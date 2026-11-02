# RC Crawler Open World, Stage 1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Trailhead Valley hub that the game starts in, gateways that travel between the hub and the six terrains (gradually unlocked by medals), and challenges started by driving into rings in the world.

**Architecture:** The hub is one more level definition run through the existing `buildLevel` pipeline. Three new focused modules sit beside `main.js`: `world/progress.js` (pure medal and unlock maths), `world/gateways.js` (arches, barriers, crossing, travel requests) and `world/challengeRings.js` (rings, beacons, proximity). `main.js` wires them in and travels with the existing `loadLevel`. Physics and challenge rules are unchanged.

**Tech Stack:** Plain ES modules, Three.js r160 (vendored at `public/rc-crawler/vendor/three`), Node 22 built-in `node:test` for headless tests.

**Spec:** `docs/superpowers/specs/2026-11-02-rc-crawler-open-world-design.md`

All paths below are relative to `public/rc-crawler/` unless they start with `tools/` or `docs/` (repo root).

## Global Constraints

- Unlock thresholds (total medals): `hub 0, desert 0, forest 0, mud 3, canyon 6, creek 10, ultimate 15`.
- A medal counts once per challenge, any colour; source is localStorage `rccrawler.best.v1`, keys `<levelId>:<challengeId>#medal`.
- Hub: id `hub`, name `Trailhead Valley`, size `160`, heightfield cell stays `0.1`.
- Ring colours by tier: Beginner `0x3ccf6e`, Intermediate `0xf5a623`, Expert `0xe5484d`.
- Start key: `E`; touch button id `b-ring`.
- The hub menu action is labelled **BACK TO BASECAMP** (the existing "RETURN TO TRAILHEAD" button restarts the current terrain and keeps its meaning).
- `?level=<id>` opens that level directly and bypasses locks.
- In a multiplayer room gateways never travel.
- Tests live in `tools/rc-crawler-tests/` (never under `public/`, which is deployed).

## Review Focus

1. **Terrain picker bypassing locks** — the title cards and the menu's Terrain tab must show locked terrains as locked and refuse them (Task 5).
2. **Backing out of a gateway** — reversing or sliding back through an arch must not travel (Task 3).
3. **Travel during a running challenge or a load** — cancel the challenge; ignore a second request while loading (Task 5).
4. **A medal that crosses a threshold while in the hub** — the barrier must open at once, without a reload (Task 5).
5. **No localStorage** (private mode) — progress works for the session; nothing throws (Task 1).

---

### Task 1: Headless test runner and `world/progress.js`

**Files:**
- Create: `tools/rc-crawler-tests/register.mjs` (Node resolve hook: `three` → `public/rc-crawler/vendor/three/build/three.module.js`, `three/addons/*` → `public/rc-crawler/vendor/three/examples/jsm/*`)
- Create: `tools/rc-crawler-tests/progress.test.mjs`
- Create: `src/world/progress.js`
- Modify: `package.json` (repo root) — script `"test:game": "node --import ./tools/rc-crawler-tests/register.mjs --test tools/rc-crawler-tests/"`

**Interfaces:**
- Produces:
  - `export const UNLOCKS: Record<string, number>` (values from Global Constraints)
  - `export function countMedals(best: object): number`
  - `export function medalsIn(best: object, levelId: string): number`
  - `export function needFor(levelId: string): number` (unknown ids → 0)
  - `export function isUnlocked(levelId: string, best: object): boolean`
  - `export function newlyUnlocked(before: object, after: object): string[]` (level ids that are unlocked in `after` but not `before`)
  - `export function recordAvailable(levelId: string, n: number, store = globalThis.localStorage): void` and `export function availableIn(levelId: string, store = globalThis.localStorage): number | null` (key `rccrawler.available.v1`; the number of challenges a level offers, cached the first time it is built, so signs can say "4 / 10")

