'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const CONFIG = require('../src/config.js');
const CityMap = require('../src/map.js');
const Police = require('../src/entities/police.js');

const SIZE = CONFIG.TILE_SIZE;
const POL = CONFIG.POLICE;
const rng0 = () => 0;

// Small deterministic generator for tests that need varied random numbers.
function seeded(seed) {
  return () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
}

// Stub with only what Police.update needs.
function makeGame(px, py) {
  const events = [];
  return {
    player: { x: px, y: py, radius: 12 },
    bullets: [],
    effects: [],
    events,
    emit(name, data) { events.push([name, data]); }
  };
}

test('chases the player and stops at KEEP_DISTANCE', () => {
  // Horizontal road at row 8: free line between both.
  const cop = new Police(4 * SIZE, 8.5 * SIZE, rng0);
  const game = makeGame(20 * SIZE, 8.5 * SIZE);
  const d0 = Math.hypot(game.player.x - cop.x, game.player.y - cop.y);
  cop.update(0.5, game);
  const d1 = Math.hypot(game.player.x - cop.x, game.player.y - cop.y);
  assert.ok(Math.abs(d0 - d1 - POL.SPEED * 0.5) < 1e-6);
  for (let i = 0; i < 400; i++) cop.update(0.05, game);
  const d2 = Math.hypot(game.player.x - cop.x, game.player.y - cop.y);
  assert.ok(d2 <= POL.KEEP_DISTANCE + 1 && d2 > POL.KEEP_DISTANCE - POL.SPEED * 0.05 - 1);
});

test('never walks through buildings and gets around a block', () => {
  // Cop on the sidewalk left of a block, player on the sidewalk right of it.
  const cop = new Police(2.5 * SIZE, 5.5 * SIZE, seeded(7));
  const game = makeGame(7.5 * SIZE, 5.5 * SIZE);
  let reached = false;
  for (let i = 0; i < 600; i++) {
    cop.update(0.05, game);
    assert.ok(!CityMap.circleHitsSolid(cop.x, cop.y, cop.radius));
    if (Math.hypot(game.player.x - cop.x, game.player.y - cop.y) <= POL.KEEP_DISTANCE + 1) reached = true;
  }
  assert.ok(reached, 'ends up next to the player');
});

test('shoots only in range and respects the fire cooldown', () => {
  const cop = new Police(10 * SIZE, 8.5 * SIZE, rng0);
  cop.leaving = false;
  const far = makeGame(10 * SIZE + POL.SHOOT_RANGE + 200, 8.5 * SIZE);
  cop.update(0.01, far);
  assert.equal(far.bullets.length, 0);

  const cop2 = new Police(10 * SIZE, 8.5 * SIZE, rng0);
  const near = makeGame(10 * SIZE + 200, 8.5 * SIZE);
  cop2.update(0.01, near);
  assert.equal(near.bullets.length, 1);
  assert.equal(near.bullets[0].owner, cop2);
  assert.equal(near.bullets[0].damage, POL.DAMAGE);
  assert.equal(near.events.filter((e) => e[0] === 'copShot').length, 1);
  cop2.update(POL.FIRE_COOLDOWN * 0.5, near);
  assert.equal(near.bullets.length, 1, 'still cooling down');
  cop2.update(POL.FIRE_COOLDOWN * 0.6, near);
  assert.equal(near.bullets.length, 2);
});

test('vision is a plain radius', () => {
  const cop = new Police(100, 100, rng0);
  assert.ok(cop.canSee(100 + CONFIG.WANTED.VISION_RADIUS, 100));
  assert.ok(!cop.canSee(100 + CONFIG.WANTED.VISION_RADIUS + 1, 100));
});

test('takes damage, dies at 0 health and its body disappears', () => {
  const cop = new Police(100, 100, rng0);
  assert.equal(cop.takeDamage(POL.HEALTH - 1), false);
  assert.equal(cop.takeDamage(1), true);
  assert.ok(cop.dead);
  assert.equal(cop.takeDamage(10), false);
  const game = makeGame(200, 100);
  cop.update(POL.CORPSE_TIME + 0.1, game);
  assert.ok(cop.remove);
  assert.equal(game.bullets.length, 0, 'dead cops do not shoot');
});

test('leaving cops walk away and do not shoot', () => {
  const cop = new Police(10 * SIZE, 8.5 * SIZE, rng0);
  cop.leaving = true;
  const game = makeGame(10 * SIZE + 150, 8.5 * SIZE);
  const d0 = game.player.x - cop.x;
  for (let i = 0; i < 20; i++) cop.update(0.05, game);
  assert.ok(game.player.x - cop.x > d0);
  assert.equal(game.bullets.length, 0);
});

// ---- Player damage ----
const Player = require('../src/entities/player.js');

test('player takes full damage on foot and half inside a car', () => {
  const p = new Player(100, 100);
  assert.equal(p.takeDamage(10), 10);
  assert.equal(p.health, CONFIG.PLAYER.MAX_HEALTH - 10);
  p.inCar = {}; // set by F5 while driving
  assert.equal(p.takeDamage(10), 10 * CONFIG.CAR.PLAYER_DAMAGE_FACTOR);
  assert.equal(p.health, CONFIG.PLAYER.MAX_HEALTH - 15);
  p.takeDamage(1000);
  assert.equal(p.health, 0);
  assert.ok(p.dead);
});

