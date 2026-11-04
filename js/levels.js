/* Level geometry, story, and collectible memories. */

const g = (x, w, y = 760, type = 'earth') => ({ x, y, w, h: 980 - y, type });
const p = (x, y, w, type = 'concrete', h = 22, move = null) => ({
  x, y, w, h, type,
  baseX: x, baseY: y,
  ...(move ? { move } : {}),
});

export const MEMORIES = {
  lark_yellow_door: {
    id: 'lark_yellow_door', city: 'Larkspur', title: 'The Yellow Door',
    text: 'Mira’s family lived on the third floor. Her mother repainted the door every spring, even when the landlord said not to. The paint is still there, under the ivy — a bright, stubborn yellow.',
  },
  lark_bikes: {
    id: 'lark_bikes', city: 'Larkspur', title: 'Two Bikes',
    text: 'A tandem bicycle has grown into the fence. Teo says they rode it before they could walk. Mira says that is physically impossible. Teo says they were very determined children.',
  },
  lark_slide: {
    id: 'lark_slide', city: 'Larkspur', title: 'The Slide',
    text: 'The playground slide is a tree now. They used to dare each other to touch the old fence. Neither of them ever did. The fence has since fallen over, which feels like a victory.',
  },
  lark_radio: {
    id: 'lark_radio', city: 'Larkspur', title: 'The Radio',
    text: 'Built from a toaster, a car battery, and a stolen antenna. For six years it played nothing but static. Tonight, it played a woman’s voice saying: “Come home.”',
  },
  vir_flood: {
    id: 'vir_flood', city: 'Vireo', title: 'The Flood',
    text: 'The river took the lower streets the year they were born. The city kept its lights on for eleven days after the water came. The lights are still on in some windows, somehow.',
  },
  vir_garden: {
    id: 'vir_garden', city: 'Vireo', title: 'Rooftop Garden',
    text: 'Tomato plants in old paint buckets. Watered this morning. Someone else is alive in Vireo, and they have been very patient with the tomatoes.',
  },
  vir_map: {
    id: 'vir_map', city: 'Vireo', title: 'Metro Map',
    text: 'A child’s drawing of a train, taped inside a locker. The date in the corner is thirty years old. The train is drawn with a smile and fourteen windows.',
  },
  vir_piano: {
    id: 'vir_piano', city: 'Vireo', title: 'The Piano',
    text: 'In the flooded lobby, one key still works. Teo plays it badly. Mira laughs so hard she has to sit down on a floating suitcase. For a moment, the drowned city has a soundtrack.',
  },
  cin_glass: {
    id: 'cin_glass', city: 'Cinder Heights', title: 'Ash Glass',
    text: 'The blast fused the sand into green glass. Mira pockets a piece. It is warm, even now, as if it remembers being a window.',
  },
  cin_letter: {
    id: 'cin_letter', city: 'Cinder Heights', title: 'The Letter',
    text: 'A letter from Dr. Sera Vale to their parents: “If the worst happens, the vault will wait. Bring something alive. That is the only password that matters.”',
  },
  cin_suit: {
    id: 'cin_suit', city: 'Cinder Heights', title: 'Small Suit',
    text: 'A child-sized radiation suit hangs in the locker room, the name TEO stitched inside the collar. He does not remember wearing it. His mother must have carried him through the hot streets.',
  },
  cin_seed: {
    id: 'cin_seed', city: 'Cinder Heights', title: 'The First Seed',
    text: 'The seed is warm in Mira’s palm. It came from the vault, from before the fire, from a world that trusted the future enough to save something for it.',
  },
};

