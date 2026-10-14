import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { handleApiRequest } from './server/api-router.mjs';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'codex-local-bridge-middleware',
      configureServer(server) {
        if (server.httpServer) {
          server.httpServer.requestTimeout = 0;
          server.httpServer.timeout = 0;
          server.httpServer.headersTimeout = 0;
          server.httpServer.keepAliveTimeout = 65000;
          server.httpServer.on('connection', (socket) => {
            socket.setNoDelay(true);
            socket.setKeepAlive(true, 15000);
            socket.setTimeout(0);
            socket.on('error', () => {});
          });
        }

        server.middlewares.use(async (req, res, next) => {
          if (
            req.url &&
            (req.url.startsWith('/api/') ||
              req.url.startsWith('/readyz') ||
              req.url.startsWith('/healthz'))
          ) {
            req.setTimeout?.(0);
            res.setTimeout?.(0);
            const handled = await handleApiRequest(req, res, process.cwd());
            if (handled) return;
          }
          next();
        });
      },
    },
  ],
  base: './',
  server: {
    port: 5173,
  },
});
