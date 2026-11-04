/* Core game: state machine, physics, interaction, story flow. */

import { LEVELS, MEMORIES, CITIES, INTRO_SLIDES, ENDING_COPY } from './levels.js';
import { Renderer } from './render.js';
import { AudioEngine } from './audio.js';
import { Input } from './input.js';
import { UI } from './ui.js';

const SAVE_KEY = 'gb.save.v1';
const MAX_HEALTH = 3;

const CHAR = {
  mira: { w: 30, h: 60, speed: 312, accel: 2300, jump: 650, jumps: 2 },
  teo: { w: 34, h: 66, speed: 282, accel: 2050, jump: 660, jumps: 1 },
};

const clone = (v) => JSON.parse(JSON.stringify(v));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const overlaps = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

function loadSave() {
  try {
    const raw = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (!raw || typeof raw !== 'object') throw new Error('none');
    return {
      started: !!raw.started,
      level: clamp(Number(raw.level) || 0, 0, 2),
      memories: Array.isArray(raw.memories) ? [...new Set(raw.memories.filter((m) => MEMORIES[m]))] : [],
      completed: !!raw.completed,
      totalTime: Number(raw.totalTime) || 0,
      deaths: Number(raw.deaths) || 0,
    };
  } catch {
    return { started: false, level: 0, memories: [], completed: false, totalTime: 0, deaths: 0 };
  }
}

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.audio = new AudioEngine();
    this.audio.setMuted(this.audio.muted);
    this.input = new Input();
    this.renderer = new Renderer(this, canvas);
    this.ui = new UI(this);

    this.cityList = CITIES;
    this.introSlides = INTRO_SLIDES;
    this.endingCopy = ENDING_COPY;

    this.save = loadSave();
    this.state = 'title';
    this.introSlide = 0;
    this.pending = null;
    this.level = null;
    this.levelIndex = 0;
    this.levelTime = 0;
    this.totalTime = this.save.totalTime;
    this.deaths = 0;
    this.health = MAX_HEALTH;
    this.player = null;
    this.partner = null;
    this.camera = { x: 0, y: 0 };
    this.trail = [];
    this.dialogueQueue = [];
    this.particles = [];
    this.shake = 0;
    this.respawnTimer = 0;
    this.triggerFired = new Set();
    this.hasCapacitor = false;
    this.promptCache = '';
    this.lastStats = null;
    this.journalReturn = 'playing';
    this.stepTimer = 0;
    this.dustTimer = 0;
    this.last = performance.now();
    this.accumulator = 0;
    this.dialoguePause = false;

    this.bindUI();
    this.audio.setScene('title');
    this.ui.setMuted(this.audio.muted);
    this.ui.showTitle(this.hasSave());
    this.ui.setHearts(MAX_HEALTH);
    this.ui.setShards(this.save.memories.length, Object.keys(MEMORIES).length);
    this.input.onFirstGesture = () => {
      this.audio.resume();
      this.audio.ui();
    };

    requestAnimationFrame((t) => this.loop(t));
  }

  hasSave() { return this.save.started && !this.save.completed; }

  saveGame() {
    localStorage.setItem(SAVE_KEY, JSON.stringify(this.save));
  }

  formatTime(sec) {
    const s = Math.max(0, Math.floor(sec));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  bindUI() {
    const click = (id, fn) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('click', (e) => {
        e.preventDefault();
        this.audio.resume();
        this.audio.ui();
        fn();
      });
    };

    click('btn-new', () => this.newJourney());
    click('btn-continue', () => this.continueJourney());
    click('btn-how', () => { this.pending = 'title'; this.ui.showScreen('how'); });
    click('btn-how-close', () => { this.ui.showTitle(this.hasSave()); this.audio.setScene('title'); });
    click('btn-intro-next', () => this.advanceIntro());
    click('btn-intro-skip', () => this.finishIntro());
    click('btn-interlude-go', () => this.startLevel(this.save.level));
    click('btn-interlude-journal', () => this.openJournal('interlude'));
    click('btn-resume', () => this.resumeGame());
    click('btn-pause-journal', () => this.openJournal('paused'));
    click('btn-restart', () => this.restartLevel());
    click('btn-quit', () => this.quitToTitle());
    click('btn-journal-close', () => this.closeJournal());
    click('btn-complete-next', () => this.nextAfterComplete());
    click('btn-complete-journal', () => this.openJournal('complete'));
    click('btn-ending-journal', () => this.openJournal('ending'));
    click('btn-ending-again', () => this.newJourney());

    click('btn-journal', () => { if (this.state === 'playing') this.openJournal('playing'); });
    click('btn-pause', () => { if (this.state === 'playing') this.pauseGame(); });
    click('btn-sound', () => this.toggleMute());

    window.addEventListener('resize', () => this.resize());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'playing' && !this.ui.dialogueActive) this.pauseGame();
    });
  }

  toggleMute() {
    this.audio.setMuted(!this.audio.muted);
    this.ui.setMuted(this.audio.muted);
  }

  /* ------------------------------------------------------------ */
  /* Flow                                                         */
  /* ------------------------------------------------------------ */

  newJourney() {
    this.save = { started: true, level: 0, memories: [], completed: false, totalTime: 0, deaths: 0 };
    this.saveGame();
    this.totalTime = 0;
    this.introSlide = 0;
    this.state = 'intro';
    this.audio.setScene('title');
    this.ui.showIntro(0);
    this.ui.showScreen('intro');
  }

  continueJourney() {
    if (!this.hasSave()) { this.newJourney(); return; }
    this.state = 'interlude';
    this.ui.showInterlude(this.save.level);
    this.audio.setScene(CITIES[this.save.level].id);
  }

  advanceIntro() {
    if (this.introSlide < this.introSlides.length - 1) {
      this.introSlide++;
      this.ui.showIntro(this.introSlide);
      this.audio.setScene(this.introSlide === 2 ? 'signal' : 'title');
    } else {
      this.finishIntro();
    }
  }

  finishIntro() {
    this.save.started = true;
    this.save.level = 0;
    this.saveGame();
    this.state = 'interlude';
    this.ui.showInterlude(0);
    this.audio.setScene('larkspur');
  }

  nextAfterComplete() {
    if (this.levelIndex >= LEVELS.length - 1) { this.finishJourney(); return; }
    this.save.level = this.levelIndex + 1;
    this.saveGame();
    this.state = 'interlude';
    this.ui.showInterlude(this.save.level);
    this.audio.setScene(CITIES[this.save.level].id);
  }

  startLevel(index) {
    index = clamp(index, 0, LEVELS.length - 1);
    this.levelIndex = index;
    this.save.level = index;
    this.level = clone(LEVELS[index]);
    this.levelTime = 0;
    this.deaths = 0;
    this.health = MAX_HEALTH;
    this.player = null;
    this.partner = null;
    this.particles = [];
    this.trail = [];
    this.dialogueQueue = [];
    this.triggerFired = new Set();
    this.hasCapacitor = false;
    this.respawnTimer = 0;
    this.shake = 0;
    this.promptCache = '';
    this.dialoguePause = false;

    for (const s of this.level.shards) s.collected = this.save.memories.includes(s.memory);
    for (const it of this.level.interactables) {
      if (it.type === 'gate') { it.open = false; it.openT = 0; }
      if (it.type === 'terminal') it.on = false;
      if (it.type === 'rubble') it.cleared = false;
      if (it.type === 'beacon') it.on = false;
    }

    const spawn = this.level.spawn;
    this.player = this.makePlayer('mira', spawn.x, spawn.y, 1);
    this.partner = this.makePlayer('teo', spawn.x - 48, spawn.y, 1);
    this.respawnPoint = { x: spawn.x, y: spawn.y };

    this.ui.resetDialogue();
    this.ui.hideScreens();
    this.ui.setHudVisible(true);
    this.ui.setTouchVisible(true);
    this.ui.setLevelInfo(this.level);
    this.ui.setHearts(this.health);
    this.ui.setShards(this.save.memories.length, Object.keys(MEMORIES).length);
    this.ui.hidePrompt();
    this.ui.fade(true);
    setTimeout(() => this.ui.fade(false), 160);

    this.audio.setScene(this.level.id);
    this.state = 'playing';
    this.snapCamera();
    this.updateTrail(true);
    this.ui.setObjective(this.level.objective);
    this.promptCache = '';
    this.last = performance.now();
    this.accumulator = 0;
    this.saveGame();
  }

  makePlayer(char, centerX, feetY, facing = 1) {
    const c = CHAR[char];
    return {
      char,
      x: centerX - c.w / 2,
      y: feetY - c.h,
      w: c.w,
      h: c.h,
      vx: 0,
      vy: 0,
      facing,
      onGround: false,
      jumpsLeft: c.jumps,
      coyote: 0,
      jumpBuffer: 0,
      jumpCut: false,
      runPhase: 0,
      invuln: 0,
      attackT: 0,
      attackCd: 0,
      attackHits: new Set(),
      groundPlatform: null,
      stepTimer: 0,
    };
  }

  restartLevel() {
    this.ui.hideScreens();
    this.startLevel(this.levelIndex);
  }

  quitToTitle() {
    this.state = 'title';
    this.level = null;
    this.player = null;
    this.partner = null;
    this.ui.setHudVisible(false);
    this.ui.setTouchVisible(false);
    this.ui.showTitle(this.hasSave());
    this.audio.setScene('title');
    this.saveGame();
  }

  finishJourney() {
    this.save.completed = true;
    this.save.totalTime = this.totalTime + this.levelTime;
    this.save.deaths += this.deaths;
    this.saveGame();
    this.lastStats = { shards: this.save.memories.length, time: this.save.totalTime, deaths: this.save.deaths };
    this.state = 'ending';
    this.ui.showEnding(this.lastStats);
    this.audio.setScene('ending');
    this.audio.complete();
  }

  completeLevel() {
    this.totalTime += this.levelTime;
    this.save.totalTime = this.totalTime;
    this.save.deaths += this.deaths;
    this.save.level = Math.min(this.levelIndex + 1, LEVELS.length - 1);
    this.saveGame();
    const city = CITIES[this.levelIndex];
    const stats = {
      chapter: city.chapter,
      name: city.name,
      shards: this.save.memories.filter((m) => MEMORIES[m]?.city === city.name).length,
      time: this.levelTime,
      deaths: this.deaths,
    };
    this.lastStats = stats;
    this.completeText = this.level.completeText;
    this.state = 'complete';
    this.ui.setHudVisible(false);
    this.ui.setTouchVisible(false);
    this.ui.hidePrompt();
    this.ui.showComplete(stats, this.level.completeText);
    this.audio.complete();
  }

  pauseGame() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.ui.hidePrompt();
    this.ui.setHudVisible(false);
    this.ui.setTouchVisible(false);
    this.ui.showScreen('pause');
  }

  resumeGame() {
    this.state = 'playing';
    this.ui.hideScreens();
    this.ui.setHudVisible(true);
    this.ui.setTouchVisible(true);
    this.last = performance.now();
    this.accumulator = 0;
  }

  openJournal(returnTo) {
    if (this.state === 'journal') return;
    this.journalReturn = returnTo || (this.state === 'playing' ? 'playing' : this.state);
    this.state = 'journal';
    this.ui.buildJournal(this.save);
    this.ui.showScreen('journal');
    this.ui.setHudVisible(false);
    this.ui.setTouchVisible(false);
  }

  closeJournal() {
    this.state = this.journalReturn;
    if (this.journalReturn === 'paused') {
      this.state = 'paused';
      this.ui.showScreen('pause');
    } else if (this.journalReturn === 'interlude') {
      this.state = 'interlude';
      this.ui.showInterlude(this.save.level);
    } else if (this.journalReturn === 'ending') {
      this.state = 'ending';
      this.ui.showEnding(this.lastStats || { shards: this.save.memories.length, time: this.save.totalTime, deaths: this.save.deaths });
    } else if (this.journalReturn === 'complete') {
      this.state = 'complete';
      this.ui.showComplete(this.lastStats, this.completeText || this.level?.completeText || '');
    } else {
      this.state = 'playing';
      this.ui.hideScreens();
      this.ui.setHudVisible(true);
      this.ui.setTouchVisible(true);
    }
    this.last = performance.now();
    this.accumulator = 0;
  }

  /* ------------------------------------------------------------ */
  /* Input / loop                                                 */
  /* ------------------------------------------------------------ */

  loop(now) {
    const raw = Math.max(0, (now - this.last) / 1000);
    this.last = now;

    // Fixed simulation steps keep movement and jump arcs identical whether the
    // device runs at 120 fps or struggles at 20. Input "just pressed" is only
    // visible to the first step of the frame so one tap is never repeated.
    const frameDt = Math.min(0.1, raw);
    this.accumulator = Math.min(0.25, (this.accumulator || 0) + frameDt);

    const STEP = 1 / 120;
    let steps = 0;
    while (this.accumulator >= STEP && steps < 12) {
      this.update(STEP);
      this.accumulator -= STEP;
      steps++;
      if (steps === 1) this.input.endFrame();
    }
    if (steps === 12) this.accumulator = 0;

    // DOM work is expensive on software renderers, so it runs once per
    // rendered frame instead of once per simulation step.
    const uiDt = Math.min(0.05, frameDt);
    if (this.ui.dialogueActive) {
      this.ui.updateDialogue(uiDt);
    } else if (this.state === 'playing' && this.respawnTimer <= 0) {
      this.updatePrompt();
    }

    this.renderer.render(uiDt);
    requestAnimationFrame((t) => this.loop(t));
  }

  update(dt) {
    const input = this.input;

    if (input.pressed('mute')) this.toggleMute();

    if (this.ui.dialogueActive) {
      if (input.pressed('action') || input.pressed('jump') || input.pressed('strike') || input.pressed('pause')) {
        this.advanceDialogue();
      }
      this.updateParticles(dt);
      this.shake = Math.max(0, this.shake - dt * 3);
      return;
    }

    if (input.pressed('pause')) {
      if (this.state === 'playing') this.pauseGame();
      else if (this.state === 'paused') this.resumeGame();
      else if (this.state === 'journal') this.closeJournal();
      return;
    }

    if (input.pressed('journal')) {
      if (this.state === 'playing') { this.openJournal('playing'); return; }
      if (this.state === 'journal') { this.closeJournal(); return; }
    }

    if (this.state === 'playing') {
      if (input.pressed('switch')) this.switchCharacter();
      this.updatePlaying(dt);
    } else {
      this.updateParticles(dt);
    }
  }

  updatePlaying(dt) {
    if (this.respawnTimer > 0) {
      this.respawnTimer -= dt;
      this.updateParticles(dt);
      this.shake = Math.max(0, this.shake - dt * 2.5);
      if (this.respawnTimer <= 0) this.doRespawn();
      return;
    }

    this.levelTime += dt;
    this.updateMovingPlatforms(dt);
    this.updatePlayer(dt);
    this.updateTrail();
    this.updatePartner(dt);
    this.updateEnemies(dt);
    this.updateInteractions(dt);
    this.updateCamera(dt);
    this.updateParticles(dt);

    this.shake = Math.max(0, this.shake - dt * 3.4);
  }

  /* ------------------------------------------------------------ */
  /* Player physics                                               */
  /* ------------------------------------------------------------ */

  getSolids() {
    const out = [];
    if (!this.level) return out;
    for (const pl of this.level.platforms) out.push(pl);
    for (const it of this.level.interactables) {
      if (!it.solid) continue;
      if (it.type === 'rubble' && it.cleared) continue;
      if (it.type === 'gate' && it.open) continue;
      out.push(it);
    }
    return out;
  }

  updateMovingPlatforms(dt) {
    for (const pl of this.level.platforms) {
      if (!pl.move) continue;
      const m = pl.move;
      const offset = Math.sin(this.levelTime * m.speed + m.phase) * m.dist;
      const nx = m.axis === 'x' ? pl.baseX + offset : pl.baseX;
      const ny = m.axis === 'y' ? pl.baseY + offset : pl.baseY;
      const dx = nx - pl.x;
      const dy = ny - pl.y;
      pl.x = nx;
      pl.y = ny;
      if (this.player && this.player.groundPlatform === pl) {
        this.player.x += dx;
        this.player.y += dy;
      }
    }
  }

  updatePlayer(dt) {
    const p = this.player;
    if (!p) return;
    const c = CHAR[p.char];
    const input = this.input;

    if (p.invuln > 0) p.invuln -= dt;
    if (p.attackT > 0) {
      p.attackT -= dt;
      if (p.attackT > 0) this.checkAttackHits(p);
    } else {
      p.attackT = 0;
    }
    if (p.attackCd > 0) p.attackCd -= dt;
    if (p.coyote > 0) p.coyote -= dt;
    if (p.jumpBuffer > 0) p.jumpBuffer -= dt;

    const axis = input.axis();
    const target = axis * c.speed;
    if (axis !== 0) {
      p.vx += Math.sign(target - p.vx) * c.accel * dt;
      if (Math.abs(p.vx) > c.speed && Math.sign(p.vx) === Math.sign(target)) p.vx = target;
      p.facing = axis;
    } else {
      const fr = c.accel * 1.25 * dt;
      if (Math.abs(p.vx) <= fr) p.vx = 0;
      else p.vx -= Math.sign(p.vx) * fr;
    }

    if (input.pressed('jump')) p.jumpBuffer = 0.13;

    if (p.jumpBuffer > 0) {
      if (p.onGround || p.coyote > 0) {
        p.vy = -c.jump;
        p.onGround = false;
        p.coyote = 0;
        p.jumpsLeft = c.jumps - 1;
        p.jumpBuffer = 0;
        p.jumpCut = false;
        this.audio.jump();
        this.burst(p.x + p.w / 2, p.y + p.h, 7, ['rgba(210,200,170,0.45)', 'rgba(160,180,140,0.3)'], 60, 0.4, 2);
      } else if (p.jumpsLeft > 0) {
        p.vy = -560;
        p.jumpsLeft--;
        p.jumpBuffer = 0;
        p.jumpCut = false;
        this.audio.doubleJump();
        this.burst(p.x + p.w / 2, p.y + p.h * 0.7, 10, ['rgba(150,230,200,0.5)', 'rgba(220,240,200,0.35)'], 90, 0.5, 1.6);
        this.ring(p.x + p.w / 2, p.y + p.h * 0.65, 'rgba(160,235,205,0.55)', 22);
      }
    }

    if (!input.isDown('jump') && p.vy < -210 && !p.jumpCut) {
      p.vy *= 0.52;
      p.jumpCut = true;
    }

    p.vy += 2000 * dt;
    if (p.vy > 950) p.vy = 950;

    if (p.attackCd <= 0 && input.pressed('strike')) {
      p.attackT = 0.22;
      p.attackCd = 0.42;
      p.attackHits = new Set();
      this.audio.strike();
    }

    const wasGround = p.onGround;
    const prevVy = p.vy;

    // Horizontal.
    p.x += p.vx * dt;
    for (const s of this.getSolids()) {
      if (!overlaps(p, s)) continue;
      if (p.vx > 0) p.x = s.x - p.w;
      else if (p.vx < 0) p.x = s.x + s.w;
      p.vx = 0;
    }
    p.x = clamp(p.x, 0, this.level.width - p.w);

    // Vertical.
    p.onGround = false;
    p.groundPlatform = null;
    p.y += p.vy * dt;
    for (const s of this.getSolids()) {
      if (!overlaps(p, s)) continue;
      if (p.vy > 0) {
        p.y = s.y - p.h;
        p.vy = 0;
        p.onGround = true;
        p.groundPlatform = s;
      } else if (p.vy < 0) {
        p.y = s.y + s.h;
        p.vy = 0;
      }
    }

    if (p.onGround) {
      p.jumpsLeft = c.jumps;
      p.coyote = 0.1;
      if (!wasGround && prevVy > 260) {
        this.audio.land();
        this.burst(p.x + p.w / 2, p.y + p.h, 9, ['rgba(200,190,160,0.4)', 'rgba(140,160,120,0.3)'], 80, 0.45, 2.4);
        this.shake = Math.min(0.4, this.shake + prevVy / 2400);
      }
    }

    if (Math.abs(p.vx) > 30 && p.onGround) {
      p.runPhase += dt * (8 + Math.abs(p.vx) * 0.035);
      p.dustTimer = (p.dustTimer || 0) - dt;
      if (p.dustTimer <= 0) {
        p.dustTimer = 0.13;
        this.burst(p.x + p.w / 2 - p.facing * 8, p.y + p.h - 2, 2, ['rgba(180,170,140,0.26)', 'rgba(130,150,110,0.2)'], 24, 0.4, 1.7);
        if (p.stepTimer <= 0) { this.audio.step(); p.stepTimer = 0.24; }
      }
    }
    if (p.stepTimer > 0) p.stepTimer -= dt;

    // World bounds.
    if (p.y > this.level.height + 120) this.fall();

    // Hazards.
    for (const hz of this.level.hazards) {
      if (!overlaps(p, hz)) continue;
      if (hz.type === 'water') { this.fall(); break; }
      if (hz.type === 'radiation') {
        if (p.char !== 'teo' && p.invuln <= 0) this.hurt();
      }
    }

    // Enemies contact.
    for (const e of this.level.enemies) {
      if (!e.alive) continue;
      const box = this.enemyBox(e);
      if (overlaps(p, box) && p.invuln <= 0) this.hurt();
    }

    // Footstep camera / lookahead handled in camera.
  }

  checkAttackHits(p) {
    if (p.attackT <= 0) return;
    const dir = p.facing || 1;
    const hitbox = {
      x: dir > 0 ? p.x + p.w * 0.5 : p.x - 52,
      y: p.y - 8,
      w: 70,
      h: p.h + 16,
    };
    for (const e of this.level.enemies) {
      if (!e.alive || p.attackHits.has(e)) continue;
      const box = this.enemyBox(e);
      if (!overlaps(hitbox, box)) continue;
      p.attackHits.add(e);
      e.hp -= 1;
      e.hitT = 0.26;
      const cx = box.x + box.w / 2;
      const cy = box.y + box.h / 2;
      this.burst(cx, cy, 12, ['rgba(255,230,170,0.9)', 'rgba(255,150,90,0.7)', 'rgba(220,240,200,0.6)'], 180, 0.5, 2);
      this.audio.strike();
      this.shake = Math.min(0.5, this.shake + 0.18);
      if (e.hp <= 0) {
        e.alive = false;
        this.burst(cx, cy, 26, ['rgba(255,200,130,0.8)', 'rgba(160,170,140,0.6)', 'rgba(220,235,200,0.5)'], 220, 0.9, 2.4);
        this.ring(cx, cy, 'rgba(255,210,140,0.5)', 30);
        this.audio.enemyDown();
      }
    }
  }

  enemyBox(e) {
    if (e.type === 'drone') return { x: e.x - 18, y: e.y - 16, w: 36, h: 32 };
    return { x: e.x - 20, y: e.y - 28, w: 40, h: 28 };
  }

  /* ------------------------------------------------------------ */
  /* Partner follow                                               */
  /* ------------------------------------------------------------ */

  updateTrail(force = false) {
    const p = this.player;
    if (!p) return;
    const pt = { x: p.x + p.w / 2, y: p.y + p.h, t: this.levelTime };
    const last = this.trail[this.trail.length - 1];
    if (force || !last || Math.abs(last.x - pt.x) > 6 || Math.abs(last.y - pt.y) > 6) {
      this.trail.push(pt);
      while (this.trail.length > 80) this.trail.shift();
    }
    const cutoff = this.levelTime - 3;
    while (this.trail.length > 2 && this.trail[0].t < cutoff) this.trail.shift();
  }

  updatePartner(dt) {
    const p = this.player;
    const q = this.partner;
    if (!p || !q) return;
    const targetT = this.levelTime - 0.42;
    let target = this.trail[0] || { x: p.x + p.w / 2, y: p.y + p.h };
    for (let i = this.trail.length - 1; i >= 0; i--) {
      if (this.trail[i].t <= targetT) { target = this.trail[i]; break; }
    }
    // Keep a little distance even when standing still.
    const desiredX = target.x - p.facing * 34;
    const desiredY = target.y;
    const dx = desiredX - (q.x + q.w / 2);
    const dy = desiredY - (q.y + q.h);
    const dist = Math.hypot(dx, dy);
    if (dist > 520 || this.levelTime - (target.t ?? 0) > 2.5) {
      q.x = desiredX - q.w / 2;
      q.y = desiredY - q.h;
      q.vy = 0;
      q.onGround = true;
    } else {
      const k = 1 - Math.exp(-7 * dt);
      const nx = q.x + q.w / 2 + dx * k;
      const ny = q.y + q.h + dy * k;
      const move = nx - (q.x + q.w / 2);
      q.runPhase += Math.abs(move) * 0.08;
      q.facing = p.facing;
      q.vy = dy * 6;
      q.onGround = Math.abs(dy) < 8;
      q.x = nx - q.w / 2;
      q.y = ny - q.h;
      if (Math.abs(move) > 0.3) {
        q.runPhase += dt * 2;
      }
    }
    q.invuln = 0;
    q.attackT = 0;
  }

  switchCharacter() {
    if (this.state !== 'playing' || this.ui.dialogueActive || this.respawnTimer > 0) return;
    const p = this.player;
    const q = this.partner;
    const oldChar = p.char;
    const newChar = q.char === oldChar ? (oldChar === 'mira' ? 'teo' : 'mira') : q.char;
    const feet = p.y + p.h;
    const cx = p.x + p.w / 2;
    p.char = newChar;
    p.w = CHAR[newChar].w;
    p.h = CHAR[newChar].h;
    p.x = cx - p.w / 2;
    p.y = feet - p.h;
    p.jumpsLeft = CHAR[newChar].jumps;
    q.char = oldChar;
    q.w = CHAR[oldChar].w;
    q.h = CHAR[oldChar].h;
    q.x = cx - p.facing * 30 - q.w / 2;
    q.y = feet - q.h;
    this.trail = [{ x: cx, y: feet, t: this.levelTime }];
    this.promptCache = '';
    this.audio.switch();
    this.ring(cx, feet - p.h / 2, newChar === 'teo' ? 'rgba(240,190,110,0.65)' : 'rgba(140,230,205,0.65)', 30);
    this.burst(cx, feet - p.h / 2, 14, newChar === 'teo'
      ? ['rgba(240,190,110,0.8)', 'rgba(220,150,80,0.5)']
      : ['rgba(150,235,210,0.8)', 'rgba(200,245,220,0.5)'], 120, 0.6, 1.8);
    if (this.input.virtual.size === 0) {
      this.ui.toast(newChar === 'teo' ? 'Teo takes the lead — strong, heat-hardened' : 'Mira takes the lead — quick, double jump', 'memory');
    }
  }

  /* ------------------------------------------------------------ */
  /* Enemies                                                      */
  /* ------------------------------------------------------------ */

  updateEnemies(dt) {
    const p = this.player;
    for (const e of this.level.enemies) {
      if (!e.alive) continue;
      if (e.hitT > 0) e.hitT -= dt;
      if (e.type === 'drone') {
        e.x += e.speed * e.dir * dt;
        if (e.x < e.range[0]) { e.x = e.range[0]; e.dir = 1; }
        if (e.x > e.range[1]) { e.x = e.range[1]; e.dir = -1; }
      } else {
        e.x += e.speed * e.dir * dt;
        if (e.x < e.range[0]) { e.x = e.range[0]; e.dir = 1; }
        if (e.x > e.range[1]) { e.x = e.range[1]; e.dir = -1; }
      }
      // Touch damage handled in player update.
    }
  }

  /* ------------------------------------------------------------ */
  /* Interaction / pickups                                        */
  /* ------------------------------------------------------------ */

  nearbyInteractable() {
    const p = this.player;
    if (!p) return null;
    for (const it of this.level.interactables) {
      if (it.type === 'gate') continue;
      if (it.type === 'rubble' && it.cleared) continue;
      if (it.type === 'terminal' && it.on) continue;
      if (it.type === 'beacon' && it.on) continue;
      if (it.type === 'capacitor' && it.collected) continue;
      if (it.type === 'capacitor') continue;
      if (!it.w || !it.h) continue;
      const zone = { x: it.x - 46, y: it.y - 36, w: it.w + 92, h: it.h + 72 };
      if (overlaps(p, zone)) return it;
    }
    return null;
  }

  updateInteractions(dt) {
    const p = this.player;
    const level = this.level;

    // Shards.
    for (const s of level.shards) {
      if (s.collected) continue;
      if (overlaps(p, { x: s.x - 10, y: s.y - 10, w: s.w + 20, h: s.h + 20 })) {
        s.collected = true;
        if (!this.save.memories.includes(s.memory)) this.save.memories.push(s.memory);
        this.saveGame();
        const mem = MEMORIES[s.memory];
        this.ui.toast(`Memory — ${mem.title}`, 'memory');
        this.ui.setShards(this.save.memories.length, Object.keys(MEMORIES).length);
        this.burst(s.x + s.w / 2, s.y + s.h / 2, 22, ['rgba(180,245,220,0.9)', 'rgba(120,210,190,0.7)', 'rgba(255,245,200,0.8)'], 140, 1.0, 2);
        this.ring(s.x + s.w / 2, s.y + s.h / 2, 'rgba(170,240,215,0.6)', 34);
        this.audio.memory();
      }
    }

    // Heals.
    for (const h of level.heals) {
      if (h.collected) continue;
      if (overlaps(p, { x: h.x - 8, y: h.y - 8, w: h.w + 16, h: h.h + 16 })) {
        h.collected = true;
        this.health = Math.min(MAX_HEALTH, this.health + 1);
        this.ui.setHearts(this.health);
        this.ui.toast('Sap from a stubborn little plant. +1 heart');
        this.burst(h.x + h.w / 2, h.y + h.h / 2, 14, ['rgba(180,240,140,0.8)', 'rgba(120,190,90,0.6)'], 90, 0.7, 2);
        this.audio.heal();
      }
    }

    // Capacitor.
    for (const it of level.interactables) {
      if (it.type !== 'capacitor' || it.collected) continue;
      if (overlaps(p, { x: it.x - 30, y: it.y - 40, w: 60, h: 80 })) {
        it.collected = true;
        this.hasCapacitor = true;
        this.ui.setObjective('Reach the control tower and power the antenna');
        this.ui.toast('Found a capacitor — still humming');
        this.burst(it.x, it.y, 18, ['rgba(160,225,255,0.9)', 'rgba(120,190,240,0.6)'], 110, 0.7, 2);
        this.audio.pickup();
      }
    }

    // Checkpoints.
    for (const cp of level.checkpoints) {
      if (cp.active) continue;
      if (p.x + p.w / 2 > cp.x - 6) {
        cp.active = true;
        this.respawnPoint = { x: cp.x, y: cp.y };
        this.ui.toast('Checkpoint — you will remember this place');
        this.burst(cp.x + 9, cp.y - 43, 12, ['rgba(255,210,130,0.8)', 'rgba(240,180,100,0.5)'], 70, 0.7, 1.6);
        this.audio.interact();
      }
    }

    // Triggers.
    if (!this.ui.dialogueActive && this.dialogueQueue.length === 0) {
      const pcx = p.x + p.w / 2;
      for (const tr of level.triggers) {
        if (tr.once && this.triggerFired.has(tr.key)) continue;
        if (pcx >= tr.x && pcx <= tr.x + tr.w) {
          this.triggerFired.add(tr.key);
          this.playDialogue(tr.lines);
          break;
        }
      }
    }

    // Action / interaction.
    if (this.input.pressed('action')) {
      const it = this.nearbyInteractable();
      if (it) this.interact(it);
    }
  }

  interact(it) {
    const p = this.player;
    if (it.requires && it.requires !== p.char) {
      const name = it.requires === 'mira' ? 'Mira' : 'Teo';
      this.ui.toast(`Switch to ${name} — press Q`);
      this.audio.deny();
      return;
    }
    if (it.type === 'rubble') {
      it.cleared = true;
      this.burst(it.x + it.w / 2, it.y + it.h - 20, 24, ['rgba(200,195,160,0.7)', 'rgba(140,140,110,0.6)', 'rgba(120,150,80,0.4)'], 190, 0.8, 3);
      this.shake = Math.min(0.7, this.shake + 0.45);
      this.ui.toast('Teo heaves the rubble aside');
      this.audio.gate();
      this.promptCache = '';
      return;
    }
    if (it.type === 'terminal') {
      it.on = true;
      const gate = this.level.interactables.find((g) => g.type === 'gate' && g.id === it.gate);
      if (gate) { gate.open = true; this.audio.gate(); this.shake = Math.min(0.5, this.shake + 0.3); }
      this.burst(it.x + it.w / 2, it.y + 20, 18, ['rgba(140,240,190,0.8)', 'rgba(220,255,230,0.5)'], 100, 0.8, 1.6);
      this.ring(it.x + it.w / 2, it.y + 20, 'rgba(140,240,190,0.55)', 28);
      this.ui.toast('The old machine remembers its job');
      this.audio.pickup();
      this.promptCache = '';
      return;
    }
    if (it.type === 'beacon') {
      if (it.needsKey && !this.hasCapacitor) {
        this.ui.toast('The radio needs a capacitor. Search the drowned station.');
        this.audio.deny();
        return;
      }
      it.on = true;
      this.audio.interact();
      this.burst(it.x + it.w / 2, it.y - 50, 30, ['rgba(170,245,220,0.9)', 'rgba(255,240,190,0.8)'], 160, 1.2, 2);
      this.ring(it.x + it.w / 2, it.y - 40, 'rgba(170,245,220,0.6)', 50);
      this.playDialogue(this.level.beaconLines, () => {
        if (this.levelIndex === LEVELS.length - 1) this.finishJourney();
        else this.completeLevel();
      });
      this.promptCache = '';
    }
  }

  /* ------------------------------------------------------------ */
  /* Dialogue                                                     */
  /* ------------------------------------------------------------ */

  playDialogue(lines, onDone = null) {
    if (!lines || !lines.length) { onDone?.(); return; }
    this.dialogueQueue.push({ lines, onDone });
    this.pumpDialogue();
  }

  pumpDialogue() {
    if (this.ui.dialogueActive || this.dialogueQueue.length === 0) return;
    if (this.state !== 'playing') return;
    const { lines, onDone } = this.dialogueQueue.shift();
    this.ui.startDialogue(lines, () => {
      onDone?.();
      this.pumpDialogue();
    });
    this.ui.hidePrompt();
    this.promptCache = '';
  }

  advanceDialogue() {
    this.ui.advanceDialogue();
  }

  /* ------------------------------------------------------------ */
  /* Camera / health / respawn                                    */
  /* ------------------------------------------------------------ */

  updateCamera(dt) {
    if (!this.level || !this.player) return;
    const p = this.player;
    const maxX = Math.max(0, this.level.width - this.renderer.viewW);
    const maxY = Math.max(0, this.level.height - this.renderer.viewH);
    const targetX = clamp(p.x + p.w / 2 - this.renderer.viewW * 0.42 + p.vx * 0.16, 0, maxX);
    const targetY = clamp(p.y + p.h * 0.5 - this.renderer.viewH * 0.56, 0, maxY);
    const k = 1 - Math.exp(-6 * dt);
    this.camera.x += (targetX - this.camera.x) * k;
    this.camera.y += (targetY - this.camera.y) * k;
    this.camera.x = clamp(this.camera.x, 0, maxX);
    this.camera.y = clamp(this.camera.y, 0, maxY);
  }

  snapCamera() {
    if (!this.level || !this.player) return;
    const p = this.player;
    const maxX = Math.max(0, this.level.width - this.renderer.viewW);
    const maxY = Math.max(0, this.level.height - this.renderer.viewH);
    this.camera.x = clamp(p.x + p.w / 2 - this.renderer.viewW * 0.42, 0, maxX);
    this.camera.y = clamp(p.y + p.h * 0.5 - this.renderer.viewH * 0.56, 0, maxY);
  }

  hurt() {
    if (this.respawnTimer > 0) return;
    const p = this.player;
    if (!p || p.invuln > 0) return;
    if (this.health <= 0) return;
    this.health--;
    this.ui.setHearts(this.health);
    this.ui.hurt();
    this.audio.hurt();
    this.shake = Math.min(1, this.shake + 0.65);
    p.invuln = 1.45;
    this.burst(p.x + p.w / 2, p.y + p.h * 0.45, 14, ['rgba(240,120,90,0.8)', 'rgba(255,190,130,0.6)'], 130, 0.6, 2);
    if (this.health <= 0) {
      this.beginRespawn(true);
    } else {
      p.vy = -280;
      p.vx = p.facing > 0 ? -220 : 220;
      this.ui.toast('Careful. The city is still sharp in places.');
    }
  }

  fall() {
    if (this.respawnTimer > 0) return;
    this.health = Math.max(0, this.health - 1);
    if (this.health <= 0) this.health = 3;
    this.ui.setHearts(this.health);
    this.ui.hurt();
    this.beginRespawn(false);
  }

  beginRespawn(fromDamage) {
    this.deaths++;
    this.respawnTimer = 0.85;
    this.ui.fade(true);
    this.ui.hidePrompt();
    this.promptCache = '';
    this.audio.death();
    if (!fromDamage) this.ui.toast('The city is patient. It lets you try again.');
    else this.ui.toast('You wake up at the last place you remember.');
  }

  doRespawn() {
    const p = this.player;
    const q = this.partner;
    if (!p) return;
    if (this.health <= 0) this.health = MAX_HEALTH;
    this.health = Math.max(1, this.health);
    this.ui.setHearts(this.health);
    const c = CHAR[p.char];
    p.w = c.w; p.h = c.h;
    p.x = this.respawnPoint.x - p.w / 2;
    p.y = this.respawnPoint.y - p.h;
    p.vx = 0; p.vy = 0; p.onGround = false;
    p.invuln = 2;
    p.jumpsLeft = c.jumps;
    p.groundPlatform = null;
    if (q) {
      q.x = p.x - 40 - q.w / 2;
      q.y = p.y + p.h - q.h;
      q.vy = 0;
    }
    this.trail = [{ x: this.respawnPoint.x, y: this.respawnPoint.y, t: this.levelTime }];
    this.snapCamera();
    this.respawnTimer = 0;
    this.ui.fade(false);
    this.updatePrompt();
  }

  /* ------------------------------------------------------------ */
  /* Prompt / particles                                           */
  /* ------------------------------------------------------------ */

  updatePrompt() {
    if (!this.player || this.state !== 'playing') { this.ui.hidePrompt(); return; }
    const it = this.nearbyInteractable();
    let key = 'E';
    let text = '';
    let wrong = false;
    if (it) {
      if (it.type === 'beacon' && it.needsKey && !this.hasCapacitor) {
        text = 'The radio needs a capacitor'; key = '·'; wrong = true;
      } else if (it.requires && it.requires !== this.player.char) {
        const name = it.requires === 'mira' ? 'Mira' : 'Teo';
        text = `Switch to ${name} to ${it.label || 'help'}`; key = 'Q'; wrong = true;
      } else {
        text = it.label || 'Interact';
        key = 'E';
      }
    }
    if (!text) { this.ui.hidePrompt(); this.promptCache = ''; return; }
    const sig = `${key}|${text}|${wrong}`;
    if (sig !== this.promptCache) {
      this.promptCache = sig;
      this.ui.showPrompt(text, key, wrong);
    }
  }

  burst(x, y, count, colors, speed = 100, life = 0.7, size = 2) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = speed * (0.25 + Math.random() * 0.9);
      this.particles.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - speed * 0.2,
        life, maxLife: life,
        size: size * (0.5 + Math.random()),
        color: colors[Math.floor(Math.random() * colors.length)],
        type: Math.random() < 0.25 ? 'leaf' : 'dot',
        rot: Math.random() * Math.PI * 2,
        alpha: 0.9,
      });
    }
  }

  ring(x, y, color, size) {
    this.particles.push({ x, y, vx: 0, vy: 0, life: 0.5, maxLife: 0.5, size, color, type: 'ring' });
  }

  updateParticles(dt) {
    const arr = this.particles;
    for (let i = arr.length - 1; i >= 0; i--) {
      const p = arr[i];
      p.life -= dt;
      if (p.life <= 0) { arr.splice(i, 1); continue; }
      if (p.type === 'ring') continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.type === 'leaf') {
        p.vx *= 0.97;
        p.vy += 260 * dt;
        p.rot = (p.rot || 0) + dt * 3;
      } else {
        p.vy += 520 * dt;
        p.vx *= 0.98;
      }
    }
    if (arr.length > 400) arr.splice(0, arr.length - 400);
  }

  /* ------------------------------------------------------------ */
  /* Misc                                                         */
  /* ------------------------------------------------------------ */

  resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.renderer.resize(rect.width, rect.height);
    if (this.level && this.player) {
      this.camera.x = clamp(this.camera.x, 0, Math.max(0, this.level.width - this.renderer.viewW));
      this.camera.y = clamp(this.camera.y, 0, Math.max(0, this.level.height - this.renderer.viewH));
    }
  }

  onResize() {
    if (this.state === 'playing' && this.player) this.snapCamera();
  }
}
