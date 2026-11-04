/* Procedural painterly renderer. Every texture is drawn at runtime. */

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(n) {
  n = Math.sin(n * 127.1) * 43758.5453;
  return n - Math.floor(n);
}

function rr(ctx, x, y, w, h, r) {
  const q = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + q, y);
  ctx.arcTo(x + w, y, x + w, y + h, q);
  ctx.arcTo(x + w, y + h, x, y + h, q);
  ctx.arcTo(x, y + h, x, y, q);
  ctx.arcTo(x, y, x + w, y, q);
  ctx.closePath();
}

const TITLE_PALETTES = {
  default: {
    skyTop: '#1a2b3c', skyMid: '#8d5d63', skyLow: '#e6a46f', horizon: '#f8d7a0',
    sun: '#ffe4af', sunGlow: 'rgba(255, 196, 130, 0.4)', far: '#4a575c', mid: '#2e4640', near: '#162b22',
    accent: '#e8b56a', grass: '#486f3a', grassLit: '#83ad61',
  },
  fire: {
    skyTop: '#170d11', skyMid: '#5e2022', skyLow: '#c15436', horizon: '#f0a05a',
    sun: '#ffbf7a', sunGlow: 'rgba(255, 110, 50, 0.3)', far: '#3a2024', mid: '#26151a', near: '#150c10',
    accent: '#ff8a52', grass: '#332820', grassLit: '#4e3826',
  },
  green: {
    skyTop: '#1d3b43', skyMid: '#5e8f79', skyLow: '#b7cf96', horizon: '#f2e2ae',
    sun: '#fff0c2', sunGlow: 'rgba(255, 234, 170, 0.42)', far: '#4f7563', mid: '#335b45', near: '#173a28',
    accent: '#cfe08b', grass: '#4f7d3d', grassLit: '#94c26b',
  },
  signal: {
    skyTop: '#070b1a', skyMid: '#12263e', skyLow: '#28515e', horizon: '#7fb2a4',
    sun: '#d9f1dc', sunGlow: 'rgba(150, 225, 210, 0.32)', far: '#1c3340', mid: '#12262b', near: '#071719',
    accent: '#8fd6c2', grass: '#2f5743', grassLit: '#5d8a64',
  },
};

export class Renderer {
  constructor(game, canvas) {
    this.game = game;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.cssW = 1; this.cssH = 1; this.dpr = 1;
    this.scale = 1; this.viewW = 1280; this.viewH = 720;
    this.skylines = new Map();
    this.weather = [];
    this.weatherKind = null;
    this.fireflies = [];
    this.flash = 0;
    this.titleParticles = [];
    this.lastLevelId = null;
    this.time = 0;
  }

  resize(w, h) {
    this.cssW = Math.max(1, w);
    this.cssH = Math.max(1, h);
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(this.cssW * this.dpr);
    this.canvas.height = Math.round(this.cssH * this.dpr);
    this.scale = this.cssH / 720;
    this.viewH = 720;
    this.viewW = this.cssW / this.scale;
    this.game?.onResize?.(this.viewW, this.viewH);
  }

  render(dt) {
    const g = this.game;
    this.time += dt;
    const ctx = this.ctx;
    ctx.setTransform(this.dpr * this.scale, 0, 0, this.dpr * this.scale, 0, 0);
    ctx.clearRect(0, 0, this.viewW, this.viewH);

    const scenic = ['title', 'intro', 'how'].includes(g.state) || !g.level;
    if (scenic) {
      this.drawScenic(dt);
    } else {
      this.drawGame(dt);
    }
  }

  /* ------------------------------------------------------------ */
  /* Scenic title / intro backdrop                                */
  /* ------------------------------------------------------------ */

  drawScenic(dt) {
    const g = this.game;
    const ctx = this.ctx;
    const t = this.time;
    let key = 'default';
    if (g.state === 'intro') key = ['fire', 'green', 'signal'][g.introSlide] || 'green';
    const pal = TITLE_PALETTES[key];
    const camX = g.state === 'intro' ? g.introSlide * 340 : 40;
    const camY = 0;

    this.drawSky(pal, camX, camY, t, key);
    this.drawSkyline(pal, key, 0, 0.07, 548, camX, camY, t, 0.72);
    this.drawSkyline(pal, key, 1, 0.15, 610, camX, camY, t, 0.9);
    this.drawSkyline(pal, key, 2, 0.3, 668, camX, camY, t, 1);

    // A thin lit tower in the distance.
    const towerX = this.viewW * (key === 'signal' ? 0.72 : 0.68) - camX * 0.12;
    this.drawDistantTower(towerX, 610 - camY * 0.1, pal, key, t);

    // Foreground hill.
    const hillY = this.viewH * 0.86;
    const hill = ctx.createLinearGradient(0, hillY - 20, 0, this.viewH);
    hill.addColorStop(0, pal.near);
    hill.addColorStop(1, '#060f0a');
    ctx.fillStyle = hill;
    ctx.beginPath();
    ctx.moveTo(-40, this.viewH + 10);
    ctx.lineTo(-40, hillY + 18);
    ctx.bezierCurveTo(this.viewW * 0.22, hillY - 34, this.viewW * 0.52, hillY + 6, this.viewW * 0.72, hillY - 10);
    ctx.bezierCurveTo(this.viewW * 0.86, hillY - 22, this.viewW * 0.95, hillY - 4, this.viewW + 40, hillY - 14);
    ctx.lineTo(this.viewW + 40, this.viewH + 10);
    ctx.closePath();
    ctx.fill();

    // Hill grass rim.
    ctx.strokeStyle = pal.grassLit;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-40, hillY + 16);
    ctx.bezierCurveTo(this.viewW * 0.22, hillY - 36, this.viewW * 0.52, hillY + 4, this.viewW * 0.72, hillY - 12);
    ctx.bezierCurveTo(this.viewW * 0.86, hillY - 24, this.viewW * 0.95, hillY - 6, this.viewW + 40, hillY - 16);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Grass tufts on the hill.
    for (let i = 0; i < 70; i++) {
      const x = hash(i * 7.3) * this.viewW;
      const y = hillY - 6 + hash(i * 3.1) * 40;
      if (y > this.viewH) continue;
      ctx.strokeStyle = i % 4 === 0 ? pal.grassLit : pal.grass;
      ctx.globalAlpha = 0.6;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(x, y + 6);
      ctx.quadraticCurveTo(x + Math.sin(t + i) * 3, y - 2, x + Math.sin(t * 0.7 + i) * 5, y - 9 - hash(i) * 5);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Two friends on the hill, facing the horizon.
    if (key !== 'fire') {
      const baseY = this.viewH * 0.925;
      const scale = Math.min(1.9, this.viewH / 430);
      this.drawCharacter(this.viewW * 0.735, baseY, 'teo', 1, t * 1.6, false, true, 0, scale * 64, 1);
      this.drawCharacter(this.viewW * 0.675, baseY + 4, 'mira', 1, t * 1.6 + 0.7, false, true, 0, scale * 60, 1);
    }

    // Fireflies / motes.
    for (let i = 0; i < 42; i++) {
      const px = (hash(i * 4.7) * this.viewW + t * (6 + hash(i) * 8)) % this.viewW;
      const py = hillY - 40 + hash(i * 9.2) * 170 + Math.sin(t * 0.6 + i) * 12;
      const glow = 0.3 + 0.5 * (0.5 + 0.5 * Math.sin(t * 1.4 + i * 2));
      this.dot(px, py, 1.2 + hash(i * 2) * 1.5, pal.accent, glow);
    }

    if (key === 'fire') {
      // Embers rising.
      for (let i = 0; i < 38; i++) {
        const px = (hash(i * 8.1) * this.viewW + t * 10) % this.viewW;
        const py = this.viewH - ((t * (22 + hash(i) * 40) + hash(i * 3) * this.viewH) % this.viewH);
        this.dot(px, py, 1 + hash(i) * 1.4, '#ff9a5e', 0.55);
      }
    }

    if (key === 'signal') {
      // A slow scanning beam.
      const bx = towerX;
      const by = 610 - camY * 0.1 - 210;
      const grd = ctx.createLinearGradient(bx, by, bx, by - 420);
      grd.addColorStop(0, 'rgba(160, 240, 220, 0.16)');
      grd.addColorStop(1, 'rgba(160, 240, 220, 0)');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.moveTo(bx - 10, by);
      ctx.lineTo(bx + 10, by);
      ctx.lineTo(bx + 110, by - 420);
      ctx.lineTo(bx - 110, by - 420);
      ctx.closePath();
      ctx.fill();
    }
  }

