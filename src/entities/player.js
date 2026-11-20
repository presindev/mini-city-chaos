(function (root) {
  'use strict';

  const CONFIG = root.CONFIG || (typeof require !== 'undefined' ? require('../config.js') : null);
  const Utils = root.Utils || (typeof require !== 'undefined' ? require('../utils.js') : null);
  const CityMap = root.CityMap || (typeof require !== 'undefined' ? require('../map.js') : null);
  const Weapons = root.Weapons || (typeof require !== 'undefined' ? require('../weapons.js') : null);

  const SLOT_KEYS = ['Digit1', 'Digit2', 'Digit3'];

  // Player on foot: WASD movement, faces the mouse, slides along buildings,
  // switches weapons (1-3 / wheel) and fires with the left mouse button.
  class Player {
    constructor(x, y) {
      this.x = x;
      this.y = y;
      this.radius = CONFIG.PLAYER.RADIUS;
      this.speed = CONFIG.PLAYER.SPEED;
      this.health = CONFIG.PLAYER.MAX_HEALTH;
      this.angle = 0; // radians, 0 = facing +x
      this.inventory = Weapons.createInventory();
      this.inCar = null; // the Car being driven, or null on foot
      this.hurtTimer = 0; // > 0: blinks red after taking damage (set on 'playerHurt')
    }

    update(dt, game) {
      this.hurtTimer = Math.max(0, this.hurtTimer - dt);
      const input = game.input;
      if (input.wasPressed('KeyE')) {
        if (this.inCar) this.exitCar(game);
        else this.enterNearestCar(game);
      }
      if (this.inCar) {
        this.drive(dt, game);
        return;
      }

      let dx = 0;
      let dy = 0;
      if (input.isDown('KeyW')) dy -= 1;
      if (input.isDown('KeyS')) dy += 1;
      if (input.isDown('KeyA')) dx -= 1;
      if (input.isDown('KeyD')) dx += 1;
      if (dx !== 0 || dy !== 0) {
        const len = Math.hypot(dx, dy); // normalise so diagonals are not faster
        const step = this.speed * dt / len;
        const moved = CityMap.moveCircle(this.x, this.y, this.radius, dx * step, dy * step);
        this.x = moved.x;
        this.y = moved.y;
      }

      // Aim at the mouse (canvas pixels -> world).
      const mouse = game.camera.screenToWorld(input.mouse.x, input.mouse.y);
      if (mouse.x !== this.x || mouse.y !== this.y) {
        this.angle = Utils.angleTo(this.x, this.y, mouse.x, mouse.y);
      }

      // Weapons.
      const inv = this.inventory;
      Weapons.update(inv, dt);
      SLOT_KEYS.forEach((code, i) => {
        if (input.wasPressed(code)) Weapons.select(inv, i);
      });
      if (input.wheel) Weapons.cycle(inv, input.wheel > 0 ? 1 : -1);
      if (input.mouse.down) Weapons.fire(inv, this, this.angle, game);
    }

    // Driving: W/S throttle, A/D steer. The car moves in Car.update, which also
    // keeps player.x/y on it. No shooting and no aiming inside the car.
    drive(dt, game) {
      const input = game.input;
      const car = this.inCar;
      car.controls.throttle = (input.isDown('KeyW') ? 1 : 0) - (input.isDown('KeyS') ? 1 : 0);
      car.controls.steer = (input.isDown('KeyD') ? 1 : 0) - (input.isDown('KeyA') ? 1 : 0);
      const inv = this.inventory;
      Weapons.update(inv, dt);
      SLOT_KEYS.forEach((code, i) => {
        if (input.wasPressed(code)) Weapons.select(inv, i);
      });
      if (input.wheel) Weapons.cycle(inv, input.wheel > 0 ? 1 : -1);
    }

    // Enters the closest car whose body is within ENTER_DISTANCE; an AI driver
    // gets out and runs away. Returns the car or null.
    enterNearestCar(game) {
      let best = null;
      let bestDist = CONFIG.CAR.ENTER_DISTANCE;
      for (const car of game.cars || []) {
        if (car.driver === 'player') continue;
        const d = car.distanceTo(this.x, this.y);
        if (d <= bestDist) {
          best = car;
          bestDist = d;
        }
      }
      if (!best) return null;
      if (best.driver === 'ai') best.ejectDriver(game);
      best.driver = 'player';
      best.controls.throttle = 0;
      best.controls.steer = 0;
      this.inCar = best;
      this.x = best.x;
      this.y = best.y;
      this.angle = best.angle;
      if (game.emit) game.emit('carEnter', { car: best });
      return best;
    }

    // Gets out next to the car (left, right, front or back: the first free spot).
    // Returns false if there is no room.
    exitCar(game) {
      const car = this.inCar;
      const spot = car.freeSpotBeside(this.radius, game);
      if (!spot) return false;
      car.driver = null;
      car.controls.throttle = 0;
      car.controls.steer = 0;
      this.inCar = null;
      this.x = spot.x;
      this.y = spot.y;
      if (game.emit) game.emit('carExit', { car });
      return true;
    }

    // Applies damage (halved by CAR.PLAYER_DAMAGE_FACTOR while driving) and returns the
    // amount actually taken. Sets `dead` at 0 health. Events/game over: Game.damagePlayer.
    takeDamage(amount) {
      if (this.dead) return 0;
      if (this.inCar) amount *= CONFIG.CAR.PLAYER_DAMAGE_FACTOR;
      this.health = Math.max(0, this.health - amount);
      if (this.health <= 0) this.dead = true;
      return amount;
    }

    draw(ctx, camera) {
      if (this.inCar) return; // hidden inside the car
      const p = camera.worldToScreen(this.x, this.y);
      const r = this.radius;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(this.angle);
      // Body (blinks red while hurt).
      const blinkRed = this.hurtTimer > 0 &&
        Math.floor(this.hurtTimer * CONFIG.EFFECTS.HURT_BLINK_RATE) % 2 === 0;
      ctx.fillStyle = blinkRed ? '#ff3030' : '#2e8bff';
      ctx.strokeStyle = '#0b2c5a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // Head.
      ctx.fillStyle = '#5a3a1a';
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.5, 0, Math.PI * 2);
      ctx.fill();
      // Gun barrel when holding a firearm.
      const weapon = this.inventory.current;
      if (weapon !== 'FISTS') {
        ctx.fillStyle = '#222';
        const long = weapon === 'SHOTGUN';
        ctx.fillRect(r - 2, -2.5, long ? 18 : 12, long ? 5 : 4);
      }
      // Hand / direction marker in front of the body.
      ctx.fillStyle = '#f0c8a0';
      ctx.strokeStyle = '#0b2c5a';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(r + 3, 0, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  root.Player = Player;
  if (typeof module !== 'undefined' && module.exports) module.exports = Player;
})(typeof window !== 'undefined' ? window : globalThis);
