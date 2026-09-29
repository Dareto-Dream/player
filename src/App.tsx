import { type FormEvent, useEffect, useState } from 'react'
import { ArrowRight, Disc3, Grid2X2, List, LogIn, Music2, Plus, Search, SlidersHorizontal, Users } from 'lucide-react'
import { api, type Room, type SharedQueue } from './api'
import { ward, type WardProfile } from './auth'

const securityCopy = { anyone: 'Anyone can join', ward: 'Ward members', approval: 'Waiting room' }

function App() {
  const roomId = /^\/rooms\/([^/]+)$/.exec(window.location.pathname)?.[1]
  return roomId ? <RoomView roomId={decodeURIComponent(roomId)} /> : <Directory />
}

function Directory() {
  const [profile, setProfile] = useState<WardProfile | null>(null)
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeTags, setActiveTags] = useState<string[]>([])
  const [showTags, setShowTags] = useState(false)
  const [view, setView] = useState<'grid' | 'list'>(() => sessionStorage.getItem('room-view') === 'grid' ? 'grid' : 'list')
  const [showCreate, setShowCreate] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const boot = async () => {
      try {
        ward.hydrateCallback()
        setProfile(await ward.profile())
        const data = await api.browse()
        if (data.rooms.length) setRooms(data.rooms)
      } catch (cause) { setError(cause instanceof Error ? cause.message : 'Something went wrong.') }
      finally { setLoading(false) }
    }
    void boot()
  }, [])

  const tags = [...new Set(rooms.flatMap(room => room.tags.map(tag => tag.trim()).filter(Boolean)))].sort((a, b) => a.localeCompare(b))
  const visibleRooms = rooms.filter(room => `${room.name} ${room.host} ${room.tags.join(' ')}`.toLowerCase().includes(search.toLowerCase()) && activeTags.every(tag => room.tags.some(roomTag => roomTag.toLowerCase() === tag.toLowerCase())))
  const setDirectoryView = (next: 'grid' | 'list') => { setView(next); sessionStorage.setItem('room-view', next) }
  const toggleTag = (tag: string) => setActiveTags(current => current.includes(tag) ? current.filter(item => item !== tag) : [...current, tag])

  return <main className="player-app">
    <header className="nav container wide">
      <a className="brand" href="/"><Disc3 size={24} aria-hidden="true" /><span>Spectralis</span><small>player</small></a>
      {profile ? <button className="account-button" onClick={() => { ward.signOut(); setProfile(null) }}><span>{profile.name ?? profile.preferred_username}</span><LogIn size={16} /></button>
        : <button className="outline" onClick={() => void ward.signIn()}><LogIn size={16} /> Sign in</button>}
    </header>

    <section className="tool-layout container wide">
      <section className="browse" id="browse">
        <div className="directory-tools">
          <label className="search"><Search size={18} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Find your group" /></label>
          <button className={`tag-filter${activeTags.length ? ' active' : ''}`} onClick={() => setShowTags(value => !value)} aria-expanded={showTags}><SlidersHorizontal size={17} /> Tags{activeTags.length ? ` (${activeTags.length})` : ''}</button>
          <div className="view-toggle" aria-label="Directory view"><button className={view === 'grid' ? 'selected' : ''} onClick={() => setDirectoryView('grid')} aria-label="Grid view" aria-pressed={view === 'grid'}><Grid2X2 size={18} /></button><button className={view === 'list' ? 'selected' : ''} onClick={() => setDirectoryView('list')} aria-label="List view" aria-pressed={view === 'list'}><List size={18} /></button></div>
        </div>
        {showTags && <div className="tag-menu"><button className={!activeTags.length ? 'selected' : ''} onClick={() => setActiveTags([])}>All tags</button>{tags.map(tag => <button className={activeTags.includes(tag) ? 'selected' : ''} onClick={() => toggleTag(tag)} key={tag}>{tag}</button>)}</div>}
        {error && <p className="notice">{error}</p>}
        <div className={`room-grid ${view}`}>{loading ? <p className="caption">Finding rooms...</p> : visibleRooms.map(room => <RoomCard key={room.id} room={room} />)}</div>
        {!loading && !visibleRooms.length && <div className="empty"><strong>{rooms.length ? 'Nothing matched those filters.' : 'No public rooms are open right now.'}</strong><span>{rooms.length ? 'Clear a tag or try a different search.' : 'Use a private room code to join someone directly.'}</span></div>}
      </section>
      <RoomCode />
    </section>
    <button className="new-room container wide" onClick={() => setShowCreate(true)}><Plus size={18} /> New room</button>
    {showCreate && <CreateRoom profile={profile} onClose={() => setShowCreate(false)} onCreated={room => { setRooms(current => [room, ...current]); setShowCreate(false) }} />}
  </main>
}

function RoomCard({ room }: { room: Room }) {
  return <article className="room-card"><div className="room-art"><Music2 size={24} /></div><div className="room-copy"><h3>{room.name}</h3><p>{room.nowPlaying?.title ?? 'No track reported'} <span>·</span> {room.nowPlaying?.artist ?? `hosted by ${room.host}`}</p></div><div className="room-tags">{room.tags.map(tag => <span key={tag}>{tag}</span>)}</div><div className="room-meta"><span>{room.kind === 'channel' ? 'channel' : 'streamer queue'}</span><span><Users size={14} /> {room.listeners}</span></div><a className="join" href={`/rooms/${encodeURIComponent(room.id)}`} aria-label={`Enter ${room.name}`}><ArrowRight size={18} /></a></article>
}

