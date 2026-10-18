// Other players' trucks: the same SCX30 model as the local truck, driven from server snapshots.
//
// Each remote truck keeps a short buffer of timestamped snapshots (server clock) and is drawn at a point
// slightly in the past (INTERP_DELAY), interpolating between the two snapshots around it. If the stream
// stalls it extrapolates along its last velocity for at most MAX_EXTRAP, then holds. Nothing here runs
// physics on a remote truck: its owner's browser already did, so a second simulation would only fight it.
//
// For the local truck's physics each remote truck is a moving obstacle: three upright cylinders along its
// body (the same collider type as trees and posts), carrying the remote truck's velocity so a contact
// closes at the true relative speed. Only the local truck is pushed by such a contact; the remote truck's
// owner resolves its own side of the same contact against our relayed pose.
import * as THREE from 'three';
import { createCrawler } from '../vehicles/crawlerModel.js';
import { LIVERIES, liveryCss } from './config.js';
import { mountBody } from '../vehicles/bodies.js';
import { FLAG } from '../../vendor/net/codec.js';

const INTERP_DELAY = 110;     // ms behind the newest snapshot: ~2 snapshots of jitter cover at 20 Hz
const MAX_EXTRAP = 250;       // ms of dead reckoning before a stalled truck stops moving
const SNAP_DIST = 8;          // m: a jump bigger than this between snapshots (a recovery) is not tweened; a truck at
                              // top speed covers ~2 m per snapshot, ~4.5 when one arrives late
const COLLIDE_LEAD = 0.3;
const FAR = 70;     // s: most we predict a remote truck's collider ahead of its drawn pose
const PROXY_Z = [-0.58, 0, 0.58], PROXY_R = 0.44;
const _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion(), _fwd = new THREE.Vector3();

class RemoteTruck {
  constructor(slot, scene, quality) {
    this.slot = slot;
    this.scene = scene;
    this.quality = quality;
    this.buf = [];                         // [{t, x,y,z, q:Quaternion, vx,vy,vz, steer, throttle, hub:[4], flags}]
    this.pos = new THREE.Vector3(); this.q = new THREE.Quaternion(); this.vel = new THREE.Vector3();
    this.hub = [-0.1, -0.1, -0.1, -0.1]; this.steer = 0; this.flags = 0; this.spin = 0;
    this.visible = false;
    this.color = -1; this.name = '';
    this.proxies = PROXY_Z.map(() => ({ x: 0, z: 0, r: PROXY_R, y0: 0, top: 0, mat: 'plastic', kind: 'truck', enabled: false, v: new THREE.Vector3(), remote: slot }));
  }

  setLook(color, name, talking, mic, vehicle = 'scx30') {
    if (color !== this.color) {
      this.vehicle = null;   // a new model: mount its body again below
      this.color = color;
      if (this.model) { this.scene.remove(this.model.group); this.model.dispose(); }
      this.model = createCrawler({ quality: this.quality, bodyColor: (LIVERIES[color] || LIVERIES[0])[1], realLights: false });
      // shadows from the body shell only: 19 trucks x ~60 small parts in the shadow map cost more than they show
      const body = new Set(this.model.bodyMeshes || []);
      this.model.group.traverse((o) => { if (o.isMesh) o.castShadow = body.has(o); });
      this.model.group.visible = this.visible;
      this.lightsOn = null;
      this.scene.add(this.model.group);
    }
    if (vehicle !== this.vehicle && this.model) { this.vehicle = vehicle; mountBody(this.model, vehicle, (LIVERIES[color] || LIVERIES[0])[1]); }
    const key = `${name}|${talking ? 1 : 0}|${mic ? 1 : 0}|${color}`;
    if (key !== this.tagKey) { this.tagKey = key; this.name = name; this.drawTag(name, talking, mic, color); }
  }

