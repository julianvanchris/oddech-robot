/* Page glue: loader, citations and the reference list, navigation and presentation mode, reveals, cursor,
   the valley schematic, the yardstick bars, the robot viewer and its calculators, the platform matrix, the market map,
   unit economics, and the H1 benchmark (precomputed, and re-runnable in a worker). */
(function () {
  "use strict";
  const $ = id => document.getElementById(id), $$ = s => Array.from(document.querySelectorAll(s));
  const REFS = window.ODDECH_REFS || [], BENCH = window.ODDECH_BENCH || null;

  // ---------------------------------------------------------------- loader
  function ready() { $("loader").classList.add("done"); document.body.classList.add("ready"); }
  if (document.readyState === "complete") setTimeout(ready, 400); else window.addEventListener("load", () => setTimeout(ready, 400));
  setTimeout(ready, 2600);

  // ---------------------------------------------------------------- citations: numbered by first appearance, linked to the list
  const byKey = {}; REFS.forEach(r => { byKey[r.key] = r; });
  const order = [];
  $$("a.c").forEach(a => (a.dataset.ref || "").split(",").map(s => s.trim()).forEach(k => { if (byKey[k] && order.indexOf(k) < 0) order.push(k); }));
  REFS.forEach(r => { if (order.indexOf(r.key) < 0) order.push(r.key); });
  const num = {}; order.forEach((k, i) => { num[k] = i + 1; });
  $$("a.c").forEach(a => {
    const keys = (a.dataset.ref || "").split(",").map(s => s.trim()).filter(k => byKey[k]);
    if (!keys.length) return;
    a.textContent = "[" + keys.map(k => num[k]).join(", ") + "]";
    a.href = "#ref-" + keys[0];
    a.title = keys.map(k => byKey[k].short).join("; ");
    a.addEventListener("click", e => {
      e.preventDefault(); const li = $("ref-" + keys[0]); if (!li) return;
      li.scrollIntoView({ behavior: "smooth", block: "center" }); li.classList.add("flash"); setTimeout(() => li.classList.remove("flash"), 2200);
    });
  });
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  $("refList").innerHTML = order.map(k => {
    const r = byKey[k], link = r.doi ? `<a href="https://doi.org/${esc(r.doi)}" target="_blank" rel="noopener">doi:${esc(r.doi)}</a>`
      : `<a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.url)}</a> (accessed ${esc(r.accessed)})`;
    return `<li id="ref-${esc(k)}">${esc(r.entry)} ${link}</li>`;
  }).join("");

  // ---------------------------------------------------------------- navigation, progress, side index, presentation mode
  // In-page links. Inside Streamlit the page is an iframe srcdoc, whose base URL is the parent app: a plain "#id" link would
  // load the app again inside the frame (the page looked as if it reset). Every "#..." link scrolls instead.
  document.addEventListener("click", e => {
    const a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    const id = decodeURIComponent(a.getAttribute("href").slice(1)), el = id ? document.getElementById(id) : null;
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); else if (!id) window.scrollTo({ top: 0, behavior: "smooth" });
  });
  const sections = $$("main > section"), idx = $("sideIndex");
  idx.innerHTML = sections.map(s => `<a href="#${s.id}" data-id="${s.id}"><span>${s.dataset.title}</span><i></i></a>`).join("");
  let current = 0;
  function mark() {
    const id = sections[current].id;
    $$("#sideIndex a").forEach(a => a.classList.toggle("on", a.dataset.id === id));
    $$(".topnav a").forEach(a => a.classList.toggle("on", a.getAttribute("href") === "#" + id));
    $("slideCount").textContent = String(current + 1).padStart(2, "0") + " / " + String(sections.length).padStart(2, "0") + " · " + sections[current].dataset.title;
  }
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { current = sections.indexOf(e.target); mark(); } }), { rootMargin: "-45% 0px -50% 0px" });
  sections.forEach(s => io.observe(s)); mark();
  const bar = $("progress");
  function onScroll() { const h = document.documentElement.scrollHeight - window.innerHeight; bar.style.transform = "scaleX(" + (h > 0 ? window.scrollY / h : 0) + ")"; }
  window.addEventListener("scroll", onScroll, { passive: true }); onScroll();
  function go(i) { current = Math.max(0, Math.min(sections.length - 1, i)); sections[current].scrollIntoView({ behavior: "smooth" }); mark(); }
  function togglePresent(on) {
    const el = document.documentElement, v = on === undefined ? !el.classList.contains("present") : on;
    el.classList.toggle("present", v); $("presentBtn").classList.toggle("on", v);
  }
  $("presentBtn").addEventListener("click", () => togglePresent());
  window.addEventListener("keydown", e => {
    const tag = (e.target.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === "p" || e.key === "P") { togglePresent(); return; }
    if (e.key === "f" || e.key === "F") {
      const d = document.documentElement;
      if (!document.fullscreenElement && d.requestFullscreen) d.requestFullscreen().catch(() => {}); else if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
      return;
    }
    if (!document.documentElement.classList.contains("present")) return;
    if (["ArrowRight", "ArrowDown", "PageDown", " "].indexOf(e.key) >= 0) { e.preventDefault(); go(current + 1); }
    if (["ArrowLeft", "ArrowUp", "PageUp"].indexOf(e.key) >= 0) { e.preventDefault(); go(current - 1); }
  });

  // ---------------------------------------------------------------- reveals, the yardstick bars, the benchmark bars
  const growBars = root => root.querySelectorAll(".bar i").forEach(i => { i.style.width = i.dataset.w; });
  const rio = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    e.target.classList.add("in"); rio.unobserve(e.target);
    if (e.target.querySelector("#ladder")) $$(".lad").forEach(l => { l.querySelector("i").style.width = Math.min(100, +l.dataset.v / 35 * 100) + "%"; });
    growBars(e.target);
  }), { threshold: 0.12 });
  $$("[data-reveal]").forEach(el => rio.observe(el));

  // ---------------------------------------------------------------- cursor and magnetic buttons (fine pointers only)
  if (window.matchMedia("(pointer: fine)").matches) {
    const cur = $("cursor"); let x = -100, y = -100, cx = -100, cy = -100;
    window.addEventListener("pointermove", e => { x = e.clientX; y = e.clientY; cur.classList.add("on"); });
    document.addEventListener("pointerleave", () => cur.classList.remove("on"));
    document.addEventListener("pointerover", e => { cur.classList.toggle("hover", !!e.target.closest("a, button, summary, input, .spec-row")); });
    (function loop() { cx += (x - cx) * 0.22; cy += (y - cy) * 0.22; cur.style.transform = `translate(${cx}px, ${cy}px)`; requestAnimationFrame(loop); })();
    $$(".magnetic").forEach(b => {
      b.addEventListener("pointermove", e => { const r = b.getBoundingClientRect(); b.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.18}px, ${(e.clientY - r.top - r.height / 2) * 0.25}px)`; });
      b.addEventListener("pointerleave", () => { b.style.transform = ""; });
    });
  }

  // ---------------------------------------------------------------- the valley schematic (section 01)
  (function valley() {
    const cv = $("valleyCanvas"); if (!cv) return;
    let inversion = true, visible = false, parts = [], last = performance.now(), haze = 0;
    $("invOn").addEventListener("click", () => { inversion = true; $("invOn").classList.add("on"); $("invOff").classList.remove("on"); });
    $("invOff").addEventListener("click", () => { inversion = false; $("invOff").classList.add("on"); $("invOn").classList.remove("on"); });
    new IntersectionObserver(es => { visible = es[0].isIntersecting; }).observe(cv);
    const ground = u => 0.82 - 0.40 * Math.pow(Math.abs(u - 0.5) * 2, 1.6);       // valley profile: y as a fraction of the height
    const chimneys = [0.1, 0.17, 0.83, 0.9];
    function frame(now) {
      requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (!visible) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2), w = cv.clientWidth, h = cv.clientHeight;
      if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
      const g = cv.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
      const lid = h * 0.3;
      haze += ((inversion ? 1 : 0) - haze) * dt * 0.25;
      if (haze > 0.01) {                                   // trapped smoke builds up under the lid
        g.fillStyle = `rgba(120,108,96,${(0.22 * haze).toFixed(3)})`; g.beginPath(); g.moveTo(0, lid);
        g.lineTo(w, lid); for (let x = w; x >= 0; x -= 6) g.lineTo(x, ground(x / w) * h); g.closePath(); g.fill();
      }
      if (inversion) {
        g.fillStyle = "rgba(180,83,42,.07)"; g.fillRect(0, lid - 26, w, 26);
        g.strokeStyle = "rgba(180,83,42,.7)"; g.setLineDash([5, 5]); g.beginPath(); g.moveTo(0, lid); g.lineTo(w, lid); g.stroke(); g.setLineDash([]);
        g.font = "600 10px 'JetBrains Mono', monospace"; g.fillStyle = "#B4532A"; g.fillText("WARM AIR LID · INVERSION", 10, lid - 9);
        g.fillStyle = "#2E4A6E"; g.textAlign = "center"; g.fillText("COLD AIR POOLS IN THE VALLEY", w / 2, lid + 18); g.textAlign = "left";
      } else { g.font = "600 10px 'JetBrains Mono', monospace"; g.fillStyle = "#2E4A6E"; g.fillText("WIND AND MIXING CARRY THE SMOKE AWAY", 10, 16); }
      for (const u of chimneys) if (Math.random() < dt * 9) parts.push({ x: u * w, y: ground(u) * h - 20, vx: (u < 0.5 ? 1 : -1) * (22 + Math.random() * 14), vy: -(10 + Math.random() * 8), a: 1, r: 3 + Math.random() * 3 });
      for (const p of parts) {
        if (inversion) {
          p.vx += ((w / 2 - p.x) * 0.02 - p.vx) * dt * 0.6; p.vy += 6 * dt;
          if (p.y < lid + 6) { p.y = lid + 6; p.vy = Math.abs(p.vy) * 0.3; }
          const gy = ground(p.x / w) * h - 6; if (p.y > gy) { p.y = gy; p.vy = -Math.abs(p.vy) * 0.3; }
          p.a -= dt * 0.035; p.r += dt * 1.2;
        } else { p.vy -= 4 * dt; p.vx += 16 * dt; p.a -= dt * 0.22; p.r += dt * 3; }
        p.x += p.vx * dt; p.y += p.vy * dt;
      }
      parts = parts.filter(p => p.a > 0 && p.x > -20 && p.x < w + 20 && p.y > -20).slice(-520);
      for (const p of parts) { g.fillStyle = `rgba(110,102,92,${(0.16 * p.a).toFixed(3)})`; g.beginPath(); g.arc(p.x, p.y, p.r, 0, 2 * Math.PI); g.fill(); }
      g.fillStyle = "#E4DDD1"; g.beginPath(); g.moveTo(0, h);
      for (let x = 0; x <= w; x += 4) g.lineTo(x, ground(x / w) * h);
      g.lineTo(w, h); g.closePath(); g.fill();
      g.strokeStyle = "#1F1D1A"; g.lineWidth = 1; g.beginPath(); for (let x = 0; x <= w; x += 4) { const y = ground(x / w) * h; if (x) g.lineTo(x, y); else g.moveTo(x, y); } g.stroke();
      g.fillStyle = "#1F1D1A";
      let s = 5; const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280;
      for (let x = w * 0.36; x < w * 0.64; x += 9) { const bh = 8 + rnd() * 22; g.fillRect(x, ground(x / w) * h - bh, 7, bh); }
      g.fillRect(w * 0.49, ground(0.5) * h - 44, 4, 44);
      for (const u of chimneys) { const y = ground(u) * h; g.fillRect(u * w - 6, y - 10, 12, 10); g.fillRect(u * w + 2, y - 20, 3, 10); }
      g.textAlign = "center"; g.font = "600 11px 'JetBrains Mono', monospace"; g.fillStyle = "#1F1D1A"; g.fillText("KRAKÓW", w / 2, h - 10);
      g.fillStyle = "#6E675E"; g.font = "500 10px 'JetBrains Mono', monospace";
      g.fillText("towns burning", w * 0.13, Math.min(h - 18, ground(0.13) * h + 26)); g.fillText("solid fuel", w * 0.13, Math.min(h - 6, ground(0.13) * h + 39));
      g.fillText("towns burning", w * 0.87, Math.min(h - 18, ground(0.87) * h + 26)); g.fillText("solid fuel", w * 0.87, Math.min(h - 6, ground(0.87) * h + 39));
      g.textAlign = "left";
    }
    requestAnimationFrame(frame);
  })();

  // ---------------------------------------------------------------- robot viewer and calculators (section 04)
  (function robot() {
    if (!window.OddechRobot || !$("robotCanvas")) return;
    let v; try { v = window.OddechRobot.viewer($("robotCanvas"), $("robotLabels")); } catch (e) { return; }
    const range = $("mastRange");
    const set = h => { range.value = h; $("mastVal").textContent = (+h).toFixed(2) + " m"; v.setMast(+h);
      $$(".robot-ctl [data-h]").forEach(b => b.classList.toggle("on", Math.abs(+b.dataset.h - h) < 0.01)); };
    let touched = false; const touch = () => { touched = true; };
    range.addEventListener("input", () => { touch(); set(+range.value); });
    $$(".robot-ctl [data-h]").forEach(b => b.addEventListener("click", () => { touch(); set(+b.dataset.h); }));
    let ex = false; $("explodeBtn").addEventListener("click", () => { touch(); ex = !ex; v.setExplode(ex); $("explodeBtn").classList.toggle("on", ex); });
    $("robotCanvas").addEventListener("pointerdown", touch);
    $$(".spec-row").forEach(r => {
      r.addEventListener("pointerenter", () => {
        v.highlight(r.dataset.part); r.classList.add("on");
        if (r.dataset.part === "head" || r.dataset.part === "mast") set(1.6);
        if (["battery", "compute", "bio", "vent"].indexOf(r.dataset.part) >= 0 && !ex) { v.setExplode(true); r._ex = true; }
      });
      r.addEventListener("pointerleave", () => { v.highlight(null); r.classList.remove("on"); if (r._ex && !ex) { v.setExplode(false); r._ex = false; } });
    });
    let demo = null, phase = 0;                            // the mast rises and falls until someone takes over
    new IntersectionObserver(es => {
      clearInterval(demo); demo = null;
      if (es[0].isIntersecting && !touched) demo = setInterval(() => { if (touched) { clearInterval(demo); return; } set([1.1, 1.6, 0.4][phase++ % 3]); }, 2400);
    }, { threshold: 0.3 }).observe($("robotCanvas"));
  })();
  function bindCalc(ids, fn) { ids.forEach(id => $(id).addEventListener("input", fn)); fn(); }
  bindCalc(["pbWh", "pbBase", "pbBio", "pbDrive", "pbMast"], () => {
    const wh = +$("pbWh").value, base = +$("pbBase").value, bio = +$("pbBio").value, dr = +$("pbDrive").value / 100, ms = +$("pbMast").value / 100;
    const avg = base + bio + 8 * dr + 6 * ms, hrs = wh * 0.8 / avg;
    $("pbWhV").textContent = wh + " Wh"; $("pbBaseV").textContent = base + " W"; $("pbBioV").textContent = bio + " W"; $("pbDriveV").textContent = Math.round(dr * 100) + " %"; $("pbMastV").textContent = Math.round(ms * 100) + " %";
    $("pbAvg").textContent = avg.toFixed(1) + " W"; $("pbHours").textContent = hrs.toFixed(1) + " h";
  });
  bindCalc(["stH", "stM"], () => {
    const h = +$("stH").value, m = +$("stM").value, hc = 0.352 + 0.7 * (h - 0.352), cog = (6.4 * 0.12 + m * hc) / (6.4 + m), a = 9.81 * 0.10 / cog;
    $("stHV").textContent = h.toFixed(2) + " m"; $("stMV").textContent = m.toFixed(2) + " kg";
    $("stCog").textContent = cog.toFixed(2) + " m"; $("stAcc").textContent = a.toFixed(1) + " m/s²"; $("stMar").textContent = "×" + a.toFixed(1);
  });
  bindCalc(["ueHw", "ueFee", "ueCart", "uePc", "ueSvc", "ueLife"], () => {
    const o = { hw: +$("ueHw").value, fee: +$("ueFee").value, cart: +$("ueCart").value, pc: +$("uePc").value, svc: +$("ueSvc").value, life: +$("ueLife").value };
    const { gm, pay, ltv } = window.OddechSim.unitEconomics(o), life = o.life;
    const eur = v => "€" + Math.abs(Math.round(v)).toLocaleString("en-GB") + (v < 0 ? " loss" : "");   // a loss in words, not a minus sign
    $("ueHwV").textContent = eur(o.hw); $("ueFeeV").textContent = eur(o.fee); $("ueCartV").textContent = o.cart; $("uePcV").textContent = `${eur(o.pc)} · ${eur(o.pc / 2)}`;
    $("ueSvcV").textContent = eur(o.svc); $("ueLifeV").textContent = life + " months";
    $("ueGm").textContent = eur(gm); $("uePay").textContent = isFinite(pay) ? pay.toFixed(1) + " months" : "never"; $("ueLtv").textContent = eur(ltv);
    $("uePay").style.color = isFinite(pay) && pay <= life ? "" : "#B4532A";
  });

  // ---------------------------------------------------------------- one robot or many devices (section 04), the live demonstration (section 16)
  (function pictures() {
    const A = window.OddechArt, B = window.ODDECH_BENCH; if (!A) return;
    if ($("setupsArt")) $("setupsArt").innerHTML = A.setups(false);
    if ($("trioArt")) $("trioArt").insertAdjacentHTML("afterbegin", A.img("robot_trio", "Oddech with its nose at 0.40, 1.10 and 1.60 m", "width:100%;height:auto"));
    if ($("vsPoints") && B) {
      const e = v => Math.round(100 * (Math.exp(v) - 1)), eO = e(B.median.oddech_people), eF = e(B.median.fixed4_people), all = B.wins.people_vs_fixed === B.seeds;
      $("vsPoints").innerHTML = [
        [eO < eF / 2 ? "Less than half the error" : "Less error", `In our room model, three fixed sensors and Oddech misjudged the air people breathe by ${eO} %, four fixed sensors by ${eF} %, ${all ? "in every model room" : "in most model rooms"}.`],
        ["It chooses where to go", `It also beat a robot that wanders at random${B.wins.people_vs_random === B.seeds ? " in every model room" : ""}: the gain is in the choosing.`],
        ["Living cells cannot sit in every corner", "They need 37 °C, moist air and a fresh cartridge each week. One robot carries one cartridge to every spot."],
        ["One device to look after", "It works with the purifier you already have, and tells you when to open the window instead."],
      ].map(([h, t], i) => `<div class="${i ? "" : "hot"}"><h4>${h}</h4><p>${t}</p></div>`).join("");
    }
    if ($("liveRobot")) $("liveRobot").innerHTML = A.img("robot_hero", "Oddech, rendered from its 3D model", "height:420px;width:auto");
    if ($("liveQr")) $("liveQr").innerHTML = A.qr(true, 220);
    if ($("priceRead") && $("ueFee")) {                    // section 05's price, from the business section's default inputs
      const fee = +$("ueFee").defaultValue, cart = +$("ueCart").defaultValue, pc = +$("uePc").defaultValue, reads = 7 * 24 * 6;
      const child = 100 * (fee + cart * pc) / 30.4 / 20;
      $("priceRead").textContent = `${(100 * pc / reads).toFixed(1)} cents`;
      $("priceText").textContent = `One €${pc} cartridge gives about 1,000 readings a week. A room of twenty children, with the robot and a fresh cartridge every week, comes to about ${Math.round(child)} cents a child a day. Planning assumptions, not quotes.`;
    }
  })();

  // ---------------------------------------------------------------- platform matrix (section 04)
  (function matrix() {
    const cols = ["Fixed monitor", "Sensor network", "Wearable", "Indoor drone", "Mobile purifier robot", "Oddech"];
    const rows = [["Covers the whole room", [0, 2, 0, 2, 1, 2]], ["Reads at several heights", [0, 1, 0, 2, 0, 2]],
      ["Leaves the air undisturbed while reading", [2, 2, 2, 0, 0, 1]], ["Runs for hours", [2, 2, 1, 0, 2, 2]],
      ["Safe and quiet near small children", [2, 2, 2, 0, 1, 1]], ["One calibrated instrument, no unit-to-unit spread", [2, 0, 2, 2, 2, 2]],
      ["Measures one person's own exposure", [0, 0, 2, 0, 0, 1]], ["Can act on the air", [0, 0, 0, 0, 2, 1]], ["Low cost for one room", [2, 1, 2, 0, 1, 1]],
      ["Measures harm to living cells, not only mass", [0, 0, 0, 0, 0, 2]]];
    const us = cols.length - 1;
    $("platformMatrix").innerHTML = "<thead><tr><th>Question</th>" + cols.map((c, i) => `<th class="${i === us ? "us" : ""}">${c}</th>`).join("") + "</tr></thead><tbody>" +
      rows.map(([q, v]) => `<tr><td>${q}</td>` + v.map((x, i) => `<td class="${i === us ? "us" : ""}"><span class="dot f${x}" title="${["no", "partly", "yes"][x]}"></span></td>`).join("") + "</tr>").join("") + "</tbody>";
  })();

  // ---------------------------------------------------------------- market positioning map (section 08)
  (function posmap() {
    const svg = $("posMap"); if (!svg) return;
    const x0 = 64, x1 = 580, y0 = 400, y1 = 20, X = u => x0 + (x1 - x0) * u, Y = v => y0 - (y0 - y1) * v;
    const pts = [["City networks and apps", 0.06, 0.30], ["Indoor monitors", 0.2, 0.15], ["Smart purifiers", 0.22, 0.45], ["Mobile purifier robot", 0.5, 0.55],
      ["General home robots", 0.44, 0.25], ["Research robots", 0.84, 0.15], ["Laboratory toxicity tests", 0.08, 0.66], ["Oddech", 0.86, 0.86, true]];
    let s = `<g font-family="Inter Tight, Helvetica Neue, Arial, sans-serif">`;
    s += `<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y0}" stroke="#1F1D1A"/><line x1="${x0}" y1="${y0}" x2="${x0}" y2="${y1}" stroke="#1F1D1A"/>`;
    s += `<line x1="${X(0.5)}" y1="${y0}" x2="${X(0.5)}" y2="${y1}" stroke="rgba(31,29,26,.14)" stroke-dasharray="3 4"/><line x1="${x0}" y1="${Y(0.5)}" x2="${x1}" y2="${Y(0.5)}" stroke="rgba(31,29,26,.14)" stroke-dasharray="3 4"/>`;
    s += `<text x="${x0}" y="${y0 + 22}" font-size="11" fill="#8A847A">one point</text><text x="${x1}" y="${y0 + 22}" font-size="11" fill="#8A847A" text-anchor="end">a map of the room, at several heights</text>`;
    s += `<text x="${(x0 + x1) / 2}" y="${y0 + 46}" font-size="11" fill="#1F1D1A" text-anchor="middle" font-weight="600" letter-spacing="1">WHERE IN THE ROOM IT KNOWS THE AIR</text>`;
    s += `<text transform="translate(${x0 - 14},${y0}) rotate(-90)" font-size="11" fill="#8A847A">a number</text><text transform="translate(${x0 - 14},${y1}) rotate(-90)" font-size="11" fill="#8A847A" text-anchor="end">meaning and an action</text>`;
    s += `<text transform="translate(${x0 - 36},${(y0 + y1) / 2}) rotate(-90)" font-size="11" fill="#1F1D1A" text-anchor="middle" font-weight="600" letter-spacing="1">WHAT IT TELLS YOU</text>`;
    s += `<path d="M ${X(0.53)} ${Y(0.6)} Q ${X(0.66)} ${Y(0.82)} ${X(0.82)} ${Y(0.86)}" fill="none" stroke="#B4532A" stroke-width="1" stroke-dasharray="4 4"/>`;
    s += `<text x="${X(0.69)}" y="${Y(0.7)}" font-size="11" fill="#B4532A" font-style="italic">Oddech can steer it</text>`;
    for (const [name, u, v, us] of pts) {
      const cx = X(u), cy = Y(v), right = u > 0.7, dx = right ? -14 : 12;
      if (us) s += `<circle cx="${cx}" cy="${cy}" r="18" fill="none" stroke="#B4532A"><animate attributeName="r" values="10;28;10" dur="3.2s" repeatCount="indefinite"/><animate attributeName="stroke-opacity" values=".7;0;.7" dur="3.2s" repeatCount="indefinite"/></circle>`;
      s += `<circle cx="${cx}" cy="${cy}" r="${us ? 9 : 6}" fill="${us ? "#B4532A" : "#1F1D1A"}"/>`;
      s += `<text x="${cx + dx}" y="${cy + (us ? 6 : 4)}" font-size="${us ? 24 : 13}" fill="${us ? "#B4532A" : "#1F1D1A"}" text-anchor="${right ? "end" : "start"}"${us ? ' font-family="Instrument Serif, Georgia, serif"' : ""}>${name}</text>`;
    }
    svg.innerHTML = s + "</g>";
  })();

  // ---------------------------------------------------------------- H1 benchmark (section 06)
  const fx = v => "×" + Math.exp(v).toFixed(2);
  function bars(el, rows) {
    const max = Math.max(...rows.map(r => Math.exp(r[1])));
    el.innerHTML = rows.map(([name, v, us]) => `<div class="bar${us ? " us" : ""}"><span>${name}</span><i data-w="${Math.max(2, (Math.exp(v) - 1) / (max - 1) * 100).toFixed(1)}%"></i><span class="mono">${fx(v)}</span></div>`).join("");
    const host = el.closest("[data-reveal]"); if (host && host.classList.contains("in")) requestAnimationFrame(() => growBars(el));
  }
  const benchNote = $("benchNote");
  if (BENCH) {
    const m = BENCH.median, w = BENCH.wins, n = BENCH.seeds;
    bars($("benchPeople"), [["Three fixed + Oddech", m.oddech_people, true], ["Three fixed + a robot sent to random places", m.random_people], ["Four fixed sensors", m.fixed4_people]]);
    bars($("benchField"), [["Three fixed + Oddech", m.oddech, true], ["Three fixed + a robot sent to random places", m.random], ["Four fixed sensors", m.fixed4]]);
    $("benchLede").innerHTML = `In ${n} simulated rooms with random sources, outdoor levels, windows and purifier settings, the typical error where people breathe was <b>${fx(m.oddech_people)}</b> with Oddech against <b>${fx(m.fixed4_people)}</b> with four fixed sensors. Oddech did better in <b>${w.people_vs_fixed} of ${n}</b> rooms, and better than a robot sent to random places in ${w.people_vs_random} of ${n}. Across the whole floor it beat four fixed sensors in ${w.field_vs_fixed} of ${n} rooms, but a randomly moving robot did almost as well there (Oddech better in ${w.field_vs_random} of ${n}). On the floor, the gain comes from moving at all; where people breathe, it comes from choosing where.`;
    benchNote.dataset.base = `Median over ${n} rooms, minutes 5 to ${BENCH.minutes} of each run. Error is the typical factor between the map and the simulated truth: the exponential of the mean absolute error of ln(PM2.5 + 2) where the child and the adult breathe, and of the RMSE over the free floor at 1.1 m. A model room: it shows the method, not evidence about real rooms.`;
    benchNote.textContent = benchNote.dataset.base;
  }
  $("benchRun").addEventListener("click", () => {
    const btn = $("benchRun"), seeds = [0, 1, 2].map(() => 200 + Math.floor(Math.random() * 90000)), out = [];
    btn.disabled = true;
    const done = () => {
      const med = k => out.map(r => r[k]).sort((a, b) => a - b)[1];
      benchNote.innerHTML = `<b>Your 3 new rooms</b> (median): where people breathe, Oddech ${fx(med("oddech_people"))}, random robot ${fx(med("random_people"))}, four fixed ${fx(med("fixed4_people"))}; across the floor, Oddech ${fx(med("oddech"))}, random ${fx(med("random"))}, four fixed ${fx(med("fixed4"))}. ` + esc(benchNote.dataset.base || "");
      btn.disabled = false; btn.textContent = "Run 3 more rooms";
    };
    let worker = null;
    try {
      const src = (window.ODDECH_SIM_SRC || "") + "\nself.onmessage = function (e) { self.postMessage(OddechSim.benchRun(e.data.seed, e.data.minutes)); };";
      if (window.ODDECH_SIM_SRC) worker = new Worker(URL.createObjectURL(new Blob([src], { type: "text/javascript" })));
    } catch (e) { worker = null; }
    const step = i => {
      if (i >= seeds.length) { if (worker) worker.terminate(); done(); return; }
      btn.textContent = `Simulating room ${i + 1} of 3…`;
      if (worker) { worker.onmessage = e => { out.push(e.data); step(i + 1); }; worker.onerror = ev => { if (ev && ev.preventDefault) ev.preventDefault(); worker = null; step(i); }; worker.postMessage({ seed: seeds[i], minutes: 20 }); }
      else setTimeout(() => { out.push(window.OddechSim.benchRun(seeds[i], 20)); step(i + 1); }, 40);
    };
    step(0);
  });
})();
