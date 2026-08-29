import axios from 'axios'

// Dev: Vite proxies /api -> http://localhost:8000 (see vite.config.js).
// Production: the FastAPI server hosts the built frontend, so requests go
// to the same origin directly. Override with VITE_API_BASE if the API
// lives elsewhere.
const baseURL = import.meta.env.VITE_API_BASE || (import.meta.env.DEV ? '/api' : '')

const api = axios.create({
  baseURL,
  withCredentials: true,
})

export function setApiKey(key) {
  if (typeof localStorage === 'undefined') return
  if (key) localStorage.setItem('crm_api_key', key)
  else localStorage.removeItem('crm_api_key')
}

export function getApiKey() {
  if (typeof localStorage === 'undefined') return ''
  return localStorage.getItem('crm_api_key') || ''
}

export function isAuthed() {
  if (typeof localStorage === 'undefined') return false
  return localStorage.getItem('crm_authed') === '1'
}

export function setAuthed(value) {
  if (typeof localStorage === 'undefined') return
  if (value) localStorage.setItem('crm_authed', '1')
  else localStorage.removeItem('crm_authed')
}

export function isHumanIdentity(identity) {
  if (!identity || typeof identity !== 'object') return false
  return identity.principal_kind === 'HUMAN' && identity.is_human === true
}

export function classifyIdentity(identity) {
  if (isHumanIdentity(identity)) return 'HUMAN'
  const kind = identity?.principal_kind
  if (kind === 'SERVICE') return 'SERVICE'
  if (kind === 'ANONYMOUS') return 'ANONYMOUS'
  return 'ANONYMOUS'
}

export function classifyTenantResponse(payload, httpStatus) {
  if (httpStatus === 403) return 'multi_org_unsupported'
  const tenant = payload?.tenant
  if (tenant && tenant.organization_id) return 'ready'
  return 'no_membership'
}

export function gmailSurfaceAllowed({ identity, tenantState }) {
  return isHumanIdentity(identity) && tenantState === 'ready'
}

export function connectorConfigPayload(values) {
  const body = { ...(values || {}) }
  delete body.organization_id
  return body
}

export function parseGmailSyncResponse(data) {
  const r = data && typeof data === 'object' ? data : {}
  return {
    ok: r.ok,
    reason: r.reason,
    checked: r.checked,
    matched: r.matched,
    created: r.created,
    organization_id: r.organization_id,
  }
}

export async function loginFounderOS(email, password) {
  const res = await api.post('/api/v1/identity/login', { email, password })
  return res.data
}

export async function getFounderIdentity() {
  const res = await api.get('/api/v1/identity/me')
  return res.data
}

export async function getFounderTenant() {
  const res = await api.get('/api/v1/tenant/me')
  return res.data
}

export async function selectFounderTenant(organizationId) {
  const res = await api.post('/api/v1/tenant/select', {
    organization_id: organizationId,
  })
  return res.data
}

export async function logoutFounderOS() {
  try {
    await api.post('/api/v1/identity/logout')
  } finally {
    setApiKey('')
    setAuthed(false)
  }
}

export async function logout() {
  await logoutFounderOS()
  window.location.hash = '#/login'
  if (import.meta.env.MODE !== 'test') window.location.reload()
}

api.interceptors.request.use(config => {
  const key = getApiKey()
  if (key) config.headers.Authorization = `Bearer ${key}`
  return config
})

export default api