  drawDistantTower(x, baseY, pal, key, t) {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = pal.near;
    ctx.fillStyle = pal.near;
    ctx.globalAlpha = 0.9;
    const h = 220;
    // legs
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x - 24, baseY); ctx.lineTo(x - 6, baseY - h);
    ctx.moveTo(x + 24, baseY); ctx.lineTo(x + 6, baseY - h);
    ctx.stroke();
    // trusses
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 9; i++) {
      const y1 = baseY - i * (h / 9);
      const y2 = baseY - (i + 1) * (h / 9);
      const w1 = lerp(24, 6, i / 9);
      const w2 = lerp(24, 6, (i + 1) / 9);
      ctx.beginPath();
      ctx.moveTo(x - w1, y1); ctx.lineTo(x + w2, y2);
      ctx.moveTo(x + w1, y1); ctx.lineTo(x - w2, y2);
      ctx.stroke();
    }
    // beacon light
    const pulse = 0.55 + 0.45 * Math.sin(t * 2.2);
    this.glow(x, baseY - h - 4, 26, key === 'signal' ? 'rgba(150, 235, 215, 0.35)' : 'rgba(255, 190, 120, 0.32)', pulse);
    ctx.fillStyle = key === 'signal' ? '#a8efdd' : '#ffcf8a';
    ctx.beginPath();
    ctx.arc(x, baseY - h - 4, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /* ------------------------------------------------------------ */
  /* Game                                                         */
  /* ------------------------------------------------------------ */

  drawGame(dt) {
    const g = this.game;
    const level = g.level;
    const pal = level.palette;
    const ctx = this.ctx;
    const t = this.time;

    if (this.lastLevelId !== level.id) {
      this.lastLevelId = level.id;
      this.weatherKind = level.weather;
      this.weather = [];
      this.fireflies = [];
      this.flash = 0;
    }

    const camX = g.camera.x;
    const camY = g.camera.y;

    this.drawSky(pal, camX, camY, t, level.id);
    this.drawSkyline(pal, level.id, 0, 0.06, 548, camX, camY, t, 0.66);
    this.drawSkyline(pal, level.id, 1, 0.14, 612, camX, camY, t, 0.86);
    this.drawSkyline(pal, level.id, 2, 0.28, 676, camX, camY, t, 1);

    // Birds.
    if (level.id !== 'vireo') this.drawBirds(camX, camY, t, pal);

    // Mist band behind the world.
    const mist = ctx.createLinearGradient(0, 480 - camY * 0.15, 0, 720);
    mist.addColorStop(0, 'rgba(0,0,0,0)');
    mist.addColorStop(0.55, pal.mist);
    mist.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = mist;
    ctx.fillRect(0, 0, this.viewW, this.viewH);

    // Weather behind geometry.
    this.drawWeather(dt, false);

    // World transform with shake.
    const shake = g.shake > 0 ? g.shake : 0;
    const sx = shake ? (Math.random() - 0.5) * shake * 18 : 0;
    const sy = shake ? (Math.random() - 0.5) * shake * 12 : 0;
    ctx.save();
    ctx.translate(-camX + sx, -camY + sy);

    const left = camX - 80;
    const right = camX + this.viewW + 80;
    const top = camY - 80;
    const bottom = camY + this.viewH + 80;

    // Distant local silhouettes just behind the playfield.
    this.drawLocalRuins(level, left, right, top, bottom, t);

    // Hazards behind platforms.
    for (const hz of level.hazards) {
      if (hz.x + hz.w < left || hz.x > right) continue;
      if (hz.type === 'water') this.drawWater(hz, t);
      else this.drawRadiation(hz, t);
    }

    // Platforms.
    for (const pl of level.platforms) {
      if (pl.x + pl.w < left || pl.x > right) continue;
      if (pl.y + pl.h < top || pl.y > bottom) continue;
      this.drawPlatform(pl, level, t);
    }

    // Checkpoints.
    for (const cp of level.checkpoints) this.drawCheckpoint(cp, t);

    // Interactables (behind entities where needed).
    for (const it of level.interactables) {
      if (it.x + (it.w || 80) < left || it.x > right) continue;
      this.drawInteractable(it, level, t);
    }

    // Pickups.
    for (const s of level.shards) if (!s.collected) this.drawShard(s, t);
    for (const h of level.heals) if (!h.collected) this.drawHeal(h, t);

    // Enemies.
    for (const e of level.enemies) {
      if (!e.alive) continue;
      this.drawEnemy(e, level, t);
    }

    // Characters.
    if (g.partner) this.drawPlayer(g.partner, t, true);
    if (g.player) this.drawPlayer(g.player, t, false);

    // Particles.
    this.drawParticles();

    // Foreground details inside world.
    this.drawWorldForeground(level, left, right, top, bottom, t);

    ctx.restore();

    // Weather in front.
    this.drawWeather(dt, true);

    // Lightning.
    if (level.id === 'vireo') {
      this.flash = Math.max(0, this.flash - dt * 3.2);
      if (Math.random() < dt * 0.09) this.flash = 1;
      if (this.flash > 0) {
        ctx.fillStyle = `rgba(190, 230, 235, ${this.flash * 0.13})`;
        ctx.fillRect(0, 0, this.viewW, this.viewH);
      }
    }

    // Foreground vignette wash.
    const vg = ctx.createRadialGradient(this.viewW / 2, this.viewH * 0.45, this.viewH * 0.32, this.viewW / 2, this.viewH * 0.5, this.viewH * 0.85);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(2,7,5,0.26)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, this.viewW, this.viewH);
  }

  /* ------------------------------------------------------------ */
  /* Sky / parallax                                               */
  /* ------------------------------------------------------------ */

  drawSky(pal, camX, camY, t, key) {
    const ctx = this.ctx;
    const grad = ctx.createLinearGradient(0, 0, 0, this.viewH);
    grad.addColorStop(0, pal.skyTop);
    grad.addColorStop(0.48, pal.skyMid);
    grad.addColorStop(0.78, pal.skyLow);
    grad.addColorStop(1, pal.horizon);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.viewW, this.viewH);

    // Stars for night scenes.
    if (key === 'vireo' || key === 'cinder' || key === 'signal' || key === 'fire') {
      for (let i = 0; i < 70; i++) {
        const x = (hash(i * 3.7) * this.viewW - camX * 0.01 + this.viewW) % this.viewW;
        const y = hash(i * 9.1) * this.viewH * 0.5;
        const tw = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(t * 1.3 + i * 3.2));
        ctx.fillStyle = `rgba(220, 235, 220, ${0.04 + tw * 0.18})`;
        ctx.fillRect(x, y, 1.2, 1.2);
      }
    }

    // Sun / moon.
    const sunX = this.viewW * 0.74 - camX * 0.012;
    const sunY = 158 - camY * 0.04;
    const radius = key === 'vireo' || key === 'signal' ? 54 : 70;
    this.glow(sunX, sunY, radius * 2.7, pal.sunGlow, 1);
    const sg = ctx.createRadialGradient(sunX, sunY, radius * 0.1, sunX, sunY, radius);
    sg.addColorStop(0, pal.sun);
    sg.addColorStop(0.78, pal.sun);
    sg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.arc(sunX, sunY, radius, 0, Math.PI * 2);
    ctx.fill();

    // Long clouds.
    const cloudAlpha = key === 'fire' ? 0.2 : 0.16;
    for (let i = 0; i < 6; i++) {
      const cw = 160 + hash(i * 4.3) * 260;
      const cx = ((hash(i * 8.2) * (this.viewW + cw) - t * (3 + i) - camX * 0.02) % (this.viewW + cw * 2)) - cw;
      const cy = 120 + hash(i * 2.6) * 250;
      const cg = ctx.createLinearGradient(0, cy - 18, 0, cy + 18);
      cg.addColorStop(0, `rgba(255, 224, 190, ${cloudAlpha})`);
      cg.addColorStop(1, 'rgba(255, 224, 190, 0)');
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.ellipse(cx, cy, cw, 12 + hash(i * 1.4) * 9, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  getSkyline(levelId, pal, layer) {
    const cacheKey = `${levelId}-${layer}`;
    if (this.skylines.has(cacheKey)) return this.skylines.get(cacheKey);
    const rnd = mulberry32((levelId === 'larkspur' ? 11 : levelId === 'vireo' ? 27 : levelId === 'cinder' ? 43 : 77) + layer * 101);
    const buildings = [];
    let x = 0;
    const patternW = 2400;
    while (x < patternW) {
      const w = 34 + rnd() * (layer === 0 ? 70 : 100);
      const h = (layer === 0 ? 70 : 90) + rnd() * (layer === 0 ? 180 : 240);
      const windows = [];
      if (layer > 0) {
        const cols = Math.max(1, Math.floor(w / 22));
        const rows = Math.max(1, Math.floor(h / 30));
        for (let c = 0; c < cols; c++) {
          for (let r = 0; r < rows; r++) {
            if (rnd() < 0.2) {
              windows.push({ x: 8 + c * (w - 12) / cols, y: 14 + r * (h - 20) / rows, w: 3 + rnd() * 3, h: 4 + rnd() * 3, lit: rnd() < 0.45 });
            }
          }
        }
      }
      const trees = [];
      if (layer >= 1) {
        const n = Math.floor(rnd() * 3);
        for (let i = 0; i < n; i++) {
          trees.push({ x: rnd() * w, y: -rnd() * 10, r: 8 + rnd() * 16 });
        }
      }
      const antenna = rnd() < 0.18;
      buildings.push({ x, w, h, windows, trees, antenna, notch: rnd() * 0.5 });
      x += w + 4 + rnd() * 12;
    }
    const result = { buildings, patternW };
    this.skylines.set(cacheKey, result);
    return result;
  }

  drawSkyline(pal, levelId, layer, factor, baseY, camX, camY, t, alpha) {
    const ctx = this.ctx;
    const { buildings, patternW } = this.getSkyline(levelId, pal, layer);
    const color = layer === 0 ? pal.far : layer === 1 ? pal.mid : pal.near;
    const offset = -((camX * factor) % patternW);
    const yBase = baseY - camY * factor * 0.5;

    ctx.save();
    ctx.globalAlpha = alpha;
    for (let copy = 0; copy < 3; copy++) {
      const ox = offset + copy * patternW;
      if (ox > this.viewW) break;
      for (const b of buildings) {
        const bx = ox + b.x;
        if (bx + b.w < -20 || bx > this.viewW + 20) continue;
        const top = yBase - b.h;
        ctx.fillStyle = color;
        // Broken roof profile.
        ctx.beginPath();
        ctx.moveTo(bx - 1, yBase);
        ctx.lineTo(bx - 1, top + 8);
        ctx.lineTo(bx + b.w * 0.18, top + 2 + b.notch * 8);
        ctx.lineTo(bx + b.w * 0.34, top + 10);
        ctx.lineTo(bx + b.w * 0.55, top + b.notch * 10);
        ctx.lineTo(bx + b.w * 0.7, top + 4);
        ctx.lineTo(bx + b.w + 1, top + 12);
        ctx.lineTo(bx + b.w + 1, yBase);
        ctx.closePath();
        ctx.fill();

        // Edge highlight from the sun.
        ctx.strokeStyle = layer === 0 ? 'rgba(255, 220, 170, 0.08)' : 'rgba(220, 240, 210, 0.05)';
        ctx.lineWidth = 1;
        ctx.stroke();

        if (b.antenna) {
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(bx + b.w * 0.62, top + 4);
          ctx.lineTo(bx + b.w * 0.62, top - 22 - (layer * 10));
          ctx.stroke();
        }

        // Windows.
        if (layer > 0) {
          for (const w of b.windows) {
            const wx = bx + w.x;
            const wy = top + w.y;
            if (w.lit) {
              ctx.fillStyle = layer === 1 ? `rgba(232, 181, 106, ${0.1 + 0.22 * (0.5 + 0.5 * Math.sin(t * 0.4 + wx))})` : 'rgba(160, 220, 190, 0.13)';
            } else {
              ctx.fillStyle = 'rgba(5, 12, 10, 0.5)';
            }
            ctx.fillRect(wx, wy, w.w, w.h);
          }
        }

        // Rooftop vegetation.
        if (b.trees.length) {
          for (const tr of b.trees) {
            ctx.fillStyle = layer === 2 ? pal.near : layer === 1 ? pal.mid : pal.far;
            ctx.beginPath();
            ctx.arc(bx + tr.x, top + tr.y + 2, tr.r, 0, Math.PI * 2);
            ctx.arc(bx + tr.x + tr.r * 0.7, top + tr.y - tr.r * 0.2, tr.r * 0.7, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }
    ctx.restore();

    // Atmospheric fade at the base of each layer.
    const fade = ctx.createLinearGradient(0, yBase - 80, 0, yBase + 20);
    fade.addColorStop(0, 'rgba(0,0,0,0)');
    fade.addColorStop(1, pal.mist || 'rgba(240, 200, 160, 0.08)');
    ctx.fillStyle = fade;
    ctx.fillRect(0, yBase - 80, this.viewW, 100);
  }

  drawLocalRuins(level, left, right, top, bottom, t) {
    // A few big silhouettes just behind the platforms to give depth.
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = level.palette.near;
    const spacing = 900;
    const start = Math.floor(left / spacing) * spacing;
    for (let bx = start; bx < right + spacing; bx += spacing) {
      const h = 150 + hash(bx) * 90;
      const y = level.groundY - h;
      if (y > bottom) continue;
      ctx.beginPath();
      ctx.moveTo(bx, level.groundY + 20);
      ctx.lineTo(bx, y + 20);
      ctx.lineTo(bx + 60, y);
      ctx.lineTo(bx + 150, y + 14);
      ctx.lineTo(bx + 210, y - 8);
      ctx.lineTo(bx + 280, y + 12);
      ctx.lineTo(bx + 300, level.groundY + 20);
      ctx.closePath();
      ctx.fill();
      // Vines.
      ctx.strokeStyle = 'rgba(90, 140, 90, 0.18)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 4; i++) {
        const vx = bx + 30 + hash(bx + i) * 240;
        ctx.beginPath();
        ctx.moveTo(vx, y + 10);
        ctx.quadraticCurveTo(vx + Math.sin(t * 0.5 + i) * 6, y + 60, vx + 2, y + 100 + hash(i + bx) * 40);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  drawBirds(camX, camY, t, pal) {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = 'rgba(20, 32, 28, 0.5)';
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 5; i++) {
      const x = (hash(i * 5.1) * this.viewW + t * 12 + i * 30 - camX * 0.03 + this.viewW) % this.viewW;
      const y = 90 + hash(i * 7.7) * 170 + Math.sin(t * 0.8 + i) * 8;
      const flap = Math.sin(t * 5 + i * 2) * 4;
      ctx.beginPath();
      ctx.moveTo(x - 6, y + flap);
      ctx.quadraticCurveTo(x - 2, y - 2, x, y);
      ctx.quadraticCurveTo(x + 2, y - 2, x + 6, y + flap);
      ctx.stroke();
    }
    ctx.restore();
  }

  /* ------------------------------------------------------------ */
  /* World geometry                                               */
  /* ------------------------------------------------------------ */

  drawPlatform(pl, level, t) {
    const ctx = this.ctx;
    const x = pl.x, y = pl.y, w = pl.w, h = pl.h;
    const camX = this.game.camera.x;
    const left = camX - 60;
    const right = camX + this.viewW + 60;
    const x0 = Math.max(x, left);
    const x1 = Math.min(x + w, right);
    if (x1 <= x0) return;

    // Body.
    const body = ctx.createLinearGradient(0, y, 0, y + Math.min(h, 180));
    if (pl.type === 'metal') {
      body.addColorStop(0, '#48473b');
      body.addColorStop(1, '#23231e');
    } else if (pl.type === 'wood') {
      body.addColorStop(0, '#524030');
      body.addColorStop(1, '#2a2118');
    } else if (pl.type === 'concrete') {
      body.addColorStop(0, '#51534a');
      body.addColorStop(1, '#2d2f28');
    } else {
      body.addColorStop(0, '#47432f');
      body.addColorStop(0.5, '#302f26');
      body.addColorStop(1, '#1c1d16');
    }
    ctx.fillStyle = body;
    ctx.fillRect(x0, y, x1 - x0, h);

    if (pl.type === 'metal') {
      // Rusted beams and rivets.
      ctx.strokeStyle = 'rgba(160, 100, 60, 0.2)';
      ctx.lineWidth = 1;
      for (let yy = y + 10; yy < y + h; yy += 18) {
        ctx.beginPath(); ctx.moveTo(x0, yy); ctx.lineTo(x1, yy); ctx.stroke();
      }
      for (let xx = Math.ceil(x0 / 44) * 44; xx < x1; xx += 44) {
        ctx.fillStyle = 'rgba(200, 160, 100, 0.22)';
        ctx.beginPath(); ctx.arc(xx, y + 6, 1.5, 0, Math.PI * 2); ctx.fill();
      }
      // Warning stripe.
      ctx.fillStyle = 'rgba(210, 150, 80, 0.16)';
      ctx.fillRect(x0, y + Math.min(h - 5, 16), x1 - x0, 2);
    } else if (pl.type === 'wood') {
      ctx.strokeStyle = 'rgba(0,0,0,0.24)';
      ctx.lineWidth = 1;
      for (let xx = Math.ceil(x0 / 26) * 26; xx < x1; xx += 26) {
        ctx.beginPath(); ctx.moveTo(xx, y + 3); ctx.lineTo(xx, y + h); ctx.stroke();
      }
      ctx.fillStyle = 'rgba(90, 140, 80, 0.13)';
      ctx.fillRect(x0, y + Math.min(h - 4, 12), x1 - x0, 3);
    } else {
      // Cracks / brick seams.
      ctx.strokeStyle = 'rgba(0,0,0,0.17)';
      ctx.lineWidth = 1;
      for (let xx = Math.ceil(x0 / 52) * 52; xx < x1; xx += 52) {
        ctx.beginPath();
        ctx.moveTo(xx, y + 12);
        ctx.lineTo(xx + 2, Math.min(y + h, y + 60));
        ctx.stroke();
      }
      for (let xx = Math.ceil(x0 / 38) * 38; xx < x1; xx += 38) {
        const yy = y + 28 + hash(xx) * 40;
        if (yy > y + h) continue;
        ctx.fillStyle = 'rgba(150, 145, 120, 0.08)';
        ctx.fillRect(xx, yy, 8, 3);
      }
    }

    // Grass / moss top edge.
    if (pl.type !== 'metal' || hash(pl.x) > 0.5) {
      const grassH = pl.type === 'wood' ? 4 : 7;
      ctx.fillStyle = level.palette.grass;
      ctx.beginPath();
      ctx.moveTo(x0, y + grassH);
      ctx.lineTo(x0, y + 2);
      for (let xx = x0; xx <= x1; xx += 12) {
        const wob = 1.5 + hash(xx * 0.7) * 2.4;
        ctx.lineTo(xx + 6, y - wob);
        ctx.lineTo(xx + 12, y + 2);
      }
      ctx.lineTo(x1, y + grassH);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = level.palette.grassLit;
      ctx.globalAlpha = 0.5;
      ctx.fillRect(x0, y + 1, x1 - x0, 1.6);
      ctx.globalAlpha = 1;
    }

    // Grass blades.
    if (pl.type !== 'metal') {
      for (let xx = Math.ceil(x0 / 13) * 13; xx < x1; xx += 13) {
        const hh = 3 + hash(xx * 1.3) * 7;
        const sway = Math.sin(t * 1.2 + xx * 0.05) * 2;
        ctx.strokeStyle = hash(xx) > 0.6 ? level.palette.grassLit : level.palette.grass;
        ctx.lineWidth = 1.2;
        ctx.globalAlpha = 0.75;
        ctx.beginPath();
        ctx.moveTo(xx, y);
        ctx.quadraticCurveTo(xx + sway * 0.4, y - hh * 0.6, xx + sway, y - hh);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    // Hanging vines on floating platforms.
    if (h < 100) {
      for (let xx = Math.ceil(x0 / 36) * 36; xx < x1; xx += 36) {
        if (hash(xx * 2.1) > 0.55) continue;
        const len = 12 + hash(xx * 3.7) * 44;
        const sway = Math.sin(t * 0.7 + xx * 0.02) * 4;
        ctx.strokeStyle = 'rgba(70, 110, 65, 0.6)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(xx, y + h);
        ctx.bezierCurveTo(xx - 3, y + h + len * 0.4, xx + sway, y + h + len * 0.7, xx + sway, y + h + len);
        ctx.stroke();
        // Leaves.
        ctx.fillStyle = 'rgba(90, 140, 75, 0.6)';
        for (let l = 1; l <= 3; l++) {
          const ly = y + h + (len * l) / 4;
          const lx = xx + sway * (l / 4);
          ctx.beginPath();
          ctx.ellipse(lx + (l % 2 ? 3 : -3), ly, 3.2, 1.6, l % 2 ? 0.6 : -0.6, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // A few flowers.
    if (pl.type === 'earth' || pl.type === 'concrete') {
      for (let xx = Math.ceil(x0 / 97) * 97; xx < x1; xx += 97) {
        if (hash(xx * 0.31) > 0.38) continue;
        const fx = xx + hash(xx) * 20;
        const fy = y - 7 - hash(xx * 2) * 3;
        ctx.fillStyle = level.id === 'cinder' ? 'rgba(220, 120, 80, 0.75)' : 'rgba(225, 210, 150, 0.8)';
        ctx.beginPath(); ctx.arc(fx, fy, 1.6, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  drawWater(hz, t) {
    const ctx = this.ctx;
    const y = hz.y;
    const grad = ctx.createLinearGradient(0, y, 0, y + hz.h);
    grad.addColorStop(0, 'rgba(60, 135, 135, 0.75)');
    grad.addColorStop(0.25, 'rgba(20, 70, 78, 0.88)');
    grad.addColorStop(1, 'rgba(3, 20, 24, 0.98)');
    ctx.fillStyle = grad;
    ctx.fillRect(hz.x, y + 4, hz.w, hz.h - 4);

    // Surface.
    ctx.beginPath();
    ctx.moveTo(hz.x, y + 6);
    for (let x = hz.x; x <= hz.x + hz.w; x += 10) {
      const wy = y + Math.sin(x * 0.025 + t * 1.4) * 2.2 + Math.sin(x * 0.07 - t) * 1.1;
      ctx.lineTo(x, wy);
    }
    ctx.lineTo(hz.x + hz.w, y + 6);
    ctx.closePath();
    ctx.fillStyle = 'rgba(130, 210, 200, 0.18)';
    ctx.fill();

    // Highlights.
    ctx.strokeStyle = 'rgba(170, 235, 220, 0.25)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 8; i++) {
      const rx = hz.x + ((hash(i * 4.2) * hz.w + t * 8) % hz.w);
      const ry = y + 16 + hash(i * 2.7) * (hz.h - 30);
      ctx.beginPath();
      ctx.moveTo(rx, ry);
      ctx.lineTo(rx + 10 + hash(i) * 18, ry);
      ctx.stroke();
    }

    // Reeds / debris.
    for (let i = 0; i < 6; i++) {
      const rx = hz.x + hash(i * 11.3) * hz.w;
      const ry = y + 2;
      ctx.strokeStyle = 'rgba(90, 120, 80, 0.6)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(rx, ry + 4);
      ctx.quadraticCurveTo(rx + 3, ry - 12, rx + 8 + Math.sin(t + i) * 2, ry - 26);
      ctx.stroke();
    }
  }

  drawRadiation(hz, t) {
    const ctx = this.ctx;
    const y = hz.y;
    const grad = ctx.createLinearGradient(0, y, 0, y + hz.h + 6);
    grad.addColorStop(0, 'rgba(130, 200, 80, 0.75)');
    grad.addColorStop(0.5, 'rgba(80, 150, 55, 0.55)');
    grad.addColorStop(1, 'rgba(40, 80, 30, 0.25)');
    ctx.fillStyle = grad;
    ctx.fillRect(hz.x, y + 2, hz.w, hz.h + 4);

    this.glow(hz.x + hz.w / 2, y + 10, hz.w * 0.7, 'rgba(140, 220, 90, 0.18)', 1);

    // Bubbles.
    for (let i = 0; i < 9; i++) {
      const bx = hz.x + ((hash(i * 6.1) * hz.w + t * 6) % hz.w);
      const by = y + 6 + ((hash(i * 3.3) * hz.h + t * (4 + i)) % hz.h);
      ctx.strokeStyle = 'rgba(190, 240, 130, 0.25)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(bx, by, 1.5 + hash(i) * 2, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Surface crust.
    ctx.strokeStyle = 'rgba(190, 230, 120, 0.35)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (let x = hz.x; x <= hz.x + hz.w; x += 8) {
      const wy = y + Math.sin(x * 0.06 + t * 0.8) * 1.4;
      if (x === hz.x) ctx.moveTo(x, wy); else ctx.lineTo(x, wy);
    }
    ctx.stroke();
  }

  drawCheckpoint(cp, t) {
    const ctx = this.ctx;
    const x = cp.x;
    const baseY = cp.y + 6;
    // Pole.
    ctx.strokeStyle = '#4c4a3c';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, baseY);
    ctx.lineTo(x, baseY - 56);
    ctx.stroke();
    // Crossbar.
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 7, baseY - 56);
    ctx.lineTo(x + 9, baseY - 56);
    ctx.stroke();
    // Lantern.
    const ly = baseY - 46;
    const on = cp.active;
    if (on) this.glow(x + 9, ly + 3, 34, 'rgba(255, 200, 120, 0.35)', 0.85 + Math.sin(t * 2) * 0.15);
    ctx.fillStyle = on ? '#f0c987' : '#5a5140';
    ctx.beginPath();
    ctx.arc(x + 9, ly + 3, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#2c2a22';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.arc(x + 9, ly + 3, 5, 0, Math.PI * 2);
    ctx.stroke();
    // Small ribbon.
    ctx.fillStyle = on ? 'rgba(232, 181, 106, 0.75)' : 'rgba(120, 110, 90, 0.4)';
    ctx.beginPath();
    ctx.moveTo(x - 2, baseY - 58);
    ctx.quadraticCurveTo(x - 12, baseY - 52 + Math.sin(t * 2) * 2, x - 16, baseY - 42);
    ctx.lineTo(x - 9, baseY - 46);
    ctx.closePath();
    ctx.fill();
  }

  drawInteractable(it, level, t) {
    if (it.type === 'rubble') this.drawRubble(it, level, t);
    else if (it.type === 'gate') this.drawGate(it, level, t);
    else if (it.type === 'terminal') this.drawTerminal(it, level, t);
    else if (it.type === 'beacon') this.drawBeacon(it, level, t);
    else if (it.type === 'capacitor' && !it.collected) this.drawCapacitor(it, t);
  }

  drawRubble(it, level, t) {
    const ctx = this.ctx;
    if (it.cleared) {
      ctx.fillStyle = 'rgba(90, 88, 72, 0.8)';
      for (let i = 0; i < 9; i++) {
        const rx = it.x - 40 + hash(i * 3.1) * (it.w + 80);
        const ry = it.y + it.h - 4 - hash(i * 7.2) * 12;
        ctx.beginPath();
        ctx.ellipse(rx, ry, 5 + hash(i) * 9, 3 + hash(i * 2) * 5, hash(i), 0, Math.PI * 2);
        ctx.fill();
      }
      return;
    }
    // Marker cloth.
    ctx.strokeStyle = 'rgba(180, 90, 60, 0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(it.x + it.w - 6, it.y + 8);
    ctx.lineTo(it.x + it.w + 8, it.y + 18 + Math.sin(t * 2) * 2);
    ctx.stroke();

    // Stack of broken slabs.
    for (let row = 0; row < 7; row++) {
      const ry = it.y + it.h - 40 - row * 38;
      const jitter = (hash(row * 2.7) - 0.5) * 18;
      ctx.save();
      ctx.translate(it.x + it.w / 2 + jitter, ry);
      ctx.rotate((hash(row) - 0.5) * 0.16);
      const gw = 66 + hash(row * 3.3) * 30;
      const gh = 30 + hash(row * 5.1) * 12;
      const grad = ctx.createLinearGradient(0, -gh / 2, 0, gh / 2);
      grad.addColorStop(0, '#6a6859');
      grad.addColorStop(1, '#3c3b32');
      ctx.fillStyle = grad;
      rr(ctx, -gw / 2, -gh / 2, gw, gh, 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(20, 22, 18, 0.4)';
      ctx.lineWidth = 1;
      ctx.stroke();
      // Rebar.
      ctx.strokeStyle = 'rgba(110, 74, 50, 0.75)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-gw / 2 + 8, -gh / 2);
      ctx.lineTo(-gw / 2 - 4, -gh / 2 - 16);
      ctx.moveTo(gw / 2 - 14, gh / 2);
      ctx.lineTo(gw / 2 + 2, gh / 2 + 12);
      ctx.stroke();
      ctx.restore();
    }
    // Moss.
    ctx.fillStyle = 'rgba(90, 130, 70, 0.35)';
    for (let i = 0; i < 8; i++) {
      ctx.beginPath();
      ctx.arc(it.x + hash(i * 4.1) * it.w, it.y + it.h - 20 - hash(i * 2.2) * it.h * 0.7, 3 + hash(i) * 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawGate(it, level, t) {
    const ctx = this.ctx;
    const lift = it.openT * (it.h + 10);
    ctx.save();
    ctx.beginPath();
    ctx.rect(it.x - 4, it.y - 8, it.w + 8, it.h + 8);
    ctx.clip();
    ctx.translate(0, -lift);

    // Frame.
    ctx.fillStyle = '#2c2d27';
    ctx.fillRect(it.x - 4, it.y, 6, it.h);
    ctx.fillRect(it.x + it.w - 2, it.y, 6, it.h);
    // Bars.
    for (let i = 0; i < 5; i++) {
      const bx = it.x + 4 + i * ((it.w - 8) / 4);
      ctx.strokeStyle = i % 2 ? '#4a4c43' : '#3a3c34';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(bx, it.y);
      ctx.lineTo(bx, it.y + it.h);
      ctx.stroke();
      // Rust patches.
      ctx.fillStyle = 'rgba(150, 90, 55, 0.35)';
      ctx.fillRect(bx - 2, it.y + 60 + hash(i + 2) * 140, 4, 12);
    }
    // Cross braces.
    ctx.strokeStyle = '#56584c';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(it.x + 2, it.y + it.h * 0.45);
    ctx.lineTo(it.x + it.w - 2, it.y + it.h * 0.62);
    ctx.moveTo(it.x + it.w - 2, it.y + it.h * 0.45);
    ctx.lineTo(it.x + 2, it.y + it.h * 0.62);
    ctx.stroke();

    // Lock panel.
    const lx = it.x + it.w / 2;
    const ly = it.y + it.h * 0.5;
    this.glow(lx, ly, 18, it.open ? 'rgba(120, 230, 170, 0.4)' : 'rgba(230, 120, 80, 0.35)', 1);
    ctx.fillStyle = it.open ? '#83e6b0' : '#e08a60';
    ctx.beginPath(); ctx.arc(lx, ly, 3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // Bottom frame.
    ctx.fillStyle = '#22231f';
    ctx.fillRect(it.x - 4, it.y + it.h - 4, it.w + 8, 6);
  }

  drawTerminal(it, level, t) {
    const ctx = this.ctx;
    const x = it.x + it.w / 2;
    const y = it.y + it.h;
    // Base.
    ctx.fillStyle = '#3b3c33';
    ctx.beginPath();
    ctx.moveTo(x - 26, y);
    ctx.lineTo(x - 20, y - 34);
    ctx.lineTo(x + 20, y - 34);
    ctx.lineTo(x + 26, y);
    ctx.closePath();
    ctx.fill();
    // Screen body.
    ctx.fillStyle = '#24261f';
    rr(ctx, it.x + 2, it.y, it.w - 4, 58, 4);
    ctx.fill();
    // Screen.
    const on = it.on;
    const col = on ? 'rgba(120, 230, 180, 0.9)' : 'rgba(232, 181, 106, 0.65)';
    this.glow(x, it.y + 26, 44, on ? 'rgba(110, 230, 180, 0.22)' : 'rgba(232, 181, 106, 0.14)', 1);
    ctx.fillStyle = on ? 'rgba(20, 60, 45, 0.95)' : 'rgba(35, 32, 24, 0.95)';
    rr(ctx, it.x + 7, it.y + 8, it.w - 14, 34, 2);
    ctx.fill();
    ctx.strokeStyle = col;
    ctx.lineWidth = 1;
    ctx.stroke();
    // Scanlines / text.
    ctx.strokeStyle = col;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
      const sy = it.y + 15 + i * 6;
      const len = 10 + hash(i + it.x) * 18;
      ctx.beginPath();
      ctx.moveTo(it.x + 11, sy);
      ctx.lineTo(it.x + 11 + len, sy);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // Buttons.
    ctx.fillStyle = on ? '#9fe8c0' : '#c08850';
    ctx.beginPath(); ctx.arc(x, it.y + 51, 2.2, 0, Math.PI * 2); ctx.fill();
    // Cable.
    ctx.strokeStyle = 'rgba(20,20,16,0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 20, y - 12);
    ctx.quadraticCurveTo(x + 50, y - 6, x + 44, y);
    ctx.stroke();
  }

  drawBeacon(it, level, t) {
    const ctx = this.ctx;
    const x = it.x + it.w / 2;
    const baseY = it.y + it.h;
    // Base.
    ctx.fillStyle = '#31332c';
    ctx.beginPath();
    ctx.moveTo(x - 28, baseY);
    ctx.lineTo(x - 18, baseY - 26);
    ctx.lineTo(x + 18, baseY - 26);
    ctx.lineTo(x + 28, baseY);
    ctx.closePath();
    ctx.fill();
    // Console.
    ctx.fillStyle = '#24261f';
    rr(ctx, x - 20, baseY - 48, 40, 24, 2);
    ctx.fill();
    // Mast.
    ctx.strokeStyle = '#54564a';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(x, baseY - 26);
    ctx.lineTo(x, it.y - 56);
    ctx.stroke();
    ctx.lineWidth = 1;
    for (let i = 0; i < 6; i++) {
      const yy = baseY - 32 - i * 12;
      ctx.beginPath();
      ctx.moveTo(x - 6, yy); ctx.lineTo(x + 6, yy + 8);
      ctx.stroke();
    }
    // Light.
    const pulse = 0.55 + 0.45 * Math.sin(t * 2.4);
    const col = it.on ? 'rgba(150, 240, 215, ' : 'rgba(240, 190, 120, ';
    this.glow(x, it.y - 58, 46, `${col}${0.28 * pulse})`, 1);
    ctx.fillStyle = it.on ? '#a8f0dc' : '#ffcf92';
    ctx.beginPath(); ctx.arc(x, it.y - 58, 4.5, 0, Math.PI * 2); ctx.fill();
    // Beam.
    if (it.on || it.final) {
      const beam = ctx.createLinearGradient(0, it.y - 58, 0, it.y - 58 - 520);
      beam.addColorStop(0, it.on ? 'rgba(150, 240, 215, 0.3)' : 'rgba(240, 190, 120, 0.18)');
      beam.addColorStop(1, 'rgba(150, 240, 215, 0)');
      ctx.fillStyle = beam;
      ctx.beginPath();
      ctx.moveTo(x - 5, it.y - 58);
      ctx.lineTo(x + 5, it.y - 58);
      ctx.lineTo(x + 78, it.y - 580);
      ctx.lineTo(x - 78, it.y - 580);
      ctx.closePath();
      ctx.fill();
    }
    // Screen.
    ctx.fillStyle = it.on ? 'rgba(130, 240, 200, 0.8)' : 'rgba(232, 181, 106, 0.5)';
    ctx.fillRect(x - 14, baseY - 43, 28, 3);
  }

  drawCapacitor(it, t) {
    const ctx = this.ctx;
    const bob = Math.sin(t * 2) * 3;
    this.glow(it.x, it.y + bob, 26, 'rgba(140, 220, 255, 0.25)', 1);
    ctx.fillStyle = '#3a3e3a';
    rr(ctx, it.x - 12, it.y - 8 + bob, 24, 20, 3);
    ctx.fill();
    ctx.strokeStyle = 'rgba(200, 240, 255, 0.55)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#9fe0ff';
    ctx.beginPath();
    ctx.arc(it.x, it.y + 2 + bob, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  drawShard(s, t) {
    const ctx = this.ctx;
    const cx = s.x + s.w / 2;
    const cy = s.y + s.h / 2 + Math.sin(t * 1.8 + s.x) * 4;
    this.glow(cx, cy, 34, 'rgba(150, 230, 210, 0.22)', 0.8 + Math.sin(t * 2.1) * 0.2);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(Math.sin(t * 1.2 + s.x) * 0.18);
    const grad = ctx.createLinearGradient(0, -16, 0, 18);
    grad.addColorStop(0, '#dff7ee');
    grad.addColorStop(0.5, '#8fd6c0');
    grad.addColorStop(1, '#4a9e93');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, -16);
    ctx.lineTo(10, -4);
    ctx.lineTo(0, 17);
    ctx.lineTo(-10, -4);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(240, 255, 245, 0.8)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.beginPath();
    ctx.moveTo(-4, -8); ctx.lineTo(4, -8);
    ctx.stroke();
    ctx.restore();
    // Orbiting mote.
    const a = t * 1.6 + s.x;
    this.dot(cx + Math.cos(a) * 17, cy + Math.sin(a) * 9, 1.3, '#dff7ee', 0.75);
  }

  drawHeal(h, t) {
    const ctx = this.ctx;
    const cx = h.x + h.w / 2;
    const cy = h.y + h.h / 2 + Math.sin(t * 2 + h.x) * 2;
    this.glow(cx, cy, 26, 'rgba(160, 230, 120, 0.22)', 1);
    ctx.fillStyle = '#5b8f44';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 4, 7, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#a8d97e';
    ctx.beginPath();
    ctx.ellipse(cx - 2, cy, 3, 5, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#3c6a30';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 5);
    ctx.quadraticCurveTo(cx + 4, cy - 13, cx + 9, cy - 15);
    ctx.stroke();
    ctx.fillStyle = '#8fc065';
    ctx.beginPath();
    ctx.ellipse(cx + 9, cy - 15, 4, 2, 0.4, 0, Math.PI * 2);
    ctx.fill();
  }

  drawEnemy(e, level, t) {
    const ctx = this.ctx;
    if (e.type === 'drone') {
      const bob = Math.sin(t * 2.2 + (e.bob || 0)) * 5;
      const x = e.x;
      const y = e.y + bob;
      ctx.save();
      ctx.translate(x, y);
      // Rotors.
      ctx.strokeStyle = 'rgba(160, 170, 150, 0.5)';
      ctx.lineWidth = 1.4;
      for (let i = 0; i < 3; i++) {
        const a = t * 6 + i * 2.1;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a) * 18, Math.sin(a) * 6 - 8);
        ctx.stroke();
      }
      // Body.
      const body = ctx.createRadialGradient(-4, -5, 2, 0, 0, 16);
      body.addColorStop(0, '#6b6c5c');
      body.addColorStop(1, '#33342c');
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.ellipse(0, 0, 15, 11, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#1b1d18';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      // Eye.
      const hit = e.hitT > 0;
      this.glow(3, 1, 12, hit ? 'rgba(255,255,255,0.5)' : 'rgba(230, 90, 60, 0.35)', 1);
      ctx.fillStyle = hit ? '#ffffff' : '#e66a4c';
      ctx.beginPath();
      ctx.arc(3, 1, 3, 0, Math.PI * 2);
      ctx.fill();
      // Little legs.
      ctx.strokeStyle = '#3d3e34';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-7, 8); ctx.lineTo(-9, 16);
      ctx.moveTo(7, 8); ctx.lineTo(9, 16);
      ctx.stroke();
      ctx.restore();
    } else {
      const x = e.x;
      const y = e.y;
      const phase = t * 7 + e.x;
      ctx.save();
      ctx.translate(x, y);
      // Legs.
      ctx.strokeStyle = '#3b3b30';
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        const off = -10 + i * 10;
        const swing = Math.sin(phase + i) * 4;
        ctx.beginPath();
        ctx.moveTo(off, -12);
        ctx.lineTo(off + swing, -2);
        ctx.lineTo(off - 3 + swing, 0);
        ctx.stroke();
      }
      // Shell.
      const grad = ctx.createLinearGradient(0, -26, 0, 0);
      grad.addColorStop(0, '#5b5b48');
      grad.addColorStop(1, '#2d2d25');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(0, -14, 18, 11, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#1a1a15';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      // Plates.
      ctx.strokeStyle = 'rgba(180, 160, 110, 0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, -14, 10, 0.2, Math.PI - 0.2);
      ctx.stroke();
      // Eye.
      const hit = e.hitT > 0;
      this.glow(8, -18, 10, hit ? 'rgba(255,255,255,0.5)' : 'rgba(230, 90, 60, 0.3)', 1);
      ctx.fillStyle = hit ? '#ffffff' : '#e66a4c';
      ctx.beginPath();
      ctx.arc(8, -18, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  /* ------------------------------------------------------------ */
  /* Characters                                                   */
  /* ------------------------------------------------------------ */

  drawPlayer(p, t, isPartner) {
    const ctx = this.ctx;
    if (!p) return;
    const scale = p.h / (p.char === 'mira' ? 60 : 64);
    let alpha = isPartner ? 0.94 : 1;
    if (p.invuln > 0 && Math.floor(p.invuln * 14) % 2 === 0) alpha *= 0.35;
    const moving = Math.abs(p.vx) > 20 && p.onGround;
    const phase = p.runPhase || 0;
    const night = this.game.level && this.game.level.id !== 'larkspur';
    this.glow(
      p.x + p.w / 2,
      p.y + p.h * 0.52,
      night ? 104 : 74,
      night ? 'rgba(255, 206, 150, 0.11)' : 'rgba(255, 226, 178, 0.06)',
      isPartner ? 0.6 : 1
    );
    this.drawCharacter(
      p.x + p.w / 2, p.y + p.h, p.char, p.facing || 1,
      phase, moving, p.onGround, p.attackT || 0, p.h, alpha, p.vy
    );
    // Attack arc.
    if (p.attackT > 0) {
      const prog = 1 - p.attackT / 0.22;
      const dir = p.facing || 1;
      const cx = p.x + p.w / 2 + dir * 16;
      const cy = p.y + p.h * 0.42;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(dir * (-0.9 + prog * 1.9));
      ctx.strokeStyle = `rgba(232, 220, 180, ${0.65 * (1 - prog * 0.5)})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 34, -0.7, 0.7);
      ctx.stroke();
      ctx.strokeStyle = `rgba(240, 250, 225, ${0.3 * (1 - prog)})`;
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.arc(0, 0, 30, -0.5, 0.5);
      ctx.stroke();
      ctx.restore();
    }
  }

  drawCharacter(cx, feetY, char, facing, phase, moving, onGround, attackT, height, alpha = 1, vy = 0) {
    const ctx = this.ctx;
    const s = height / (char === 'mira' ? 60 : 64);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(cx, feetY);
    ctx.scale(facing * s, s);

    const idle = Math.sin(this.time * 2 + cx * 0.01) * 1.1;
    const walk = moving ? Math.sin(phase) : 0;
    const bounce = moving ? Math.abs(Math.sin(phase)) * 2.2 : idle;
    const air = !onGround;
    const yoff = -bounce;
    const breathe = Math.sin(this.time * 1.8 + cx * 0.02) * 0.8;

    // Shadow.
    ctx.save();
    ctx.scale(1 / facing, 1);
    ctx.fillStyle = 'rgba(4, 10, 7, 0.35)';
    ctx.beginPath();
    ctx.ellipse(0, 1, 15, 4.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    const isMira = char === 'mira';

    // Back arm / tool.
    const armSwing = moving ? -walk * 8 : 0;
    const attackPose = attackT > 0 ? clamp(attackT / 0.22, 0, 1) : 0;
    ctx.strokeStyle = isMira ? '#2d5a4e' : '#8f5f30';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-2, -47 + yoff);
    ctx.lineTo(-8 + armSwing * 0.4, -33 + yoff);
    ctx.stroke();

    // Backpack / satchel.
    ctx.fillStyle = isMira ? '#7a5b39' : '#4f5d45';
    if (isMira) {
      rr(ctx, -17, -46 + yoff, 10, 15, 3);
      ctx.fill();
      ctx.strokeStyle = '#5b4229';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = '#a3835a';
      ctx.fillRect(-16, -38 + yoff, 8, 2);
    } else {
      rr(ctx, -16, -50 + yoff, 12, 22, 4);
      ctx.fill();
      ctx.fillStyle = '#6d7b5c';
      rr(ctx, -14, -46 + yoff, 8, 7, 2);
      ctx.fill();
    }

    // Legs.
    const legSwing = moving ? walk * 9 : 0;
    const legLift = air ? 6 : 0;
    ctx.strokeStyle = isMira ? '#2f3d37' : '#33352c';
    ctx.lineWidth = 6.5;
    const legY = -28 + yoff;
    if (air) {
      ctx.beginPath();
      ctx.moveTo(-3, legY); ctx.lineTo(-8, legY + 13 - Math.min(8, Math.abs(vy) * 0.02));
      ctx.moveTo(3, legY); ctx.lineTo(8, legY + 9);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(-2, legY); ctx.lineTo(-5 + legSwing, -1);
      ctx.moveTo(3, legY); ctx.lineTo(5 - legSwing, -1);
      ctx.stroke();
    }
    // Boots.
    ctx.strokeStyle = isMira ? '#1d2823' : '#211d18';
    ctx.lineWidth = 6;
    ctx.beginPath();
    if (air) {
      ctx.moveTo(-8, legY + 13); ctx.lineTo(-4, legY + 14);
      ctx.moveTo(8, legY + 9); ctx.lineTo(12, legY + 10);
    } else {
      ctx.moveTo(-5 + legSwing, -2); ctx.lineTo(0 + legSwing, -2);
      ctx.moveTo(5 - legSwing, -2); ctx.lineTo(10 - legSwing, -2);
    }
    ctx.stroke();

    // Torso.
    if (isMira) {
      const coat = ctx.createLinearGradient(0, -52, 0, -22);
      coat.addColorStop(0, '#4d8b74');
      coat.addColorStop(1, '#2c5c4d');
      ctx.fillStyle = coat;
      ctx.beginPath();
      ctx.moveTo(-9, -51 + yoff + breathe);
      ctx.quadraticCurveTo(-13, -40, -11, -25 + yoff);
      ctx.lineTo(10, -24 + yoff);
      ctx.quadraticCurveTo(12, -39, 9, -51 + yoff + breathe);
      ctx.closePath();
      ctx.fill();
      // Coat split.
      ctx.strokeStyle = 'rgba(20, 40, 32, 0.5)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(0, -32 + yoff); ctx.lineTo(0, -24 + yoff);
      ctx.stroke();
    } else {
      const coat = ctx.createLinearGradient(0, -54, 0, -22);
      coat.addColorStop(0, '#d79a5b');
      coat.addColorStop(1, '#9f6633');
      ctx.fillStyle = coat;
      ctx.beginPath();
      ctx.moveTo(-10, -53 + yoff + breathe);
      ctx.quadraticCurveTo(-14, -40, -12, -24 + yoff);
      ctx.lineTo(11, -24 + yoff);
      ctx.quadraticCurveTo(13, -40, 10, -53 + yoff + breathe);
      ctx.closePath();
      ctx.fill();
      // Jacket zip.
      ctx.strokeStyle = 'rgba(80, 50, 25, 0.6)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(2, -50 + yoff); ctx.lineTo(2, -26 + yoff);
      ctx.stroke();
      // Patches.
      ctx.fillStyle = 'rgba(90, 110, 70, 0.55)';
      rr(ctx, -8, -38 + yoff, 6, 5, 1); ctx.fill();
    }

    // Front arm.
    ctx.strokeStyle = isMira ? '#3f7662' : '#b77c42';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(5, -47 + yoff);
    if (attackT > 0) {
      ctx.lineTo(15, -39 + yoff);
      ctx.lineTo(24, -40 + yoff);
    } else {
      ctx.lineTo(10 - armSwing * 0.5, -32 + yoff);
      ctx.lineTo(12 - armSwing * 0.7, -27 + yoff);
    }
    ctx.stroke();

    // Hands.
    ctx.fillStyle = isMira ? '#d9a982' : '#c89570';
    ctx.beginPath();
    ctx.arc(attackT > 0 ? 24 : 12 - armSwing * 0.7, attackT > 0 ? -40 + yoff : -27 + yoff, 2.6, 0, Math.PI * 2);
    ctx.fill();

    // Tool / staff.
    if (isMira) {
      ctx.strokeStyle = '#6d5937';
      ctx.lineWidth = 2;
      ctx.beginPath();
      if (attackT > 0) {
        ctx.moveTo(10, -44 + yoff); ctx.lineTo(30, -32 + yoff);
      } else {
        ctx.moveTo(-8, -58 + yoff); ctx.lineTo(-18, -18 + yoff);
      }
      ctx.stroke();
      if (attackT > 0) {
        ctx.fillStyle = 'rgba(160, 240, 190, 0.9)';
        ctx.beginPath(); ctx.arc(30, -32 + yoff, 2.6, 0, Math.PI * 2); ctx.fill();
      }
    } else {
      ctx.strokeStyle = '#aeb4a6';
      ctx.lineWidth = 2.3;
      ctx.beginPath();
      if (attackT > 0) {
        ctx.moveTo(22, -40 + yoff); ctx.lineTo(34, -34 + yoff);
      } else {
        ctx.moveTo(-13, -36 + yoff); ctx.lineTo(-17, -18 + yoff);
      }
      ctx.stroke();
      ctx.fillStyle = '#c9cec0';
      ctx.beginPath();
      ctx.arc(attackT > 0 ? 34 : -17, attackT > 0 ? -34 + yoff : -18 + yoff, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Head.
    const headY = -58 + yoff + breathe;
    ctx.fillStyle = isMira ? '#e3b28a' : '#d6a47e';
    ctx.beginPath();
    ctx.arc(0, headY, 7.2, 0, Math.PI * 2);
    ctx.fill();

    // Hair / hat.
    if (isMira) {
      ctx.fillStyle = '#2a2320';
      ctx.beginPath();
      ctx.arc(0, headY - 1.4, 7.4, Math.PI * 0.85, Math.PI * 2.15);
      ctx.fill();
      // Bun.
      ctx.beginPath();
      ctx.arc(-6.5, headY - 4, 3.4, 0, Math.PI * 2);
      ctx.fill();
      // Face highlight.
      ctx.fillStyle = 'rgba(255, 220, 190, 0.35)';
      ctx.beginPath();
      ctx.arc(3.5, headY + 1, 2.4, 0, Math.PI * 2);
      ctx.fill();
      // Eye.
      ctx.fillStyle = '#2b211c';
      ctx.beginPath();
      ctx.arc(4.4, headY + 0.5, 1, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = '#3a2b20';
      ctx.beginPath();
      ctx.arc(0, headY - 1.8, 7.3, Math.PI * 0.82, Math.PI * 2.18);
      ctx.fill();
      // Cap.
      ctx.fillStyle = '#5f6a4f';
      ctx.beginPath();
      ctx.arc(0, headY - 3.2, 7.2, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(1, headY - 4.2, 9, 2.4);
      // Goggles on forehead.
      ctx.strokeStyle = '#b7c9bf';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(-5, headY - 6); ctx.lineTo(5, headY - 6);
      ctx.stroke();
      ctx.fillStyle = 'rgba(150, 210, 200, 0.6)';
      ctx.beginPath(); ctx.arc(-2.5, headY - 6, 1.8, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(2.5, headY - 6, 1.8, 0, Math.PI * 2); ctx.fill();
      // Eye.
      ctx.fillStyle = '#2b211c';
      ctx.beginPath(); ctx.arc(4.4, headY + 1, 1, 0, Math.PI * 2); ctx.fill();
    }

    // Scarf / collar.
    if (isMira) {
      ctx.fillStyle = '#cf6a58';
      ctx.beginPath();
      ctx.ellipse(0, -51 + yoff, 8.5, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      // Trailing scarf.
      ctx.fillStyle = 'rgba(207, 106, 88, 0.9)';
      ctx.beginPath();
      ctx.moveTo(-6, -51 + yoff);
      ctx.quadraticCurveTo(-18 - Math.sin(this.time * 2.2) * 3, -48 + yoff, -23 - Math.sin(this.time * 2.2) * 4, -37 + yoff);
      ctx.lineTo(-19, -36 + yoff);
      ctx.quadraticCurveTo(-14, -45 + yoff, -6, -47 + yoff);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillStyle = '#3f4a3a';
      ctx.fillRect(-7, -52 + yoff, 14, 3.4);
      // Little scarf tail.
      ctx.fillStyle = 'rgba(90, 120, 85, 0.85)';
      ctx.beginPath();
      ctx.moveTo(-6, -50 + yoff);
      ctx.quadraticCurveTo(-15, -47 + yoff, -18, -39 + yoff);
      ctx.lineTo(-14, -38 + yoff);
      ctx.quadraticCurveTo(-12, -45 + yoff, -6, -47 + yoff);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }

  /* ------------------------------------------------------------ */
  /* Particles / weather / foreground                             */
  /* ------------------------------------------------------------ */

  drawParticles() {
    const ctx = this.ctx;
    for (const p of this.game.particles) {
      const life = p.life / p.maxLife;
      ctx.globalAlpha = Math.max(0, Math.min(1, life)) * (p.alpha ?? 1);
      if (p.type === 'ring') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.size * 0.35;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1.6 - life), 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.type === 'leaf') {
        ctx.fillStyle = p.color;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot || 0);
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size, p.size * 0.45, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (p.type === 'spark') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.02, p.y - p.vy * 0.02);
        ctx.stroke();
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (0.4 + life * 0.6), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  drawWeather(dt, front) {
    const ctx = this.ctx;
    const kind = this.weatherKind;
    if (!kind) return;

    if (this.weather.length === 0) {
      const counts = kind === 'rain' ? 110 : kind === 'ash' ? 55 : 34;
      for (let i = 0; i < counts; i++) {
        this.weather.push({
          x: Math.random() * this.viewW,
          y: Math.random() * this.viewH,
          z: front ? 1 : 0.6,
          r: Math.random(),
          s: Math.random(),
        });
      }
    }

    if (kind === 'rain') {
      ctx.strokeStyle = front ? 'rgba(170, 215, 220, 0.32)' : 'rgba(150, 200, 210, 0.16)';
      ctx.lineWidth = 1;
      for (const d of this.weather) {
        if ((d.z > 0.8) !== front) continue;
        d.y += (520 + d.s * 280) * dt;
        d.x += 90 * dt;
        if (d.y > this.viewH + 20) { d.y = -20; d.x = Math.random() * this.viewW; }
        if (d.x > this.viewW + 20) d.x = -20;
        ctx.beginPath();
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x - 2.5, d.y + 9 + d.s * 9);
        ctx.stroke();
      }
    } else if (kind === 'ash') {
      for (const d of this.weather) {
        if ((d.z > 0.8) !== front) continue;
        d.y += (16 + d.s * 26) * dt;
        d.x += Math.sin(this.time * 0.6 + d.r * 10) * 8 * dt + 4 * dt;
        if (d.y > this.viewH + 10) { d.y = -10; d.x = Math.random() * this.viewW; }
        if (d.x > this.viewW + 10) d.x = -10;
        ctx.fillStyle = front ? `rgba(220, 210, 200, ${0.14 + d.r * 0.22})` : 'rgba(180, 170, 160, 0.1)';
        ctx.beginPath();
        ctx.arc(d.x, d.y, 0.8 + d.r * 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
      // Embers.
      if (front) {
        for (let i = 0; i < 12; i++) {
          const ex = (hash(i * 5.3) * this.viewW + this.time * (8 + i)) % this.viewW;
          const ey = this.viewH - ((this.time * (18 + i * 2) + hash(i * 2) * this.viewH) % this.viewH);
          this.dot(ex, ey, 1.2, '#ff9a5e', 0.4);
        }
      }
    } else {
      // Pollen / motes.
      for (const d of this.weather) {
        if ((d.z > 0.8) !== front) continue;
        d.y -= (5 + d.s * 10) * dt;
        d.x += Math.sin(this.time * 0.7 + d.r * 9) * 10 * dt + 3 * dt;
        if (d.y < -10) { d.y = this.viewH + 10; d.x = Math.random() * this.viewW; }
        if (d.x > this.viewW + 10) d.x = -10;
        ctx.fillStyle = front ? `rgba(255, 235, 180, ${0.2 + d.r * 0.35})` : 'rgba(255, 225, 170, 0.12)';
        ctx.beginPath();
        ctx.arc(d.x, d.y, 0.8 + d.r * 1.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  drawWorldForeground(level, left, right, top, bottom, t) {
    const ctx = this.ctx;
    // Hanging vine curtains from the top of tall areas.
    if (level.id === 'larkspur') {
      for (let i = 0; i < 3; i++) {
        const bx = left + ((i * 470 + 120 - (this.game.camera.x * 0.15)) % 620);
        if (bx < left - 100 || bx > right) continue;
        ctx.strokeStyle = 'rgba(40, 75, 42, 0.55)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(bx, top);
        ctx.bezierCurveTo(bx + 20, top + 60, bx - 14, top + 120, bx + 8, top + 176);
        ctx.stroke();
        ctx.fillStyle = 'rgba(60, 100, 55, 0.45)';
        for (let l = 0; l < 5; l++) {
          ctx.beginPath();
          ctx.ellipse(bx + 8 + Math.sin(l) * 8, top + 40 + l * 28, 7, 3, 0.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // Fireflies near the ground.
    if (level.id === 'larkspur' || level.id === 'vireo') {
      for (let i = 0; i < 26; i++) {
        const fx = left + ((hash(i * 7.7) * 1300 + t * (4 + hash(i) * 6)) % 1300);
        const fy = level.groundY - 20 - hash(i * 3.1) * 150 + Math.sin(t * 0.8 + i) * 10;
        if (fx < left || fx > right) continue;
        const a = 0.25 + 0.55 * (0.5 + 0.5 * Math.sin(t * 1.7 + i * 2.4));
        this.dot(fx, fy, 1.4, level.id === 'vireo' ? '#a8e6d2' : '#e9d98b', a);
      }
    }
  }

  /* ------------------------------------------------------------ */
  /* Helpers                                                      */
  /* ------------------------------------------------------------ */

  glow(x, y, r, color, alpha = 1) {
    const ctx = this.ctx;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  dot(x, y, r, color, alpha = 1) {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
