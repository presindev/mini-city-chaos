'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const CONFIG = require('../src/config.js');
const Sound = require('../src/audio.js');
const Game = require('../src/game.js');

// Fake WebAudio: records every node created so tests can see if anything played.
function makeFakeAudio() {
  const log = { oscillators: 0, sources: 0, created: 0 };
  const param = () => ({
    value: 0,
    setValueAtTime() {},
    linearRampToValueAtTime() {},
    exponentialRampToValueAtTime() {}
  });
  const node = (extra = {}) => Object.assign({ connect() {}, start() {}, stop() {} }, extra);
  class FakeContext {
    constructor() {
      log.created++;
      this.currentTime = 0;
      this.sampleRate = 8000;
      this.state = 'suspended';
      this.destination = node();
    }
    resume() { this.state = 'running'; }
    createGain() { return node({ gain: param() }); }
    createOscillator() { log.oscillators++; return node({ type: '', frequency: param() }); }
    createBufferSource() { log.sources++; return node({ buffer: null }); }
    createBiquadFilter() { return node({ type: '', frequency: param(), Q: param() }); }
    createBuffer(ch, len) { const data = new Float32Array(len); return { getChannelData: () => data }; }
  }
  return { FakeContext, log };
}

const stubInput = { wasPressed: () => false, isDown: () => false, wheel: 0, mouse: { x: 0, y: 0 } };

test('is a silent no-op without an AudioContext', () => {
  Sound.reset();
  assert.equal(Sound.play('pistol'), false); // not unlocked yet
  assert.equal(Sound.unlock(), false); // Node has no AudioContext
  assert.equal(Sound.play('pistol'), false);
  assert.doesNotThrow(() => Sound.toggleMute());
  const game = new Game(stubInput);
  Sound.attach(game);
  assert.doesNotThrow(() => {
    game.emit('shot', { weapon: 'PISTOL', owner: game.player });
    game.emit('playerDied', {});
  });
});

test('every recipe plays with a (fake) AudioContext and unlock resumes it', () => {
  Sound.reset();
  const { FakeContext, log } = makeFakeAudio();
  assert.equal(Sound.unlock(FakeContext), true);
  assert.equal(Sound.ctx.state, 'running');
  Sound.unlock(FakeContext);
  assert.equal(log.created, 1); // only one context
  for (const name of Object.keys(Sound.SOUNDS)) {
    Sound.ctx.currentTime += 1; // avoid throttling
    assert.equal(Sound.play(name), true, name);
  }
  assert.ok(log.oscillators > 0 && log.sources > 0);
  assert.equal(Sound.play('doesNotExist'), false);
});

test('M mute: nothing plays while muted and master gain goes to 0', () => {
  Sound.reset();
  const { FakeContext, log } = makeFakeAudio();
  Sound.unlock(FakeContext);
  assert.equal(Sound.toggleMute(), true);
  assert.equal(Sound.master.gain.value, 0);
  const before = log.oscillators + log.sources;
  assert.equal(Sound.play('pistol'), false);
  assert.equal(log.oscillators + log.sources, before);
  assert.equal(Sound.toggleMute(), false);
  assert.ok(Sound.master.gain.value > 0);
  assert.equal(Sound.play('pistol'), true);
});

test('the same sound is throttled inside the window', () => {
  Sound.reset();
  const { FakeContext } = makeFakeAudio();
  Sound.unlock(FakeContext);
  let played = 0;
  for (let i = 0; i < 10; i++) if (Sound.play('hitWall')) played++;
  assert.equal(played, CONFIG.AUDIO.MAX_SAME_SOUND);
  Sound.ctx.currentTime += 1;
  assert.equal(Sound.play('hitWall'), true);
});

test('attach subscribes to every event and maps them to sounds', () => {
  Sound.reset();
  const { FakeContext } = makeFakeAudio();
  Sound.unlock(FakeContext);
  const game = new Game(stubInput);
  const played = [];
  const original = Sound.play;
  Sound.play = (name) => { played.push(name); return true; };
  try {
    Sound.attach(game);
    const events = ['shot', 'punch', 'bulletImpact', 'pickup', 'pedKilled', 'carEnter', 'carExit',
      'carCrash', 'runOver', 'wantedChanged', 'copKilled', 'copShot', 'playerHurt', 'playerDied'];
    for (const e of events) assert.ok(game.listeners[e] && game.listeners[e].length > 0, e);

    game.emit('shot', { weapon: 'PISTOL', owner: game.player });
    game.emit('shot', { weapon: 'SHOTGUN', owner: game.player });
    game.emit('shot', { weapon: 'PISTOL', owner: { cop: true } });
    game.emit('punch', { hit: true });
    game.emit('punch', { hit: false });
    game.emit('bulletImpact', { target: null });
    game.emit('bulletImpact', { target: {} });
    game.emit('wantedChanged', { stars: 2, prev: 1 });
    game.emit('wantedChanged', { stars: 1, prev: 2 }); // going down: no siren
    game.emit('carCrash', { speed: 300 });
    game.emit('playerDied', {});
    assert.deepEqual(played, ['pistol', 'shotgun', 'copShot', 'punchHit', 'punchMiss', 'hitWall',
      'hitFlesh', 'siren', 'crash', 'gameOver']);

    // Listeners survive a reset.
    game.reset();
    played.length = 0;
    game.emit('pickup', {});
    assert.deepEqual(played, ['pickup']);
  } finally {
    Sound.play = original;
  }
});

test('the same source firing twice in the same instant plays once', () => {
  Sound.reset();
  const { FakeContext } = makeFakeAudio();
  Sound.unlock(FakeContext);
  const cop = {};
  assert.equal(Sound.play('copShot', 1, cop), true);
  assert.equal(Sound.play('copShot', 1, cop), false);
  assert.equal(Sound.play('copShot', 1, {}), true); // another cop
});
