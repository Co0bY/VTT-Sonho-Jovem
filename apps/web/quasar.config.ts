import { defineConfig } from '#q-app/wrappers'

export default defineConfig(() => ({
  devServer: {
    host: '127.0.0.1',
    port: 9000,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
}))
