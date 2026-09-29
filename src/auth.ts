const issuer = import.meta.env.VITE_WARD_ISSUER ?? 'https://ward.deltavdevs.com'
const clientId = import.meta.env.VITE_WARD_CLIENT_ID ?? 'spectralis-player'
const callback = `${window.location.origin}/auth/callback`
const storedToken = 'spectralis.ward.access-token'

const base64Url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes))
  .replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')

const verifier = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(48))
  return base64Url(bytes)
}

const challengeFor = async (value: string) => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return base64Url(new Uint8Array(digest))
}

export type WardProfile = { sub: string; name?: string; preferred_username?: string; picture?: string }

export const ward = {
  token: () => sessionStorage.getItem(storedToken),
  signOut: () => sessionStorage.removeItem(storedToken),
  async signIn() {
    const state = crypto.randomUUID()
    const codeVerifier = verifier()
    sessionStorage.setItem('spectralis.ward.state', state)
    sessionStorage.setItem('spectralis.ward.verifier', codeVerifier)
    const query = new URLSearchParams({
      client_id: clientId,
      redirect_uri: callback,
      response_type: 'code',
      scope: 'openid profile',
      state,
      nonce: crypto.randomUUID(),
      code_challenge: await challengeFor(codeVerifier),
      code_challenge_method: 'S256',
    })
    window.location.assign(`${issuer}/oauth/authorize?${query}`)
  },
  async finishCallback() {
    const query = new URLSearchParams(window.location.search)
    if (query.get('state') !== sessionStorage.getItem('spectralis.ward.state')) throw new Error('Ward sign-in could not be verified. Please try again.')
    const code = query.get('code')
    const codeVerifier = sessionStorage.getItem('spectralis.ward.verifier')
    if (!code || !codeVerifier) throw new Error('Ward did not return a usable sign-in code.')
    const response = await fetch(`${issuer}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'authorization_code', client_id: clientId, code, redirect_uri: callback, code_verifier: codeVerifier }),
    })
    const data = await response.json() as { access_token?: string; error_description?: string }
    if (!response.ok || !data.access_token) throw new Error(data.error_description ?? 'Ward sign-in failed.')
    sessionStorage.setItem(storedToken, data.access_token)
    sessionStorage.removeItem('spectralis.ward.state')
    sessionStorage.removeItem('spectralis.ward.verifier')
    window.history.replaceState({}, '', '/')
  },
  async profile(): Promise<WardProfile | null> {
    const token = ward.token()
    if (!token) return null
    const response = await fetch(`${issuer}/oauth/userinfo`, { headers: { Authorization: `Bearer ${token}` } })
    return response.ok ? response.json() as Promise<WardProfile> : null
  },
}
