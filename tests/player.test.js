'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const CONFIG = require('../src/config.js');
const CityMap = require('../src/map.js');
const Camera = require('../src/camera.js');
const Player = require('../src/entities/player.js');

const SIZE = CONFIG.TILE_SIZE;

function makeGame(keys, mouse = { x: 0, y: 0 }) {
  const camera = new Camera(CityMap.width, CityMap.height);
  return {
    camera,
    input: { isDown: (code) => keys.includes(code), wasPressed: () => false, wheel: 0, mouse }
  };
}

test('moves at the configured speed and diagonals are not faster', () => {
  // Middle of a horizontal road: free space around.
  const p = new Player(12 * SIZE, 8.5 * SIZE);
  p.update(0.1, makeGame(['KeyD']));
  assert.ok(Math.abs(p.x - (12 * SIZE + CONFIG.PLAYER.SPEED * 0.1)) < 1e-9);

  const q = new Player(12 * SIZE, 8.5 * SIZE);
  q.update(0.1, makeGame(['KeyD', 'KeyS']));
  const moved = Math.hypot(q.x - 12 * SIZE, q.y - 8.5 * SIZE);
  assert.ok(Math.abs(moved - CONFIG.PLAYER.SPEED * 0.1) < 1e-9);
});

test('cannot walk into buildings', () => {
  const { tx, ty } = CONFIG.PLAYER.SPAWN_TILE; // sidewalk left of a building
  const start = CityMap.tileCenter(tx, ty);
  const p = new Player(start.x, start.y);
  const game = makeGame(['KeyD']);
  for (let i = 0; i < 60; i++) p.update(0.05, game);
  assert.ok(!CityMap.circleHitsSolid(p.x, p.y, p.radius));
  assert.ok(p.x <= (tx + 1) * SIZE - p.radius + 1e-9);
});

test('faces the mouse in world coordinates', () => {
  const p = new Player(1000, 1000);
  const game = makeGame([]);
  game.camera.follow(p.x, p.y);
  const screen = game.camera.worldToScreen(p.x, p.y + 100); // straight below
  game.input.mouse = screen;
  p.update(0.016, game);
  assert.ok(Math.abs(p.angle - Math.PI / 2) < 1e-9);
});
