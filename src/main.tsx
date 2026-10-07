import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import { AppProvider } from './state/AppContext'
import './index.css'

/**
 * HashRouter (not BrowserRouter): the app is a static bundle that may be served
 * from a subpath (GitHub Pages) with no server-side rewrite available. Hash
 * routes always resolve to index.html, which also keeps deep links working
 * offline from the home-screen icon.
 */

// Auto-update the service worker. There's no network at runtime anyway, so this
// only matters when the phone happens to be online and a new build is deployed.
registerSW({ immediate: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProvider>
      <HashRouter>
        <App />
      </HashRouter>
    </AppProvider>
  </StrictMode>,
)
