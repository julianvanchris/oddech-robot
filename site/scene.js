/* Oddech live simulation (section 06): the model flat in Three.js. The air is shown as a coloured slice at a chosen height
   and as drifting particles; the robot drives, raises its mast and samples; people carry a ring with Oddech's estimate of
   their air; the purifier, window, stove and candle respond to the controls and to Oddech's advice.
   Physics, map, planning and advice live in sim.js (window.OddechSim); this file only draws and wires the controls. */
(function () {
  "use strict";
  const T = window.THREE, S = window.OddechSim, R = window.OddechRobot;
  if (!T || !S || !R) return;
  const { ROOM, NX, NY, NZ, LAYOUT, LOG, EXP } = S, L = ROOM.Lx, W = ROOM.Ly, H = ROOM.H;
  const P = (x, y, z) => new T.Vector3(x - L / 2, z, W / 2 - y);
  const $ = id => document.getElementById(id);

  // ---------------------------------------------------------------- colour maps (indigo = clean, terracotta = heavy)
  function ramp(stops) {
    const c = stops.map(([t, h]) => [t, parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
    return t => {
      t = Math.max(0, Math.min(1, t)); let i = 1; while (i < c.length - 1 && t > c[i][0]) i++;
      const a = c[i - 1], b = c[i], f = (t - a[0]) / (b[0] - a[0] || 1);
      return [a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f, a[3] + (b[3] - a[3]) * f];
    };
  }
  const CONC = ramp([[0, "#20344d"], [0.22, "#4d6d94"], [0.4, "#a7b3bf"], [0.54, "#e4d1b0"], [0.68, "#dd9b63"], [0.82, "#bf572b"], [1, "#651d0f"]]);
  const SDR = ramp([[0, "#111824"], [0.5, "#46628c"], [1, "#eaf0f8"]]);
  const ERR = ramp([[0, "#262422"], [0.4, "#7a4a35"], [0.7, "#c0582c"], [1, "#f2c7a3"]]);
  const CMAX = 300, TICKS = [5, 15, 35, 75, 150, 300];
  const tC = c => Math.log(1 + Math.max(0, c) / 4) / Math.log(1 + CMAX / 4);
  window.OddechColors = { CONC, SDR, ERR, tC, TICKS };             // shared with results.js and cloud.js
  const hexOf = rgb => (Math.round(rgb[0]) << 16) | (Math.round(rgb[1]) << 8) | Math.round(rgb[2]);
  const fmt = v => (v === null || v === undefined || !isFinite(v)) ? "–" : v < 10 ? v.toFixed(1) : Math.round(v).toString();
  const clock = t => { t = Math.floor(t); const h = Math.floor(t / 3600), m = Math.floor(t / 60) % 60, s = t % 60; return (h ? h + ":" : "") + String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0"); };

  function init() {
    const canvas = $("simCanvas"), stageEl = $("simStage"), labelsEl = $("simLabels");
    let renderer;
    try { renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" }); }
    catch (e) { $("msgText").textContent = "This browser could not start WebGL, so the 3D model cannot be shown."; return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.outputEncoding = T.sRGBEncoding; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.setClearColor(0x0d0c0b, 1);
    const scene = new T.Scene(); scene.fog = new T.Fog(0x0d0c0b, 30, 58);
    const cam = new T.PerspectiveCamera(32, 1, 0.05, 90);
    const room = new T.Group(); scene.add(room);

    // ---------------------------------------------------------------- light
    scene.add(new T.HemisphereLight(0xf3e7d6, 0x1d1a17, 0.5));
    const key = new T.DirectionalLight(0xfff1e0, 1.15); key.position.set(-5, 10, 7); key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048); Object.assign(key.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 1, far: 30 }); key.shadow.bias = -0.0004; scene.add(key);
    const lamp = new T.PointLight(0xffd2a1, 0.9, 7, 2); lamp.position.copy(P(4.0, 4.1, 2.0)); scene.add(lamp);
    const winGlow = new T.PointLight(0xff9a55, 0.7, 6, 2); winGlow.position.copy(P(5.5, 5.6, 1.6)); scene.add(winGlow);
    const candleL = new T.PointLight(0xffa64d, 0, 2.8, 2); candleL.position.copy(P(4.0, 4.1, 1.0)); scene.add(candleL);
    const stoveL = new T.PointLight(0xff5a1f, 0, 2.4, 2); stoveL.position.copy(P(1.25, 5.55, 1.05)); scene.add(stoveL);

    // ---------------------------------------------------------------- materials and a box helper in room coordinates
    const mat = (c, o) => new T.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.85, metalness: 0 }, o || {}));
    const mWall = mat(0xC9C1B4, { roughness: 0.95 }), mWood = mat(0x8E6F55, { roughness: 0.7 }), mDarkWood = mat(0x5B4636, { roughness: 0.75 });
    const mCounter = mat(0xD9D3C8, { roughness: 0.6 }), mTop = mat(0x34302B, { roughness: 0.4 }), mFabric = mat(0x6B5F55, { roughness: 1 });
    const mDark = mat(0x26231F, { roughness: 0.5 }), mShell = mat(0xF1ECE3, { roughness: 0.4 }), mPerson = mat(0xE9E2D6, { roughness: 0.9 });
    function box(x0, y0, x1, y1, z0, z1, m, shadow) {
      const mesh = new T.Mesh(new T.BoxGeometry(x1 - x0, z1 - z0, y1 - y0), m);
      mesh.position.copy(P((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2));
      mesh.castShadow = shadow !== false; mesh.receiveShadow = true; room.add(mesh); return mesh;
    }
    function cyl(x, y, z0, z1, r, m, seg) {
      const mesh = new T.Mesh(new T.CylinderGeometry(r, r, z1 - z0, seg || 32), m);
      mesh.position.copy(P(x, y, (z0 + z1) / 2)); mesh.castShadow = true; mesh.receiveShadow = true; room.add(mesh); return mesh;
    }
    function canvasTex(w, h, draw) { const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h); const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; return t; }
    // a line with a fixed-size buffer, so long runs do not allocate GPU memory every frame
    function liveLine(max, material) {
      const g = new T.BufferGeometry(), pos = new Float32Array(max * 3), dist = new Float32Array(max);
      g.setAttribute("position", new T.BufferAttribute(pos, 3)); g.setAttribute("lineDistance", new T.BufferAttribute(dist, 1)); g.setDrawRange(0, 0);
      const line = new T.Line(g, material); line.frustumCulled = false;
      line.set = pts => {
        const n = Math.min(max, pts.length); let d = 0;
        for (let i = 0; i < n; i++) { pos[3 * i] = pts[i].x; pos[3 * i + 1] = pts[i].y; pos[3 * i + 2] = pts[i].z; if (i) d += pts[i].distanceTo(pts[i - 1]); dist[i] = d; }
        g.setDrawRange(0, n); g.attributes.position.needsUpdate = true; g.attributes.lineDistance.needsUpdate = true;
      };
      return line;
    }

    // floor with planks
    const floorTex = canvasTex(1024, 768, (g, w, h) => {
      g.fillStyle = "#3a322b"; g.fillRect(0, 0, w, h);
      const rows = 26, rh = h / rows;
      for (let r = 0; r < rows; r++) {
        let x = -(r * 97 % 180);
        while (x < w) { const len = 140 + (r * 53 + Math.abs(x)) % 160; const s = 0.9 + 0.2 * ((r * 7 + Math.floor(Math.abs(x))) % 5) / 5;
          g.fillStyle = `rgb(${Math.round(58 * s)},${Math.round(50 * s)},${Math.round(43 * s)})`; g.fillRect(x + 1, r * rh + 1, len - 2, rh - 2); x += len; }
      }
    });
    const floor = new T.Mesh(new T.PlaneGeometry(L, W), new T.MeshStandardMaterial({ map: floorTex, roughness: 0.85 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; room.add(floor);

    // walls: left and back full height (window in the back), right wall low with the doorway, a skirting at the front
    const Wn = LAYOUT.window, D = LAYOUT.door;
    box(-0.1, -0.1, 0, W + 0.1, 0, H, mWall);
    box(-0.1, W, Wn.x0, W + 0.1, 0, H, mWall); box(Wn.x1, W, L + 0.1, W + 0.1, 0, H, mWall);
    box(Wn.x0, W, Wn.x1, W + 0.1, 0, Wn.z0, mWall); box(Wn.x0, W, Wn.x1, W + 0.1, Wn.z1, H, mWall);
    box(L, -0.1, L + 0.1, D.y0, 0, 1.0, mWall); box(L, D.y1, L + 0.1, W + 0.1, 0, 1.0, mWall);
    box(-0.1, -0.1, L + 0.1, 0, 0, 0.1, mWall);
    // window: frame, a pane that swings in, the smoggy city outside
    const mFrame = mat(0x2F2B27, { roughness: 0.5 });
    box(Wn.x0 - 0.04, W - 0.04, Wn.x1 + 0.04, W, Wn.z0 - 0.04, Wn.z0, mFrame); box(Wn.x0 - 0.04, W - 0.04, Wn.x1 + 0.04, W, Wn.z1, Wn.z1 + 0.04, mFrame);
    box(Wn.x0 - 0.04, W - 0.04, Wn.x0, W, Wn.z0, Wn.z1, mFrame); box(Wn.x1, W - 0.04, Wn.x1 + 0.04, W, Wn.z0, Wn.z1, mFrame);
    box(Wn.x0 - 0.1, W - 0.18, Wn.x1 + 0.1, W, Wn.z0 - 0.04, Wn.z0, mCounter);
    const paneHinge = new T.Group(); paneHinge.position.copy(P(Wn.x0, W - 0.02, Wn.z0)); room.add(paneHinge);
    const pane = new T.Mesh(new T.PlaneGeometry(Wn.x1 - Wn.x0, Wn.z1 - Wn.z0), new T.MeshStandardMaterial({ color: 0xA8BACB, transparent: true, opacity: 0.16, roughness: 0.05, metalness: 0.2, side: T.DoubleSide }));
    pane.position.set((Wn.x1 - Wn.x0) / 2, (Wn.z1 - Wn.z0) / 2, 0); paneHinge.add(pane);
    const cityTex = canvasTex(1024, 512, (g, w, h) => {
      const sky = g.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, "#0d1016"); sky.addColorStop(0.55, "#3b2a1f"); sky.addColorStop(0.8, "#7a4a2a"); sky.addColorStop(1, "#2b1e16");
      g.fillStyle = sky; g.fillRect(0, 0, w, h);
      let x = 0, seed = 7; const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
      while (x < w) { const bw = 40 + rnd() * 90, bh = 90 + rnd() * 210; g.fillStyle = "#16120f"; g.fillRect(x, h - bh, bw, bh);
        for (let yy = h - bh + 12; yy < h - 10; yy += 18) for (let xx = x + 8; xx < x + bw - 8; xx += 14) if (rnd() < 0.3) { g.fillStyle = `rgba(255,${Math.round(180 + rnd() * 50)},${Math.round(110 + rnd() * 40)},${(0.35 + rnd() * 0.5).toFixed(2)})`; g.fillRect(xx, yy, 5, 7); }
        x += bw + 4; }
      g.fillStyle = "#120f0c";                                        // two spires on the skyline
      g.fillRect(610, h - 330, 34, 330); g.beginPath(); g.moveTo(604, h - 330); g.lineTo(627, h - 410); g.lineTo(650, h - 330); g.fill();
      g.fillRect(670, h - 290, 26, 290); g.beginPath(); g.moveTo(665, h - 290); g.lineTo(683, h - 345); g.lineTo(701, h - 290); g.fill();
    });
    const city = new T.Mesh(new T.PlaneGeometry(3.4, 1.9), new T.MeshBasicMaterial({ map: cityTex, fog: false }));
    city.position.copy(P((Wn.x0 + Wn.x1) / 2, W + 0.9, 1.6)); room.add(city);
    const hazeM = new T.MeshBasicMaterial({ color: 0x8a6a50, transparent: true, opacity: 0.3, fog: false, depthWrite: false });
    const haze = new T.Mesh(new T.PlaneGeometry(3.4, 1.9), hazeM); haze.position.copy(P((Wn.x0 + Wn.x1) / 2, W + 0.5, 1.6)); room.add(haze);

    // kitchen
    box(0, 5.35, 2.8, 6, 0, 0.86, mCounter); box(0, 5.33, 2.8, 6, 0.86, 0.9, mTop);
    box(0, 3.4, 0.62, 4.05, 0, 1.85, mat(0xCFC9BE, { roughness: 0.45 }));            // fridge
    box(0, 4.05, 0.62, 5.35, 0, 0.86, mCounter); box(0, 4.05, 0.64, 5.35, 0.86, 0.9, mTop);
    box(0, 5.68, 2.8, 6, 1.45, 2.15, mCounter);                                        // wall cabinets
    box(0.95, 5.38, 1.6, 5.88, 0.9, 0.912, mat(0x111111, { roughness: 0.1, metalness: 0.3 }));
    const burnerM = new T.MeshStandardMaterial({ color: 0x331a10, emissive: 0xff4a10, emissiveIntensity: 0, roughness: 0.4 });
    for (const [bx, by] of [[1.12, 5.55], [1.42, 5.72]]) { const b = new T.Mesh(new T.TorusGeometry(0.075, 0.007, 8, 40), burnerM); b.rotation.x = Math.PI / 2; b.position.copy(P(bx, by, 0.915)); room.add(b); }
    cyl(1.12, 5.55, 0.915, 1.05, 0.11, mat(0x9A9389, { metalness: 0.7, roughness: 0.3 }), 32);
    box(0.9, 5.7, 1.65, 6, 1.95, 2.1, mat(0x46413B, { roughness: 0.5 }));             // hood
    // dining table, chairs, candle, pendant
    box(3.15, 3.55, 4.85, 4.65, 0.72, 0.76, mWood);
    for (const [lx, ly] of [[3.2, 3.6], [4.75, 3.6], [3.2, 4.55], [4.75, 4.55]]) box(lx, ly, lx + 0.05, ly + 0.05, 0, 0.72, mDarkWood);
    for (const [cx, cy, s] of [[3.6, 3.45, -1], [4.4, 3.45, -1], [3.6, 4.75, 1], [4.4, 4.75, 1]]) {
      box(cx - 0.2, cy - 0.17, cx + 0.2, cy + 0.17, 0.42, 0.46, mDarkWood);
      box(cx - 0.2, cy + s * 0.17 - 0.02, cx + 0.2, cy + s * 0.17 + 0.02, 0.46, 0.9, mDarkWood);
      for (const [dx, dy] of [[-0.17, -0.14], [0.15, -0.14], [-0.17, 0.12], [0.15, 0.12]]) box(cx + dx, cy + dy, cx + dx + 0.025, cy + dy + 0.025, 0, 0.42, mDarkWood, false);
    }
    cyl(4.0, 4.1, 0.76, 0.87, 0.03, mat(0xF2EDE4, { roughness: 0.6 }), 20);
    const flame = new T.Mesh(new T.ConeGeometry(0.014, 0.05, 12), new T.MeshBasicMaterial({ color: 0xffc070 })); flame.position.copy(P(4.0, 4.1, 0.9)); room.add(flame);
    const shade = new T.Mesh(new T.CylinderGeometry(0.12, 0.26, 0.2, 40, 1, true), mat(0xD8CFC0, { side: T.DoubleSide, emissive: 0x3a2a18 })); shade.position.copy(P(4.0, 4.1, 2.0)); room.add(shade);
    // sofa, coffee table, rug
    box(4.5, 1.1, 6.8, 2.6, 0, 0.008, mat(0x4D443D, { roughness: 1 }), false);
    box(4.6, 0.15, 6.9, 1.05, 0, 0.42, mFabric); box(4.6, 0.15, 6.9, 0.38, 0.42, 0.86, mFabric);
    box(4.6, 0.15, 4.78, 1.05, 0.42, 0.62, mFabric); box(6.72, 0.15, 6.9, 1.05, 0.42, 0.62, mFabric);
    box(5.0, 1.5, 6.2, 2.05, 0.38, 0.42, mWood); for (const [lx, ly] of [[5.03, 1.53], [6.13, 1.53], [5.03, 1.98], [6.13, 1.98]]) box(lx, ly, lx + 0.04, ly + 0.04, 0, 0.38, mDarkWood, false);
    // bookshelf with books, and the household monitor
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
    const monScreen = new T.Mesh(new T.PlaneGeometry(0.13, 0.08), new T.MeshBasicMaterial({ map: monTex }));
    monScreen.position.copy(P(7.655, 2.6, 1.43)); monScreen.rotation.y = -Math.PI / 2; room.add(monScreen);
    // play mat with blocks, a plant by the window, the robot's dock
    box(2.7, 0.9, 4.3, 2.5, 0, 0.014, mat(0xCDB89A, { roughness: 1 }), false);
    for (const [bx, by, c] of [[3.0, 1.2, 0xB4532A], [3.12, 1.3, 0x2E4A6E], [3.9, 2.1, 0xD9A441]]) box(bx, by, bx + 0.08, by + 0.08, 0.014, 0.094, mat(c, { roughness: 0.6 }));
    cyl(6.75, 5.6, 0, 0.32, 0.16, mat(0x8D5B42, { roughness: 0.8 }), 24);
    for (const [dx, dy, dz, r] of [[0, 0, 0.62, 0.24], [0.1, 0.06, 0.82, 0.16], [-0.08, -0.05, 0.78, 0.18]]) { const s = new T.Mesh(new T.IcosahedronGeometry(r, 1), mat(0x56664A, { roughness: 1, flatShading: true })); s.position.copy(P(6.75 + dx, 5.6 + dy, dz)); s.castShadow = true; room.add(s); }
    box(7.62, 4.82, 7.82, 5.18, 0, 0.1, mDark); box(7.6, 4.9, 7.62, 5.1, 0.04, 0.06, new T.MeshBasicMaterial({ color: 0x7E98BC }), false);

    // ---------------------------------------------------------------- people, purifier, robot
    function person(p) {
      const g = new T.Group();
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
      g.rotation.y = Math.PI / 2;                                    // facing into the room (+y)
      g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
      g.position.copy(P(p.x, p.y, 0)); scene.add(g);
      const ringM = new T.MeshBasicMaterial({ color: 0x7E98BC, transparent: true, opacity: 0.85, side: T.DoubleSide, depthWrite: false });
      const ring = new T.Mesh(new T.RingGeometry(0.34, 0.38, 64), ringM); ring.rotation.x = -Math.PI / 2; ring.position.copy(P(p.x, p.y, 0.02)); scene.add(ring);
      return { g, ring, ringM };
    }
    const people = LAYOUT.people.map(p => person(p));

    const pur = new T.Group(); scene.add(pur);
    const purBody = new T.Mesh(new T.CylinderGeometry(0.17, 0.18, 0.62, 48), mShell); purBody.position.y = 0.31; purBody.castShadow = true; pur.add(purBody);
    const purTop = new T.Mesh(new T.CylinderGeometry(0.15, 0.15, 0.012, 48), mDark); purTop.position.y = 0.625; pur.add(purTop);
    const purRingM = new T.MeshStandardMaterial({ color: 0x2E4A6E, emissive: 0x7E98BC, emissiveIntensity: 0 });
    const purRing = new T.Mesh(new T.TorusGeometry(0.172, 0.006, 8, 64), purRingM); purRing.rotation.x = Math.PI / 2; purRing.position.y = 0.6; pur.add(purRing);
    const fan = new T.Group(); fan.position.y = 0.635; pur.add(fan);
    for (let k = 0; k < 5; k++) { const b = new T.Mesh(new T.BoxGeometry(0.12, 0.004, 0.035), mat(0x6E675E)); b.position.x = 0.06; const holder = new T.Group(); holder.rotation.y = k * 2 * Math.PI / 5; holder.add(b); fan.add(holder); }
    const intakeBand = new T.Mesh(new T.CylinderGeometry(0.182, 0.182, 0.22, 48, 1, true), mat(0x7B746B, { side: T.DoubleSide, roughness: 1 })); intakeBand.position.y = 0.16; pur.add(intakeBand);

    const rob = R.buildRobot({ sampler: true }); scene.add(rob.group);

    // ---------------------------------------------------------------- the air: slice and particles
    const sliceData = new Uint8Array(NX * NY * 4), sliceTex = new T.DataTexture(sliceData, NX, NY, T.RGBAFormat);
    sliceTex.magFilter = sliceTex.minFilter = T.LinearFilter; sliceTex.encoding = T.sRGBEncoding; sliceTex.needsUpdate = true;
    const sdData = new Uint8Array(20 * 15 * 4), sdTex = new T.DataTexture(sdData, 20, 15, T.RGBAFormat);
    sdTex.magFilter = sdTex.minFilter = T.LinearFilter; sdTex.encoding = T.sRGBEncoding; sdTex.needsUpdate = true;
    const sliceM = new T.MeshBasicMaterial({ map: sliceTex, transparent: true, opacity: 0.66, side: T.DoubleSide, depthWrite: false, fog: false });
    const slice = new T.Mesh(new T.PlaneGeometry(L, W), sliceM); slice.rotation.x = -Math.PI / 2; slice.renderOrder = 2; scene.add(slice);
    const sliceEdge = new T.LineLoop(new T.BufferGeometry().setFromPoints([P(0, 0, 0), P(L, 0, 0), P(L, W, 0), P(0, W, 0)]), new T.LineBasicMaterial({ color: 0x9C958A, transparent: true, opacity: 0.6 }));
    scene.add(sliceEdge);

    const NP = window.innerWidth < 900 ? 1100 : 2400, NCELL = NX * NY * NZ;
    const pp = new Float32Array(NP * 3), pPos = new Float32Array(NP * 3), pCol = new Float32Array(NP * 3), pA = new Float32Array(NP), pS = new Float32Array(NP);
    const pg = new T.BufferGeometry();
    pg.setAttribute("position", new T.BufferAttribute(pPos, 3)); pg.setAttribute("aColor", new T.BufferAttribute(pCol, 3));
    pg.setAttribute("aAlpha", new T.BufferAttribute(pA, 1)); pg.setAttribute("aSize", new T.BufferAttribute(pS, 1));
    const pMat = new T.ShaderMaterial({
      uniforms: { uScale: { value: 600 } }, transparent: true, depthWrite: false,
      vertexShader: "attribute vec3 aColor; attribute float aAlpha; attribute float aSize; uniform float uScale; varying vec3 vC; varying float vA;" +
        "void main(){ vC = aColor; vA = aAlpha; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = max(1.5, aSize * uScale / -mv.z); gl_Position = projectionMatrix * mv; }",
      fragmentShader: "varying vec3 vC; varying float vA; void main(){ vec2 d = gl_PointCoord - 0.5; float r = dot(d, d); if (r > 0.25) discard; gl_FragColor = vec4(vC, vA * smoothstep(0.25, 0.02, r)); }",
    });
    const points = new T.Points(pg, pMat); points.frustumCulled = false; points.renderOrder = 3; scene.add(points);
    const cdf = new Float32Array(NCELL); let cdfTotal = 0;
    function buildCdf(C) { let s = 0; for (let n = 0; n < NCELL; n++) { s += C[n]; cdf[n] = s; } cdfTotal = s; }
    function placeParticle(q) {                                    // particles are drawn where the dust is, in proportion
      const u = Math.random() * cdfTotal; let lo = 0, hi = NCELL - 1;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (cdf[mid] < u) lo = mid + 1; else hi = mid; }
      const i = lo % NX, j = Math.floor(lo / NX) % NY, k = Math.floor(lo / (NX * NY));
      pp[3 * q] = (i + Math.random()) * S.DX; pp[3 * q + 1] = (j + Math.random()) * S.DY; pp[3 * q + 2] = Math.max(0.03, (k + Math.random()) * S.DZ);
    }
    for (let q = 0; q < NP; q++) pS[q] = 0.016 + 0.022 * Math.random();

    // path, target, trail, samples, hot spot, the monitor's pulse
    const pathLine = liveLine(64, new T.LineDashedMaterial({ color: 0x9fb4d2, dashSize: 0.12, gapSize: 0.08, transparent: true, opacity: 0.95 })); scene.add(pathLine);
    const trailLine = liveLine(320, new T.LineBasicMaterial({ color: 0x77716a, transparent: true, opacity: 0.55 })); scene.add(trailLine);
    const tgt = new T.Group(); scene.add(tgt);
    const tgtRing = new T.Mesh(new T.RingGeometry(0.2, 0.235, 48), new T.MeshBasicMaterial({ color: 0x9fb4d2, transparent: true, opacity: 0.9, side: T.DoubleSide, depthWrite: false })); tgtRing.rotation.x = -Math.PI / 2; tgtRing.position.y = 0.02; tgt.add(tgtRing);
    const beam = new T.Mesh(new T.CylinderGeometry(0.008, 0.008, 1.7, 8), new T.MeshBasicMaterial({ color: 0x9fb4d2, transparent: true, opacity: 0.4 })); beam.position.y = 0.85; tgt.add(beam);
    const MAXS = 140, sampMesh = new T.InstancedMesh(new T.SphereGeometry(0.035, 12, 10), new T.MeshBasicMaterial({ color: 0xffffff }), MAXS);
    sampMesh.instanceMatrix.setUsage(T.DynamicDrawUsage); sampMesh.count = 0; sampMesh.frustumCulled = false; scene.add(sampMesh);
    const hotRing = new T.Mesh(new T.RingGeometry(0.42, 0.46, 64), new T.MeshBasicMaterial({ color: 0xD9875C, transparent: true, opacity: 0.0, side: T.DoubleSide, depthWrite: false })); hotRing.rotation.x = -Math.PI / 2; scene.add(hotRing);
    const monPulse = new T.Mesh(new T.RingGeometry(0.06, 0.075, 40), new T.MeshBasicMaterial({ color: 0xEDE8DF, transparent: true, opacity: 0, side: T.DoubleSide, depthWrite: false }));
    monPulse.position.copy(P(7.62, 2.6, 1.43)); monPulse.rotation.y = -Math.PI / 2; scene.add(monPulse);

    // ---------------------------------------------------------------- labels
    function label(cls) { const d = document.createElement("div"); d.className = "slab " + (cls || ""); labelsEl.appendChild(d); return d; }
    const lab = { child: label("acc"), adult: label("acc"), monitor: label(), purifier: label("ind"), robot: label("ind"), outdoor: label(), hot: label("acc") };

    // ---------------------------------------------------------------- camera: orbit, pan, zoom, presets
    const orbit = { th: 0.58, ph: 0.93, r: 22, t: new T.Vector3(0.4, -0.7, 0.6) }, goal = { th: 0.58, ph: 0.93, r: 22, t: new T.Vector3(0.4, -0.7, 0.6) };
    let camMode = "orbit", drag = null, engaged = false, zoomed = false;
    const PRESET = { orbit: { th: 0.58, ph: 0.93, r: 22, t: [0.4, -0.7, 0.6] }, top: { th: 0, ph: 0.02, r: 19, t: [0.3, 0, 0.7] } };
    function preset(n) { camMode = n; const p = PRESET[n]; if (p) { goal.th = p.th; goal.ph = p.ph; goal.r = p.r; goal.t.set(p.t[0], p.t[1], p.t[2]); } }
    canvas.addEventListener("pointerdown", e => {
      engaged = true;
      drag = { x: e.clientX, y: e.clientY, pan: e.shiftKey || e.button === 2, th: goal.th, ph: goal.ph, t: goal.t.clone() };
      if (camMode === "follow" && !drag.pan) { camMode = "orbit"; setOn("camBtns", "c", "orbit"); }
    });
    canvas.addEventListener("pointermove", e => {
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (drag.pan) {
        const right = new T.Vector3(Math.cos(goal.th), 0, -Math.sin(goal.th)), fwd = new T.Vector3(-Math.sin(goal.th), 0, -Math.cos(goal.th));
        goal.t.copy(drag.t).addScaledVector(right, -dx * 0.001 * goal.r).addScaledVector(fwd, dy * 0.001 * goal.r);
      } else { goal.th = drag.th - dx * 0.006; goal.ph = Math.min(1.45, Math.max(0.02, drag.ph - dy * 0.005)); }
    });
    const endDrag = () => { drag = null; };
    window.addEventListener("pointerup", endDrag); canvas.addEventListener("pointercancel", endDrag);
    canvas.addEventListener("contextmenu", e => e.preventDefault());
    canvas.addEventListener("wheel", e => {
      if (!(engaged || e.ctrlKey || document.documentElement.classList.contains("present"))) return;
      e.preventDefault(); zoomed = true; goal.r = Math.min(32, Math.max(2.5, goal.r * (1 + e.deltaY * 0.0012)));
    }, { passive: false });
    stageEl.addEventListener("pointerleave", () => { engaged = false; });

    // ---------------------------------------------------------------- the world and its controls
    let world, scenario = "cooking", policy = "oddech", purMode = "auto", cadr = 300, speed = 30, running = true, layer = "truth", sliceZ = 1.1;
    let voice = "warm", unc = "stated", lastAdviceT = -1, showParticles = true, showTrail = true;
    function setOn(groupId, attr, val) { document.querySelectorAll("#" + groupId + " [data-" + attr + "]").forEach(b => b.classList.toggle("on", b.dataset[attr] === String(val))); }
    function newWorld() {
      world = new S.World({ scenario, seed: 11 + Math.floor(Math.random() * 100000), policy, purifierMode: purMode, cadr });
      world.follow = $("followAdv").checked;
      buildCdf(world.air.C); for (let q = 0; q < NP; q++) placeParticle(q);
      lastAdviceT = -1; $("msgText").textContent = "Warming up: the robot is taking its first readings."; $("msgActions").innerHTML = ""; $("msgLog").innerHTML = "";
      $("scNote").textContent = S.SCENARIOS[scenario].note; syncControls(); paintSlice(); drawCharts();
    }
    const scBtns = $("scBtns");
    for (const k in S.SCENARIOS) { const b = document.createElement("button"); b.className = "chip" + (k === scenario ? " on" : ""); b.dataset.sc = k; b.textContent = S.SCENARIOS[k].label; scBtns.appendChild(b); }
    scBtns.addEventListener("click", e => { const b = e.target.closest("[data-sc]"); if (!b) return; scenario = b.dataset.sc; setOn("scBtns", "sc", scenario); newWorld(); });
    document.querySelectorAll("#simPanel .tab").forEach(t => t.addEventListener("click", () => {
      document.querySelectorAll("#simPanel .tab").forEach(x => x.classList.toggle("on", x === t));
      document.querySelectorAll("#simPanel .tabpane").forEach(p => p.classList.toggle("on", p.dataset.pane === t.dataset.tab));
    }));
    $("playBtn").addEventListener("click", () => { running = !running; $("playBtn").textContent = running ? "Pause" : "Play"; $("playBtn").classList.toggle("on", running); });
    $("resetBtn").addEventListener("click", newWorld);
    $("speedBtns").addEventListener("click", e => { const b = e.target.closest("[data-s]"); if (!b) return; speed = +b.dataset.s; setOn("speedBtns", "s", speed); });
    $("followAdv").addEventListener("change", e => { world.follow = e.target.checked; });
    $("coutR").addEventListener("input", e => { world.set({ cout: +e.target.value }); $("coutV").textContent = e.target.value + " µg/m³"; });
    $("winT").addEventListener("change", e => world.set({ windowOpen: e.target.checked }));
    $("stoveT").addEventListener("change", e => world.set({ stoveOn: e.target.checked }));
    $("candleT").addEventListener("change", e => world.set({ candleOn: e.target.checked }));
    $("matT").addEventListener("change", e => world.set({ matOn: e.target.checked }));
    $("purBtns").addEventListener("click", e => { const b = e.target.closest("[data-m]"); if (!b) return; purMode = b.dataset.m; world.setPurifierMode(purMode, cadr); setOn("purBtns", "m", purMode); });
    $("cadrR").addEventListener("input", e => { cadr = +e.target.value; world.setPurifierMode(world.purifierMode, cadr); $("cadrV").textContent = cadr + " m³/h"; });
    $("purHome").addEventListener("click", () => world.set({ purifier: Object.assign({}, LAYOUT.purifier) }));
    $("polBtns").addEventListener("click", e => { const b = e.target.closest("[data-p]"); if (!b) return; policy = b.dataset.p; setOn("polBtns", "p", policy);
      const r = world.live.robot; r.policy = policy; if (r.state === "drive") r.state = "plan"; });
    $("layerBtns").addEventListener("click", e => { const b = e.target.closest("[data-l]"); if (!b) return; layer = b.dataset.l; setOn("layerBtns", "l", layer); paintSlice(); drawLegend(); });
    $("sliceBtns").addEventListener("click", e => { const b = e.target.closest("[data-z]"); if (!b) return; sliceZ = +b.dataset.z; setOn("sliceBtns", "z", b.dataset.z); paintSlice(); drawLegend(); });
    $("partT").addEventListener("change", e => { showParticles = e.target.checked; points.visible = showParticles; });
    $("trailT").addEventListener("change", e => { showTrail = e.target.checked; });
    $("camBtns").addEventListener("click", e => { const b = e.target.closest("[data-c]"); if (!b) return; setOn("camBtns", "c", b.dataset.c); preset(b.dataset.c); });
    $("voiceBtns").addEventListener("click", e => { const b = e.target.closest("[data-v]"); if (!b) return; voice = b.dataset.v; setOn("voiceBtns", "v", voice); renderAdvice(true); });
    $("uncBtns").addEventListener("click", e => { const b = e.target.closest("[data-u]"); if (!b) return; unc = b.dataset.u; setOn("uncBtns", "u", unc); renderAdvice(true); });
    $("msgActions").addEventListener("click", e => { const b = e.target.closest("[data-a]"); if (!b || !world.advice) return; const a = world.advice.actions[+b.dataset.a]; if (a) { world.applyAction(a); syncControls(); $("msgActions").innerHTML = ""; renderLog(); } });
    $("panelToggle").addEventListener("click", () => $("simPanel").classList.toggle("open"));

    function syncControls() {
      const c = world.air.cfg;
      $("winT").checked = c.windowOpen; $("stoveT").checked = c.stoveOn; $("candleT").checked = c.candleOn; $("matT").checked = c.matOn;
      if (document.activeElement !== $("coutR")) { $("coutR").value = c.cout; $("coutV").textContent = Math.round(c.cout) + " µg/m³"; }
      cadr = world.cadrSet; if (document.activeElement !== $("cadrR")) { $("cadrR").value = cadr; $("cadrV").textContent = cadr + " m³/h"; }
      purMode = world.purifierMode; setOn("purBtns", "m", purMode);
    }

    // ---------------------------------------------------------------- painting the slice and the legend
    function paintSlice() {
      if (!world) return;
      const m = world.live.map, z = sliceZ;
      if (layer === "sd" && m.ready) {
        const g = m.grid(z, world.t, 20, 15, true);
        for (let q = 0; q < 300; q++) { const c = SDR(g.sd[q] / 0.75); sdData[4 * q] = c[0]; sdData[4 * q + 1] = c[1]; sdData[4 * q + 2] = c[2]; sdData[4 * q + 3] = 215; }
        sdTex.needsUpdate = true; if (sliceM.map !== sdTex) { sliceM.map = sdTex; sliceM.needsUpdate = true; }
      } else {
        const truth = world.air.plane(z, null, layer === "harm" ? world.air.O : null), g = (layer !== "truth" && layer !== "harm" && m.ready) ? m.grid(z, world.t, NX, NY, false) : null;
        for (let q = 0; q < NX * NY; q++) {
          let c, a;
          if (layer === "err" && g) { c = ERR(Math.abs(g.mu[q] - LOG(truth[q]))); a = 205; }
          else { const t = tC((layer === "est" && g) ? EXP(g.mu[q]) : truth[q]); c = CONC(t); a = 40 + 175 * t; }
          sliceData[4 * q] = c[0]; sliceData[4 * q + 1] = c[1]; sliceData[4 * q + 2] = c[2]; sliceData[4 * q + 3] = a;
        }
        sliceTex.needsUpdate = true; if (sliceM.map !== sliceTex) { sliceM.map = sliceTex; sliceM.needsUpdate = true; }
      }
      slice.position.y = z; sliceEdge.position.y = z;
      slice.visible = sliceEdge.visible = layer !== "off";
    }
    function drawLegend() {
      const cv = $("legendCanvas"), g = cv.getContext("2d"), w = cv.width, h = cv.height;
      for (let x = 0; x < w; x++) { const t = x / (w - 1), c = layer === "sd" ? SDR(t) : layer === "err" ? ERR(t) : CONC(t); g.fillStyle = `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`; g.fillRect(x, 0, 1, h); }
      cv.style.visibility = $("legendTicks").style.visibility = layer === "off" ? "hidden" : "visible";
      const names = { truth: "Simulated PM2.5 at ", harm: "Harm-weighted PM2.5 (dust × relative harm of its source) at ", est: "Oddech's map of PM2.5 at ", sd: "Map uncertainty at ", err: "Map error at ", off: "Particles only, coloured by the simulated PM2.5 at " };
      $("legendName").textContent = names[layer] + sliceZ.toFixed(1) + " m" + (layer === "sd" ? "" : layer === "err" ? ", as a factor" : ", µg/m³");
      let html;
      if (layer === "sd") html = `<span style="left:6%">sure</span><span style="left:94%">unsure</span>`;
      else if (layer === "err") html = [1, 1.3, 1.65, 2.1, 2.7].map(f => `<span style="left:${(Math.log(f) * 100).toFixed(1)}%">×${f}</span>`).join("");
      else html = TICKS.map(v => `<span style="left:${(tC(v) * 100).toFixed(1)}%">${v}</span>`).join("");
      $("legendTicks").innerHTML = html;
    }

    // ---------------------------------------------------------------- charts
    function chart(cv, series) {
      const dpr = Math.min(window.devicePixelRatio || 1, 2), w = cv.clientWidth, h = cv.clientHeight;
      if (!w || !h) return;
      if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
      const g = cv.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
      const hist = world.hist; if (hist.length < 2) return;
      const t0 = hist[0].t, t1 = hist[hist.length - 1].t, X = t => 30 + (w - 38) * (t - t0) / Math.max(1, t1 - t0);
      g.font = "9px 'JetBrains Mono', monospace";
      for (const s of series) {
        let max = s.max || 0; if (!s.max) for (const p of hist) { const v = s.get(p); if (v !== null && v !== undefined && isFinite(v)) max = Math.max(max, v); }
        max = max * 1.1 || 1; const Y = v => h - 14 - (h - 22) * v / max;
        if (s.band) {
          const pts = hist.filter(p => p.lo !== null && p.lo !== undefined);
          if (pts.length > 1) { g.fillStyle = s.band; g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(X(p.t), Y(p.hi)) : g.moveTo(X(p.t), Y(p.hi)));
            for (let i = pts.length - 1; i >= 0; i--) g.lineTo(X(pts[i].t), Y(pts[i].lo)); g.closePath(); g.fill(); }
        }
        g.strokeStyle = s.color; g.lineWidth = s.width || 1.4; g.setLineDash(s.dash || []); g.beginPath(); let on = false;
        for (const p of hist) { const v = s.get(p); if (v === null || v === undefined || !isFinite(v)) { on = false; continue; } const x = X(p.t), y = Y(v); if (on) g.lineTo(x, y); else { g.moveTo(x, y); on = true; } }
        g.stroke(); g.setLineDash([]);
        if (s.axis) { g.fillStyle = s.color; g.textAlign = "left"; g.fillText(s.axis(max / 1.1), 0, 9); }
        if (s.axisR) { g.fillStyle = s.color; g.textAlign = "right"; g.fillText(s.axisR(max / 1.1), w, 9); g.textAlign = "left"; }
      }
      g.strokeStyle = "rgba(237,232,223,.14)"; g.beginPath(); g.moveTo(30, h - 13.5); g.lineTo(w - 8, h - 13.5); g.stroke();
      g.fillStyle = "#77716a"; g.textAlign = "left"; g.fillText(clock(t0), 30, h - 2); g.textAlign = "right"; g.fillText(clock(t1), w - 8, h - 2); g.textAlign = "left";
    }
    function drawCharts() {
      if (!world) return;
      let mx = 0; for (const p of world.hist) mx = Math.max(mx, p.truthChild || 0, p.est || 0, p.monitor || 0, p.hi || 0);
      chart($("chartA"), [
        { get: p => p.truthChild, color: "#EDE8DF", max: mx, width: 1.2 },
        { get: p => p.monitor, color: "#8a847a", max: mx, dash: [3, 3] },
        { get: p => p.est, color: "#D9875C", max: mx, width: 1.8, band: "rgba(217,135,92,.16)", axis: v => Math.round(v) + " µg/m³" },
      ]);
      chart($("chartB"), [
        { get: p => p.err === null ? null : Math.exp(p.err), color: "#7E98BC", width: 1.6, axis: v => "×" + v.toFixed(2) },
        { get: p => p.dose, color: "#E8B48F", width: 1.2, dash: [4, 3], axisR: v => v.toFixed(1) + " µg" },
      ]);
    }

    // ---------------------------------------------------------------- advice
    function renderLog() { $("msgLog").innerHTML = world.log.slice(-3).reverse().map(l => `${clock(l.t)}&nbsp; ${l.text}`).join("<br>"); }
    function renderAdvice(force) {
      const a = world.advice;
      if (!a) return;
      if (!force && a.t === lastAdviceT) return;
      lastAdviceT = a.t;
      $("msgText").textContent = a.text[voice + "_" + unc];
      $("msgActions").innerHTML = a.actions.map((x, i) => `<button class="chip" data-a="${i}">${x.label}</button>`).join("");
      renderLog();
    }

    // ---------------------------------------------------------------- per-frame updates
    const v3 = new T.Vector3(), mtx = new T.Matrix4(), col = new T.Color();
    function placeLabel(el, p, html) {
      v3.copy(p).project(cam);
      if (v3.z > 1 || v3.x < -1.05 || v3.x > 1.05 || v3.y < -1.05 || v3.y > 1.05) { el.style.display = "none"; return; }
      const top = (1 - v3.y) / 2 * canvas.clientHeight;
      if (top < 150) { el.style.display = "none"; return; }             // keep the title and the clock clear
      el.style.display = "block"; el.style.left = ((v3.x + 1) / 2 * canvas.clientWidth) + "px"; el.style.top = top + "px";
      if (html !== undefined && el._h !== html) { el.innerHTML = html; el._h = html; }
    }
    const STATE = { plan: "choosing where to go", drive: "driving", sample: "measuring", retract: "lowering the mast", charge: "charging" };
    function updateParticles(dt) {
      const air = world.air, cfg = air.cfg, pu = cfg.purifier;
      if (dt > 0) {
        const sub = Math.max(1, Math.ceil(dt / 0.6)), hh = dt / sub, sig = Math.sqrt(2 * S.PHYS.K * hh);
        const g = () => (Math.random() + Math.random() + Math.random() - 1.5) * 2;
        for (let s = 0; s < sub; s++) for (let q = 0; q < NP; q++) {
          const i3 = 3 * q, x = pp[i3], y = pp[i3 + 1], z = pp[i3 + 2], vel = air.velocity(x, y, z);
          let nx = x + vel[0] * hh + sig * g(), ny = y + vel[1] * hh + sig * g(), nz = z + vel[2] * hh + sig * g();
          if (nx < 0.02) nx = 0.04 - nx; if (nx > L - 0.02) nx = 2 * (L - 0.02) - nx;
          if (ny < 0.02) ny = 0.04 - ny; if (ny > W - 0.02) ny = 2 * (W - 0.02) - ny;
          if (nz < 0.03) nz = 0.06 - nz; if (nz > H - 0.02) nz = 2 * (H - 0.02) - nz;
          pp[i3] = Math.min(L - 0.02, Math.max(0.02, nx)); pp[i3 + 1] = Math.min(W - 0.02, Math.max(0.02, ny)); pp[i3 + 2] = Math.min(H - 0.02, Math.max(0.03, nz));
        }
        const k = NP * Math.min(0.3, dt / 90), nRel = Math.floor(k) + (Math.random() < k % 1 ? 1 : 0);
        for (let r = 0; r < nRel; r++) placeParticle(Math.floor(Math.random() * NP));
        if (cfg.purifierOn) for (let q = 0; q < NP; q++) { const i3 = 3 * q; if (pp[i3 + 2] < 0.75 && Math.hypot(pp[i3] - pu.x, pp[i3 + 1] - pu.y) < 0.3) placeParticle(q); }
      }
      for (let q = 0; q < NP; q++) {
        const i3 = 3 * q, x = pp[i3], y = pp[i3 + 1], z = pp[i3 + 2], t = tC(air.at(x, y, z)), c = CONC(0.25 + 0.75 * t);
        pPos[i3] = x - L / 2; pPos[i3 + 1] = z; pPos[i3 + 2] = W / 2 - y;
        pCol[i3] = c[0] / 255; pCol[i3 + 1] = c[1] / 255; pCol[i3 + 2] = c[2] / 255; pA[q] = 0.08 + 0.7 * t;
      }
      pg.attributes.position.needsUpdate = true; pg.attributes.aColor.needsUpdate = true; pg.attributes.aAlpha.needsUpdate = true;
    }
    function updateScene(now) {
      const air = world.air, cfg = air.cfg, r = world.live.robot, m = world.live.map;
      rob.group.position.copy(P(r.x, r.y, 0)); rob.group.rotation.y = r.th; rob.setMast(r.mast);
      const here = r.profile[Math.max(0, Math.min(2, r.hIdx - 1))];
      rob.setRing(hexOf(CONC(0.25 + 0.75 * tC(here === null ? air.at(r.x, r.y, r.mast) : here))));
      const showP = showTrail && r.path.length > 0 && r.state === "drive";
      pathLine.visible = showP; tgt.visible = showTrail && !!r.target && (r.state === "drive" || r.state === "plan");
      if (showP) pathLine.set([P(r.x, r.y, 0.03)].concat(r.path.map(p => P(p.x, p.y, 0.03))));
      if (r.target) { tgt.position.copy(P(r.target.x, r.target.y, 0)); const s = 1 + 0.12 * Math.sin(now / 220); tgtRing.scale.set(s, s, s); }
      trailLine.visible = showTrail && r.trail.length > 1;
      if (trailLine.visible) trailLine.set(r.trail.slice(-320).map(p => P(p[0], p[1], 0.012)));
      let n = 0;
      if (showTrail) for (const s of m.samples) {
        if (s.src !== "robot" || n >= MAXS) continue;
        const sc = Math.max(0.3, 1 - Math.max(0, world.t - s.t) / 720);
        mtx.makeScale(sc, sc, sc); mtx.setPosition(P(s.x, s.y, s.z)); sampMesh.setMatrixAt(n, mtx);
        col.setHex(hexOf(CONC(0.25 + 0.75 * tC(s.c)))); sampMesh.setColorAt(n, col); n++;
      }
      sampMesh.count = n; sampMesh.instanceMatrix.needsUpdate = true; if (sampMesh.instanceColor) sampMesh.instanceColor.needsUpdate = true;
      pur.position.copy(P(cfg.purifier.x, cfg.purifier.y, 0));
      purRingM.emissiveIntensity = cfg.purifierOn ? 2.2 : 0; if (cfg.purifierOn) fan.rotation.y += 0.25 * Math.min(2, cfg.cadr * 3600 / 300);
      paneHinge.rotation.y += ((cfg.windowOpen ? 1.15 : 0) - paneHinge.rotation.y) * 0.08;
      burnerM.emissiveIntensity = cfg.stoveOn ? 1.6 + 0.3 * Math.sin(now / 90) : 0; stoveL.intensity = cfg.stoveOn ? 0.9 : 0;
      flame.visible = cfg.candleOn; candleL.intensity = cfg.candleOn ? 0.55 + 0.12 * Math.sin(now / 70) + 0.08 * Math.sin(now / 37) : 0;
      hazeM.opacity = Math.min(0.75, 0.1 + cfg.cout / 170); winGlow.intensity = 0.4 + cfg.cout / 140;
      const adv = world.advice;
      if (adv && adv.ratio > 1.4) { hotRing.position.copy(P(adv.hotspot.x, adv.hotspot.y, 0.025)); hotRing.material.opacity = 0.5 + 0.3 * Math.sin(now / 300); const s = 1 + 0.08 * Math.sin(now / 300); hotRing.scale.set(s, s, s); }
      else hotRing.material.opacity = 0;
      const ms = world.live.sensors[0];
      if (ms) { const since = world.t - (ms.next - 30); monPulse.material.opacity = Math.max(0, 0.8 - since / 6); const s = 1 + Math.min(4, since / 3); monPulse.scale.set(s, s, s); }
    }
    let monLast;
    function drawMonitor(val) {
      const key = val === null ? null : Math.round(val);
      if (key === monLast) return; monLast = key;
      const g = monCanvas.getContext("2d"); g.fillStyle = "#101418"; g.fillRect(0, 0, 256, 128);
      g.fillStyle = "#7E98BC"; g.font = "600 20px 'JetBrains Mono', monospace"; g.fillText("PM2.5", 16, 32);
      g.fillStyle = "#EDE8DF"; g.font = "600 64px 'JetBrains Mono', monospace"; g.fillText(key === null ? "--" : String(key), 16, 104);
      monTex.needsUpdate = true;
    }
    function updateHud() {
      const air = world.air, cfg = air.cfg, r = world.live.robot, ex = S.exposures(world), mon = world.live.sensors[0];
      const truth = air.plane(1.1); let s = 0, n = 0; for (let q = 0; q < truth.length; q++) if (!world.occ[q]) { s += truth[q]; n++; }
      const last = world.hist[world.hist.length - 1];
      $("simClock").textContent = clock(world.t);
      $("kOut").textContent = fmt(cfg.cout) + " µg/m³"; $("kMean").textContent = fmt(s / n) + " µg/m³";
      const ch = ex[0];
      $("kChild").textContent = ch.c === null ? "–" : `${fmt(ch.c)} (${fmt(ch.lo)}–${fmt(ch.hi)})`; $("kChildT").textContent = fmt(ch.truth) + " µg/m³";
      const b = world.bio.last; $("kBio").textContent = b.n ? `${Math.round(b.index)} / 100` : "first breath at 10 min";
      $("kErr").textContent = last && last.err !== null ? "×" + Math.exp(last.err).toFixed(2) : "–";
      $("kRobot").textContent = `${Math.round(r.pct)} % · ${STATE[r.state] || r.state}`;
      $("kPur").textContent = (cfg.purifierOn ? "on · " + Math.round(cfg.cadr * 3600) + " m³/h" : "off") + (world.purifierMode === "auto" ? " · auto" : "");
      $("profileBars").innerHTML = S.MAST.map((h, i) => { const v = r.profile[i];
        return `<div class="pbar"><span>${h.toFixed(2)} m</span><i style="width:${v === null ? 0 : Math.min(100, tC(v) * 100).toFixed(1)}%;background:#${hexOf(CONC(0.25 + 0.75 * tC(v || 0))).toString(16).padStart(6, "0")}"></i><span>${v === null ? "–" : fmt(v)}</span></div>`; }).join("");
      $("battBar").style.width = r.pct.toFixed(1) + "%"; $("battV").textContent = Math.round(r.pct) + " %";
      drawMonitor(mon ? mon.last : null);
      syncControls();
      const hot = world.advice && world.advice.ratio > 1.4 ? world.advice.hotspot : null;
      LAYOUT.people.forEach((p, i) => {
        const e = ex[i];
        people[i].ringM.color.setHex(hexOf(CONC(0.25 + 0.75 * tC(e.c === null ? e.truth : e.c))));
        placeLabel(lab[p.id], P(p.x, p.y, p.z + 0.35), `${p.id === "child" ? "Child · breathes at 0.45 m" : "Adult · breathes at 1.1 m"}<small>Oddech <b>${fmt(e.c)}</b>${unc === "stated" && e.c !== null ? ` (${fmt(e.lo)}–${fmt(e.hi)})` : ""} · truth ${fmt(e.truth)}</small>`);
      });
      placeLabel(lab.monitor, P(7.6, 2.6, 1.7), `Household monitor<small>reads <b>${mon && mon.last !== null ? fmt(mon.last) : "–"}</b> on the shelf</small>`);
      placeLabel(lab.purifier, P(cfg.purifier.x, cfg.purifier.y, 0.95), `Purifier<small>${cfg.purifierOn ? "on · " + Math.round(cfg.cadr * 3600) + " m³/h" : "off"}</small>`);
      const why = r.state === "drive" && r.target ? "to " + r.target.why : r.state === "sample" ? "measuring at " + S.MAST[Math.min(2, r.hIdx)].toFixed(2) + " m" : STATE[r.state];
      placeLabel(lab.robot, P(r.x, r.y, r.mast + 0.3), `Oddech<small>${why}</small>`);
      placeLabel(lab.outdoor, P((Wn.x0 + Wn.x1) / 2, W + 0.3, Wn.z1 + 0.3), `Outdoor · <b>${fmt(cfg.cout)}</b><small>${cfg.windowOpen ? "window open" : "window shut"}</small>`);
      if (hot) placeLabel(lab.hot, P(hot.x, hot.y, 1.75), `Worst air on the map<small>near ${world.advice.zone.replace(/^the /, "")}</small>`); else lab.hot.style.display = "none";
      if (canvas.clientWidth < 700) for (const k of ["adult", "monitor", "purifier", "hot"]) lab[k].style.display = "none";   // phones: fewer labels
    }

    // ---------------------------------------------------------------- loop
    let visible = false, last = performance.now(), tSlice = 0, tHud = 0, tChart = 0, tCdf = 0;
    function resize() {
      const w = stageEl.clientWidth, h = stageEl.clientHeight; if (!w || !h) return;
      renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix();
      pMat.uniforms.uScale.value = h * renderer.getPixelRatio() / (2 * Math.tan(cam.fov * Math.PI / 360));
      PRESET.orbit.r = 22 * Math.pow(Math.max(1, 1600 / w, 900 / h), 0.6);          // smaller screens: the panels take more room
      if (camMode === "orbit" && !zoomed) goal.r = PRESET.orbit.r;
    }
    let below = false;                                             // the live maps under the stage keep the model running
    const io = new IntersectionObserver(es => { for (const e of es) { if (e.target === stageEl) { visible = e.isIntersecting; if (visible) resize(); } else below = e.isIntersecting; } }, { threshold: 0.12 });
    io.observe(stageEl); if ($("mapTruth")) io.observe($("mapTruth").closest(".results"));
    window.addEventListener("resize", resize);
    function frame(now) {
      requestAnimationFrame(frame);
      const dtR = Math.min(0.1, (now - last) / 1000); last = now;
      if ((!visible && !below) || document.hidden) return;
      let dtS = 0;
      if (running) { dtS = Math.min(dtR * speed, 4); world.advance(dtS); }
      if (!visible) return;
      if (now - tCdf > 500) { buildCdf(world.air.C); tCdf = now; }
      if (showParticles) updateParticles(dtS);
      updateScene(now);
      if (now - tSlice > (layer === "truth" || layer === "harm" ? 120 : 450)) { paintSlice(); tSlice = now; }
      if (now - tHud > 250) { updateHud(); renderAdvice(false); tHud = now; }
      if (now - tChart > 1000) { drawCharts(); tChart = now; }
      if (camMode === "follow") { const r = world.live.robot; goal.t.copy(P(r.x, r.y, 0.5)); goal.r = 3.6; goal.ph = 1.0; goal.th = r.th - Math.PI / 2; }
      let dth = goal.th - orbit.th; while (dth > Math.PI) dth -= 2 * Math.PI; while (dth < -Math.PI) dth += 2 * Math.PI;
      const k = Math.min(1, dtR * 4);
      orbit.th += dth * k; orbit.ph += (goal.ph - orbit.ph) * k; orbit.r += (goal.r - orbit.r) * k; orbit.t.lerp(goal.t, k);
      cam.position.set(orbit.t.x + orbit.r * Math.sin(orbit.ph) * Math.sin(orbit.th), orbit.t.y + orbit.r * Math.cos(orbit.ph), orbit.t.z + orbit.r * Math.sin(orbit.ph) * Math.cos(orbit.th));
      cam.lookAt(orbit.t);
      renderer.render(scene, cam);
    }
    const hint = document.createElement("div"); hint.textContent = "Drag: orbit · Shift-drag: pan · click, then scroll: zoom";
    Object.assign(hint.style, { font: "500 10px/1 'JetBrains Mono', monospace", letterSpacing: ".04em", color: "#77716a", marginTop: "2px" });
    document.querySelector(".sim-legend").appendChild(hint);

    resize(); newWorld(); drawLegend(); requestAnimationFrame(frame);
    window.OddechStage = { get world() { return world; }, goal };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
