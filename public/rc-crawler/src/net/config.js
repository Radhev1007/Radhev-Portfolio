// Where the multiplayer server lives. The game is static files, so the URL comes from (first match wins):
//   1. ?mp=wss://... on the game URL (the portfolio passes NEXT_PUBLIC_RC_MULTIPLAYER_URL this way)
//   2. window.RC_CONFIG.multiplayerUrl (set by a host page before the game loads)
//   3. ws://<this host>:2567 when the game is served from localhost (local development)
// No URL = multiplayer is shown as unavailable; single player is unaffected either way.
// The LiveKit voice URL is not configured here: the multiplayer server hands it out with each voice token.
export function multiplayerUrl() {
  const q = new URLSearchParams(location.search).get('mp');
  if (q && /^wss?:\/\//.test(q)) return q;
  const w = window.RC_CONFIG?.multiplayerUrl;
  if (w) return w;
  if (/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) || location.hostname.endsWith('.localhost')) return `ws://${location.hostname}:2567`;
  return '';
}

// 20 liveries: the "vehicle" each player picks (same SCX30 truck, different paint), also their colour in lists
export const LIVERIES = [
  ['Arctic White', 0xf1f1ee], ['Firecracker Red', 0xc8261e], ['Ocean Blue', 0x1f5fb8], ['Sarge Green', 0x56653a],
  ['Hellayella', 0xf2c21b], ['Punk Pink', 0xe0457b], ['Granite', 0x5e6166], ['Sting Teal', 0x14958f],
  ['Nacho Orange', 0xe8741c], ['Midnight', 0x23262b], ['Mojito Lime', 0x8cc63f], ['Gecko Purple', 0x6c3fa8],
  ['Sandstorm', 0xc9a66b], ['Hydro Cyan', 0x2db6e0], ['Copper', 0xa8592f], ['Ice Silver', 0xb8bec4],
  ['Rubicon Maroon', 0x6e1d24], ['Bikini Aqua', 0x4fc9b5], ['Sunset Coral', 0xf0765b], ['Black Ops', 0x121314],
];
export const liveryCss = (i) => '#' + (LIVERIES[i] || LIVERIES[0])[1].toString(16).padStart(6, '0');
