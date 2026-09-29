import { test, expect, type Page } from '@playwright/test'
import { zipSync } from 'fflate'

// Fixture rooms exist only in intercepted browser requests, never in the app or database.
const rooms = [
  {
    id: 'after-hours',
    name: 'after hours',
    host: 'milo',
    kind: 'channel',
    tags: ['ambient', 'late night', 'all ages'],
    isLive: true,
    listeners: 18,
    nowPlaying: { title: 'Weightless', artist: 'Marconi Union' },
  },
  {
    id: 'soft-static',
    name: 'soft static',
    host: 'rae',
    kind: 'channel',
    tags: ['Shoegaze', 'explicit'],
    isLive: true,
    listeners: 12,
    nowPlaying: { title: 'When the Sun Hits', artist: 'Slowdive' },
  },
  {
    id: 'side-b',
    name: 'side B requests',
    host: 'finch',
    kind: 'streamer_queue',
    tags: ['requests', 'shoegaze', '18+'],
    isLive: true,
    listeners: 7,
    nowPlaying: { title: 'The Rip', artist: 'Portishead' },
  },
  {
    id: 'unspooled',
    name: 'unspooled',
    host: 'Jun',
    kind: 'channel',
    tags: ['jazz', 'vinyl'],
    isLive: true,
    listeners: 4,
    nowPlaying: { title: 'Peace Piece', artist: 'Bill Evans' },
  },
  {
    id: 'night-drive',
    name: 'night drive',
    host: 'sam',
    kind: 'streamer_queue',
    tags: ['electronic', 'requests'],
    isLive: false,
    listeners: 0,
  },
  {
    id: 'warm-machines',
    name: 'warm machines',
    host: 'Lou',
    kind: 'channel',
    tags: ['ambient', 'electronic'],
    isLive: false,
    listeners: 0,
  },
].map((room) => ({ ...room, security: 'anyone' }))

async function directory(page: Page, data = rooms) {
  await page.route('**/player/v1/rooms', (route) =>
    route.fulfill({ json: { rooms: data } }),
  )
}

test('tags, text, type and layouts compose without losing information', async ({
  page,
}) => {
  await directory(page)
  await page.goto('/')
  await expect(page.locator('.room-card')).toHaveCount(6)
  await page.getByRole('button', { name: 'Tags', exact: true }).click()
  await page.getByRole('textbox', { name: 'Search tags' }).fill('shoe')
  await expect(page.locator('.tag-option')).toHaveCount(1)
  await page.locator('.tag-option').click()
  await expect(page.locator('.room-card')).toHaveCount(2)
  await page.getByRole('button', { name: 'Done', exact: true }).click()
  await page.getByRole('button', { name: 'List view' }).click()
  await expect(page.locator('.view-list .room-card')).toHaveCount(2)
  await expect(page.locator('.view-list .listener-count').first()).toBeVisible()
  await page.getByRole('textbox', { name: 'Search rooms' }).fill('  FINCH  ')
  await expect(page.locator('.room-card')).toHaveCount(1)
  await expect(page.locator('.room-card h2')).toHaveText('side B requests')
  await page.getByRole('button', { name: 'Channels', exact: true }).click()
  await expect(page.getByText('Nothing on this frequency.')).toBeVisible()
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click()
  await expect(page.locator('.room-card')).toHaveCount(6)
  await page.reload()
  await expect(page.getByRole('button', { name: 'List view' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
})

test('no rooms and unavailable directory are distinct states', async ({
  page,
}) => {
  await directory(page, [])
  await page.goto('/')
  await expect(page.getByText('Quiet in here for now.')).toBeVisible()
  await expect(page.locator('.room-card')).toHaveCount(0)
  await page.screenshot({
    path: 'test-results/directory-empty.png',
    fullPage: true,
  })
  await page.unroute('**/player/v1/rooms')
  await page.route('**/player/v1/rooms', (route) =>
    route.fulfill({ status: 503, json: { error: 'Temporarily offline.' } }),
  )
  await page.reload()
  await expect(page.getByRole('alert')).toContainText('Temporarily offline.')
  await expect(page.getByText('Quiet in here for now.')).toHaveCount(0)
})

test('expired Ward access cannot break public browsing', async ({ page }) => {
  await directory(page)
  await page.addInitScript(() =>
    sessionStorage.setItem('spectralis.ward.access-token', 'test-expired'),
  )
  await page.route('**/oauth/userinfo', (route) =>
    route.fulfill({ status: 401, json: { error: 'expired' } }),
  )
  await page.goto('/')
  await expect(page.locator('.room-card')).toHaveCount(6)
  await page.getByRole('button', { name: 'New room' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Continue with Ward' }),
  ).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'New room' })).toBeFocused()
})

test('grid, list and mobile fit the viewport and keep tags accessible', async ({
  page,
}) => {
  await directory(page)
  await page.goto('/')
  await expect(page.locator('.room-card')).toHaveCount(6)
  await page.screenshot({
    path: 'test-results/directory-grid.png',
    fullPage: true,
  })
  await page.getByRole('button', { name: 'List view' }).click()
  await page.screenshot({
    path: 'test-results/directory-list.png',
    fullPage: true,
  })
  for (const width of [1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 844 })
    await expect(page.getByRole('button', { name: 'Grid view' })).toBeVisible()
    for (const label of ['Grid view', 'List view']) {
      await page.getByRole('button', { name: label }).click()
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true)
      await expect(page.locator('.room-tags').first()).toBeVisible()
    }
  }
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: 'Grid view' }).click()
  await page.screenshot({
    path: 'test-results/directory-mobile.png',
    fullPage: true,
  })
})

