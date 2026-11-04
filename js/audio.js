/* Small procedural score and sound effects. No external assets. */

const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

const MODES = {
  title: {
    root: 50, scale: [0, 2, 4, 7, 9, 12, 14, 16], step: 0.52,
    chords: [[50, 57, 62, 66], [47, 54, 59, 62], [43, 50, 55, 59], [45, 52, 57, 61]],
    melody: [62, 64, 66, 69, 71, 74, 76, 78], density: 0.42, pad: 0.045, pluck: 0.035,
  },
  larkspur: {
    root: 50, scale: [0, 2, 4, 7, 9, 12, 14, 16], step: 0.46,
    chords: [[50, 57, 62, 66], [47, 54, 59, 64], [43, 50, 55, 59], [45, 52, 57, 62]],
    melody: [62, 66, 69, 71, 74, 78, 81, 83], density: 0.5, pad: 0.04, pluck: 0.036,
  },
  vireo: {
    root: 45, scale: [0, 2, 3, 5, 7, 10, 12, 15], step: 0.6,
    chords: [[45, 52, 57, 60], [41, 48, 53, 57], [43, 50, 55, 58], [40, 47, 52, 55]],
    melody: [57, 60, 63, 67, 69, 72, 75, 79], density: 0.34, pad: 0.05, pluck: 0.03,
  },
  cinder: {
    root: 40, scale: [0, 2, 3, 5, 7, 8, 12, 15], step: 0.72,
    chords: [[40, 47, 52, 55], [36, 43, 48, 51], [38, 45, 50, 53], [35, 42, 47, 50]],
    melody: [52, 55, 58, 60, 63, 67, 70, 72], density: 0.24, pad: 0.055, pluck: 0.026,
  },
  ending: {
    root: 50, scale: [0, 2, 4, 7, 9, 12, 14, 16], step: 0.62,
    chords: [[50, 57, 62, 66], [45, 52, 57, 61], [47, 54, 59, 62], [43, 50, 55, 59]],
    melody: [62, 66, 69, 74, 78, 81, 86, 90], density: 0.3, pad: 0.04, pluck: 0.03,
  },
};

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.mode = 'title';
    this.muted = localStorage.getItem('gb.muted') === '1';
    this.started = false;
    this.stepIndex = 0;
    this.nextTime = 0;
    this.timer = null;
    this.noise = null;
    this.noiseGain = null;
  }

  ensure() {
    if (this.ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try {
      this.ctx = new AC();
    } catch { return false; }
    const c = this.ctx;
    this.master = c.createGain();
    this.master.gain.value = this.muted ? 0 : 0.9;
    this.master.connect(c.destination);

    this.music = c.createGain();
    this.music.gain.value = 0.5;
    this.music.connect(this.master);

    this.sfx = c.createGain();
    this.sfx.gain.value = 0.75;
    this.sfx.connect(this.master);

    // Soft wind / rain bed.
    const len = c.sampleRate * 3;
    const buffer = c.createBuffer(1, len, c.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = last * 0.985 + white * 0.015;
      data[i] = last * 3.2;
    }
    this.noise = c.createBufferSource();
    this.noise.buffer = buffer;
    this.noise.loop = true;
    const filter = c.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 700;
    filter.Q.value = 0.55;
    this.noiseGain = c.createGain();
    this.noiseGain.gain.value = 0.0;
    this.noise.connect(filter).connect(this.noiseGain).connect(this.master);
    this.noise.start();
    return true;
  }

  resume() {
    if (!this.ensure()) return;
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    if (!this.started) {
      this.started = true;
      this.nextTime = this.ctx.currentTime + 0.15;
      this.stepIndex = 0;
      this.timer = setInterval(() => this.schedule(), 220);
    }
  }

  setMuted(muted) {
    this.muted = muted;
    localStorage.setItem('gb.muted', muted ? '1' : '0');
    if (this.master) {
      const t = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(t);
      this.master.gain.setTargetAtTime(muted ? 0 : 0.9, t, 0.08);
    }
  }

  setScene(mode) {
    if (!MODES[mode]) mode = 'title';
    this.mode = mode;
    if (this.ctx && this.noiseGain) {
      const wet = mode === 'vireo' ? 0.016 : mode === 'cinder' ? 0.008 : 0.003;
      this.noiseGain.gain.setTargetAtTime(this.muted ? 0 : wet, this.ctx.currentTime, 1.2);
    }
  }

  schedule() {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const m = MODES[this.mode] || MODES.title;
    const ahead = this.ctx.currentTime + 0.8;
    let guard = 0;
    while (this.nextTime < ahead && guard++ < 12) {
      this.playStep(this.stepIndex, this.nextTime, m);
      this.nextTime += m.step;
      this.stepIndex++;
    }
  }

  playStep(step, t, m) {
    const bar = Math.floor(step / 8);
    const beat = step % 8;
    if (beat === 0) {
      const chord = m.chords[bar % m.chords.length];
      chord.forEach((n, i) => this.pad(n, t, 4.2, m.pad * (1 - i * 0.12)));
    }
    if (beat === 0 || beat === 4) {
      const bass = m.chords[bar % m.chords.length][0] - 12;
      this.pluck(bass, t, 0.19, 1.8, 'sine');
    }
    if (Math.random() < m.density * 0.55) {
      const n = m.melody[Math.floor(Math.random() * m.melody.length)];
      this.pluck(n + (Math.random() < 0.18 ? 12 : 0), t + Math.random() * 0.05, m.pluck, 1.4, 'triangle');
    }
    if (step % 16 === 12 && Math.random() < 0.5) {
      const n = m.melody[Math.floor(Math.random() * m.melody.length)] + 12;
      this.pluck(n, t, m.pluck * 0.6, 2.2, 'sine');
    }
  }

  pad(note, t, dur, vol) {
    if (!this.ctx) return;
    const c = this.ctx;
    const freq = midi(note);
    const osc = c.createOscillator();
    const osc2 = c.createOscillator();
    const gain = c.createGain();
    const filter = c.createBiquadFilter();
    osc.type = 'sine';
    osc2.type = 'triangle';
    osc.frequency.value = freq;
    osc2.frequency.value = freq * 1.003;
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    filter.Q.value = 0.4;
    gain.gain.value = 0;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol, t + 1.8);
    gain.gain.linearRampToValueAtTime(0, t + dur);
    osc.connect(filter);
    osc2.connect(filter);
    filter.connect(gain).connect(this.music);
    osc.start(t); osc2.start(t);
    osc.stop(t + dur + 0.1); osc2.stop(t + dur + 0.1);
  }

  pluck(note, t, vol, dur, type = 'triangle') {
    if (!this.ctx) return;
    const c = this.ctx;
    const osc = c.createOscillator();
    const gain = c.createGain();
    const filter = c.createBiquadFilter();
    osc.type = type;
    osc.frequency.value = midi(note);
    filter.type = 'lowpass';
    filter.frequency.value = 2600;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol, t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(filter).connect(gain).connect(this.music);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  tone(freq, dur, vol, type = 'sine', slide = 0, delay = 0) {
    if (!this.ctx || this.muted) return;
    const c = this.ctx;
    const t = c.currentTime + delay;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(vol, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(this.sfx);
    osc.start(t);
    osc.stop(t + dur + 0.03);
  }

  noiseBurst(dur, vol, freq = 1200, q = 0.8, delay = 0) {
    if (!this.ctx || this.muted) return;
    const c = this.ctx;
    const t = c.currentTime + delay;
    const len = Math.max(1, Math.floor(c.sampleRate * dur));
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource();
    src.buffer = buf;
    const filter = c.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    filter.Q.value = q;
    const gain = c.createGain();
    gain.gain.value = vol;
    src.connect(filter).connect(gain).connect(this.sfx);
    src.start(t);
  }

  jump() { this.tone(300, 0.16, 0.1, 'sine', 260); }
  doubleJump() { this.tone(440, 0.2, 0.09, 'triangle', 340); this.tone(660, 0.16, 0.05, 'sine', 180, 0.03); }
  land() { this.tone(110, 0.1, 0.11, 'sine', -40); this.noiseBurst(0.08, 0.05, 500, 0.6); }
  step() { this.noiseBurst(0.045, 0.018, 900, 1.2); }
  switch() { this.tone(520, 0.22, 0.07, 'sine', 160); this.tone(780, 0.28, 0.05, 'triangle', 200, 0.05); }
  interact() { this.tone(392, 0.14, 0.07, 'sine'); this.tone(587, 0.22, 0.06, 'sine', 0, 0.08); }
  gate() { this.noiseBurst(0.7, 0.09, 240, 1.4); this.tone(70, 0.7, 0.07, 'sawtooth', -20); }
  pickup() { [784, 988, 1175].forEach((f, i) => this.tone(f, 0.5, 0.06, 'sine', 0, i * 0.07)); }
  memory() { [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.9, 0.05, 'sine', 0, i * 0.09)); }
  heal() { [392, 523, 659].forEach((f, i) => this.tone(f, 0.5, 0.05, 'triangle', 0, i * 0.06)); }
  hurt() { this.tone(180, 0.28, 0.13, 'sawtooth', -100); this.noiseBurst(0.2, 0.08, 400, 0.6); }
  strike() { this.noiseBurst(0.12, 0.07, 1800, 1.2); this.tone(240, 0.12, 0.05, 'square', -80); }
  enemyDown() { this.tone(300, 0.3, 0.07, 'square', -180); this.noiseBurst(0.3, 0.07, 700, 0.8, 0.05); }
  death() { [220, 174, 130].forEach((f, i) => this.tone(f, 0.7, 0.08, 'sine', -20, i * 0.16)); }
  complete() { [392, 523, 659, 784, 1046].forEach((f, i) => this.tone(f, 1.4, 0.06, 'sine', 0, i * 0.12)); }
  ui() { this.tone(660, 0.07, 0.035, 'sine'); }
  deny() { this.tone(180, 0.12, 0.06, 'square', -30); }
}

export const audio = new AudioEngine();