export const INTRO_SLIDES = [
  {
    kicker: 'before',
    title: 'The sky caught fire.',
    text: 'Thirty years ago, the reactors failed and the cities emptied. Mira and Teo were not born yet. The world they inherited was very quiet, and very green.',
    scene: 'fire',
  },
  {
    kicker: 'after',
    title: 'Then the green came back.',
    text: 'Ivy took the towers. Rain filled the metro. Foxes slept in the school gym. In a cellar under Hollow Hill, two children grew up on stories of a world with streetlights.',
    scene: 'green',
  },
  {
    kicker: 'now',
    title: 'A radio that shouldn’t work.',
    text: 'Last night, their patched-together radio spoke. A woman’s voice, repeating coordinates from the Ashen Spire in Cinder Heights: “If anyone is listening — the seed vault is open. Bring something alive. Come home.”',
    scene: 'signal',
  },
];

export const CITIES = [
  {
    id: 'larkspur', chapter: 'CHAPTER I', name: 'Larkspur',
    sub: 'the suburb that dreamed',
    objective: 'Climb the radio tower on the east edge of Larkspur',
    nextText: 'The signal points east, across the flooded river, to Vireo.',
    introText: 'Their own street. The houses are smaller than they remember. The radio tower still stands, wrapped in wisteria, and something up there is still broadcasting.',
  },
  {
    id: 'vireo', chapter: 'CHAPTER II', name: 'Vireo',
    sub: 'the city that drowned',
    objective: 'Find a capacitor in the drowned station, then reach the control tower',
    nextText: 'On the far tower, a light answers. Cinder Heights is still burning, gently.',
    introText: 'Rain on black water. The old city rises out of the flood in pieces, and somebody has been growing tomatoes on a roof.',
  },
  {
    id: 'cinder', chapter: 'CHAPTER III', name: 'Cinder Heights',
    sub: 'the city that kept the fire',
    objective: 'Climb the Ashen Spire and answer the voice',
    nextText: '',
    introText: 'The air tastes like coins. Ash falls like slow snow. Above the reactor ruins, the Ashen Spire holds up what is left of the sky.',
  },
];

export const TITLE_LINES = {
  larkspur: [
    { who: 'Mira', text: 'Thirty years since the fire, and the street still smells like rain on hot stone.' },
    { who: 'Teo', text: 'It smells like moss. And something dead.' },
    { who: 'Mira', text: 'Romantic.' },
    { who: 'Teo', text: 'You said we were going to the tower.' },
    { who: 'Mira', text: 'I said we were going to see if the radio was lying. Same thing.' },
    { who: 'Teo', text: 'It is not the same thing at all.' },
  ],
  vireo: [
    { who: 'Teo', text: 'The river is higher than the maps.' },
    { who: 'Mira', text: 'The maps are thirty years old.' },
    { who: 'Teo', text: 'So is the rain. It hasn’t stopped since we crossed the bridge.' },
    { who: 'Mira', text: 'Look — tomatoes. Someone’s been up there.' },
    { who: 'Teo', text: 'Or something has.' },
    { who: 'Mira', text: 'Something with a watering can?' },
  ],
  cinder: [
    { who: 'Mira', text: 'The signal’s coming from the top of the Spire.' },
    { who: 'Teo', text: 'Of course it is.' },
    { who: 'Mira', text: 'We came all this way.' },
    { who: 'Teo', text: 'I know. I’m not stopping. I just wanted to say it out loud.' },
    { who: 'Mira', text: 'Then let’s go say hello.' },
  ],
};

const MEMORY_NOTE = [
  { who: 'Mira', text: 'People lived here. Not just survived — lived.' },
  { who: 'Teo', text: 'Keep it. We’ll put it with the others.' },
];

