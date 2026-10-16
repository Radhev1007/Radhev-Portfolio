// RC Crawler — game bootstrap, state machine and frame loop.
import * as THREE from 'three';
import { LEVELS, LEVEL_BY_ID } from './levels/levels.js';
import { buildLevel } from './levels/levelBuilder.js';
import { sharedTerrainUniforms } from './terrain/terrainMaterial.js';
import { windUniforms } from './terrain/vegetation.js';
import { waterUniforms } from './terrain/water.js';
import { SURF_NAMES } from './terrain/heightfield.js';
import { CrawlerPhysics, GEARS, DIFF_MODES } from './physics/vehicle.js';
import { createCrawler } from './vehicles/crawlerModel.js';
import { CameraRig, CAM_MODES } from './camera/cameraRig.js';
import { Environment, PRESETS } from './env/environment.js';
import { PostFX } from './effects/post.js';
import { Particles } from './effects/particles.js';
import { TyreTracks } from './effects/tracks.js';
import { ContactShadow } from './effects/contactShadow.js';
import { AudioEngine } from './audio/audio.js';
import { Input } from './core/input.js';
import { ChallengeManager, fmtTime } from './challenges/challenges.js';
import { UI } from './ui/ui.js';
import { Multiplayer } from './net/multiplayer.js';
import { Modes } from './net/modes.js';
import { Voice } from './net/voice.js';
import { MpUI } from './ui/mpUI.js';
import { Landscape } from './ui/landscape.js';
import { Minimap } from './ui/minimap.js';
import { LIVERIES, liveryCss } from './net/config.js';

// ------------------------------------------------------------ settings
const SET_KEY = 'rccrawler.settings.v1';
const isTouch = matchMedia('(pointer: coarse)').matches;
const defaults = { quality: isTouch ? 'low' : 'high', preset: 'golden', touch: 'auto', dof: 'on', fps: 'off', volume: 80, ambience: 'on', level: 'creek' };
let settings = { ...defaults };
try { Object.assign(settings, JSON.parse(localStorage.getItem(SET_KEY) || '{}')); } catch { /* ignore */ }
const saveSettings = () => { try { localStorage.setItem(SET_KEY, JSON.stringify(settings)); } catch { /* ignore */ } };
const params = new URLSearchParams(location.search);
const NORENDER = params.has('norender');   // dev/test: simulate and network without drawing (headless test clients)
if (params.get('q')) settings.quality = params.get('q');
if (params.get('level') && LEVEL_BY_ID[params.get('level')]) settings.level = params.get('level');

// ------------------------------------------------------------ renderer / scene
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: params.has('capture') || params.has('dev') });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.05, 6000);
const env = new Environment(renderer, scene);
let post = null;
const particles = new Particles(1400);
scene.add(particles.points);
const tracks = new TyreTracks(2600);
scene.add(tracks.mesh);
const contact = new ContactShadow();
scene.add(contact.group);
const audio = new AudioEngine();
const input = new Input(canvas);
const ui = new UI();
const rig = new CameraRig(camera, null);

// Phones have dense screens (2–3× DPR); rendering them at ≤1× CSS pixels
// left the image soft. Touch devices keep their lighter effects but render
// much closer to native resolution; desktop is unchanged.
function pixelRatio(q) {
  const d = devicePixelRatio || 1;
  if (isTouch) return { low: Math.min(d, 1.5), medium: Math.min(d, 1.75), high: Math.min(d, 2), ultra: Math.min(d, 2.5) }[q] || Math.min(d, 1.5);
  return { low: Math.min(d, 1) * 0.75, medium: Math.min(d, 1), high: Math.min(d, 1.25), ultra: Math.min(d, 1.75) }[q] || 1;
}
function applyQuality() {
  renderer.setPixelRatio(pixelRatio(settings.quality));
  renderer.setSize(innerWidth, innerHeight, false);
  env.setShadowQuality(settings.quality);
  if (post) post.composer.dispose?.();
  post = new PostFX(renderer, scene, camera, settings.quality);
  post.setSize(innerWidth, innerHeight);
  particles.setPixelScale(innerHeight * renderer.getPixelRatio());
}
applyQuality();
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight, false); post.setSize(innerWidth, innerHeight);
  particles.setPixelScale(innerHeight * renderer.getPixelRatio());
});

// ------------------------------------------------------------ vehicle
let model = createCrawler({ quality: settings.quality });
scene.add(model.group);
let lightsOn = true;
model.setLights(lightsOn);
const dirt = { dust: 0.05, mud: 0, wet: 0 };

// ------------------------------------------------------------ game state
let state = 'loading';
let level = null, phys = null;
let minimap = null;   // created with the multiplayer objects below; reads them for other players and courses
let loadToken = 0;
const challenges = new ChallengeManager(onChallengeEvent);

