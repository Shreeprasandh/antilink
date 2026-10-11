# Antilink

A latency-optimized companion bridge and mobile Progressive Web App (PWA) for Google Antigravity (`agy`). Antilink enables developers to monitor and steer agent turns, review and approve tool executions, preserve system power states, and preview live development servers directly from mobile devices.

---

## Key Capabilities

- **Bidirectional Agent Streaming**: Real-time websocket stream of thoughts, messages, and tool invocations with sub-50ms latency.
- **Interactive Tool Confirmation Gateway**: Approve or deny terminal commands and file edits on your phone via one-tap action cards.
- **Multi-Port Dev Preview Matrix**: In-app embedded browser with automatic discovery and reverse-proxying of dev ports (Next.js, Vite, FastAPI, Supabase Studio, Prisma Studio).
- **Zero-Config Cloudflare Tunneling**: Auto-provisions an encrypted public HTTPS endpoint on boot with no account setup required.
- **macOS Caffeinate Wake-Lock**: Automatically keeps the host workstation awake (`/usr/bin/caffeinate -disu`) when the laptop lid is closed.
- **VS Code Material Palenight Theme**: 100% adherence to the official Palenight color palette tokens and responsive safe-area layout.

---

## Architecture Overview

```
+-------------------------------------------------------------------+
|                        macOS Workstation                          |
|                                                                   |
|  +--------------------+     IPC/JSON-ND     +------------------+  |
|  |  Antigravity CLI   | <=================> | Antilink Daemon  |  |
|  |       (agy)        |                     | (Port Scanner,   |  |
|  +--------------------+                     |  Tunnel Manager, |  |
|                                             |  Caffeinate)     |  |
|  +--------------------+                     +--------+---------+  |
|  | Local Dev Servers  |                              |            |
|  | (:3000, :8000, ...) <------- Reverse Proxy -------+            |
+------------------------------------------------------|------------+
                                                       |
                                               Encrypted Tunnel
                                            (Cloudflare / Local IP)
                                                       |
                                                       v
                                      +---------------------------------+
                                      |        Mobile Client PWA        |
                                      |  (VS Code Palenight Interface)  |
                                      |  - Tab 1: Agent Stream & Tools  |
                                      |  - Tab 2: Embedded App Preview  |
                                      |  - Tab 3: System & Power Deck   |
                                      +---------------------------------+
```

---

## Repository Structure

- `apps/web`: Next.js 16 (React 19) PWA client configured with Tailwind CSS v4.
- `packages/daemon`: Headless Node.js / TypeScript host bridge, reverse proxy, and tunnel supervisor.
- `packages/shared`: Shared TypeScript types, event protocols, and telemetry schemas.
- `bin/antilink.js`: CLI executable launcher.

---

## Quickstart

### Prerequisites

- Node.js 20+
- macOS (for native `caffeinate` wake-lock support)
- Cloudflare Tunnel (`cloudflared` CLI)

### Installation

```bash
git clone https://github.com/Shreeprasandh/antilink.git
cd antilink
npm install
npm run build
```

### Running

```bash
npm start
```

Or run via the CLI binary directly:

```bash
node bin/antilink.js
```

The terminal will display:
1. Local loopback URL (`http://localhost:4040/?token=...`)
2. Wi-Fi network URL (`http://<lan-ip>:4040/?token=...`)
3. Public Cloudflare HTTPS Tunnel URL
4. Scannable terminal QR code for instant mobile pairing.

---

## License

MIT License. See `LICENSE` for details.
