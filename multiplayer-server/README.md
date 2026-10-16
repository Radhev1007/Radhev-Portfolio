# RC Crawler — online multiplayer and voice

Up to 20 friends per room on any of the six terrains, with an optional voice channel. Single player is
unchanged: none of this code loads until someone opens **Multiplayer**.

```
browser (public/rc-crawler, static)          multiplayer-server (Node, this folder)        LiveKit (Cloud or self-hosted)
  game + physics + Colyseus client  ──wss──►  Colyseus rooms, lobby, validation,
                                               session clock, scores, voice tokens
  LiveKit client  ─────────────────────────────────────────── WebRTC audio ──────────►  voice rooms "rc-<CODE>"
  direct voice (no LiveKit) ◄── setup relayed by the game server ──► browser ◄── WebRTC audio, player to player
```

## Run it locally

```bash
cd multiplayer-server
npm install
npm run dev            # ws://localhost:2567 (health: http://localhost:2567/health)
```

Then in another terminal, from the repo root:

```bash
npm run dev            # portfolio on http://localhost:3000, game at /rc-crawler/index.html
```

On `localhost` the game finds the dev server by itself. Open the game in two different browsers (or one
normal and one private window) to play against yourself: **Multiplayer → Create room**, then **Join** with the
5-letter code in the other window.

Voice works without any setup: players connect directly to each other (see **Voice** below). For a LiveKit
voice server instead, put `LIVEKIT_URL`, `LIVEKIT_API_KEY` and `LIVEKIT_API_SECRET` in `multiplayer-server/.env`
(see `.env.example`). Either a free LiveKit Cloud project, or LiveKit's open-source server in dev mode
(`livekit-server --dev` → `ws://localhost:7880`, key `devkey`, secret `secret`).

## Configuration

| Where | Variable | Purpose |
| --- | --- | --- |
| server | `PORT`, `HOST` | listen address (default `0.0.0.0:2567`) |
| server | `ALLOWED_ORIGINS` | comma-separated page origins allowed to join (empty = any) |
| server | `MAX_PLAYERS` | players per room, 2–20 (default 20) |
| server | `RECONNECT_SECONDS` | how long a dropped player's seat is held (default 30) |
| server | `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_TOKEN_TTL` | LiveKit voice (optional); the secret stays on the server |
| server | `STUN_URLS` | direct voice: STUN servers, comma-separated (default Google's public STUN) |
| server | `TURN_URLS`, `TURN_USERNAME`, `TURN_CREDENTIAL` | direct voice: optional TURN relay for players behind strict NATs |
| portfolio build | `NEXT_PUBLIC_RC_MULTIPLAYER_URL` | `wss://…` URL of this server, passed to the game frame |

The game itself is static, so its server URL comes from the page: `?mp=wss://…` on the game URL (the portfolio
adds it from `NEXT_PUBLIC_RC_MULTIPLAYER_URL`), or `window.RC_CONFIG.multiplayerUrl`, or `ws://<host>:2567` on
localhost. The LiveKit URL is never configured in the browser: the server returns it with each voice token.

## Deploy

**Quickest path (Render + Vercel + LiveKit Cloud):**

1. Render → **New → Blueprint** → connect this GitHub repo. It reads `render.yaml` at the repo root, builds
   `multiplayer-server/Dockerfile`, and asks for `ALLOWED_ORIGINS` (your portfolio origin, e.g.
   `https://your-site.vercel.app`), `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` (from LiveKit
   Cloud → Settings → API Keys; leave them empty for direct voice). Deploy, then open
   `https://<service>.onrender.com/health`: `"voice": true` means LiveKit is configured.
2. Vercel → your portfolio project → Settings → Environment Variables →
   `NEXT_PUBLIC_RC_MULTIPLAYER_URL = wss://<service>.onrender.com` → redeploy.
3. Render's free plan sleeps after ~15 minutes without traffic; the first player then waits up to a minute for
   it to wake. A paid instance stays awake.

**Any other host:**

1. **Multiplayer server** — any host that keeps a Node process running and allows WebSockets (Render, Railway,
   Fly.io, a VPS). Vercel/Netlify static hosting and serverless functions cannot: they don't hold connections.
   Build from this folder's `Dockerfile` (or `npm ci --omit=dev && npm start`), set the variables above, and
   put it behind HTTPS so the game connects with `wss://`. Health check: `GET /health`.
   Rooms live in the server's memory: run **one instance** (a restart ends current rooms; players are told the
   connection was lost and keep driving solo). Scaling past one process needs Colyseus' Redis presence/driver.
2. **Voice** — nothing to do for direct voice. For LiveKit, create a LiveKit Cloud project (or self-host
   LiveKit) and copy its URL / API key / secret into the server's environment. Nothing is recorded either way:
   live audio only, no egress is configured.
3. **Portfolio** — set `NEXT_PUBLIC_RC_MULTIPLAYER_URL=wss://your-server` in the Vercel project and redeploy.
   Set the server's `ALLOWED_ORIGINS` to the portfolio's origin.
4. Invite links are the portfolio URL with `?rc=CODE`; they open the garage with the code filled in.

## How it works

**Rooms.** `create` makes a room whose id is a 5-character code (no 0/O/1/I); `joinById(code)` joins it.
Max 20 including the host (the 21st gets "That room is full"). The first player is host; if they leave, the
longest-standing connected player takes over. Each browser tab has a guest id (session storage); a second
tab with the same id is refused, and duplicate display names get a number. A dropped player keeps their seat
for 30 s and the game reconnects automatically (also across a page reload). Empty rooms are disposed.