function shard(id, x, y) {
  return { type: 'shard', memory: id, x, y, w: 26, h: 34, collected: false };
}
function heal(x, y) { return { type: 'heal', x, y, w: 30, h: 36, collected: false }; }
function checkpoint(x, y = 760) { return { type: 'checkpoint', x, y, active: false }; }
function rubble(x, y, h = 330) {
  return { type: 'rubble', x, y, w: 100, h, solid: true, cleared: false, requires: 'teo', label: 'Heave the rubble' };
}
function gate(id, x, y, h = 460, w = 52) {
  return { type: 'gate', id, x, y, w, h, solid: true, open: false, openT: 0 };
}
function terminal(x, y, gateId) {
  return { type: 'terminal', x, y, w: 54, h: 96, requires: 'mira', gate: gateId, on: false, label: 'Wake the old machine' };
}
function beacon(x, y, final = false, needsKey = null) {
  return { type: 'beacon', x, y, w: 72, h: 100, requires: 'mira', final, needsKey, on: false, label: 'Tune the signal' };
}

function buildLarkspur() {
  const ground = 760;
  return {
    id: 'larkspur', ...CITIES[0],
    width: 5200, height: 980, groundY: ground,
    spawn: { x: 140, y: ground },
    palette: {
      skyTop: '#24384a', skyMid: '#a56d6c', skyLow: '#f0b57c', horizon: '#f9daa4',
      sun: '#ffe6b4', sunGlow: 'rgba(255, 196, 130, 0.45)',
      far: '#5d6d71', mid: '#3f5b53', near: '#234234',
      ground: '#37352a', grass: '#5f8c49', grassLit: '#9dc574',
      accent: '#e8b56a', mist: 'rgba(240, 190, 140, 0.10)',
    },
    weather: 'pollen', skylineSeed: 11,
    platforms: [
      g(0, 980), g(1100, 1000), g(2100, 1200), g(3420, 1080), g(4500, 700),
      p(560, 640, 190, 'concrete'), p(1190, 628, 150, 'concrete'), p(1380, 520, 150, 'concrete'),
      p(2150, 620, 180, 'wood'), p(3540, 668, 240, 'concrete'), p(3820, 568, 210, 'concrete'),
      p(4090, 652, 220, 'wood'),
      p(4620, 660, 170, 'metal'), p(4800, 568, 150, 'metal'), p(4620, 476, 150, 'metal'),
      p(4800, 384, 150, 'metal'), p(4620, 292, 150, 'metal'), p(4790, 200, 210, 'metal'),
    ],
    hazards: [],
    shards: [
      shard('lark_yellow_door', 628, 530),
      shard('lark_bikes', 1444, 410),
      shard('lark_slide', 3908, 458),
      shard('lark_radio', 4684, 182),
    ],
    heals: [heal(2020, 712), heal(3610, 620)],
    checkpoints: [checkpoint(1170), checkpoint(3240), checkpoint(4520)],
    enemies: [
      { type: 'crawler', x: 1520, y: ground, range: [1290, 1690], speed: 46, dir: 1, hp: 2, hitT: 0, alive: true },
      { type: 'drone', x: 2920, y: 560, range: [2760, 3090], speed: 42, dir: 1, hp: 2, hitT: 0, alive: true, bob: 0 },
      { type: 'crawler', x: 3710, y: ground, range: [3460, 3980], speed: 54, dir: 1, hp: 2, hitT: 0, alive: true },
      { type: 'drone', x: 4240, y: 540, range: [4140, 4420], speed: 38, dir: -1, hp: 2, hitT: 0, alive: true, bob: 1.4 },
    ],
    interactables: [
      rubble(1780, ground - 330),
      terminal(2360, ground - 96, 'gate1'),
      gate('gate1', 2500, ground - 460),
      beacon(4896, 100),
    ],
    triggers: [
      { x: 0, w: 260, key: 'intro', lines: TITLE_LINES.larkspur, once: true },
      { x: 1660, w: 70, key: 'rubble', once: true, lines: [
        { who: 'Teo', text: 'That pile’s newer than the rest. Somebody didn’t want anyone getting through.' },
        { who: 'Mira', text: 'Or something didn’t. You’re up.' },
      ] },
      { x: 2290, w: 80, key: 'terminal', once: true, lines: [
        { who: 'Mira', text: 'This terminal still has a heartbeat. Give me a minute with it.' },
        { who: 'Teo', text: 'You always say a minute.' },
      ] },
      { x: 3180, w: 80, key: 'check1', once: true, lines: [
        { who: 'Teo', text: 'We should stop. Just for a bit.' },
        { who: 'Mira', text: 'The signal doesn’t stop.' },
        { who: 'Teo', text: 'No. But we could.' },
      ] },
      { x: 4480, w: 80, key: 'tower', once: true, lines: [
        { who: 'Teo', text: 'That’s the tower. The top is still glowing.' },
        { who: 'Mira', text: 'Thirty years, and it’s still asking for an answer.' },
      ] },
    ],
    beaconLines: [
      { who: 'Mira', text: 'The signal’s coming from the Spire — Cinder Heights. It’s a woman’s voice. She keeps saying “bring something alive.”' },
      { who: 'Teo', text: 'That’s not ominous at all.' },
      { who: 'Mira', text: 'She knew the way we talk. She called us by name.' },
      { who: 'Teo', text: 'Then we go east. Before I remember how much I like it here.' },
    ],
    completeText: 'The old tower wakes with a shudder. Somewhere east, across the river, a light blinks back — once, twice, three times. An answer.',
  };
}

