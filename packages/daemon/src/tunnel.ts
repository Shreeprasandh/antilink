import { spawn, ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import ngrok, { Listener } from '@ngrok/ngrok';

export interface TunnelEvents {
  ready: (url: string) => void;
  error: (err: Error) => void;
  close: () => void;
}

export interface ITunnelManager extends EventEmitter {
  start(): Promise<string>;
  stop(): Promise<void> | void;
  getUrl(): string | null;
}

export interface AntilinkConfig {
  token?: string;
  tunnel?: {
    provider?: 'ngrok' | 'cloudflare';
    ngrokAuthtoken?: string;
    ngrokDomain?: string;
  };
}

export function loadAntilinkConfig(): AntilinkConfig {
  const candidatePaths = [
    path.join(process.cwd(), '.antilink_config.json'),
    path.join(os.homedir(), '.gemini', 'antilink_config.json'),
  ];

  for (const configPath of candidatePaths) {
    try {
      if (fs.existsSync(configPath)) {
        return JSON.parse(fs.readFileSync(configPath, 'utf8'));
      }
    } catch {
      // ignore
    }
  }
  return {};
}

export class CloudflareTunnelManager extends EventEmitter implements ITunnelManager {
  private process: ChildProcess | null = null;
  private tunnelUrl: string | null = null;
  private targetPort: number;

  constructor(targetPort: number) {
    super();
    this.targetPort = targetPort;
  }

  public start(): Promise<string> {
    return new Promise((resolve, reject) => {
      if (this.tunnelUrl) {
        return resolve(this.tunnelUrl);
      }

      try {
        this.process = spawn('cloudflared', ['tunnel', '--url', `http://localhost:${this.targetPort}`], {
          stdio: ['ignore', 'pipe', 'pipe'],
        });

        let resolved = false;
        const timeout = setTimeout(() => {
          if (!resolved) {
            this.emit('error', new Error('Tunnel startup timed out after 20s'));
            // Do not reject hard, allow local fallback
            resolve('');
          }
        }, 20000);

        const handleData = (chunk: Buffer) => {
          const text = chunk.toString();
          // Match https://*.trycloudflare.com
          const match = text.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
          if (match && !resolved) {
            resolved = true;
            clearTimeout(timeout);
            this.tunnelUrl = match[0];
            this.emit('ready', this.tunnelUrl);
            resolve(this.tunnelUrl);
          }
        };

        this.process.stdout?.on('data', handleData);
        this.process.stderr?.on('data', handleData);

        this.process.on('error', (err) => {
          clearTimeout(timeout);
          this.emit('error', err);
          if (!resolved) {
            resolve('');
          }
        });

        this.process.on('exit', () => {
          clearTimeout(timeout);
          this.tunnelUrl = null;
          this.process = null;
          this.emit('close');
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  public stop(): void {
    if (this.process) {
      try {
        this.process.kill('SIGTERM');
      } catch {
        // ignore
      }
      this.process = null;
    }
    this.tunnelUrl = null;
  }

  public getUrl(): string | null {
    return this.tunnelUrl;
  }
}

export class NgrokTunnelManager extends EventEmitter implements ITunnelManager {
  private listener: Listener | null = null;
  private tunnelUrl: string | null = null;
  private targetPort: number;
  private authtoken: string;
  private domain?: string;

  constructor(targetPort: number, options: { authtoken: string; domain?: string }) {
    super();
    this.targetPort = targetPort;
    this.authtoken = options.authtoken;
    this.domain = options.domain;
  }

  public async start(): Promise<string> {
    if (this.tunnelUrl) {
      return this.tunnelUrl;
    }

    try {
      this.listener = await ngrok.forward({
        addr: this.targetPort,
        authtoken: this.authtoken,
        domain: this.domain || undefined,
      });

      const url = this.listener.url();
      if (url) {
        this.tunnelUrl = url;
        this.emit('ready', this.tunnelUrl);
        return this.tunnelUrl;
      }
      return '';
    } catch (err: any) {
      this.emit('error', err instanceof Error ? err : new Error(String(err)));
      return '';
    }
  }

  public async stop(): Promise<void> {
    if (this.listener) {
      try {
        await this.listener.close();
      } catch {
        // ignore
      }
      this.listener = null;
    }
    this.tunnelUrl = null;
    this.emit('close');
  }

  public getUrl(): string | null {
    return this.tunnelUrl;
  }
}

export function createTunnelManager(
  targetPort: number,
  preferredProvider?: 'ngrok' | 'cloudflare'
): ITunnelManager {
  const config = loadAntilinkConfig();
  const provider = preferredProvider || process.env.ANTILINK_TUNNEL_PROVIDER || config.tunnel?.provider;
  const ngrokToken = process.env.NGROK_AUTHTOKEN || config.tunnel?.ngrokAuthtoken;
  const ngrokDomain = process.env.NGROK_DOMAIN || config.tunnel?.ngrokDomain;

  if (provider === 'ngrok' || (!preferredProvider && ngrokToken)) {
    if (ngrokToken) {
      return new NgrokTunnelManager(targetPort, {
        authtoken: ngrokToken,
        domain: ngrokDomain,
      });
    }
  }

  return new CloudflareTunnelManager(targetPort);
}

