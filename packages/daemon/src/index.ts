import * as os from 'node:os';
import qrcode from 'qrcode-terminal';
import { AntilinkDaemonServer } from './server.js';
import {
  ITunnelManager,
  createTunnelManager,
  CloudflareTunnelManager,
  loadAntilinkConfig,
} from './tunnel.js';

export interface CliFlags {
  port: number;
  enableTunnel: boolean;
  enableCaffeinate: boolean;
  tunnelProvider?: 'ngrok' | 'cloudflare';
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

  const sessionCode = server.security.getSessionPairingCode();

  console.log('\x1b[38;2;195;232;141m[OK]\x1b[0m Daemon active on port ' + port);
  console.log('\x1b[38;2;130;170;255mLocal:\x1b[0m   ' + localUrl);
  console.log('\x1b[38;2;130;170;255mWi-Fi:\x1b[0m   ' + lanUrl);
  console.log('');
  console.log('\x1b[38;2;199;146;234m' + '--------------------------------------------------' + '\x1b[0m');
  console.log(`\x1b[38;2;195;232;141m\x1b[1m   SESSION PAIRING CODE: [ ${sessionCode.split('').join(' ')} ]   \x1b[0m`);
  console.log('\x1b[38;2;103;110;149m      Enter this code on your phone when prompted     ' + '\x1b[0m');
  console.log('\x1b[38;2;137;221;255m      Or press "y" in this terminal to quick-approve  \x1b[0m');
  console.log('\x1b[38;2;199;146;234m' + '--------------------------------------------------' + '\x1b[0m\n');


  let activeAccessUrl = lanUrl;
  let activeTunnel: ITunnelManager | null = null;

  if (enableTunnel) {
    const config = loadAntilinkConfig();
    const preferredProvider: 'ngrok' | 'cloudflare' =
      flags.tunnelProvider ||
      (process.env.ANTILINK_TUNNEL_PROVIDER as 'ngrok' | 'cloudflare') ||
      config.tunnel?.provider ||
      (config.tunnel?.ngrokAuthtoken ? 'ngrok' : 'cloudflare');

    const providerLabel =
      preferredProvider === 'ngrok'
        ? `ngrok Permanent Static (${config.tunnel?.ngrokDomain || 'Default Edge'})`
        : 'Cloudflare Quick Tunnel';

    console.log(`\x1b[38;2;247;140;108m[TUNNEL]\x1b[0m Provisioning ${providerLabel}...`);
    activeTunnel = createTunnelManager(port, preferredProvider);

    try {
      let publicUrl = await activeTunnel.start();

      // Silent Auto-Fallback: If ngrok fails, immediately fall back to Cloudflare
      if (!publicUrl && preferredProvider === 'ngrok') {
        console.log(
          '\x1b[38;2;255;203;107m[FALLBACK]\x1b[0m ngrok tunnel timed out or failed. Falling back to Cloudflare...'
        );
        activeTunnel = new CloudflareTunnelManager(port);
        publicUrl = await activeTunnel.start();
      }

      if (publicUrl) {
        const fullPublicUrl = `${publicUrl}/?token=${token}`;
        const vercelUrl = `https://antilink-gold.vercel.app/?gateway=${encodeURIComponent(publicUrl)}&token=${token}`;
        server.setTunnelUrl(publicUrl);
        activeAccessUrl = vercelUrl;
        console.log('\x1b[38;2;195;232;141m[OK]\x1b[0m Public HTTPS Tunnel Ready:');
        console.log('\x1b[38;2;137;221;255m\x1b[1m' + fullPublicUrl + '\x1b[0m\n');
        console.log('\x1b[38;2;199;146;234m[PERMANENT WEB]\x1b[0m Vercel Web App:');
        console.log('\x1b[38;2;195;232;141m\x1b[1m' + vercelUrl + '\x1b[0m\n');
      } else {
        console.log('\x1b[38;2;255;203;107m[NOTE]\x1b[0m Public tunnel skipped or timed out. Use Wi-Fi URL.');
      }
    } catch (err) {
      console.log('\x1b[38;2;255;203;107m[NOTE]\x1b[0m Tunnel provisioning encountered an error. Using Wi-Fi URL.');
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

  const cleanup = async () => {
    console.log('\n\x1b[38;2;247;140;108m[SHUTDOWN]\x1b[0m Stopping daemon and releasing wake-locks...');
    if (activeTunnel) {
      try {
        await activeTunnel.stop();
      } catch {
        // ignore
      }
    }
    server.stop();
    process.exit(0);
  };

  if (process.stdin.isTTY) {
    try {
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.setEncoding('utf8');
      process.stdin.on('data', (key: string) => {
        if (key === '\u0003') {
          cleanup();
        } else if (key.toLowerCase() === 'y') {
          server.security.approveLatestPending(true);
        }
      });
    } catch {
      // non-TTY environment fallback
    }
  }

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

  let tunnelProvider: 'ngrok' | 'cloudflare' | undefined;
  if (args.includes('--ngrok')) {
    tunnelProvider = 'ngrok';
  } else if (args.includes('--cloudflare')) {
    tunnelProvider = 'cloudflare';
  } else {
    const tunnelIdx = args.indexOf('--tunnel');
    if (tunnelIdx !== -1 && args[tunnelIdx + 1]) {
      const val = args[tunnelIdx + 1].toLowerCase();
      if (val === 'ngrok' || val === 'cloudflare') {
        tunnelProvider = val;
      }
    }
  }

  runDaemon({
    port,
    enableTunnel: !noTunnel,
    enableCaffeinate: !noCaffeinate,
    tunnelProvider,
  });
}

