import * as os from 'node:os';
import qrcode from 'qrcode-terminal';
import { AntilinkDaemonServer } from './server.js';
import { CloudflareTunnelManager } from './tunnel.js';

export interface CliFlags {
  port: number;
  enableTunnel: boolean;
  enableCaffeinate: boolean;
}

export async function runDaemon(flags: Partial<CliFlags> = {}): Promise<void> {
  const port = flags.port || 4040;
  const enableTunnel = flags.enableTunnel !== false;

  console.log('\x1b[38;2;199;146;234m' + '==================================================' + '\x1b[0m');
  console.log('\x1b[38;2;137;221;255m' + '   ANTILINK: Google Antigravity Remote Cockpit   ' + '\x1b[0m');
  console.log('\x1b[38;2;103;110;149m' + '      VS Code Palenight Edition | Sub-50ms Sync    ' + '\x1b[0m');
  console.log('\x1b[38;2;199;146;234m' + '==================================================' + '\x1b[0m\n');

  const server = new AntilinkDaemonServer({ port });
  await server.start();

  const token = server.getToken();
  const localUrl = `http://localhost:${port}/?token=${token}`;

  // Get local network LAN IP for same-Wi-Fi phones
  const interfaces = os.networkInterfaces();
  let lanIp = 'localhost';
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        lanIp = net.address;
        break;
      }
    }
  }
  const lanUrl = `http://${lanIp}:${port}/?token=${token}`;

  console.log('\x1b[38;2;195;232;141m[OK]\x1b[0m Daemon active on port ' + port);
  console.log('\x1b[38;2;130;170;255mLocal:\x1b[0m   ' + localUrl);
  console.log('\x1b[38;2;130;170;255mWi-Fi:\x1b[0m   ' + lanUrl);

  let activeAccessUrl = lanUrl;

  if (enableTunnel) {
    console.log('\x1b[38;2;247;140;108m[TUNNEL]\x1b[0m Provisioning Cloudflare Quick Tunnel...');
    const tunnel = new CloudflareTunnelManager(port);
    try {
      const publicUrl = await tunnel.start();
      if (publicUrl) {
        const fullPublicUrl = `${publicUrl}/?token=${token}`;
        server.setTunnelUrl(publicUrl);
        activeAccessUrl = fullPublicUrl;
        console.log('\x1b[38;2;195;232;141m[OK]\x1b[0m Public HTTPS Tunnel Ready:');
        console.log('\x1b[38;2;137;221;255m\x1b[1m' + fullPublicUrl + '\x1b[0m\n');
      } else {
        console.log('\x1b[38;2;255;203;107m[NOTE]\x1b[0m Cloudflare tunnel skipped or timed out. Use Wi-Fi URL.');
      }
    } catch {
      console.log('\x1b[38;2;255;203;107m[NOTE]\x1b[0m Tunnel provisioning failed. Using Wi-Fi URL.');
    }
  }

  console.log('\x1b[38;2;103;110;149mScan with your mobile camera to launch Antilink:\x1b[0m\n');
  try {
    const gen = qrcode.generate || (qrcode as any).default?.generate;
    if (typeof gen === 'function') {
      gen(activeAccessUrl, { small: true });
    }
  } catch {
    // fallback if terminal does not support QR rendering
  }

  console.log('\n\x1b[38;2;103;110;149mPress Ctrl+C to disconnect and restore normal sleep.\x1b[0m\n');

  const cleanup = () => {
    console.log('\n\x1b[38;2;247;140;108m[SHUTDOWN]\x1b[0m Stopping daemon and releasing wake-locks...');
    server.stop();
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}

// Auto-run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  let port = 4040;
  const portIndex = args.indexOf('--port');
  if (portIndex !== -1 && args[portIndex + 1]) {
    port = parseInt(args[portIndex + 1], 10);
  }
  const noTunnel = args.includes('--no-tunnel');
  const noCaffeinate = args.includes('--no-caffeinate');

  runDaemon({
    port,
    enableTunnel: !noTunnel,
    enableCaffeinate: !noCaffeinate,
  });
}
