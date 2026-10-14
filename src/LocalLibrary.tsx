import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { api, request, type Session } from './api'
import { ward, type WardProfile } from './auth'
import './local-library.css'

type LinkPick = { kind: 'link'; url: string; title: string; size: number }
type Pick = { id: string; owner: string; title: string; size: number; addedAt: number; putOnAt?: number } &
  ({ kind: 'file'; name: string } | LinkPick)
type Library = {
  list(): Promise<Pick[]>; recent(): Promise<Pick[]>; file(id: string): Promise<File | undefined>
  add(file: File): Promise<Pick>; remove(id: string): Promise<void>; saveLink(url: string, title?: string): Promise<Pick>
  remember(item: Pick | LinkPick): Promise<void>; clearRecent(): Promise<void>; hasLegacy(): Promise<boolean>; recover(): Promise<void>
}
declare global {
  interface Window {
    // Kept identical to Spectralis' embedded web-share implementation.
    LocalAudioLibrary: { forAccount(subject: string): Library; link(url: string, title?: string): LinkPick }
  }
}

export function LocalLibrary({ session, profile, onQueued, renderRequests }: {
  session: Session; profile: WardProfile | null; onQueued(): void
  renderRequests?: (accepted: (url: string) => void, suggested: { url: string; nonce: number } | null) => ReactNode
}) {
  const dialog = useRef<HTMLDialogElement>(null), input = useRef<HTMLInputElement>(null)
  const [tracks, setTracks] = useState<Pick[]>([]), [recent, setRecent] = useState<Pick[]>([])
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('')
  const [view, setView] = useState<'all' | 'recent'>('all'), [url, setUrl] = useState(''), [title, setTitle] = useState('')
  const [legacy, setLegacy] = useState(false), [suggested, setSuggested] = useState<{url:string;nonce:number}|null>(null)
  const accounts = ward.enabled && session.accountUploadsAvailable === true
  const uploads = session.capabilities?.audioUploads !== false
  const links = !session.capabilities?.queueAdd || session.capabilities.queueAdd === 'everyone'
  const subject = accounts ? profile?.sub : undefined
  const db = useMemo(() => subject ? window.LocalAudioLibrary.forAccount(subject) : null, [subject])
  const activeDb = useRef(db); activeDb.current = db
  const refresh = async () => {
    if (!db) return
    const [saved, history, old] = await Promise.all([db.list(), db.recent(), db.hasLegacy()])
    if (activeDb.current !== db) return
    setTracks(saved); setRecent(history); setLegacy(old)
  }
  useEffect(() => {
    setTracks([]); setRecent([]); setMessage(''); setUrl(''); setTitle(''); setSuggested(null); setView('all')
    void refresh().catch((e: Error) => setMessage(e.message))
  }, [db])
  const run = async (action: () => Promise<void>) => {
    if (busy) return
    setBusy(true)
    try { await action() } catch (error) { setMessage(error instanceof Error ? error.message : 'The request could not be completed.') }
    finally { setBusy(false); await refresh().catch((e: Error) => setMessage(e.message)) }
  }
  const remember = async (track: Pick | LinkPick) => {
    try { await db?.remember(track) } catch { setMessage('Added to the queue, but this browser could not save it to recent picks.') }
  }
  const putOn = async (track: Pick | LinkPick) => {
    if (track.kind === 'link') {
      if (renderRequests) { setSuggested({url:track.url,nonce:Date.now()}); setMessage('Review your request above to send it to the host.'); return }
      if (!links) throw new Error('The host is not accepting link requests from you.')
      await api.addQueueLink(session.roomCode, track.url, track.title)
    } else {
      if (!db || !uploads) throw new Error('Audio uploads are unavailable in this room.')
      const file = await db.file(track.id)
      if (!file) throw new Error('This file is no longer in your browser library.')
      const body = new FormData(); body.append('file',file,track.name); body.append('title',track.title)
      setMessage(`Sending ${track.title} to the room...`)
      await request(`/shared-play/v2/sessions/${encodeURIComponent(session.roomCode)}/uploads`, { method:'POST',body,signal:AbortSignal.timeout(90_000) })
    }
    setMessage(`${track.title} was added to the queue.`); onQueued(); await remember(track)
  }
  const picks = (view === 'all' ? tracks : recent).filter(track => track.owner === subject)
  return <>
    <button className="button button-primary local-library-open" onClick={() => { dialog.current?.showModal(); void refresh().catch((e:Error)=>setMessage(e.message)) }}>Put something on +</button>
    <dialog ref={dialog} className="local-library-dialog" aria-labelledby="local-library-heading">
      <div className="local-library-heading"><h2 id="local-library-heading">Put something on</h2><button className="icon-button" aria-label="Close music picker" onClick={() => dialog.current?.close()}>&times;</button></div>
      {!accounts ? <p className="field-help">Add a link to the room. Account libraries are unavailable here.</p> : !db ? <p className="field-help">Share a link, or <button className="button button-quiet" onClick={() => ward.signIn()}>Sign in for your library</button></p> : <p className="field-help">Signed in as {profile?.name || profile?.preferred_username || 'Listener'}</p>}
      {db && <>
        <div className="local-library-tabs" role="group" aria-label="Your music"><button aria-pressed={view==='all'} onClick={()=>setView('all')}>Your library</button><button aria-pressed={view==='recent'} onClick={()=>setView('recent')}>Recently put on</button></div>
        <p className="field-help">Saved in this browser for your account. Only queued audio is uploaded. Clearing site data removes your library.</p>
        {!uploads && <p className="field-help">The host has turned off audio uploads.</p>}
        <div className="local-library-tools"><button className="button button-primary" disabled={busy} onClick={() => input.current?.click()}>Add audio files +</button>{view==='recent' && <button className="button button-quiet" disabled={busy} onClick={()=>void run(async()=>{await db.clearRecent();setMessage('Recent picks cleared.')})}>Clear recent</button>}<span className="field-help">{tracks.filter(t=>t.kind==='file').length} files {"\u00b7"} {tracks.filter(t=>t.kind==='link').length} links {"\u00b7"} {(tracks.reduce((sum,t)=>sum+t.size,0)/1048576).toFixed(1)} MB</span></div>
        {legacy && <button className="button button-quiet" disabled={busy} onClick={()=>void run(async()=>{await db.recover();setMessage('Previous browser files added to your library.')})}>Recover files saved before account libraries</button>}
        <input ref={input} type="file" aria-label="Add audio files" accept=".mp3,.m4a,.wav,.flac,.ogg,.opus,.aac,.aif,.aiff" multiple hidden onChange={event => {
          const files = Array.from(event.target.files || []); event.target.value = ''
          void run(async () => { let imported=0; for (const file of files) { await db.add(file); imported++ } setView('all');setMessage(`${imported} files saved locally. Nothing was uploaded.`) })
        }} />
        <ul className="local-library-tracks">
          {!picks.length && <li className="field-help">{view==='recent' ? 'Your last 50 accepted picks will appear here. Put something on to start.' : 'A little collection of your favourites. Add audio files or save a link above.'}</li>}
          {picks.map(track => <li key={track.id}>
            <div><strong>{track.title}</strong><span className="field-help">{track.kind==='link' ? track.url : `${track.name} \u00b7 ${(track.size/1048576).toFixed(1)} MB`}{view==='recent' && track.putOnAt ? ` \u00b7 ${new Date(track.putOnAt).toLocaleDateString()}` : ''}</span></div>
            <div className="local-library-actions">
              <button className="button button-quiet" disabled={busy || (track.kind==='file' ? !uploads : !links && !renderRequests)} onClick={() => void run(()=>putOn(track))}>{renderRequests && track.kind==='link' ? 'Request track' : 'Add to queue'}</button>
              {view==='all' ? <button className="button button-quiet" disabled={busy} onClick={() => void run(async () => { await db.remove(track.id); setMessage('Removed from this browser. Tracks already sent to a room stay in its queue.') })}>Remove</button> : track.kind==='link' && !tracks.some(t=>t.id===track.id) && <button className="button button-quiet" disabled={busy} onClick={()=>void run(async()=>{await db.saveLink(track.url,track.title);setMessage('Link saved to your library.')})}>Save link</button>}
            </div>
          </li>)}
        </ul>
      </>}
      {renderRequests ? renderRequests((value) => { void run(async()=>{ await remember(window.LocalAudioLibrary.link(value)) }) }, suggested) :
        <form className="local-library-link-form" onSubmit={event => { event.preventDefault(); void run(async () => { await putOn(window.LocalAudioLibrary.link(url, db ? title : '')); setUrl(''); setTitle('') }) }}>
          <label htmlFor="request-url">Track link</label>
          <div className="local-library-link-input"><input id="request-url" value={url} onChange={e=>setUrl(e.target.value)} placeholder="Paste a track link" inputMode="url" required /><button className="button button-primary" disabled={busy || !links}>Add to queue</button></div>
          <p className="field-help">{links ? 'The host controls what plays next.' : 'The host is not accepting link requests from you.'}</p>
        </form>}
      {db && <>
        <div className="local-library-save">
          {renderRequests && <input aria-label="Link to save" value={url} onChange={e=>setUrl(e.target.value)} placeholder="Paste a link to save" />}
          <input aria-label="Link title (optional)" placeholder="Track title (optional)" value={title} maxLength={240} onChange={e=>setTitle(e.target.value)} />
          <button className="button button-quiet" disabled={busy} onClick={()=>void run(async()=>{await db.saveLink(url,title); setUrl('');setTitle('');setView('all');setMessage('Link saved to your library. Add it to the queue whenever you like.')})}>Save link to library</button>
        </div>
      </>}
      <p role="status" className="field-help">{message}</p>
    </dialog>
  </>
}
