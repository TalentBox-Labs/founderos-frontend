import React from 'react'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import {
  classifyIdentity,
  classifyTenantResponse,
  connectorConfigPayload,
  gmailSurfaceAllowed,
  isHumanIdentity,
  parseGmailSyncResponse,
} from '../src/api.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function src(rel) {
  return readFileSync(join(root, rel), 'utf8')
}

describe('identity and tenant helpers', () => {
  it('classifies HUMAN only when principal_kind and is_human agree', () => {
    expect(isHumanIdentity({ principal_kind: 'HUMAN', is_human: true })).toBe(true)
    expect(isHumanIdentity({ principal_kind: 'SERVICE', is_human: false })).toBe(false)
    expect(isHumanIdentity({ principal_kind: 'ANONYMOUS', is_human: false })).toBe(false)
    expect(isHumanIdentity({ principal_kind: 'HUMAN', is_human: false })).toBe(false)
    expect(classifyIdentity({ principal_kind: 'SERVICE', is_human: false })).toBe('SERVICE')
    expect(classifyIdentity({ principal_kind: 'ANONYMOUS' })).toBe('ANONYMOUS')
  })

  it('crm_authed is not human authority', () => {
    localStorage.setItem('crm_authed', '1')
    localStorage.setItem('crm_api_key', 'platform-only-key')
    expect(isHumanIdentity(null)).toBe(false)
    expect(gmailSurfaceAllowed({
      identity: { principal_kind: 'SERVICE', is_human: false },
      tenantState: 'ready',
    })).toBe(false)
  })

  it('tenant bootstrap states match backend evidence', () => {
    expect(classifyTenantResponse({ ok: true, tenant: { organization_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' } }, 200)).toBe('ready')
    expect(classifyTenantResponse({ ok: true, tenant: null }, 200)).toBe('no_membership')
    expect(classifyTenantResponse(null, 403)).toBe('multi_org_unsupported')
  })

  it('single-org tenant enables Gmail; zero-membership and multi-org do not', () => {
    const human = { principal_kind: 'HUMAN', is_human: true }
    expect(gmailSurfaceAllowed({ identity: human, tenantState: 'ready' })).toBe(true)
    expect(gmailSurfaceAllowed({ identity: human, tenantState: 'no_membership' })).toBe(false)
    expect(gmailSurfaceAllowed({ identity: human, tenantState: 'multi_org_unsupported' })).toBe(false)
    expect(gmailSurfaceAllowed({ identity: { principal_kind: 'ANONYMOUS' }, tenantState: 'ready' })).toBe(false)
    expect(gmailSurfaceAllowed({ identity: { principal_kind: 'SERVICE', is_human: false }, tenantState: 'ready' })).toBe(false)
  })

  it('strips client organization_id from connector payloads', () => {
    expect(connectorConfigPayload({
      client_id: 'cid',
      organization_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    })).toEqual({ client_id: 'cid' })
  })

  it('parses Gmail sync payload at the top level, not res.data.result', () => {
    const parsed = parseGmailSyncResponse({
      ok: true,
      checked: 3,
      matched: 1,
      created: 1,
      organization_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    })
    expect(parsed.created).toBe(1)
    expect(parseGmailSyncResponse({ result: { created: 9 } }).created).toBeUndefined()
  })
})

describe('source contract: no client tenant assertion', () => {
  it('does not introduce X-Organization-Id', () => {
    for (const file of ['src/api.js', 'src/pages/Login.jsx', 'src/App.jsx', 'src/pages/Integrations.jsx']) {
      expect(src(file)).not.toMatch(/X-Organization-Id/i)
    }
  })

  it('does not send organization_id as Gmail authority in Integrations', () => {
    const integrations = src('src/pages/Integrations.jsx')
    expect(integrations).toContain('connectorConfigPayload')
    expect(integrations).not.toMatch(/headers:\s*\{[^}]*organization/i)
    expect(integrations).not.toMatch(/params:\s*\{[^}]*organization_id/)
  })

  it('login uses Founder OS identity login, not heartbeat as human proof', () => {
    const login = src('src/pages/Login.jsx')
    expect(login).toContain('loginFounderOS')
    expect(login).not.toContain('heartbeat/status')
    expect(login).not.toContain('setAuthed(true)')
    expect(src('src/api.js')).toContain("api.post('/api/v1/identity/login'")
  })

  it('bootstrap and logout use proven identity/tenant endpoints', () => {
    const app = src('src/App.jsx')
    expect(app).toContain('getFounderIdentity')
    expect(app).toContain('getFounderTenant')
    expect(app).toContain('logout')
    expect(app).not.toContain('isAuthed()')
    const api = src('src/api.js')
    expect(api).toContain("api.post('/api/v1/identity/login'")
    expect(api).toContain("api.get('/api/v1/identity/me'")
    expect(api).toContain("api.post('/api/v1/identity/logout'")
    expect(api).toContain("api.get('/api/v1/tenant/me'")
    expect(api).toContain('withCredentials: true')
  })

  it('does not store Founder OS JWT in localStorage helpers', () => {
    const api = src('src/api.js')
    expect(api).not.toMatch(/localStorage\.setItem\([^)]*token/i)
    expect(api).not.toMatch(/localStorage\.setItem\([^)]*jwt/i)
    expect(api).not.toMatch(/localStorage\.setItem\([^)]*founder_os_identity/)
  })
})

vi.mock('../src/api.js', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    loginFounderOS: vi.fn(),
    getFounderIdentity: vi.fn(),
    getFounderTenant: vi.fn(),
    logout: vi.fn(),
    logoutFounderOS: vi.fn(),
    default: {
      get: vi.fn(),
      post: vi.fn(),
      delete: vi.fn(),
      interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
    },
  }
})

describe('Login.jsx', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    if (window.location && typeof window.location.reload === 'function') {
      try { vi.spyOn(window.location, 'reload').mockImplementation(() => {}) } catch { /* jsdom */ }
    }
  })

  it('human login calls /api/v1/identity/login via loginFounderOS and stores no JWT', async () => {
    const { loginFounderOS } = await import('../src/api.js')
    loginFounderOS.mockResolvedValue({
      ok: true,
      identity: {
        principal_kind: 'HUMAN',
        is_human: true,
        user_id: 'u1',
        email: 'owner-a@example.com',
      },
    })
    const { default: Login } = await import('../src/pages/Login.jsx')
    render(<Login />)
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'owner-a@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'pass-o' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }))
    await waitFor(() => {
      expect(loginFounderOS).toHaveBeenCalledWith('owner-a@example.com', 'pass-o')
    })
    expect(loginFounderOS).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem('founder_os_identity')).toBeNull()
    expect(Object.keys(localStorage).join(',')).not.toMatch(/jwt|access_token|founder_os_identity/i)
  })

  it('optional service API key is stored separately and is not human login', async () => {
    const { loginFounderOS, setApiKey, getApiKey } = await import('../src/api.js')
    loginFounderOS.mockResolvedValue({
      ok: true,
      identity: { principal_kind: 'HUMAN', is_human: true },
    })
    const { default: Login } = await import('../src/pages/Login.jsx')
    render(<Login />)
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'owner-a@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'pass-o' } })
    fireEvent.change(screen.getByLabelText('Service API key (optional)'), {
      target: { value: 'platform-only-key' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }))
    await waitFor(() => expect(loginFounderOS).toHaveBeenCalled())
    expect(getApiKey()).toBe('platform-only-key')
    expect(localStorage.getItem('crm_authed')).toBeNull()
  })
})

