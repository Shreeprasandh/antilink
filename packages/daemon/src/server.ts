import * as http from 'node:http';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as url from 'node:url';
import * as crypto from 'node:crypto';
import { exec } from 'node:child_process';
import { WebSocketServer, WebSocket } from 'ws';
import type {
  AntilinkClientMessage,
  AntilinkServerMessage,
  AntilinkInitialState,
  ToolConfirmationResponse,
} from '@antilink/shared';
import { ReverseProxyManager } from './reverseProxy.js';
import { PortScanner } from './portScanner.js';
import { CaffeinateManager } from './caffeinate.js';
import { TelemetryCollector } from './telemetry.js';
import { AgentBridge } from './agentBridge.js';

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

  private reverseProxy: ReverseProxyManager;
  private portScanner: PortScanner;
  private caffeinate: CaffeinateManager;
  private telemetry: TelemetryCollector;
  private agentBridge: AgentBridge;

  constructor(options: ServerOptions) {
    this.port = options.port;
    this.token = options.token || crypto.randomBytes(6).toString('hex');
    this.tunnelUrl = options.tunnelUrl || null;
    this.staticDir = options.staticDir || path.resolve(process.cwd(), 'apps/web/out');

    this.reverseProxy = new ReverseProxyManager();
    this.portScanner = new PortScanner();
    this.caffeinate = new CaffeinateManager(true);
    this.telemetry = new TelemetryCollector();
    this.agentBridge = new AgentBridge();

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

      let authenticated = queryToken === this.token;

      if (authenticated) {
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

      ws.on('message', (raw) => {
        try {
          const msg = JSON.parse(raw.toString()) as AntilinkClientMessage;

          if (msg.type === 'AUTH') {
            if (msg.token === this.token) {
              authenticated = true;
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
            } else {
              this.sendTo(ws, {
                type: 'AUTH_FAILED',
                error: 'Invalid authentication token',
              });
            }
            return;
          }

          if (!authenticated) {
            this.sendTo(ws, { type: 'AUTH_FAILED', error: 'Authentication required' });
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

        // If shell command, execute directly
        if (/^(git|npm|node|pnpm|cargo|curl)\b/.test(prompt)) {
          exec(prompt, { cwd: process.cwd() }, (err, stdout, stderr) => {
            this.sendTo(ws, {
              type: 'COMMAND_OUTPUT',
              output: stdout || stderr || (err ? err.message : 'Command executed successfully'),
              exitCode: err ? (err.code || 1) : 0,
            });
          });
          break;
        }

        // 1. Inject keystroke into VS Code terminal (key code 36 = Return)
        this.injectKeystrokeToTerminal(prompt, true);

        // 2. Dispatch via agy agentapi send-message
        this.dispatchAgentMessage(prompt, (err) => {
          this.sendTo(ws, {
            type: 'COMMAND_OUTPUT',
            output: err ? `Injected to terminal: "${prompt}"` : `Delivered to Luna: "${prompt}"`,
            exitCode: 0,
          });
        });
        break;
      }

      case 'TOOL_CONFIRM': {
        const payload = msg.payload;
        const answer = payload.approved ? 'yes' : 'no';

        // 1. Inject "yes" or "no" + Return into active terminal
        this.injectKeystrokeToTerminal(answer, true);

        // 2. Dispatch note to agent
        const note = payload.approved
          ? `[Antilink Remote Control] User APPROVED action for step #${payload.stepIdx}`
          : `[Antilink Remote Control] User DENIED action for step #${payload.stepIdx}`;
        this.dispatchAgentMessage(note);

        // 3. Broadcast confirmation feedback
        this.broadcast({
          type: 'COMMAND_OUTPUT',
          output: `Step #${payload.stepIdx} ${payload.approved ? 'APPROVED' : 'DENIED'} via Antilink`,
          exitCode: 0,
        });
        break;
      }
    }
  }

  private injectKeystrokeToTerminal(text: string, hitReturn: boolean = true): void {
    try {
      const escaped = text.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      const returnClause = hitReturn
        ? `-e 'tell application "System Events" to tell process "Code" to key code 36'`
        : '';
      const script = `osascript -e 'tell application "System Events" to tell process "Code" to keystroke "${escaped}"' ${returnClause}`;
      exec(script, (err) => {
        if (err) {
          const scriptWithActivate = `osascript -e 'tell application "Visual Studio Code" to activate' -e 'tell application "System Events" to tell process "Code" to keystroke "${escaped}"' ${returnClause}`;
          exec(scriptWithActivate);
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
