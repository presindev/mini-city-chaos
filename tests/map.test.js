'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const CONFIG = require('../src/config.js');
const CityMap = require('../src/map.js');

const { ROAD, SIDEWALK, BUILDING, PARK } = CONFIG.TILE;
const SIZE = CONFIG.TILE_SIZE;

test('outer border is solid', () => {
  for (let i = 0; i < CityMap.cols; i++) {
    assert.equal(CityMap.getTile(i, 0), BUILDING);
    assert.equal(CityMap.getTile(i, CityMap.rows - 1), BUILDING);
    assert.equal(CityMap.getTile(0, i), BUILDING);
    assert.equal(CityMap.getTile(CityMap.cols - 1, i), BUILDING);
  }
});

test('out-of-bounds tiles are solid', () => {
  assert.equal(CityMap.getTile(-1, 5), BUILDING);
  assert.equal(CityMap.getTile(5, CityMap.rows), BUILDING);
  assert.equal(CityMap.isSolid(-10, 100), true);
});

test('layout follows the 8-tile pattern', () => {
  assert.equal(CityMap.getTile(1, 1), ROAD);
  assert.equal(CityMap.getTile(8, 5), ROAD);
  assert.equal(CityMap.getTile(2, 2), SIDEWALK);
  assert.equal(CityMap.getTile(7, 4), SIDEWALK);
  assert.equal(CityMap.getTile(3, 3), BUILDING);
  assert.equal(CityMap.getTile(6, 6), BUILDING);
});

test('the configured blocks are parks', () => {
  const parks = CONFIG.MAP.PARK_BLOCKS;
  assert.equal(parks.length, 2);
  for (const [bx, by] of parks) {
    const p = CONFIG.MAP.BLOCK_PERIOD;
    assert.equal(CityMap.getTile(bx * p + 3, by * p + 3), PARK);
    assert.equal(CityMap.getTile(bx * p + 6, by * p + 6), PARK);
  }
  let count = 0;
  for (const t of CityMap.tiles) if (t === PARK) count++;
  assert.equal(count, 2 * 16);
});

test('all road tiles are connected', () => {
  const start = CityMap.randomTileOfType(ROAD, () => 0);
  const seen = new Set([start.ty * CityMap.cols + start.tx]);
  const queue = [start];
  while (queue.length) {
    const { tx, ty } = queue.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = tx + dx;
      const ny = ty + dy;
      const key = ny * CityMap.cols + nx;
      if (CityMap.getTile(nx, ny) === ROAD && !seen.has(key)) {
        seen.add(key);
        queue.push({ tx: nx, ty: ny });
      }
    }
  }
  let roads = 0;
  for (const t of CityMap.tiles) if (t === ROAD) roads++;
  assert.equal(seen.size, roads);
});

test('world queries convert pixels to tiles', () => {
  assert.equal(CityMap.worldToTile(0), 0);
  assert.equal(CityMap.worldToTile(SIZE - 1), 0);
  assert.equal(CityMap.worldToTile(SIZE), 1);
  assert.equal(CityMap.isRoad(SIZE * 1.5, SIZE * 1.5), true);
  assert.equal(CityMap.isSolid(SIZE * 1.5, SIZE * 1.5), false);
  assert.equal(CityMap.isSolid(SIZE * 3.5, SIZE * 3.5), true);
  assert.deepEqual(CityMap.tileCenter(2, 3), { x: 2.5 * SIZE, y: 3.5 * SIZE });
});

test('randomTileOfType returns a tile of the requested type', () => {
  let n = 0;
  const rng = () => (n++ * 0.137) % 1;
  for (let i = 0; i < 20; i++) {
    const t = CityMap.randomTileOfType(SIDEWALK, rng);
    assert.equal(CityMap.getTile(t.tx, t.ty), SIDEWALK);
  }
});

test('player spawn tile is a sidewalk', () => {
  const { tx, ty } = CONFIG.PLAYER.SPAWN_TILE;
  assert.equal(CityMap.getTile(tx, ty), SIDEWALK);
});

test('moveCircle stops at walls and slides along them', () => {
  const r = 12;
  // On the sidewalk at tile (2, 4), walking right into the building at tile 3.
  const x = 2.5 * SIZE;
  const y = 4.5 * SIZE;
  const hit = CityMap.moveCircle(x, y, r, 100, 0);
  assert.ok(hit.x <= 3 * SIZE - r + 1e-9, 'does not enter the building');
  assert.ok(hit.x > 3 * SIZE - r - 2, 'gets close to the wall');
  // Diagonal into the wall: x is blocked but y keeps moving (slide).
  const slide = CityMap.moveCircle(hit.x, y, r, 20, 20);
  assert.equal(slide.y, y + 20);
  assert.ok(!CityMap.circleHitsSolid(slide.x, slide.y, r));
});
