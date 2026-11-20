'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const CONFIG = require('../src/config.js');
const CityMap = require('../src/map.js');
const Pedestrian = require('../src/entities/pedestrian.js');
const Game = require('../src/game.js');

const PED = CONFIG.PEDESTRIAN;
const { BUILDING, ROAD } = CONFIG.TILE;

// Small deterministic PRNG (mulberry32).
function seeded(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeInput() {
  return { wasPressed: () => false, isDown: () => false, mouse: { x: 0, y: 0 }, wheel: 0 };
}

test('calm pedestrians never enter buildings or roads', () => {
  const rng = seeded(1);
  for (let n = 0; n < 10; n++) {
    const tile = CityMap.randomTileOfType(CONFIG.TILE.SIDEWALK, rng);
    const pos = CityMap.tileCenter(tile.tx, tile.ty);
    const p = new Pedestrian(pos.x, pos.y, rng);
    for (let i = 0; i < 600; i++) {
      p.update(1 / 30);
      const t = CityMap.getTile(CityMap.worldToTile(p.x), CityMap.worldToTile(p.y));
      assert.notEqual(t, BUILDING);
      assert.notEqual(t, ROAD);
      assert.ok(!CityMap.circleHitsSolid(p.x, p.y, p.radius));
    }
  }
});

test('scare makes it flee away at flee speed for FLEE_TIME', () => {
  const p = new Pedestrian(12 * 64, 8.5 * 64, seeded(2)); // middle of a road: free space
  p.scare(p.x - 100, p.y);
  assert.ok(p.fleeing);
  assert.equal(p.angle, 0); // away from the threat (+x)
  const x0 = p.x;
  p.update(0.1);
  assert.ok(Math.abs(p.x - x0 - PED.FLEE_SPEED * 0.1) < 1e-9);
  for (let i = 0; i < 40; i++) p.update(0.1);
  assert.ok(!p.fleeing);
});

test('takeDamage kills at 0 health, body disappears after CORPSE_TIME', () => {
  const p = new Pedestrian(500, 500, seeded(3));
  assert.equal(p.takeDamage(20, 0, 0), false);
  assert.ok(p.fleeing, 'survivors flee');
  assert.equal(p.takeDamage(20, 0, 0), true);
  assert.ok(p.dead);
  assert.equal(p.takeDamage(20, 0, 0), false, 'already dead');
  p.update(PED.CORPSE_TIME - 0.1);
  assert.ok(!p.remove);
  p.update(0.2);
  assert.ok(p.remove);
});

test('game keeps COUNT pedestrians alive, spawned out of view, and scores kills', () => {
  const game = new Game(makeInput(), seeded(4));
  game.start();
  const alive = () => game.pedestrians.filter((p) => !p.dead);
  assert.equal(alive().length, PED.COUNT);
  for (const p of game.pedestrians) assert.ok(!game.isOnScreen(p.x, p.y));

  const victim = alive()[0];
  game.damagePedestrian(victim, 100);
  assert.equal(game.score, CONFIG.SCORE.PEDESTRIAN);
  game.update(0.016);
  assert.equal(alive().length, PED.COUNT, 'a replacement spawns');
});

test('scareAt only scares pedestrians within the radius', () => {
  const game = new Game(makeInput(), seeded(5));
  game.start();
  const [near, far] = game.pedestrians;
  near.x = 1000; near.y = 1000;
  far.x = 1500; far.y = 1000;
  game.scareAt(1000, 1100, 250);
  assert.ok(near.fleeing);
  assert.ok(!far.fleeing);
});
