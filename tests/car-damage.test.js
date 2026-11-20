'use strict';

// MCC-001 car-damage-explosions: one group per acceptance criterion (AC-001 .. AC-011).
// AC-012 (HUD bar, visuals, sounds) is a manual in-browser check.

const test = require('node:test');
const assert = require('node:assert/strict');
const CONFIG = require('../src/config.js');
const Car = require('../src/entities/car.js');
const Bullet = require('../src/entities/bullet.js');
const Pedestrian = require('../src/entities/pedestrian.js');
const Police = require('../src/entities/police.js');
const Weapons = require('../src/weapons.js');
const Effects = require('../src/effects.js');
const Game = require('../src/game.js');

const SIZE = CONFIG.TILE_SIZE;
const CAR = CONFIG.CAR;
const SCORE = CONFIG.SCORE;
// Eastbound lane of the horizontal road at tiles ty = 8, 9 (far from the player spawn).
const LANE_Y = 9.5 * SIZE;
const X0 = 12 * SIZE;

function seeded(seed = 1) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
}

function makeInput() {
  let pressed = new Set();
  return {
    press(code) { pressed.add(code); },
    wasPressed(code) { return pressed.has(code); },
    isDown() { return false; },
    wheel: 0,
    mouse: { x: 0, y: 0, down: false },
    endFrame() { pressed = new Set(); }
  };
}

// Playing game with no traffic, pedestrians or police (tests add what they need).
function makeGame() {
  const input = makeInput();
  const game = new Game(input, seeded(3));
  game.start();
  game.cars = [];
  game.pedestrians = [];
  game.police = [];
  game.isOnScreen = () => true; // spawners only use off-screen spots -> nothing spawns
  game.spawnPedestrians = () => {};
  const events = [];
  for (const name of ['carBurning', 'carExploded', 'bulletImpact', 'carCrash']) {
    game.on(name, (d) => events.push([name, d]));
  }
  return { game, input, events };
}

const count = (events, name) => events.filter(([n]) => n === name).length;

function addCar(game, x = X0, y = LANE_Y, angle = 0) {
  const car = new Car(x, y, angle);
  game.cars.push(car);
  return car;
}

// Puts the player at the wheel of `car`.
function drive(game, car) {
  const p = game.player;
  car.driver = 'player';
  p.inCar = car;
  p.x = car.x;
  p.y = car.y;
}

// Flies a bullet until it dies.
function flyBullet(game, b) {
  game.bullets.push(b);
  for (let i = 0; i < 120 && !b.dead; i++) b.update(1 / 60, game);
  return b;
}

const pistol = CONFIG.WEAPONS.PISTOL;
const playerBullet = (game, x, y, angle = 0) =>
  new Bullet(x, y, angle, pistol.BULLET_SPEED, pistol.RANGE, pistol.DAMAGE, game.player);

const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

test('AC-001: new traffic and patrol cars start with CAR.HEALTH', () => {
  assert.equal(new Car(0, 0).health, CAR.HEALTH);
  const traffic = Car.randomTrafficCar(seeded(5)) || Car.randomTrafficCar(seeded(6));
  assert.ok(traffic);
  assert.equal(traffic.health, CAR.HEALTH);
  const patrol = Police.createPatrolCar(0, 0, 0);
  assert.equal(patrol.health, CAR.HEALTH);
  assert.equal(patrol.isBurning(), false);
  assert.equal(patrol.wreck, false);
});

