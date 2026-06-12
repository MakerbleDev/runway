import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

function getInitials(name = '') {
  return name.slice(0, 2).toUpperCase()
}

export default function OrgsPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [orgs, setOrgs] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [newName, setNewName] = useState('')
  const [newLogo, setNewLogo] = useState(null)
  const [saving, setSaving] = useState(false)
  const logoRef = useRef()

  const isSU = profile?.role === 'superuser'

  useEffect(() => { fetchOrgs() }, [profile])

  async function fetchOrgs() {
    setLoading(true)
    let query = supabase.from('organisations').select(`
      id, name, logo_url,
      org_members(count),
      programmes(count)
    `)
    if (!isSU) {
      // only orgs this user belongs to
      const { data: myOrgs } = await supabase
        .from('org_members').select('org_id').eq('user_id', profile?.id)
      const ids = (myOrgs || []).map(r => r.org_id)
      if (ids.length === 0) { setOrgs([]); setLoading(false); return }
      query = query.in('id', ids)
    }
    const { data } = await query.order('name')
    setOrgs(data || [])
    setLoading(false)
  }

  async function createOrg() {
    if (!newName.trim()) return
    setSaving(true)
    let logo_url = null
    const { data: org } = await supabase.from('organisations').insert({ name: newName.trim() }).select().single()
    if (newLogo && org) {
      const ext = newLogo.name.split('.').pop()
      const path = `org-logos/${org.id}.${ext}`
      await supabase.storage.from('assets').upload(path, newLogo, { upsert: true })
      const { data: pub } = supabase.storage.from('assets').getPublicUrl(path)
      logo_url = pub.publicUrl
      await supabase.from('organisations').update({ logo_url }).eq('id', org.id)
    }
    setSaving(false)
    setShowModal(false)
    setNewName('')
    setNewLogo(null)
    fetchOrgs()
  }

  if (loading) return <div className="spinner-wrap"><div className="spinner" /></div>

  return (
    <>
      <div className="page-header">
        <div className="page-title">Organisations</div>
        <div className="page-sub">Manage client organisations and their onboarding programmes</div>
      </div>

      <div className="section-header">
        <h2>All Organisations</h2>
        {isSU && (
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            + New Organisation
          </button>
        )}
      </div>

      {orgs.length === 0 ? (
        <div className="empty-state"><p>No organisations yet.</p></div>
      ) : (
        <div className="grid-2">
          {orgs.map(org => (
            <div key={org.id} className="org-card" onClick={() => navigate(`/orgs/${org.id}`)}>
              <div className="org-logo">
                {org.logo_url ? <img src={org.logo_url} alt={org.name} /> : getInitials(org.name)}
              </div>
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{org.name}</h3>
              <p style={{ fontSize: 12, color: '#6b7280' }}>
                {org.programmes?.[0]?.count ?? 0} programme(s) &bull; {org.org_members?.[0]?.count ?? 0} member(s)
              </p>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <h2>New Organisation</h2>
            <div className="form-row">
              <label className="form-label">Organisation name</label>
              <input className="input" value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. AfrikaTikkun" />
            </div>
            <div className="form-row">
              <label className="form-label">Logo (optional)</label>
              <div className="logo-upload-wrap" style={{ width: 64, height: 64 }} onClick={() => logoRef.current?.click()}>
                {newLogo
                  ? <img src={URL.createObjectURL(newLogo)} alt="logo" />
                  : <span style={{ fontSize: 11, color: '#9ca3af', textAlign: 'center', padding: 4 }}>Add logo</span>
                }
                <input type="file" ref={logoRef} accept="image/*" style={{ display: 'none' }} onChange={e => setNewLogo(e.target.files[0])} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={createOrg} disabled={saving}>{saving ? 'Creating…' : 'Create'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
