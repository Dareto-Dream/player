import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  AudioLines,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Headphones,
  List,
  LoaderCircle,
  Pause,
  Play,
  Radio,
  RotateCcw,
  Search,
  Send,
  Volume2,
  VolumeX,
} from "lucide-react";
import {
  api,
  type QueueItem,
  type Room,
  type Session,
  type SharedQueue,
} from "./api";
import { packageAudio, hostPosition, timeLabel, type RichMedia } from "./audio";
import {
  Artwork,
  ErrorNotice,
  Footer,
  Header,
  savedValue,
  saveValue,
  useAccount,
} from "./ui";
import { ward } from "./auth";
import StreamerRoom from "./StreamerRoom";
import Checkout from './Checkout'

export default function RoomView({
  id,
  privateSession,
}: {
  id: string;
  privateSession: boolean;
}) {
  const account = useAccount();
  const [room, setRoom] = useState<Room | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [items, setItems] = useState<QueueItem[]>([]);
  const [queue, setQueue] = useState<SharedQueue | null>(null);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [queueError, setQueueError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [collapsed, setCollapsed] = useState(false);
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");
  const [listeners, setListeners] = useState<number | null>(null);
  const [access, setAccess] = useState<{
    status: string;
    isOwner: boolean;
  } | null>(null);
  const [rich, setRich] = useState<RichMedia>({});
  useEffect(
    () => () => {
      if (rich.cover) URL.revokeObjectURL(rich.cover);
    },
    [rich.cover],
  );
  const subject = account.profile?.sub;

  useEffect(() => {
    if (privateSession) return;
    let previous: string[] = [];
    try {
      const stored = JSON.parse(savedValue("recent-rooms", "[]"));
      if (Array.isArray(stored))
        previous = stored.filter((value) => typeof value === "string");
    } catch {
      /* Invalid history has no effect on a room. */
    }
    saveValue(
      "recent-rooms",
      JSON.stringify(
        [id, ...previous.filter((value) => value !== id)].slice(0, 8),
      ),
    );
  }, [id, privateSession]);

  useEffect(() => {
    let disposed = false;
    let timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      try {
        const details = privateSession ? null : await api.room(id);
        if (disposed) return;
        setRoom(details);
        // The server must grant protected-room access before fetching session content.
        const admission = privateSession ? null : await api.access(id);
        if (disposed) return;
        setAccess(admission);
        if (admission && admission.status !== "allowed") {
          setSession(null);
          setItems([]);
          setQueue(null);
          setError("");
          return;
        }
        if (details?.kind === "streamer_queue" && details.streamerQueueId) {
          setError("");
          return;
        }
        const channel = privateSession ? null : await api.channel(id);
        const code = privateSession
          ? id
          : channel?.isLive
            ? channel.roomCode
            : null;
        if (details && channel) setRoom({ ...details, isLive: channel.isLive });
        if (!code) {
          setSession(null);
          setItems([]);
          setQueue(null);
          setError("");
          return;
        }
        const current = await api.session(code);
        if (disposed) return;
        setSession(current);
        setError("");
        const [tracks, requests] = await Promise.allSettled([
          api.queue(code),
          api.sharedQueue(code),
        ]);
        if (disposed) return;
        if (tracks.status === "fulfilled") {
          setItems(tracks.value.items || []);
          setCurrentIndex(tracks.value.currentIndex);
          setQueueError("");
        } else setQueueError("The queue could not be refreshed.");
        if (requests.status === "fulfilled") setQueue(requests.value);
        else {
          setQueue(null);
          if (details?.kind === "streamer_queue")
            setQueueError("Requests are temporarily unavailable.");
        }
      } catch (cause) {
        if (!disposed) {
          setSession(null);
          setError(
            cause instanceof Error
              ? cause.message
              : "Could not load this room.",
          );
        }
      } finally {
        if (!disposed) {
          setLoading(false);
          timer = setTimeout(load, 4_000);
        }
      }
    };
    void load();
    return () => {
      disposed = true;
      clearTimeout(timer);
    };
  }, [id, privateSession, subject, refresh]);

  const code = session?.roomCode;
  useEffect(() => {
    if (!code) {
      setListeners(null);
      return;
    }
    let cancelled = false;
    const clientId = savedValue("listener-id", "") || crypto.randomUUID();
    saveValue("listener-id", clientId);
    const presence = () =>
      void api
        .presence(
          code,
          clientId,
          account.profile?.name ||
            account.profile?.preferred_username ||
            "Listener",
        )
        .then((value) => {
          if (!cancelled) setListeners(value.listenerCount);
        })
        .catch(() => {});
    presence();
    const timer = setInterval(presence, 20_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [code, account.profile?.name, account.profile?.preferred_username]);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2_000);
    return () => clearTimeout(timer);
  }, [copied]);

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setCopyError("");
    } catch {
      setCopyError("Copy the room link from your address bar.");
    }
  };
  const name =
    room?.name ||
    (privateSession
      ? "Shared Play"
      : loading
        ? "Opening room…"
        : "Room unavailable");
  const title =
    session?.track?.title ||
    session?.track?.displayName ||
    room?.nowPlaying?.title;
  const artist = session?.track?.artist || room?.nowPlaying?.artist;
  const requestItems = queue?.enabled
    ? (queue.submissions || []).filter((item) =>
        ["pending", "awaiting_payment"].includes(item.status || ""),
      )
    : [];
  const filteredItems = items.filter((item) =>
    `${item.title || item.displayName || item.url || ""} ${item.artist || ""}`
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  );
  const protectedMessage =
    access?.status === "denied"
      ? "The host has declined your admission request."
      : access?.status === "pending"
        ? "You’re in the waiting room. We’ll let you in when the host approves."
        : room?.security === "approval" && access?.status !== "allowed"
          ? "This room requires host approval. Sign in and ask to join."
          : access?.status === "signin"
            ? "Sign in with Ward to join this room."
            : "";

  if (
    room?.kind === "streamer_queue" &&
    room.streamerQueueId &&
    access?.status === "allowed"
  )
    return <StreamerRoom id={room.streamerQueueId} profileRoom={room} />;

  return (
    <div className="app">
      <Header account={account} />
      <main className="shell listening-page">
        <div className="room-breadcrumb">
          <a href="/">
            <ArrowLeft size={15} /> Leave room
          </a>
          {access?.isOwner && <a href={`/rooms/${id}/settings`}>Manage room</a>}
          <button className="button button-quiet" onClick={share}>
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? "Copied" : "Copy invite"}
          </button>
        </div>
        <div className="room-page-heading">
          <div>
            <div className="section-label">
              <Radio size={13} />
              {privateSession
                ? "PRIVATE SHARED PLAY"
                : room?.kind === "streamer_queue"
                  ? "STREAMER QUEUE"
                  : "CHANNEL"}
            </div>
            <h1>{name}</h1>
            {room?.description && <p>{room.description}</p>}
          </div>
          <span className="room-audience">
            <Headphones size={15} />
            {listeners ?? room?.listeners ?? 0}
            <span>listening</span>
          </span>
        </div>
        {copyError && (
          <p role="status" className="field-help">
            {copyError}
          </p>
        )}
        {error && (
          <ErrorNotice
            message={error}
            retry={() => setRefresh((value) => value + 1)}
          />
        )}
        <div
          className={`listening-layout ${collapsed ? "queue-collapsed" : ""}`}
        >
          <section className="listening-stage" aria-label="Player">
            <div className="stage-label">
              <span>
                <i className={session ? "status-dot live" : "status-dot"} />
                {loading ? "CONNECTING" : session ? "CONNECTED" : "OFF AIR"}
              </span>
              <span>
                {privateSession
                  ? id
                  : room?.host
                    ? `HOSTED BY ${room.host}`
                    : ""}
              </span>
            </div>
            <div className="listening-art">
              <Artwork
                name={name}
                src={
                  rich.cover ||
                  session?.albumArtUrl ||
                  session?.track?.artworkUrl ||
                  room?.nowPlaying?.artwork ||
                  room?.bannerUrl
                }
                className="album-art"
              />
            </div>
            <div className="now-playing-copy">
              <div className="section-label">
                {session ? "NOW PLAYING" : "BETWEEN SESSIONS"}
              </div>
              <h2>
                {session
                  ? title || "Shared audio"
                  : loading
                    ? "Tuning in…"
                    : "Waiting for the host"}
              </h2>
              <p>
                {session
                  ? artist || "Shared from Spectralis"
                  : protectedMessage ||
                    "This room will update when the host starts listening."}
              </p>
              {room?.security !== "anyone" && !privateSession && !subject && (
                <button
                  className="button button-primary"
                  onClick={() => ward.signIn()}
                >
                  Sign in with Ward
                  <ArrowRight size={15} />
                </button>
              )}
              {subject &&
                room?.security === "approval" &&
                access?.status === "none" && (
                  <button
                    className="button button-primary"
                    onClick={() =>
                      void api
                        .requestAccess(id)
                        .then(() => setRefresh((v) => v + 1))
                        .catch((e) => setError(e.message))
                    }
                  >
                    Ask to join
                  </button>
                )}
            </div>
            {subject && session?.track?.album && (
              <p className="field-help">{session.track.album}</p>
            )}
            <AudioDeck session={session} onMetadata={setRich} />
            {subject && <Lyrics lrc={rich.lyrics} session={session} />}
          </section>
          <aside className="listening-queue">
            <button
              className="queue-collapse icon-button"
              onClick={() => setCollapsed((value) => !value)}
              aria-label={collapsed ? "Show queue" : "Hide queue"}
              aria-expanded={!collapsed}
            >
              {collapsed ? (
                <ChevronLeft size={17} />
              ) : (
                <ChevronRight size={17} />
              )}
            </button>
            {collapsed ? (
              <span className="queue-rail-label">
                <List size={17} />
                QUEUE · {items.length}
              </span>
            ) : (
              <>
                <div className="queue-title">
                  <div>
                    <List size={18} />
                    <h2>Queue</h2>
                    <span className="count">{items.length}</span>
                  </div>
                  <span className="field-help">From the host</span>
                </div>
                <label className="search-field queue-search">
                  <Search size={15} />
                  <input
                    aria-label="Search queue"
                    placeholder="Find a track"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </label>
                {queueError && (
                  <ErrorNotice
                    message={queueError}
                    retry={() => setRefresh((value) => value + 1)}
                  />
                )}
                <ol className="queue-tracks">
                  {filteredItems.map((item) => (
                    <li
                      key={item.id}
                      className={
                        items.indexOf(item) === currentIndex
                          ? "current-track"
                          : ""
                      }
                    >
                      <span className="queue-position">
                        {items.indexOf(item) === currentIndex ? (
                          <AudioLines size={16} />
                        ) : (
                          String(items.indexOf(item) + 1).padStart(2, "0")
                        )}
                      </span>
                      <div>
                        <strong>
                          {item.title || item.url || "Shared track"}
                        </strong>
                        <span>
                          {item.artist || item.sourceKind || "Requested track"}
                        </span>
                      </div>
                      <span className="queue-duration">
                        {item.durationSeconds
                          ? timeLabel(item.durationSeconds)
                          : ""}
                      </span>
                    </li>
                  ))}
                </ol>
                {!filteredItems.length && (
                  <div className="queue-empty">
                    <List size={26} strokeWidth={1} />
                    <h3>
                      {items.length ? "No matches" : "Nothing queued yet"}
                    </h3>
                    <p>
                      {items.length
                        ? "Try another track or artist."
                        : session
                          ? "The host’s next tracks will appear here."
                          : "The queue opens when the host goes live."}
                    </p>
                  </div>
                )}
                {!!requestItems.length && (
                  <div className="pending-requests">
                    <div className="section-label">
                      AWAITING APPROVAL / PAYMENT
                    </div>
                    {requestItems.map((item) => (
                      <p key={item.id}>
                        {item.title || item.url}
                        <span>
                          {item.status === "pending"
                            ? "Pending"
                            : "Payment required"}
                        </span>
                      </p>
                    ))}
                  </div>
                )}
                {code && (
                  <RequestForm
                    code={code}
                    queue={queue}
                    isStreamer={room?.kind === "streamer_queue"}
                    displayName={
                      account.profile?.name ||
                      account.profile?.preferred_username
                    }
                    onSubmitted={() => setRefresh((value) => value + 1)}
                  />
                )}
              </>
            )}
          </aside>
        </div>
      </main>
      <Footer />
    </div>
  );
}

