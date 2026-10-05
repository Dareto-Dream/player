import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import express from "express";
import { roomImage } from "./social.mjs";

const app = express();
const port = Number(process.env.PORT ?? 3000);
const apiBase = (
  process.env.PLAYER_API ?? "https://spectralis-api.deltavdevs.com"
).replace(/\/$/, "");
const siteUrl = (
  process.env.PLAYER_URL ?? "https://player.deltavdevs.com"
).replace(/\/$/, "");
const wardIssuer = (
  process.env.WARD_ISSUER ?? "https://ward.deltavdevs.com"
).replace(/\/$/, "");
const wardClientId = process.env.WARD_CLIENT_ID;
const wardClientSecret = process.env.WARD_CLIENT_SECRET;
const html = await readFile(resolve("dist/index.html"), "utf8");
const pendingAuth = new Map();

const escape = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
const metadata = (room) => {
  const name = room.name || "Rooms";
  const title = room.seoTitle || `${name} · Spectralis Player`;
  const description =
    room.seoDescription ||
    room.description ||
    `Join ${name} on Spectralis Player.`;
  const image =
    room.ogImageUrl ||
    room.bannerUrl ||
    (room.id
      ? `${siteUrl}/rooms/${encodeURIComponent(room.id)}/og.png`
      : `${siteUrl}/og-default.png`);
  return { title, description, image };
};

async function roomFor(id) {
  const response = await fetch(
    `${apiBase}/player/v1/rooms/${encodeURIComponent(id)}`,
    {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(5000),
    },
  );
  return response.ok ? response.json() : null;
}

function documentFor(room, canonical) {
  const { title, description, image } = metadata(room ?? {});
  const tags = [
    `<title>${escape(title)}</title>`,
    `<meta name="description" content="${escape(description)}">`,
    `<link rel="canonical" href="${escape(canonical)}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="Spectralis Player">`,
    `<meta property="og:title" content="${escape(title)}">`,
    `<meta property="og:description" content="${escape(description)}">`,
    `<meta property="og:url" content="${escape(canonical)}">`,
    `<meta property="og:image" content="${escape(image)}">`,
    `<meta property="og:image:alt" content="${escape(room?.name || "Spectralis Player")}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${escape(title)}">`,
    `<meta name="twitter:description" content="${escape(description)}">`,
    `<meta name="twitter:image" content="${escape(image)}">`,
    `<meta name="twitter:image:alt" content="${escape(room?.name || "Spectralis Player")}">`,
    ...(room?.iconUrl
      ? [
          `<link rel="icon" href="${escape(room.iconUrl)}">`,
          `<link rel="apple-touch-icon" href="${escape(room.iconUrl)}">`,
        ]
      : []),
  ].join("");
  return html
    .replace(/<title>.*?<\/title>/s, "")
    .replace(/<meta name="description"[^>]*>/, "")
    .replace("</head>", `${tags}</head>`);
}

const base64Url = (value) => Buffer.from(value).toString("base64url");
const pkceChallenge = (verifier) =>
  createHash("sha256").update(verifier).digest("base64url");

app.get("/auth/login", (request, response) => {
  if (!wardClientId || !wardClientSecret)
    return response.status(503).send("Ward sign-in is not configured yet.");
  const state = randomUUID();
  const verifier = base64Url(randomBytes(48));
  const requestedReturn =
    typeof request.query.returnTo === "string" ? request.query.returnTo : "/";
  const returnTo =
    /^(?:\/my|\/(?:rooms|sessions|queues|connect)\/[a-zA-Z0-9_-]+(?:\/settings)?)\/?$/.test(
      requestedReturn,
    )
      ? requestedReturn
      : "/";
  pendingAuth.set(state, { verifier, returnTo, createdAt: Date.now() });
  response.cookie("player_oauth_state", state, {
    httpOnly: true,
    secure: siteUrl.startsWith("https:"),
    sameSite: "lax",
    maxAge: 600_000,
    path: "/auth",
  });
  for (const [key, pending] of pendingAuth)
    if (Date.now() - pending.createdAt > 10 * 60_000) pendingAuth.delete(key);
  const query = new URLSearchParams({
    client_id: wardClientId,
    redirect_uri: `${siteUrl}/auth/callback`,
    response_type: "code",
    scope: "openid profile",
    state,
    nonce: randomUUID(),
    code_challenge: pkceChallenge(verifier),
    code_challenge_method: "S256",
  });
  response.redirect(`${wardIssuer}/oauth/authorize?${query}`);
});

