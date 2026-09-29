import { type FormEvent, useEffect, useState } from 'react'
import { ArrowRight, Disc3, LogIn, Music2, Plus, Radio, Search, ShieldCheck, Users } from 'lucide-react'
import { api, type Room } from './api'
import { ward, type WardProfile } from './auth'

const starterRooms: Room[] = [
  { id: 'demo-midnight', name: 'Midnight Radio', kind: 'channel', tags: ['chill', 'explicit'], security: 'anyone', listeners: 28, host: 'nova', nowPlaying: { title: 'Small Hours', artist: 'untitled' } },
  { id: 'demo-queue', name: 'garden stream requests', kind: 'streamer_queue', tags: ['all ages', 'requests'], security: 'ward', listeners: 11, host: 'garden', nowPlaying: { title: 'nothing playing' } },
]

const securityCopy = { anyone: 'Anyone can join', ward: 'Ward members', approval: 'Waiting room' }

function App() {
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
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Something went wrong.')
      } finally { setLoading(false) }
    }
    void boot()
  }, [])

  const visibleRooms = rooms.filter(room => `${room.name} ${room.host} ${room.tags.join(' ')}`.toLowerCase().includes(search.toLowerCase()))

  return <main className="player-app">
    <header className="nav container wide">
      <a className="brand" href="/"><Disc3 size={24} aria-hidden="true" /><span>Spectralis</span><small>player</small></a>
      <nav><a href="#browse">Rooms</a><a href="#about">What&apos;s this?</a></nav>
      {profile ? <button className="account-button" onClick={() => { ward.signOut(); setProfile(null) }}><span>{profile.name ?? profile.preferred_username}</span><LogIn size={16} /></button>
        : <button className="outline" onClick={() => void ward.signIn()}><LogIn size={16} /> Sign in with Ward</button>}
    </header>

    <section className="directory container wide">
      <aside className="directory-intro">
        <p className="eyebrow">spectralis player</p>
        <h1>Rooms with the door open.</h1>
        <p>Channels are for people already listening. Streamer queues are for throwing a song into the mix. Shared Play stays off this page: send that link to the people you mean to invite.</p>
        <button className="outline" onClick={() => setShowCreate(true)}><Plus size={18} /> Open a public room</button>
      </aside>
      <section className="browse" id="browse">
      <div className="section-heading"><div><p className="eyebrow">room directory</p><h2 className="title">Live, idle, and taking requests</h2></div><label className="search"><Search size={18} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Find a host or a tag" /></label></div>
      {error && <p className="notice">{error} Showing a small local preview while the new directory API comes online.</p>}
      <div className="room-grid">{loading ? <p className="caption">Finding rooms…</p> : visibleRooms.map(room => <RoomCard key={room.id} room={room} />)}</div>
      {!loading && !visibleRooms.length && <p className="empty">Nothing matched that. Try another tag or host.</p>}
      </section>
    </section>

    <section className="notes container wide" id="about"><div><ShieldCheck size={20} /><h3>The host picks the threshold.</h3><p>Anybody, Ward members, or a waiting room. Public does not have to mean unmanaged.</p></div><div><Radio size={20} /><h3>Shared Play is deliberately absent.</h3><p>Those rooms expire and only work from the link. No surprise listeners, no directory listing.</p></div><div><Users size={20} /><h3>Requests belong to the requester.</h3><p>Sign in with Ward to correct or promote your own pending song. Hosts still run the queue.</p></div></section>
    {showCreate && <CreateRoom profile={profile} onClose={() => setShowCreate(false)} onCreated={room => { setRooms(current => [room, ...current]); setShowCreate(false) }} />}
  </main>
}

function RoomCard({ room }: { room: Room }) {
  return <article className="room-card"><div className="room-art"><Music2 size={28} /></div><div className="room-copy"><div className="room-meta"><span>{room.kind === 'channel' ? 'channel' : 'streamer queue'}</span><span><Users size={14} /> {room.listeners}</span></div><h3>{room.name}</h3><p>{room.nowPlaying?.title ?? 'Nothing playing'} <span>·</span> {room.nowPlaying?.artist ?? `hosted by ${room.host}`}</p><div className="tags">{room.tags.map(tag => <span key={tag}>#{tag}</span>)}</div></div><a className="join" href={`/rooms/${encodeURIComponent(room.id)}`}><span>Enter</span><ArrowRight size={18} /></a></article>
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
  return <div className="modal-backdrop" role="presentation"><form className="modal card" onSubmit={submit}><button className="close" type="button" onClick={onClose}>×</button><p className="eyebrow">new public room</p><h2 className="headline">Set the vibe, then open the door.</h2><p className="caption">Public rooms need Ward. Private Shared Play links do not.</p><label>Room name<input required value={name} maxLength={60} onChange={event => setName(event.target.value)} placeholder="late night records" /></label><label>Room type<select value={kind} onChange={event => setKind(event.target.value as Room['kind'])}><option value="channel">Shared channel</option><option value="streamer_queue">Streamer queue</option></select></label><label>Who can enter<select value={security} onChange={event => setSecurity(event.target.value as Room['security'])}>{Object.entries(securityCopy).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label>Up to three tags<input value={tags} maxLength={80} onChange={event => setTags(event.target.value)} placeholder="all ages, chill, vinyl" /></label>{error && <p className="form-error">{error}</p>}<button className="cta" type="submit">{profile ? 'Create public room' : 'Sign in with Ward to continue'} <ArrowRight size={18} /></button></form></div>
}

export default App