- [ ] **Step 1: Write the failing tests** in `progress.test.mjs`:
  - `countMedals({ 'hub:a#medal': 'gold', 'hub:a': 31, 'desert:b#medal': 'bronze', 'desert:c#medal': null })` → `2`
  - `medalsIn(same, 'desert')` → `1`
  - `isUnlocked('mud', best with 2 medals)` → `false`; with 3 → `true`; `isUnlocked('forest', {})` → `true`; `isUnlocked('ultimate', 14 medals)` → `false`
  - `newlyUnlocked(5 medals, 6 medals)` → `['canyon']`; `newlyUnlocked(2, 10)` → `['mud', 'canyon', 'creek']`
  - `recordAvailable('canyon', 10, fakeStore)` then `availableIn('canyon', fakeStore)` → `10`; `availableIn('mud', fakeStore)` → `null`
  - A store whose `getItem`/`setItem` throw: `recordAvailable` does not throw and `availableIn` returns `null`
- [ ] **Step 2: Run** `npm run test:game` — expect FAIL (module not found).
- [ ] **Step 3: Implement `register.mjs` and `src/world/progress.js`.** No imports in `progress.js`; every storage access is in try/catch.
- [ ] **Step 4: Run** `npm run test:game` — expect all `progress` tests PASS.
- [ ] **Step 5: Commit** `feat(rc-crawler): medal progress and unlock rules`.

### Task 2: Trailhead Valley level

**Files:**
- Create: `src/levels/hub.js`
- Modify: `src/levels/levels.js` (import `hub`; `LEVELS = [hub, rockyCanyon, …]`)
- Modify: `src/levels/activities.js` (`PROGRAMME.hub`)
- Modify: `src/levels/levelBuilder.js` (export `LevelContext`; pass `layout.gateways` and `layout.arrivals` through on the returned level)
- Test: `tools/rc-crawler-tests/hub.test.mjs`

**Interfaces:**
- Consumes: `LevelContext` helpers (`path`, `distanceField`, `fill`, `edgeWalls`, `carvePath`, `paintLayerAt`, `hill`, `obstacle`, `forEachNear`, `scatter`, `rocks.add`) exactly as `levels.js` uses them.
- Produces: `export const hub` — a level def (`id: 'hub'`, `name: 'Trailhead Valley'`, `size: 160`, `biome: 'forest'`, `seed: 7`, `stars: 1`, `difficulty: 'Easy'`) whose `build(ctx)` returns
  `{ spawn: {x,z,yaw}, path: TrailPath, challenges: [], basecamp: {x, z, r: 9}, gateways: Gateway[], arrivals: Record<levelId, {x,z,yaw}> }`
  where `Gateway = { id: string, to: levelId, x, z, yaw, width: 3.2 }`, `yaw` pointing outward (the direction you drive to leave). The returned level object gains `level.gateways` and `level.arrivals` (empty for other levels until Task 4).

Layout decisions: basecamp at (0, 0), levelled flat, radius 9. `path` is a ring trail of radius 18 round basecamp (the activities attach to it). Six spokes at bearings 0°, 60°, … 300°, carved from radius 9 to radius 68, in the order desert, forest, mud, canyon, creek, ultimate. Each spoke's outer 40 % takes its destination's surface layer and scatter (sand + small rocks, pines, mud pits, boulders, a shallow stream crossing, mixed). The gateway pad is at radius 70, levelled over 3 m; the arrival pose is at radius 64 facing basecamp. Spawn at basecamp facing the desert spoke. Basecamp props (simple Three.js meshes added to `ctx` the way activities add their geometry): a tent at (−5, −4), a 4 m flagpole at (5, −4), and a progress board at (0, −7) facing the spawn, whose canvas texture Task 7 fills; the tent and flagpole are registered as posts so the truck can't drive through them. `PROGRAMME.hub = [['slalom', 0], ['rockCrawl', 0], ['jump', 0], ['logPile', 1], ['slopes', 1]]`.

