import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

function getInitials(name = '') { return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() }

export default function ProfilePage() {
  const { session, profile, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState(profile?.display_name || '')
  const [newPass, setNewPass] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const avatarRef = useRef()

  const avatar = profile?.avatar_url

  async function uploadAvatar(file) {
    const ext = file.name.split('.').pop()
    const path = `avatars/${session.user.id}.${ext}`
    await supabase.storage.from('assets').upload(path, file, { upsert: true })
    const { data } = supabase.storage.from('assets').getPublicUrl(path)
    await supabase.from('profiles').update({ avatar_url: data.publicUrl }).eq('id', session.user.id)
    await refreshProfile()
  }

  async function save() {
    setMsg(''); setErr('')
    if (!name.trim()) { setErr('Name cannot be empty'); return }
    setSaving(true)
    await supabase.from('profiles').update({ display_name: name.trim() }).eq('id', session.user.id)
    if (newPass) {
      const { error } = await supabase.auth.updateUser({ password: newPass })
      if (error) { setErr(error.message); setSaving(false); return }
    }
    await refreshProfile()
    setSaving(false)
    setMsg('Changes saved ✓')
    setNewPass('')
  }

  const displayName = profile?.display_name || session?.user?.email || ''

  return (
    <>
      <button className="nav-back" onClick={() => navigate(-1)}>← Back</button>
      <div className="page-header">
        <div className="page-title">My Profile</div>
        <div className="page-sub">Update your name, password and profile picture</div>
      </div>

      <div className="card" style={{ maxWidth: 500 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
          <div className="avatar-lg" onClick={() => avatarRef.current?.click()}>
            {avatar ? <img src={avatar} alt={displayName} /> : getInitials(displayName)}
          </div>
          <input type="file" ref={avatarRef} accept="image/*" style={{ display: 'none' }}
            onChange={e => uploadAvatar(e.target.files[0])} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{displayName}</div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>Click avatar to change photo</div>
          </div>
        </div>

        {err && <div className="error-bar">{err}</div>}
        {msg && <div className="success-bar">{msg}</div>}

        <div className="form-row">
          <label className="form-label">Display name</label>
          <input className="input" value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div className="form-row">
          <label className="form-label">New password (leave blank to keep current)</label>
          <input className="input" type="password" value={newPass} onChange={e => setNewPass(e.target.value)} placeholder="New password" />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
        </div>
      </div>
    </>
  )
}
