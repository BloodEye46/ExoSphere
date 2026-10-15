/* ExoSphere UI Controller: AAA Interactive Sci-Fi Experience with Audio, Dioramas, & Radial Canvases */
'use strict';
(function (G) {
  const { fmt, fmtRate, fmtTime, RES, BUILD, BUILD_ORDER, HQ, SITES, TECH_BY, MODULES, OBJECTIVES, endlessObjective } = G;

  const $ = id => document.getElementById(id);

  class UIController {
    constructor(S, renderer) {
      this.S = S;
      this.R = renderer;
      this.curTab = null; // null = orbit, 'city', 'mining', 'galaxy', 'tree', 'fleet', 'xeno'

      // Sub-system canvas controllers
      this.cityDiorama = null;
      this.treeCanvas = null;
      this.galaxyCanvas = null;
      this.combatRun = null;

      this.selectedHex = '0,0';
      this.selectedTech = 'core';
      this.selectedSys = 0;

      this.initDOMElements();
      this.bindEvents();
    }

    initDOMElements() {
      // 1. Top HUD
      const hud = $('hud');
      hud.innerHTML = `
        <div class="hud-pill" title="Empire-wide Ore reserves">
          <i class="ic" style="background:${RES.ore.c};clip-path:polygon(50% 0,100% 38%,82% 100%,18% 100%,0 38%)"></i>
          <div><b id="v-ore">0</b><small id="r-ore">+0/s</small></div>
        </div>
        <div class="hud-pill" title="Empire-wide Energy reserves">
          <i class="ic" style="background:${RES.energy.c};clip-path:polygon(60% 0,15% 55%,48% 55%,36% 100%,85% 42%,52% 42%)"></i>
          <div><b id="v-energy">0</b><small id="r-energy">+0/s</small></div>
        </div>
        <div class="hud-pill" title="Empire-wide Crystal reserves">
          <i class="ic" style="background:${RES.crystal.c};clip-path:polygon(50% 0,100% 50%,50% 100%,0 50%)"></i>
          <div><b id="v-crystal">0</b><small id="r-crystal">+0/s</small></div>
        </div>
        <div class="hud-pill" title="Research Points">
          <i class="ic" style="background:${RES.research.c};clip-path:circle(50%)"></i>
          <div><b id="v-res">0</b><small id="r-res">+0/s</small></div>
        </div>
        <div class="hud-pill" title="Dark Matter from Tactical Battles">
          <i class="ic" style="background:${RES.dm.c};clip-path:polygon(50% 0,100% 50%,50% 100%,0 50%)"></i>
          <div><b id="v-dm">0</b><small>dark matter</small></div>
        </div>
        <button id="btn-audio" class="hud-btn" type="button" title="Toggle Sound">
          <svg viewBox="0 0 24 24" style="width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
        </button>
      `;

      $('btn-audio')?.addEventListener('click', () => {
        if (G.Audio) {
          const isMuted = G.Audio.toggleMute();
          $('btn-audio').style.opacity = isMuted ? '0.4' : '1.0';
          if (!isMuted) G.Audio.tap(700);
        }
      });

      // 2. Bottom Dock Buttons (Sleek AAA Vectors)
      const dock = $('dock');
      dock.innerHTML = `
        <button class="d" data-t="city" title="Capital City Diorama">
          <i><svg viewBox="0 0 24 24"><path d="M3 21h18M5 21V9l7-5 7 5v12M9 13h6M9 17h6"/></svg></i>
          <span>Capital</span>
        </button>
        <button class="d" data-t="mining" title="Planetary Mines & Water Pump">
          <i><svg viewBox="0 0 24 24"><path d="M14 4l6 6M4 20l10-10M2 14l6-6M10 22l6-6"/></svg></i>
          <span>Mines</span>
        </button>
        <button class="d big" data-t="galaxy" title="Spiral Galaxy Map">
          <i><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><circle cx="19" cy="8" r="1.5"/><circle cx="5" cy="16" r="1.5"/><path d="M12 4a8 8 0 0 1 8 8M12 20a8 8 0 0 1-8-8"/></svg></i>
          <span>Galaxy</span>
        </button>
        <button class="d" data-t="tree" title="The Tower (Radial Skill Tree)">
          <i><svg viewBox="0 0 24 24"><path d="M12 3v18M12 9l6-4M12 15l7-3M12 11l-6-4M12 17l-7-3"/></svg></i>
          <span>The Tower</span>
        </button>
        <button class="d" data-t="fleet" title="Armada Workshop & Sector Defense">
          <i><svg viewBox="0 0 24 24"><path d="M12 2L4 20l8-4 8 4L12 2z"/></svg></i>
          <span>Defense</span>
        </button>
        <button class="d" data-t="xeno" title="Xenodex & Alien Life">
          <i><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 3M8 12h.01M16 12h.01"/></svg></i>
          <span>Xenodex</span>
        </button>
      `;

      // 3. Guided Objectives Floating Bar
      const objBar = document.createElement('div');
      objBar.id = 'obj-bar';
      document.body.appendChild(objBar);
      this.objBar = objBar;
      this.updateObjectiveUI();
    }

    bindEvents() {
      // Dock tab buttons
      $('dock').addEventListener('click', e => {
        const btn = e.target.closest('[data-t]');
        if (!btn) return;
        const t = btn.dataset.t;
        if (G.Audio) G.Audio.tap(600);
        this.toggleTab(t);
      });

      // Overlay background click to close
      $('ov').addEventListener('click', e => {
        if (e.target.id === 'ov' || e.target.classList.contains('ov-close')) {
          if (G.Audio) G.Audio.tap(450);
          this.toggleTab(null);
        }
      });

      // Objective bar click
      this.objBar.addEventListener('click', () => {
        const obj = this.getCurrentObjective();
        if (!obj) return;
        const [cur, target] = obj.p(this.S);
        if (cur >= target) {
          this.S.objIdx = (this.S.objIdx || 0) + 1;
          for (const k in obj.rw) {
            this.S.res[k] = (this.S.res[k] || 0) + obj.rw[k];
          }
          if (G.Audio) G.Audio.research();
          this.pop(innerWidth / 2, 120, 'Mission Accomplished!', '#ffb938');
          G.save(this.S);
          this.updateObjectiveUI();
        }
      });
    }

    getCurrentObjective() {
      const idx = this.S.objIdx || 0;
      if (idx < OBJECTIVES.length) return OBJECTIVES[idx];
      return endlessObjective(idx - OBJECTIVES.length);
    }

    updateObjectiveUI() {
      const obj = this.getCurrentObjective();
      if (!obj) { this.objBar.style.display = 'none'; return; }
      const [cur, target] = obj.p(this.S);
      const isReady = cur >= target;
      const pct = Math.min(100, Math.round((cur / target) * 100));
      const rwText = Object.entries(obj.rw).map(([k, v]) => `+${v} ${RES[k] ? RES[k].n : k}`).join(', ');

      this.objBar.innerHTML = `
        <div style="display:flex;align-items:center;gap:10px;width:100%">
          <div style="flex:1;min-width:0">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px">
              <span style="font-weight:700;color:#fff">${obj.t}</span>
              <span style="color:var(--mut);font-variant-numeric:tabular-nums">${Math.floor(cur)} / ${target}</span>
            </div>
            <div style="background:rgba(255,255,255,0.12);height:4px;border-radius:2px;overflow:hidden">
              <div style="background:${isReady ? '#ffb938' : '#5cc8ff'};height:100%;width:${pct}%"></div>
            </div>
          </div>
          ${isReady ? `<button class="btn btn-primary" style="padding:4px 12px;font-size:11px;flex:none">Claim (${rwText})</button>` : ''}
        </div>
      `;
    }

    toggleTab(tab) {
      if (this.curTab === tab) {
        this.curTab = null;
      } else {
        this.curTab = tab;
      }

      // Mark dock active
      document.querySelectorAll('#dock .d').forEach(b => {
        b.classList.toggle('active', b.dataset.t === this.curTab);
      });

      // Camera view transition
      if (this.curTab === 'city') {
        this.R.setViewMode('city');
      } else {
        this.R.setViewMode('orbit');
      }

      const ov = $('ov');
      if (!this.curTab) {
        ov.classList.remove('on');
        ov.innerHTML = '';
        if (this.combatRun) this.combatRun.active = false;
        return;
      }

      ov.classList.add('on');
      this.renderCurrentTab();
    }

    renderCurrentTab() {
      const ov = $('ov');
      ov.innerHTML = '';

      switch (this.curTab) {
        case 'city': this.renderCityTab(ov); break;
        case 'mining': this.renderMiningTab(ov); break;
        case 'galaxy': this.renderGalaxyTab(ov); break;
        case 'tree': this.renderTreeTab(ov); break;
        case 'fleet': this.renderFleetTab(ov); break;
        case 'xeno': this.renderXenoTab(ov); break;
      }
    }

    /* ---------------- 1. CAPITAL CITY TAB (ISOMETRIC DIORAMA) ---------------- */
    renderCityTab(ov) {
      const col = this.S.col[this.S.cur];
      if (!col) return;
      const cs = G.colonyStats(this.S, col);
      this.S.st.visitedCity = true;

      ov.innerHTML = `
        <div class="ov-header">
          <div>
            <h2>${cs.P.name} &bull; Capital City</h2>
            <div style="color:var(--mut);font-size:12px">Colony Headquarters &bull; Biome: ${cs.P.B.n}</div>
          </div>
          <button class="btn ov-close" type="button">Orbit View</button>
        </div>

        <!-- Demographics Holographic Bar -->
        <div class="holo-bar">
          <div class="holo-item">
            <span class="label">POPULATION</span>
            <span class="val">${Math.floor(col.pop)} <small>/ ${cs.housing}</small></span>
            <span class="sub" style="color:${cs.growth >= 0 ? '#7ef0c2' : '#ff7a7a'}">
              ${cs.growth >= 0 ? '+' : ''}${(cs.growth * 60).toFixed(1)} / min
            </span>
          </div>

          <div class="holo-item">
            <span class="label">MORALE & HAPPINESS</span>
            <span class="val" style="color:${cs.happy >= 80 ? '#7ef0c2' : cs.happy >= 50 ? '#ffb938' : '#ff7a7a'}">${cs.happy}%</span>
            <span class="sub">Production x${cs.morale.toFixed(2)}</span>
          </div>

          <div class="holo-item">
            <span class="label">FOOD RESERVES</span>
            <span class="val" style="color:${col.food > 0 ? '#a6e36b' : '#ff7a7a'}">${Math.floor(col.food)}</span>
            <span class="sub" style="color:${cs.foodNet >= 0 ? '#a6e36b' : '#ff7a7a'}">
              Net: ${fmtRate(cs.foodNet)}/s
            </span>
          </div>

          <div class="holo-item">
            <span class="label">WATER RESERVES</span>
            <span class="val" style="color:${col.water > 0 ? '#5cc8ff' : '#ff7a7a'}">${Math.floor(col.water)}</span>
            <span class="sub" style="color:${cs.waterNet >= 0 ? '#5cc8ff' : '#ff7a7a'}">
              Net: ${fmtRate(cs.waterNet)}/s ${cs.P.water === 0 ? '(Arid)' : ''}
            </span>
          </div>
        </div>

        <!-- City Hex Diorama Canvas Viewport -->
        <div class="diorama-viewport">
          <canvas id="city-canvas" width="700" height="420" style="width:100%;height:100%"></canvas>
          <div class="diorama-hint">Tap any hex tile to inspect, build, or upgrade</div>
        </div>

        <!-- Selected District Holographic Card -->
        <div id="district-drawer"></div>
      `;

      // Initialize Isometric City Diorama
      const canvas = $('city-canvas');
      this.cityDiorama = new G.CityDiorama(canvas, this.S, k => {
        this.selectedHex = k;
        this.updateDistrictDrawer();
      });

      // City render loop
      let lastTime = performance.now();
      const loopCity = () => {
        if (this.curTab !== 'city' || !this.cityDiorama) return;
        const now = performance.now();
        const dt = Math.min(0.1, (now - lastTime) / 1000);
        lastTime = now;
        this.cityDiorama.render(dt);
        requestAnimationFrame(loopCity);
      };
      loopCity();

      this.updateDistrictDrawer();
    }

    updateDistrictDrawer() {
      const drawer = $('district-drawer');
      if (!drawer) return;

      const col = this.S.col[this.S.cur];
      const F = G.features(this.S.cur);
      const k = this.selectedHex || '0,0';
      const isHQ = k === '0,0';
      const building = isHQ ? ['hq', col.hq] : col.tiles[k];
      const feat = F[k];
      const featInfo = G.FEATURE_INFO[feat] || G.FEATURE_INFO.plain;

      if (building) {
        // Existing Building Inspector
        const type = building[0];
        const lvl = building[1];
        const b = isHQ ? HQ : BUILD[type];
        const cost = isHQ ? G.costAt(HQ.c, HQ.g, lvl) : G.newBuildCost(col, type);
        const canAfford = G.can(this.S, cost);

        drawer.innerHTML = `
          <div class="district-card">
            <div style="display:flex;justify-content:space-between;align-items:flex-start">
              <div>
                <b style="font-size:18px;color:#fff">${b.n}</b>
                <span class="badge" style="margin-left:8px">Level ${lvl}</span>
                <small style="display:block;color:var(--mut);margin-top:4px">${b.d}</small>
                <div style="font-size:12px;color:#7ef0c2;margin-top:6px">${featInfo[0]} &bull; ${featInfo[1] || 'Standard terrain'}</div>
              </div>
              <button class="btn btn-primary" id="btn-up-district" ${canAfford ? '' : 'disabled'}>
                Upgrade (Lvl ${lvl + 1})<br>
                <small>${cost.map((x, i) => x ? `${x} ${RES[G.COST_KEYS[i]].n}` : '').filter(Boolean).join(', ')}</small>
              </button>
            </div>
          </div>
        `;

        $('btn-up-district')?.addEventListener('click', e => {
          if (canAfford) {
            G.pay(this.S, cost);
            if (isHQ) col.hq++;
            else col.tiles[k][1]++;
            if (G.Audio) G.Audio.build();
            this.pop(e.clientX, e.clientY, `${b.n} Upgraded`, '#ffb938');
            G.save(this.S);
            this.updateDistrictDrawer();
          }
        });
      } else {
        // Empty Plot Construction Menu
        let html = `
          <div class="district-card">
            <div style="margin-bottom:10px">
              <b>Plot (${k}) &mdash; ${featInfo[0]}</b>
              <small style="display:block;color:var(--mut)">${featInfo[1] || 'Construct a new district on this open ground.'}</small>
            </div>
            <div class="build-grid">
        `;

        BUILD_ORDER.forEach(type => {
          const b = BUILD[type];
          if (b.req && !this.S.tech[b.req]) return;
          const cost = G.newBuildCost(col, type);
          const canAfford = G.can(this.S, cost);

          html += `
            <button class="build-btn ${canAfford ? '' : 'no'}" data-bld="${type}" ${canAfford ? '' : 'disabled'}>
              <b>${b.n}</b>
              <small style="color:var(--mut);line-height:1.2">${b.d}</small>
              <span class="cost-pill">${cost.map((x, i) => x ? `${x} ${RES[G.COST_KEYS[i]].n.toLowerCase()}` : '').filter(Boolean).join(', ')}</span>
            </button>
          `;
        });

        html += `</div></div>`;
        drawer.innerHTML = html;

        drawer.addEventListener('click', e => {
          const btn = e.target.closest('[data-bld]');
          if (!btn || btn.disabled) return;
          const type = btn.dataset.bld;
          const cost = G.newBuildCost(col, type);
          if (G.can(this.S, cost)) {
            G.pay(this.S, cost);
            col.tiles[k] = [type, 1];
            if (G.Audio) G.Audio.build();
            this.pop(e.clientX, e.clientY, `${BUILD[type].n} Constructed`, '#7ef0c2');
            G.save(this.S);
            this.updateDistrictDrawer();
          }
        });
      }
    }

    /* ---------------- 2. PLANETARY MINES TAB ---------------- */
    renderMiningTab(ov) {
      const col = this.S.col[this.S.cur];
      const P = G.planet(this.S.cur);
      const cs = G.colonyStats(this.S, col);

      const costA = G.costAt(SITES.ore.c, SITES.ore.g, col.sites.a);
      const canA = G.can(this.S, costA);

      const costB = G.costAt(SITES.crystal.c, SITES.crystal.g, col.sites.b);
      const canB = G.can(this.S, costB);

      const costPump = G.costAt(SITES.water.c, SITES.water.g, col.sites.water || 0);
      const canPump = G.can(this.S, costPump);

      ov.innerHTML = `
        <div class="ov-header">
          <div>
            <h2>${P.name} &bull; Geological Mining Sites</h2>
            <div style="color:var(--mut);font-size:12px">Bedrock strata extraction facilities & regional aquifers</div>
          </div>
          <button class="btn ov-close" type="button">Orbit View</button>
        </div>

        <div class="mining-grid">
          <!-- Quarry Alpha -->
          <div class="mine-card">
            <div class="mine-strata" style="border-color:${RES.ore.c}">
              <div class="laser-beam" id="beam-a"></div>
              <div style="font-size:12px;color:var(--mut)">DEPOSIT ALPHA</div>
              <b style="font-size:20px;color:#fff">Quarry Rig &bull; Ore</b>
              <div style="font-size:13px;color:var(--acc);margin-top:2px">Grade: ${G.GRADES[P.deposits[0].g][0]} (x${G.GRADES[P.deposits[0].g][1]})</div>
              <div style="font-size:15px;font-weight:700;margin-top:8px">+${cs.siteOut.a.toFixed(1)} Ore / sec</div>
              <button class="btn btn-tap" id="tap-overcharge-a" style="margin-top:12px">Overcharge Drill (Tap)</button>
            </div>
            <button class="btn btn-primary" id="btn-up-mine-a" style="margin-top:14px;width:100%" ${canA ? '' : 'disabled'}>
              Upgrade Quarry (Lvl ${col.sites.a + 1})<br>
              <small>${costA.map((x, i) => x ? `${x} ${RES[G.COST_KEYS[i]].n}` : '').filter(Boolean).join(', ')}</small>
            </button>
          </div>

          <!-- Quarry Beta -->
          <div class="mine-card">
            <div class="mine-strata" style="border-color:${RES.crystal.c}">
              <div class="laser-beam" id="beam-b" style="background:#ff7eb6"></div>
              <div style="font-size:12px;color:var(--mut)">DEPOSIT BETA</div>
              <b style="font-size:20px;color:#fff">Crystal Resonance Rig</b>
              <div style="font-size:13px;color:#ff7eb6;margin-top:2px">Grade: ${G.GRADES[P.deposits[1].g][0]} (x${G.GRADES[P.deposits[1].g][1]})</div>
              <div style="font-size:15px;font-weight:700;margin-top:8px">+${cs.siteOut.b.toFixed(1)} Crystal / sec</div>
              <button class="btn btn-tap" id="tap-overcharge-b" style="margin-top:12px">Resonant Pulse (Tap)</button>
            </div>
            <button class="btn btn-primary" id="btn-up-mine-b" style="margin-top:14px;width:100%" ${canB ? '' : 'disabled'}>
              Upgrade Crystal Rig (Lvl ${col.sites.b + 1})<br>
              <small>${costB.map((x, i) => x ? `${x} ${RES[G.COST_KEYS[i]].n}` : '').filter(Boolean).join(', ')}</small>
            </button>
          </div>

          <!-- Aquifer Pump -->
          <div class="mine-card">
            <div class="mine-strata" style="border-color:${RES.water.c}">
              <div style="font-size:12px;color:var(--mut)">SUBTERRANEAN AQUIFER</div>
              <b style="font-size:20px;color:#fff">Hydro Pump Station</b>
              <div style="font-size:13px;color:#5cc8ff;margin-top:2px">
                ${P.water > 0 ? `Natural Table: ${Math.round(P.water * 33)}%` : 'Arid World (Dry Bedrock)'}
              </div>
              <div style="font-size:15px;font-weight:700;margin-top:8px">+${cs.siteOut.water.toFixed(1)} Water / sec</div>
            </div>
            <button class="btn btn-primary" id="btn-up-pump" style="margin-top:14px;width:100%" ${canPump && P.water > 0 ? '' : 'disabled'}>
              Upgrade Pump (Lvl ${(col.sites.water || 0) + 1})<br>
              <small>${P.water > 0 ? costPump.map((x, i) => x ? `${x} ${RES[G.COST_KEYS[i]].n}` : '').filter(Boolean).join(', ') : 'No Ground Water'}</small>
            </button>
          </div>
        </div>
      `;

      // Tap to overcharge
      $('tap-overcharge-a')?.addEventListener('click', e => {
        const bonus = Math.max(1, Math.round(3 * G.bonus(this.S, 'mine')));
        this.S.res.ore += bonus;
        if (G.Audio) G.Audio.tap(800);
        this.pop(e.clientX, e.clientY, `+${bonus} Ore`, RES.ore.c);
        this.updateHUD();
      });

      $('tap-overcharge-b')?.addEventListener('click', e => {
        const bonus = Math.max(1, Math.round(1 * G.bonus(this.S, 'crystal')));
        this.S.res.crystal += bonus;
        if (G.Audio) G.Audio.tap(950);
        this.pop(e.clientX, e.clientY, `+${bonus} Crystal`, RES.crystal.c);
        this.updateHUD();
      });

      $('btn-up-mine-a')?.addEventListener('click', e => {
        if (canA) {
          G.pay(this.S, costA);
          col.sites.a++;
          if (G.Audio) G.Audio.build();
          this.pop(e.clientX, e.clientY, 'Quarry Upgraded', '#ffb938');
          G.save(this.S);
          this.renderMiningTab(ov);
        }
      });

      $('btn-up-mine-b')?.addEventListener('click', e => {
        if (canB) {
          G.pay(this.S, costB);
          col.sites.b++;
          if (G.Audio) G.Audio.build();
          this.pop(e.clientX, e.clientY, 'Crystal Rig Upgraded', '#ff7eb6');
          G.save(this.S);
          this.renderMiningTab(ov);
        }
      });

      $('btn-up-pump')?.addEventListener('click', e => {
        if (canPump && P.water > 0) {
          G.pay(this.S, costPump);
          col.sites.water = (col.sites.water || 0) + 1;
          if (G.Audio) G.Audio.build();
          this.pop(e.clientX, e.clientY, 'Pump Upgraded', '#5cc8ff');
          G.save(this.S);
          this.renderMiningTab(ov);
        }
      });
    }

    /* ---------------- 3. GALAXY MAP TAB ---------------- */
    renderGalaxyTab(ov) {
      ov.innerHTML = `
        <div class="ov-header">
          <div>
            <h2>Spiral Galaxy Star Chart</h2>
            <div style="color:var(--mut);font-size:12px">420 Star Systems &bull; Drag to pan, scroll to zoom &bull; Scanner Radar Active</div>
          </div>
          <button class="btn ov-close" type="button">Orbit View</button>
        </div>

        <div class="galaxy-viewport">
          <canvas id="galaxy-canvas" width="800" height="460" style="width:100%;height:100%"></canvas>
          <div class="diorama-hint">Tap any star system to target and warp</div>
        </div>

        <div id="galaxy-drawer"></div>
      `;

      const canvas = $('galaxy-canvas');
      this.galaxyCanvas = new G.GalaxyCanvas(canvas, this.S, sys => {
        this.selectedSys = sys.i;
        this.updateGalaxyDrawer();
      });

      // Loop
      let lastTime = performance.now();
      const loopGalaxy = () => {
        if (this.curTab !== 'galaxy' || !this.galaxyCanvas) return;
        const now = performance.now();
        const dt = Math.min(0.1, (now - lastTime) / 1000);
        lastTime = now;
        this.galaxyCanvas.render(dt);
        requestAnimationFrame(loopGalaxy);
      };
      loopGalaxy();

      this.updateGalaxyDrawer();
    }

    updateGalaxyDrawer() {
      const drawer = $('galaxy-drawer');
      if (!drawer) return;

      const s = G.galaxy[this.selectedSys] || G.galaxy[0];
      const isHome = s.i === 0;

      let html = `
        <div class="district-card">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">
            <div>
              <b style="font-size:20px;color:#fff">${s.name}</b>
              <span class="badge" style="color:${s.star[0]};margin-left:8px">${s.star[1]}</span>
              <div style="color:var(--mut);font-size:12px;margin-top:4px">
                Distance: ${s.d.toFixed(1)} ly &bull; ${s.planets.length} worlds &bull; Threat Rating: ${isHome ? 'Safe' : 'Medium'}
              </div>
            </div>
          </div>

          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px">
      `;

      s.planets.forEach(pSeed => {
        const P = G.planet(pSeed);
        const isCur = pSeed === this.S.cur;
        const isCol = !!this.S.col[pSeed];

        html += `
          <div style="background:rgba(255,255,255,0.05);border-radius:12px;padding:10px;display:flex;flex-direction:column;justify-content:space-between">
            <div>
              <div style="display:flex;justify-content:space-between;align-items:center">
                <b>${P.name}</b>
                <span style="font-size:11px;color:${P.pal.atmo}">${P.B.n}</span>
              </div>
              <small style="color:var(--mut);display:block;margin-top:3px">
                Hab: ${P.hab}% &bull; Water: ${P.water > 0 ? 'Yes' : 'None'} &bull; Grav: ${P.gravity}G
              </small>
            </div>
            <div style="margin-top:10px">
              ${isCur ? '<span style="color:var(--acc);font-weight:700">Currently in Orbit</span>' :
                `<button class="btn btn-primary" data-warp="${pSeed}" style="width:100%;font-size:11px;padding:5px">
                  ${isCol ? 'Warp to Orbit' : 'Colonize World'}
                </button>`}
            </div>
          </div>
        `;
      });

      html += `</div></div>`;
      drawer.innerHTML = html;

      drawer.addEventListener('click', e => {
        const btn = e.target.closest('[data-warp]');
        if (!btn) return;
        const seed = +btn.dataset.warp;
        this.warpToWorld(seed);
      });
    }

    warpToWorld(seed) {
      if (!this.S.col[seed]) {
        // Found new colony
        this.S.col[seed] = G.newColony(seed, false);
      }
      this.S.cur = seed;
      this.toggleTab(null);
      this.R.warpJump(seed, () => {
        this.pop(innerWidth / 2, innerHeight / 2, `Arrived at ${G.planet(seed).name}`, '#ffb938');
        G.save(this.S);
      });
    }

    /* ---------------- 4. THE TOWER (RADIAL SKILL TREE) ---------------- */
    renderTreeTab(ov) {
      ov.innerHTML = `
        <div class="ov-header">
          <div>
            <h2>The Tower &mdash; Infinite Skill Mandala</h2>
            <div style="color:var(--mut);font-size:12px">5 Core Disciplines &bull; Drag to pan, scroll to zoom &bull; Outer Singularity Nodes</div>
          </div>
          <div style="display:flex;gap:10px">
            <button class="btn" id="btn-tree-recenter" type="button">Recenter</button>
            <button class="btn ov-close" type="button">Orbit View</button>
          </div>
        </div>

        <div class="tree-viewport">
          <canvas id="tree-canvas" width="800" height="460" style="width:100%;height:100%"></canvas>
          <div class="diorama-hint">Tap any node to inspect and research</div>
        </div>

        <div id="tree-drawer"></div>
      `;

      $('btn-tree-recenter')?.addEventListener('click', () => {
        if (this.treeCanvas) {
          this.treeCanvas.recenter();
          if (G.Audio) G.Audio.tap(600);
        }
      });

      const canvas = $('tree-canvas');
      this.treeCanvas = new G.SkillTreeCanvas(canvas, this.S, tId => {
        this.selectedTech = tId;
        this.updateTechDrawer();
      });

      // Loop
      let lastTime = performance.now();
      const loopTree = () => {
        if (this.curTab !== 'tree' || !this.treeCanvas) return;
        const now = performance.now();
        const dt = Math.min(0.1, (now - lastTime) / 1000);
        lastTime = now;
        this.treeCanvas.render(dt);
        requestAnimationFrame(loopTree);
      };
      loopTree();

      this.updateTechDrawer();
    }

    updateTechDrawer() {
      const drawer = $('tree-drawer');
      if (!drawer) return;

      const t = TECH_BY[this.selectedTech] || TECH_BY['core'];
      const curLvl = this.S.tech[t.id] || 0;
      const cost = G.techCost(t, curLvl);
      const dmCost = G.techDm(t, curLvl);
      const isMax = t.max > 0 && curLvl >= t.max;
      const canAfford = this.S.res.research >= cost && (this.S.res.dm || 0) >= dmCost;
      const reqMet = !t.req || t.req.length === 0 || t.req.every(rId => (this.S.tech[rId] || 0) > 0);

      const branch = G.BRANCHES[Math.floor(t.b)] || G.BRANCHES[0];

      drawer.innerHTML = `
        <div class="district-card">
          <div style="display:flex;justify-content:space-between;align-items:flex-start">
            <div>
              <div style="display:flex;align-items:center;gap:8px">
                <b style="font-size:20px;color:#fff">${t.n}</b>
                <span class="badge" style="color:${branch.c}">${branch.n}</span>
                <span class="badge">Lvl ${curLvl}${t.max ? `/${t.max}` : ' (\u221E)'}</span>
              </div>
              <small style="display:block;color:var(--mut);margin-top:6px">${t.d}</small>
            </div>

            <div>
              ${isMax ? '<span class="badge" style="color:#7ef0c2;padding:8px 14px;font-size:13px">MAX LEVEL REACHED</span>' :
                `<button class="btn btn-primary" id="btn-up-tech" ${reqMet && canAfford ? '' : 'disabled'}>
                  Research Upgrade<br>
                  <small>${cost} Research ${dmCost ? `+ ${dmCost} DM` : ''}</small>
                </button>`}
            </div>
          </div>
        </div>
      `;

      $('btn-up-tech')?.addEventListener('click', e => {
        if (reqMet && canAfford && !isMax) {
          this.S.res.research -= cost;
          if (dmCost) this.S.res.dm -= dmCost;
          this.S.tech[t.id] = curLvl + 1;
          if (G.Audio) G.Audio.research();
          this.pop(e.clientX, e.clientY, `${t.n} Researched`, '#7ef0c2');
          G.save(this.S);
          this.updateTechDrawer();
        }
      });
    }

    /* ---------------- 5. ARMADA WORKSHOP & DEFENSE TAB ---------------- */
    renderFleetTab(ov) {
      ov.innerHTML = `
        <div class="ov-header">
          <div>
            <h2>Sector Defense & Flagship Armory</h2>
            <div style="color:var(--mut);font-size:12px">Endless Tactical Wave Combat &bull; Earn Dark Matter &bull; Upgrade Flagship</div>
          </div>
          <button class="btn ov-close" type="button">Orbit View</button>
        </div>

        <div class="combat-viewport">
          <canvas id="combat-canvas" width="700" height="340" style="width:100%;height:100%"></canvas>
          <div class="combat-hud">
            WAVE <b id="cb-wave" style="font-size:20px;color:#fff">1</b> &bull; RECORD: <b>${this.S.st.bestWave || 0}</b>
          </div>
          <div class="combat-controls">
            <button class="btn" id="cb-missile">Missile Swarm</button>
            <button class="btn" id="cb-shield">Shield Overcharge</button>
            <button class="btn" id="cb-emp">EMP Shockwave</button>
          </div>
        </div>

        <h3 style="margin:16px 0 10px;font-size:16px;color:#fff">Permanent Flagship Upgrades</h3>
        <div class="module-grid">
          ${MODULES.map(m => {
            const curLvl = this.S.ship[m.id] || 0;
            const cost = G.costAt([m.ore || 30, 0, 0], m.g, curLvl);
            const dmCost = Math.round(m.c * Math.pow(m.g, curLvl));
            const canAfford = this.S.res.ore >= cost[0] && (this.S.res.dm || 0) >= dmCost;

            return `
              <div class="district-card" style="padding:12px">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
                  <b>${m.n}</b>
                  <span class="badge">Lvl ${curLvl}</span>
                </div>
                <small style="color:var(--mut);display:block;margin-bottom:8px">${m.d} &bull; ${m.fx(curLvl)}</small>
                <button class="btn btn-primary" data-ship="${m.id}" style="width:100%;font-size:11px" ${canAfford ? '' : 'disabled'}>
                  Upgrade (${cost[0]} Ore + ${dmCost} DM)
                </button>
              </div>
            `;
          }).join('')}
        </div>
      `;

      const canvas = $('combat-canvas');
      const ctx = canvas.getContext('2d');
      this.combatRun = new G.CombatRun(this.S, (wave, dm) => {
        this.pop(innerWidth / 2, innerHeight / 2, `Combat Ended at Wave ${wave}`, '#ff7a7a');
      });

      const loopCombat = () => {
        if (!this.combatRun || !this.combatRun.active || this.curTab !== 'fleet') return;
        this.combatRun.update(0.016);
        this.combatRun.render(ctx, canvas.width, canvas.height);
        $('cb-wave').textContent = this.combatRun.wave;
        requestAnimationFrame(loopCombat);
      };
      loopCombat();

      $('cb-missile')?.addEventListener('click', () => this.combatRun.triggerMissiles());
      $('cb-shield')?.addEventListener('click', () => this.combatRun.triggerShieldOvercharge());
      $('cb-emp')?.addEventListener('click', () => this.combatRun.triggerEmp());

      ov.addEventListener('click', e => {
        const btn = e.target.closest('[data-ship]');
        if (!btn || btn.disabled) return;
        const mId = btn.dataset.ship;
        const m = MODULES.find(x => x.id === mId);
        const curLvl = this.S.ship[mId] || 0;
        const cost = G.costAt([m.ore || 30, 0, 0], m.g, curLvl);
        const dmCost = Math.round(m.c * Math.pow(m.g, curLvl));

        if (this.S.res.ore >= cost[0] && (this.S.res.dm || 0) >= dmCost) {
          this.S.res.ore -= cost[0];
          this.S.res.dm -= dmCost;
          this.S.ship[mId] = curLvl + 1;
          if (G.Audio) G.Audio.build();
          this.pop(e.clientX, e.clientY, `${m.n} Upgraded`, '#ffb938');
          G.save(this.S);
          this.renderFleetTab(ov);
        }
      });
    }

    /* ---------------- 6. XENODEX TAB (PROCEDURAL CREATURE DRAWING) ---------------- */
    renderXenoTab(ov) {
      const P = G.planet(this.S.cur);

      ov.innerHTML = `
        <div class="ov-header">
          <div>
            <h2>${P.name} &bull; Indigenous Alien Ecology</h2>
            <div style="color:var(--mut);font-size:12px">Scan alien specimens to unlock permanent empire-wide bonuses</div>
          </div>
          <button class="btn ov-close" type="button">Orbit View</button>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px">
          ${P.species.map(sp => {
            const isCat = !!this.S.dex[sp.id];
            return `
              <div class="district-card" style="border-color:${sp.glow}44">
                <div style="height:120px;background:rgba(0,0,0,0.3);border-radius:10px;margin-bottom:10px;position:relative;overflow:hidden">
                  <canvas id="creature-${sp.idx}" width="280" height="120" style="width:100%;height:100%"></canvas>
                </div>

                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
                  <b style="color:#fff;font-size:17px">${sp.name}</b>
                  <span class="badge" style="color:${sp.glow}">${sp.behav}</span>
                </div>
                <div style="font-size:12px;color:var(--mut);margin-bottom:4px">Diet: ${sp.diet} &bull; HP: ${sp.hp}</div>
                <div style="font-size:13px;color:#7ef0c2;font-weight:600;margin-bottom:12px">
                  Permanent Bonus: +${Math.round(sp.bonus.v * 100)}% ${sp.bonus.label}
                </div>

                <button class="btn btn-primary" data-scan="${sp.id}" style="width:100%" ${isCat ? 'disabled' : ''}>
                  ${isCat ? 'Catalogued in Xenodex' : 'Scan Specimen (+35 Research)'}
                </button>
              </div>
            `;
          }).join('')}
        </div>
      `;

      // Render procedural creature visuals
      P.species.forEach(sp => {
        const c = $(`creature-${sp.idx}`);
        if (!c) return;
        const ctx = c.getContext('2d');
        const cx = 140, cy = 60;

        // Procedural creature drawing based on anatomy
        ctx.fillStyle = sp.body;
        ctx.strokeStyle = sp.glow;
        ctx.lineWidth = 2;

        if (sp.plan === 'blob') {
          ctx.beginPath();
          ctx.arc(cx, cy, 26 * sp.size, 0, Math.PI * 2);
          ctx.fill(); ctx.stroke();
        } else if (sp.plan === 'manta') {
          ctx.beginPath();
          ctx.ellipse(cx, cy, 38 * sp.size, 16 * sp.size, 0, 0, Math.PI * 2);
          ctx.fill(); ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.roundRect ? ctx.roundRect(cx - 25, cy - 18, 50, 36, 12) : ctx.rect(cx - 25, cy - 18, 50, 36);
          ctx.fill(); ctx.stroke();
        }

        // Eyes
        ctx.fillStyle = sp.glow;
        for (let i = 0; i < sp.eyes; i++) {
          ctx.beginPath();
          ctx.arc(cx - 10 + i * 8, cy - 4, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      ov.addEventListener('click', e => {
        const btn = e.target.closest('[data-scan]');
        if (!btn || btn.disabled) return;
        const spId = btn.dataset.scan;
        this.S.dex[spId] = { count: 1 };
        this.S.res.research += 35;
        if (G.Audio) G.Audio.scan();
        this.pop(e.clientX, e.clientY, '+35 Research & Bonus Unlocked', '#7ef0c2');
        G.save(this.S);
        this.renderXenoTab(ov);
      });
    }

    updateHUD() {
      const rates = G.rates(this.S);

      $('v-ore').textContent = fmt(this.S.res.ore);
      $('r-ore').textContent = fmtRate(rates.ore) + '/s';

      $('v-energy').textContent = fmt(this.S.res.energy);
      $('r-energy').textContent = fmtRate(rates.energy) + '/s';

      $('v-crystal').textContent = fmt(this.S.res.crystal);
      $('r-crystal').textContent = fmtRate(rates.crystal) + '/s';

      $('v-res').textContent = fmt(this.S.res.research);
      $('r-res').textContent = fmtRate(rates.research) + '/s';

      $('v-dm').textContent = fmt(this.S.res.dm || 0);

      this.updateObjectiveUI();
    }

    pop(x, y, text, color = '#ffb938') {
      const e = document.createElement('div');
      e.className = 'pop';
      e.textContent = text;
      e.style.cssText = `left:${x}px;top:${y}px;color:${color}`;
      document.body.appendChild(e);
      setTimeout(() => e.remove(), 1000);
    }
  }

  G.UIController = UIController;
})(typeof window !== 'undefined' ? window.G : globalThis.G);