function silentWav() {
  const samples = 44100 * 30
  const buffer = Buffer.alloc(44 + samples * 2)
  buffer.write('RIFF')
  buffer.writeUInt32LE(buffer.length - 8, 4)
  buffer.write('WAVEfmt ', 8)
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(1, 22)
  buffer.writeUInt32LE(44100, 24)
  buffer.writeUInt32LE(88200, 28)
  buffer.writeUInt16LE(2, 32)
  buffer.writeUInt16LE(16, 34)
  buffer.write('data', 36)
  buffer.writeUInt32LE(samples * 2, 40)
  return buffer
}

async function sessionRoutes(page: Page) {
  const tracks = [
    {
      id: 'one',
      title: 'Weightless',
      artist: 'Marconi Union',
      durationSeconds: 480,
    },
    {
      id: 'two',
      title: 'First Light',
      artist: 'Harold Budd',
      durationSeconds: 419,
    },
    {
      id: 'three',
      title: 'An Ending (Ascent)',
      artist: 'Brian Eno',
      durationSeconds: 266,
    },
  ]
  const code = 'ABC123'
  const base = 'https://audioplayer-production-5b83.up.railway.app'
  let paused = false
  let position = 3
  await page.route('**/shared-play/v2/sessions/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    const json = (value: unknown) => route.fulfill({ json: value })
    if (path.endsWith('/package'))
      return route.fulfill({
        contentType: 'application/zip',
        body: Buffer.from(zipSync({ 'audio/track.wav': silentWav() })),
      })
    if (path.endsWith('/queue/items')) {
      const item = route.request().postDataJSON().item
      tracks.push({
        id: 'new',
        title: item.url,
        artist: '',
        durationSeconds: 0,
      })
      return json({ items: tracks, currentIndex: 0 })
    }
    if (path.endsWith('/queue')) return json({ items: tracks, currentIndex: 0 })
    if (path.endsWith('/streamer-queue'))
      return json({ enabled: false, submissions: [] })
    if (path.endsWith('/presence')) return json({ listenerCount: 18 })
    return json({
      session: {
        roomCode: code,
        trackId: 'one',
        packageUrl: `${base}/shared-play/v2/sessions/${code}/package`,
        track: tracks[0],
        playback: {
          isPlaying: !paused,
          positionSeconds: position,
          durationSeconds: 30,
          hostClockUtc: new Date().toISOString(),
        },
      },
    })
  })
  return {
    finishHost: () => {
      position = 31
    },
    pauseHost: () => {
      paused = true
    },
  }
}

