// Produktions-Build zur Pruefung - schreibt NICHT nach client/dist, sondern in den Scratchpad.
// Fehlende lokale Pakete (react-quill, papaparse) werden durch Shims ersetzt; das echte Deployment
// muss vorher `npm install` im client ausfuehren.
import path from 'path'
import { createRequire } from 'module'
const CLIENT = '/home/adar/Projects/FixitHub/client'
const SHIMS = '/tmp/fixithub-e2e/e2e/shims/client'
const requireFromClient = createRequire(path.join(CLIENT, 'package.json'))
const { defineConfig } = await import(requireFromClient.resolve('vite'))
const reactPlugin = (await import(requireFromClient.resolve('@vitejs/plugin-react'))).default
export default defineConfig({
  root: CLIENT,
  plugins: [reactPlugin()],
  resolve: { alias: [
    { find: /^react-quill\/dist\/.*\.css$/, replacement: path.join(SHIMS, 'empty.css') },
    { find: /^react-quill$/, replacement: path.join(SHIMS, 'react-quill.jsx') },
    { find: /^papaparse$/, replacement: path.join(SHIMS, 'papaparse.js') },
    { find: '@', replacement: path.resolve(CLIENT, './src') },
  ] },
  build: { outDir: '/tmp/fixithub-e2e/build-check', emptyOutDir: true },
})