async function loadLevel(id, { keepState = false } = {}) {
  const def = LEVEL_BY_ID[id] || LEVELS[0];
  const token = ++loadToken;
  ui.showLoading(!!level, `Loading ${def.name}`);
  ui.setCardLoading(id, true);
  await new Promise((r) => setTimeout(r, 30));
  const lvl = await buildLevel(def, settings.quality, (p, msg) => ui.loadProgress(p, msg));
  if (token !== loadToken) { disposeGroup(lvl.group); return; }
  if (level) { scene.remove(level.group); disposeGroup(level.group); }
  level = lvl;
  settings.level = id; saveSettings();
  scene.add(level.group);
  phys = new CrawlerPhysics(level.hf);
  level.posts.forEach((t, i) => { t.netId = i; });       // stable ids: every client builds the same level
  phys.trunks = level.trunks.concat(remoteColliders);
  phys.posts = level.posts;
  applyDrivetrain();
  placeAtSpawn();
  rig.setHeightfield(level.hf);
  applyLevelEnv();
  challenges.setLevel(level);
  setChallengeMarkers(null);
  minimap?.setLevel(level);
  tracks.reset();
  // settle the suspension before showing
  for (let i = 0; i < 90; i++) phys.update(1 / 60, { throttle: 0, steer: 0, handbrake: true });
  rig.pos.copy(phys.pos).add(new THREE.Vector3(3, 1.5, 3));
  ui.setLevel(def, challenges);
  ui.setCardLoading(id, false);
  ui.hideLoading();
  if (mp.active) { for (const i of mp.broken) breakPost(i, 0, 0, 1, true); placeAtSpawn(); modes.sync(); }
  if (!keepState && state === 'loading') setState('title');
}

function placeAtSpawn() {
  const s = mp.active ? modes.spawnPose(mpOrder()) : level.spawn;
  phys.placeAt(s.x, s.z, s.yaw);
  if (mp.active) mp.flagRecover();
  resetStakes();
}

// Broken stakes stand back up when the truck goes back to the start or a challenge is picked.
function resetStakes() {
  if (!level || !level.posts) return;
  for (const t of level.posts) {
    if (!t.breakable) continue;
    if (mp.active && mp.broken.has(t.netId)) continue;     // knocked down in this room: stays down for everyone
    t.broken = false; t.stress = 0; t.hitV = 0; t.pushT = 0; t.fallA = 0; t.fallW = 0; t.landed = false;
    // gate posts only collide while their gate is shown; everything else stands solid again
    t.enabled = t.markerId === undefined ? true : t.mesh ? t.mesh.visible : false;
    if (t.mesh) t.mesh.quaternion.identity();
  }
}

// A snapped stake topples about its base like a rigid rod under the game's gravity:
// angular acceleration (3g / 2L) sin θ, starting from a nudge set by how hard it was hit, until it lies on
// the ground. Purely the visual; the collider is already off.
const _fallAxis = new THREE.Vector3(), _fallQ = new THREE.Quaternion();
function updateStakes(dt) {
  if (!level || !level.posts) return;
  for (const t of level.posts) {
    if (!t.broken || !t.mesh || t.landed) continue;
    if (!t.fallA) { t.fallA = 0.06; t.fallW = 1.5 + 2.5 * Math.min(1, (t.hitV || 0) / 4); }
    const L = Math.max(0.3, t.top - t.y0), g = 30;     // the post's own height: 0.6 stake, 0.9 sign, 1.26 gate
    t.fallW += (3 * g / (2 * L)) * Math.sin(t.fallA) * dt;
    t.fallA = Math.min(Math.PI / 2 - 0.04, t.fallA + t.fallW * dt);
    if (t.fallA >= Math.PI / 2 - 0.04 && !t.landed) {
      t.landed = true;
      audio.events([{ type: 'stakeland', mat: t.mat, speed: t.fallW * L, p: new THREE.Vector3(t.x + t.fallDir.x * L * 0.5, t.y0, t.z + t.fallDir.z * L * 0.5) }]);
    }
    _fallAxis.set(0, 1, 0).cross(t.fallDir).normalize();
    t.mesh.quaternion.copy(_fallQ.setFromAxisAngle(_fallAxis, t.fallA));
  }
}

function applyLevelEnv() {
  const e = level.def.env || {};
  sharedTerrainUniforms.uMossAmt.value = e.moss ?? 0.6;
  sharedTerrainUniforms.uTopLayer.value = e.topLayer ?? 5;
  sharedTerrainUniforms.uDust.value = e.dust ?? 0;
  sharedTerrainUniforms.uSnowLine.value = e.snow ?? 1e4;
  sharedTerrainUniforms.uWaterY.value = level.hf.waterBodies?.find((w) => !w.murky)?.y ?? -1e4;
  const p = env.apply(settings.preset, e);
  post.setGrade(p.grade);
  windUniforms.uWind.value = p.wind;
  level.hf.wetGlobal = sharedTerrainUniforms.uWet.value;
  sharedTerrainUniforms.uSurround.value.set(p.hemiGround).lerp(new THREE.Color(p.fog), 0.35).multiplyScalar(0.9);
  sharedTerrainUniforms.uCaustic.value = { morning: 0.9, golden: 1.0, overcast: 0.2, rain: 0.5 }[settings.preset] ?? 0.8;
  ui.setPreset(settings.preset);
  audio.setEnvironment({ biome: state === 'title' ? level.def.biome : level.def.biome, weather: settings.preset });
}