// ---- Integration with Game (spawner, wanted level, damage) ----
const Game = require('../src/game.js');

function startGame() {
  const input = {
    pressed: new Set(['Enter']),
    wasPressed(code) { return this.pressed.has(code); },
    isDown() { return false; },
    wheel: 0,
    mouse: { x: 0, y: 0, down: false }
  };
  const game = new Game(input, seeded(3));
  game.update(0.016);
  input.pressed = new Set();
  return game;
}

const activeCops = (game) => game.police.filter((c) => !c.dead && !c.leaving);

test('attacking a pedestrian gives 1 star and spawns that many cops off-screen', () => {
  const game = startGame();
  const changes = [];
  game.on('wantedChanged', (d) => changes.push([d.stars, d.prev]));
  assert.equal(game.wanted.stars, 0);
  game.update(0.016);
  assert.equal(game.police.length, 0, 'no cops at 0 stars');
  game.damagePedestrian(game.pedestrians[0], 5, 0, 0, game.player);
  assert.equal(game.wanted.stars, 1);
  assert.deepEqual(changes, [[1, 0]]);
  game.update(0.016);
  assert.equal(activeCops(game).length, CONFIG.WANTED.FOOT_COPS[1]);
  for (const c of game.police) {
    assert.ok(!game.isOnScreen(c.x, c.y, POL.SPAWN_MARGIN - 1));
    assert.ok(!CityMap.circleHitsSolid(c.x, c.y, c.radius));
  }
  // Attacks by someone else do not count.
  const other = startGame();
  other.damagePedestrian(other.pedestrians[0], 5, 0, 0, { cop: true });
  assert.equal(other.wanted.stars, 0);
});

test('the number of cops follows the FOOT_COPS table', () => {
  const game = startGame();
  for (let stars = 1; stars <= 3; stars++) {
    game.wanted.setStars(stars);
    game.update(0.016);
    assert.equal(activeCops(game).length, CONFIG.WANTED.FOOT_COPS[stars]);
  }
  game.wanted.setStars(1);
  game.update(0.016);
  assert.equal(activeCops(game).length, CONFIG.WANTED.FOOT_COPS[1], 'extra cops leave');
});

test('with 0 stars cops stop chasing and disappear off-screen', () => {
  const game = startGame();
  game.wanted.setStars(2);
  game.update(0.016);
  assert.ok(game.police.length > 0);
  game.wanted.setStars(0);
  game.update(0.016);
  assert.equal(activeCops(game).length, 0);
  assert.equal(game.police.length, 0, 'they were already off-screen');
});

test('killing a cop gives points, +1 star and copKilled; cops do not hurt each other', () => {
  const game = startGame();
  game.wanted.setStars(1);
  game.update(0.016);
  const [a, b] = game.police;
  const killed = [];
  game.on('copKilled', (d) => killed.push(d.cop));
  game.damageTarget(a, 999, 0, 0, b);
  assert.ok(!a.dead, 'friendly fire is ignored');
  const score = game.score;
  game.damageTarget(a, 999, 0, 0, game.player);
  assert.ok(a.dead);
  assert.deepEqual(killed, [a]);
  assert.equal(game.score, score + CONFIG.SCORE.POLICE);
  assert.equal(game.wanted.stars, 2);
  assert.ok(game.getTargets().includes(b), 'cops can be hit by bullets and fists');
});

test('cop bullets hurt the player and killing him ends the run', () => {
  const game = startGame();
  const events = [];
  game.on('playerHurt', (d) => events.push(['hurt', d.amount, d.health]));
  game.on('playerDied', () => events.push(['died']));
  const cop = new Police(game.player.x + 100, game.player.y, rng0);
  game.damageTarget(game.player, 30, 0, 0, game.player);
  assert.equal(game.player.health, CONFIG.PLAYER.MAX_HEALTH, 'own damage is ignored');
  game.damageTarget(game.player, 30, 0, 0, cop);
  assert.deepEqual(events, [['hurt', 30, 70]]);
  game.damageTarget(game.player, 80, 0, 0, cop);
  assert.deepEqual(events.slice(1), [['hurt', 80, 0], ['died']]);
  assert.equal(game.state, 'gameover');
  game.damageTarget(game.player, 10, 0, 0, cop);
  assert.equal(events.length, 3, 'no more events once dead');
});

test('a cop in range ends up killing a player who stands still', () => {
  const game = startGame();
  game.wanted.setStars(1);
  game.police = [new Police(game.player.x, game.player.y - 200, seeded(5))];
  let seconds = 0;
  while (game.state === 'playing' && seconds < 120) {
    game.update(0.05);
    seconds += 0.05;
  }
  assert.equal(game.state, 'gameover');
  assert.ok(seconds > 5, 'takes a while (' + seconds.toFixed(1) + ' s)');
});

test('loses a star after hiding from the police for LOSE_STAR_TIME', () => {
  const game = startGame();
  game.wanted.setStars(1);
  const t = CONFIG.WANTED.LOSE_STAR_TIME;
  // Nobody watching: drop the cops the spawner adds every frame.
  for (let s = 0; s < t - 0.5; s += 0.05) { game.update(0.05); game.police = []; }
  assert.equal(game.wanted.stars, 1);
  for (let s = 0; s < 1; s += 0.05) { game.update(0.05); game.police = []; }
  assert.equal(game.wanted.stars, 0);
});