describe('App.jsx bootstrap', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    const api = await import('../src/api.js')
    api.getFounderIdentity.mockResolvedValue({
      ok: true,
      identity: { principal_kind: 'ANONYMOUS', is_human: false },
    })
    api.getFounderTenant.mockResolvedValue({ ok: true, tenant: null })
    api.default.get.mockResolvedValue({ data: {} })
  })

  it('identity bootstrap uses /api/v1/identity/me and crm_authed is not sufficient', async () => {
    localStorage.setItem('crm_authed', '1')
    localStorage.setItem('crm_api_key', 'platform-only-key')
    const { getFounderIdentity } = await import('../src/api.js')
    const { default: App } = await import('../src/App.jsx')
    render(<App />)
    await waitFor(() => expect(getFounderIdentity).toHaveBeenCalled())
    expect(await screen.findByLabelText('Email')).toBeTruthy()
    expect(screen.queryByText('Dashboard')).toBeNull()
  })

  it('HUMAN session bootstraps tenant via /api/v1/tenant/me', async () => {
    const api = await import('../src/api.js')
    api.getFounderIdentity.mockResolvedValue({
      ok: true,
      identity: { principal_kind: 'HUMAN', is_human: true, email: 'owner-a@example.com' },
    })
    api.getFounderTenant.mockResolvedValue({
      ok: true,
      tenant: { organization_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', organization_name: 'A' },
    })
    const { default: App } = await import('../src/App.jsx')
    render(<App />)
    await waitFor(() => expect(api.getFounderTenant).toHaveBeenCalled())
    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeTruthy()
  })

  it('logout control is wired to backend identity logout helper', async () => {
    const api = await import('../src/api.js')
    api.getFounderIdentity.mockResolvedValue({
      ok: true,
      identity: { principal_kind: 'HUMAN', is_human: true },
    })
    api.getFounderTenant.mockResolvedValue({
      ok: true,
      tenant: { organization_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' },
    })
    const { default: App } = await import('../src/App.jsx')
    render(<App />)
    const button = await screen.findByRole('button', { name: 'Logout' })
    fireEvent.click(button)
    expect(api.logout).toHaveBeenCalled()
  })

  it('zero-membership HUMAN sees fail-closed organization message', async () => {
    const api = await import('../src/api.js')
    api.getFounderIdentity.mockResolvedValue({
      ok: true,
      identity: { principal_kind: 'HUMAN', is_human: true },
    })
    api.getFounderTenant.mockResolvedValue({ ok: true, tenant: null })
    const { default: App } = await import('../src/App.jsx')
    render(<App />)
    expect(await screen.findByText(/No active Founder OS organization is available/)).toBeTruthy()
  })

  it('multi-org 403 shows unsupported selection state without an org UUID field', async () => {
    const api = await import('../src/api.js')
    api.getFounderIdentity.mockResolvedValue({
      ok: true,
      identity: { principal_kind: 'HUMAN', is_human: true },
    })
    api.getFounderTenant.mockRejectedValue({ response: { status: 403 } })
    const { default: App } = await import('../src/App.jsx')
    render(<App />)
    expect(await screen.findByText(/organization selection is not yet enabled/)).toBeTruthy()
    expect(screen.queryByLabelText(/organization/i)).toBeNull()
  })
})

