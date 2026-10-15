/* ExoSphere Spiral Galaxy Star Chart: Interactive AAA Canvas with Fog of War & Scanner Radar */
'use strict';
(function (G) {
  const { galaxy, planet, planetDist, HOME, sysOf, tech } = G;

  class GalaxyCanvas {
    constructor(canvas, S, onSelectSystem) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.S = S;
      this.onSelectSystem = onSelectSystem;

      // Pan & Zoom state
      this.panX = 0;
      this.panY = 0;
      this.zoom = 3.8; // Initial zoom framing Sol & core
      this.minZoom = 1.2;
      this.maxZoom = 10.0;

      this.selectedSys = 0; // Sol
      this.hoverSys = null;
      this.isDragging = false;
      this.startX = 0;
      this.startY = 0;
      this.hasMoved = false;

      this.animTime = 0;
      this.radarAngle = 0;

      // Pre-compute galactic dust clouds
      this.dust = [];
      const r = G.rng(4242);
      for (let i = 0; i < 350; i++) {
        const arm = Math.floor(r() * 4);
        const d = 10 + Math.pow(r(), 0.7) * 90;
        const ang = (arm / 4) * Math.PI * 2 + d * 0.055 + (r() - 0.5) * 0.7;
        this.dust.push({
          x: Math.cos(ang) * d + (r() - 0.5) * 8,
          y: Math.sin(ang) * d + (r() - 0.5) * 8,
          size: 1.5 + r() * 3.5,
          color: r() < 0.4 ? 'rgba(92, 200, 255, 0.08)' : (r() < 0.7 ? 'rgba(255, 185, 56, 0.07)' : 'rgba(177, 140, 255, 0.08)')
        });
      }

      this.bindInput();
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

    getScannerRange() {
      // Base 14 light years + tech bonus
      return 14 + (tech(this.S, 'scan') || 0);
    }

    isSystemScanned(sys) {
      if (sys.i === 0) return true; // Sol
      const range = this.getScannerRange();

      // Check distance to any player colony
      for (const colSeed in this.S.col) {
        const colSysIdx = sysOf[colSeed];
        const colSys = galaxy[colSysIdx];
        if (colSys) {
          const dist = Math.hypot(sys.x - colSys.x, sys.y - colSys.y);
          if (dist <= range) return true;
        }
      }
      return false;
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
          for (const s of galaxy) {
            if (Math.hypot(wp.x - s.x, wp.y - s.y) <= 4.0 / this.zoom + 2.5) {
              found = s.i;
              break;
            }
          }
          if (this.hoverSys !== found) {
            this.hoverSys = found;
            this.canvas.style.cursor = found !== null ? 'pointer' : 'grab';
          }
        }
      });

      const end = e => {
        if (!this.isDragging) return;
        this.isDragging = false;
        if (!this.hasMoved) {
          const p = getPos(e);
          const wp = this.screenToWorld(p.x, p.y);
          for (const s of galaxy) {
            if (Math.hypot(wp.x - s.x, wp.y - s.y) <= 4.0 / this.zoom + 2.5) {
              this.selectedSys = s.i;
              if (G.Audio) G.Audio.tap(680);
              if (this.onSelectSystem) this.onSelectSystem(s);
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
        const factor = e.deltaY < 0 ? 1.15 : 0.86;
        const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom * factor));

        const wp = this.screenToWorld(p.x, p.y);
        this.zoom = newZoom;
        const newSp = this.worldToScreen(wp.x, wp.y);
        this.panX += p.x - newSp.x;
        this.panY += p.y - newSp.y;
      }, { passive: false });
    }

    focusSystem(sysIdx) {
      const s = galaxy[sysIdx];
      if (!s) return;
      this.selectedSys = sysIdx;
      this.panX = -s.x * this.zoom;
      this.panY = -s.y * this.zoom;
    }

    render(dt) {
      this.animTime += dt;
      this.radarAngle += dt * 0.8;
      const ctx = this.ctx;
      const w = this.canvas.width;
      const h = this.canvas.height;
      const scannerRange = this.getScannerRange();

      ctx.clearRect(0, 0, w, h);

      // 1. Galactic Center Core Glow
      const centerSc = this.worldToScreen(0, 0);
      const coreGrad = ctx.createRadialGradient(centerSc.x, centerSc.y, 4, centerSc.x, centerSc.y, 70 * this.zoom);
      coreGrad.addColorStop(0, 'rgba(255, 235, 180, 0.25)');
      coreGrad.addColorStop(0.3, 'rgba(177, 140, 255, 0.12)');
      coreGrad.addColorStop(1, 'rgba(3, 5, 13, 0)');
      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(centerSc.x, centerSc.y, 70 * this.zoom, 0, Math.PI * 2);
      ctx.fill();

      // 2. Cosmic Nebular Dust Clouds
      this.dust.forEach(d => {
        const sc = this.worldToScreen(d.x, d.y);
        if (sc.x < -20 || sc.x > w + 20 || sc.y < -20 || sc.y > h + 20) return;
        ctx.fillStyle = d.color;
        ctx.beginPath();
        ctx.arc(sc.x, sc.y, d.size * this.zoom, 0, Math.PI * 2);
        ctx.fill();
      });

      // 3. Scanner Radar Field & Boundaries
      for (const colSeed in this.S.col) {
        const colSysIdx = sysOf[colSeed];
        const colSys = galaxy[colSysIdx];
        if (colSys) {
          const sc = this.worldToScreen(colSys.x, colSys.y);
          const rad = scannerRange * this.zoom;

          // Glowing radar dome
          const radarGrad = ctx.createRadialGradient(sc.x, sc.y, 0, sc.x, sc.y, rad);
          radarGrad.addColorStop(0, 'rgba(92, 200, 255, 0.08)');
          radarGrad.addColorStop(0.85, 'rgba(92, 200, 255, 0.04)');
          radarGrad.addColorStop(1, 'rgba(92, 200, 255, 0.18)');
          ctx.fillStyle = radarGrad;
          ctx.beginPath();
          ctx.arc(sc.x, sc.y, rad, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = 'rgba(92, 200, 255, 0.35)';
          ctx.lineWidth = 1.2;
          ctx.setLineDash([4, 6]);
          ctx.stroke();
          ctx.setLineDash([]);

          // Sweeping radar scan line
          ctx.strokeStyle = 'rgba(92, 200, 255, 0.4)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(sc.x, sc.y);
          ctx.lineTo(sc.x + Math.cos(this.radarAngle) * rad, sc.y + Math.sin(this.radarAngle) * rad);
          ctx.stroke();
        }
      }

      // 4. Render Star Systems
      galaxy.forEach(s => {
        const sc = this.worldToScreen(s.x, s.y);
        if (sc.x < -30 || sc.x > w + 30 || sc.y < -30 || sc.y > h + 30) return;

        const isScanned = this.isSystemScanned(s);
        const hasColony = s.planets.some(p => !!this.S.col[p]);
        const isCurOrbit = s.planets.includes(this.S.cur);
        const isSelected = this.selectedSys === s.i;
        const isHovered = this.hoverSys === s.i;

        const starColor = s.star[0];
        const starRadius = (hasColony ? 3.5 : 2.2) * Math.min(2.0, Math.max(0.8, this.zoom * 0.35));

        if (isScanned) {
          // Star Glow Corona
          const glowGrad = ctx.createRadialGradient(sc.x, sc.y, 0, sc.x, sc.y, starRadius * 3.5);
          glowGrad.addColorStop(0, starColor);
          glowGrad.addColorStop(0.4, `${starColor}66`);
          glowGrad.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = glowGrad;
          ctx.beginPath();
          ctx.arc(sc.x, sc.y, starRadius * 3.5, 0, Math.PI * 2);
          ctx.fill();

          // Star Core
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(sc.x, sc.y, starRadius, 0, Math.PI * 2);
          ctx.fill();

          // Colony Orbit Ring
          if (hasColony) {
            ctx.strokeStyle = '#ffb938';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(sc.x, sc.y, starRadius + 5, 0, Math.PI * 2);
            ctx.stroke();
          }

          // Flagship presence icon
          if (isCurOrbit) {
            ctx.fillStyle = '#5cc8ff';
            ctx.beginPath();
            ctx.moveTo(sc.x, sc.y - starRadius - 9);
            ctx.lineTo(sc.x + 4, sc.y - starRadius - 4);
            ctx.lineTo(sc.x - 4, sc.y - starRadius - 4);
            ctx.closePath();
            ctx.fill();
          }

          // System Name label (when zoomed in or hovered/selected)
          if (this.zoom > 3.0 || isSelected || isHovered || hasColony) {
            ctx.fillStyle = hasColony ? '#ffb938' : (isCurOrbit ? '#5cc8ff' : '#e6ebff');
            ctx.font = `${isSelected ? '700' : '500'} 10px Fredoka`;
            ctx.textAlign = 'center';
            ctx.fillText(s.name, sc.x, sc.y + starRadius + 12);
          }
        } else {
          // Fog of War: Unexplored system silhouette
          ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
          ctx.beginPath();
          ctx.arc(sc.x, sc.y, 1.2, 0, Math.PI * 2);
          ctx.fill();
        }

        // Tactical Selection Reticle
        if (isSelected) {
          const retSize = 14 + Math.sin(this.animTime * 4) * 2;
          ctx.strokeStyle = '#ffb938';
          ctx.lineWidth = 1.5;

          // Four corner brackets
          const len = 4;
          // Top Left
          ctx.beginPath(); ctx.moveTo(sc.x - retSize, sc.y - retSize + len); ctx.lineTo(sc.x - retSize, sc.y - retSize); ctx.lineTo(sc.x - retSize + len, sc.y - retSize); ctx.stroke();
          // Top Right
          ctx.beginPath(); ctx.moveTo(sc.x + retSize - len, sc.y - retSize); ctx.lineTo(sc.x + retSize, sc.y - retSize); ctx.lineTo(sc.x + retSize, sc.y - retSize + len); ctx.stroke();
          // Bottom Right
          ctx.beginPath(); ctx.moveTo(sc.x + retSize, sc.y + retSize - len); ctx.lineTo(sc.x + retSize, sc.y + retSize); ctx.lineTo(sc.x + retSize - len, sc.y + retSize); ctx.stroke();
          // Bottom Left
          ctx.beginPath(); ctx.moveTo(sc.x - retSize + len, sc.y + retSize); ctx.lineTo(sc.x - retSize, sc.y + retSize); ctx.lineTo(sc.x - retSize, sc.y + retSize - len); ctx.stroke();
        }
      });
    }
  }

  G.GalaxyCanvas = GalaxyCanvas;
})(typeof window !== 'undefined' ? window.G : globalThis.G);
