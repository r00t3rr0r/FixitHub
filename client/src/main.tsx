
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './McRepair-Design-System/design-system/tokens.css'
import './index.css'
import './mcrepair-global.css'
import './mcrepair-homepage.css'
import './mcrepair-fixes.css'
import './McRepair-Design-System/design-system/components/navigation.css'
import './i18n'
import 'hover.css/css/hover.css'
import App from './App.tsx'
import { initMcRepair } from './mcrepair-interactions'

// Initialize McRepair interactive functions
initMcRepair();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