**Movement (20 Hz, binary).** Each client simulates its own truck with the game's existing physics and sends
a 35-byte pose (position, orientation, velocity, steering, throttle, suspension, light/brake flags). The
server validates every update — finite values, inside the map, under 30 m/s, displacement per update within
what that speed allows, at most 40/s, sequence order — drops implausible ones, and after repeated rejections
sends the client back to its last valid pose. Accepted poses go out to everyone at 20 Hz in one snapshot
(36 bytes per truck: ~14 KB/s per client in a full room), each stamped with the time the server received it.
Recoveries are flagged moves; in scored sessions they are only accepted to the spawn area / starting grid or a
gate the player has reached.

**Remote trucks.** The same SCX30 model in the player's livery (without real headlight beams, which are costly
with 19 trucks around), drawn ~110 ms in the past and interpolated between snapshots, with ≤250 ms of dead
reckoning if a stream stalls and a cut (no slide) on recoveries. They never run physics locally.

**Authority — what is and isn't authoritative (stage 1).** The server is authoritative for membership, host,
ready state, the session clock (countdown, start, end), courses, gate/checkpoint progress (checked against the
player's last accepted position, in order, and no faster than 12 m/s along the course), timed runs (timed on
the server clock), stunt points (rate-capped), co-op progress, finish order and which breakable posts are down.
Vehicle physics is **not** simulated on the server: each truck's own browser simulates it and the server
validates the result. Truck-to-truck contact is resolved by each truck's owner against the other trucks
(upright colliders along each body, led along their velocity to where they are now): each truck gets exactly one
response, from its owner, so the two sides never apply contradictory responses to the same truck. Server-side
physics would need the level builder and vehicle solver running headless in Node — a possible stage 2.

**Shared obstacles.** Every client builds the same level from the same seed, so posts have stable ids. The
first client to snap a stake/sign reports it; the server records it in the room state (late joiners get it)
and everyone else knocks it down too. Posts stay down for the session.

**Modes** (host picks map, mode and course in the lobby; all optional, single-player challenges untouched):
Free Roam · Friends Race (full trail or any challenge, grid start, gates in order) · Timed Obstacle Challenge
(best clean run on an activity section in 4 min, retries allowed; uses the existing challenge rules) ·
Stunt & Drift (3 min of airtime and drift points) · Checkpoint Challenge (8 server-chosen checkpoints, any
order) · Co-op Off-Road (the team takes the gates together; anyone can take the next one).

**Voice.** The client asks the game server to join voice over its existing connection. Two transports:

- *LiveKit* (when its keys are set): one voice room per game room. The server mints a 15-minute token for that
  player's session id, scoped to `rc-<CODE>`, microphone-only, no data channel.
- *Direct* (no LiveKit keys, or the browser cannot reach LiveKit — then it stops trying for 10 minutes): every
  pair of players on direct voice gets its own WebRTC connection. The game server only relays the setup
  messages (offer, answer, ICE candidates) between two players who are both on direct voice, with size and rate
  limits; the audio goes browser to browser. Public STUN finds each player's address; players behind strict
  NATs or some mobile carriers need a TURN relay (`TURN_URLS`). Each player uploads one ~24 kbps stream per
  listener, so it suits small groups best. The lobby shows "· direct" and flags a player with no route.

The microphone is requested only when a player turns it on. Modes: muted, open mic, push-to-talk (default key
**T**, configurable; on-screen hold button in game). Speaker mute, per-player mute and volume, speaking and mic
indicators in the lobby and on name tags. Voice reconnects on its own and failing or leaving it never affects
driving.

## Tests

```bash
npm test                    # real server + real clients: rooms, codes, capacity 20, duplicates, movement
                            # validation, reconnection, host hand-over, race validation, voice token scope,
                            # direct-voice fallback and signalling relay
npm run bots -- CODE 18     # fill a room with 18 simulated drivers (load testing)
```

Browser tests used separate headless Chrome profiles as separate players (`?norender` on the game URL runs
the simulation and networking without drawing, for headless clients). Measured on an M3 Pro, real GPU, 19
remote trucks all in view near the camera: 62 fps on High (87 solo), 96 fps on Low (226 solo).

Voice was tested end to end against LiveKit server 1.13.10 (built from source, `--dev` mode) with two browser
players and a synthetic microphone signal: audio measured on the received track, speaking and mic indicators
(lobby and name tags), mute, push-to-talk (key and on-screen), speaker / per-player mute and volume, a camera
publish refused by the token, recovery from a dropped signal connection, leaving voice, and permission-denied
and no-microphone handling — 20/20 checks. The same checks pass on direct voice, both with no LiveKit keys and
with wrong keys against LiveKit Cloud (it falls back on its own), and a working LiveKit setup still uses LiveKit.

Not covered yet: LiveKit Cloud with valid keys (same protocol as the self-hosted server), mobile devices, and
direct voice between players on different networks (strict NATs need TURN).

## Files

- `src/index.js` HTTP + WebSocket entry · `src/RcRoom.js` rooms, validation, modes · `src/state.js` synced
  state · `src/voice.js` LiveKit tokens · `src/config.js` environment · `shared/codec.js` binary snapshots
- `scripts/vendor-client.mjs` copies the Colyseus / LiveKit browser builds and the codec into
  `public/rc-crawler/vendor/net/` (run `npm run vendor` after upgrading them) · `scripts/bots.mjs` load test
- Game side: `public/rc-crawler/src/net/` (connection, remote trucks, modes, `voice.js` voice controls and
  LiveKit, `p2pVoice.js` direct voice) and `src/ui/mpUI.js`
