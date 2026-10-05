import { ward } from "./auth";

export const base = (
  import.meta.env.VITE_PLAYER_API ??
  "https://spectralis-api.deltavdevs.com"
).replace(/\/$/, "");

export type Room = {
  id: string;
  name: string;
  description?: string;
  kind: "channel" | "streamer_queue";
  tags: string[];
  security: "anyone" | "ward" | "approval";
  listeners: number;
  host: string;
  joinUrl?: string;
  roomCode?: string | null;
  isLive?: boolean;
  isPublic?: boolean;
  streamerQueueId?: string | null;
  ogImageUrl?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  artwork?: string;
  bannerUrl?: string | null;
  iconUrl?: string | null;
  nowPlaying?: { title: string; artist?: string; artwork?: string };
};

export async function request<T>(path: string, init: RequestInit = {}) {
  const token = ward.token();
  const response = await fetch(`${base}${path}`, {
    signal: AbortSignal.timeout(15_000),
    ...init,
    headers: {
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(
      body?.message ||
        body?.error ||
        `Could not reach the player service (${response.status}).`,
    );
  }
  return response.json() as Promise<T>;
}

export const api = {
  uploadImage: (id: string, kind: string, file: File) =>
    request<{ url: string }>(
      `/player/v1/rooms/${encodeURIComponent(id)}/images/${kind}`,
      { method: "PUT", headers: { "Content-Type": file.type }, body: file },
    ),
  access: (id: string) =>
    request<{ status: string; isOwner: boolean }>(
      `/player/v1/rooms/${encodeURIComponent(id)}/access`,
    ),
  requestAccess: (id: string) =>
    request(`/player/v1/rooms/${encodeURIComponent(id)}/access`, {
      method: "POST",
    }),
  myRooms: () => request<{ rooms: Room[] }>("/player/v1/me/rooms"),
  // An account has at most one permanent room; null until it makes one.
  myRoom: () => request<{ room: Room | null }>("/player/v1/me/room"),
  saveProfile: (id: string, profile: Partial<Room>) =>
    jsonRequest(
      `/player/v1/rooms/${encodeURIComponent(id)}/profile`,
      "PUT",
      profile,
    ),
  members: (id: string) =>
    request<{ members: Member[] }>(
      `/player/v1/rooms/${encodeURIComponent(id)}/members`,
    ),
  decide: (id: string, subject: string, status: string) =>
    jsonRequest(
      `/player/v1/rooms/${encodeURIComponent(id)}/members/${encodeURIComponent(subject)}`,
      "PUT",
      { status },
    ),
  host: (id: string) =>
    request<{ ownerToken: string }>(
      `/player/v1/rooms/${encodeURIComponent(id)}/host`,
    ),
  connect: (code: string) =>
    request(`/player/v1/connect/${encodeURIComponent(code)}/approve`, {
      method: "POST",
    }),
  streamerRoom: (id: string, ownerToken?: string) =>
    request<StreamerRoom>(
      `/streamer-queue/v1/rooms/${encodeURIComponent(id)}${ownerToken ? `?ownerToken=${encodeURIComponent(ownerToken)}` : ""}`,
    ),
  submitStreamer: (id: string, submission: object) =>
    jsonRequest<QueueSubmission>(
      `/streamer-queue/v1/rooms/${encodeURIComponent(id)}/submit`,
      "POST",
      submission,
    ),
  editStreamer: (id: string, sid: string, submission: object) =>
    jsonRequest(
      `/streamer-queue/v1/rooms/${encodeURIComponent(id)}/submissions/${encodeURIComponent(sid)}`,
      "PATCH",
      submission,
    ),
  promoteStreamer: (id: string, sid: string, submission: object) =>
    jsonRequest<QueueSubmission>(
      `/streamer-queue/v1/rooms/${encodeURIComponent(id)}/submissions/${encodeURIComponent(sid)}/promote`,
      "POST",
      submission,
    ),
  streamerAction: (
    id: string,
    sid: string,
    action: string,
    ownerToken: string,
  ) =>
    jsonRequest(
      `/streamer-queue/v1/rooms/${encodeURIComponent(id)}/submissions/${encodeURIComponent(sid)}/${action}`,
      "POST",
      { ownerToken },
    ),
  streamerSettings: (id: string, settings: object) =>
    jsonRequest(
      `/streamer-queue/v1/rooms/${encodeURIComponent(id)}/settings`,
      "PUT",
      settings,
    ),
  createStreamer: () =>
    request<{ roomId: string; ownerToken: string }>(
      "/streamer-queue/v1/rooms",
      { method: "POST" },
    ),
  browse: () => request<{ rooms: Room[] }>("/player/v1/rooms"),
  room: (id: string) =>
    request<Room>(`/player/v1/rooms/${encodeURIComponent(id)}`),
  channel: (id: string) =>
    request<{ isLive: boolean; roomCode?: string | null }>(
      `/shared-play/v2/channels/${encodeURIComponent(id)}`,
    ),
  session: async (code: string) => {
    const result = await request<{ session: Session }>(
      `/shared-play/v2/sessions/${encodeURIComponent(code)}`,
    );
    return result.session;
  },
  queue: (code: string) =>
    request<{ items: QueueItem[]; currentIndex: number }>(
      `/shared-play/v2/sessions/${encodeURIComponent(code)}/queue`,
    ),
  presence: (code: string, clientId: string, displayName: string) =>
    request<{ listenerCount: number }>(
      `/shared-play/v2/sessions/${encodeURIComponent(code)}/presence`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, displayName }),
      },
    ),
  addQueueLink: (code: string, url: string) =>
    request(
      `/shared-play/v2/sessions/${encodeURIComponent(code)}/queue/items`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item: { url, title: url, sourceKind: "url" } }),
      },
    ),
  sharedQueue: (code: string) =>
    request<SharedQueue>(
      `/shared-play/v2/sessions/${encodeURIComponent(code)}/streamer-queue`,
    ),
  submitSharedQueue: (
    code: string,
    submission: {
      url: string;
      title?: string;
      artist?: string;
      displayName?: string;
    },
  ) =>
    request<QueueSubmission>(
      `/shared-play/v2/sessions/${encodeURIComponent(code)}/streamer-queue/submit`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submission),
      },
    ),
  createRoom: (
    room: Pick<
      Room,
      "name" | "description" | "kind" | "tags" | "security" | "isPublic"
    >,
  ) =>
    request<Room>("/player/v1/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(room),
    }),
};

