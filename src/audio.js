(function (root) {
  'use strict';

  const CONFIG = root.CONFIG || (typeof require !== 'undefined' ? require('./config.js') : null);

  // Synthesised sound effects (WebAudio oscillators + filtered noise, no files).
  // Named `Sound` (not `Audio`) so the browser's native Audio constructor is not shadowed.
  // Everything is a silent no-op until unlock() creates the AudioContext (first user
  // interaction), and also when there is no WebAudio at all (Node, old browsers).
  const Sound = {
    ctx: null,
    master: null,
    noiseBuffer: null,
    muted: false,
    recent: {}, // sound name -> [start times] (throttling)
    lastBySource: new Map(), // source object -> {name, time} (dedupe)

    // Creates (or resumes) the AudioContext. Must run inside a user gesture.
    // `AudioCtor` can be injected in tests. Returns true if audio is available.
    unlock(AudioCtor) {
      try {
        if (!Sound.ctx) {
          const Ctor = AudioCtor || root.AudioContext || root.webkitAudioContext;
          if (!Ctor) return false;
          const ctx = new Ctor();
          const master = ctx.createGain();
          master.gain.value = Sound.muted ? 0 : CONFIG.AUDIO.MASTER_VOLUME;
          master.connect(ctx.destination);
          Sound.ctx = ctx;
          Sound.master = master;
          Sound.noiseBuffer = Sound.makeNoise(ctx);
        }
        if (Sound.ctx.state === 'suspended' && Sound.ctx.resume) Sound.ctx.resume();
        return true;
      } catch (err) {
        Sound.ctx = null;
        return false;
      }
    },

    // Forgets the context (tests).
    reset() {
      Sound.ctx = null;
      Sound.master = null;
      Sound.noiseBuffer = null;
      Sound.muted = false;
      Sound.recent = {};
      Sound.lastBySource = new Map();
    },

    makeNoise(ctx) {
      const length = Math.floor(ctx.sampleRate * 0.5);
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
      return buffer;
    },

    setMuted(muted) {
      Sound.muted = muted;
      if (Sound.master) Sound.master.gain.value = muted ? 0 : CONFIG.AUDIO.MASTER_VOLUME;
    },

    toggleMute() {
      Sound.setMuted(!Sound.muted);
      return Sound.muted;
    },

    // Plays a named sound from SOUNDS. `volume` scales it (0..1+). `source` (optional
    // object) dedupes the same sound fired twice by the same thing in the same instant.
    // Returns true if something was scheduled.
    play(name, volume = 1, source = null) {
      const ctx = Sound.ctx;
      const fn = SOUNDS[name];
      if (!ctx || Sound.muted || !fn) return false;
      const a = CONFIG.AUDIO;
      const now = ctx.currentTime;
      if (source) {
        const last = Sound.lastBySource.get(source);
        if (last && last.name === name && now - last.time < a.DEDUPE_TIME) return false;
        Sound.lastBySource.set(source, { name, time: now });
        if (Sound.lastBySource.size > 64) Sound.lastBySource.clear();
      }
      const times = (Sound.recent[name] || []).filter((t) => now - t < a.THROTTLE_WINDOW);
      if (times.length >= a.MAX_SAME_SOUND) {
        Sound.recent[name] = times;
        return false;
      }
      times.push(now);
      Sound.recent[name] = times;
      try {
        fn(Sound, now, volume);
      } catch (err) {
        return false; // never let audio break the game
      }
      return true;
    },

    // --- Building blocks -------------------------------------------------------

    // Gain node with an attack/exponential-decay envelope, connected to master.
    envelope(t, vol, attack, dur) {
      const g = Sound.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(Math.max(vol, 0.0002), t + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      g.connect(Sound.master);
      return g;
    },

    // Oscillator sweep from `freq` to `freqEnd` over `dur` seconds.
    tone(t, { type = 'square', freq, freqEnd = freq, dur, vol, attack = 0.005 }) {
      const ctx = Sound.ctx;
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      if (freqEnd !== freq) osc.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
      osc.connect(Sound.envelope(t, vol, attack, dur));
      osc.start(t);
      osc.stop(t + dur + 0.02);
    },

    // Filtered white noise burst (shots, impacts, crashes).
    noise(t, { dur, vol, filter = 'lowpass', freq = 2000, freqEnd = freq, q = 1, attack = 0.002 }) {
      const ctx = Sound.ctx;
      const src = ctx.createBufferSource();
      src.buffer = Sound.noiseBuffer;
      const f = ctx.createBiquadFilter();
      f.type = filter;
      f.frequency.setValueAtTime(freq, t);
      if (freqEnd !== freq) f.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
      f.Q.value = q;
      src.connect(f);
      f.connect(Sound.envelope(t, vol, attack, dur));
      src.start(t);
      src.stop(t + dur + 0.02);
    },

    // Subscribes the sounds to the game event bus (see docs/game.md). Call once:
    // listeners survive game.reset().
    attach(game) {
      for (const name of Object.keys(EVENT_SOUNDS)) {
        game.on(name, (data, g) => EVENT_SOUNDS[name](data || {}, g || game));
      }
    }
  };

  // Sound recipes: fn(Sound, startTime, volume).
  const SOUNDS = {
    punchHit(s, t, v) {
      s.noise(t, { dur: 0.09, vol: 0.9 * v, freq: 900, freqEnd: 200 });
      s.tone(t, { type: 'sine', freq: 140, freqEnd: 60, dur: 0.1, vol: 0.7 * v });
    },
    punchMiss(s, t, v) {
      s.noise(t, { dur: 0.12, vol: 0.25 * v, filter: 'bandpass', freq: 1500, freqEnd: 600, q: 0.8, attack: 0.03 });
    },
    pistol(s, t, v) {
      s.noise(t, { dur: 0.12, vol: 0.8 * v, freq: 3000, freqEnd: 500 });
      s.tone(t, { type: 'square', freq: 220, freqEnd: 70, dur: 0.08, vol: 0.35 * v });
    },
    shotgun(s, t, v) {
      s.noise(t, { dur: 0.3, vol: 1.0 * v, freq: 2000, freqEnd: 200 });
      s.tone(t, { type: 'sawtooth', freq: 120, freqEnd: 40, dur: 0.2, vol: 0.5 * v });
    },
    copShot(s, t, v) {
      s.noise(t, { dur: 0.1, vol: 0.55 * v, freq: 2200, freqEnd: 400 });
      s.tone(t, { type: 'square', freq: 300, freqEnd: 90, dur: 0.07, vol: 0.25 * v });
    },
    hitWall(s, t, v) {
      s.noise(t, { dur: 0.05, vol: 0.3 * v, filter: 'highpass', freq: 2500 });
    },
    hitFlesh(s, t, v) {
      s.noise(t, { dur: 0.07, vol: 0.45 * v, freq: 700, freqEnd: 250 });
    },
    pickup(s, t, v) {
      s.tone(t, { type: 'square', freq: 660, dur: 0.07, vol: 0.3 * v });
      s.tone(t + 0.07, { type: 'square', freq: 990, dur: 0.1, vol: 0.3 * v });
    },
    crash(s, t, v) {
      s.noise(t, { dur: 0.35, vol: 0.9 * v, freq: 1200, freqEnd: 150 });
      s.tone(t, { type: 'triangle', freq: 90, freqEnd: 40, dur: 0.25, vol: 0.6 * v });
    },
    carDoor(s, t, v) {
      s.noise(t, { dur: 0.06, vol: 0.5 * v, freq: 600 });
      s.tone(t, { type: 'sine', freq: 180, freqEnd: 110, dur: 0.08, vol: 0.4 * v });
    },
    runOver(s, t, v) {
      s.noise(t, { dur: 0.18, vol: 0.9 * v, freq: 500, freqEnd: 120 });
      s.tone(t, { type: 'sine', freq: 110, freqEnd: 45, dur: 0.2, vol: 0.8 * v });
    },
    siren(s, t, v) {
      // Two-tone "wee-woo", twice.
      for (let i = 0; i < 4; i++) {
        s.tone(t + i * 0.18, { type: 'triangle', freq: i % 2 ? 620 : 860, dur: 0.17, vol: 0.35 * v, attack: 0.02 });
      }
    },
    hurt(s, t, v) {
      s.tone(t, { type: 'sawtooth', freq: 260, freqEnd: 140, dur: 0.15, vol: 0.4 * v });
    },
    death(s, t, v) {
      s.tone(t, { type: 'square', freq: 400, freqEnd: 90, dur: 0.3, vol: 0.3 * v });
    },
    copDeath(s, t, v) {
      s.tone(t, { type: 'square', freq: 300, freqEnd: 60, dur: 0.4, vol: 0.35 * v });
      s.noise(t, { dur: 0.1, vol: 0.3 * v, freq: 800 });
    },
    gameOver(s, t, v) {
      const notes = [392, 330, 262, 196];
      notes.forEach((f, i) => {
        s.tone(t + i * 0.22, { type: 'triangle', freq: f, dur: i === 3 ? 0.6 : 0.2, vol: 0.45 * v });
      });
    }
  };

  // Event bus -> sound (data shapes in docs/game.md).
  const EVENT_SOUNDS = {
    shot(d, game) {
      // Police may reuse Weapons.fire: their shots get the police sound.
      if (d.owner && game && d.owner !== game.player) Sound.play('copShot', 1, d.owner);
      else Sound.play(d.weapon === 'SHOTGUN' ? 'shotgun' : 'pistol');
    },
    punch(d) { Sound.play(d.hit ? 'punchHit' : 'punchMiss'); },
    bulletImpact(d) { Sound.play(d.target ? 'hitFlesh' : 'hitWall'); },
    pickup() { Sound.play('pickup'); },
    pedKilled() { Sound.play('death'); },
    carEnter() { Sound.play('carDoor'); },
    carExit() { Sound.play('carDoor'); },
    carCrash(d) {
      const v = Math.min(1, Math.max(0.3, (d.speed || 0) / CONFIG.CAR.MAX_SPEED));
      Sound.play('crash', v);
    },
    runOver() { Sound.play('runOver'); },
    wantedChanged(d) { if (d.stars > (d.prev || 0)) Sound.play('siren'); },
    copKilled() { Sound.play('copDeath'); },
    copShot(d) { Sound.play('copShot', 1, d.cop || null); },
    playerHurt() { Sound.play('hurt'); },
    playerDied() { Sound.play('gameOver'); }
  };

  Sound.SOUNDS = SOUNDS;
  Sound.EVENT_SOUNDS = EVENT_SOUNDS;

  root.Sound = Sound;
  if (typeof module !== 'undefined' && module.exports) module.exports = Sound;
})(typeof window !== 'undefined' ? window : globalThis);
