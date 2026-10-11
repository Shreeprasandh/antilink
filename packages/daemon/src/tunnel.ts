import { spawn, ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';

export interface TunnelEvents {
  ready: (url: string) => void;
  error: (err: Error) => void;
  close: () => void;
}

export class CloudflareTunnelManager extends EventEmitter {
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
