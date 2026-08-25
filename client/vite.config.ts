import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined

          if (id.includes("react-quill") || id.includes("quill") || id.includes("jspdf") || id.includes("html2canvas")) {
            return "editor-print"
          }

          if (id.includes("chart.js") || id.includes("recharts")) {
            return "charts"
          }

          if (id.includes("leaflet")) {
            return "maps"
          }

          if (id.includes("@radix-ui") || id.includes("lucide-react") || id.includes("react-router")) {
            return "ui-framework"
          }

          return "vendor"
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/assets': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/logs': {
        target: 'http://localhost:4444',
        changeOrigin: true,
      }
    },
    allowedHosts: [
      'localhost',
      '.pythagora.ai'
    ],
    watch: {
      ignored: ['**/node_modules/**', '**/dist/**', '**/public/**', '**/log/**']
    }
  },
})
