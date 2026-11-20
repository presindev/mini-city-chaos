'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const CONFIG = require('../src/config.js');
const Effects = require('../src/effects.js');
const Game = require('../src/game.js');

const FX = CONFIG.EFFECTS;
const rng = () => 0.5;
const stubInput = { wasPressed: () => false, isDown: () => false, wheel: 0, mouse: { x: 0, y: 0 } };

test('impacts create sparks on buildings and red particles on people', () => {
  const sparks = Effects.impact([], { x: 10, y: 20, target: null }, rng);
  assert.equal(sparks.length, FX.SPARK_COUNT);
  for (const p of sparks) {
    assert.equal(p.kind, 'particle');
    assert.ok(FX.SPARK_COLORS.includes(p.color));
    assert.equal(p.x, 10);
    assert.equal(p.y, 20);
  }
  const hit = Effects.impact([], { x: 0, y: 0, target: {} }, rng);
  assert.equal(hit.length, FX.HIT_COUNT);
  for (const p of hit) assert.ok(FX.BLOOD_COLORS.includes(p.color));
  const blood = Effects.blood([], { x: 5, y: 5 }, rng);
  assert.equal(blood.length, FX.BLOOD_COUNT);
});

test('particles move, slow down and disappear; other kinds just age', () => {
  let fx = Effects.burst([], 0, 0, { count: 3, speed: 100, colors: ['#fff'] }, rng);
  fx.push({ kind: 'flash', x: 0, y: 0, time: 1 });
  const v0 = Math.hypot(fx[0].vx, fx[0].vy);
  fx = Effects.update(fx, 0.05);
  assert.equal(fx.length, 4);
  assert.ok(Math.hypot(fx[0].x, fx[0].y) > 0);
  assert.ok(Math.hypot(fx[0].vx, fx[0].vy) < v0);
  assert.ok(Math.abs(fx[3].time - 0.95) < 1e-9);
  for (let i = 0; i < 20; i++) fx = Effects.update(fx, 0.05);
  assert.equal(fx.length, 0);
});

test('particle count is capped, dropping the oldest and keeping other effects', () => {
  const fx = [{ kind: 'swing', x: 0, y: 0, time: 1 }];
  for (let i = 0; i < 100; i++) Effects.impact(fx, { x: i, y: 0, target: null }, rng);
  assert.equal(Effects.countParticles(fx), FX.MAX_PARTICLES);
  assert.equal(fx[0].kind, 'swing');
  assert.equal(fx[fx.length - 1].x, 99); // newest kept
});

test('game turns events into effects and the hurt blink', () => {
  const game = new Game(stubInput);
  game.start();
  game.emit('bulletImpact', { x: 100, y: 100, target: null });
  assert.equal(Effects.countParticles(game.effects), FX.SPARK_COUNT);
  const ped = game.pedestrians[0];
  game.damagePedestrian(ped, 1);
  assert.equal(Effects.countParticles(game.effects), FX.SPARK_COUNT + FX.BLOOD_COUNT);

  assert.equal(game.player.hurtTimer, 0);
  game.emit('playerHurt', { amount: 10, health: 90 });
  assert.equal(game.player.hurtTimer, FX.HURT_FLASH_TIME);
  game.update(0.1);
  assert.ok(Math.abs(game.player.hurtTimer - (FX.HURT_FLASH_TIME - 0.1)) < 1e-9);
  for (let i = 0; i < 20; i++) game.update(0.05);
  assert.equal(game.player.hurtTimer, 0);
  assert.equal(Effects.countParticles(game.effects), 0);
});
