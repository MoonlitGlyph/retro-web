import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    server: { proxy: { '/api': { target: env.RUSTY_ROM_API || 'http://127.0.0.1:3000', changeOrigin: true } } },
  };
});
