/* ExoSphere Capital City Diorama: Isometric Hex Grid Renderer with 2.5D Procedural Sci-Fi Architecture */
'use strict';
(function (G) {
  const { BUILD, BUILD_ORDER, HQ, HQ_PLOTS, PLOTS, key, neighbours, plotUnlocked, features, FEATURE_INFO, lvlMul, fmt, costAt, GLOBAL_RES } = G;

  class CityDiorama {
    constructor(canvas, S, onSelectTile) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.S = S;
      this.onSelectTile = onSelectTile;
      this.selectedKey = '0,0';
      this.hoverKey = null;

      // Isometric projection constants
      this.tileW = 72; // Hex width
      this.tileH = 42; // Hex height
      this.tileDepth = 14;

      // Ambient drones
      this.drones = [];
      for (let i = 0; i < 5; i++) {
        this.drones.push({
          x: (Math.random() - 0.5) * 200,
          y: (Math.random() - 0.5) * 120,
          targetX: (Math.random() - 0.5) * 200,
          targetY: (Math.random() - 0.5) * 120,
          speed: 0.6 + Math.random() * 0.8,
          progress: Math.random(),
          color: Math.random() > 0.5 ? '#ffb938' : '#5cc8ff'
        });
      }

      this.animTime = 0;
      this.bindInput();
    }

    // Convert axial (q, r) to isometric screen coordinates (x, y) relative to center
    hexToScreen(q, r) {
      // Axial to isometric 2D
      const x = this.tileW * 0.75 * q;
      const y = this.tileH * (r + q * 0.5);
      return { x, y };
    }

    screenToHex(sx, sy) {
      const cx = this.canvas.width / 2;
      const cy = this.canvas.height / 2 + 10;
      const dx = sx - cx;
      const dy = sy - cy;

      let closestKey = null;
      let minDist = 36;

      // Check center HQ
      const hqDist = Math.hypot(dx, dy);
      if (hqDist < minDist) {
        minDist = hqDist;
        closestKey = '0,0';
      }

      // Check all plots
      for (const [q, r] of PLOTS) {
        const pt = this.hexToScreen(q, r);
        const dist = Math.hypot(dx - pt.x, dy - pt.y);
        if (dist < minDist) {
          minDist = dist;
          closestKey = key(q, r);
        }
      }
      return closestKey;
    }

    bindInput() {
      const getPos = e => {
        const rect = this.canvas.getBoundingClientRect();
        return {
          x: (e.clientX - rect.left) * (this.canvas.width / rect.width),
          y: (e.clientY - rect.top) * (this.canvas.height / rect.height)
        };
      };

      this.canvas.addEventListener('pointermove', e => {
        const p = getPos(e);
        this.hoverKey = this.screenToHex(p.x, p.y);
      });

      this.canvas.addEventListener('pointerleave', () => {
        this.hoverKey = null;
      });

      this.canvas.addEventListener('pointerdown', e => {
        const p = getPos(e);
        const k = this.screenToHex(p.x, p.y);
        if (k) {
          this.selectedKey = k;
          if (G.Audio) G.Audio.tap(600);
          if (this.onSelectTile) this.onSelectTile(k);
        }
      });
    }

    drawHexPolygon(ctx, x, y, w, h) {
      ctx.beginPath();
      ctx.moveTo(x, y - h);
      ctx.lineTo(x + w * 0.5, y - h * 0.5);
      ctx.lineTo(x + w * 0.5, y + h * 0.5);
      ctx.lineTo(x, y + h);
      ctx.lineTo(x - w * 0.5, y + h * 0.5);
      ctx.lineTo(x - w * 0.5, y - h * 0.5);
      ctx.closePath();
    }

    drawHexBase(ctx, x, y, w, h, depth, topColor, sideColor) {
      // 3D Hex side extrusion
      ctx.fillStyle = sideColor;
      ctx.beginPath();
      ctx.moveTo(x - w * 0.5, y + h * 0.5);
      ctx.lineTo(x, y + h);
      ctx.lineTo(x + w * 0.5, y + h * 0.5);
      ctx.lineTo(x + w * 0.5, y + h * 0.5 + depth);
      ctx.lineTo(x, y + h + depth);
      ctx.lineTo(x - w * 0.5, y + h * 0.5 + depth);
      ctx.closePath();
      ctx.fill();

      // Top face
      ctx.fillStyle = topColor;
      this.drawHexPolygon(ctx, x, y, w, h);
      ctx.fill();
    }

    // Render stylized procedural building geometries
    drawBuilding(ctx, type, level, x, y, time) {
      const p = Math.sin(time * 3) * 0.5 + 0.5;

      switch (type) {
        case 'hq': { // Capital Center Spire
          // Base podium
          ctx.fillStyle = '#2b3354';
          ctx.beginPath();
          ctx.ellipse(x, y + 2, 22, 11, 0, 0, Math.PI * 2);
          ctx.fill();

          // Spire tiers
          ctx.fillStyle = '#f0ebe1';
          ctx.fillRect(x - 9, y - 26, 18, 28);
          ctx.fillStyle = '#d5cebf';
          ctx.fillRect(x, y - 26, 9, 28);

          // Second tier
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(x - 5, y - 44, 10, 18);
          ctx.fillStyle = '#e2ded5';
          ctx.fillRect(x, y - 44, 5, 18);

          // Golden Crown & Beacon
          ctx.fillStyle = '#ffb938';
          ctx.beginPath();
          ctx.arc(x, y - 48, 3.5, 0, Math.PI * 2);
          ctx.fill();

          // Beacon glow
          ctx.fillStyle = `rgba(255, 185, 56, ${0.4 + p * 0.4})`;
          ctx.beginPath();
          ctx.arc(x, y - 48, 8 + p * 3, 0, Math.PI * 2);
          ctx.fill();

          // Lit windows
          ctx.fillStyle = '#ffb938';
          for (let row = 0; row < 3; row++) {
            ctx.fillRect(x - 7, y - 22 + row * 8, 3, 4);
            ctx.fillRect(x + 4, y - 22 + row * 8, 3, 4);
          }
          break;
        }

        case 'habitat': { // Modular Residential Pods
          ctx.fillStyle = '#222842';
          ctx.fillRect(x - 14, y - 6, 28, 8);

          // Stacked pods
          ctx.fillStyle = '#e9e4d8';
          ctx.fillRect(x - 12, y - 18, 11, 13);
          ctx.fillRect(x + 1, y - 22, 12, 17);

          // Shadows
          ctx.fillStyle = '#c5bfb0';
          ctx.fillRect(x - 6, y - 18, 5, 13);
          ctx.fillRect(x + 7, y - 22, 6, 17);

          // Amber lit windows
          ctx.fillStyle = '#ffb938';
          ctx.fillRect(x - 10, y - 15, 3, 3);
          ctx.fillRect(x - 10, y - 10, 3, 3);
          ctx.fillRect(x + 3, y - 19, 3, 3);
          ctx.fillRect(x + 3, y - 13, 3, 3);
          ctx.fillRect(x + 3, y - 7, 3, 3);
          break;
        }

        case 'farm': { // Geodesic Glass Biodome
          // Greenhouse Base
          ctx.fillStyle = '#3a4a35';
          ctx.beginPath();
          ctx.ellipse(x, y + 2, 16, 8, 0, 0, Math.PI * 2);
          ctx.fill();

          // Glowing Green Crops inside
          ctx.fillStyle = '#7ef0c2';
          ctx.fillRect(x - 10, y - 6, 20, 6);

          // Glass dome
          ctx.fillStyle = 'rgba(92, 200, 255, 0.45)';
          ctx.beginPath();
          ctx.arc(x, y - 4, 13, Math.PI, 0);
          ctx.fill();
          ctx.strokeStyle = '#aee4ff';
          ctx.lineWidth = 1.2;
          ctx.stroke();

          // Dome struts
          ctx.beginPath();
          ctx.moveTo(x - 13, y - 4);
          ctx.lineTo(x, y - 17);
          ctx.lineTo(x + 13, y - 4);
          ctx.stroke();
          break;
        }

        case 'power': { // Tokamak Fusion Reactor
          // Reactor base
          ctx.fillStyle = '#232940';
          ctx.fillRect(x - 12, y - 14, 24, 16);

          // Cooling fins
          ctx.fillStyle = '#ffb938';
          ctx.fillRect(x - 14, y - 12, 3, 12);
          ctx.fillRect(x + 11, y - 12, 3, 12);

          // Core cylinder
          ctx.fillStyle = '#14182b';
          ctx.beginPath();
          ctx.arc(x, y - 8, 8, 0, Math.PI * 2);
          ctx.fill();

          // Pulsing Cyan Plasma Ring
          ctx.fillStyle = `rgba(92, 200, 255, ${0.7 + p * 0.3})`;
          ctx.beginPath();
          ctx.arc(x, y - 8, 5, 0, Math.PI * 2);
          ctx.fill();

          // Outer plasma aura
          ctx.strokeStyle = '#5cc8ff';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(x, y - 8, 9 + p * 2, 0, Math.PI * 2);
          ctx.stroke();
          break;
        }

        case 'lab': { // Advanced Research Facility
          ctx.fillStyle = '#2f3b60';
          ctx.fillRect(x - 14, y - 14, 28, 16);
          ctx.fillStyle = '#f0f5ff';
          ctx.fillRect(x - 12, y - 18, 24, 6);

          // Satellite radar dish
          const angle = time * 1.5;
          ctx.strokeStyle = '#b18cff';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(x + 4, y - 24, 7, angle, angle + Math.PI);
          ctx.stroke();

          // Mint data stream
          ctx.fillStyle = '#7ef0c2';
          ctx.fillRect(x - 9, y - 10, 4, 8);
          ctx.fillRect(x - 3, y - 10, 4, 8);
          break;
        }

        case 'recycler': { // Water Reclamation Facility
          // Water pool reservoir
          ctx.fillStyle = '#192244';
          ctx.fillRect(x - 14, y - 10, 28, 14);

          // Sparkling blue water
          ctx.fillStyle = `rgba(92, 200, 255, ${0.8 + p * 0.2})`;
          ctx.fillRect(x - 11, y - 7, 22, 9);

          // Filtration tank
          ctx.fillStyle = '#e5eff8';
          ctx.fillRect(x + 4, y - 20, 8, 16);
          ctx.fillStyle = '#3a93d1';
          ctx.fillRect(x + 6, y - 18, 4, 12);
          break;
        }

        case 'clinic': { // Medical Pavilion
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(x, y - 6, 12, Math.PI, 0);
          ctx.fill();
          ctx.fillStyle = '#273152';
          ctx.fillRect(x - 12, y - 6, 24, 8);

          // Cyan Medical Cross
          ctx.fillStyle = '#5cc8ff';
          ctx.fillRect(x - 2, y - 16, 4, 10);
          ctx.fillRect(x - 5, y - 13, 10, 4);
          break;
        }

        case 'park': { // Terraformed Nature Park
          // Raised mound
          ctx.fillStyle = '#4f9b3b';
          ctx.beginPath();
          ctx.ellipse(x, y - 2, 15, 8, 0, 0, Math.PI * 2);
          ctx.fill();

          // Sparkling pond
          ctx.fillStyle = '#5cc8ff';
          ctx.beginPath();
          ctx.ellipse(x + 4, y - 1, 5, 3, 0, 0, Math.PI * 2);
          ctx.fill();

          // Low-poly trees
          const tree = (tx, ty) => {
            ctx.fillStyle = '#6b472e';
            ctx.fillRect(tx - 1, ty - 4, 2, 5);
            ctx.fillStyle = '#2f7d3a';
            ctx.beginPath();
            ctx.moveTo(tx, ty - 12);
            ctx.lineTo(tx + 4, ty - 4);
            ctx.lineTo(tx - 4, ty - 4);
            ctx.closePath();
            ctx.fill();
          };
          tree(x - 6, y - 2);
          tree(x - 2, y - 5);
          tree(x + 6, y - 4);
          break;
        }

        case 'port': { // Spaceport Landing Pad
          ctx.fillStyle = '#1e243a';
          ctx.fillRect(x - 16, y - 6, 32, 10);

          // Yellow landing chevron markings
          ctx.fillStyle = '#ffb938';
          ctx.fillRect(x - 8, y - 4, 16, 2);
          ctx.fillRect(x - 1, y - 6, 2, 6);

          // Control tower
          ctx.fillStyle = '#e8e5dc';
          ctx.fillRect(x - 13, y - 20, 5, 16);
          ctx.fillStyle = '#5cc8ff';
          ctx.fillRect(x - 14, y - 23, 7, 4);

          // Docked shuttle
          ctx.fillStyle = '#f4efe6';
          ctx.beginPath();
          ctx.moveTo(x + 6, y - 16);
          ctx.lineTo(x + 11, y - 6);
          ctx.lineTo(x + 1, y - 6);
          ctx.closePath();
          ctx.fill();
          break;
        }

        case 'defense': { // Defense Grid Turret
          // Armored bunker
          ctx.fillStyle = '#2b3352';
          ctx.fillRect(x - 12, y - 10, 24, 12);

          // Rotating turret head
          const turretAngle = Math.sin(time * 0.8) * 0.6;
          ctx.fillStyle = '#e8ecf4';
          ctx.beginPath();
          ctx.arc(x, y - 11, 7, 0, Math.PI * 2);
          ctx.fill();

          // Dual barrels
          ctx.strokeStyle = '#ff7a7a';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(x - 2, y - 11);
          ctx.lineTo(x - 2 + Math.cos(turretAngle) * 10, y - 11 - Math.sin(turretAngle + 1) * 8);
          ctx.moveTo(x + 2, y - 11);
          ctx.lineTo(x + 2 + Math.cos(turretAngle) * 10, y - 11 - Math.sin(turretAngle + 1) * 8);
          ctx.stroke();
          break;
        }
      }
    }

    render(dt) {
      this.animTime += dt;
      const ctx = this.ctx;
      const w = this.canvas.width;
      const h = this.canvas.height;
      const cx = w / 2;
      const cy = h / 2 + 10;

      ctx.clearRect(0, 0, w, h);

      const col = this.S.col[this.S.cur];
      if (!col) return;
      const P = G.planet(this.S.cur);
      const F = features(this.S.cur);

      // Biome-specific terrain colors
      const biomeColors = {
        temperate: { top: '#2e4235', side: '#1a261f', edge: '#4a6b56' },
        ocean: { top: '#1c3d52', side: '#102330', edge: '#3b789e' },
        desert: { top: '#4a3a24', side: '#2a2014', edge: '#856942' },
        ice: { top: '#2c4357', side: '#17242f', edge: '#5a8cb3' },
        volcanic: { top: '#3b2222', side: '#211313', edge: '#6b3333' },
        toxic: { top: '#34451c', side: '#1e2810', edge: '#668737' },
        crystal: { top: '#3b2654', side: '#221530', edge: '#7249a3' },
        barren: { top: '#2f3238', side: '#1b1c21', edge: '#535863' }
      };
      const bColor = biomeColors[P.biome] || biomeColors.temperate;

      // 1. Draw all hex base tiles in sorted isometric depth order (Y ascending)
      const allPlots = [{ k: '0,0', q: 0, r: 0, hq: true }];
      PLOTS.forEach(([q, r]) => allPlots.push({ k: key(q, r), q, r, hq: false }));

      allPlots.sort((a, b) => {
        const pa = this.hexToScreen(a.q, a.r);
        const pb = this.hexToScreen(b.q, b.r);
        return pa.y - pb.y;
      });

      // 2. Render each tile
      allPlots.forEach(tile => {
        const pos = this.hexToScreen(tile.q, tile.r);
        const sx = cx + pos.x;
        const sy = cy + pos.y;
        const k = tile.k;
        const isUnlocked = tile.hq || plotUnlocked(col, k);
        const isSelected = this.selectedKey === k;
        const isHovered = this.hoverKey === k;
        const feat = F[k];
        const building = tile.hq ? ['hq', col.hq] : col.tiles[k];

        // Tile base colors
        let topCol = bColor.top;
        let sideCol = bColor.side;

        if (!isUnlocked) {
          topCol = '#0d1124';
          sideCol = '#060814';
        } else if (feat === 'lake') {
          topCol = '#1a3c63';
        } else if (feat === 'rock') {
          topCol = '#373a45';
        } else if (feat === 'fertile') {
          topCol = '#354d2e';
        }

        // Draw 3D Hex
        this.drawHexBase(ctx, sx, sy, this.tileW, this.tileH, isUnlocked ? this.tileDepth : 4, topCol, sideCol);

        // Grid border
        ctx.strokeStyle = isSelected ? '#ffb938' : isHovered ? '#5cc8ff' : (isUnlocked ? bColor.edge : 'rgba(255,255,255,0.06)');
        ctx.lineWidth = isSelected ? 2.5 : isHovered ? 2 : 1;
        this.drawHexPolygon(ctx, sx, sy, this.tileW, this.tileH);
        ctx.stroke();

        // Terrain Feature icon/badge on empty unlocked plots
        if (isUnlocked && !building) {
          if (feat === 'lake') {
            ctx.fillStyle = '#5cc8ff';
            ctx.font = '600 10px Fredoka';
            ctx.textAlign = 'center';
            ctx.fillText('LAKE', sx, sy + 3);
          } else if (feat === 'rock') {
            ctx.fillStyle = '#aab3e6';
            ctx.font = '600 10px Fredoka';
            ctx.textAlign = 'center';
            ctx.fillText('BEDROCK', sx, sy + 3);
          } else if (feat === 'fertile') {
            ctx.fillStyle = '#7ef0c2';
            ctx.font = '600 10px Fredoka';
            ctx.textAlign = 'center';
            ctx.fillText('FERTILE', sx, sy + 3);
          } else {
            // Plus build prompt
            ctx.fillStyle = 'rgba(255,255,255,0.3)';
            ctx.font = '700 13px Fredoka';
            ctx.textAlign = 'center';
            ctx.fillText('+', sx, sy + 4);
          }
        }

        // Lock icon on locked plots
        if (!isUnlocked) {
          ctx.fillStyle = 'rgba(255,255,255,0.18)';
          ctx.font = '11px Fredoka';
          ctx.textAlign = 'center';
          ctx.fillText('Locked', sx, sy + 3);
        }

        // 3. Render Building if present
        if (building) {
          this.drawBuilding(ctx, building[0], building[1], sx, sy, this.animTime);

          // Level badge
          ctx.fillStyle = 'rgba(10, 14, 40, 0.85)';
          ctx.beginPath();
          ctx.arc(sx, sy + 13, 8, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#ffb938';
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.fillStyle = '#fff';
          ctx.font = '700 9px Fredoka';
          ctx.textAlign = 'center';
          ctx.fillText(building[1], sx, sy + 16);
        }

        // Animated selector ring on selected tile
        if (isSelected) {
          const pulse = Math.sin(this.animTime * 4) * 2;
          ctx.strokeStyle = '#ffb938';
          ctx.lineWidth = 2;
          this.drawHexPolygon(ctx, sx, sy - pulse, this.tileW + 4, this.tileH + 2);
          ctx.stroke();
        }
      });

      // 4. Draw Synergistic Adjacency Laser Links for selected tile
      if (this.selectedKey) {
        const [sq, sr] = this.selectedKey.split(',').map(Number);
        const selBld = this.selectedKey === '0,0' ? ['hq', col.hq] : col.tiles[this.selectedKey];

        if (selBld) {
          const sPos = this.hexToScreen(sq, sr);
          neighbours(sq, sr).forEach(nk => {
            const nbBld = nk === '0,0' ? ['hq', col.hq] : col.tiles[nk];
            if (nbBld) {
              const [nq, nr] = nk.split(',').map(Number);
              const nPos = this.hexToScreen(nq, nr);

              // Check synergies (e.g. farm <-> recycler, lab <-> lab, park <-> habitat)
              let synColor = null;
              if (selBld[0] === 'farm' && nbBld[0] === 'recycler') synColor = '#5cc8ff';
              else if (selBld[0] === 'recycler' && nbBld[0] === 'farm') synColor = '#5cc8ff';
              else if (selBld[0] === 'lab' && nbBld[0] === 'lab') synColor = '#b18cff';
              else if (selBld[0] === 'park' && (nbBld[0] === 'habitat' || nbBld[0] === 'lab')) synColor = '#7ef0c2';
              else if (selBld[0] === 'habitat' && nbBld[0] === 'power') synColor = '#ff7a7a'; // negative

              if (synColor) {
                ctx.strokeStyle = synColor;
                ctx.lineWidth = 2;
                ctx.setLineDash([4, 4]);
                ctx.lineDashOffset = -this.animTime * 15;
                ctx.beginPath();
                ctx.moveTo(cx + sPos.x, cy + sPos.y - 10);
                ctx.lineTo(cx + nPos.x, cy + nPos.y - 10);
                ctx.stroke();
                ctx.setLineDash([]);
              }
            }
          });
        }
      }

      // 5. Update and render ambient transport drones
      this.drones.forEach(d => {
        d.progress += dt * d.speed * 0.4;
        if (d.progress >= 1) {
          d.progress = 0;
          d.x = d.targetX;
          d.y = d.targetY;
          d.targetX = (Math.random() - 0.5) * 180;
          d.targetY = (Math.random() - 0.5) * 100;
        }
        const curX = cx + d.x + (d.targetX - d.x) * d.progress;
        const curY = cy + d.y + (d.targetY - d.y) * d.progress - 20;

        ctx.fillStyle = d.color;
        ctx.beginPath();
        ctx.arc(curX, curY, 2.5, 0, Math.PI * 2);
        ctx.fill();

        // Drone thruster tail
        ctx.strokeStyle = `rgba(255, 185, 56, ${1 - d.progress})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(curX, curY);
        ctx.lineTo(curX - (d.targetX - d.x) * 0.05, curY - (d.targetY - d.y) * 0.05);
        ctx.stroke();
      });
    }
  }

  G.CityDiorama = CityDiorama;
})(typeof window !== 'undefined' ? window.G : globalThis.G);
