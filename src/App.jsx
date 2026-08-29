import React, { useEffect, useState } from 'react'
import { HashRouter as Router, Routes, Route, NavLink, Navigate } from 'react-router-dom'
import Dashboard from './pages/Dashboard.jsx'
import Contacts from './pages/Contacts.jsx'
import ContactDetail from './pages/ContactDetail.jsx'
import Deals from './pages/Deals.jsx'
import DealDetail from './pages/DealDetail.jsx'
import Analytics from './pages/Analytics.jsx'
import Goals from './pages/Goals.jsx'
import Activity from './pages/Activity.jsx'
import Approvals from './pages/Approvals.jsx'
import Marketing from './pages/Marketing.jsx'
import Customers from './pages/Customers.jsx'
import Automation from './pages/Automation.jsx'
import Agents from './pages/Agents.jsx'
import KnowledgeBase from './pages/KnowledgeBase.jsx'
import Integrations from './pages/Integrations.jsx'
import Copilot from './pages/Copilot.jsx'
import Login from './pages/Login.jsx'
import {
  classifyIdentity,
  classifyTenantResponse,
  getFounderIdentity,
  getFounderTenant,
  logout,
} from './api.js'

const NAV_LINKS = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/copilot', label: 'Copilot' },
  { to: '/contacts', label: 'Contacts' },
  { to: '/deals', label: 'Deals' },
  { to: '/customers', label: 'Customers' },
  { to: '/marketing', label: 'Marketing' },
  { to: '/analytics', label: 'Analytics' },
  { to: '/goals', label: 'Goals' },
  { to: '/approvals', label: 'Approvals' },
  { to: '/automation', label: 'Automation' },
  { to: '/agents', label: 'Agents' },
  { to: '/knowledge-base', label: 'Knowledge Base' },
  { to: '/integrations', label: 'Integrations' },
  { to: '/activity', label: 'Activity' },
]

export default function App() {
  const [boot, setBoot] = useState('loading')
  const [identityKind, setIdentityKind] = useState('ANONYMOUS')
  const [tenantState, setTenantState] = useState(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      let kind = 'ANONYMOUS'
      try {
        const me = await getFounderIdentity()
        kind = classifyIdentity(me?.identity)
      } catch {
        kind = 'ANONYMOUS'
      }
      if (cancelled) return
      setIdentityKind(kind)
      if (kind !== 'HUMAN') {
        setTenantState(null)
        setBoot('ready')
        return
      }
      try {
        const payload = await getFounderTenant()
        if (!cancelled) setTenantState(classifyTenantResponse(payload, 200))
      } catch (err) {
        const status = err.response?.status
        if (!cancelled) setTenantState(classifyTenantResponse(null, status))
      }
      if (!cancelled) setBoot('ready')
    })()
    return () => { cancelled = true }
  }, [])

  const isHuman = identityKind === 'HUMAN'

  if (boot === 'loading') {
    return <div className="loading">Loading session…</div>
  }

  function RequireAuth({ children }) {
    if (!isHuman) return <Navigate to="/login" replace />
    return children
  }

  return (
    <Router>
      <div className="App">
        <nav className="navbar">
          <div className="nav-container">
            <NavLink to="/" className="nav-logo">
              FounderOS
            </NavLink>
            {isHuman && (
              <ul className="nav-menu">
                {NAV_LINKS.map(link => (
                  <li key={link.to}>
                    <NavLink to={link.to} className="nav-link" end={link.end}>
                      {link.label}
                    </NavLink>
                  </li>
                ))}
                <li>
                  <button
                    onClick={logout}
                    className="nav-link"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', font: 'inherit' }}
                  >
                    Logout
                  </button>
                </li>
              </ul>
            )}
          </div>
        </nav>

        <div className="main-content">
          {isHuman && tenantState === 'no_membership' && (
            <div className="card" style={{ borderLeft: '4px solid #D62828' }}>
              No active Founder OS organization is available for this account.
            </div>
          )}
          {isHuman && tenantState === 'multi_org_unsupported' && (
            <div className="card" style={{ borderLeft: '4px solid #D62828' }}>
              Multiple organizations are available, but organization selection is not
              yet enabled in this Founder OS interface.
            </div>
          )}
          <Routes>
            <Route path="/login" element={isHuman ? <Navigate to="/" replace /> : <Login />} />
            <Route path="/" element={<RequireAuth><Dashboard /></RequireAuth>} />
            <Route path="/copilot" element={<RequireAuth><Copilot /></RequireAuth>} />
            <Route path="/contacts" element={<RequireAuth><Contacts /></RequireAuth>} />
            <Route path="/contacts/:id" element={<RequireAuth><ContactDetail /></RequireAuth>} />
            <Route path="/deals" element={<RequireAuth><Deals /></RequireAuth>} />
            <Route path="/deals/:id" element={<RequireAuth><DealDetail /></RequireAuth>} />
            <Route path="/customers" element={<RequireAuth><Customers /></RequireAuth>} />
            <Route path="/marketing" element={<RequireAuth><Marketing /></RequireAuth>} />
            <Route path="/analytics" element={<RequireAuth><Analytics /></RequireAuth>} />
            <Route path="/goals" element={<RequireAuth><Goals /></RequireAuth>} />
            <Route path="/approvals" element={<RequireAuth><Approvals /></RequireAuth>} />
            <Route path="/automation" element={<RequireAuth><Automation /></RequireAuth>} />
            <Route path="/agents" element={<RequireAuth><Agents /></RequireAuth>} />
            <Route path="/knowledge-base" element={<RequireAuth><KnowledgeBase /></RequireAuth>} />
            <Route path="/integrations" element={<RequireAuth><Integrations /></RequireAuth>} />
            <Route path="/activity" element={<RequireAuth><Activity /></RequireAuth>} />
          </Routes>
        </div>
      </div>
    </Router>
  )
}