test('AC-002: a pistol bullet stops at the car body and costs 25; four set it on fire', () => {
  const { game, events } = makeGame();
  const car = addCar(game, X0 + 200);
  const b = flyBullet(game, playerBullet(game, X0, LANE_Y));
  assert.ok(b.dead);
  assert.equal(car.distanceTo(b.x, b.y), 0, 'stopped inside the body');
  assert.ok(b.x < car.x, 'did not go through');
  assert.equal(car.health, CAR.HEALTH - pistol.DAMAGE);
  const impact = events.find(([n]) => n === 'bulletImpact')[1];
  assert.equal(impact.car, car);
  assert.equal(impact.target, null);
  for (let i = 0; i < 3; i++) flyBullet(game, playerBullet(game, X0, LANE_Y));
  assert.equal(car.health, 0);
  assert.ok(car.isBurning());
  assert.equal(car.burnTimer, CAR.BURN_TIME);
  assert.equal(count(events, 'carBurning'), 1);
  assert.equal(car.byPlayer, true);
});

test('AC-002/EDGE-006: fists do not damage cars', () => {
  const { game } = makeGame();
  const car = addCar(game);
  const p = game.player;
  p.x = car.x;
  p.y = car.y - CAR.HEIGHT / 2 - p.radius - 2;
  const inv = Weapons.createInventory();
  assert.equal(Weapons.fire(inv, p, Math.PI / 2, game), true);
  assert.equal(car.health, CAR.HEALTH);
});

test('AC-003: police bullets hit the car the player drives, not the player', () => {
  const { game } = makeGame();
  const car = addCar(game);
  drive(game, car);
  const cop = new Police(car.x - 150, car.y, seeded(2));
  game.police.push(cop);
  const pol = CONFIG.POLICE;
  const b = flyBullet(game, new Bullet(cop.x + 16, cop.y, 0, pol.BULLET_SPEED, pol.BULLET_RANGE, pol.DAMAGE, cop));
  assert.ok(b.dead);
  assert.equal(car.health, CAR.HEALTH - pol.DAMAGE);
  assert.equal(game.player.health, CONFIG.PLAYER.MAX_HEALTH);
  assert.equal(car.byPlayer, false);
});

test('AC-004: a carCrash with impact 200 costs 20 health; crash attribution', () => {
  const { game, events } = makeGame();
  const car = addCar(game);
  car.crash(200, game);
  assert.equal(count(events, 'carCrash'), 1);
  assert.equal(car.health, CAR.HEALTH - 200 * CAR.CRASH_DAMAGE_FACTOR);
  assert.equal(car.health, 80);
  assert.equal(car.byPlayer, false, 'wall crash of a parked car is not the player');
  car.crash(200, game);
  assert.equal(car.health, 80, 'no damage without a carCrash (cooldown)');
  car.crash(CAR.CRASH_SPEED - 1, game);
  assert.equal(car.health, 80, 'small bumps do nothing');

  // Car-car crash where the player drives one of them: both are the player's.
  const mine = addCar(game, X0 + 300);
  drive(game, mine);
  const other = addCar(game, X0 + 300 + CAR.WIDTH - 10);
  mine.speed = 200;
  Car.resolveCollisions(game);
  assert.ok(other.health < CAR.HEALTH && mine.health < CAR.HEALTH);
  assert.equal(other.byPlayer, true);
  assert.equal(mine.byPlayer, true);
});

test('AC-005/EDGE-001: after BURN_TIME a burning car becomes a wreck, carExploded fires once', () => {
  const { game, input, events } = makeGame();
  const car = addCar(game);
  game.damageCar(car, CAR.HEALTH, game.player);
  assert.ok(car.isBurning());
  const dt = 0.05;
  for (let t = 0; t < CAR.BURN_TIME / 2; t += dt) { game.update(dt); input.endFrame(); }
  const timer = car.burnTimer;
  game.damageCar(car, 50, game.player);
  flyBullet(game, playerBullet(game, X0 - 150, LANE_Y));
  assert.equal(car.burnTimer, timer, 'extra damage does not change the burn timer');
  assert.equal(count(events, 'carBurning'), 1);
  for (let t = 0; t < CAR.BURN_TIME / 2 + 0.2; t += dt) { game.update(dt); input.endFrame(); }
  assert.equal(car.wreck, true);
  assert.equal(car.isBurning(), false);
  assert.equal(car.driver, null);
  assert.equal(count(events, 'carExploded'), 1);
  for (let i = 0; i < 20; i++) { game.update(dt); input.endFrame(); }
  assert.equal(count(events, 'carExploded'), 1, 'only once');
  assert.ok(game.cars.includes(car), 'wreck stays while on screen');
});

