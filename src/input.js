(function (root) {
  'use strict';

  // Keyboard and mouse state. Keys use KeyboardEvent.code ('KeyW', 'Digit1', 'Enter'...).
  // Per-frame data (wasPressed, mouse.clicked, wheel) is cleared by endFrame(),
  // which the game loop calls once at the end of every frame.
  const Input = {
    keysDown: new Set(),
    keysPressed: new Set(),
    mouse: {
      x: 0, // canvas pixels
      y: 0,
      down: false, // left button held
      clicked: false // left button pressed this frame
    },
    wheel: 0, // -1, 0 or +1 this frame

    init(canvas, target = root) {
      target.addEventListener('keydown', (e) => {
        if (!e.repeat) this.keysPressed.add(e.code);
        this.keysDown.add(e.code);
        if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
      });
      target.addEventListener('keyup', (e) => {
        this.keysDown.delete(e.code);
      });
      // Avoid stuck keys when the window loses focus.
      target.addEventListener('blur', () => {
        this.keysDown.clear();
        this.mouse.down = false;
      });

      canvas.addEventListener('mousemove', (e) => this.updateMouse(canvas, e));
      canvas.addEventListener('mousedown', (e) => {
        this.updateMouse(canvas, e);
        if (e.button === 0) {
          this.mouse.down = true;
          this.mouse.clicked = true;
        }
      });
      target.addEventListener('mouseup', (e) => {
        if (e.button === 0) this.mouse.down = false;
      });
      canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        if (e.deltaY !== 0) this.wheel = Math.sign(e.deltaY);
      }, { passive: false });
      canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    },

    // Converts client coordinates to canvas pixels (handles CSS scaling).
    updateMouse(canvas, e) {
      const rect = canvas.getBoundingClientRect();
      this.mouse.x = (e.clientX - rect.left) * (canvas.width / rect.width);
      this.mouse.y = (e.clientY - rect.top) * (canvas.height / rect.height);
    },

    isDown(code) {
      return this.keysDown.has(code);
    },

    wasPressed(code) {
      return this.keysPressed.has(code);
    },

    endFrame() {
      this.keysPressed.clear();
      this.mouse.clicked = false;
      this.wheel = 0;
    }
  };

  root.Input = Input;
  if (typeof module !== 'undefined' && module.exports) module.exports = Input;
})(typeof window !== 'undefined' ? window : globalThis);
