import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  root: 'src',
  server: {
    proxy: {
      '/api': 'http://localhost:8787'
    }
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'src/index.html'),
        login: resolve(__dirname, 'src/login.html'),
        register: resolve(__dirname, 'src/register.html'),
        onboarding: resolve(__dirname, 'src/onboarding.html'),
        book: resolve(__dirname, 'src/book.html'),
        providerOnboarding: resolve(__dirname, 'src/provider-onboarding.html'),
        providerFeed: resolve(__dirname, 'src/provider-feed.html')
      }
    }
  }
})
