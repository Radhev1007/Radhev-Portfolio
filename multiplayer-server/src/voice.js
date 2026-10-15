// LiveKit access tokens, minted here so the API secret never reaches a browser. Tokens are short-lived,
// scoped to the one voice room that belongs to the multiplayer room, and only allow publishing a microphone.
import { AccessToken, TrackSource } from 'livekit-server-sdk';
import { config } from './config.js';

export const voiceConfigured = () => !!(config.livekit.url && config.livekit.apiKey && config.livekit.apiSecret);

export async function voiceToken({ room, identity, name }) {
  const lk = config.livekit;
  const at = new AccessToken(lk.apiKey, lk.apiSecret, { identity, name, ttl: lk.tokenTtl });
  at.addGrant({
    room, roomJoin: true, canSubscribe: true, canPublish: true, canPublishData: false,
    canPublishSources: [TrackSource.MICROPHONE],
  });
  return { url: lk.url, room, token: await at.toJwt() };
}