function RequestForm({
  code,
  queue,
  isStreamer,
  displayName,
  onSubmitted,
}: {
  code: string;
  queue: SharedQueue | null;
  isStreamer: boolean;
  displayName?: string;
  onSubmitted: () => void;
}) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const [payment,setPayment]=useState<string|null>(null)
  const paid =
    queue?.settings?.queueEntryFee?.enabled &&
    Number(queue.settings.queueEntryFee.amount) > 0;
  const disabled =
    busy ||
    !!payment ||
    (isStreamer && !queue?.enabled) ||
    queue?.acceptingSubmissions === false;
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (disabled || !url.trim()) return;
    setFailed(false);
    setMessage("");
    if (!/^(https?:\/\/|spotify:)/i.test(url.trim())) {
      setFailed(true);
      setMessage("Paste an http, https or Spotify track link.");
      return;
    }
    setBusy(true);
    try {
      if (queue?.enabled) {
        const result = await api.submitSharedQueue(code, {
          url: url.trim(),
          displayName,
        });
        if(result.clientSecret)setPayment(result.clientSecret)
        setMessage(
          result.status === "pending"
            ? "Sent to the host for approval."
            : result.status === "awaiting_payment"
              ? "Payment is required before this request can join the queue."
              : "Your request is in the queue.",
        );
      } else {
        await api.addQueueLink(code, url.trim());
        setMessage("Your request is in the queue.");
      }
      setUrl("");
      onSubmitted();
    } catch (cause) {
      setFailed(true);
      setMessage(
        cause instanceof Error
          ? cause.message
          : "The request could not be sent.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className="request-form" onSubmit={submit}>
      <label htmlFor="request-url">Request a track</label>
      <div className="request-input">
        <input
          id="request-url"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="Paste a track link"
          disabled={!!disabled}
        />
        <button
          className="icon-button"
          disabled={!!disabled || !url.trim()}
          title="Send request"
          aria-label="Send request"
        >
          {busy ? <LoaderCircle size={17} /> : <Send size={17} />}
        </button>
      </div>
      <p className="field-help">
        {paid
          ? `Entry: ${queue?.settings?.queueEntryFee?.amount}. You’ll confirm payment before joining the queue.`
          : disabled && !busy
            ? "The host is not accepting requests."
            : "The host controls what plays next."}
      </p>
      {message && (
        <p className={failed ? "form-error" : "request-success"} role="status">
          {message}
        </p>
      )}
      {payment&&<Checkout clientSecret={payment} publishableKey={queue?.stripePublishableKey} onDone={()=>{setPayment(null);setMessage('Payment confirmed. Waiting for the queue to update.');onSubmitted()}}/>}
    </form>
  );
}

