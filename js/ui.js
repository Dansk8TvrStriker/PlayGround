/* DOM overlays: HUD, dialogue, menus, journal. */

import { MEMORIES } from './levels.js';

const $ = (id) => document.getElementById(id);

const SPEAKERS = {
  Mira: { letter: 'M', cls: '' },
  Teo: { letter: 'T', cls: 'teo' },
  Signal: { letter: '≈', cls: 'signal' },
  Sera: { letter: 'S', cls: 'signal' },
};

const HEART_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7.6-4.6-9.3-9.2C1.2 7.9 3.5 4.4 7 4.4c2 0 3.6 1.1 5 3 1.4-1.9 3-3 5-3 3.5 0 5.8 3.5 4.3 7.4C19.6 16.4 12 21 12 21z" fill="currentColor"/></svg>';

export class UI {
  constructor(game) {
    this.game = game;
    this.dialogueActive = false;
    this.lines = [];
    this.lineIndex = 0;
    this.reveal = 0;
    this.onDone = null;
    this.lastWho = null;
    this.el = {
      hud: $('hud'),
      hearts: $('hearts'),
      shardCount: $('shard-count'),
      shardTotal: $('shard-total'),
      chapter: $('chapter-label'),
      location: $('location-label'),
      objective: $('objective-text'),
      prompt: $('prompt'),
      promptText: $('prompt-text'),
      promptKey: $('prompt-key'),
      dialogue: $('dialogue'),
      dlgPortrait: $('dlg-portrait'),
      dlgName: $('dlg-name'),
      dlgText: $('dlg-text'),
      toasts: $('toasts'),
      hurt: $('hurt-flash'),
      fade: $('fade'),
      journalList: $('journal-list'),
      journalCount: $('journal-count'),
      touch: $('touch'),
    };
    this.screens = {
      title: $('screen-title'), intro: $('screen-intro'), interlude: $('screen-interlude'),
      pause: $('screen-pause'), journal: $('screen-journal'), complete: $('screen-complete'),
      ending: $('screen-ending'), how: $('screen-how'),
    };
    this.el.dialogue.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.game.advanceDialogue();
    });
  }

  hideScreens() {
    for (const s of Object.values(this.screens)) {
      if (!s.classList.contains('hidden')) s.classList.add('hidden');
    }
    delete document.body.dataset.screen;
  }

  showScreen(name) {
    this.hideScreens();
    if (this.screens[name]) {
      this.screens[name].classList.remove('hidden');
      document.body.dataset.screen = name;
    }
  }

  setHudVisible(v) {
    this.el.hud.classList.toggle('hidden', !v);
  }

  setTouchVisible(v) {
    const show = v && (matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0 || window.innerWidth < 900);
    this.el.touch.classList.toggle('hidden', !show);
  }

  setLevelInfo(level) {
    this.el.chapter.textContent = level.chapter;
    this.el.location.textContent = level.name;
    this.el.objective.textContent = level.objective;
    this.el.shardTotal.textContent = Object.keys(MEMORIES).length;
  }

  setObjective(text) {
    this.el.objective.textContent = text;
  }

  setHearts(health, max = 3) {
    let html = '';
    for (let i = 0; i < max; i++) {
      html += `<span class="heart ${i < health ? 'full' : 'empty'}">${HEART_SVG}</span>`;
    }
    this.el.hearts.innerHTML = html;
  }

  popHearts() {
    this.el.hearts.querySelectorAll('.heart').forEach((h) => {
      h.classList.remove('pop');
      void h.offsetWidth;
      h.classList.add('pop');
    });
  }

  setShards(n, total) {
    this.el.shardCount.textContent = n;
    this.el.shardTotal.textContent = total;
  }

  showPrompt(text, key = 'E', wrong = false) {
    this.el.prompt.classList.remove('hidden');
    this.el.prompt.classList.toggle('wrong', wrong);
    this.el.promptKey.textContent = key;
    this.el.promptText.textContent = text;
  }

  hidePrompt() {
    if (this.el.prompt.classList.contains('hidden')) return;
    this.el.prompt.classList.add('hidden');
  }

  toast(text, kind = '') {
    const div = document.createElement('div');
    div.className = `toast ${kind}`;
    div.textContent = text;
    this.el.toasts.appendChild(div);
    setTimeout(() => div.remove(), 3200);
  }

  hurt() {
    const h = this.el.hurt;
    h.classList.remove('on');
    void h.offsetWidth;
    h.classList.add('on');
  }

  fade(on) {
    this.el.fade.classList.toggle('on', on);
  }

  /* Dialogue */

  startDialogue(lines, onDone = null) {
    if (!lines || !lines.length) { onDone?.(); return; }
    this.lines = lines;
    this.lineIndex = 0;
    this.onDone = onDone;
    this.dialogueActive = true;
    this.el.dialogue.classList.remove('hidden');
    this.el.hud.querySelector('.objective')?.classList.add('dim');
    this.renderLine();
  }

  renderLine() {
    const line = this.lines[this.lineIndex];
    if (!line) return;
    this.reveal = 0;
    this.lastWho = line.who;
    const sp = SPEAKERS[line.who] || SPEAKERS.Mira;
    this.el.dlgPortrait.className = `dlg-portrait ${sp.cls}`;
    this.el.dlgPortrait.innerHTML = `<span>${sp.letter}</span>`;
    this.el.dlgName.textContent = line.who;
    this.el.dlgText.textContent = '';
  }

  updateDialogue(dt) {
    if (!this.dialogueActive) return;
    const line = this.lines[this.lineIndex];
    if (!line) return;
    const len = line.text.length;
    if (this.reveal < len) {
      this.reveal = Math.min(len, this.reveal + dt * 48);
      this.el.dlgText.textContent = line.text.slice(0, Math.floor(this.reveal));
    }
  }

  advanceDialogue() {
    if (!this.dialogueActive) return false;
    const line = this.lines[this.lineIndex];
    if (!line) return false;
    if (this.reveal < line.text.length) {
      this.reveal = line.text.length;
      this.el.dlgText.textContent = line.text;
      return true;
    }
    this.lineIndex++;
    if (this.lineIndex < this.lines.length) {
      this.renderLine();
    } else {
      this.closeDialogue();
    }
    return true;
  }

  closeDialogue() {
    this.dialogueActive = false;
    this.el.dialogue.classList.add('hidden');
    this.el.hud.querySelector('.objective')?.classList.remove('dim');
    const cb = this.onDone;
    this.onDone = null;
    this.lines = [];
    if (cb) cb();
  }

  resetDialogue() {
    this.dialogueActive = false;
    this.el.dialogue.classList.add('hidden');
    this.el.hud.querySelector('.objective')?.classList.remove('dim');
    this.onDone = null;
    this.lines = [];
    this.lineIndex = 0;
    this.reveal = 0;
  }

  /* Journal */

  buildJournal(save) {
    const all = Object.values(MEMORIES);
    const collected = all.filter((m) => save.memories.includes(m.id));
    this.el.journalCount.textContent = `${collected.length} / ${all.length}`;
    this.el.journalList.innerHTML = all.map((m) => {
      const got = save.memories.includes(m.id);
      if (!got) {
        return `<article class="memory-card locked"><span class="mem-where">${m.city}</span><h4>Not yet found</h4><p>Somewhere in the city, a small thing is still waiting to be noticed.</p></article>`;
      }
      return `<article class="memory-card"><span class="mem-where">${m.city}</span><h4>${m.title}</h4><p>${m.text}</p></article>`;
    }).join('');
  }

  /* Screens */

  showTitle(hasSave) {
    this.showScreen('title');
    $('btn-continue').classList.toggle('hidden', !hasSave);
    this.setHudVisible(false);
    this.setTouchVisible(false);
  }

  showIntro(slideIndex) {
    const slide = this.game.introSlides[slideIndex];
    $('intro-kicker').textContent = slide.kicker;
    $('intro-title').textContent = slide.title;
    $('intro-text').textContent = slide.text;
    $('intro-count').textContent = String(slideIndex + 1).padStart(2, '0');
    const dots = $('intro-dots');
    dots.innerHTML = this.game.introSlides.map((_, i) => `<i class="${i <= slideIndex ? 'on' : ''}"></i>`).join('');
    $('btn-intro-next').textContent = slideIndex === this.game.introSlides.length - 1 ? 'Begin' : 'Continue';
    $('btn-intro-skip').classList.toggle('hidden', slideIndex === this.game.introSlides.length - 1);
    this.setHudVisible(false);
    this.setTouchVisible(false);
  }

  showInterlude(index) {
    const city = this.game.cityList[index];
    $('interlude-kicker').textContent = city.chapter;
    $('interlude-title').textContent = city.name;
    $('interlude-sub').textContent = city.sub;
    $('interlude-text').textContent = city.introText;
    const save = this.game.save;
    const shardCount = save.memories.length;
    $('interlude-stats').innerHTML = `<span><b>${shardCount}/${Object.keys(MEMORIES).length}</b> memories</span><span><b>${this.game.formatTime(this.game.totalTime)}</b> journey</span>`;
    $('btn-interlude-go').textContent = index === 0 ? 'Begin the journey' : 'Follow the signal';
    this.showScreen('interlude');
    this.setHudVisible(false);
    this.setTouchVisible(false);
  }

  showComplete(stats, text) {
    $('complete-kicker').textContent = `${stats.chapter} complete`;
    $('complete-title').textContent = stats.name;
    $('complete-text').textContent = text;
    $('complete-shards').textContent = stats.shards;
    $('complete-time').textContent = this.game.formatTime(stats.time);
    $('complete-deaths').textContent = stats.deaths;
    this.showScreen('complete');
    this.setHudVisible(false);
    this.setTouchVisible(false);
  }

  showEnding(stats) {
    $('ending-shards').textContent = stats.shards;
    $('ending-time').textContent = this.game.formatTime(stats.time);
    $('ending-deaths').textContent = stats.deaths;
    const copy = this.game.endingCopy;
    $('ending-copy').innerHTML = copy.map((p) => `<p>${p}</p>`).join('');
    this.showScreen('ending');
    this.setHudVisible(false);
    this.setTouchVisible(false);
  }

  setMuted(muted) {
    $('btn-sound').classList.toggle('muted', muted);
  }
}