export type QueueItem = {
  id: string;
  title?: string | null;
  displayName?: string;
  artist?: string | null;
  url?: string;
  artworkUrl?: string;
  durationSeconds?: number;
  status?: string;
  sourceKind?: string;
  isMine?: boolean;
  canEdit?: boolean;
  tier?: string;
};
export type Member = {
  subject: string;
  name?: string;
  username?: string;
  status: string;
};
export type StreamerRoom = {
  roomId: string;
  enabled: boolean;
  acceptingSubmissions?: boolean;
  nowPlayingId?: string;
  nowPlayingTitle?: string;
  nowPlayingArtist?: string;
  orderedQueue?: QueueItem[];
  submissions?: QueueItem[];
  mySubmissions?: QueueItem[];
  stripePublishableKey?: string;
  settings?: Record<string, any>;
  queueChannels?: { id: string; name: string }[];
};
function jsonRequest<T = unknown>(path: string, method: string, body: object) {
  return request<T>(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
export type SharedQueue = {
  stripePublishableKey?:string
  enabled: boolean;
  acceptingSubmissions?: boolean;
  submissions?: QueueItem[];
  settings?: {
    requireApproval?: boolean;
    queueEntryFee?: { enabled?: boolean; amount?: number };
  };
};
export type QueueSubmission = {
  submissionId: string;
  status: string;
  position?: number | null;
  clientSecret?: string;
};

export type Playback = {
  isPlaying: boolean;
  positionSeconds: number;
  durationSeconds?: number;
  hostClockUtc?: string;
};
export type Session = {
  roomCode: string;
  trackId?: string;
  packageUrl?: string;
  browserAudioUrl?: string;
  albumArtUrl?: string;
  playback?: Playback;
  track?: {
    displayName?: string;
    title?: string;
    artist?: string;
    album?: string;
    durationSeconds?: number;
    artworkUrl?: string;
    lyrics?: { timeSeconds?: number; startSeconds?: number; text: string }[];
  };
};
