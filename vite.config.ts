/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

// Rutas relativas para que funcione en GitHub Pages (/tiendapokemon/) y en local
export default defineConfig({
  base: './',
  build: { target: 'es2020', chunkSizeWarningLimit: 1000 },
  test: { include: ['tests/**/*.test.ts'], passWithNoTests: true },
});
