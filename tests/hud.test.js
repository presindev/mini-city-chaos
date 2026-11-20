'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const CONFIG = require('../src/config.js');
const Hud = require('../src/hud.js');

function fakeStorage(initial = {}) {
  const data = Object.assign({}, initial);
  return {
    data,
    getItem(k) { return k in data ? data[k] : null; },
    setItem(k, v) { data[k] = String(v); }
  };
}

const throwingStorage = {
  getItem() { throw new Error('SecurityError'); },
  setItem() { throw new Error('QuotaExceededError'); }
};

test('formatTime gives mm:ss', () => {
  assert.equal(Hud.formatTime(0), '00:00');
  assert.equal(Hud.formatTime(9.99), '00:09');
  assert.equal(Hud.formatTime(75.4), '01:15');
  assert.equal(Hud.formatTime(3600), '60:00');
  assert.equal(Hud.formatTime(-3), '00:00');
});

test('loadHighscore reads the stored value or 0', () => {
  assert.equal(Hud.loadHighscore(fakeStorage()), 0);
  assert.equal(Hud.loadHighscore(fakeStorage({ [CONFIG.HIGHSCORE_KEY]: '123' })), 123);
  assert.equal(Hud.loadHighscore(fakeStorage({ [CONFIG.HIGHSCORE_KEY]: 'basura' })), 0);
  assert.equal(Hud.loadHighscore(null), 0);
});

test('saveHighscore writes under CONFIG.HIGHSCORE_KEY', () => {
  const st = fakeStorage();
  assert.equal(Hud.saveHighscore(42.7, st), true);
  assert.equal(st.data[CONFIG.HIGHSCORE_KEY], '42');
  assert.equal(Hud.loadHighscore(st), 42);
});

test('a storage that throws never breaks the game', () => {
  assert.equal(Hud.loadHighscore(throwingStorage), 0);
  assert.equal(Hud.saveHighscore(10, throwingStorage), false);
});

test('in Node there is no default storage and no minimap canvas', () => {
  assert.equal(Hud.defaultStorage(), null);
  assert.equal(Hud.getMinimapCanvas(), null);
});
