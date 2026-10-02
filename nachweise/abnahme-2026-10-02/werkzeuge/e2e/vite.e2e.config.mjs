// E2E-Konfiguration (ausserhalb des Repos). Wie client/vite.config.ts, aber:
// - API-Proxy zeigt auf den isolierten Testserver (Wegwerf-DB) statt localhost:3000
// - E2E_ROOT erlaubt einen zweiten Stand (z. B. "vorher"-Worktree) parallel zu betreiben
// - fehlende lokale Pakete (react-quill, papaparse) werden durch Shims ersetzt
import path from 'path'
import { createRequire } from 'module'

const REPO = process.env.E2E_ROOT || '/home/adar/Projects/FixitHub'
const CLIENT = path.join(REPO, 'client')
const SHIMS = '/tmp/fixithub-e2e/e2e/shims/client'
const requireFromClient = createRequire('/home/adar/Projects/FixitHub/client/package.json')
const { defineConfig } = await import(requireFromClient.resolve('vite'))
const reactPlugin = (await import(requireFromClient.resolve('@vitejs/plugin-react'))).default

const API = process.env.E2E_API || 'http://127.0.0.1:5099'
const PORT = Number(process.env.E2E_PORT || 5199)

export default defineConfig({
  root: CLIENT,
  cacheDir: `/tmp/fixithub-e2e/e2e/vite-cache-${PORT}`,
  plugins: [reactPlugin()],
  resolve: {
    alias: [
      { find: /^react-quill\/dist\/.*\.css$/, replacement: path.join(SHIMS, 'empty.css') },
      { find: /^react-quill$/, replacement: path.join(SHIMS, 'react-quill.jsx') },
      { find: /^papaparse$/, replacement: path.join(SHIMS, 'papaparse.js') },
      { find: '@', replacement: path.resolve(CLIENT, './src') },
    ],
  },
  server: {
    host: '127.0.0.1',
    port: PORT,
    strictPort: true,
    fs: { allow: [REPO, '/home/adar/Projects/FixitHub', SHIMS] },
    proxy: {
      '/api': { target: API, changeOrigin: true },
      '/uploads': { target: API, changeOrigin: true },
      '/socket.io': { target: API, changeOrigin: true, ws: true },
    },
    watch: { ignored: ['**/node_modules/**', '**/dist/**', '**/log/**', '**/logs/**'] },
  },
})