test('AC-006/EDGE-005: civilian drivers flee a burning car; patrol cars keep driving', () => {
  const { game } = makeGame();
  const car = addCar(game);
  car.driver = 'ai';
  game.damageCar(car, CAR.HEALTH, game.player);
  assert.equal(car.driver, null);
  assert.equal(game.pedestrians.length, 1);
  const ped = game.pedestrians[0];
  assert.ok(ped.fleeing);
  assert.ok(car.distanceTo(ped.x, ped.y) > 0, 'beside the car');

  const patrol = Police.createPatrolCar(X0 + 300, LANE_Y, 0);
  game.cars.push(patrol);
  game.damageCar(patrol, CAR.HEALTH, game.player);
  assert.ok(patrol.isBurning());
  assert.equal(patrol.driver, 'ai');
  assert.equal(game.pedestrians.length, 1, 'no one gets out of a patrol car');
  assert.ok(game.patrolCars().includes(patrol), 'a burning patrol car still counts');
  game.explodeCar(patrol);
  assert.ok(!game.patrolCars().includes(patrol), 'a wreck does not count');
});

test('EDGE-004: burning cars survive the off-screen cleanup; wrecks do not', () => {
  const { game } = makeGame();
  const car = addCar(game);
  game.damageCar(car, CAR.HEALTH, game.player);
  game.isOnScreen = () => false;
  game.spawnPatrolCars = () => {};
  Car.updateAll(0.01, game);
  assert.ok(game.cars.includes(car));
  game.explodeCar(car);
  Car.updateAll(0.01, game);
  assert.ok(!game.cars.includes(car));
});

test('AC-007/EDGE-002: explosion damage falls off with distance and chains to other cars', () => {
  const { game, events } = makeGame();
  const car = addCar(game);
  const R = CAR.EXPLOSION_RADIUS;
  const fall = (d) => CAR.EXPLOSION_DAMAGE * (1 - d / R);
  const ped = new Pedestrian(car.x, car.y - 100, seeded(1));
  const far = new Pedestrian(car.x, car.y - R - 5, seeded(1));
  game.pedestrians.push(ped, far);
  const cop = new Police(car.x - 90, car.y, seeded(1));
  game.police.push(cop);
  const p = game.player;
  p.x = car.x;
  p.y = car.y + 60;
  const other = addCar(game, car.x + 30 + CAR.WIDTH / 2, car.y); // body 30 px from the centre
  const weak = addCar(game, car.x, car.y - 50, 0);
  weak.health = 10;
  game.damageCar(car, CAR.HEALTH, game.player);
  game.explodeCar(car);

  assert.ok(near(ped.health, CONFIG.PEDESTRIAN.HEALTH - fall(100)));
  assert.equal(far.health, CONFIG.PEDESTRIAN.HEALTH, 'outside the radius');
  assert.ok(near(cop.health, CONFIG.POLICE.HEALTH - fall(90)));
  assert.ok(near(p.health, CONFIG.PLAYER.MAX_HEALTH - fall(60)));
  assert.ok(near(other.health, CAR.HEALTH - fall(30)));
  assert.equal(weak.health, 0);
  assert.equal(weak.burnTimer, CAR.BURN_TIME, 'chained car burns for a full BURN_TIME');
  assert.equal(weak.byPlayer, true, 'chain from a player-attributed explosion');
  const ex = events.find(([n]) => n === 'carExploded')[1];
  assert.equal(ex.car, car);
  assert.equal(ex.x, car.x);
  assert.equal(ex.byPlayer, true);
});

