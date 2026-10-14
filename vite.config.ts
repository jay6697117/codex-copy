import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { handleApiRequest } from './server/api-router.mjs';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'codex-local-bridge-middleware',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (
            req.url &&
            (req.url.startsWith('/api/') ||
              req.url.startsWith('/readyz') ||
              req.url.startsWith('/healthz'))
          ) {
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
