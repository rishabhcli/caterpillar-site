import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { content } from './src/content';
import { createAssistantMiddleware } from './server/assistant.mjs';

export default defineConfig(({ mode }) => {
  // Only this server-side config reads unprefixed secrets. Never expose a VITE_* key.
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env };
  return {
    plugins: [react(), {
      name: 'optional-site-assistant',
      configureServer(server) { server.middlewares.use(createAssistantMiddleware({ content, env })); },
      configurePreviewServer(server) { server.middlewares.use(createAssistantMiddleware({ content, env })); },
      generateBundle() { this.emitFile({ type: 'asset', fileName: 'knowledge.json', source: JSON.stringify(content) }); },
    }],
    server: { host: '127.0.0.1', port: 5173, strictPort: true },
    preview: { host: '127.0.0.1', port: 4173, strictPort: true },
    build: { target: 'es2022' },
  };
});
