import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import express from 'express'

const app = express()
const port = Number(process.env.PORT ?? 3000)
const apiBase = (process.env.PLAYER_API ?? 'https://audioplayer-production.up.railway.app').replace(/\/$/, '')
const siteUrl = (process.env.PLAYER_URL ?? 'https://player.deltavdevs.com').replace(/\/$/, '')
const wardIssuer = (process.env.WARD_ISSUER ?? 'https://ward.deltavdevs.com').replace(/\/$/, '')
const wardClientId = process.env.WARD_CLIENT_ID
const wardClientSecret = process.env.WARD_CLIENT_SECRET
const html = await readFile(resolve('dist/index.html'), 'utf8')
const pendingAuth = new Map()

const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])
const metadata = room => {
  const name = room.name || 'Spectralis room'
  const title = room.seoTitle || `${name} · Spectralis Player`
  const description = room.seoDescription || room.description || `Join ${name} on Spectralis Player.`
  const image = room.ogImageUrl || room.bannerUrl || `${siteUrl}/og-default.png`
  return { title, description, image }
}

async function roomFor(id) {
  const response = await fetch(`${apiBase}/player/v1/rooms/${encodeURIComponent(id)}`, { headers: { Accept: 'application/json' } })
  return response.ok ? response.json() : null
}

function documentFor(room, canonical) {
  const { title, description, image } = metadata(room ?? {})
  const tags = [
    `<title>${escape(title)}</title>`,
    `<meta name="description" content="${escape(description)}">`,
    `<link rel="canonical" href="${escape(canonical)}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="Spectralis Player">`,
    `<meta property="og:title" content="${escape(title)}">`,
    `<meta property="og:description" content="${escape(description)}">`,
    `<meta property="og:url" content="${escape(canonical)}">`,
    `<meta property="og:image" content="${escape(image)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${escape(title)}">`,
    `<meta name="twitter:description" content="${escape(description)}">`,
    `<meta name="twitter:image" content="${escape(image)}">`,
  ].join('')
  return html.replace('</head>', `${tags}</head>`)
}

const base64Url = value => Buffer.from(value).toString('base64url')
const pkceChallenge = verifier => createHash('sha256').update(verifier).digest('base64url')

app.get('/auth/login', (request, response) => {
  if (!wardClientId || !wardClientSecret) return response.status(503).send('Ward sign-in is not configured yet.')
  const state = randomUUID()
  const verifier = base64Url(randomBytes(48))
  pendingAuth.set(state, { verifier, createdAt: Date.now() })
  for (const [key, pending] of pendingAuth) if (Date.now() - pending.createdAt > 10 * 60_000) pendingAuth.delete(key)
  const query = new URLSearchParams({
    client_id: wardClientId,
    redirect_uri: `${siteUrl}/auth/callback`,
    response_type: 'code',
    scope: 'openid profile',
    state,
    nonce: randomUUID(),
    code_challenge: pkceChallenge(verifier),
    code_challenge_method: 'S256',
  })
  response.redirect(`${wardIssuer}/oauth/authorize?${query}`)
})

app.get('/auth/callback', async (request, response) => {
  const code = typeof request.query.code === 'string' ? request.query.code : ''
  const state = typeof request.query.state === 'string' ? request.query.state : ''
  const pending = pendingAuth.get(state)
  pendingAuth.delete(state)
  if (!code || !pending) return response.status(400).send('Ward sign-in could not be verified. Start again from the player.')
  try {
    const tokenResponse = await fetch(`${wardIssuer}/oauth/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${wardClientId}:${wardClientSecret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: `${siteUrl}/auth/callback`, code_verifier: pending.verifier }),
    })
    const token = await tokenResponse.json()
    if (!tokenResponse.ok || !token.access_token) throw new Error('Ward did not issue an access token.')
    response.redirect(`/#ward_access_token=${encodeURIComponent(token.access_token)}`)
  } catch (error) {
    console.error('Ward callback failed:', error instanceof Error ? error.message : error)
    response.status(502).send('Ward sign-in failed. Please try again.')
  }
})

app.use('/assets', express.static(resolve('dist/assets'), { immutable: true, maxAge: '1y' }))
app.get('/rooms/:id', async (request, response) => {
  const room = await roomFor(request.params.id).catch(() => null)
  response.type('html').send(documentFor(room, `${siteUrl}/rooms/${encodeURIComponent(request.params.id)}`))
})
app.get('*', (_request, response) => response.type('html').send(documentFor(null, siteUrl)))
app.listen(port, '0.0.0.0', () => console.log(`Spectralis Player listening on ${port}`))
