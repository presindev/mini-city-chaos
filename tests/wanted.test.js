'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const CONFIG = require('../src/config.js');
const Wanted = require('../src/wanted.js');

const LOSE = CONFIG.WANTED.LOSE_STAR_TIME;

test('starts at 0 stars; attacking a pedestrian gives at least 1', () => {
  const w = new Wanted();
  assert.equal(w.stars, 0);
  w.pedAttacked();
  assert.equal(w.stars, 1);
  w.pedAttacked();
  assert.equal(w.stars, 1, 'more attacks do not add stars');
  w.copKilled();
  w.pedAttacked();
  assert.equal(w.stars, 2, 'attacking does not lower the level');
});

test('killing cops adds one star each, up to 3', () => {
  const w = new Wanted();
  w.copKilled();
  assert.equal(w.stars, 1);
  w.copKilled();
  w.copKilled();
  w.copKilled();
  assert.equal(w.stars, CONFIG.WANTED.MAX_STARS);
});

test('loses a star after LOSE_STAR_TIME unseen and the timer restarts', () => {
  const w = new Wanted();
  w.setStars(3);
  for (let t = 0; t < LOSE - 0.5; t += 0.5) w.update(0.5, false);
  assert.equal(w.stars, 3);
  w.update(0.5, false);
  assert.equal(w.stars, 2);
  assert.equal(w.unseenTimer, 0);
  w.update(LOSE - 0.1, false);
  assert.equal(w.stars, 2, 'needs another full period');
  w.update(0.1, false);
  assert.equal(w.stars, 1);
  w.update(LOSE, false);
  assert.equal(w.stars, 0);
  w.update(LOSE * 2, false);
  assert.equal(w.stars, 0, 'never below 0');
});

test('being seen resets the unseen timer', () => {
  const w = new Wanted();
  w.setStars(1);
  w.update(LOSE - 1, false);
  w.update(0.1, true);
  assert.equal(w.unseenTimer, 0);
  w.update(LOSE - 1, false);
  assert.equal(w.stars, 1);
  w.update(1, false);
  assert.equal(w.stars, 0);
});

test('onChange reports (stars, prev) only on real changes', () => {
  const changes = [];
  const w = new Wanted((s, p) => changes.push([s, p]));
  w.pedAttacked();
  w.pedAttacked();
  w.copKilled();
  w.copKilled();
  w.copKilled();
  w.update(LOSE, false);
  assert.deepEqual(changes, [[1, 0], [2, 1], [3, 2], [2, 3]]);
});
