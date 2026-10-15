/* ExoSphere simulation: state, colony economy with hex adjacency, life support, routes,
   expeditions, species scans, offline progress. No DOM access (balance-testable in Node). */
'use strict';
(function (G) {
  const { clamp, lvlMul, BUILD, SITES, TECH_BY } = G;
  const SAVE_KEY = 'exosphere_v4';

  /* ---------- hex grid (axial) ---------- */
  const DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
  G.HEX_DIRS = DIRS;
  G.ring = function (n) {
    if (n === 0) return [[0, 0]];
    const out = []; let q = -n, r = n; // start at direction 4 * n
    for (let d = 0; d < 6; d++) for (let k = 0; k < n; k++) { out.push([q, r]); q += DIRS[d][0]; r += DIRS[d][1]; }
    return out;
  };
  G.PLOTS = [].concat(G.ring(1), G.ring(2), G.ring(3)); // build order of plots
  G.key = (q, r) => q + ',' + r;
  G.neighbours = (q, r) => DIRS.map(d => G.key(q + d[0], r + d[1]));
  G.plotUnlocked = (col, k) => { const i = G.PLOTS.findIndex(p => G.key(p[0], p[1]) === k); return i >= 0 && i < G.HQ_PLOTS[Math.min(col.hq, G.HQ.max)]; };

  /* terrain features of a colony's city plot, deterministic per planet */
  const FEAT = {};
  G.features = function (seed) {
    if (FEAT[seed]) return FEAT[seed];
    const P = G.planet(seed), r = G.rng(seed * 101 + 5), f = {};
    G.PLOTS.forEach(([q, rr]) => {
      const x = r(); let t = 'plain';
      if (P.water > 0 && x < .09) t = 'lake';
      else if (x < .22) t = 'rock';
      else if (x < .36 && P.fert > .15) t = 'fertile';
      f[G.key(q, rr)] = t;
    });
    // the home world always has a gentle mix close to the capital
    if (P.home) { f['1,0'] = 'fertile'; f['-1,1'] = 'rock'; f['0,-1'] = 'plain'; f['2,-2'] = 'lake'; }
    return (FEAT[seed] = f);
  };
  G.FEATURE_INFO = {
    plain: ['Open ground', ''], fertile: ['Fertile soil', '+50% farm output'],
    rock: ['Bedrock', '+25% power and defense'], lake: ['Lake', 'x2 recycler water, +50% park happiness']
  };

  /* ---------- state ---------- */
  G.newColony = function (seed, starter) {
    const P = G.planet(seed);
    const c = { seed, pop: starter ? 20 : 12, food: 60, water: 60, hq: 1, tiles: {}, sites: { a: 1, b: 0, water: P.water > 0 ? 1 : 0 }, nests: {}, founded: Date.now() };
    c.tiles['1,0'] = ['farm', 1];
    c.tiles['-1,0'] = ['habitat', 1];
    if (starter) c.tiles['0,1'] = ['habitat', 1];
    return c;
  };
  G.defaultState = function () {
    return {
      v: 4, t: Date.now(), cur: G.HOME,
      res: { ore: 40, energy: 20, crystal: 0, research: 0, dm: 0 },
      col: { [G.HOME]: G.newColony(G.HOME, true) },
      tech: { core: 1 }, ship: {}, routes: [], dex: {}, scans: {},
      known: { [G.HOME]: 1 }, cleared: { [G.HOME]: 1 }, flights: [],
      st: { taps: 0, visitedCity: false, bestWave: 0, surveys: 0, cleared: 0, kills: 0, battles: 0, played: 0 },
      objIdx: 0, settings: { sound: 1, music: 1, quality: 1 }, seenIntro: 0
    };
  };
  G.save = function (S) { try { S.t = Date.now(); localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { } };
  G.load = function () {
    try {
      const raw = localStorage.getItem(SAVE_KEY); if (!raw) return G.defaultState();
      const p = JSON.parse(raw), d = G.defaultState();
      for (const k in d) if (p[k] === undefined) p[k] = d[k];
      p.res = Object.assign(d.res, p.res); p.st = Object.assign(d.st, p.st); p.settings = Object.assign(d.settings, p.settings);
      return p;
    } catch (e) { return G.defaultState(); }
  };
  G.reset = function () { try { localStorage.removeItem(SAVE_KEY); } catch (e) { } };

  /* ---------- bonuses (tech + species) ---------- */
  G.tech = (S, k) => { let a = 0; for (const id in S.tech) { const t = TECH_BY[id]; if (t && t.e[k] !== undefined) a += t.e[k] * S.tech[id]; } return a; };
  G.species = function (S, k) {
    let a = 0; const mul = 1 + G.tech(S, 'species');
    for (const id in S.dex) { const sp = G.speciesById(id); if (sp && sp.bonus.k === k) a += sp.bonus.v; }
    return a * mul;
  };
  G.bonus = (S, k) => 1 + G.tech(S, k) + G.species(S, k);
  G.allMul = S => 1 + G.tech(S, 'all');
  G.speciesById = function (id) { const [seed, i] = id.split(':'); const P = G.planet(+seed); return P.species[+i]; };

  /* ---------- colony economy ---------- */
  G.colonyStats = function (S, col) {
    const P = G.planet(col.seed), F = G.features(col.seed), o = {
      P, housing: G.HQ.housing * col.hq + 10, jobs: 0, food: 0, water: 0, ore: 0, crystal: 0, energy: 0, research: 0,
      health: 50, happyAdd: 0, freighters: 0, defense: 0, notes: [], perTile: {}
    };
    const jobsMul = Math.max(.5, 1 - G.tech(S, 'jobs'));
    const tiles = col.tiles;
    const typeAt = k => tiles[k] ? tiles[k][0] : null;
    for (const k in tiles) {
      const t = tiles[k]; if (!t) continue;
      const [type, l] = t, B = BUILD[type], m = lvlMul(l), [q, r] = k.split(',').map(Number);
      const nb = G.neighbours(q, r).map(typeAt), feat = F[k];
      const cnt = x => nb.filter(n => n === x).length;
      let v = 0;
      switch (type) {
        case 'habitat': v = B.out.housing * m; o.housing += v; o.happyAdd += 2 * cnt('park') - 2 * cnt('power'); break;
        case 'farm': v = B.out.food * m * (.4 + P.fert) * (feat === 'fertile' ? 1.5 : 1) * (cnt('recycler') ? 1.2 : 1); o.food += v; break;
        case 'power': v = B.out.energy * m * (feat === 'rock' ? 1.25 : 1); o.energy += v; break;
        case 'lab': v = B.out.research * m * (1 + .1 * cnt('lab')) * (cnt('park') ? 1.15 : 1); o.research += v; break;
        case 'recycler': v = B.out.water * m * (feat === 'lake' ? 2 : 1); o.water += v; break;
        case 'clinic': v = B.out.health * l; o.health += v; break;
        case 'park': v = B.out.happy * l * (feat === 'lake' ? 1.5 : 1); o.happyAdd += v; break;
        case 'port': v = l; o.freighters += l; break;
        case 'defense': v = B.out.defense * l * (feat === 'rock' ? 1.25 : 1); o.defense += v; break;
      }
      o.perTile[k] = v;
      o.jobs += Math.round(B.jobs * l * jobsMul);
    }
    // planet sites
    const dA = P.deposits[0], dB = P.deposits[1];
    const site = (lvl, dep) => { if (!lvl) return 0; const D = SITES[dep.type]; o.jobs += Math.round(D.jobs * lvl * jobsMul); return D.out * lvlMul(lvl) * G.GRADES[dep.g][1]; };
    const a = site(col.sites.a, dA), b = site(col.sites.b, dB);
    o.siteOut = { a, b, water: 0 };
    o[dA.type] += a; o[dB.type] += b;
    if (col.sites.water && P.water > 0) { const w = SITES.water.out * lvlMul(col.sites.water) * G.WATER_FACTOR[P.water]; o.water += w; o.siteOut.water = w; o.jobs += Math.round(SITES.water.jobs * col.sites.water * jobsMul); }
    o.energy += .25; // capital generator

    o.housing = Math.floor(o.housing * G.bonus(S, 'housing'));
    o.staff = o.jobs > 0 ? clamp(col.pop / o.jobs, 0, 1) : 1;
    o.unemployed = Math.max(0, Math.floor(col.pop - o.jobs));

    // life support
    o.foodProd = o.food * o.staff * G.bonus(S, 'food');
    o.waterProd = o.water * o.staff * G.bonus(S, 'water');
    o.foodUse = col.pop * G.EAT; o.waterUse = col.pop * G.DRINK;
    let fIn = 0, wIn = 0;
    for (const rt of S.routes) {
      const amt = rt.n * G.ROUTE_RATE * (1 + G.tech(S, 'route'));
      if (rt.to === col.seed) { if (rt.res === 'food') fIn += amt; else wIn += amt; }
      if (rt.from === col.seed) { if (rt.res === 'food') fIn -= amt; else wIn -= amt; }
    }
    o.foodRoute = fIn; o.waterRoute = wIn;
    o.foodNet = o.foodProd - o.foodUse + fIn;
    o.waterNet = o.waterProd - o.waterUse + wIn;
    o.cap = 150 + 120 * col.hq;
    const starving = col.food <= 0 && o.foodNet < 0, thirsty = col.water <= 0 && o.waterNet < 0;

    // health & happiness
    o.health = clamp(o.health + G.tech(S, 'health') - P.atmo.tox * 25 - (starving || thirsty ? 25 : 0), 5, 100);
    let h = 55 + o.happyAdd + G.tech(S, 'happy') + G.species(S, 'happy');
    const parts = [['Base', 55]];
    if (o.happyAdd) parts.push(['Parks and neighbours', Math.round(o.happyAdd)]);
    if (!starving && o.foodNet >= 0) { h += 5; parts.push(['Food surplus', 5]); }
    if (!thirsty && o.waterNet >= 0) { h += 5; parts.push(['Water surplus', 5]); }
    if (starving) { h -= 30; parts.push(['Starvation', -30]); }
    if (thirsty) { h -= 30; parts.push(['No drinking water', -30]); }
    if (col.pop > 10 && o.unemployed / col.pop > .3) { h -= 8; parts.push(['Unemployment', -8]); }
    const nests = P.species.filter(sp => sp.hostile && !col.nests[sp.idx]).length;
    if (nests) { h -= 6 * nests; parts.push(['Hostile alien nests', -6 * nests]); }
    if (P.atmo.tox > 0) { h -= Math.round(P.atmo.tox * 10); parts.push(['Toxic air', -Math.round(P.atmo.tox * 10)]); }
    const symb = G.tech(S, 'symb') * Math.floor(Object.keys(S.dex).length / 4);
    if (symb) { h += symb; parts.push(['Symbiosis', symb]); }
    const th = G.tech(S, 'happy') + G.species(S, 'happy'); if (th) parts.push(['Technology and species', Math.round(th)]);
    o.happy = clamp(Math.round(h), 0, 100); o.happyParts = parts;
    o.morale = .6 + o.happy / 100 * .8;

    // growth
    if (starving || thirsty) o.growth = -Math.max(.05, col.pop * .004);
    else {
      const room = Math.max(0, 1 - col.pop / Math.max(1, o.housing));
      o.growth = (col.pop * .006 * (o.health / 50) * (.5 + o.happy / 100) * G.bonus(S, 'birth') + .04) * room;
      if (col.pop > o.housing) o.growth = -(col.pop - o.housing) * .01;
    }

    // empire output
    const all = G.allMul(S), mm = o.staff * o.morale * all;
    o.out = {
      ore: o.ore * mm * G.bonus(S, 'mine'),
      crystal: o.crystal * mm * G.bonus(S, 'crystal') * (dA.type === 'ore' && dB.type === 'ore' ? 1 : 1),
      energy: o.energy * mm * G.bonus(S, 'energy'),
      research: o.research * mm * G.bonus(S, 'research')
    };
    if (o.staff < .999) o.notes.push('Not enough workers: buildings run at ' + Math.round(o.staff * 100) + '%');
    if (starving) o.notes.push('Food has run out. Colonists are leaving.');
    if (thirsty) o.notes.push('Drinking water has run out. Colonists are leaving.');
    if (!thirsty && o.waterNet < 0) o.notes.push('Water reserves are shrinking.');
    if (!starving && o.foodNet < 0) o.notes.push('Food reserves are shrinking.');
    return o;
  };

  G.rates = function (S) {
    const t = { ore: 0, crystal: 0, energy: 0, research: 0 };
    for (const k in S.col) { const o = G.colonyStats(S, S.col[k]).out; for (const r in t) t[r] += o[r]; }
    return t;
  };
  G.tapYield = S => Math.max(1, Math.round((1 + Math.floor((S.col[S.cur] ? S.col[S.cur].sites.a : 0) / 2)) * (1 + G.tech(S, 'tap'))));

  /* ---------- spending ---------- */
  G.can = (S, c) => c.every((x, i) => S.res[G.COST_KEYS[i]] >= x);
  G.pay = (S, c) => c.forEach((x, i) => { S.res[G.COST_KEYS[i]] -= x; });
  G.buildCost = (type, lvl) => G.costAt(BUILD[type].c, BUILD[type].g, lvl);
  G.newBuildCost = (col, type) => {
    // each extra copy of the same building costs more
    const n = Object.values(col.tiles).filter(t => t && t[0] === type).length;
    return G.costAt(BUILD[type].c, BUILD[type].g, n * 1.5);
  };
  G.hqCost = l => G.costAt(G.HQ.c, G.HQ.g, l - 1);
  G.siteCost = (type, lvl) => G.costAt(SITES[type].c, SITES[type].g, lvl);

  /* ---------- galaxy reach & flights ---------- */
  G.scanRange = S => 9 + G.tech(S, 'scan') + (S.ship.scanner || 0) * 1.5;
  G.sysVisible = function (S, sys) {
    if (sys.i === 0) return true;
    const R = G.scanRange(S);
    for (const k in S.col) { const s = G.galaxy[G.sysOf[k]]; if (Math.hypot(s.x - sys.x, s.y - sys.y) <= R) return true; }
    return false;
  };
  G.travelTime = function (S, seed) {
    const sys = G.galaxy[G.sysOf[seed]];
    let best = 1e9;
    for (const k in S.col) { const s = G.galaxy[G.sysOf[k]]; best = Math.min(best, Math.hypot(s.x - sys.x, s.y - sys.y)); }
    const base = best < .5 ? 90 : 240 + best * 14;
    return base * Math.max(.3, 1 - G.tech(S, 'warp') - (S.ship.engine || 0) * .04);
  };
  G.hasPort = S => Object.values(S.col).some(c => Object.values(c.tiles).some(t => t && t[0] === 'port'));
  G.freighters = S => { let n = 0; for (const k in S.col) n += G.colonyStats(S, S.col[k]).freighters; return n; };
  G.freightersUsed = S => S.routes.reduce((a, r) => a + r.n, 0);
  G.canReach = function (S, seed) {
    const inHome = G.sysOf[seed] === G.sysOf[S.cur] || G.sysOf[seed] === 0;
    if (!S.tech.l1) return [false, 'Research Rocketry first'];
    if (!G.hasPort(S)) return [false, 'Build a Spaceport first'];
    const sysOwned = Object.keys(S.col).some(k => G.sysOf[k] === G.sysOf[seed]);
    if (!sysOwned && !S.tech.l3b) return [false, 'Requires Interstellar Drive'];
    if (!G.sysVisible(S, G.galaxy[G.sysOf[seed]])) return [false, 'Out of scanner range'];
    return [true, ''];
  };
  G.flying = (S, seed, kind) => S.flights.find(f => f.seed === seed && (!kind || f.kind === kind));
  G.launch = function (S, kind, seed) {
    const sys = G.galaxy[G.sysOf[seed]];
    const cost = kind === 'survey' ? G.SURVEY_COST(sys.d) : G.podCost(S);
    if (!G.can(S, cost)) return false;
    G.pay(S, cost);
    const dur = G.travelTime(S, seed) * (kind === 'pod' ? 1.3 : 1);
    S.flights.push({ kind, seed, start: Date.now(), end: Date.now() + dur * 1000 });
    return true;
  };
  G.podCost = S => G.POD_COST(Object.keys(S.col).length).map(x => Math.ceil(x * Math.max(.5, 1 - G.tech(S, 'colony'))));

  /* ---------- species scans ---------- */
  G.scanCost = sp => [0, Math.ceil(15 * (1 + G.planet(+sp.id.split(':')[0]).threat) * (1 + sp.idx * .3)), 0];
  G.scanTime = sp => 25 + sp.idx * 15 + G.planet(+sp.id.split(':')[0]).threat * 20;
  G.scanReward = (S, sp) => Math.ceil(10 * (1 + G.planet(+sp.id.split(':')[0]).threat) * (1 + sp.idx * .4) * (1 + G.tech(S, 'xeno')));

  /* ---------- tick ---------- */
  G.simTick = function (S, dt, notify) {
    const say = notify || (() => { });
    for (const k in S.col) {
      const c = S.col[k], o = G.colonyStats(S, c);
      c.food = clamp(c.food + o.foodNet * dt, 0, o.cap);
      c.water = clamp(c.water + o.waterNet * dt, 0, o.cap);
      c.pop = Math.max(4, c.pop + o.growth * dt);
      for (const r in o.out) S.res[r] += o.out[r] * dt;
    }
    // routes stop if the source has no stock
    const now = Date.now();
    for (let i = S.flights.length - 1; i >= 0; i--) {
      const f = S.flights[i];
      if (now >= f.end) {
        S.flights.splice(i, 1);
        const P = G.planet(f.seed);
        if (f.kind === 'survey') {
          S.known[f.seed] = 1; S.st.surveys++;
          if (!P.threat) S.cleared[f.seed] = 1;
          say({ t: 'Survey complete', d: P.name + ' • ' + P.B.n + (P.threat ? ' • hostile orbit, threat ' + P.threat : ' • safe to settle'), seed: f.seed, kind: 'survey' });
        } else if (f.kind === 'pod') {
          if (!S.col[f.seed]) S.col[f.seed] = G.newColony(f.seed, false);
          say({ t: 'Colony founded', d: 'Welcome to ' + P.name + '!', seed: f.seed, kind: 'pod' });
        }
      }
    }
    for (const id in S.scans) {
      if (now >= S.scans[id]) {
        delete S.scans[id];
        const sp = G.speciesById(id);
        if (sp && !S.dex[id]) {
          S.dex[id] = now; const rw = G.scanReward(S, sp); S.res.research += rw;
          say({ t: 'Species catalogued', d: sp.name + ' • +' + rw + ' research • +' + G.bonusText(sp), kind: 'scan', id });
        }
      }
    }
  };
  G.bonusText = sp => sp.bonus.k === 'happy' ? sp.bonus.v + ' ' + sp.bonus.label.toLowerCase() : Math.round(sp.bonus.v * 100) + '% ' + sp.bonus.label.toLowerCase();

  G.offline = function (S) {
    const el = (Date.now() - (S.t || Date.now())) / 1000;
    if (el < 60) return null;
    const cap = (4 + G.tech(S, 'offline')) * 3600, sim = Math.min(el, cap);
    const before = Object.assign({}, S.res), pop0 = Object.values(S.col).reduce((a, c) => a + c.pop, 0);
    const n = Math.min(240, Math.ceil(sim / 30)), dt = sim / n, notes = [];
    for (let i = 0; i < n; i++) G.simTick(S, dt, x => notes.push(x));
    const pop1 = Object.values(S.col).reduce((a, c) => a + c.pop, 0), gain = {};
    for (const k in S.res) gain[k] = S.res[k] - before[k];
    return { secs: sim, away: el, capped: el > cap, gain, pop: pop1 - pop0, notes };
  };
})(typeof window !== 'undefined' ? window.G : globalThis.G);
