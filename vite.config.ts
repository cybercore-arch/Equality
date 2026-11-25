import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Для Tauri/Capacitor нужен относительный base, чтобы файлы грузились из локального бандла.
export default defineConfig({
  plugins: [react()],
  base: './',
  server: { port: 5173, strictPort: true },
  build: { target: 'es2022', sourcemap: false },
});
