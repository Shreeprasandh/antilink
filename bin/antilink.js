#!/usr/bin/env node

import { runDaemon } from '../packages/daemon/dist/index.js';

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
}).catch((err) => {
  console.error('\x1b[38;2;255;83;112mError starting Antilink:\x1b[0m', err);
  process.exit(1);
});
