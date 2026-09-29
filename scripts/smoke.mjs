import assert from 'node:assert/strict'

const base = process.env.SMOKE_URL || 'http://127.0.0.1:3137'
const home = await fetch(base)
assert.equal(home.status, 200)
const html = await home.text()
assert.equal((html.match(/<title>/g) || []).length, 1)
assert.equal((html.match(/name="description"/g) || []).length, 1)
for (const [path, type] of [
  ['/favicon.svg', 'image/svg+xml'],
  ['/og-default.png', 'image/png'],
]) {
  const response = await fetch(`${base}${path}`)
  assert.equal(response.status, 200)
  assert.ok(response.headers.get('content-type')?.includes(type))
}
const privateRoom = await fetch(`${base}/sessions/ABC123`)
assert.equal(privateRoom.headers.get('x-robots-tag'), 'noindex, nofollow')
assert.ok((await privateRoom.text()).includes('Private Shared Play'))
console.log(
  'Homepage metadata, image MIME types and private-session indexing: passed.',
)
