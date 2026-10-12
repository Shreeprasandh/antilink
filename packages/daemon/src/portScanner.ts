import * as net from 'node:net';
import type { DiscoveredPort } from '@antilink/shared';

const CANDIDATE_PORTS = [
  { port: 3000, name: 'Frontend (Next.js / React)', serviceType: 'frontend' as const },
  { port: 3001, name: 'Frontend Alt', serviceType: 'frontend' as const },
  { port: 5173, name: 'Vite Dev Server', serviceType: 'frontend' as const },
  { port: 5174, name: 'Vite Alt', serviceType: 'frontend' as const },
  { port: 8000, name: 'Backend API (FastAPI / Django)', serviceType: 'api' as const },
  { port: 8080, name: 'Backend HTTP API', serviceType: 'api' as const },
  { port: 4000, name: 'GraphQL / Node API', serviceType: 'api' as const },
  { port: 5000, name: 'Flask / Express API', serviceType: 'api' as const },
  { port: 54323, name: 'Supabase Studio', serviceType: 'database' as const },
  { port: 5555, name: 'Prisma Studio', serviceType: 'database' as const },
];

export class PortScanner {
  private customPorts: number[] = [];
  private activePorts: DiscoveredPort[] = [];

  constructor(customPorts: number[] = []) {
    this.customPorts = customPorts;
  }

  public addCustomPort(port: number): void {
    if (!this.customPorts.includes(port)) {
      this.customPorts.push(port);
    }
  }

  private checkPort(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(250);

      socket.on('connect', () => {
        socket.destroy();
        resolve(true);
      });

      socket.on('timeout', () => {
        socket.destroy();
        resolve(false);
      });

      socket.on('error', () => {
        socket.destroy();
        resolve(false);
      });

      socket.connect(port, '127.0.0.1');
    });
  }

  private async isDevServer(port: number): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 350);
      const res = await fetch(`http://127.0.0.1:${port}/`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const serverHeader = res.headers.get('server') || '';
      // Exclude Apple AirPlay / AirTunes system daemons on port 5000 / 7000
      if (serverHeader.toLowerCase().includes('airtunes')) {
        return false;
      }
      return true;
    } catch {
      // If it responded to TCP but refused HTTP on known macOS system ports, ignore
      if (port === 5000 || port === 7000) return false;
      return true;
    }
  }

  public async scan(): Promise<DiscoveredPort[]> {
    const allCandidates = [
      ...CANDIDATE_PORTS,
      ...this.customPorts
        .filter((cp) => !CANDIDATE_PORTS.some((p) => p.port === cp))
        .map((cp) => ({
          port: cp,
          name: `Custom Port ${cp}`,
          serviceType: 'custom' as const,
        })),
    ];

    const results: DiscoveredPort[] = [];

    await Promise.all(
      allCandidates.map(async (candidate) => {
        const isOpen = await this.checkPort(candidate.port);
        if (isOpen) {
          const isDev = await this.isDevServer(candidate.port);
          if (!isDev) return;

          results.push({
            port: candidate.port,
            name: candidate.name,
            isOpen: true,
            serviceType: candidate.serviceType,
            url: `http://localhost:${candidate.port}`,
            previewPath: `/preview/${candidate.port}/`,
          });
        }
      })
    );

    // Sort by port number
    results.sort((a, b) => a.port - b.port);
    this.activePorts = results;
    return results;
  }

  public getActivePorts(): DiscoveredPort[] {
    return this.activePorts;
  }
}
