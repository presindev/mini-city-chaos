(function (root) {
  'use strict';

  const CONFIG = root.CONFIG || (typeof require !== 'undefined' ? require('./config.js') : null);

  // Short-lived visual effects stored in game.effects. Every effect has
  // {kind, x, y, time}; this module adds the 'particle' kind (sparks, blood) and
  // updates/draws all kinds. Creation and update are pure (no DOM) and tested.
  const Effects = {
    // Burst of `count` particles from (x, y) with random direction and speed up to `speed`.
    // If `angle` is given, they spray in a half-circle around it. Keeps the number of
    // particles under MAX_PARTICLES by dropping the oldest ones.
    burst(effects, x, y, { count, speed, colors, angle = null, size = 2 }, rng = Math.random) {
      const cfg = CONFIG.EFFECTS;
      for (let i = 0; i < count; i++) {
        const a = angle === null ? rng() * Math.PI * 2 : angle + (rng() - 0.5) * Math.PI;
        const v = speed * (0.3 + 0.7 * rng());
        const life = cfg.PARTICLE_TIME * (0.6 + 0.4 * rng());
        effects.push({
          kind: 'particle',
          x,
          y,
          vx: Math.cos(a) * v,
          vy: Math.sin(a) * v,
          time: life,
          maxTime: life,
          size: size * (0.7 + 0.6 * rng()),
          color: colors[Math.floor(rng() * colors.length) % colors.length]
        });
      }
      Effects.cap(effects);
      return effects;
    },

    // Bullet impact (event data {x, y, target}): sparks on buildings, red on people.
    impact(effects, data, rng = Math.random) {
      const cfg = CONFIG.EFFECTS;
      if (data.target) {
        return Effects.burst(effects, data.x, data.y,
          { count: cfg.HIT_COUNT, speed: cfg.HIT_SPEED, colors: cfg.BLOOD_COLORS, size: 2.5 }, rng);
      }
      return Effects.burst(effects, data.x, data.y,
        { count: cfg.SPARK_COUNT, speed: cfg.SPARK_SPEED, colors: cfg.SPARK_COLORS, size: 2 }, rng);
    },

    // Blood splash on someone ({x, y}) that was attacked.
    blood(effects, who, rng = Math.random) {
      const cfg = CONFIG.EFFECTS;
      return Effects.burst(effects, who.x, who.y,
        { count: cfg.BLOOD_COUNT, speed: cfg.BLOOD_SPEED, colors: cfg.BLOOD_COLORS, size: 3 }, rng);
    },

    // Removes the oldest particles (front of the array) beyond MAX_PARTICLES in place.
    cap(effects) {
      let extra = Effects.countParticles(effects) - CONFIG.EFFECTS.MAX_PARTICLES;
      for (let i = 0; i < effects.length && extra > 0;) {
        if (effects[i].kind === 'particle') {
          effects.splice(i, 1);
          extra--;
        } else {
          i++;
        }
      }
    },

    countParticles(effects) {
      let n = 0;
      for (const e of effects) if (e.kind === 'particle') n++;
      return n;
    },

    // Ages every effect, moves particles (with drag) and returns the live ones.
    update(effects, dt) {
      const drag = Math.exp(-CONFIG.EFFECTS.PARTICLE_DRAG * dt);
      for (const e of effects) {
        e.time -= dt;
        if (e.kind === 'particle') {
          e.x += e.vx * dt;
          e.y += e.vy * dt;
          e.vx *= drag;
          e.vy *= drag;
        }
      }
      return effects.filter((e) => e.time > 0);
    },

    // Draws a particle at screen point `p`, fading out with its remaining life.
    drawParticle(ctx, p, e) {
      ctx.globalAlpha = Math.max(0, Math.min(1, e.time / e.maxTime));
      ctx.fillStyle = e.color;
      ctx.fillRect(p.x - e.size / 2, p.y - e.size / 2, e.size, e.size);
      ctx.globalAlpha = 1;
    },

    // Muzzle flash: a bright blob plus a short cone along the shot, fading out.
    drawFlash(ctx, p, e) {
      const k = Math.max(0, Math.min(1, e.time / CONFIG.EFFECTS.FLASH_TIME));
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(e.angle || 0);
      ctx.globalAlpha = 0.5 + 0.5 * k;
      ctx.fillStyle = 'rgba(255, 200, 80, 0.8)';
      ctx.beginPath();
      ctx.moveTo(0, -5);
      ctx.lineTo(16, 0);
      ctx.lineTo(0, 5);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 245, 200, 0.95)';
      ctx.beginPath();
      ctx.arc(0, 0, 5 + 3 * k, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  };

  root.Effects = Effects;
  if (typeof module !== 'undefined' && module.exports) module.exports = Effects;
})(typeof window !== 'undefined' ? window : globalThis);
