/* Section 07: Oddech Cloud. An animated data path (robot, encrypted link, cloud, people) and a working dashboard design,
   fed live by three rooms of the same room model (sim.js), each with its own robot and living-sensor cartridge.
   The dashboard shows only what a robot would send: its estimates, never the model's hidden truth. Demonstration data. */
(function () {
  "use strict";
  const S = window.OddechSim; if (!S) return;
  const $ = id => document.getElementById(id);
  const fit = cv => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2), w = cv.clientWidth, h = cv.clientHeight;
    if (!w || !h) return null;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const g = cv.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0); return { g, w, h };
  };
  const r0 = v => v === null || v === undefined || !isFinite(v) ? "–" : Math.round(v);
  const hhmm = t => { const m = Math.floor(8 * 60 + t / 60); return String(Math.floor(m / 60) % 24).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0"); };
  const lvl = c => c === null || c === undefined ? "#5d6672" : c <= 15 ? "#5fd08a" : c <= 35 ? "#e3c35a" : c <= 75 ? "#f0965a" : "#e0573a";

  // ================================================================ the data path
  (function arch() {
    const svg = $("archSvg"); if (!svg) return;
    const I = "#1F1D1A", G = "#77716a", A = "#B4532A", B = "#2E4A6E", H = "rgba(31,29,26,.22)";
    const mono = 'font-family="JetBrains Mono, monospace"', serif = 'font-family="Instrument Serif, serif"';
    const t = (x, y, s, c = I, f = mono, size = 11, anchor = "middle") => `<text x="${x}" y="${y}" fill="${c}" ${f} font-size="${size}" text-anchor="${anchor}">${s}</text>`;
    const p = (id, d, c) => `<path id="${id}" d="${d}" fill="none" stroke="${c}" stroke-width="1.4" stroke-dasharray="4 5"/>`;
    const dot = (id, c, dur, b) => `<circle r="4" fill="${c}"><animateMotion dur="${dur}s" begin="${b}s" repeatCount="indefinite"><mpath href="#${id}"/></animateMotion></circle>`;
    svg.innerHTML = `
      <style>.pulse{animation:apulse 2.4s ease-in-out infinite;transform-box:fill-box;transform-origin:center}@keyframes apulse{0%,100%{opacity:.35}50%{opacity:1}}
      @media (prefers-reduced-motion:reduce){.pulse{animation:none}}</style>
      <g transform="translate(40,0)">
        <rect x="62" y="150" width="56" height="70" rx="10" fill="#F1ECE3" stroke="${I}"/>
        <rect x="86" y="70" width="8" height="80" fill="${I}"/><rect x="74" y="56" width="32" height="18" rx="4" fill="#F1ECE3" stroke="${I}"/>
        <circle cx="90" cy="65" r="3" fill="${A}" class="pulse"/><rect x="66" y="196" width="48" height="6" rx="3" fill="${B}" opacity=".7"/>
        <rect x="70" y="160" width="40" height="22" rx="3" fill="#e9a0b4" fill-opacity=".45" stroke="${H}"/>
        ${t(90, 248, "Oddech robot", I, serif, 22)}${t(90, 268, "edge: map · plan · living sensor")}
      </g>
      ${p("u1", "M 180 150 L 470 150", A)}
      <g transform="translate(325,124)"><rect x="-11" y="2" width="22" height="16" rx="3" fill="${I}"/><path d="M -6 2 v -5 a 6 6 0 0 1 12 0 v 5" fill="none" stroke="${I}" stroke-width="2"/></g>
      ${t(325, 172, "MQTT over TLS · ~400 B every 10 s", G)}${t(325, 190, "buffers offline, syncs later", G)}
      <path d="M 500 190 a 40 40 0 0 1 22 -66 a 58 58 0 0 1 108 -10 a 44 44 0 0 1 76 34 a 34 34 0 0 1 -6 66 z" fill="#ECE6DA" stroke="${I}"/>
      ${t(600, 158, "Oddech Cloud", I, serif, 26)}${t(600, 180, "time series · alerts · models")}
      <g ${mono} font-size="10" fill="${G}"><rect x="548" y="240" width="104" height="18" rx="2" fill="none" stroke="${H}"/><text x="600" y="253" text-anchor="middle">EU hosting · GDPR</text></g>
      ${p("d1", "M 712 140 C 790 140 800 70 880 70", B)}${p("d2", "M 712 156 L 880 156", B)}${p("d3", "M 712 172 C 790 172 800 242 880 242", B)}
      <g><rect x="884" y="48" width="64" height="42" rx="3" fill="#fff" stroke="${I}"/><rect x="892" y="56" width="22" height="16" fill="${A}" opacity=".7"/><rect x="918" y="56" width="22" height="7" fill="${B}" opacity=".6"/><rect x="918" y="66" width="22" height="6" fill="${H}"/>
        ${t(962, 66, "Staff dashboard", I, serif, 20, "start")}${t(962, 84, "every room, live", G, mono, 11, "start")}</g>
      <g><rect x="902" y="132" width="28" height="48" rx="5" fill="#fff" stroke="${I}"/><rect x="907" y="140" width="18" height="10" rx="2" fill="${A}" opacity=".75" class="pulse"/>
        ${t(962, 152, "Parent's phone", I, serif, 20, "start")}${t(962, 170, "alert: act now, and why", G, mono, 11, "start")}</g>
      <g><rect x="886" y="226" width="12" height="30" fill="${I}" opacity=".7"/><rect x="902" y="214" width="14" height="42" fill="${I}" opacity=".5"/><rect x="920" y="232" width="12" height="24" fill="${I}" opacity=".7"/><rect x="936" y="222" width="10" height="34" fill="${I}" opacity=".4"/>
        ${t(962, 240, "City programme", I, serif, 20, "start")}${t(962, 258, "anonymous, consented trends", G, mono, 11, "start")}</g>
      ${dot("u1", A, 2.2, 0)}${dot("u1", A, 2.2, 1.1)}${dot("d1", B, 2.6, .4)}${dot("d2", B, 2.6, 1.0)}${dot("d3", B, 2.6, 1.6)}`;
  })();

  // ================================================================ the dashboard
  const dash = $("dash"); if (!dash) return;
  const ROOMS = [
    { id: "ladybirds", name: "Ladybirds · play room", sc: "smog", seed: 101, robot: "oddech-r1" },
    { id: "bears", name: "Bears · next to the kitchen", sc: "cooking", seed: 202, robot: "oddech-r2" },
    { id: "owls", name: "Owls · quiet room", sc: "candle", seed: 303, robot: "oddech-r3" },
  ];
  let sel = 0, built = false, visible = false, speed = 30, last = performance.now(), tUi = 0;
  const alerts = [];
  function build() {
    built = true;
    for (const r of ROOMS) { r.w = new S.World({ scenario: r.sc, seed: r.seed }); r.w.follow = true; r.hist = []; r.lastRec = -1e9; r.flags = {}; r.logN = 0; }
    $("dashRooms").innerHTML = ROOMS.map((r, i) => `<button class="dash-room${i === sel ? " on" : ""}" data-i="${i}"><b>${r.name}</b><span id="dr${i}">starting…</span></button>`).join("") +
      `<div class="dash-side-foot mono">3 rooms · 3 robots · demo site</div>`;
    $("dashRooms").addEventListener("click", e => { const b = e.target.closest("[data-i]"); if (!b) return; sel = +b.dataset.i;
      $("dashRooms").querySelectorAll(".dash-room").forEach((x, i) => x.classList.toggle("on", i === sel)); ui(); });
  }
  new IntersectionObserver(es => { visible = es[0].isIntersecting; if (visible && !built) build(); }, { threshold: 0.05 }).observe(dash);

  function alert(r, t, text, warn) { alerts.unshift({ t, room: r.name.split(" · ")[0], text, warn }); if (alerts.length > 14) alerts.pop(); }
  function rules(r) {                                       // what the cloud's rules would raise from the robot's messages
    const w = r.w, ex = S.exposures(w)[0], b = w.bio.last, f = r.flags;
    if (ex.c !== null) {
      if (ex.c > 35 && !f.heavy) { f.heavy = true; alert(r, w.t, `Children's air heavy: ${r0(ex.c)} µg/m³${w.advice ? ", worst near " + w.advice.zone : ""}`, true); }
      if (ex.c < 25 && f.heavy) { f.heavy = false; alert(r, w.t, `Children's air back to ${r0(ex.c)} µg/m³`); }
    }
    if (b.n && b.index >= 25 && !f.stress) { f.stress = true; alert(r, w.t, `Living cells reacting, stress ${r0(b.index)}/100${b.toxPerMass > 1.2 ? ": smoke-like air" : ""}`, true); }
    if (b.n && b.life < 0.25 && !f.cart) { f.cart = true; alert(r, w.t, "Cartridge due: swap within the day"); }
    for (; r.logN < w.log.length; r.logN++) alert(r, w.log[r.logN].t, "Action taken: " + w.log[r.logN].text);
  }
  function record(r) {
    const w = r.w; if (w.t - r.lastRec < 30) return; r.lastRec = w.t;
    const ex = S.exposures(w)[0];
    r.hist.push({ t: w.t, c: ex.c, lo: ex.lo, hi: ex.hi, mon: w.live.sensors[0] ? w.live.sensors[0].last : null });
    while (r.hist.length && w.t - r.hist[0].t > 3600) r.hist.shift();
    rules(r);
  }

  function packet(r) {
    const w = r.w, ex = S.exposures(w), b = w.bio.last, cfg = w.air.cfg, rb = w.live.robot;
    return {
      device: r.robot, room: r.id, time: hhmm(w.t),
      breathing_zone: Object.fromEntries(ex.map(e => [e.id === "child" ? "child_0.45m" : "adult_1.1m", e.c === null ? null : { pm25: r0(e.c), p10: r0(e.lo), p90: r0(e.hi) }])),
      hotspot: w.advice ? w.advice.zone : null,
      living_sensor: { cycle: b.n, dF_F0_exposed: +b.dExp.toFixed(3), dF_F0_control: +b.dCtl.toFixed(3), stress_index: r0(b.index), cartridge_life: +b.life.toFixed(2) },
      purifier: { on: cfg.purifierOn, cadr_m3h: Math.round(cfg.cadr * 3600), mode: w.purifierMode },
      robot: { battery: +(rb.pct / 100).toFixed(2), state: rb.state },
    };
  }

  const offMap = document.createElement("canvas");
  function drawMap(r) {
    const f = fit($("dashMap")); if (!f) return; const { g, w, h } = f, m = r.w.live.map, C = window.OddechColors;
    g.fillStyle = "#0f1216"; g.fillRect(0, 0, w, h);
    if (!m.ready || !C) { g.fillStyle = "#8b97a5"; g.font = "500 11px 'JetBrains Mono', monospace"; g.textAlign = "center"; g.fillText("first readings…", w / 2, h / 2); return; }
    const nx = 40, ny = 30, gr = m.grid(1.1, r.w.t, nx, ny, false), og = offMap.getContext("2d");
    offMap.width = nx; offMap.height = ny; const img = og.createImageData(nx, ny);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const c = C.CONC(C.tC(S.EXP(gr.mu[i + nx * j]))), o = 4 * (i + nx * (ny - 1 - j)); img.data[o] = c[0]; img.data[o + 1] = c[1]; img.data[o + 2] = c[2]; img.data[o + 3] = 255; }
    og.putImageData(img, 0, 0); g.imageSmoothingEnabled = true; g.drawImage(offMap, 0, 0, w, h);
    const X = x => x / S.ROOM.Lx * w, Y = y => h - y / S.ROOM.Ly * h;
    g.strokeStyle = "rgba(15,18,22,.6)"; g.fillStyle = "rgba(15,18,22,.3)"; g.lineWidth = 1;
    for (const o of S.LAYOUT.obstacles) { g.fillRect(X(o[0]), Y(o[3]), X(o[2]) - X(o[0]), Y(o[1]) - Y(o[3])); g.strokeRect(X(o[0]), Y(o[3]), X(o[2]) - X(o[0]), Y(o[1]) - Y(o[3])); }
    for (const p of S.LAYOUT.people) { g.strokeStyle = "#e7ecf1"; g.lineWidth = 1.4; g.beginPath(); g.arc(X(p.x), Y(p.y), 5, 0, 2 * Math.PI); g.stroke(); }
    const rb = r.w.live.robot; g.fillStyle = "#fff"; g.beginPath(); g.arc(X(rb.x), Y(rb.y), 4, 0, 2 * Math.PI); g.fill();
    const a = r.w.advice; if (a && a.ratio > 1.4) { g.strokeStyle = "#f0b38c"; g.lineWidth = 1.5; g.setLineDash([3, 3]); g.beginPath(); g.arc(X(a.hotspot.x), Y(a.hotspot.y), 16, 0, 2 * Math.PI); g.stroke(); g.setLineDash([]); }
  }
  function drawTrend(r) {
    const f = fit($("dashTrend")); if (!f) return; const { g, w, h } = f, H = r.hist.filter(p => p.c !== null); g.clearRect(0, 0, w, h);
    const x0 = 30, x1 = w - 6, y0 = h - 16, y1 = 6, t1 = r.w.t, t0 = t1 - 3600;
    let mx = 40; for (const p of H) mx = Math.max(mx, p.hi, p.mon || 0); mx *= 1.08;
    const X = t => x0 + (x1 - x0) * (t - t0) / 3600, Y = v => y0 - (y0 - y1) * v / mx;
    g.font = "500 9.5px 'JetBrains Mono', monospace"; g.fillStyle = "#8b97a5"; g.strokeStyle = "rgba(220,230,240,.07)"; g.lineWidth = 1; g.textAlign = "right";
    const step = mx > 160 ? 50 : mx > 80 ? 25 : 10;
    for (let v = 0; v < mx; v += step) { g.beginPath(); g.moveTo(x0, Y(v)); g.lineTo(x1, Y(v)); g.stroke(); g.fillText(v, x0 - 4, Y(v) + 3); }
    g.textAlign = "left"; g.fillText(hhmm(Math.max(0, t0)), x0, h - 2); g.textAlign = "right"; g.fillText(hhmm(t1), x1, h - 2);
    g.strokeStyle = "rgba(95,208,138,.6)"; g.setLineDash([2, 4]); g.beginPath(); g.moveTo(x0, Y(15)); g.lineTo(x1, Y(15)); g.stroke(); g.setLineDash([]);
    g.fillStyle = "rgba(95,208,138,.8)"; g.fillText("WHO 15", x1, Y(15) - 3);
    if (H.length < 2) return;
    g.fillStyle = "rgba(240,150,90,.18)"; g.beginPath(); H.forEach((p, i) => i ? g.lineTo(X(p.t), Y(p.hi)) : g.moveTo(X(p.t), Y(p.hi)));
    for (let i = H.length - 1; i >= 0; i--) g.lineTo(X(H[i].t), Y(H[i].lo)); g.closePath(); g.fill();
    g.strokeStyle = "#8b97a5"; g.lineWidth = 1; g.setLineDash([3, 3]); g.beginPath(); let on = false;
    for (const p of r.hist) { if (p.mon === null) { on = false; continue; } on ? g.lineTo(X(p.t), Y(p.mon)) : g.moveTo(X(p.t), Y(p.mon)); on = true; } g.stroke(); g.setLineDash([]);
    g.strokeStyle = "#f0965a"; g.lineWidth = 2; g.beginPath(); H.forEach((p, i) => i ? g.lineTo(X(p.t), Y(p.c)) : g.moveTo(X(p.t), Y(p.c))); g.stroke();
  }
  function drawBio(r) {
    const f = fit($("dashBio")); if (!f) return; const { g, w, h } = f, H = r.w.bio.hist.filter(b => b.n > 0).slice(-36); g.clearRect(0, 0, w, h);
    g.font = "500 9.5px 'JetBrains Mono', monospace"; g.fillStyle = "#8b97a5"; g.textAlign = "left"; g.lineWidth = 1;
    const x0 = 22, x1 = w - 4, y0 = h - 12, y1 = 6, Y = v => y0 - (y0 - y1) * v / 100;
    g.strokeStyle = "rgba(220,230,240,.07)"; for (const v of [0, 50, 100]) { g.beginPath(); g.moveTo(x0, Y(v)); g.lineTo(x1, Y(v)); g.stroke(); g.fillText(v, 0, Y(v) + 3); }
    g.strokeStyle = "rgba(240,150,90,.45)"; g.setLineDash([2, 3]); g.beginPath(); g.moveTo(x0, Y(25)); g.lineTo(x1, Y(25)); g.stroke(); g.setLineDash([]);
    if (!H.length) { g.fillText("first breath after 10 min", x0 + 6, h / 2); return; }
    const bw = (x1 - x0) / 36;
    H.forEach((b, i) => { g.fillStyle = b.index >= 25 ? "#f0965a" : "#7E98BC"; g.fillRect(x0 + i * bw + 1, Y(b.index), Math.max(1, bw - 2), y0 - Y(b.index)); });
    g.fillStyle = "#8b97a5"; g.textAlign = "right"; g.fillText("stress index per 10-min cycle", x1, y1 + 8);
  }
  function wells(r) {
    const b = r.w.bio.last, names = ["E1", "E2", "E3", "E4", "C1", "C2", "REF", "BLK"];
    $("dashWells").innerHTML = names.map((n, k) => {
      const rel = k === 7 ? 0 : (b.F[k] - b.F0[k]) / b.F0[k], a = Math.max(0, Math.min(1, rel));
      const bg = k === 7 ? "#20262e" : k === 6 ? "#45607f" : `rgba(${Math.round(120 + 135 * a)},${Math.round(110 + 30 * a)},${Math.round(130 - 60 * a)},${(0.35 + 0.65 * a).toFixed(2)})`;
      return `<i style="background:${bg}" data-r="${n}" title="${n}: ${(100 * rel).toFixed(0)} %"></i>`; }).join("");
  }

  function ui() {
    const r = ROOMS[sel], w = r.w, ex = S.exposures(w), b = w.bio.last, cfg = w.air.cfg, m = w.live.map;
    $("dashClock").textContent = "live · " + hhmm(w.t);
    ROOMS.forEach((q, i) => { const e = S.exposures(q.w)[0], bb = q.w.bio.last;
      $("dr" + i).innerHTML = `<i class="lvl" style="background:${lvl(e.c)}"></i>${e.c === null ? "warming up" : r0(e.c) + " µg/m³"} · stress ${bb.n ? r0(bb.index) : "–"}`; });
    let avg = null;
    if (m.ready) { const gr = m.grid(1.1, w.t, 20, 15, false); let s = 0; for (const v of gr.mu) s += S.EXP(v); avg = s / gr.mu.length; }
    const smoky = b.n && b.index >= 25 && b.toxPerMass > 1.2;
    const tiles = [
      ["Children's air · 0.45 m", ex[0].c === null ? "–" : `${r0(ex[0].c)}<small> µg/m³</small>`, ex[0].c === null ? "warming up" : `likely ${r0(ex[0].lo)}–${r0(ex[0].hi)}`, lvl(ex[0].c)],
      ["Room average · map", avg === null ? "–" : `${r0(avg)}<small> µg/m³</small>`, w.advice ? "worst: " + w.advice.zone.replace(/^the /, "") : "", lvl(avg)],
      ["Living Air Sensor", b.n ? `${r0(b.index)}<small> / 100</small>` : "–", b.n ? (smoky ? "smoke-like air" : b.index >= 25 ? "cells reacting" : "cells calm") : "first breath at 10 min", b.n ? (b.index >= 25 ? "#f0965a" : "#5fd08a") : "#5d6672"],
      ["Outdoor · city station", `${r0(cfg.cout)}<small> µg/m³</small>`, cfg.windowOpen ? "window open" : "window shut", lvl(cfg.cout)],
      ["Purifier", cfg.purifierOn ? `${Math.round(cfg.cadr * 3600)}<small> m³/h</small>` : "off", w.purifierMode === "auto" ? "auto, guided by Oddech" : w.purifierMode, cfg.purifierOn ? "#7E98BC" : "#5d6672"],
    ];
    $("dashTiles").innerHTML = tiles.map(t => `<div class="dash-tile" style="border-top:2px solid ${t[3]}"><span>${t[0]}</span><b>${t[1]}</b><em>${t[2]}</em></div>`).join("");
    $("dashMapT").textContent = m.ready ? `${m.samples.length} readings` : "";
    $("dashCart").textContent = b.n ? `cycle ${b.n} · life ${Math.round(100 * b.life)} %` : "cartridge fresh";
    drawMap(r); drawTrend(r); drawBio(r); wells(r);
    $("dashAlertN").textContent = alerts.length ? `${alerts.filter(a => a.warn).length} warnings` : "";
    $("dashAlerts").innerHTML = alerts.length ? alerts.slice(0, 7).map(a => `<li class="${a.warn ? "warn" : ""}"><span class="mono">${hhmm(a.t)}</span><span><b>${a.room}</b> · ${a.text}</span></li>`).join("") : `<li><span class="mono">–</span><span>No alerts yet.</span></li>`;
    $("dashDevices").innerHTML = ROOMS.map(q => { const rb = q.w.live.robot; return `<li>${q.robot} · ${q.name.split(" · ")[0]}<span>${Math.round(rb.pct)} % · ${rb.state}</span></li>`; }).join("") +
      ROOMS.map(q => `<li>cartridge · ${q.name.split(" · ")[0]}<span>${Math.round(100 * q.w.bio.last.life)} %</span></li>`).join("");
    const pk = packet(r), s = JSON.stringify(pk);
    $("dashPkt").textContent = JSON.stringify(pk, null, 1); $("dashPktT").textContent = `${new Blob([s]).size} B · ${hhmm(w.t)}`;
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (!visible || !built || document.hidden) return;
    const t0 = performance.now();
    for (const r of ROOMS) { r.w.advance(dt * speed); record(r); }
    const cost = performance.now() - t0;                    // keep the page smooth: slow the clock on slow machines
    speed = cost > 12 ? Math.max(6, speed * 0.9) : cost < 6 ? Math.min(45, speed * 1.03) : speed;
    if (now - tUi > 700) { ui(); tUi = now; }
  }
  requestAnimationFrame(frame);
})();
