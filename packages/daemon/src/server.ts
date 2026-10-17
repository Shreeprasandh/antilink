import * as http from 'node:http';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as url from 'node:url';
import * as crypto from 'node:crypto';
import { exec, execSync } from 'node:child_process';
import { WebSocketServer, WebSocket } from 'ws';
import type {
  AntilinkClientMessage,
  AntilinkServerMessage,
  AntilinkInitialState,
  ToolConfirmationResponse,
  QueuedPrompt,
} from '@antilink/shared';
import { ReverseProxyManager } from './reverseProxy.js';
import { PortScanner } from './portScanner.js';
import { CaffeinateManager } from './caffeinate.js';
import { TelemetryCollector } from './telemetry.js';
import { AgentBridge } from './agentBridge.js';
import { DeviceSecurityManager } from './security.js';
import { loadAntilinkConfig } from './tunnel.js';

export interface ServerOptions {
  port: number;
  token?: string;
  staticDir?: string;
  tunnelUrl?: string | null;
}

export class AntilinkDaemonServer {
  private port: number;
  private token: string;
  private staticDir: string;
  private tunnelUrl: string | null = null;
  private server: http.Server;
  private wss: WebSocketServer;
  private connectedSockets: Set<WebSocket> = new Set();
  private promptQueue: QueuedPrompt[] = [];

  private reverseProxy: ReverseProxyManager;
  private portScanner: PortScanner;
  private caffeinate: CaffeinateManager;
  private telemetry: TelemetryCollector;
  private agentBridge: AgentBridge;
  public security: DeviceSecurityManager;

  constructor(options: ServerOptions) {
    this.port = options.port;
    const config = loadAntilinkConfig();
    this.token = options.token || config.token || 'fab4b0b4cbb7';
    this.tunnelUrl = options.tunnelUrl || null;
    this.staticDir = options.staticDir || path.resolve(process.cwd(), 'apps/web/out');

    this.reverseProxy = new ReverseProxyManager();
    this.portScanner = new PortScanner();
    this.caffeinate = new CaffeinateManager(true);
    this.telemetry = new TelemetryCollector();
    this.agentBridge = new AgentBridge();
    this.security = new DeviceSecurityManager();

    this.server = http.createServer((req, res) => this.handleRequest(req, res));
    this.wss = new WebSocketServer({ noServer: true });

    this.setupWebSockets();
    this.setupAgentBridge();
  }

  public setTunnelUrl(url: string | null): void {
    this.tunnelUrl = url;
    this.broadcast({
      type: 'TUNNEL_UPDATED',
      tunnelUrl: url,
    });
  }

  public getToken(): string {
    return this.token;
  }

  public getPort(): number {
    return this.port;
  }

  public async start(): Promise<void> {
    this.agentBridge.init();
    await this.portScanner.scan();

    return new Promise((resolve) => {
      this.server.listen(this.port, '0.0.0.0', () => {
        this.setupBackgroundPolling();
        resolve();
      });

      this.server.on('upgrade', (req, socket, head) => {
        const parsed = url.parse(req.url || '');
        if (parsed.pathname === '/ws') {
          this.wss.handleUpgrade(req, socket, head, (ws) => {
            this.wss.emit('connection', ws, req);
          });
        } else if (parsed.pathname?.startsWith('/preview/')) {
          const match = parsed.pathname.match(/^\/preview\/(\d+)(.*)/);
          if (match) {
            const targetPort = parseInt(match[1], 10);
            this.reverseProxy.handleWebSocketUpgrade(req, socket, head, targetPort);
          }
        }
      });
    });
  }

  public stop(): void {
    try {
      this.broadcast({
        type: 'SESSION_ENDED',
        reason: 'Host terminal session closed',
      });
    } catch {
      // ignore
    }
    this.caffeinate.stop();
    this.agentBridge.stop();
    this.wss.close();
    this.server.close();
  }

  private handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    const parsedUrl = url.parse(req.url || '', true);
    const pathname = parsedUrl.pathname || '/';

