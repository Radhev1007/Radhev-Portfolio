// Node resolve hook for the RC Crawler headless tests: the game imports `three` and `three/addons/*` through
// the browser's import map; here they resolve to the same vendored files under public/rc-crawler/vendor.
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

const vendor = new URL('../../public/rc-crawler/vendor/three/', import.meta.url).href;
const code = `
const vendor = ${JSON.stringify(vendor)};
export async function resolve(spec, ctx, next) {
  if (spec === 'three') return { url: vendor + 'build/three.module.js', shortCircuit: true };
  if (spec.startsWith('three/addons/')) return { url: vendor + 'examples/jsm/' + spec.slice('three/addons/'.length), shortCircuit: true };
  return next(spec, ctx);
}`;
register('data:text/javascript,' + encodeURIComponent(code), pathToFileURL('./'));
