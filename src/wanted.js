(function (root) {
  'use strict';

  const CONFIG = root.CONFIG || (typeof require !== 'undefined' ? require('./config.js') : null);

  const W = CONFIG.WANTED;

  // Wanted level (0..MAX_STARS). Pure logic: no DOM, no game references.
  // `onChange(stars, prev)` is called whenever the number of stars changes.
  class Wanted {
    constructor(onChange = null) {
      this.stars = 0;
      this.unseenTimer = 0; // seconds without any cop seeing the player
      this.onChange = onChange;
    }

    setStars(n) {
      const next = Math.max(0, Math.min(W.MAX_STARS, n));
      if (next === this.stars) return;
      const prev = this.stars;
      this.stars = next;
      this.unseenTimer = 0;
      if (this.onChange) this.onChange(next, prev);
    }

    // The player attacked or killed a pedestrian: at least 1 star.
    pedAttacked() {
      if (this.stars < 1) this.setStars(1);
    }

    // The player killed a cop: +1 star (capped).
    copKilled() {
      this.setStars(this.stars + 1);
    }

    // `seen`: true if any cop can see the player this frame. After LOSE_STAR_TIME
    // seconds unseen, one star is lost and the timer starts again.
    update(dt, seen) {
      if (this.stars === 0 || seen) {
        this.unseenTimer = 0;
        return;
      }
      this.unseenTimer += dt;
      if (this.unseenTimer >= W.LOSE_STAR_TIME) this.setStars(this.stars - 1);
    }
  }

  root.Wanted = Wanted;
  if (typeof module !== 'undefined' && module.exports) module.exports = Wanted;
})(typeof window !== 'undefined' ? window : globalThis);
