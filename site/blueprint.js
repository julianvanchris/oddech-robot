/* Section 04·b: the blueprint. The robot as a technical line drawing on blueprint paper, made from the same part list as
   the Gazebo model (gazebo/blueprint.json): visible edges in white, hidden edges dashed, the nose heights and the overall
   height as dimensions, the frames of the URDF on request. Below it the generator's general-arrangement sheet, drawn in as
   it scrolls into view, and the Gazebo package's contents and the checks it passed. */
(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const T = window.THREE, R = window.ODDECH_ROBOT, OR = window.OddechRobot;
  const cv = $("bpCanvas"); if (!cv || !T || !R || !OR) return;
  const LINE = 0xEAF2FB, FAINT = 0x9FC0E2, HOT = 0xF0A27C, FILL = 0x133D69;     // FILL: one step lighter than the paper, so volumes read
  let calm = false;                                       // the site's one Motion switch (the pitch deck's), on unless turned off
  try { calm = localStorage.getItem("oddech-deck-motion") === "off"; } catch (e) { /* storage blocked: keep motion on */ }

  // the parts list of the drawing; each row lights up its groups in 3D and has a pin at an anchor
  const BOM = [[1, "Sensor head: air inlet, dust counter, CO₂, VOC", ["head"], "head"], [2, "Telescoping mast, 4 × 320 mm stages", ["mast"], "mast"],
    [3, "Living Air Sensor bay, 8-well cartridge", ["bio"], "bio"], [4, "HEPA and carbon filter, exhaust grille", ["vent"], "vent"],
    [5, "Light ring, speaker and microphones", ["ring"], "ring"], [6, "Laser scanner, 360°, 0.20 to 8 m", ["lidar"], "lidar"],
    [7, "On-board computer", ["compute"], "compute"], [8, "Battery 14.4 V, about 100 Wh", ["battery"], "battery"],
    [9, "Hub motors, wheels Ø90, ball casters front and rear", ["drive"], "drive"], [10, "Body, chassis, bumper; filter sampler", ["body", "chassis", "sampler"], "sampler"]];

  // ---------------------------------------------------------------- scene
  const renderer = new T.WebGLRenderer({ canvas: cv, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputEncoding = T.sRGBEncoding; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  const scene = new T.Scene(), cam = new T.PerspectiveCamera(26, 1, 0.05, 40);
  scene.add(new T.HemisphereLight(0xeaf2fb, 0x0d2c4d, 0.95));
  const key = new T.DirectionalLight(0xffffff, 1.5); key.position.set(2.5, 4, 3); scene.add(key);
  const rob = OR.buildRobot({ shadows: false }); scene.add(rob.group);

  // line drawing: visible edges, hidden edges dashed (drawn only where something is in front), a paper fill that hides
  const C = h => new T.Color(h).convertSRGBToLinear();     // hex colours are sRGB; the renderer works in linear light
  const lineMat = new T.LineBasicMaterial({ color: C(LINE), transparent: true, opacity: 0.92, toneMapped: false });
  const hotMat = new T.LineBasicMaterial({ color: C(HOT), toneMapped: false });
  const hidMat = new T.LineDashedMaterial({ color: C(FAINT), dashSize: 0.008, gapSize: 0.007, transparent: true, opacity: 0.32, depthFunc: T.GreaterDepth, depthWrite: false, toneMapped: false });
  const fillMat = new T.MeshBasicMaterial({ color: C(FILL), toneMapped: false, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
  const xrayMat = new T.MeshBasicMaterial({ color: C(0x7fb2e0), transparent: true, opacity: 0.08, depthWrite: false, side: T.DoubleSide, toneMapped: false });
  const items = [];
  rob.group.traverse(o => {
    if (!o.isMesh) return;
    const eg = new T.EdgesGeometry(o.geometry, 24), vis = new T.LineSegments(eg, lineMat), hid = new T.LineSegments(eg, hidMat);
    hid.computeLineDistances(); o.add(vis, hid);
    items.push({ o, solid: o.material, vis, hid, group: o.userData.part, internal: o.userData.spec.internal });
  });

  // dimensions: the three nose heights as dashed rings, the overall height as a dimension line
  const dims = new T.Group(); scene.add(dims);
  const dashed = (pts, color, op) => { const l = new T.Line(new T.BufferGeometry().setFromPoints(pts), new T.LineDashedMaterial({ color: C(color), dashSize: 0.02, gapSize: 0.016, transparent: true, opacity: op, toneMapped: false })); l.computeLineDistances(); return l; };
  const HEIGHTS = [[0.4, "0.40 · child on the floor"], [1.1, "1.10 · seated adult"], [1.6, "1.60 · standing adult"]];
  for (const [h] of HEIGHTS) { const pts = []; for (let k = 0; k <= 72; k++) pts.push(new T.Vector3(0.24 * Math.cos(k / 36 * Math.PI), h, 0.24 * Math.sin(k / 36 * Math.PI))); dims.add(dashed(pts, HOT, 0.75)); }
  const hLine = new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(), new T.Vector3()]), new T.LineBasicMaterial({ color: C(FAINT), transparent: true, opacity: 0.8, toneMapped: false }));
  const hTicks = new T.LineSegments(new T.BufferGeometry().setFromPoints([new T.Vector3(), new T.Vector3(), new T.Vector3(), new T.Vector3()]), new T.LineBasicMaterial({ color: C(FAINT), toneMapped: false }));
  dims.add(hLine, hTicks);
  const ground = []; for (let k = 0; k <= 96; k++) ground.push(new T.Vector3(0.173 * Math.cos(k / 48 * Math.PI), 0.001, 0.173 * Math.sin(k / 48 * Math.PI)));
  dims.add(dashed(ground, FAINT, 0.5));

  // frames of the URDF (ROS colours: x red forward, y green left, z blue up), shown on request
  const frames = { visible: false, axes: [] };
  function rosAxes(s) {
    const g = new T.BufferGeometry().setFromPoints([new T.Vector3(), new T.Vector3(s, 0, 0), new T.Vector3(), new T.Vector3(0, 0, -s), new T.Vector3(), new T.Vector3(0, s, 0)]);
    g.setAttribute("color", new T.Float32BufferAttribute([1, .35, .3, 1, .35, .3, .4, .9, .5, .4, .9, .5, .45, .65, 1, .45, .65, 1], 3));
    return new T.LineSegments(g, new T.LineBasicMaterial({ vertexColors: true, depthTest: false, transparent: true, opacity: 0.95 }));
  }
  const FRAME_LABELS = [];
  for (const j of R.joints) {
    const holder = rob.links[j.child], ax = rosAxes(j.child.startsWith("mast") ? 0.05 : 0.09);
    if (holder) holder.add(ax);
    else { ax.position.copy(OR.P3(OR.linkOrigin(j.child, 0))); rob.group.add(ax); }
    ax.visible = false; ax.renderOrder = 5; frames.axes.push(ax);
    if (["head_link", "lidar_link", "cartridge_link", "wheel_left_link", "base_link"].indexOf(j.child) >= 0) FRAME_LABELS.push([j.child, ax]);
  }

  // ---------------------------------------------------------------- labels: part pins, nose heights, height, frames
  const lab = $("bpLabels");
  const mk = (cls, text) => { const d = document.createElement("div"); d.className = cls; d.textContent = text; lab.appendChild(d); return d; };
  const pins = BOM.map(b => mk("bp-pin", b[0]));
  const hLabs = HEIGHTS.map(h => mk("bp-dim", h[1])), hMain = mk("bp-dim main", ""), fLabs = FRAME_LABELS.map(f => mk("bp-frame", f[0]));
  const v = new T.Vector3();
  function put(el, p) {
    v.copy(p).project(cam);
    el.style.left = ((v.x + 1) / 2 * cv.clientWidth) + "px"; el.style.top = ((1 - v.y) / 2 * cv.clientHeight) + "px"; el.style.opacity = v.z < 1 ? "" : 0;
  }

  // ---------------------------------------------------------------- side panel and package panel
  const dd = R.dims, mm = m => Math.round(m * 1000).toLocaleString("en-GB");
  $("bpDims").innerHTML = [["Body", `Ø ${mm(dd.diameter)} mm`], ["Height", `${mm(dd.height_stowed)} to ${mm(dd.height_max)} mm`], ["Nose", "0.40 · 1.10 · 1.60 m"],
    ["Mast", `${dd.stages} × ${mm(dd.stage)} mm stages`], ["Wheels", `Ø ${mm(dd.wheel_d)} · track ${mm(dd.track)}`], ["Speed", `${dd.v_max.toFixed(2)} m/s · ${dd.w_max} rad/s`],
    ["Scanner", `${dd.lidar.samples} beams · ${dd.lidar.rmin}–${dd.lidar.rmax} m`], ["Mass", `about ${dd.mass.toFixed(1)} kg`]].map(([k, val]) => `<dt>${k}</dt><dd>${val}</dd>`).join("");
  $("bpParts").innerHTML = BOM.map(b => `<li data-i="${b[0] - 1}"><i>${b[0]}</i><span>${b[1]}</span></li>`).join("");
  const rows = Array.from($("bpParts").querySelectorAll("li"));
  rows.forEach((li, i) => { li.addEventListener("pointerenter", () => setHot(i)); li.addEventListener("pointerleave", () => setHot(-1)); });
  pins.forEach((p, i) => { p.addEventListener("pointerenter", () => setHot(i)); p.addEventListener("pointerleave", () => setHot(-1)); });
  const files = R.files || [], size = b => b < 1024 ? b + " B" : b < 1048576 ? Math.round(b / 1024) + " KB" : (b / 1048576).toFixed(1) + " MB";
  const tree = {};
  for (const f of files) { const p = f.path.split("/"); const top = p.length > 2 ? p.slice(0, 2).join("/") : p.length > 1 ? p[0] : "."; (tree[top] = tree[top] || []).push(f); }
  $("bpTree").innerHTML = `<b>oddech/</b><span class="s">${files.length} files · ${size(files.reduce((s, f) => s + f.bytes, 0))}</span>\n` +
    Object.keys(tree).sort().map(k => {
      const fs = tree[k], total = fs.reduce((s, f) => s + f.bytes, 0);
      if (k === ".") return fs.map(f => `  ${f.path}<span class="s">${size(f.bytes)}</span>`).join("\n");
      const names = fs.length > 5 ? fs.slice(0, 3).map(f => f.path.split("/").pop()).join(", ") + `, and ${fs.length - 3} more` : fs.map(f => f.path.split("/").pop()).join(", ");
      return `  <span class="d">${k}/</span><span class="s">${fs.length} · ${size(total)}</span>\n      ${names}`;
    }).join("\n");

  // ---------------------------------------------------------------- controls
  let mode = "lines", hot = -1, mastGoal = 0.4, mastNow = 0.4, exploded = false, explodeGoal = 0, explodeNow = 0;
  function setHot(i) {
    hot = i;
    const gs = i >= 0 ? BOM[i][2] : [];
    for (const it of items) { const on = gs.indexOf(it.group) >= 0; it.vis.material = on ? hotMat : lineMat; it.vis.visible = mode !== "solid" || on; }
    rows.forEach((li, k) => li.classList.toggle("on", k === i)); pins.forEach((p, k) => p.classList.toggle("on", k === i));
    if (i >= 0 && ["battery", "compute", "bio", "vent"].indexOf(BOM[i][3]) >= 0) explodeGoal = Math.max(explodeGoal, 0.6);
    else if (!exploded) explodeGoal = 0;
  }
  function setMode(m) {
    mode = m;
    for (const it of items) { it.o.material = m === "solid" ? it.solid : m === "xray" ? xrayMat : fillMat; it.hid.visible = m === "lines"; }
    setHot(hot);
    $("bpMode").querySelectorAll("[data-mode]").forEach(b => b.classList.toggle("on", b.dataset.mode === m));
  }
  $("bpMode").addEventListener("click", e => { const b = e.target.closest("[data-mode]"); if (b) setMode(b.dataset.mode); });
  $("bpMast").addEventListener("click", e => { const b = e.target.closest("[data-h]"); if (!b) return; mastGoal = +b.dataset.h; $("bpMast").querySelectorAll("[data-h]").forEach(x => x.classList.toggle("on", x === b)); });
  $("bpExplode").addEventListener("click", () => { exploded = !exploded; explodeGoal = exploded ? 1 : 0; $("bpExplode").classList.toggle("on", exploded); });
  $("bpFrames").addEventListener("click", () => { frames.visible = !frames.visible; frames.axes.forEach(a => { a.visible = frames.visible; }); pins.forEach(p => { p.style.display = frames.visible ? "none" : ""; }); $("bpFrames").classList.toggle("on", frames.visible); });
  setMode("lines");

  // ---------------------------------------------------------------- orbit, render only while visible
  let theta = 0.85, phi = 1.18, auto = !calm, drag = null, resume = 0, visible = false, last = performance.now();
  cv.addEventListener("pointerdown", e => { drag = { x: e.clientX, y: e.clientY, t: theta, p: phi }; auto = false; clearTimeout(resume); cv.setPointerCapture(e.pointerId); });
  cv.addEventListener("pointermove", e => { if (!drag) return; theta = drag.t - (e.clientX - drag.x) * 0.008; phi = Math.min(1.52, Math.max(0.3, drag.p - (e.clientY - drag.y) * 0.006)); });
  const release = () => { drag = null; clearTimeout(resume); resume = setTimeout(() => { auto = !calm; }, 5000); };
  cv.addEventListener("pointerup", release); cv.addEventListener("pointercancel", release);
  function resize() { const w = cv.clientWidth, h = cv.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }
  window.addEventListener("resize", resize);
  new IntersectionObserver(es => { visible = es[0].isIntersecting; if (visible) resize(); }, { threshold: 0.02 }).observe(cv);
  const target = new T.Vector3();
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!visible) return;
    if (auto) theta += dt * 0.16;
    mastNow += (mastGoal - mastNow) * Math.min(1, dt * 3); explodeNow += (explodeGoal - explodeNow) * Math.min(1, dt * 4);
    rob.setMast(mastNow); rob.setExplode(explodeNow);
    for (const it of items) it.o.visible = mode === "solid" ? true : !it.internal || explodeNow > 0.05 || mode === "xray";
    const top = mastNow + 0.043 + explodeNow * 0.7;
    target.set(0, 0.03 + 0.47 * top, 0);                                        // frame the whole robot at any mast height
    const r = (0.75 + 2.2 * top + explodeNow * 0.4) * Math.max(1, 1.1 / cam.aspect);   // narrow screens: fit the width
    cam.position.set(target.x + r * Math.sin(phi) * Math.sin(theta), target.y + r * Math.cos(phi), target.z + r * Math.sin(phi) * Math.cos(theta)); cam.lookAt(target);
    const sx = -Math.cos(theta) * 0.34, sz = Math.sin(theta) * 0.34;             // the height dimension stays to the viewer's left
    const real = mastNow + 0.043, dimOn = explodeNow < 0.05;                      // an exploded view carries no dimension
    hLine.visible = hTicks.visible = dimOn; hMain.style.display = dimOn ? "" : "none";
    hLine.geometry.setFromPoints([new T.Vector3(sx, 0, sz), new T.Vector3(sx, real, sz)]);
    hTicks.geometry.setFromPoints([new T.Vector3(sx - 0.03, 0, sz), new T.Vector3(sx + 0.03, 0, sz), new T.Vector3(sx - 0.03, real, sz), new T.Vector3(sx + 0.03, real, sz)]);
    renderer.render(scene, cam);
    BOM.forEach((b, i) => put(pins[i], rob.anchor(b[3])));
    HEIGHTS.forEach(([h], i) => put(hLabs[i], new T.Vector3(0.26 * Math.sin(theta + 1.2), h, 0.26 * Math.cos(theta + 1.2))));
    hMain.textContent = `${Math.round(real * 1000)} mm`; put(hMain, new T.Vector3(sx, real / 2, sz));
    FRAME_LABELS.forEach(([n, ax], i) => { fLabs[i].style.display = frames.visible ? "" : "none"; if (frames.visible) put(fLabs[i], ax.getWorldPosition(new T.Vector3())); });
  }
  requestAnimationFrame(frame);

  // ---------------------------------------------------------------- the drawing sheet: lines drawn in as it scrolls into view
  const sheet = document.querySelector(".bp-sheet");
  if (sheet && !calm) {
    Array.from(sheet.querySelectorAll("svg path")).forEach((p, i) => {
      if (/stroke-dasharray/.test(p.getAttribute("style") || "")) p.classList.add("fd"); else { p.setAttribute("pathLength", "1"); p.classList.add("ln"); }
      p.style.animationDelay = Math.min(1600, i * 5) + "ms";
    });
    new IntersectionObserver((es, ob) => { if (es[0].isIntersecting) { sheet.classList.add("draw"); ob.disconnect(); } }, { threshold: 0.25 }).observe(sheet);
  }
})();