function disposeGroup(g) {
  g.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { m.map?.dispose?.(); m.dispose(); });
  });
}

const landscape = new Landscape();
function setState(s) {
  if (s === 'play' && state === 'title') landscape.request();   // starting to drive is a tap: phones turn sideways
  landscape.setPlaying(s === 'play');
  minimap?.setVisible(s === 'play');
  state = s;
  ui.setState(s);
  rig.intro = s === 'title';
  input.enabled = s === 'play';
  if (s === 'title') { rig.introT = 0; audio.setEnvironment({ biome: level?.def.biome || 'menu', weather: settings.preset }); }
  updateTouchVisibility();
}

function updateTouchVisibility() {
  const on = settings.touch === 'on' || (settings.touch === 'auto' && isTouch);
  ui.setTouch(on && state === 'play');
}

// ------------------------------------------------------------ challenges
function setChallengeMarkers(id) {
  if (!level) return;
  resetStakes();
  level.group.traverse((o) => { if (o.userData.markerId !== undefined) o.visible = o.userData.markerId === id; });
  for (const p of level.posts) if (p.markerId !== undefined) p.enabled = p.markerId === id;   // colliders follow visibility
}
function onChallengeEvent(type, c, a, b, medal) {
  if (mp.active) modes.onChallengeEvent(type, c, a, b);
  if (type === 'select') { setChallengeMarkers(c ? c.id : null); ui.setChallenge(c, c ? 'Drive through the start gate' : ''); }
  if (type === 'start') { ui.toast(c.name, 'Go! Timer started'); ui.setChallenge(c, 'In progress'); }
  if (type === 'checkpoint') ui.toast(`Checkpoint ${a + 1}/${b}`, '');
  if (type === 'fail') { ui.toast('Challenge failed', a); ui.setChallenge(c, `Failed — ${a}. Return to the start gate`); audio.impact(0.2, 'thud'); }
  if (type === 'complete') {
    const m = medal ? ` · ${medal[0].toUpperCase() + medal.slice(1)} medal` : '';
    ui.toast('Challenge complete', `${fmtTime(a)}${m}${b ? ' · New best!' : ''}`);
    ui.setChallenge(c, `Complete · ${fmtTime(a)}${m}`);
    ui.refreshChallenges(challenges);
  }
}

// ------------------------------------------------------------ UI wiring
ui.buildCards(LEVELS, (id) => {
  audio.uiClick();
  if (mp.active) {
    if (mp.isHost && mp.state.phase !== 'running' && mp.state.phase !== 'countdown') mp.room.send('config', { map: id });
    else ui.toast('In a room', mp.isHost ? 'Change the map between sessions' : 'Only the host can change the map');
    return;
  }
  if (state === 'paused') { ui.closeMenu(); loadLevel(id, { keepState: true }).then(() => setState('play')); }
  else if (!level || id !== level.def.id) loadLevel(id, { keepState: true });
});
ui.on('start', () => { audio.start(); audio.uiClick(); rig.mode = 0; rig.blendIn = 0; setState('play'); ui.flashKeys(); });
ui.on('preset', (p) => { audio.uiClick(); settings.preset = p; saveSettings(); if (level) applyLevelEnv(); });
ui.on('reset', () => recover());
ui.on('camera', () => { const n = rig.cycle(); ui.setCamLabel(n); ui.toast(n + ' camera', ''); });
ui.on('lights', () => { lightsOn = !lightsOn; model.setLights(lightsOn); });
// transfer case range, diff lockers, dig
const dtState = { gear: 'LOW', diffMode: 0, dig: false };
function applyDrivetrain() {
  if (!phys) return;
  phys.gear = dtState.gear === 'LOW' ? GEARS.LOW : GEARS.HIGH; phys.diffMode = dtState.diffMode; phys.dig = dtState.dig;
  ui.drivetrain({ gear: phys.gear.name, diff: DIFF_MODES[phys.diffMode].name, dig: phys.dig });
}
ui.on('range', () => {
  if (state !== 'play' || !phys) return;
  dtState.gear = dtState.gear === 'LOW' ? 'HIGH' : 'LOW'; applyDrivetrain(); audio.uiClick();
  ui.toast(dtState.gear === 'LOW' ? 'Low range' : 'High range', dtState.gear === 'LOW' ? 'Max torque, slow and precise' : 'Faster trail speed, less torque');
});
ui.on('diff', () => {
  if (state !== 'play' || !phys) return;
  dtState.diffMode = (dtState.diffMode + 1) % DIFF_MODES.length; applyDrivetrain(); audio.uiClick();
  const m = DIFF_MODES[dtState.diffMode];
  ui.toast('Diffs: ' + m.label, m.name === 'LOCKED' ? 'Both axles locked, maximum traction' : m.name === 'FRONT OPEN' ? 'Easier steering, rear stays locked' : 'Wheels can spin independently, smooth turning');
});
ui.on('dig', () => {
  if (state !== 'play' || !phys) return;
  dtState.dig = !dtState.dig; applyDrivetrain(); audio.uiClick();
  ui.toast(dtState.dig ? 'Dig engaged' : 'Dig off', dtState.dig ? 'Rear wheels held, steer + throttle to pivot' : 'Normal 4WD');
});
ui.on('menu', () => openMenu());
ui.on('orient', () => landscape.toggle());
ui.on('resume', () => { ui.closeMenu(); setState('play'); });
ui.on('restart', () => { ui.closeMenu(); placeAtSpawn(); tracks.reset(); setState('play'); });
ui.on('title', () => { ui.closeMenu(); placeAtSpawn(); setState('title'); });
ui.on('challenge', (id) => { audio.uiClick(); challenges.select(challenges.active?.id === id ? null : id); ui.refreshChallenges(challenges); ui.closeMenu(); setState('play'); });
ui.on('quality', (q) => { settings.quality = q; saveSettings(); rebuildForQuality(); });
ui.on('volume', (v) => { settings.volume = v; saveSettings(); audio.setMasterVolume(v / 100); });
ui.on('ambience', (v) => { settings.ambience = v; saveSettings(); audio.setAmbience(v === 'on'); });
ui.on('touch', (v) => { settings.touch = v; saveSettings(); updateTouchVisibility(); });
ui.on('dof', (v) => { settings.dof = v; saveSettings(); });
ui.on('fps', (v) => { settings.fps = v; saveSettings(); ui.showFps(v === 'on'); });
ui.initSettings(settings);
input.bindTouchUI(document.getElementById('touch'));

