import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  AudioLines,
  Check,
  ChevronDown,
  Clock3,
  Grid2X2,
  Headphones,
  List,
  LockKeyhole,
  Plus,
  Radio,
  Search,
  SlidersHorizontal,
  Users,
  X,
} from "lucide-react";
import { api, type Room } from "./api";
import { ward, type WardProfile } from "./auth";
import {
  Artwork,
  ErrorNotice,
  Footer,
  Header,
  savedValue,
  saveValue,
  useAccount,
} from "./ui";

const normalize = (value: string) =>
  value.trim().replace(/^#/, "").toLocaleLowerCase();
type Filter = "all" | Room["kind"];
const securityLabels = {
  anyone: "Open to everyone",
  ward: "Ward members",
  approval: "Host approval",
};

export default function Directory() {
  const account = useAccount();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [showTags, setShowTags] = useState(false);
  const [tagSearch, setTagSearch] = useState("");
  const [kind, setKind] = useState<Filter>("all");
  const [sort, setSort] = useState("live");
  const [view, setView] = useState(() =>
    savedValue("room-view", "grid") === "list" ? "list" : "grid",
  );
  const [showCreate, setShowCreate] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [myRoom, setMyRoom] = useState<Room | null>(null);
  const tagPanel = useRef<HTMLDivElement>(null);

  // One permanent room per account: someone who has one goes to it instead of making another.
  useEffect(() => {
    if (!account.profile) {
      setMyRoom(null);
      return;
    }
    let cancelled = false;
    api
      .myRoom()
      .then(({ room }) => {
        if (!cancelled) setMyRoom(room);
      })
      .catch(() => {
        if (!cancelled) setMyRoom(null);
      });
    return () => {
      cancelled = true;
    };
  }, [account.profile]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      try {
        const data = await api.browse();
        if (!cancelled) {
          setRooms(data.rooms);
          setError("");
        }
      } catch (cause) {
        if (!cancelled)
          setError(
            cause instanceof Error
              ? cause.message
              : "The directory is unavailable.",
          );
      } finally {
        if (!cancelled) {
          setLoading(false);
          timer = setTimeout(load, 30_000);
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [refresh]);

  useEffect(() => {
    if (!showTags) return;
    const dismiss = (event: PointerEvent) => {
      if (!tagPanel.current?.contains(event.target as Node)) setShowTags(false);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [showTags]);

  const tagCounts = new Map<string, number>();
  rooms.forEach((room) =>
    new Set(room.tags.map(normalize).filter(Boolean)).forEach((tag) =>
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1),
    ),
  );
  const tags = [...tagCounts.keys()].sort((a, b) => a.localeCompare(b));
  const filtered = rooms
    .filter((room) => {
      const text =
        `${room.name} ${room.host} ${room.description || ""} ${room.tags.join(" ")}`.toLocaleLowerCase();
      return (
        (kind === "all" || room.kind === kind) &&
        text.includes(normalize(search)) &&
        activeTags.every((tag) => room.tags.map(normalize).includes(tag))
      );
    })
    .sort((a, b) =>
      sort === "name"
        ? a.name.localeCompare(b.name)
        : sort === "listeners"
          ? b.listeners - a.listeners
          : Number(Boolean(b.isLive)) - Number(Boolean(a.isLive)) ||
            b.listeners - a.listeners ||
            a.name.localeCompare(b.name),
    );
  const reset = () => {
    setSearch("");
    setActiveTags([]);
    setKind("all");
  };
  const toggleTag = (tag: string) =>
    setActiveTags((current) =>
      current.includes(tag)
        ? current.filter((item) => item !== tag)
        : [...current, tag],
    );
  const filtersApplied = Boolean(search || activeTags.length || kind !== "all");
  const changeView = (next: string) => {
    setView(next);
    saveValue("room-view", next);
  };

  return (
    <div className="app">
      <Header account={account} />
      <main className="shell directory-page">
        <div className="page-heading">
          <div>
            <div className="section-label">
              <Radio size={14} /> THE DIRECTORY
            </div>
            <h1>
              Find your frequency<span>.</span>
            </h1>
            <p>Public channels &amp; streamer queues.</p>
          </div>
          {myRoom ? (
            <a
              className="button button-light"
              href={`/rooms/${encodeURIComponent(myRoom.id)}`}
            >
              Your room
            </a>
          ) : (
            <button
              className="button button-light"
              onClick={() => setShowCreate(true)}
            >
              <Plus size={16} /> New room
            </button>
          )}
        </div>
        <div className="directory-layout">
          <section className="directory-main" aria-label="Public rooms">
            <div className="directory-toolbar">
              <label className="search-field">
                <Search size={18} />
                <input
                  aria-label="Search rooms"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Find a room, host or tag"
                />
                {search && (
                  <button
                    className="icon-button"
                    onClick={() => setSearch("")}
                    type="button"
                    aria-label="Clear search"
                  >
                    <X size={15} />
                  </button>
                )}
              </label>
              <div
                className="tag-control"
                ref={tagPanel}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    setShowTags(false);
                    tagPanel.current?.querySelector("button")?.focus();
                  }
                }}
              >
                <button
                  className={`button button-quiet tag-toggle ${activeTags.length ? "is-selected" : ""}`}
                  onClick={() => setShowTags((value) => !value)}
                  aria-expanded={showTags}
                  aria-controls="tag-panel"
                >
                  <SlidersHorizontal size={16} /> Tags
                  {activeTags.length > 0 && (
                    <span className="count">{activeTags.length}</span>
                  )}
                </button>
                {showTags && (
                  <div className="tag-panel" id="tag-panel">
                    <div className="panel-heading">
                      <strong>Filter by tag</strong>
                      <button
                        className="text-button"
                        onClick={() => setActiveTags([])}
                        disabled={!activeTags.length}
                      >
                        Clear
                      </button>
                    </div>
                    <label className="search-field compact">
                      <Search size={15} />
                      <input
                        aria-label="Search tags"
                        placeholder="Search tags"
                        value={tagSearch}
                        onChange={(event) => setTagSearch(event.target.value)}
                        autoFocus
                      />
                    </label>
                    <p className="field-help">
                      Rooms must match every selected tag.
                    </p>
                    <div className="tag-options">
                      {tags
                        .filter((tag) => tag.includes(normalize(tagSearch)))
                        .map((tag) => (
                          <button
                            key={tag}
                            className="tag-option"
                            aria-pressed={activeTags.includes(tag)}
                            onClick={() => toggleTag(tag)}
                          >
                            <span className="checkbox-mark">
                              {activeTags.includes(tag) && <Check size={12} />}
                            </span>
                            <span>{tag}</span>
                            <small>{tagCounts.get(tag)}</small>
                          </button>
                        ))}
                    </div>
                    {!tags.length && (
                      <p className="field-help">
                        Tags appear here when rooms are published.
                      </p>
                    )}
                    {!!tags.length &&
                      !tags.some((tag) =>
                        tag.includes(normalize(tagSearch)),
                      ) && <p className="field-help">No matching tags.</p>}
                    <button
                      className="button button-quiet tag-done"
                      onClick={() => setShowTags(false)}
                    >
                      Done <Check size={14} />
                    </button>
                  </div>
                )}
              </div>
              <div
                className="view-switch"
                role="group"
                aria-label="Directory view"
              >
                <button
                  aria-label="Grid view"
                  title="Grid view"
                  aria-pressed={view === "grid"}
                  onClick={() => changeView("grid")}
                >
                  <Grid2X2 size={17} />
                </button>
                <button
                  aria-label="List view"
                  title="List view"
                  aria-pressed={view === "list"}
                  onClick={() => changeView("list")}
                >
                  <List size={18} />
                </button>
              </div>
            </div>
            <div className="directory-filters">
              <div className="kind-tabs" role="group" aria-label="Room type">
                {(
                  [
                    ["all", "All rooms"],
                    ["channel", "Channels"],
                    ["streamer_queue", "Queues"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    aria-pressed={kind === value}
                    onClick={() => setKind(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <label className="sort-control">
                <span className="sr-only">Sort rooms</span>
                <select
                  value={sort}
                  onChange={(event) => setSort(event.target.value)}
                >
                  <option value="live">Live first</option>
                  <option value="listeners">Most listeners</option>
                  <option value="name">A–Z</option>
                </select>
                <ChevronDown size={13} />
              </label>
            </div>
            {activeTags.length > 0 && (
              <div className="active-tags" aria-label="Selected tags">
                {activeTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    aria-label={`Remove tag ${tag}`}
                  >
                    {tag}
                    <X size={12} />
                  </button>
                ))}
              </div>
            )}
            {error && (
              <ErrorNotice
                message={error}
                retry={() => setRefresh((value) => value + 1)}
              />
            )}
            <div className="results-heading">
              <span aria-live="polite">
                {loading
                  ? "Tuning in…"
                  : `${filtered.length} ${filtered.length === 1 ? "room" : "rooms"}`}
              </span>
              <span>
                <i
                  className={
                    rooms.some((room) => room.isLive)
                      ? "status-dot live"
                      : "status-dot"
                  }
                />
                {rooms.filter((room) => room.isLive).length} on air
              </span>
            </div>
            {loading ? (
              <div className="loading-state" role="status">
                <AudioLines size={25} />
                <span>Finding rooms…</span>
              </div>
            ) : (
              <div className={`room-collection view-${view}`}>
                {filtered.map((room) => (
                  <RoomCard
                    key={room.id}
                    room={room}
                    onTag={(tag) => {
                      const normalized = normalize(tag);
                      if (!activeTags.includes(normalized))
                        setActiveTags((current) => [...current, normalized]);
                    }}
                  />
                ))}
              </div>
            )}
            {!loading && !error && !filtered.length && (
              <div className="directory-empty">
                <div className="empty-dial" aria-hidden="true">
                  <Radio size={31} strokeWidth={1} />
                  <span>OFF AIR</span>
                </div>
                <h2>
                  {filtersApplied
                    ? "Nothing on this frequency."
                    : "Quiet in here for now."}
                </h2>
                <p>
                  {filtersApplied
                    ? "Try another name or remove a filter."
                    : "No public rooms yet. Have an invite? You can still join with a room code."}
                </p>
                <button
                  className="button button-quiet"
                  onClick={filtersApplied ? reset : () => setShowCreate(true)}
                >
                  {filtersApplied ? "Clear filters" : "Create a room"}
                  <ArrowRight size={15} />
                </button>
              </div>
            )}
          </section>
          <aside className="directory-sidebar">
            <RoomCode />
            <div className="sidebar-note">
              <LockKeyhole size={16} />
              <p>
                Shared Play stays private.
                <br />
                <span>Only people with your invite can join.</span>
              </p>
            </div>
            <RecentRooms rooms={rooms} />
            <div className="sidebar-colophon">
              <AudioLines size={18} />
              <span>
                YOUR MUSIC.
                <br />
                YOUR PEOPLE.
              </span>
            </div>
          </aside>
        </div>
      </main>
      <Footer />
      {showCreate && (
        <CreateRoom
          profile={account.profile}
          onClose={() => setShowCreate(false)}
          onCreated={(room) => {
            window.location.assign(`/rooms/${encodeURIComponent(room.id)}`);
          }}
        />
      )}
    </div>
  );
}

function RoomCard({
  room,
  onTag,
}: {
  room: Room;
  onTag: (tag: string) => void;
}) {
  const path = `/rooms/${encodeURIComponent(room.id)}`;
  return (
    <article className="room-card">
      <a className="room-cover" href={path} tabIndex={-1} aria-hidden="true">
        <Artwork
          name={room.name}
          src={room.bannerUrl || room.artwork || room.nowPlaying?.artwork}
        />
        <span className={`room-status ${room.isLive ? "on-air" : ""}`}>
          <i className="status-dot" />
          {room.isLive ? "ON AIR" : "OFFLINE"}
        </span>
      </a>
      <div className="room-card-body">
        <div className="room-kind">
          {room.kind === "streamer_queue" ? (
            <List size={12} />
          ) : (
            <Radio size={12} />
          )}
          {room.kind === "streamer_queue" ? "STREAMER QUEUE" : "CHANNEL"}
          <span title={securityLabels[room.security]}>
            {room.security !== "anyone" && <LockKeyhole size={12} />}
          </span>
        </div>
        <h2>
          <a href={path}>{room.name}</a>
        </h2>
        <p className="room-host">with {room.host}</p>
        <div className="room-track">
          <AudioLines size={14} />
          <span>
            {room.isLive && room.nowPlaying?.title ? (
              <>
                {room.nowPlaying.title}
                {room.nowPlaying.artist && (
                  <span className="track-artist">
                    {" "}
                    · {room.nowPlaying.artist}
                  </span>
                )}
              </>
            ) : (
              "Between sessions"
            )}
          </span>
        </div>
        <div className="room-card-bottom">
          <div className="room-tags">
            {room.tags.map((tag) => (
              <button
                key={tag}
                onClick={() => onTag(tag)}
                title={`Filter by ${tag}`}
              >
                {tag}
              </button>
            ))}
          </div>
          <span
            className="listener-count"
            title={`${room.listeners} listeners`}
          >
            <Headphones size={13} />
            {room.listeners}
          </span>
        </div>
      </div>
      <a
        className="room-enter icon-button"
        href={path}
        aria-label={`Enter ${room.name}`}
      >
        <ArrowUpRight size={18} />
      </a>
    </article>
  );
}

function RoomCode() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const normalized = code.replace(/[\s-]/g, "").toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(normalized)) {
      setError("Enter the six-character code from your invite.");
      return;
    }
    window.location.assign(`/sessions/${normalized}`);
  };
  return (
    <section className="invite-panel">
      <div className="panel-index">
        <span>HAVE AN INVITE?</span>
        <ArrowUpRight size={15} />
      </div>
      <h2>Right this way.</h2>
      <p>Join your people with a room code.</p>
      <form onSubmit={submit}>
        <label className="sr-only" htmlFor="room-code">
          Room code
        </label>
        <input
          id="room-code"
          className="code-input"
          value={code}
          onChange={(event) => {
            setCode(event.target.value.toUpperCase());
            setError("");
          }}
          placeholder="ABC123"
          autoComplete="off"
          spellCheck={false}
          maxLength={12}
          aria-describedby={error ? "code-error" : undefined}
          aria-invalid={!!error}
        />
        <button className="button button-primary" type="submit">
          Join room <ArrowRight size={16} />
        </button>
        {error && (
          <p id="code-error" className="form-error" role="alert">
            {error}
          </p>
        )}
      </form>
    </section>
  );
}

function RecentRooms({ rooms }: { rooms: Room[] }) {
  let ids: string[] = [];
  try {
    const value = JSON.parse(savedValue("recent-rooms", "[]"));
    if (Array.isArray(value))
      ids = value.filter((id) => typeof id === "string");
  } catch {
    /* Ignore corrupt browser history. */
  }
  const recent = ids
    .flatMap((id) => {
      const room = rooms.find((item) => item.id === id);
      return room ? [room] : [];
    })
    .slice(0, 3);
  return (
    <section className="recent-panel">
      <div className="section-label">
        <Clock3 size={13} /> RECENTLY OPENED
      </div>
      {recent.length ? (
        recent.map((room) => (
          <a
            className="recent-room"
            href={`/rooms/${encodeURIComponent(room.id)}`}
            key={room.id}
          >
            <Artwork name={room.name} src={room.iconUrl} />
            <span>
              {room.name}
              <small>{room.isLive ? "On air" : "Offline"}</small>
            </span>
            <ArrowUpRight size={14} />
          </a>
        ))
      ) : (
        <p>Your recently opened channels will show up here.</p>
      )}
    </section>
  );
}

function CreateRoom({
  profile,
  onClose,
  onCreated,
}: {
  profile: WardProfile | null;
  onClose: () => void;
  onCreated: (room: Room) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<Room["kind"]>("channel");
  const [security, setSecurity] = useState<Room["security"]>("anyone");
  const [tags, setTags] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [isPublic, setIsPublic] = useState(false);
  useEffect(() => {
    const element = dialog.current;
    const previous = document.activeElement as HTMLElement | null;
    element?.showModal();
    return () => {
      element?.close();
      previous?.focus();
    };
  }, []);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const parsedTags = [
      ...new Set(tags.split(",").map(normalize).filter(Boolean)),
    ];
    if (parsedTags.length > 3) {
      setError("Choose up to three tags.");
      return;
    }
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      onCreated(
        await api.createRoom({
          name: name.trim(),
          kind,
          security,
          tags: parsedTags,
          isPublic,
        }),
      );
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Could not create the room.";
      // Made one on another device a moment ago: take them to it.
      if (/already have a room/i.test(message)) {
        try {
          const { room } = await api.myRoom();
          if (room) {
            onCreated(room);
            return;
          }
        } catch {
          /* fall through to the message */
        }
      }
      setError(message);
      setBusy(false);
    }
  };
  return (
    <dialog
      ref={dialog}
      className="room-dialog"
      aria-labelledby="create-title"
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === dialog.current && !busy) onClose();
      }}
    >
      <div className="dialog-content">
        <button
          className="icon-button dialog-close"
          aria-label="Close new room"
          onClick={onClose}
          disabled={busy}
        >
          <X size={20} />
        </button>
        <div className="section-label">
          <Radio size={14} /> YOUR OWN FREQUENCY
        </div>
        <h2 id="create-title">New room</h2>
        {!profile ? (
          <div className="sign-in-prompt">
            <p>Connect your Ward account to create and manage a public room.</p>
            <button
              className="button button-primary"
              onClick={() => ward.signIn()}
            >
              Continue with Ward
              <ArrowUpRight size={16} />
            </button>
            <p className="field-help">
              Joining a private Shared Play invite doesn’t need an account.
            </p>
            <button
              className="button button-quiet"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const queue = await api.createStreamer();
                  saveValue(`queue-owner-${queue.roomId}`, queue.ownerToken);
                  await api.streamerSettings(queue.roomId, {
                    ownerToken: queue.ownerToken,
                    enabled: true,
                  });
                  window.location.assign(`/queues/${queue.roomId}`);
                } catch (e) {
                  setError((e as Error).message);
                  setBusy(false);
                }
              }}
            >
              Create a private streamer queue
            </button>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
          </div>
        ) : (
          <form className="room-form" onSubmit={submit}>
            <label>
              Room name
              <input
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={60}
                autoFocus
              />
            </label>
            <div className="form-columns">
              <label>
                Room type
                <select
                  value={kind}
                  onChange={(event) =>
                    setKind(event.target.value as Room["kind"])
                  }
                >
                  <option value="channel">Channel</option>
                  <option value="streamer_queue">Streamer queue</option>
                </select>
              </label>
              <label>
                Who can join
                <select
                  value={security}
                  onChange={(event) =>
                    setSecurity(event.target.value as Room["security"])
                  }
                >
                  {Object.entries(securityLabels).map(([value, label]) => (
                    <option value={value} key={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              Tags
              <input
                value={tags}
                onChange={(event) => setTags(event.target.value)}
                placeholder="chill, electronic, 18+"
                maxLength={80}
              />
              <span className="field-help">
                Up to three, separated by commas.
              </span>
            </label>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
              />{" "}
              Show in the public directory
            </label>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button
              className="button button-primary"
              disabled={busy || !name.trim()}
            >
              {busy ? "Creating…" : "Create room"}
              <ArrowRight size={16} />
            </button>
          </form>
        )}
      </div>
    </dialog>
  );
}
