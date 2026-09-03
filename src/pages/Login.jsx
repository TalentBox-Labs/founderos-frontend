import React, { useState } from 'react'
import { loginFounderOS, isHumanIdentity, setApiKey } from '../api.js'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [serviceKey, setServiceKey] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const trimmedKey = serviceKey.trim()
    try {
      const data = await loginFounderOS(email.trim(), password)
      const identity = data?.identity
      if (!isHumanIdentity(identity)) {
        setError('This account is not a Founder OS human session.')
        return
      }
      if (trimmedKey) setApiKey(trimmedKey)
      window.location.hash = '#/'
      if (import.meta.env.MODE !== 'test') window.location.reload()
    } catch (err) {
      const status = err.response?.status
      const detail = err.response?.data?.detail
      if (status === 401) {
        setError('Invalid email or password.')
      } else if (status === 429) {
        setError(typeof detail === 'string' ? detail : 'Too many login attempts. Try later.')
      } else {
        setError('Cannot reach the backend. Is the API running?')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{
      minHeight: '70vh', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
    }}>
      <div className="card" style={{ width: '420px', maxWidth: '90vw' }}>
        <h1 style={{ marginBottom: '0.5rem' }}>FounderOS</h1>
        <p style={{ color: '#666', marginBottom: '1.5rem' }}>
          Sign in with your Founder OS account. The team API key is a separate
          service credential for routes that still require <code>RUNNER_API_KEY</code>
          — it is not your identity.
        </p>

        {error && (
          <div style={{
            padding: '0.75rem', marginBottom: '1rem', borderRadius: '6px',
            backgroundColor: '#f8d7da', color: '#721c24',
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="founder-email">Email</label>
            <input
              id="founder-email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoFocus
            />
          </div>
          <div className="form-group">
            <label htmlFor="founder-password">Password</label>
            <input
              id="founder-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="runner-api-key">Service API key (optional)</label>
            <input
              id="runner-api-key"
              type="password"
              value={serviceKey}
              onChange={e => setServiceKey(e.target.value)}
              placeholder="RUNNER_API_KEY — not human identity"
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={busy}>
            {busy ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}