function openMenu() { if (state !== 'play') return; setState('paused'); ui.openMenu(challenges); }

async function rebuildForQuality() {
  applyQuality();
  scene.remove(model.group); model.dispose();
  model = createCrawler({ quality: settings.quality });
  scene.add(model.group); model.setLights(lightsOn); applyLivery();
  const wasPlaying = state === 'play' || state === 'paused';
  const pose = phys ? { p: phys.pos.clone(), yaw: phys.yaw } : null;
  await loadLevel(settings.level, { keepState: true });
  if (pose && wasPlaying) phys.placeAt(pose.p.x, pose.p.z, pose.yaw);
}

function recover() {
  if (!phys) return;
  audio.uiClick();
  tracks.reset();
  if (mp.active) {
    mp.flagRecover();
    mp.relay('recover', phys.pos, 0);
    const pose = modes.recoverPose();
    if (pose) { phys.placeAt(pose.x, pose.z, pose.yaw); ui.toast('Vehicle recovered', 'Back to your last gate'); return; }
  }
  // With a challenge active, retry it: back to just before its start gate, facing through it, without
  // touching anything else. Otherwise back to the trail's start (righting the truck where it stood left it
  // on whatever had trapped it).
  const c = challenges.active;
  if (c && c.gates?.length) {
    const g = c.gates[0];
    phys.placeAt(g.x - Math.sin(g.yaw) * 1.4, g.z - Math.cos(g.yaw) * 1.4, g.yaw);
    resetStakes();
    challenges.select(c.id);
    ui.toast('Vehicle recovered', 'Back to the start of ' + c.name);
  } else {
    placeAtSpawn();
    ui.toast('Vehicle recovered', 'Back to the start');
  }
}

audio.setAmbience(settings.ambience !== 'off');
const unlockAudio = () => { audio.start().then(() => { audio.setMasterVolume(settings.volume / 100); if (level) audio.setEnvironment({ biome: level.def.biome, weather: settings.preset }); }); };
addEventListener('pointerdown', unlockAudio, { once: true });
addEventListener('keydown', unlockAudio, { once: true });

input.on('press', (k) => {
  if (k === 'escape' && mpUI.open) { mpUI.hide(); return; }
  if (k === 'escape') { if (state === 'play') openMenu(); else if (state === 'paused') { ui.closeMenu(); setState('play'); } return; }
  if (state === 'title' && (k === 'enter')) { ui.emit('start'); return; }
  if (state !== 'play') return;
  if (k === 'r') recover();
  if (k === 'c') ui.emit('camera');
  if (k === 'l') ui.emit('lights');
  if (k === 'g') ui.emit('range');
  if (k === 'x') ui.emit('diff');
  if (k === 'v') ui.emit('dig');
  if (k === 'm') audio.setMuted(!(audio._mutedFlag = !audio._mutedFlag));
  if (k === 'n') minimap?.toggle();
  if (k === '=' || k === '+') minimap?.zoomBy(1);
  if (k === '-' || k === '_') minimap?.zoomBy(-1);
});
input.on('orbit', (dx, dy) => rig.orbit(dx, dy));
input.on('zoom', (d) => rig.wheel(d));

