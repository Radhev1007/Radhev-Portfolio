# RC Crawler simulator upgrade: audit and phased plan

Brief: upgrade the existing RC Crawler (public/rc-crawler, Three.js r160, ES modules, no bundler) toward a
premium hobby-grade simulator, phase by phase, keeping every working feature, the /rc-crawler entry point
and the keyboard controls. All indicators must read real game state.

## Audit: what the game already has

| Brief item | Status | Where |
|---|---|---|
| 4WD drivetrain, locked/front-open/open diffs, dig | Done | physics/vehicle.js (DIFF_MODES, single drivetrain, couple()) |
| Low/high range, motor torque curve, ESC drag brake | Done | GEARS, dragBrake, battery, motorTemp |
| Per-wheel suspension, solid-axle articulation | Done | 4 sprung wheels, bump stops, crawlerModel axles/links/shocks |
| Tyre deformation, tyre pressure | Done | TYRE_PRESSURE, tyreDeform.js |
| Steering (Ackermann), per-wheel spin | Done | crawlerModel ackermann(), w.spin |
| Grip by surface, slip, traction loss | Done | SURF_PROPS mu/roll/sink, slip stats |
| Body roll, weight transfer, rollover | Done | rigid body, comLift by difficulty |
| Recovery | Done | R; tow crane rights a rolled truck (world/towTruck.js) |
| Wet weather cuts grip | Done | wetMu (hf.wetGlobal from the weather preset; rock 30%, others 18%) |
| Obstacle collisions | Done | probes, body boxes, posts/trunks, terrain-in-body, 20–30 trail obstacles per terrain |
| Environments: forest, mud, desert, creek (water), canyon, rock course, hub | Done | levels/levels.js (7 levels), gateways, unlocks by medals |
| Water: depth, buoyancy, splashes | Done | terrain/water.js, buoyancy in physics, particles |
| Dashboard: RPM, speed, battery, temp, gear, 4WD, diffs, drag, recover, chase, lights, minimap | Done | ui/ui.js, ui/minimap.js (all read physics state) |
| Cameras: chase, close, low ground, cinematic director, free orbit, zoom | Done | camera/cameraRig.js |
| Weather: morning, golden hour, overcast, after rain (wet terrain) | Done | env/environment.js PRESETS |
| Audio: motor load, tyres, surfaces, impacts, splashes, servo, ambience | Done | audio/audio.js (1.3k lines) |
| Challenges, medals, unlockable trails, best times | Done | challenges/, world/progress.js, rings |
| Multiplayer rooms, open world lobby, spectate, voice, races/modes | Done | net/*, multiplayer-server (Colyseus on Render) |
| Bodies: SCX30, Bronco, Willys (own geometry), liveries | Done | vehicles/bodies.js, geometry.js |
| Driver: seated animation, get out and walk | Done | vehicles/driver*.js, world/onFoot.js |
| Instanced vegetation, culling, quality presets, adaptive resolution | Done | terrain/*, QUALITY, adaptResolution |

## Gaps, by phase

**Phase 1 — physics, steering, traction, camera** (done)
- Cameras: front bumper, wheel inspection, first-person driver (the brief's three missing modes), with smooth
  transitions between modes.
- Gamepad: left stick steers, triggers throttle/reverse, buttons for brake, recover, camera, get out, lights.
- Physics: audited above; no gaps that justify retuning a handling that was tuned and tested. Revisit only on
  a concrete driving complaint.

**Phase 2 — Trailhead Valley and obstacles** (done)
- Plank bridges over ditches (rope handrails, a mud pit instead on too steep a stretch) and deep ruts at track
  width as trail obstacles; traffic cones at obstacle entries and rope barriers along cliff paths, descents and
  off-camber slopes, all knockable; silty brown creeks and crossings that keep their flow, ripples and foam.
- Not yet: mud build-up on the tyres (the body already gets dust, mud and wet).

**Phase 3 — environments and challenges** (done)
- Done: career (world/career.js) — XP (distance, medals, trail progress, achievements), ranks, 15 achievements
  from real events (distance, time, rollovers, crane recoveries, bridges crossed, creeks forded, medals, trail
  ends, every vehicle driven), trail completion % per terrain, statistics overall and per vehicle; a CAREER menu
  tab and the rank under the HUD medal count.
- Done: missions on every terrain's main trail (levels/missions.js) — Hill Climb (the steepest 24-40 m stretch,
  driven uphill, where the trail climbs 1.5 m or more), Checkpoint Race (60-140 m, at least four checkpoints),
  Recovery Run (out to a crawler broken down beside the trail and back). Ordinary challenges: rings, timer, par
  medals and career XP all apply.

**Phase 4 — dashboard, minimap, weather, audio** (done)
- Weather: Rain (falling rain streaks round the camera, slanted by the wind; a rain hiss and rumble; the ground
  fully wet, so grip drops), Fog (thick, short sight lines), Night (moonlight; the headlights switch on).
- Dashboard: the needles swing to the exact readings on a damped spring (a slight overshoot, like a real gauge).
- Mud and dust now build up on bodies' own tyres (Willys, Bronco) too, per truck.
- Not yet: puddles that form while it rains; a full glass/metal restyle of the cluster.

**Phase 5 — garage** (done)
- Parts that change the physics (vehicles/parts.js, CrawlerPhysics.setSetup): tyres (all-terrain, mud terrain,
  sticky rock compound: grip by surface), shocks (soft/stock/firm), motor (45T torque, 27T speed), battery
  (5000 mAh runtime, 3S speed and punch), ESC (crawl/stock/sport throttle), wheel offset (narrow/wide track),
  accessories (LED light bar on the headlights, roof rack raising the centre of mass, rock sliders letting the
  chassis slide off rock, tube bumper). Stock parts leave the tuned handling exactly as it was (tested).
- A GARAGE menu tab with stat bars against stock and an inspection view circling the parked truck.
- Not yet: parts are not sent to other players in multiplayer (they see stock trucks).

**Phase 6 — multiplayer** (done)
- Already there: rooms of up to 20 (tested), invite links, player names and markers, voice, spectating,
  server-checked race / timed / checkpoint / coop sessions (gates in order, near the truck, no faster than the
  course allows; timed runs measured on the server clock).
- Added: course leaderboards (multiplayer-server/src/leaderboard.js) — the best server-timed result per player per
  course, top 10, kept across rooms and saved to disk (BOARDS_FILE), shown in the lobby and results with the
  vehicle and whether its parts were stock. Garage parts sync to other players as a short code the server checks
  against the parts that exist; their trucks show the same accessories and wheel offset.
- Note: on a host without a persistent disk (Render's free tier) the boards start fresh after a redeploy.

## Visual target (reference images from the brief)

Sunlit backyard course with wooden plank bridges, traffic cones and rope-and-post barriers; muddy brown water
with ripples, splashes and spray off the tyres; tyres caked in dirt; buggies on big lichen-grey boulders in dense
pine forest with flowers and ferns; scale bodies with clear headlights and black trim. Phases 2 and 4 aim here:
plank bridges, cones and rope barriers as trail obstacles; muddier, opaque water with ripples; mud build-up on
tyres; denser understorey.

Each phase ships on its own, tested headlessly (npm run test:game) and in the browser at desktop size.
