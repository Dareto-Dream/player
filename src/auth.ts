const issuer = import.meta.env.VITE_WARD_ISSUER ?? 'https://ward.deltavdevs.com'
const storedToken = 'spectralis.ward.access-token'

export type WardProfile = {
  sub: string
  name?: string
  preferred_username?: string
  picture?: string
}

export const ward = {
  token: () => sessionStorage.getItem(storedToken),
  signOut: () => sessionStorage.removeItem(storedToken),
  signIn() {
    window.location.assign(
      `/auth/login?returnTo=${encodeURIComponent(window.location.pathname + window.location.search)}`,
    )
  },
  hydrateCallback() {
    const token = new URLSearchParams(window.location.hash.slice(1)).get(
      'ward_access_token',
    )
    if (!token) return
    sessionStorage.setItem(storedToken, token)
    window.history.replaceState(
      {},
      '',
      window.location.pathname + window.location.search,
    )
  },
  async profile(): Promise<WardProfile | null> {
    const token = ward.token()
    if (!token) return null
    const response = await fetch(`${issuer}/oauth/userinfo`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (response.status === 401 || response.status === 403) {
      ward.signOut()
      return null
    }
    if (!response.ok) throw new Error('Ward is temporarily unavailable.')
    return response.json() as Promise<WardProfile>
  },
}
