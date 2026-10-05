import { useEffect, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  Check,
  ExternalLink,
  Radio,
  Shield,
  Users,
} from "lucide-react";
import { api, type Room, type Member } from "./api";
import { Header, Footer, ErrorNotice, useAccount } from "./ui";
import { ward } from "./auth";

export function ConnectApp({ code }: { code: string }) {
  const account = useAccount();
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const approve = async () => {
    setBusy(true);
    try {
      await api.connect(code);
      setStatus("Connected. You can return to Spectralis.");
    } catch (e) {
      setStatus((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="app">
      <Header account={account} />
      <main className="shell settings-page">
        <div className="section-label">
          <Shield size={14} /> APP CONNECTION
        </div>
        <h1>Bring your account along.</h1>
        <p>
          Connect the Spectralis app to your Ward account to host channels and
          manage your queues.
        </p>
        <div className="settings-panel">
          <p>
            Only approve this if you just clicked “Connect Ward” inside your
            Spectralis app.
          </p>
          <code className="connection-code">
            {code.slice(0, 8)} · {code.slice(8, 16)}
          </code>
          {status ? (
            <p role="status">{status}</p>
          ) : account.profile ? (
            <button
              className="button button-primary"
              disabled={busy}
              onClick={approve}
            >
              Connect as{" "}
              {account.profile.name || account.profile.preferred_username}
            </button>
          ) : (
            <button
              className="button button-primary"
              onClick={() => ward.signIn()}
            >
              Sign in with Ward
            </button>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}

export function MyRooms() {
  const account = useAccount();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    if (account.profile)
      void api
        .myRooms()
        .then((v) => setRooms(v.rooms))
        .catch((e) => setError(e.message));
  }, [account.profile?.sub]);
  return (
    <div className="app">
      <Header account={account} />
      <main className="shell settings-page">
        <a className="back-link" href="/">
          <ArrowLeft size={15} /> Directory
        </a>
        <h1>Your rooms</h1>
        <p>
          Permanent addresses for your channels and queues. Unlisted rooms stay
          out of search.
        </p>
        {error && <ErrorNotice message={error} />}{" "}
        {!account.profile ? (
          <button
            className="button button-primary"
            onClick={() => ward.signIn()}
          >
            Sign in with Ward
          </button>
        ) : (
          <div className="owned-rooms">
            {rooms.map((room) => (
              <a
                href={`/rooms/${room.id}/settings`}
                className="owned-room"
                key={room.id}
              >
                <Radio size={20} />
                <div>
                  <h2>{room.name}</h2>
                  <p>
                    {room.kind === "channel" ? "Channel" : "Streamer queue"} ·{" "}
                    {room.isPublic ? "Public" : "Unlisted"}
                  </p>
                </div>
                <ExternalLink size={17} />
              </a>
            ))}
            {rooms.length === 0 && (
              <p>
                No channels yet. Create one from the directory or the Spectralis
                app.
              </p>
            )}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}

export default function RoomSettings({ id }: { id: string }) {
  const account = useAccount();
  const [room, setRoom] = useState<Room | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [allowed, setAllowed] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tags, setTags] = useState("");
  useEffect(() => {
    if (!account.profile) return;
    let disposed = false;
    void Promise.all([api.room(id), api.access(id)])
      .then(([details, access]) => {
        if (disposed) return;
        setRoom(details);
        setTags(details.tags.join(", "));
        setAllowed(access.isOwner);
        if (!access.isOwner) setError("Only the host can change this room.");
      })
      .catch((e) => setError(e.message));
    return () => {
      disposed = true;
    };
  }, [id, account.profile?.sub]);
  useEffect(() => {
    if (!allowed) return;
    let done = false;
    const load = () =>
      void api
        .members(id)
        .then((v) => {
          if (!done) setMembers(v.members);
        })
        .catch((e) => {
          if (!done) setError(e.message);
        });
    load();
    const timer = setInterval(load, 5000);
    return () => {
      done = true;
      clearInterval(timer);
    };
  }, [id, allowed]);
  const update = (value: Partial<Room>) => {
    setRoom((r) => (r ? { ...r, ...value } : r));
    setSaved(false);
  };
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!room || busy) return;
    const selected = [
      ...new Set(
        tags
          .split(",")
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean),
      ),
    ];
    if (selected.length > 3) {
      setError("Choose up to three tags.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api.saveProfile(id, { ...room, tags: selected });
      setSaved(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const decide = async (member: Member, status: string) => {
    try {
      await api.decide(id, member.subject, status);
      setMembers((m) =>
        m.map((v) => (v.subject === member.subject ? { ...v, status } : v)),
      );
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <div className="app">
      <Header account={account} />
      <main className="shell settings-page">
        <a className="back-link" href={`/rooms/${id}`}>
          <ArrowLeft size={15} /> Back to room
        </a>
        <div className="section-label">THE HOST'S DESK</div>
        <h1>{room?.name || "Room settings"}</h1>
        {error && <ErrorNotice message={error} />}{" "}
        {!account.profile ? (
          <button
            className="button button-primary"
            onClick={() => ward.signIn()}
          >
            Sign in to manage this room
          </button>
        ) : (
          allowed &&
          room && (
            <div className="settings-layout">
              <form className="room-form settings-panel" onSubmit={save}>
                <h2>Room profile</h2>
                <label>
                  Name
                  <input
                    value={room.name}
                    required
                    maxLength={60}
                    onChange={(e) => update({ name: e.target.value })}
                  />
                </label>
                <label>
                  Description
                  <textarea
                    value={room.description || ""}
                    maxLength={280}
                    onChange={(e) => update({ description: e.target.value })}
                  />
                </label>
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={!!room.isPublic}
                    onChange={(e) => update({ isPublic: e.target.checked })}
                  />{" "}
                  Show in the public directory
                </label>
                <label>
                  Who can join
                  <select
                    value={room.security}
                    onChange={(e) =>
                      update({ security: e.target.value as Room["security"] })
                    }
                  >
                    <option value="anyone">Anyone with the link</option>
                    <option value="ward">Anyone signed in with Ward</option>
                    <option value="approval">Ward accounts I approve</option>
                  </select>
                </label>
                <label>
                  Tags
                  <input
                    value={tags}
                    onChange={(e) => {
                      setTags(e.target.value);
                      setSaved(false);
                    }}
                    placeholder="Up to three, separated by commas"
                  />
                </label>
                <div className="tag-templates">
                  {[
                    "all ages",
                    "18+",
                    "explicit",
                    "requests",
                    "ambient",
                    "live",
                  ].map((tag) => (
                    <button
                      type="button"
                      key={tag}
                      className="tag"
                      onClick={() => {
                        const selected = tags
                          .split(",")
                          .map((t) => t.trim())
                          .filter(Boolean);
                        if (!selected.includes(tag) && selected.length < 3)
                          setTags([...selected, tag].join(", "));
                      }}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
                <h2>Artwork</h2>
                <p className="field-help">
                  Upload PNG, JPEG or WebP images up to 5 MB, or use HTTPS URLs.
                  Your banner is also the default social preview.
                </p>
                {(["bannerUrl", "iconUrl", "ogImageUrl"] as const).map(
                  (key, index) => (
                    <label key={key}>
                      {["Banner", "Room icon", "Social preview image"][index]}
                      <input
                        type="url"
                        value={room[key] || ""}
                        onChange={(e) => update({ [key]: e.target.value })}
                        placeholder="https://…"
                      />
                      <input type="file" aria-label={`Upload ${["banner","icon","social preview"][index]}`} accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={async(event)=>{const file=event.target.files?.[0];if(!file)return;if(file.size>5*1024*1024){setError('Room images must be under 5 MB.');return;}setBusy(true);try{const result=await api.uploadImage(id,["banner","icon","social"][index],file);update({[key]:result.url});}catch(error){setError((error as Error).message)}finally{setBusy(false)}}}/>
                    </label>
                  ),
                )}
                {room.bannerUrl && (
                  <img
                    className="profile-preview"
                    src={room.bannerUrl}
                    alt="Banner preview"
                    referrerPolicy="no-referrer"
                  />
                )}
                <details>
                  <summary>Search & social cards</summary>
                  <label>
                    Page title
                    <input
                      value={room.seoTitle || ""}
                      maxLength={70}
                      onChange={(e) => update({ seoTitle: e.target.value })}
                    />
                  </label>
                  <label>
                    Search description
                    <textarea
                      value={room.seoDescription || ""}
                      maxLength={160}
                      onChange={(e) =>
                        update({ seoDescription: e.target.value })
                      }
                    />
                  </label>
                </details>
                <button className="button button-primary" disabled={busy}>
                  {saved ? (
                    <>
                      <Check size={16} /> Saved
                    </>
                  ) : busy ? (
                    "Saving…"
                  ) : (
                    "Save room"
                  )}
                </button>
              </form>
              <aside className="settings-panel admission-panel">
                <div className="section-label">
                  <Users size={14} /> ADMISSION
                </div>
                <h2>At the door</h2>
                <p className="field-help">
                  Approvals belong to this room and survive between sessions.
                  Deny an account to revoke access.
                </p>
                {members.length === 0 && <p>No admission requests.</p>}
                {members.map((member) => (
                  <div className="member-row" key={member.subject}>
                    <strong>
                      {member.name || member.username || "Ward listener"}
                    </strong>
                    <span>{member.status}</span>
                    <div className="row-actions">
                      <button
                        className="button button-quiet"
                        disabled={member.status === "allowed"}
                        onClick={() => decide(member, "allowed")}
                      >
                        Allow
                      </button>
                      <button
                        className="button button-quiet"
                        disabled={member.status === "denied"}
                        onClick={() => decide(member, "denied")}
                      >
                        Deny
                      </button>
                    </div>
                  </div>
                ))}
              </aside>
            </div>
          )
        )}
      </main>
      <Footer />
    </div>
  );
}
