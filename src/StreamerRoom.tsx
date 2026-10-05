import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowUp, ListMusic, Pencil, Check, X } from "lucide-react";
import {
  api,
  request,
  type Room,
  type StreamerRoom as QueueRoom,
  type QueueItem,
  type QueueSubmission,
} from "./api";
import { Header, Footer, ErrorNotice, useAccount, savedValue } from "./ui";
import { ward } from "./auth";
import Checkout from "./Checkout";

export default function StreamerRoom({
  id,
  profileRoom,
}: {
  id: string;
  profileRoom?: Room;
}) {
  const account = useAccount();
  const [room, setRoom] = useState<QueueRoom | null>(null);
  const [ownerToken, setOwnerToken] = useState(
    savedValue(`queue-owner-${id}`, ""),
  );
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [channel, setChannel] = useState(
    new URLSearchParams(location.search).get("ch") || "",
  );
  const [editing, setEditing] = useState<QueueItem | null>(null);
  const [payment, setPayment] = useState<string | null>(null);
  useEffect(() => {
    if (!account.profile) return;
    void api
      .host(profileRoom?.id || id)
      .then((v) => setOwnerToken(v.ownerToken))
      .catch(() => {});
  }, [id, profileRoom?.id, account.profile?.sub]);
  useEffect(() => {
    let disposed = false;
    let timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      try {
        const value = await api.streamerRoom(id, ownerToken || undefined);
        if (!disposed) {
          setRoom(value);
          setError("");
        }
      } catch (e) {
        if (!disposed) setError((e as Error).message);
      } finally {
        if (!disposed) timer = setTimeout(load, 4000);
      }
    };
    void load();
    return () => {
      disposed = true;
      clearTimeout(timer);
    };
  }, [id, ownerToken, refresh, account.profile?.sub]);
  const result = (value: QueueSubmission) => {
    if (value.clientSecret) {
      setPayment(value.clientSecret);
      setMessage("Your request is waiting for payment.");
    } else
      setMessage(
        value.status === "pending"
          ? "Sent to the host for approval."
          : "Your request is in the queue.",
      );
    setRefresh((v) => v + 1);
  };
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const name = account.profile?.name || displayName || "Listener";
      if (file) {
        const form = new FormData();
        form.append("file", file);
        form.append("title", title);
        form.append("artist", artist);
        form.append("displayName", name);
        if (channel) form.append("queueChannelId", channel);
        result(
          await request<QueueSubmission>(
            `/streamer-queue/v1/rooms/${id}/upload`,
            { method: "POST", body: form },
          ),
        );
      } else
        result(
          await api.submitStreamer(id, {
            url,
            title,
            artist,
            displayName: name,
            queueChannelId: channel || undefined,
          }),
        );
      setUrl("");
      setTitle("");
      setArtist("");
      setFile(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const action = async (item: QueueItem, type: string) => {
    setBusy(true);
    try {
      await api.streamerAction(id, item.id, type, ownerToken);
      setRefresh((v) => v + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const promote = async (item: QueueItem, tier: string) => {
    setBusy(true);
    try {
      result(
        await api.promoteStreamer(id, item.id, {
          tier,
          ...(ownerToken ? { ownerToken } : {}),
        }),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const saveEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setBusy(true);
    try {
      await api.editStreamer(id, editing.id, {
        title: editing.title,
        artist: editing.artist,
        ...(ownerToken ? { ownerToken } : {}),
      });
      setEditing(null);
      setRefresh((v) => v + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const itemRow = (item: QueueItem, index: number) => (
    <li key={item.id} className="streamer-track">
      <span className="track-number">{index + 1}</span>
      <div>
        <strong>{item.title || item.url || "Audio upload"}</strong>
        <p>
          {item.artist || item.displayName || "Listener"} ·{" "}
          {item.status || "queued"}
          {item.tier && item.tier !== "normal"
            ? ` · ${item.tier.replace("_", " ")}`
            : ""}
        </p>
      </div>
      {(ownerToken || item.canEdit) && item.id !== room?.nowPlayingId && (
        <div className="row-actions">
          <button
            className="icon-button"
            title="Edit your request"
            aria-label={`Edit ${item.title || "request"}`}
            onClick={() => setEditing(item)}
          >
            <Pencil size={15} />
          </button>
          {["skip", "super_skip"].map((tier) => {
            const fee =
              room?.settings?.[tier === "skip" ? "skip" : "superSkip"];
            return (
              (ownerToken || fee?.enabled) && (
                <button
                  key={tier}
                  className="button button-quiet"
                  disabled={busy}
                  onClick={() => promote(item, tier)}
                >
                  <ArrowUp size={13} />
                  {tier === "skip" ? "Promote" : "Priority"}
                  {!ownerToken && fee?.amount > 0
                    ? ` · ${fee.amount} ${fee.currency || "USD"}`
                    : ""}
                </button>
              )
            );
          })}
          {ownerToken && item.status === "pending" && (
            <button
              className="icon-button"
              title="Approve request"
              onClick={() => action(item, "approve")}
            >
              <Check size={16} />
            </button>
          )}
          {ownerToken && (
            <button
              className="icon-button"
              title="Reject request"
              onClick={() => action(item, "reject")}
            >
              <X size={16} />
            </button>
          )}
        </div>
      )}
    </li>
  );
  const fee = room?.settings?.queueEntryFee;
  const mine = (room?.mySubmissions || []).filter(
    (v) => !room?.orderedQueue?.some((q) => q.id === v.id),
  );
  const pending = ownerToken
    ? (room?.submissions || []).filter((s) => s.status === "pending")
    : mine;
  return (
    <div className="app">
      <Header account={account} />
      <main className="shell listening-page">
        <div className="room-breadcrumb">
          <a href="/">
            <ArrowLeft size={15} /> Directory
          </a>
          {ownerToken && account.profile && (
            <a href={`/rooms/${profileRoom?.id || id}/settings`}>Manage room</a>
          )}
        </div>
        <div className="section-label">
          <ListMusic size={14} /> STREAMER QUEUE
        </div>
        <h1>{profileRoom?.name || "Requests"}</h1>
        <p>{profileRoom?.description || "Send a track. Follow the queue."}</p>
        {error && (
          <ErrorNotice message={error} retry={() => setRefresh((v) => v + 1)} />
        )}
        <div className="settings-layout">
          <section className="settings-panel">
            <div className="queue-title">
              <h2>
                {room?.nowPlayingId
                  ? `Now playing · ${room.nowPlayingTitle || "Audio upload"}`
                  : "Up next"}
              </h2>
            </div>
            <ol className="streamer-tracks">
              {room?.orderedQueue?.map(itemRow)}
            </ol>
            {!room?.orderedQueue?.length && (
              <p className="field-help">No tracks queued.</p>
            )}
            {pending.length > 0 && (
              <>
                <h3>
                  {ownerToken ? "Waiting for approval" : "Your other requests"}
                </h3>
                <ol className="streamer-tracks">{pending.map(itemRow)}</ol>
              </>
            )}
            {ownerToken && (
              <button
                className="button button-quiet"
                onClick={() =>
                  void api
                    .streamerSettings(id, {
                      ownerToken,
                      enabled: true,
                      acceptingSubmissions: !room?.acceptingSubmissions,
                    })
                    .then(() => setRefresh((v) => v + 1))
                    .catch((e) => setError(e.message))
                }
              >
                {room?.acceptingSubmissions
                  ? "Close requests"
                  : "Open requests"}
              </button>
            )}
          </section>
          <aside className="settings-panel">
            <h2>Request a track</h2>
            <form className="room-form" onSubmit={submit}>
              {!account.profile && (
                <label>
                  Your name
                  <input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    maxLength={32}
                  />
                </label>
              )}
              <label>
                Track link
                <input
                  type="url"
                  required={!file}
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://…"
                  disabled={!!file}
                />
              </label>
              <label>
                Or upload audio
                <input
                  type="file"
                  accept="audio/*"
                  onChange={(e) => {
                    const selected = e.target.files?.[0];
                    if (selected && selected.size > 50 * 1024 * 1024) {
                      setError("Audio uploads must be under 50 MB.");
                      e.target.value = "";
                      return;
                    }
                    setFile(selected || null);
                  }}
                />
              </label>
              <label>
                Title
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={120}
                />
              </label>
              <label>
                Artist
                <input
                  value={artist}
                  onChange={(e) => setArtist(e.target.value)}
                  maxLength={120}
                />
              </label>
              {(room?.queueChannels?.length || 0) > 1 && (
                <label>
                  Queue
                  <select
                    value={channel}
                    onChange={(e) => setChannel(e.target.value)}
                  >
                    <option value="">Default</option>
                    {room?.queueChannels?.map((lane) => (
                      <option value={lane.id} key={lane.id}>
                        {lane.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {fee?.enabled && (
                <p className="field-help">
                  Entry: {fee.amount} {fee.currency}. You’ll confirm payment
                  before joining the queue.
                </p>
              )}
              <button
                className="button button-primary"
                disabled={
                  busy || !room?.enabled || room.acceptingSubmissions === false
                }
              >
                {busy
                  ? "Sending…"
                  : room?.enabled && room.acceptingSubmissions !== false
                    ? "Send request"
                    : "Requests closed"}
              </button>
              {message && <p role="status">{message}</p>}
            </form>
            {!account.profile && (
              <p className="field-help">
                <button className="text-button" onClick={() => ward.signIn()}>
                  Sign in with Ward
                </button>{" "}
                to edit or promote your pending songs.
              </p>
            )}
            {payment && (
              <Checkout
                clientSecret={payment}
                publishableKey={room?.stripePublishableKey}
                onDone={() => {
                  setPayment(null);
                  setMessage(
                    "Payment confirmed. Waiting for the queue to update.",
                  );
                  setRefresh((v) => v + 1);
                }}
              />
            )}
          </aside>
        </div>
        {editing && (
          <div className="inline-editor settings-panel">
            <form className="room-form" onSubmit={saveEdit}>
              <h2>Edit request</h2>
              <label>
                Title
                <input
                  autoFocus
                  value={editing.title || ""}
                  onChange={(e) =>
                    setEditing({ ...editing, title: e.target.value })
                  }
                  maxLength={120}
                />
              </label>
              <label>
                Artist
                <input
                  value={editing.artist || ""}
                  onChange={(e) =>
                    setEditing({ ...editing, artist: e.target.value })
                  }
                  maxLength={120}
                />
              </label>
              <div className="row-actions">
                <button className="button button-primary" disabled={busy}>
                  Save
                </button>
                <button
                  type="button"
                  className="button button-quiet"
                  onClick={() => setEditing(null)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
