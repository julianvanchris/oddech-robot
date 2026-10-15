/* Section 15: the pitch deck. Sixteen 1280×720 slides, scaled to the frame; arrow keys, thumbnails, Present (full screen,
   key F) and print to PDF (one slide per page). One message per slide, in plain words; numbers only where they carry the
   point, and never with a minus sign. Pictures come from art.js (cells, the room, today's setups, the air loop, the
   cartridge loop, the QR code) and from the robot's 3D model (site/img), so the slides and the page show the same things.
   Slide changes morph: what two slides share (wordmark, kicker, title, footer, the robot) glides to its new place through
   the View Transitions API, then the slide's content enters in sequence. Without the API, or with Motion off, slides fade.
   Marks that call out a key point are CSS borders on the element itself, so print can never shift them onto other text.
   Numbers come from the page's own sources: the benchmarks and the example evening (bench.json, written by test_sim.js),
   the living-sensor model and the unit-economics function (sim.js). */
(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const deck = $("deck"), stage = $("deckStage"); if (!deck || !stage) return;
  const S = window.OddechSim, B = window.ODDECH_BENCH, CARE = B && B.care, EX = B && B.example, A = window.OddechArt;
  if (!A) return;
  const mono = 'font-family="JetBrains Mono, monospace"';
  const niceStep = (mx, n) => { const raw = mx / n, p = Math.pow(10, Math.floor(Math.log10(raw))); return [1, 2, 2.5, 5, 10].map(k => k * p).find(s => s >= raw); };
  const pct = v => Math.round(100 * v);
  const tErr = v => pct(Math.exp(v) - 1);                 // typical error, from the mean |error| of ln(PM2.5 + 2)
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  function words(v) {                                     // a share in words: 0.2 → "a fifth", 0.26 → "about a quarter"
    const F = [[1 / 2, "half"], [1 / 3, "a third"], [1 / 4, "a quarter"], [1 / 5, "a fifth"], [1 / 6, "a sixth"], [1 / 8, "an eighth"], [1 / 10, "a tenth"]];
    let best = F[0]; for (const f of F) if (Math.abs(f[0] - v) < Math.abs(best[0] - v)) best = f;
    return (Math.abs(best[0] - v) > 0.012 ? "about " : "") + best[1];
  }
  const PLAN = { hw: 1100, fee: 120, cart: 4, pc: 25, svc: 20, life: 36 };   // the business section's default inputs: planning assumptions, not quotes
  const ue = S && S.unitEconomics ? S.unitEconomics(PLAN) : null;

  // ---------------------------------------------------------------- charts and pictures made from the model's own numbers
  const RUN = (m, tox) => { const L = new S.LivingSensor(3), out = [0]; for (let i = 0; i < 36; i++) out.push(L.cycle(m, m * tox, i * 600).index); return out; };
  const BIO = S && S.LivingSensor ? { smoke: RUN(70, 1.4), cook: RUN(70, 0.7), clean: RUN(8, 1.0) } : null;
  function bioCurves() {                                  // cell stress over six hours: same dust mass, three kinds of air
    if (!BIO) return "";
    const sets = [["smoke-like dust", BIO.smoke, "#D9875C", 3], ["cooking fumes", BIO.cook, "#E8B48F", 2], ["clean room", BIO.clean, "#7E98BC", 2]];
    const W = 440, H = 292, x0 = 40, x1 = W - 130, y0 = H - 34, y1 = 14, X = n => x0 + (x1 - x0) * n / 36, Y = v => y0 - (y0 - y1) * v / 100;
    let s = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true"><g ${mono} font-size="12" fill="#9C958A">`;
    for (const v of [0, 50, 100]) s += `<line x1="${x0}" x2="${x1}" y1="${Y(v)}" y2="${Y(v)}" stroke="rgba(237,232,223,.1)"/><text x="${x0 - 8}" y="${Y(v) + 4}" text-anchor="end">${v}</text>`;
    for (const h of [0, 2, 4, 6]) s += `<text x="${X(h * 6)}" y="${y0 + 20}" text-anchor="middle">${h} h</text>`;
    s += `<text x="${x0 + 6}" y="${y1 + 12}">cell stress</text>`;
    sets.forEach(([name, v, c, w]) => {
      s += `<path class="draw" pathLength="1" d="${v.map((y, n) => (n ? "L" : "M") + X(n).toFixed(1) + " " + Y(y).toFixed(1)).join(" ")}" fill="none" stroke="${c}" stroke-width="${w}"/>`;
      s += `<text x="${x1 + 8}" y="${Y(v[36]) + 4}" fill="${c}">${name}</text>`;
    });
    return s + `</g></svg>`;
  }
  function evening() {                                    // the example evening: the child's air with the purifier left alone, and with Oddech
    const W = 680, H = 410, x0 = 46, x1 = W - 150, y0 = H - 30, y1 = 74, T = EX.minutes * 60, cv = EX.curve;
    let mx = 20; for (const r of cv) mx = Math.max(mx, r[1], r[2]);
    const st = niceStep(mx, 4), yMax = Math.ceil(mx / st) * st, X = t => x0 + (x1 - x0) * t / T, Y = v => y0 - (y0 - y1) * v / yMax;
    const line = (k, c, w) => `<path class="draw" pathLength="1" d="${cv.filter(r => r[k] !== null).map((r, i) => (i ? "L" : "M") + X(r[0]).toFixed(1) + " " + Y(r[k]).toFixed(1)).join(" ")}" fill="none" stroke="${c}" stroke-width="${w}"/>`;
    let s = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true"><g ${mono} font-size="12" fill="#9C958A">`;
    for (let v = 0; v <= yMax + 1e-9; v += st) s += `<line x1="${x0}" x2="${x1}" y1="${Y(v)}" y2="${Y(v)}" stroke="rgba(237,232,223,.09)"/><text x="${x0 - 8}" y="${Y(v) + 4}" text-anchor="end">${v}</text>`;
    for (let m = 0; m <= EX.minutes; m += 10) s += `<text x="${X(m * 60)}" y="${y0 + 20}" text-anchor="middle">${m} min</text>`;
    s += `<text x="${x0 - 30}" y="14">dust where the child breathes, µg/m³</text>`;
    EX.actions.forEach(([t], i) => { const x = X(t).toFixed(1); s += `<line x1="${x}" x2="${x}" y1="${y1 - 26}" y2="${y0}" stroke="rgba(237,232,223,.18)"/><circle class="pop" cx="${x}" cy="${y1 - 34}" r="10" fill="#D9875C"/><text x="${x}" y="${y1 - 30}" text-anchor="middle" fill="#0F0E0C" font-weight="700">${i + 1}</text>`; });
    s += line(2, "#8A847A", 2.4) + line(1, "#D9875C", 3.6);
    const end = cv[cv.length - 1];
    s += `<g font-size="13"><text x="${x1 + 10}" y="${Y(end[2]) + 4}" fill="#CFC8BC">purifier left</text><text x="${x1 + 10}" y="${Y(end[2]) + 20}" fill="#CFC8BC">in its corner</text>`;
    s += `<text x="${x1 + 10}" y="${Y(end[1]) + 4}" fill="#D9875C" font-weight="600">with Oddech</text></g>`;
    return s + `</g></svg>`;
  }
  const actPhrase = t => t.replace(/^Oddech switched the purifier on$/, "Switches the purifier on").replace(/^The purifier was turned to high$/, "Turns it up to high")
    .replace(/^The purifier was moved towards (.*)$/, "Has it moved towards $1").replace(/^The window was opened.*$/, "Says when to open the window").replace(/^The window was closed$/, "Says when to close the window");
  function vsArt() {                                      // four fixed sensors against three fixed sensors and Oddech, with their error where people breathe
    const eF = tErr(B.median.fixed4_people), eO = tErr(B.median.oddech_people), W = 580, H = 420;
    const room = (x0, robot) => {
      let s = `<rect x="${x0}" y="10" width="270" height="240" rx="3" fill="rgba(31,29,26,.04)" stroke="#4A4640" stroke-width="1.2"/>`;
      s += `<circle cx="${x0 + 92}" cy="148" r="58" fill="rgba(180,83,42,.16)"/><circle cx="${x0 + 84}" cy="154" r="4.5" fill="#B4532A"/>`;
      const sq = (x, y) => `<rect x="${x - 8}" y="${y - 8}" width="16" height="16" rx="2" fill="#EFEBE3" stroke="#2E4A6E" stroke-width="1.6"/>`;
      s += sq(x0 + 20, 30) + sq(x0 + 250, 30) + sq(x0 + 250, 230) + (robot ? "" : sq(x0 + 20, 230));
      s += `<circle cx="${x0 + 126}" cy="160" r="${robot ? 20 : 54}" fill="none" stroke="${robot ? "#B4532A" : "#8A847A"}" stroke-width="1.8" stroke-dasharray="4 4"/>`;
      s += `<circle cx="${x0 + 126}" cy="160" r="9" fill="#EFEBE3" stroke="#1F1D1A" stroke-width="1.5"/>`;
      if (robot) s += `<path d="M${x0 + 32} 226 C${x0 + 72} 230 ${x0 + 92} 176 ${x0 + 114} 170" fill="none" stroke="#B4532A" stroke-width="2" stroke-dasharray="5 4"/><circle cx="${x0 + 32}" cy="226" r="9" fill="#B4532A"/>`;
      return s;
    };
    let s = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true">` + room(10, false) + room(300, true);
    s += `<g ${mono} font-size="13"><text x="10" y="274" fill="#1F1D1A">Four fixed sensors</text><text x="300" y="274" fill="#B4532A">Three fixed + Oddech</text></g>`;
    s += `<g ${mono} font-size="11" fill="#8A847A"><text x="10" y="292">dashed ring: how unsure each is about the child's air</text></g>`;
    s += `<text x="10" y="338" font-family="Inter Tight, sans-serif" font-size="14" fill="#4A4640">Typical error in the air people breathe</text>`;
    const bar = (y, v, c, label) => `<rect x="10" y="${y}" width="${(380 * v / eF).toFixed(1)}" height="18" fill="${c}"/><text x="${(20 + 380 * v / eF).toFixed(1)}" y="${y + 14}" ${mono} font-size="13" fill="${c}">${v} % · ${label}</text>`;
    s += bar(352, eF, "#8A847A", "four fixed") + bar(384, eO, "#B4532A", "with Oddech");
    return s + `</svg>`;
  }
  function archArt() {                                    // the data path from section 07, at slide size
    const src = $("archSvg"); if (!src) return "";
    return `<svg viewBox="0 40 1200 240" width="960" height="192" aria-hidden="true">${src.innerHTML.replace(/id="(u1|d1|d2|d3)"/g, 'id="dk-$1"').replace(/href="#(u1|d1|d2|d3)"/g, 'href="#dk-$1"').replace(/begin="([\d.]+)s"/g, (m, t) => `begin="-${t}s"`)}</svg>`;
  }
  // where the parts are in robot_hero.webp (fractions of its width and height), from the render that made it
  const HERO = { w: 582, h: 1200, head: [0.33, 0.008], mast: [0.282, 0.37], ring: [0.27, 0.708], bio: [0.354, 0.77], vent: [0.156, 0.818], lidar: [0.335, 0.868] };
  function robotCallouts() {
    const H = 452, Wd = H * HERO.w / HERO.h, L = 300, T = 0;           // image box inside the 640 × 460 panel
    const parts = [["head", "Nose", "breathes at 0.4, 1.1 or 1.6 m"], ["mast", "Telescoping mast", "rises only when it stands still"], ["ring", "Light ring and voice", "tells you, in plain words"],
      ["bio", "Living Air Sensor", "airway cells, read every 10 minutes"], ["vent", "HEPA + carbon", "exhales cleaner air"], ["lidar", "Laser scanner", "finds its way; no camera"]];
    let lines = "", labels = "";
    parts.forEach(([k, b, t], i) => {
      const px = L + HERO[k][0] * Wd, py = T + HERO[k][1] * H + (k === "head" ? 18 : 0), ly = 20 + i * 78;
      lines += `<path d="M262 ${ly + 12} L${(px - 18).toFixed(1)} ${ly + 12} L${px.toFixed(1)} ${py.toFixed(1)}" fill="none" stroke="rgba(237,232,223,.38)"/><circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="3.5" fill="#D9875C"/>`;
      labels += `<div class="sl-callout" style="top:${ly}px"><b>${b}</b><span>${t}</span></div>`;
    });
    return `<div class="sl-robotbox"><div class="sl-robotimg" data-m="robot" style="left:${L}px;top:${T}px;height:${H}px;width:${Wd.toFixed(1)}px">${A.img("robot_hero", "Oddech, rendered from its 3D model", `height:${H}px;width:${Wd.toFixed(1)}px`)}</div>
      <svg class="sl-leads" viewBox="0 0 640 460" width="640" height="460" aria-hidden="true">${lines}</svg>${labels}</div>`;
  }

  // ---------------------------------------------------------------- the slides
  const head = k => `<div class="sl-k" data-m="k">${k}</div><div class="sl-brand"><span class="hug" data-m="brand">Oddech</span></div>`;
  const foot = left => `<div class="sl-foot" data-m="foot"><span>${left}</span><span class="sl-pg"></span></div>`;
  const ok = B && CARE && EX && S;
  const SL = [];
  SL.push(["Title", "s-dark", `
    <div class="sl-k" data-m="k">FL Joint Programme · Kraków · 16 October 2026</div>
    <h2 class="sl-title"><span class="hug" data-m="brand">Oddech</span></h2>
    <p class="sl-lede">A robot that breathes the room with you.</p>
    <p class="sl-sub" style="max-width:640px">Living airway cells tell it <b>how harmful</b> the air is, its map tells it <b>where</b>, and it tells you <b>what to do</b>.</p>
    <p class="sl-sub sl-names">Julian Evan Chrisnanto · Antonio Galiza Cerdeira Gonzalez · Xiyue (Thea) Cao · Aleksandra Skrzypiec</p>
    <div class="sl-hero" data-m="robot">${A.img("robot_hero", "Oddech, rendered from its 3D model", "height:590px")}</div>
    ${foot("Oddech, Polish for “breath” · rendered from the robot's 3D model")}`]);
  SL.push(["Problem", "s-paper", `${head("01 · The problem")}
    <h2 data-m="t" style="font-size:54px">Kraków's smog comes indoors. <em>The shelf monitor misses the child.</em></h2>
    <div class="sl-split">
      <div class="sl-pic">${A.room(false)}</div>
      <ul class="sl-facts">
        <li><b>87 %</b><span>of our time is spent indoors, with one monitor on a shelf.</span></li>
        <li><b>6 to 20 ×</b><span>dirtier air right next to a source than in a well-mixed room.</span></li>
        <li><b>Not yet</b><span>Kraków's ban on coal heating cleaned the air, but the EU limit is still not met.</span></li>
      </ul>
    </div>
    ${foot("Sources: Klepeis et al. 2001; Acevedo-Bolton et al. 2011; Kicińska & Jawdyńska 2025")}`]);
  SL.push(["Today's answers", "s-paper2", `${head("02 · What rooms have today")}
    <h2 data-m="t" style="font-size:54px">More devices, more numbers. <em>Still nobody asks the body.</em></h2>
    <div class="sl-setups">${A.setups(false)}</div>
    <p class="sl-take">Every setup adds devices. <em>None says how harmful the air is where the child breathes.</em></p>
    ${foot("Our assessment · units drift apart: Castell et al. 2017 · purifier robot: Ecovacs AIRBOT Z1")}`]);
  SL.push(["The solution", "s-dark", `${head("03 · The solution")}
    <h2 data-m="t" style="font-size:54px">Oddech: one robot that <em>breathes the room with you.</em></h2>
    <div class="sl-sol">
      ${robotCallouts()}
      <div class="sl-verbs">
        <div><i>01</i><b>Breathe</b><span>at the child's, a seated and a standing height</span></div>
        <div class="hot"><i>02</i><b>Feel</b><span>living airway cells glow when the air harms them</span></div>
        <div><i>03</i><b>Map</b><span>a live map of the room, and where it is unsure</span></div>
        <div><i>04</i><b>Tell</b><span>plain words: what, where, how sure, what to do</span></div>
        <div><i>05</i><b>Act</b><span>the purifier, the window, the phone</span></div>
      </div>
    </div>
    ${foot("Design targets for a robot not yet built · 3D model from our Gazebo package")}`]);
  SL.push(["How it breathes", "s-dark", `${head("04 · How it breathes")}
    <h2 data-m="t">Every ten minutes, <em>one breath.</em></h2>
    <div class="sl-loop">${A.airLoop(true, { caption: false })}</div>
    <div class="sl-notes4">
      <div><b>Warm and moist</b><span>37 °C and 85–90 % RH: the conditions a mobile field system keeps its cells in.</span></div>
      <div><b>Dry air harms too</b><span>Low humidity alone hurts airway cells, so the bay controls it.</span></div>
      <div><b>Fair controls</b><span>The control wells breathe the robot's own clean, conditioned air.</span></div>
      <div><b>Nothing living leaves</b><span>The cartridge has its own filter; HEPA and carbon clean the rest.</span></div>
    </div>
    ${foot("Sources: Juárez-Facio et al. 2024; Chidekel et al. 2012 · the air path is our design, under test")}`]);
  SL.push(["Living Air Sensor", "s-dark", `${head("05 · Our unique point · the Living Air Sensor")}
    <h2 data-m="t" style="font-size:52px">Living airway cells <em>feel what a dust counter cannot.</em></h2>
    <div class="sl-cellrow">
      <div class="sl-cellpic">${A.cells(true)}</div>
      <div>${bioCurves()}<p class="sl-cap2">Same dust mass, different harm. The readout is simple: exposed wells over controls, where <b>1.0×</b> means clean air.</p></div>
    </div>
    <p class="sl-take">Every air monitor weighs the dust. <em>Oddech asks living cells how much it hurts.</em></p>
    ${foot("Concept model after X. Cao, no experimental data · cells at the air-liquid interface: Upadhyay & Palmberg 2018")}`]);
  const reads = 7 * 24 * 6, centsRead = 100 * PLAN.pc / reads, childDay = 100 * (PLAN.fee + PLAN.cart * PLAN.pc) / 30.4 / 20;   // a room of twenty children
  SL.push(["Minutes and cents", "s-dark", `${head("06 · How fast, and at what price")}
    <h2 data-m="t">Read in minutes, <em>for cents a reading.</em></h2>
    <div class="sl-ladder2">${A.timeLadder(true)}</div>
    <div class="sl-notes4">
      <div><b>Within minutes</b><span>In lab studies, airway cells react to particles within minutes, far faster than classic toxicity tests.</span></div>
      <div><b>Read alive</b><span>Live-cell readouts follow stress in real time; classic lab tests use the cells up.</span></div>
      <div><b>About ${centsRead.toFixed(1)} cents a reading</b><span>One €${PLAN.pc} cartridge gives about 1,000 readings a week.</span></div>
      <div><b>About ${Math.round(childDay)} cents a child a day</b><span>A room of twenty, with the robot and a fresh cartridge every week.</span></div>
    </div>
    ${foot("Sources: Milici 2021; Corteselli 2018; Puthussery 2018; Huang 2021 · prices: planning assumptions, not quotes")}`]);
  if (ok) {
    const all = CARE.wins.corner === CARE.seeds;
    SL.push(["What changes", "s-dark", `${head("07 · What changes for the child · in our room model")}
      <h2 data-m="t" style="font-size:52px">Same flat, same purifier: <em>the child breathes ${words(CARE.median.cutCorner)} less dust.</em></h2>
      <div class="sl-eve2">
        <div class="sl-evechart">${evening()}</div>
        <div class="sl-acts">
          <i>What Oddech did, one evening</i>
          <ol>${EX.actions.map(([, a]) => `<li>${actPhrase(a)}</li>`).join("")}</ol>
          <p class="sl-take2">${all ? "Lower for the child in every model room we tried." : `Lower for the child in most model rooms we tried.`}</p>
        </div>
      </div>
      ${foot("Room model with random sources, windows and purifiers; the family acts on the advice after 90 s · the method, not field evidence")}`]);
    const r = Math.exp(B.median.oddech_people) - 1, f = Math.exp(B.median.fixed4_people) - 1, less = r / f < 0.5 ? "less than half the error" : `${words(1 - r / f)} less error`;
    SL.push(["One robot, not more sensors", "s-paper", `${head("08 · Why one robot, not more sensors")}
      <h2 data-m="t" style="font-size:52px">One robot that moves <em>beats four sensors that stay put.</em></h2>
      <div class="sl-vs">
        <div class="sl-vspics">${vsArt()}</div>
        <ul class="sl-why">
          <li><b>${cap(less)}</b><span>in the air people breathe, in ${B.wins.people_vs_fixed === B.seeds ? "every" : "most"} model room${B.wins.people_vs_fixed === B.seeds ? "" : "s"}.</span></li>
          <li><b>It chooses where to go</b><span>It also beats a robot that wanders at random: the gain is in the choosing.</span></li>
          <li><b>Living cells cannot sit in every corner</b><span>They need 37 °C, moist air and a fresh cartridge each week. One robot carries one cartridge everywhere.</span></li>
          <li><b>One device to look after</b><span>It works with the purifier you already have.</span></li>
        </ul>
      </div>
      ${foot("Room model, minutes 5 to 20: three fixed sensors and Oddech against four fixed sensors · the method, not field evidence")}`]);
    SL.push(["For every user", "s-paper", `${head("09 · The product · robot at the edge, every room in the cloud")}
      <h2 data-m="t" style="font-size:52px">Each user gets <em>what they can act on.</em></h2>
      <div class="sl-arch">${archArt()}</div>
      <div class="sl-users">
        <div class="sl-user"><i>Staff and director · every room, live</i>
          <div class="sl-dash mini">
            <div class="sl-dash-tiles"><div><span>Children's air</span><b>42</b><em>likely 31–58</em></div><div><span>Living sensor</span><b style="color:#f0965a">1.4×</b><em>smoke-like</em></div><div><span>Purifier</span><b>high</b><em>auto</em></div></div>
            <div class="sl-dash-alert"><span>17:44</span>Bears room: purifier moved to the play mat</div>
          </div></div>
        <div class="sl-user"><i>Parents · on the phone</i>
          <div class="sl-phone"><em>ODDECH · now</em>${EX.advice}</div></div>
        <div class="sl-user"><i>City programme · every month</i><b>Anonymous, consented trends</b>
          <span>Which rooms breathe worst on smog evenings, district by district: where to fund purifiers, boiler swaps and pilots.</span></div>
      </div>
      ${foot("Phone message: Oddech's own words from the model evening · dashboard: working design on our site, demonstration values")}`]);
  }
  SL.push(["Customers", "s-paper", `${head("10 · Customers and why now")}
    <h2 data-m="t" style="font-size:52px">Start where the risk is highest <em>and someone can act.</em></h2>
    <div class="sl-grid2">
      <ul class="sl-list">
        <li><i>01</i><span><b>Kindergartens</b> in Kraków: twenty children on the floor, one director deciding. Our first market.</span></li>
        <li><i>02</i><span><b>Care homes</b>: residents with lung disease, indoors all day.</span></li>
        <li><i>03</i><span><b>Parents</b> of children with asthma: a home station and the phone app.</span></li>
        <li><i>04</i><span><b>City programmes</b>: co-fund pilots, receive anonymous indoor data.</span></li>
      </ul>
      <div><p class="sl-big"><span class="pill">25 → 10</span></p><p class="sl-sub" style="font-size:18px;margin-top:18px">The EU limit for annual PM2.5 falls from 25 to 10 µg/m³ in 2030. Institutions will be asked what they did about the air inside.</p>
        <dl class="sl-roles"><dt>Pays</dt><dd>the kindergarten: one monthly fee per room</dd><dt>Uses</dt><dd>staff and the director: live dashboard, alerts with an action</dd>
          <dt>Hears</dt><dd>parents: phone alerts and a monthly air report</dd><dt>Gains</dt><dd>the children: cleaner air where they breathe</dd></dl></div>
    </div>
    ${foot("Source: Directive (EU) 2024/2881")}`]);
  SL.push(["Business model", "s-paper2", `${head("11 · Business model")}
    <h2 data-m="t">Rent the robot, <em>refill the living sensor.</em></h2>
    <div class="sl-biz">
      <div class="sl-bizloop">${A.cartridgeLoop(false)}</div>
      <div>
        <ul class="sl-list">
          <li><i>A</i><span><b>Oddech Room</b>: the robot as a service, one monthly fee per room.</span></li>
          <li><i>B</i><span><b>Living cartridges</b>: a fresh one every week, returned like capsules.</span></li>
          <li><i>C</i><span><b>Oddech Cloud</b>: a dashboard per site, an API for purifier makers.</span></li>
          <li><i>D</i><span><b>Lab reports</b>: filter samples confirmed by a partner lab.</span></li>
        </ul>
        ${ue && isFinite(ue.pay) ? `<p class="sl-pay"><span class="pill">about ${Math.round(ue.pay)} months</span> to pay back a robot</p>` : ""}
      </div>
    </div>
    ${foot("Planning assumptions, not quotes · used cartridges handled as laboratory waste: WHO Laboratory Biosafety Manual 2020")}`]);
  SL.push(["Risks", "s-dark", `${head("12 · Risks, and what we do about them")}
    <h2 data-m="t">What could go wrong, <em>and our answer.</em></h2>
    <table class="sl-risk"><tbody>
      <tr><th>Cells drift or tire</th><td>Controls, a lamp reference and a blank in every cartridge; a fresh cartridge each week.</td></tr>
      <tr><th>Heat, dry air, condensation</th><td>A 37 °C bay, sample air kept moist, heated lines; a reading counts only if both stayed in range.</td></tr>
      <tr><th>Biological waste</th><td>A sealed cartridge with its own filter, sent back in its pouch and made safe by the partner lab.</td></tr>
      <tr><th>Safety around children</th><td>Slow near people, mast down while it drives, a soft bumper, no camera.</td></tr>
      <tr><th>Trust</th><td>Every message says how sure it is; the wording is tested with people before a pilot.</td></tr>
    </tbody></table>
    <div class="sl-planb"><i>Plan B</i><span>Rooms evenly mixed: <b>Oddech Station</b>, a fixed living sensor.</span><span>Cells too fragile: the robot <b>collects filters</b> for a lab.</span><span>No one pays: <b>license</b> the robot's brain to purifier makers.</span></div>
    ${foot("Sources: Juárez-Facio et al. 2024; Chidekel et al. 2012; WHO Laboratory Biosafety Manual 2020")}`]);
  SL.push(["Roadmap", "s-dark", `${head("13 · Roadmap")}
    <h2 data-m="t">From Kraków <em>to a first room.</em></h2>
    <div class="sl-tl">
      <div><i>14 Oct</i><b>Field visit, Kraków</b></div><div><i>16 Oct</i><b>Final presentation</b></div><div><i>27 Nov</i><b>Student Research Day, TUAT</b></div>
      <div><i>26 Feb 2027</i><b>Entre Challenge</b></div><div class="hot"><i>2027 · plan</i><b>Lab calibration, first pilot room</b></div>
    </div>
    <ol class="sl-ladder"><li class="done"><b>Simulation</b><span>a known truth; this site</span></li><li><b>Lab and chamber</b><span>calibrate the cells; a sealed room</span></li><li><b>One real room</b><span>a kindergarten, with consent</span></li><li><b>Pilot</b><span>several rooms, one smog season</span></li></ol>
    ${foot("Programme dates from the FL schedule; 2027 is our plan, not yet arranged")}`]);
  SL.push(["Team and ask", "s-paper", `${head("14 · Team and our ask")}
    <h2 data-m="t" style="font-size:46px">Physics, robotics, biology, communication. <em>Take one away and the chain breaks.</em></h2>
    <div class="sl-team">
      <div><i>Physics-informed AI</i><b>Julian Evan Chrisnanto</b><span>TUAT, Japan · room map, robot's choices, dose</span></div>
      <div><i>Physical AI and robotics</i><b>Antonio Galiza Cerdeira Gonzalez, Ph.D.</b><span>Body, mast, motion and safety</span></div>
      <div><i>RNA bioinformatics</i><b>Xiyue (Thea) Cao</b><span>TUAT, Japan · the Living Air Sensor</span></div>
      <div><i>Human–machine communication</i><b>Aleksandra Skrzypiec</b><span>Jagiellonian University · how Oddech speaks</span></div>
    </div>
    <div class="sl-ask"><span class="pill-box"><b>1</b>A room for a 2027 pilot</span><span><b>2</b>A lab bench to calibrate the cells</span><span><b>3</b>Introductions: city, purifier makers</span><span><b>4</b>Your honest view</span></div>
    <p class="sl-thanks">Dziękujemy. Thank you. ありがとうございました。</p>
    ${foot("Oddech · FL Joint Programme 2026")}`]);
  const Q = window.ODDECH_QR, host = Q ? Q.url.replace(/^https?:\/\//, "").replace(/\/$/, "") : "";
  SL.push(["Live demonstration", "s-dark", `${head("15 · Live demonstration")}
    <h2 data-m="t">Open the loop, <em>run it yourself.</em></h2>
    <div class="sl-live">
      <div>
        <div class="sl-k2">Demo link</div>
        <p class="sl-url"><span class="pill">${host}</span></p>
        <p class="sl-urlfull">${Q ? Q.url : ""}</p>
        <p class="sl-sub" style="font-size:19px;max-width:560px">Open the link, or scan the code with your phone: the room model, the living sensor, the 3D blueprint and the Gazebo twin.</p>
      </div>
      <div class="sl-qr">${A.qr(true, 250)}<span>scan to open</span></div>
    </div>
    <p class="sl-take">Not a stronger purifier: <em>knowing the air where the child breathes, and acting on it.</em></p>
    ${foot("Demonstration of the model: the method, not field evidence")}`]);

  // ---------------------------------------------------------------- build the frame
  const N = SL.length;
  stage.innerHTML = SL.map(([t, cls, html], i) => `<section class="slide ${cls}" data-i="${i}" aria-label="Slide ${i + 1}: ${t}">${html}</section>`).join("");
  const slides = Array.from(stage.querySelectorAll(".slide")), thumbs = $("deckThumbs"), prog = $("deckProg");
  slides.forEach((s, i) => { const pg = s.querySelector(".sl-pg"); if (pg) pg.textContent = `ODDECH · ${String(i + 1).padStart(2, "0")} / ${N}`; });
  thumbs.innerHTML = SL.map(([t], i) => `<button data-i="${i}" title="${t}">${String(i + 1).padStart(2, "0")}</button>`).join("");
  thumbs.style.setProperty("--n", N);
  deck.setAttribute("aria-label", `Pitch deck, ${N} slides`);

  // entrances: content rises in reading order; curves draw, dots pop; what morphs is left to the morph
  const SEQ = ".sl-lede, .sl-sub, .sl-facts li, .sl-pic, .art-setup, .sl-callout, .sl-verbs > div, .sl-loop, .sl-notes4 > div, .sl-cellrow > div, .sl-acts li, .sl-take2, .sl-vspics, .sl-why li, .sl-list li, .sl-risk tr, .sl-planb, .sl-team > div, .sl-ask > span, .sl-tl > div, .sl-ladder li, .sl-thanks, .sl-take, .sl-roles, .sl-big, .sl-user, .sl-arch, .sl-bizloop, .sl-pay, .sl-qr, .sl-url";
  slides.forEach(s => {
    let i = 0;
    s.querySelectorAll(SEQ).forEach(el => { if (el.closest("[data-m]") || el.querySelector("[data-m]")) return; el.classList.add("sl-in"); el.style.animationDelay = (240 + 70 * i++) + "ms"; });
    s.querySelectorAll(".draw").forEach((el, k) => { el.style.animationDelay = (420 + 180 * k) + "ms"; });
    s.querySelectorAll(".pop").forEach((el, k) => { el.style.animationDelay = (560 + 90 * k) + "ms"; });
  });
  function play(s) {
    slides.forEach(x => x.classList.remove("play"));
    void s.offsetWidth;                                   // restart the CSS animations
    s.classList.add("play");
  }

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
    if (!VT || !motion || document.body.classList.contains("print-deck")) { show(next); play(to); return; }
    const my = ++seq, root = document.documentElement;
    root.dataset.deckDir = next > cur ? "fwd" : "back";
    root.classList.add("deck-vt"); name(from, true);
    let t;
    try { t = document.startViewTransition(() => { name(from, false); show(next); name(to, true); play(to); }); }
    catch (e) { name(from, false); root.classList.remove("deck-vt"); show(next); play(to); return; }
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
  function printDeck() {                                   // print mode: every slide on its own 1280 × 720 page
    document.body.classList.add("print-deck");
    const done = () => { document.body.classList.remove("print-deck"); window.removeEventListener("afterprint", done); };
    window.addEventListener("afterprint", done);
    setTimeout(() => { try { window.print(); } catch (e) { done(); } }, 60);
  }
  $("deckPrint").addEventListener("click", printDeck);
  if (/print-deck/.test(location.hash)) document.body.classList.add("print-deck");   // for a headless PDF export of the deck alone
  window.addEventListener("resize", scale);
  new ResizeObserver(scale).observe(deck);
  show(0); scale();
  let seen = false;                                        // the title enters when the deck first comes into view
  new IntersectionObserver(es => { if (es[0].isIntersecting && !seen) { seen = true; play(slides[cur]); } }, { threshold: 0.35 }).observe(deck);
})();