function buildVireo() {
  const ground = 770;
  return {
    id: 'vireo', ...CITIES[1],
    width: 5600, height: 980, groundY: ground,
    spawn: { x: 130, y: ground },
    palette: {
      skyTop: '#09152a', skyMid: '#1c4d61', skyLow: '#41908e', horizon: '#9ad2bb',
      sun: '#e4f6e7', sunGlow: 'rgba(160, 220, 210, 0.36)',
      far: '#23505c', mid: '#1a3b40', near: '#0f2929',
      ground: '#2c3a35', grass: '#4f8058', grassLit: '#8cb87d',
      accent: '#8fd6c2', mist: 'rgba(140, 200, 190, 0.10)',
    },
    weather: 'rain', skylineSeed: 27,
    platforms: [
      g(0, 800, ground), g(1300, 1000, ground), g(2900, 1000, ground), g(4500, 1100, ground),
      p(540, 660, 150, 'concrete'),
      p(850, 690, 120, 'wood'), p(1030, 630, 120, 'wood'), p(1200, 690, 120, 'wood'),
      p(1320, 620, 180, 'concrete'), p(1550, 520, 170, 'concrete'),
      p(2380, 680, 150, 'wood', 22, { axis: 'y', dist: 58, speed: 0.8, phase: 0 }),
      p(2610, 620, 140, 'wood', 22, { axis: 'y', dist: 72, speed: 0.65, phase: 2.1 }),
      p(2790, 690, 130, 'wood'),
      p(3000, 610, 180, 'concrete'), p(3240, 520, 170, 'concrete'),
      p(3960, 650, 200, 'metal'), p(4200, 560, 200, 'metal'), p(4410, 660, 190, 'wood'),
      p(5050, 640, 170, 'metal'), p(5220, 540, 150, 'metal'), p(5060, 440, 150, 'metal'),
      p(5230, 340, 150, 'metal'), p(5100, 240, 210, 'metal'),
    ],
    hazards: [
      { type: 'water', x: 800, y: 722, w: 500, h: 258 },
      { type: 'water', x: 2300, y: 722, w: 600, h: 258 },
      { type: 'water', x: 3900, y: 722, w: 600, h: 258 },
    ],
    shards: [
      shard('vir_flood', 588, 550),
      shard('vir_garden', 1604, 410),
      shard('vir_map', 3330, 410),
      shard('vir_piano', 5160, 130),
    ],
    heals: [heal(1440, 722), heal(3010, 722), heal(4560, 722)],
    checkpoints: [checkpoint(1340, ground), checkpoint(2960, ground), checkpoint(4520, ground)],
    enemies: [
      { type: 'crawler', x: 1700, y: ground, range: [1450, 1900], speed: 48, dir: 1, hp: 2, hitT: 0, alive: true },
      { type: 'drone', x: 3080, y: 520, range: [2960, 3300], speed: 44, dir: -1, hp: 2, hitT: 0, alive: true, bob: 0.8 },
      { type: 'crawler', x: 3660, y: ground, range: [3400, 3840], speed: 52, dir: 1, hp: 2, hitT: 0, alive: true },
      { type: 'drone', x: 5300, y: 420, range: [5140, 5420], speed: 40, dir: 1, hp: 2, hitT: 0, alive: true, bob: 2.2 },
    ],
    interactables: [
      rubble(1850, ground - 300, 300),
      terminal(2010, ground - 96, 'gate1'),
      gate('gate1', 2150, ground - 480, 480),
      { type: 'capacitor', id: 'capacitor', x: 3300, y: 460, w: 34, h: 30, collected: false, label: 'Take the capacitor' },
      beacon(5196, 140, false, 'capacitor'),
    ],
    triggers: [
      { x: 0, w: 280, key: 'intro', lines: TITLE_LINES.vireo, once: true },
      { x: 760, w: 80, key: 'water', once: true, lines: [
        { who: 'Teo', text: 'The street’s gone under. Watch your step.' },
        { who: 'Mira', text: 'I’m watching everything. It’s a lot.' },
      ] },
      { x: 1750, w: 80, key: 'beam', once: true, lines: [
        { who: 'Teo', text: 'A collapsed support. Give me a second.' },
        { who: 'Mira', text: 'I’ll hold the sky up.' },
      ] },
      { x: 3160, w: 70, key: 'cap', once: true, lines: [
        { who: 'Mira', text: 'A capacitor. Still charged, somehow.' },
        { who: 'Teo', text: 'Everything in this city is stubborn.' },
      ] },
      { x: 4460, w: 90, key: 'tower2', once: true, lines: [
        { who: 'Mira', text: 'The control tower. If we can power the antenna, the Spire might hear us.' },
        { who: 'Teo', text: 'You want to talk back.' },
        { who: 'Mira', text: 'I want to say we’re coming.' },
      ] },
    ],
    beaconLines: [
      { who: 'Mira', text: 'The capacitor fits. The antenna is moving.' },
      { who: 'Teo', text: 'It’s pointing at Cinder Heights.' },
      { who: 'Mira', text: 'Somebody’s still up there. I can hear them breathing.' },
      { who: 'Teo', text: 'Then let’s not keep them waiting.' },
    ],
    completeText: 'The control tower answers in a voice older than the rain. A single word comes back through the static: “Come.”',
  };
}

