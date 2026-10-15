/* ExoSphere game data: resources, buildings, sites, skill tree, armory, objectives */
'use strict';
(function (G) {

  /* ---------- resources ----------
     Global pool: ore, energy, crystal, research, dm.  Local per colony: pop, food, water. */
  G.RES = {
    ore: { n: 'Ore', c: '#c3cdf0', icon: 'res_ore' },
    energy: { n: 'Energy', c: '#ffd23f', icon: 'res_energy' },
    crystal: { n: 'Crystal', c: '#ff7eb6', icon: 'res_crystal' },
    research: { n: 'Research', c: '#7ef0c2', icon: 'res_research' },
    dm: { n: 'Dark Matter', c: '#b18cff', icon: 'res_dm' },
    food: { n: 'Food', c: '#a6e36b', icon: 'res_food' },
    water: { n: 'Water', c: '#5cc8ff', icon: 'res_water' },
    pop: { n: 'Colonists', c: '#fff1d6', icon: 'res_pop' }
  };
  G.COST_KEYS = ['ore', 'energy', 'crystal'];
  G.lvlMul = l => l <= 0 ? 0 : l * Math.pow(1.08, l - 1);
  G.costAt = (base, g, l, red) => base.map(x => Math.ceil(x * Math.pow(g, l) * (1 - (red || 0))));

  /* ---------- city buildings ----------
     c: cost [ore, energy, crystal] at level 0 -> 1, g: growth per level, jobs per level, req: tech unlock flag.
     out: base output per level-multiplier. adj: human readable adjacency rules (implemented in sim.js). */
  G.BUILD = {
    habitat: {
      n: 'Habitat', d: 'Homes for colonists. Population grows until housing is full.',
      c: [30, 6, 0], g: 1.5, jobs: 0, out: { housing: 25 },
      adj: ['Park next door: +2 happiness', 'Power plant next door: -2 happiness']
    },
    farm: {
      n: 'Farm', d: 'Grows food. Soil fertility of the planet matters.',
      c: [25, 8, 0], g: 1.5, jobs: 3, out: { food: 1.0 },
      adj: ['Fertile ground: +50% food', 'Next to a Water Recycler: +20% food']
    },
    power: {
      n: 'Power Plant', d: 'Fusion reactor feeding energy to the whole empire.',
      c: [40, 0, 0], g: 1.5, jobs: 3, out: { energy: 0.8 },
      adj: ['Bedrock: +25% energy', 'Makes neighbouring habitats unhappy']
    },
    lab: {
      n: 'Research Lab', d: 'Scientists turn curiosity into research.',
      c: [70, 30, 5], g: 1.55, jobs: 4, out: { research: 0.15 },
      adj: ['Each neighbouring lab: +10% research', 'Next to a Park: +15% research']
    },
    recycler: {
      n: 'Water Recycler', d: 'Cleans and recycles water. Lifeline of dry worlds.',
      c: [50, 25, 0], g: 1.5, jobs: 2, out: { water: 0.8 }, req: 'recycler',
      adj: ['On a lake: +100% water', 'Boosts neighbouring farms']
    },
    clinic: {
      n: 'Clinic', d: 'Healthy colonists live longer and have more children.',
      c: [80, 40, 10], g: 1.55, jobs: 3, out: { health: 10 }, req: 'clinic',
      adj: ['Health raises birth rate and happiness']
    },
    park: {
      n: 'Park', d: 'Green space and culture. Happy colonists work harder.',
      c: [45, 10, 5], g: 1.5, jobs: 1, out: { happy: 4 }, req: 'park',
      adj: ['Next to habitats: +2 happiness each', 'On a lake: +50% happiness', 'Inspires neighbouring labs']
    },
    port: {
      n: 'Spaceport', d: 'Launches survey ships, colony pods and supply freighters. Each level adds one freighter.',
      c: [300, 150, 40], g: 2.0, jobs: 8, out: { freighters: 1 }, req: 'port', unique: true,
      adj: []
    },
    defense: {
      n: 'Defense Grid', d: 'Orbital batteries. Adds defense to every battle fought at this colony.',
      c: [250, 180, 60], g: 1.8, jobs: 5, out: { defense: 0.15 }, req: 'defense', unique: true,
      adj: ['Bedrock: +25% defense']
    }
  };
  G.BUILD_ORDER = ['habitat', 'farm', 'power', 'lab', 'recycler', 'clinic', 'park', 'port', 'defense'];

  G.HQ = {
    n: 'Capital', d: 'The heart of the colony. Expanding it opens new building plots and adds housing.',
    c: [150, 60, 10], g: 3.2, max: 8, housing: 20
  };
  // number of buildable plots unlocked per HQ level (axial ring order)
  G.HQ_PLOTS = [0, 6, 12, 18, 27, 36, 36, 36, 36];

  /* ---------- planet sites (outside the city) ---------- */
  G.SITES = {
    ore: { n: 'Quarry', d: 'Open-pit mine on a rocky deposit.', c: [20, 0, 0], g: 1.45, jobs: 3, out: 0.5, res: 'ore', model: 'quarry' },
    crystal: { n: 'Crystal Rig', d: 'Extracts resonant crystal from a deep vein.', c: [60, 30, 0], g: 1.5, jobs: 4, out: 0.12, res: 'crystal', model: 'crystal_rig' },
    water: { n: 'Water Pump', d: 'Pumps fresh water from the planet\'s natural reserves.', c: [20, 5, 0], g: 1.45, jobs: 2, out: 1.2, res: 'water', model: 'pump' }
  };
  G.WATER_FACTOR = [0, 0.5, 1.0, 1.4]; // by planet water class

  // life support per colonist per second
  G.EAT = 0.04;
  G.DRINK = 0.05;

  /* ---------- expansion ---------- */
  G.SURVEY_COST = d => [0, Math.ceil(40 + d * 6), 0];
  G.SURVEY_TIME = d => d < 1 ? 90 : 180 + d * 12; // seconds
  G.POD_COST = n => [600, 300, 80].map(x => Math.ceil(x * Math.pow(2.1, n - 1))); // n = colonies already owned
  G.ROUTE_RATE = 1.5; // units per second per freighter

  /* ---------- skill tree ----------
     b = branch (0..4), r = ring, o = angular offset. e: effect per level. max: cap (0 = infinite).
     c: research cost, g: growth, dm: optional dark matter cost, u: unlock flag. */
  G.BRANCHES = [
    { n: 'Industry', c: '#ffb938', glyph: 'pick' },
    { n: 'Society', c: '#7ef0c2', glyph: 'people' },
    { n: 'Logistics', c: '#5cc8ff', glyph: 'rocket' },
    { n: 'Military', c: '#ff7a7a', glyph: 'shield' },
    { n: 'Science', c: '#b18cff', glyph: 'atom' }
  ];
  const T = (id, b, r, o, n, d, e, max, c, req, extra) => Object.assign({ id, b, r, o, n, d, e, max, c, g: 1.5, req }, extra || {});
  G.TECH = [
    T('core', -1, 0, 0, 'Planetary Charter', 'The founding of your civilisation.', {}, 1, 0, []),
    // Industry
    T('i1', 0, 1, 0, 'Deep Drills', '+15% quarry output', { mine: .15 }, 10, 5, ['core']),
    T('i2a', 0, 2, -1, 'Power Grid', '+20% energy output', { energy: .2 }, 10, 15, ['i1']),
    T('i2b', 0, 2, 1, 'Crystal Resonance', '+15% crystal output', { crystal: .15 }, 10, 25, ['i1']),
    T('i3a', 0, 3, -1.4, 'Automation', '-6% jobs per building', { jobs: .06 }, 5, 90, ['i2a']),
    T('i3b', 0, 3, 0, 'Seismic Tapping', '+50% ore from tapping the planet', { tap: .5 }, 10, 20, ['i1']),
    T('i3c', 0, 3, 1.4, 'Geode Splitting', '+25% crystal output', { crystal: .25 }, 8, 140, ['i2b']),
    T('i4a', 0, 4, -1, 'Fusion Core', '+40% energy output', { energy: .4 }, 6, 450, ['i3a']),
    T('i4b', 0, 4, 1, 'Orbital Smelters', '+30% quarry output', { mine: .3 }, 8, 500, ['i3c', 'i3b']),
    T('i5', 0, 5, 0, 'Mega Excavators', '+50% quarry output', { mine: .5 }, 5, 3000, ['i4a', 'i4b']),
    T('i6', 0, 6, 0, 'Industrial Singularity', '+6% all industry. Infinite.', { mine: .06, energy: .06, crystal: .06 }, 0, 12000, ['i5'], { g: 1.3, dm: 25 }),
    // Society
    T('s1', 1, 1, 0, 'Civic Planning', '+10% housing', { housing: .1 }, 10, 6, ['core']),
    T('s2a', 1, 2, -1, 'Hydroponics', '+20% food', { food: .2 }, 10, 15, ['s1']),
    T('s2b', 1, 2, 1, 'Medicine', 'Unlocks the Clinic. +4 health', { health: 4 }, 5, 60, ['s1'], { u: 'clinic' }),
    T('s3a', 1, 3, -1.4, 'Culture', 'Unlocks Parks. +2 happiness', { happy: 2 }, 8, 70, ['s2a'], { u: 'park' }),
    T('s3b', 1, 3, 0, 'Water Reclamation', 'Unlocks the Water Recycler. +15% water', { water: .15 }, 8, 50, ['s2a'], { u: 'recycler' }),
    T('s3c', 1, 3, 1.4, 'Family Programs', '+15% birth rate', { birth: .15 }, 10, 110, ['s2b']),
    T('s4a', 1, 4, -1, 'Arcologies', '+20% housing', { housing: .2 }, 6, 550, ['s3a']),
    T('s4b', 1, 4, 1, 'Gene Therapy', '+8 health, +10% birth rate', { health: 8, birth: .1 }, 5, 700, ['s3c']),
    T('s5', 1, 5, 0, 'Golden Age', '+4 happiness, +10% all colony output', { happy: 4, all: .1 }, 5, 3500, ['s4a', 's4b']),
    T('s6', 1, 6, 0, 'Utopia', '+4% all colony output. Infinite.', { all: .04 }, 0, 15000, ['s5'], { g: 1.3, dm: 25 }),
    // Logistics
    T('l1', 2, 1, 0, 'Rocketry', 'Unlocks the Spaceport and survey flights inside your home system', {}, 1, 120, ['core'], { u: 'port' }),
    T('l2a', 2, 2, -1, 'Cargo Lines', 'Unlocks supply routes. +20% freighter capacity', { route: .2 }, 10, 250, ['l1'], { u: 'routes' }),
    T('l2b', 2, 2, 1, 'Long-Range Scanner', '+4 ly scanner range', { scan: 4 }, 10, 150, ['l1']),
    T('l3a', 2, 3, -1.4, 'Cold Storage', '+2h offline production cap', { offline: 2 }, 6, 200, ['l2a']),
    T('l3b', 2, 3, 0, 'Interstellar Drive', 'Survey and colonise other star systems', {}, 1, 1500, ['l2a', 'l2b'], { u: 'warp' }),
    T('l3c', 2, 3, 1.4, 'Survey Drones', '+25% scan rewards, +3 ly scanner range', { xeno: .25, scan: 3 }, 6, 300, ['l2b']),
    T('l4a', 2, 4, -1, 'Colony Pods', '-8% colony pod cost', { colony: .08 }, 5, 900, ['l3b']),
    T('l4b', 2, 4, 1, 'Warp Efficiency', '-8% travel time', { warp: .08 }, 6, 800, ['l3b']),
    T('l5', 2, 5, 0, 'Jump Gates', '-12% travel time, +30% freighter capacity', { warp: .12, route: .3 }, 4, 4000, ['l4a', 'l4b']),
    T('l6', 2, 6, 0, 'Deep Space Network', '+2 ly scanner range. Infinite.', { scan: 2 }, 0, 9000, ['l5'], { g: 1.28, dm: 20 }),
    // Military
    T('m1', 3, 1, 0, 'Targeting Arrays', '+10% fleet damage', { dmg: .1 }, 10, 8, ['core']),
    T('m2a', 3, 2, -1, 'Deflectors', '+12% shields', { shield: .12 }, 10, 30, ['m1']),
    T('m2b', 3, 2, 1, 'Composite Armor', '+12% hull', { hp: .12 }, 10, 30, ['m1']),
    T('m3a', 3, 3, -1.4, 'Missile Bays', 'Unlocks Missile Barrage. +20% missile damage', { missile: .2 }, 8, 160, ['m2a', 'm2b'], { u: 'missile' }),
    T('m3b', 3, 3, 0, 'Planetary Defense', 'Unlocks the Defense Grid. +15% defense', { defense: .15 }, 6, 400, ['m2b'], { u: 'defense' }),
    T('m3c', 3, 3, 1.4, 'Fire Control', '+6% fire rate', { rate: .06 }, 10, 120, ['m2b']),
    T('m4a', 3, 4, -1, 'Critical Systems', '+2% critical chance', { crit: .02 }, 10, 700, ['m3a']),
    T('m4b', 3, 4, 1, 'Nanite Repair', '+15% hull regeneration', { regen: .15 }, 8, 650, ['m3c']),
    T('m5', 3, 5, 0, 'Bounty Contracts', '+15% dark matter from battles', { dm: .15 }, 6, 3500, ['m4a', 'm4b']),
    T('m6', 3, 6, 0, 'War Doctrine', '+5% damage and hull. Infinite.', { dmg: .05, hp: .05 }, 0, 10000, ['m5'], { g: 1.3, dm: 25 }),
    // Science
    T('x1', 4, 1, 0, 'Xenobiology', '+20% species scan rewards', { xeno: .2 }, 10, 8, ['core']),
    T('x2a', 4, 2, -1, 'Research Networks', '+15% research', { research: .15 }, 10, 25, ['x1']),
    T('x2b', 4, 2, 1, 'Specimen Analysis', '+20% species bonuses', { species: .2 }, 5, 90, ['x1']),
    T('x3a', 4, 3, -1.4, 'Quantum Labs', '+25% research', { research: .25 }, 8, 220, ['x2a']),
    T('x3b', 4, 3, 0, 'Dark Matter Theory', '+10% dark matter', { dm: .1 }, 6, 300, ['x2a', 'x2b']),
    T('x3c', 4, 3, 1.4, 'Bio-Engineering', '+10% food, +5% birth rate', { food: .1, birth: .05 }, 8, 180, ['x2b']),
    T('x4a', 4, 4, -1, 'Precursor Studies', '+5% all colony output', { all: .05 }, 6, 950, ['x3a']),
    T('x4b', 4, 4, 1, 'Symbiosis', '+1 happiness per 4 species catalogued', { symb: 1 }, 3, 1100, ['x3c']),
    T('x5', 4, 5, 0, 'Synthetic Minds', '+40% research', { research: .4 }, 4, 4500, ['x4a', 'x4b']),
    T('x6', 4, 6, 0, 'Omniscience', '+5% research. Infinite.', { research: .05 }, 0, 14000, ['x5'], { g: 1.3, dm: 25 }),
    // bridges between neighbouring branches
    T('h01', 0.5, 4.7, 0, 'Company Towns', '+8% housing, -4% jobs', { housing: .08, jobs: .04 }, 5, 1300, ['i4b', 's4a']),
    T('h12', 1.5, 4.7, 0, 'Colonial Charter', '-6% colony pod cost, +2 happiness', { colony: .06, happy: 2 }, 4, 1500, ['s4b', 'l4a']),
    T('h23', 2.5, 4.7, 0, 'Armed Escorts', '+20% freighter capacity, +8% hull', { route: .2, hp: .08 }, 5, 1400, ['l4b', 'm4a']),
    T('h34', 3.5, 4.7, 0, 'Xeno Weapons', '+10% fleet damage', { dmg: .1 }, 5, 1600, ['m4b', 'x4a']),
    T('h40', 4.5, 4.7, 0, 'Applied Science', '+10% all industry', { mine: .1, energy: .1, crystal: .1 }, 5, 1300, ['x4b', 'i4a'])
  ];
  G.TECH_BY = {};
  G.TECH.forEach(t => { G.TECH_BY[t.id] = t; });
  G.techCost = (t, l) => Math.ceil(t.c * Math.pow(t.g, l));
  G.techDm = (t, l) => t.dm ? Math.ceil(t.dm * Math.pow(1.2, l)) : 0;

  /* ---------- armory: permanent flagship upgrades bought with dark matter (+ore) ---------- */
  G.MODULES = [
    { id: 'laser', n: 'Pulse Lasers', d: 'Main weapon damage', c: 4, g: 1.28, ore: 40, fx: l => '+' + Math.round(15 * l) + '% damage' },
    { id: 'rate', n: 'Capacitors', d: 'Fire rate', c: 6, g: 1.32, ore: 60, max: 40, fx: l => '+' + Math.round(5 * l) + '% fire rate' },
    { id: 'hull', n: 'Hull Plating', d: 'Hit points', c: 4, g: 1.28, ore: 40, fx: l => '+' + Math.round(15 * l) + '% hull' },
    { id: 'shield', n: 'Deflector Shield', d: 'Absorbs damage and recharges', c: 5, g: 1.3, ore: 50, fx: l => '+' + Math.round(15 * l) + '% shield' },
    { id: 'repair', n: 'Repair Drones', d: 'Hull regeneration per second', c: 6, g: 1.32, ore: 60, fx: l => (0.4 + 0.3 * l).toFixed(1) + ' hp/s' },
    { id: 'crit', n: 'Targeting AI', d: 'Chance for a triple-damage hit', c: 8, g: 1.35, ore: 80, max: 30, fx: l => (3 + 1.5 * l).toFixed(1) + '% crit' },
    { id: 'range', n: 'Sensor Mast', d: 'Weapon range', c: 7, g: 1.35, ore: 70, max: 25, fx: l => '+' + Math.round(4 * l) + '% range' },
    { id: 'salvage', n: 'Salvage Bay', d: 'More credits from wrecks during a battle', c: 8, g: 1.35, ore: 80, max: 30, fx: l => '+' + Math.round(8 * l) + '% credits' },
    { id: 'missile', n: 'Missile Racks', d: 'Missile Barrage damage', c: 12, g: 1.35, ore: 150, req: 'missile', fx: l => '+' + Math.round(25 * l) + '% missiles' },
    { id: 'engine', n: 'Warp Engines', d: 'Faster survey flights', c: 15, g: 1.45, ore: 300, max: 15, fx: l => '-' + Math.round(4 * l) + '% travel time' },
    { id: 'scanner', n: 'Deep Scanner', d: 'Scanner range in the galaxy', c: 15, g: 1.45, ore: 300, max: 20, fx: l => '+' + (l * 1.5).toFixed(1) + ' ly' }
  ];
  G.MOD_BY = {};
  G.MODULES.forEach(m => { G.MOD_BY[m.id] = m; });
  G.modCost = (m, l) => ({ dm: Math.ceil(m.c * Math.pow(m.g, l)), ore: Math.ceil(m.ore * Math.pow(m.g + .1, l)) });

  /* in-battle upgrades, bought with battle credits (reset every run, like The Tower) */
  G.RUN_UPS = [
    { id: 'dmg', n: 'Damage', d: '+20% damage', c: 8, g: 1.35 },
    { id: 'rate', n: 'Fire rate', d: '+8% fire rate', c: 10, g: 1.4 },
    { id: 'hp', n: 'Hull', d: '+20% max hull', c: 8, g: 1.35 },
    { id: 'regen', n: 'Regen', d: '+0.5 hp/s', c: 12, g: 1.4 }
  ];

  /* ---------- objectives: guided chain for the first hours, then endless ---------- */
  const home = S => S.col[G.HOME];
  const nb = (c, t) => Object.values(c.tiles).filter(x => x && x[0] === t).length;
  const lv = (c, t) => Object.values(c.tiles).filter(x => x && x[0] === t).reduce((a, x) => a + x[1], 0);
  G.OBJECTIVES = [
    { t: 'Tap the planet to mine ore', p: S => [S.st.taps, 12], rw: { ore: 30 } },
    { t: 'Upgrade the Quarry to level 2', p: S => [home(S).sites.a || 0, 2], rw: { ore: 40, energy: 10 } },
    { t: 'Enter the Capital', p: S => [S.st.visitedCity ? 1 : 0, 1], rw: { ore: 30 } },
    { t: 'Build a Power Plant', p: S => [nb(home(S), 'power'), 1], rw: { ore: 50 } },
    { t: 'Build a second Habitat', p: S => [nb(home(S), 'habitat'), 2], rw: { ore: 60, energy: 20 } },
    { t: 'Build a Research Lab', p: S => [nb(home(S), 'lab'), 1], rw: { research: 6 } },
    { t: 'Learn a technology', p: S => [Object.keys(S.tech).length - 1, 1], rw: { ore: 80, research: 5 } },
    { t: 'Grow the colony to 60 colonists', p: S => [Math.floor(home(S).pop), 60], rw: { ore: 150, energy: 60 } },
    { t: 'Win a battle: reach wave 5', p: S => [S.st.bestWave, 5], rw: { dm: 6 } },
    { t: 'Upgrade a module in the Armory', p: S => [Object.values(S.ship).reduce((a, b) => a + b, 0), 1], rw: { ore: 120 } },
    { t: 'Open the Crystal Rig', p: S => [home(S).sites.b || 0, 1], rw: { crystal: 15 } },
    { t: 'Scan an alien species', p: S => [Object.keys(S.dex).length, 1], rw: { research: 25 } },
    { t: 'Expand the Capital to level 2', p: S => [home(S).hq, 2], rw: { crystal: 30, research: 30 } },
    { t: 'Have 3 farms working', p: S => [nb(home(S), 'farm'), 3], rw: { ore: 300, energy: 120 } },
    { t: 'Reach wave 12', p: S => [S.st.bestWave, 12], rw: { dm: 15 } },
    { t: 'Grow the colony to 150 colonists', p: S => [Math.floor(home(S).pop), 150], rw: { ore: 600, energy: 250 } },
    { t: 'Research Rocketry', p: S => [S.tech.l1 ? 1 : 0, 1], rw: { energy: 300 } },
    { t: 'Build a Spaceport', p: S => [nb(home(S), 'port'), 1], rw: { ore: 400, crystal: 60 } },
    { t: 'Survey a planet in your home system', p: S => [S.st.surveys, 1], rw: { research: 120 } },
    { t: 'Clear a hostile orbit or alien nest', p: S => [S.st.cleared, 1], rw: { dm: 20 } },
    { t: 'Found your first colony', p: S => [Object.keys(S.col).length - 1, 1], rw: { dm: 30, research: 300 } },
    { t: 'Set up a supply route', p: S => [S.routes.length, 1], rw: { ore: 2500, energy: 1200 } },
    { t: 'Research Interstellar Drive', p: S => [S.tech.l3b ? 1 : 0, 1], rw: { dm: 40 } },
    { t: 'Catalogue 8 alien species', p: S => [Object.keys(S.dex).length, 8], rw: { dm: 50 } },
    { t: 'Reach wave 30', p: S => [S.st.bestWave, 30], rw: { dm: 80 } },
    { t: 'Rule 3 colonies', p: S => [Object.keys(S.col).length, 3], rw: { dm: 120, research: 4000 } }
  ];
  G.endlessObjective = function (k) {
    const kind = k % 3, step = Math.floor(k / 3) + 1;
    if (kind === 0) { const w = 30 + step * 10; return { t: 'Reach wave ' + w, p: S => [S.st.bestWave, w], rw: { dm: 60 + step * 30 } }; }
    if (kind === 1) { const n = 3 + step; return { t: 'Rule ' + n + ' colonies', p: S => [Object.keys(S.col).length, n], rw: { dm: 100 + step * 40 } }; }
    const n = 8 + step * 5; return { t: 'Catalogue ' + n + ' alien species', p: S => [Object.keys(S.dex).length, n], rw: { dm: 70 + step * 30 } };
  };
  G.objective = S => S.objIdx < G.OBJECTIVES.length ? G.OBJECTIVES[S.objIdx] : G.endlessObjective(S.objIdx - G.OBJECTIVES.length);
  G._lv = lv;
})(typeof window !== 'undefined' ? window.G : globalThis.G);
