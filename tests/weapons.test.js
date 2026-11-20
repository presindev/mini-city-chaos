'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const CONFIG = require('../src/config.js');
const CityMap = require('../src/map.js');
const Weapons = require('../src/weapons.js');
const Bullet = require('../src/entities/bullet.js');
const Pickup = require('../src/entities/pickup.js');
const Pedestrian = require('../src/entities/pedestrian.js');

const W = CONFIG.WEAPONS;
const SIZE = CONFIG.TILE_SIZE;

// Minimal game stub with the interface Weapons/Bullet need.
function makeGame(targets = []) {
  const game = {
    bullets: [],
    effects: [],
    scared: 0,
    damage: [],
    getTargets: () => targets,
    damageTarget(t, n) { game.damage.push([t, n]); t.takeDamage(n); },
    scareAt() { game.scared++; }
  };
  return game;
}

// Owner in the middle of a horizontal road (free space to the right).
const owner = () => ({ x: 12 * SIZE, y: 8.5 * SIZE, radius: 12 });

test('starts with fists only; cannot select weapons not owned', () => {
  const inv = Weapons.createInventory();
  assert.equal(inv.current, 'FISTS');
  assert.equal(Weapons.select(inv, 1), false);
  assert.equal(inv.current, 'FISTS');
  Weapons.cycle(inv, 1);
  assert.equal(inv.current, 'FISTS');
});

test('pickups give weapon + ammo capped at MAX_AMMO; cycling skips missing weapons', () => {
  const inv = Weapons.createInventory();
  Weapons.addWeapon(inv, 'SHOTGUN', W.SHOTGUN.PICKUP_AMMO);
  assert.equal(inv.ammo.SHOTGUN, 8);
  for (let i = 0; i < 5; i++) Weapons.addWeapon(inv, 'SHOTGUN', W.SHOTGUN.PICKUP_AMMO);
  assert.equal(inv.ammo.SHOTGUN, W.SHOTGUN.MAX_AMMO);
  Weapons.cycle(inv, 1);
  assert.equal(inv.current, 'SHOTGUN');
  Weapons.cycle(inv, 1);
  assert.equal(inv.current, 'FISTS');
  Weapons.cycle(inv, -1);
  assert.equal(inv.current, 'SHOTGUN');
  assert.equal(Weapons.select(inv, 0), true);
  assert.equal(inv.current, 'FISTS');
});

test('cooldown limits the fire rate and ammo is spent', () => {
  const inv = Weapons.createInventory();
  Weapons.addWeapon(inv, 'PISTOL', 2);
  Weapons.select(inv, 1);
  const game = makeGame();
  assert.equal(Weapons.fire(inv, owner(), 0, game), true);
  assert.equal(Weapons.fire(inv, owner(), 0, game), false, 'still cooling down');
  Weapons.update(inv, W.PISTOL.COOLDOWN);
  assert.equal(Weapons.fire(inv, owner(), 0, game), true);
  Weapons.update(inv, W.PISTOL.COOLDOWN);
  assert.equal(inv.ammo.PISTOL, 0);
  assert.equal(Weapons.fire(inv, owner(), 0, game), false, 'no ammo');
  assert.equal(game.bullets.length, 2);
  assert.equal(game.scared, 2, 'gunshots scare pedestrians');
});

test('shotgun fires PELLETS bullets spread over SPREAD degrees', () => {
  const inv = Weapons.createInventory();
  Weapons.addWeapon(inv, 'SHOTGUN', 8);
  Weapons.select(inv, 2);
  const game = makeGame();
  Weapons.fire(inv, owner(), 0, game);
  assert.equal(game.bullets.length, W.SHOTGUN.PELLETS);
  const angles = game.bullets.map((b) => Math.atan2(b.vy, b.vx));
  const spread = (Math.max(...angles) - Math.min(...angles)) * 180 / Math.PI;
  assert.ok(Math.abs(spread - W.SHOTGUN.SPREAD) < 1e-9);
  assert.equal(inv.ammo.SHOTGUN, 7, 'one shell per shot');
});

test('fists hit targets in front within range, not behind or far away', () => {
  const o = owner();
  const front = new Pedestrian(o.x + 30, o.y);
  const behind = new Pedestrian(o.x - 30, o.y - 25);
  const far = new Pedestrian(o.x + 80, o.y);
  const game = makeGame([front, behind, far]);
  const inv = Weapons.createInventory();
  assert.equal(Weapons.fire(inv, o, 0, game), true);
  assert.deepEqual(game.damage.map(([t]) => t), [front]);
  assert.equal(front.health, CONFIG.PEDESTRIAN.HEALTH - W.FISTS.DAMAGE);
  assert.equal(game.bullets.length, 0);
  assert.equal(game.effects[0].kind, 'swing');
});

test('bullets hit the first target, ignore the owner and stop at max range', () => {
  const o = owner();
  const ped = new Pedestrian(o.x + 200, o.y);
  const game = makeGame([o, ped]);
  const b = new Bullet(o.x, o.y, 0, 700, 500, 25, o);
  for (let i = 0; i < 20 && !b.dead; i++) b.update(1 / 60, game);
  assert.ok(b.dead);
  assert.equal(ped.health, CONFIG.PEDESTRIAN.HEALTH - 25);

  const miss = new Bullet(o.x, o.y, Math.PI, 700, 100, 25, o); // left, along the road
  for (let i = 0; i < 60 && !miss.dead; i++) miss.update(1 / 60, makeGame());
  assert.ok(miss.dead);
  assert.ok(Math.abs(o.x - miss.x - 100) < 1e-6, 'travels exactly its range');
});

test('bullets are stopped by buildings', () => {
  // From the sidewalk at tile (2, 4) towards the building at tile (3, 4).
  const b = new Bullet(2.5 * SIZE, 4.5 * SIZE, 0, 700, 500, 25, null);
  const game = makeGame();
  for (let i = 0; i < 60 && !b.dead; i++) b.update(1 / 60, game);
  assert.ok(b.dead);
  assert.ok(b.x < 3 * SIZE + 4, 'dies at the wall');
});

test('pickup gives the weapon, disappears and respawns after RESPAWN_TIME', () => {
  const k = new Pickup(500, 500, 'PISTOL');
  const player = { x: 500, y: 510, radius: 12, inventory: Weapons.createInventory() };
  assert.equal(k.update(0.016, player), true);
  assert.ok(player.inventory.owned.PISTOL);
  assert.equal(player.inventory.ammo.PISTOL, W.PISTOL.PICKUP_AMMO);
  assert.equal(k.update(0.016, player), false, 'inactive');
  k.update(CONFIG.PICKUPS.RESPAWN_TIME, null);
  assert.ok(k.active);
});

test('pickup spots are on sidewalks (4 pistol + 3 shotgun)', () => {
  assert.equal(CONFIG.PICKUPS.PISTOL_TILES.length, 4);
  assert.equal(CONFIG.PICKUPS.SHOTGUN_TILES.length, 3);
  for (const [tx, ty] of [...CONFIG.PICKUPS.PISTOL_TILES, ...CONFIG.PICKUPS.SHOTGUN_TILES]) {
    assert.equal(CityMap.getTile(tx, ty), CONFIG.TILE.SIDEWALK, `tile ${tx},${ty}`);
  }
});
