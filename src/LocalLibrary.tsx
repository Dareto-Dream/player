import { useEffect, useRef, useState } from 'react'
import { request, type Session } from './api'
import { ward, type WardProfile } from './auth'
import './local-library.css'

type LocalTrack = { id: string; name: string; title: string; size: number; addedAt: number }
declare global {
  interface Window {
    // public/local-library.js is shared with Spectralis' embedded web-share client.
    LocalAudioLibrary: {
      list(): Promise<LocalTrack[]>; file(id: string): Promise<File | undefined>
      add(file: File): Promise<LocalTrack>; remove(id: string): Promise<void>
    }
  }
}

export function LocalLibrary({ session, profile, onQueued }: {
  session: Session; profile: WardProfile | null; onQueued(): void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const [tracks, setTracks] = useState<LocalTrack[]>([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const accounts = ward.enabled && session.accountUploadsAvailable === true
  const uploads = session.capabilities?.audioUploads !== false
  const refresh = async () => setTracks((await window.LocalAudioLibrary.list()).sort((a,b) => b.addedAt - a.addedAt))
  useEffect(() => { void refresh().catch((e: Error) => setMessage(e.message)) }, [])
  const run = async (action: () => Promise<void>) => {
    if (busy) return
    setBusy(true)
    try { await action() } catch (error) { setMessage(error instanceof Error ? error.message : 'The file could not be saved.') }
    finally { setBusy(false); await refresh().catch((e: Error) => setMessage(e.message)) }
  }
  return <>
    <button className="button button-quiet local-library-open" onClick={() => dialog.current?.showModal()}>Choose from your files ↗</button>
    <dialog ref={dialog} className="local-library-dialog" aria-labelledby="local-library-heading">
      <div className="local-library-heading"><h2 id="local-library-heading">Your files</h2><button className="icon-button" aria-label="Close your files" onClick={() => dialog.current?.close()}>×</button></div>
      <p className="field-help">Saved in this browser, not on our servers. Only “Add to queue” sends a temporary copy to the room. Clearing site data removes your library.</p>
      {!accounts ? <p className="field-help">Account uploads are unavailable in this room.</p> : !profile ? <button className="button button-quiet" onClick={() => ward.signIn()}>Sign in to upload audio</button> : <p className="field-help">Signed in as {profile.name || profile.preferred_username || 'Listener'}</p>}
      {accounts && !uploads && <p className="field-help">The host has turned off audio uploads.</p>}
      <div className="local-library-tools"><button className="button button-primary" disabled={busy} onClick={() => input.current?.click()}>Import audio files +</button><span className="field-help">{tracks.length} tracks · {(tracks.reduce((sum,t) => sum+t.size,0)/1048576).toFixed(1)} / 512 MB</span></div>
      <input ref={input} type="file" aria-label="Import audio files" accept=".mp3,.m4a,.wav,.flac,.ogg,.opus,.aac,.aif,.aiff" multiple hidden onChange={(event) => {
        const files = Array.from(event.target.files || [])
        event.target.value = ''
        void run(async () => {
          let imported = 0
          for (const file of files) {
            setMessage(`Saving ${file.name} in this browser…`)
            await window.LocalAudioLibrary.add(file); imported++
          }
          setMessage(`${imported} files saved locally. Nothing was uploaded.`)
        })
      }} />
      <ul className="local-library-tracks">
        {!tracks.length && <li className="field-help">Bring a few favourites. They stay in this browser until you add them to a room.</li>}
        {tracks.map(track => <li key={track.id}>
          <div><strong>{track.title}</strong><span className="field-help">{track.name} · {(track.size/1048576).toFixed(1)} MB</span></div>
          <div className="local-library-actions">
            <button className="button button-quiet" disabled={busy || !profile || !accounts || !uploads} onClick={() => void run(async () => {
              const file = await window.LocalAudioLibrary.file(track.id)
              if (!file) throw new Error('This file is no longer in your browser library.')
              const body = new FormData(); body.append('file',file,track.name); body.append('title',track.title)
              setMessage(`Sending ${track.title} to the room…`)
              await request(`/shared-play/v2/sessions/${encodeURIComponent(session.roomCode)}/uploads`, { method:'POST',body,signal:AbortSignal.timeout(90_000) })
              setMessage(`${track.title} was added to the queue. Your library copy stays here.`); onQueued()
            })}>Add to queue</button>
            <button className="button button-quiet" disabled={busy} onClick={() => void run(async () => {
              await window.LocalAudioLibrary.remove(track.id); setMessage('Removed from this browser. Tracks already sent to a room stay in its queue.')
            })}>Remove</button>
          </div>
        </li>)}
      </ul>
      <p role="status" className="field-help">{message}</p>
    </dialog>
  </>
}
