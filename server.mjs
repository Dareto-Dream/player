import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import express from 'express'

const app = express()
const port = Number(process.env.PORT ?? 3000)
const apiBase = (process.env.PLAYER_API ?? 'https://audioplayer-production.up.railway.app').replace(/\/$/, '')
const siteUrl = (process.env.PLAYER_URL ?? 'https://player.deltavdevs.com').replace(/\/$/, '')
const html = await readFile(resolve('dist/index.html'), 'utf8')

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

app.use('/assets', express.static(resolve('dist/assets'), { immutable: true, maxAge: '1y' }))
app.get('/rooms/:id', async (request, response) => {
  const room = await roomFor(request.params.id).catch(() => null)
  response.type('html').send(documentFor(room, `${siteUrl}/rooms/${encodeURIComponent(request.params.id)}`))
})
app.get('*', (_request, response) => response.type('html').send(documentFor(null, siteUrl)))
app.listen(port, '0.0.0.0', () => console.log(`Spectralis Player listening on ${port}`))