  drawTag(name, talking, mic, color) {
    if (!this.tag) {
      this.tagCanvas = document.createElement('canvas'); this.tagCanvas.width = 512; this.tagCanvas.height = 96;
      this.tagTex = new THREE.CanvasTexture(this.tagCanvas); this.tagTex.colorSpace = THREE.SRGBColorSpace;
      this.tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tagTex, depthWrite: false, transparent: true }));
      this.tag.scale.set(1.6, 0.3, 1); this.tag.renderOrder = 10;
      this.scene.add(this.tag);
    }
    const g = this.tagCanvas.getContext('2d');
    g.clearRect(0, 0, 512, 96);
    g.font = '500 46px "Host Grotesk", system-ui, sans-serif';
    const tw = Math.min(380, g.measureText(name).width), w = tw + (mic ? 150 : 110), x0 = (512 - w) / 2;
    g.fillStyle = talking ? 'rgba(46,160,90,0.92)' : 'rgba(10,12,14,0.72)';
    g.beginPath(); g.roundRect(x0, 10, w, 76, 38); g.fill();
    g.fillStyle = liveryCss(color); g.beginPath(); g.arc(x0 + 44, 48, 16, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fff'; g.textBaseline = 'middle'; g.fillText(name, x0 + 76, 50, 380);
    if (mic) {   // small microphone glyph: shown while their mic is live
      const mx = x0 + 76 + tw + 30;
      g.strokeStyle = '#fff'; g.lineWidth = 5; g.beginPath(); g.roundRect(mx - 8, 26, 16, 30, 8); g.stroke();
      g.beginPath(); g.arc(mx, 48, 16, 0.15 * Math.PI, 0.85 * Math.PI); g.moveTo(mx, 64); g.lineTo(mx, 72); g.stroke();
    }
    this.tagTex.needsUpdate = true;
  }

  push(t, s) {
    const last = this.buf[this.buf.length - 1];
    if (last && t <= last.t) return;                       // out of order / duplicate
    const e = { t, x: s.x, y: s.y, z: s.z, q: new THREE.Quaternion(s.qx, s.qy, s.qz, s.qw), vx: s.vx, vy: s.vy, vz: s.vz, steer: s.steer, throttle: s.throttle, hub: s.hub.slice(), flags: s.flags };
    // a recovery or a long gap is a real teleport: start the buffer over instead of sliding across the map
    if (last && (s.flags & FLAG.RECOVER || Math.hypot(e.x - last.x, e.z - last.z) > SNAP_DIST)) this.buf.length = 0;
    this.buf.push(e);
    if (this.buf.length > 30) this.buf.shift();
  }

  // pose at server time rt
  sample(rt) {
    const b = this.buf;
    if (!b.length) return false;
    let a = null, c = null;
    for (let i = b.length - 1; i >= 0; i--) { if (b[i].t <= rt) { a = b[i]; c = b[i + 1] || null; break; } }
    if (!a) { a = b[0]; c = null; rt = a.t; }                   // older than everything: hold the oldest
    if (c) {
      const f = (rt - a.t) / Math.max(1, c.t - a.t);
      this.pos.set(a.x + (c.x - a.x) * f, a.y + (c.y - a.y) * f, a.z + (c.z - a.z) * f);
      this.q.copy(a.q).slerp(c.q, f);
      this.vel.set(a.vx + (c.vx - a.vx) * f, a.vy + (c.vy - a.vy) * f, a.vz + (c.vz - a.vz) * f);
      this.steer = a.steer + (c.steer - a.steer) * f;
      for (let i = 0; i < 4; i++) this.hub[i] = a.hub[i] + (c.hub[i] - a.hub[i]) * f;
      this.flags = f < 0.5 ? a.flags : c.flags;
    } else {
      // past the newest snapshot: bounded dead reckoning along the last velocity
      const dt = Math.min(MAX_EXTRAP, Math.max(0, rt - a.t)) / 1000;
      this.pos.set(a.x + a.vx * dt, a.y + a.vy * dt, a.z + a.vz * dt);
      this.q.copy(a.q); this.vel.set(a.vx, a.vy, a.vz); this.steer = a.steer; this.flags = a.flags;
      for (let i = 0; i < 4; i++) this.hub[i] = a.hub[i];
      if (rt - a.t > MAX_EXTRAP) this.vel.set(0, 0, 0);
    }
    // keep the buffer short: drop snapshots older than the one we are interpolating from
    while (b.length > 2 && b[1].t < rt - 50) b.shift();
    return true;
  }

  update(dt, rt, now, eye) {
    const ok = this.sample(rt) && now - this.buf[this.buf.length - 1].t < 5000;   // gone quiet for 5 s: hide
    this.setVisible(ok);
    // past FAR metres the 80-part model is a few pixels: draw only the name tag
    if (ok && this.model) this.model.group.visible = !eye || this.pos.distanceToSquared(eye) < FAR * FAR;
    for (const p of this.proxies) p.enabled = ok;
    if (!ok || !this.model) return;
    const g = this.model.group;
    // a soft follow on top of interpolation hides the 20 Hz steps without adding much lag
    const k = 1 - Math.exp(-dt * 30);
    if (g.position.distanceToSquared(this.pos) > SNAP_DIST * SNAP_DIST) { g.position.copy(this.pos); g.quaternion.copy(this.q); }
    else { g.position.lerp(this.pos, k); g.quaternion.slerp(this.q, k); }
    _fwd.set(0, 0, 1).applyQuaternion(this.q);
    this.spin += (this.vel.dot(_fwd) / 0.215) * dt;
    this.model.update({ hubY: this.hub, steer: this.steer, spin: [this.spin, this.spin, this.spin, this.spin], dt });
    this.model.setBrake(this.flags & FLAG.BRAKE ? 1 : 0.12);
    const lights = !!(this.flags & FLAG.LIGHTS);
    if (lights !== this.lightsOn) { this.lightsOn = lights; this.model.setLights(lights); }
    if (this.tag) this.tag.position.set(g.position.x, g.position.y + 0.95, g.position.z);
    // collision proxies along the body axis (horizontal heading only: the colliders are upright cylinders).
    // What we draw is ~INTERP_DELAY old; for contact we lead it along its velocity to where that truck is
    // most likely now, so two trucks closing head-on meet at their real positions, not a car-length late.
    const fx = _fwd.x, fz = _fwd.z, fl = Math.hypot(fx, fz) || 1;
    const lead = Math.min(COLLIDE_LEAD, this.lead || 0);
    const cx = g.position.x + this.vel.x * lead, cz = g.position.z + this.vel.z * lead;
    for (let i = 0; i < 3; i++) {
      const p = this.proxies[i];
      p.x = cx + (fx / fl) * PROXY_Z[i]; p.z = cz + (fz / fl) * PROXY_Z[i];
      p.y0 = g.position.y - 0.38; p.top = g.position.y + 0.42;
      p.v.copy(this.vel);
    }
  }

  setVisible(v) {
    if (v === this.visible) return;
    this.visible = v;
    if (this.model) this.model.group.visible = v;
    if (this.tag) this.tag.visible = v;
  }

  dispose() {
    if (this.model) { this.scene.remove(this.model.group); this.model.dispose(); }
    if (this.tag) { this.scene.remove(this.tag); this.tag.material.dispose(); this.tagTex.dispose(); }
  }
}

export class RemoteFleet {
  constructor(scene) {
    this.scene = scene;
    this.trucks = new Map();   // slot -> RemoteTruck
    this.colliders = [];       // flat list handed to the local truck's physics (phys.trunks gets these appended)
    this.quality = 'low';
  }

  get(slot) {
    let t = this.trucks.get(slot);
    if (!t) { t = new RemoteTruck(slot, this.scene, this.quality); this.trucks.set(slot, t); this.rebuildColliders(); }
    return t;
  }

  remove(slot) {
    const t = this.trucks.get(slot);
    if (!t) return;
    t.dispose(); this.trucks.delete(slot); this.rebuildColliders();
  }

  clear() { for (const s of [...this.trucks.keys()]) this.remove(s); }

  rebuildColliders() { this.colliders = [...this.trucks.values()].flatMap((t) => t.proxies); }

  // lead = how far behind real time the drawn trucks are (interpolation delay + half the round trip), seconds
  update(dt, renderTime, serverNow, lead = 0, eye = null) { for (const t of this.trucks.values()) { t.lead = lead; t.update(dt, renderTime, serverNow, eye); } }

  static get INTERP_DELAY() { return INTERP_DELAY; }
}
