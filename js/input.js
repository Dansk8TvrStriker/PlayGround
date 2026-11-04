/* Keyboard + touch input, mapped to a tiny set of actions. */

const KEYMAP = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'jump', KeyW: 'jump', Space: 'jump',
  KeyQ: 'switch', Tab: 'switch', ShiftLeft: 'switch', ShiftRight: 'switch',
  KeyE: 'action', Enter: 'action',
  KeyX: 'strike', KeyK: 'strike',
  KeyJ: 'journal',
  Escape: 'pause', KeyP: 'pause',
  KeyM: 'mute',
};

export class Input {
  constructor() {
    this.down = new Set();
    this.just = new Set();
    this.virtual = new Set();
    this.onFirstGesture = null;
    this._gestured = false;

    window.addEventListener('keydown', (e) => {
      const a = KEYMAP[e.code];
      if (!a) return;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
      this.gesture();
      if (e.repeat) return;
      this.down.add(a);
      this.just.add(a);
    }, { passive: false });

    window.addEventListener('keyup', (e) => {
      const a = KEYMAP[e.code];
      if (!a) return;
      this.down.delete(a);
    });

    window.addEventListener('blur', () => {
      this.down.clear();
      this.virtual.clear();
      document.querySelectorAll('.tbtn.on').forEach((b) => b.classList.remove('on'));
    });

    document.querySelectorAll('[data-input]').forEach((btn) => {
      const action = btn.dataset.input;
      const press = (e) => {
        e.preventDefault();
        this.gesture();
        btn.setPointerCapture?.(e.pointerId);
        this.virtual.add(action);
        this.just.add(action);
        btn.classList.add('on');
      };
      const release = (e) => {
        e.preventDefault();
        this.virtual.delete(action);
        btn.classList.remove('on');
      };
      btn.addEventListener('pointerdown', press, { passive: false });
      btn.addEventListener('pointerup', release, { passive: false });
      btn.addEventListener('pointercancel', release, { passive: false });
      btn.addEventListener('lostpointercapture', release);
      btn.addEventListener('contextmenu', (e) => e.preventDefault());
    });
  }

  gesture() {
    if (this._gestured) return;
    this._gestured = true;
    this.onFirstGesture?.();
  }

  isDown(a) { return this.down.has(a) || this.virtual.has(a); }
  pressed(a) { return this.just.has(a); }
  axis() { return (this.isDown('right') ? 1 : 0) - (this.isDown('left') ? 1 : 0); }
  endFrame() { this.just.clear(); }
}