    // CORS headers for cross-origin mobile connections
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // Dev Server Reverse Proxy: /preview/:port/*
    if (pathname.startsWith('/preview/')) {
      const match = pathname.match(/^\/preview\/(\d+)(.*)/);
      if (match) {
        const targetPort = parseInt(match[1], 10);
        const subPath = match[2] || '/';
        this.reverseProxy.handleHttpRequest(req, res, targetPort, subPath);
        return;
      }
    }

    // Health API
    if (pathname === '/api/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          status: 'ok',
          uptime: process.uptime(),
          machine: this.telemetry.getTelemetry(this.caffeinate.getStatus()).hostname,
        })
      );
      return;
    }

    // Initial State API
    if (pathname === '/api/state') {
      // Validate token if provided
      const reqToken = req.headers.authorization?.replace('Bearer ', '') || parsedUrl.query.token;
      if (reqToken !== this.token) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized' }));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(this.getInitialState()));
      return;
    }

    // Direct file upload to workspace uploads/ folder
    if (pathname === '/api/upload' && req.method === 'POST') {
      const reqToken = req.headers.authorization?.replace('Bearer ', '') || parsedUrl.query.token;
      if (reqToken !== this.token) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized' }));
        return;
      }

      const rawFilename = (parsedUrl.query.filename as string) || (req.headers['x-filename'] as string) || `upload_${Date.now()}`;
      const safeFilename = path.basename(decodeURIComponent(rawFilename)).replace(/[^a-zA-Z0-9._-]/g, '_');
      const uploadDir = path.join(process.cwd(), 'uploads');

      try {
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }

        const targetPath = path.join(uploadDir, safeFilename);
        const writeStream = fs.createWriteStream(targetPath);
        let bytesReceived = 0;

        req.on('data', (chunk) => {
          bytesReceived += chunk.length;
        });

        req.pipe(writeStream);

        writeStream.on('finish', () => {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              success: true,
              filePath: targetPath,
              fileName: safeFilename,
              size: bytesReceived,
            })
          );
        });

        writeStream.on('error', (err) => {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        });
      } catch (err: unknown) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: (err as Error).message }));
      }
      return;
    }

    // Serve Static Web PWA files
    this.serveStaticFile(pathname, res);
  }

  private serveStaticFile(pathname: string, res: http.ServerResponse): void {
    let filePath = path.join(this.staticDir, pathname === '/' ? 'index.html' : pathname);

    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(this.staticDir, 'index.html');
    }

    if (!fs.existsSync(filePath)) {
      // Return embedded Palenight fallback shell if Next.js export is not yet compiled
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(this.getEmbeddedFallbackHtml());
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.html': 'text/html',
      '.js': 'application/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.png': 'image/png',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon',
    };

    const contentType = mimeTypes[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  }

  private setupWebSockets(): void {
    this.wss.on('connection', (ws, req) => {
      const parsed = url.parse(req.url || '', true);
      const queryToken = parsed.query.token as string | undefined;
      const queryDeviceId = parsed.query.deviceId as string | undefined;
      const queryDeviceName = (parsed.query.deviceName as string) || 'Browser Companion';
      const queryPin = parsed.query.pin as string | undefined;

      const rawIp =
        (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
        req.socket.remoteAddress ||
        '127.0.0.1';
      const clientIp = rawIp.replace(/^.*:/, '').trim() || '127.0.0.1';

      if (this.security.isRateLimited(clientIp)) {
        this.sendTo(ws, {
          type: 'AUTH_FAILED',
          error: 'IP temporarily locked out due to multiple failed security attempts. Please wait 15 minutes.',
        });
        ws.close();
        return;
      }

      const session = {
        ip: clientIp,
        tokenAuthenticated: queryToken === this.token,
        deviceId: queryDeviceId || '',
        deviceName: queryDeviceName,
        devicePaired: queryDeviceId ? this.security.isDevicePaired(queryDeviceId) : false,
        pinVerified: queryPin ? this.security.verifyPin(queryPin) : false,
        pinError: undefined as string | undefined,
      };

      if (queryDeviceId) {
        this.evaluateAndAuthorize(ws, session);
      }

      ws.on('message', (raw) => {
        try {
          const msg = JSON.parse(raw.toString()) as AntilinkClientMessage;

          if (msg.type === 'DEVICE_HANDSHAKE') {
            session.deviceId = msg.deviceId;
            session.deviceName = msg.deviceName || session.deviceName;
            session.devicePaired = this.security.isDevicePaired(msg.deviceId);
            if (msg.token && msg.token === this.token) {
              session.tokenAuthenticated = true;
            }
            if (msg.pin) {
              session.pinVerified = this.security.verifyPin(msg.pin);
            }
            this.evaluateAndAuthorize(ws, session);
            return;
          }

          if (msg.type === 'PAIR_VERIFY') {
            const success = this.security.verifyPairingCode(msg.deviceId, msg.code, session.ip);
            if (success) {
              session.devicePaired = true;
              session.tokenAuthenticated = true;
              session.deviceId = msg.deviceId;
              this.evaluateAndAuthorize(ws, session);
            } else {
              this.sendTo(ws, {
                type: 'PAIR_CHALLENGE',
                deviceId: msg.deviceId,
                deviceName: session.deviceName,
                message: 'Invalid pairing code. Please check your Mac terminal screen.',
              });
            }
            return;
          }

          if (msg.type === 'PIN_VERIFY') {
            if (this.security.verifyPin(msg.pin)) {
              session.pinVerified = true;
              session.pinError = undefined;
              this.evaluateAndAuthorize(ws, session);
            } else {
              this.security.recordFailedAttempt(session.ip);
              this.sendTo(ws, {
                type: 'PIN_REQUIRED',
                error: 'Incorrect Master PIN. Please try again.',
              });
            }
            return;
          }

          if (msg.type === 'AUTH') {
            if (msg.token === this.token) {
              session.tokenAuthenticated = true;
            }
            this.evaluateAndAuthorize(ws, session);
            return;
          }

          // Strict gate: No client operations permitted until both hardware paired and PIN verified
          if (!session.devicePaired || !session.pinVerified) {
            this.evaluateAndAuthorize(ws, session);
            return;
          }

          this.handleClientMessage(msg, ws);
        } catch {
          // ignore malformed messages
        }
      });

      ws.on('close', () => {
        this.connectedSockets.delete(ws);
      });
    });
  }

  private evaluateAndAuthorize(
    ws: WebSocket,
    session: {
      ip: string;
      tokenAuthenticated: boolean;
      deviceId: string;
      deviceName: string;
      devicePaired: boolean;
      pinVerified: boolean;
      pinError?: string;
    }
  ): void {
    // Tier 1: Hardware Device Pairing Check
    if (!session.devicePaired) {
      if (!session.deviceId) {
        this.sendTo(ws, { type: 'AUTH_FAILED', error: 'Missing device hardware identity' });
        return;
      }

      this.security.createPairingChallenge(
        session.deviceId,
        session.deviceName,
        session.ip,
        () => {
          session.devicePaired = true;
          session.tokenAuthenticated = true;
          this.evaluateAndAuthorize(ws, session);
        }
      );

      this.sendTo(ws, {
        type: 'PAIR_CHALLENGE',
        deviceId: session.deviceId,
        deviceName: session.deviceName,
        message: 'Please enter the 6-digit pairing code displayed on your Mac terminal screen, or press y on your Mac keyboard.',
      });
      return;
    }

    // Active session authorized once device pairing is approved
    session.tokenAuthenticated = true;

    // Tier 2: Master Security PIN Check
    if (!session.pinVerified) {
      this.sendTo(ws, {
        type: 'PIN_REQUIRED',
        error: session.pinError,
      });
      return;
    }

    // Both Tier 1 (Device Pairing) and Tier 2 (Master PIN) verified!
    this.security.resetFailedAttempts(session.ip);
    this.security.touchDevice(session.deviceId, session.ip);
    this.connectedSockets.add(ws);

    this.sendTo(ws, {
      type: 'AUTH_SUCCESS',
      session: {
        paired: true,
        machineName: this.telemetry.getTelemetry(this.caffeinate.getStatus()).hostname,
      },
    });

    this.sendTo(ws, {
      type: 'INITIAL_STATE',
      data: this.getInitialState(),
    });
  }

  private handleClientMessage(msg: AntilinkClientMessage, ws: WebSocket): void {
    switch (msg.type) {
      case 'GET_STATE':
        this.sendTo(ws, {
          type: 'INITIAL_STATE',
          data: this.getInitialState(),
        });
        break;

      case 'SWITCH_CONVERSATION':
        if (this.agentBridge.switchConversation(msg.conversationId)) {
          this.broadcast({
            type: 'INITIAL_STATE',
            data: this.getInitialState(),
          });
        }
        break;

      case 'KILL_TASK':
        exec(`kill ${msg.taskId}`, () => {
          this.broadcast({
            type: 'TASKS_UPDATED',
            tasks: this.agentBridge.getTasks(),
          });
        });
        break;

      case 'TOGGLE_CAFFEINATE':
        if (msg.enable) {
          this.caffeinate.start();
        } else {
          this.caffeinate.stop();
        }
        this.broadcast({
          type: 'TELEMETRY_UPDATED',
          telemetry: this.telemetry.getTelemetry(this.caffeinate.getStatus()),
        });
        break;

      case 'SCAN_PORTS':
        this.portScanner.scan().then((ports) => {
          this.broadcast({
            type: 'PORTS_UPDATED',
            ports,
          });
        });
        break;

      case 'EXEC_COMMAND':
        exec(msg.command, { cwd: process.cwd() }, (err, stdout, stderr) => {
          this.sendTo(ws, {
            type: 'COMMAND_OUTPUT',
            output: stdout || stderr || (err ? err.message : 'Command executed successfully'),
            exitCode: err ? (err.code || 1) : 0,
          });
        });
        break;

      case 'SEND_PROMPT': {
        const prompt = msg.prompt.trim();
        if (!prompt) break;

        // If Luna is actively working on a task, queue the prompt until current turn finishes
        if (this.agentBridge.isAgentWorking()) {
          const queued: QueuedPrompt = {
            id: `queue-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
            text: prompt,
            timestamp: new Date().toISOString(),
            conversationId: this.agentBridge.getActiveConversationId() || '',
          };
          this.promptQueue.push(queued);
          this.broadcast({
            type: 'PROMPT_QUEUE_UPDATED',
            queue: this.promptQueue,
          });
          this.sendTo(ws, {
            type: 'COMMAND_OUTPUT',
            output: `Prompt waiting in queue (will send when Luna finishes current task): "${prompt}"`,
            exitCode: 0,
          });
          break;
        }

        // Luna is idle: dispatch prompt immediately
        this.agentBridge.notifyAgentStarted();
        this.dispatchAgentMessage(prompt, (err) => {
          this.sendTo(ws, {
            type: 'COMMAND_OUTPUT',
            output: err ? `Error delivering prompt to Luna: ${err.message}` : `Delivered to Luna: "${prompt}"`,
            exitCode: err ? 1 : 0,
          });
        });
        break;
      }

      case 'CANCEL_QUEUED_PROMPT': {
        this.promptQueue = this.promptQueue.filter((p) => p.id !== msg.promptId);
        this.broadcast({
          type: 'PROMPT_QUEUE_UPDATED',
          queue: this.promptQueue,
        });
        break;
      }

      case 'TOOL_CONFIRM': {
        const payload = msg.payload;
        // Map to exact terminal menu choice: 1, 2, 3, or 4
        let choice = '1';
        if (payload.optionNumber && [1, 2, 3, 4].includes(payload.optionNumber)) {
          choice = String(payload.optionNumber);
        } else if (payload.approved === false) {
          choice = '4'; // No, cancel
        } else {
          choice = '1'; // Yes, run command
        }

        // Always persist approved command prefix to settings.json for uninterrupted future runs
        if (choice === '1' || choice === '2' || choice === '3') {
          this.persistAllowedCommand(payload.commandLine);
        }

        // 1. Inject option number into the active terminal
        this.injectKeystrokeToTerminal(choice, true);

        // 2. Broadcast confirmation feedback
        this.broadcast({
          type: 'COMMAND_OUTPUT',
          output: `Selected Option [${choice}] for step #${payload.stepIdx} via Antilink`,
          exitCode: 0,
        });
        break;
      }
    }
  }

  private persistAllowedCommand(cmd?: string): void {
    if (!cmd) return;
    try {
      const clean = cmd.replace(/^["']|["']$/g, '').trim();
      if (!clean) return;
      const settingsPath = path.join(os.homedir(), '.gemini', 'antigravity-cli', 'settings.json');
      if (fs.existsSync(settingsPath)) {
        const data = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
        if (!data.permissions) data.permissions = {};
        if (!Array.isArray(data.permissions.allow)) data.permissions.allow = [];

        const tokens = clean.split(/\s+/);
        const prefix = tokens.length > 2 ? tokens.slice(0, 3).join(' ') : clean;
        const rule = `command(${prefix})`;

        if (!data.permissions.allow.includes(rule)) {
          data.permissions.allow.push(rule);
          fs.writeFileSync(settingsPath, JSON.stringify(data, null, 2), 'utf8');
        }
      }
    } catch {
      // ignore
    }
  }

  private injectKeystrokeToTerminal(text: string, hitReturn: boolean = true): void {
    try {
      const escaped = text.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      // Direct menu click 'View > Terminal' focuses the terminal without popping command palettes or searching
      const script = `osascript -e '
tell application "System Events"
  set prevApp to ""
  try
    set prevApp to name of first process whose frontmost is true
  end try
  tell application "Visual Studio Code" to activate
  delay 0.1
  tell process "Code"
    try
      click menu item "Terminal" of menu "View" of menu bar 1
    end try
    delay 0.1
    keystroke "${escaped}"
    ${hitReturn ? 'delay 0.05\nkey code 36' : ''}
  end tell
  delay 0.08
  if prevApp is not "" and prevApp is not "Code" and prevApp is not "Visual Studio Code" then
    try
      tell application prevApp to activate
    end try
  end if
end tell
'`;
      exec(script, (err) => {
        if (err) {
          const fallback = `osascript -e 'tell application "Visual Studio Code" to activate' -e 'delay 0.08' -e 'tell application "System Events" to keystroke "${escaped}"' ${hitReturn ? "-e 'delay 0.05' -e 'tell application \"System Events\" to key code 36'" : ''}`;
          exec(fallback);
        }
      });
    } catch {
      // ignore
    }
  }

  private dispatchAgentMessage(content: string, callback?: (err: Error | null) => void): void {
    const activeConvId = this.agentBridge.getActiveConversationId();
    if (!activeConvId) {
      if (callback) callback(new Error('No active conversation'));
      return;
    }
    const escaped = content.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    exec(`/Users/shreeprasandhk/.local/bin/agy agentapi send-message "${activeConvId}" "${escaped}"`, (err) => {
      if (callback) callback(err);
    });
  }

  private processNextQueuedPrompt(): void {
    if (this.promptQueue.length === 0) return;

    const nextPrompt = this.promptQueue.shift();
    if (!nextPrompt) return;

    this.broadcast({
      type: 'PROMPT_QUEUE_UPDATED',
      queue: this.promptQueue,
    });

    // Small debounce (350ms) to ensure Cascade CLI input prompt has fully stabilized
    setTimeout(() => {
      this.agentBridge.notifyAgentStarted();
      this.dispatchAgentMessage(nextPrompt.text, (err) => {
        this.broadcast({
          type: 'COMMAND_OUTPUT',
          output: err
            ? `Error delivering queued prompt to Luna: ${err.message}`
            : `Queued prompt sent to Luna: "${nextPrompt.text}"`,
          exitCode: err ? 1 : 0,
        });
      });
    }, 350);
  }

  private setupAgentBridge(): void {
    this.agentBridge.on('step_added', (step) => {
      this.broadcast({
        type: 'AGENT_STEP_ADDED',
        step,
      });
      this.broadcast({
        type: 'ARTIFACTS_UPDATED',
        artifacts: this.agentBridge.getArtifacts(),
      });
    });

    this.agentBridge.on('tool_confirmation', (payload) => {
      this.broadcast({
        type: 'TOOL_CONFIRM_REQUEST',
        payload,
      });
    });

    this.agentBridge.on('tool_confirmation_resolved', ({ stepIdx }) => {
      this.broadcast({
        type: 'TOOL_CONFIRM_RESOLVED',
        stepIdx,
      });
    });

    this.agentBridge.on('agent_idle', () => {
      this.processNextQueuedPrompt();
    });

    this.agentBridge.on('agent_status_changed', (isWorking) => {
      this.broadcast({
        type: 'AGENT_STATUS_CHANGED',
        isWorking,
      });
    });
  }

  private setupBackgroundPolling(): void {
    // Scan ports every 3 seconds
    setInterval(async () => {
      const ports = await this.portScanner.scan();
      this.broadcast({
        type: 'PORTS_UPDATED',
        ports,
      });
    }, 3000);

    // Stream telemetry every 2 seconds
    setInterval(() => {
      const telem = this.telemetry.getTelemetry(this.caffeinate.getStatus());
      this.broadcast({
        type: 'TELEMETRY_UPDATED',
        telemetry: telem,
      });
    }, 2000);

    // Refresh conversation list every 5 seconds
    setInterval(() => {
      this.broadcast({
        type: 'CONVERSATIONS_UPDATED',
        conversations: this.agentBridge.getConversations(),
      });
    }, 5000);
  }

  private getUserProfile(): { userName: string; userEmail: string; assistantName: string } {
    let userName = 'Operator';
    let userEmail = '';
    try {
      const gitName = execSync('git config user.name', { encoding: 'utf8' }).trim();
      if (gitName) userName = gitName;
    } catch {
      try {
        userName = os.userInfo().username || 'Operator';
      } catch {
        // ignore
      }
    }
    try {
      const gitEmail = execSync('git config user.email', { encoding: 'utf8' }).trim();
      if (gitEmail) userEmail = gitEmail;
    } catch {
      // ignore
    }
    return {
      userName,
      userEmail,
      assistantName: 'Luna',
    };
  }

  private getInitialState(): AntilinkInitialState {
    const telem = this.telemetry.getTelemetry(this.caffeinate.getStatus());
    return {
      machineName: telem.hostname,
      activeConversationTitle: this.agentBridge.getActiveConversationTitle(),
      tunnelUrl: this.tunnelUrl,
      localUrl: `http://localhost:${this.port}`,
      ports: this.portScanner.getActivePorts(),
      telemetry: telem,
      activeConversationId: this.agentBridge.getActiveConversationId(),
      conversations: this.agentBridge.getConversations(),
      subagents: this.agentBridge.getSubagents(),
      tasks: this.agentBridge.getTasks(),
      artifacts: this.agentBridge.getArtifacts(),
      recentSteps: this.agentBridge.getRecentSteps(),
      isAgentWorking: this.agentBridge.isAgentWorking(),
      promptQueue: this.promptQueue,
      activeConfirmation: this.agentBridge.getActiveConfirmation(),
      userProfile: this.getUserProfile(),
    };
  }

  private sendTo(ws: WebSocket, msg: AntilinkServerMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }

  private broadcast(msg: AntilinkServerMessage): void {
    const payload = JSON.stringify(msg);
    for (const ws of this.connectedSockets) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      }
    }
  }

  private getEmbeddedFallbackHtml(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, interactive-widget=resizes-content">
  <title>Antilink Mobile Cockpit</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: #292D3E;
      color: #A6ACCD;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace;
      min-height: 100dvh;
      display: flex;
      flex-direction: column;
    }
    header {
      background-color: #1B1E2B;
      border-bottom: 1px solid #2E3245;
      padding: 12px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .logo {
      color: #EEFFFF;
      font-weight: 700;
      font-size: 1.1rem;
      letter-spacing: 0.5px;
    }
    .badge {
      background-color: #232635;
      border: 1px solid #2E3245;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 0.75rem;
      color: #C3E88D;
    }
    main {
      flex: 1;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .card {
      background-color: #232635;
      border: 1px solid #2E3245;
      border-radius: 6px;
      padding: 16px;
    }
    .card-title {
      color: #C792EA;
      font-size: 0.85rem;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 8px;
    }
    .port-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 0;
      border-bottom: 1px solid #2E3245;
    }
    .port-item:last-child { border-bottom: none; }
    .btn {
      background-color: #82AAFF;
      color: #1B1E2B;
      border: none;
      padding: 6px 12px;
      border-radius: 4px;
      font-weight: 600;
      font-size: 0.8rem;
      cursor: pointer;
    }
    .stream {
      background-color: #1B1E2B;
      border: 1px solid #2E3245;
      border-radius: 6px;
      padding: 12px;
      flex: 1;
      overflow-y: auto;
      font-size: 0.8rem;
      line-height: 1.5;
    }
  </style>
</head>
<body>
  <header>
    <div class="logo">ANTILINK</div>
    <div class="badge" id="status-badge">Connecting...</div>
  </header>
  <main>
    <div class="card">
      <div class="card-title">Live Dev Ports</div>
      <div id="ports-list">Scanning local interfaces...</div>
    </div>
    <div class="card" style="flex: 1; display: flex; flex-direction: column;">
      <div class="card-title">Agent Telemetry Stream</div>
      <div class="stream" id="stream-box">Waiting for agent activity...</div>
    </div>
  </main>
  <script>
    const token = new URLSearchParams(window.location.search).get('token') || '';
    const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(wsProto + '//' + window.location.host + '/ws?token=' + token);
    const badge = document.getElementById('status-badge');
    const portsList = document.getElementById('ports-list');
    const streamBox = document.getElementById('stream-box');

    ws.onopen = () => {
      badge.textContent = 'Connected (Live)';
      badge.style.color = '#C3E88D';
    };
    ws.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.type === 'PORTS_UPDATED' || (data.type === 'INITIAL_STATE' && data.data.ports)) {
        const ports = data.ports || data.data.ports;
        if (ports.length === 0) {
          portsList.innerHTML = '<div style="color: #676E95; font-size: 0.8rem;">No open dev servers found. Launch Next.js or Vite.</div>';
        } else {
          portsList.innerHTML = ports.map(p => 
            '<div class="port-item"><div><span style="color: #89DDFF; font-weight: bold;">:' + p.port + '</span> <span style="font-size: 0.8rem; color: #EEFFFF;">' + p.name + '</span></div><a class="btn" style="text-decoration: none;" href="/preview/' + p.port + '/" target="_blank">Open Preview</a></div>'
          ).join('');
        }
      }
      if (data.type === 'AGENT_STEP_ADDED') {
        const item = document.createElement('div');
        item.style.marginBottom = '8px';
        item.innerHTML = '<span style="color: #FFCB6B;">[' + data.step.type + ']</span> <span style="color: #EEFFFF;">' + (data.step.content ? data.step.content.slice(0, 140) : (data.step.thinking ? 'Thinking...' : 'Step ' + data.step.stepIndex)) + '</span>';
        streamBox.appendChild(item);
        streamBox.scrollTop = streamBox.scrollHeight;
      }
    };
    ws.onclose = () => {
      badge.textContent = 'Disconnected';
      badge.style.color = '#FF5370';
    };
  </script>
</body>
</html>`;
  }
}
