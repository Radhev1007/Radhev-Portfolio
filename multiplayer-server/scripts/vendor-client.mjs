// Copies the browser client libraries and the shared snapshot codec into the game, which has no bundler:
//   public/rc-crawler/vendor/net/colyseus.js        Colyseus 0.16 client (UMD, defines window.Colyseus)
//   public/rc-crawler/vendor/net/livekit-client.mjs LiveKit browser SDK (self-contained ES module)
//   public/rc-crawler/vendor/net/codec.js           shared/codec.js (single source of truth: edit that one)
// Run after changing client library versions:  npm run vendor
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const out = join(root, '..', 'public', 'rc-crawler', 'vendor', 'net');
mkdirSync(out, { recursive: true });
const pkg = (n) => JSON.parse(readFileSync(join(root, 'node_modules', n, 'package.json'), 'utf8')).version;

// the source maps are not shipped, so drop the comments that point browsers' dev tools at them
const copyNoMap = (from, to) => writeFileSync(to, readFileSync(from, 'utf8').replace(/\/\/# sourceMappingURL=\S+\s*$/, '\n'));
copyNoMap(join(root, 'node_modules/colyseus.js/dist/colyseus.js'), join(out, 'colyseus.js'));
copyNoMap(join(root, 'node_modules/livekit-client/dist/livekit-client.esm.mjs'), join(out, 'livekit-client.mjs'));
copyFileSync(join(root, 'shared/codec.js'), join(out, 'codec.js'));
writeFileSync(join(out, 'VERSIONS.txt'), `colyseus.js ${pkg('colyseus.js')} (MIT)\nlivekit-client ${pkg('livekit-client')} (Apache-2.0)\ncodec.js from multiplayer-server/shared/codec.js\n`);
console.log('vendored into', out);
