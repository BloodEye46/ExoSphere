/* ExoSphere 3D Renderer: Three.js procedural planet, cinematic camera dive, hyperspace warp, hotspots, bloom */
'use strict';
(function (G) {
  const { rng, makeNoise } = G;

  class WorldRenderer {
    constructor(host, S, onMineTap) {
      this.host = host;
      this.S = S;
      this.onMineTap = onMineTap;
      this.zk = 1;
      this.spots = [];
      this.hotspots = [];

      // Camera view transition mode ('orbit' vs 'city')
      this.viewMode = 'orbit';
      this.camTargetZ = 4.4;
      this.rigTargetY = -0.22;
      this.camTargetRotX = 0;
      this.isWarping = false;
      this.warpSpeed = 0;

      this.initScene();
      this.initEvents();
    }

    initScene() {
      try {
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
      } catch (e) {
        this.host.textContent = 'WebGL is not available.';
        return;
      }

      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.renderer.setClearColor(0x03050d);
      this.host.appendChild(this.renderer.domElement);

      this.scene = new THREE.Scene();
      this.cam = new THREE.PerspectiveCamera(40, 1, 0.1, 250);

      // Post-processing bloom
      if (typeof THREE.EffectComposer !== 'undefined' && typeof THREE.UnrealBloomPass !== 'undefined') {
        this.comp = new THREE.EffectComposer(this.renderer);
        this.comp.addPass(new THREE.RenderPass(this.scene, this.cam));
        this.comp.addPass(new THREE.UnrealBloomPass(new THREE.Vector2(512, 512), 0.38, 0.6, 0.85));
      }

      // Lights
      this.scene.add(new THREE.HemisphereLight(0x8fb0ff, 0x1a1030, 0.6));
      this.sun = new THREE.DirectionalLight(0xfff1d6, 1.6);
      this.sun.position.set(3, 1.5, 2.5);
      this.scene.add(this.sun);

      this.rim = new THREE.DirectionalLight(0x6a8cff, 0.7);
      this.rim.position.set(-3, 0.5, -2);
      this.scene.add(this.rim);

      // Cosmic starfield
      const sr = rng(99), sp = new Float32Array(7200), sc = new Float32Array(7200);
      for (let i = 0; i < 2400; i++) {
        const u = sr() * 2 - 1, t = sr() * 6.2832, d = 30 + sr() * 30, q = Math.sqrt(1 - u * u);
        sp[i * 3] = q * Math.cos(t) * d; sp[i * 3 + 1] = u * d; sp[i * 3 + 2] = q * Math.sin(t) * d;
        const h = sr(), b = 0.3 + sr() * 0.7;
        sc[i * 3] = b * (h < 0.2 ? 1 : 0.8 + h * 0.2);
        sc[i * 3 + 1] = b * (0.85 + h * 0.1);
        sc[i * 3 + 2] = b * (h > 0.6 ? 1 : 0.8);
      }
      const sg = new THREE.BufferGeometry();
      sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
      sg.setAttribute('color', new THREE.BufferAttribute(sc, 3));
      this.starField = new THREE.Points(sg, new THREE.PointsMaterial({ vertexColors: true, size: 0.13 }));
      this.scene.add(this.starField);

      // Dust
      const dp = new Float32Array(720);
      for (let i = 0; i < 720; i++) dp[i] = (sr() - 0.5) * 14;
      const dgeo = new THREE.BufferGeometry();
      dgeo.setAttribute('position', new THREE.BufferAttribute(dp, 3));
      this.dust = new THREE.Points(dgeo, new THREE.PointsMaterial({ color: 0xffe9c0, size: 0.03, transparent: true, opacity: 0.6, depthWrite: false }));
      this.scene.add(this.dust);

      // Planet rig
      this.rig = new THREE.Group();
      this.pl = new THREE.Group();
      this.pl.rotation.z = 0.25;
      this.rig.add(this.pl);
      this.scene.add(this.rig);

      // Atmosphere glow shader
      this.atmo = new THREE.ShaderMaterial({
        uniforms: { c: { value: new THREE.Color('#6db6ff') } },
        vertexShader: 'varying vec3 vN;void main(){vN=normalize(normalMatrix*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
        fragmentShader: 'uniform vec3 c;varying vec3 vN;void main(){float i=pow(max(.62-dot(vN,vec3(0.,0.,1.)),0.),3.5)*1.8;gl_FragColor=vec4(c*i,i);}',
        side: THREE.BackSide, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false
      });
      this.atmoMesh = new THREE.Mesh(new THREE.SphereGeometry(1.34, 48, 48), this.atmo);
      this.rig.add(this.atmoMesh);

      // Moon
      this.moon = new THREE.Mesh(new THREE.IcosahedronGeometry(0.11, 1), new THREE.MeshStandardMaterial({ color: 0xb9b4ad, flatShading: true, roughness: 1 }));
      this.scene.add(this.moon);

      this.fit();
    }

    fit() {
      const w = this.host.clientWidth || 1, h = this.host.clientHeight || 1;
      this.renderer.setSize(w, h);
      if (this.comp) { this.comp.setPixelRatio(this.renderer.getPixelRatio()); this.comp.setSize(w, h); }
      this.cam.aspect = w / h;
      this.updateCamTargets();
      this.cam.position.z = this.camTargetZ;
      this.cam.updateProjectionMatrix();
      this.rig.position.y = this.rigTargetY;
    }

    setViewMode(mode) {
      this.viewMode = mode;
      this.updateCamTargets();

      // Show/hide hotspots based on orbit view
      const hsContainer = document.getElementById('hs');
      if (hsContainer) {
        hsContainer.style.display = mode === 'orbit' ? 'block' : 'none';
      }
    }

    updateCamTargets() {
      const baseZ = Math.max(4.4, 3.7 / this.cam.aspect) * this.zk;
      if (this.viewMode === 'city') {
        // Dramatic close-up on planet surface
        this.camTargetZ = 2.1;
        this.rigTargetY = -0.82;
        this.camTargetRotX = 0.45;
      } else {
        // Lowered planet center in orbit view: perfectly eliminates crowding at top
        this.camTargetZ = baseZ;
        this.rigTargetY = -0.22;
        this.camTargetRotX = 0;
      }
    }

    warpJump(seed, onComplete) {
      this.isWarping = true;
      this.warpSpeed = 0;
      if (G.Audio) G.Audio.warp();

      // Flash element
      const flash = document.getElementById('flash');
      if (flash) flash.classList.add('on');

      setTimeout(() => {
        this.build(seed);
        if (flash) flash.classList.remove('on');
        this.isWarping = false;
        if (onComplete) onComplete();
      }, 700);
    }

    build(seed) {
      while (this.pl.children.length) {
        const o = this.pl.children[0];
        this.pl.remove(o);
        if (o.geometry) o.geometry.dispose();
        if (o.material) o.material.dispose();
      }

      const P = G.planet(seed);
      const pal = P.pal;
      const r = rng(seed * 7919 + 13);
      const noise = makeNoise(seed);

      const geo = new THREE.IcosahedronGeometry(1, 38);
      const pos = geo.attributes.position;
      const n = pos.count;
      const hs = new Float32Array(n);
      const v = new THREE.Vector3();

      for (let i = 0; i < n; i++) {
        v.fromBufferAttribute(pos, i).normalize();
        let h = noise(v.x, v.y, v.z);
        if (h > 0) h *= 1 + h * 1.6;
        hs[i] = h;
        v.multiplyScalar(1 + Math.max(h, pal.sea) * 0.32);
        pos.setXYZ(i, v.x, v.y, v.z);
      }

      const col = new Float32Array(n * 3);
      const c = new THREE.Color(), c2 = new THREE.Color();
      const deep = new THREE.Color(pal.deep), shal = new THREE.Color(pal.shal);
      const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3();
      this.spots = [];

      for (let f = 0; f < n / 3; f++) {
        const i = f * 3, h = (hs[i] + hs[i + 1] + hs[i + 2]) / 3;
        if (h <= pal.sea) {
          c.copy(shal).lerp(deep, Math.min(1, (pal.sea - h) / 0.35));
        } else {
          const t = Math.min(1, (h - pal.sea) / (0.62 - pal.sea));
          let k = 0;
          while (k < pal.stops.length - 1 && t > pal.stops[k][0]) k++;
          c.set(pal.stops[k][1]);
          if (k > 0) { c2.set(pal.stops[k - 1][1]); c.lerp(c2, 0.25 * r()); }
          if (t > pal.trees[0] && t < pal.trees[1] && r() < 0.25) {
            A.fromBufferAttribute(pos, i); B.fromBufferAttribute(pos, i + 1); C.fromBufferAttribute(pos, i + 2);
            this.spots.push(A.clone().add(B).add(C).multiplyScalar(1 / 3));
          }
        }
        c.offsetHSL(0, 0, (r() - 0.5) * 0.05);
        for (let j = 0; j < 3; j++) {
          col[(i + j) * 3] = c.r; col[(i + j) * 3 + 1] = c.g; col[(i + j) * 3 + 2] = c.b;
        }
      }

      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      geo.computeVertexNormals();
      this.pl.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9, metalness: 0 })));

      // Procedural Low-poly Trees
      const cnt = Math.min(1200, this.spots.length);
      if (cnt > 0) {
        const cg = new THREE.ConeGeometry(0.02, pal.tree[2], pal.tree[1]).translate(0, pal.tree[2] / 2, 0);
        const im = new THREE.InstancedMesh(cg, new THREE.MeshStandardMaterial({ color: pal.tree[0], flatShading: true, roughness: 0.9 }), cnt);
        const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), sc = new THREE.Vector3();
        for (let i = 0; i < cnt; i++) {
          q.setFromUnitVectors(up, this.spots[i].clone().normalize());
          const s = 0.7 + r() * 0.6;
          sc.set(s, s, s);
          m.compose(this.spots[i], q, sc);
          im.setMatrixAt(i, m);
        }
        this.pl.add(im);
      }

      // Clouds
      this.cl = this.createClouds(seed, pal);
      if (this.cl) this.pl.add(this.cl);

      // Rings
      if (P.rings) {
        const ringMesh = new THREE.Mesh(new THREE.RingGeometry(1.6, 2.1, 40, 1), new THREE.MeshStandardMaterial({ color: 0xe8f4ff, side: THREE.DoubleSide, transparent: true, opacity: 0.8, flatShading: true }));
        ringMesh.rotation.x = -Math.PI / 2;
        this.pl.add(ringMesh);
      }

      this.atmo.uniforms.c.value.set(pal.atmo);
      this.setupHotspots(P);
    }

    createClouds(seed, pal) {
      const r = rng(seed * 13 + 5);
      const n = 240;
      const im = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.05, 0), new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, transparent: true, opacity: 0.88, roughness: 1 }), n);
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), p = new THREE.Vector3(), sc = new THREE.Vector3(), c = new THREE.Vector3();
      let i = 0;
      while (i < n) {
        const u = r() * 2 - 1, t = r() * 6.2832, k = Math.sqrt(1 - u * u);
        c.set(k * Math.cos(t), u, k * Math.sin(t));
        for (let j = 0, cnt = 3 + Math.floor(r() * 4); j < cnt && i < n; j++, i++) {
          p.set(c.x + (r() - 0.5) * 0.16, c.y + (r() - 0.5) * 0.16, c.z + (r() - 0.5) * 0.16).normalize().multiplyScalar(1.25 + r() * 0.03);
          q.setFromUnitVectors(up, p.clone().normalize());
          const z = 0.7 + r() * 1.1;
          sc.set(z * (1 + r() * 0.8), z * 0.6, z * (1 + r() * 0.8));
          m.compose(p, q, sc);
          im.setMatrixAt(i, m);
        }
      }
      return im;
    }

    setupHotspots(P) {
      const hsContainer = document.getElementById('hs');
      if (!hsContainer) return;
      hsContainer.innerHTML = '';
      this.hotspots = [];

      // 5 Surface Hotspot Pins
      const pins = [
        { id: 'city', label: 'Capital', dir: new THREE.Vector3(0, 0.7, 0.7), ic: 'M3 21h18M5 21V9l7-5 7 5v12M9 13h6M9 17h6' },
        { id: 'mine_a', label: 'Quarry Alpha', dir: new THREE.Vector3(0.85, -0.2, 0.5), ic: 'M14 4l6 6M4 20l10-10M2 14l6-6M10 22l6-6' },
        { id: 'mine_b', label: 'Quarry Beta', dir: new THREE.Vector3(-0.75, -0.3, 0.6), ic: 'M12 2l8 8-8 8-8-8z' },
        { id: 'pump', label: 'Aquifer Pump', dir: new THREE.Vector3(-0.4, 0.8, -0.5), ic: 'M12 2a6 6 0 0 1 6 6c0 4-6 12-6 12S6 12 6 8a6 6 0 0 1 6-6z' },
        { id: 'xeno', label: 'Alien Life', dir: new THREE.Vector3(0.6, -0.6, -0.5), ic: 'M12 12m-8 0a8 8 0 1 0 16 0a8 8 0 1 0 -16 0' }
      ];

      pins.forEach(pin => {
        const btn = document.createElement('button');
        btn.className = 'hs';
        btn.innerHTML = `
          <span>
            <svg class="ic" viewBox="0 0 24 24" style="stroke:currentColor;fill:none;stroke-width:2"><path d="${pin.ic}"/></svg>
          </span>
          <small>${pin.label}</small>
        `;
        btn.addEventListener('click', () => {
          if (G.Audio) G.Audio.tap(650);
          if (pin.id === 'city') G.UI.toggleTab('city');
          else if (pin.id === 'mine_a' || pin.id === 'mine_b' || pin.id === 'pump') G.UI.toggleTab('mining');
          else if (pin.id === 'xeno') G.UI.toggleTab('xeno');
        });
        hsContainer.appendChild(btn);

        const anchor = pin.dir.normalize().multiplyScalar(1.08);
        this.hotspots.push({ el: btn, anchor });
      });
    }

    updateHotspots() {
      if (this.viewMode !== 'orbit') return;
      const W = this.host.clientWidth, H = this.host.clientHeight;
      const V = new THREE.Vector3(), N = new THREE.Vector3(), D = new THREE.Vector3();

      this.hotspots.forEach(item => {
        V.copy(item.anchor).applyMatrix4(this.pl.matrixWorld);
        N.copy(V).sub(this.rig.position).normalize();
        D.copy(this.cam.position).sub(V);
        const f = N.dot(D) / D.length();
        const o = Math.max(0, Math.min(1, (f - 0.12) / 0.25));

        V.project(this.cam);
        item.el.style.left = ((V.x * 0.5 + 0.5) * W) + 'px';
        item.el.style.top = ((-V.y * 0.5 + 0.5) * H) + 'px';
        item.el.style.opacity = o;
        item.el.style.pointerEvents = o > 0.5 ? 'auto' : 'none';
      });
    }

    initEvents() {
      window.addEventListener('resize', () => this.fit());

      let drag = false, lx = 0, sx = 0, sy = 0, mv = false, vy = 0;
      this.host.addEventListener('pointerdown', e => {
        drag = true; lx = sx = e.clientX; sy = e.clientY; mv = false; vy = 0;
        this.host.setPointerCapture(e.pointerId);
      });
      this.host.addEventListener('pointermove', e => {
        if (!drag) return;
        if (Math.abs(e.clientX - sx) + Math.abs(e.clientY - sy) > 8) mv = true;
        const dx = e.clientX - lx; lx = e.clientX;
        this.pl.rotation.y += dx * 0.006;
        vy = dx * 0.006;
      });
      const end = e => {
        drag = false;
        if (e.type === 'pointerup' && !mv) {
          if (this.onMineTap) this.onMineTap(e.clientX, e.clientY);
        }
      };
      this.host.addEventListener('pointerup', end);
      this.host.addEventListener('pointercancel', end);

      this.vy = 0;
      this.moonAngle = 0;
    }

    render(dt) {
      // Smooth Camera & Rig interpolation
      const lerpSpeed = Math.min(1, dt * 4.5);
      this.cam.position.z += (this.camTargetZ - this.cam.position.z) * lerpSpeed;
      this.rig.position.y += (this.rigTargetY - this.rig.position.y) * lerpSpeed;
      this.cam.rotation.x += (this.camTargetRotX - this.cam.rotation.x) * lerpSpeed;

      if (this.pl) {
        this.pl.rotation.y += dt * 0.08;
      }
      if (this.cl) {
        this.cl.rotation.y += dt * 0.03;
      }
      if (this.dust) {
        this.dust.rotation.y += dt * 0.015;
      }

      this.moonAngle += dt * 0.3;
      this.moon.position.set(Math.cos(this.moonAngle) * 2.2, Math.sin(this.moonAngle) * 0.4 + this.rig.position.y, Math.sin(this.moonAngle) * 2.2);

      this.rig.updateMatrixWorld(true);
      this.updateHotspots();

      if (this.comp) this.comp.render();
      else this.renderer.render(this.scene, this.cam);
    }
  }

  G.WorldRenderer = WorldRenderer;
})(typeof window !== 'undefined' ? window.G : globalThis.G);
