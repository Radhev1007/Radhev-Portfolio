import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import './dom-stub.mjs';
import { PRESETS } from '../../public/rc-crawler/src/env/environment.js';
import { WEATHER } from '../../public/rc-crawler/src/audio/audio.js';
import { Rain } from '../../public/rc-crawler/src/effects/rain.js';

const NEW = ['storm', 'fog', 'night'];

test('rain, fog and night presets, each as complete as the others', () => {
  const keys = Object.keys(PRESETS.morning);
  for (const id of NEW) {
    assert.ok(PRESETS[id], `${id} missing`);
    for (const k of keys) assert.ok(k in PRESETS[id], `${id} has no ${k}`);
  }
  assert.equal(PRESETS.storm.wet, 1, 'rain soaks the ground (and so cuts grip)');
  assert.ok(PRESETS.storm.rain > 0 && !PRESETS.morning.rain, 'only rain rains');
  assert.ok(PRESETS.fog.fogD > PRESETS.overcast.fogD * 3, 'fog is thick');
  assert.ok(PRESETS.night.night && PRESETS.night.sunI < 0.5 && PRESETS.night.exposure < PRESETS.morning.exposure, 'night is dark');
});

test('each preset has its own ambience and a weather button', () => {
  const html = readFileSync(new URL('../../public/rc-crawler/index.html', import.meta.url), 'utf8');
  for (const id of Object.keys(PRESETS)) {
    assert.ok(WEATHER[id], `no ambience for ${id}`);
    assert.ok(html.includes(`data-p="${id}"`), `no button for ${id}`);
  }
  assert.ok(WEATHER.storm.rain > 0 && WEATHER.night.crickets > WEATHER.morning.crickets && WEATHER.storm.birds < WEATHER.morning.birds);
});

test('rain falls around the camera, slanted by the wind, and stops when it stops raining', () => {
  const scene = new THREE.Scene(), rain = new Rain(scene, 600);
  rain.setIntensity(1);
  const cam = new THREE.Vector3(50, 3, -20);
  for (let i = 0; i < 120; i++) rain.update(1 / 60, cam, 1.5);
  const p = rain.positions;
  let inside = 0, slant = 0;
  for (let i = 0; i < p.length; i += 6) {
    if (Math.abs(p[i] - cam.x) < rain.half + 1 && Math.abs(p[i + 2] - cam.z) < rain.half + 1 && p[i + 1] < cam.y + rain.height) inside++;
    slant += p[i] - p[i + 3];   // the top of each streak is upwind of its bottom
  }
  assert.ok(inside / (p.length / 6) > 0.98, 'the drops stay round the camera');
  assert.ok(slant < 0, 'blown by the wind');
  assert.ok(rain.lines.visible);
  rain.setIntensity(0); rain.update(1 / 60, cam, 1.5);
  assert.equal(rain.lines.visible, false);
});
