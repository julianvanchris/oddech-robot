/* Section 04·b: the Gazebo twin. The model flat (sim.js LAYOUT, the room the Gazebo world was built from) with the robot
   drawn from the package's part list.
   Replay: a sampling round that Gazebo Harmonic 8.10 simulated from the package and we recorded (gazebo/docs/gazebo_run.json,
   about 18 samples a second): pose, wheel angles and the four mast stages, played back at their true speed.
   Drive: the same robot and limits computed here (0.30 m/s, 1.6 rad/s, 0.5 m/s², nose 0.25 m/s), with collisions.
   In both, the laser scan is ray-cast here against the same flat; Gazebo's own scanner needs a GPU and was not recorded. */
(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const T = window.THREE, S = window.OddechSim, R = window.ODDECH_ROBOT, RUN = window.ODDECH_GZRUN, OR = window.OddechRobot;
  const cv = $("twinCanvas"); if (!cv || !T || !S || !R || !RUN || !OR) return;
  const L = S.LAYOUT, D = R.dims, RAD = 0.175, WR = D.wheel_d / 2, HALF = D.track / 2;
  const P = (x, y, z) => new T.Vector3(x, z || 0, -y);                    // ROS world (x, y, z) -> three.js

  // ---------------------------------------------------------------- scene: the flat as a blueprint model
  const renderer = new T.WebGLRenderer({ canvas: cv, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputEncoding = T.sRGBEncoding; renderer.toneMapping = T.ACESFilmicToneMapping;
  const C = h => new T.Color(h).convertSRGBToLinear();                  // hex colours are sRGB; the renderer works in linear light
  const scene = new T.Scene(); scene.background = new T.Color(0x0A2542); scene.fog = new T.Fog(C(0x0A2542), 11, 26);
  const cam = new T.PerspectiveCamera(36, 1, 0.05, 60);
  scene.add(new T.HemisphereLight(0xdfe9f5, 0x0a2240, 0.9));
  const sun = new T.DirectionalLight(0xffffff, 1.2); sun.position.set(2, 7, 3); scene.add(sun);
  const floor = new T.Mesh(new T.PlaneGeometry(8, 6), new T.MeshBasicMaterial({ color: C(0x0F3157), toneMapped: false }));
  floor.rotation.x = -Math.PI / 2; floor.position.copy(P(4, 3, 0)); scene.add(floor);
  const seg = [];
  for (let x = 0; x <= 8 + 1e-6; x += 0.25) seg.push([x, 0, x, 6, Math.abs(x - Math.round(x)) < 1e-6]);
  for (let y = 0; y <= 6 + 1e-6; y += 0.25) seg.push([0, y, 8, y, Math.abs(y - Math.round(y)) < 1e-6]);
  for (const major of [false, true]) {
    const pts = []; for (const s of seg) if (s[4] === major) pts.push(P(s[0], s[1], 0.002), P(s[2], s[3], 0.002));
    scene.add(new T.LineSegments(new T.BufferGeometry().setFromPoints(pts), new T.LineBasicMaterial({ color: C(0xEAF2FB), transparent: true, opacity: major ? 0.2 : 0.07, toneMapped: false })));
  }
  const edgeMat = new T.LineBasicMaterial({ color: C(0xEAF2FB), transparent: true, opacity: 0.62, toneMapped: false });
  function block(x0, y0, x1, y1, z0, z1, color, opacity) {
    const g = new T.BoxGeometry(x1 - x0, z1 - z0, y1 - y0), m = new T.Mesh(g, new T.MeshStandardMaterial({ color: C(color), roughness: 0.85, transparent: opacity < 1, opacity, depthWrite: opacity > 0.5 }));
    m.position.copy(P((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)); m.add(new T.LineSegments(new T.EdgesGeometry(g), edgeMat)); scene.add(m); return m;
  }
  function cylinder(x, y, r, z0, z1, color, opacity) {
    const g = new T.CylinderGeometry(r, r, z1 - z0, 32), m = new T.Mesh(g, new T.MeshStandardMaterial({ color: C(color), roughness: 0.8, transparent: opacity < 1, opacity }));
    m.position.copy(P(x, y, (z0 + z1) / 2)); m.add(new T.LineSegments(new T.EdgesGeometry(g, 30), edgeMat)); scene.add(m); return m;
  }
  // walls, 2.7 m, glassy so the room stays readable; a gap for the door, a pane for the window
  const H = S.ROOM.H, W = L.window, DR = L.door, wall = 0x9FC0E2;
  for (const w of [[-0.1, 0, 0, 6], [0, -0.1, 8, 0], [0, 6, W.x0, 6.1], [W.x1, 6, 8, 6.1], [8, 0, 8.1, DR.y0], [8, DR.y1, 8.1, 6]]) block(w[0], w[1], w[2], w[3], 0, H, wall, 0.06);
  block(W.x0, 6, W.x1, 6.1, 0, W.z0, wall, 0.06); block(W.x0, 6, W.x1, 6.1, W.z1, H, wall, 0.06); block(8, DR.y0, 8.1, DR.y1, 2.1, H, wall, 0.06);
  block(W.x0, 6.02, W.x1, 6.06, W.z0, W.z1, 0xcfe0f2, 0.22);
  // furniture: tables as tops on legs (the scanner sees the legs), the rest as blocks
  const rects = [], circles = [], beams = [];                                // for collisions and the scan
  for (const o of L.obstacles) {
    const [x0, y0, x1, y1, h, name] = o;
    rects.push([x0, y0, x1, y1]);
    if (/table/.test(name)) {
      block(x0, y0, x1, y1, h - 0.04, h, 0x8DB3DD, 0.5);
      for (const [lx, ly] of [[x0 + 0.06, y0 + 0.06], [x1 - 0.06, y0 + 0.06], [x1 - 0.06, y1 - 0.06], [x0 + 0.06, y1 - 0.06]]) {
        block(lx - 0.025, ly - 0.025, lx + 0.025, ly + 0.025, 0, h - 0.04, 0x8DB3DD, 0.5); beams.push([lx - 0.025, ly - 0.025, lx + 0.025, ly + 0.025]);
      }
    } else { block(x0, y0, x1, y1, 0, h, 0x6F9BCB, 0.3); beams.push([x0, y0, x1, y1]); }
  }
  block(L.mat.x0, L.mat.y0, L.mat.x1, L.mat.y1, 0, 0.008, 0xE9C9A8, 0.22);
  block(L.stove.x - 0.3, L.stove.y - 0.25, L.stove.x + 0.3, L.stove.y + 0.25, 0.9, 0.93, 0x26231F, 1);
  cylinder(L.candle.x, L.candle.y, 0.03, 0.75, 0.85, 0xF6EBD9, 1);
  cylinder(L.purifier.x, L.purifier.y, 0.17, 0, 0.55, 0xEDE8DF, 1); circles.push([L.purifier.x, L.purifier.y, 0.17]); beams.push(["c", L.purifier.x, L.purifier.y, 0.17]);
  block(L.dock.x + 0.28, L.dock.y - 0.17, L.dock.x + 0.4, L.dock.y + 0.17, 0, 0.14, 0x2E4A6E, 1);
  for (const p of L.people) {
    const child = p.id === "child", r = child ? 0.12 : 0.17, z0 = child ? 0 : 0.42, z1 = child ? 0.36 : 0.99, hr = child ? 0.09 : 0.11;
    cylinder(p.x, p.y, r, z0, z1, 0xD9875C, 0.85);
    const head = new T.Mesh(new T.SphereGeometry(hr, 24, 16), new T.MeshStandardMaterial({ color: C(0xE8B48F), roughness: 0.7 })); head.position.copy(P(p.x, p.y, p.z)); scene.add(head);
    circles.push([p.x, p.y, r]); if (child) beams.push(["c", p.x, p.y, r]);
  }

  // the robot, its trail, the scan, the nose
  const rob = OR.buildRobot({ shadows: false }); rob.setRing(0x7E98BC); scene.add(rob.group);
  const TRAIL = 900, trailPos = new Float32Array(TRAIL * 3), trailGeo = new T.BufferGeometry();
  trailGeo.setAttribute("position", new T.BufferAttribute(trailPos, 3)); trailGeo.setDrawRange(0, 0);
  scene.add(new T.Line(trailGeo, new T.LineBasicMaterial({ color: C(0xF0A27C), transparent: true, opacity: 0.9, toneMapped: false })));
  const NB = 180, scanPos = new Float32Array(NB * 6), hitPos = new Float32Array(NB * 3), scanGeo = new T.BufferGeometry(), hitGeo = new T.BufferGeometry();
  scanGeo.setAttribute("position", new T.BufferAttribute(scanPos, 3)); hitGeo.setAttribute("position", new T.BufferAttribute(hitPos, 3));
  const scanLines = new T.LineSegments(scanGeo, new T.LineBasicMaterial({ color: C(0x7FD3FF), transparent: true, opacity: 0.14, toneMapped: false }));
  const scanHits = new T.Points(hitGeo, new T.PointsMaterial({ color: C(0x9FE3FF), size: 0.045, transparent: true, opacity: 0.95, toneMapped: false }));
  scene.add(scanLines, scanHits);
  const noseRing = new T.Mesh(new T.TorusGeometry(0.09, 0.006, 8, 48), new T.MeshBasicMaterial({ color: C(0xF0A27C), transparent: true, opacity: 0, toneMapped: false }));
  noseRing.rotation.x = Math.PI / 2; scene.add(noseRing);

  // ---------------------------------------------------------------- geometry for the scan and for collisions
  function rayBox(ox, oy, dx, dy, b) {                                    // slab test: distance, or Infinity
    let t0 = -Infinity, t1 = Infinity;
    for (const [o, d, lo, hi] of [[ox, dx, b[0], b[2]], [oy, dy, b[1], b[3]]]) {
      if (Math.abs(d) < 1e-12) { if (o < lo || o > hi) return Infinity; continue; }
      let a = (lo - o) / d, c = (hi - o) / d; if (a > c) { const s = a; a = c; c = s; }
      t0 = Math.max(t0, a); t1 = Math.min(t1, c); if (t0 > t1) return Infinity;
    }
    return t0 > 0 ? t0 : t1 > 0 ? 0 : Infinity;
  }
  function rayCircle(ox, oy, dx, dy, cx, cy, r) {
    const fx = ox - cx, fy = oy - cy, b = fx * dx + fy * dy, c = fx * fx + fy * fy - r * r, disc = b * b - c;
    if (disc < 0) return Infinity; const t = -b - Math.sqrt(disc); return t > 0 ? t : Infinity;
  }
  function ray(ox, oy, a) {
    const dx = Math.cos(a), dy = Math.sin(a);
    let t = Math.min(dx > 0 ? (8 - ox) / dx : dx < 0 ? -ox / dx : Infinity, dy > 0 ? (6 - oy) / dy : dy < 0 ? -oy / dy : Infinity);   // the walls
    for (const b of beams) t = Math.min(t, b[0] === "c" ? rayCircle(ox, oy, dx, dy, b[1], b[2], b[3]) : rayBox(ox, oy, dx, dy, b));
    return Math.min(D.lidar.rmax, t);
  }
  function free(x, y) {
    if (x < RAD || y < RAD || x > 8 - RAD || y > 6 - RAD) return false;
    for (const r of rects) { const dx = Math.max(r[0] - x, 0, x - r[2]), dy = Math.max(r[1] - y, 0, y - r[3]); if (dx * dx + dy * dy < RAD * RAD) return false; }
    for (const c of circles) if (Math.hypot(x - c[0], y - c[1]) < RAD + c[2]) return false;
    return true;
  }

  // ---------------------------------------------------------------- state: replay of the Gazebo run, or live driving
  const rows = RUN.rows, T_END = rows[rows.length - 1][0];
  const x0 = rows[0][1], y0 = rows[0][2], yaw0 = rows[0][3];
  const tMove = (rows.find(r => Math.hypot(r[1] - x0, r[2] - y0) > 0.005) || rows[0])[0], OFFSET = tMove - (R.patrol[0][0] + 0.12);
  const st = { mode: "replay", play: true, tau: 0, x: x0, y: y0, yaw: yaw0, v: 0, w: 0, wl: 0, wr: 0, q: 0, qT: 0, cmdQ: 0, keys: {}, bump: 0, simT: 0, ntrail: 0, scanMin: [9, 0] };
  let ri = 0;
  function sample(tau) {                                                   // interpolate the recorded run
    while (ri < rows.length - 2 && rows[ri + 1][0] < tau) ri++;
    while (ri > 0 && rows[ri][0] > tau) ri--;
    const a = rows[ri], b = rows[Math.min(ri + 1, rows.length - 1)], f = b[0] > a[0] ? Math.min(1, Math.max(0, (tau - a[0]) / (b[0] - a[0]))) : 0;
    let dyaw = b[3] - a[3]; dyaw -= 2 * Math.PI * Math.round(dyaw / (2 * Math.PI));
    const lerp = k => a[k] + (b[k] - a[k]) * f, dt = Math.max(1e-3, b[0] - a[0]);
    const vx = (b[1] - a[1]) / dt, vy = (b[2] - a[2]) / dt;
    return { x: lerp(1), y: lerp(2), yaw: a[3] + dyaw * f, wl: lerp(4), wr: lerp(5), q: lerp(9) / 4, v: vx * Math.cos(a[3]) + vy * Math.sin(a[3]), w: dyaw / dt };
  }
  function resetTrail() { st.ntrail = 0; trailGeo.setDrawRange(0, 0); }
  function pushTrail() {
    const n = st.ntrail;
    if (n && Math.hypot(trailPos[3 * (n - 1)] - st.x, -trailPos[3 * (n - 1) + 2] - st.y) < 0.01) return;
    if (n >= TRAIL) { trailPos.copyWithin(0, 3); st.ntrail--; }
    const k = 3 * st.ntrail; trailPos[k] = st.x; trailPos[k + 1] = 0.006; trailPos[k + 2] = -st.y; st.ntrail++;
    trailGeo.setDrawRange(0, st.ntrail); trailGeo.attributes.position.needsUpdate = true;
  }

  // ---------------------------------------------------------------- the patrol log (replay) and the side panels
  const log = $("twinLog"), say = (kind, val) => kind === "m" ? `/mast/cmd ${val.toFixed(3)} · nose ${(0.4 + 4 * val).toFixed(2)} m` : kind === "v" ? `/cmd_vel linear.x ${val.toFixed(2)}` : `/cmd_vel angular.z ${val.toFixed(2)}`;
  log.innerHTML = R.patrol.map(([t, , kind, val]) => `<li><span class="k">${(t + OFFSET).toFixed(1).padStart(5)} s</span>  ${say(kind, val)}</li>`).join("");
  const logItems = Array.from(log.querySelectorAll("li"));
  const mmss = s => `${String(Math.floor(s / 60)).padStart(2, "0")}:${(s % 60).toFixed(1).padStart(4, "0")}`;
  const deg = a => (((a * 180 / Math.PI) % 360 + 360) % 360).toFixed(1);       // a heading from 0 to 360, never signed
  const fix = (v, d) => (Math.abs(v) < 0.5 * Math.pow(10, -d) ? 0 : v).toFixed(d);  // no "-0.00"
  function hud() {
    const live = st.mode === "drive", tt = live ? st.simT : Math.min(st.tau, T_END);
    $("twinHud").innerHTML = (live ? `<b>LIVE</b> · computed in your browser with the Gazebo model's limits` : `<span class="rec">●</span> <b>GAZEBO HARMONIC 8.10</b> · recorded run, played at 1×`) +
      `<br>sim ${mmss(tt)}${live ? "" : " / " + mmss(T_END)} · real-time factor 1.00` + (st.bump > 0 ? ` · <span class="rec">bumper</span>` : "");
    const c = Math.cos(yaw0), s = Math.sin(yaw0), ox = (st.x - x0) * c + (st.y - y0) * s, oy = -(st.x - x0) * s + (st.y - y0) * c;
    $("twinTopics").innerHTML = [
      ["/clock", `sim ${tt.toFixed(1)} s`],
      ["/cmd_vel", `linear.x ${st.v.toFixed(2)} · angular.z ${st.w.toFixed(2)}`],
      ["/odom", `x ${fix(ox, 2)} · y ${fix(oy, 2)} · yaw ${deg(st.yaw - yaw0)}°`],
      ["/joint_states", `wheels ${st.wl.toFixed(0)}, ${st.wr.toFixed(0)} rad · mast 4 × ${st.q.toFixed(3)}`],
      ["/mast/cmd", `${st.cmdQ.toFixed(3)} · nose ${(0.4 + 4 * st.q).toFixed(2)} m`],
      ["/scan", `${D.lidar.samples} beams · nearest ${st.scanMin[0].toFixed(2)} m at ${st.scanMin[1].toFixed(0)}°`]].map(([k, val]) => `<span class="t">${k.padEnd(14)}</span>${val}`).join("\n");
    $("twinTree").innerHTML = `<span class="k">world</span> oddech_flat\n ├ ground_plane\n ├ flat <span class="k">· the 8 × 6 m model flat</span>\n └ oddech <span class="k">· ${D.mass.toFixed(2)} kg</span>\n    ├ base_link <span class="k">· x ${st.x.toFixed(2)} y ${st.y.toFixed(2)} yaw ${deg(st.yaw)}°</span>\n    ├ wheel_left / right_link <span class="k">· ${st.wl.toFixed(0)} / ${st.wr.toFixed(0)} rad</span>\n    ├ caster_front / rear_link\n    ├ mast_stage_1…4 <span class="k">· ${(st.q * 1000).toFixed(0)} mm each</span>\n    └ head_link <span class="k">· nose ${(0.4 + 4 * st.q).toFixed(2)} m</span>`;
    if (live) return;
    let cur = -1;
    logItems.forEach((li, i) => { const t = R.patrol[i][0] + OFFSET, nxt = i + 1 < logItems.length ? R.patrol[i + 1][0] + OFFSET : 1e9; li.className = st.tau >= nxt ? "done" : st.tau >= t ? "now" : ""; if (li.className === "now") cur = i; });
    if (cur !== logNow) { logNow = cur; log.scrollTo({ top: cur < 0 ? 0 : logItems[cur].offsetTop - log.clientHeight / 2, behavior: "smooth" }); }   // keep the current command in view
  }
  let logNow = -1;

  // ---------------------------------------------------------------- controls
  function setMode(m) {
    st.mode = m; $("twinMode").querySelectorAll("[data-mode]").forEach(b => b.classList.toggle("on", b.dataset.mode === m));
    $("twinKeys").style.display = m === "drive" ? "" : "none"; log.classList.toggle("off", m === "drive");
    if (m === "drive") { st.v = st.w = 0; st.qT = st.q; st.simT = 0; st.play = true; cv.focus({ preventScroll: true }); }
    else { st.tau = 0; ri = 0; st.play = true; resetTrail(); }
    $("twinPlay").textContent = st.play ? "Pause" : "Play"; $("twinPlay").classList.toggle("on", st.play);
  }
  $("twinMode").addEventListener("click", e => { const b = e.target.closest("[data-mode]"); if (b) setMode(b.dataset.mode); });
  $("twinPlay").addEventListener("click", () => { st.play = !st.play; $("twinPlay").textContent = st.play ? "Pause" : "Play"; $("twinPlay").classList.toggle("on", st.play); });
  let showScan = true, follow = false;
  $("twinScan").addEventListener("click", () => { showScan = !showScan; scanLines.visible = scanHits.visible = showScan; $("twinScan").classList.toggle("on", showScan); });
  $("twinFollow").addEventListener("click", () => { follow = !follow; $("twinFollow").classList.toggle("on", follow); });
  const KEY = { ArrowUp: "f", KeyW: "f", ArrowDown: "b", KeyS: "b", ArrowLeft: "l", KeyA: "l", ArrowRight: "r", KeyD: "r" };
  const mastKey = n => { st.qT = [0, 0.175, 0.3][n - 1]; st.cmdQ = st.qT; };
  cv.addEventListener("keydown", e => {
    if (KEY[e.code]) { e.preventDefault(); if (st.mode !== "drive") setMode("drive"); st.keys[KEY[e.code]] = true; }
    else if (e.code === "Space") { e.preventDefault(); st.keys = {}; st.v = st.w = 0; }
    else if (["Digit1", "Digit2", "Digit3"].indexOf(e.code) >= 0) { if (st.mode !== "drive") setMode("drive"); mastKey(+e.code.slice(-1)); }
  });
  cv.addEventListener("keyup", e => { if (KEY[e.code]) st.keys[KEY[e.code]] = false; });
  cv.addEventListener("blur", () => { st.keys = {}; });
  document.querySelectorAll("#twinPad [data-k]").forEach(b => {
    const k = b.dataset.k;
    b.addEventListener("pointerdown", e => { e.preventDefault(); if (st.mode !== "drive") setMode("drive"); if ("123".indexOf(k) >= 0) mastKey(+k); else st.keys[k] = true; });
    ["pointerup", "pointerleave", "pointercancel"].forEach(ev => b.addEventListener(ev, () => { st.keys[k] = false; }));
  });

  // ---------------------------------------------------------------- camera: orbit or follow; render only while visible
  let theta = -0.5, phi = 0.8, drag = null, visible = false, last = performance.now(), tHud = 0, tScan = 0, tTrail = 0;
  const radius = 11.6, target = P(4, 3, 0.4), want = new T.Vector3();
  cv.addEventListener("pointerdown", e => { cv.focus({ preventScroll: true }); drag = { x: e.clientX, y: e.clientY, t: theta, p: phi }; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener("pointermove", e => { if (!drag) return; theta = drag.t - (e.clientX - drag.x) * 0.006; phi = Math.min(1.45, Math.max(0.25, drag.p - (e.clientY - drag.y) * 0.005)); });
  ["pointerup", "pointercancel"].forEach(ev => cv.addEventListener(ev, () => { drag = null; }));
  function resize() { const w = cv.clientWidth, h = cv.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }
  window.addEventListener("resize", resize);
  new IntersectionObserver(es => { visible = es[0].isIntersecting; if (visible) resize(); }, { threshold: 0.02 }).observe(cv);

  function step(dt) {
    if (!st.play) return;
    if (st.mode === "replay") {
      st.tau += dt; if (st.tau > T_END + 2.5) { st.tau = 0; ri = 0; resetTrail(); }
      const s = sample(Math.min(st.tau, T_END)), over = st.tau > T_END;
      Object.assign(st, { x: s.x, y: s.y, yaw: s.yaw, wl: s.wl, wr: s.wr, q: Math.max(0, s.q), v: over ? 0 : s.v, w: over ? 0 : s.w });
      st.cmdQ = 0; for (const [t, , kind, val] of R.patrol) if (kind === "m" && t + OFFSET <= st.tau) st.cmdQ = val;
      return;
    }
    st.simT += dt;
    const k = st.keys, vT = k.f ? 0.25 : k.b ? -0.15 : 0, wT = k.l ? 1.0 : k.r ? -1.0 : 0;
    st.v += Math.max(-D.a_max * dt, Math.min(D.a_max * dt, vT - st.v)); st.w += Math.max(-3 * dt, Math.min(3 * dt, wT - st.w));
    const nx = st.x + Math.cos(st.yaw) * st.v * dt, ny = st.y + Math.sin(st.yaw) * st.v * dt;
    if (free(nx, ny)) { st.x = nx; st.y = ny; } else if (Math.abs(st.v) > 0.01) { st.v = 0; st.bump = 1.2; }
    st.yaw += st.w * dt; st.bump = Math.max(0, st.bump - dt);
    st.wl += (st.v - st.w * HALF) / WR * dt; st.wr += (st.v + st.w * HALF) / WR * dt;
    st.q += Math.max(-D.mast_v / 4 * dt, Math.min(D.mast_v / 4 * dt, st.qT - st.q));
  }
  function scan() {
    const ox = st.x, oy = st.y; let best = 9, at = 0;
    for (let i = 0; i < NB; i++) {
      const a = st.yaw - Math.PI + 2 * Math.PI * i / NB, r = ray(ox, oy, a), hx = ox + Math.cos(a) * r, hy = oy + Math.sin(a) * r;
      if (r < best && r >= D.lidar.rmin) { best = r; at = ((a - st.yaw) * 180 / Math.PI + 540) % 360 - 180; }
      scanPos.set([ox, D.lidar.z, -oy, hx, D.lidar.z, -hy], 6 * i); hitPos.set([hx, D.lidar.z, -hy], 3 * i);
    }
    st.scanMin = [best, at]; scanGeo.attributes.position.needsUpdate = true; hitGeo.attributes.position.needsUpdate = true;
  }
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!visible) return;
    step(dt);
    rob.group.position.copy(P(st.x, st.y, 0)); rob.group.rotation.y = st.yaw; rob.setWheels(st.wl, st.wr); rob.setMast(0.4 + 4 * st.q);
    const sampling = Math.abs(st.v) < 0.02 && st.q > 0.01, pulse = 0.5 + 0.5 * Math.sin(now / 260);
    noseRing.position.copy(P(st.x, st.y, 0.4 + 4 * st.q)); noseRing.material.opacity = sampling ? 0.45 + 0.45 * pulse : 0; noseRing.scale.setScalar(1 + (sampling ? 0.3 * pulse : 0));
    if (now - tScan > 100) { scan(); tScan = now; }
    if (now - tTrail > 100) { pushTrail(); tTrail = now; }
    if (follow) { want.copy(P(st.x - 2.2 * Math.cos(st.yaw), st.y - 2.2 * Math.sin(st.yaw), 1.6)); cam.position.lerp(want, Math.min(1, dt * 2.5)); target.lerp(P(st.x, st.y, 0.5), Math.min(1, dt * 4)); }
    else { target.lerp(P(4, 3, 0.4), Math.min(1, dt * 2)); const rr = radius * Math.max(1, 1.15 / cam.aspect); cam.position.set(target.x + rr * Math.sin(phi) * Math.sin(theta), target.y + rr * Math.cos(phi), target.z + rr * Math.sin(phi) * Math.cos(theta)); }
    cam.lookAt(target);
    renderer.render(scene, cam);
    if (now - tHud > 150) { hud(); tHud = now; }
  }
  setMode("replay"); scan(); hud();
  requestAnimationFrame(frame);
})();
