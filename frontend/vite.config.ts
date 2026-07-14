import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@engine': path.resolve(__dirname, '../shared/engine'),
    },
  },
  assetsInclude: ['**/*.png', '**/*.jpg', '**/*.jpeg'],
  test: {
    include: [
      '**/*.{test,spec}.?(c|m)[jt]s?(x)',
      '../shared/engine/**/*.test.ts',
    ],
  },
})