function RoomCode() {
  const [code, setCode] = useState('')
  const submit = (event: FormEvent) => { event.preventDefault(); const normalized = code.replace(/[^a-z0-9]/gi, '').toUpperCase(); if (normalized.length === 6) window.location.assign(`https://audioplayer-production-5b83.up.railway.app/spectralis/web-share/?session=${normalized}`) }
  return <aside className="room-code"><form onSubmit={submit}><p className="eyebrow">private invite</p><h2>Room Code</h2><label><span className="sr-only">Room code</span><input value={code} onChange={event => setCode(event.target.value)} placeholder="ABC123" maxLength={6} /></label><button className="cta" disabled={code.replace(/[^a-z0-9]/gi, '').length !== 6}>Join room <ArrowRight size={17} /></button></form></aside>
}

function CreateRoom({ profile, onClose, onCreated }: { profile: WardProfile | null; onClose: () => void; onCreated: (room: Room) => void }) {
  const [name, setName] = useState('')
  const [kind, setKind] = useState<Room['kind']>('channel')
  const [security, setSecurity] = useState<Room['security']>('anyone')
  const [tags, setTags] = useState('all ages, requests')
  const [error, setError] = useState('')
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!profile) return void ward.signIn()
    try { onCreated(await api.createRoom({ name, kind, security, tags: tags.split(',').map(tag => tag.trim()).filter(Boolean).slice(0, 3) })) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not create the room.') }
  }
  return <div className="modal-backdrop" role="presentation"><form className="modal card" onSubmit={submit}><button className="close" type="button" onClick={onClose}>×</button><p className="eyebrow">new public room</p><h2 className="headline">Open a room</h2><p className="caption">Public rooms need Ward. Private Shared Play links do not.</p><label>Room name<input required value={name} maxLength={60} onChange={event => setName(event.target.value)} placeholder="late night records" /></label><label>Room type<select value={kind} onChange={event => setKind(event.target.value as Room['kind'])}><option value="channel">Shared channel</option><option value="streamer_queue">Streamer queue</option></select></label><label>Who can enter<select value={security} onChange={event => setSecurity(event.target.value as Room['security'])}>{Object.entries(securityCopy).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label>Up to three tags<input value={tags} maxLength={80} onChange={event => setTags(event.target.value)} placeholder="all ages, chill, vinyl" /></label>{error && <p className="form-error">{error}</p>}<button className="cta" type="submit">{profile ? 'Create public room' : 'Sign in with Ward to continue'} <ArrowRight size={18} /></button></form></div>
}

export default App

function RoomView({ roomId }: { roomId: string }) {
  const [profile, setProfile] = useState<WardProfile | null>(null)
  const [room, setRoom] = useState<Room | null>(null)
  const [error, setError] = useState('')
  const [request, setRequest] = useState('')
  const [queue, setQueue] = useState<SharedQueue | null>(null)
  const [requestStatus, setRequestStatus] = useState('')

  useEffect(() => {
    void (async () => {
      try {
        ward.hydrateCallback(); setProfile(await ward.profile());
        const currentRoom = await api.room(roomId); setRoom(currentRoom)
        if (currentRoom.roomCode && currentRoom.kind === 'streamer_queue') setQueue(await api.sharedQueue(currentRoom.roomCode))
      }
      catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load this room.') }
    })()
  }, [roomId])

  const title = room?.name ?? 'Queue'
  const track = queue?.nowPlayingTitle ?? room?.nowPlaying?.title ?? 'No track reported'
  const artist = queue?.nowPlayingArtist ?? room?.nowPlaying?.artist ?? 'The host has not published playback metadata.'
  const submitRequest = async (event: FormEvent) => {
    event.preventDefault()
    if (!room?.roomCode || !request.trim()) return
    try { const result = await api.submitSharedQueue(room.roomCode, { url: request.trim(), displayName: profile?.name ?? profile?.preferred_username }); setRequest(''); setRequestStatus(`Added to the queue${result.position ? ` at #${result.position}` : ''}.`); setQueue(await api.sharedQueue(room.roomCode)) }
    catch (cause) { setRequestStatus(cause instanceof Error ? cause.message : 'Could not add that request.') }
  }

  return <main className="room-app">
    <header className="nav container wide"><a className="brand" href="/"><Disc3 size={24} aria-hidden="true" /><span>Spectralis</span><small>player</small></a>{profile ? <button className="account-button" onClick={() => { ward.signOut(); setProfile(null) }}>{profile.name ?? profile.preferred_username}</button> : <button className="outline" onClick={() => void ward.signIn()}><LogIn size={16} /> Sign in</button>}</header>
    <section className="room-layout container wide">
      <section className="listener">
        <div className="room-topline"><a href="/" className="leave">Leave</a><span>{room?.kind === 'streamer_queue' ? 'streamer queue' : 'shared channel'}</span></div>
        {error && <p className="notice">{error}</p>}
        <div className="now-playing"><div className="cover"><Music2 size={54} /></div><div className="track-copy"><p className="eyebrow">now playing</p><h1>{track}</h1><p>{artist}</p></div></div>
        {room?.joinUrl ? <a className="cta live-link" href={room.joinUrl}>Open live player <ArrowRight size={17} /></a> : <p className="caption">This room is not live right now.</p>}
      </section>
      <aside className="queue-panel"><div className="queue-heading"><h2>{title}</h2><p>{queue ? `${queue.queueLength ?? queue.activeCount ?? 0} songs lined up` : room?.kind === 'streamer_queue' ? 'Queue opens when the host goes live.' : 'This is a listening channel.'}</p></div>{room?.kind === 'streamer_queue' && queue?.enabled && <form className="queue-request" onSubmit={submitRequest}><Search size={16} /><input value={request} onChange={event => setRequest(event.target.value)} placeholder="Paste a track link" /><button type="submit" aria-label="Add request"><Plus size={17} /></button></form>}{requestStatus && <p className="request-status">{requestStatus}</p>}</aside>
    </section>
  </main>
}