// ------------------------------------------------------------ effects per frame
const SURF_COLORS = {
  dirt: new THREE.Color(0.42, 0.33, 0.24), sand: new THREE.Color(0.74, 0.6, 0.43), mud: new THREE.Color(0.2, 0.14, 0.09),
  rock: new THREE.Color(0.55, 0.52, 0.48), gravel: new THREE.Color(0.5, 0.46, 0.4), grass: new THREE.Color(0.35, 0.33, 0.22), water: new THREE.Color(0.85, 0.9, 0.9),
};
const TRACK_COLORS = { dirt: [new THREE.Color(0.16, 0.12, 0.08), 0.5], sand: [new THREE.Color(0.38, 0.29, 0.19), 0.55], mud: [new THREE.Color(0.07, 0.05, 0.03), 0.8], grass: [new THREE.Color(0.12, 0.12, 0.06), 0.35], gravel: [new THREE.Color(0.18, 0.16, 0.13), 0.35] };
const _pv = new THREE.Vector3(), _vv = new THREE.Vector3(), _up = new THREE.Vector3();
let emitAcc = 0;

function updateEffects(dt) {
  emitAcc += dt;
  const doEmit = emitAcc > 1 / 45; if (doEmit) emitAcc = 0;
  const speed = Math.abs(phys.stats.speed);
  let onMud = 0, onDust = 0, inWater = 0;
  for (const w of phys.wheels) {
    if (!w.contact || !w.cp) continue;
    const sname = SURF_NAMES[w.surf] === 'wood' ? 'rock' : SURF_NAMES[w.surf];
    const surf = w.water > 0.15 ? 'water' : sname;
    const tc = TRACK_COLORS[sname];
    if (tc && w.water < 0.2 && speed > 0.05) tracks.add(w.i, w.cp, w.axle, w.n, tc[0], tc[1] * (0.6 + 0.4 * Math.min(1, w.fn / 8)));
    const slip = Math.abs(w.slip);
    if (doEmit && (slip > 0.35 || speed > 1.2)) {
      const amt = Math.min(1, slip * 0.6 + speed * 0.25);
      const col = SURF_COLORS[surf] || SURF_COLORS.dirt;
      _pv.copy(w.cp).addScaledVector(w.n, 0.05);
      const back = _vv.set(0, 0, -Math.sign(phys.omega || 1)).applyQuaternion(phys.q);
      if (surf === 'water') {
        for (let k = 0; k < 4; k++) particles.emit(_pv.clone().add(new THREE.Vector3(0, 0.06, 0)), new THREE.Vector3(back.x * 0.5 + (Math.random() - 0.5) * 0.8, 0.6 + Math.random() * 1.3, back.z * 0.5 + (Math.random() - 0.5) * 0.8), col, { size: 0.028, grow: 0.12, life: 0.45 + Math.random() * 0.3, grav: 11, drag: 0.5, alpha: 0.32 });
      } else if (surf === 'mud') {
        if (Math.random() < amt) particles.emit(_pv, new THREE.Vector3(back.x * (1 + slip) + (Math.random() - 0.5) * 0.6, 0.8 + Math.random() * slip * 1.6, back.z * (1 + slip) + (Math.random() - 0.5) * 0.6), col, { size: 0.045, grow: 0.0, life: 0.9, grav: 14, drag: 0.4, alpha: 0.95 });
      } else if (surf !== 'rock' || slip > 0.5) {
        if (Math.random() < amt * (surf === 'sand' ? 1.3 : 0.8)) particles.emit(_pv, new THREE.Vector3(back.x * 0.5 + (Math.random() - 0.5) * 0.3, 0.25 + Math.random() * 0.3, back.z * 0.5 + (Math.random() - 0.5) * 0.3), col, { size: 0.07, grow: 0.35, life: 1.2 + Math.random() * 0.6, grav: -0.03, drag: 1.6, alpha: surf === 'sand' ? 0.16 : 0.11 });
      }
    }
    if (sname === 'mud') onMud++; if (sname === 'sand' || sname === 'dirt' || sname === 'gravel') onDust++;
    if (w.water > 0.1) inWater++;
  }
  // vehicle dirt accumulation
  dirt.mud = Math.min(1, dirt.mud + onMud * dt * 0.02 * (0.3 + speed));
  dirt.dust = Math.min(0.55, dirt.dust + onDust * dt * 0.0015 * (0.3 + speed));
  if (inWater) { dirt.wet = 1; dirt.mud = Math.max(0, dirt.mud - dt * 0.04 * inWater); dirt.dust = Math.max(0, dirt.dust - dt * 0.06); }
  dirt.wet = Math.max(sharedTerrainUniforms.uWet.value * 0.6, dirt.wet - dt * 0.03);
  model.setDirt(dirt);
}

