import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  root: 'src',
  envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
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
        providerFeed: resolve(__dirname, 'src/provider-feed.html'),
        admin: resolve(__dirname, 'src/admin.html'),
        privacy: resolve(__dirname, 'src/privacy.html'),
        terms: resolve(__dirname, 'src/terms.html'),
        rut: resolve(__dirname, 'src/rut.html')
      }
    }
  }
})