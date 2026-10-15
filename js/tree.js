/* ExoSphere Skill Tree ("The Tower"): Interactive AAA Radial Tech Graph Canvas */
'use strict';
(function (G) {
  const { TECH, TECH_BY, BRANCHES, techCost, techDm } = G;

  class SkillTreeCanvas {
    constructor(canvas, S, onResearch) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.S = S;
      this.onResearch = onResearch;

      // Pan & Zoom state
      this.panX = 0;
      this.panY = 0;
      this.zoom = 0.95;
      this.minZoom = 0.45;
      this.maxZoom = 2.2;

      this.selectedNode = 'core';
      this.hoverNode = null;
      this.isDragging = false;
      this.startX = 0;
      this.startY = 0;
      this.hasMoved = false;

      // Pre-calculate node positions in polar/cartesian graph space
      this.nodePos = {};
      this.calculateNodePositions();

      this.animTime = 0;
      this.pulses = [];
      this.bindInput();
    }

    calculateNodePositions() {
      const ringRadius = 78;
      const angleStep = (Math.PI * 2) / 5; // 5 branches

      TECH.forEach(t => {
        if (t.id === 'core') {
          this.nodePos[t.id] = { x: 0, y: 0, r: 24, branchColor: '#ffb938' };
          return;
        }

        // Branch angle: b=0 is Industry (pointing up-ish), 1 Society, 2 Logistics, 3 Military, 4 Science
        const baseAngle = t.b * angleStep - Math.PI / 2;
        const ang = baseAngle + (t.o || 0) * 0.17;
        const dist = t.r * ringRadius;

        const x = Math.cos(ang) * dist;
        const y = Math.sin(ang) * dist;

        const branch = BRANCHES[Math.floor(t.b)] || BRANCHES[0];
        const isSingularity = t.max === 0;

        this.nodePos[t.id] = {
          x,
          y,
          r: isSingularity ? 22 : 17,
          branchColor: branch.c,
          isSingularity
        };
      });
    }

    worldToScreen(wx, wy) {
      const cx = this.canvas.width / 2;
      const cy = this.canvas.height / 2;
      return {
        x: cx + this.panX + wx * this.zoom,
        y: cy + this.panY + wy * this.zoom
      };
    }

    screenToWorld(sx, sy) {
      const cx = this.canvas.width / 2;
      const cy = this.canvas.height / 2;
      return {
        x: (sx - cx - this.panX) / this.zoom,
        y: (sy - cy - this.panY) / this.zoom
      };
    }

    bindInput() {
      const getPos = e => {
        const rect = this.canvas.getBoundingClientRect();
        return {
          x: (e.clientX - rect.left) * (this.canvas.width / rect.width),
          y: (e.clientY - rect.top) * (this.canvas.height / rect.height)
        };
      };

      this.canvas.addEventListener('pointerdown', e => {
        this.isDragging = true;
        this.hasMoved = false;
        const p = getPos(e);
        this.startX = p.x - this.panX;
        this.startY = p.y - this.panY;
        this.canvas.setPointerCapture(e.pointerId);
      });

      this.canvas.addEventListener('pointermove', e => {
        const p = getPos(e);
        if (this.isDragging) {
          const dx = p.x - (this.startX + this.panX);
          const dy = p.y - (this.startY + this.panY);
          if (Math.hypot(dx, dy) > 4) this.hasMoved = true;
          this.panX = p.x - this.startX;
          this.panY = p.y - this.startY;
        } else {
          // Hover check
          const wp = this.screenToWorld(p.x, p.y);
          let found = null;
          for (const t of TECH) {
            const pos = this.nodePos[t.id];
            if (pos && Math.hypot(wp.x - pos.x, wp.y - pos.y) <= pos.r + 4) {
              found = t.id;
              break;
            }
          }
          if (this.hoverNode !== found) {
            this.hoverNode = found;
            this.canvas.style.cursor = found ? 'pointer' : 'grab';
          }
        }
      });

      const end = e => {
        if (!this.isDragging) return;
        this.isDragging = false;
        if (!this.hasMoved) {
          const p = getPos(e);
          const wp = this.screenToWorld(p.x, p.y);
          for (const t of TECH) {
            const pos = this.nodePos[t.id];
            if (pos && Math.hypot(wp.x - pos.x, wp.y - pos.y) <= pos.r + 4) {
              this.selectedNode = t.id;
              if (G.Audio) G.Audio.tap(720);
              if (this.onResearch) this.onResearch(t.id);
              break;
            }
          }
        }
      };

      this.canvas.addEventListener('pointerup', end);
      this.canvas.addEventListener('pointercancel', end);

      this.canvas.addEventListener('wheel', e => {
        e.preventDefault();
        const p = getPos(e);
        const factor = e.deltaY < 0 ? 1.12 : 0.89;
        const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom * factor));

        // Zoom towards mouse
        const wp = this.screenToWorld(p.x, p.y);
        this.zoom = newZoom;
        const newSp = this.worldToScreen(wp.x, wp.y);
        this.panX += p.x - newSp.x;
        this.panY += p.y - newSp.y;
      }, { passive: false });
    }

    recenter() {
      this.panX = 0;
      this.panY = 0;
      this.zoom = 0.95;
    }

    isUnlocked(id) {
      return (this.S.tech[id] || 0) > 0;
    }

    isAvailable(t) {
      if (this.isUnlocked(t.id)) return true;
      if (!t.req || t.req.length === 0) return true;
      return t.req.every(reqId => (this.S.tech[reqId] || 0) > 0);
    }

    render(dt) {
      this.animTime += dt;
      const ctx = this.ctx;
      const w = this.canvas.width;
      const h = this.canvas.height;

      ctx.clearRect(0, 0, w, h);

      // 1. Cosmic Holographic Grid Background
      ctx.save();
      const origin = this.worldToScreen(0, 0);

      // Concentric Tier Rings
      for (let r = 1; r <= 6; r++) {
        const rad = r * 78 * this.zoom;
        ctx.strokeStyle = r === 6 ? 'rgba(177, 140, 255, 0.22)' : 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = r === 6 ? 1.5 : 1;
        ctx.setLineDash(r === 6 ? [6, 6] : [3, 8]);
        ctx.beginPath();
        ctx.arc(origin.x, origin.y, rad, 0, Math.PI * 2);
        ctx.stroke();

        // Tier Labels
        ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
        ctx.font = '600 10px Fredoka';
        ctx.textAlign = 'center';
        ctx.fillText(`TIER ${r}${r === 6 ? ' (SINGULARITY)' : ''}`, origin.x, origin.y - rad - 4);
      }
      ctx.setLineDash([]);

      // 5 Branch Radial Spine Rays
      const angleStep = (Math.PI * 2) / 5;
      BRANCHES.forEach((b, idx) => {
        const ang = idx * angleStep - Math.PI / 2;
        const maxDist = 6 * 78 * this.zoom;
        const tx = origin.x + Math.cos(ang) * maxDist;
        const ty = origin.y + Math.sin(ang) * maxDist;

        ctx.strokeStyle = `${b.c}20`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(origin.x, origin.y);
        ctx.lineTo(tx, ty);
        ctx.stroke();

        // Branch Label at outer rim
        ctx.fillStyle = b.c;
        ctx.font = '700 12px Fredoka';
        ctx.textAlign = 'center';
        ctx.fillText(b.n.toUpperCase(), origin.x + Math.cos(ang) * (maxDist + 28), origin.y + Math.sin(ang) * (maxDist + 28));
      });

      // 2. Connecting Circuit Lines
      TECH.forEach(t => {
        if (!t.req) return;
        const destPos = this.nodePos[t.id];
        if (!destPos) return;
        const destSc = this.worldToScreen(destPos.x, destPos.y);

        t.req.forEach(reqId => {
          const srcPos = this.nodePos[reqId];
          if (!srcPos) return;
          const srcSc = this.worldToScreen(srcPos.x, srcPos.y);

          const srcUnlocked = this.isUnlocked(reqId);
          const destUnlocked = this.isUnlocked(t.id);
          const available = this.isAvailable(t);

          if (destUnlocked) {
            // Active unlocked circuit with bright glow
            ctx.strokeStyle = destPos.branchColor;
            ctx.lineWidth = 2.4 * this.zoom;
            ctx.shadowColor = destPos.branchColor;
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.moveTo(srcSc.x, srcSc.y);
            ctx.lineTo(destSc.x, destSc.y);
            ctx.stroke();
            ctx.shadowBlur = 0;

            // Animated energy pulses along active lines
            const pulseT = (this.animTime * 1.5 + (destPos.x + destPos.y) * 0.005) % 1;
            const px = srcSc.x + (destSc.x - srcSc.x) * pulseT;
            const py = srcSc.y + (destSc.y - srcSc.y) * pulseT;
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(px, py, 2.5 * this.zoom, 0, Math.PI * 2);
            ctx.fill();
          } else if (available) {
            // Ready to research
            ctx.strokeStyle = 'rgba(255, 185, 56, 0.45)';
            ctx.lineWidth = 1.6 * this.zoom;
            ctx.beginPath();
            ctx.moveTo(srcSc.x, srcSc.y);
            ctx.lineTo(destSc.x, destSc.y);
            ctx.stroke();
          } else {
            // Locked path
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
            ctx.lineWidth = 1 * this.zoom;
            ctx.setLineDash([4, 6]);
            ctx.beginPath();
            ctx.moveTo(srcSc.x, srcSc.y);
            ctx.lineTo(destSc.x, destSc.y);
            ctx.stroke();
            ctx.setLineDash([]);
          }
        });
      });

      // 3. Render Nodes
      TECH.forEach(t => {
        const pos = this.nodePos[t.id];
        if (!pos) return;
        const sc = this.worldToScreen(pos.x, pos.y);
        const r = pos.r * this.zoom;

        const lvl = this.S.tech[t.id] || 0;
        const unlocked = lvl > 0;
        const available = this.isAvailable(t);
        const isSelected = this.selectedNode === t.id;
        const isHovered = this.hoverNode === t.id;

        // Outer Aura on available/selected
        if (isSelected || isHovered) {
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(sc.x, sc.y, r + 5 * this.zoom, 0, Math.PI * 2);
          ctx.stroke();
        }

        if (unlocked) {
          ctx.fillStyle = pos.branchColor;
          ctx.shadowColor = pos.branchColor;
          ctx.shadowBlur = 12;
        } else if (available) {
          ctx.fillStyle = '#1c2444';
          ctx.shadowColor = '#ffb938';
          ctx.shadowBlur = 6;
        } else {
          ctx.fillStyle = '#0b0f20';
          ctx.shadowBlur = 0;
        }

        // Node Circle Body
        ctx.beginPath();
        ctx.arc(sc.x, sc.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Node Border Ring
        ctx.strokeStyle = unlocked ? '#ffffff' : (available ? pos.branchColor : 'rgba(255, 255, 255, 0.15)');
        ctx.lineWidth = unlocked ? 2.5 * this.zoom : 1.5 * this.zoom;
        ctx.beginPath();
        ctx.arc(sc.x, sc.y, r, 0, Math.PI * 2);
        ctx.stroke();

        // Level Pill / Badge
        if (t.id !== 'core') {
          const badgeY = sc.y + r + 11 * this.zoom;
          ctx.fillStyle = 'rgba(8, 12, 32, 0.88)';
          ctx.beginPath();
          ctx.roundRect ? ctx.roundRect(sc.x - 18 * this.zoom, badgeY - 7 * this.zoom, 36 * this.zoom, 14 * this.zoom, 6)
                         : ctx.rect(sc.x - 18 * this.zoom, badgeY - 7 * this.zoom, 36 * this.zoom, 14 * this.zoom);
          ctx.fill();
          ctx.strokeStyle = unlocked ? pos.branchColor : 'rgba(255,255,255,0.2)';
          ctx.lineWidth = 1;
          ctx.stroke();

          ctx.fillStyle = unlocked ? '#ffffff' : (available ? '#ffb938' : 'rgba(255,255,255,0.4)');
          ctx.font = `700 ${Math.max(9, Math.round(9 * this.zoom))}px Fredoka`;
          ctx.textAlign = 'center';
          ctx.fillText(pos.isSingularity ? `${lvl} \u221E` : `${lvl}/${t.max}`, sc.x, badgeY + 3 * this.zoom);
        } else {
          // Core node title
          ctx.fillStyle = '#fff';
          ctx.font = `700 ${Math.max(10, Math.round(11 * this.zoom))}px Fredoka`;
          ctx.textAlign = 'center';
          ctx.fillText('CHARTER', sc.x, sc.y + 4 * this.zoom);
        }

        // Inner node icon/initial
        if (t.id !== 'core') {
          ctx.fillStyle = unlocked ? '#080d24' : (available ? '#ffffff' : 'rgba(255,255,255,0.3)');
          ctx.font = `700 ${Math.max(9, Math.round(11 * this.zoom))}px Fredoka`;
          ctx.textAlign = 'center';
          ctx.fillText(t.n.slice(0, 3).toUpperCase(), sc.x, sc.y + 4 * this.zoom);
        }
      });

      ctx.restore();
    }
  }

  G.SkillTreeCanvas = SkillTreeCanvas;
})(typeof window !== 'undefined' ? window.G : globalThis.G);
