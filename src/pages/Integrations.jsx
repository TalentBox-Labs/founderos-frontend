import React, { useState, useEffect, useCallback } from 'react'
import api, {
  classifyIdentity,
  classifyTenantResponse,
  connectorConfigPayload,
  getFounderIdentity,
  getFounderTenant,
  gmailSurfaceAllowed,
  parseGmailSyncResponse,
} from '../api.js'

const CATEGORY_LABELS = {
  email: 'Email', notifications: 'Notifications', messaging: 'Messaging',
  calendar: 'Calendar', automation: 'Automation', ai: 'AI', content: 'Content Publishing',
  enrichment: 'Enrichment',
}

const MULTI_ORG_MESSAGE = 'Multiple organizations are available, but organization selection is not yet enabled in this Founder OS interface.'
const NO_ORG_MESSAGE = 'No active Founder OS organization is available for this account.'

function fmt(iso) {
  if (!iso) return null
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function Integrations() {
  const [connectors, setConnectors] = useState([])
  const [loading, setLoading] = useState(true)
  const [offline, setOffline] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState(null)
  const [openForm, setOpenForm] = useState(null)
  const [formValues, setFormValues] = useState({})
  const [identity, setIdentity] = useState(null)
  const [tenantState, setTenantState] = useState(null)

  const loadSession = useCallback(async () => {
    let ident = null
    try {
      const me = await getFounderIdentity()
      ident = me?.identity || null
    } catch {
      ident = null
    }
    setIdentity(ident)
    if (classifyIdentity(ident) !== 'HUMAN') {
      setTenantState(null)
      return
    }
    try {
      const payload = await getFounderTenant()
      setTenantState(classifyTenantResponse(payload, 200))
    } catch (err) {
      setTenantState(classifyTenantResponse(null, err.response?.status))
    }
  }, [])

  const load = useCallback(async () => {
    try {
      const res = await api.get('/api/v1/integrations/connectors')
      setConnectors(res.data.connectors || [])
      setOffline(false)
    } catch {
      setOffline(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadSession().then(() => load())
  }, [load, loadSession])

  const gmailReady = gmailSurfaceAllowed({ identity, tenantState })

  const openConfigure = (connector) => {
    if (connector.name === 'gmail' && !gmailReady) return
    setOpenForm(connector.name)
    setFormValues({})
  }

  const submitConfigure = async (e, connector) => {
    e.preventDefault()
    if (connector.name === 'gmail' && !gmailReady) {
      setNotice(tenantState === 'multi_org_unsupported' ? MULTI_ORG_MESSAGE : NO_ORG_MESSAGE)
      return
    }
    setBusy(true)
    try {
      const payload = connectorConfigPayload(formValues)
      await api.post(`/api/v1/integrations/connectors/${connector.name}/configure`, payload)
      setNotice(`${connector.label} configured`)
      setOpenForm(null)
      setFormValues({})
      await load()
    } catch (err) {
      setNotice(err.response?.data?.detail || `Failed to configure ${connector.label}`)
    } finally {
      setBusy(false)
    }
  }

  const removeConnector = async (connector) => {
    if (connector.name === 'gmail' && !gmailReady) return
    setBusy(true)
    try {
      await api.delete(`/api/v1/integrations/connectors/${connector.name}`)
      setNotice(`${connector.label} credentials removed`)
      await load()
    } finally {
      setBusy(false)
    }
  }

  const connectOauth = async (connector) => {
    if (connector.name === 'gmail' && !gmailReady) {
      setNotice(tenantState === 'multi_org_unsupported' ? MULTI_ORG_MESSAGE : NO_ORG_MESSAGE)
      return
    }
    setBusy(true)
    try {
      const res = await api.get(`/api/v1/integrations/${connector.name}/authorize`)
      window.open(res.data.authorize_url, '_blank', 'noopener')
      setNotice(`Complete the consent screen in the new tab, then come back and refresh.`)
    } catch (err) {
      setNotice(err.response?.data?.detail || `Failed to start ${connector.label} connection`)
    } finally {
      setBusy(false)
    }
  }

  const syncNow = async (connector) => {
    if (connector.name === 'gmail' && !gmailReady) {
      setNotice(tenantState === 'multi_org_unsupported' ? MULTI_ORG_MESSAGE : NO_ORG_MESSAGE)
      return
    }
    setBusy(true)
    try {
      const res = await api.post(`/api/v1/integrations/${connector.name}/sync`)
      const r = parseGmailSyncResponse(res.data)
      setNotice(
        r.ok === false ? (r.reason || 'Sync did not run')
          : `Synced ${connector.label}: checked ${r.checked ?? 0}, matched ${r.matched ?? 0}, logged ${r.created ?? 0} new`,
      )
    } catch (err) {
      setNotice(err.response?.data?.detail || `Sync failed for ${connector.label}`)
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <div className="loading">Loading integrations…</div>

  const byCategory = {}
  for (const c of connectors) {
    byCategory[c.category] = byCategory[c.category] || []
    byCategory[c.category].push(c)
  }
  const configuredCount = connectors.filter(c => c.configured).length
  const gmailBlockedReason = tenantState === 'multi_org_unsupported'
    ? MULTI_ORG_MESSAGE
    : tenantState === 'no_membership'
      ? NO_ORG_MESSAGE
      : null

  return (
    <div>
      <h1>Integrations</h1>
      <p style={{ color: '#666', marginBottom: '2rem' }}>
        Every connector this platform knows about, in one place. Credentials
        you enter here are encrypted at rest and survive a restart — no
        re-entering an SMTP password after every deploy.
      </p>

      {offline && (
        <div className="card" style={{ borderLeft: '4px solid #D62828' }}>
          Backend offline — start the API on port 8000
        </div>
      )}
      {!gmailReady && gmailBlockedReason && (
        <div className="card" data-testid="gmail-tenant-blocked" style={{ borderLeft: '4px solid #D62828' }}>
          Gmail requires a Founder OS organization session. {gmailBlockedReason}
        </div>
      )}
      {notice && (
        <div className="card" style={{ borderLeft: '4px solid #667eea', padding: '1rem 2rem' }}>
          {String(notice)}
          <button className="btn btn-secondary" style={{ marginLeft: '1rem', padding: '0.2rem 0.6rem' }}
            onClick={() => setNotice(null)}>dismiss</button>
        </div>
      )}

      <div className="grid" style={{ marginBottom: '2rem' }}>
        <div className="stat-card">
          <div className="stat-label">Connectors</div>
          <div className="stat-number">{connectors.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Configured</div>
          <div className="stat-number">{configuredCount}</div>
        </div>
      </div>

      {Object.entries(byCategory).map(([category, items]) => (
        <div className="card" key={category}>
          <h2 className="card-title">{CATEGORY_LABELS[category] || category}</h2>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {items.map(c => {
              const isGmail = c.name === 'gmail'
              const gmailLocked = isGmail && !gmailReady
              return (
              <div key={c.name} style={{ border: '1px solid #eee', borderRadius: '8px', padding: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <strong>{c.label}</strong>
                    {c.source === 'env' && (
                      <span style={{ color: '#999', fontSize: '0.8rem', marginLeft: '0.6rem' }}>
                        via env: {c.env_vars.join(', ')}
                      </span>
                    )}
                    {c.configured && c.updated_at && (
                      <span style={{ color: '#999', fontSize: '0.8rem', marginLeft: '0.6rem' }}>
                        · configured {fmt(c.updated_at)}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span className={`badge ${c.oauth ? (c.connected ? 'badge-success' : c.configured ? 'badge-warning' : 'badge-warning') : (c.configured ? 'badge-success' : 'badge-warning')}`}>
                      {c.oauth ? (c.connected ? 'connected' : c.configured ? 'awaiting consent' : 'not configured') : (c.configured ? 'configured' : 'not configured')}
                    </span>
                    {c.source === 'vault' && (
                      <>
                        <button className="btn btn-secondary" style={{ padding: '0.35rem 0.7rem', fontSize: '0.8rem' }}
                          disabled={gmailLocked}
                          onClick={() => openForm === c.name ? setOpenForm(null) : openConfigure(c)}>
                          {openForm === c.name ? 'Cancel' : c.configured ? 'Reconfigure' : 'Configure'}
                        </button>
                        {c.oauth && c.configured && (
                          <button className="btn btn-secondary" style={{ padding: '0.35rem 0.7rem', fontSize: '0.8rem' }}
                            disabled={busy || gmailLocked} onClick={() => connectOauth(c)}>
                            {c.connected ? 'Reconnect' : 'Connect'}
                          </button>
                        )}
                        {c.oauth && c.connected && (
                          <button className="btn btn-secondary" style={{ padding: '0.35rem 0.7rem', fontSize: '0.8rem' }}
                            disabled={busy || gmailLocked} onClick={() => syncNow(c)}>
                            Sync now
                          </button>
                        )}
                        {c.configured && (
                          <button className="btn btn-secondary" style={{ padding: '0.35rem 0.7rem', fontSize: '0.8rem', color: '#D62828' }}
                            disabled={busy || gmailLocked} onClick={() => removeConnector(c)}>
                            Remove
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {openForm === c.name && !gmailLocked && (
                  <form onSubmit={e => submitConfigure(e, c)} style={{ marginTop: '1rem', display: 'grid', gap: '0.6rem' }}>
                    {c.fields.map(f => (
                      <div key={f.key} className="form-group" style={{ marginBottom: 0 }}>
                        <label htmlFor={`connector-${c.name}-${f.key}`} style={{ fontSize: '0.85rem' }}>{f.label}</label>
                        <input
                          id={`connector-${c.name}-${f.key}`}
                          type={f.type === 'password' ? 'password' : f.type === 'number' ? 'number' : 'text'}
                          value={formValues[f.key] || ''}
                          onChange={e => setFormValues({ ...formValues, [f.key]: e.target.value })}
                          style={{ padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px', width: '100%' }}
                        />
                      </div>
                    ))}
                    <button type="submit" className="btn btn-primary" disabled={busy} style={{ justifySelf: 'start' }}>
                      Save
                    </button>
                  </form>
                )}
              </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
