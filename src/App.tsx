import { type FormEvent, useEffect, useState } from 'react'
import { ArrowRight, Disc3, Grid2X2, List, LogIn, Music2, Plus, Search, SlidersHorizontal, Users } from 'lucide-react'
import { api, type Room } from './api'
import { ward, type WardProfile } from './auth'

const starterRooms: Room[] = [
  { id: 'demo-midnight', name: 'Midnight Radio', kind: 'channel', tags: ['chill', 'explicit'], security: 'anyone', listeners: 28, host: 'nova', nowPlaying: { title: 'Small Hours', artist: 'untitled' } },
  { id: 'demo-queue', name: 'garden stream requests', kind: 'streamer_queue', tags: ['all ages', 'requests'], security: 'ward', listeners: 11, host: 'garden', nowPlaying: { title: 'nothing playing' } },
]

const securityCopy = { anyone: 'Anyone can join', ward: 'Ward members', approval: 'Waiting room' }

function App() {
  const roomId = /^\/rooms\/([^/]+)$/.exec(window.location.pathname)?.[1]
  return roomId ? <RoomView roomId={decodeURIComponent(roomId)} /> : <Directory />
}

function Directory() {
  const [profile, setProfile] = useState<WardProfile | null>(null)
  const [rooms, setRooms] = useState<Room[]>(starterRooms)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
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

  const visibleRooms = rooms.filter(room => `${room.name} ${room.host} ${room.tags.join(' ')}`.toLowerCase().includes(search.toLowerCase()))

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
          <button className="tag-filter"><SlidersHorizontal size={17} /> Tags</button>
          <div className="view-toggle" aria-label="Directory view"><button aria-label="Grid view"><Grid2X2 size={18} /></button><button className="selected" aria-label="List view"><List size={18} /></button></div>
        </div>
        {error && <p className="notice">{error} Showing a small local preview while the directory reconnects.</p>}
        <div className="room-grid">{loading ? <p className="caption">Finding rooms...</p> : visibleRooms.map(room => <RoomCard key={room.id} room={room} />)}</div>
        {!loading && !visibleRooms.length && <p className="empty">Nothing matched that. Try another tag or host.</p>}
      </section>
      <aside className="room-code">
        <div><p className="eyebrow">private invite</p><h2>Room Code</h2><label><span className="sr-only">Room code</span><input placeholder="ABC123" maxLength={12} /></label><button className="cta">Join room <ArrowRight size={17} /></button></div>
        <p>Your Stats.</p>
      </aside>
    </section>
    <button className="new-room container wide" onClick={() => setShowCreate(true)}><Plus size={18} /> New room</button>
    {showCreate && <CreateRoom profile={profile} onClose={() => setShowCreate(false)} onCreated={room => { setRooms(current => [room, ...current]); setShowCreate(false) }} />}
  </main>
}

function RoomCard({ room }: { room: Room }) {
  return <article className="room-card"><div className="room-art"><Music2 size={24} /></div><div className="room-copy"><h3>{room.name}</h3><p>{room.nowPlaying?.title ?? 'Nothing playing'} <span>·</span> {room.nowPlaying?.artist ?? `hosted by ${room.host}`}</p></div><div className="room-tags">{room.tags.map(tag => <span key={tag}>{tag}</span>)}</div><div className="room-meta"><span>{room.kind === 'channel' ? 'channel' : 'streamer queue'}</span><span><Users size={14} /> {room.listeners}</span></div><a className="join" href={`/rooms/${encodeURIComponent(room.id)}`} aria-label={`Enter ${room.name}`}><ArrowRight size={18} /></a></article>
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
  const [playing, setPlaying] = useState(false)
  const [request, setRequest] = useState('')
  const [queue, setQueue] = useState<string[]>(['Distant Signals — Mice Parade', 'Sometimes — My Bloody Valentine', 'Satellite — Guster', 'Just Like Honey — The Jesus and Mary Chain'])

  useEffect(() => {
    void (async () => {
      try { ward.hydrateCallback(); setProfile(await ward.profile()); setRoom(await api.room(roomId)) }
      catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load this room.') }
    })()
  }, [roomId])

  const title = room?.name ?? 'Queue'
  const track = room?.nowPlaying?.title ?? 'Nothing playing'
  const artist = room?.nowPlaying?.artist ?? 'Waiting for the host'
  const submitRequest = (event: FormEvent) => {
    event.preventDefault()
    const value = request.trim()
    if (!value) return
    setQueue(items => [...items, value])
    setRequest('')
  }

  return <main className="room-app">
    <header className="nav container wide"><a className="brand" href="/"><Disc3 size={24} aria-hidden="true" /><span>Spectralis</span><small>player</small></a>{profile ? <button className="account-button" onClick={() => { ward.signOut(); setProfile(null) }}>{profile.name ?? profile.preferred_username}</button> : <button className="outline" onClick={() => void ward.signIn()}><LogIn size={16} /> Sign in</button>}</header>
    <section className="room-layout container wide">
      <section className="listener">
        <div className="room-topline"><a href="/" className="leave">Leave</a><span>{room?.kind === 'streamer_queue' ? 'streamer queue' : 'shared channel'}</span></div>
        {error && <p className="notice">{error}</p>}
        <div className="now-playing"><div className="cover"><Music2 size={54} /></div><div className="track-copy"><p className="eyebrow">now playing</p><h1>{track}</h1><p>{artist}</p></div></div>
        <div className="transport"><button aria-label="Previous track">‹</button><button className="play" onClick={() => setPlaying(value => !value)} aria-label={playing ? 'Pause' : 'Play'}>{playing ? 'Ⅱ' : '▶'}</button><button aria-label="Next track">›</button></div>
        <div className="progress"><span style={{ width: playing ? '41%' : '0%' }} /></div>
      </section>
      <aside className="queue-panel"><div className="queue-heading"><h2>{title}</h2><p>{queue.length} songs lined up</p></div><ol>{queue.map((item, index) => <li key={`${item}-${index}`}><span>{index + 1}</span><p>{item}</p></li>)}</ol><form className="queue-request" onSubmit={submitRequest}><Search size={16} /><input value={request} onChange={event => setRequest(event.target.value)} placeholder="Add a request" /><button type="submit" aria-label="Add request"><Plus size={17} /></button></form></aside>
    </section>
  </main>
}
