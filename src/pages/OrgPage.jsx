import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

function getInitials(name = '') { return name.slice(0, 2).toUpperCase() }

export default function OrgPage() {
  const { orgId } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [org, setOrg] = useState(null)
  const [progs, setProgs] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [newName, setNewName] = useState('')
  const [newLogo, setNewLogo] = useState(null)
  const [saving, setSaving] = useState(false)
  const logoRef = useRef()
  const orgLogoRef = useRef()

  const isSU = profile?.role === 'superuser'
  const isManager = isSU || profile?.role === 'manager'

  useEffect(() => { fetchAll() }, [orgId])

  async function fetchAll() {
    setLoading(true)
    const [{ data: o }, { data: p }] = await Promise.all([
      supabase.from('organisations').select('*').eq('id', orgId).single(),
      supabase.from('programmes').select('id, name, logo_url, journey').eq('org_id', orgId).order('name'),
    ])
    setOrg(o)
    setProgs(p || [])
    setLoading(false)
  }

  async function uploadOrgLogo(file) {
    const ext = file.name.split('.').pop()
    const path = `org-logos/${orgId}.${ext}`
    await supabase.storage.from('assets').upload(path, file, { upsert: true })
    const { data } = supabase.storage.from('assets').getPublicUrl(path)
    await supabase.from('organisations').update({ logo_url: data.publicUrl }).eq('id', orgId)
    fetchAll()
  }

  async function createProg() {
    if (!newName.trim()) return
    setSaving(true)
    const { data: prog } = await supabase.from('programmes')
      .insert({ org_id: orgId, name: newName.trim(), journey: {} })
      .select().single()
    if (newLogo && prog) {
      const ext = newLogo.name.split('.').pop()
      const path = `prog-logos/${prog.id}.${ext}`
      await supabase.storage.from('assets').upload(path, newLogo, { upsert: true })
      const { data: pub } = supabase.storage.from('assets').getPublicUrl(path)
      await supabase.from('programmes').update({ logo_url: pub.publicUrl }).eq('id', prog.id)
    }
    setSaving(false)
    setShowModal(false)
    setNewName('')
    setNewLogo(null)
    fetchAll()
  }

  function countItems(journey = {}) {
    return Object.values(journey).reduce((n, arr) => n + (Array.isArray(arr) ? arr.length : 0), 0)
  }

  if (loading) return <div className="spinner-wrap"><div className="spinner" /></div>
  if (!org) return <div className="empty-state"><p>Organisation not found.</p></div>

  return (
    <>
      <button className="nav-back" onClick={() => navigate('/')}>← All Organisations</button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <div className="logo-upload-wrap" style={{ width: 60, height: 60 }} onClick={() => isManager && orgLogoRef.current?.click()}>
          {org.logo_url ? <img src={org.logo_url} alt={org.name} /> : <span style={{ fontSize: 18, fontWeight: 700, color: '#9ca3af' }}>{getInitials(org.name)}</span>}
          {isManager && <input type="file" ref={orgLogoRef} accept="image/*" style={{ display: 'none' }} onChange={e => uploadOrgLogo(e.target.files[0])} />}
        </div>
        <div>
          <div className="page-title">{org.name}</div>
          <div className="page-sub">Click logo to change it</div>
        </div>
        {isManager && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button className="btn btn-sm" onClick={() => navigate(`/orgs/${orgId}/members`)}>👥 Members</button>
          </div>
        )}
      </div>

      <div className="section-header">
        <h2>Programmes</h2>
        {isManager && <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>+ New Programme</button>}
      </div>

      {progs.length === 0 ? (
        <div className="empty-state"><p>No programmes yet{isManager ? '. Create one to begin onboarding.' : ' assigned to you.'}</p></div>
      ) : (
        <div className="grid-2">
          {progs.map(p => {
            const ini = p.name.slice(0, 2).toUpperCase()
            const items = countItems(p.journey)
            return (
              <div key={p.id} className="prog-card" onClick={() => navigate(`/orgs/${orgId}/programmes/${p.id}`)}>
                <div className="prog-logo">{p.logo_url ? <img src={p.logo_url} alt={p.name} /> : ini}</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>{items} journey item{items !== 1 ? 's' : ''} across 7 stages</div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <h2>New Programme</h2>
            <div className="form-row">
              <label className="form-label">Programme name</label>
              <input className="input" value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Bambanani" />
            </div>
            <div className="form-row">
              <label className="form-label">Logo (optional)</label>
              <div className="logo-upload-wrap" style={{ width: 64, height: 64 }} onClick={() => logoRef.current?.click()}>
                {newLogo ? <img src={URL.createObjectURL(newLogo)} alt="logo" /> : <span style={{ fontSize: 11, color: '#9ca3af', textAlign: 'center', padding: 4 }}>Add logo</span>}
                <input type="file" ref={logoRef} accept="image/*" style={{ display: 'none' }} onChange={e => setNewLogo(e.target.files[0])} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={createProg} disabled={saving}>{saving ? 'Creating…' : 'Create'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
