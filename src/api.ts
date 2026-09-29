import { ward } from './auth'

const base = (
  import.meta.env.VITE_PLAYER_API ??
  'https://audioplayer-production-5b83.up.railway.app'
).replace(/\/$/, '')

export type Room = {
  id: string
  name: string
  description?: string
  kind: 'channel' | 'streamer_queue'
  tags: string[]
  security: 'anyone' | 'ward' | 'approval'
  listeners: number
  host: string
  joinUrl?: string
  roomCode?: string | null
  isLive?: boolean
  artwork?: string
  bannerUrl?: string | null
  iconUrl?: string | null
  nowPlaying?: { title: string; artist?: string; artwork?: string }
}

async function request<T>(path: string, init: RequestInit = {}) {
  const token = ward.token()
  const response = await fetch(`${base}${path}`, {
    signal: AbortSignal.timeout(15_000),
    ...init,
    headers: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  })
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(
      body?.message ||
        body?.error ||
        `Could not reach the player service (${response.status}).`,
    )
  }
  return response.json() as Promise<T>
}

export const api = {
  browse: () => request<{ rooms: Room[] }>('/player/v1/rooms'),
  room: (id: string) =>
    request<Room>(`/player/v1/rooms/${encodeURIComponent(id)}`),
  channel: (id: string) =>
    request<{ isLive: boolean; roomCode?: string | null }>(
      `/shared-play/v2/channels/${encodeURIComponent(id)}`,
    ),
  session: async (code: string) => {
    const result = await request<{ session: Session }>(
      `/shared-play/v2/sessions/${encodeURIComponent(code)}`,
    )
    return result.session
  },
  queue: (code: string) =>
    request<{ items: QueueItem[]; currentIndex: number }>(
      `/shared-play/v2/sessions/${encodeURIComponent(code)}/queue`,
    ),
  presence: (code: string, clientId: string, displayName: string) =>
    request<{ listenerCount: number }>(
      `/shared-play/v2/sessions/${encodeURIComponent(code)}/presence`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, displayName }),
      },
    ),
  addQueueLink: (code: string, url: string) =>
    request(
      `/shared-play/v2/sessions/${encodeURIComponent(code)}/queue/items`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item: { url, title: url, sourceKind: 'url' } }),
      },
    ),
  sharedQueue: (code: string) =>
    request<SharedQueue>(
      `/shared-play/v2/sessions/${encodeURIComponent(code)}/streamer-queue`,
    ),
  submitSharedQueue: (
    code: string,
    submission: {
      url: string
      title?: string
      artist?: string
      displayName?: string
    },
  ) =>
    request<QueueSubmission>(
      `/shared-play/v2/sessions/${encodeURIComponent(code)}/streamer-queue/submit`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submission),
      },
    ),
  createRoom: (
    room: Pick<Room, 'name' | 'description' | 'kind' | 'tags' | 'security'>,
  ) =>
    request<Room>('/player/v1/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(room),
    }),
}

export type QueueItem = {
  id: string
  title?: string | null
  displayName?: string
  artist?: string | null
  url?: string
  artworkUrl?: string
  durationSeconds?: number
  status?: string
  sourceKind?: string
}
export type SharedQueue = {
  enabled: boolean
  acceptingSubmissions?: boolean
  submissions?: QueueItem[]
  settings?: {
    requireApproval?: boolean
    queueEntryFee?: { enabled?: boolean; amount?: number }
  }
}
export type QueueSubmission = {
  submissionId: string
  status: string
  position?: number | null
}

export type Playback = {
  isPlaying: boolean
  positionSeconds: number
  durationSeconds?: number
  hostClockUtc?: string
}
export type Session = {
  roomCode: string
  trackId?: string
  packageUrl?: string
  browserAudioUrl?: string
  albumArtUrl?: string
  playback?: Playback
  track?: {
    displayName?: string
    title?: string
    artist?: string
    album?: string
    durationSeconds?: number
    artworkUrl?: string
  }
}
