/* Section 05: the Living Air Sensor. Three pieces:
   1. Thea Cao's six-scene concept film (living-air-sensor.html), redrawn in the site's style.
   2. The breath path through the robot (inhale, sense, feel, clean, exhale), animated SVG.
   3. A cartridge lab: eight wells, live glow against cycle count, and the robot's arithmetic (F0, F, ΔF/F0, corrected, index),
      driven by OddechSim.LivingSensor. Concept model, illustrative numbers, no experimental data. */
(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const S = window.OddechSim;
  const P = { bg: "#0c0b0a", ink: "#EDE8DF", grey: "#9C958A", hair: "rgba(237,232,223,.16)", acc: "#D9875C", ind: "#7E98BC", fill: "#1d1a17" };
  const fit = cv => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2), w = cv.clientWidth, h = cv.clientHeight;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const g = cv.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0); return { g, w, h };
  };
  const onScreen = (el, cb) => new IntersectionObserver(es => cb(es[0].isIntersecting), { threshold: 0.05 }).observe(el);
  const rr = (g, x, y, w, h, r) => { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h); };

  // ================================================================ 1. the film
  (function film() {
    const cv = $("filmCanvas"); if (!cv) return;
    const CH = [
      ["The vision", "Air quality, <em>through a living response.</em>", "A living-cell sensor translates airborne exposure into a measurable biological response.", "Concept demonstration · no experimental data"],
      ["The mechanism", "Stress changes <em>the signal.</em>", "Mitochondrial fluorescent staining changes with cellular stress. The response is nonlinear, but it can be quantified.", "Signal direction and size depend on the probe and the assay chosen."],
      ["The architecture", "One chamber. <em>A complete optical readout.</em>", "Air enters from above. Cells exchange gases through a membrane. Excitation comes from below; fluorescence is read from above.", "Light-tight chamber · emission-selective detector · camera upgrade"],
      ["The calibration", "Controlled exposure. <em>A reference response.</em>", "Controlled PM2.5 exposures establish a nonlinear reference curve linking exposure to relative fluorescence change.", "Illustrative curve only · fixed exposure time and assay conditions"],
      ["The comparison", "Relative change <em>is the reference.</em>", "Each culture is normalised to its own baseline and compared with matched controls, to reduce cell-to-cell variability.", "Illustrative values · normalisation reduces, but does not remove, biological variability"],
      ["The customisation", "Built around <em>respiratory biology.</em>", "Respiratory epithelial cells, with donor panels tailored by ancestry, age and smoking history.", "Proposed platform · donor-specific calibration and validation required"],
    ];
    let t = 0, playing = true, visible = false, scene = -1, last = performance.now();
    const dots = $("filmDots");
    dots.innerHTML = CH.map((c, i) => `<button aria-label="Scene ${i + 1}: ${c[0]}" data-i="${i}"></button>`).join("");
    dots.addEventListener("click", e => { const b = e.target.closest("[data-i]"); if (b) t = +b.dataset.i * 10 + 0.01; });
    $("filmPlay").addEventListener("click", () => { playing = !playing; $("filmPlay").textContent = playing ? "Pause" : "Play"; $("filmPlay").classList.toggle("on", playing); });
    $("filmPrev").addEventListener("click", () => { t = Math.max(0, (Math.floor(t / 10) - 1) * 10) + 0.01; });
    $("filmNext").addEventListener("click", () => { t = Math.min(50, (Math.floor(t / 10) + 1) * 10) + 0.01; });
    $("filmTime").addEventListener("input", e => { t = +e.target.value; });
    onScreen(cv, v => { visible = v; });

    let g;
    const line = (x1, y1, x2, y2, c = P.hair, w = 1) => { g.strokeStyle = c; g.lineWidth = w; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); };
    const text = (s, x, y, al = "center", c = P.ink, f = "500 12px 'JetBrains Mono', monospace") => { g.fillStyle = c; g.font = f; g.textAlign = al; g.textBaseline = "middle"; g.fillText(s, x, y); };
    const ell = (x, y, rx, ry, c, a = 1, rot = 0) => { g.globalAlpha = a; g.fillStyle = c; g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, 2 * Math.PI); g.fill(); g.globalAlpha = 1; };
    const arrow = (x1, y1, x2, y2, c = P.acc, w = 2) => { line(x1, y1, x2, y2, c, w); const a = Math.atan2(y2 - y1, x2 - x1);
      g.beginPath(); g.moveTo(x2, y2); g.lineTo(x2 - 9 * Math.cos(a - .45), y2 - 9 * Math.sin(a - .45)); g.lineTo(x2 - 9 * Math.cos(a + .45), y2 - 9 * Math.sin(a + .45)); g.closePath(); g.fillStyle = c; g.fill(); };
    function mito(x, y, r, glow) {
      g.save(); g.shadowBlur = 6 + glow * 26; g.shadowColor = P.acc;
      ell(x, y, r, r * .46, P.acc, .14 + .5 * glow, -.25);
      g.strokeStyle = P.acc; g.lineWidth = 1.2; g.beginPath(); g.ellipse(x, y, r, r * .46, -.25, 0, 2 * Math.PI); g.stroke();
      g.shadowBlur = 0; g.beginPath();
      for (let j = 0; j <= 18; j++) { const xx = x - r * .7 + j * r * 1.4 / 18, yy = y + Math.sin(j * .9) * r * .2 - (xx - x) * .25 * .46; j ? g.lineTo(xx, yy) : g.moveTo(xx, yy); }
      g.stroke(); g.restore();
    }
    function cell(x, y, r, glow) {
      const grd = g.createRadialGradient(x - r * .3, y - r * .3, r * .1, x, y, r * 1.1); grd.addColorStop(0, "rgba(233,160,180,.20)"); grd.addColorStop(1, "rgba(233,160,180,.04)");
      g.fillStyle = grd; g.beginPath(); g.ellipse(x, y, r, r * .74, 0, 0, 2 * Math.PI); g.fill();
      g.strokeStyle = "rgba(237,232,223,.45)"; g.lineWidth = 1.3; g.stroke();
      ell(x - r * .25, y - r * .08, r * .24, r * .2, P.ind, .35);
      mito(x + r * .38, y - r * .22, r * .24, glow); mito(x - r * .05, y + r * .34, r * .25, glow); mito(x + r * .2, y + r * .05, r * .18, glow * .8);
    }
    function particles(x, y, w, h, p, n = 22) {
      for (let i = 0; i < n; i++) { const q = (i / n + p * .9) % 1, xx = x + q * w, yy = y + ((i * 47) % 101) / 101 * h + Math.sin(p * 7 + i) * 4, r = 2 + (i % 4);
        ell(xx, yy, r * 1.8, r * 1.8, "#8a7e72", .18); ell(xx, yy, r, r, "#cfc6b8", .85); }
    }
    function draw() {
      const f = fit(cv), W = f.w, H = f.h; g = f.g;
      g.fillStyle = P.bg; g.fillRect(0, 0, W, H);
      const vg = g.createRadialGradient(W * .5, H * .55, 10, W * .5, H * .55, W * .7); vg.addColorStop(0, "rgba(217,135,92,.06)"); vg.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = vg; g.fillRect(0, 0, W, H);
      const s = Math.min(5, Math.floor(t / 10)), p = (t - s * 10) / 10, k = Math.min(W / 760, H / 428);
      if (s !== scene) {
        scene = s; const c = CH[s];
        $("filmTitle").innerHTML = c[1]; $("filmCaption").textContent = c[2]; $("filmNote").textContent = c[3];
        $("filmNum").textContent = String(s + 1).padStart(2, "0"); $("filmScene").textContent = `${s + 1} / 6 · ${c[0]}`;
        dots.querySelectorAll("button").forEach((b, i) => b.classList.toggle("on", i === s));
      }
      g.save(); g.translate(W / 2 - 380 * k, H / 2 - 214 * k); g.scale(k, k);
      if (s === 0) {
        particles(40, 150, 150, 110, p); text("AIRBORNE PARTICLES", 115, 300, "center", P.grey);
        arrow(205, 205, 285, 205, P.acc); cell(380, 205, 88, .25 + .55 * p); text("LIVING AIRWAY CELLS", 380, 318, "center", P.grey);
        arrow(478, 205, 548, 205, P.acc);
        for (let i = 0; i < 5; i++) { const bh = (34 + i * i * 9) * (.75 + .25 * p); g.fillStyle = P.acc; g.globalAlpha = .35 + i * .13; g.fillRect(570 + i * 28, 262 - bh, 16, bh); }
        g.globalAlpha = 1; line(565, 262, 715, 262, P.hair); text("OPTICAL RESPONSE", 640, 300, "center", P.grey);
      }
      if (s === 1) {
        cell(230, 205, 120, .15 + .85 * p); text("MITOCHONDRIA, STAINED", 230, 50, "center", P.grey);
        const gx = 430, gy = 90, gw = 280, gh = 210; line(gx, gy + gh, gx + gw, gy + gh, P.ink); line(gx, gy, gx, gy + gh, P.ink);
        text("RELATIVE FLUORESCENCE", gx + gw / 2, gy - 22, "center", P.grey);
        g.strokeStyle = P.acc; g.lineWidth = 2.5; g.beginPath();
        for (let i = 0; i <= gw * p; i++) { const q = i / gw, yy = gy + gh - 12 - (gh - 40) / (1 + Math.exp(-11 * (q - .5))); i ? g.lineTo(gx + i, yy) : g.moveTo(gx + i, yy); }
        g.stroke(); text("stress →", gx + gw - 30, gy + gh + 18, "center", P.grey); text("NONLINEAR, QUANTIFIABLE", gx + gw / 2, gy + gh + 46, "center", P.acc);
      }
      if (s === 2) {
        const L = 130, R = 630, T = 92, B = 326, cx = 380;
        g.fillStyle = "#070706"; g.fillRect(L, T, R - L, B - T); g.strokeStyle = "rgba(237,232,223,.4)"; g.lineWidth = 1.5; g.strokeRect(L, T, R - L, B - T);
        text("LIGHT-TIGHT CHAMBER", L + 16, T + 20, "left", P.grey);
        arrow(L + 34, 30, L + 34, T + 26, P.ink); text("air in", L + 34, 18, "center", P.ink); arrow(R - 34, T + 26, R - 34, 30, P.ind); text("air out", R - 34, 18, "center", P.ind);
        particles(L + 20, T + 40, R - L - 40, 40, p, 16);
        g.fillStyle = P.fill; g.fillRect(cx - 52, 40, 104, 28); g.strokeStyle = P.hair; g.strokeRect(cx - 52, 40, 104, 28); text("DETECTOR", cx, 54, "center", P.ink);
        g.save(); g.shadowColor = P.acc; g.shadowBlur = 16; g.globalAlpha = .18 + .3 * p; g.fillStyle = P.acc; g.fillRect(cx - 6, 70, 12, 160); g.restore(); g.globalAlpha = 1; arrow(cx, 226, cx, 76, P.acc, 2.2);
        text("emission ↑", cx + 18, 150, "left", P.acc);
        line(L + 20, 236, R - 20, 236, "rgba(237,232,223,.5)", 2); for (let i = 0; i <= 22; i++) line(L + 20 + i * (R - L - 40) / 22, 232, L + 20 + i * (R - L - 40) / 22, 240, P.grey);
        text("gas-exchange membrane", R - 24, 222, "right", P.grey);
        for (let i = 0; i < 6; i++) cell(L + 62 + i * 75, 268, 30, .3 + .5 * p);
        g.save(); g.shadowColor = P.ind; g.shadowBlur = 16; g.globalAlpha = .35; g.fillStyle = P.ind; g.fillRect(cx - 6, 300, 12, 90); g.restore(); g.globalAlpha = 1;
        arrow(cx, 400, cx, 302, P.ind, 2.2); text("EXCITATION LED", cx, 414, "center", P.ind); text("camera upgrade", R + 14, 54, "left", P.grey);
      }
      if (s === 3) {
        const x0 = 110, x1 = 690, y0 = 340, y1 = 60; line(x0, y0, x1, y0, P.ink); line(x0, y1, x0, y0, P.ink);
        text("RELATIVE FLUORESCENCE CHANGE", 400, 30, "center", P.grey); text("CONTROLLED PM2.5 EXPOSURE →", 400, 380, "center", P.grey); text("schematic", x1, y1 + 4, "right", P.grey);
        const f = q => .08 + .78 / (1 + Math.exp(-(q - .5) * 9)), reach = .12 + .88 * p;
        g.strokeStyle = P.acc; g.lineWidth = 3; g.beginPath();
        for (let i = 0; i <= 100 * reach; i++) { const q = i / 100, x = x0 + q * (x1 - x0), y = y0 - f(q) * (y0 - y1); i ? g.lineTo(x, y) : g.moveTo(x, y); }
        g.stroke();
        for (let i = 0; i < 7; i++) { const q = i / 6; if (q <= reach) { const x = x0 + q * (x1 - x0), y = y0 - f(q) * (y0 - y1); ell(x, y, 6, 6, P.acc); line(x, y - 14, x, y + 14, "rgba(217,135,92,.5)", 1.5); } }
      }
      if (s === 4) {
        text("TWO CULTURES, DIFFERENT BASELINES", 380, 40, "center", P.grey);
        [["Culture A", 100, 125], ["Culture B", 160, 200]].forEach((r, i) => {
          const y = 96 + i * 96, bw = 470 / 210, grow = .4 + .6 * p;
          text(r[0], 60, y + 14, "left", P.ink, "400 20px 'Instrument Serif', serif");
          g.fillStyle = "rgba(237,232,223,.28)"; g.fillRect(200, y, bw * r[1], 12);
          g.fillStyle = P.acc; g.fillRect(200, y + 22, bw * (r[1] + (r[2] - r[1]) * grow), 12);
          text("F₀ " + r[1], 210 + bw * r[1], y + 6, "left", P.grey); text("F " + r[2], 210 + bw * r[2], y + 28, "left", P.acc);
        });
        arrow(380, 300, 380, 336, P.acc); text("A: +25 %      B: +25 %", 380, 362, "center", P.acc, "500 20px 'JetBrains Mono', monospace");
        text("within-culture relative change, against matched controls", 380, 398, "center", P.grey);
      }
      if (s === 5) {
        for (let i = 0; i < 7; i++) cell(380 + (i - 3) * 92, 150, 38, .35 + .4 * Math.sin(p * 6 + i) ** 2);
        text("RESPIRATORY EPITHELIAL CELLS", 380, 60, "center", P.grey);
        ["donor ancestry", "age", "smoking history"].forEach((l, i) => { const x = 200 + i * 180; line(x, 236, x, 262, P.hair); text(l, x, 282, "center", P.ink, "400 22px 'Instrument Serif', serif"); });
        text("A CONFIGURABLE LIVING-CELL SENSING PLATFORM", 380, 360, "center", P.acc);
      }
      g.restore();
      $("filmTime").value = t.toFixed(1); $("filmClock").textContent = "00:" + String(Math.floor(t)).padStart(2, "0") + " / 01:00";
    }
    function frame(now) {
      requestAnimationFrame(frame);
      const dt = Math.min(.1, (now - last) / 1000); last = now;
      if (!visible) return;
      if (playing) { t += dt; if (t >= 60) t = 0; }
      draw();
    }
    requestAnimationFrame(frame);
  })();

  // ================================================================ 2. the breath path, the cells, the cartridge's loop (pictures from art.js)
  (function pictures() {
    const A = window.OddechArt; if (!A) return;
    const put = (id, html) => { const el = $(id); if (el) el.innerHTML = html; };
    put("breathArt", A.airLoop(true)); put("cellsArt", A.cells(true)); put("loopArt", A.cartridgeLoop(true));
    const steps = Array.from(document.querySelectorAll(".breath-steps li")); let k = 0;
    if (steps.length) setInterval(() => { steps.forEach((li, i) => li.classList.toggle("on", i === k)); k = (k + 1) % steps.length; }, 1600);
  })();

  // ================================================================ 3. the cartridge lab
  (function lab() {
    const wc = $("wellCanvas"), bc = $("bioChart"); if (!wc || !bc || !S) return;
    // [PM2.5 mass µg/m³, harm per unit mass (sim.js TOX), label]
    const AIR = { clean: [8, 1.0, "clean room air"], smog: [70, 1.4, "Kraków winter air, smoke from solid-fuel heating"], cook: [70, 0.7, "cooking fumes"], candle: [70, 1.6, "candle smoke"] };
    const CYCLES = 48;
    let air = "smog", sensor, running = true, visible = false, acc = 0, last = performance.now();
    const reset = () => { sensor = new S.LivingSensor(29 + Math.floor(Math.random() * 1000)); acc = 0; draw(); };
    $("bioAir").addEventListener("click", e => { const b = e.target.closest("[data-air]"); if (!b) return; air = b.dataset.air;
      $("bioAir").querySelectorAll("[data-air]").forEach(x => x.classList.toggle("on", x === b)); reset(); running = true; $("bioRun").textContent = "Pause"; $("bioRun").classList.add("on"); });
    $("bioRun").addEventListener("click", () => { if (sensor.n >= CYCLES) reset(); running = !running || sensor.n === 0; $("bioRun").textContent = running ? "Pause" : "Run"; $("bioRun").classList.toggle("on", running); });
    $("bioReset").addEventListener("click", reset);
    onScreen(wc, v => { visible = v; });

    function drawWells() {
      const { g, w, h } = fit(wc), L = sensor.last;
      g.clearRect(0, 0, w, h);
      const slideW = Math.min(w - 20, 520), slideH = (h - 60) / 2, x0 = (w - slideW) / 2;
      const names = ["E1", "E2", "E3", "E4", "C1", "C2", "REF", "BLANK"];
      for (let s = 0; s < 2; s++) {
        const y0 = 16 + s * (slideH + 26);
        g.fillStyle = "rgba(220,228,236,.10)"; g.strokeStyle = "rgba(237,232,223,.35)"; g.lineWidth = 1;
        rr(g, x0, y0, slideW, slideH, 6); g.fill(); g.stroke();
        g.fillStyle = "rgba(237,232,223,.82)"; g.fillRect(x0 + 6, y0 + 6, slideW * .17, slideH - 12);
        g.fillStyle = "#1F1D1A"; g.textAlign = "center"; g.textBaseline = "alphabetic";
        g.font = "600 11px 'JetBrains Mono', monospace"; g.fillText("ODDECH", x0 + 6 + slideW * .085, y0 + slideH / 2 - 7);
        g.font = "500 10px 'JetBrains Mono', monospace"; g.fillText(s ? "CONTROLS" : "EXPOSED", x0 + 6 + slideW * .085, y0 + slideH / 2 + 9);
        const ww = (slideW * .78 - 30) / 4, wy = y0 + 12, wh = slideH - 24;
        for (let i = 0; i < 4; i++) {
          const k = s * 4 + i, x = x0 + slideW * .2 + i * (ww + 10), role = S.BIO.roles[k];
          const fold = k < 4 ? (1 + L.exp[k]) / (1 + L.dCtl) : k < 6 ? (1 + L.ctl[k - 4]) / (1 + L.dCtl) : 1, rel = fold - 1;   // lamp-corrected, over the controls
          g.fillStyle = role === "blank" ? "rgba(255,255,255,.04)" : role === "reference" ? "rgba(126,152,188,.35)" : "rgba(233,160,180,.30)";
          rr(g, x, wy, ww, wh, 8); g.fill(); g.strokeStyle = "rgba(255,255,255,.35)"; g.stroke();
          if (role === "exposed" || role === "control") {
            const glow = Math.max(0, Math.min(1, rel / 1.2));
            const grd = g.createRadialGradient(x + ww / 2, wy + wh / 2, 2, x + ww / 2, wy + wh / 2, Math.max(ww, wh) * .7);
            grd.addColorStop(0, `rgba(255,140,90,${(0.15 + 0.85 * glow).toFixed(3)})`); grd.addColorStop(1, "rgba(255,140,90,0)");
            g.fillStyle = grd; g.fillRect(x, wy, ww, wh);
            for (let c = 0; c < 9; c++) { const cx = x + 8 + (c % 3) * (ww - 16) / 2, cy = wy + 18 + Math.floor(c / 3) * (wh - 28) / 2;
              g.fillStyle = `rgba(255,${Math.round(190 - 80 * glow)},${Math.round(160 - 90 * glow)},${(0.35 + 0.6 * glow).toFixed(2)})`; g.beginPath(); g.arc(cx, cy, 2.2 + 1.5 * glow, 0, 2 * Math.PI); g.fill(); }
          }
          if (role === "reference") { g.fillStyle = "rgba(160,190,230,.55)"; g.beginPath(); g.arc(x + ww / 2, wy + wh / 2, ww * .22, 0, 2 * Math.PI); g.fill(); }
          g.fillStyle = "#EDE8DF"; g.font = "600 10.5px 'JetBrains Mono', monospace"; g.textAlign = "center"; g.fillText(names[k], x + ww / 2, wy + wh + 13);
          const tag = role === "reference" ? `lamp ${(100 * L.lampRel).toFixed(0)} %` : role === "blank" ? `glow ${Math.max(0, L.blank).toFixed(0)}` : fold.toFixed(2) + "×";
          g.fillStyle = role === "exposed" && rel > 0.05 ? "#D9875C" : "#9C958A"; g.font = "500 10px 'JetBrains Mono', monospace"; g.fillText(tag, x + ww / 2, wy + 12);
        }
      }
      g.fillStyle = "#9C958A"; g.font = "500 10.5px 'JetBrains Mono', monospace"; g.textAlign = "left";
      g.fillText(`air in: ${AIR[air][2]}, PM2.5 ${AIR[air][0]} µg/m³`, x0, h - 4);
    }
    function drawChart() {
      const { g, w, h } = fit(bc), H = sensor.hist; g.clearRect(0, 0, w, h);
      const x0 = 46, x1 = w - 46, y0 = h - 26, y1 = 14, N = CYCLES;
      let ymax = 1200; for (const r of H) ymax = Math.max(ymax, r.F0exp * (1 + Math.max(...r.exp)) * 1.08);
      const X = n => x0 + (x1 - x0) * n / N, Y = v => y0 - (y0 - y1) * v / ymax, Yi = v => y0 - (y0 - y1) * v / 100;
      g.textBaseline = "alphabetic"; g.strokeStyle = "rgba(237,232,223,.12)"; g.lineWidth = 1; g.font = "500 10px 'JetBrains Mono', monospace"; g.fillStyle = "#9C958A"; g.textAlign = "right";
      for (let v = 0; v <= ymax; v += 500) { g.beginPath(); g.moveTo(x0, Y(v)); g.lineTo(x1, Y(v)); g.stroke(); g.fillText(v, x0 - 6, Y(v) + 3); }
      g.textAlign = "center"; for (let n = 0; n <= N; n += 6) g.fillText(n, X(n), y0 + 16);
      g.textAlign = "left"; g.fillText("intensity, a.u.", x0 + 4, y1 + 2); g.textAlign = "right"; g.fillText("cycle count (10 min each)", x1, y0 - 6);
      g.fillStyle = "#E8B48F"; g.textAlign = "left"; g.fillText("index", x1 + 6, y1 + 2);
      if (!H.length) return;
      const F0 = H[0].F0exp; g.setLineDash([4, 4]); g.strokeStyle = "rgba(237,232,223,.4)"; g.beginPath(); g.moveTo(x0, Y(F0)); g.lineTo(x1, Y(F0)); g.stroke(); g.setLineDash([]);
      g.fillStyle = "#EDE8DF"; g.fillText("F₀", x1 + 6, Y(F0) + 3);
      g.fillStyle = "rgba(217,135,92,.16)"; g.beginPath();                        // spread of the four exposed wells, lamp-corrected
      const wcor = r => r.exp.map((e, i) => r.F0[i] * (1 + e));
      H.forEach((r, i) => { const hi = Math.max(...wcor(r)); i ? g.lineTo(X(r.n), Y(hi)) : g.moveTo(X(r.n), Y(hi)); });
      for (let i = H.length - 1; i >= 0; i--) g.lineTo(X(H[i].n), Y(Math.min(...wcor(H[i]))));
      g.closePath(); g.fill();
      const plot = (get, c, wdt, dash, yf = Y) => { g.strokeStyle = c; g.lineWidth = wdt; g.setLineDash(dash); g.beginPath(); H.forEach((r, i) => i ? g.lineTo(X(r.n), yf(get(r))) : g.moveTo(X(r.n), yf(get(r)))); g.stroke(); g.setLineDash([]); };
      const cF0 = r => (r.F0[4] + r.F0[5]) / 2, eC = r => r.F0exp * (1 + r.dExp), cC = r => cF0(r) * (1 + r.dCtl);   // lamp-corrected glow
      plot(r => r.F[7] * 10, "#77716a", 1.2, [2, 3]); plot(cC, "#7E98BC", 1.6, []); plot(eC, "#D9875C", 2.4, []); plot(r => r.index, "#E8B48F", 1.2, [5, 3], Yi);
      const L = H[H.length - 1]; g.fillStyle = "#D9875C"; g.beginPath(); g.arc(X(L.n), Y(eC(L)), 4, 0, 2 * Math.PI); g.fill();
      g.fillStyle = "#77716a"; g.textAlign = "left"; g.fillText("blank ×10", x0 + 4, Y(H[0].F[7] * 10) - 6);
    }
    function drawTable() {
      const L = sensor.last, f = v => v.toFixed(0), x = v => v.toFixed(2) + "×";   // no signed numbers: ratios to a baseline, as an assay reads
      const cF0 = (L.F0[4] + L.F0[5]) / 2;
      $("bioTable").innerHTML = `<tr><th>wells</th><th>F₀ at start</th><th>F now, corrected</th><th>F / F₀</th><th>over controls</th></tr>
        <tr class="hi"><td>Exposed, mean of 4</td><td>${f(L.F0exp)}</td><td>${f(L.F0exp * (1 + L.dExp))}</td><td>${x(1 + L.dExp)} <span class="sd">± ${L.sd.toFixed(2)}</span></td><td>${x(L.fold)}</td></tr>
        <tr><td>Filtered controls, mean of 2</td><td>${f(cF0)}</td><td>${f(cF0 * (1 + L.dCtl))}</td><td>${x(1 + L.dCtl)}</td><td>1.00× baseline</td></tr>
        <tr><td>Reference (lamp)</td><td>${f(L.F0[6])}</td><td>${f(L.F[6])}</td><td>lamp at ${(100 * L.lampRel).toFixed(0)} %</td><td>drift corrected</td></tr>
        <tr><td>Blank, no cells</td><td>${f(L.F0[7])}</td><td>${f(L.F[7])}</td><td>dust glow ${f(Math.max(0, L.blank))}</td><td>taken out</td></tr>
        <tr class="hi"><td><b>Stress signal: exposed over controls</b></td><td></td><td></td><td></td><td><b>${x(L.fold)}</b></td></tr>`;
      const idx = L.index, n = L.n, tox = AIR[air][1], dusty = AIR[air][0] > 20;
      const word = n === 0 ? "Waiting for the first breath." : idx < 12 ? "The cells are calm: this air is not stressing them." : idx < 35 ? "The cells are reacting: this air is doing harm." : "Strong stress response: harmful air. Act now.";
      const tail = n > 6 && dusty ? (tox > 1.2 ? " For this much dust the response is high: it behaves like smoke." : tox < 1 ? " Same dust count as the smog, much less stress: less harmful per gram." : "") : "";
      $("bioVerdict").innerHTML = `<div class="gauge">${idx.toFixed(0)}<small>/ 100</small></div><p><b>Stress index after ${n} cycles (${(n / 6).toFixed(1)} h).</b> ${word}${tail}</p>`;
      $("bioCount").textContent = `cycle ${n} / ${CYCLES}`;
    }
    function draw() { drawWells(); drawChart(); drawTable(); }
    function frame(now) {
      requestAnimationFrame(frame);
      const dt = Math.min(.1, (now - last) / 1000); last = now;
      if (!visible || !running) return;
      acc += dt;
      if (acc > 0.55 && sensor.n < CYCLES) { acc = 0; const a = AIR[air]; sensor.cycle(a[0], a[0] * a[1], sensor.n * 600); draw(); }
    }
    reset(); requestAnimationFrame(frame);
    window.addEventListener("resize", draw);
  })();
})();
