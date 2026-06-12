import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import OrgsPage from './pages/OrgsPage'
import OrgPage from './pages/OrgPage'
import ProgrammePage from './pages/ProgrammePage'
import MembersPage from './pages/MembersPage'
import ProfilePage from './pages/ProfilePage'

function ProtectedRoute({ children }) {
  const { session } = useAuth()
  if (session === undefined) return <div className="spinner-wrap"><div className="spinner" /></div>
  if (!session) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  const { session } = useAuth()
  if (session === undefined) return <div className="spinner-wrap"><div className="spinner" /></div>
  return (
    <Routes>
      <Route path="/login" element={session ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<OrgsPage />} />
        <Route path="orgs/:orgId" element={<OrgPage />} />
        <Route path="orgs/:orgId/programmes/:progId" element={<ProgrammePage />} />
        <Route path="orgs/:orgId/members" element={<MembersPage />} />
        <Route path="profile" element={<ProfilePage />} />
      </Route>
    </Routes>
  )
}