test('AC-008/EDGE-007: a player still inside is thrown out and takes the full damage', () => {
  const { game } = makeGame();
  const car = addCar(game);
  drive(game, car);
  game.damageCar(car, CAR.HEALTH);
  game.explodeCar(car);
  const p = game.player;
  assert.equal(p.inCar, null);
  assert.equal(car.driver, null);
  assert.ok(car.distanceTo(p.x, p.y) > 0, 'beside the car');
  assert.equal(p.health, CONFIG.PLAYER.MAX_HEALTH - CAR.EXPLOSION_DAMAGE, 'not halved');

  // Leaving in time: damaged as an on-foot target, only within the radius.
  const g2 = makeGame().game;
  const c2 = addCar(g2);
  drive(g2, c2);
  g2.damageCar(c2, CAR.HEALTH);
  assert.equal(g2.player.exitCar(g2), true);
  g2.player.x = c2.x + CAR.EXPLOSION_RADIUS + 10;
  g2.explodeCar(c2);
  assert.equal(g2.player.health, CONFIG.PLAYER.MAX_HEALTH);
});

test('AC-009: burning cars and wrecks cannot be entered; wrecks vanish after WRECK_TIME', () => {
  const { game, input } = makeGame();
  const car = addCar(game);
  const p = game.player;
  p.x = car.x;
  p.y = car.y - CAR.HEIGHT / 2 - p.radius - 4;
  game.damageCar(car, CAR.HEALTH, game.player);
  assert.equal(p.enterNearestCar(game), null);
  game.explodeCar(car);
  p.x = car.x;
  p.y = car.y - CAR.HEIGHT / 2 - p.radius - 4;
  p.health = CONFIG.PLAYER.MAX_HEALTH;
  assert.equal(p.enterNearestCar(game), null);
  assert.equal(p.inCar, null);
  // A wreck stops bullets without damage.
  const b = flyBullet(game, playerBullet(game, car.x - 150, car.y));
  assert.ok(b.dead && car.distanceTo(b.x, b.y) === 0);
  assert.equal(car.health, 0);
  assert.equal(car.wreck, true);
  // Immobile in collisions.
  const pusher = addCar(game, car.x + CAR.WIDTH - 10, car.y);
  const before = { x: car.x, y: car.y };
  Car.resolveCollisions(game);
  assert.deepEqual({ x: car.x, y: car.y }, before);
  game.cars = game.cars.filter((c) => c !== pusher);
  for (let t = 0; t < CAR.WRECK_TIME + 0.1; t += 0.05) { game.update(0.05); input.endFrame(); }
  assert.ok(!game.cars.includes(car));
});

test('AC-010: rewards for player-destroyed cars only', () => {
  // Civilian car shot by the player: +SCORE.CAR, at least 1 star.
  let { game } = makeGame();
  let car = addCar(game);
  for (let i = 0; i < 4; i++) flyBullet(game, playerBullet(game, X0 - 150, LANE_Y));
  assert.ok(car.isBurning());
  let score = game.score;
  game.explodeCar(car);
  assert.equal(game.score - score, SCORE.CAR);
  assert.equal(SCORE.CAR, 20);
  assert.equal(game.wanted.stars, 1);

  // Patrol car shot by the player: +SCORE.PATROL_CAR, +1 star.
  ({ game } = makeGame());
  game.wanted.setStars(2);
  car = Police.createPatrolCar(X0, LANE_Y, 0);
  game.cars.push(car);
  for (let i = 0; i < 4; i++) flyBullet(game, playerBullet(game, X0 - 150, LANE_Y));
  score = game.score;
  game.explodeCar(car);
  assert.equal(game.score - score, SCORE.PATROL_CAR);
  assert.equal(SCORE.PATROL_CAR, 100);
  assert.equal(game.wanted.stars, 3);

  // Set on fire while the player drove it: nothing, even if the player did it.
  ({ game } = makeGame());
  car = addCar(game);
  drive(game, car);
  car.health = 10;
  car.crash(200, game);
  assert.ok(car.isBurning());
  assert.equal(car.noReward, true);
  game.player.exitCar(game);
  score = game.score;
  game.explodeCar(car);
  assert.equal(game.score, score);
  assert.equal(game.wanted.stars, 0);

  // Burnt by police fire: nothing.
  ({ game } = makeGame());
  car = addCar(game);
  const cop = new Police(X0 - 150, LANE_Y, seeded(4));
  const pol = CONFIG.POLICE;
  for (let i = 0; i < 20 && !car.isBurning(); i++) {
    flyBullet(game, new Bullet(cop.x + 16, cop.y, 0, pol.BULLET_SPEED, pol.BULLET_RANGE, pol.DAMAGE, cop));
  }
  assert.ok(car.isBurning());
  assert.equal(car.byPlayer, false);
  score = game.score;
  game.explodeCar(car);
  assert.equal(game.score, score);
  assert.equal(game.wanted.stars, 0);
});

