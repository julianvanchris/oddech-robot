/* Section 06, below the 3D model: live top-view maps (dust, harm, Oddech's map, its doubt) and live curves (air where people
   breathe; the living sensor's glow and stress index against cycle count). Reads the running world from scene.js
   (window.OddechStage), so it shows exactly what the 3D model is doing. */
(function () {
  "use strict";
  const S = window.OddechSim; if (!S) return;
  const $ = id => document.getElementById(id);
  const { NX, NY, ROOM, LAYOUT, EXP } = S, L = ROOM.Lx, W = ROOM.Ly;
  const KITCHEN = { x: 1.6, y: 4.9, z: 1.1 };
  const fit = cv => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2), w = cv.clientWidth, h = cv.clientHeight;
    if (!w || !h) return null;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const g = cv.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0); return { g, w, h };
  };
  const off = document.createElement("canvas"), offG = off.getContext("2d");
  let visible = false, tMap = 0, tCurve = 0, hist = [], lastWorld = null, lastRec = -1e9;
  const sec = $("mapTruth") && $("mapTruth").closest(".results");
  if (!sec) return;
  new IntersectionObserver(es => { visible = es[0].isIntersecting; }, { threshold: 0.02 }).observe(sec);

  function paintField(cv, nx, ny, colorAt, world, extra) {
    const f = fit(cv); if (!f) return; const { g, w, h } = f;
    off.width = nx; off.height = ny; const img = offG.createImageData(nx, ny);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const c = colorAt(i + nx * j), o = 4 * (i + nx * (ny - 1 - j));          // room y points up the screen
      img.data[o] = c[0]; img.data[o + 1] = c[1]; img.data[o + 2] = c[2]; img.data[o + 3] = 255;
    }
    offG.putImageData(img, 0, 0);
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high"; g.drawImage(off, 0, 0, w, h);
    const X = x => x / L * w, Y = y => h - y / W * h;
    g.strokeStyle = "rgba(15,13,11,.55)"; g.fillStyle = "rgba(15,13,11,.28)"; g.lineWidth = 1;
    for (const o of LAYOUT.obstacles) { g.fillRect(X(o[0]), Y(o[3]), X(o[2]) - X(o[0]), Y(o[1]) - Y(o[3])); g.strokeRect(X(o[0]), Y(o[3]), X(o[2]) - X(o[0]), Y(o[1]) - Y(o[3])); }
    const wn = LAYOUT.window; g.strokeStyle = "#cfe0f2"; g.lineWidth = 3; g.beginPath(); g.moveTo(X(wn.x0), 1.5); g.lineTo(X(wn.x1), 1.5); g.stroke();
    for (const p of LAYOUT.people) { g.strokeStyle = "#EDE8DF"; g.lineWidth = 1.4; g.beginPath(); g.arc(X(p.x), Y(p.y), 5, 0, 2 * Math.PI); g.stroke(); }
    const pu = world.air.cfg.purifier; g.fillStyle = world.air.cfg.purifierOn ? "#9fb4d2" : "#5d6672"; g.beginPath(); g.arc(X(pu.x), Y(pu.y), 4.5, 0, 2 * Math.PI); g.fill();
    if (extra) extra(g, X, Y, w, h);
  }

  function paintMaps(st) {
    const world = st.world, z = 1.1, { CONC, SDR, tC } = window.OddechColors, m = world.live.map, r = world.live.robot;
    const truth = world.air.plane(z), harm = world.air.plane(z, null, world.air.O);
    const robot = (g, X, Y) => {
      g.strokeStyle = "rgba(255,255,255,.55)"; g.lineWidth = 1.1; g.beginPath();
      r.trail.slice(-260).forEach((p, i) => i ? g.lineTo(X(p[0]), Y(p[1])) : g.moveTo(X(p[0]), Y(p[1]))); g.stroke();
      g.fillStyle = "#fff"; g.beginPath(); g.arc(X(r.x), Y(r.y), 4, 0, 2 * Math.PI); g.fill();
      g.strokeStyle = "#1F1D1A"; g.lineWidth = 1.5; g.stroke();
    };
    paintField($("mapTruth"), NX, NY, q => CONC(tC(truth[q])), world, robot);
    paintField($("mapHarm"), NX, NY, q => CONC(tC(harm[q])), world, (g, X, Y, w) => {
      robot(g, X, Y);
      const b = world.bio.last;
      if (b.n) { g.font = "600 11px 'JetBrains Mono', monospace"; g.fillStyle = "#fff"; const s = `living sensor ${Math.round(b.index)}/100`;
        const right = X(r.x) > w * 0.6; g.textAlign = right ? "right" : "left"; g.fillText(s, X(r.x) + (right ? -8 : 8), Y(r.y) - 8); }
    });
    if (m.ready) {
      const ge = m.grid(z, world.t, NX, NY, false), gs = m.grid(z, world.t, 20, 15, true);
      const dots = (g, X, Y) => {
        for (const s of m.samples) { if (s.src !== "robot") continue; g.fillStyle = "rgba(255,255,255,.85)"; g.beginPath(); g.arc(X(s.x), Y(s.y), 2.2, 0, 2 * Math.PI); g.fill(); }
        robot(g, X, Y);
      };
      paintField($("mapEst"), NX, NY, q => CONC(tC(EXP(ge.mu[q]))), world, dots);
      paintField($("mapSd"), 20, 15, q => SDR(gs.sd[q] / 0.75), world, dots);
    } else {
      for (const id of ["mapEst", "mapSd"]) { const f = fit($(id)); if (!f) continue; f.g.fillStyle = "#0c0b0a"; f.g.fillRect(0, 0, f.w, f.h);
        f.g.fillStyle = "#77716a"; f.g.font = "500 11px 'JetBrains Mono', monospace"; f.g.textAlign = "center"; f.g.fillText("waiting for the first readings", f.w / 2, f.h / 2); }
    }
  }

  function legend() {
    const cv = $("mapsLegend"), st = window.OddechColors; if (!cv || cv._done) return; cv._done = true;
    const g = cv.getContext("2d");
    for (let x = 0; x < cv.width; x++) { const c = st.CONC(x / (cv.width - 1)); g.fillStyle = `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`; g.fillRect(x, 0, 1, cv.height); }
    $("mapsTicks").innerHTML = st.TICKS.map(v => `<span style="left:${(st.tC(v) * 100).toFixed(1)}%">${v}</span>`).join("");
  }

  function record(world) {
    if (world !== lastWorld || world.t < lastRec) { hist = []; lastWorld = world; lastRec = -1e9; }
    if (world.t - lastRec < 20) return;
    lastRec = world.t;
    const child = LAYOUT.people[0], ex = S.exposures(world)[0], mon = world.live.sensors[0];
    hist.push({ t: world.t, child: world.air.at(child.x, child.y, child.z), est: ex.c, lo: ex.lo, hi: ex.hi,
      kitchen: world.air.at(KITCHEN.x, KITCHEN.y, KITCHEN.z), mon: mon ? mon.last : null });
    if (hist.length > 540) hist.shift();
  }

  function axes(g, w, h, x0, x1, y0, y1, ymax, step, unit, xl) {
    g.font = "500 10px 'JetBrains Mono', monospace"; g.textBaseline = "alphabetic"; g.strokeStyle = "rgba(237,232,223,.1)"; g.lineWidth = 1;
    g.fillStyle = "#77716a"; g.textAlign = "right";
    for (let v = 0; v <= ymax + 1e-9; v += step) { const y = y0 - (y0 - y1) * v / ymax; g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke(); g.fillText(Math.round(v), x0 - 5, y + 3); }
    g.textAlign = "left"; g.fillText(unit, x0 + 4, y1 + 9); g.textAlign = "right"; g.fillText(xl, x1, h - 2);
  }
  const nice = v => { const p = Math.pow(10, Math.floor(Math.log10(v))); return [1, 2, 2.5, 5, 10].map(k => k * p).find(s => s >= v); };   // the step for about four ticks: nice(max / 4)

  function curveAir() {
    const f = fit($("curveAir")); if (!f) return; const { g, w, h } = f; g.clearRect(0, 0, w, h);
    const x0 = 34, x1 = w - 8, y0 = h - 22, y1 = 8;
    if (hist.length < 2) { g.fillStyle = "#77716a"; g.font = "500 11px 'JetBrains Mono', monospace"; g.fillText("collecting…", x0, h / 2); return; }
    let mx = 20; for (const p of hist) mx = Math.max(mx, p.child, p.kitchen, p.hi || 0, p.mon || 0);
    const st = nice(mx / 4), ymax = Math.ceil(mx * 1.05 / st) * st, t0 = hist[0].t, t1 = hist[hist.length - 1].t;
    const X = t => x0 + (x1 - x0) * (t - t0) / Math.max(1, t1 - t0), Y = v => y0 - (y0 - y1) * v / ymax;
    axes(g, w, h, x0, x1, y0, y1, ymax, st, "µg/m³", `last ${Math.round((t1 - t0) / 60)} min, simulated`);
    const pts = hist.filter(p => p.lo !== null && p.lo !== undefined);
    if (pts.length > 1) { g.fillStyle = "rgba(217,135,92,.16)"; g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(X(p.t), Y(p.hi)) : g.moveTo(X(p.t), Y(p.hi)));
      for (let i = pts.length - 1; i >= 0; i--) g.lineTo(X(pts[i].t), Y(pts[i].lo)); g.closePath(); g.fill(); }
    const line = (k, c, wd, dash) => { g.strokeStyle = c; g.lineWidth = wd; g.setLineDash(dash || []); g.beginPath(); let on = false;
      for (const p of hist) { const v = p[k]; if (v === null || v === undefined) { on = false; continue; } on ? g.lineTo(X(p.t), Y(v)) : g.moveTo(X(p.t), Y(v)); on = true; }
      g.stroke(); g.setLineDash([]); };
    line("kitchen", "#7E98BC", 1.3); line("mon", "#8a847a", 1.2, [3, 3]); line("child", "#EDE8DF", 1.4); line("est", "#D9875C", 2);
    g.strokeStyle = "rgba(217,135,92,.5)"; g.setLineDash([2, 4]); g.beginPath(); g.moveTo(x0, Y(15)); g.lineTo(x1, Y(15)); g.stroke(); g.setLineDash([]);
    g.fillStyle = "rgba(217,135,92,.8)"; g.textAlign = "right"; g.fillText("WHO 24-h guideline 15", x1, Y(15) - 4);
  }

  function curveBio(world) {
    const f = fit($("curveBio")); if (!f) return; const { g, w, h } = f; g.clearRect(0, 0, w, h);
    const H = world.bio.hist.filter(r => r.n > 0), x0 = 40, x1 = w - 34, y0 = h - 22, y1 = 8;
    if (!H.length) { g.fillStyle = "#77716a"; g.font = "500 11px 'JetBrains Mono', monospace"; g.fillText("the cartridge reads once every 10 simulated minutes…", x0, h / 2); return; }
    let mx = 1200; for (const r of H) mx = Math.max(mx, r.Fexp * 1.06);
    const st = nice(mx / 4), ymax = Math.ceil(mx / st) * st, N = Math.max(12, H[H.length - 1].n);
    const X = n => x0 + (x1 - x0) * n / N, Y = v => y0 - (y0 - y1) * v / ymax, Yi = v => y0 - (y0 - y1) * v / 100;
    axes(g, w, h, x0, x1, y0, y1, ymax, st, "intensity, a.u.", "cycle count, 10 min each");
    g.fillStyle = "#E8B48F"; g.textAlign = "left"; for (const v of [0, 50, 100]) g.fillText(v, x1 + 5, Yi(v) + 3);
    const F0 = H[0].F0exp; g.strokeStyle = "rgba(237,232,223,.35)"; g.setLineDash([4, 4]); g.beginPath(); g.moveTo(x0, Y(F0)); g.lineTo(x1, Y(F0)); g.stroke(); g.setLineDash([]);
    g.fillStyle = "#9C958A"; g.fillText("F₀", x0 + 4, Y(F0) - 4);
    const line = (get, c, wd, yf, dash) => { g.strokeStyle = c; g.lineWidth = wd; g.setLineDash(dash || []); g.beginPath(); H.forEach((r, i) => i ? g.lineTo(X(r.n), yf(get(r))) : g.moveTo(X(r.n), yf(get(r)))); g.stroke(); g.setLineDash([]); };
    line(r => r.Fctl, "#7E98BC", 1.4, Y); line(r => r.Fexp, "#D9875C", 2.2, Y); line(r => r.index, "#E8B48F", 1.3, Yi, [5, 3]);
    for (const r of H) { g.fillStyle = "#D9875C"; g.beginPath(); g.arc(X(r.n), Y(r.Fexp), 2, 0, 2 * Math.PI); g.fill(); }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const st = window.OddechStage; if (!st || !st.world) return;
    record(st.world);
    if (!visible || document.hidden) return;
    legend();
    if (now - tMap > 500) { paintMaps(st); tMap = now; }
    if (now - tCurve > 1000) { curveAir(); curveBio(st.world); tCurve = now; }
  }
  requestAnimationFrame(frame);
})();
