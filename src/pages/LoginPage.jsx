import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (err) setError(err.message)
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <img className="login-shield" src="/icons/shield.png" alt="Makerble" />
        <h2 style={{ textAlign: 'center', fontSize: 17, fontWeight: 700, marginBottom: 4 }}>
          Makerble Onboarding
        </h2>
        <p style={{ textAlign: 'center', fontSize: 13, color: '#6b7280', marginBottom: 24 }}>
          Sign in to your account
        </p>
        {error && <div className="error-bar">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <label className="form-label">Email</label>
            <input className="input" type="email" value={email}
              onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required />
          </div>
          <div className="form-row">
            <label className="form-label">Password</label>
            <input className="input" type="password" value={password}
              onChange={e => setPassword(e.target.value)} placeholder="Password" required />
          </div>
          <button className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}
            disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
      <img className="login-full-logo" src="/icons/full_logo.png" alt="Makerble" />
    </div>
  )
}