// ------------------------------------------------------------ HUD
let hudAcc = 0, fpsAcc = 0, fpsN = 0;
function updateHud(dt) {
  hudAcc += dt;
  if (hudAcc < 0.08) return;
  hudAcc = 0;
  const s = phys.stats;
  ui.hud({
    speed: Math.abs(s.speed) * 0.36,
    gear: phys.gear.name, rpm: Math.min(1, Math.abs(phys.omega) / phys.gear.wmax),
    diff: DIFF_MODES[phys.diffMode].name, dig: phys.dig,
    dir: phys.omega > 0.3 ? 'F' : phys.omega < -0.3 ? 'R' : 'N',
    throttle: Math.abs(phys.throttle), battery: phys.battery, traction: s.traction,
    temp: 22 + phys.motorTemp * 55, surface: s.surface,
    rolled: phys.upsideTimer > 1.2,
  });
  if (challenges.active && challenges.state === 'running') ui.challengeTime(fmtTime(challenges.time));
}

// ------------------------------------------------------------ main loop
let last = performance.now(), time = 0;
const _q = new THREE.Quaternion();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  tick(dt);
}
const _aFwd = new THREE.Vector3();
function tick(dt, forced) {
  if (!level || !phys) { if (post) post.render(dt); return; }
  time += dt;
  let inp = forced || (state === 'play' && !mpUI.open ? input.state : { throttle: 0, steer: 0, handbrake: true });
  if (mp.active) inp = modes.inputOverride(inp);
  mp.preStep(dt);
  phys.update(dt, inp);

  // drive the visual model from the interpolated pose (smooth between physics substeps)
  phys.renderPose(model.group.position, model.group.quaternion);
  model.update({ hubY: [0, 1, 2, 3].map((i) => phys.hubLocalY(i)), steer: phys.steer, spin: phys.wheels.map((w) => w.spin), dt });
  model.setBrake(inp.handbrake || (phys.omega > 0.5 && inp.throttle < -0.1) || (phys.omega < -0.5 && inp.throttle > 0.1) ? 1 : 0.12);

  // suspension activity for camera shake/audio
  let act = 0; for (const w of phys.wheels) act += Math.abs(w.cVis - (w._lastVis ?? w.cVis)) / Math.max(dt, 1e-3), w._lastVis = w.cVis;
  phys.stats.suspension = Math.min(1, act * 0.15);

  if (state === 'play') challenges.update(dt, phys);
  updateEffects(dt);
  updateStakes(dt);
  for (const d of level.dynamics || []) if (d.mesh) d.mesh.rotation.x = -d.a;
  contact.update(phys, level.hf);
  particles.update(dt, scene.fog);
  tracks.update(dt);

  if (mp.active) {
    mp.postStep(dt, phys, inp, { lights: lightsOn, brake: inp.handbrake || (phys.omega > 0.5 && inp.throttle < -0.1) || (phys.omega < -0.5 && inp.throttle > 0.1) });
    modes.update(dt, phys);
  }

  // impacts -> audio
  // every collision, tyre touchdown/lift-off and landing comes straight from the physics step that
  // produced it; the audio engine merges and rate-limits them
  audio.events(phys.events);
  phys.events.length = 0;
  if (phys.stats.water > 0.2 && Math.abs(phys.stats.speed) > 0.5 && Math.random() < 0.03) audio.impact(0.4, 'splash');

  audio.update({
    motor: Math.min(1, Math.abs(phys.omega) / 14), rpm: Math.min(1, Math.abs(phys.omega) / phys.gear.wmax), throttle: phys.throttle, load: phys.stats.load,
    speed: Math.abs(phys.stats.speed) * 0.1, slip: phys.stats.slip, slide: phys.stats.slide, scrape: phys.stats.scrape, scrapeMat: phys.stats.scrapeMat,
    surface: phys.stats.surface, water: phys.stats.water,
    suspension: phys.stats.suspension, steerRate: phys.steerRate || 0, grounded: phys.stats.grounded,
  }, dt);

  // camera
  rig.update(dt, model.group, phys);
  // 3D audio: the camera listens, the truck's own sounds come from the truck
  camera.getWorldDirection(_aFwd);
  audio.setListener(camera.position, _aFwd, camera.up);
  audio.setVehiclePosition(model.group.position);
  env.update(dt, phys.pos, time);
  sharedTerrainUniforms.uTime.value = time;
  windUniforms.uTime.value = time;
  waterUniforms.uTime.value = time;

  // depth of field: strong on title/cinematic, subtle while driving
  const dofAmt = settings.dof === 'off' ? 0 : state === 'title' ? 1 : rig.mode === 3 ? 0.7 : rig.mode === 2 ? 0.45 : settings.quality === 'ultra' ? 0.2 : 0;
  post.setDOF(rig.focusDist, dofAmt);

  if (state === 'play' || state === 'paused') updateHud(dt);
  if (state === 'play') minimap?.update(dt);
  if (!NORENDER) post.render(dt);

  fpsAcc += dt; fpsN++;
  if (fpsAcc > 0.5) { ui.fps(Math.round(fpsN / fpsAcc)); fpsAcc = 0; fpsN = 0; }
}

