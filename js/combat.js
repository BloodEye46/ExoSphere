/* ExoSphere Sector Defense: AAA Tactical Wave Combat with Thrusters, Shields, Laser Beams, & Dark Matter Orbs */
'use strict';
(function (G) {
  const { clamp, techBonus } = G;

  class CombatRun {
    constructor(S, onEnd) {
      this.S = S;
      this.onEnd = onEnd;
      this.wave = 1;
      this.waveTimer = 0;
      this.enemies = [];
      this.lasers = [];
      this.missiles = [];
      this.particles = [];
      this.pops = [];
      this.dmOrbs = [];
      this.stars = [];

      // Background stars
      for (let i = 0; i < 60; i++) {
        this.stars.push({
          x: Math.random() * 800,
          y: Math.random() * 400,
          speed: 15 + Math.random() * 40,
          size: Math.random() * 1.8 + 0.5
        });
      }

      // Flagship stats derived from ship modules & tech
      const ship = S.ship;
      const dmgMul = techBonus(S, 'dmg') * (1 + (ship.laser || 0) * 0.18);
      const hpMul = techBonus(S, 'hp') * (1 + (ship.hull || 0) * 0.20);
      const shieldMul = techBonus(S, 'shield') * (1 + (ship.shield || 0) * 0.20);
      const rateMul = techBonus(S, 'rate') * (1 + (ship.rate || 0) * 0.06);

      this.maxHp = Math.round(160 * hpMul);
      this.hp = this.maxHp;
      this.maxShield = Math.round(110 * shieldMul);
      this.shield = this.maxShield;
      this.dps = 26 * dmgMul;
      this.fireRate = 2.4 * rateMul; // shots per sec
      this.fireTimer = 0;
      this.critChance = 0.05 + (ship.crit || 0) * 0.02;
      this.regenRate = (ship.repair || 0) * 0.55;
      this.missileDmg = 90 * (1 + (ship.missile || 0) * 0.25);
      this.missileCooldown = 0;
      this.shieldOverchargeCooldown = 0;
      this.empCooldown = 0;

      this.shieldHitAnim = 0;
      this.active = true;
      this.totalDmEarned = 0;
      this.spawnWave(this.wave);
    }

    spawnWave(w) {
      this.wave = w;
      this.enemies = [];
      const isBossWave = w % 5 === 0;
      const count = isBossWave ? 1 + Math.floor(w * 0.4) : 4 + Math.floor(w * 0.7);
      const baseHp = 40 * Math.pow(1.13, w);
      const baseDmg = 5 * Math.pow(1.07, w);

      for (let i = 0; i < count; i++) {
        const isBoss = isBossWave && i === 0;
        const hp = baseHp * (isBoss ? 4.8 : (0.7 + Math.random() * 0.5));
        const dmg = baseDmg * (isBoss ? 2.2 : 1.0);

        this.enemies.push({
          id: i,
          x: 650 + i * 55 + Math.random() * 50,
          y: isBoss ? 160 : (60 + Math.random() * 200),
          targetY: 60 + Math.random() * 200,
          hp: hp,
          maxHp: hp,
          dmg: dmg,
          speed: isBoss ? 16 : (28 + Math.random() * 18),
          boss: isBoss,
          size: isBoss ? 26 : 12,
          color: isBoss ? '#ff3864' : '#ff7a7a',
          fireTimer: Math.random() * 1.5,
          stunTimer: 0
        });
      }
    }

    triggerMissiles() {
      if (this.missileCooldown > 0) return false;
      this.missileCooldown = 8.0;

      // Launch micro-missiles
      this.enemies.forEach(e => {
        for (let i = 0; i < 2; i++) {
          this.missiles.push({
            x: 80,
            y: 160 + (i === 0 ? -12 : 12),
            vx: 120 + Math.random() * 50,
            vy: (Math.random() - 0.5) * 140,
            target: e,
            life: 2.5
          });
        }
      });
      if (G.Audio) G.Audio.laser();
      return true;
    }

    triggerShieldOvercharge() {
      if (this.shieldOverchargeCooldown > 0) return false;
      this.shieldOverchargeCooldown = 12.0;
      this.shield = this.maxShield;
      this.shieldHitAnim = 1.0;
      this.addPop(75, 140, 'SHIELD RESTORED', '#5cc8ff');
      if (G.Audio) G.Audio.tap(900);
      return true;
    }

    triggerEmp() {
      if (this.empCooldown > 0) return false;
      this.empCooldown = 15.0;

      // Stun and damage all enemies
      this.enemies.forEach(e => {
        e.stunTimer = 3.0;
        e.hp -= this.dps * 1.8;
        this.addPop(e.x, e.y, 'EMP STUN', '#b18cff');
        this.addExplosion(e.x, e.y, '#b18cff', 16);
      });
      if (G.Audio) G.Audio.explosion();
      return true;
    }

    addPop(x, y, text, color = '#ffb938') {
      this.pops.push({ x, y, text, color, life: 0.9 });
    }

    addExplosion(x, y, color = '#ff7a7a', count = 10) {
      for (let i = 0; i < count; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 40 + Math.random() * 90;
        this.particles.push({
          x, y,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          color,
          life: 0.5 + Math.random() * 0.4,
          maxLife: 0.9,
          size: 1.5 + Math.random() * 2.5
        });
      }
    }

    update(dt) {
      if (!this.active) return;

      // Cooldowns
      if (this.missileCooldown > 0) this.missileCooldown -= dt;
      if (this.shieldOverchargeCooldown > 0) this.shieldOverchargeCooldown -= dt;
      if (this.empCooldown > 0) this.empCooldown -= dt;
      if (this.shieldHitAnim > 0) this.shieldHitAnim -= dt * 2;

      // Flagship Regeneration
      if (this.regenRate > 0 && this.hp < this.maxHp) {
        this.hp = Math.min(this.maxHp, this.hp + this.regenRate * dt);
      }
      if (this.shield < this.maxShield) {
        this.shield = Math.min(this.maxShield, this.shield + (this.maxShield * 0.08) * dt);
      }

      // Background Star Scroll
      this.stars.forEach(s => {
        s.x -= s.speed * dt;
        if (s.x < 0) {
          s.x = 800;
          s.y = Math.random() * 320;
        }
      });

      // Flagship Primary Weapon Auto-Firing
      this.fireTimer += dt;
      if (this.fireTimer >= 1 / this.fireRate && this.enemies.length > 0) {
        this.fireTimer = 0;
        const target = this.enemies[0];
        const isCrit = Math.random() < this.critChance;
        const dmg = (this.dps / this.fireRate) * (isCrit ? 2.2 : 1.0);

        this.lasers.push({
          x1: 95, y1: 154,
          x2: target.x, y2: target.y,
          color: isCrit ? '#ffb938' : '#5cc8ff',
          life: 0.12
        });
        this.lasers.push({
          x1: 95, y1: 166,
          x2: target.x, y2: target.y,
          color: isCrit ? '#ffb938' : '#5cc8ff',
          life: 0.12
        });

        target.hp -= dmg;
        this.addPop(target.x, target.y - 12, Math.round(dmg), isCrit ? '#ffb938' : '#fff');
        this.addExplosion(target.x, target.y, isCrit ? '#ffb938' : '#5cc8ff', 4);
        if (G.Audio) G.Audio.laser();
      }

      // Update Lasers
      for (let i = this.lasers.length - 1; i >= 0; i--) {
        this.lasers[i].life -= dt;
        if (this.lasers[i].life <= 0) this.lasers.splice(i, 1);
      }

      // Update Guided Missiles
      for (let i = this.missiles.length - 1; i >= 0; i--) {
        const m = this.missiles[i];
        m.life -= dt;

        if (m.target && m.target.hp > 0) {
          const dx = m.target.x - m.x;
          const dy = m.target.y - m.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 15) {
            // Impact
            const dmg = this.missileDmg * (0.8 + Math.random() * 0.4);
            m.target.hp -= dmg;
            this.addPop(m.target.x, m.target.y, Math.round(dmg), '#ffb938');
            this.addExplosion(m.x, m.y, '#ffd23f', 12);
            if (G.Audio) G.Audio.explosion();
            this.missiles.splice(i, 1);
            continue;
          }
          m.vx += (dx / dist) * 350 * dt;
          m.vy += (dy / dist) * 350 * dt;
        }

        m.x += m.vx * dt;
        m.y += m.vy * dt;

        // Smoke particles behind missile
        if (Math.random() < 0.6) {
          this.particles.push({
            x: m.x, y: m.y,
            vx: -m.vx * 0.1, vy: -m.vy * 0.1,
            color: 'rgba(255, 185, 56, 0.5)',
            life: 0.25, maxLife: 0.25, size: 2
          });
        }

        if (m.life <= 0) this.missiles.splice(i, 1);
      }

      // Update Enemies
      for (let i = this.enemies.length - 1; i >= 0; i--) {
        const e = this.enemies[i];

        // Stun effect
        if (e.stunTimer > 0) {
          e.stunTimer -= dt;
          continue;
        }

        // Enemy movement
        e.x -= e.speed * dt;
        e.y += Math.sin(e.x * 0.05) * 15 * dt;

        // Enemy firing at Flagship
        e.fireTimer -= dt;
        if (e.fireTimer <= 0 && e.x > 110) {
          e.fireTimer = 1.4 + Math.random() * 0.8;
          // Damage flagship
          const dmg = e.dmg;
          if (this.shield > 0) {
            this.shield = Math.max(0, this.shield - dmg);
            this.shieldHitAnim = 0.5;
            this.addPop(80, 160, `-${Math.round(dmg)}`, '#5cc8ff');
          } else {
            this.hp = Math.max(0, this.hp - dmg);
            this.addPop(75, 160, `-${Math.round(dmg)}`, '#ff7a7a');
          }
        }

        // Enemy Death
        if (e.hp <= 0) {
          this.addExplosion(e.x, e.y, e.color, e.boss ? 30 : 16);
          if (G.Audio) G.Audio.explosion();

          // Spawn Dark Matter Orbs
          const dmCount = e.boss ? (4 + Math.floor(this.wave * 0.5)) : 1;
          for (let d = 0; d < dmCount; d++) {
            this.dmOrbs.push({
              x: e.x + (Math.random() - 0.5) * 20,
              y: e.y + (Math.random() - 0.5) * 20,
              vx: (Math.random() - 0.5) * 80,
              vy: (Math.random() - 0.5) * 80,
              life: 2.0
            });
          }

          this.enemies.splice(i, 1);
        }
      }

      // Update Dark Matter Orbs (Magnetizing to Flagship)
      for (let i = this.dmOrbs.length - 1; i >= 0; i--) {
        const orb = this.dmOrbs[i];
        const dx = 75 - orb.x;
        const dy = 160 - orb.y;
        const dist = Math.hypot(dx, dy);

        if (dist < 22) {
          // Collected!
          this.S.res.dm = (this.S.res.dm || 0) + 1;
          this.totalDmEarned++;
          this.addPop(75, 140, '+1 Dark Matter', '#b18cff');
          if (G.Audio) G.Audio.darkMatter();
          this.dmOrbs.splice(i, 1);
          continue;
        }

        // Strong magnetic pull
        orb.vx += (dx / dist) * 450 * dt;
        orb.vy += (dy / dist) * 450 * dt;
        orb.x += orb.vx * dt;
        orb.y += orb.vy * dt;
      }

      // Check Wave Victory
      if (this.enemies.length === 0) {
        this.spawnWave(this.wave + 1);
        this.addPop(300, 150, `WAVE ${this.wave} INCOMING!`, '#ffb938');
        this.S.st.bestWave = Math.max(this.S.st.bestWave || 0, this.wave);
      }

      // Check Flagship Defeat
      if (this.hp <= 0) {
        this.active = false;
        if (this.onEnd) this.onEnd(this.wave, this.totalDmEarned);
      }

      // Update Particles
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.life -= dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.life <= 0) this.particles.splice(i, 1);
      }

      // Update Floating Popups
      for (let i = this.pops.length - 1; i >= 0; i--) {
        const pop = this.pops[i];
        pop.life -= dt;
        pop.y -= 25 * dt;
        if (pop.life <= 0) this.pops.splice(i, 1);
      }
    }

    render(ctx, w, h) {
      ctx.clearRect(0, 0, w, h);

      // 1. Cosmic Deep Space Background
      ctx.fillStyle = '#02040b';
      ctx.fillRect(0, 0, w, h);

      // Starfield
      this.stars.forEach(s => {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.fillRect(s.x, s.y, s.size, s.size);
      });

      // 2. Flagship Hero Ship (at x: 75, y: 160)
      const fx = 75, fy = 160;

      // Engine Thruster Exhaust Flames
      const flLen = 14 + Math.random() * 12;
      ctx.fillStyle = '#ffb938';
      ctx.beginPath();
      ctx.moveTo(fx - 24, fy - 6);
      ctx.lineTo(fx - 24 - flLen, fy - 6);
      ctx.lineTo(fx - 24, fy - 2);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(fx - 24, fy + 2);
      ctx.lineTo(fx - 24 - flLen, fy + 6);
      ctx.lineTo(fx - 24, fy + 6);
      ctx.closePath();
      ctx.fill();

      // Flagship Hull
      ctx.fillStyle = '#e8e5dc'; // Cream armored hull
      ctx.beginPath();
      ctx.moveTo(fx + 28, fy);
      ctx.lineTo(fx - 22, fy - 18);
      ctx.lineTo(fx - 14, fy);
      ctx.lineTo(fx - 22, fy + 18);
      ctx.closePath();
      ctx.fill();

      // Slate Armor Wings
      ctx.fillStyle = '#2a3150';
      ctx.fillRect(fx - 18, fy - 12, 14, 5);
      ctx.fillRect(fx - 18, fy + 7, 14, 5);

      // Cyan Cockpit
      ctx.fillStyle = '#5cc8ff';
      ctx.beginPath();
      ctx.arc(fx + 6, fy, 4, 0, Math.PI * 2);
      ctx.fill();

      // Shield Energy Barrier Bubble
      if (this.shield > 0 || this.shieldHitAnim > 0) {
        ctx.strokeStyle = `rgba(92, 200, 255, ${0.4 + this.shieldHitAnim * 0.6})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(fx + 2, fy, 38, 28, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      // 3. Render Lasers
      this.lasers.forEach(l => {
        ctx.strokeStyle = l.color;
        ctx.lineWidth = 2.5;
        ctx.shadowColor = l.color;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(l.x1, l.y1);
        ctx.lineTo(l.x2, l.y2);
        ctx.stroke();
        ctx.shadowBlur = 0;
      });

      // 4. Render Guided Missiles
      this.missiles.forEach(m => {
        ctx.fillStyle = '#ffb938';
        ctx.beginPath();
        ctx.arc(m.x, m.y, 3, 0, Math.PI * 2);
        ctx.fill();
      });

      // 5. Render Enemies
      this.enemies.forEach(e => {
        const isStunned = e.stunTimer > 0;
        ctx.fillStyle = isStunned ? '#b18cff' : e.color;

        if (e.boss) {
          // Boss Dreadnought
          ctx.beginPath();
          ctx.moveTo(e.x - e.size, e.y);
          ctx.lineTo(e.x + e.size, e.y - e.size);
          ctx.lineTo(e.x + e.size * 0.5, e.y);
          ctx.lineTo(e.x + e.size, e.y + e.size);
          ctx.closePath();
          ctx.fill();

          // Glowing Boss Core
          ctx.fillStyle = '#fff';
          ctx.beginPath();
          ctx.arc(e.x, e.y, 6, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Scout / Frigate
          ctx.beginPath();
          ctx.moveTo(e.x - e.size, e.y);
          ctx.lineTo(e.x + e.size * 0.7, e.y - e.size * 0.7);
          ctx.lineTo(e.x + e.size * 0.7, e.y + e.size * 0.7);
          ctx.closePath();
          ctx.fill();
        }

        // Enemy Health Bar
        const barW = e.size * 2;
        const hpPct = clamp(e.hp / e.maxHp, 0, 1);
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(e.x - barW / 2, e.y - e.size - 8, barW, 3.5);
        ctx.fillStyle = e.boss ? '#ff3864' : '#7ef0c2';
        ctx.fillRect(e.x - barW / 2, e.y - e.size - 8, barW * hpPct, 3.5);
      });

      // 6. Render Dark Matter Orbs
      this.dmOrbs.forEach(orb => {
        ctx.fillStyle = '#b18cff';
        ctx.shadowColor = '#b18cff';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(orb.x, orb.y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      // 7. Render Particles
      this.particles.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      });

      // 8. Render Floating Combat Text
      this.pops.forEach(pop => {
        ctx.fillStyle = pop.color;
        ctx.font = '700 12px Fredoka';
        ctx.textAlign = 'center';
        ctx.fillText(pop.text, pop.x, pop.y);
      });

      // 9. Flagship HP & Shield HUD Gauges
      ctx.fillStyle = 'rgba(10, 14, 38, 0.8)';
      ctx.fillRect(14, 14, 180, 24);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.strokeRect(14, 14, 180, 24);

      // Shield Gauge
      const sPct = clamp(this.shield / this.maxShield, 0, 1);
      ctx.fillStyle = '#5cc8ff';
      ctx.fillRect(16, 16, 176 * sPct, 8);

      // HP Gauge
      const hPct = clamp(this.hp / this.maxHp, 0, 1);
      ctx.fillStyle = '#7ef0c2';
      ctx.fillRect(16, 26, 176 * hPct, 10);
    }
  }

  G.CombatRun = CombatRun;
})(typeof window !== 'undefined' ? window.G : globalThis.G);
