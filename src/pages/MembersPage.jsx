import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

function getInitials(name = '') { return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() }

export default function MembersPage() {
  const { orgId } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [orgName, setOrgName] = useState('')
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [invName, setInvName] = useState('')
  const [invEmail, setInvEmail] = useState('')
  const [invRole, setInvRole] = useState('member')
  const [inviting, setInviting] = useState(false)
  const [invMsg, setInvMsg] = useState('')

  const isSU = profile?.role === 'superuser'
  const isManager = isSU || profile?.role === 'manager'

  useEffect(() => { fetchAll() }, [orgId])

  async function fetchAll() {
    setLoading(true)
    const [{ data: o }, { data: m }] = await Promise.all([
      supabase.from('organisations').select('name').eq('id', orgId).single(),
      supabase.from('org_members')
        .select('id, role, profiles(id, display_name, email, avatar_url)')
        .eq('org_id', orgId),
    ])
    setOrgName(o?.name || '')
    setMembers(m || [])
    setLoading(false)
  }

  async function inviteMember() {
    if (!invEmail.trim()) return
    setInviting(true)
    setInvMsg('')
    // Create Supabase auth invite — user gets email to set password
    const { data: invited, error } = await supabase.auth.admin.inviteUserByEmail(invEmail.trim(), {
      data: { display_name: invName.trim() || invEmail.trim() }
    })
    if (error) {
      // Fallback: look up existing user
      const { data: existing } = await supabase.from('profiles').select('id').eq('email', invEmail.trim()).maybeSingle()
      if (existing) {
        await supabase.from('org_members').upsert({ org_id: orgId, user_id: existing.id, role: invRole })
        // Update display name + role if provided
        if (invName.trim()) await supabase.from('profiles').update({ display_name: invName.trim(), role: invRole }).eq('id', existing.id)
        setInvMsg('Member added ✓')
      } else {
        setInvMsg('User not found. They need to sign up first, or check Supabase invitations.')
      }
    } else if (invited?.user) {
      await supabase.from('org_members').upsert({ org_id: orgId, user_id: invited.user.id, role: invRole })
      await supabase.from('profiles').upsert({ id: invited.user.id, email: invEmail.trim(), display_name: invName.trim() || invEmail.trim(), role: invRole })
      setInvMsg('Invitation sent ✓')
    }
    setInviting(false)
    fetchAll()
  }

  async function removeMember(memberId) {
    await supabase.from('org_members').delete().eq('id', memberId)
    fetchAll()
  }

  if (loading) return <div className="spinner-wrap"><div className="spinner" /></div>

  return (
    <>
      <button className="nav-back" onClick={() => navigate(`/orgs/${orgId}`)}>← {orgName}</button>
      <div className="page-header">
        <div className="page-title">Manage Members</div>
        <div className="page-sub">Invite team members and assign roles for {orgName}</div>
      </div>

      <div className="card">
        <div className="section-header">
          <h2>Members</h2>
          {isManager && <button className="btn btn-primary btn-sm" onClick={() => { setShowModal(true); setInvMsg('') }}>+ Invite</button>}
        </div>

        {members.length === 0 ? (
          <div className="empty-state" style={{ padding: 20 }}><p>No members yet.</p></div>
        ) : members.map(m => {
          const p = m.profiles
          const name = p?.display_name || p?.email || '?'
          return (
            <div key={m.id} className="member-row">
              <div className="avatar" style={{ background: m.role === 'manager' ? '#534AB7' : '#888780' }}>
                {p?.avatar_url ? <img src={p.avatar_url} alt={name} /> : getInitials(name)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{name}</div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>{p?.email}</div>
              </div>
              <span className={`tag ${m.role === 'manager' ? 'tag-purple' : 'tag-gray'}`}>
                {m.role === 'manager' ? 'Manager' : 'Member'}
              </span>
              {isManager && <button className="btn btn-sm btn-danger" onClick={() => removeMember(m.id)}>Remove</button>}
            </div>
          )
        })}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <h2>Invite member</h2>
            <div className="info-bar">ℹ️ An invitation email will be sent. If they already have an account, they'll be added immediately.</div>
            {invMsg && <div className="success-bar">{invMsg}</div>}
            <div className="form-row">
              <label className="form-label">Full name</label>
              <input className="input" value={invName} onChange={e => setInvName(e.target.value)} placeholder="e.g. Pinky Khwiane" />
            </div>
            <div className="form-row">
              <label className="form-label">Email address</label>
              <input className="input" type="email" value={invEmail} onChange={e => setInvEmail(e.target.value)} placeholder="e.g. pinky@org.org" />
            </div>
            <div className="form-row">
              <label className="form-label">Role</label>
              <select className="select" value={invRole} onChange={e => setInvRole(e.target.value)}>
                <option value="manager">Org Manager</option>
                <option value="member">Org Member</option>
              </select>
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => setShowModal(false)}>Close</button>
              <button className="btn btn-primary" onClick={inviteMember} disabled={inviting}>{inviting ? 'Inviting…' : 'Invite'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