// ------------------------------------------------------------ preview capture (dev): ?capture=1
async function capturePreviews() {
  const savedLevel = settings.level;
  for (const def of LEVELS) {
    await loadLevel(def.id, { keepState: true });
    const path = level.ctx.paths[level.ctx.paths.length - 1];
    const t = def.previewT ?? 0.27;
    const p = path.offset(t, 0.3, -3.2);
    phys.placeAt(p.x, p.z, path.yaw(t));
    for (let i = 0; i < 120; i++) phys.update(1 / 60, { throttle: 0, steer: 0, handbrake: true });
    model.group.position.copy(phys.pos); model.group.quaternion.copy(phys.q);
    model.update({ hubY: [0, 1, 2, 3].map((i) => phys.hubLocalY(i)), steer: 0.2, spin: [0, 0, 0, 0], dt: 0.016 });
    const yaw = phys.yaw + 0.55;
    camera.position.set(phys.pos.x + Math.sin(yaw) * 4.6, phys.pos.y + 1.5, phys.pos.z + Math.cos(yaw) * 4.6);
    camera.lookAt(phys.pos.x, phys.pos.y + 0.2, phys.pos.z);
    camera.fov = 45; camera.updateProjectionMatrix();
    env.update(0, phys.pos, 0);
    contact.update(phys, level.hf);
    post.setDOF(4.2, 0.4);
    for (let i = 0; i < 40; i++) post.setDOF(4.2, 0.4);
    post.render(0.016); post.render(0.016);
    const big = renderer.domElement;
    const c = document.createElement('canvas'); c.width = 480; c.height = 300;
    const g = c.getContext('2d');
    const ar = big.width / big.height, tar = 480 / 300;
    let sw = big.width, sh = big.height, sx = 0, sy = 0;
    if (ar > tar) { sw = big.height * tar; sx = (big.width - sw) / 2; } else { sh = big.width / tar; sy = (big.height - sh) / 2; }
    g.drawImage(big, sx, sy, sw, sh, 0, 0, 480, 300);
    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.86));
    await fetch('/save-preview?id=' + def.id, { method: 'POST', body: blob });
  }
  settings.level = savedLevel; saveSettings();
  document.title = 'CAPTURE DONE';
}

// ------------------------------------------------------------ multiplayer (optional, loads on demand)
let remoteColliders = [];
function mpOrder() {
  const k = mp.players.filter((x) => x.p.connected).sort((a, b) => a.p.slot - b.p.slot).findIndex((x) => x.sid === mp.room?.sessionId);
  return Math.max(0, k);
}
function breakPost(i, fx, fz, speed, silent) {
  const t = level?.posts?.[i];
  if (!t || t.broken) return;
  t.broken = true; t.enabled = false; t.hitV = speed || 1;
  t.fallDir = new THREE.Vector3(fx, 0, fz);
  if (t.fallDir.lengthSq() < 1e-6) t.fallDir.set(Math.random() - 0.5, 0, Math.random() - 0.5);
  t.fallDir.normalize();
  if (!silent) audio.events([{ type: 'break', mat: t.mat, speed: speed || 1, p: new THREE.Vector3(t.x, t.y0 + 0.15, t.z), post: t }]);
}
let mapLoading = null;
const game = {
  levels: LEVELS,
  scene: () => scene,
  level: () => level,
  levelId: () => level?.def.id || settings.level,
  loadMap: (id) => {
    if (!LEVEL_BY_ID[id] || mapLoading === id || level?.def.id === id) return;
    mapLoading = id;
    loadLevel(id, { keepState: true }).finally(() => { mapLoading = null; });
  },
  placeAt: (x, z, yaw) => { if (phys) { phys.placeAt(x, z, yaw); tracks.reset(); } },
  setRemoteColliders: (list) => { remoteColliders = list; if (phys && level) phys.trunks = level.trunks.concat(list); },
  breakPost,
  unbreakAll: () => resetStakes(),
  remoteEvent: (m) => {
    const p = new THREE.Vector3(m.x, m.y, m.z);
    if (m.k === 'hit') audio.events([{ type: 'hit', mat: m.mat || 'metal', part: 'body', speed: m.s, impulse: m.s * 0.4, p }]);
    if (m.k === 'land') audio.events([{ type: 'land', air: 0.5, speed: m.s, p }]);
  },
  selectChallenge: (id) => { challenges.select(id); ui.refreshChallenges(challenges); },
  voiceInfo: (sid) => voice.info(sid),
  toast: (a, b) => ui.toast(a, b),
  sound: () => audio.uiClick(),
  driving: () => state === 'play' || state === 'paused',
  eye: () => camera.position,
  closeMenu: () => { if (state === 'paused') { ui.closeMenu(); setState('play'); } },
  panelOpen: (open) => {
    if (!open && mp.active && state === 'title') { audio.start(); rig.mode = 0; rig.blendIn = 0; setState('play'); }
    input.enabled = state === 'play' && !open;
  },
};
const mp = new Multiplayer(game);
const modes = new Modes(mp, game);
const voice = new Voice(mp);
const mpUI = new MpUI({ mp, voice, modes, game });
mp.on('change', () => modes.sync());

