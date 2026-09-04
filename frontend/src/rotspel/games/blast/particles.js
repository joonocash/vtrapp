// particles.js — ett canvaslager ovanpå brädet. DOM-element per partikel skulle
// döda mobilen, canvas klarar tusentals.

export class ParticleField {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext ? canvas.getContext('2d') : null;
    this.parts = [];
    this.raf = null;
    this.last = 0;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    this.resize();
  }

  resize() {
    if (!this.ctx) return;
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = Math.max(1, Math.floor(rect.width * this.dpr));
    this.canvas.height = Math.max(1, Math.floor(rect.height * this.dpr));
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.w = rect.width;
    this.h = rect.height;
  }

  burst(x, y, color, { count = 10, power = 200, size = 4, life = 0.55 } = {}) {
    if (this.reduced || !this.ctx) return;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = power * (0.35 + Math.random() * 0.85);
      this.parts.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - power * 0.35,
        life: life * (0.7 + Math.random() * 0.6),
        age: 0,
        size: size * (0.5 + Math.random()),
        color,
        spin: (Math.random() - 0.5) * 12,
        rot: Math.random() * Math.PI,
      });
    }
    this.start();
  }

  // Ett brett svep när något stort händer.
  shockwave(x, y, color) {
    if (this.reduced || !this.ctx) return;
    this.parts.push({ ring: true, x, y, r: 8, life: 0.45, age: 0, color });
    this.start();
  }

  start() {
    if (this.raf || !this.ctx) return;
    this.last = performance.now();
    const loop = (now) => {
      const dt = Math.min((now - this.last) / 1000, 0.05);
      this.last = now;
      this.step(dt);
      if (this.parts.length) this.raf = requestAnimationFrame(loop);
      else { this.raf = null; this.ctx.clearRect(0, 0, this.w, this.h); }
    };
    this.raf = requestAnimationFrame(loop);
  }

  step(dt) {
    const { ctx } = this;
    ctx.clearRect(0, 0, this.w, this.h);
    const keep = [];
    for (const p of this.parts) {
      p.age += dt;
      if (p.age >= p.life) continue;
      const t = p.age / p.life;

      if (p.ring) {
        const r = p.r + t * 130;
        ctx.globalAlpha = (1 - t) * 0.5;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 6 * (1 - t);
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.stroke();
        keep.push(p);
        continue;
      }

      p.vy += 900 * dt;
      p.vx *= 0.99;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.spin * dt;

      ctx.globalAlpha = 1 - t * t;
      ctx.fillStyle = p.color;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      const s = p.size * (1 - t * 0.4);
      ctx.fillRect(-s / 2, -s / 2, s, s);
      ctx.restore();
      keep.push(p);
    }
    ctx.globalAlpha = 1;
    this.parts = keep;
  }

  destroy() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = null;
    this.parts = [];
  }
}
