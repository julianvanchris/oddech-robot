/* Oddech simulation engine.
   Indoor PM2.5 transport in a model flat, a fixed monitor and the Oddech robot with a telescoping sensor mast,
   a probabilistic map (Gaussian process on log concentration with a mass-balance prior), path planning, a battery,
   advice in four wordings, inhaled dose, and the H1 benchmark (4 fixed sensors vs 3 fixed + robot).
   Plain JavaScript, no dependencies: window.OddechSim in the browser, module.exports in Node (test_sim.js).
   Units: metres, seconds, micrograms per cubic metre. Everything here is a model room, not a measurement. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.OddechSim = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // ------------------------------------------------------------------ room and grid
  const ROOM = { Lx: 8, Ly: 6, H: 2.7 };
  const NX = 40, NY = 30, NZ = 9;
  const DX = ROOM.Lx / NX, DY = ROOM.Ly / NY, DZ = ROOM.H / NZ;
  const NCELL = NX * NY * NZ, VCELL = DX * DY * DZ, VROOM = ROOM.Lx * ROOM.Ly * ROOM.H;
  const idx = (i, j, k) => i + NX * (j + NY * k);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  // model parameters (assumptions for the demonstration; stated on the page)
  const PHYS = {
    K: 0.04,              // turbulent diffusivity, m2/s
    kd: 0.3 / 3600,       // PM2.5 deposition to surfaces, 1/s
    lam: 0.5 / 3600,      // infiltration air exchange, window closed, 1/s
    P: 0.8,               // penetration factor through the envelope
    Qwin: 0.08,           // exchange through the open window, m3/s
  };
  // relative oxidative potential per unit mass, by source (illustrative; motivated by Daellenbach et al. 2020:
  // oxidative potential comes mostly from anthropogenic combustion, e.g. residential biomass burning, not from mass alone)
  const TOX = { out: 1.4, stove: 0.7, candle: 1.6, mat: 0.5 };

  const LAYOUT = {
    window: { x0: 4.6, x1: 6.4, z0: 0.9, z1: 2.2 },       // back wall, y = Ly
    door: { y0: 4.55, y1: 5.45 },                          // right wall, x = Lx
    stove: { x: 1.25, y: 5.62, z: 0.95 },
    candle: { x: 4.0, y: 4.1, z: 0.85 },
    mat: { x0: 2.7, x1: 4.3, y0: 0.9, y1: 2.5 },
    dock: { x: 7.45, y: 5.0 },
    obstacles: [                                           // x0, y0, x1, y1, height, name
      [0, 5.35, 2.8, 6, 0.9, "kitchen counter"],
      [0, 3.4, 0.62, 5.35, 0.9, "kitchen counter"],
      [3.15, 3.55, 4.85, 4.65, 0.75, "dining table"],
      [4.6, 0.15, 6.9, 1.05, 0.8, "sofa"],
      [5.0, 1.5, 6.2, 2.05, 0.42, "coffee table"],
      [7.62, 1.2, 8, 4.3, 1.9, "bookshelf"],
    ],
    people: [
      { id: "child", label: "Child on the play mat", x: 3.5, y: 1.7, z: 0.45, vE: 0.32 },   // breathing m3/h, assumed
      { id: "adult", label: "Adult on the sofa", x: 5.75, y: 0.62, z: 1.1, vE: 0.54 },
    ],
    monitor: { x: 7.72, y: 2.6, z: 1.25 },                 // the household's own monitor, on the bookshelf
    purifier: { x: 7.25, y: 0.55 },
    bench: [{ x: 7.72, y: 2.6, z: 1.25 }, { x: 0.75, y: 3.0, z: 1.2 }, { x: 5.5, y: 5.75, z: 1.0 }, { x: 4.3, y: 0.35, z: 0.8 }],
  };
  const MAST = [0.4, 1.1, 1.6];                            // sensor heights: child on the floor, seated, standing

  const ZONES = [
    { name: "the kitchen", x0: 0, x1: 2.9, y0: 3.3, y1: 6 },
    { name: "the window", x0: 4.3, x1: 6.9, y0: 4.7, y1: 6 },
    { name: "the dining table", x0: 2.9, x1: 5.0, y0: 3.0, y1: 4.7 },
    { name: "the hallway door", x0: 6.9, x1: 8, y0: 4.3, y1: 6 },
    { name: "the play mat", x0: 2.2, x1: 4.6, y0: 0, y1: 3.0 },
    { name: "the sofa", x0: 4.6, x1: 8, y0: 0, y1: 2.4 },
  ];
  const zoneOf = (x, y) => (ZONES.find(z => x >= z.x0 && x < z.x1 && y >= z.y0 && y < z.y1) || { name: "the middle of the room" }).name;

  // ------------------------------------------------------------------ random numbers
  function rngOf(seed) {                                   // mulberry32
    let a = seed >>> 0;
    const r = () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    r.gauss = () => { let u = 0; while (u === 0) u = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r()); };
    return r;
  }

  // ------------------------------------------------------------------ flow: velocity = curl of a vector potential
  // Every component is a vector potential A, tapered to zero at the walls, so the discrete face velocities are
  // exactly divergence-free and no air crosses a wall (exchange through the open window is a source term).
  const sstep = (d, w) => { const t = clamp(d / w, 0, 1); return t * t * (3 - 2 * t); };
  const taper = (x, y, z) => sstep(x, 0.35) * sstep(ROOM.Lx - x, 0.35) * sstep(y, 0.35) * sstep(ROOM.Ly - y, 0.35) * sstep(z, 0.2) * sstep(ROOM.H - z, 0.2);

  function makePotential(cfg) {
    const comps = [];
    // slow room-scale circulation (occupants, heating): 7 cm/s, opposite at floor and ceiling
    comps.push((x, y, z, out) => {
      const s = 0.07 * ROOM.Ly / Math.PI;
      out[2] += s * Math.sin(Math.PI * x / ROOM.Lx) * Math.sin(Math.PI * y / ROOM.Ly) * Math.cos(Math.PI * z / ROOM.H);
    });
    // toroidal cell: air drawn in low, lifted through a core of radius a, thrown out high (purifier, cooking plume)
    const torus = (xc, yc, Q, a, R, z0) => (x, y, z, out) => {
      if (z <= z0) return;
      const dx = x - xc, dy = y - yc, r2 = dx * dx + dy * dy;
      const h = Math.sin(Math.PI * (z - z0) / (ROOM.H - z0));
      const f = r2 < 1e-9 ? 1 / (a * a) : (1 - Math.exp(-r2 / (a * a))) / r2;
      const psi = Q / (2 * Math.PI) * f * Math.exp(-r2 / (R * R)) * h;    // Stokes stream function / r^2
      out[0] += -psi * dy; out[1] += psi * dx;
    };
    if (cfg.purifierOn && cfg.cadr > 0) comps.push(torus(cfg.purifier.x, cfg.purifier.y, cfg.cadr, 0.22, 2.5, 0));
    if (cfg.stoveOn) comps.push(torus(LAYOUT.stove.x, LAYOUT.stove.y, 0.04, 0.25, 0.9, 0.9));
    // open window: cold air slides in along the floor, warm air leaves at the top
    if (cfg.windowOpen) {
      const W = LAYOUT.window, xm = (W.x0 + W.x1) / 2, Ld = 0.9, V = 0.22;
      comps.push((x, y, z, out) => {
        const d = (ROOM.Ly - y) / Ld, m = Math.exp(-((x - xm) * (x - xm)) / (2 * 0.8 * 0.8));
        out[0] += -V * (ROOM.H / Math.PI) * d * Math.exp(1 - d) * Math.sin(Math.PI * z / ROOM.H) * m;
      });
    }
    const buf = [0, 0, 0];
    return (x, y, z) => {
      buf[0] = buf[1] = buf[2] = 0;
      for (const c of comps) c(x, y, z, buf);
      const t = taper(x, y, z);
      return [buf[0] * t, buf[1] * t, buf[2] * t];
    };
  }

  function makeFlow(cfg) {
    const A = makePotential(cfg);
    const u = new Float32Array((NX + 1) * NY * NZ), v = new Float32Array(NX * (NY + 1) * NZ), w = new Float32Array(NX * NY * (NZ + 1));
    const hx = DX / 2, hy = DY / 2, hz = DZ / 2;
    let umax = 0, vmax = 0, wmax = 0;
    for (let k = 0; k < NZ; k++) for (let j = 0; j < NY; j++) for (let i = 0; i <= NX; i++) {
      const x = i * DX, y = (j + 0.5) * DY, z = (k + 0.5) * DZ;
      const val = (A(x, y + hy, z)[2] - A(x, y - hy, z)[2]) / DY - (A(x, y, z + hz)[1] - A(x, y, z - hz)[1]) / DZ;
      u[i + (NX + 1) * (j + NY * k)] = val; umax = Math.max(umax, Math.abs(val) / DX);
    }
    for (let k = 0; k < NZ; k++) for (let j = 0; j <= NY; j++) for (let i = 0; i < NX; i++) {
      const x = (i + 0.5) * DX, y = j * DY, z = (k + 0.5) * DZ;
      const val = (A(x, y, z + hz)[0] - A(x, y, z - hz)[0]) / DZ - (A(x + hx, y, z)[2] - A(x - hx, y, z)[2]) / DX;
      v[i + NX * (j + (NY + 1) * k)] = val; vmax = Math.max(vmax, Math.abs(val) / DY);
    }
    for (let k = 0; k <= NZ; k++) for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
      const x = (i + 0.5) * DX, y = (j + 0.5) * DY, z = k * DZ;
      const val = (A(x + hx, y, z)[1] - A(x - hx, y, z)[1]) / DX - (A(x, y + hy, z)[0] - A(x, y - hy, z)[0]) / DY;
      w[idx(i, j, 0) + NX * NY * k] = val; wmax = Math.max(wmax, Math.abs(val) / DZ);
    }
    const diff = 2 * PHYS.K * (1 / (DX * DX) + 1 / (DY * DY) + 1 / (DZ * DZ));
    return { u, v, w, dtMax: 0.85 / (umax + vmax + wmax + diff + 1.6) };   // 1.6/s covers the strongest sink
  }

  // ------------------------------------------------------------------ the air (truth)
  class Air {
    constructor(cfg) {
      this.cfg = Object.assign({ cout: 70, windowOpen: false, stoveOn: false, candleOn: false, matOn: false,
        stoveRate: 25, candleRate: 4, matRate: 6, purifierOn: false, cadr: 300 / 3600, purifier: Object.assign({}, LAYOUT.purifier) }, cfg || {});
      this.C = new Float32Array(NCELL); this.D = new Float32Array(NCELL); this.O = new Float32Array(NCELL);
      this.C.fill(PHYS.lam * PHYS.P * this.cfg.cout / (PHYS.lam + PHYS.kd));
      this.O.fill(PHYS.lam * PHYS.P * this.cfg.cout * TOX.out / (PHYS.lam + PHYS.kd));   // toxicity-weighted field
      this.t = 0; this.rebuild();
    }
    rebuild() {
      this.flow = makeFlow(this.cfg);
      const W = LAYOUT.window, p = this.cfg.purifier;
      this.winCells = [];
      for (let k = 0; k < NZ; k++) for (let i = 0; i < NX; i++) {
        const x = (i + 0.5) * DX, z = (k + 0.5) * DZ;
        if (x > W.x0 && x < W.x1 && z > W.z0 && z < W.z1) this.winCells.push(idx(i, NY - 1, k));
      }
      this.intake = [];
      for (let k = 0; k < NZ; k++) for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
        const x = (i + 0.5) * DX, y = (j + 0.5) * DY, z = (k + 0.5) * DZ;
        if (Math.hypot(x - p.x, y - p.y) < 0.3 && z < 0.75) this.intake.push(idx(i, j, k));
      }
      const cell = (s) => idx(clamp(Math.floor(s.x / DX), 0, NX - 1), clamp(Math.floor(s.y / DY), 0, NY - 1), clamp(Math.floor(s.z / DZ), 0, NZ - 1));
      this.srcCells = { stove: cell(LAYOUT.stove), candle: cell(LAYOUT.candle), mat: cell({ x: 3.5, y: 1.7, z: 0.2 }) };
    }
    set(patch) {                                           // change sources, window, purifier; rebuild the flow if needed
      const flowKeys = ["windowOpen", "stoveOn", "purifierOn", "cadr", "purifier"];
      const need = flowKeys.some(key => key in patch && JSON.stringify(patch[key]) !== JSON.stringify(this.cfg[key]));
      Object.assign(this.cfg, patch);
      if (need) this.rebuild();
    }
    advance(seconds) {
      let left = seconds;
      while (left > 1e-6) { const dt = Math.min(left, this.flow.dtMax); this.step(dt); left -= dt; }
    }
    step(dt) {                                             // mass field, then the toxicity-weighted field (same flow, same sinks)
      this.stepField(this.C, dt, this.cfg.cout, { stove: 1, candle: 1, mat: 1 });
      this.stepField(this.O, dt, this.cfg.cout * TOX.out, TOX);
      this.t += dt;
    }
    stepField(C, dt, cin, wt) {
      const D = this.D, { u, v, w } = this.flow, K = PHYS.K, cfg = this.cfg;
      D.fill(0);
      for (let k = 0; k < NZ; k++) for (let j = 0; j < NY; j++) {
        const row = NX * (j + NY * k), ur = (NX + 1) * (j + NY * k);
        for (let i = 1; i < NX; i++) {
          const a = row + i - 1, b = a + 1, uf = u[ur + i];
          const f = (uf > 0 ? uf * C[a] : uf * C[b]) - K * (C[b] - C[a]) / DX;
          D[a] -= f / DX; D[b] += f / DX;
        }
      }
      for (let k = 0; k < NZ; k++) for (let j = 1; j < NY; j++) {
        const rb = NX * (j + NY * k), ra = rb - NX, vr = NX * (j + (NY + 1) * k);
        for (let i = 0; i < NX; i++) {
          const a = ra + i, b = rb + i, vf = v[vr + i];
          const f = (vf > 0 ? vf * C[a] : vf * C[b]) - K * (C[b] - C[a]) / DY;
          D[a] -= f / DY; D[b] += f / DY;
        }
      }
      const L = NX * NY;
      for (let k = 1; k < NZ; k++) for (let n = 0; n < L; n++) {
        const a = n + L * (k - 1), b = a + L, wf = w[n + L * k];
        const f = (wf > 0 ? wf * C[a] : wf * C[b]) - K * (C[b] - C[a]) / DZ;
        D[a] -= f / DZ; D[b] += f / DZ;
      }
      const gain = PHYS.lam * PHYS.P * cin, loss = PHYS.lam + PHYS.kd;
      for (let n = 0; n < NCELL; n++) D[n] += gain - loss * C[n];
      if (cfg.windowOpen) { const r = PHYS.Qwin / (this.winCells.length * VCELL); for (const n of this.winCells) D[n] += r * (cin - C[n]); }
      if (cfg.purifierOn && cfg.cadr > 0) { const r = cfg.cadr / (this.intake.length * VCELL); for (const n of this.intake) D[n] -= r * C[n]; }
      if (cfg.stoveOn) D[this.srcCells.stove] += wt.stove * cfg.stoveRate / VCELL;
      if (cfg.candleOn) D[this.srcCells.candle] += wt.candle * cfg.candleRate / VCELL;
      if (cfg.matOn) D[this.srcCells.mat] += wt.mat * cfg.matRate / VCELL;
      for (let n = 0; n < NCELL; n++) { const c = C[n] + dt * D[n]; C[n] = c > 0 ? c : 0; }
    }
    at(x, y, z) { return this.sample(this.C, x, y, z); }
    opAt(x, y, z) { return this.sample(this.O, x, y, z); }   // toxicity-weighted concentration
    sample(C, x, y, z) {                                   // trilinear, cell-centred
      const fx = clamp(x / DX - 0.5, 0, NX - 1.001), fy = clamp(y / DY - 0.5, 0, NY - 1.001), fz = clamp(z / DZ - 0.5, 0, NZ - 1.001);
      const i = Math.floor(fx), j = Math.floor(fy), k = Math.floor(fz), a = fx - i, b = fy - j, c = fz - k;
      const n = idx(i, j, k), sy = NX, sz = NX * NY;
      const c00 = C[n] * (1 - a) + C[n + 1] * a, c10 = C[n + sy] * (1 - a) + C[n + sy + 1] * a;
      const c01 = C[n + sz] * (1 - a) + C[n + sz + 1] * a, c11 = C[n + sz + sy] * (1 - a) + C[n + sz + sy + 1] * a;
      return (c00 * (1 - b) + c10 * b) * (1 - c) + (c01 * (1 - b) + c11 * b) * c;
    }
    plane(z, out, C) {                                     // NX*NY slice at height z, of the dust (default) or the harm field
      out = out || new Float32Array(NX * NY); C = C || this.C;
      const fz = clamp(z / DZ - 0.5, 0, NZ - 1.001), k = Math.floor(fz), c = fz - k, L = NX * NY;
      for (let n = 0; n < L; n++) out[n] = C[n + L * k] * (1 - c) + C[n + L * (k + 1)] * c;
      return out;
    }
    velocity(x, y, z) {                                    // piecewise-linear face velocity, for the particles
      const i = clamp(Math.floor(x / DX), 0, NX - 1), j = clamp(Math.floor(y / DY), 0, NY - 1), k = clamp(Math.floor(z / DZ), 0, NZ - 1);
      const ax = clamp(x / DX - i, 0, 1), ay = clamp(y / DY - j, 0, 1), az = clamp(z / DZ - k, 0, 1), { u, v, w } = this.flow;
      const ui = i + (NX + 1) * (j + NY * k), vi = i + NX * (j + (NY + 1) * k), wi = idx(i, j, k);
      return [u[ui] * (1 - ax) + u[ui + 1] * ax, v[vi] * (1 - ay) + v[vi + NX] * ay, w[wi] * (1 - az) + w[wi + NX * NY] * az];
    }
    mean() { let s = 0; for (let n = 0; n < NCELL; n++) s += this.C[n]; return s / NCELL; }
    mass() { return this.mean() * VROOM; }                 // micrograms in the room
  }

  // ------------------------------------------------------------------ the map: Gaussian process on log concentration
  const LOG = c => Math.log(Math.max(c, 0) + 2), EXP = y => Math.max(0, Math.exp(y) - 2);
  class FieldMap {
    constructor(o) {
      o = o || {};
      this.ell = o.ell || 1.3; this.ellZ = o.ellZ || 1.2; this.ellT = o.ellT || 240; this.sf2 = Math.pow(o.sf || 0.75, 2);
      this.maxN = o.maxN || 90; this.samples = []; this.ready = false; this.n = 0;
    }
    add(s) { this.samples.push(s); this.dirty = true; }
    k(a, b) {
      const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z, dt = a.t - b.t;
      return this.sf2 * Math.exp(-(dx * dx + dy * dy) / (2 * this.ell * this.ell) - dz * dz / (2 * this.ellZ * this.ellZ) - dt * dt / (2 * this.ellT * this.ellT));
    }
    fit(t, priorMean) {                                    // priorMean: log-space mass-balance prior at time t
      this.t = t;
      this.samples = this.samples.filter(s => t - s.t < 3 * this.ellT);
      if (this.samples.length > this.maxN) this.samples = this.samples.slice(-this.maxN);
      const S = this.samples, n = S.length;
      let r = 0; for (const s of S) r += LOG(s.c) - priorMean;
      this.m = priorMean + (n ? r / (n + 3) : 0);          // shrunk offset: the prior is only a starting point
      const Lm = new Float64Array(n * n);
      for (let i = 0; i < n; i++) for (let j = 0; j <= i; j++) Lm[i * n + j] = this.k(S[i], S[j]) + (i === j ? S[i].sn * S[i].sn + 1e-6 : 0);
      for (let j = 0; j < n; j++) {                        // Cholesky in place, lower triangle
        let d = Lm[j * n + j];
        for (let q = 0; q < j; q++) d -= Lm[j * n + q] * Lm[j * n + q];
        d = Math.sqrt(Math.max(d, 1e-9)); Lm[j * n + j] = d;
        for (let i = j + 1; i < n; i++) {
          let s = Lm[i * n + j];
          for (let q = 0; q < j; q++) s -= Lm[i * n + q] * Lm[j * n + q];
          Lm[i * n + j] = s / d;
        }
      }
      const y = new Float64Array(n);
      for (let i = 0; i < n; i++) y[i] = LOG(S[i].c) - this.m;
      const z = this.fwd(Lm, n, y), alpha = new Float64Array(n);
      for (let i = n - 1; i >= 0; i--) { let s = z[i]; for (let q = i + 1; q < n; q++) s -= Lm[q * n + i] * alpha[q]; alpha[i] = s / Lm[i * n + i]; }
      this.L = Lm; this.alpha = alpha; this.n = n; this.dirty = false; this.ready = true;
    }
    fwd(Lm, n, b) { const z = new Float64Array(n); for (let i = 0; i < n; i++) { let s = b[i]; for (let q = 0; q < i; q++) s -= Lm[i * n + q] * z[q]; z[i] = s / Lm[i * n + i]; } return z; }
    predict(p, withSd) {                                   // p = {x, y, z, t}; log-space mean and sd
      const n = this.n, S = this.samples, ks = new Float64Array(n);
      let mu = this.m === undefined ? LOG(35) : this.m;
      for (let i = 0; i < n; i++) { ks[i] = this.k(p, S[i]); mu += ks[i] * this.alpha[i]; }
      if (!withSd) return { mu };
      let v = this.sf2; if (n) { const z = this.fwd(this.L, n, ks); for (let i = 0; i < n; i++) v -= z[i] * z[i]; }
      return { mu, sd: Math.sqrt(Math.max(v, 1e-6)) };
    }
    grid(z, t, nx, ny, withSd) {                           // predictions at the cell centres of an nx*ny grid
      const mu = new Float32Array(nx * ny), sd = withSd ? new Float32Array(nx * ny) : null, p = { x: 0, y: 0, z, t };
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        p.x = (i + 0.5) * ROOM.Lx / nx; p.y = (j + 0.5) * ROOM.Ly / ny;
        const r = this.predict(p, withSd); mu[i + nx * j] = r.mu; if (withSd) sd[i + nx * j] = r.sd;
      }
      return { mu, sd, nx, ny };
    }
  }

  // ------------------------------------------------------------------ where the robot may drive
  function occupancy(purifier) {
    const occ = new Uint8Array(NX * NY), R = 0.24;           // robot radius 0.17 m plus a margin
    for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
      const x = (i + 0.5) * DX, y = (j + 0.5) * DY;
      let blocked = x < R || y < R || x > ROOM.Lx - R || y > ROOM.Ly - R;
      for (const o of LAYOUT.obstacles) if (x > o[0] - R && x < o[2] + R && y > o[1] - R && y < o[3] + R) blocked = true;
      for (const p of LAYOUT.people) if (Math.hypot(x - p.x, y - p.y) < 0.75) blocked = true;      // keep clear of people
      if (purifier && Math.hypot(x - purifier.x, y - purifier.y) < 0.2 + R) blocked = true;
      occ[i + NX * j] = blocked ? 1 : 0;
    }
    return occ;
  }
  const cellOf = (x, y) => [clamp(Math.floor(x / DX), 0, NX - 1), clamp(Math.floor(y / DY), 0, NY - 1)];
  function nearestFree(occ, x, y) {
    const [ci, cj] = cellOf(x, y); let best = null, bd = 1e9;
    for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) if (!occ[i + NX * j]) {
      const d = (i - ci) * (i - ci) + (j - cj) * (j - cj); if (d < bd) { bd = d; best = [i, j]; }
    }
    return best;
  }
  function astar(occ, sx, sy, tx, ty) {                    // 8-connected A*, then string pulling; waypoints in metres
    const s = nearestFree(occ, sx, sy), g = nearestFree(occ, tx, ty);
    if (!s || !g) return null;
    const N = NX * NY, start = s[0] + NX * s[1], goal = g[0] + NX * g[1];
    const gs = new Float32Array(N).fill(Infinity), f = new Float32Array(N).fill(Infinity), from = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
    const h = n => { const dx = Math.abs(n % NX - g[0]), dy = Math.abs(Math.floor(n / NX) - g[1]); return Math.max(dx, dy) + 0.414 * Math.min(dx, dy); };
    const open = [start]; gs[start] = 0; f[start] = h(start);
    while (open.length) {
      let bi = 0; for (let q = 1; q < open.length; q++) if (f[open[q]] < f[open[bi]]) bi = q;
      const cur = open[bi]; open[bi] = open[open.length - 1]; open.pop();
      if (cur === goal) break;
      if (closed[cur]) continue; closed[cur] = 1;
      const ci = cur % NX, cj = Math.floor(cur / NX);
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const ni = ci + di, nj = cj + dj;
        if (ni < 0 || nj < 0 || ni >= NX || nj >= NY) continue;
        const nb = ni + NX * nj;
        if (occ[nb] || (di && dj && (occ[ci + di + NX * cj] || occ[ci + NX * (cj + dj)]))) continue;
        const ng = gs[cur] + (di && dj ? 1.414 : 1);
        if (ng < gs[nb]) { gs[nb] = ng; from[nb] = cur; f[nb] = ng + h(nb); open.push(nb); }
      }
    }
    if (from[goal] < 0 && goal !== start) return null;
    const cells = []; for (let n = goal; n >= 0; n = from[n]) { cells.push(n); if (n === start) break; }
    cells.reverse();
    const pts = cells.map(n => ({ x: (n % NX + 0.5) * DX, y: (Math.floor(n / NX) + 0.5) * DY }));
    const free = (a, b) => {
      const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / (DX / 3)));
      for (let q = 0; q <= steps; q++) { const [i, j] = cellOf(a.x + (b.x - a.x) * q / steps, a.y + (b.y - a.y) * q / steps); if (occ[i + NX * j]) return false; }
      return true;
    };
    const out = [pts[0]]; let a = 0;
    while (a < pts.length - 1) { let b = pts.length - 1; while (b > a + 1 && !free(pts[a], pts[b])) b--; out.push(pts[b]); a = b; }
    return out;
  }

  // ------------------------------------------------------------------ the robot
  // ------------------------------------------------------------------ one robot's unit economics (section 10; planning assumptions)
  // hw: parts and assembly, EUR; fee: monthly fee; cart: cartridges per month; pc: cartridge price (made for half of it);
  // svc: service and cloud cost per month; life: months in service
  function unitEconomics(o) {
    const gm = o.fee - o.svc + o.cart * o.pc / 2, pay = gm > 0 ? o.hw / gm : Infinity;
    return { gm, pay, ltv: gm * o.life - o.hw };
  }

  const POWER = { idle: 15, drive: 8, mast: 6, charge: 60, capacity: 100 };  // W and Wh: design targets (idle includes the 6 W cell bay)
  class Robot {
    constructor(policy, rng) {
      this.policy = policy; this.rng = rng; this.x = 6.6; this.y = 3.0; this.th = Math.PI; this.v = 0;
      this.state = "plan"; this.mast = MAST[0]; this.path = []; this.target = null;
      this.battery = POWER.capacity * 0.92; this.hIdx = 0; this.dwell = 0; this.acc = 0; this.nacc = 0;
      this.trail = []; this.profile = [null, null, null]; this.visits = 0; this.bias = 0.03;
      this.patrol = [[1.5, 2.2], [2.2, 0.6], [4.2, 2.9], [6.6, 2.6], [6.4, 4.0], [5.2, 5.1], [2.2, 4.4], [1.4, 3.1]]; this.pi = 0;
    }
    get pct() { return 100 * this.battery / POWER.capacity; }
    choose(world, obs) {                                   // the next place to measure
      const occ = world.occ, map = obs.map;
      if (this.battery < 0.2 * POWER.capacity) return { x: LAYOUT.dock.x, y: LAYOUT.dock.y, why: "battery low: back to the dock", dock: true };
      if (this.policy === "patrol") { const p = this.patrol[this.pi++ % this.patrol.length]; return { x: p[0], y: p[1], why: "next stop on a fixed route" }; }
      if (this.policy === "random") {
        for (let q = 0; q < 400; q++) { const i = Math.floor(this.rng() * NX), j = Math.floor(this.rng() * NY); if (!occ[i + NX * j]) return { x: (i + 0.5) * DX, y: (j + 0.5) * DY, why: "a random free spot" }; }
        return null;
      }
      const g = map.grid(1.0, world.t, 20, 15, true);
      let best = -1, bs = -Infinity, bmu = 0, bsd = 0;
      for (let j = 0; j < 15; j++) for (let i = 0; i < 20; i++) {
        const x = (i + 0.5) * 0.4, y = (j + 0.5) * 0.4, [ci, cj] = cellOf(x, y);
        if (occ[ci + NX * cj]) continue;
        const n = i + 20 * j, sd = g.sd[n], mu = g.mu[n], dist = Math.hypot(x - this.x, y - this.y);
        let s;
        if (this.policy === "explore") s = sd / (1 + dist / 6);
        else if (this.policy === "hunt") s = (mu + 2 * sd) / (1 + dist / 6);
        else {                                             // oddech: uncertainty where people breathe, worth the trip
          let wgt = 0; for (const p of LAYOUT.people) wgt += Math.exp(-((x - p.x) ** 2 + (y - p.y) ** 2) / (2 * 1.1 * 1.1));
          s = sd * (1 + 1.0 * wgt) * (1 + 0.35 * Math.max(0, mu - map.m)) / (1 + dist / 5);
        }
        if (dist < 0.5) s *= 0.2;                          // it was just here
        if (s > bs) { bs = s; best = n; bmu = mu; bsd = sd; }
      }
      if (best < 0) return null;
      const x = (best % 20 + 0.5) * 0.4, y = (Math.floor(best / 20) + 0.5) * 0.4;
      const why = this.policy === "hunt" ? "the likely hot spot" : this.policy === "explore" ? "where the map is least sure"
        : "least sure where people breathe";
      return { x, y, why, mu: EXP(bmu), sd: bsd };
    }
    update(dt, world, obs) {
      const out = [];
      let watts = POWER.idle;
      if (this.state === "plan") {
        const tg = this.choose(world, obs);
        const path = tg && astar(world.occ, this.x, this.y, tg.x, tg.y);
        this.hIdx = 0;
        if (path && path.length) { this.target = tg; this.path = path.slice(1); this.state = this.path.length ? "drive" : (tg.dock ? "charge" : "sample"); }
        else { this.target = null; this.state = "sample"; }
      } else if (this.state === "drive") {
        const wp = this.path[0];
        if (!wp) { this.state = this.target && this.target.dock ? "charge" : "sample"; this.hIdx = 0; this.v = 0; }
        else {
          const dx = wp.x - this.x, dy = wp.y - this.y, d = Math.hypot(dx, dy);
          if (d < 0.06) this.path.shift();
          else {
            let err = Math.atan2(dy, dx) - this.th; while (err > Math.PI) err -= 2 * Math.PI; while (err < -Math.PI) err += 2 * Math.PI;
            this.th += clamp(err, -1.6 * dt, 1.6 * dt);
            let vmax = 0.3; for (const p of LAYOUT.people) if (Math.hypot(this.x - p.x, this.y - p.y) < 1.4) vmax = 0.15;
            this.v = Math.abs(err) > 0.5 ? 0 : Math.min(vmax, d / Math.max(dt, 1e-3));
            this.x += Math.cos(this.th) * this.v * dt; this.y += Math.sin(this.th) * this.v * dt;
            this.trail.push([this.x, this.y]); if (this.trail.length > 600) this.trail.shift();
          }
          watts += POWER.drive * Math.min(1, this.v / 0.3 + 0.3);
        }
      } else if (this.state === "sample") {                // raise the mast through the three heights; read while still
        const h = MAST[this.hIdx];
        if (Math.abs(this.mast - h) > 1e-3) { watts += POWER.mast; this.mast += clamp(h - this.mast, -0.25 * dt, 0.25 * dt); this.dwell = 0; this.acc = 0; this.nacc = 0; }
        else {
          this.dwell += dt; this.acc += world.air.at(this.x, this.y, this.mast) * dt; this.nacc += dt;
          if (this.dwell >= 8) {
            const truth = this.acc / this.nacc;
            const c = Math.max(0, truth * (1 + this.bias) * (1 + 0.04 * this.rng.gauss()) + 0.8 * this.rng.gauss());
            out.push({ x: this.x, y: this.y, z: h, t: world.t, c, sn: 0.1, src: "robot" });
            this.profile[this.hIdx] = c; this.dwell = 0; this.acc = 0; this.nacc = 0;
            this.hIdx++;
            if (this.hIdx >= MAST.length) { this.state = "retract"; this.visits++; }
          }
        }
      } else if (this.state === "retract") {
        if (this.mast > MAST[0] + 1e-3) { watts += POWER.mast; this.mast = Math.max(MAST[0], this.mast - 0.25 * dt); }
        else { this.mast = MAST[0]; this.state = "plan"; }
      } else if (this.state === "charge") {
        watts -= POWER.charge;
        if (this.battery >= 0.95 * POWER.capacity) this.state = "plan";
      }
      this.battery = clamp(this.battery - watts * dt / 3600, 0, POWER.capacity);
      return out;
    }
  }

  // ------------------------------------------------------------------ the Living Air Sensor (concept model, after X. Cao)
  // Two 4-well glass chamber slides (1.7 cm2 per well, the Millicell EZ SLIDE format) of respiratory epithelial cells at
  // the air-liquid interface, eight wells in all, read optically in a dark
  // chamber: excitation from below, emission read from above. Air drawn in at the mast head flows over four exposed wells;
  // two control wells receive the same air through a HEPA filter; one well holds a fluorescent reference (lamp drift);
  // one is cell-free (the particles' own glow). A mitochondrial stress dye glows brighter as oxidative stress rises.
  // Each cycle: inhale, expose, read, exhale through the robot's filter. Illustrative numbers only: no experimental data.
  const BIO = { cycle: 600, flow: 2.0, eta: 0.24, area: 1.7, Rmax: 1.5, EC50: 6, hill: 1.6, repair: 6 * 3600, life: 7 * 144,   // a cartridge lasts a week of 10-minute cycles
    roles: ["exposed", "exposed", "exposed", "exposed", "control", "control", "reference", "blank"] };
  class LivingSensor {
    constructor(seed) {
      this.rng = rngOf(seed); this.n = 0; this.hist = []; this.dose = 0; this.doseMass = 0;
      this.F0 = BIO.roles.map(r => r === "blank" ? 40 : r === "reference" ? 800 : 1000 * (1 + 0.06 * this.rng.gauss()));
      this.k = BIO.roles.map(() => 1 + 0.12 * this.rng.gauss());          // culture-to-culture sensitivity
      this.read(0, 0, 0);
    }
    cycle(cMass, cTox, t) {                                // mean mass and toxicity-weighted concentration the inlet saw
      const perWell = c => c * 1e-3 * BIO.flow * (BIO.cycle / 60) * BIO.eta / BIO.area;   // µg/m3 -> µg/cm2 per cycle
      const keep = Math.exp(-BIO.cycle / BIO.repair);                                      // cells slowly recover
      this.dose = this.dose * keep + perWell(cTox); this.doseMass = this.doseMass * keep + perWell(cMass);
      this.n++;
      return this.read(cMass, cTox, t);
    }
    read(cMass, cTox, t) {
      const g = this.rng.gauss, lamp = (1 - 0.0015 * this.n) * (1 + 0.004 * g());      // bleaching and lamp noise
      const R = BIO.Rmax * Math.pow(this.dose, BIO.hill) / (Math.pow(BIO.EC50, BIO.hill) + Math.pow(this.dose, BIO.hill));
      const F = BIO.roles.map((role, i) => {
        if (role === "exposed") return this.F0[i] * lamp * (1 + R * this.k[i]) * (1 + 0.015 * g()) + 3 * this.doseMass;
        if (role === "control") return this.F0[i] * lamp * (1 + 0.015 * g());
        if (role === "reference") return this.F0[i] * lamp;
        return this.F0[i] + 3 * this.doseMass;
      });
      // what the robot computes: lamp-corrected, blank-subtracted relative change, exposed minus control
      const lampRel = F[6] / this.F0[6], blank = F[7] - this.F0[7];
      const rel = i => ((F[i] - (i < 4 ? blank : 0)) / lampRel - this.F0[i]) / this.F0[i];
      const mean = a => a.reduce((s, v) => s + v, 0) / a.length;
      const exp = [0, 1, 2, 3].map(rel), ctl = [4, 5].map(rel), dExp = mean(exp), dCtl = mean(ctl), corrected = dExp - dCtl;
      const sd = Math.sqrt(exp.reduce((s, v) => s + (v - dExp) * (v - dExp), 0) / (exp.length - 1));
      this.last = { n: this.n, t, cMass, cTox, F, F0: this.F0.slice(), exp, ctl, dExp, dCtl, corrected, sd,
        index: clamp(100 * corrected / BIO.Rmax, 0, 100), Fexp: mean(F.slice(0, 4)), F0exp: mean(this.F0.slice(0, 4)),
        Fctl: mean(F.slice(4, 6)), dose: this.dose, doseMass: this.doseMass, toxPerMass: cMass > 1 ? cTox / cMass : null,
        life: Math.max(0, 1 - this.n / BIO.life) };
      this.hist.push(this.last); if (this.hist.length > 400) this.hist.shift();
      return this.last;
    }
  }

  // ------------------------------------------------------------------ an observer: sensors, maybe a robot, a map
  class Observer {
    constructor(name, sensors, policy, rng) {
      this.name = name; this.map = new FieldMap(); this.lastFit = -1;
      this.sensors = sensors.map(s => Object.assign({ bias: 0.15 * rng.gauss(), next: 0, last: null }, s));
      this.robot = policy ? new Robot(policy, rng) : null;
    }
  }

  // ------------------------------------------------------------------ the world
  const SCENARIOS = {
    cooking: { label: "Cooking dinner", cout: 55, windowOpen: false, stoveOn: true, candleOn: false, matOn: false,
      events: [[1200, { stoveOn: false }]], note: "Frying for 20 minutes with the window shut; outdoor PM2.5 55 µg/m³." },
    smog: { label: "Smog evening, window open", cout: 85, windowOpen: true, stoveOn: false, candleOn: false, matOn: false,
      events: [[1500, { windowOpen: false }]], note: "Airing the flat on a smog evening: outdoor PM2.5 85 µg/m³, window open 25 minutes." },
    candle: { label: "Candle and play", cout: 40, windowOpen: false, stoveOn: false, candleOn: true, matOn: true,
      events: [], note: "A candle on the dining table and a child playing on the mat; outdoor PM2.5 40 µg/m³." },
  };

  class World {
    constructor(o) {
      o = Object.assign({ scenario: "cooking", seed: 7, policy: "oddech", purifierMode: "auto", cadr: 300 }, o || {});
      this.o = o; this.rng = rngOf(o.seed); this.t = 0;
      const sc = SCENARIOS[o.scenario] || {};
      const cfg = Object.assign({ purifierOn: o.purifierMode === "on", cadr: o.cadr / 3600 }, sc, o.air || {});
      delete cfg.events; delete cfg.label; delete cfg.note;
      this.air = new Air(cfg);
      this.events = (sc.events || []).map(e => ({ t: e[0], patch: e[1] }));
      this.purifierMode = o.purifierMode; this.cadrSet = o.cadr;
      this.occ = occupancy(this.air.cfg.purifier);
      this.box = this.air.mean();                          // mass-balance prior, integrated alongside
      this.observers = o.observers ? o.observers.map(([name, sensors, policy]) => new Observer(name, sensors, policy, this.rng))
        : [new Observer("live", [Object.assign({ id: "monitor" }, LAYOUT.monitor)], o.policy, this.rng)];
      this.dose = {}; for (const p of LAYOUT.people) this.dose[p.id] = 0;
      this.hist = []; this.lastHist = -1e9; this.follow = false; this.pending = null; this.log = [];
      this.advice = null; this.lastAdvice = -1e9; this.nextAuto = 0;
      this.bio = new LivingSensor((o.seed || 1) + 7919); this.bioAcc = { m: 0, o: 0, s: 0 }; this.nextBio = BIO.cycle;
    }
    get live() { return this.observers[0]; }
    set(patch) {
      this.air.set(patch);
      if ("purifier" in patch) this.occ = occupancy(this.air.cfg.purifier);
    }
    setPurifierMode(mode, cadr) {
      this.purifierMode = mode; if (cadr) this.cadrSet = cadr;
      if (mode === "auto") this.set({ cadr: this.cadrSet / 3600 });
      else this.set({ purifierOn: mode === "on", cadr: this.cadrSet / 3600 });
    }
    applyAction(a) {
      if (!a) return;
      if (a.id === "closeWindow") this.set({ windowOpen: false });
      if (a.id === "openWindow") this.set({ windowOpen: true });
      if (a.id === "purifierHigh") { this.cadrSet = 600; this.set({ cadr: 600 / 3600 }); }
      if (a.id === "purifierOn") { if (this.purifierMode === "off") this.purifierMode = "on"; this.set({ purifierOn: true }); }
      if (a.id === "movePurifier") this.set({ purifier: { x: a.x, y: a.y } });
      this.log.push({ t: this.t, text: a.done });
      this.lastAdvice = -1e9;
    }
    boxStep(dt) {                                          // what physics alone predicts for a well-mixed room
      const c = this.air.cfg, loss = PHYS.lam + PHYS.kd + (c.purifierOn ? c.cadr / VROOM : 0);
      this.box += dt * (PHYS.lam * PHYS.P * c.cout - loss * this.box);
    }
    advance(seconds, opts) {
      opts = opts || {};
      const tEnd = this.t + seconds;
      while (this.t < tEnd - 1e-9) {
        const dt = Math.min(1, tEnd - this.t);
        for (const e of this.events) if (!e.done && this.t >= e.t) { this.set(e.patch); e.done = true; }
        this.air.advance(dt); this.boxStep(dt); this.t = this.air.t;
        this.bioStep(dt);
        for (const p of LAYOUT.people) this.dose[p.id] += this.air.at(p.x, p.y, p.z) * p.vE * dt / 3600;
        for (const ob of this.observers) {
          for (const s of ob.sensors) if (this.t >= s.next) {
            const c = Math.max(0, this.air.at(s.x, s.y, s.z) * (1 + s.bias) * (1 + 0.06 * this.rng.gauss()) + 1.0 * this.rng.gauss());
            ob.map.add({ x: s.x, y: s.y, z: s.z, t: this.t, c, sn: 0.2, src: s.id || "fixed" }); s.last = c; s.next = this.t + 30;
          }
          if (ob.robot) for (const s of ob.robot.update(dt, this, ob)) ob.map.add(s);
          if (ob.map.dirty && (this.t - ob.lastFit >= 2 || !ob.map.ready)) { ob.map.fit(this.t, LOG(this.box)); ob.lastFit = this.t; }
        }
        if (this.purifierMode === "auto" && this.live.map.ready && this.t >= this.nextAuto) { this.autoPurifier(); this.nextAuto = this.t + 10; }
        if (opts.advice !== false && this.t - this.lastAdvice >= 20) { this.advice = advise(this); this.lastAdvice = this.t; this.followAdvice(); }
        if (opts.history !== false && this.t - this.lastHist >= 10) this.record();
      }
    }
    bioStep(dt) {                                          // the cartridge breathes the air at the mast head
      const r = this.live.robot, p = r ? [r.x, r.y, r.mast + 0.05] : [LAYOUT.monitor.x, LAYOUT.monitor.y, LAYOUT.monitor.z];
      const a = this.bioAcc;
      a.m += this.air.at(p[0], p[1], p[2]) * dt; a.o += this.air.opAt(p[0], p[1], p[2]) * dt; a.s += dt;
      if (this.t >= this.nextBio) { this.bio.cycle(a.m / a.s, a.o / a.s, this.t); this.bioAcc = { m: 0, o: 0, s: 0 }; this.nextBio += BIO.cycle; }
    }
    autoPurifier() {                                       // Oddech switches a connected purifier by the people's estimated air
      const worst = Math.max(...exposures(this).map(e => e.c));
      if (!this.air.cfg.purifierOn && worst > 15) { this.set({ purifierOn: true }); this.log.push({ t: this.t, text: "Oddech switched the purifier on" }); }
      else if (this.air.cfg.purifierOn && worst < 8) { this.set({ purifierOn: false }); this.log.push({ t: this.t, text: "Oddech switched the purifier off" }); }
    }
    followAdvice() {                                       // the household acts on the first suggestion, 90 s later
      const a = this.follow && this.advice && this.advice.actions[0];
      if (!a) { this.pending = null; return; }
      if (!this.pending || this.pending.a.id !== a.id) this.pending = { a, t: this.t + 90 };
      else if (this.t >= this.pending.t) { this.applyAction(a); this.pending = null; }
    }
    record() {
      const ob = this.live, truth = this.air.plane(1.1), ex = exposures(this), child = LAYOUT.people[0];
      let s = 0, n = 0; for (let q = 0; q < truth.length; q++) if (!this.occ[q]) { s += truth[q]; n++; }
      this.hist.push({ t: this.t, mean: s / n, est: ex[0].c, lo: ex[0].lo, hi: ex[0].hi, truthChild: this.air.at(child.x, child.y, child.z),
        err: ob.map.ready ? mapError(this, ob, 1.1, truth) : null, dose: this.dose.child, monitor: ob.sensors[0] ? ob.sensors[0].last : null });
      if (this.hist.length > 720) this.hist.shift();
      this.lastHist = this.t;
    }
  }

  function exposures(world) {                              // the map's estimate where each person breathes, 80 % range
    const m = world.live.map;
    return LAYOUT.people.map(p => {
      const truth = world.air.at(p.x, p.y, p.z);
      if (!m.ready) return { id: p.id, label: p.label, c: null, truth };
      const r = m.predict({ x: p.x, y: p.y, z: p.z, t: world.t }, true);
      return { id: p.id, label: p.label, c: EXP(r.mu), lo: EXP(r.mu - 1.28 * r.sd), hi: EXP(r.mu + 1.28 * r.sd), sd: r.sd, truth };
    });
  }

  function mapError(world, ob, z, truth) {                 // RMSE of log concentration over the free floor
    truth = truth || world.air.plane(z);
    const g = ob.map.grid(z, world.t, NX, NY, false);
    let se = 0, n = 0;
    for (let q = 0; q < NX * NY; q++) { if (world.occ[q]) continue; const d = g.mu[q] - LOG(truth[q]); se += d * d; n++; }
    return Math.sqrt(se / n);
  }

  // ------------------------------------------------------------------ advice, in the four wordings of the WP3 experiment
  const band = c => c <= 15 ? "fresh" : c <= 35 ? "a little heavy" : c <= 75 ? "heavy" : "very heavy";
  const r0 = v => Math.round(v);
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  function purifierSpot(hx, hy) {                          // a free floor spot near the hot spot, clear of furniture and people
    let best = null, bd = 1e9;
    for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
      const x = (i + 0.5) * DX, y = (j + 0.5) * DY;
      let ok = x > 0.35 && y > 0.35 && x < ROOM.Lx - 0.35 && y < ROOM.Ly - 0.35;
      for (const o of LAYOUT.obstacles) if (x > o[0] - 0.3 && x < o[2] + 0.3 && y > o[1] - 0.3 && y < o[3] + 0.3) ok = false;
      for (const p of LAYOUT.people) if (Math.hypot(x - p.x, y - p.y) < 0.9) ok = false;
      const d = Math.hypot(x - hx, y - hy);
      if (ok && d < bd) { bd = d; best = { x, y }; }
    }
    return best;
  }
  function advise(world) {
    const m = world.live.map, cfg = world.air.cfg;
    if (!m.ready) return null;
    const ex = exposures(world), worst = ex.reduce((a, b) => (b.c > a.c ? b : a));
    const g = m.grid(1.1, world.t, NX, NY, false), vals = Array.from(g.mu);
    let hq = 0; for (let q = 1; q < vals.length; q++) if (vals[q] > vals[hq]) hq = q;
    const hot = EXP(vals[hq]), hx = (hq % NX + 0.5) * DX, hy = (Math.floor(hq / NX) + 0.5) * DY;
    vals.sort((a, b) => a - b);
    const median = EXP(vals[vals.length >> 1]), ratio = hot / Math.max(median, 1), zone = zoneOf(hx, hy);
    const place = worst.id === "child" ? "the play mat" : "the sofa";
    const fromWindow = cfg.windowOpen && cfg.cout > median * 1.1;
    const actions = [];
    if (fromWindow) actions.push({ id: "closeWindow", label: "Close the window", done: "The window was closed" });
    if (!cfg.purifierOn && worst.c > 15) actions.push({ id: "purifierOn", label: "Switch the purifier on", done: "The purifier was switched on" });
    if (!cfg.windowOpen && worst.c > 35 && median > 1.5 * cfg.cout)       // indoors worse than outdoors, even in smog
      actions.push({ id: "openWindow", label: `Open the window for ten minutes (outside is about ${r0(cfg.cout)})`, done: "The window was opened to air the room" });
    if (cfg.windowOpen && !fromWindow && median < 1.1 * cfg.cout && cfg.cout > 15)
      actions.push({ id: "closeWindow", label: "Close the window", done: "The window was closed" });
    if (cfg.purifierOn && worst.c > 35 && cfg.cadr < 0.99 * 600 / 3600)
      actions.push({ id: "purifierHigh", label: "Turn the purifier to high", done: "The purifier was turned to high" });
    const p = cfg.purifier;
    if (cfg.purifierOn && !fromWindow && ratio > 1.6 && Math.hypot(hx - p.x, hy - p.y) > 2.2) {
      const spot = purifierSpot(hx, hy);
      if (spot && Math.hypot(spot.x - p.x, spot.y - p.y) > 1)
        actions.push({ id: "movePurifier", label: "Move the purifier towards " + zoneOf(spot.x, spot.y), x: spot.x, y: spot.y, done: "The purifier was moved towards " + zoneOf(spot.x, spot.y) });
    }
    const act = actions.length ? actions.map(a => a.label.charAt(0).toLowerCase() + a.label.slice(1)).join(", then ") : null;
    const next = worst.c > 35 ? 5 : worst.c > 15 ? 10 : 20;
    const lvl = band(worst.c), rng = `${r0(worst.lo)}–${r0(worst.hi)}`, rngW = `${r0(worst.lo)} and ${r0(worst.hi)}`;
    const none = worst.c <= 15 ? "Nothing to do for now." : "Keep the purifier running; it is doing the right thing.";
    const noneN = worst.c <= 15 ? "No action needed." : "Keep the purifier running.";
    const srcTxt = fromWindow ? "Most of it comes in through the open window." : ratio > 1.4 ? `The air is worst near ${zone}.` : "It is spread evenly through the room.";
    const b = world.bio.last, smoky = b.n > 0 && b.index >= 25 && b.toxPerMass !== null && b.toxPerMass > 1.2;
    const bioN = b.n > 0 ? ` Living sensor: stress ${r0(b.index)}/100${smoky ? ", high for this amount of dust" : ""}.` : "";
    const bioW = b.n > 0 && b.index >= 25 ? (smoky ? " My living cells react more than the dust count alone suggests: it behaves like smoke." : " My living cells are reacting to this air.") : "";
    const T = {
      neutral_stated: `${cap(place)}: PM2.5 ${r0(worst.c)} µg/m³ (likely ${rng}). ${srcTxt}${bioN}` + (act ? ` Recommended: ${act}.` : ` ${noneN}`) + ` Next check in ${next} min.`,
      neutral_hidden: `${cap(place)}: PM2.5 ${r0(worst.c)} µg/m³. ${srcTxt}${bioN}` + (act ? ` Recommended: ${act}.` : ` ${noneN}`) + ` Next check in ${next} min.`,
      warm_stated: `Ania, the air on ${place} is ${lvl}: my best guess is ${r0(worst.c)}, somewhere between ${rngW}. ${srcTxt}${bioW}` + (act ? ` Shall we ${act}?` : ` ${none}`) + ` I'll check again in ${next} minutes.`,
      warm_hidden: `Ania, the air on ${place} is ${lvl} (${r0(worst.c)}). ${srcTxt}${bioW}` + (act ? ` Shall we ${act}?` : ` ${none}`) + ` I'll check again in ${next} minutes.`,
    };
    return { t: world.t, worst, ex, zone, hot, median, ratio, level: lvl, actions, text: T, hotspot: { x: hx, y: hy }, bio: b };
  }

  // ------------------------------------------------------------------ H1 benchmark: the same air, three ways of sensing it
  function benchScenario(rng) {
    const pick = rng();
    const src = pick < 0.4 ? { stoveOn: true, stoveRate: 20 + 50 * rng() }
      : pick < 0.7 ? { candleOn: true, candleRate: 3 + 6 * rng(), matOn: rng() < 0.5 } : { matOn: true, matRate: 6 + 10 * rng() };
    return Object.assign({ cout: 30 + 70 * rng(), windowOpen: rng() < 0.35, purifierOn: rng() < 0.5, cadr: 300 / 3600 }, src);
  }
  function benchRun(seed, minutes) {
    const rng = rngOf(1000 + seed), air = benchScenario(rng), B = LAYOUT.bench;
    const w = new World({ seed: 1000 + seed, scenario: "none", purifierMode: air.purifierOn ? "on" : "off", air,
      observers: [["fixed4", B, null], ["oddech", B.slice(0, 3), "oddech"], ["random", B.slice(0, 3), "random"]] });
    w.events = [{ t: minutes * 60 * 0.6, patch: { stoveOn: false, candleOn: false, matOn: false } }];
    const errs = { fixed4: [], oddech: [], random: [] }, perr = { fixed4: [], oddech: [], random: [] };
    for (let t = 0; t < minutes * 60; t += 30) {
      w.advance(30, { advice: false, history: false });
      if (w.t < 300) continue;
      const truth = w.air.plane(1.1);
      for (const ob of w.observers) {
        errs[ob.name].push(mapError(w, ob, 1.1, truth));
        for (const p of LAYOUT.people) perr[ob.name].push(Math.abs(ob.map.predict({ x: p.x, y: p.y, z: p.z, t: w.t }).mu - LOG(w.air.at(p.x, p.y, p.z))));
      }
    }
    const mean = a => a.reduce((s, v) => s + v, 0) / a.length, r = { seed };
    for (const k of ["fixed4", "oddech", "random"]) { r[k] = mean(errs[k]); r[k + "_people"] = mean(perr[k]); }
    return r;
  }

  return { ROOM, NX, NY, NZ, DX, DY, DZ, VROOM, PHYS, TOX, BIO, LivingSensor, unitEconomics, LAYOUT, MAST, POWER, SCENARIOS, ZONES, LOG, EXP,
    rngOf, makeFlow, Air, FieldMap, occupancy, astar, Robot, World, exposures, mapError, advise, zoneOf, benchRun, band };
});
