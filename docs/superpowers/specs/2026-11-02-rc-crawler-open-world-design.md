# RC Crawler — Open world, stage 1: hub, gateways and world challenges

Date: 2026-11-02 · Game: `public/rc-crawler/` (Three.js, served at radhev.in/rc-crawler via the portfolio's Garage)

## Intent

The owner wants the game to feel "like GTA 5": an open world to drive around, with challenges found in the
world rather than picked from a menu, and a reason to keep playing.

Decided with the owner:

- **Scope is three stages, built in order**, each finished and playable before the next:
  1. **This spec:** a hub world joined to the existing terrains by gateways, challenges placed in the world,
     medal progression with gradual unlocks.
  2. Missions and progression beyond medals (objectives such as deliver / rescue / reach the summit, unlocks).
  3. A living world (day–night, wildlife, AI vehicles on the trails).
- **Audience is both** portfolio visitors (a few minutes, must load fast and impress quickly) and returning
  players (want goals). So the start is compact and immediate, and more opens up with play.
- **Approach B, hub + gateways**, chosen over a streamed seamless world (most work) and one large two-detail
  map (fixed size). Travel between areas is a short fade, not seamless.
- **Gradual unlocks** by medals.

Success for stage 1: a visitor lands at basecamp, sees challenge beacons and gateways straight away, can start
a challenge by driving into it within a minute, and can drive through a gateway to another terrain and back.
A returning player sees medal totals and locked gateways that tell them what to earn.

## 1. The hub: Trailhead Valley

- A new level definition, id `hub`, name "Trailhead Valley", about 160 m square (the other terrains are 136 m;
  the heightfield stays at 10 cm cells, so memory is about 1.4× one terrain).
- Built with the existing level pipeline (`LevelBuilder`): heightfield, trail, surfaces, vegetation, rocks.
- **Basecamp** at the centre: a levelled clearing with the spawn point, a tent, a flagpole and a progress
  board (medal totals per terrain).
- **Six trails** radiate from basecamp to six gateways at the map edges. Each trail takes on its destination's
  surfaces and scatter as it nears the edge (sand and rock toward Desert Ridge, wet ruts toward Mud Trail,
  pines toward Pine Forest, boulders toward Rocky Canyon, a stream toward Creek Crossing, mixed toward the
  Ultimate Rock Course).
- The hub has its own **activity programme** in `activities.js`: four to five Beginner/Intermediate sections
  (e.g. slalom, small rock crawl, jump, log pile, slopes), so medals are available within minutes.
- The game starts in the hub. `?level=<id>` in the URL still opens a terrain directly.

## 2. Gateways

- Each trail ends in a **gateway arch** with a sign: terrain name, difficulty stars, and medals earned there
  ("4 / 10").
- **Driving through an open gateway** fades the screen, shows "Loading <terrain>", loads that level and spawns
  the truck at its start.
- Every terrain gets a **return gateway** placed near its spawn, facing away from the trail start, plus a
  "Back to Trailhead" entry in the pause menu. Returning spawns the truck just inside the hub at that
  terrain's gateway, facing basecamp.
- **Locked gateways** have a barrier across the arch (a solid post line using the existing post collision)
  and a sign: "Earn 6 medals · you have 4". Touching the barrier shows the same message as a toast.
- **Multiplayer:** a room plays one level, as now, and the hub is selectable as a room level. Inside a room,
  gateways do not travel; their signs show the room's terrain and driving through shows a toast. Players are
  never split across levels.

## 3. Challenges in the world

- Each activity's start gate gets a **ground ring and a light beacon**, visible from a distance; colour by
  tier (green Beginner, amber Intermediate, red Expert), with a medal icon once a medal is earned.
- **Driving into a ring** shows a prompt: "<name> · <tier> · Best: <medal> <time> · Press E to start" (a
  button on touch devices). Starting calls the existing `ChallengeManager.select()`; the run, rules, timer and
  medals work exactly as now. While a challenge is active its own gates show as today and the other rings dim.
- **Minimap:** ring icons (tier colour, medal state) and gateway icons (open / locked). The large map (N)
  labels both.
- The pause menu keeps its challenge list.

## 4. Progression and unlocks

- **Medals** are the existing per-challenge best medals (`rccrawler.best.v1` in localStorage). A medal counts
  once per challenge, whatever its colour.
- A **medal counter** sits in the HUD corner and on the basecamp board (earned / available, all terrains).
- **Unlock schedule** (total medals):

  | Area | Unlocks at |
  | --- | --- |
  | Trailhead Valley, Desert Ridge, Pine Forest | start |
  | Mud Trail | 3 |
  | Rocky Canyon | 6 |
  | Creek Crossing | 10 |
  | Ultimate Rock Course | 15 |

- Unlocking shows a toast ("Rocky Canyon unlocked") and opens that gateway's barrier the next time the hub
  loads or immediately if the player is in the hub.
- `?level=<id>` bypasses locks (for sharing and testing).

## 5. Code structure

New, each with one job:

- `src/levels/hub.js` — the Trailhead Valley level definition (layout, basecamp, trails, gateway placements),
  registered in `LEVELS` in `levels.js`.
- `src/world/progress.js` — medal totals from the saved bests, the unlock table, `isUnlocked(levelId)`,
  `medalsIn(levelId)`.
- `src/world/gateways.js` — gateway arch and barrier geometry, signs, crossing detection, and the travel
  request (`{ to: levelId, arriveAt: gatewayId }`).
- `src/world/challengeRings.js` — rings, beacons, proximity prompt, E key / touch button → `challenges.select()`.

Changed lightly:

- `main.js` — start in the hub; handle travel requests via the existing `loadLevel` with a fade and a new
  spawn option (arrive at a gateway); "Back to Trailhead" menu action; wire rings and gateways into the loop.
- `levels/activities.js` — the hub programme.
- `ui/minimap.js` — gateway and ring icons and labels.
- `ui/ui.js`, `index.html`, `styles.css` — prompt, medal counter, loading fade, menu entry.

Unchanged: physics, `ChallengeManager` rules and medals, multiplayer protocol (the hub is just another level id).

## Errors and edge cases

- Travel while a challenge is running cancels the challenge first.
- Travel requests are ignored while a level is already loading.
- A gateway crossing needs the truck upright and moving through the arch (not reversing out of it), so
  backing away from a gateway never triggers it.
- If localStorage is unavailable, progress lives for the session only and locks still work from it.
- Old saved settings with `level` set to a terrain still start in the hub (the hub is the new home);
  `?level=` remains the way to open a terrain directly.

## Testing

- Headless (Node, like the physics harness): build the hub level; check every trail from basecamp to each
  gateway is drivable (slope and obstacle limits along the trail), each gateway pad and arrival spawn is flat
  and clear, activities fit without overlapping trails or gateways, and the unlock arithmetic.
- Browser (desktop): basecamp → open gateway → terrain → return gateway → hub arrives at the right gateway;
  locked gateway blocks and shows the medal message; ring prompt starts a challenge and a medal updates the
  counter and the gateway signs; the large map shows rings and gateways.
- Multiplayer smoke test: a room on the hub; gateways do not travel.

## Out of scope for this stage

Missions and story objectives, AI traffic, wildlife, day–night cycle, a seamless streamed world, new vehicles.
