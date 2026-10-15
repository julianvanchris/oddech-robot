/* Section 15: the pitch deck. Fourteen 1280×720 slides, scaled to the frame; arrow keys, thumbnails, Present (full screen,
   key F) and print to PDF (one slide per page). Slide changes morph: what two slides share (wordmark, kicker, title, footer,
   the ring that marks each slide's key point, the cartridge, the headline numbers) glides to its new place through the
   View Transitions API, then the slide's content enters in sequence. Without the API, or with Motion off, slides fade.
   Numbers come from the page's own sources: the H1 and H2 benchmarks and the example evening (bench.json, written by
   test_sim.js), the living-sensor model and the unit-economics function (sim.js). */
(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const deck = $("deck"), stage = $("deckStage"); if (!deck || !stage) return;
  const S = window.OddechSim, B = window.ODDECH_BENCH, CARE = B && B.care, EX = B && B.example, COL = window.OddechColors;
  const mono = 'font-family="JetBrains Mono, monospace"', serif = 'font-family="Instrument Serif, serif"';
  const niceStep = (mx, n) => { const raw = mx / n, p = Math.pow(10, Math.floor(Math.log10(raw))); return [1, 2, 2.5, 5, 10].map(k => k * p).find(s => s >= raw); };

  // ---------------------------------------------------------------- pictures, drawn in SVG
  function robotArt(h) {
    return `<svg viewBox="0 0 260 520" style="height:${h}px" aria-hidden="true">
      <defs><radialGradient id="dkGlow"><stop offset="0" stop-color="#ff9a66" stop-opacity=".95"/><stop offset="1" stop-color="#ff9a66" stop-opacity="0"/></radialGradient></defs>
      <g stroke="#EDE8DF" stroke-width="1.6" fill="none">
        <path d="M 40 70 C 10 60 4 30 30 18" stroke="#9C958A" stroke-dasharray="3 5"/><path d="M 220 70 C 250 60 256 30 230 18" stroke="#7E98BC" stroke-dasharray="3 5"/>
        <rect x="88" y="40" width="84" height="46" rx="12" fill="#1d1a17"/><circle cx="130" cy="63" r="7" fill="#D9875C" stroke="none"/>
        <rect x="124" y="86" width="12" height="250" fill="#1d1a17"/>
        <rect x="58" y="336" width="144" height="128" rx="26" fill="#1d1a17"/>
        <rect x="82" y="356" width="96" height="44" rx="6" fill="#0c0b0a" data-focus/>
      </g>
      ${[0, 1, 2, 3].map(i => `<circle cx="${96 + i * 23}" cy="378" r="14" fill="url(#dkGlow)"><animate attributeName="opacity" values=".3;1;.3" dur="3.6s" begin="${i * .4}s" repeatCount="indefinite"/></circle><rect x="${89 + i * 23}" y="371" width="14" height="14" rx="3" fill="#e9a0b4" fill-opacity=".55"/>`).join("")}
      <rect x="70" y="424" width="120" height="6" rx="3" fill="#7E98BC"/><circle cx="92" cy="470" r="12" fill="#2a2622" stroke="#EDE8DF"/><circle cx="168" cy="470" r="12" fill="#2a2622" stroke="#EDE8DF"/>
      <text x="184" y="34" fill="#9C958A" ${mono} font-size="12">1.6 m</text>
      <text x="146" y="256" fill="#9C958A" ${mono} font-size="12">1.1 m</text>
      <text x="130" y="416" fill="#D9875C" ${mono} font-size="11" text-anchor="middle">living cells</text>
    </svg>`;
  }
  function wellsArt(w, focus) {                           // the cartridge: same drawing in the breath path and on its own slide
    const role = ["E1", "E2", "E3", "E4", "C1", "C2", "REF", "BLK"];
    let s = `<svg viewBox="0 0 470 300" style="width:${w}px;display:block" aria-hidden="true"><g ${mono} font-size="12">`;
    for (let r = 0; r < 2; r++) {
      s += `<rect x="10" y="${20 + r * 140}" width="450" height="110" rx="8" fill="rgba(220,228,236,.07)" stroke="rgba(237,232,223,.35)"${focus && !r ? " data-focus" : ""}/>`;
      s += `<rect x="18" y="${28 + r * 140}" width="70" height="94" fill="rgba(237,232,223,.8)"/><text x="53" y="${80 + r * 140}" text-anchor="middle" fill="#1F1D1A" font-weight="600">${r ? "CONTROL" : "EXPOSED"}</text>`;
      for (let i = 0; i < 4; i++) {
        const k = r * 4 + i, x = 104 + i * 88, y = 30 + r * 140, c = k < 4 ? "#ff9a66" : k < 6 ? "#e9a0b4" : k === 6 ? "#9fb4d2" : "#2a2622";
        s += `<rect x="${x}" y="${y}" width="76" height="76" rx="10" fill="${c}" fill-opacity="${k < 4 ? .75 : .35}" stroke="rgba(255,255,255,.35)"/>`;
        if (k < 4) s += `<rect x="${x}" y="${y}" width="76" height="76" rx="10" fill="#ff9a66"><animate attributeName="opacity" values=".1;.7;.1" dur="4s" begin="${i * .3}s" repeatCount="indefinite"/></rect>`;
        s += `<text x="${x + 38}" y="${y + 96}" text-anchor="middle" fill="#9C958A">${role[k]}</text>`;
      }
    }
    return s + `</g></svg>`;
  }
  function breathArt() {                                  // inhale, sense, feel, clean, exhale; the cartridge is laid over it
    const A = "#D9875C", I = "#7E98BC", T = "#EDE8DF", G = "#9C958A", Hh = "rgba(237,232,223,.25)";
    const box = (x, y, w, h, label, sub) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="#14120f" stroke="${Hh}"/>
      <text x="${x + w / 2}" y="${y + h / 2 - 2}" fill="${T}" ${serif} font-size="24" text-anchor="middle">${label}</text>
      <text x="${x + w / 2}" y="${y + h / 2 + 20}" fill="${G}" ${mono} font-size="11" text-anchor="middle">${sub}</text>`;
    const path = (id, d, c) => `<path id="${id}" d="${d}" fill="none" stroke="${c}" stroke-width="2" stroke-dasharray="6 6" class="sl-flow"/>`;
    const dot = (id, c, dur, b) => `<circle r="3.5" fill="${c}"><animateMotion dur="${dur}s" begin="${-b}s" repeatCount="indefinite"><mpath href="#${id}"/></animateMotion></circle>`;   // already running: no dot parked at the origin
    return `<svg viewBox="0 0 1120 280" width="1120" height="280" aria-hidden="true">
      ${Array.from({ length: 22 }, (_, i) => `<circle cx="${14 + (i * 37) % 96}" cy="${40 + (i * 53) % 190}" r="${2 + i % 3}" fill="#cfc6b8" fill-opacity=".7"/>`).join("")}
      <text x="62" y="268" fill="${G}" ${mono} font-size="11" text-anchor="middle">ROOM AIR</text>
      <circle cx="160" cy="140" r="22" fill="none" stroke="${A}" stroke-width="2" data-focus/><circle cx="160" cy="140" r="6" fill="${A}"/>
      <text x="160" y="94" fill="${A}" ${mono} font-size="11" text-anchor="middle">INHALE · NOSE</text>
      ${path("dkb1", "M 182 140 L 246 140", A)}${box(246, 100, 172, 80, "Dust counter", "PM1 · PM2.5 · PM10")}
      ${path("dkb2", "M 418 124 C 456 124 462 92 498 92", A)}${path("dkb3", "M 418 158 C 436 170 438 181 452 181", I)}
      <rect x="452" y="169" width="34" height="24" rx="3" fill="#1d2430" stroke="${I}"/><text x="469" y="185" fill="${I}" ${mono} font-size="9" text-anchor="middle">HEPA</text>
      ${path("dkb4", "M 486 181 L 498 181", I)}
      <text x="645" y="30" fill="${T}" ${serif} font-size="22" text-anchor="middle">Living cartridge · 8 wells</text>
      <text x="645" y="262" fill="${G}" ${mono} font-size="10.5" text-anchor="middle">LED below · detector above · 37 °C</text>
      ${path("dkb5", "M 794 140 L 850 140", T)}${box(850, 100, 172, 80, "HEPA + carbon", "filters everything")}
      ${path("dkb6", "M 1022 140 L 1050 140 L 1050 200", I)}
      <circle cx="1050" cy="222" r="20" fill="none" stroke="${I}" stroke-width="2"/><circle cx="1050" cy="222" r="6" fill="${I}"/>
      <text x="1050" y="262" fill="${I}" ${mono} font-size="11" text-anchor="middle">EXHALE · CLEAN AIR</text>
      ${dot("dkb1", A, 1.6, 0)}${dot("dkb1", A, 1.6, .8)}${dot("dkb2", A, 1.4, .3)}${dot("dkb3", I, 1.8, .2)}${dot("dkb5", T, 1.2, .5)}${dot("dkb6", I, 1.6, .1)}
    </svg>`;
  }
  const RUN = (m, tox) => { const L = new S.LivingSensor(3), out = [0]; for (let i = 0; i < 36; i++) out.push(L.cycle(m, m * tox, i * 600).index); return out; };
  const BIO = S && S.LivingSensor ? { smoke: RUN(70, 1.4), cook: RUN(70, 0.7), clean: RUN(8, 1.0) } : null;
  function bioCurves() {                                  // the model's own response, same mass, three kinds of air
    if (!BIO) return "";
    const sets = [["Kraków winter smoke · 70", BIO.smoke, "#D9875C"], ["Cooking fumes · 70", BIO.cook, "#E8B48F"], ["Clean room · 8", BIO.clean, "#7E98BC"]];
    const W = 520, H = 300, x0 = 46, x1 = W - 10, y0 = H - 34, y1 = 12, X = n => x0 + (x1 - x0) * n / 36, Y = v => y0 - (y0 - y1) * v / 100;
    let s = `<svg viewBox="0 0 ${W} ${H}" style="width:${W}px" aria-hidden="true"><g ${mono} font-size="12" fill="#9C958A">`;
    for (const v of [0, 25, 50, 75, 100]) s += `<line x1="${x0}" x2="${x1}" y1="${Y(v)}" y2="${Y(v)}" stroke="rgba(237,232,223,.1)"/><text x="${x0 - 8}" y="${Y(v) + 4}" text-anchor="end">${v}</text>`;
    for (const n of [0, 12, 24, 36]) s += `<text x="${X(n)}" y="${y0 + 20}" text-anchor="middle">${n}</text>`;
    s += `<text x="${X(18)}" y="${y0 + 20}" text-anchor="middle">cycles of 10 min</text><text x="${x0 + 6}" y="${y1 + 12}">stress index</text>`;
    sets.forEach(([name, v, c], i) => {
      s += `<path class="draw" pathLength="1" d="${v.map((y, n) => (n ? "L" : "M") + X(n).toFixed(1) + " " + Y(y).toFixed(1)).join(" ")}" fill="none" stroke="${c}" stroke-width="${i ? 2 : 3}"/>`;
      s += `<text x="${x1}" y="${Y(v[36]) - 8}" text-anchor="end" fill="${c}">${name}: ${Math.round(v[36])}</text>`;
    });
    return s + `</g></svg>`;
  }

  // ---------------------------------------------------------------- numbers from the page's own sources
  const pct = v => Math.round(100 * v);
  const under = v => { const p = pct(1 - Math.exp(v)); return p >= 0 ? `${p} % too low` : `${-p} % too high`; };
  const tErr = v => pct(Math.exp(v) - 1);                 // typical error, from the mean |error| of ln(PM2.5 + 2)
  const ue = S && S.unitEconomics ? S.unitEconomics({ hw: 1100, fee: 120, cart: 4, pc: 25, svc: 20, life: 36 }) : null;
  const eur = v => "€" + Math.round(v).toLocaleString("en-GB");
  const cutC = CARE ? pct(CARE.median.cutCorner) : 0;
  const monLow = CARE ? pct(1 - Math.exp(CARE.median.monitorLog)) : 0;
  const bioX = BIO ? (BIO.smoke[36] / BIO.cook[36]).toFixed(1) : "–";
  const barW = v => (100 * (Math.exp(v) - 1) / (Math.exp(B.median.fixed4_people) - 1)).toFixed(1) + "%";

  function strip() {                                      // H2: each room's cut in the child's dose, against two ways of running the purifier
    const rows = CARE.rows, W = 520, H = 168, x0 = 10, x1 = W - 14;
    const fC = r => 1 - r.oddech / r.corner, fH = r => 1 - r.oddech / r.high, all = rows.map(fC).concat(rows.map(fH));
    const lo = Math.min(-0.05, Math.floor(Math.min(...all) * 20) / 20), hi = Math.max(0.35, Math.ceil(Math.max(...all) * 20) / 20);
    const X = v => x0 + (x1 - x0) * (v - lo) / (hi - lo);
    let s = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true"><g ${mono} font-size="11" fill="#8A847A">`;
    for (let v = 0; v <= hi + 1e-9; v += 0.1) s += `<line x1="${X(v).toFixed(1)}" x2="${X(v).toFixed(1)}" y1="22" y2="${H - 24}" stroke="rgba(31,29,26,${v < 1e-9 ? .45 : .1})"/><text x="${X(v).toFixed(1)}" y="${H - 8}" text-anchor="middle">${pct(v)} %</text>`;
    [["vs the purifier left in its corner", fC, "#B4532A", 48, CARE.median.cutCorner, CARE.wins.corner], ["vs the purifier on high, all the time", fH, "#2E4A6E", 112, CARE.median.cutHigh, CARE.wins.high]].forEach(([label, f, c, y, m, wins]) => {
      s += `<text x="${x0}" y="${y - 20}" fill="#4A4640" paint-order="stroke" stroke="#EFEBE3" stroke-width="6">${label} · lower in ${wins} of ${rows.length}</text>`;
      rows.forEach((r, i) => { s += `<circle class="pop" cx="${X(f(r)).toFixed(1)}" cy="${y + ((i % 3) - 1) * 6}" r="5" fill="${c}" fill-opacity=".72"/>`; });
      s += `<line x1="${X(m).toFixed(1)}" x2="${X(m).toFixed(1)}" y1="${y - 13}" y2="${y + 13}" stroke="${c}" stroke-width="3"/><text x="${(X(m) + 8).toFixed(1)}" y="${y + 24}" fill="${c}" font-weight="600" paint-order="stroke" stroke="#EFEBE3" stroke-width="6">median −${pct(m)} %</text>`;
    });
    return s + `</g></svg>`;
  }

  function evening() {                                    // the example evening: the child's air, two ways, and Oddech's actions
    const W = 560, H = 438, x0 = 44, x1 = W - 112, y0 = H - 30, y1 = 70, T = EX.minutes * 60, cv = EX.curve;
    let mx = 20; for (const r of cv) mx = Math.max(mx, r[1], r[2], r[6] || 0);      // the range band is clipped at the frame
    const st = niceStep(mx, 4), yMax = Math.ceil(mx / st) * st, X = t => x0 + (x1 - x0) * t / T, Y = v => y0 - (y0 - y1) * v / yMax;
    const line = (k, c, w, extra) => { let d = "", on = false; for (const r of cv) { const v = r[k]; if (v === null) { on = false; continue; } d += (on ? "L" : "M") + X(r[0]).toFixed(1) + " " + Y(v).toFixed(1) + " "; on = true; }
      return `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" ${extra || ""}/>`; };
    const band = cv.filter(r => r[4] !== null && r[5] !== null);
    let s = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true"><g ${mono} font-size="11" fill="#9C958A">`;
    for (let v = 0; v <= yMax + 1e-9; v += st) s += `<line x1="${x0}" x2="${x1}" y1="${Y(v)}" y2="${Y(v)}" stroke="rgba(237,232,223,.09)"/><text x="${x0 - 8}" y="${Y(v) + 4}" text-anchor="end">${v}</text>`;
    for (let m = 0; m <= EX.minutes; m += 5) s += `<text x="${X(m * 60)}" y="${y0 + 18}" text-anchor="middle">${m}</text>`;
    s += `<text x="${x1}" y="${H - 1}" text-anchor="end">minutes</text><text x="${x0 + 6}" y="${y1 + 14}">µg/m³ where the child breathes</text>`;
    s += `<line x1="${x0}" x2="${x1}" y1="${Y(15)}" y2="${Y(15)}" stroke="rgba(217,135,92,.55)" stroke-dasharray="2 4"/><text x="${x1}" y="${Y(15) - 5}" text-anchor="end" fill="rgba(217,135,92,.9)">WHO 24-h guideline 15</text>`;
    EX.actions.forEach(([t], i) => { const x = X(t).toFixed(1); s += `<line x1="${x}" x2="${x}" y1="${y1 - 10}" y2="${y0}" stroke="rgba(237,232,223,.2)"/><circle class="pop" cx="${x}" cy="${y1 - 20}" r="9" fill="#D9875C"/><text x="${x}" y="${y1 - 16}" text-anchor="middle" fill="#0F0E0C" font-weight="700">${i + 1}</text>`; });
    s += `<clipPath id="dkEveClip"><rect x="${x0}" y="${y1}" width="${x1 - x0}" height="${y0 - y1}"/></clipPath>`;
    s += `<path clip-path="url(#dkEveClip)" d="${band.map((r, i) => (i ? "L" : "M") + X(r[0]).toFixed(1) + " " + Y(r[5]).toFixed(1)).join(" ")} ${band.slice().reverse().map(r => "L" + X(r[0]).toFixed(1) + " " + Y(r[4]).toFixed(1)).join(" ")} Z" fill="rgba(217,135,92,.15)"/>`;
    s += line(6, "#CFC8BC", 1.2, 'stroke-dasharray="2 3"') + line(2, "#8A847A", 2.2, 'class="draw" pathLength="1"') + line(1, "#D9875C", 3.2, 'class="draw" pathLength="1"');
    const end = cv[cv.length - 1];
    s += `<g font-size="12"><text x="${x1 + 8}" y="${Y(end[2]) - 2}" fill="#CFC8BC"><tspan font-size="17" font-weight="600">${Math.round(end[2])}</tspan><tspan x="${x1 + 8}" dy="15">purifier left</tspan><tspan x="${x1 + 8}" dy="14">in its corner</tspan></text>`;
    s += `<text x="${x1 + 8}" y="${Y(end[1]) - 2}" fill="#D9875C" data-focus><tspan font-size="17" font-weight="700">${Math.round(end[1])}</tspan><tspan x="${x1 + 8}" dy="15">Oddech acting</tspan></text></g>`;
    s += `<g font-size="11"><line x1="${x0}" x2="${x0 + 22}" y1="12" y2="12" stroke="#D9875C" stroke-width="3"/><text x="${x0 + 28}" y="16" fill="#EDE8DF">child, Oddech acting</text>
      <line x1="${x0 + 200}" x2="${x0 + 222}" y1="12" y2="12" stroke="#8A847A" stroke-width="2.2"/><text x="${x0 + 228}" y="16" fill="#EDE8DF">child, purifier left in its corner</text>
      <rect x="${x0}" y="26" width="22" height="10" fill="rgba(217,135,92,.25)"/><text x="${x0 + 28}" y="35" fill="#EDE8DF">Oddech's estimate, likely range</text>
      <line x1="${x0 + 260}" x2="${x0 + 282}" y1="31" y2="31" stroke="#CFC8BC" stroke-dasharray="2 3"/><text x="${x0 + 288}" y="35" fill="#EDE8DF">shelf monitor</text></g>`;
    return s + `</g></svg>`;
  }
  const shortAct = t => t.replace(/^Oddech switched the purifier (on|off)$/, "purifier switched $1").replace(/^The purifier was turned to high$/, "turned to high")
    .replace(/^The purifier was moved towards (.*)$/, "moved towards $1").replace(/^The window was opened.*$/, "window opened to air the room").replace(/^The window was closed$/, "window closed");
  const mmss = t => Math.floor(t / 60) + ":" + String(Math.round(t % 60)).padStart(2, "0");

  function maps() {                                       // four top views of the example evening at minute EX.mapMinute
    const k = [["truth", "Dust", "simulated PM2.5 at 1.1 m"], ["harm", "Harm", "dust weighted by its source"], ["est", "Oddech's map", "from its readings only"], ["sd", "Doubt", "where the map is unsure"]];
    return `<div class="sl-maps">${k.map(([id, b, t]) => `<div class="sl-map"><canvas data-map="${id}" width="504" height="378"></canvas><p><b>${b}</b> · ${t}</p></div>`).join("")}</div>`;
  }
  function paintMaps() {
    if (!EX || !COL) return;
    const M = EX.maps, { CONC, SDR, tC } = COL, { NX, NY, ROOM, LAYOUT } = S, off = document.createElement("canvas"), og = off.getContext("2d");
    stage.querySelectorAll("canvas[data-map]").forEach(cv => {
      const kind = cv.dataset.map, g = cv.getContext("2d"), w = cv.width, h = cv.height, q = w / 252;
      const nx = kind === "sd" ? 20 : NX, ny = kind === "sd" ? 15 : NY, src = M[kind];
      off.width = nx; off.height = ny; const img = og.createImageData(nx, ny);
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const v = src[i + nx * j], c = kind === "sd" ? SDR(v / 0.75) : CONC(tC(v)), o = 4 * (i + nx * (ny - 1 - j));
        img.data[o] = c[0]; img.data[o + 1] = c[1]; img.data[o + 2] = c[2]; img.data[o + 3] = 255;
      }
      og.putImageData(img, 0, 0); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high"; g.drawImage(off, 0, 0, w, h);
      const X = x => x / ROOM.Lx * w, Y = y => h - y / ROOM.Ly * h;
      g.strokeStyle = "rgba(15,13,11,.55)"; g.fillStyle = "rgba(15,13,11,.28)"; g.lineWidth = q;
      for (const o of LAYOUT.obstacles) { g.fillRect(X(o[0]), Y(o[3]), X(o[2]) - X(o[0]), Y(o[1]) - Y(o[3])); g.strokeRect(X(o[0]), Y(o[3]), X(o[2]) - X(o[0]), Y(o[1]) - Y(o[3])); }
      const wn = LAYOUT.window; g.strokeStyle = "#cfe0f2"; g.lineWidth = 3 * q; g.beginPath(); g.moveTo(X(wn.x0), 1.5 * q); g.lineTo(X(wn.x1), 1.5 * q); g.stroke();
      for (const p of LAYOUT.people) { g.strokeStyle = "#EDE8DF"; g.lineWidth = 1.5 * q; g.beginPath(); g.arc(X(p.x), Y(p.y), 5 * q, 0, 2 * Math.PI); g.stroke(); }
      g.fillStyle = M.purifier[2] ? "#9fb4d2" : "#5d6672"; g.beginPath(); g.arc(X(M.purifier[0]), Y(M.purifier[1]), 5 * q, 0, 2 * Math.PI); g.fill();
      g.strokeStyle = "rgba(255,255,255,.55)"; g.lineWidth = 1.2 * q; g.beginPath(); M.trail.forEach((p, i) => i ? g.lineTo(X(p[0]), Y(p[1])) : g.moveTo(X(p[0]), Y(p[1]))); g.stroke();
      if (kind === "est" || kind === "sd") { g.fillStyle = "rgba(255,255,255,.88)"; for (const s of M.samples) { g.beginPath(); g.arc(X(s[0]), Y(s[1]), 2.3 * q, 0, 2 * Math.PI); g.fill(); } }
      g.fillStyle = "#fff"; g.strokeStyle = "#1F1D1A"; g.lineWidth = 1.5 * q; g.beginPath(); g.arc(X(M.robot[0]), Y(M.robot[1]), 4.5 * q, 0, 2 * Math.PI); g.fill(); g.stroke();
    });
  }
  function archArt() {                                    // the data path from section 07, at slide size
    const src = $("archSvg"); if (!src) return "";
    return `<svg viewBox="0 40 1200 240" width="960" height="192" aria-hidden="true">${src.innerHTML.replace(/id="(u1|d1|d2|d3)"/g, 'id="dk-$1"').replace(/href="#(u1|d1|d2|d3)"/g, 'href="#dk-$1"').replace(/begin="([\d.]+)s"/g, (m, t) => `begin="-${t}s"`)}</svg>`;
  }

  // ---------------------------------------------------------------- the slides
  const head = k => `<div class="sl-k" data-m="k">${k}</div><div class="sl-brand"><span class="hug" data-m="brand">Oddech</span></div>`;
  const foot = left => `<div class="sl-foot" data-m="foot"><span>${left}</span><span class="sl-pg"></span></div>`;
  const ok = B && CARE && EX && S && COL;
  const SL = [];
  SL.push(["Title", "s-dark", `
    <div class="sl-k" data-m="k">FL Joint Programme · Kraków · 16 October 2026</div>
    <h2 class="sl-title"><span class="hug" data-m="brand">Oddech</span></h2>
    <p class="sl-sub" style="max-width:700px">A robot that breathes the room with you. Living airway cells tell it <b>how harmful</b> the air is, its map tells it <b>where</b>, and it tells you <b>what to do</b>.</p>
    <p class="sl-sub sl-names">Julian Evan Chrisnanto · Antonio Galiza Cerdeira Gonzalez · Xiyue (Thea) Cao · Aleksandra Skrzypiec</p>
    <div class="sl-art" data-m="robot" style="right:110px;top:70px">${robotArt(560)}</div>
    ${foot("Oddech, Polish for “breath”")}`]);
  SL.push(["Problem", "s-paper", `${head("01 · The problem")}
    <h2 data-m="t">Kraków's smog comes indoors. <em>A number on a shelf cannot help.</em></h2>
    <div class="sl-nums">
      <div><b class="acc">−40 %</b><span>annual PM2.5, 2010 to 2021, after the solid-fuel ban. The limit was still not met.</span></div>
      <div><b>≈70 %</b><span>of indoor PM10 in Kraków flats is the finest dust, PM2.5, in the cold half-year.</span></div>
      <div><b><span class="hug" data-focus>87 %</span></b><span>of our time is spent inside buildings. Children breathe at 0.4 m, below the shelf.</span></div>
    </div>
    ${foot("Sources: Kicińska & Jawdyńska 2025; Ścibor et al. 2020; Klepeis et al. 2001")}`]);
  SL.push(["Gap", "s-paper2", `${head("02 · The gap")}
    <h2 data-m="t">Today's tools weigh the air. <em>Nobody asks the body.</em></h2>
    <div class="sl-grid2">
      <ul class="sl-list">
        <li><i>01</i><span><b>Air is uneven.</b> Next to a source it can be 6 to 20 times the well-mixed prediction.</span></li>
        <li><i>02</i><span><b>A monitor is one point.</b> A purifier cleans around itself and shows one number.</span></li>
        <li><i>03</i><span><b>Same weight, different harm.</b> Its oxidising power comes mostly from human sources such as burning wood at home; cutting mass alone may not cut it.</span></li>
      </ul>
      <div><p class="sl-q">Where?</p><p class="sl-q"><span class="hug acc" data-focus>How harmful?</span></p><p class="sl-q">What to do?</p>
        <p class="sl-sub" style="font-size:19px;margin-top:20px">Three questions a kindergarten director cannot answer today, on a smog evening, in one room.</p></div>
    </div>
    ${foot("Sources: Acevedo-Bolton et al. 2011; Daellenbach et al. 2020")}`]);
  SL.push(["Solution", "s-dark", `${head("03 · The solution")}
    <h2 data-m="t" style="font-size:52px">Oddech breathes, feels, maps, tells, acts.</h2>
    <div class="sl-breath">${breathArt()}<div class="sl-wells-mini" data-m="wells">${wellsArt(470)}</div></div>
    <div class="sl-chain sm">
      <div><i>01</i><b>Breathe</b><span>Samples at 0.4, 1.1 and 1.6 m, where children and adults breathe.</span></div>
      <div class="hot"><i>02</i><b>Feel</b><span>Living airway cells glow when the air stresses them.</span></div>
      <div><i>03</i><b>Map</b><span>A live map of the room, with its doubt, chooses where to go next.</span></div>
      <div><i>04</i><b>Tell</b><span>Plain, tested words: what, where, how sure, what to do.</span></div>
      <div><i>05</i><b>Act</b><span>Moves the purifier, says when a window helps, alerts the phone.</span></div>
    </div>
    ${foot("Concept: robot, sensor and advice are designs under test")}`]);
  SL.push(["Living Air Sensor", "s-dark", `${head("04 · Our unique point · the Living Air Sensor")}
    <h2 data-m="t" style="font-size:52px">A cartridge of living cells, <em>read every ten minutes.</em></h2>
    <div class="sl-grid2" style="grid-template-columns:470px 1fr;gap:60px;margin-top:10px">
      <div><div data-m="wells">${wellsArt(470, true)}</div><p class="sl-sub" style="font-size:15px;color:#9C958A;margin-top:8px">Four wells breathe room air, two breathe the same air through a filter, one checks the lamp, one has no cells.</p></div>
      <div>${bioCurves()}<p class="sl-sub" style="font-size:16px;margin-top:10px">Same dust mass, different harm: the index is <b>ΔF/F₀ exposed − control</b>, so the cells answer what the dust counter cannot.</p></div>
    </div>
    ${foot("Concept model after X. Cao; illustrative values, no experimental data · format: 4-well chamber slides, 1.7 cm² per well")}`]);
  SL.push(["What is new", "s-paper", `${head("05 · “Isn't this an existing idea?”")}
    <h2 data-m="t">The pieces exist. <em>The loop does not.</em></h2>
    <table class="sl-tbl"><thead><tr><th>What exists</th><th>Goes where people breathe</th><th>Measures harm to cells</th><th>Maps the room</th><th>Tells you what to do</th></tr></thead><tbody>
      <tr><td>Odour-seeking biohybrid drone (moth antenna)</td><td>partly</td><td>–</td><td>–</td><td>–</td></tr>
      <tr><td>Airway cells exposed to smoke, in a lab</td><td>–</td><td>yes</td><td>–</td><td>–</td></tr>
      <tr><td>Gas-mapping research robots</td><td>partly</td><td>–</td><td>yes</td><td>–</td></tr>
      <tr><td>Monitors, purifiers, purifier robots</td><td>one point</td><td>–</td><td>–</td><td>partly</td></tr>
      <tr data-focus><td class="us"><b style="color:var(--accent)">Oddech</b></td><td class="us">yes</td><td class="us">yes</td><td class="us">yes</td><td class="us">yes</td></tr>
    </tbody></table>
    <p class="sl-sub" style="font-size:17px;margin-top:22px">Our quick search (OpenAlex, 13 October 2026) found no robot carrying a cell-based particle sensor. A full search is our first task after Kraków.</p>
    ${foot("Sources: Anderson et al. 2020; Ihantola et al. 2022; Francis et al. 2022; Ecovacs AIRBOT Z1")}`]);
  if (ok) {
    SL.push(["Results at a glance", "s-dark", `${head("06 · What Oddech changes · in simulation")}
      <h2 data-m="t">Cleaner air for the child, <em>in every one of ${CARE.seeds} model rooms.</em></h2>
      <div class="sl-nums four">
        <div><b><span class="hug acc" data-m="n1" data-focus>−<span data-count="${cutC}">${cutC}</span> %</span></b><span>dust the child breathes in over ${CARE.minutes} minutes, same purifier, when the family follows Oddech's advice</span></div>
        <div><b><span class="hug" data-m="n2"><span data-count="${monLow}">${monLow}</span> %</span></b><span>how far too low the shelf monitor reads the child's air. Oddech's map: ${under(CARE.median.oddechLog)}.</span></div>
        <div><b><span class="hug" data-m="n3"><span data-count="${B.wins.people_vs_fixed}">${B.wins.people_vs_fixed}</span>/${B.seeds}</span></b><span>rooms where Oddech knew the air people breathe better than four fixed sensors</span></div>
        <div><b><span class="hug" data-m="n4">×<span data-count="${bioX}">${bioX}</span></span></b><span>living-cell stress for smoke-like air against cooking fumes, at the same dust mass</span></div>
      </div>
      <p class="sl-take">Not a stronger purifier: <em>knowing the air where the child breathes, and acting on it.</em></p>
      ${foot("Room model: random sources, windows and purifiers; the living sensor is a concept model. The method, not field evidence")}`]);
    SL.push(["Across 24 rooms", "s-paper2", `${head(`07 · ${B.seeds} model rooms, the same purifier, three ways`)}
      <h2 data-m="t" style="font-size:52px">Knows the child's air, <em>then cleans it.</em></h2>
      <div class="sl-panels">
        <div class="sl-panel">
          <div class="sl-hl"><span class="hug" data-m="n3">${B.wins.people_vs_fixed}/${B.seeds}</span></div>
          <p class="sl-pt">rooms where Oddech knew the air the child and the adult breathe better than four fixed sensors</p>
          <div class="sl-bars sm">
            <div class="sl-bar us"><span>Three fixed sensors + Oddech</span><i style="width:${barW(B.median.oddech_people)}"></i><b>${tErr(B.median.oddech_people)} %</b></div>
            <div class="sl-bar"><span>Three fixed + a random robot</span><i style="width:${barW(B.median.random_people)}"></i><b>${tErr(B.median.random_people)} %</b></div>
            <div class="sl-bar"><span>Four fixed sensors</span><i style="width:100%"></i><b>${tErr(B.median.fixed4_people)} %</b></div>
          </div>
          <p class="sl-cap">Typical error where people breathe, median of ${B.seeds} rooms. Oddech also beat the random robot in ${B.wins.people_vs_random} of ${B.seeds}: the gain comes from <b>choosing</b> where to go.</p>
          <p class="sl-pt2">The shelf monitor alone read the child's air <span class="hug" data-m="n2">${monLow} % too low</span>; Oddech's map, ${under(CARE.median.oddechLog)}.</p>
        </div>
        <div class="sl-panel">
          <div class="sl-hl acc"><span class="hug" data-m="n1" data-focus>−${cutC} %</span></div>
          <p class="sl-pt">dust the child breathes in over ${CARE.minutes} minutes when the family follows Oddech's advice; lower in all ${CARE.wins.corner} rooms</p>
          ${strip()}
          <p class="sl-cap">Each dot is one room. Oddech switches the purifier on, turns it up, has it moved towards the worst air and says when to open or close the window; the family acts 90 s later.</p>
        </div>
      </div>
      ${foot("H1: minutes 5 to 20 · H2: 30 minutes, sources off after 18 · model rooms: the method, not field evidence")}`]);
    const end = EX.curve[EX.curve.length - 1], doseCut = pct(1 - EX.dose.oddech / EX.dose.corner);
    SL.push(["One evening", "s-dark", `${head("08 · One evening up close · cooking dinner, window shut")}
      <h2 data-m="t" style="font-size:46px">Same flat, same purifier: <em>by minute ${EX.minutes}, ${Math.round(end[1])} instead of ${Math.round(end[2])}.</em></h2>
      <div class="sl-eve">
        <div>${maps()}</div>
        <div>${evening()}
          <p class="sl-evecap">${EX.actions.map(([t, a], i) => `<b>${i + 1}</b> ${mmss(t)} ${shortAct(a)}`).join(" · ")}. Over the evening the child breathes in <b>${doseCut} % less dust</b>.</p></div>
      </div>
      ${foot(`One model flat run twice (cooking, seed ${EX.seed}) · maps at minute ${EX.mapMinute}: robot path in white, readings as dots`)}`]);
    SL.push(["For every user", "s-paper", `${head("09 · The product · robot at the edge, every room in the cloud")}
      <h2 data-m="t" style="font-size:52px">Each user gets <em>what they can act on.</em></h2>
      <div class="sl-arch">${archArt()}</div>
      <div class="sl-users">
        <div class="sl-user"><i>Staff and director · every room, live</i>
          <div class="sl-dash mini">
            <div class="sl-dash-tiles"><div><span>Children's air</span><b>42</b><em>likely 31–58</em></div><div><span>Living sensor</span><b style="color:#f0965a">31</b><em>smoke-like</em></div><div><span>Purifier</span><b>300</b><em>m³/h · auto</em></div></div>
            <div class="sl-dash-alert"><span>17:44</span>Bears room: purifier moved to the play mat</div>
          </div></div>
        <div class="sl-user"><i>Parents · on the phone</i>
          <div class="sl-phone" data-focus><em>ODDECH · now</em>${EX.advice}</div></div>
        <div class="sl-user"><i>City programme · every month</i><b>Anonymous, consented trends</b>
          <span>Which rooms breathe worst on smog evenings, district by district: where to fund purifiers, boiler swaps and pilots. A monthly air report goes to the director and the parents.</span></div>
      </div>
      ${foot("Phone message: Oddech's own words from the evening on slide 9 · dashboard: working design on our site, demonstration values")}`]);
  }
  SL.push(["Customers", "s-paper", `${head("10 · Customers and why now")}
    <h2 data-m="t">Start where the risk is highest <em>and someone can act.</em></h2>
    <div class="sl-grid2">
      <ul class="sl-list">
        <li><i>01</i><span><b>Kindergartens</b> in Kraków: twenty children on the floor, one director deciding. Our beachhead.</span></li>
        <li><i>02</i><span><b>Care homes</b>: residents with lung disease indoors all day.</span></li>
        <li><i>03</i><span><b>Parents</b> of children with asthma: a home station and the phone app.</span></li>
        <li><i>04</i><span><b>City programmes</b>: co-fund pilots, receive anonymous indoor data.</span></li>
      </ul>
      <div><p class="sl-big"><span class="hug" data-focus>25 → 10</span></p><p class="sl-sub" style="font-size:18px;margin-top:20px">The EU limit for annual PM2.5 falls from 25 to 10 µg/m³ in 2030. Institutions will be asked what they did about the air inside.</p>
        <dl class="sl-roles"><dt>Pays</dt><dd>the kindergarten: one monthly fee per room</dd><dt>Uses</dt><dd>staff and the director: live dashboard, alerts with an action</dd>
          <dt>Hears</dt><dd>parents: phone alerts and a monthly air report</dd><dt>Benefits</dt><dd>the children: ${CARE ? `${cutC} % less dust where they breathe, in our model` : "cleaner air where they breathe"}</dd></dl></div>
    </div>
    ${foot("Source: Directive (EU) 2024/2881")}`]);
  SL.push(["Business model", "s-paper2", `${head("11 · Business model")}
    <h2 data-m="t">Rent the robot, <em>refill the living sensor.</em></h2>
    <div class="sl-grid2">
      <ul class="sl-list">
        <li><i>A</i><span><b>Oddech Room</b>: robot as a service, one monthly fee.</span></li>
        <li><i>B</i><span><b>Living cartridges</b>: a fresh cartridge every week, recurring like capsules.</span></li>
        <li><i>C</i><span><b>Oddech Cloud</b>: dashboard per site, API for purifier makers.</span></li>
        <li><i>D</i><span><b>Lab reports</b>: filter samples confirmed in a partner lab.</span></li>
        <li><i>E</i><span><b>Cities</b>: paid pilots, anonymous statistics.</span></li>
      </ul>
      <div class="sl-nums" style="grid-template-columns:1fr 1fr;margin-top:0">
        ${ue ? `<div><b class="acc"><span class="hug" data-focus>${eur(ue.gm)}</span></b><span>gross margin per robot per month</span></div><div><b>${ue.pay.toFixed(1)}</b><span>months to pay back the robot</span></div>
        <div><b>${eur(ue.ltv)}</b><span>gross profit over 36 months</span></div><div><b>4</b><span>cartridges a month per room</span></div>` : ""}
      </div>
    </div>
    ${foot("Planning assumptions, not quotes: robot €1,100, fee €120, cartridge €25 made for half, service €20 a month")}`]);
  SL.push(["Roadmap", "s-dark", `${head("12 · Roadmap, and what we do if we are wrong")}
    <h2 data-m="t">From Kraków <em>to a first room.</em></h2>
    <div class="sl-tl">
      <div><i>14 Oct</i><b>Field visit, Kraków</b></div><div><i>16 Oct</i><b>Final presentation</b></div><div><i>27 Nov</i><b>Student Research Day, TUAT</b></div>
      <div><i>26 Feb 2027</i><b>Entre Challenge</b></div><div class="hot"><i>2027 · plan</i><b><span class="hug" data-focus>Lab calibration, first pilot room</span></b></div>
    </div>
    <ul class="sl-list" style="margin-top:34px">
      <li><i>→</i><span>Rooms turn out evenly mixed: <b>Oddech Station</b>, a fixed living sensor with the cloud.</span></li>
      <li><i>→</i><span>Cells too fragile outside the lab: <b>bio-lab service</b>, the robot collects filters, a lab tests them.</span></li>
      <li><i>→</i><span>Institutions will not pay: <b>license</b> the robot's brain and cloud to purifier makers.</span></li>
    </ul>
    ${foot("Programme dates from the FL schedule; 2027 is our plan, not yet arranged")}`]);
  SL.push(["Team and ask", "s-paper", `${head("13 · Team and our ask")}
    <h2 data-m="t" style="font-size:46px">Physics, robotics, biology, communication. <em>Take one away and the chain breaks.</em></h2>
    <div class="sl-team">
      <div><i>Physics-informed AI</i><b>Julian Evan Chrisnanto</b><span>TUAT, Japan · room map, robot's choices, dose</span></div>
      <div><i>Physical AI and robotics</i><b>Antonio Galiza Cerdeira Gonzalez, Ph.D.</b><span>Body, mast, motion and safety</span></div>
      <div><i>RNA bioinformatics</i><b>Xiyue (Thea) Cao</b><span>TUAT, Japan · the Living Air Sensor</span></div>
      <div><i>Human–machine communication</i><b>Aleksandra Skrzypiec</b><span>Jagiellonian University · how Oddech speaks</span></div>
    </div>
    <div class="sl-ask"><span data-focus><b>1</b>A room for a 2027 pilot</span><span><b>2</b>A lab bench to calibrate the cells</span><span><b>3</b>Introductions: city, purifier makers</span><span><b>4</b>Your honest view</span></div>
    <p class="sl-thanks">Dziękujemy. Thank you. ありがとうございました。</p>
    ${foot("Oddech · FL Joint Programme 2026")}`]);

  // ---------------------------------------------------------------- build the frame
  const N = SL.length;
  stage.innerHTML = SL.map(([t, cls, html], i) => `<section class="slide ${cls}" data-i="${i}" aria-label="Slide ${i + 1}: ${t}">${html}<i class="sl-ring" data-m="ring" aria-hidden="true"></i></section>`).join("");
  const slides = Array.from(stage.querySelectorAll(".slide")), thumbs = $("deckThumbs"), prog = $("deckProg");
  slides.forEach((s, i) => { const pg = s.querySelector(".sl-pg"); if (pg) pg.textContent = `ODDECH · ${String(i + 1).padStart(2, "0")} / ${N}`; });
  thumbs.innerHTML = SL.map(([t], i) => `<button data-i="${i}" title="${t}">${String(i + 1).padStart(2, "0")}</button>`).join("");
  thumbs.style.setProperty("--n", N);
  deck.setAttribute("aria-label", `Pitch deck, ${N} slides`);
  paintMaps();

  // entrances: content rises in reading order; bars grow, curves draw, dots pop; what morphs is left to the morph
  const SEQ = ".sl-sub, .sl-nums > div > b, .sl-nums > div > span, .sl-list li, .sl-chain > div, .sl-tbl tbody tr, .sl-team > div, .sl-ask > span, .sl-tl > div, .sl-thanks, .sl-take, .sl-roles, .sl-q, .sl-panel > p, .sl-panel > .sl-bars, .sl-map, .sl-user, .sl-evecap, .sl-breath, .sl-art, .sl-grid2 > div > svg, .sl-arch";
  slides.forEach(s => {
    let i = 0;
    s.querySelectorAll(SEQ).forEach(el => { if (el.closest("[data-m]") || el.querySelector("[data-m]")) return; el.classList.add("sl-in"); el.style.animationDelay = (240 + 70 * i++) + "ms"; });
    s.querySelectorAll(".sl-bar i").forEach((el, k) => { el.style.animationDelay = (520 + 140 * k) + "ms"; });
    s.querySelectorAll(".draw").forEach((el, k) => { el.style.animationDelay = (420 + 180 * k) + "ms"; });
    s.querySelectorAll(".pop").forEach((el, k) => { el.style.animationDelay = (560 + 18 * k) + "ms"; });
  });
  function count(el) {
    const end = parseFloat(el.dataset.count), dec = (el.dataset.count.split(".")[1] || "").length, t0 = performance.now();
    const tick = now => { const p = Math.min(1, (now - t0) / 1100), e = 1 - Math.pow(1 - p, 3); el.textContent = (end * e).toFixed(dec); if (p < 1) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }
  function play(s, prev) {
    slides.forEach(x => x.classList.remove("play"));
    void s.offsetWidth;                                   // restart the CSS animations
    s.classList.add("play");
    if (motion) s.querySelectorAll("[data-count]").forEach(el => { const m = el.closest("[data-m]"); if (!(m && prev && prev.querySelector(`[data-m="${m.dataset.m}"]`))) count(el); });
  }

  // the ring: an ellipse around each slide's [data-focus], measured in slide pixels once the fonts are in
  function placeRings() {
    slides.forEach(s => {
      const f = s.querySelector("[data-focus]"), ring = s.querySelector(".sl-ring");
      if (!f) { ring.hidden = true; return; }
      const sr = s.getBoundingClientRect(), r = f.getBoundingClientRect(), k = sr.width / 1280; if (!k || !r.width) return;
      const w = r.width / k, h = r.height / k, cx = (r.left - sr.left) / k + w / 2, cy = (r.top - sr.top) / k + h / 2;
      const round = w < 1.4 * h && h < 1.4 * w, wide = w > 2.4 * h;   // circle for square targets, pill for wide ones, ellipse between
      const W = Math.min(1240, round ? Math.max(w, h) + 26 : wide ? w + 40 : w + Math.max(44, 0.16 * w)), H = Math.min(680, round ? W : wide ? h + 20 : h + Math.max(22, 0.16 * h));
      Object.assign(ring.style, { left: Math.max(20, Math.min(1260 - W, cx - W / 2)) + "px", top: Math.max(20, Math.min(700 - H, cy - H / 2)) + "px", width: W + "px", height: H + "px", borderRadius: wide ? "999px" : "50%" });
    });
  }
  (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(placeRings);
  placeRings();

  // ---------------------------------------------------------------- navigate: morph when the browser can
  let cur = 0, seq = 0, motion = true;
  const VT = typeof document.startViewTransition === "function";
  try { motion = localStorage.getItem("oddech-deck-motion") !== "off"; } catch (e) { /* storage blocked: keep motion on */ }
  function setMotion(on) {                                // the presenter's choice, remembered; off means plain fades and no entrances
    motion = on; deck.classList.toggle("calm", !on);
    const b = $("deckMotion"); if (b) { b.textContent = on ? "Motion on" : "Motion off"; b.setAttribute("aria-pressed", String(on)); }
    try { localStorage.setItem("oddech-deck-motion", on ? "on" : "off"); } catch (e) { /* not remembered */ }
  }
  const name = (s, on) => s.querySelectorAll("[data-m]").forEach(e => { e.style.viewTransitionName = on ? "m-" + e.dataset.m : ""; });
  function show(i) {
    cur = (i + N) % N;
    slides.forEach((s, k) => s.classList.toggle("on", k === cur));
    thumbs.querySelectorAll("button").forEach((b, k) => b.classList.toggle("on", k === cur));
    $("deckCount").textContent = String(cur + 1).padStart(2, "0") + " / " + N + " · " + SL[cur][0];
    if (prog) prog.style.transform = `scaleX(${(cur + 1) / N})`;
  }
  function go(i) {
    const next = (i + N) % N; if (next === cur) return;
    const from = slides[cur], to = slides[next];
    if (!VT || !motion || document.body.classList.contains("print-deck")) { show(next); play(to, from); return; }
    const my = ++seq, root = document.documentElement;
    root.dataset.deckDir = next > cur ? "fwd" : "back";
    root.classList.add("deck-vt"); name(from, true);
    let t;
    try { t = document.startViewTransition(() => { name(from, false); show(next); name(to, true); play(to, from); }); }
    catch (e) { name(from, false); root.classList.remove("deck-vt"); show(next); play(to, from); return; }
    t.finished.finally(() => { if (my !== seq) return; name(to, false); root.classList.remove("deck-vt"); });
  }
  function scale() {
    const w = deck.clientWidth, h = deck.clientHeight, s = Math.min(w / 1280, h / 720);
    stage.style.transform = `translate(${(w - 1280 * s) / 2}px, ${(h - 720 * s) / 2}px) scale(${s})`;
  }
  function present() {
    const max = () => { deck.classList.toggle("deck-max"); scale(); deck.focus({ preventScroll: true }); play(slides[cur]); };
    if (document.fullscreenElement) { document.exitFullscreen().catch(() => {}); return; }
    if (deck.classList.contains("deck-max") || !deck.requestFullscreen) { max(); return; }
    deck.requestFullscreen().then(() => { deck.focus({ preventScroll: true }); play(slides[cur]); }).catch(max);
  }
  $("deckPrev").addEventListener("click", () => go(cur - 1));
  $("deckNext").addEventListener("click", () => go(cur + 1));
  thumbs.addEventListener("click", e => { const b = e.target.closest("[data-i]"); if (b) go(+b.dataset.i); });
  deck.addEventListener("click", e => { if (e.target.closest("a, button")) return; const r = deck.getBoundingClientRect(); go(cur + (e.clientX - r.left < r.width * 0.3 ? -1 : 1)); deck.focus({ preventScroll: true }); });
  deck.addEventListener("keydown", e => {
    if (["ArrowRight", "PageDown", " "].indexOf(e.key) >= 0) { e.preventDefault(); e.stopPropagation(); go(cur + 1); }
    else if (["ArrowLeft", "PageUp"].indexOf(e.key) >= 0) { e.preventDefault(); e.stopPropagation(); go(cur - 1); }
    else if (e.key === "Home") { e.preventDefault(); go(0); } else if (e.key === "End") { e.preventDefault(); go(N - 1); }
    else if (e.key === "f" || e.key === "F") { e.preventDefault(); present(); }
    else if (e.key === "Escape" && deck.classList.contains("deck-max")) { deck.classList.remove("deck-max"); scale(); }
  });
  let idle; deck.addEventListener("mousemove", () => { deck.classList.remove("idle"); clearTimeout(idle); idle = setTimeout(() => deck.classList.add("idle"), 2200); });
  $("deckFull").addEventListener("click", present);
  if ($("deckMotion")) $("deckMotion").addEventListener("click", () => setMotion(!motion));
  setMotion(motion);
  document.addEventListener("fullscreenchange", scale);
  $("deckPrint").addEventListener("click", () => {
    document.body.classList.add("print-deck");
    const done = () => { document.body.classList.remove("print-deck"); window.removeEventListener("afterprint", done); };
    window.addEventListener("afterprint", done);
    setTimeout(() => { try { window.print(); } catch (e) { done(); } }, 60);
  });
  window.addEventListener("resize", scale);
  new ResizeObserver(scale).observe(deck);
  show(0); scale();
  let seen = false;                                        // the title enters when the deck first comes into view
  new IntersectionObserver(es => { if (es[0].isIntersecting && !seen) { seen = true; play(slides[cur]); } }, { threshold: 0.35 }).observe(deck);
})();