- [ ] **Step 1: Write the failing tests** in `hub.test.mjs` (build with `new LevelContext(hub, 'low')` and `hub.build(ctx)`; stub `document.createElement('canvas')` only if the constructor needs it):
  - `gateways.length === 6` and their `to` values are exactly `['desert','forest','mud','canyon','creek','ultimate']`
  - each gateway pad: max |height − pad height| within 1.6 m of the gateway ≤ `0.12`
  - each spoke, sampled every 0.5 m from basecamp edge to its gateway: grade ≤ `0.45` (rise / run between samples)
  - each arrival is ≥ 5 m inside its gateway and its `yaw` points within 10° of basecamp
  - basecamp: max height spread within radius 8 ≤ `0.15`
- [ ] **Step 2: Run** `npm run test:game` — expect FAIL.
- [ ] **Step 3: Implement `hub.js`, register it, add the programme, export `LevelContext`.**
- [ ] **Step 4: Run** `npm run test:game` — expect PASS, and the existing six levels still load in the browser (open `/rc-crawler/index.html?level=canyon`, no console errors).
- [ ] **Step 5: Commit** `feat(rc-crawler): Trailhead Valley hub level`.

### Task 3: Gateway crossing logic and return gateways

**Files:**
- Create: `src/world/gateways.js` (logic part only in this task)
- Modify: `src/levels/levelBuilder.js` — for every level except `hub`, add one return gateway via `placeReturnGateway`
- Test: `tools/rc-crawler-tests/gateways.test.mjs`

**Interfaces:**
- Consumes: `Gateway` shape from Task 2; `Heightfield` (`terrain/heightfield.js`).
- Produces:
  - `export function crossedGateway(g: Gateway, prev: {x,z}, cur: {x,z}, fwdSpeed: number, upY: number): boolean` — true only when the segment prev→cur crosses the gateway line in the outward direction, within `width / 2` laterally, with `fwdSpeed > 0.2` along `g.yaw` and `upY > 0.6`
  - `export function placeReturnGateway(ctx: LevelContext, spawn: {x,z,yaw}): { gateway: Gateway, arrival: {x,z,yaw} }` — gateway 4 m behind the spawn (`yaw = spawn.yaw + π`, `to: 'hub'`, `id: 'return'`), pad levelled to the spawn height over 2.5 m with a smoothstep edge; arrival = the spawn
  - The hub's `arrivals[levelId]` is where you land when coming back from `levelId`.

- [ ] **Step 1: Write the failing tests:**
  - driving forward through the line at 1 m/s, upright → `true`
  - the same segment reversed (cur→prev) → `false`
  - crossing 1.7 m off centre with `width: 3.2` → `false`
  - crossing with `upY: 0.3` (on its side) → `false`
  - crossing with `fwdSpeed: -1` (reversing out, rear first) → `false`
  - `placeReturnGateway` on a sloped synthetic Heightfield: gateway is 4 m behind the spawn ±0.05, `yaw` = spawn yaw + π, pad spread within 1.6 m ≤ 0.05
