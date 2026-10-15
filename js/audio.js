/* ExoSphere Web Audio Sound Engine: Procedural sci-fi SFX with zero external dependencies */
'use strict';
(function (G) {
  let ctx = null;
  let muted = false;

  function getCtx() {
    if (!ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        ctx = new AudioCtx();
      }
    }
    if (ctx && ctx.state === 'suspended') {
      ctx.resume();
    }
    return ctx;
  }

  const AudioEngine = {
    init() {
      // Lazy unlock on first user interaction
      if (typeof window !== 'undefined' && window.addEventListener) {
        const unlock = () => {
          getCtx();
          window.removeEventListener('pointerdown', unlock);
          window.removeEventListener('keydown', unlock);
        };
        window.addEventListener('pointerdown', unlock);
        window.addEventListener('keydown', unlock);
      }
    },

    isMuted() {
      return muted;
    },

    toggleMute() {
      muted = !muted;
      return muted;
    },

    // 1. Crisp UI tap
    tap(pitch = 800) {
      if (muted) return;
      const c = getCtx();
      if (!c) return;
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(pitch, c.currentTime);
      osc.frequency.exponentialRampToValueAtTime(pitch * 0.4, c.currentTime + 0.04);
      gain.gain.setValueAtTime(0.08, c.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.04);
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start();
      osc.stop(c.currentTime + 0.04);
    },

    // 2. Building placement or upgrade mechanical clunk
    build() {
      if (muted) return;
      const c = getCtx();
      if (!c) return;
      const now = c.currentTime;

      // Bass thud
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(45, now + 0.12);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start(now);
      osc.stop(now + 0.12);

      // Metallic high sheen
      const chime = c.createOscillator();
      const cGain = c.createGain();
      chime.type = 'sine';
      chime.frequency.setValueAtTime(920, now + 0.03);
      chime.frequency.exponentialRampToValueAtTime(1380, now + 0.16);
      cGain.gain.setValueAtTime(0.08, now + 0.03);
      cGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      chime.connect(cGain);
      cGain.connect(c.destination);
      chime.start(now + 0.03);
      chime.stop(now + 0.18);
    },

    // 3. Tech Research Ascending Chime
    research() {
      if (muted) return;
      const c = getCtx();
      if (!c) return;
      const now = c.currentTime;
      const freqs = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      freqs.forEach((f, idx) => {
        const osc = c.createOscillator();
        const gain = c.createGain();
        const t = now + idx * 0.05;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, t);
        gain.gain.setValueAtTime(0.09, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
        osc.connect(gain);
        gain.connect(c.destination);
        osc.start(t);
        osc.stop(t + 0.28);
      });
    },

    // 4. Dark Matter collect ping
    darkMatter() {
      if (muted) return;
      const c = getCtx();
      if (!c) return;
      const now = c.currentTime;
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1100, now);
      osc.frequency.exponentialRampToValueAtTime(1760, now + 0.1);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start(now);
      osc.stop(now + 0.15);
    },

    // 5. Laser Pew (Sector Defense)
    laser() {
      if (muted) return;
      const c = getCtx();
      if (!c) return;
      const now = c.currentTime;
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(980, now);
      osc.frequency.exponentialRampToValueAtTime(120, now + 0.09);
      gain.gain.setValueAtTime(0.07, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start(now);
      osc.stop(now + 0.09);
    },

    // 6. Explosion / Impact
    explosion() {
      if (muted) return;
      const c = getCtx();
      if (!c) return;
      const now = c.currentTime;
      // Filtered noise explosion simulation
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(80, now);
      osc.frequency.exponentialRampToValueAtTime(20, now + 0.25);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start(now);
      osc.stop(now + 0.25);
    },

    // 7. Interstellar Warp Woosh
    warp() {
      if (muted) return;
      const c = getCtx();
      if (!c) return;
      const now = c.currentTime;

      // Low rumble sweep up
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(60, now);
      osc.frequency.exponentialRampToValueAtTime(320, now + 0.4);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.85);
      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(0.22, now + 0.35);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.85);
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start(now);
      osc.stop(now + 0.85);
    },

    // 8. Alien Species Scan
    scan() {
      if (muted) return;
      const c = getCtx();
      if (!c) return;
      const now = c.currentTime;
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.linearRampToValueAtTime(880, now + 0.15);
      osc.frequency.linearRampToValueAtTime(660, now + 0.3);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start(now);
      osc.stop(now + 0.32);
    }
  };

  G.Audio = AudioEngine;
  AudioEngine.init();
})(typeof window !== 'undefined' ? window.G : globalThis.G);
