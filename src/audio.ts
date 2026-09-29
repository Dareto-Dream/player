import { unzip } from 'fflate'
import type { Playback } from './api'

const MAX_AUDIO_BYTES = 128 * 1024 * 1024

export async function packageAudio(
  url: string,
  signal: AbortSignal,
): Promise<string> {
  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error('The host’s audio is not available yet.')
  if (Number(response.headers.get('content-length')) > MAX_AUDIO_BYTES)
    throw new Error('This track is too large for browser playback.')
  // Limit streamed responses too; content-length isn't always present.
  const reader = response.body?.getReader()
  if (!reader) throw new Error('Could not read the audio download.')
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      size += value.length
      if (size > MAX_AUDIO_BYTES) {
        await reader.cancel()
        throw new Error('This track is too large for browser playback.')
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  const data = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    data.set(chunk, offset)
    offset += chunk.length
  }
  const bytes = await new Promise<{ name: string; data: Uint8Array }>(
    (resolve, reject) => {
      if (signal.aborted) {
        reject(new DOMException('Cancelled', 'AbortError'))
        return
      }
      const cancel = unzip(
        data,
        {
          filter: (entry) =>
            /^audio\/track\.(mp3|wav|flac|ogg|opus|m4a|aac)$/i.test(
              entry.name,
            ) && entry.originalSize <= MAX_AUDIO_BYTES,
        },
        (error, files) => {
          signal.removeEventListener('abort', onAbort)
          if (error) {
            reject(new Error('The shared audio package could not be opened.'))
            return
          }
          const entry = Object.entries(files)[0]
          if (!entry) {
            reject(
              new Error(
                'This package does not contain browser-playable audio.',
              ),
            )
            return
          }
          resolve({ name: entry[0], data: entry[1] })
        },
      )
      function onAbort() {
        cancel()
        reject(new DOMException('Cancelled', 'AbortError'))
      }
      signal.addEventListener('abort', onAbort, { once: true })
    },
  )
  if (signal.aborted) throw new DOMException('Cancelled', 'AbortError')
  const extensions: Record<string, string> = {
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    flac: 'audio/flac',
    ogg: 'audio/ogg',
    opus: 'audio/ogg',
    m4a: 'audio/mp4',
    aac: 'audio/aac',
  }
  return URL.createObjectURL(
    new Blob([new Uint8Array(bytes.data)], {
      type: extensions[bytes.name.split('.').pop()!.toLowerCase()],
    }),
  )
}

export function hostPosition(playback: Playback) {
  const clock = Date.parse(playback.hostClockUtc || '')
  const elapsed =
    playback.isPlaying && Number.isFinite(clock)
      ? Math.max(0, (Date.now() - clock) / 1000)
      : 0
  return Math.max(0, (Number(playback.positionSeconds) || 0) + elapsed)
}

export function timeLabel(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  return `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60)
    .toString()
    .padStart(2, '0')}`
}
