/* Oddech Sim: a Gazebo-style simulator that runs in the browser, at simulated time.
   - The robot is Antonio's CAD (3model/*.dae, packed by sim/tools/pack_cad.py), loaded with three.js's ColladaLoader. Its two
     wheels turn as it drives, its four mast stages telescope, and the sniffer head on top carries the nose.
   - The world is the site's model flat. The air (PM2.5 transport), the map (a Gaussian process), the planner, the living cells
     and the advice are the site's own model (site/sim.js, window.OddechSim), so this page and section 06 tell the same story.
   - Added here: differential drive with limits and collisions when you drive, a 2D laser ray-cast against the furniture, an
     occupancy map built from it, wheel odometry with drift, an IMU, and ROS 2-style topics with their rates.
   A model room with stated, illustrative parameters: nothing here is a measurement. */
(function () {
  "use strict";
  const T = window.THREE, S = window.OddechSim, CAD = window.ODDECH_CAD || { files: [] };
  const $ = id => document.getElementById(id);
  const bootStep = t => { const el = $("bootStep"); if (el) el.textContent = t; };
  if (!T || !S) { bootStep("This page could not start: three.js or the air model did not load."); return; }
  T.ColorManagement.legacyMode = false;                          // the colours below are sRGB hex, as on the site

  const { ROOM, LAYOUT, NX, NY, NZ, BIO } = S, L = ROOM.Lx, WD = ROOM.Ly, H = ROOM.H;
  const P = (x, y, z) => new T.Vector3(x - L / 2, z, WD / 2 - y);  // room (x, y, z up) to three.js (y up)
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const wrap = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
  const fmt = v => (v === null || v === undefined || !isFinite(v)) ? "–" : v < 10 ? v.toFixed(1) : Math.round(v).toString();
  const fix = (v, d) => (Math.abs(v) < 0.5 * Math.pow(10, -d) ? 0 : v).toFixed(d);            // never "-0.00"
  const clock = t => { t = Math.max(0, Math.floor(t)); const h = Math.floor(t / 3600), m = Math.floor(t / 60) % 60, s = t % 60; return (h ? h + ":" : "") + String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0"); };
  const deg = a => ((a * 180 / Math.PI) % 360 + 360) % 360;                                    // a heading from 0 to 360
  const turn = a => fix(((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI), 2);               // a wheel angle within one turn
  const gauss = () => { let u = 0; while (!u) u = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * Math.random()); };
  const SITE = window.ODDECH_SITE || "https://oddech-robot.streamlit.app/";
  for (const id of ["siteLink", "siteLink2"]) if ($(id)) $(id).href = SITE;

  // ---------------------------------------------------------------- colour maps (indigo = clean, terracotta = heavy), as in section 06
  function ramp(stops) {
    const c = stops.map(([t, h]) => [t, parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
    return t => {
      t = clamp(t, 0, 1); let i = 1; while (i < c.length - 1 && t > c[i][0]) i++;
      const a = c[i - 1], b = c[i], f = (t - a[0]) / (b[0] - a[0] || 1);
      return [a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f, a[3] + (b[3] - a[3]) * f];
    };
  }
  const CONC = ramp([[0, "#20344d"], [0.22, "#4d6d94"], [0.4, "#a7b3bf"], [0.54, "#e4d1b0"], [0.68, "#dd9b63"], [0.82, "#bf572b"], [1, "#651d0f"]]);
  const CMAX = 300, tC = c => Math.log(1 + Math.max(0, c) / 4) / Math.log(1 + CMAX / 4);
  const css = rgb => `rgb(${rgb[0] | 0},${rgb[1] | 0},${rgb[2] | 0})`;
  const setSrgb = (color, rgb) => color.setRGB(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255, T.SRGBColorSpace);

  // ---------------------------------------------------------------- renderer, scene, the room's frame
  const canvas = $("view"), stage = $("stage"), labelsEl = $("labels");
  let renderer;
  try { renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" }); }
  catch (e) { bootStep("This browser could not start WebGL, so the simulation cannot be shown."); return; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.outputEncoding = T.sRGBEncoding; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.92;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
  const scene = new T.Scene(); scene.background = new T.Color(0x0d0c0b); scene.fog = new T.Fog(0x0d0c0b, 26, 52);
  const cam = new T.PerspectiveCamera(34, 1, 0.03, 90);
  const W = new T.Group(); W.rotation.x = -Math.PI / 2; W.position.set(-L / 2, 0, WD / 2); scene.add(W);   // build in room coordinates

  function studioEnvironment() {                                   // soft light for the robot's reflections
    const pm = new T.PMREMGenerator(renderer), env = new T.Scene();
    env.add(new T.Mesh(new T.BoxGeometry(12, 6, 12), new T.MeshBasicMaterial({ color: new T.Color(0.05, 0.045, 0.04), side: T.BackSide })));
    const panel = (w, h, c, x, y, z, rx, ry) => { const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: c, side: T.DoubleSide })); m.position.set(x, y, z); m.rotation.set(rx, ry, 0); env.add(m); };
    panel(6, 1.4, new T.Color(5, 4.7, 4.2), 0, 2.9, 0, Math.PI / 2, 0);
    panel(3, 2.4, new T.Color(3, 2.4, 1.8), -5.9, 1, 0, 0, Math.PI / 2);
    panel(3, 2.4, new T.Color(1, 1.25, 1.9), 5.9, 1.2, 1, 0, -Math.PI / 2);
    const tex = pm.fromScene(env, 0.035).texture; pm.dispose(); return tex;
  }
  scene.environment = studioEnvironment();

  scene.add(new T.HemisphereLight(0xf3e7d6, 0x1d1a17, 0.4));
  const key = new T.DirectionalLight(0xfff1e0, 1.1); key.position.set(-5, 10, 7); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048); Object.assign(key.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 1, far: 30 }); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02; scene.add(key);
  const lamp = new T.PointLight(0xffd2a1, 0.9, 7, 2); lamp.position.copy(P(4.0, 4.1, 2.0)); scene.add(lamp);
  const winGlow = new T.PointLight(0xff9a55, 0.7, 6, 2); winGlow.position.copy(P(5.5, 5.6, 1.6)); scene.add(winGlow);
  const candleL = new T.PointLight(0xffa64d, 0, 2.8, 2); candleL.position.copy(P(4.0, 4.1, 1.0)); scene.add(candleL);
  const stoveL = new T.PointLight(0xff5a1f, 0, 2.4, 2); stoveL.position.copy(P(1.25, 5.55, 1.05)); scene.add(stoveL);

  // ---------------------------------------------------------------- the model flat (the furniture of section 06)
  const mat = (c, o) => new T.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.85, metalness: 0, envMapIntensity: 0.12 }, o || {}));
  const mWall = mat(0xC9C1B4, { roughness: 0.95 }), mWood = mat(0x8E6F55, { roughness: 0.7 }), mDarkWood = mat(0x5B4636, { roughness: 0.75 });
  const mCounter = mat(0xD9D3C8, { roughness: 0.6 }), mTop = mat(0x34302B, { roughness: 0.4 }), mFabric = mat(0x6B5F55, { roughness: 1 });
  const mDark = mat(0x26231F, { roughness: 0.5 }), mShell = mat(0xF1ECE3, { roughness: 0.4 }), mPerson = mat(0xE9E2D6, { roughness: 0.9 });
  function box(x0, y0, x1, y1, z0, z1, m, shadow) {
    const mesh = new T.Mesh(new T.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), m);
    mesh.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); mesh.castShadow = shadow !== false; mesh.receiveShadow = true; W.add(mesh); return mesh;
  }
  function cyl(x, y, z0, z1, r, m, seg) {
    const mesh = new T.Mesh(new T.CylinderGeometry(r, r, z1 - z0, seg || 32), m);
    mesh.rotation.x = Math.PI / 2; mesh.position.set(x, y, (z0 + z1) / 2); mesh.castShadow = true; mesh.receiveShadow = true; W.add(mesh); return mesh;
  }
  function canvasTex(w, h, draw) { const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h); const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; return t; }

  const floorTex = canvasTex(1024, 768, (g, w, h) => {
    g.fillStyle = "#3a322b"; g.fillRect(0, 0, w, h);
    const rows = 26, rh = h / rows;
    for (let r = 0; r < rows; r++) {
      let x = -(r * 97 % 180);
      while (x < w) { const len = 140 + (r * 53 + Math.abs(x)) % 160, s = 0.9 + 0.2 * ((r * 7 + Math.floor(Math.abs(x))) % 5) / 5;
        g.fillStyle = `rgb(${Math.round(58 * s)},${Math.round(50 * s)},${Math.round(43 * s)})`; g.fillRect(x + 1, r * rh + 1, len - 2, rh - 2); x += len; }
    }
  });
  const floor = new T.Mesh(new T.PlaneGeometry(L, WD), new T.MeshStandardMaterial({ map: floorTex, roughness: 0.82, envMapIntensity: 0.1 }));
  floor.position.set(L / 2, WD / 2, 0); floor.receiveShadow = true; W.add(floor);
  const Wn = LAYOUT.window, D = LAYOUT.door;
  box(-0.1, -0.1, 0, WD + 0.1, 0, H, mWall);
  box(-0.1, WD, Wn.x0, WD + 0.1, 0, H, mWall); box(Wn.x1, WD, L + 0.1, WD + 0.1, 0, H, mWall);
  box(Wn.x0, WD, Wn.x1, WD + 0.1, 0, Wn.z0, mWall); box(Wn.x0, WD, Wn.x1, WD + 0.1, Wn.z1, H, mWall);
  box(L, -0.1, L + 0.1, D.y0, 0, 1.0, mWall); box(L, D.y1, L + 0.1, WD + 0.1, 0, 1.0, mWall);
  box(-0.1, -0.1, L + 0.1, 0, 0, 0.1, mWall);
  const mFrame = mat(0x2F2B27, { roughness: 0.5 });
  box(Wn.x0 - 0.04, WD - 0.04, Wn.x1 + 0.04, WD, Wn.z0 - 0.04, Wn.z0, mFrame); box(Wn.x0 - 0.04, WD - 0.04, Wn.x1 + 0.04, WD, Wn.z1, Wn.z1 + 0.04, mFrame);
  box(Wn.x0 - 0.04, WD - 0.04, Wn.x0, WD, Wn.z0, Wn.z1, mFrame); box(Wn.x1, WD - 0.04, Wn.x1 + 0.04, WD, Wn.z0, Wn.z1, mFrame);
  box(Wn.x0 - 0.1, WD - 0.18, Wn.x1 + 0.1, WD, Wn.z0 - 0.04, Wn.z0, mCounter);
  const paneHinge = new T.Group(); paneHinge.position.set(Wn.x0, WD - 0.02, Wn.z0); W.add(paneHinge);
  const pane = new T.Mesh(new T.PlaneGeometry(Wn.x1 - Wn.x0, Wn.z1 - Wn.z0), new T.MeshStandardMaterial({ color: 0xA8BACB, transparent: true, opacity: 0.16, roughness: 0.05, metalness: 0.2, side: T.DoubleSide }));
  pane.rotation.x = Math.PI / 2; pane.position.set((Wn.x1 - Wn.x0) / 2, 0, (Wn.z1 - Wn.z0) / 2); paneHinge.add(pane);
  const cityTex = canvasTex(1024, 512, (g, w, h) => {
    const sky = g.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, "#0d1016"); sky.addColorStop(0.55, "#3b2a1f"); sky.addColorStop(0.8, "#7a4a2a"); sky.addColorStop(1, "#2b1e16");
    g.fillStyle = sky; g.fillRect(0, 0, w, h);
    let x = 0, seed = 7; const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
    while (x < w) { const bw = 40 + rnd() * 90, bh = 90 + rnd() * 210; g.fillStyle = "#16120f"; g.fillRect(x, h - bh, bw, bh);
      for (let yy = h - bh + 12; yy < h - 10; yy += 18) for (let xx = x + 8; xx < x + bw - 8; xx += 14) if (rnd() < 0.3) { g.fillStyle = `rgba(255,${Math.round(180 + rnd() * 50)},${Math.round(110 + rnd() * 40)},${(0.35 + rnd() * 0.5).toFixed(2)})`; g.fillRect(xx, yy, 5, 7); }
      x += bw + 4; }
    g.fillStyle = "#120f0c";
    g.fillRect(610, h - 330, 34, 330); g.beginPath(); g.moveTo(604, h - 330); g.lineTo(627, h - 410); g.lineTo(650, h - 330); g.fill();
    g.fillRect(670, h - 290, 26, 290); g.beginPath(); g.moveTo(665, h - 290); g.lineTo(683, h - 345); g.lineTo(701, h - 290); g.fill();
  });
  const city = new T.Mesh(new T.PlaneGeometry(3.4, 1.9), new T.MeshBasicMaterial({ map: cityTex, fog: false, toneMapped: false }));
  city.rotation.x = Math.PI / 2; city.position.set((Wn.x0 + Wn.x1) / 2, WD + 0.9, 1.6); W.add(city);
  const hazeM = new T.MeshBasicMaterial({ color: 0x8a6a50, transparent: true, opacity: 0.3, fog: false, depthWrite: false });
  const haze = new T.Mesh(new T.PlaneGeometry(3.4, 1.9), hazeM); haze.rotation.x = Math.PI / 2; haze.position.set((Wn.x0 + Wn.x1) / 2, WD + 0.5, 1.6); W.add(haze);
  // kitchen
  box(0, 5.35, 2.8, 6, 0, 0.86, mCounter); box(0, 5.33, 2.8, 6, 0.86, 0.9, mTop);
  box(0, 3.4, 0.62, 4.05, 0, 1.85, mat(0xCFC9BE, { roughness: 0.45 }));
  box(0, 4.05, 0.62, 5.35, 0, 0.86, mCounter); box(0, 4.05, 0.64, 5.35, 0.86, 0.9, mTop);
  box(0, 5.68, 2.8, 6, 1.45, 2.15, mCounter);
  box(0.95, 5.38, 1.6, 5.88, 0.9, 0.912, mat(0x111111, { roughness: 0.1, metalness: 0.3 }));
  const burnerM = new T.MeshStandardMaterial({ color: 0x331a10, emissive: 0xff4a10, emissiveIntensity: 0, roughness: 0.4 });
  for (const [bx, by] of [[1.12, 5.55], [1.42, 5.72]]) { const b = new T.Mesh(new T.TorusGeometry(0.075, 0.007, 8, 40), burnerM); b.position.set(bx, by, 0.915); W.add(b); }
  cyl(1.12, 5.55, 0.915, 1.05, 0.11, mat(0x9A9389, { metalness: 0.7, roughness: 0.3 }), 32);
  box(0.9, 5.7, 1.65, 6, 1.95, 2.1, mat(0x46413B, { roughness: 0.5 }));
  // dining table, chairs, candle, pendant
  const TABLE_LEGS = [[3.2, 3.6], [4.75, 3.6], [3.2, 4.55], [4.75, 4.55]], CHAIRS = [[3.6, 3.45, -1], [4.4, 3.45, -1], [3.6, 4.75, 1], [4.4, 4.75, 1]];
  const CHAIR_LEGS = [[-0.17, -0.14], [0.15, -0.14], [-0.17, 0.12], [0.15, 0.12]], COFFEE_LEGS = [[5.03, 1.53], [6.13, 1.53], [5.03, 1.98], [6.13, 1.98]];
  box(3.15, 3.55, 4.85, 4.65, 0.72, 0.76, mWood);
  for (const [lx, ly] of TABLE_LEGS) box(lx, ly, lx + 0.05, ly + 0.05, 0, 0.72, mDarkWood);
  for (const [cx, cy, s] of CHAIRS) {
    box(cx - 0.2, cy - 0.17, cx + 0.2, cy + 0.17, 0.42, 0.46, mDarkWood);
    box(cx - 0.2, cy + s * 0.17 - 0.02, cx + 0.2, cy + s * 0.17 + 0.02, 0.46, 0.9, mDarkWood);
    for (const [dx, dy] of CHAIR_LEGS) box(cx + dx, cy + dy, cx + dx + 0.025, cy + dy + 0.025, 0, 0.42, mDarkWood, false);
  }
  cyl(4.0, 4.1, 0.76, 0.87, 0.03, mat(0xF2EDE4, { roughness: 0.6 }), 20);
  const flame = new T.Mesh(new T.ConeGeometry(0.014, 0.05, 12), new T.MeshBasicMaterial({ color: 0xffc070, toneMapped: false })); flame.rotation.x = Math.PI / 2; flame.position.set(4.0, 4.1, 0.9); W.add(flame);
  const shade = new T.Mesh(new T.CylinderGeometry(0.12, 0.26, 0.2, 40, 1, true), mat(0xD8CFC0, { side: T.DoubleSide, emissive: 0x3a2a18 })); shade.rotation.x = Math.PI / 2; shade.position.set(4.0, 4.1, 2.0); W.add(shade);
  // sofa, coffee table, rug
  box(4.5, 1.1, 6.8, 2.6, 0, 0.008, mat(0x4D443D, { roughness: 1 }), false);
  box(4.6, 0.15, 6.9, 1.05, 0, 0.42, mFabric); box(4.6, 0.15, 6.9, 0.38, 0.42, 0.86, mFabric);
  box(4.6, 0.15, 4.78, 1.05, 0.42, 0.62, mFabric); box(6.72, 0.15, 6.9, 1.05, 0.42, 0.62, mFabric);
  box(5.0, 1.5, 6.2, 2.05, 0.38, 0.42, mWood); for (const [lx, ly] of COFFEE_LEGS) box(lx, ly, lx + 0.04, ly + 0.04, 0, 0.38, mDarkWood, false);
  // bookshelf, books, the household monitor
  box(7.95, 1.2, 8, 4.3, 0, 1.9, mDarkWood);
  for (const z of [0, 0.45, 0.9, 1.35, 1.88]) box(7.62, 1.2, 8, 4.3, z, z + 0.025, mDarkWood);
  box(7.62, 1.2, 8, 1.23, 0, 1.9, mDarkWood); box(7.62, 4.27, 8, 4.3, 0, 1.9, mDarkWood);
  { let seed = 3; const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
    const tones = [0x7B3B2A, 0x2E4A6E, 0xB9A98F, 0x5E6B55, 0x3A3631, 0xA25B3A, 0xD6CCBB];
    for (const z of [0.025, 0.475, 0.925, 1.375]) { let y = 1.26; while (y < 4.2) { const bw = 0.03 + rnd() * 0.04, bh = 0.24 + rnd() * 0.14;
      if (!(z > 1 && z < 1.4 && y > 2.42 && y < 2.78)) box(7.66 + rnd() * 0.05, y, 7.94, y + bw, z, z + bh, mat(tones[Math.floor(rnd() * tones.length)], { roughness: 0.8 }), false);
      y += bw + 0.004 + (rnd() < 0.12 ? 0.12 : 0); } } }
  const monCanvas = document.createElement("canvas"); monCanvas.width = 256; monCanvas.height = 128;
  const monTex = new T.CanvasTexture(monCanvas); monTex.encoding = T.sRGBEncoding;
  box(7.66, 2.52, 7.8, 2.68, 1.375, 1.485, mShell);
  const monScreen = new T.Mesh(new T.PlaneGeometry(0.13, 0.08), new T.MeshBasicMaterial({ map: monTex, toneMapped: false }));
  monScreen.rotation.set(Math.PI / 2, 0, -Math.PI / 2, "ZYX"); monScreen.position.set(7.655, 2.6, 1.43); W.add(monScreen);
  // play mat with blocks, a plant by the window, the robot's dock
  box(2.7, 0.9, 4.3, 2.5, 0, 0.014, mat(0xCDB89A, { roughness: 1 }), false);
  for (const [bx, by, c] of [[3.0, 1.2, 0xB4532A], [3.12, 1.3, 0x2E4A6E], [3.9, 2.1, 0xD9A441]]) box(bx, by, bx + 0.08, by + 0.08, 0.014, 0.094, mat(c, { roughness: 0.6 }));
  cyl(6.75, 5.6, 0, 0.32, 0.16, mat(0x8D5B42, { roughness: 0.8 }), 24);
  for (const [dx, dy, dz, r] of [[0, 0, 0.62, 0.24], [0.1, 0.06, 0.82, 0.16], [-0.08, -0.05, 0.78, 0.18]]) { const s = new T.Mesh(new T.IcosahedronGeometry(r, 1), mat(0x56664A, { roughness: 1, flatShading: true })); s.position.set(6.75 + dx, 5.6 + dy, dz); s.castShadow = true; W.add(s); }
  box(7.62, 4.82, 7.82, 5.18, 0, 0.1, mDark); box(7.6, 4.9, 7.62, 5.1, 0.04, 0.06, new T.MeshBasicMaterial({ color: 0x7E98BC, toneMapped: false }), false);

  // people and the purifier, built standing up (y up) and stood in the room
  function person(p) {
    const outer = new T.Group(), g = new T.Group(); outer.add(g);
    if (p.id === "child") {
      const torso = new T.Mesh(new T.CapsuleGeometry(0.085, 0.16, 6, 14), mPerson); torso.position.y = 0.24; g.add(torso);
      const head = new T.Mesh(new T.SphereGeometry(0.085, 20, 14), mPerson); head.position.y = 0.46; g.add(head);
      for (const s of [-1, 1]) { const leg = new T.Mesh(new T.CapsuleGeometry(0.045, 0.22, 4, 8), mPerson); leg.rotation.z = Math.PI / 2; leg.position.set(0.14, 0.06, s * 0.06); g.add(leg); }
    } else {
      const torso = new T.Mesh(new T.CapsuleGeometry(0.14, 0.32, 6, 14), mPerson); torso.position.y = 0.76; g.add(torso);
      const head = new T.Mesh(new T.SphereGeometry(0.105, 20, 14), mPerson); head.position.y = 1.13; g.add(head);
      for (const s of [-1, 1]) {
        const leg = new T.Mesh(new T.CapsuleGeometry(0.06, 0.34, 4, 8), mPerson); leg.rotation.z = Math.PI / 2; leg.position.set(0.2, 0.47, s * 0.1); g.add(leg);
        const shin = new T.Mesh(new T.CapsuleGeometry(0.05, 0.32, 4, 8), mPerson); shin.position.set(0.4, 0.23, s * 0.1); g.add(shin);
      }
    }
    g.rotation.set(Math.PI / 2, Math.PI / 2, 0);                   // face into the room (+y), then stand up
    g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    outer.position.set(p.x, p.y, 0); W.add(outer);
    const ringM = new T.MeshBasicMaterial({ color: 0x7E98BC, transparent: true, opacity: 0.85, side: T.DoubleSide, depthWrite: false, toneMapped: false });
    const ring = new T.Mesh(new T.RingGeometry(0.34, 0.38, 64), ringM); ring.position.set(p.x, p.y, 0.02); W.add(ring);
    return { ringM };
  }
  const people = LAYOUT.people.map(person);
  const pur = new T.Group(), purIn = new T.Group(); purIn.rotation.x = Math.PI / 2; pur.add(purIn); W.add(pur);
  const purBody = new T.Mesh(new T.CylinderGeometry(0.17, 0.18, 0.62, 48), mShell); purBody.position.y = 0.31; purBody.castShadow = true; purIn.add(purBody);
  const purTop = new T.Mesh(new T.CylinderGeometry(0.15, 0.15, 0.012, 48), mDark); purTop.position.y = 0.625; purIn.add(purTop);
  const purRingM = new T.MeshStandardMaterial({ color: 0x2E4A6E, emissive: 0x7E98BC, emissiveIntensity: 0 });
  const purRing = new T.Mesh(new T.TorusGeometry(0.172, 0.006, 8, 64), purRingM); purRing.rotation.x = Math.PI / 2; purRing.position.y = 0.6; purIn.add(purRing);
  const fan = new T.Group(); fan.position.y = 0.635; purIn.add(fan);
  for (let k = 0; k < 5; k++) { const b = new T.Mesh(new T.BoxGeometry(0.12, 0.004, 0.035), mat(0x6E675E)); b.position.x = 0.06; const hold = new T.Group(); hold.rotation.y = k * 2 * Math.PI / 5; hold.add(b); fan.add(hold); }
  const intake = new T.Mesh(new T.CylinderGeometry(0.182, 0.182, 0.22, 48, 1, true), mat(0x7B746B, { side: T.DoubleSide, roughness: 1 })); intake.position.y = 0.16; purIn.add(intake);

  // ---------------------------------------------------------------- what the laser sees and what the robot bumps into
  const LASER = { n: 360, rmin: 0.2, rmax: 8, sigma: 0.01, rate: 10 };
  const SEGS = [[0, 0, L, 0], [0, 0, 0, WD], [0, WD, L, WD], [L, 0, L, D.y0], [L, D.y1, L, WD]];       // walls; the doorway is open
  const BOXES = [[0, 5.35, 2.8, 6], [0, 3.4, 0.62, 5.35], [4.6, 0.15, 6.9, 1.05], [7.62, 1.2, 8, 4.3]];    // solid to the floor at the laser's height
  for (const [lx, ly] of TABLE_LEGS) BOXES.push([lx, ly, lx + 0.05, ly + 0.05]);                         // tables: the laser sees their legs
  for (const [cx, cy] of CHAIRS) for (const [dx, dy] of CHAIR_LEGS) BOXES.push([cx + dx, cy + dy, cx + dx + 0.025, cy + dy + 0.025]);
  for (const [lx, ly] of COFFEE_LEGS) BOXES.push([lx, ly, lx + 0.04, ly + 0.04]);
  const STILL = [[3.5, 1.7, 0.15], [5.65, 1.02, 0.05], [5.85, 1.02, 0.05], [6.75, 5.6, 0.16]];              // the child, the adult's shins, the plant pot
  const BODIES = [[3.5, 1.7, 0.2], [5.75, 1.1, 0.13], [6.75, 5.6, 0.17]];                                 // for collisions
  function rayBox(ox, oy, dx, dy, b) {
    let t0 = -Infinity, t1 = Infinity;
    for (const [o, d, lo, hi] of [[ox, dx, b[0], b[2]], [oy, dy, b[1], b[3]]]) {
      if (Math.abs(d) < 1e-12) { if (o < lo || o > hi) return Infinity; continue; }
      let a = (lo - o) / d, c = (hi - o) / d; if (a > c) { const s = a; a = c; c = s; }
      t0 = Math.max(t0, a); t1 = Math.min(t1, c); if (t0 > t1) return Infinity;
    }
    return t0 > 0 ? t0 : Infinity;
  }
  function rayCircle(ox, oy, dx, dy, cx, cy, r) {
    const fx = ox - cx, fy = oy - cy, b = fx * dx + fy * dy, c = fx * fx + fy * fy - r * r, disc = b * b - c;
    if (disc < 0) return Infinity; const t = -b - Math.sqrt(disc); return t > 0 ? t : Infinity;
  }
  function raySeg(ox, oy, dx, dy, s) {
    const ex = s[2] - s[0], ey = s[3] - s[1], den = dx * ey - dy * ex;
    if (Math.abs(den) < 1e-12) return Infinity;
    const t = ((s[0] - ox) * ey - (s[1] - oy) * ex) / den, u = ((s[0] - ox) * dy - (s[1] - oy) * dx) / den;
    return t > 0 && u >= 0 && u <= 1 ? t : Infinity;
  }
  function castRay(ox, oy, a, pu) {
    const dx = Math.cos(a), dy = Math.sin(a); let t = Infinity;
    for (const s of SEGS) t = Math.min(t, raySeg(ox, oy, dx, dy, s));
    for (const b of BOXES) t = Math.min(t, rayBox(ox, oy, dx, dy, b));
    for (const c of STILL) t = Math.min(t, rayCircle(ox, oy, dx, dy, c[0], c[1], c[2]));
    return Math.min(t, rayCircle(ox, oy, dx, dy, pu.x, pu.y, 0.18));
  }
  function free(x, y, R) {
    if (x < R || y < R || x > L - R || y > WD - R) return false;
    for (const o of LAYOUT.obstacles) { const dx = Math.max(o[0] - x, 0, x - o[2]), dy = Math.max(o[1] - y, 0, y - o[3]); if (dx * dx + dy * dy < R * R) return false; }
    for (const c of BODIES) if (Math.hypot(x - c[0], y - c[1]) < R + c[2]) return false;
    const pu = world.air.cfg.purifier; return Math.hypot(x - pu.x, y - pu.y) >= R + 0.18;
  }

  // ---------------------------------------------------------------- the air: a slice at the nose and drifting particles (as section 06)
  const sliceData = new Uint8Array(NX * NY * 4), sliceTex = new T.DataTexture(sliceData, NX, NY, T.RGBAFormat);
  sliceTex.magFilter = sliceTex.minFilter = T.LinearFilter; sliceTex.encoding = T.sRGBEncoding; sliceTex.needsUpdate = true;
  const sliceM = new T.MeshBasicMaterial({ map: sliceTex, transparent: true, opacity: 0.45, side: T.DoubleSide, depthWrite: false, fog: false, toneMapped: false });
  const slice = new T.Mesh(new T.PlaneGeometry(L, WD), sliceM); slice.position.set(L / 2, WD / 2, 1); slice.renderOrder = 2; W.add(slice);
  const NP = window.innerWidth < 900 ? 1100 : 2200, NCELL = NX * NY * NZ;
  const pp = new Float32Array(NP * 3), pCol = new Float32Array(NP * 3), pA = new Float32Array(NP), pS = new Float32Array(NP);
  const pg = new T.BufferGeometry();
  pg.setAttribute("position", new T.BufferAttribute(pp, 3)); pg.setAttribute("aColor", new T.BufferAttribute(pCol, 3));
  pg.setAttribute("aAlpha", new T.BufferAttribute(pA, 1)); pg.setAttribute("aSize", new T.BufferAttribute(pS, 1));
  const pMat = new T.ShaderMaterial({
    uniforms: { uScale: { value: 600 } }, transparent: true, depthWrite: false,
    vertexShader: "attribute vec3 aColor; attribute float aAlpha; attribute float aSize; uniform float uScale; varying vec3 vC; varying float vA;" +
      "void main(){ vC = aColor; vA = aAlpha; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = clamp(aSize * uScale / -mv.z, 1.5, 14.0); gl_Position = projectionMatrix * mv; }",
    fragmentShader: "varying vec3 vC; varying float vA; void main(){ vec2 d = gl_PointCoord - 0.5; float r = dot(d, d); if (r > 0.25) discard; gl_FragColor = vec4(vC, vA * smoothstep(0.25, 0.02, r)); }",
  });
  const points = new T.Points(pg, pMat); points.frustumCulled = false; points.renderOrder = 3; W.add(points);
  const cdf = new Float32Array(NCELL); let cdfTotal = 0;
  function buildCdf(C) { let s = 0; for (let n = 0; n < NCELL; n++) { s += C[n]; cdf[n] = s; } cdfTotal = s; }
  function placeParticle(q) {
    const u = Math.random() * cdfTotal; let lo = 0, hi = NCELL - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (cdf[mid] < u) lo = mid + 1; else hi = mid; }
    const i = lo % NX, j = Math.floor(lo / NX) % NY, k = Math.floor(lo / (NX * NY));
    pp[3 * q] = (i + Math.random()) * S.DX; pp[3 * q + 1] = (j + Math.random()) * S.DY; pp[3 * q + 2] = Math.max(0.03, (k + Math.random()) * S.DZ);
  }
  for (let q = 0; q < NP; q++) pS[q] = 0.016 + 0.022 * Math.random();
  function updateParticles(dt) {
    const air = world.air, cfg = air.cfg, pu = cfg.purifier;
    if (dt > 0) {
      const sub = Math.max(1, Math.ceil(dt / 0.6)), hh = dt / sub, sig = Math.sqrt(2 * S.PHYS.K * hh);
      const g3 = () => (Math.random() + Math.random() + Math.random() - 1.5) * 2;
      for (let s = 0; s < sub; s++) for (let q = 0; q < NP; q++) {
        const i3 = 3 * q, x = pp[i3], y = pp[i3 + 1], z = pp[i3 + 2], vel = air.velocity(x, y, z);
        let nx = x + vel[0] * hh + sig * g3(), ny = y + vel[1] * hh + sig * g3(), nz = z + vel[2] * hh + sig * g3();
        if (nx < 0.02) nx = 0.04 - nx; if (nx > L - 0.02) nx = 2 * (L - 0.02) - nx;
        if (ny < 0.02) ny = 0.04 - ny; if (ny > WD - 0.02) ny = 2 * (WD - 0.02) - ny;
        if (nz < 0.03) nz = 0.06 - nz; if (nz > H - 0.02) nz = 2 * (H - 0.02) - nz;
        pp[i3] = clamp(nx, 0.02, L - 0.02); pp[i3 + 1] = clamp(ny, 0.02, WD - 0.02); pp[i3 + 2] = clamp(nz, 0.03, H - 0.02);
      }
      const k = NP * Math.min(0.3, dt / 90), nRel = Math.floor(k) + (Math.random() < k % 1 ? 1 : 0);
      for (let r = 0; r < nRel; r++) placeParticle(Math.floor(Math.random() * NP));
      if (cfg.purifierOn) for (let q = 0; q < NP; q++) { const i3 = 3 * q; if (pp[i3 + 2] < 0.75 && Math.hypot(pp[i3] - pu.x, pp[i3 + 1] - pu.y) < 0.3) placeParticle(q); }
      if (sampling()) {                                            // the nose breathes in what is next to it
        const n3 = bot.nose3;
        for (let q = 0; q < NP; q++) { const i3 = 3 * q, dx = pp[i3] - n3.x, dy = pp[i3 + 1] - n3.y, dz = pp[i3 + 2] - n3.z, d2 = dx * dx + dy * dy + dz * dz;
          if (d2 < 0.25) { const f = Math.min(0.9, 1.6 * dt / Math.max(0.04, Math.sqrt(d2))); pp[i3] -= dx * f; pp[i3 + 1] -= dy * f; pp[i3 + 2] -= dz * f; if (d2 < 0.0016) placeParticle(q); } }
      }
    }
    for (let q = 0; q < NP; q++) {
      const i3 = 3 * q, t = tC(air.at(pp[i3], pp[i3 + 1], pp[i3 + 2])), c = CONC(0.25 + 0.75 * t);
      pCol[i3] = c[0] / 255; pCol[i3 + 1] = c[1] / 255; pCol[i3 + 2] = c[2] / 255; pA[q] = 0.08 + 0.7 * t;
    }
    pg.attributes.position.needsUpdate = true; pg.attributes.aColor.needsUpdate = true; pg.attributes.aAlpha.needsUpdate = true;
  }
  function paintSlice() {
    const z = clamp(bot.nose, 0.1, H - 0.1), truth = world.air.plane(z);
    for (let q = 0; q < NX * NY; q++) { const t = tC(truth[q]), c = CONC(t); sliceData[4 * q] = c[0]; sliceData[4 * q + 1] = c[1]; sliceData[4 * q + 2] = c[2]; sliceData[4 * q + 3] = 12 + 170 * t * t; }
    sliceTex.needsUpdate = true; slice.position.z = z;
  }

  // ---------------------------------------------------------------- overlays: laser, path, trail, samples, target, hot spot, the laser's map
  const C3 = h => new T.Color(h);
  const lineM = (c, o) => new T.LineBasicMaterial(Object.assign({ color: c, transparent: true, toneMapped: false }, o || {}));
  const scanPos = new Float32Array(LASER.n * 6), hitPos = new Float32Array(LASER.n * 3), scanGeo = new T.BufferGeometry(), hitGeo = new T.BufferGeometry();
  scanGeo.setAttribute("position", new T.BufferAttribute(scanPos, 3)); hitGeo.setAttribute("position", new T.BufferAttribute(hitPos, 3));
  const scanLines = new T.LineSegments(scanGeo, lineM(0x7E98BC, { opacity: 0.1 }));
  const scanHits = new T.Points(hitGeo, new T.PointsMaterial({ color: C3(0xD9875C), size: 0.04, transparent: true, opacity: 0.95, toneMapped: false }));
  scanLines.frustumCulled = scanHits.frustumCulled = false; W.add(scanLines, scanHits);
  function liveLine(max, material) {
    const g = new T.BufferGeometry(), pos = new Float32Array(max * 3), dist = new Float32Array(max);
    g.setAttribute("position", new T.BufferAttribute(pos, 3)); g.setAttribute("lineDistance", new T.BufferAttribute(dist, 1)); g.setDrawRange(0, 0);
    const line = new T.Line(g, material); line.frustumCulled = false;
    line.set = pts => {
      const n = Math.min(max, pts.length); let d = 0;
      for (let i = 0; i < n; i++) { pos[3 * i] = pts[i][0]; pos[3 * i + 1] = pts[i][1]; pos[3 * i + 2] = pts[i][2]; if (i) d += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); dist[i] = d; }
      g.setDrawRange(0, n); g.attributes.position.needsUpdate = true; g.attributes.lineDistance.needsUpdate = true;
    };
    W.add(line); return line;
  }
  const pathLine = liveLine(64, new T.LineDashedMaterial({ color: 0x9fb4d2, dashSize: 0.12, gapSize: 0.08, transparent: true, opacity: 0.95, toneMapped: false }));
  const trailLine = liveLine(600, lineM(0x77716a, { opacity: 0.6 })), trail = [];
  const tgt = new T.Group(); W.add(tgt);
  const tgtRing = new T.Mesh(new T.RingGeometry(0.22, 0.25, 48), new T.MeshBasicMaterial({ color: 0x9fb4d2, transparent: true, opacity: 0.9, side: T.DoubleSide, depthWrite: false, toneMapped: false })); tgtRing.position.z = 0.02; tgt.add(tgtRing);
  const MAXS = 140, sampMesh = new T.InstancedMesh(new T.SphereGeometry(0.035, 12, 10), new T.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), MAXS);
  sampMesh.instanceMatrix.setUsage(T.DynamicDrawUsage); sampMesh.count = 0; sampMesh.frustumCulled = false; W.add(sampMesh);
  const hotRing = new T.Mesh(new T.RingGeometry(0.42, 0.46, 64), new T.MeshBasicMaterial({ color: 0xD9875C, transparent: true, opacity: 0, side: T.DoubleSide, depthWrite: false, toneMapped: false })); W.add(hotRing);
  const OG = { res: 0.05, w: Math.round(L / 0.05), h: Math.round(WD / 0.05), known: 0 };
  OG.lo = new Float32Array(OG.w * OG.h); OG.canvas = document.createElement("canvas"); OG.canvas.width = OG.w; OG.canvas.height = OG.h;
  OG.ctx = OG.canvas.getContext("2d"); OG.img = OG.ctx.createImageData(OG.w, OG.h);
  const ogTex = new T.CanvasTexture(OG.canvas); ogTex.encoding = T.sRGBEncoding; ogTex.magFilter = T.NearestFilter; ogTex.flipY = false;
  const ogMesh = new T.Mesh(new T.PlaneGeometry(L, WD), new T.MeshBasicMaterial({ map: ogTex, transparent: true, depthWrite: false, toneMapped: false }));
  ogMesh.position.set(L / 2, WD / 2, 0.006); ogMesh.renderOrder = 1; ogMesh.visible = false; W.add(ogMesh);
  const collG = new T.Group(); collG.visible = false; W.add(collG);               // the world's collision shapes
  { const m = lineM(0x7E98BC, { opacity: 0.55 });
    for (const o of LAYOUT.obstacles) { const e = new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(o[2] - o[0], o[3] - o[1], o[4])), m); e.position.set((o[0] + o[2]) / 2, (o[1] + o[3]) / 2, o[4] / 2); collG.add(e); }
    for (const c of BODIES) { const e = new T.LineSegments(new T.EdgesGeometry(new T.CylinderGeometry(c[2], c[2], 0.5, 24)), m); e.rotation.x = Math.PI / 2; e.position.set(c[0], c[1], 0.25); collG.add(e); } }

  // ---------------------------------------------------------------- the robot: Antonio's CAD, articulated
  const RB = { radius: 0.21, lift: 0.025, wheelR: 0.03, track: 0.364, lidarZ: 0.17, vMax: 0.3, wMax: 1.6, aMax: 0.5, alpha: 3, mastV: 0.25,
               top: 0.35, travel: 1.28, noseMid: 1.66, noseTop: 1.69, noseMin: 0.405 };
  const robot = { root: new T.Group(), base: new T.Group(), wheels: [], stages: [], sniffer: new T.Group(), parts: [], frames: [], colls: [], source: "cad" };
  robot.root.add(robot.base, robot.sniffer); W.add(robot.root);
  const noseRing = new T.Mesh(new T.TorusGeometry(0.075, 0.004, 8, 48), new T.MeshBasicMaterial({ color: 0xD9875C, transparent: true, opacity: 0, toneMapped: false }));
  robot.sniffer.add(noseRing);
  const noseOf = e => RB.noseMin + RB.travel * clamp(e, 0, 1), extOf = h => clamp((h - RB.noseMin) / RB.travel, 0, 1);
  const STUDIO = {
    shell: () => new T.MeshPhysicalMaterial({ color: 0xEEE9E0, roughness: 0.34, clearcoat: 0.55, clearcoatRoughness: 0.28 }),
    band: () => new T.MeshPhysicalMaterial({ color: 0x2A2724, roughness: 0.5, metalness: 0.15, clearcoat: 0.3 }),
    port: () => new T.MeshPhysicalMaterial({ color: 0x151413, roughness: 0.22, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.08 }),
    lens: () => new T.MeshPhysicalMaterial({ color: 0x2E4A6E, roughness: 0.16, metalness: 0.35, emissive: 0x7E98BC, emissiveIntensity: 0.35, clearcoat: 1 }),
    tyre: () => new T.MeshStandardMaterial({ color: 0x23201D, roughness: 0.9 }),
    caster: () => new T.MeshStandardMaterial({ color: 0x46413B, roughness: 0.32, metalness: 0.7 }),
    mast: k => new T.MeshPhysicalMaterial({ color: [0xC9C3B9, 0xBDB7AD, 0xB1ABA1, 0xA59F95][k] || 0xB1ABA1, roughness: 0.3, metalness: 0.85, clearcoat: 0.2 }),
    lid: () => new T.MeshPhysicalMaterial({ color: 0xB4532A, roughness: 0.4, metalness: 0.05, clearcoat: 0.6, emissive: 0xB4532A, emissiveIntensity: 0.05 }),
  };
  const manifestPart = (file, matName) => {
    const f = (CAD.files || []).find(x => x.file === file);
    return (f && f.parts.find(p => p.freecad && p.freecad.object === matName)) || (f && f.parts.find(p => p.name === matName)) || null;
  };
  function addPart(mesh, file) {
    const m0 = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material, matName = (m0 && m0.name) || mesh.name;
    const info = manifestPart(file, matName) || {}, label = info.name || matName, body = (info.freecad && info.freecad.body) || null;
    const geo = mesh.geometry.clone(); geo.applyMatrix4(mesh.matrixWorld); geo.computeBoundingBox();
    const bb = geo.boundingBox, c = bb.getCenter(new T.Vector3()), sz = bb.getSize(new T.Vector3());
    const lum = m0 && m0.color ? (m0.color.r + m0.color.g + m0.color.b) / 3 : 0.5;
    let link = "base", role;
    if (/sniffer/i.test(file)) { link = "sniffer"; role = lum > 0.8 ? "shell" : "lid"; }
    else if (/cilindro/i.test(file)) { link = "stage"; role = "mast"; }
    else if (/wheel/i.test(body || label) || (sz.x < 0.03 && sz.z > 0.04 && Math.abs(c.x) > 0.12)) { link = "wheel"; role = "tyre"; }
    else if (/^fusion/i.test(label)) role = "caster";
    else role = lum > 0.8 ? "shell" : lum < 0.1 ? "port" : sz.x < 0.08 ? "lens" : "band";
    const part = { file, label, object: matName, body, link, role, tris: (geo.index ? geo.index.count : geo.attributes.position.count) / 3, bb: bb.clone(), center: c, size: sz,
                   color: info.color || (m0 && m0.color ? m0.color.toArray().map(v => +v.toFixed(3)) : null), cad: m0 || new T.MeshStandardMaterial(), offset: new T.Vector3() };
    part.mesh = new T.Mesh(geo, part.cad); part.mesh.castShadow = true; part.mesh.receiveShadow = true; part.mesh.userData.part = part;
    robot.parts.push(part); return part;
  }
  function assemble() {
    const stages = robot.parts.filter(p => p.link === "stage").sort((a, b) => a.bb.min.z - b.bb.min.z);
    stages.forEach((p, k) => { p.stage = k; p.studio = STUDIO.mast(k); const g = new T.Group(); g.add(p.mesh); robot.root.add(g); robot.stages.push({ g, part: p }); });
    for (const p of robot.parts) {
      if (p.link === "stage") continue;
      p.studio = STUDIO[p.role]();
      if (p.link === "wheel") { const piv = new T.Group(); piv.position.copy(p.center); p.mesh.position.copy(p.center).negate(); p.base = p.mesh.position.clone(); piv.add(p.mesh); robot.root.add(piv); robot.wheels.push({ piv, part: p, side: p.center.x > 0 ? 1 : -1, phi: 0 }); }
      else if (p.link === "sniffer") robot.sniffer.add(p.mesh);
      else robot.base.add(p.mesh);
    }
    const wh = robot.wheels.map(w => w.part);                       // the dimensions come from the CAD itself
    if (wh.length === 2) { RB.wheelR = wh[0].size.z / 2; RB.track = Math.abs(wh[0].center.x - wh[1].center.x); RB.lift = -Math.min(wh[0].bb.min.z, wh[1].bb.min.z); }
    let r = 0; robot.parts.filter(p => p.link === "base").forEach(p => { r = Math.max(r, Math.abs(p.bb.min.x), Math.abs(p.bb.max.x), Math.abs(p.bb.min.y), Math.abs(p.bb.max.y)); });
    if (r) RB.radius = r;
    const band = robot.parts.find(p => p.role === "band"); if (band) RB.lidarZ = band.center.z + RB.lift;
    if (stages.length) { RB.top = stages[0].bb.min.z; RB.travel = stages[stages.length - 1].bb.max.z - RB.top; }
    const sn = robot.parts.filter(p => p.link === "sniffer");
    if (sn.length) { const b = new T.Box3(); sn.forEach(p => b.union(p.bb)); RB.noseMid = (b.min.z + b.max.z) / 2; RB.noseTop = b.max.z; RB.snifferR = b.getSize(new T.Vector3()).x / 2; }
    RB.noseMin = RB.noseMid - RB.travel + RB.lift;
    noseRing.position.set(0, 0, RB.noseMid);
    // the ROS frames and the collision shapes, for the Frames and Collisions views
    const axes = (s, parent, pos) => { const a = new T.AxesHelper(s); a.setColors(C3(0xD9875C), C3(0x8DA37A), C3(0x7E98BC)); a.material.toneMapped = false; a.material.depthTest = false; a.renderOrder = 9; if (pos) a.position.copy(pos); a.visible = false; parent.add(a); robot.frames.push(a); };
    axes(0.28, robot.root, new T.Vector3(0, 0, -RB.lift + 0.002));
    axes(0.12, robot.root, new T.Vector3(0, 0, RB.lidarZ - RB.lift));
    robot.wheels.forEach(w => axes(0.08, w.piv));
    robot.stages.forEach(s => axes(0.07, s.g, new T.Vector3(0, 0, s.part.bb.min.z)));
    axes(0.09, robot.sniffer, new T.Vector3(0, 0, RB.noseMid));
    const cm = lineM(0xD9875C, { opacity: 0.75 });
    const cylEdges = (rad, z0, z1, parent) => { const e = new T.LineSegments(new T.EdgesGeometry(new T.CylinderGeometry(rad, rad, z1 - z0, 28)), cm); e.rotation.x = Math.PI / 2; e.position.z = (z0 + z1) / 2; e.visible = false; parent.add(e); robot.colls.push(e); };
    cylEdges(RB.radius, -RB.lift + 0.01, RB.top, robot.root);
    robot.stages.forEach(s => cylEdges(s.part.size.x / 2, s.part.bb.min.z, s.part.bb.max.z, s.g));
    if (sn.length) cylEdges(RB.snifferR, RB.noseMid - 0.03, RB.noseTop, robot.sniffer);
    setSkin(skin);
  }
  function standIn() {                                            // if the CAD cannot be loaded: the same robot from primitives
    robot.source = "stand-in";
    const shell = () => new T.MeshPhongMaterial({ color: 0xffffff }), grey = () => new T.MeshPhongMaterial({ color: 0x818181 });
    const add = (geo, file, name, m) => { m.name = name; const mesh = new T.Mesh(geo, m); mesh.updateMatrixWorld(true); return addPart(mesh, file); };
    const up = (r0, r1, h, z) => new T.CylinderGeometry(r0, r1, h, 48).rotateX(Math.PI / 2).translate(0, 0, z);
    add(up(0.21, 0.21, 0.14, 0.07), "Oddech.dae", "lower body", shell());
    add(up(0.19, 0.19, 0.05, 0.145), "Oddech.dae", "band", grey());
    add(up(0.2, 0.209, 0.18, 0.26), "Oddech.dae", "upper body", shell());
    for (const s of [-1, 1]) add(new T.CylinderGeometry(0.03, 0.03, 0.01, 32).rotateZ(Math.PI / 2).translate(s * 0.182, 0, 0.005), "Oddech.dae", s < 0 ? "LWheel" : "RWheel", grey());
    [0.03, 0.025, 0.02, 0.015].forEach((r, k) => add(up(r, r, 0.32, 0.51 + 0.32 * k), `Oddech-Cilindro${k ? "00" + k : ""}.dae`, "stage " + (k + 1), grey()));
    add(up(0.035, 0.035, 0.05, 1.655), "Oddech_sniffer.dae", "chamber", shell());
    add(up(0.035, 0.035, 0.01, 1.685), "Oddech_sniffer.dae", "lid", grey());
    assemble();
  }
  let skin = "studio", explode = 0, explodeT = 0;
  function setSkin(s) { skin = s; for (const p of robot.parts) p.mesh.material = s === "studio" ? p.studio : p.cad; markSelection(); }
  function explodeOffsets() {                                     // where each part goes in the exploded view (CAD frame, metres)
    for (const p of robot.parts) {
      const o = p.offset.set(0, 0, 0), c = p.center;
      if (p.link === "wheel") o.x = Math.sign(c.x) * 0.16;
      else if (p.link === "stage") o.z = 0.09 * (p.stage + 1);
      else if (p.link === "sniffer") o.z = 0.5;
      else if (p.role === "caster") { o.z = -0.06; o.y = Math.sign(c.y) * 0.08; }
      else if (p.role === "port" || p.role === "lens") { o.y = Math.sign(c.y) * 0.16; o.z = 0.26; }
      else if (p.role === "band") o.z = 0.12;
      else if (p.role === "shell" && c.z > 0.15) o.z = 0.26;
    }
  }

  // ---------------------------------------------------------------- state
  let world, scenario = "candle", mode = "oddech", speed = 1, playing = true, stepLeft = 0, purMode = "auto";
  const bot = { x: 0, y: 0, th: 0, v: 0, w: 0, e: 0, eT: 0, nose: 0.4, nose3: new T.Vector3(), bump: 0, odom: { x: 0, y: 0, th: 0 }, imu: { ax: 0, wz: 0 } };
  const keys = {}, hist = [];                                      // hist: one row a simulated second, for the plots
  const show = { air: true, particles: true, laser: true, map: false, path: true, frames: false, collision: false };
  const sampling = () => { const r = world && world.live.robot; return !!r && r.state === "sample" && Math.abs(r.mast - S.MAST[Math.min(2, r.hIdx)]) < 0.01; };

  // ---------------------------------------------------------------- topics, as the package names them (and a few this simulator adds)
  const TOPICS = [
    { n: "/clock", ty: "rosgraph_msgs/Clock", src: "bridge" },
    { n: "/cmd_vel", ty: "geometry_msgs/Twist", p: 0.05, src: "bridge" },
    { n: "/odom", ty: "nav_msgs/Odometry", p: 0.05, src: "bridge" },
    { n: "/joint_states", ty: "sensor_msgs/JointState", p: 0.05, src: "bridge" },
    { n: "/tf", ty: "tf2_msgs/TFMessage", p: 0.05, src: "bridge" },
    { n: "/imu", ty: "sensor_msgs/Imu", p: 0.02, src: "bridge" },
    { n: "/scan", ty: "sensor_msgs/LaserScan", p: 1 / LASER.rate, src: "bridge" },
    { n: "/mast/cmd", ty: "std_msgs/Float64", src: "bridge" },
    { n: "/map", ty: "nav_msgs/OccupancyGrid", p: 1, src: "sim" },
    { n: "/oddech/pm25", ty: "oddech_msgs/Aerosol", p: 1, src: "sim" },
    { n: "/oddech/cells", ty: "oddech_msgs/CellReading", src: "sim" },
    { n: "/oddech/plan", ty: "nav_msgs/Path", src: "sim" },
    { n: "/oddech/advice", ty: "std_msgs/String", src: "sim" },
    { n: "/battery_state", ty: "sensor_msgs/BatteryState", p: 1, src: "sim" },
  ];
  const topic = {}; TOPICS.forEach(t => { topic[t.n] = Object.assign(t, { last: null, count: 0 }); });
  let selTopic = "/oddech/pm25";
  function publish(name, msg, n) { const t = topic[name]; if (msg !== undefined) t.last = msg; t.count += n || 1; }
  const ticks = (period, t0, t1) => Math.floor(t1 / period) - Math.floor(t0 / period);

  // ---------------------------------------------------------------- the laser, its map, odometry
  const scan = { ranges: new Float32Array(LASER.n), nearest: [9, 0] };
  function laser() {
    const pu = world.air.cfg.purifier, ox = bot.x, oy = bot.y, z = RB.lidarZ; let best = 9, at = 0;
    for (let i = 0; i < LASER.n; i++) {
      const rel = -Math.PI + 2 * Math.PI * i / LASER.n, a = bot.th + rel;
      let r = castRay(ox, oy, a, pu) + LASER.sigma * gauss();
      if (!(r < LASER.rmax)) r = Infinity;
      scan.ranges[i] = r;
      if (r < best && r >= LASER.rmin) { best = r; at = rel; }
      const d = isFinite(r) ? r : LASER.rmax, hx = ox + Math.cos(a) * d, hy = oy + Math.sin(a) * d;
      scanPos[6 * i] = ox; scanPos[6 * i + 1] = oy; scanPos[6 * i + 2] = z; scanPos[6 * i + 3] = hx; scanPos[6 * i + 4] = hy; scanPos[6 * i + 5] = z;
      hitPos[3 * i] = isFinite(r) ? hx : ox; hitPos[3 * i + 1] = isFinite(r) ? hy : oy; hitPos[3 * i + 2] = isFinite(r) ? z : -5;
    }
    scan.nearest = [best, at];
    scanGeo.attributes.position.needsUpdate = true; hitGeo.attributes.position.needsUpdate = true;
    integrateScan(ox, oy, bot.th);
  }
  function integrateScan(ox, oy, th) {                             // log-odds occupancy at the true pose: localisation is assumed
    const lo = OG.lo, res = OG.res, step = res / 2;
    for (let i = 0; i < LASER.n; i++) {
      const r = scan.ranges[i], a = th - Math.PI + 2 * Math.PI * i / LASER.n, hit = isFinite(r), end = hit ? r : LASER.rmax * 0.6;
      const dx = Math.cos(a), dy = Math.sin(a); let last = -1;
      for (let s = 0; s < end - step; s += step) {
        const cx = Math.floor((ox + dx * s) / res), cy = Math.floor((oy + dy * s) / res);
        if (cx < 0 || cy < 0 || cx >= OG.w || cy >= OG.h) break;
        const k = cx + OG.w * cy; if (k !== last) { lo[k] = Math.max(-3, lo[k] - 0.4); last = k; }
      }
      if (hit) { const cx = Math.floor((ox + dx * r) / res), cy = Math.floor((oy + dy * r) / res);
        if (cx >= 0 && cy >= 0 && cx < OG.w && cy < OG.h) { const k = cx + OG.w * cy; lo[k] = Math.min(3.5, lo[k] + 0.9); } }
    }
  }
  function paintMap() {
    const d = OG.img.data, lo = OG.lo; let known = 0;
    for (let k = 0; k < OG.w * OG.h; k++) {
      const q = 4 * k, v = lo[k];
      if (v > 0.6) { d[q] = 237; d[q + 1] = 232; d[q + 2] = 223; d[q + 3] = 235; known++; }
      else if (v < -0.6) { d[q] = 126; d[q + 1] = 152; d[q + 2] = 188; d[q + 3] = 46; known++; }
      else d[q + 3] = 0;
    }
    OG.ctx.putImageData(OG.img, 0, 0); ogTex.needsUpdate = true; OG.known = known / (OG.w * OG.h);
  }
  const ODO = { kl: 1.004, kr: 0.997, sig: 0.004 };                // wheel odometry: slightly unequal wheels and a little slip
  function odometry(dl, dr) {
    const sl = dl * RB.wheelR * ODO.kl * (1 + ODO.sig * gauss()), sr = dr * RB.wheelR * ODO.kr * (1 + ODO.sig * gauss());
    const ds = (sl + sr) / 2, dth = (sr - sl) / RB.track, o = bot.odom;
    o.x += ds * Math.cos(o.th + dth / 2); o.y += ds * Math.sin(o.th + dth / 2); o.th = wrap(o.th + dth);
  }

  // ---------------------------------------------------------------- one step of simulated time
  function turnWheels(ds, dth) {                                  // left = the robot's left, facing its round port (CAD -y)
    const dl = (ds - dth * RB.track / 2) / RB.wheelR, dr = (ds + dth * RB.track / 2) / RB.wheelR;
    for (const w of robot.wheels) w.phi += w.side > 0 ? dl : dr;
    odometry(dl, dr);
  }
  function teleop(dt) {
    const r = world.live.robot, busy = r.state === "sample" || r.state === "retract";
    let vT = 0, wT = 0;
    if (!busy) { if (keys.f) vT += RB.vMax; if (keys.b) vT -= 0.15; if (keys.l) wT += 1.2; if (keys.r) wT -= 1.2; }
    bot.v += clamp(vT - bot.v, -RB.aMax * dt, RB.aMax * dt); bot.w += clamp(wT - bot.w, -RB.alpha * dt, RB.alpha * dt);
    const n = Math.max(1, Math.ceil(Math.abs(bot.v) * dt / 0.02)), h = dt / n, R = RB.radius;
    let moved = 0, turned = 0;
    for (let i = 0; i < n; i++) {
      const th = bot.th + bot.w * h / 2, nx = bot.x + Math.cos(th) * bot.v * h, ny = bot.y + Math.sin(th) * bot.v * h, x0 = bot.x, y0 = bot.y;
      if (free(nx, ny, R)) { bot.x = nx; bot.y = ny; } else if (free(nx, bot.y, R)) bot.x = nx; else if (free(bot.x, ny, R)) bot.y = ny;
      else { if (Math.abs(bot.v) > 0.03) bot.bump = 1.2; bot.v = 0; }
      moved += (bot.x - x0) * Math.cos(th) + (bot.y - y0) * Math.sin(th);
      bot.th = wrap(bot.th + bot.w * h); turned += bot.w * h;
    }
    turnWheels(moved, turned);
    if (!busy) { const s = RB.mastV / RB.travel * dt; bot.e += clamp(bot.eT - bot.e, -s, s); r.mast = noseOf(bot.e); }
    r.x = bot.x; r.y = bot.y; r.th = bot.th;
  }
  function followModel(dt) {                                      // the site's model drove: read its pose, turn the wheels to match
    const r = world.live.robot, dx = r.x - bot.x, dy = r.y - bot.y, ds = dx * Math.cos(bot.th) + dy * Math.sin(bot.th), dth = wrap(r.th - bot.th);
    turnWheels(ds, dth);
    const k = Math.min(1, dt * 8);
    bot.v += ((dt > 0 ? ds / dt : 0) - bot.v) * k; bot.w += ((dt > 0 ? dth / dt : 0) - bot.w) * k;
    bot.x = r.x; bot.y = r.y; bot.th = r.th;
  }
  let lastV = 0, lastCells = 0, lastAdv = null, lastPath = "", lastMast = null;
  function simStep(dt) {
    const t0 = world.t, r = world.live.robot;
    if (mode === "teleop") { teleop(dt); world.advance(dt); if (r.state === "plan") { r.state = "teleop"; bot.e = bot.eT = extOf(r.mast); } }
    else { world.advance(dt); followModel(dt); }
    if (!(mode === "teleop" && r.state === "teleop")) bot.e = bot.eT = extOf(r.mast);
    bot.nose = noseOf(bot.e); bot.nose3.set(bot.x, bot.y, bot.nose);
    bot.bump = Math.max(0, bot.bump - dt);
    bot.imu.ax = dt > 0 ? (bot.v - lastV) / dt : 0; bot.imu.wz = bot.w; lastV = bot.v;
    const t1 = world.t;
    publish("/clock", null);                                       // topics, at simulated time
    for (const name of ["/cmd_vel", "/odom", "/joint_states", "/tf", "/imu"]) { const n = ticks(topic[name].p, t0, t1); if (n) publish(name, undefined, n); }
    const nScan = ticks(topic["/scan"].p, t0, t1); if (nScan) { laser(); publish("/scan", undefined, nScan); }
    const nSec = ticks(1, t0, t1);
    if (nSec) {
      const c = world.air.at(bot.x, bot.y, bot.nose), read = Math.max(0, c * 1.03 * (1 + 0.04 * gauss()) + 0.8 * gauss()), ex = S.exposures(world)[0];
      publish("/oddech/pm25", { c: read, z: bot.nose, truth: c }, nSec); publish("/battery_state", undefined, nSec); publish("/map", undefined, nSec);
      hist.push({ t: t1, nose: read, z: bot.nose, child: ex.truth, est: ex.c, lo: ex.lo, hi: ex.hi, cells: world.bio.last.n ? world.bio.last.index : null });
      if (hist.length > 1800) hist.shift();
    }
    if (world.bio.last.n !== lastCells) { lastCells = world.bio.last.n; if (lastCells) publish("/oddech/cells", world.bio.last); }
    if (world.advice && world.advice.t !== lastAdv) { lastAdv = world.advice.t; publish("/oddech/advice", world.advice); }
    const pathKey = r.path.length ? r.path.length + ":" + r.path[r.path.length - 1].x.toFixed(2) + ":" + r.path[r.path.length - 1].y.toFixed(2) : "";
    if (pathKey !== lastPath) { lastPath = pathKey; if (pathKey) publish("/oddech/plan", r.path.slice()); }
    const want = mode === "teleop" && r.state === "teleop" ? bot.eT : extOf(r.state === "sample" ? S.MAST[Math.min(2, r.hIdx)] : r.state === "retract" ? S.MAST[0] : r.mast);
    const mastCmd = +(RB.travel / 4 * want).toFixed(3);
    if (mastCmd !== lastMast) { lastMast = mastCmd; publish("/mast/cmd", { data: mastCmd }); }
  }

  // ---------------------------------------------------------------- the world
  function newWorld(warm) {
    world = new S.World({ scenario, seed: 11 + Math.floor(Math.random() * 100000), policy: mode === "patrol" ? "patrol" : "oddech", purifierMode: purMode, cadr: 300 });
    world.follow = $("followT").checked;
    const r = world.live.robot;
    if (warm) world.advance(warm, { history: false });
    if (mode === "teleop") { r.state = "teleop"; r.path = []; r.target = null; }
    Object.assign(bot, { x: r.x, y: r.y, th: r.th, v: 0, w: 0, e: extOf(r.mast), eT: extOf(r.mast) });
    bot.odom = { x: r.x, y: r.y, th: r.th }; bot.nose = noseOf(bot.e); bot.nose3.set(bot.x, bot.y, bot.nose);
    hist.length = 0; trail.length = 0; lastCells = 0; lastAdv = null; lastPath = ""; lastMast = null;
    buildCdf(world.air.C); for (let q = 0; q < NP; q++) placeParticle(q);
    laser(); paintMap(); paintSlice(); syncControls(); renderAdvice(true);
  }

  // ---------------------------------------------------------------- controls
  function setOn(groupId, attr, val) { document.querySelectorAll("#" + groupId + " [data-" + attr + "]").forEach(b => b.classList.toggle("on", b.dataset[attr] === String(val))); }
  const NOTES = {
    oddech: "The site's planner chooses where to measure next: where its map is least sure about the air people breathe. At each stop it raises the nose to 0.40, 1.10 and 1.60 m.",
    patrol: "A fixed round of eight stops, the way a simple robot would do it. Watch how slowly the estimate for the child improves.",
    teleop: "You drive: arrows or WASD, or the pad. Q and E move the nose, M samples here at three heights. The robot stops at furniture and people.",
  };
  function setMode(m) {
    mode = m; const r = world.live.robot;
    if (m === "teleop") { r.state = "teleop"; r.path = []; r.target = null; bot.v = bot.w = 0; bot.e = bot.eT = extOf(r.mast); setSpeed(1); }
    else { r.policy = m === "patrol" ? "patrol" : "oddech"; if (r.state === "teleop" || r.state === "drive") r.state = "plan"; }
    setOn("modeBtns", "mode", m); $("modeNote").textContent = NOTES[m]; $("pad").style.opacity = m === "teleop" ? 1 : 0.55;
  }
  function setSpeed(s) { speed = s; setOn("speedBtns", "s", s); }
  function setPlaying(p) { playing = p; $("playBtn").textContent = p ? "❚❚" : "▶"; $("playBtn").setAttribute("aria-label", p ? "Pause" : "Play"); }
  function takeControl() {                                        // you drive: a sampling round in progress stops where it is
    if (mode !== "teleop") { setMode("teleop"); return; }
    const r = world.live.robot;
    if (r.state !== "teleop") { r.state = "teleop"; r.path = []; r.target = null; bot.e = bot.eT = extOf(r.mast); }
  }
  function setNose(h) { takeControl(); bot.eT = extOf(h); }
  function sampleHere() {
    const r = world.live.robot; if (r.state === "sample" || r.state === "retract") return;
    if (mode !== "teleop") setMode("teleop");
    keysOff(); bot.v = bot.w = 0;
    Object.assign(r, { state: "sample", hIdx: 0, dwell: 0, acc: 0, nacc: 0, target: null, path: [] });
  }
  function keysOff() { for (const k in keys) keys[k] = false; document.querySelectorAll("#pad button").forEach(b => b.classList.remove("on")); }
  for (const k in S.SCENARIOS) { const b = document.createElement("button"); b.className = "chip" + (k === scenario ? " on" : ""); b.dataset.sc = k; b.textContent = S.SCENARIOS[k].label; $("scBtns").appendChild(b); }
  $("scBtns").addEventListener("click", e => { const b = e.target.closest("[data-sc]"); if (!b) return; scenario = b.dataset.sc; setOn("scBtns", "sc", scenario); newWorld(0); });
  $("modeBtns").addEventListener("click", e => { const b = e.target.closest("[data-mode]"); if (b) setMode(b.dataset.mode); });
  $("speedBtns").addEventListener("click", e => { const b = e.target.closest("[data-s]"); if (b) setSpeed(+b.dataset.s); });
  $("playBtn").addEventListener("click", () => setPlaying(!playing));
  $("stepBtn").addEventListener("click", () => { setPlaying(false); stepLeft = 1; });
  $("noseR").addEventListener("input", e => setNose(+e.target.value));
  $("noseBtns").addEventListener("click", e => { const b = e.target.closest("[data-h]"); if (b) setNose(+b.dataset.h); });
  $("sampleBtn").addEventListener("click", sampleHere);
  document.querySelectorAll("#pad [data-k]").forEach(b => {
    const k = b.dataset.k;
    b.addEventListener("pointerdown", e => { e.preventDefault(); takeControl(); if (k === "s") { keysOff(); return; } keys[k] = true; b.classList.add("on"); });
    ["pointerup", "pointerleave", "pointercancel"].forEach(ev => b.addEventListener(ev, () => { if (k !== "s") { keys[k] = false; b.classList.remove("on"); } }));
  });
  const KEY = { ArrowUp: "f", KeyW: "f", ArrowDown: "b", KeyS: "b", ArrowLeft: "l", KeyA: "l", ArrowRight: "r", KeyD: "r" };
  window.addEventListener("keydown", e => {
    if (e.target && e.target.tagName === "INPUT" && e.target.type === "range") return;
    if (KEY[e.code]) { e.preventDefault(); if (!keys[KEY[e.code]]) takeControl(); keys[KEY[e.code]] = true; }
    else if (e.code === "Space") { e.preventDefault(); keysOff(); bot.v = bot.w = 0; }
    else if (e.code === "KeyQ" || e.code === "KeyE") setNose(noseOf(bot.eT) + (e.code === "KeyE" ? 0.1 : -0.1));
    else if (e.code === "Digit1" || e.code === "Digit2" || e.code === "Digit3") setNose(S.MAST[+e.code.slice(-1) - 1]);
    else if (e.code === "KeyM") sampleHere();
    else if (e.code === "KeyP") setPlaying(!playing);
    else if (e.code === "KeyC") { const order = ["orbit", "follow", "top", "robot"]; setCam(order[(order.indexOf(camMode) + 1) % order.length]); }
  });
  window.addEventListener("keyup", e => { if (KEY[e.code]) keys[KEY[e.code]] = false; });
  window.addEventListener("blur", keysOff);
  $("candleT").addEventListener("change", e => world.set({ candleOn: e.target.checked }));
  $("stoveT").addEventListener("change", e => world.set({ stoveOn: e.target.checked }));
  $("matT").addEventListener("change", e => world.set({ matOn: e.target.checked }));
  $("winT").addEventListener("change", e => world.set({ windowOpen: e.target.checked }));
  $("coutR").addEventListener("input", e => { world.set({ cout: +e.target.value }); $("coutV").textContent = e.target.value + " µg/m³"; });
  $("purBtns").addEventListener("click", e => { const b = e.target.closest("[data-m]"); if (!b) return; purMode = b.dataset.m; world.setPurifierMode(purMode, 300); setOn("purBtns", "m", purMode); });
  $("followT").addEventListener("change", e => { world.follow = e.target.checked; });
  function syncControls() {
    const c = world.air.cfg;
    $("candleT").checked = c.candleOn; $("stoveT").checked = c.stoveOn; $("matT").checked = c.matOn; $("winT").checked = c.windowOpen;
    if (document.activeElement !== $("coutR")) { $("coutR").value = c.cout; $("coutV").textContent = Math.round(c.cout) + " µg/m³"; }
    purMode = world.purifierMode; setOn("purBtns", "m", purMode);
  }
  let paneOn = "drive";
  document.querySelectorAll(".tab").forEach(t => t.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(x => x.classList.toggle("on", x === t));
    document.querySelectorAll(".pane").forEach(p => p.classList.toggle("on", p.dataset.pane === t.dataset.tab));
    paneOn = t.dataset.tab; refreshPanels(); if (paneOn === "plots") drawPlots();
  }));
  $("showBtns").addEventListener("click", e => { const b = e.target.closest("[data-v]"); if (!b) return; const v = b.dataset.v; show[v] = !show[v]; b.classList.toggle("on", show[v]); applyShow(); });
  function applyShow() {
    slice.visible = show.air; points.visible = show.particles; scanLines.visible = scanHits.visible = show.laser; ogMesh.visible = show.map;
    robot.frames.forEach(a => { a.visible = show.frames; }); robot.colls.forEach(c => { c.visible = show.collision; }); collG.visible = show.collision;
  }
  $("skinBtns").addEventListener("click", e => { const b = e.target.closest("[data-skin]"); if (!b) return; setOn("skinBtns", "skin", b.dataset.skin); setSkin(b.dataset.skin); });
  $("explodeBtn").addEventListener("click", () => { explodeT = explodeT ? 0 : 1; $("explodeBtn").classList.toggle("on", !!explodeT); if (explodeT && camMode !== "robot") setCam("robot"); if (explodeT) goal.r = Math.max(goal.r, 3.1); });
  $("advClose").addEventListener("click", () => $("advice").classList.add("hide"));
  $("advActs").addEventListener("click", e => { const b = e.target.closest("[data-a]"); if (!b || !world.advice) return; const a = world.advice.actions[+b.dataset.a]; if (a) { world.applyAction(a); syncControls(); $("advActs").innerHTML = ""; } });
  for (const [btn, panel] of [["leftToggle", "leftPanel"], ["rightToggle", "rightPanel"]]) $(btn).addEventListener("click", () => {
    const open = !$(panel).classList.contains("open");
    document.querySelectorAll(".panel").forEach(p => p.classList.remove("open")); $("leftToggle").classList.remove("on"); $("rightToggle").classList.remove("on");
    if (open) { $(panel).classList.add("open"); $(btn).classList.add("on"); }
  });

  // ---------------------------------------------------------------- camera: orbit, follow, top, the robot up close
  const orbit = { th: 0.62, ph: 0.95, r: 13, t: new T.Vector3(0.3, 0.5, 0.4) }, goal = { th: 0.62, ph: 0.95, r: 13, t: new T.Vector3(0.3, 0.5, 0.4) };
  let camMode = "orbit", drag = null, pinch = null, zoomed = false;
  const PRESET = { orbit: { th: 0.62, ph: 0.95, r: 13, t: [0.3, 0.5, 0.4] }, top: { th: 0, ph: 0.02, r: 12.5, t: [0, 0, 0.2] } };
  const fitScale = () => Math.pow(Math.max(1, 1500 / Math.max(1, stage.clientWidth), 820 / Math.max(1, stage.clientHeight)), 0.7);
  function setCam(n) {
    camMode = n; setOn("camBtns", "c", n); zoomed = false;
    const p = PRESET[n]; if (p) { goal.th = p.th; goal.ph = p.ph; goal.r = p.r * fitScale(); goal.t.set(p.t[0], p.t[1], p.t[2]); }
    if (n === "robot") { goal.r = 2.3; goal.ph = 1.18; goal.th = bot.th + 0.7; }
  }
  $("camBtns").addEventListener("click", e => { const b = e.target.closest("[data-c]"); if (b) setCam(b.dataset.c); });
  const ptrs = new Map();
  canvas.addEventListener("pointerdown", e => {
    canvas.focus({ preventScroll: true }); ptrs.set(e.pointerId, [e.clientX, e.clientY]); canvas.setPointerCapture(e.pointerId);
    if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), r: goal.r }; drag = null; return; }
    drag = { x: e.clientX, y: e.clientY, pan: e.shiftKey || e.button === 2, th: goal.th, ph: goal.ph, t: goal.t.clone(), moved: 0 };
  });
  canvas.addEventListener("pointermove", e => {
    if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, [e.clientX, e.clientY]);
    if (pinch && ptrs.size === 2) { const [a, b] = [...ptrs.values()]; goal.r = clamp(pinch.r * pinch.d / Math.max(20, Math.hypot(a[0] - b[0], a[1] - b[1])), 0.8, 28); zoomed = true; return; }
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.moved = Math.max(drag.moved, Math.hypot(dx, dy));
    if (drag.moved > 4 && camMode === "follow" && !drag.pan) setCam("orbit");
    if (drag.pan) {
      const right = new T.Vector3(Math.cos(goal.th), 0, -Math.sin(goal.th)), fwd = new T.Vector3(-Math.sin(goal.th), 0, -Math.cos(goal.th));
      goal.t.copy(drag.t).addScaledVector(right, -dx * 0.0012 * goal.r).addScaledVector(fwd, dy * 0.0012 * goal.r);
    } else { goal.th = drag.th - dx * 0.006; goal.ph = clamp(drag.ph - dy * 0.005, 0.02, 1.5); }
  });
  const endPtr = e => {
    ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = null;
    if (drag && drag.moved < 5 && e.type === "pointerup") pick(e.clientX, e.clientY);
    drag = null;
  };
  canvas.addEventListener("pointerup", endPtr); canvas.addEventListener("pointercancel", endPtr);
  canvas.addEventListener("contextmenu", e => e.preventDefault());
  canvas.addEventListener("wheel", e => { e.preventDefault(); zoomed = true; goal.r = clamp(goal.r * (1 + e.deltaY * 0.0012), 0.8, 28); }, { passive: false });

  // ---------------------------------------------------------------- picking parts, the entity tree, the inspector
  const raycaster = new T.Raycaster(); let selected = null;
  function pick(cx, cy) {
    const rc = canvas.getBoundingClientRect(), v = new T.Vector2(((cx - rc.left) / rc.width) * 2 - 1, -((cy - rc.top) / rc.height) * 2 + 1);
    raycaster.setFromCamera(v, cam);
    const hit = raycaster.intersectObjects(robot.parts.map(p => p.mesh), false)[0];
    select(hit ? { kind: "part", part: hit.object.userData.part } : null);
  }
  function select(s) { selected = s; markSelection(); renderTree(); renderInspector(); }
  const linkKey = p => p.link === "wheel" ? "wheel:" + p.label : p.link === "stage" ? "stage:" + p.stage : p.link;
  function markSelection() {
    for (const p of robot.parts) {
      const m = p.mesh.material, on = !!selected && ((selected.kind === "part" && selected.part === p) || (selected.kind === "link" && selected.link === linkKey(p)));
      if (!m.emissive) continue;
      if (m.userData.e0 === undefined) { m.userData.e0 = m.emissive.getHex(); m.userData.i0 = m.emissiveIntensity; }
      m.userData.sel = on;
      if (on) { m.emissive.setHex(0xB4532A); m.emissiveIntensity = 0.55; } else { m.emissive.setHex(m.userData.e0); m.emissiveIntensity = m.userData.i0; }
    }
  }
  const ROLE = { shell: "shell", band: "band · the laser is assumed here", port: "round port", lens: "port window", tyre: "wheel", caster: "ball caster", mast: "mast stage", lid: "sniffer lid" };
  const mm = v => Math.round(v * 1000);
  function treeRows() {
    const rows = [], byLink = k => robot.parts.filter(p => linkKey(p) === k);
    const tri = robot.parts.reduce((s, p) => s + p.tris, 0), files = new Set(robot.parts.map(p => p.file)).size;
    rows.push({ d: 0, n: "model_flat", k: "world" });
    rows.push({ d: 1, n: "flat", k: "8 × 6 × 2.7 m · furniture", sel: { kind: "ent", ent: "flat" } });
    rows.push({ d: 1, n: "purifier", k: world.air.cfg.purifierOn ? "on" : "off", sel: { kind: "ent", ent: "purifier" } });
    rows.push({ d: 1, n: "child · adult", k: "people", sel: { kind: "ent", ent: "people" } });
    rows.push({ d: 1, n: "wall monitor", k: "on the shelf", sel: { kind: "ent", ent: "monitor" } });
    rows.push({ d: 1, n: "oddech", k: robot.source === "cad" ? `Antonio's CAD · ${files} files · ${Math.round(tri / 1000)}k triangles` : "stand-in (CAD not loaded)", sel: { kind: "ent", ent: "robot" }, cls: "link" });
    rows.push({ d: 2, n: "base_link", k: "Oddech.dae", sel: { kind: "link", link: "base" }, cls: "link" });
    for (const p of byLink("base")) rows.push({ d: 3, n: p.body || p.label, k: p.body ? p.label : ROLE[p.role], sel: { kind: "part", part: p } });
    for (const w of robot.wheels) rows.push({ d: 2, n: w.part.body || w.part.label, k: "continuous", j: `${turn(w.phi)} rad`, sel: { kind: "part", part: w.part }, cls: "link" });
    for (const s of robot.stages) rows.push({ d: 2, n: "mast_stage_" + (s.part.stage + 1), k: s.part.label + " · prismatic", j: `${mm(bot.e * RB.travel / 4)} mm`, sel: { kind: "part", part: s.part }, cls: "link" });
    rows.push({ d: 2, n: "sniffer_link", k: "Oddech_sniffer.dae", j: `nose ${bot.nose.toFixed(2)} m`, sel: { kind: "link", link: "sniffer" }, cls: "link" });
    for (const p of byLink("sniffer")) rows.push({ d: 3, n: p.body || p.label, k: p.body ? p.label : ROLE[p.role], sel: { kind: "part", part: p } });
    rows.push({ d: 2, n: "lidar_link", k: `laser · ${LASER.n} beams at ${RB.lidarZ.toFixed(2)} m`, sel: { kind: "ent", ent: "laser" } });
    return rows;
  }
  const same = (a, b) => !!a && !!b && a.kind === b.kind && a.part === b.part && a.link === b.link && a.ent === b.ent;
  let treeCache = [];
  function renderTree() {
    treeCache = treeRows();
    $("tree").innerHTML = treeCache.map((r, i) => `<div class="row ${r.cls || ""} ${same(r.sel, selected) ? "sel" : ""}" data-i="${i}" style="--d:${r.d}"><span class="n">${r.n}</span><span class="k">${r.k || ""}</span>${r.j ? `<span class="j">${r.j}</span>` : ""}</div>`).join("");
  }
  $("tree").addEventListener("click", e => {
    const row = e.target.closest("[data-i]"); if (!row) return; const r = treeCache[+row.dataset.i]; if (!r || !r.sel) return;
    select(r.sel); if ((r.sel.kind !== "ent" || r.sel.ent === "robot") && camMode !== "robot") setCam("robot");
  });
  function renderInspector() {
    const s = selected, rows = [];
    if (s && s.kind === "part") {
      const p = s.part;
      rows.push(["FreeCAD label", p.label], ["body", p.body || "–"], ["object", p.object], ["file", p.file], ["triangles", Math.round(p.tris).toLocaleString("en")],
        ["size", `${mm(p.size.x)} × ${mm(p.size.y)} × ${mm(p.size.z)} mm`], ["exported colour", p.color ? p.color.map(v => (+v).toFixed(2)).join(" ") : "–"], ["here", ROLE[p.role]]);
      if (p.link === "wheel") { const w = robot.wheels.find(x => x.part === p); rows.push(["joint", "continuous, about x"], ["angle", `${turn(w.phi)} rad`], ["radius", `${mm(RB.wheelR)} mm`]); }
      if (p.link === "stage") rows.push(["joint", "prismatic, along z"], ["out", `${mm(bot.e * RB.travel / 4)} of ${mm(RB.travel / 4)} mm`]);
      if (p.link === "sniffer") rows.push(["nose height", `${bot.nose.toFixed(2)} m`]);
    } else if (s && s.kind === "link") {
      const ps = robot.parts.filter(p => linkKey(p) === s.link), tri = ps.reduce((a, p) => a + p.tris, 0);
      rows.push(["link", s.link === "base" ? "base_link" : "sniffer_link"], ["parts", ps.map(p => p.body || p.label).join(", ")], ["triangles", Math.round(tri).toLocaleString("en")]);
      if (s.link === "sniffer") rows.push(["nose height", `${bot.nose.toFixed(2)} m`], ["range", `${RB.noseMin.toFixed(2)} to ${(RB.noseMin + RB.travel).toFixed(2)} m`]);
    } else if (!s || s.ent === "robot") {
      rows.push(["model", robot.source === "cad" ? "3model/*.dae, by Antonio" : "stand-in"], ["diameter", `${mm(2 * RB.radius)} mm`], ["wheels", `${mm(2 * RB.wheelR)} mm, ${mm(RB.track)} mm apart`],
        ["mast", `4 stages of ${mm(RB.travel / 4)} mm`], ["nose", `${RB.noseMin.toFixed(2)} to ${(RB.noseMin + RB.travel).toFixed(2)} m`], ["limits", `${RB.vMax} m/s · ${RB.wMax} rad/s · ${RB.aMax} m/s²`],
        ["pose", `x ${bot.x.toFixed(2)} · y ${bot.y.toFixed(2)} · ${deg(bot.th).toFixed(0)}°`], ["click", "a part to inspect it"]);
    } else if (s.ent === "purifier") { const c = world.air.cfg; rows.push(["state", c.purifierOn ? "on" : "off"], ["clean air", `${Math.round(c.cadr * 3600)} m³/h`], ["switched by", world.purifierMode === "auto" ? "Oddech" : "hand"], ["at", `x ${c.purifier.x.toFixed(2)} · y ${c.purifier.y.toFixed(2)}`]); }
    else if (s.ent === "people") S.exposures(world).forEach(e => rows.push([e.id, `breathes ${fmt(e.truth)} µg/m³ · Oddech says ${fmt(e.c)}`]));
    else if (s.ent === "monitor") { const m = world.live.sensors[0]; rows.push(["reads", `${fmt(m && m.last)} µg/m³`], ["height", `${LAYOUT.monitor.z} m, on the shelf`], ["every", "30 s"]); }
    else if (s.ent === "laser") rows.push(["beams", LASER.n], ["range", `${LASER.rmin} to ${LASER.rmax} m`], ["rate", `${LASER.rate} Hz`], ["height", `${RB.lidarZ.toFixed(2)} m, in the band`], ["nearest", `${scan.nearest[0].toFixed(2)} m`], ["map known", `${Math.round(100 * OG.known)} %`]);
    else if (s.ent === "flat") rows.push(["size", "8 × 6 × 2.7 m"], ["furniture", LAYOUT.obstacles.length + " pieces"], ["window", world.air.cfg.windowOpen ? "open" : "shut"], ["outdoor", `${fmt(world.air.cfg.cout)} µg/m³`]);
    $("insp").innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("");
  }

  // ---------------------------------------------------------------- panels that change: readouts, topics, wells, plots, the advice
  const STATE = { plan: "choosing where to go", drive: "driving", sample: "measuring", retract: "lowering the nose", charge: "charging", teleop: "driven by you" };
  function words(v, w) {
    const mv = Math.abs(v) < 0.01 ? "still" : (v > 0 ? "forward " : "back ") + Math.abs(v).toFixed(2) + " m/s";
    const tw = Math.abs(w) < 0.02 ? "" : ", turning " + (w > 0 ? "left " : "right ") + Math.abs(w * 180 / Math.PI).toFixed(0) + "°/s";
    return mv + tw;
  }
  function robotReadout() {
    const r = world.live.robot, drift = Math.hypot(bot.odom.x - bot.x, bot.odom.y - bot.y), nose = topic["/oddech/pm25"].last;
    const rows = [["state", STATE[r.state] || r.state], ["motion", words(bot.v, bot.w)], ["nose", `${bot.nose.toFixed(2)} m`], ["nose reads", nose ? `${fmt(nose.c)} µg/m³` : "–", "hot"],
      ["battery", `${Math.round(r.pct)} %`], ["laser, nearest", `${scan.nearest[0].toFixed(2)} m`, "cool"], ["odometry drift", `${Math.round(drift * 100)} cm`], ["map known", `${Math.round(100 * OG.known)} %`, "cool"]];
    if (bot.bump > 0) rows.push(["bumper", "touched", "hot"]);
    $("robotRead").innerHTML = rows.map(([k, v, c]) => `<dt>${k}</dt><dd class="${c || ""}">${v}</dd>`).join("");
    if (document.activeElement !== $("noseR")) $("noseR").value = noseOf(bot.eT).toFixed(2);
    $("noseV").textContent = bot.nose.toFixed(2) + " m";
  }
  function wells() {
    const b = world.bio.last, roles = BIO.roles, el = $("wells");
    if (!el.children.length) el.innerHTML = roles.map((r, i) => `<div class="well"><i></i><span>${r === "exposed" ? "air " + (i + 1) : r === "control" ? "filtered" : r}</span></div>`).join("");
    roles.forEach((r, i) => {
      const rel = b.F && b.F0 ? b.F[i] / b.F0[i] : 1, g = clamp((rel - 1) / 1.2, 0, 1), dot = el.children[i].firstChild;
      const base = r === "exposed" ? "217,135,92" : r === "control" ? "126,152,188" : r === "reference" ? "237,232,223" : "60,55,50";
      const lv = r === "blank" ? 0.12 : 0.28 + 0.72 * (r === "exposed" ? g : 0.15);
      dot.style.background = `radial-gradient(circle at 50% 45%, rgba(${base},${lv.toFixed(2)}) 0%, rgba(${base},${(lv * 0.35).toFixed(2)}) 55%, #120f0d 100%)`;
      dot.style.boxShadow = r === "exposed" && g > 0.05 ? `0 0 ${(6 + 16 * g).toFixed(0)}px rgba(217,135,92,${(0.25 + 0.5 * g).toFixed(2)})` : "none";
    });
    $("cellRead").innerHTML = [["stress index", b.n ? `${Math.round(b.index)} / 100` : "first reading at 10 min"], ["exposed over filtered", b.n ? `× ${b.fold.toFixed(2)}` : "–"],
      ["next reading in", clock(Math.max(0, world.nextBio - world.t))], ["readings", b.n], ["cartridge left", `${Math.round(100 * b.life)} %`]].map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("");
  }
  function summary(name) {
    const r = world.live.robot, t = topic[name];
    switch (name) {
      case "/clock": return `sim ${clock(world.t)}`;
      case "/cmd_vel": return words(bot.v, bot.w);
      case "/odom": return `x ${bot.odom.x.toFixed(2)} · y ${bot.odom.y.toFixed(2)} · heading ${deg(bot.odom.th).toFixed(0)}° · drift ${Math.round(100 * Math.hypot(bot.odom.x - bot.x, bot.odom.y - bot.y))} cm`;
      case "/joint_states": return `wheels ${robot.wheels.map(w => turn(w.phi)).join(", ")} rad · stages 4 × ${mm(bot.e * RB.travel / 4)} mm`;
      case "/tf": return "odom, base_footprint, base_link, wheels, mast_stage_1…4, sniffer_link, lidar_link";
      case "/imu": return `yaw rate ${Math.abs(bot.imu.wz * 180 / Math.PI).toFixed(0)}°/s · acceleration ${Math.abs(bot.imu.ax).toFixed(2)} m/s²`;
      case "/scan": return `${LASER.n} beams · nearest ${scan.nearest[0].toFixed(2)} m · ${Array.from(scan.ranges).filter(isFinite).length} returns`;
      case "/mast/cmd": return t.last ? `${t.last.data.toFixed(3)} m per stage · nose ${noseOf(t.last.data * 4 / RB.travel).toFixed(2)} m` : "–";
      case "/map": return `${OG.w} × ${OG.h} cells of ${OG.res} m · ${Math.round(100 * OG.known)} % known`;
      case "/oddech/pm25": return t.last ? `${fmt(t.last.c)} µg/m³ at ${t.last.z.toFixed(2)} m` : "–";
      case "/oddech/cells": return t.last ? `stress ${Math.round(t.last.index)} / 100 · × ${t.last.fold.toFixed(2)} over filtered` : "every 10 min of simulated time";
      case "/oddech/plan": return r.path.length ? `${r.path.length} waypoints${r.target ? " · " + r.target.why : ""}` : "no plan";
      case "/oddech/advice": return world.advice ? world.advice.text.neutral_stated : "–";
      case "/battery_state": return `${Math.round(r.pct)} % · ${r.state === "charge" ? "charging" : "discharging"}`;
    }
    return "";
  }
  function echo(name) {
    const r = world.live.robot, t = world.t, sec = Math.floor(t), ns = Math.round((t % 1) * 1e9), stamp = `header:\n  stamp: {sec: ${sec}, nanosec: ${ns}}\n`;
    const q = th => `{x: 0.0, y: 0.0, z: ${Math.sin(th / 2).toFixed(4)}, w: ${Math.cos(th / 2).toFixed(4)}}`, note = s => `<span class="c"># ${s}</span>`;
    switch (name) {
      case "/clock": return `clock: {sec: ${sec}, nanosec: ${ns}}`;
      case "/cmd_vel": return `linear: {x: ${bot.v.toFixed(3)}, y: 0.0, z: 0.0}\nangular: {x: 0.0, y: 0.0, z: ${bot.w.toFixed(3)}}`;
      case "/odom": return stamp + `  frame_id: odom\nchild_frame_id: base_footprint\npose:\n  pose:\n    position: {x: ${bot.odom.x.toFixed(3)}, y: ${bot.odom.y.toFixed(3)}, z: 0.0}\n    orientation: ${q(bot.odom.th)}\ntwist:\n  twist:\n    linear: {x: ${bot.v.toFixed(3)}}\n    angular: {z: ${bot.w.toFixed(3)}}\n` + note(`from the wheels alone, so it drifts: the true pose is x ${bot.x.toFixed(3)}, y ${bot.y.toFixed(3)}`);
      case "/joint_states": return stamp + `name: [${robot.wheels.map(w => (w.part.body || w.part.label).toLowerCase() + "_joint").join(", ")}, mast_stage_1, mast_stage_2, mast_stage_3, mast_stage_4]\nposition: [${robot.wheels.map(w => w.phi.toFixed(3)).join(", ")}, ${[0, 1, 2, 3].map(() => (bot.e * RB.travel / 4).toFixed(4)).join(", ")}]`;
      case "/tf": return `transforms:\n- header: {frame_id: odom}\n  child_frame_id: base_footprint\n  transform:\n    translation: {x: ${bot.odom.x.toFixed(3)}, y: ${bot.odom.y.toFixed(3)}, z: 0.0}\n    rotation: ${q(bot.odom.th)}\n` + note("the other frames come from /joint_states through robot_state_publisher");
      case "/imu": return stamp + `  frame_id: imu_link\nangular_velocity: {x: 0.0, y: 0.0, z: ${bot.imu.wz.toFixed(3)}}\nlinear_acceleration: {x: ${bot.imu.ax.toFixed(3)}, y: 0.0, z: 9.81}`;
      case "/scan": { const rs = Array.from(scan.ranges).map(v => isFinite(v) ? v.toFixed(2) : ".inf");
        return stamp + `  frame_id: lidar_link\nangle_min: ${(-Math.PI).toFixed(4)}\nangle_max: ${Math.PI.toFixed(4)}\nangle_increment: ${(2 * Math.PI / LASER.n).toFixed(5)}\nrange_min: ${LASER.rmin}\nrange_max: ${LASER.rmax}\nranges: [${rs.slice(0, 12).join(", ")}, … ${LASER.n - 12} more]`; }
      case "/mast/cmd": return topic[name].last ? `data: ${topic[name].last.data.toFixed(3)}\n` + note(`how far each of the four stages is out, in metres: nose = ${RB.noseMin.toFixed(3)} + 4 × data`) : "–";
      case "/map": return stamp + `  frame_id: map\ninfo:\n  resolution: ${OG.res}\n  width: ${OG.w}\n  height: ${OG.h}\n  origin: {position: {x: 0.0, y: 0.0}}\ndata: [${OG.w * OG.h} cells, ${Math.round(100 * OG.known)} % known]\n` + note("built from /scan at the true pose: localisation is assumed here");
      case "/oddech/pm25": { const m = topic[name].last; return m ? stamp + `  frame_id: sniffer_link\npm25: ${m.c.toFixed(2)}   ${note("µg/m³, the optical counter at the nose")}\nheight: ${m.z.toFixed(3)}\n` + note(`the model's air there: ${m.truth.toFixed(2)}`) : "–"; }
      case "/oddech/cells": { const b = topic[name].last; return b ? stamp + `index: ${b.index.toFixed(1)}\nfold_over_filtered: ${b.fold.toFixed(3)}\nexposed: [${b.exp.map(v => v.toFixed(3)).join(", ")}]\ncontrols: [${b.ctl.map(v => v.toFixed(3)).join(", ")}]\ncartridge_left: ${b.life.toFixed(3)}` : note(`the cells are read every ${BIO.cycle / 60} min of simulated time`); }
      case "/oddech/plan": return r.path.length ? stamp + `  frame_id: map\nposes:\n${r.path.map(p => `- {x: ${p.x.toFixed(2)}, y: ${p.y.toFixed(2)}}`).join("\n")}` + (r.target ? "\n" + note("why: " + r.target.why) : "") : "–";
      case "/oddech/advice": return world.advice ? `data: "${world.advice.text.neutral_stated}"` : "–";
      case "/battery_state": return stamp + `percentage: ${(r.pct / 100).toFixed(3)}\npower_supply_status: ${r.state === "charge" ? 1 : 2}\n` + note("a 100 Wh pack: a design target");
    }
    return "";
  }
  function renderTopics() {
    $("topics").innerHTML = TOPICS.map(t => {
      const rate = t.p ? (1 / t.p).toFixed(0) + " Hz" : t.n === "/clock" ? "every step" : "on change";
      return `<div class="topic ${t.n === selTopic ? "sel" : ""}" data-t="${t.n}"><span class="t">${t.n}</span><span class="hz">${t.count ? rate : "waiting"}</span><span class="ty">${t.ty} · ${t.src === "bridge" ? "package bridge" : "this simulator"}</span><span class="sm">${summary(t.n)}</span></div>`;
    }).join("");
    $("echoHead").textContent = "ros2 topic echo " + selTopic;
    $("echo").innerHTML = echo(selTopic);
  }
  $("topics").addEventListener("click", e => { const row = e.target.closest("[data-t]"); if (!row) return; selTopic = row.dataset.t; renderTopics(); });
  function chart(cv, series, opts) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2), w = cv.clientWidth, h = cv.clientHeight; if (!w || !h || hist.length < 2) return;
    if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const g = cv.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
    const t1 = hist[hist.length - 1].t, t0 = t1 - Math.max(60, Math.min(900, t1 - hist[0].t)), X = t => 34 + (w - 40) * (t - t0) / (t1 - t0);
    const rows = hist.filter(p => p.t >= t0);
    let max = opts.max || 0; if (!opts.max) for (const p of rows) for (const s of series) { const v = s.get(p); if (v !== null && v !== undefined && isFinite(v)) max = Math.max(max, v, s.hi ? s.hi(p) || 0 : 0); }
    max = (max || 1) * 1.12; const min = opts.min || 0, Y = v => h - 14 - (h - 22) * (v - min) / (max - min);
    g.font = "9px 'JetBrains Mono', monospace"; g.strokeStyle = "rgba(237,232,223,.1)"; g.lineWidth = 1;
    for (const f of [0, 0.5, 1]) { const v = min + (max / 1.12 - min) * f, y = Y(v); g.beginPath(); g.moveTo(34, y); g.lineTo(w - 6, y); g.stroke(); g.fillStyle = "#77716a"; g.textAlign = "right"; g.fillText(opts.tick ? opts.tick(v) : Math.round(v), 30, y + 3); }
    for (const s of series) {
      if (s.hi) { g.fillStyle = s.band; g.beginPath(); let on = false; for (const p of rows) { const v = s.hi(p); if (v === null || v === undefined) continue; if (on) g.lineTo(X(p.t), Y(v)); else g.moveTo(X(p.t), Y(v)); on = true; }
        for (let i = rows.length - 1; i >= 0; i--) { const v = s.lo(rows[i]); if (v === null || v === undefined) continue; g.lineTo(X(rows[i].t), Y(v)); } g.closePath(); g.fill(); }
      g.strokeStyle = s.color; g.lineWidth = s.width || 1.4; g.beginPath(); let on = false, prev = null;
      for (const p of rows) { const v = s.get(p); if (v === null || v === undefined || !isFinite(v)) { on = false; continue; } const x = X(p.t), y = Y(v);
        if (on) { if (s.step && prev !== null) g.lineTo(x, prev); g.lineTo(x, y); } else { g.moveTo(x, y); on = true; } prev = y; }
      g.stroke();
    }
    g.fillStyle = "#77716a"; g.textAlign = "left"; g.fillText(clock(t0), 34, h - 2); g.textAlign = "right"; g.fillText(clock(t1), w - 6, h - 2);
  }
  function drawPlots() {
    chart($("plotPM"), [{ get: p => p.child, color: "#EDE8DF", width: 1.2 }, { get: p => p.est, color: "#7E98BC", width: 1.6, hi: p => p.hi, lo: p => p.lo, band: "rgba(126,152,188,.16)" }, { get: p => p.nose, color: "#D9875C", width: 1.3 }], {});
    chart($("plotZ"), [{ get: p => p.z, color: "#EDE8DF", width: 1.4 }], { max: 1.6, min: 0.3, tick: v => v.toFixed(1) });
    chart($("plotCells"), [{ get: p => p.cells, color: "#D9875C", width: 1.6, step: true }], { max: 100 / 1.12 });
  }
  let advShown = -1;
  function renderAdvice(force) {
    const a = world.advice;
    if (!a) { $("advText").textContent = "Warming up: the robot is taking its first readings."; $("advT").textContent = ""; $("advActs").innerHTML = ""; return; }
    if (!force && a.t === advShown) return; advShown = a.t;
    $("advT").textContent = "· " + clock(a.t); $("advText").textContent = a.text.warm_stated;
    $("advActs").innerHTML = a.actions.map((x, i) => `<button class="chip" data-a="${i}">${x.label}</button>`).join("");
  }
  function refreshPanels() { if (paneOn === "drive") robotReadout(); else if (paneOn === "air") wells(); else if (paneOn === "topics") renderTopics(); }

  // ---------------------------------------------------------------- the minimap: what the robot knows, RViz style
  const mini = $("miniCanvas"), mg = mini.getContext("2d");
  function drawMini() {
    const w = mini.width, h = mini.height, s = w / L, X = x => x * s, Y = y => h - y * s;
    mg.fillStyle = "#12100e"; mg.fillRect(0, 0, w, h);
    mg.imageSmoothingEnabled = false; mg.save(); mg.translate(0, h); mg.scale(s * OG.res, -s * OG.res); mg.drawImage(OG.canvas, 0, 0); mg.restore();
    mg.strokeStyle = "rgba(237,232,223,.18)"; mg.lineWidth = 1; mg.strokeRect(0.5, 0.5, w - 1, h - 1);
    const r = world.live.robot;
    mg.fillStyle = "rgba(217,135,92,.9)";                            // the laser's returns
    for (let i = 0; i < LASER.n; i += 2) { const d = scan.ranges[i]; if (!isFinite(d)) continue; const a = bot.th - Math.PI + 2 * Math.PI * i / LASER.n; mg.fillRect(X(bot.x + Math.cos(a) * d) - 1, Y(bot.y + Math.sin(a) * d) - 1, 2, 2); }
    for (const sm of world.live.map.samples) { if (sm.src !== "robot") continue; mg.fillStyle = css(CONC(0.25 + 0.75 * tC(sm.c))); mg.beginPath(); mg.arc(X(sm.x), Y(sm.y), 2.6, 0, 7); mg.fill(); }
    if (r.path.length && show.path) { mg.strokeStyle = "#9fb4d2"; mg.setLineDash([4, 3]); mg.beginPath(); mg.moveTo(X(bot.x), Y(bot.y)); r.path.forEach(p => mg.lineTo(X(p.x), Y(p.y))); mg.stroke(); mg.setLineDash([]); }
    for (const p of LAYOUT.people) { mg.strokeStyle = "#7E98BC"; mg.beginPath(); mg.arc(X(p.x), Y(p.y), 0.36 * s, 0, 7); mg.stroke(); }
    const pu = world.air.cfg.purifier; mg.fillStyle = world.air.cfg.purifierOn ? "#7E98BC" : "#4a4640"; mg.beginPath(); mg.arc(X(pu.x), Y(pu.y), 0.18 * s, 0, 7); mg.fill();
    const o = bot.odom; mg.strokeStyle = "rgba(237,232,223,.4)"; mg.setLineDash([2, 2]); mg.beginPath(); mg.arc(X(o.x), Y(o.y), RB.radius * s, 0, 7); mg.stroke(); mg.setLineDash([]);   // where odometry alone puts it
    mg.save(); mg.translate(X(bot.x), Y(bot.y)); mg.rotate(-bot.th);
    mg.fillStyle = "#EDE8DF"; mg.beginPath(); mg.arc(0, 0, RB.radius * s, 0, 7); mg.fill();
    mg.fillStyle = "#B4532A"; mg.beginPath(); mg.moveTo(RB.radius * s + 4, 0); mg.lineTo(-2, -4.5); mg.lineTo(-2, 4.5); mg.closePath(); mg.fill(); mg.restore();
    $("miniKnown").textContent = Math.round(100 * OG.known) + " % known";
  }

  // ---------------------------------------------------------------- labels in the 3D view, the HUD, the wall monitor's screen
  const lab = {}; for (const k of ["child", "adult", "monitor", "purifier", "robot", "outdoor", "hot", "part"]) { const d = document.createElement("div"); d.className = "lab"; labelsEl.appendChild(d); lab[k] = d; }
  lab.child.classList.add("acc"); lab.robot.classList.add("acc"); lab.purifier.classList.add("ind"); lab.hot.classList.add("acc"); lab.part.classList.add("part");
  const v3 = new T.Vector3(), boxes = [];
  function panelBoxes() {                                          // where the floating panels are, so labels stay clear of them
    boxes.length = 0; const st = stage.getBoundingClientRect();
    for (const id of ["leftPanel", "rightPanel", "mini", "advice", "viewbar"]) {
      const el = $(id); if (!el || el.classList.contains("hide") || getComputedStyle(el).opacity === "0") continue;
      const r = el.getBoundingClientRect(); boxes.push([r.left - st.left - 8, r.top - st.top - 8, r.right - st.left + 8, r.bottom - st.top + 30]);
    }
  }
  function placeLabel(el, room, html) {
    v3.set(room[0] - L / 2, room[2], WD / 2 - room[1]).project(cam);
    const x = (v3.x + 1) / 2 * canvas.clientWidth, y = (1 - v3.y) / 2 * canvas.clientHeight;
    if (v3.z > 1 || x < 20 || x > canvas.clientWidth - 20 || y < 40 || y > canvas.clientHeight - 20 || boxes.some(b => x >= b[0] && x <= b[2] && y >= b[1] && y <= b[3])) { el.style.display = "none"; return; }
    el.style.display = "block"; el.style.left = x + "px"; el.style.top = y + "px";
    if (html !== undefined && el._h !== html) { el.innerHTML = html; el._h = html; }
  }
  function updateLabels() {
    panelBoxes();
    const cfg = world.air.cfg, r = world.live.robot, ex = S.exposures(world), mon = world.live.sensors[0], nose = topic["/oddech/pm25"].last, close = camMode === "robot";
    LAYOUT.people.forEach((p, i) => { if (close) lab[p.id].style.display = "none"; else placeLabel(lab[p.id], [p.x, p.y, p.z + 0.35], `${p.id === "child" ? "Child" : "Adult"}<b>${fmt(ex[i].truth)}</b>`); });
    if (close) for (const k of ["monitor", "purifier", "outdoor", "hot"]) lab[k].style.display = "none";
    else {
      placeLabel(lab.monitor, [7.6, 2.6, 1.72], `Wall monitor<b>${fmt(mon && mon.last)}</b>`);
      placeLabel(lab.purifier, [cfg.purifier.x, cfg.purifier.y, 0.95], `Purifier<b>${cfg.purifierOn ? "on" : "off"}</b>`);
      placeLabel(lab.outdoor, [(Wn.x0 + Wn.x1) / 2, WD + 0.2, Wn.z1 + 0.25], `Outdoor<b>${fmt(cfg.cout)}</b>`);
      const a = world.advice; if (a && a.ratio > 1.4) placeLabel(lab.hot, [a.hotspot.x, a.hotspot.y, 1.0], `Worst air on the map<b>${fmt(a.hot)}</b>`); else lab.hot.style.display = "none";
    }
    const what = r.state === "sample" ? `measuring at ${S.MAST[Math.min(2, r.hIdx)].toFixed(2)} m` : r.state === "drive" && r.target ? r.target.why : STATE[r.state] || "";
    placeLabel(lab.robot, [bot.x, bot.y, bot.nose + 0.22], `Oddech · ${what}<b>${nose ? fmt(nose.c) : "–"}</b>`);
    if (canvas.clientWidth < 700) for (const k of ["adult", "monitor", "outdoor", "hot"]) lab[k].style.display = "none";   // phones: fewer labels
    if (selected && selected.kind === "part") {
      const p = selected.part, wp = p.mesh.geometry.boundingBox.getCenter(new T.Vector3()); p.mesh.localToWorld(wp);
      placeLabel(lab.part, [wp.x + L / 2, WD / 2 - wp.z, wp.y], `${p.body || p.label}${p.body ? `<b>${p.label}</b>` : ""}`);
    } else lab.part.style.display = "none";
  }
  function hud() {
    const r = world.live.robot, nose = topic["/oddech/pm25"].last, ex = S.exposures(world)[0];
    const who = mode === "teleop" ? "You drive" : mode === "patrol" ? "Fixed round" : "Oddech decides";
    $("hud").innerHTML = `<span><b>${who}</b> · ${STATE[r.state] || r.state} · nose <b>${bot.nose.toFixed(2)} m</b> reads <span class="hot">${nose ? fmt(nose.c) : "–"} µg/m³</span> · the child breathes <b>${fmt(ex.truth)}</b>, Oddech estimates <span class="cool">${fmt(ex.c)}</span>` +
      (bot.bump > 0 ? ` · <span class="warn">bumper</span>` : "") + (r.pct < 25 ? ` · <span class="warn">battery ${Math.round(r.pct)} %</span>` : "") + "</span>";
  }
  let monLast;
  function drawMonitor(val) {
    const k = val === null || val === undefined ? null : Math.round(val);
    if (k === monLast) return; monLast = k;
    const g = monCanvas.getContext("2d"); g.fillStyle = "#101418"; g.fillRect(0, 0, 256, 128);
    g.fillStyle = "#7E98BC"; g.font = "600 20px 'JetBrains Mono', monospace"; g.fillText("PM2.5", 16, 32);
    g.fillStyle = "#EDE8DF"; g.font = "600 64px 'JetBrains Mono', monospace"; g.fillText(k === null ? "--" : String(k), 16, 104);
    monTex.needsUpdate = true;
  }

  // ---------------------------------------------------------------- per frame: pose the robot and the room, then draw
  const mtx = new T.Matrix4(), col = new T.Color();
  function poseScene(now, dtR) {
    const cfg = world.air.cfg, r = world.live.robot;
    robot.root.position.set(bot.x, bot.y, RB.lift); robot.root.rotation.set(0, 0, bot.th + Math.PI / 2);   // the round port (CAD -y) leads
    explode += (explodeT - explode) * Math.min(1, dtR * 3.2);
    for (const p of robot.parts) if (p.link !== "wheel") p.mesh.position.copy(p.offset).multiplyScalar(explode);
    for (const w of robot.wheels) { w.piv.position.copy(w.part.center).addScaledVector(w.part.offset, explode); w.piv.rotation.x = w.phi; }
    for (const s of robot.stages) s.g.position.z = -(s.part.bb.max.z - RB.top) * (1 - bot.e);
    robot.sniffer.position.z = robot.stages.length ? robot.stages[robot.stages.length - 1].g.position.z : 0;
    const smp = sampling(), pulse = 0.5 + 0.5 * Math.sin(now / 240);
    noseRing.material.opacity = smp ? 0.4 + 0.5 * pulse : 0; noseRing.scale.setScalar(1 + (smp ? 0.5 * pulse : 0));
    const lid = robot.parts.find(p => p.role === "lid");
    if (lid && skin === "studio" && !lid.studio.userData.sel) lid.studio.emissiveIntensity = smp ? 0.35 + 0.45 * pulse : 0.05;
    pur.position.set(cfg.purifier.x, cfg.purifier.y, 0); purRingM.emissiveIntensity = cfg.purifierOn ? 2.2 : 0; if (cfg.purifierOn) fan.rotation.y += 0.25 * Math.min(2, cfg.cadr * 3600 / 300);
    paneHinge.rotation.z += ((cfg.windowOpen ? -1.15 : 0) - paneHinge.rotation.z) * 0.08;
    burnerM.emissiveIntensity = cfg.stoveOn ? 1.6 + 0.3 * Math.sin(now / 90) : 0; stoveL.intensity = cfg.stoveOn ? 0.9 : 0;
    flame.visible = cfg.candleOn; candleL.intensity = cfg.candleOn ? 0.55 + 0.12 * Math.sin(now / 70) + 0.08 * Math.sin(now / 37) : 0;
    hazeM.opacity = Math.min(0.75, 0.1 + cfg.cout / 170); winGlow.intensity = 0.4 + cfg.cout / 140;
    S.exposures(world).forEach((e, i) => setSrgb(people[i].ringM.color, CONC(0.25 + 0.75 * tC(e.c === null ? e.truth : e.c))));
    const a = world.advice;
    if (a && a.ratio > 1.4) { hotRing.position.set(a.hotspot.x, a.hotspot.y, 0.025); hotRing.material.opacity = 0.5 + 0.3 * Math.sin(now / 300); hotRing.scale.setScalar(1 + 0.08 * Math.sin(now / 300)); }
    else hotRing.material.opacity = 0;
    const showP = show.path && r.path.length > 0 && r.state === "drive";
    pathLine.visible = showP; if (showP) pathLine.set([[bot.x, bot.y, 0.03]].concat(r.path.map(p => [p.x, p.y, 0.03])));
    tgt.visible = show.path && !!r.target && (r.state === "drive" || r.state === "plan");
    if (r.target) { tgt.position.set(r.target.x, r.target.y, 0); tgtRing.scale.setScalar(1 + 0.12 * Math.sin(now / 220)); }
    const lt = trail[trail.length - 1];
    if (!lt || Math.hypot(lt[0] - bot.x, lt[1] - bot.y) > 0.03) { trail.push([bot.x, bot.y, 0.012]); if (trail.length > 600) trail.shift(); }
    trailLine.visible = show.path && trail.length > 1; if (trailLine.visible) trailLine.set(trail);
    let n = 0;
    if (show.path) for (const sm of world.live.map.samples) {
      if (sm.src !== "robot" || n >= MAXS) continue;
      const sc = Math.max(0.35, 1 - Math.max(0, world.t - sm.t) / 720);
      mtx.makeScale(sc, sc, sc); mtx.setPosition(sm.x, sm.y, sm.z); sampMesh.setMatrixAt(n, mtx);
      setSrgb(col, CONC(0.25 + 0.75 * tC(sm.c))); sampMesh.setColorAt(n, col); n++;
    }
    sampMesh.count = n; sampMesh.instanceMatrix.needsUpdate = true; if (sampMesh.instanceColor) sampMesh.instanceColor.needsUpdate = true;
  }
  function moveCamera(dtR) {
    if (camMode === "follow") { goal.t.copy(P(bot.x, bot.y, 0.5)); goal.ph = 1.12; goal.th = bot.th - Math.PI / 2; if (!zoomed) goal.r = 2.5; }   // low enough to pass under the lamp
    if (camMode === "robot") goal.t.copy(P(bot.x, bot.y, Math.max(0.42, bot.nose * 0.55) + 0.3 * explode));
    let dth = goal.th - orbit.th; while (dth > Math.PI) dth -= 2 * Math.PI; while (dth < -Math.PI) dth += 2 * Math.PI;
    const k = Math.min(1, dtR * 4);
    orbit.th += dth * k; orbit.ph += (goal.ph - orbit.ph) * k; orbit.r += (goal.r - orbit.r) * k; orbit.t.lerp(goal.t, k);
    cam.position.set(orbit.t.x + orbit.r * Math.sin(orbit.ph) * Math.sin(orbit.th), orbit.t.y + orbit.r * Math.cos(orbit.ph), orbit.t.z + orbit.r * Math.sin(orbit.ph) * Math.cos(orbit.th));
    cam.lookAt(orbit.t);
  }
  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix();
    pMat.uniforms.uScale.value = h * renderer.getPixelRatio() / (2 * Math.tan(cam.fov * Math.PI / 360));
    if (!zoomed && PRESET[camMode]) goal.r = PRESET[camMode].r * fitScale();
  }
  window.addEventListener("resize", resize);

  let last = performance.now(), tMid = 0, tPanel = 0, tMap = 0, tSlow = 0, tCdf = 0, rtf = 1, rtfAcc = [0, 0];
  function frame(now) {
    requestAnimationFrame(frame);
    const dtR = Math.min(0.1, (now - last) / 1000); last = now;
    if (document.hidden) return;
    let dtS = 0;
    if (playing) dtS = Math.min(dtR * speed, 2.5); else if (stepLeft > 0) { dtS = stepLeft; stepLeft = 0; }
    if (dtS > 0) simStep(dtS);
    rtfAcc[0] += dtS; rtfAcc[1] += dtR; if (rtfAcc[1] > 0.5) { rtf = rtfAcc[0] / rtfAcc[1]; rtfAcc = [0, 0]; }
    if (show.particles) { if (now - tCdf > 500) { buildCdf(world.air.C); tCdf = now; } updateParticles(dtS); }
    poseScene(now, dtR); moveCamera(dtR);
    renderer.render(scene, cam);
    if (now - tMid > 125) { tMid = now; updateLabels(); hud(); if (show.air) paintSlice();
      $("clock").innerHTML = `<span>sim ${clock(world.t)}</span><span>RTF ${rtf.toFixed(2)}${playing ? "" : " · paused"}</span>`; }
    if (now - tPanel > 250) { tPanel = now; refreshPanels(); renderAdvice(false); drawMonitor(world.live.sensors[0] && world.live.sensors[0].last); }
    if (now - tMap > 400) { tMap = now; paintMap(); drawMini(); }
    if (now - tSlow > 1000) { tSlow = now; if (paneOn === "plots") drawPlots(); renderTree(); renderInspector(); syncControls(); }
  }

  // ---------------------------------------------------------------- loading Antonio's CAD
  function staticUrl(path) {
    if (window.ODDECH_STATIC) return new URL(path, new URL(window.ODDECH_STATIC, location.href)).href;
    let base = location.href;
    try { if (window.parent !== window && window.parent.location.href) base = window.parent.location.href; } catch (e) { /* another origin: stay with ours */ }
    return new URL("app/static/" + path, base).href;
  }
  async function fetchText(file, row) {                           // Streamlit's static folder first, then the same file on GitHub
    const urls = [staticUrl("cad/" + file + ".gz")];
    if (window.ODDECH_CAD_RAW) urls.push(window.ODDECH_CAD_RAW + file + ".gz");
    let why = "";
    for (const url of urls) {
      try {
        const res = await fetch(url);
        if (!res.ok) { why = `HTTP ${res.status}`; continue; }
        const total = +res.headers.get("content-length") || 0, reader = res.body.getReader(), chunks = []; let got = 0;
        for (;;) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); got += value.length; row.style.setProperty("--p", total ? (got / total).toFixed(3) : 0.5); }
        const bytes = new Uint8Array(got); let o = 0; for (const c of chunks) { bytes.set(c, o); o += c.length; }
        let text;
        if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
          if (!("DecompressionStream" in window)) throw new Error("this browser cannot unzip the CAD files");
          text = await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"))).text();
        } else text = new TextDecoder().decode(bytes);                // already unzipped on the way
        if (text.indexOf("<COLLADA") >= 0) return text;
        why = "not a COLLADA file";
      } catch (e) { why = e.message; }
    }
    throw new Error(`${file}: ${why}`);
  }
  const mb = b => (b / 1e6).toFixed(b < 1e5 ? 2 : 1) + " MB";
  async function loadCad() {
    const files = (CAD.files || []).map(f => f.file), list = $("bootFiles");
    list.innerHTML = (CAD.files || []).map(f => `<li><b>${f.file}</b><span>${mb(f.bytes)} · ${f.parts.length} part${f.parts.length > 1 ? "s" : ""}</span><i></i></li>`).join("");
    if (!files.length || !T.ColladaLoader) throw new Error("no CAD manifest");
    const rows = Array.from(list.children), texts = await Promise.all(files.map((f, i) => fetchText(f, rows[i])));
    for (let i = 0; i < files.length; i++) {
      bootStep(`parsing ${files[i]}`); await new Promise(r => setTimeout(r, 16));
      const c = new T.ColladaLoader().parse(texts[i], "");
      c.scene.quaternion.identity(); c.scene.scale.set(1, 1, 1); c.scene.updateMatrixWorld(true);
      c.scene.traverse(o => { if (o.isMesh) addPart(o, files[i]); });
      rows[i].classList.add("ok"); rows[i].style.setProperty("--p", 1);
    }
    robot.source = "cad"; assemble();
  }
  async function boot() {
    resize();
    try { bootStep("downloading"); await loadCad(); }
    catch (e) {
      console.warn("Oddech Sim: CAD not loaded:", e); robot.parts.length = 0;
      bootStep("The CAD files could not be loaded here, so a stand-in robot with the same dimensions drives instead."); standIn(); await new Promise(r => setTimeout(r, 1400));
    }
    explodeOffsets();
    $("cadStat").textContent = robot.source === "cad" ? `${robot.parts.length} parts · ${new Set(robot.parts.map(p => p.file)).size} DAE files` : "stand-in";
    bootStep("warming up the air: two minutes of simulated time"); await new Promise(r => setTimeout(r, 16));
    newWorld(120); setMode("oddech"); setSpeed(1); applyShow(); renderTree(); renderInspector(); setCam("orbit");
    requestAnimationFrame(frame);
    setTimeout(() => $("boot").classList.add("done"), 250);
    window.OddechGz = { get world() { return world; }, bot, robot, RB, topic, OG, keys, setMode, setCam, setSpeed, setPlaying, select, sampleHere };   // for the tests
  }
  boot();
})();