test('private invite stays in React, plays the real package, pauses and submits a request', async ({
  page,
}) => {
  await directory(page)
  const session = await sessionRoutes(page)
  await page.goto('/')
  await page
    .getByRole('textbox', { name: 'Room code', exact: true })
    .fill('bad')
  await page.getByRole('button', { name: 'Join room', exact: true }).click()
  await expect(
    page.getByText('Enter the six-character code from your invite.'),
  ).toBeVisible()
  await page
    .getByRole('textbox', { name: 'Room code', exact: true })
    .fill('abc-123')
  await page.getByRole('button', { name: 'Join room', exact: true }).click()
  await expect(page).toHaveURL(/\/sessions\/ABC123$/)
  await expect(page.locator('.queue-tracks li')).toHaveCount(3)
  await expect(
    page.getByRole('button', { name: 'Start listening' }),
  ).toBeEnabled()
  await page.getByRole('button', { name: 'Start listening' }).click()
  await expect
    .poll(() =>
      page
        .locator('audio')
        .evaluate((el: HTMLAudioElement) => !el.paused && el.currentTime > 2),
    )
    .toBe(true)
  await page.getByRole('button', { name: 'Pause listening' }).click()
  await expect
    .poll(() =>
      page.locator('audio').evaluate((el: HTMLAudioElement) => el.paused),
    )
    .toBe(true)
  await page.getByRole('textbox', { name: 'Search queue' }).fill('ENO')
  await expect(page.locator('.queue-tracks li')).toHaveCount(1)
  await page.getByRole('textbox', { name: 'Search queue' }).fill('')
  await page
    .getByRole('textbox', { name: 'Request a track' })
    .fill('https://example.com/real-request')
  await page.getByRole('button', { name: 'Send request' }).click()
  await expect(page.getByRole('status')).toContainText(
    'Your request is in the queue.',
  )
  await expect(page.locator('.queue-tracks li')).toHaveCount(4)
  await page.getByRole('button', { name: 'Start listening' }).click()
  session.pauseHost()
  await expect
    .poll(
      () => page.locator('audio').evaluate((el: HTMLAudioElement) => el.paused),
      { timeout: 10_000 },
    )
    .toBe(true)
  await page.getByRole('button', { name: 'Hide queue' }).click()
  await expect(page.locator('.queue-tracks')).toHaveCount(0)
  await page.getByRole('button', { name: 'Show queue' }).click()
  await expect(page.locator('.queue-tracks li')).toHaveCount(4)
})

test('finished audio waits for the next host track instead of looping', async ({
  page,
}) => {
  const session = await sessionRoutes(page)
  session.finishHost()
  await page.goto('/sessions/ABC123')
  await expect(
    page.getByRole('button', { name: 'Start listening' }),
  ).toBeEnabled()
  await page.getByRole('button', { name: 'Start listening' }).click()
  await expect
    .poll(() =>
      page
        .locator('audio')
        .evaluate((el: HTMLAudioElement) => el.paused && el.currentTime >= 29),
    )
    .toBe(true)
})

test('room screenshots and mobile queue controls', async ({ page }) => {
  await page.route('**/player/v1/rooms/after-hours', (route) =>
    route.fulfill({ json: rooms[0] }),
  )
  await page.route('**/shared-play/v2/channels/after-hours', (route) =>
    route.fulfill({ json: { isLive: true, roomCode: 'ABC123' } }),
  )
  await sessionRoutes(page)
  await page.goto('/rooms/after-hours')
  await expect(
    page.getByRole('button', { name: 'Start listening' }),
  ).toBeEnabled()
  await page.screenshot({
    path: 'test-results/room-desktop.png',
    fullPage: true,
  })
  await page.setViewportSize({ width: 390, height: 844 })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  await page.getByRole('button', { name: 'Hide queue' }).click()
  await expect(page.getByRole('button', { name: 'Show queue' })).toBeVisible()
  await page.getByRole('button', { name: 'Show queue' }).click()
  await page.screenshot({
    path: 'test-results/room-mobile.png',
    fullPage: true,
  })
})

test('server request failures are not reported as successful submissions', async ({
  page,
}) => {
  await sessionRoutes(page)
  await page.route('**/queue/items', (route) =>
    route.fulfill({
      status: 403,
      json: { error: 'The host has closed requests.' },
    }),
  )
  await page.goto('/sessions/ABC123')
  await page
    .getByRole('textbox', { name: 'Request a track' })
    .fill('https://example.com/song')
  await page.getByRole('button', { name: 'Send request' }).click()
  await expect(page.getByRole('status')).toContainText(
    'The host has closed requests.',
  )
  await expect(
    page.getByRole('textbox', { name: 'Request a track' }),
  ).toHaveValue('https://example.com/song')
})
