import { useEffect, useRef, useState } from 'react'

export type LyricWord = { timeSeconds: number; text: string }
export type LyricLine = LyricWord & { words: LyricWord[] }

function timestamp(value: Record<string, unknown>) {
  const time = value.timeSeconds ?? value.startSeconds ?? value.startTime ?? value.time
  return typeof time === 'number' && Number.isFinite(time) && time >= 0 ? time : null
}

export function trackLyrics(lrc?: string, input?: unknown): LyricLine[] {
  const supplied: LyricLine[] = []
  if (Array.isArray(input)) for (const line of input.slice(0, 400)) {
    if (!line || typeof line !== 'object') continue
    const time = timestamp(line)
    if (time === null || typeof line.text !== 'string' || !line.text.trim()) continue
    const words: LyricWord[] = []
    if (Array.isArray(line.words)) for (const word of line.words.slice(0, 500)) {
      if (!word || typeof word !== 'object') continue
      const start = timestamp(word)
      if (start !== null && typeof word.text === 'string' && word.text.trim())
        words.push({ timeSeconds: start, text: word.text })
    }
    supplied.push({ timeSeconds: time, text: line.text, words: words.sort((a, b) => a.timeSeconds - b.timeSeconds) })
  }
  if (supplied.length) return supplied.sort((a, b) => a.timeSeconds - b.timeSeconds)
  const offset = Number(/\[offset:([+-]?\d+)\]/i.exec(lrc || '')?.[1] || 0) / 1000
  const parsed: LyricLine[] = []
  for (const line of (lrc || '').split(/\r?\n/).slice(0, 400)) {
    const stamps = [...line.matchAll(/\[(\d+):(\d+(?:\.\d+)?)\]/g)]
    if (!stamps.length) continue
    const body = line.replace(/\[[^\]]*\]/g, '')
    const text = body.replace(/<\d+:\d+(?:\.\d+)?>/g, '').trim()
    if (!text) continue
    const words = [...body.matchAll(/<(\d+):(\d+(?:\.\d+)?)>([^<]*)/g)]
      .filter(match => match[3].trim())
      .map(match => ({ timeSeconds: Math.max(0, Number(match[1]) * 60 + Number(match[2]) + offset), text: match[3] }))
    for (const stamp of stamps) parsed.push({
      timeSeconds: Math.max(0, Number(stamp[1]) * 60 + Number(stamp[2]) + offset), text, words,
    })
  }
  return parsed.sort((a, b) => a.timeSeconds - b.timeSeconds)
}

export function RoomLyrics({ lines, position, active }: { lines: LyricLine[]; position: number; active: boolean }) {
  const panel = useRef<HTMLDivElement>(null)
  const [following, setFollowing] = useState(true)
  const current = lines.map(line => line.timeSeconds <= position).lastIndexOf(true)
  const mode = lines.some(line => line.words.length) ? 'word' : 'line'
  useEffect(() => { setFollowing(true) }, [lines])
  useEffect(() => {
    if (!active || !following) return
    const element = panel.current?.querySelector<HTMLElement>('[aria-current=true]')
    if (element && panel.current) panel.current.scrollTo({
      top: Math.max(0, element.offsetTop - panel.current.clientHeight * 0.32),
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
    })
  }, [current, active, following])
  return <div className="room-lyrics" hidden={!active}>
    <div className="room-lyrics-tools">
      <span className="room-lyric-timing">{mode === 'word' ? 'Word timed' : 'Line timed'}</span>
      {!following && <button onClick={() => setFollowing(true)}>Follow lyrics</button>}
    </div>
    <div ref={panel} id="room-lyrics-panel" role="tabpanel" aria-labelledby="room-lyrics-tab"
      className="room-lyric-scroller" tabIndex={0} data-timing={mode}
      onWheel={() => setFollowing(false)} onTouchMove={() => setFollowing(false)}
      onKeyDown={event => { if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'].includes(event.key)) setFollowing(false) }}>
      {lines.map((line, index) => <p key={`${line.timeSeconds}:${index}`} className="room-lyric-line" aria-current={index === current ? 'true' : undefined}>
        {line.words.length ? line.words.map((word, wordIndex) => <span key={wordIndex}
          className={index === current && word.timeSeconds <= position ? 'word-sung' : undefined}>{word.text}</span>) : line.text}
      </p>)}
    </div>
  </div>
}
