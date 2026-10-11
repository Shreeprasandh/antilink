import { spawn, ChildProcess } from 'node:child_process';

export class CaffeinateManager {
  private process: ChildProcess | null = null;
  private isEnabled: boolean = false;

  constructor(autoStart: boolean = true) {
    if (autoStart && process.platform === 'darwin') {
      this.start();
    }
  }

  public start(): boolean {
    if (this.process) return true;
    if (process.platform !== 'darwin') {
      return false;
    }

    try {
      // -d: prevent display sleep
      // -i: prevent idle sleep
      // -s: prevent system sleep on AC
      // -u: declare user is active
      this.process = spawn('/usr/bin/caffeinate', ['-disu'], {
        detached: false,
        stdio: 'ignore',
      });

      this.process.on('error', () => {
        this.process = null;
        this.isEnabled = false;
      });

      this.process.on('exit', () => {
        this.process = null;
        this.isEnabled = false;
      });

      this.isEnabled = true;
      return true;
    } catch {
      this.process = null;
      this.isEnabled = false;
      return false;
    }
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
    this.isEnabled = false;
  }

  public getStatus(): boolean {
    return this.isEnabled;
  }
}
