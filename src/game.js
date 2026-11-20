(function (root) {
  'use strict';

  const CONFIG = root.CONFIG || (typeof require !== 'undefined' ? require('./config.js') : null);
  const CityMap = root.CityMap || (typeof require !== 'undefined' ? require('./map.js') : null);
  const Camera = root.Camera || (typeof require !== 'undefined' ? require('./camera.js') : null);
  const Player = root.Player || (typeof require !== 'undefined' ? require('./entities/player.js') : null);
  const Pedestrian = root.Pedestrian || (typeof require !== 'undefined' ? require('./entities/pedestrian.js') : null);
  const Weapons = root.Weapons || (typeof require !== 'undefined' ? require('./weapons.js') : null);
  const Pickup = root.Pickup || (typeof require !== 'undefined' ? require('./entities/pickup.js') : null);
  const Car = root.Car || (typeof require !== 'undefined' ? require('./entities/car.js') : null);
  const Wanted = root.Wanted || (typeof require !== 'undefined' ? require('./wanted.js') : null);
  const Police = root.Police || (typeof require !== 'undefined' ? require('./entities/police.js') : null);
  const Hud = root.Hud || (typeof require !== 'undefined' ? require('./hud.js') : null);
  const Effects = root.Effects || (typeof require !== 'undefined' ? require('./effects.js') : null);

  // Game state machine: menu -> playing <-> paused -> gameover -> playing.
  // `input` is injected (the global Input in the browser, a stub in tests).
  class Game {
    constructor(input, rng = Math.random) {
      this.input = input;
      this.rng = rng;
      this.state = 'menu';
      this.listeners = {}; // event name -> [fn]; survives reset() (audio subscribes once)
      // Attacking pedestrians raises the wanted level (this.wanted is recreated in reset()).
      this.on('pedAttacked', (d) => {
        if (d.byPlayer) this.wanted.pedAttacked();
      });
      this.reset();
      // Visual feedback (F8): particles on hits and a red blink when the player is hurt.
      this.on('bulletImpact', (d) => Effects.impact(this.effects, d));
      this.on('pedAttacked', (d) => Effects.blood(this.effects, d.ped));
      this.on('playerHurt', () => { this.player.hurtTimer = CONFIG.EFFECTS.HURT_FLASH_TIME; });
    }

    // Tiny event bus so systems (wanted level, audio, HUD...) can react to game events
    // without depending on each other. See docs/game.md for the list of events.
    on(name, fn) {
      (this.listeners[name] = this.listeners[name] || []).push(fn);
    }

    emit(name, data = {}) {
      const fns = this.listeners[name];
      if (fns) for (const fn of fns) fn(data, this);
    }

    // Puts the world back to its initial state (called when a run starts).
    reset() {
      this.time = 0; // seconds survived in the current run
      this.score = 0;
      this.scoreTimer = 0; // fraction of a second not yet turned into points
      this.newRecord = false;
      // `this.storage` (getItem/setItem) can be injected for tests; undefined = localStorage.
      this.highscore = Hud.loadHighscore(this.storage);
      const spawn = CityMap.tileCenter(CONFIG.PLAYER.SPAWN_TILE.tx, CONFIG.PLAYER.SPAWN_TILE.ty);
      this.player = new Player(spawn.x, spawn.y);
      this.camera = new Camera(CityMap.width, CityMap.height);
      this.camera.follow(this.player.x, this.player.y);
      this.pedestrians = [];
      this.spawnPedestrians();
      this.wanted = new Wanted((stars, prev) => this.emit('wantedChanged', { stars, prev }));
      this.police = []; // cops on foot (alive, dead bodies and leaving ones)
      this.bullets = [];
      this.effects = []; // short-lived visuals: {kind: 'swing' | 'flash' | 'particle', x, y, time, ...}
      this.pickups = [];
      for (const [tx, ty] of CONFIG.PICKUPS.PISTOL_TILES) {
        const c = CityMap.tileCenter(tx, ty);
        this.pickups.push(new Pickup(c.x, c.y, 'PISTOL'));
      }
      for (const [tx, ty] of CONFIG.PICKUPS.SHOTGUN_TILES) {
        const c = CityMap.tileCenter(tx, ty);
        this.pickups.push(new Pickup(c.x, c.y, 'SHOTGUN'));
      }
      this.cars = []; // traffic, parked and (F6) police cars
      Car.spawnTraffic(this);
    }

    // Everything bullets and fists can hit (dead ones are skipped by the callers).
    getTargets() {
      return this.pedestrians.concat(this.police, [this.player]);
    }

    // `attacker` is who caused the damage (the player, a cop...); used for score/wanted.
    damageTarget(target, amount, fromX, fromY, attacker) {
      if (target instanceof Pedestrian) this.damagePedestrian(target, amount, fromX, fromY, attacker);
      else if (target instanceof Police) this.damagePolice(target, amount, fromX, fromY, attacker);
      else if (target === this.player && attacker !== this.player) this.damagePlayer(amount);
    }

    // Single entry point for hurting the player (bullets, and later patrol-car rams).
    // Emits 'playerHurt'; at 0 health emits 'playerDied' and ends the run.
    damagePlayer(amount) {
      const p = this.player;
      if (p.dead) return;
      const taken = p.takeDamage(amount);
      this.emit('playerHurt', { amount: taken, health: p.health });
      if (p.dead) {
        this.emit('playerDied', {});
        this.gameOver();
      }
    }

    // Damages a cop. Cops do not hurt each other. Killing one (player or no attacker):
    // +SCORE.POLICE, event 'copKilled' and +1 star.
    damagePolice(cop, amount, fromX, fromY, attacker) {
      if (cop.dead || attacker instanceof Police) return;
      const byPlayer = !attacker || attacker === this.player;
      if (!cop.takeDamage(amount)) return;
      this.emit('copKilled', { cop });
      if (byPlayer) {
        this.score += CONFIG.SCORE.POLICE;
        this.wanted.copKilled();
      }
    }

    // True if any active cop can see the player (radius only, walls ignored).
    isPlayerSeen() {
      const p = this.player;
      if (this.police.some((c) => !c.dead && !c.leaving && c.canSee(p.x, p.y))) return true;
      const r = CONFIG.WANTED.VISION_RADIUS;
      return this.patrolCars().some((c) => Math.hypot(c.x - p.x, c.y - p.y) <= r);
    }

    // Keeps WANTED.FOOT_COPS[stars] cops chasing the player. Extra ones (the level
    // dropped) start leaving; leaving cops are removed once they are off-screen.
    spawnPolice() {
      const want = CONFIG.WANTED.FOOT_COPS[this.wanted.stars];
      const active = this.police.filter((c) => !c.dead && !c.leaving);
      for (let i = want; i < active.length; i++) active[i].leaving = true;
      this.police = this.police.filter((c) => !(c.leaving && !c.dead && !this.isOnScreen(c.x, c.y, 32)));

      let missing = want - Math.min(active.length, want);
      let attempts = 30;
      while (missing > 0 && attempts-- > 0) {
        const pos = this.findPoliceSpawn();
        if (!pos) continue;
        this.police.push(new Police(pos.x, pos.y, this.rng));
        missing--;
      }
    }

    // Random road/sidewalk tile centre in a ring around the player, out of camera view.
    // `onlyType` restricts it to one tile type (patrol cars spawn on ROAD).
    findPoliceSpawn(onlyType) {
      const P = CONFIG.POLICE;
      const angle = this.rng() * Math.PI * 2;
      const d = P.SPAWN_MIN_DIST + this.rng() * (P.SPAWN_MAX_DIST - P.SPAWN_MIN_DIST);
      const tx = CityMap.worldToTile(this.player.x + Math.cos(angle) * d);
      const ty = CityMap.worldToTile(this.player.y + Math.sin(angle) * d);
      const tile = CityMap.getTile(tx, ty);
      if (onlyType !== undefined ? tile !== onlyType : tile !== CONFIG.TILE.ROAD && tile !== CONFIG.TILE.SIDEWALK) {
        return null;
      }
      const pos = CityMap.tileCenter(tx, ty);
      if (this.isOnScreen(pos.x, pos.y, P.SPAWN_MARGIN)) return null;
      return pos;
    }

    // Active patrol cars (police AI driving, not leaving).
    patrolCars() {
      return this.cars.filter((c) => c.isPolice && c.driver === 'ai' && !c.leaving);
    }

    // Keeps WANTED.PATROL_CARS[stars] patrol cars, spawned on roads out of view.
    // Extra ones (stars went down) drive away and are removed once off screen.
    spawnPatrolCars() {
      const want = CONFIG.WANTED.PATROL_CARS[this.wanted.stars];
      const active = this.patrolCars();
      for (let i = want; i < active.length; i++) active[i].leaving = true;
      this.cars = this.cars.filter((c) => !(c.isPolice && c.leaving && c.driver === 'ai' &&
        !this.isOnScreen(c.x, c.y, CONFIG.CAR.WIDTH)));

      let missing = want - Math.min(active.length, want);
      let attempts = 30;
      while (missing > 0 && attempts-- > 0) {
        const pos = this.findPoliceSpawn(CONFIG.TILE.ROAD);
        if (!pos) continue;
        if (this.cars.some((o) => Math.hypot(o.x - pos.x, o.y - pos.y) < CONFIG.CAR.WIDTH * 2)) continue;
        const angle = Math.atan2(this.player.y - pos.y, this.player.x - pos.x);
        this.cars.push(Police.createPatrolCar(pos.x, pos.y, angle));
        missing--;
      }
    }

    // Keeps CONFIG.PEDESTRIAN.COUNT alive pedestrians, spawning them out of view.
    spawnPedestrians() {
      const ped = CONFIG.PEDESTRIAN;
      let alive = this.pedestrians.filter((p) => !p.dead).length;
      let attempts = 50; // spread the work over frames if spots are hard to find
      while (alive < ped.COUNT && attempts-- > 0) {
        const type = this.rng() < ped.PARK_SPAWN_CHANCE ? CONFIG.TILE.PARK : CONFIG.TILE.SIDEWALK;
        const tile = CityMap.randomTileOfType(type, this.rng);
        if (!tile) continue;
        const pos = CityMap.tileCenter(tile.tx, tile.ty);
        if (this.isOnScreen(pos.x, pos.y, ped.SPAWN_MARGIN)) continue;
        this.pedestrians.push(new Pedestrian(pos.x, pos.y, this.rng));
        alive++;
      }
    }

    isOnScreen(x, y, margin = 0) {
      const c = this.camera;
      return x > c.x - margin && x < c.x + c.width + margin &&
        y > c.y - margin && y < c.y + c.height + margin;
    }

    // Makes every living pedestrian within `radius` of (x, y) run away.
    scareAt(x, y, radius) {
      for (const p of this.pedestrians) {
        if (!p.dead && Math.hypot(p.x - x, p.y - y) <= radius) p.scare(x, y);
      }
    }

    // Damages a pedestrian; points only if the player did it (no attacker = console/tests).
    damagePedestrian(ped, amount, fromX, fromY, attacker) {
      if (ped.dead) return;
      const byPlayer = !attacker || attacker === this.player;
      const killed = ped.takeDamage(amount, fromX, fromY);
      this.emit('pedAttacked', { ped, byPlayer, killed });
      if (killed) {
        if (byPlayer) this.score += CONFIG.SCORE.PEDESTRIAN;
        this.emit('pedKilled', { ped, byPlayer });
      }
    }

    start() {
      this.reset();
      this.state = 'playing';
    }

    // Ends the run and saves the highscore (only on the playing -> gameover transition).
    gameOver() {
      if (this.state !== 'playing') return;
      this.state = 'gameover';
      const final = Math.floor(this.score);
      if (final > this.highscore) {
        this.highscore = final;
        this.newRecord = true;
        Hud.saveHighscore(final, this.storage);
      }
    }

    // +CONFIG.SCORE.PER_SECOND for every full second survived (fractions carry over).
    addTimeScore(dt) {
      this.scoreTimer += dt;
      while (this.scoreTimer >= 1) {
        this.scoreTimer -= 1;
        this.score += CONFIG.SCORE.PER_SECOND;
      }
    }

    update(dt) {
      const input = this.input;
      switch (this.state) {
        case 'menu':
        case 'gameover':
          if (input.wasPressed('Enter')) this.start();
          break;
        case 'playing':
          if (input.wasPressed('KeyP')) {
            this.state = 'paused';
            break;
          }
          this.time += dt;
          this.addTimeScore(dt);
          this.player.update(dt, this);
          Car.updateAll(dt, this); // also keeps player.x/y on the car being driven
          this.camera.follow(this.player.x, this.player.y);
          for (const b of this.bullets) b.update(dt, this);
          this.bullets = this.bullets.filter((b) => !b.dead);
          for (const p of this.pedestrians) p.update(dt);
          this.pedestrians = this.pedestrians.filter((p) => !p.remove);
          this.spawnPedestrians();
          for (const c of this.police) c.update(dt, this);
          this.police = this.police.filter((c) => !c.remove);
          this.wanted.update(dt, this.isPlayerSeen());
          this.spawnPolice();
          this.spawnPatrolCars();
          for (const k of this.pickups) {
            if (k.update(dt, this.player.inCar ? null : this.player)) this.emit('pickup', { weapon: k.weapon, x: k.x, y: k.y });
          }
          this.effects = Effects.update(this.effects, dt);
          break;
        case 'paused':
          if (input.wasPressed('KeyP')) this.state = 'playing';
          break;
      }
    }

    draw(ctx) {
      switch (this.state) {
        case 'menu':
          Hud.drawMenu(ctx, this);
          break;
        case 'playing':
          this.drawWorld(ctx);
          break;
        case 'paused':
          this.drawWorld(ctx);
          Hud.drawPause(ctx, this);
          break;
        case 'gameover':
          this.drawWorld(ctx);
          Hud.drawGameOver(ctx, this);
          break;
      }
    }

    drawWorld(ctx) {
      const cam = this.camera;
      CityMap.draw(ctx, cam);
      for (const k of this.pickups) if (this.isOnScreen(k.x, k.y, 32)) k.draw(ctx, cam);
      // Bodies first so the living walk over them.
      for (const p of this.pedestrians) if (p.dead && this.isOnScreen(p.x, p.y, 32)) p.draw(ctx, cam);
      for (const c of this.police) if (c.dead && this.isOnScreen(c.x, c.y, 32)) c.draw(ctx, cam);
      for (const p of this.pedestrians) if (!p.dead && this.isOnScreen(p.x, p.y, 32)) p.draw(ctx, cam);
      for (const c of this.cars) if (this.isOnScreen(c.x, c.y, 48)) c.draw(ctx, cam);
      for (const c of this.police) if (!c.dead && this.isOnScreen(c.x, c.y, 32)) c.draw(ctx, cam);
      this.player.draw(ctx, cam);
      for (const b of this.bullets) b.draw(ctx, cam);
      this.drawEffects(ctx);
      Hud.draw(ctx, this);
    }

    drawEffects(ctx) {
      for (const e of this.effects) {
        const p = this.camera.worldToScreen(e.x, e.y);
        if (e.kind === 'swing') {
          const def = CONFIG.WEAPONS.FISTS;
          const half = def.ARC * Math.PI / 360;
          ctx.strokeStyle = 'rgba(255, 255, 255, ' + (e.time / CONFIG.EFFECTS.SWING_TIME) + ')';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(p.x, p.y, this.player.radius + def.RANGE * 0.8, e.angle - half, e.angle + half);
          ctx.stroke();
        } else if (e.kind === 'flash') {
          Effects.drawFlash(ctx, p, e);
        } else if (e.kind === 'particle') {
          if (this.isOnScreen(e.x, e.y, 8)) Effects.drawParticle(ctx, p, e);
        }
      }
    }
  }

  root.Game = Game;
  if (typeof module !== 'undefined' && module.exports) module.exports = Game;
})(typeof window !== 'undefined' ? window : globalThis);
