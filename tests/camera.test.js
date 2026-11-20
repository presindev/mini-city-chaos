'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Camera = require('../src/camera.js');

test('centres on the target', () => {
  const cam = new Camera(2560, 2560, 960, 640);
  cam.follow(1280, 1280);
  assert.equal(cam.x, 1280 - 480);
  assert.equal(cam.y, 1280 - 320);
});

test('is clamped to the map edges', () => {
  const cam = new Camera(2560, 2560, 960, 640);
  cam.follow(10, 10);
  assert.deepEqual([cam.x, cam.y], [0, 0]);
  cam.follow(2550, 2550);
  assert.deepEqual([cam.x, cam.y], [2560 - 960, 2560 - 640]);
});

test('screen and world conversions are inverse', () => {
  const cam = new Camera(2560, 2560, 960, 640);
  cam.follow(1000, 700);
  const w = cam.screenToWorld(100, 50);
  assert.deepEqual(w, { x: cam.x + 100, y: cam.y + 50 });
  assert.deepEqual(cam.worldToScreen(w.x, w.y), { x: 100, y: 50 });
});
