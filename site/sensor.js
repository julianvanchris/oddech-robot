/* Section 05: how an optical particle counter works (animated), and the humidity correction (interactive).
   Mass growth factor f = 1 + (kappa * rho_w / rho_p) * aw / (1 - aw), aw = RH, rho_p = 1.65 g/cm3 (kappa-Koehler, as in the page's note).
   Diameter growth for the drawing: (1 + kappa * aw / (1 - aw))^(1/3). The animation is illustrative; the numbers are the formula. */
(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const RHO_P = 1.65, TRUE_DRY = 35;
  const growthMass = (rh, k) => { const aw = Math.min(rh, 99) / 100; return 1 + (k / RHO_P) * aw / (1 - aw); };
  const growthDiam = (rh, k) => { const aw = Math.min(rh, 99) / 100; return Math.cbrt(1 + k * aw / (1 - aw)); };
  const st = { rh: 85, k: 0.30, ka: 0.25 };

  function fit(cv) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2), w = cv.clientWidth, h = cv.clientHeight;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const g = cv.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0); return { g, w, h };
  }

  // ---------------------------------------------------------------- the humidity controls and chart
  function readout() {
    const raw = TRUE_DRY * growthMass(st.rh, st.k), cor = raw / growthMass(st.rh, st.ka);
    $("rhV").textContent = st.rh + " %"; $("kV").textContent = st.k.toFixed(2); $("kaV").textContent = st.ka.toFixed(2);
    $("rhRaw").textContent = Math.round(raw); $("rhCor").textContent = Math.round(cor);
    drawRh();
  }
  function drawRh() {
    const cv = $("rhCanvas"); if (!cv || !cv.clientWidth) return;
    const { g, w, h } = fit(cv), x0 = 46, x1 = w - 14, y0 = h - 34, y1 = 18, fmax = 4;
    const X = rh => x0 + (x1 - x0) * (rh - 30) / 67, Y = f => y0 - (y0 - y1) * (f - 1) / (fmax - 1);
    g.clearRect(0, 0, w, h);
    g.fillStyle = "rgba(180,83,42,.07)"; g.fillRect(X(75), y1, x1 - X(75), y0 - y1);
    g.fillStyle = "#B4532A"; g.font = "500 10.5px 'JetBrains Mono', monospace"; g.fillText("above ~75 % RH", X(75) + 6, y1 + 12); g.fillText("readings rise", X(75) + 6, y1 + 26);
    g.strokeStyle = "rgba(31,29,26,.14)"; g.lineWidth = 1; g.font = "500 10px 'JetBrains Mono', monospace"; g.fillStyle = "#8A847A";
    for (let f = 1; f <= fmax; f++) { g.beginPath(); g.moveTo(x0, Y(f)); g.lineTo(x1, Y(f)); g.stroke(); g.fillText("×" + f, 8, Y(f) + 3); }
    for (let rh = 30; rh <= 90; rh += 15) g.fillText(rh + "%", X(rh) - 10, y0 + 16);
    g.fillText("relative humidity", x1 - 104, y0 + 30);
    const curve = (k, color, dash, width) => {
      g.strokeStyle = color; g.lineWidth = width; g.setLineDash(dash); g.beginPath();
      for (let rh = 30; rh <= 97; rh += 0.5) { const f = Math.min(fmax + 0.2, growthMass(rh, k)); if (rh === 30) g.moveTo(X(rh), Y(f)); else g.lineTo(X(rh), Y(f)); }
      g.stroke(); g.setLineDash([]);
    };
    g.save(); g.beginPath(); g.rect(x0, y1 - 4, x1 - x0, y0 - y1 + 4); g.clip();
    curve(st.ka, "#2E4A6E", [5, 4], 1.4); curve(st.k, "#1F1D1A", [], 2); g.restore();
    const f = growthMass(st.rh, st.k), fy = Y(Math.min(fmax, f));
    g.strokeStyle = "rgba(180,83,42,.6)"; g.beginPath(); g.moveTo(X(st.rh), y0); g.lineTo(X(st.rh), fy); g.stroke();
    g.fillStyle = "#B4532A"; g.beginPath(); g.arc(X(st.rh), fy, 5, 0, 2 * Math.PI); g.fill();
    g.fillStyle = "#1F1D1A"; g.font = "600 12px 'JetBrains Mono', monospace"; g.textAlign = X(st.rh) > (x0 + x1) / 2 ? "right" : "left";
    g.fillText("×" + f.toFixed(2), X(st.rh) + (g.textAlign === "right" ? -9 : 9), fy - 8); g.textAlign = "left";
    g.font = "500 10.5px 'Inter Tight', sans-serif"; g.fillStyle = "#4A4640";
    g.fillText("— mass growth factor for the dust's κ", x0 + 6, y1 + 12); g.fillStyle = "#2E4A6E"; g.fillText("- - the κ the correction assumes", x0 + 6, y1 + 28);
  }
  [["rhR", "rh"], ["kR", "k"], ["kaR", "ka"]].forEach(([id, key]) => { const el = $(id); if (el) el.addEventListener("input", () => { st[key] = +el.value; readout(); }); });

  // ---------------------------------------------------------------- the animated optical particle counter
  const cv = $("opcCanvas");
  if (!cv) return;
  let parts = [], pulses = [], visible = false, last = performance.now(), fanA = 0, spawn = 0;
  const bins = [0, 0, 0, 0, 0], EDGES = [0.3, 0.5, 1, 2.5, 5, 10], BIN_L = ["0.3–0.5", "0.5–1", "1–2.5", "2.5–5", "5–10"];
  const drawD = () => 0.3 * Math.pow(10 / 0.3, Math.pow(Math.random(), 2.2));          // mostly fine particles
  new IntersectionObserver(es => { visible = es[0].isIntersecting; }).observe(cv);
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!visible) return;
    const { g, w, h } = fit(cv);
    const cw = w * 0.6, chY0 = h * 0.36, chY1 = h * 0.64, beamX = cw * 0.52, gd = growthDiam(st.rh, st.k);
    g.fillStyle = "#0F0E0C"; g.fillRect(0, 0, w, h);
    g.strokeStyle = "rgba(237,232,223,.35)"; g.lineWidth = 1;
    g.beginPath(); g.moveTo(18, chY0); g.lineTo(cw - 50, chY0); g.moveTo(18, chY1); g.lineTo(cw - 50, chY1); g.stroke();
    g.fillStyle = "#9C958A"; g.font = "500 10px 'JetBrains Mono', monospace";
    g.fillText("AIR IN", 18, chY0 - 10); g.fillText("FAN", cw - 44, chY1 + 34);
    fanA = (fanA + dt * 9) % (2 * Math.PI);
    g.save(); g.translate(cw - 34, (chY0 + chY1) / 2); g.rotate(fanA); g.strokeStyle = "rgba(237,232,223,.5)";
    g.beginPath(); g.arc(0, 0, 20, 0, 2 * Math.PI); g.stroke();
    for (let k = 0; k < 5; k++) { g.rotate(2 * Math.PI / 5); g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(10, -6, 17, 0); g.stroke(); }
    g.restore();
    const pulseNow = pulses.length && now - pulses[pulses.length - 1].t < 90;
    g.strokeStyle = "rgba(217,135,92,.25)"; g.lineWidth = 7; g.beginPath(); g.moveTo(beamX, h * 0.88); g.lineTo(beamX, h * 0.1); g.stroke();
    g.strokeStyle = "#D9875C"; g.lineWidth = 1.4; g.beginPath(); g.moveTo(beamX, h * 0.88); g.lineTo(beamX, h * 0.1); g.stroke();
    g.fillStyle = "#D9875C"; g.fillRect(beamX - 9, h * 0.88, 18, 9); g.fillStyle = "#9C958A"; g.fillText("LASER", beamX + 16, h * 0.88 + 8);
    g.fillStyle = pulseNow ? "#EDE8DF" : "#5a554e"; g.beginPath(); g.arc(beamX + 74, h * 0.2, 8, 0, 2 * Math.PI); g.fill();
    g.fillStyle = "#9C958A"; g.fillText("PHOTODIODE", beamX + 54, h * 0.2 - 16);
    g.setLineDash([2, 4]); g.strokeStyle = "rgba(237,232,223,.25)"; g.beginPath(); g.moveTo(beamX, (chY0 + chY1) / 2); g.lineTo(beamX + 70, h * 0.2 + 6); g.stroke(); g.setLineDash([]);
    spawn += dt * 6; while (spawn > 1) { spawn--; parts.push({ x: 20, y: chY0 + 8 + Math.random() * (chY1 - chY0 - 16), d: drawD(), hit: false }); }
    for (const p of parts) {
      p.x += dt * 120;
      const dw = p.d * gd, r = 1.4 + 4.2 * Math.log10(dw / 0.3 + 1), rd = 1.4 + 4.2 * Math.log10(p.d / 0.3 + 1);
      if (!p.hit && p.x >= beamX) {
        p.hit = true; pulses.push({ t: now, a: Math.min(0.92, Math.pow(dw / 6, 1.2) + 0.08) });
        let b = 0; while (b < 4 && dw > EDGES[b + 1]) b++; bins[b] += 1;
        g.fillStyle = "rgba(255,226,196,.9)"; g.beginPath(); g.arc(p.x, p.y, r + 7, 0, 2 * Math.PI); g.fill();
      }
      if (gd > 1.05) { g.fillStyle = "rgba(126,152,188,.45)"; g.beginPath(); g.arc(p.x, p.y, r + 1, 0, 2 * Math.PI); g.fill(); g.strokeStyle = "rgba(160,185,220,.8)"; g.lineWidth = 1; g.stroke(); }
      g.fillStyle = "#C9BFB0"; g.beginPath(); g.arc(p.x, p.y, rd, 0, 2 * Math.PI); g.fill();
    }
    parts = parts.filter(p => p.x < cw - 56);
    const sx = cw + 24, sw = w - sx - 18, sy0 = 24, sy1 = h * 0.46;
    g.strokeStyle = "rgba(237,232,223,.16)"; g.lineWidth = 1; g.strokeRect(sx, sy0, sw, sy1 - sy0);
    g.fillStyle = "#9C958A"; g.font = "500 10px 'JetBrains Mono', monospace"; g.fillText("PHOTODIODE PULSES", sx, sy0 - 8);
    pulses = pulses.filter(p => now - p.t < 3000);
    g.strokeStyle = "#D9875C"; g.lineWidth = 1.2; g.beginPath(); g.moveTo(sx, sy1 - 4);
    for (const p of pulses) { const x = sx + sw * (1 - (now - p.t) / 3000), y = sy1 - 4 - (sy1 - sy0 - 12) * p.a; g.lineTo(x - 2, sy1 - 4); g.lineTo(x, y); g.lineTo(x + 2, sy1 - 4); }
    g.lineTo(sx + sw, sy1 - 4); g.stroke();
    const by0 = h * 0.58, by1 = h - 46, bw = sw / 5;
    g.fillStyle = "#9C958A"; g.fillText("COUNTS BY SIZE, µm", sx, by0 - 8);
    for (let b = 0; b < 5; b++) bins[b] *= Math.exp(-dt / 6);
    const bmax = Math.max(4, ...bins);
    for (let b = 0; b < 5; b++) {
      const bh = (by1 - by0) * bins[b] / bmax;
      g.fillStyle = b < 3 ? "#D9875C" : "#6f695f"; g.fillRect(sx + b * bw + 4, by1 - bh, bw - 8, bh);
      g.fillStyle = "#9C958A"; g.font = "500 9px 'JetBrains Mono', monospace"; g.fillText(BIN_L[b], sx + b * bw + 2, by1 + 13);
    }
    const raw = TRUE_DRY * growthMass(st.rh, st.k);
    g.fillStyle = "#EDE8DF"; g.font = "600 13px 'JetBrains Mono', monospace"; g.fillText(`PM2.5 reported ${Math.round(raw)} µg/m³`, 18, h - 22);
    g.fillStyle = "#9C958A"; g.font = "500 11px 'JetBrains Mono', monospace";
    g.fillText(`true dry ${TRUE_DRY} · RH ${st.rh} %${gd > 1.05 ? " · blue halo: water" : ""}`, 18, h - 8);
  }
  readout(); requestAnimationFrame(frame);
  window.addEventListener("resize", drawRh);
  new IntersectionObserver(es => { if (es[0].isIntersecting) drawRh(); }).observe($("rhCanvas"));
})();
