import * as http from 'node:http';
import * as net from 'node:net';
import type * as stream from 'node:stream';

export class ReverseProxyManager {
  public handleHttpRequest(req: http.IncomingMessage, res: http.ServerResponse, targetPort: number, subPath: string): void {
    const targetPath = subPath.startsWith('/') ? subPath : `/${subPath}`;

    const headers: http.OutgoingHttpHeaders = { ...req.headers };
    headers['host'] = `localhost:${targetPort}`;
    delete headers['connection'];

    const proxyReq = http.request(
      {
        hostname: '127.0.0.1',
        port: targetPort,
        path: targetPath + (req.url && req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''),
        method: req.method,
        headers,
      },
      (proxyRes) => {
        const responseHeaders: http.OutgoingHttpHeaders = { ...proxyRes.headers };

        // Strip security headers that block embedding inside mobile PWA iframes
        delete responseHeaders['x-frame-options'];
        delete responseHeaders['content-security-policy'];
        delete responseHeaders['content-security-policy-report-only'];

        // Allow framing from any origin for preview purposes
        responseHeaders['access-control-allow-origin'] = '*';
        responseHeaders['access-control-allow-methods'] = 'GET, POST, PUT, DELETE, OPTIONS, PATCH';
        responseHeaders['access-control-allow-headers'] = '*';

        res.writeHead(proxyRes.statusCode || 200, responseHeaders);
        proxyRes.pipe(res);
      }
    );

    proxyReq.on('error', (err) => {
      res.writeHead(502, { 'Content-Type': 'text/html' });
      res.end(`
        <div style="font-family: monospace; background: #292D3E; color: #FF5370; padding: 24px; min-height: 100vh;">
          <h3>Target Port ${targetPort} Unavailable</h3>
          <p style="color: #A6ACCD;">Ensure your development server is running locally on port ${targetPort}.</p>
          <pre style="color: #676E95;">${err.message}</pre>
        </div>
      `);
    });

    req.pipe(proxyReq);
  }

  public handleWebSocketUpgrade(req: http.IncomingMessage, clientSocket: stream.Duplex, head: Buffer, targetPort: number): void {
    const serverSocket = net.connect(targetPort, '127.0.0.1', () => {
      serverSocket.write(head);
      clientSocket.pipe(serverSocket);
      serverSocket.pipe(clientSocket);
    });

    serverSocket.on('error', () => {
      clientSocket.destroy();
    });

    clientSocket.on('error', () => {
      serverSocket.destroy();
    });
  }
}
