/* ------------------------------------------------------------------
   Interactive Particle Field Engine (Canvas2D + Typed-Array SoA)
   Adapted with dual dark/light theme synchronization & View Transitions support.
------------------------------------------------------------------- */

(function (global) {
  "use strict";

  const CONFIG = {
    influence: 165, // px — cursor radius of influence
    spring: 0.022, // Hooke constant pulling points home
    damping: 0.9, // velocity decay per frame
    pointerLerp: 0.18, // cursor smoothing factor
    maxSpeed: 18, // px/frame velocity clamp
    baseRadius: 1.3, // resting dot radius (css px)
    radiusBoost: 2.1, // extra radius at full influence
    strength: {
      repel: 1.65,
      attract: 0.68,
      vortex: 1.25
    },
    pulseSpeed: 13, // px/frame shockwave expansion
    pulseWidth: 96, // shockwave band thickness
    targetParticles: 2400, // desktop budget
    targetParticlesMobile: 850
  };

  const THEMES = {
    dark: {
      ink: [186, 200, 220], // cool silver-slate dots
      accent: [56, 189, 248], // #38bdf8 vivid cyan accent
      line: [56, 189, 248], // luminous cyan tension web
      baseAlpha: 0.28,
      maxDotAlpha: 0.96,
      maxLineAlpha: 0.36,
      glowInnerAlpha: 0.16,
      glowMidAlpha: 0.055,
      pulseAlpha: 0.45
    },
    light: {
      ink: [30, 41, 59], // #1e293b crisp dark slate
      accent: [2, 132, 199], // #0284c7 sky accent
      line: [2, 132, 199], // crisp sky tension web
      baseAlpha: 0.25,
      maxDotAlpha: 0.94,
      maxLineAlpha: 0.3,
      glowInnerAlpha: 0.12,
      glowMidAlpha: 0.04,
      pulseAlpha: 0.4
    }
  };

  const PALETTE_STEPS = 24;
  const LINE_STEPS = 14;

  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  const smooth = (t) => t * t * (3 - 2 * t);

  class ParticleField {
    constructor(canvas, initialTheme) {
      this.canvas = canvas;
      const ctx = canvas.getContext("2d", { alpha: true });
      if (!ctx) throw new Error("2D canvas context unavailable");
      this.ctx = ctx;

      this.w = 0;
      this.h = 0;
      this.dpr = 1;
      this.lastW = 0;
      this.lastH = 0;

      this.spacing = 30;
      this.cols = 0;
      this.rows = 0;
      this.count = 0;

      this.ox = new Float32Array(0);
      this.oy = new Float32Array(0);
      this.px = new Float32Array(0);
      this.py = new Float32Array(0);
      this.vx = new Float32Array(0);
      this.vy = new Float32Array(0);
      this.dis = new Float32Array(0);

      this.mouse = { x: -9999, y: -9999, tx: -9999, ty: -9999, active: false, speed: 0 };
      this.mode = "repel";
      this.pulses = [];

      this.fps = 60;
      this.degraded = false;
      this.time = 0;
      this.frameCount = 0;
      this.lastTs = -1;

      this.themeName = initialTheme === "light" ? "light" : "dark";
      this.dotPalette = [];
      this.linePalette = [];
      this.glowSprite = null;

      this.buildThemeAssets();
    }

    buildThemeAssets() {
      const tCfg = THEMES[this.themeName] || THEMES.dark;
      const { ink, accent, line, baseAlpha, maxDotAlpha, maxLineAlpha, glowInnerAlpha, glowMidAlpha } = tCfg;

      this.dotPalette = [];
      for (let i = 0; i < PALETTE_STEPS; i++) {
        const t = i / (PALETTE_STEPS - 1);
        const r = Math.round(lerp(ink[0], accent[0], t));
        const g = Math.round(lerp(ink[1], accent[1], t));
        const b = Math.round(lerp(ink[2], accent[2], t));
        const a = lerp(baseAlpha, maxDotAlpha, Math.pow(t, 1.4));
        this.dotPalette.push(`rgba(${r},${g},${b},${a.toFixed(3)})`);
      }

      this.linePalette = [];
      for (let i = 0; i < LINE_STEPS; i++) {
        const a = (i / (LINE_STEPS - 1)) * maxLineAlpha;
        this.linePalette.push(`rgba(${line[0]},${line[1]},${line[2]},${a.toFixed(3)})`);
      }

      const s = 256;
      const c = document.createElement("canvas");
      c.width = s;
      c.height = s;
      const g = c.getContext("2d");
      if (g) {
        const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
        grad.addColorStop(0, `rgba(${accent[0]},${accent[1]},${accent[2]},${glowInnerAlpha})`);
        grad.addColorStop(0.45, `rgba(${accent[0]},${accent[1]},${accent[2]},${glowMidAlpha})`);
        grad.addColorStop(1, `rgba(${accent[0]},${accent[1]},${accent[2]},0)`);
        g.fillStyle = grad;
        g.fillRect(0, 0, s, s);
      }
      this.glowSprite = c;
    }

    syncTheme(themeName, redrawNow) {
      const normalized = themeName === "light" ? "light" : "dark";
      if (normalized === this.themeName && this.dotPalette.length) return;
      this.themeName = normalized;
      this.buildThemeAssets();
      if (redrawNow && this.count > 0) {
        this.render();
      }
    }

    resize() {
      const first = this.count === 0;
      this.w = window.innerWidth;
      this.h = window.innerHeight;
      this.dpr = clamp(window.devicePixelRatio || 1, 1, 2);

      this.canvas.width = Math.round(this.w * this.dpr);
      this.canvas.height = Math.round(this.h * this.dpr);
      this.canvas.style.width = `${this.w}px`;
      this.canvas.style.height = `${this.h}px`;
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

      const widthChanged = Math.abs(this.w - this.lastW) > 1;
      const bigHeightShift = Math.abs(this.h - this.lastH) > 140;
      if (first || widthChanged || bigHeightShift) {
        this.buildLattice(!first);
        this.lastW = this.w;
        this.lastH = this.h;
      }
    }

    buildLattice(settleInstantly) {
      const mobile = Math.min(this.w, this.h) < 640;
      const target = mobile ? CONFIG.targetParticlesMobile : CONFIG.targetParticles;
      this.spacing = clamp(Math.sqrt((this.w * this.h) / target), 24, 46);

      this.cols = Math.ceil(this.w / this.spacing) + 1;
      this.rows = Math.ceil(this.h / this.spacing) + 1;
      this.count = this.cols * this.rows;

      this.ox = new Float32Array(this.count);
      this.oy = new Float32Array(this.count);
      this.px = new Float32Array(this.count);
      this.py = new Float32Array(this.count);
      this.vx = new Float32Array(this.count);
      this.vy = new Float32Array(this.count);
      this.dis = new Float32Array(this.count);

      const dw = (this.cols - 1) * this.spacing;
      const dh = (this.rows - 1) * this.spacing;
      const mx = (this.w - dw) / 2;
      const my = (this.h - dh) / 2;

      let i = 0;
      for (let r = 0; r < this.rows; r++) {
        for (let c = 0; c < this.cols; c++, i++) {
          const jx = (Math.sin(i * 12.9898) * 43758.5453) % 1;
          const jy = (Math.sin(i * 78.233) * 12543.1234) % 1;
          const x = mx + c * this.spacing + jx * 2.4;
          const y = my + r * this.spacing + jy * 2.4;
          this.ox[i] = x;
          this.oy[i] = y;
          if (settleInstantly) {
            this.px[i] = x;
            this.py[i] = y;
          } else {
            // Smooth intro settle animation into the geometric lattice
            this.px[i] = x + (Math.random() - 0.5) * 90;
            this.py[i] = y + (Math.random() - 0.5) * 90;
            this.vx[i] = (Math.random() - 0.5) * 3.2;
            this.vy[i] = (Math.random() - 0.5) * 3.2;
          }
        }
      }
    }

    setPointer(x, y) {
      if (!this.mouse.active) {
        this.mouse.x = x;
        this.mouse.y = y;
        this.mouse.active = true;
      }
      this.mouse.tx = x;
      this.mouse.ty = y;
    }

    releasePointer() {
      this.mouse.active = false;
      this.mouse.tx = -9999;
      this.mouse.ty = -9999;
    }

    setMode(mode) {
      if (mode === "repel" || mode === "attract" || mode === "vortex") {
        this.mode = mode;
      }
    }

    pulse(x, y) {
      if (this.pulses.length > 5) this.pulses.shift();
      this.pulses.push({ x, y, r: 8, life: 1 });
    }

    frame(ms) {
      const dt = clamp(ms / 16.666, 0.4, 2.6);
      this.time += ms;
      this.frameCount++;

      if (this.lastTs >= 0 && ms > 0) {
        const inst = 1000 / ms;
        this.fps = lerp(this.fps, clamp(inst, 1, 240), 0.05);
      }
      this.lastTs = ms;

      this.step(dt);
      this.render();

      if (this.frameCount > 240 && this.frameCount % 120 === 0 && this.fps < 44 && this.spacing < 46) {
        this.degraded = true;
        this.spacing = Math.min(this.spacing + 8, 46);
        this.rebuildKeepingSpacing();
      }
    }

    rebuildKeepingSpacing() {
      const cols = Math.ceil(this.w / this.spacing) + 1;
      const rows = Math.ceil(this.h / this.spacing) + 1;
      this.cols = cols;
      this.rows = rows;
      this.count = cols * rows;

      this.ox = new Float32Array(this.count);
      this.oy = new Float32Array(this.count);
      this.px = new Float32Array(this.count);
      this.py = new Float32Array(this.count);
      this.vx = new Float32Array(this.count);
      this.vy = new Float32Array(this.count);
      this.dis = new Float32Array(this.count);

      const mx = (this.w - (cols - 1) * this.spacing) / 2;
      const my = (this.h - (rows - 1) * this.spacing) / 2;
      let i = 0;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++, i++) {
          const x = mx + c * this.spacing;
          const y = my + r * this.spacing;
          this.ox[i] = this.px[i] = x;
          this.oy[i] = this.py[i] = y;
        }
      }
    }

    step(dt) {
      const { influence, spring, damping, maxSpeed, strength } = CONFIG;
      const R2 = influence * influence;
      const dampF = Math.pow(damping, dt);
      const sp2 = maxSpeed * maxSpeed;

      const m = this.mouse;
      if (m.active) {
        const f = 1 - Math.pow(1 - CONFIG.pointerLerp, dt);
        const nx = lerp(m.x, m.tx, f);
        const ny = lerp(m.y, m.ty, f);
        m.speed = Math.hypot(nx - m.x, ny - m.y) / dt;
        m.x = nx;
        m.y = ny;
      }

      const mx = m.x;
      const my = m.y;
      const mode = this.mode;
      const str = strength[mode];

      const pulses = this.pulses;
      for (let p = pulses.length - 1; p >= 0; p--) {
        const pu = pulses[p];
        pu.r += CONFIG.pulseSpeed * dt;
        pu.life -= 0.014 * dt;
        if (pu.life <= 0) pulses.splice(p, 1);
      }

      const ox = this.ox;
      const oy = this.oy;
      const px = this.px;
      const py = this.py;
      const vx = this.vx;
      const vy = this.vy;
      const dis = this.dis;
      const n = this.count;
      const pulseBand = CONFIG.pulseWidth;

      for (let i = 0; i < n; i++) {
        let ax = (ox[i] - px[i]) * spring;
        let ay = (oy[i] - py[i]) * spring;

        const dx = px[i] - mx;
        const dy = py[i] - my;
        const d2 = dx * dx + dy * dy;
        if (d2 < R2 && d2 > 0.01) {
          const d = Math.sqrt(d2);
          const t = smooth(1 - d / influence);
          const ux = dx / d;
          const uy = dy / d;
          if (mode === "repel") {
            ax += ux * t * str;
            ay += uy * t * str;
          } else if (mode === "attract") {
            const core = clamp(d / 46, 0, 1);
            ax -= ux * t * str * core;
            ay -= uy * t * str * core;
            ax += -uy * t * str * core * 0.34;
            ay += ux * t * str * core * 0.34;
          } else {
            ax += -uy * t * str + ux * t * str * 0.16;
            ay += ux * t * str + uy * t * str * 0.16;
          }
        }

        for (let p = 0; p < pulses.length; p++) {
          const pu = pulses[p];
          const pdx = px[i] - pu.x;
          const pdy = py[i] - pu.y;
          const pd = Math.sqrt(pdx * pdx + pdy * pdy) || 0.0001;
          const band = Math.abs(pd - pu.r);
          if (band < pulseBand) {
            const f = (1 - band / pulseBand) * pu.life * 3.2;
            ax += (pdx / pd) * f;
            ay += (pdy / pd) * f;
          }
        }

        let nvx = (vx[i] + ax * dt) * dampF;
        let nvy = (vy[i] + ay * dt) * dampF;
        const v2 = nvx * nvx + nvy * nvy;
        if (v2 > sp2) {
          const s = maxSpeed / Math.sqrt(v2);
          nvx *= s;
          nvy *= s;
        }
        const npx = px[i] + nvx * dt;
        const npy = py[i] + nvy * dt;
        vx[i] = nvx;
        vy[i] = nvy;
        px[i] = npx;
        py[i] = npy;

        const ddx = npx - ox[i];
        const ddy = npy - oy[i];
        dis[i] = Math.sqrt(ddx * ddx + ddy * ddy);
      }
    }

    render() {
      const ctx = this.ctx;
      const { influence, baseRadius, radiusBoost } = CONFIG;
      const tCfg = THEMES[this.themeName] || THEMES.dark;
      const w = this.w;
      const h = this.h;
      const cols = this.cols;
      const n = this.count;
      const px = this.px;
      const py = this.py;
      const dis = this.dis;
      const m = this.mouse;

      ctx.clearRect(0, 0, w, h);

      if (m.active && this.glowSprite) {
        const breathe = 1 + Math.sin(this.time * 0.0022) * 0.06;
        const gr = influence * 2.4 * breathe * clamp(1 + m.speed * 0.02, 1, 1.5);
        ctx.drawImage(this.glowSprite, m.x - gr, m.y - gr, gr * 2, gr * 2);
      }

      ctx.lineWidth = 1;
      const linePal = this.linePalette;
      const lineMax = LINE_STEPS - 1;
      let lastLine = -1;
      for (let i = 0; i < n; i++) {
        const c = i % cols;
        if (c < cols - 1) {
          const j = i + 1;
          const s = dis[i] + dis[j];
          if (s > 7) {
            const b = Math.min(lineMax, ((s - 7) * 0.22) | 0);
            if (b !== lastLine) {
              ctx.strokeStyle = linePal[b];
              lastLine = b;
            }
            ctx.beginPath();
            ctx.moveTo(px[i], py[i]);
            ctx.lineTo(px[j], py[j]);
            ctx.stroke();
          }
        }
        const j = i + cols;
        if (j < n) {
          const s = dis[i] + dis[j];
          if (s > 7) {
            const b = Math.min(lineMax, ((s - 7) * 0.22) | 0);
            if (b !== lastLine) {
              ctx.strokeStyle = linePal[b];
              lastLine = b;
            }
            ctx.beginPath();
            ctx.moveTo(px[i], py[i]);
            ctx.lineTo(px[j], py[j]);
            ctx.stroke();
          }
        }
      }

      const R = influence;
      const dotPal = this.dotPalette;
      const palMax = PALETTE_STEPS - 1;
      const tNow = this.time * 0.0011;
      let lastFill = -1;

      for (let i = 0; i < n; i++) {
        const x = px[i];
        const y = py[i];

        let prox = 0;
        if (m.active) {
          const dx = x - m.x;
          const dy = y - m.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < R * R) prox = smooth(1 - Math.sqrt(d2) / R);
        }
        const heat = clamp(dis[i] / 22, 0, 1);
        const intensity = prox > heat ? prox : heat;

        const b = (intensity * palMax) | 0;
        if (b !== lastFill) {
          ctx.fillStyle = dotPal[b];
          lastFill = b;
        }

        const idle = 1 + Math.sin(tNow + i * 0.617) * 0.1;
        const r = (baseRadius + radiusBoost * intensity) * idle;

        ctx.beginPath();
        ctx.arc(x, y, r, 0, 6.283185307);
        ctx.fill();
      }

      const pulses = this.pulses;
      if (pulses.length) {
        const [ar, ag, ab] = tCfg.accent;
        for (const pu of pulses) {
          ctx.strokeStyle = `rgba(${ar},${ag},${ab},${(pu.life * tCfg.pulseAlpha).toFixed(3)})`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(pu.x, pu.y, pu.r, 0, 6.283185307);
          ctx.stroke();
        }
        ctx.lineWidth = 1;
      }
    }

    renderStatic() {
      for (let i = 0; i < this.count; i++) {
        this.px[i] = this.ox[i];
        this.py[i] = this.oy[i];
        this.dis[i] = 0;
      }
      this.render();
    }
  }

  global.ParticleField = ParticleField;
})(window);
