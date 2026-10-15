/* ExoSphere procedural generation: planets, galaxy, alien species.
   Ported and extended from the Kotlin PlanetaryDataGenerator / AlienEcologyGenerator. */
'use strict';
(function (G) {
  const { rng, pick, hash } = G;

  /* ---------- biomes ---------- */
  // water: 0 none, 1 trace (ice caps), 2 seas, 3 ocean world. fert: soil fertility for farms.
  G.BIOMES = {
    temperate: {
      n: 'Temperate World', water: 2, fert: 1.0, tox: 0, hz: 0,
      atmo: ['Nitrogen', 'Oxygen', 1.0], temp: [-10, 32], weather: 'Rain fronts and jet streams',
      pal: { sea: .02, deep: '#1b4a86', shal: '#3a93d1', stops: [[.10, '#e8d38c'], [.38, '#93d150'], [.62, '#4f9b3b'], [.84, '#8c867b'], [1, '#f5f8fb']], tree: ['#2f7d3a', 5, .07], atmo: '#6db6ff', trees: [.12, .60], cloud: 0xffffff, cloudP: .7 }
    },
    ocean: {
      n: 'Ocean World', water: 3, fert: .7, tox: 0, hz: 1,
      atmo: ['Nitrogen', 'Water vapour', 1.4], temp: [4, 26], weather: 'Endless monsoon',
      pal: { sea: .16, deep: '#0d3470', shal: '#2a8fc9', stops: [[.15, '#f1e2a6'], [.45, '#5fc27a'], [.8, '#3c8f5d'], [1, '#d8efe0']], tree: ['#2d9d6b', 6, .06], atmo: '#59a6ff', trees: [.1, .9], cloud: 0xffffff, cloudP: .95 }
    },
    desert: {
      n: 'Desert World', water: 0, fert: .25, tox: .1, hz: 1,
      atmo: ['Carbon dioxide', 'Argon', .6], temp: [8, 71], weather: 'Dust storms',
      pal: { sea: -.30, deep: '#2c6f8f', shal: '#4cc0c0', stops: [[.12, '#f0cf8a'], [.45, '#e0a352'], [.75, '#c0703c'], [1, '#7d4a36']], tree: ['#5f8f3c', 5, .055], atmo: '#ffb98a', trees: [.10, .45], cloud: 0xfff2dd, cloudP: .25 }
    },
    ice: {
      n: 'Ice World', water: 3, fert: .2, tox: .1, hz: 2,
      atmo: ['Nitrogen', 'Methane', 1.3], temp: [-160, -40], weather: 'Methane blizzards',
      pal: { sea: -.05, deep: '#1d3e72', shal: '#5a9bd6', stops: [[.15, '#d7ecf8'], [.55, '#eef8ff'], [.8, '#a9bfd9'], [1, '#ffffff']], tree: ['#9fe9ff', 4, .095], atmo: '#b4e0ff', trees: [.10, .65], cloud: 0xffffff, cloudP: .6 }
    },
    volcanic: {
      n: 'Volcanic World', water: 0, fert: .1, tox: .7, hz: 3,
      atmo: ['Carbon dioxide', 'Sulfur dioxide', 2.6], temp: [180, 640], weather: 'Ash storms and magma rain',
      pal: { sea: .10, deep: '#ff5a14', shal: '#ffb02e', stops: [[.2, '#3a2e30'], [.55, '#54413f'], [.85, '#74584c'], [1, '#a08876']], tree: ['#1b1416', 3, .085], atmo: '#ff7a3a', trees: [.05, .80], cloud: 0x4a3d3b, cloudP: 1, lava: true }
    },
    toxic: {
      n: 'Toxic Jungle', water: 2, fert: .8, tox: .6, hz: 3,
      atmo: ['Chlorine', 'Ammonia', 1.9], temp: [30, 78], weather: 'Acid rain',
      pal: { sea: .0, deep: '#2c4a12', shal: '#7fa82a', stops: [[.12, '#c9d36b'], [.4, '#6fae2e'], [.7, '#3f7a2a'], [1, '#2a3d1e']], tree: ['#b4f03a', 6, .08], atmo: '#b6ff5c', trees: [.08, .9], cloud: 0xd8ff9a, cloudP: .8 }
    },
    crystal: {
      n: 'Crystal World', water: 1, fert: .3, tox: .3, hz: 2,
      atmo: ['Argon', 'Neon', .8], temp: [-45, 30], weather: 'Prismatic auroras',
      pal: { sea: -.08, deep: '#3a1670', shal: '#8b5cf6', stops: [[.15, '#e9d5ff'], [.45, '#b794f6'], [.75, '#7c4bc4'], [1, '#f5e8ff']], tree: ['#ff7eb6', 4, .12], atmo: '#d58cff', trees: [.15, .85], cloud: 0xf3e8ff, cloudP: .4 }
    },
    barren: {
      n: 'Barren Moon', water: 0, fert: 0, tox: 0, hz: 1,
      atmo: ['Vacuum', 'Helium trace', 0], temp: [-180, 130], weather: 'Micrometeorite showers',
      pal: { sea: -.9, deep: '#333', shal: '#555', stops: [[.15, '#8b8b93'], [.45, '#a3a3ab'], [.75, '#6e6e78'], [1, '#c9c9d1']], tree: ['#55555e', 4, .05], atmo: '#9aa3b8', trees: [.0, .0], cloud: 0xffffff, cloudP: 0 }
    }
  };
  G.BIOME_KEYS = Object.keys(G.BIOMES);
  const BIOME_WEIGHT = { temperate: 1, ocean: 1.1, desert: 1.6, ice: 1.4, volcanic: 1.2, toxic: 1, crystal: .8, barren: 1.6 };

  const GRADES = [['Trace', .5], ['Moderate', 1], ['Rich', 1.6], ['Abundant', 2.3], ['Anomalous', 3.5]];
  G.GRADES = GRADES;

  const SYL = ['ka', 'ro', 'vex', 'tun', 'mi', 'zal', 'or', 'en', 'dra', 'phi', 'su', 'lek', 'ba', 'qua', 'tho', 'ny', 'ise', 'ul', 'ar', 'cen'];
  const SUF = ['Prime', 'II', 'III', 'IV', 'V', 'VI', 'Major', 'Minor', 'b', 'c', 'd'];
  function planetName(r) {
    let nm = '';
    for (let i = 0, n = 2 + Math.floor(r() * 2); i < n; i++) nm += pick(r, SYL);
    nm = nm[0].toUpperCase() + nm.slice(1);
    return r() < .5 ? nm + ' ' + pick(r, SUF) : nm + '-' + (10 + Math.floor(r() * 990));
  }

  G.HOME = 4242;
  G.FORCE_BIOME = { [hash(77, 1)]: 'ice', [hash(77, 2)]: 'desert' };
  const MC = {};

  /* Full planet profile, deterministic from seed. */
  G.planet = function (seed) {
    if (MC[seed]) return MC[seed];
    const r = rng(seed * 31 + 7), home = seed === G.HOME;
    let biomeKey;
    if (home) biomeKey = 'temperate';
    else if (G.FORCE_BIOME[seed]) { biomeKey = G.FORCE_BIOME[seed]; r(); }
    else {
      let tot = 0; for (const k in BIOME_WEIGHT) tot += BIOME_WEIGHT[k];
      let x = r() * tot; biomeKey = 'barren';
      for (const k in BIOME_WEIGHT) { x -= BIOME_WEIGHT[k]; if (x <= 0) { biomeKey = k; break; } }
    }
    const B = G.BIOMES[biomeKey];
    const name = home ? 'Terra' : planetName(r);
    const gravity = home ? 1 : Math.round((.4 + r() * 1.6) * 100) / 100;
    const dist = home ? 0 : (G.planetDist[seed] || 0);
    // threat rises with distance from home and with biome hazard
    const threat = home ? 0 : G.clamp(Math.round(B.hz * .6 + dist / 18 + r() * 1.5), 0, 9);
    const gradeIdx = (bias) => G.clamp(Math.floor(r() * 3 + bias + (home ? 0 : dist / 40)), 0, 4);
    // two stone deposits per planet
    const depA = { type: 'ore', g: gradeIdx(biomeKey === 'barren' || biomeKey === 'volcanic' ? 1 : 0) };
    const crysBias = biomeKey === 'crystal' ? 2 : biomeKey === 'ice' ? .5 : 0;
    const depB = r() < (biomeKey === 'crystal' ? .9 : .55) || home ? { type: 'crystal', g: gradeIdx(crysBias) } : { type: 'ore', g: gradeIdx(0) };
    if (home) { depA.g = 1; depB.g = 1; }
    const water = B.water;
    const t0 = B.temp[0] + Math.round((r() - .5) * 20), t1 = B.temp[1] + Math.round((r() - .5) * 20);
    const P = MC[seed] = {
      seed, name, home, biome: biomeKey, B, pal: B.pal,
      gravity, threat, water, fert: B.fert,
      deposits: [depA, depB],
      atmo: { primary: B.atmo[0], secondary: B.atmo[1], pressure: Math.round(B.atmo[2] * (.8 + r() * .4) * 100) / 100, tox: B.tox },
      temp: [t0, t1], weather: B.weather,
      rings: !home && r() < .3, ringKind: Math.floor(r() * 3),
      moons: home ? 1 : Math.floor(r() * 3),
      size: home ? 1 : .8 + r() * .4
    };
    P.hab = G.clamp(Math.round(100 - B.tox * 70 - B.hz * 9 - Math.abs(gravity - 1) * 25 - (water ? 0 : 25) - Math.max(0, Math.abs((t0 + t1) / 2 - 18) - 15) * .4), 1, 100);
    if (home) P.hab = 100;
    P.species = genSpecies(seed, biomeKey, threat);
    return P;
  };

  /* ---------- alien species ---------- */
  const PREF = ['Xeno', 'Cryo', 'Litho', 'Vesper', 'Pyro', 'Aero', 'Umbra', 'Giga', 'Phospho', 'Tachyo', 'Prisma', 'Nebu', 'Silico', 'Myco', 'Hydro', 'Lumi'];
  const ROOT = ['manta', 'wyrm', 'drifter', 'carapace', 'strider', 'behemoth', 'spore', 'stalker', 'viper', 'scarab', 'mantis', 'polyp', 'grazer', 'hopper', 'leech', 'moth'];
  const PLANS = ['blob', 'crawler', 'manta', 'worm', 'strider', 'colossus'];
  const BEHAV = [
    ['Docile grazer', 0], ['Curious watcher', 0], ['Territorial', 1], ['Hunting swarm', 1], ['Leviathan', 1]
  ];
  const BONUS = [
    ['research', 'Research', .03], ['happy', 'Happiness', 1], ['birth', 'Birth rate', .03],
    ['mine', 'Mining', .03], ['dmg', 'Fleet damage', .03], ['food', 'Food', .04]
  ];
  G.SPECIES_BONUS = BONUS;
  const BIOME_TONES = {
    temperate: [['#3fae5a', '#9cff8a'], ['#c08a3e', '#ffd36b'], ['#4a7bd1', '#8fe3ff']],
    ocean: [['#2a7fb8', '#7ff3ff'], ['#1f9a8a', '#a6ffe9'], ['#5a5fd6', '#c2b8ff']],
    desert: [['#c58d4c', '#ffcf7a'], ['#9c5b3a', '#ff9a5a'], ['#d9b98a', '#fff1c2']],
    ice: [['#9cc8ef', '#e6fbff'], ['#5a7fc4', '#9fe9ff'], ['#c9d9f2', '#ffffff']],
    volcanic: [['#3e2723', '#ff5a1f'], ['#5a2a2a', '#ffb02e'], ['#2b2b33', '#ff3d6a']],
    toxic: [['#4b6e1d', '#d4ff3a'], ['#2f5a3c', '#7dff9a'], ['#6a3d7a', '#e4ff5c']],
    crystal: [['#5b2a9e', '#ff7eb6'], ['#2e3a9e', '#9fd3ff'], ['#8a3aa8', '#ffd1ff']],
    barren: [['#55555e', '#a5b4fc'], ['#6e5a4a', '#ffc58a'], ['#3e4a5a', '#7fe0ff']]
  };
  function genSpecies(seed, biome, threat) {
    const r = rng(seed + 40404), n = biome === 'barren' ? 1 + Math.floor(r() * 2) : 3 + Math.floor(r() * 3), out = [];
    for (let i = 0; i < n; i++) {
      let b = Math.floor(r() * BEHAV.length);
      if (threat === 0 && BEHAV[b][1]) b = Math.floor(r() * 2);
      const tone = pick(r, BIOME_TONES[biome]);
      const plan = b === 4 ? 'colossus' : pick(r, PLANS.slice(0, 5));
      const bonus = pick(r, BONUS);
      out.push({
        id: seed + ':' + i, idx: i,
        name: pick(r, PREF) + pick(r, ROOT),
        plan, behav: BEHAV[b][0], hostile: !!BEHAV[b][1],
        size: b === 4 ? 2.2 + r() * .8 : .6 + r() * 1.1,
        body: tone[0], glow: tone[1],
        eyes: 1 + Math.floor(r() * 5), legs: 2 + Math.floor(r() * 4) * 2,
        spikes: r() < .45 ? 2 + Math.floor(r() * 6) : 0,
        stripes: r() < .5,
        bonus: { k: bonus[0], label: bonus[1], v: bonus[2] * (b === 4 ? 3 : 1) },
        hp: Math.round((40 + r() * 60) * (1 + threat * .6) * (b === 4 ? 4 : 1)),
        diet: pick(r, ['Lithovore', 'Radiotroph', 'Chemosynthetic', 'Predator', 'Filter feeder', 'Energy feeder'])
      });
    }
    return out;
  }

  /* ---------- galaxy ---------- */
  // A spiral galaxy of star systems. Positions in light-year-ish units.
  G.planetDist = {};
  G.galaxy = (function () {
    const r = rng(1337), sys = [], N = 420, ARMS = 4;
    const starTypes = [['#ffd27a', 'Yellow dwarf'], ['#ff9a6a', 'Orange dwarf'], ['#ff6a6a', 'Red dwarf'], ['#9fc7ff', 'Blue giant'], ['#ffffff', 'White star']];
    // home system
    sys.push({ i: 0, x: 38, y: 0, name: 'Sol', star: starTypes[0], planets: [G.HOME, hash(77, 1), hash(77, 2)] });
    let tries = 0;
    while (sys.length < N && tries < 20000) {
      tries++;
      const arm = Math.floor(r() * ARMS), d = 8 + Math.pow(r(), .8) * 92, ang = arm / ARMS * Math.PI * 2 + d * .055 + (r() - .5) * .55;
      const x = Math.cos(ang) * d + (r() - .5) * 5, y = Math.sin(ang) * d + (r() - .5) * 5;
      if (sys.some(s => (s.x - x) ** 2 + (s.y - y) ** 2 < 9)) continue;
      const i = sys.length, np = 1 + Math.floor(r() * 4), pl = [];
      for (let k = 0; k < np; k++) pl.push(hash(i * 977 + 13, k + 1));
      const nm = (pick(r, ['Kep', 'Gli', 'Tau', 'Ross', 'Wolf', 'Lal', 'Vega', 'Alt', 'Cyg', 'Hyd', 'Ori', 'Lyr']) + '-' + (100 + Math.floor(r() * 900)));
      sys.push({ i, x, y, name: nm, star: pick(r, starTypes), planets: pl });
    }
    const hx = sys[0].x, hy = sys[0].y;
    for (const s of sys) { s.d = Math.hypot(s.x - hx, s.y - hy); for (const p of s.planets) G.planetDist[p] = s.d; }
    // the two neighbours in Sol are kept close to home and gentle
    return sys;
  })();
  G.sysOf = {};
  for (const s of G.galaxy) for (const p of s.planets) G.sysOf[p] = s.i;
})(typeof window !== 'undefined' ? window.G : globalThis.G);
