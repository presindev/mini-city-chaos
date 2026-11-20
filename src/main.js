(function (root) {
  'use strict';

  // Boot: wires canvas, input, sound and game, then runs the requestAnimationFrame loop.
  const Main = {
    start() {
      const canvas = document.getElementById('game');
      const ctx = canvas.getContext('2d');
      Input.init(canvas);
      const game = new Game(Input);
      root.game = game; // handy for debugging from the console

      // Audio lives here (not in Game) so Node tests never depend on it.
      // Browsers only allow audio after a user gesture: unlock on the first key/click.
      Sound.attach(game);
      const unlock = () => Sound.unlock();
      root.addEventListener('keydown', unlock);
      root.addEventListener('mousedown', unlock);

      let last = performance.now();
      function frame(now) {
        const dt = Math.min((now - last) / 1000, CONFIG.MAX_DT);
        last = now;
        if (Input.wasPressed('KeyM')) Sound.toggleMute();
        game.update(dt);
        game.draw(ctx);
        if (Sound.muted) Main.drawMuted(ctx);
        Input.endFrame();
        requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    },

    // Small "muted" tag at the bottom centre (corners are left for the HUD/minimap).
    drawMuted(ctx) {
      const w = CONFIG.SCREEN_WIDTH;
      const h = CONFIG.SCREEN_HEIGHT;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 13px sans-serif';
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.fillRect(w / 2 - 60, h - 28, 120, 20);
      ctx.fillStyle = '#fff';
      ctx.fillText('SILENCIO (M)', w / 2, h - 18);
    }
  };

  root.Main = Main;
  if (typeof module !== 'undefined' && module.exports) module.exports = Main;
  if (typeof document !== 'undefined') Main.start();
})(typeof window !== 'undefined' ? window : globalThis);
