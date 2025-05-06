import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      'vue': resolve(__dirname, 'node_modules/vue/dist/vue.esm-browser.js')
    }
  },
  server: {
    port: 3000
  }
})