function buildCinder() {
  const ground = 780;
  return {
    id: 'cinder', ...CITIES[2],
    width: 5000, height: 1000, groundY: ground,
    spawn: { x: 130, y: ground },
    palette: {
      skyTop: '#231524', skyMid: '#743039', skyLow: '#d57145', horizon: '#f4b774',
      sun: '#ffd096', sunGlow: 'rgba(255, 130, 80, 0.3)',
      far: '#543744', mid: '#3d2933', near: '#24171d',
      ground: '#382f29', grass: '#5d6d46', grassLit: '#97a562',
      accent: '#e58b58', mist: 'rgba(220, 130, 90, 0.09)',
    },
    weather: 'ash', skylineSeed: 43,
    platforms: [
      g(0, 900, ground), g(1150, 1050, ground), g(2200, 900, ground), g(3350, 900, ground), g(4250, 750, ground),
      p(650, 720, 180, 'concrete'), p(1850, 660, 170, 'concrete'), p(3440, 660, 180, 'wood'),
      p(4290, 680, 180, 'metal'), p(4480, 590, 160, 'metal'), p(4290, 500, 160, 'metal'),
      p(4480, 410, 160, 'metal'), p(4290, 320, 160, 'metal'), p(4480, 230, 160, 'metal'),
      p(4330, 150, 240, 'metal'),
    ],
    hazards: [
      { type: 'radiation', x: 900, y: 748, w: 250, h: 32 },
      { type: 'radiation', x: 3100, y: 748, w: 250, h: 32 },
      { type: 'radiation', x: 4200, y: 748, w: 140, h: 32 },
    ],
    shards: [
      shard('cin_glass', 700, 610),
      shard('cin_letter', 1910, 550),
      shard('cin_suit', 3500, 550),
      shard('cin_seed', 4540, 120),
    ],
    heals: [heal(1250, 732), heal(3400, 732)],
    checkpoints: [checkpoint(1200, ground), checkpoint(3400, ground), checkpoint(4260, ground)],
    enemies: [
      { type: 'drone', x: 1500, y: 560, range: [1350, 1740], speed: 46, dir: 1, hp: 2, hitT: 0, alive: true, bob: 0.4 },
      { type: 'crawler', x: 2300, y: ground, range: [2200, 2500], speed: 50, dir: -1, hp: 2, hitT: 0, alive: true },
      { type: 'drone', x: 3650, y: 520, range: [3460, 3920], speed: 42, dir: 1, hp: 2, hitT: 0, alive: true, bob: 1.7 },
    ],
    interactables: [
      rubble(1750, ground - 330),
      terminal(2470, ground - 96, 'gate1'),
      gate('gate1', 2600, ground - 460),
      beacon(4440, 52, true),
    ],
    triggers: [
      { x: 0, w: 250, key: 'intro', lines: TITLE_LINES.cinder, once: true },
      { x: 800, w: 80, key: 'rad', once: true, lines: [
        { who: 'Mira', text: 'Hot ground. My counter’s screaming.' },
        { who: 'Teo', text: 'Stay behind me. The suit’s held this long.' },
      ] },
      { x: 1660, w: 80, key: 'rubble3', once: true, lines: [
        { who: 'Teo', text: 'Another wall. Hold my lantern.' },
      ] },
      { x: 3030, w: 80, key: 'rad2', once: true, lines: [
        { who: 'Mira', text: 'It gets worse up there.' },
        { who: 'Teo', text: 'Then it gets better after.' },
        { who: 'Mira', text: 'You don’t know that.' },
        { who: 'Teo', text: 'No. But I’m going anyway.' },
      ] },
      { x: 4180, w: 90, key: 'spire', once: true, lines: [
        { who: 'Mira', text: 'The Spire. It’s taller than the radio said.' },
        { who: 'Teo', text: 'Everything’s taller in person.' },
      ] },
    ],
    beaconLines: [
      { who: 'Signal', text: 'You came. Both of you. I hoped — I hoped so much.' },
      { who: 'Mira', text: 'Who are you?' },
      { who: 'Signal', text: 'Sera Vale. I knew your mothers. I kept the vault because they asked me to.' },
      { who: 'Teo', text: 'You’re alive.' },
      { who: 'Signal', text: 'Mostly. Bring something alive up here, and I’ll show you what we saved.' },
    ],
    completeText: '',
  };
}

export const LEVELS = [buildLarkspur(), buildVireo(), buildCinder()];

export const ENDING_COPY = [
  'Dr. Sera Vale is ninety-one years old and has been alone in the Ashen Spire for six years. The seed vault beneath the reactor is cold, dry, and full.',
  'Mira holds up the seedling from Larkspur. Teo holds up the tomato from Vireo. Sera laughs until she has to sit down.',
  '“Your mothers sealed this place,” she says. “They asked me to wait for someone who still believed in spring.”',
  'That night, they send a message back to Hollow Hill. By morning, the radio has an answer: eleven people, two goats, and a very old dog.',
  'The road between the three cities takes four days to clear. By the end of the year, it takes four hours.',
  'The cities are not dead. They were only waiting for someone to walk back in.',
];