app.get("/auth/callback", async (request, response) => {
  const code = typeof request.query.code === "string" ? request.query.code : "";
  const state =
    typeof request.query.state === "string" ? request.query.state : "";
  const pending = pendingAuth.get(state);
  pendingAuth.delete(state);
  const cookieState = request.headers.cookie
    ?.split(";")
    .map((v) => v.trim())
    .find((v) => v.startsWith("player_oauth_state="))
    ?.slice("player_oauth_state=".length);
  response.clearCookie("player_oauth_state", { path: "/auth" });
  if (
    !code ||
    !pending ||
    cookieState !== state ||
    Date.now() - pending.createdAt > 600_000
  )
    return response
      .status(400)
      .send("Ward sign-in could not be verified. Start again from the player.");
  try {
    const tokenResponse = await fetch(`${wardIssuer}/oauth/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${wardClientId}:${wardClientSecret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: `${siteUrl}/auth/callback`,
        code_verifier: pending.verifier,
      }),
    });
    const token = await tokenResponse.json();
    if (!tokenResponse.ok || !token.access_token)
      throw new Error("Ward did not issue an access token.");
    response.redirect(
      `${pending.returnTo}#ward_access_token=${encodeURIComponent(token.access_token)}`,
    );
  } catch (error) {
    console.error(
      "Ward callback failed:",
      error instanceof Error ? error.message : error,
    );
    response.status(502).send("Ward sign-in failed. Please try again.");
  }
});

app.use(
  "/assets",
  express.static(resolve("dist/assets"), { immutable: true, maxAge: "1y" }),
);
app.get("/favicon.svg", (_request, response) =>
  response.sendFile(resolve("dist/favicon.svg")),
);
app.get("/og-default.png", (_request, response) =>
  response.sendFile(resolve("dist/og-default.png")),
);
app.get("/sessions/:id", (request, response) => {
  response
    .set("X-Robots-Tag", "noindex, nofollow")
    .type("html")
    .send(
      documentFor(
        {
          name: "Private Shared Play",
          description: "An invite-only listening session.",
        },
        `${siteUrl}/sessions/${encodeURIComponent(request.params.id)}`,
      ),
    );
});
app.get("/rooms/:id", async (request, response) => {
  const room = await roomFor(request.params.id).catch(() => null);
  if (!room?.isPublic) response.set("X-Robots-Tag", "noindex, nofollow");
  response
    .type("html")
    .send(
      documentFor(
        room,
        `${siteUrl}/rooms/${encodeURIComponent(request.params.id)}`,
      ),
    );
});
app.get("/rooms/:id/og.png", async (request, response) => {
  try {
    const room = await roomFor(request.params.id);
    if (!room) return response.sendStatus(404);
    response
      .set("Cache-Control", room.isPublic ? "public, max-age=60" : "no-store")
      .type("png")
      .send(await roomImage(room));
  } catch {
    response.sendStatus(503);
  }
});
app.get(
  ["/connect/:id", "/rooms/:id/settings", "/queues/:id", "/my"],
  (_request, response) =>
    response
      .set("X-Robots-Tag", "noindex, nofollow")
      .type("html")
      .send(documentFor(null, siteUrl)),
);
app.get("*", (_request, response) =>
  response.type("html").send(documentFor(null, siteUrl)),
);
app.listen(port, "0.0.0.0", () =>
  console.log(`Spectralis Player listening on ${port}`),
);