- [ ] **Step 2: Run** `npm run test:game` — expect FAIL.
- [ ] **Step 3: Implement** `crossedGateway` and `placeReturnGateway`, and call the latter in `buildLevel` (after `buildActivities`, so the activities' trail guard is unaffected), setting `level.gateways = [gateway]` and `level.arrivals = {}`.
- [ ] **Step 4: Run** `npm run test:game` — expect PASS.
- [ ] **Step 5: Commit** `feat(rc-crawler): gateway crossing and return gateways`.

### Task 4: Gateway arches in the scene

**Files:**
- Modify: `src/world/gateways.js` (scene part)

**Interfaces:**
- Consumes: `crossedGateway`, `isUnlocked`, `needFor`, `medalsIn`, `availableIn`.
- Produces: `export function buildGateways(level, best: object): { group: THREE.Group, posts: Post[], update(prev, cur, phys): Gateway | null, refresh(best: object): void }`
  - Arch: two 0.12 m-square posts 2.4 m tall at ±`width/2`, a beam across the top, and a sign panel (canvas texture) reading the terrain name, difficulty stars and "medals 4 / 10" (or "4 / —" when `availableIn` is null). The return gateway's sign reads "Trailhead Valley".
  - Locked: a barrier of five steel posts (the shape `phys.posts` uses: `{x, z, r: 0.06, y0, top, mat: 'steel', kind: 'gate', enabled: true}`) across the arch, and the sign's second line "Earn N medals · you have M". `posts` returns them so `main.js` adds them to `level.posts` before physics starts.
  - `update` returns the gateway that was crossed (open ones only), or, for a locked one, `null` and sets `lastBlocked` to it (for the toast).
  - `refresh` redraws signs and sets each barrier post's `enabled` from `isUnlocked` (Review Focus 4).

- [ ] **Step 1:** Implement; verify in the browser on `?level=hub` (desktop): six arches visible, signs legible from 6 m, Desert and Forest open, the others barred.
- [ ] **Step 2:** Drive into a barred arch: the truck stops against the barrier (real collision), no travel.
- [ ] **Step 3: Commit** `feat(rc-crawler): gateway arches, signs and barriers`.

### Task 5: Travel, start in the hub, and locked terrain cards

**Files:**
- Modify: `src/main.js`, `src/ui/ui.js`, `index.html`

**Interfaces:**
- Consumes: Task 4's `buildGateways`, Task 1's progress functions, `loadLevel`, `challenges`.
- Produces: `loadLevel(id, { keepState, arriveAt })` — `arriveAt` is a level id; on the hub it spawns at `level.arrivals[arriveAt]`, elsewhere at the level's spawn. `travel(to: string)` in `main.js`.

Decisions:
- Boot: load `hub` unless `?level=` is given (`settings.level` no longer decides the start).
- `travel(to)`: if `mp.active` → toast "<room terrain> room" "Gateways are closed in multiplayer" and return; if a load is in progress → return; if a challenge is running → `challenges.select(null)` first; then `loadLevel(to, { arriveAt: level.def.id })`. The existing loading screen ("Loading <name>") is the fade.
- After each load: `recordAvailable(level.def.id, level.challenges.length)`; build gateways and add their posts to `level.posts` before `phys.posts = level.posts`.
- Each frame in `play`: call `gateways.update(prev, cur, phys)`; a returned gateway → `travel(g.to)`; `lastBlocked` → toast "Earn N medals" "You have M" (at most once every 3 s).
- On a challenge `finish` with a medal: compare `newlyUnlocked(before, after)`; toast "<name> unlocked" for each and call `gateways.refresh(best)`.
- Pause menu: a new button **BACK TO BASECAMP** (`#m-hub`, hidden on the hub) → `travel('hub')`.
- Title cards and the menu's Terrain tab: locked cards get class `locked` and a line "Earn N medals"; picking one toasts the same text instead of loading (unless `?level=` named it).

- [ ] **Step 1:** Implement.
- [ ] **Step 2: Browser check (desktop):** fresh profile (clear localStorage) → the game starts at basecamp; drive through the Desert arch → Desert loads at its start; drive through its return arch → back in the hub at the Desert arrival, facing basecamp.
- [ ] **Step 3: Browser check:** a locked card in the title and the Terrain tab refuses with the toast; `?level=canyon` still opens the canyon; with a running challenge, BACK TO BASECAMP cancels it and travels; double-clicking travel loads once.
- [ ] **Step 4: Browser check:** set `rccrawler.best.v1` to 5 medals, finish one more challenge in the hub → toast "Rocky Canyon unlocked" and the canyon barrier disappears without a reload.
- [ ] **Step 5: Commit** `feat(rc-crawler): travel between the hub and terrains`.

### Task 6: Challenge rings and the start prompt

**Files:**
- Create: `src/world/challengeRings.js`
- Modify: `src/main.js`, `src/ui/ui.js`, `index.html`, `styles.css`
- Test: `tools/rc-crawler-tests/rings.test.mjs`

**Interfaces:**
- Consumes: `level.challenges` (each `{ id, name, tier: 'Beginner'|'Intermediate'|'Expert', gates: [{x, z, yaw, width}, …] }`), `challenges.medalOf(c)`, `challenges.bestFor(c)`.
- Produces:
  - `export function ringFor(c): { id, x, z, r, tier }` with `r = max(1.6, gates[0].width / 2 + 0.4)`
  - `export function nearestRing(rings, x, z): Ring | null` — the closest ring containing (x, z)
  - `export function buildRings(level, challenges): { group, rings, update(dt, phys): Ring | null, refresh(): void }` — a flat ring (tier colour, emissive), a 6 m translucent beacon column, a medal disc above it once earned; dimmed to 25 % opacity while any challenge is armed or running

- [ ] **Step 1: Write the failing tests:** `ringFor` with gate width 2 → r `1.6`; width 4 → `2.4`; `nearestRing` picks the closer of two overlapping rings and returns `null` 0.01 m outside the radius.
- [ ] **Step 2: Run** `npm run test:game` — expect FAIL.
- [ ] **Step 3: Implement** the module; in `main.js`, while in `play` with no challenge running, show `#ring-prompt` "<name> · <tier> · Best: <medal> <time> · Press E to start" (`Best: —` when none) and the `#b-ring` touch button; `E` or the button → `challenges.select(id)`, `ui.refreshChallenges(challenges)`, hide the prompt; `refresh()` after any finish.
- [ ] **Step 4: Run** `npm run test:game` — PASS; browser: drive into a hub ring, press E → "Drive through the start gate" shows and the run works as today.
- [ ] **Step 5: Commit** `feat(rc-crawler): start challenges from rings in the world`.

### Task 7: Medal counter and minimap marks

**Files:**
- Modify: `src/ui/minimap.js`, `src/ui/ui.js`, `index.html`, `styles.css`, `src/main.js`

**Interfaces:**
- Consumes: `countMedals`, `buildRings().rings`, `buildGateways()` gateway list with lock state.
- Produces: `minimap.setWorldMarks({ rings: Ring[] with medal, gateways: {x, z, yaw, locked}[] })`, drawn in `drawFeatures` (ring: tier-coloured dot, gold outline if medalled; gateway: arch glyph, grey with a lock when locked) and labelled on the large map (N). `ui.setMedals(n: number)` updates `#medals` ("MEDALS 4"); the basecamp board shows per-terrain "4 / 10" via the same numbers as the signs.

- [ ] **Step 1:** Implement.
- [ ] **Step 2: Browser check (desktop):** minimap shows rings and arches; N map labels them; the counter updates on a new medal; the basecamp board matches the signs.
- [ ] **Step 3: Commit** `feat(rc-crawler): medal counter and world marks on the map`.

### Task 8: Hub preview, multiplayer smoke test, final pass

**Files:**
- Create: `assets/previews/hub.webp` (via the existing `?capture=1` preview capture)
- Modify: `README` section of `public/rc-crawler` if present (controls: `E` starts a challenge in a ring)

- [ ] **Step 1:** Capture the hub card preview with `?capture=1` and save it as `assets/previews/hub.webp` at the size of the existing previews.
- [ ] **Step 2: Multiplayer smoke test:** create a room on the hub; driving through an arch shows the multiplayer toast and does not travel; a second client sees the same arches.
- [ ] **Step 3:** `npm run test:game` all PASS; `npx next build` passes; no console errors on the hub and on each terrain.
- [ ] **Step 4: Commit** `chore(rc-crawler): hub preview and open-world pass`.
