'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Utils = require('../src/utils.js');

const near = (actual, expected, eps = 1e-9) =>
  assert.ok(Math.abs(actual - expected) < eps, `${actual} !~ ${expected}`);

test('clamp limits values to the range', () => {
  assert.equal(Utils.clamp(5, 0, 10), 5);
  assert.equal(Utils.clamp(-3, 0, 10), 0);
  assert.equal(Utils.clamp(42, 0, 10), 10);
});

test('lerp interpolates linearly', () => {
  assert.equal(Utils.lerp(0, 10, 0), 0);
  assert.equal(Utils.lerp(0, 10, 1), 10);
  assert.equal(Utils.lerp(0, 10, 0.25), 2.5);
});

test('dist returns euclidean distance', () => {
  assert.equal(Utils.dist(0, 0, 3, 4), 5);
  assert.equal(Utils.dist(1, 1, 1, 1), 0);
});

test('angleTo points right, down, left and up', () => {
  near(Utils.angleTo(0, 0, 10, 0), 0);
  near(Utils.angleTo(0, 0, 0, 10), Math.PI / 2);
  near(Math.abs(Utils.angleTo(0, 0, -10, 0)), Math.PI);
  near(Utils.angleTo(0, 0, 0, -10), -Math.PI / 2);
});

test('randRange stays within [min, max) and uses injected rng', () => {
  assert.equal(Utils.randRange(2, 6, () => 0), 2);
  assert.equal(Utils.randRange(2, 6, () => 0.5), 4);
  for (let i = 0; i < 100; i++) {
    const v = Utils.randRange(-1, 1);
    assert.ok(v >= -1 && v < 1);
  }
});

test('circleRectCollide detects overlap, edges and corners', () => {
  const rect = [0, 0, 64, 64];
  assert.ok(Utils.circleRectCollide(32, 32, 5, ...rect), 'center inside');
  assert.ok(Utils.circleRectCollide(70, 32, 10, ...rect), 'overlaps right edge');
  assert.ok(!Utils.circleRectCollide(80, 32, 10, ...rect), 'away from right edge');
  assert.ok(!Utils.circleRectCollide(74, 32, 10, ...rect), 'just touching is not a collision');
  assert.ok(Utils.circleRectCollide(70, 70, 10, ...rect), 'near corner (dist ~8.5)');
  assert.ok(!Utils.circleRectCollide(72, 72, 10, ...rect), 'beyond corner (dist ~11.3)');
});

test('circleCircleCollide', () => {
  assert.ok(Utils.circleCircleCollide(0, 0, 10, 15, 0, 10));
  assert.ok(!Utils.circleCircleCollide(0, 0, 10, 20, 0, 10), 'touching');
  assert.ok(!Utils.circleCircleCollide(0, 0, 10, 30, 30, 10));
});

test('rectsOverlap', () => {
  const a = { x: 0, y: 0, w: 10, h: 10 };
  assert.ok(Utils.rectsOverlap(a, { x: 5, y: 5, w: 10, h: 10 }));
  assert.ok(Utils.rectsOverlap(a, { x: 2, y: 2, w: 2, h: 2 }), 'contained');
  assert.ok(!Utils.rectsOverlap(a, { x: 10, y: 0, w: 10, h: 10 }), 'shared edge');
  assert.ok(!Utils.rectsOverlap(a, { x: 20, y: 20, w: 5, h: 5 }));
});
