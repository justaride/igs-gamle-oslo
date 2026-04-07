import { type FormEvent, useState } from 'react'
import { api } from '../services/api'

type Props = {
  onClose: () => void
  onSuccess: () => void
}

export default function LoginDialog({ onClose, onSuccess }: Props) {
  const [token, setToken] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!token.trim()) return

    setLoading(true)
    setError('')

    api.setEditorToken(token)
    const valid = await api.verifyToken()

    if (valid) {
      onSuccess()
    } else {
      api.clearEditorToken()
      setError('Ugyldig redaktørnøkkel')
    }

    setLoading(false)
  }

  return (
    <div className="login-overlay" onClick={onClose}>
      <div className="login-dialog" onClick={(e) => e.stopPropagation()}>
        <h3>Logg inn som redaktør</h3>
        <form onSubmit={handleSubmit}>
          <label htmlFor="editor-token">Redaktørnøkkel</label>
          <input
            id="editor-token"
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Skriv inn nøkkel..."
            autoFocus
            disabled={loading}
          />
          {error && <p className="login-error">{error}</p>}
          <div className="login-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
              Avbryt
            </button>
            <button type="submit" className="btn" disabled={loading || !token.trim()}>
              {loading ? 'Verifiserer...' : 'Logg inn'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
