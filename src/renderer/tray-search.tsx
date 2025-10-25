import React from 'react'
import { createRoot } from 'react-dom/client'
import { TraySearch } from './components/tray/TraySearch'
import './index.css'

/**
 * Entry point for the tray search window
 * Lightweight standalone app for quick secret search
 */
// Sync theme with OS (dark/light)
function syncThemeWithOS(): void {
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  const apply = () => {
    if (mq.matches) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }
  apply()
  mq.addEventListener('change', apply)
}

const container = document.getElementById('root')
if (!container) {
  throw new Error('Root element not found')
}

const root = createRoot(container)
syncThemeWithOS()
root.render(
  <React.StrictMode>
    <TraySearch />
  </React.StrictMode>
)

