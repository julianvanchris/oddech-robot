/* Shared illustrations for the page and the pitch deck, so a picture is the same in both: living airway cells, a room in
   cross-section, the ways rooms are watched today, Oddech's air loop and the living cartridge's loop, the QR code to this
   site and the robot renders (gazebo/blueprint.json drawn by robot3d.js, saved as site/img/*.webp).
   Each function returns an SVG (or <img>) string; `dark` picks the palette for night or paper backgrounds. Anything that
   moves carries class "anim", which print hides, so a PDF never shows a dot frozen half-way. */
(function () {
  "use strict";
  const mono = 'font-family="JetBrains Mono, ui-monospace, monospace"', serif = 'font-family="Instrument Serif, Georgia, serif"';
  const sans = 'font-family="Inter Tight, Helvetica Neue, Arial, sans-serif"';
  const pal = dark => dark
    ? { ink: "#EDE8DF", ink2: "#CFC8BC", grey: "#9C958A", hair: "rgba(237,232,223,.22)", faint: "rgba(237,232,223,.08)", acc: "#D9875C", ind: "#7E98BC", bg: "#0F0E0C", card: "#171512" }
    : { ink: "#1F1D1A", ink2: "#4A4640", grey: "#8A847A", hair: "rgba(31,29,26,.22)", faint: "rgba(31,29,26,.05)", acc: "#B4532A", ind: "#2E4A6E", bg: "#F7F5F0", card: "#EFEBE3" };
  let uid = 0;                                            // gradient ids must be unique on the page
  const id = p => `${p}${++uid}`;
  const rng = seed => () => { seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const scatter = (seed, n, x0, y0, w, h, f) => { const r = rng(seed); let s = ""; for (let i = 0; i < n; i++) s += f(x0 + r() * w, y0 + r() * h, r()); return s; };

  // ---------------------------------------------------------------- living airway cells, a control well against a room-air well
  function cells(dark) {
    const P = pal(dark), W = 640, H = 330;
    const glowC = id("cg"), glowE = id("ce");
    const panel = (x0, exposed) => {
      let s = "";
      const top = 92, bot = 214, n = 7, cw = 40;          // seven columnar cells, 40 px wide, from 92 to 214
      // the air above: particles only where the room air comes in
      if (exposed) s += scatter(7, 30, x0 + 8, 14, 270, 58, (x, y, r) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(1.4 + r * 3).toFixed(1)}" fill="${r > .66 ? "#7a5a44" : P.grey}" fill-opacity=".78"/>`);
      else s += scatter(3, 4, x0 + 20, 20, 240, 40, (x, y) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="1.3" fill="${P.grey}" fill-opacity=".45"/>`);
      for (let i = 0; i < n; i++) {
        const x = x0 + 4 + i * cw, goblet = i === 2 || i === 5;
        // cell body; a goblet cell is rounder and carries mucus granules
        s += goblet
          ? `<path d="M${x + 3} ${bot} L${x + 3} ${top + 24} Q${x + 3} ${top - 2} ${x + cw / 2} ${top - 2} Q${x + cw - 3} ${top - 2} ${x + cw - 3} ${top + 24} L${x + cw - 3} ${bot} Z" fill="${P.faint}" stroke="${P.hair}"/>`
            + [0, 1, 2, 3].map(k => `<circle cx="${x + 12 + (k % 2) * 14}" cy="${top + 14 + Math.floor(k / 2) * 12}" r="4.2" fill="none" stroke="${P.grey}" stroke-opacity=".7"/>`).join("")
          : `<rect x="${x + 2}" y="${top}" width="${cw - 4}" height="${bot - top}" rx="7" fill="${P.faint}" stroke="${P.hair}"/>`
            + Array.from({ length: 7 }, (_, k) => `<line x1="${x + 6 + k * 4.6}" y1="${top}" x2="${x + 4 + k * 4.6 + (k % 2 ? 2 : -1)}" y2="${top - 13}" stroke="${P.grey}" stroke-width="1.1" stroke-linecap="round"/>`).join("");   // cilia
        s += `<ellipse cx="${x + cw / 2}" cy="${bot - 30}" rx="8" ry="11" fill="${dark ? "#2E4A6E" : "#c9d3e2"}" stroke="${P.ind}" stroke-opacity=".7"/>`;   // nucleus
        // mitochondria with the dye: a calm glow in the control, a bright one when the air stresses the cell
        for (let k = 0; k < 3; k++) {
          const mx = x + 10 + (k % 2) * 16, my = top + (goblet ? 50 : 30) + k * 15;
          s += `<circle cx="${mx}" cy="${my}" r="${exposed ? 11 : 7}" fill="url(#${exposed ? glowE : glowC})"/>`;
          s += `<rect x="${mx - 5}" y="${my - 2.5}" width="10" height="5" rx="2.5" fill="${exposed ? "#ffb88a" : "#c98a6a"}"/>`;
        }
      }
      // basal cells under the column, the porous membrane, the medium that feeds the cells from below
      for (let i = 0; i < 6; i++) s += `<ellipse cx="${x0 + 26 + i * 46}" cy="${bot - 5}" rx="15" ry="6" fill="${P.faint}" stroke="${P.hair}"/>`;
      s += `<line x1="${x0}" y1="${bot + 6}" x2="${x0 + 284}" y2="${bot + 6}" stroke="${P.ink2}" stroke-width="3" stroke-dasharray="7 4"/>`;
      s += `<rect x="${x0}" y="${bot + 12}" width="284" height="34" fill="${dark ? "rgba(233,160,180,.16)" : "rgba(233,160,180,.28)"}"/>`;
      return s;
    };
    let s = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Airway cells on a membrane: in filtered air their mitochondria glow faintly, in smoky room air brightly">
      <defs><radialGradient id="${glowC}"><stop offset="0" stop-color="#ff9a66" stop-opacity=".35"/><stop offset="1" stop-color="#ff9a66" stop-opacity="0"/></radialGradient>
      <radialGradient id="${glowE}"><stop offset="0" stop-color="#ff9a66" stop-opacity=".95"/><stop offset="1" stop-color="#ff9a66" stop-opacity="0"/></radialGradient></defs>`;
    s += panel(14, false) + panel(342, true);
    s += `<g ${mono} font-size="11" fill="${P.grey}" letter-spacing=".06em">
      <text x="14" y="${H - 44}" fill="${P.ink}">FILTERED CONTROL</text><text x="342" y="${H - 44}" fill="${P.acc}">ROOM AIR</text>
      <text x="14" y="${H - 26}">same cells, the same air minus the dust</text><text x="342" y="${H - 26}">the dust stresses the cells: they glow</text>
      <text x="14" y="${H - 8}" fill="${P.grey}">ciliated · goblet · basal cells · membrane · medium</text></g>`;
    return s + `</svg>`;
  }

  // ---------------------------------------------------------------- a room in cross-section: a source, a child on the floor, the shelf monitor
  function room(dark) {
    const P = pal(dark), W = 620, H = 400, F = 360, M = 120;   // floor at y = 360, 120 px per metre
    const Y = h => F - h * M, haze = id("rh");
    let s = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="A room in cross-section: smoke spreads from a candle near a child on the floor, far from a monitor on a shelf">
      <defs><radialGradient id="${haze}" cx=".5" cy=".55" r=".5"><stop offset="0" stop-color="${P.acc}" stop-opacity=".42"/><stop offset=".6" stop-color="${P.acc}" stop-opacity=".14"/><stop offset="1" stop-color="${P.acc}" stop-opacity="0"/></radialGradient></defs>
      <path d="M20 ${Y(2.7)} L20 ${F} L600 ${F} L600 ${Y(2.7)}" fill="none" stroke="${P.ink}" stroke-width="1.6"/>
      <line x1="20" y1="${Y(2.7)}" x2="600" y2="${Y(2.7)}" stroke="${P.hair}"/>`;
    // the window, smog outside
    s += `<rect x="70" y="${Y(2.2)}" width="130" height="${1.3 * M}" fill="${P.faint}" stroke="${P.ink2}"/><line x1="135" y1="${Y(2.2)}" x2="135" y2="${Y(0.9)}" stroke="${P.hair}"/>`;
    s += scatter(11, 26, 76, Y(2.16), 118, 1.22 * M, (x, y, r) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(1.2 + r * 2.2).toFixed(1)}" fill="${P.grey}" fill-opacity=".8"/>`);
    s += `<text x="135" y="${Y(2.2) - 10}" ${mono} font-size="11" fill="${P.grey}" text-anchor="middle">smog outside</text>`;
    // the haze around the source and the source itself, a candle on a low table next to the play mat
    s += `<ellipse cx="250" cy="${Y(0.62)}" rx="190" ry="120" fill="url(#${haze})"/>`;
    s += scatter(5, 34, 120, Y(1.35), 270, 1.2 * M, (x, y, r) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(1.2 + r * 2.6).toFixed(1)}" fill="${P.acc}" fill-opacity="${(0.3 + r * 0.5).toFixed(2)}"/>`);
    s += `<rect x="210" y="${Y(0.45)}" width="90" height="6" fill="${P.ink2}"/><line x1="220" y1="${Y(0.45) + 6}" x2="220" y2="${F}" stroke="${P.ink2}"/><line x1="290" y1="${Y(0.45) + 6}" x2="290" y2="${F}" stroke="${P.ink2}"/>`;
    s += `<rect x="247" y="${Y(0.45) - 20}" width="8" height="20" fill="${P.ink2}"/><path d="M251 ${Y(0.45) - 30} q-5 6 0 10 q5 -4 0 -10" fill="${P.acc}"/>`;
    s += `<path class="anim" d="M251 ${Y(0.45) - 34} c-8 -18 10 -26 0 -46 c-8 -16 14 -24 4 -44" fill="none" stroke="${P.grey}" stroke-width="1.3" stroke-dasharray="3 4"/>`;
    // the child on the floor, nose at 0.4 m
    const cx = 360;
    s += `<rect x="300" y="${F - 6}" width="130" height="6" fill="${dark ? "rgba(233,201,168,.35)" : "rgba(233,201,168,.8)"}"/>`;
    s += `<circle cx="${cx}" cy="${Y(0.4) - 4}" r="15" fill="${P.card}" stroke="${P.ink}" stroke-width="1.5"/><path d="M${cx - 18} ${F - 6} Q${cx - 16} ${Y(0.4) + 14} ${cx} ${Y(0.4) + 14} Q${cx + 16} ${Y(0.4) + 14} ${cx + 22} ${F - 6} Z" fill="${P.card}" stroke="${P.ink}" stroke-width="1.5"/>`;
    // the monitor on the shelf at 1.6 m
    s += `<rect x="480" y="${Y(1.6)}" width="120" height="6" fill="${P.ink2}"/><rect x="520" y="${Y(1.6) - 34}" width="44" height="34" rx="4" fill="${P.card}" stroke="${P.ink}" stroke-width="1.5"/><circle cx="542" cy="${Y(1.6) - 17}" r="6" fill="#5fae7a"/>`;
    // heights: dashed lines at 0.4 and 1.6 m with labels
    for (const [h, t, tx, c] of [[0.4, "child · 0.4 m", 594, P.acc], [1.6, "monitor · 1.6 m", 470, P.ind]]) {
      s += `<line x1="20" y1="${Y(h)}" x2="600" y2="${Y(h)}" stroke="${c}" stroke-dasharray="4 5" stroke-opacity=".8"/>`;
      s += `<text x="${tx}" y="${Y(h) - 7}" ${mono} font-size="12" fill="${c}" text-anchor="end">${t}</text>`;
    }
    s += `<text x="255" y="${F + 26}" ${mono} font-size="11" fill="${P.grey}" text-anchor="middle">candle, play mat, child: the air is thickest here</text>`;
    return s + `</svg>`;
  }

  // ---------------------------------------------------------------- how rooms are watched today: one small floor plan per setup
  const SETUPS = {
    monitor: { name: "One monitor on a shelf", miss: "One number, far from the child, at the wrong height." },
    sensors: { name: "A sensor in every corner", miss: "More numbers, still not where the child plays; units drift apart." },
    purifiers: { name: "A purifier in every corner", miss: "Cleans where it stands, all day, without knowing what the child breathes." },
    robot: { name: "A purifier robot", miss: "Moves a filter around; measures at its own body, not the harm." },
    oddech: { name: "Oddech", miss: "Goes to the child, asks living cells how harmful the air is, then tells and acts." },
  };
  function plan(kind, dark) {
    const P = pal(dark), W = 200, H = 150, g = id("sg"), hot = kind === "oddech";
    let s = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true">
      <defs><radialGradient id="${g}"><stop offset="0" stop-color="${P.acc}" stop-opacity=".55"/><stop offset="1" stop-color="${P.acc}" stop-opacity="0"/></radialGradient></defs>
      <rect x="6" y="6" width="188" height="138" rx="3" fill="${P.faint}" stroke="${hot ? P.acc : P.ink2}" stroke-width="${hot ? 1.8 : 1.2}"/>
      <circle cx="72" cy="96" r="44" fill="url(#${g})"/><circle cx="64" cy="102" r="4" fill="${P.acc}"/>
      <circle cx="96" cy="104" r="7" fill="${P.card}" stroke="${P.ink}" stroke-width="1.4"/>`;    // the source and, next to it, the child
    const box = (x, y) => `<rect x="${x - 6}" y="${y - 6}" width="12" height="12" rx="2" fill="${P.card}" stroke="${P.ind}" stroke-width="1.5"/>`;
    const fan = (x, y) => `<circle cx="${x}" cy="${y}" r="9" fill="${P.card}" stroke="${P.ink2}" stroke-width="1.3"/><circle cx="${x}" cy="${y}" r="3" fill="${P.ink2}"/>`;
    if (kind === "monitor") s += box(178, 24) + `<path d="M170 30 L104 98" stroke="${P.grey}" stroke-dasharray="3 4"/><text x="146" y="58" ${mono} font-size="13" fill="${P.grey}">?</text>`;
    if (kind === "sensors") s += box(20, 20) + box(180, 20) + box(20, 130) + box(180, 130);
    if (kind === "purifiers") s += fan(24, 24) + fan(176, 24) + fan(24, 126) + fan(176, 126);
    if (kind === "robot") s += `<path d="M168 120 C140 120 150 60 120 50 C 100 44 80 52 70 40" fill="none" stroke="${P.grey}" stroke-dasharray="3 4"/>` + fan(168, 120);
    if (kind === "oddech") {
      s += box(180, 20) + `<path d="M176 126 C150 128 140 100 112 104" fill="none" stroke="${P.acc}" stroke-width="1.8" stroke-dasharray="4 4"/>`;
      s += `<circle cx="112" cy="104" r="7" fill="${P.acc}"/><circle cx="112" cy="104" r="13" fill="none" stroke="${P.acc}" stroke-opacity=".6"/>` + fan(44, 58);
      s += `<path d="M150 40 L60 56" stroke="${P.ind}" stroke-width="1.4" stroke-dasharray="2 3"/><path d="M60 56 l7 -5 m-7 5 l8 3" stroke="${P.ind}" stroke-width="1.4" fill="none"/>`;
    }
    return s + `</svg>`;
  }
  // three yes / partly / no marks per setup: reads the child's air · knows the harm · tells and acts
  const MARKS = { monitor: [0, 0, 0], sensors: [1, 0, 0], purifiers: [0, 0, 1], robot: [1, 0, 1], oddech: [2, 2, 2] };
  const ASK = ["Reads the air the child breathes", "Knows how harmful it is", "Tells you, and acts"];
  function setups(dark, kinds) {
    kinds = kinds || ["monitor", "sensors", "purifiers", "robot", "oddech"];
    const P = pal(dark), dot = v => `<svg viewBox="0 0 14 14" width="14" height="14" aria-label="${["no", "partly", "yes"][v]}"><circle cx="7" cy="7" r="5.5" fill="${v === 2 ? P.acc : "none"}" stroke="${v ? P.acc : P.grey}" stroke-width="1.4"/>${v === 1 ? `<path d="M7 1.5 A5.5 5.5 0 0 1 7 12.5 Z" fill="${P.acc}"/>` : ""}</svg>`;
    return `<div class="art-setups${dark ? " dark" : ""}">${kinds.map(k => `<div class="art-setup${k === "oddech" ? " us" : ""}">${plan(k, dark)}<b>${SETUPS[k].name}</b><p>${SETUPS[k].miss}</p>
      <ul>${MARKS[k].map((v, i) => `<li>${dot(v)}<span>${ASK[i]}</span></li>`).join("")}</ul></div>`).join("")}</div>`;
  }

  // ---------------------------------------------------------------- one breath: conditioned, measured, felt, cleaned, exhaled; part of it returns
  function airLoop(dark, opt) {
    opt = opt || {};
    const P = pal(dark), W = 1160, H = 340, A = P.acc, I = P.ind;
    const box = (x, y, w, h, t, sub, c) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="${dark ? "#14120f" : "#fff"}" stroke="${c || P.hair}" stroke-width="${c ? 1.6 : 1}"/>
      <text x="${x + w / 2}" y="${y + h / 2 - 4}" ${serif} font-size="23" fill="${P.ink}" text-anchor="middle">${t}</text>
      <text x="${x + w / 2}" y="${y + h / 2 + 18}" ${mono} font-size="11" fill="${P.grey}" text-anchor="middle">${sub}</text>`;
    const pid = id("al"), path = (k, d, c, w) => `<path id="${pid}${k}" d="${d}" fill="none" stroke="${c}" stroke-width="${w || 2}" stroke-dasharray="6 6" class="art-flow"/>`;
    const dot = (k, c, dur, b) => `<circle class="anim" r="3.6" fill="${c}"><animateMotion dur="${dur}s" begin="${-b}s" repeatCount="indefinite"><mpath href="#${pid}${k}"/></animateMotion></circle>`;
    let s = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Oddech's air path: inhale, warm and moisten, count the dust, living cells, cartridge filter, HEPA and carbon, exhale; part of the clean air returns to the control wells">`;
    s += scatter(17, 22, 10, 66, 84, 156, (x, y, r) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(1.6 + r * 2.6).toFixed(1)}" fill="${P.grey}" fill-opacity=".7"/>`);
    s += `<text x="52" y="248" ${mono} font-size="11" fill="${P.grey}" text-anchor="middle">ROOM AIR</text>`;
    s += `<circle cx="128" cy="140" r="22" fill="none" stroke="${A}" stroke-width="2"/><circle cx="128" cy="140" r="6" fill="${A}"/>`;
    s += `<text x="128" y="100" ${mono} font-size="11" fill="${A}" text-anchor="middle">1 INHALE</text>`;
    s += path("a", "M150 140 L188 140", A) + box(188, 100, 168, 80, "Warm, moist", "37 °C · 85–90 % RH", A);
    s += `<text x="272" y="88" ${mono} font-size="11" fill="${A}" text-anchor="middle">2 CONDITION</text>`;
    s += path("b", "M356 140 L392 140", A) + box(392, 100, 160, 80, "Dust counter", "PM1 · PM2.5 · PM10");
    s += `<text x="472" y="88" ${mono} font-size="11" fill="${P.grey}" text-anchor="middle">3 SENSE</text>`;
    // the cartridge: exposed wells on top, controls below, its own small filter at the outlet
    const cx0 = 596, wells = (y, cs, label) => `<text x="${cx0 + 10}" y="${y + 24}" ${mono} font-size="10" fill="${P.grey}">${label}</text>` + cs.map((c, i) => `<rect x="${cx0 + 84 + i * 40}" y="${y + 6}" width="30" height="30" rx="6" fill="${c}" fill-opacity="${c === "#ff9a66" ? .8 : .4}" stroke="${P.hair}"/>`).join("");
    s += path("c", "M552 128 L596 98", A) + path("r2", "M596 196 L572 196", I);
    s += `<rect x="${cx0}" y="60" width="268" height="168" rx="8" fill="none" stroke="${P.ink2}" stroke-dasharray="4 4"/>`;
    s += `<text x="${cx0 + 134}" y="48" ${mono} font-size="11" fill="${A}" text-anchor="middle">4 FEEL · LIVING CARTRIDGE</text>`;
    s += wells(74, ["#ff9a66", "#ff9a66", "#ff9a66", "#ff9a66"], "EXPOSED") + wells(176, ["#e9a0b4", "#e9a0b4", "#9fb4d2", "#2a2622"], "CONTROLS");
    s += `<rect x="${cx0 + 246}" y="112" width="16" height="64" rx="3" fill="${dark ? "#1d2430" : "#dfe6f0"}" stroke="${I}"/>`;
    s += `<text x="${cx0 + 124}" y="148" ${mono} font-size="10" fill="${P.grey}" text-anchor="middle">its own filter: nothing living leaves</text>`;
    s += path("d", "M864 144 L904 144", P.ink) + box(904, 104, 150, 80, "HEPA + carbon", "dust and gases");
    s += `<text x="979" y="92" ${mono} font-size="11" fill="${P.grey}" text-anchor="middle">5 CLEAN</text>`;
    s += path("e", "M1054 144 L1100 144 L1100 196", I);
    s += `<circle cx="1100" cy="218" r="20" fill="none" stroke="${I}" stroke-width="2"/><circle cx="1100" cy="218" r="6" fill="${I}"/>`;
    s += `<text x="1100" y="262" ${mono} font-size="11" fill="${I}" text-anchor="middle">6 EXHALE</text>`;
    // the return: a share of the clean air loops back to the front and feeds the control wells
    s += path("r", "M979 184 L979 300 L572 300 L572 196", I, 2.2);
    s += `<text x="776" y="292" ${mono} font-size="11" fill="${I}" text-anchor="middle">7 RETURN · clean, warm, moist air feeds the controls</text>`;
    s += dot("a", A, 1.4, 0) + dot("b", A, 1.4, .5) + dot("c", A, 1.2, .2) + dot("d", P.ink, 1.2, .4) + dot("e", I, 1.5, .1) + dot("r", I, 4.2, 0) + dot("r", I, 4.2, 2.1);
    if (opt.caption !== false) s += `<text x="${W / 2}" y="332" ${mono} font-size="10.5" fill="${P.grey}" text-anchor="middle">the controls breathe the robot's own clean air: what differs between the rows is only what the room air carries</text>`;
    return s + `</svg>`;
  }

  // ---------------------------------------------------------------- the living cartridge's loop: from the lab to the room and back, made safe
  function cartridgeLoop(dark) {
    const P = pal(dark), W = 640, H = 424, cx = 320, cy = 228, R = 146;
    const st = [["Partner lab", "grows airway cells,", "seals the cartridge"], ["Delivered", "every week, in a", "sealed return pouch"],
      ["In the robot", "a week at 37 °C,", "read every 10 min"], ["Sent back", "in the same pouch,", "never opened in the room"],
      ["Made safe", "the lab inactivates it;", "glass reused"]];
    const pos = st.map((_, i) => { const a = -Math.PI / 2 + i * 2 * Math.PI / st.length; return [cx + R * Math.cos(a), cy + R * Math.sin(a)]; });
    let s = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="The living cartridge's loop: partner lab, delivered, in the robot, sent back, made safe, and back to the lab">`;
    s += `<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="${P.hair}" stroke-width="1.4"/>`;
    for (let i = 0; i < st.length; i++) {                // arrows along the circle between stations
      const a0 = -Math.PI / 2 + (i + 0.22) * 2 * Math.PI / st.length, a1 = -Math.PI / 2 + (i + 0.78) * 2 * Math.PI / st.length;
      const p0 = [cx + R * Math.cos(a0), cy + R * Math.sin(a0)], p1 = [cx + R * Math.cos(a1), cy + R * Math.sin(a1)];
      s += `<path d="M${p0[0].toFixed(1)} ${p0[1].toFixed(1)} A${R} ${R} 0 0 1 ${p1[0].toFixed(1)} ${p1[1].toFixed(1)}" fill="none" stroke="${P.acc}" stroke-width="2"/>`;
      const t = [-Math.sin(a1), Math.cos(a1)];         // tangent at the arrow head
      s += `<path d="M${p1[0].toFixed(1)} ${p1[1].toFixed(1)} l${(-9 * t[0] + 5 * t[1]).toFixed(1)} ${(-9 * t[1] - 5 * t[0]).toFixed(1)} M${p1[0].toFixed(1)} ${p1[1].toFixed(1)} l${(-9 * t[0] - 5 * t[1]).toFixed(1)} ${(-9 * t[1] + 5 * t[0]).toFixed(1)}" stroke="${P.acc}" stroke-width="2" fill="none"/>`;
    }
    st.forEach(([t, a, b], i) => {
      const [x, y] = pos[i], right = x > cx + 20, left = x < cx - 20, anchor = right ? "start" : left ? "end" : "middle";
      const tx = right ? x + 20 : left ? x - 20 : x, ty = i === 0 ? y - 54 : y + (y > cy ? 30 : -6);
      s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="10" fill="${i === 2 ? P.acc : P.bg}" stroke="${P.acc}" stroke-width="2"/>`;
      s += `<text x="${tx.toFixed(1)}" y="${ty.toFixed(1)}" text-anchor="${anchor}"><tspan ${serif} font-size="21" fill="${P.ink}">${t}</tspan>`
        + `<tspan x="${tx.toFixed(1)}" dy="17" ${sans} font-size="12.5" fill="${P.ink2}">${a}</tspan><tspan x="${tx.toFixed(1)}" dy="15" ${sans} font-size="12.5" fill="${P.ink2}">${b}</tspan></text>`;
    });
    // the cartridge itself in the middle: two rows of four wells
    s += `<rect x="${cx - 62}" y="${cy - 38}" width="124" height="76" rx="8" fill="${P.card}" stroke="${P.ink2}"/>`;
    for (let i = 0; i < 8; i++) s += `<rect x="${cx - 52 + (i % 4) * 27}" y="${cy - 28 + Math.floor(i / 4) * 30}" width="20" height="20" rx="4" fill="${i < 4 ? "#ff9a66" : i < 6 ? "#e9a0b4" : i === 6 ? "#9fb4d2" : "#2a2622"}" fill-opacity="${i < 4 ? .8 : .45}"/>`;
    s += `<text x="${cx}" y="${cy + 60}" ${mono} font-size="10.5" fill="${P.grey}" text-anchor="middle">ONE CARTRIDGE A WEEK</text>`;
    return s + `</svg>`;
  }

  // ---------------------------------------------------------------- how fast each way of reading the air answers, on a log time axis
  function timeLadder(dark) {
    const P = pal(dark), W = 1120, H = 300, x0 = 40, x1 = W - 40, ya = 150, T1 = 604800;   // 1 s to one week
    const X = t => x0 + (x1 - x0) * Math.log10(t) / Math.log10(T1);
    let s = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Time each method takes to answer, from one second to one week: dust counter every second, Oddech's living cells every ten minutes, a laboratory oxidative-potential instrument hourly, a cell test in a laboratory a day or more">`;
    s += `<line x1="${x0}" y1="${ya}" x2="${x1}" y2="${ya}" stroke="${P.ink2}" stroke-width="1.4"/>`;
    for (const [t, l] of [[1, "1 s"], [60, "1 min"], [600, "10 min"], [3600, "1 h"], [86400, "1 day"], [T1, "1 week"]])
      s += `<line x1="${X(t).toFixed(1)}" y1="${ya - 6}" x2="${X(t).toFixed(1)}" y2="${ya + 6}" stroke="${P.ink2}"/><text x="${X(t).toFixed(1)}" y="${ya + 24}" ${mono} font-size="12" fill="${P.grey}" text-anchor="middle">${l}</text>`;
    // the cells answer within minutes: a band from one to ten minutes
    s += `<rect x="${X(60).toFixed(1)}" y="${ya - 9}" width="${(X(600) - X(60)).toFixed(1)}" height="18" rx="9" fill="${P.acc}" fill-opacity=".22"/>`;
    const mark = (t, up, title, sub, hot) => {
      const x = X(t), y = up ? ya - 62 : ya + 62, a = up ? "end" : "start", tx = x;
      let m = `<line x1="${x.toFixed(1)}" y1="${ya}" x2="${x.toFixed(1)}" y2="${(up ? y + 10 : y - 22).toFixed(1)}" stroke="${hot ? P.acc : P.grey}" stroke-dasharray="${hot ? "0" : "3 3"}"/>`;
      m += `<circle cx="${x.toFixed(1)}" cy="${ya}" r="${hot ? 10 : 6}" fill="${hot ? P.acc : P.bg}" stroke="${hot ? P.acc : P.ink2}" stroke-width="1.6"/>`;
      const anchor = t === 1 ? "start" : t === 600 || t >= 86400 ? "end" : "middle";
      m += `<text x="${tx.toFixed(1)}" y="${(up ? y - 12 : y).toFixed(1)}" text-anchor="${anchor}"><tspan ${serif} font-size="${hot ? 26 : 21}" fill="${hot ? P.acc : P.ink}">${title}</tspan>`
        + `<tspan x="${tx.toFixed(1)}" dy="18" ${sans} font-size="13" fill="${P.ink2}">${sub}</tspan></text>`;
      return m;
    };
    s += mark(1, false, "Dust counter, every second", "how much dust, never how harmful");
    s += mark(600, true, "Oddech's living cells, every 10 minutes", "how harmful the air is, while there is time to act", true);
    s += mark(3600, false, "Lab instrument, hourly", "a chemical stand-in, lab-sized");
    s += mark(86400, true, "Cell test in a lab, a day or more", "a 24-hour exposure, then the analysis");
    s += `<text x="${((X(60) + X(600)) / 2).toFixed(1)}" y="${ya + 44}" ${mono} font-size="11" fill="${P.acc}" text-anchor="middle">cells answer within minutes</text>`;
    return s + `</svg>`;
  }

  // ---------------------------------------------------------------- the product: robot at the edge, the cloud, three users (no ids, no style, nothing moves)
  function archFlow() {
    const I = "#1F1D1A", G = "#77716a", A = "#B4532A", B = "#2E4A6E", H = "rgba(31,29,26,.22)";
    const t = (x, y, s, c = I, f = mono, size = 11, anchor = "middle") => `<text x="${x}" y="${y}" fill="${c}" ${f} font-size="${size}" text-anchor="${anchor}">${s}</text>`;
    const dash = d => `<path d="${d}" fill="none" stroke-width="1.4" stroke-dasharray="4 5" stroke="${B}"/>`;
    return `<svg viewBox="0 40 1200 240" width="960" height="192" aria-hidden="true">
      <g transform="translate(40,0)">
        <rect x="62" y="150" width="56" height="70" rx="10" fill="#F1ECE3" stroke="${I}"/>
        <rect x="86" y="70" width="8" height="80" fill="${I}"/><rect x="74" y="56" width="32" height="18" rx="4" fill="#F1ECE3" stroke="${I}"/>
        <circle cx="90" cy="65" r="3" fill="${A}"/><rect x="66" y="196" width="48" height="6" rx="3" fill="${B}" opacity=".7"/>
        <rect x="70" y="160" width="40" height="22" rx="3" fill="#e9a0b4" fill-opacity=".45" stroke="${H}"/>
        ${t(90, 248, "Oddech robot", I, serif, 22)}${t(90, 268, "edge: map · plan · living sensor")}
      </g>
      <path d="M 180 150 L 470 150" fill="none" stroke-width="1.4" stroke-dasharray="4 5" stroke="${A}"/><circle cx="250" cy="150" r="4" fill="${A}"/><circle cx="400" cy="150" r="4" fill="${A}"/>
      <g transform="translate(325,124)"><rect x="-11" y="2" width="22" height="16" rx="3" fill="${I}"/><path d="M -6 2 v -5 a 6 6 0 0 1 12 0 v 5" fill="none" stroke="${I}" stroke-width="2"/></g>
      ${t(325, 172, "encrypted · about 400 bytes every 10 s", G)}${t(325, 190, "keeps working offline, syncs later", G)}
      <path d="M 500 190 a 40 40 0 0 1 22 -66 a 58 58 0 0 1 108 -10 a 44 44 0 0 1 76 34 a 34 34 0 0 1 -6 66 z" fill="#ECE6DA" stroke="${I}"/>
      ${t(600, 158, "Oddech Cloud", I, serif, 26)}${t(600, 180, "time series · alerts · models")}
      <rect x="548" y="240" width="104" height="18" rx="2" fill="none" stroke="${H}"/>${t(600, 253, "EU hosting · GDPR", G, mono, 10)}
      ${dash("M 712 140 C 790 140 800 70 880 70")}${dash("M 712 156 L 880 156")}${dash("M 712 172 C 790 172 800 242 880 242")}
      <rect x="884" y="48" width="64" height="42" rx="3" fill="#fff" stroke="${I}"/><rect x="892" y="56" width="22" height="16" fill="${A}" opacity=".7"/><rect x="918" y="56" width="22" height="7" fill="${B}" opacity=".6"/><rect x="918" y="66" width="22" height="6" fill="${B}" opacity=".35"/>
      ${t(962, 66, "Staff dashboard", I, serif, 20, "start")}${t(962, 84, "every room, live", G, mono, 11, "start")}
      <rect x="902" y="132" width="28" height="48" rx="5" fill="#fff" stroke="${I}"/><rect x="907" y="140" width="18" height="10" rx="2" fill="${A}" opacity=".75"/>
      ${t(962, 152, "Parent's phone", I, serif, 20, "start")}${t(962, 170, "alert: act now, and why", G, mono, 11, "start")}
      <rect x="886" y="226" width="12" height="30" fill="${I}" opacity=".7"/><rect x="902" y="214" width="14" height="42" fill="${I}" opacity=".5"/><rect x="920" y="232" width="12" height="24" fill="${I}" opacity=".7"/><rect x="936" y="222" width="10" height="34" fill="${I}" opacity=".5"/>
      ${t(962, 240, "City programme", I, serif, 20, "start")}${t(962, 258, "anonymous, consented trends", G, mono, 11, "start")}
    </svg>`;
  }

  // ---------------------------------------------------------------- the QR code to this site, with its quiet zone
  function qr(dark, size) {
    const Q = window.ODDECH_QR; if (!Q) return "";
    if (window.ODDECH_IMG && window.ODDECH_IMG.qr)          // a plain image prints in every browser; the drawn version is the fallback
      return `<img src="${window.ODDECH_IMG.qr}" alt="QR code: ${Q.url}" width="${size}" height="${size}" style="display:block;margin:0 auto;border-radius:10px;image-rendering:pixelated">`;
    const n = Q.n + 8;                                     // four modules of quiet zone on every side
    return `<svg viewBox="-4 -4 ${n} ${n}" width="${size}" height="${size}" role="img" aria-label="QR code: ${Q.url}" shape-rendering="crispEdges">
      <rect x="-4" y="-4" width="${n}" height="${n}" fill="${dark ? "#EDE8DF" : "#fff"}"/><path d="${Q.d}" fill="#1F1D1A"/></svg>`;
  }
  const img = (name, alt, style) => {
    const src = window.ODDECH_IMG && window.ODDECH_IMG[name];
    return src ? `<img src="${src}" alt="${alt}" style="${style || ""}" decoding="sync">` : "";
  };

  window.OddechArt = { cells, room, plan, setups, SETUPS, airLoop, cartridgeLoop, timeLadder, archFlow, qr, img };
})();