describe('Integrations.jsx Gmail surface', () => {
  const gmailConnector = {
    name: 'gmail',
    label: 'Gmail Sync',
    category: 'email',
    source: 'vault',
    oauth: true,
    configured: true,
    connected: true,
    fields: [
      { key: 'client_id', label: 'OAuth Client ID', type: 'text' },
      { key: 'client_secret', label: 'OAuth Client Secret', type: 'password' },
      { key: 'redirect_uri', label: 'Redirect URI', type: 'text' },
    ],
  }
  const slackConnector = {
    name: 'slack',
    label: 'Slack',
    category: 'notifications',
    source: 'vault',
    oauth: false,
    configured: false,
    fields: [{ key: 'webhook_url', label: 'Webhook URL', type: 'password' }],
  }

  beforeEach(async () => {
    vi.clearAllMocks()
    const api = await import('../src/api.js')
    api.default.get.mockResolvedValue({ data: { connectors: [gmailConnector, slackConnector] } })
    api.default.post.mockResolvedValue({ data: { ok: true, checked: 2, matched: 1, created: 1 } })
    api.getFounderIdentity.mockResolvedValue({
      ok: true,
      identity: { principal_kind: 'HUMAN', is_human: true },
    })
    api.getFounderTenant.mockResolvedValue({
      ok: true,
      tenant: { organization_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' },
    })
    vi.stubGlobal('open', vi.fn())
  })

  it('enables Gmail actions for a single-org HUMAN tenant', async () => {
    const { default: Integrations } = await import('../src/pages/Integrations.jsx')
    render(<Integrations />)
    expect(await screen.findByText('Gmail Sync')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Sync now' }).disabled).toBe(false)
    expect(screen.queryByTestId('gmail-tenant-blocked')).toBeNull()
  })

  it('disables Gmail when there is no membership', async () => {
    const api = await import('../src/api.js')
    api.getFounderTenant.mockResolvedValue({ ok: true, tenant: null })
    const { default: Integrations } = await import('../src/pages/Integrations.jsx')
    render(<Integrations />)
    expect(await screen.findByTestId('gmail-tenant-blocked')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Sync now' }).disabled).toBe(true)
    expect(screen.getByRole('button', { name: 'Configure' }).disabled).toBe(false)
  })

  it('disables Gmail on multi-org 403 and does not offer an org UUID field', async () => {
    const api = await import('../src/api.js')
    api.getFounderTenant.mockRejectedValue({ response: { status: 403 } })
    const { default: Integrations } = await import('../src/pages/Integrations.jsx')
    render(<Integrations />)
    expect(await screen.findByText(/organization selection is not yet enabled/)).toBeTruthy()
    expect(screen.queryByLabelText(/organization id/i)).toBeNull()
    expect(screen.getByRole('button', { name: 'Sync now' }).disabled).toBe(true)
  })

  it('Gmail authorize uses backend authorize route; configure omits client org authority', async () => {
    const apiMod = await import('../src/api.js')
    const { default: Integrations } = await import('../src/pages/Integrations.jsx')
    render(<Integrations />)
    await screen.findByText('Gmail Sync')
    fireEvent.click(screen.getByRole('button', { name: 'Reconnect' }))
    await waitFor(() => {
      expect(apiMod.default.get).toHaveBeenCalledWith('/api/v1/integrations/gmail/authorize')
    })
    fireEvent.click(screen.getByRole('button', { name: 'Reconfigure' }))
    fireEvent.change(screen.getByLabelText('OAuth Client ID'), { target: { value: 'cid' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => {
      expect(apiMod.default.post).toHaveBeenCalledWith(
        '/api/v1/integrations/connectors/gmail/configure',
        { client_id: 'cid' },
      )
    })
    const [, body] = apiMod.default.post.mock.calls.find((c) => String(c[0]).includes('/configure'))
    expect(body.organization_id).toBeUndefined()
  })

  it('Gmail sync parses the top-level backend payload', async () => {
    const { default: Integrations } = await import('../src/pages/Integrations.jsx')
    render(<Integrations />)
    fireEvent.click(await screen.findByRole('button', { name: 'Sync now' }))
    expect(await screen.findByText(/checked 2, matched 1, logged 1 new/)).toBeTruthy()
  })
})
