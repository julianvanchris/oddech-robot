/* Section 15: the pitch deck. Twelve 1280×720 slides, scaled to the frame; arrow keys, thumbnails, full screen,
   and print to PDF (one slide per page). Numbers come from the same sources as the page: the H1 benchmark (bench.json),
   the living-sensor model (sim.js) and the unit-economics function (sim.js). */
(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const deck = $("deck"), stage = $("deckStage"); if (!deck || !stage) return;
  const S = window.OddechSim;

  // ---------------------------------------------------------------- pictures, drawn in SVG
  function robotArt(h) {
    return `<svg viewBox="0 0 260 520" style="height:${h}px" aria-hidden="true">
      <defs><radialGradient id="dkGlow"><stop offset="0" stop-color="#ff9a66" stop-opacity=".95"/><stop offset="1" stop-color="#ff9a66" stop-opacity="0"/></radialGradient></defs>
      <g stroke="#EDE8DF" stroke-width="1.6" fill="none">
        <path d="M 40 70 C 10 60 4 30 30 18" stroke="#9C958A" stroke-dasharray="3 5"/><path d="M 220 70 C 250 60 256 30 230 18" stroke="#7E98BC" stroke-dasharray="3 5"/>
        <rect x="88" y="40" width="84" height="46" rx="12" fill="#1d1a17"/><circle cx="130" cy="63" r="7" fill="#D9875C" stroke="none"/>
        <rect x="124" y="86" width="12" height="250" fill="#1d1a17"/>
        <rect x="58" y="336" width="144" height="128" rx="26" fill="#1d1a17"/>
        <rect x="82" y="356" width="96" height="44" rx="6" fill="#0c0b0a"/>
      </g>
      ${[0, 1, 2, 3].map(i => `<circle cx="${96 + i * 23}" cy="378" r="14" fill="url(#dkGlow)"><animate attributeName="opacity" values=".3;1;.3" dur="3.6s" begin="${i * .4}s" repeatCount="indefinite"/></circle><rect x="${89 + i * 23}" y="371" width="14" height="14" rx="3" fill="#e9a0b4" fill-opacity=".55"/>`).join("")}
      <rect x="70" y="424" width="120" height="6" rx="3" fill="#7E98BC"/><circle cx="92" cy="470" r="12" fill="#2a2622" stroke="#EDE8DF"/><circle cx="168" cy="470" r="12" fill="#2a2622" stroke="#EDE8DF"/>
      <text x="184" y="34" fill="#9C958A" font-family="JetBrains Mono, monospace" font-size="12">1.6 m</text>
      <text x="146" y="256" fill="#9C958A" font-family="JetBrains Mono, monospace" font-size="12">1.1 m</text>
      <text x="130" y="416" fill="#D9875C" font-family="JetBrains Mono, monospace" font-size="11" text-anchor="middle">living cells</text>
    </svg>`;
  }
  function wellsArt() {
    const role = ["E1", "E2", "E3", "E4", "C1", "C2", "REF", "BLK"];
    let s = `<svg viewBox="0 0 470 300" style="width:470px" aria-hidden="true"><g font-family="JetBrains Mono, monospace" font-size="12">`;
    for (let r = 0; r < 2; r++) {
      s += `<rect x="10" y="${20 + r * 140}" width="450" height="110" rx="8" fill="rgba(220,228,236,.07)" stroke="rgba(237,232,223,.35)"/>`;
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
  function bioCurves() {                                  // the model's own response, same mass, three kinds of air
    if (!S || !S.LivingSensor) return "";
    const run = (m, tox) => { const L = new S.LivingSensor(3), out = [0]; for (let i = 0; i < 36; i++) out.push(L.cycle(m, m * tox, i * 600).index); return out; };
    const sets = [["Kraków winter smoke · 70", run(70, 1.4), "#D9875C"], ["Cooking fumes · 70", run(70, 0.7), "#E8B48F"], ["Clean room · 8", run(8, 1.0), "#7E98BC"]];
    const W = 520, H = 300, x0 = 46, x1 = W - 10, y0 = H - 34, y1 = 12, X = n => x0 + (x1 - x0) * n / 36, Y = v => y0 - (y0 - y1) * v / 100;
    let s = `<svg viewBox="0 0 ${W} ${H}" style="width:${W}px" aria-hidden="true"><g font-family="JetBrains Mono, monospace" font-size="12" fill="#9C958A">`;
    for (const v of [0, 25, 50, 75, 100]) s += `<line x1="${x0}" x2="${x1}" y1="${Y(v)}" y2="${Y(v)}" stroke="rgba(237,232,223,.1)"/><text x="${x0 - 8}" y="${Y(v) + 4}" text-anchor="end">${v}</text>`;
    for (const n of [0, 12, 24, 36]) s += `<text x="${X(n)}" y="${y0 + 20}" text-anchor="middle">${n}</text>`;
    s += `<text x="${X(18)}" y="${y0 + 20}" text-anchor="middle">cycles of 10 min</text><text x="${x0 + 6}" y="${y1 + 12}">stress index</text>`;
    sets.forEach(([name, v, c], i) => {
      s += `<path d="${v.map((y, n) => (n ? "L" : "M") + X(n).toFixed(1) + " " + Y(y).toFixed(1)).join(" ")}" fill="none" stroke="${c}" stroke-width="${i ? 2 : 3}"/>`;
      s += `<text x="${x1}" y="${Y(v[36]) - 8}" text-anchor="end" fill="${c}">${name}: ${Math.round(v[36])}</text>`;
    });
    return s + `</g></svg>`;
  }

  // ---------------------------------------------------------------- numbers from the page's own sources
  const B = window.ODDECH_BENCH, fx = v => "×" + Math.exp(v).toFixed(2);
  const ue = S && S.unitEconomics ? S.unitEconomics({ hw: 1100, fee: 120, cart: 4, pc: 25, svc: 20, life: 36 }) : null;
  const eur = v => "€" + Math.round(v).toLocaleString("en-GB");
  const foot = (left, n) => `<div class="sl-foot"><span>${left}</span><span>ODDECH · ${String(n).padStart(2, "0")} / 12</span></div>`;
  const barW = v => B ? ((Math.exp(v) - 1) / (Math.exp(B.median.fixed4_people) - 1) * 100).toFixed(1) + "%" : "0";

  // ---------------------------------------------------------------- the twelve slides
  const SL = [];
  SL.push(["Title", "s-dark", `
    <div class="sl-k">FL Joint Programme · Kraków · 16 October 2026</div>
    <h2 style="font-size:168px;margin:36px 0 10px">Oddech</h2>
    <p class="sl-sub" style="max-width:700px">A robot that breathes the room with you. Living airway cells tell it <b>how harmful</b> the air is, its map tells it <b>where</b>, and it tells you <b>what to do</b>.</p>
    <p class="sl-sub" style="margin-top:40px;font-size:17px;color:#9C958A">Julian Evan Chrisnanto · Antonio Galiza Cardeira Gonzales · Xiyue (Thea) Cao · Aleksandra Skrzypiec</p>
    <div class="sl-art" style="right:110px;top:70px">${robotArt(560)}</div>
    ${foot("Oddech, Polish for “breath”", 1)}`]);
  SL.push(["Problem", "s-paper", `
    <div class="sl-k">01 · The problem</div>
    <h2>Kraków's smog comes indoors. <em>A number on a shelf cannot help.</em></h2>
    <div class="sl-nums">
      <div><b class="acc">−40 %</b><span>annual PM2.5, 2010 to 2021, after the solid-fuel ban. The limit was still not met.</span></div>
      <div><b>≈70 %</b><span>of indoor PM10 in Kraków flats is the finest dust, PM2.5, in the cold half-year.</span></div>
      <div><b>87 %</b><span>of our time is spent inside buildings. Children breathe at 0.4 m, below the shelf.</span></div>
    </div>
    ${foot("Sources: Kicińska & Jawdyńska 2025; Ścibor et al. 2020; Klepeis et al. 2001", 2)}`]);
  SL.push(["Gap", "s-paper2", `
    <div class="sl-k">02 · The gap</div>
    <h2>Today's tools weigh the air. <em>Nobody asks the body.</em></h2>
    <div class="sl-grid2">
      <ul class="sl-list">
        <li><i>01</i><span><b>Air is uneven.</b> Next to a source it can be 6 to 20 times the well-mixed prediction.</span></li>
        <li><i>02</i><span><b>A monitor is one point.</b> A purifier cleans around itself and shows one number.</span></li>
        <li><i>03</i><span><b>Same weight, different harm.</b> Its oxidising power comes mostly from human sources such as burning wood at home; cutting mass alone may not cut it.</span></li>
      </ul>
      <div><p class="sl-big" style="font-size:76px;line-height:1.05">“Where, how harmful, what to do?”</p><p class="sl-sub" style="font-size:19px;margin-top:22px">Three questions a kindergarten director cannot answer today, on a smog evening, in one room.</p></div>
    </div>
    ${foot("Sources: Acevedo-Bolton et al. 2011; Daellenbach et al. 2020", 3)}`]);
  SL.push(["Solution", "s-dark", `
    <div class="sl-k">03 · The solution</div>
    <h2>Oddech breathes, feels, maps, tells, acts.</h2>
    <p class="sl-sub">A quiet robot with a mast, a living-cell cartridge and a live map, linked to the purifier, the phone and the cloud.</p>
    <div class="sl-chain">
      <div><i>01</i><b>Breathe</b><span>Samples at 0.4, 1.1 and 1.6 m, where children and adults breathe.</span></div>
      <div class="hot"><i>02</i><b>Feel</b><span>Living airway cells glow when the air stresses them.</span></div>
      <div><i>03</i><b>Map</b><span>A live map of the room, with its doubt, chooses where to go next.</span></div>
      <div><i>04</i><b>Tell</b><span>Plain, tested words: what, where, how sure, what to do.</span></div>
      <div><i>05</i><b>Act</b><span>Moves the purifier, says when a window helps, alerts the phone.</span></div>
    </div>
    ${foot("Concept: robot, sensor and advice are designs under test", 4)}`]);
  SL.push(["Living Air Sensor", "s-dark", `
    <div class="sl-k">04 · Our unique point · the Living Air Sensor</div>
    <h2 style="font-size:52px">A cartridge of living cells, <em>read every ten minutes.</em></h2>
    <div class="sl-grid2" style="grid-template-columns:470px 1fr;gap:60px;margin-top:10px">
      <div>${wellsArt()}<p class="sl-sub" style="font-size:15px;color:#9C958A;margin-top:8px">Four wells breathe room air, two breathe the same air through a filter, one checks the lamp, one has no cells.</p></div>
      <div>${bioCurves()}<p class="sl-sub" style="font-size:16px;margin-top:10px">Same dust mass, different harm: the index is <b>ΔF/F₀ exposed − control</b>, so the cells answer what the dust counter cannot.</p></div>
    </div>
    ${foot("Concept model after X. Cao; illustrative values, no experimental data · format: 4-well chamber slides, 1.7 cm² per well", 5)}`]);
  SL.push(["What is new", "s-paper", `
    <div class="sl-k">05 · “Isn't this an existing idea?”</div>
    <h2>The pieces exist. <em>The loop does not.</em></h2>
    <table class="sl-tbl"><thead><tr><th>What exists</th><th>Goes where people breathe</th><th>Measures harm to cells</th><th>Maps the room</th><th>Tells you what to do</th></tr></thead><tbody>
      <tr><td>Odour-seeking biohybrid drone (moth antenna)</td><td>partly</td><td>–</td><td>–</td><td>–</td></tr>
      <tr><td>Airway cells exposed to smoke, in a lab</td><td>–</td><td>yes</td><td>–</td><td>–</td></tr>
      <tr><td>Gas-mapping research robots</td><td>partly</td><td>–</td><td>yes</td><td>–</td></tr>
      <tr><td>Monitors, purifiers, purifier robots</td><td>one point</td><td>–</td><td>–</td><td>partly</td></tr>
      <tr><td class="us"><b style="color:var(--accent)">Oddech</b></td><td class="us">yes</td><td class="us">yes</td><td class="us">yes</td><td class="us">yes</td></tr>
    </tbody></table>
    <p class="sl-sub" style="font-size:17px;margin-top:22px">Our quick search (OpenAlex, 13 October 2026) found no robot carrying a cell-based particle sensor. A full search is our first task after Kraków.</p>
    ${foot("Sources: Anderson et al. 2020; Ihantola et al. 2022; Francis et al. 2022; Ecovacs AIRBOT Z1", 6)}`]);
  SL.push(["Proof", "s-paper2", B ? `
    <div class="sl-k">06 · First proof, in simulation (H1)</div>
    <h2 style="font-size:52px">Where people breathe, Oddech beat four fixed sensors <em>in ${B.wins.people_vs_fixed} of ${B.seeds} rooms.</em></h2>
    <p class="sl-sub" style="font-size:19px">Typical error of the estimate where the child and the adult breathe, median of ${B.seeds} simulated rooms; lower is better.</p>
    <div class="sl-bars" style="margin-top:34px">
      <div class="sl-bar us"><span>Three fixed sensors + Oddech</span><i style="width:${barW(B.median.oddech_people)}"></i><b>${fx(B.median.oddech_people)}</b></div>
      <div class="sl-bar"><span>Three fixed + a robot sent to random places</span><i style="width:${barW(B.median.random_people)}"></i><b>${fx(B.median.random_people)}</b></div>
      <div class="sl-bar"><span>Four fixed sensors</span><i style="width:100%"></i><b>${fx(B.median.fixed4_people)}</b></div>
    </div>
    <p class="sl-sub" style="font-size:17px;margin-top:30px">It beat a randomly moving robot in ${B.wins.people_vs_random} of ${B.seeds} rooms too: where people breathe, the gain comes from <b>choosing</b> where to go.</p>
    ${foot("Model room with random sources, windows and purifiers: shows the method, not evidence about real rooms", 7)}` : `<div class="sl-k">06 · Proof</div><h2>Benchmark not loaded.</h2>${foot("", 7)}`]);
  SL.push(["Product", "s-dark", `
    <div class="sl-k">07 · The product</div>
    <h2>Robot at the edge, <em>every room live in the cloud.</em></h2>
    <div class="sl-grid2" style="grid-template-columns:1fr 540px">
      <ul class="sl-list">
        <li><i>01</i><span><b>Robot.</b> Map, planning, voice and cell maths on board. No camera.</span></li>
        <li><i>02</i><span><b>Link.</b> About 400 bytes every 10 s, encrypted (MQTT over TLS); keeps working offline.</span></li>
        <li><i>03</i><span><b>Cloud.</b> History, alerts, a monthly air report; EU hosting under the GDPR.</span></li>
        <li><i>04</i><span><b>People.</b> Staff dashboard, parent alerts, anonymous trends for the city.</span></li>
      </ul>
      <div class="sl-dash">
        <div class="sl-dash-top"><b>Oddech Cloud</b><span>Kindergarten · demo</span><i></i></div>
        <div class="sl-dash-tiles"><div><span>Children's air</span><b>42</b><em>likely 31–58</em></div><div><span>Living sensor</span><b style="color:#f0965a">31</b><em>smoke-like</em></div><div><span>Purifier</span><b>300</b><em>m³/h · auto</em></div></div>
        <div class="sl-dash-alert"><span>17:42</span>Ladybirds · living cells reacting, stress 31/100: smoke-like air</div>
        <div class="sl-dash-alert"><span>17:44</span>Action taken: purifier moved to the play mat</div>
      </div>
    </div>
    ${foot("Dashboard: working design fed by the room model on our site; demonstration values", 8)}`]);
  SL.push(["Customers", "s-paper", `
    <div class="sl-k">08 · Customers and why now</div>
    <h2>Start where the risk is highest <em>and someone can act.</em></h2>
    <div class="sl-grid2">
      <ul class="sl-list">
        <li><i>01</i><span><b>Kindergartens</b> in Kraków: twenty children on the floor, one director deciding. Our beachhead.</span></li>
        <li><i>02</i><span><b>Care homes</b>: residents with lung disease indoors all day.</span></li>
        <li><i>03</i><span><b>Parents</b> of children with asthma: a home station and the phone app.</span></li>
        <li><i>04</i><span><b>City programmes</b>: co-fund pilots, receive anonymous indoor data.</span></li>
      </ul>
      <div><p class="sl-big">25 → 10</p><p class="sl-sub" style="font-size:19px;margin-top:14px">The EU limit for annual PM2.5 falls from 25 to 10 µg/m³ in 2030. Institutions will be asked what they did about the air inside.</p></div>
    </div>
    ${foot("Source: Directive (EU) 2024/2881", 9)}`]);
  SL.push(["Business model", "s-paper2", `
    <div class="sl-k">09 · Business model</div>
    <h2>Rent the robot, <em>refill the living sensor.</em></h2>
    <div class="sl-grid2">
      <ul class="sl-list">
        <li><i>A</i><span><b>Oddech Room</b>: robot as a service, one monthly fee.</span></li>
        <li><i>B</i><span><b>Living cartridges</b>: a fresh cartridge every week, recurring like capsules.</span></li>
        <li><i>C</i><span><b>Oddech Cloud</b>: dashboard per site, API for purifier makers.</span></li>
        <li><i>D</i><span><b>Lab reports</b>: filter samples confirmed in a partner lab.</span></li>
        <li><i>E</i><span><b>Cities</b>: paid pilots, anonymous statistics.</span></li>
      </ul>
      <div class="sl-nums" style="grid-template-columns:1fr 1fr;margin-top:0">
        ${ue ? `<div><b class="acc">${eur(ue.gm)}</b><span>gross margin per robot per month</span></div><div><b>${ue.pay.toFixed(1)}</b><span>months to pay back the robot</span></div>
        <div><b>${eur(ue.ltv)}</b><span>gross profit over 36 months</span></div><div><b>4</b><span>cartridges a month per room</span></div>` : ""}
      </div>
    </div>
    ${foot("Planning assumptions, not quotes: robot €1,100, fee €120, cartridge €25 made for half, service €20 a month", 10)}`]);
  SL.push(["Roadmap", "s-dark", `
    <div class="sl-k">10 · Roadmap, and what we do if we are wrong</div>
    <h2>From Kraków <em>to a first room.</em></h2>
    <div class="sl-tl">
      <div><i>14 Oct</i><b>Field visit, Kraków</b></div><div><i>16 Oct</i><b>Final presentation</b></div><div><i>27 Nov</i><b>Student Research Day, TUAT</b></div>
      <div><i>26 Feb 2027</i><b>Entre Challenge</b></div><div class="hot"><i>2027 · plan</i><b>Lab calibration, first pilot room</b></div>
    </div>
    <ul class="sl-list" style="margin-top:34px">
      <li><i>→</i><span>Rooms turn out evenly mixed: <b>Oddech Station</b>, a fixed living sensor with the cloud.</span></li>
      <li><i>→</i><span>Cells too fragile outside the lab: <b>bio-lab service</b>, the robot collects filters, a lab tests them.</span></li>
      <li><i>→</i><span>Institutions will not pay: <b>license</b> the robot's brain and cloud to purifier makers.</span></li>
    </ul>
    ${foot("Programme dates from the FL schedule; 2027 is our plan, not yet arranged", 11)}`]);
  SL.push(["Team and ask", "s-paper", `
    <div class="sl-k">11 · Team and our ask</div>
    <h2 style="font-size:46px">Physics, robotics, biology, communication. <em>Take one away and the chain breaks.</em></h2>
    <div class="sl-team">
      <div><i>Physics-informed AI</i><b>Julian Evan Chrisnanto</b><span>TUAT, Japan · room map, robot's choices, dose</span></div>
      <div><i>Physical AI and robotics</i><b>Antonio Galiza Cardeira Gonzales, Ph.D.</b><span>Body, mast, motion and safety</span></div>
      <div><i>RNA bioinformatics</i><b>Xiyue (Thea) Cao</b><span>TUAT, Japan · the Living Air Sensor</span></div>
      <div><i>Human–machine communication</i><b>Aleksandra Skrzypiec</b><span>Jagiellonian University · how Oddech speaks</span></div>
    </div>
    <div class="sl-ask"><span><b>1</b>A room for a 2027 pilot</span><span><b>2</b>A lab bench to calibrate the cells</span><span><b>3</b>Introductions: city, purifier makers</span><span><b>4</b>Your honest view</span></div>
    <p class="sl-thanks">Dziękujemy. Thank you. ありがとうございました。</p>
    ${foot("Oddech · FL Joint Programme 2026", 12)}`]);

  // ---------------------------------------------------------------- the frame: scale, navigate, full screen, print
  stage.innerHTML = SL.map(([t, cls, html], i) => `<section class="slide ${cls}" data-i="${i}" aria-label="Slide ${i + 1}: ${t}">${html}</section>`).join("");
  const slides = Array.from(stage.querySelectorAll(".slide")), N = slides.length;
  $("deckThumbs").innerHTML = SL.map(([t], i) => `<button data-i="${i}" title="${t}">${String(i + 1).padStart(2, "0")}</button>`).join("");
  let cur = 0;
  function show(i) {
    cur = (i + N) % N;
    slides.forEach((s, k) => s.classList.toggle("on", k === cur));
    $("deckThumbs").querySelectorAll("button").forEach((b, k) => b.classList.toggle("on", k === cur));
    $("deckCount").textContent = String(cur + 1).padStart(2, "0") + " / " + N + " · " + SL[cur][0];
  }
  function scale() {
    const w = deck.clientWidth, h = deck.clientHeight, s = Math.min(w / 1280, h / 720);
    stage.style.transform = `translate(${(w - 1280 * s) / 2}px, ${(h - 720 * s) / 2}px) scale(${s})`;
  }
  $("deckPrev").addEventListener("click", () => show(cur - 1));
  $("deckNext").addEventListener("click", () => show(cur + 1));
  $("deckThumbs").addEventListener("click", e => { const b = e.target.closest("[data-i]"); if (b) show(+b.dataset.i); });
  deck.addEventListener("click", e => { if (e.target.closest("a, button")) return; const r = deck.getBoundingClientRect(); show(cur + (e.clientX - r.left < r.width * 0.3 ? -1 : 1)); deck.focus({ preventScroll: true }); });
  deck.addEventListener("keydown", e => {
    if (["ArrowRight", "PageDown", " "].indexOf(e.key) >= 0) { e.preventDefault(); e.stopPropagation(); show(cur + 1); }
    else if (["ArrowLeft", "PageUp"].indexOf(e.key) >= 0) { e.preventDefault(); e.stopPropagation(); show(cur - 1); }
    else if (e.key === "Home") { e.preventDefault(); show(0); } else if (e.key === "End") { e.preventDefault(); show(N - 1); }
    else if (e.key === "Escape" && deck.classList.contains("deck-max")) { deck.classList.remove("deck-max"); scale(); }
  });
  $("deckFull").addEventListener("click", () => {
    const max = () => { deck.classList.toggle("deck-max"); scale(); deck.focus({ preventScroll: true }); };
    if (document.fullscreenElement) { document.exitFullscreen().catch(() => {}); return; }
    if (deck.classList.contains("deck-max") || !deck.requestFullscreen) { max(); return; }
    deck.requestFullscreen().then(() => deck.focus({ preventScroll: true })).catch(max);
  });
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
})();
