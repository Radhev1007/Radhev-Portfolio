// Medal progress and terrain unlocks for the open world.
//
// A medal is the best medal saved per challenge by challenges.js (localStorage `rccrawler.best.v1`, keys
// `<levelId>:<challengeId>#medal`); each medalled challenge counts once, whatever its colour. Terrains open at
// a total medal count. How many challenges a terrain offers is only known once it has been built, so that
// number is cached the first time (`rccrawler.available.v1`) for the gateway signs' "4 / 10".

export const UNLOCKS = { hub: 0, desert: 0, forest: 0, mud: 3, canyon: 6, creek: 10, ultimate: 15 };

const AVAIL_KEY = 'rccrawler.available.v1';
const isMedal = (k, v) => k.endsWith('#medal') && !!v;

export function countMedals(best) {
  let n = 0;
  for (const [k, v] of Object.entries(best || {})) if (isMedal(k, v)) n++;
  return n;
}

export function medalsIn(best, levelId) {
  let n = 0;
  for (const [k, v] of Object.entries(best || {})) if (isMedal(k, v) && k.startsWith(levelId + ':')) n++;
  return n;
}

export function needFor(levelId) { return UNLOCKS[levelId] ?? 0; }

export function isUnlocked(levelId, best) { return countMedals(best) >= needFor(levelId); }

export function newlyUnlocked(before, after) {
  const a = countMedals(before), b = countMedals(after);
  return Object.keys(UNLOCKS).filter((id) => UNLOCKS[id] > a && UNLOCKS[id] <= b);
}

function readAvail(store) {
  try { return JSON.parse(store?.getItem(AVAIL_KEY) || '{}') || {}; } catch { return {}; }
}

export function recordAvailable(levelId, n, store = globalThis.localStorage) {
  try {
    const all = readAvail(store);
    all[levelId] = n;
    store?.setItem(AVAIL_KEY, JSON.stringify(all));
  } catch { /* storage unavailable: signs fall back to "4 / —" */ }
}

export function availableIn(levelId, store = globalThis.localStorage) {
  const n = readAvail(store)[levelId];
  return typeof n === 'number' ? n : null;
}