// ------------------------------------------------------------ minimap: what it draws each refresh
const _camDir = new THREE.Vector3(), _fwd = new THREE.Vector3();
function mapSource() {
  if (!phys || !level) return null;
  camera.getWorldDirection(_camDir);
  const st = mp.active ? mp.state : null, mine = mp.room?.sessionId;
  const me = { x: phys.pos.x, z: phys.pos.z, yaw: phys.yaw };
  const others = [];
  if (st) {
    for (const [sid, p] of st.players) {
      if (sid === mine || !p.connected) continue;
      const t = mp.fleet.trucks.get(p.slot);
      if (!t || !t.visible) continue;
      const g = t.model?.group, pos = g ? g.position : t.pos;
      _fwd.set(0, 0, 1).applyQuaternion(g ? g.quaternion : t.q);
      others.push({ x: pos.x, z: pos.z, yaw: Math.atan2(_fwd.x, _fwd.z), color: liveryCss(p.color), name: p.name, talking: !!voice.speaking?.has(sid) });
    }
  }
  // the course: a multiplayer session's gates or checkpoints, else the selected solo challenge
  let gates = null, points = null;
  const c = st && (st.phase === 'countdown' || st.phase === 'running') ? modes.course : null;
  const mark = (list, next) => list.map((g, i) => (g.hidden ? null : { ...g, state: i < next ? 'done' : i === next ? 'next' : 'todo', last: i === list.length - 1 })).filter(Boolean);
  if (c?.gates) gates = mark(c.gates, st.mode === 'coop' ? st.team : (mp.me?.cp ?? -1) + 1);
  else if (c?.points) points = c.points.map((q, i) => ({ x: q.x, z: q.z, done: !!((mp.me?.mask || 0) & (1 << i)) }));
  else if (!st && challenges.active) gates = mark(challenges.active.gates, challenges.state === 'running' ? challenges.next : 0);
  return { me, camYaw: Math.atan2(_camDir.x, _camDir.z), others, gates, points };
}
minimap = new Minimap(mapSource);
if (level) minimap.setLevel(level);
voice.on('change', () => mp.onState());   // speaking / mic indicators on name tags follow voice right away
// while another player talks, the game's own sound dips so their voice comes through
voice.on('change', () => { const me = mp.room?.sessionId; audio.setDuck([...(voice.speaking || [])].some((s) => s !== me) ? 0.45 : 1); });
mp.on('joined', () => { audio.start(); if (level) placeAtSpawn(); });
mp.on('left', () => { modes.teardown(); voice.leave(); myLivery = null; applyLivery(); audio.setDuck(1); });

// In a room, this truck wears the livery the player picked, exactly as everyone else sees it; white again solo.
// (The last livery is kept through a reconnect, so the paint doesn't flash white.)
let myLivery = null;
function applyLivery() { model.setBodyColor((LIVERIES[myLivery ?? 0] || LIVERIES[0])[1]); }
mp.on('change', () => { const c = mp.me?.color; if (c !== undefined && c !== myLivery) { myLivery = c; applyLivery(); } });

// ------------------------------------------------------------ boot
requestAnimationFrame(frame);
if (params.has('capture')) capturePreviews();
else loadLevel(settings.level).then(async () => {
  const code = params.get('join');
  if (await mp.resume()) { if (state === 'title') game.panelOpen(false); ui.toast('Rejoined room', mp.code); return; }
  if (code && mp.available) { mpUI.invite(code); mpUI.show(); }
});
window.__game = {
  mp, modes, voice, mpUI, minimap, audio,
  get phys() { return phys; }, get level() { return level; }, get post() { return post; }, rig, renderer, scene, camera, settings, setState, loadLevel, input, model: () => model,
  step(n, inp, dt = 1 / 60) { for (let i = 0; i < n; i++) tick(dt, inp); },
  // dev: save the current frame to assets/previews/<name>.jpg (localhost only)
  async shot(name, w = 960) {
    post.render(0.016);
    const big = renderer.domElement, c = document.createElement('canvas');
    c.width = w; c.height = Math.round(w * big.height / big.width);
    c.getContext('2d').drawImage(big, 0, 0, c.width, c.height);
    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.88));
    await fetch('/save-preview?id=' + name, { method: 'POST', body: blob });
  },
};
