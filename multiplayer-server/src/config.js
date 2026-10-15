// Server configuration from environment variables (see .env.example). Secrets never leave this process.
const env = process.env;
const num = (v, d) => (v !== undefined && v !== '' && Number.isFinite(+v) ? +v : d);

export const config = {
  port: num(env.PORT, 2567),
  host: env.HOST || '0.0.0.0',
  // comma-separated list of page origins allowed to join, e.g. https://radhev.dev. Empty = any origin.
  allowedOrigins: (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean),
  maxPlayers: Math.min(20, Math.max(2, num(env.MAX_PLAYERS, 20))),
  reconnectSeconds: num(env.RECONNECT_SECONDS, 30),
  // trimmed: values pasted into a hosting dashboard often carry a stray space or line break, which LiveKit
  // then rejects as an invalid API key
  livekit: {
    url: (env.LIVEKIT_URL || '').trim(),      // wss://<project>.livekit.cloud, or ws://localhost:7880 for a local dev server
    apiKey: (env.LIVEKIT_API_KEY || '').trim(),
    apiSecret: (env.LIVEKIT_API_SECRET || '').trim(),
    tokenTtl: env.LIVEKIT_TOKEN_TTL || '15m',
  },
};

export const MAPS = ['canyon', 'forest', 'mud', 'desert', 'creek', 'ultimate'];
export const MODES = ['free', 'race', 'timed', 'stunt', 'checkpoint', 'coop'];
// session length per mode (ms); free roam is open-ended
export const MODE_LIMIT = { free: 0, race: 6 * 60e3, timed: 4 * 60e3, stunt: 3 * 60e3, checkpoint: 5 * 60e3, coop: 8 * 60e3 };
export const PALETTE_SIZE = 20;