test('AC-011: explosion kills score only when the explosion is the player\'s', () => {
  // Not the player's: cop dies, no score, no stars.
  let { game } = makeGame();
  let car = addCar(game);
  let cop = new Police(car.x - 10, car.y - 30, seeded(1));
  game.police.push(cop);
  const ped = new Pedestrian(car.x + 10, car.y - 30, seeded(1));
  game.pedestrians.push(ped);
  game.damageCar(car, CAR.HEALTH, cop);
  let score = game.score;
  game.explodeCar(car);
  assert.ok(cop.dead && ped.dead);
  assert.equal(game.score, score);
  assert.equal(game.wanted.stars, 0);

  // The player's: cop scores SCORE.POLICE on top of the car.
  ({ game } = makeGame());
  car = addCar(game);
  cop = new Police(car.x - 10, car.y - 30, seeded(1));
  game.police.push(cop);
  game.damageCar(car, CAR.HEALTH, game.player);
  score = game.score;
  game.explodeCar(car);
  assert.ok(cop.dead);
  assert.equal(game.score - score, SCORE.CAR + SCORE.POLICE);
  // design.md order: kills first (cop: +1 star), then the civilian car ensures >= 1 star.
  assert.equal(game.wanted.stars, 1);
});

test('NFR-001: smoke, fire and explosion particles stay within MAX_PARTICLES', () => {
  const effects = [];
  const car = { x: 0, y: 0 };
  for (let i = 0; i < 10; i++) Effects.explosion(effects, 0, 0);
  for (let i = 0; i < 200; i++) {
    Effects.fire(effects, car, 0.1);
    Effects.smoke(effects, car, 0.1);
  }
  assert.ok(Effects.countParticles(effects) <= CONFIG.EFFECTS.MAX_PARTICLES);
  assert.ok(Effects.countParticles(effects) > 0);
});

// Review NBK-1: the minimap does not draw wrecked patrol cars as patrol markers.
test('NBK-1: minimap skips wrecked patrol cars', () => {
  const Hud = require('../src/hud.js');
  const { game } = makeGame();
  const live = addCar(game, X0, LANE_Y);
  live.isPolice = true;
  const wrecked = addCar(game, X0 + 4 * SIZE, LANE_Y);
  wrecked.isPolice = true;
  wrecked.wreck = true;
  let patrolMarkers = 0;
  const ctx = new Proxy({}, {
    get(target, key) {
      if (key in target) return target[key];
      if (key === 'fillRect') {
        return () => { if (target.fillStyle === CONFIG.HUD.MINIMAP_COLORS.PATROL) patrolMarkers++; };
      }
      return () => {};
    },
    set(target, key, value) { target[key] = value; return true; }
  });
  Hud.drawMinimap(ctx, game);
  assert.equal(patrolMarkers, 1);
});