function AudioDeck({
  session,
  onMetadata,
}: {
  session: Session | null;
  onMetadata: (metadata: RichMedia) => void;
}) {
  const audio = useRef<HTMLAudioElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const graph = useRef<{
    context: AudioContext;
    analyser: AnalyserNode;
  } | null>(null);
  const playback = useRef(session?.playback);
  playback.current = session?.playback;
  const listening = useRef(false);
  const [enabled, setEnabled] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const element = audio.current!;
    const controller = new AbortController();
    let objectUrl: string | undefined;
    let cancelled = false;
    element.pause();
    element.removeAttribute("src");
    element.load();
    setReady(false);
    setPosition(0);
    setDuration(0);
    setError("");
    onMetadata({});
    const url = session?.browserAudioUrl || session?.packageUrl;
    if (!url) {
      listening.current = false;
      setEnabled(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    void (async () => {
      try {
        const source =
          session?.browserAudioUrl ||
          (objectUrl = await packageAudio(url, controller.signal, onMetadata));
        if (!cancelled) {
          element.src = source;
          element.load();
        } else if (objectUrl) URL.revokeObjectURL(objectUrl);
      } catch (cause) {
        if (!cancelled) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Audio could not be loaded.",
          );
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
      controller.abort();
      element.pause();
      element.removeAttribute("src");
      element.load();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [session?.packageUrl, session?.browserAudioUrl, session?.trackId, retry]);

  const sync = (force = false) => {
    const element = audio.current;
    const host = playback.current;
    if (!element || element.readyState < 2 || !host) return;
    const target = Math.min(
      hostPosition(host),
      Number.isFinite(element.duration) ? element.duration : Infinity,
    );
    const drift = target - element.currentTime;
    // A forced sync (first sound, play pressed) still only seeks when we're actually off. Seeking fires `canplay`,
    // and `canplay` forces a sync, so seeking unconditionally here looped forever: thousands of seeks a second,
    // which sounds like crackle.
    if (Math.abs(drift) > (force ? 0.25 : 1.5)) element.currentTime = target;
    element.playbackRate =
      Math.abs(drift) > 0.2 && Math.abs(drift) <= 1.5
        ? 1 + Math.max(-0.03, Math.min(0.03, drift / 10))
        : 1;
    if (
      !host.isPlaying ||
      (Number.isFinite(element.duration) && target >= element.duration - 0.05)
    )
      element.pause();
    else if (listening.current && element.paused)
      void element.play().catch(() => {
        listening.current = false;
        setEnabled(false);
        setError("Your browser paused audio. Press play to listen.");
      });
  };

  useEffect(() => {
    const timer = setInterval(() => sync(), 500);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (audio.current) audio.current.volume = volume;
  }, [volume]);
  useEffect(
    () => () => {
      void graph.current?.context.close();
    },
    [],
  );
  useEffect(() => {
    const element = canvas.current!;
    const context = element.getContext("2d")!;
    let frame: number;
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const draw = () => {
      const width = element.clientWidth;
      const height = element.clientHeight;
      const ratio = window.devicePixelRatio || 1;
      if (
        element.width !== width * ratio ||
        element.height !== height * ratio
      ) {
        element.width = width * ratio;
        element.height = height * ratio;
      }
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, width, height);
      const analyser = graph.current?.analyser;
      const levels = new Uint8Array(analyser?.frequencyBinCount || 128);
      if (analyser && !reducedMotion) analyser.getByteFrequencyData(levels);
      const count = 64;
      for (let index = 0; index < count; index++) {
        const amplitude = audio.current?.paused
          ? 0
          : levels[Math.floor((index * levels.length) / count)] / 255;
        context.fillStyle = amplitude > 0.1 ? "#57baa7" : "#4c6661";
        const bar = Math.max(2, amplitude * (height - 6));
        context.fillRect(
          (index * width) / count,
          (height - bar) / 2,
          Math.max(1, width / count - 3),
          bar,
        );
      }
      frame = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(frame);
  }, []);

  const toggle = async () => {
    const element = audio.current!;
    if (listening.current) {
      listening.current = false;
      setEnabled(false);
      element.pause();
      return;
    }
    setError("");
    try {
      if (!graph.current) {
        const context = new AudioContext();
        const analyser = context.createAnalyser();
        analyser.fftSize = 256;
        context.createMediaElementSource(element).connect(analyser);
        analyser.connect(context.destination);
        graph.current = { context, analyser };
      }
      await graph.current.context.resume();
      listening.current = true;
      setEnabled(true);
      sync(true);
      if (!playback.current) await element.play();
    } catch {
      listening.current = false;
      setEnabled(false);
      setError("This browser could not play the shared audio.");
    }
  };

  return (
    <div className="audio-deck">
      <audio
        ref={audio}
        crossOrigin="anonymous"
        onCanPlay={() => {
          setReady(true);
          setLoading(false);
          sync(true);
        }}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(event) => setPosition(event.currentTarget.currentTime)}
        onDurationChange={(event) =>
          setDuration(
            Number.isFinite(event.currentTarget.duration)
              ? event.currentTarget.duration
              : 0,
          )
        }
        onError={() => {
          if (audio.current?.getAttribute("src")) {
            setError("The audio format or stream could not be played.");
            setLoading(false);
          }
        }}
      />
      <canvas
        className="audio-spectrum"
        ref={canvas}
        aria-label="Live audio frequency spectrum"
        role="img"
      />
      <div className="audio-controls">
        <div className="audio-status">
          <span className={playing ? "status-dot live" : "status-dot"} />
          {loading
            ? "LOADING AUDIO"
            : enabled
              ? playing
                ? "LISTENING LIVE"
                : "HOST PAUSED"
              : "LISTEN TOGETHER"}
        </div>
        <div className="transport">
          <button
            className="icon-button"
            disabled={!ready}
            aria-label="Resync with host"
            title="Resync with host"
            onClick={() => sync(true)}
          >
            <RotateCcw size={18} />
          </button>
          <button
            className="play-button"
            disabled={!ready || loading}
            onClick={() => void toggle()}
            aria-label={enabled ? "Pause listening" : "Start listening"}
          >
            {loading ? (
              <LoaderCircle size={22} />
            ) : enabled ? (
              <Pause size={22} />
            ) : (
              <Play size={22} />
            )}
          </button>
        </div>
        <div className="volume-control">
          <button
            className="icon-button"
            aria-label={volume ? "Mute" : "Unmute"}
            onClick={() => setVolume((value) => (value ? 0 : 0.8))}
          >
            {volume ? <Volume2 size={17} /> : <VolumeX size={17} />}
          </button>
          <input
            aria-label="Volume"
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={(event) => setVolume(Number(event.target.value))}
          />
        </div>
      </div>
      <div className="timeline">
        <span>{timeLabel(position)}</span>
        <progress
          value={duration ? Math.min(position, duration) : 0}
          max={duration || 1}
          aria-label="Track progress"
        />
        <span>{timeLabel(duration)}</span>
      </div>
      {error && (
        <ErrorNotice
          message={error}
          retry={() => setRetry((value) => value + 1)}
        />
      )}
    </div>
  );
}

function Lyrics({ lrc, session }: { lrc?: string; session: Session | null }) {
  const [position, setPosition] = useState(0);
  useEffect(() => {
    const tick = () =>
      setPosition(session?.playback ? hostPosition(session.playback) : 0);
    tick();
    const timer = setInterval(tick, 250);
    return () => clearInterval(timer);
  }, [session?.playback]);
  const lines = (lrc || "")
    .split("\n")
    .flatMap((line) => {
      const text = line.replace(/\[[^\]]+\]/g, "").trim();
      return [...line.matchAll(/\[(\d+):(\d+(?:\.\d+)?)\]/g)].map((match) => ({
        time: Number(match[1]) * 60 + Number(match[2]),
        text,
      }));
    })
    .sort((a, b) => a.time - b.time);
  const timed=lines.length?lines:(session?.track?.lyrics||[]).map(line=>({time:line.timeSeconds||0,text:line.text}))
  const current = timed.filter((line) => line.time <= position).at(-1);
  return current ? <p className="host-lyrics">{current.text}</p> : null;
}
