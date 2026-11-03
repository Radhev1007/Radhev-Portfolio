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

**Phase 2 — Trailhead Valley and obstacles**
- Wooden bridges and deep ruts as trail obstacles (logs, rocks, mud, water, ramps, gravel, narrow passages exist).

**Phase 3 — environments and challenges**
- Mission types beyond timed rings: recovery mission, hill climb, checkpoint race (rings exist), exploration %.
- XP, achievements, per-vehicle statistics (medals, best times and unlocks exist).

**Phase 4 — dashboard, minimap, weather, audio**
- Weather: falling rain with particles and puddles, fog, night (headlights exist), cloudy; rain sets wetness.
- Dashboard visual pass (glass/metal, gauge easing) keeping the same readouts.

**Phase 5 — garage**
- Parts that change physics: tyres (compound/size), shocks (damping), motor (torque/rpm), battery (capacity),
  ESC (drag brake/punch), offsets, accessories (light bar, roof rack, sliders) with a 3D inspection view.
  Bodies and colours already exist.

**Phase 6 — multiplayer**
- Up to 20 players per room, invite links, leaderboards; server-authoritative checks for race results. Rooms,
  sync, markers, voice and spectating exist.

## Visual target (reference images from the brief)

Sunlit backyard course with wooden plank bridges, traffic cones and rope-and-post barriers; muddy brown water
with ripples, splashes and spray off the tyres; tyres caked in dirt; buggies on big lichen-grey boulders in dense
pine forest with flowers and ferns; scale bodies with clear headlights and black trim. Phases 2 and 4 aim here:
plank bridges, cones and rope barriers as trail obstacles; muddier, opaque water with ripples; mud build-up on
tyres; denser understorey.

Each phase ships on its own, tested headlessly (npm run test:game) and in the browser at desktop size.
