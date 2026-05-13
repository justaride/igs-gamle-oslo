import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { api } from './services/api'

function consumeMagicLink() {
  if (typeof window === 'undefined') return
  const hash = window.location.hash
  if (!hash || hash.length < 2) return

  const params = new URLSearchParams(hash.slice(1))
  const token = params.get('k') ?? params.get('token')
  const name = params.get('n') ?? params.get('name')

  if (token) api.setEditorToken(token)
  if (name) api.setEditorName(name)

  if (token || name) {
    const cleanUrl = window.location.pathname + window.location.search
    window.history.replaceState(null, '', cleanUrl)
  }
}

consumeMagicLink()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
