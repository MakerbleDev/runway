import { Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'

function getInitials(name = '') {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

export default function Layout() {
  const { session, profile } = useAuth()
  const navigate = useNavigate()
  const name = profile?.display_name || session?.user?.email || ''
  const role = profile?.role || 'member'
  const avatar = profile?.avatar_url

  async function signOut() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  return (
    <div className="app">
      <nav className="topbar">
        <div className="topbar-left">
          <img className="topbar-shield" src="/icons/shield.png" alt="Makerble"
            onClick={() => navigate('/')} style={{ cursor: 'pointer' }} />
          <span className="topbar-title" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
            Makerble Onboarding
          </span>
        </div>
        <div className="topbar-right">
          <div className="user-badge">
            <div className="avatar" onClick={() => navigate('/profile')}>
              {avatar ? <img src={avatar} alt={name} /> : getInitials(name)}
            </div>
            <span>{name}</span>
            {role === 'superuser' && <span className="tag tag-green">Super User</span>}
            {role === 'manager' && <span className="tag tag-purple">Manager</span>}
            {role === 'member' && <span className="tag tag-gray">Member</span>}
          </div>
          <button className="btn btn-light btn-sm" onClick={signOut}>Sign out</button>
        </div>
      </nav>

      <main className="main">
        <Outlet />
      </main>

      <div className="footer-logo">
        <img src="/icons/full_logo.png" alt="Makerble" />
      </div>
    </div>
  )
}
