import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const webPort = Number(process.env.CAMPUS_WEB_PORT || 5173);
const apiPort = Number(process.env.CAMPUS_API_PORT || 3001);
if (![webPort, apiPort].every(port => Number.isInteger(port) && port >= 1 && port <= 65535)) {
  throw new Error('Los puertos de Campus deben estar entre 1 y 65535.');
}

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1', port: webPort, strictPort: true,
    proxy: { '/api': `http://127.0.0.1:${apiPort}` },
  },
});
