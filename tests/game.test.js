'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Game = require('../src/game.js');
const CONFIG = require('../src/config.js');
const Weapons = require('../src/weapons.js');

// Minimal input stub: `press(code)` makes wasPressed(code) true for one update.
function makeInput() {
  let pressed = new Set();
  return {
    press(code) { pressed.add(code); },
    wasPressed(code) { return pressed.has(code); },
    isDown() { return false; },
    mouse: { x: 0, y: 0 },
    endFrame() { pressed = new Set(); }
  };
}

function step(game, input, dt = 0.016) {
  game.update(dt);
  input.endFrame();
}

test('starts in menu and Enter begins playing', () => {
  const input = makeInput();
  const game = new Game(input);
  assert.equal(game.state, 'menu');
  step(game, input);
  assert.equal(game.state, 'menu');
  input.press('Enter');
  step(game, input);
  assert.equal(game.state, 'playing');
});

test('P toggles pause and time only advances while playing', () => {
  const input = makeInput();
  const game = new Game(input);
  input.press('Enter');
  step(game, input);
  step(game, input, 0.5);
  assert.equal(game.time, 0.5);
  input.press('KeyP');
  step(game, input);
  assert.equal(game.state, 'paused');
  step(game, input, 1);
  assert.equal(game.time, 0.5);
  input.press('KeyP');
  step(game, input);
  assert.equal(game.state, 'playing');
});

test('Enter on game over restarts with a clean state', () => {
  const input = makeInput();
  const game = new Game(input);
  input.press('Enter');
  step(game, input);
  step(game, input, 2);
  game.score = 99;
  game.gameOver();
  assert.equal(game.state, 'gameover');
  input.press('Enter');
  step(game, input);
  assert.equal(game.state, 'playing');
  assert.equal(game.time, 0);
  assert.equal(game.score, 0);
});

test('event bus: on/emit and events from damaging pedestrians', () => {
  const input = makeInput();
  const game = new Game(input);
  input.press('Enter');
  step(game, input);
  const seen = [];
  game.on('pedAttacked', (d) => seen.push(['attacked', d.byPlayer, d.killed]));
  game.on('pedKilled', (d) => seen.push(['killed', d.byPlayer]));
  const [a, b] = game.pedestrians;
  game.damagePedestrian(a, 5, 0, 0, game.player);
  game.damagePedestrian(a, 100, 0, 0, game.player);
  const scoreAfterPlayerKill = game.score;
  game.damagePedestrian(b, 100, 0, 0, { someone: 'else' });
  assert.deepEqual(seen, [
    ['attacked', true, false],
    ['attacked', true, true], ['killed', true],
    ['attacked', false, true], ['killed', false]
  ]);
  assert.equal(scoreAfterPlayerKill, 10);
  assert.equal(game.score, 10, 'kills by others give no points');
});

function fakeStorage(initial = {}) {
  const data = Object.assign({}, initial);
  return {
    data,
    getItem(k) { return k in data ? data[k] : null; },
    setItem(k, v) { data[k] = String(v); }
  };
}

function startedGame(storage) {
  const input = makeInput();
  const game = new Game(input);
  game.storage = storage;
  input.press('Enter');
  step(game, input);
  return { game, input };
}

test('surviving gives PER_SECOND points per full second without losing fractions', () => {
  const { game, input } = startedGame(fakeStorage());
  for (let i = 0; i < 100; i++) step(game, input, 0.025); // ~2.5 s (plus the start frame)
  assert.equal(game.score, 2 * CONFIG.SCORE.PER_SECOND);
  for (let i = 0; i < 20; i++) step(game, input, 0.025); // passes 3 s
  assert.equal(game.score, 3 * CONFIG.SCORE.PER_SECOND);
  input.press('KeyP');
  step(game, input);
  step(game, input, 5);
  assert.equal(game.score, 3 * CONFIG.SCORE.PER_SECOND, 'no points while paused');
});

test('highscore is loaded on start and saved only when beaten at game over', () => {
  const st = fakeStorage({ [CONFIG.HIGHSCORE_KEY]: '50' });
  const { game, input } = startedGame(st);
  assert.equal(game.highscore, 50);
  game.score = 30;
  game.gameOver();
  assert.equal(game.newRecord, false);
  assert.equal(st.data[CONFIG.HIGHSCORE_KEY], '50');

  input.press('Enter');
  step(game, input);
  game.score = 80;
  game.gameOver();
  assert.equal(game.newRecord, true);
  assert.equal(game.highscore, 80);
  assert.equal(st.data[CONFIG.HIGHSCORE_KEY], '80');
  game.gameOver(); // a second call does nothing
  assert.equal(game.state, 'gameover');

  input.press('Enter');
  step(game, input);
  assert.equal(game.highscore, 80, 'record kept for the next run');
  assert.equal(game.newRecord, false);
});

test('a throwing storage does not break game over', () => {
  const bad = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); } };
  const { game } = startedGame(bad);
  assert.equal(game.highscore, 0);
  game.score = 10;
  game.gameOver();
  assert.equal(game.state, 'gameover');
  assert.equal(game.highscore, 10);
});

test('restarting after game over leaves no leftovers from the previous run', () => {
  const { game, input } = startedGame(fakeStorage());
  for (let i = 0; i < 40; i++) step(game, input, 0.05);
  const p = game.player;
  p.health = 5;
  Weapons.addWeapon(p.inventory, 'PISTOL', 24);
  p.inventory.current = 'PISTOL';
  game.bullets.push({ dead: false, update() {}, draw() {} });
  game.effects.push({ kind: 'flash', x: 0, y: 0, angle: 0, time: 1 });
  game.pickups[0].active = false;
  game.damagePedestrian(game.pedestrians[0], 1000);
  game.gameOver();
  input.press('Enter');
  step(game, input, 0);

  assert.equal(game.state, 'playing');
  assert.equal(game.time, 0);
  assert.equal(game.score, 0);
  assert.equal(game.scoreTimer, 0);
  assert.notEqual(game.player, p);
  assert.equal(game.player.health, CONFIG.PLAYER.MAX_HEALTH);
  assert.deepEqual(game.player.inventory.owned, { FISTS: true, PISTOL: false, SHOTGUN: false });
  assert.equal(game.player.inventory.current, 'FISTS');
  assert.equal(game.bullets.length, 0);
  assert.equal(game.effects.length, 0);
  assert.ok(game.pickups.every((k) => k.active));
  assert.equal(game.pedestrians.length, CONFIG.PEDESTRIAN.COUNT);
  assert.ok(game.pedestrians.every((ped) => !ped.dead));
});
