import { ward } from './auth'

const base = (import.meta.env.VITE_PLAYER_API ?? 'https://audioplayer-production-5b83.up.railway.app').replace(/\/$/, '')

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
  nowPlaying?: { title: string; artist?: string; artwork?: string }
}

async function request<T>(path: string, init: RequestInit = {}) {
  const token = ward.token()
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init.headers },
  })
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.message ?? 'Could not reach the player service.')
  return response.json() as Promise<T>
}

export const api = {
  browse: () => request<{ rooms: Room[] }>('/player/v1/rooms'),
  room: (id: string) => request<Room>(`/player/v1/rooms/${encodeURIComponent(id)}`),
  sharedQueue: (code: string) => request<SharedQueue>(`/shared-play/v2/sessions/${encodeURIComponent(code)}/streamer-queue`),
  submitSharedQueue: (code: string, submission: { url: string; title?: string; artist?: string; displayName?: string }) => request<QueueSubmission>(`/shared-play/v2/sessions/${encodeURIComponent(code)}/streamer-queue/submit`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(submission),
  }),
  createRoom: (room: Pick<Room, 'name' | 'description' | 'kind' | 'tags' | 'security'>) => request<Room>('/player/v1/rooms', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(room),
  }),
}

export type SharedQueue = { enabled: boolean; acceptingSubmissions?: boolean; queueLength?: number; activeCount?: number; nowPlayingTitle?: string | null; nowPlayingArtist?: string | null }
export type QueueSubmission = { submissionId: string; status: string; position?: number | null }
