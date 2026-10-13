/* Oddech robot: a Three.js model shared by the robot viewer (section 04) and the simulation (section 06),
   and the viewer itself. Units are metres; the origin is on the floor under the robot's centre; local +X is forward.
   Geometry follows the design targets on the page: body diameter 0.34 m, stowed height 0.42 m, sensor inlet 0.40 to 1.60 m
   on a four-stage telescoping mast (stages 0.32 m long, so they stow inside the chassis and upper body). */
(function () {
  "use strict";
  const T = window.THREE;
  const COL = { shell: 0xF1ECE3, shell2: 0xE4DED3, dark: 0x26231F, mid: 0x5E5850, metal: 0xB7B0A4, accent: 0xB4532A, indigo: 0x2E4A6E, board: 0x2F4236, cell: 0x8C8378 };
  const DECK = 0.352, STAGE = 0.32;

  function M(color, o) { return new T.MeshStandardMaterial(Object.assign({ color, roughness: 0.5, metalness: 0.04 }, o || {})); }

  function buildRobot(opts) {
    opts = Object.assign({ sampler: true, shadows: true }, opts || {});
    const g = new T.Group(), parts = {};
    const add = (name, mesh, dy) => {
      mesh.userData = { part: name, base: mesh.position.clone(), dy: dy || 0 };
      if (opts.shadows) { mesh.castShadow = true; mesh.receiveShadow = true; }
      g.add(mesh); (parts[name] = parts[name] || []).push(mesh);
      return mesh;
    };
    const dark = M(COL.dark, { roughness: 0.6 }), metal = M(COL.metal, { metalness: 0.6, roughness: 0.32 });

    // drive: two hub wheels and a front caster
    const wheelG = new T.CylinderGeometry(0.045, 0.045, 0.028, 28);
    for (const s of [-1, 1]) { const w = new T.Mesh(wheelG, dark); w.rotation.x = Math.PI / 2; w.position.set(-0.02, 0.045, s * 0.152); add("drive", w, 0); }
    const caster = new T.Mesh(new T.SphereGeometry(0.018, 16, 12), metal); caster.position.set(0.12, 0.018, 0); add("drive", caster, 0);
    // chassis and bumper
    const chassisM = M(COL.shell2, { roughness: 0.45 });
    const chassis = new T.Mesh(new T.CylinderGeometry(0.17, 0.168, 0.10, 64), chassisM); chassis.position.y = 0.08; add("chassis", chassis, 0.06);
    const bumper = new T.Mesh(new T.CylinderGeometry(0.173, 0.173, 0.05, 64, 1, true, -Math.PI / 2.2, Math.PI / 1.1), M(COL.mid, { side: T.DoubleSide })); bumper.position.y = 0.07; add("chassis", bumper, 0.06);
    // laser scanner band
    const lidar = new T.Mesh(new T.CylinderGeometry(0.166, 0.166, 0.03, 64), M(0x121110, { roughness: 0.15, metalness: 0.3, emissive: 0x1a1210 })); lidar.position.y = 0.145; add("lidar", lidar, 0.14);
    // internals, seen in the exploded view
    const battery = new T.Mesh(new T.BoxGeometry(0.16, 0.05, 0.11), M(COL.cell, { roughness: 0.7 })); battery.position.set(-0.03, 0.07, 0); add("battery", battery, 0.34);
    const board = new T.Mesh(new T.BoxGeometry(0.10, 0.012, 0.08), M(COL.board, { roughness: 0.5 })); board.position.set(0.02, 0.22, 0); add("compute", board, 0.5);
    const chip = new T.Mesh(new T.BoxGeometry(0.03, 0.008, 0.03), dark); chip.position.set(0.02, 0.23, 0); add("compute", chip, 0.5);
    // upper body, deck, light ring, speaker grille
    const bodyM = M(COL.shell, { roughness: 0.38 }), deckM = M(COL.shell2, { roughness: 0.45 });
    const body = new T.Mesh(new T.CylinderGeometry(0.15, 0.164, 0.19, 64), bodyM); body.position.y = 0.256; add("body", body, 0.66);
    const deck = new T.Mesh(new T.CylinderGeometry(0.148, 0.15, 0.012, 64), deckM); deck.position.y = DECK - 0.003; add("body", deck, 0.66);
    const ringM = new T.MeshStandardMaterial({ color: COL.indigo, emissive: COL.indigo, emissiveIntensity: 1.2, roughness: 0.3 });
    const ring = new T.Mesh(new T.TorusGeometry(0.151, 0.0065, 10, 96), ringM); ring.rotation.x = Math.PI / 2; ring.position.y = DECK - 0.012; add("ring", ring, 0.66);
    const grille = new T.Mesh(new T.CylinderGeometry(0.1505, 0.1505, 0.07, 32, 1, true, -0.55, 1.1), M(COL.mid, { side: T.DoubleSide, roughness: 0.8 }));
    grille.rotation.y = Math.PI / 2; grille.position.y = 0.25; add("ring", grille, 0.66);
    // mast: four nested stages
    const stages = [];
    [0.024, 0.0195, 0.015, 0.0105].forEach((r, k) => {
      const s = new T.Mesh(new T.CylinderGeometry(r, r, STAGE, 24), k % 2 ? metal : M(0xD9D3C8, { metalness: 0.3, roughness: 0.3 }));
      add("mast", s, 0.7); stages.push(s);
    });
    // sensor head: slotted inlet at the top, cap, status LED
    const head = new T.Group(), headM = M(COL.shell, { roughness: 0.38 });
    const hb = new T.Mesh(new T.CylinderGeometry(0.05, 0.046, 0.06, 40), headM); hb.position.y = -0.008; head.add(hb);
    const slots = new T.Mesh(new T.CylinderGeometry(0.0505, 0.0505, 0.014, 40), dark); slots.position.y = 0.026; head.add(slots);
    const cap = new T.Mesh(new T.CylinderGeometry(0.044, 0.05, 0.01, 40), M(COL.shell2)); cap.position.y = 0.038; head.add(cap);
    const led = new T.Mesh(new T.SphereGeometry(0.006, 10, 8), new T.MeshBasicMaterial({ color: COL.accent })); led.position.set(0.049, -0.01, 0); head.add(led);
    if (opts.shadows) head.traverse(m => { if (m.isMesh) m.castShadow = true; });
    g.add(head); parts.head = [head];
    // optional filter sampler on the back
    if (opts.sampler) {
      const smp = new T.Mesh(new T.CylinderGeometry(0.024, 0.024, 0.05, 28), M(COL.mid)); smp.rotation.z = Math.PI / 2; smp.position.set(-0.175, 0.25, 0); add("sampler", smp, 0.66);
      const face = new T.Mesh(new T.CylinderGeometry(0.019, 0.019, 0.004, 28), M(COL.accent, { roughness: 0.6 })); face.rotation.z = Math.PI / 2; face.position.set(-0.201, 0.25, 0); add("sampler", face, 0.66);
    }
    // charging contacts
    for (const s of [-1, 1]) { const c = new T.Mesh(new T.BoxGeometry(0.004, 0.012, 0.03), metal); c.position.set(-0.171, 0.06, s * 0.04); add("chassis", c, 0.06); }
    // Living Air Sensor bay: a dark window on the front of the body, and the 8-well cartridge inside (lifts out when exploded)
    const bay = new T.Mesh(new T.BoxGeometry(0.03, 0.07, 0.12), M(0x0d0c0b, { roughness: 0.2, metalness: 0.2 })); bay.position.set(0.148, 0.27, 0); add("bio", bay, 0.66);
    const slide = new T.Mesh(new T.BoxGeometry(0.075, 0.006, 0.11), new T.MeshStandardMaterial({ color: 0xdfe6ec, transparent: true, opacity: 0.55, roughness: 0.1 }));
    slide.position.set(0.07, 0.29, 0); add("bio", slide, 0.98);
    const wellM = new T.MeshStandardMaterial({ color: 0xe9a0b4, emissive: 0xff8a5c, emissiveIntensity: 0.7, roughness: 0.5 });
    for (let k = 0; k < 8; k++) { const w = new T.Mesh(new T.BoxGeometry(0.022, 0.008, 0.022), wellM); w.position.set(0.07 + (k < 4 ? 0.017 : -0.017), 0.295, -0.039 + (k % 4) * 0.026); add("bio", w, 0.98); }
    // lungs: HEPA and carbon filter at the back of the chassis, behind an exhaust grille
    const filt = new T.Mesh(new T.CylinderGeometry(0.04, 0.04, 0.03, 32), M(0xEDE8DF, { roughness: 0.95 })); filt.rotation.z = Math.PI / 2; filt.position.set(-0.135, 0.08, 0); add("vent", filt, 0.06);
    const vent = new T.Mesh(new T.CylinderGeometry(0.1715, 0.1715, 0.05, 32, 1, true, 1.5 * Math.PI - 0.82, 1.64), M(0x3a3631, { side: T.DoubleSide, roughness: 0.9 }));
    vent.position.y = 0.1; add("vent", vent, 0.06);

    let mastH = 0.4, explode = 0;
    function place() {
      const e = Math.max(0, mastH - 0.4), up = explode * 0.7;
      for (const name in parts) {
        if (name === "mast" || name === "head") continue;
        for (const m of parts[name]) m.position.y = m.userData.base.y + explode * m.userData.dy;
      }
      stages.forEach((s, k) => { s.position.y = up + DECK + e * (k + 1) / 4 - STAGE / 2 + 0.003 * k; });
      head.position.y = up + mastH;
      const ex = explode > 0.01;
      bodyM.transparent = deckM.transparent = chassisM.transparent = ex;
      bodyM.opacity = deckM.opacity = 1 - 0.78 * explode; chassisM.opacity = 1 - 0.6 * explode;
      bodyM.depthWrite = deckM.depthWrite = explode < 0.5;
    }
    place();
    return {
      group: g, parts, head,
      setMast(h) { mastH = Math.min(1.6, Math.max(0.4, h)); place(); },
      setExplode(t) { explode = t; place(); },
      setRing(hex) { ringM.color.setHex(hex); ringM.emissive.setHex(hex); },
      anchor(name) {                                       // a local point to pin a label on
        const up = explode * 0.7;
        const A = { head: [0.0, mastH + 0.06 + up, 0], mast: [0.0, (DECK + mastH) / 2 + up, 0.03], ring: [0.13, DECK - 0.01 + explode * 0.66, 0.08],
          lidar: [0.16, 0.145 + explode * 0.14, 0.05], compute: [0.02, 0.23 + explode * 0.5, 0.05], battery: [-0.03, 0.07 + explode * 0.34, 0.06],
          drive: [-0.02, 0.045, 0.17], sampler: [-0.2, 0.25 + explode * 0.66, 0],
          bio: [0.165, 0.27 + explode * 0.66, 0.04], vent: [-0.172, 0.1 + explode * 0.06, 0.06] }[name];
        return A ? new T.Vector3(A[0], A[1], A[2]) : null;
      },
    };
  }

  // ---------------------------------------------------------------- the viewer in section 04
  function viewer(canvas, labelsEl) {
    const renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputEncoding = T.sRGBEncoding; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
    const scene = new T.Scene();
    const cam = new T.PerspectiveCamera(30, 1, 0.05, 30);
    scene.add(new T.HemisphereLight(0xfff6ea, 0xd9d2c6, 0.85));
    const key = new T.DirectionalLight(0xffffff, 1.6); key.position.set(2.5, 4, 2.2); key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024); Object.assign(key.shadow.camera, { left: -1, right: 1, top: 2, bottom: -0.2, near: 0.5, far: 10 }); key.shadow.bias = -0.0005; scene.add(key);
    const rim = new T.DirectionalLight(0xffe2cc, 0.6); rim.position.set(-3, 2, -2.5); scene.add(rim);
    const floor = new T.Mesh(new T.CircleGeometry(1.6, 64), new T.ShadowMaterial({ opacity: 0.16 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
    const rob = buildRobot(); scene.add(rob.group);
    // the three sampling heights as dashed rings round the mast axis
    const ticks = [[0.4, "0.40 m · child on the floor"], [1.1, "1.10 m · seated adult"], [1.6, "1.60 m · standing adult"]];
    for (const [h] of ticks) {
      const pts = []; for (let k = 0; k <= 64; k++) pts.push(new T.Vector3(0.2 * Math.cos(k / 32 * Math.PI), h, 0.2 * Math.sin(k / 32 * Math.PI)));
      const ring = new T.Line(new T.BufferGeometry().setFromPoints(pts), new T.LineDashedMaterial({ color: 0xB4532A, dashSize: 0.025, gapSize: 0.02, transparent: true, opacity: 0.75 }));
      ring.computeLineDistances(); scene.add(ring);
    }
    // scale figure: a standing adult, 1.70 m
    const ghost = new T.MeshStandardMaterial({ color: 0xC9C2B6, transparent: true, opacity: 0.22, roughness: 1, depthWrite: false });
    const fig = new T.Group();
    const torso = new T.Mesh(new T.CapsuleGeometry(0.16, 0.5, 6, 16), ghost); torso.position.y = 1.18; fig.add(torso);
    const headG = new T.Mesh(new T.SphereGeometry(0.105, 20, 16), ghost); headG.position.y = 1.6; fig.add(headG);
    for (const s of [-1, 1]) { const leg = new T.Mesh(new T.CapsuleGeometry(0.065, 0.72, 4, 10), ghost); leg.position.set(0, 0.45, s * 0.09); fig.add(leg); }
    fig.position.set(-0.2, 0, 0.72); scene.add(fig);

    const names = ["head", "mast", "bio", "vent", "ring", "lidar", "compute", "battery"];   // the order of the spec rows on the page
    const pins = names.map((n, i) => { const d = document.createElement("div"); d.className = "rlab"; d.textContent = i + 1; labelsEl.appendChild(d); return d; });
    const rulerLabels = ticks.map(([, t]) => { const d = document.createElement("div"); d.className = "rlab-h"; d.innerHTML = t + "<i></i>"; labelsEl.appendChild(d); return d; });

    let theta = 0.9, phi = 1.2, auto = true, drag = null, explodeT = 0, explodeGoal = 0, mastGoal = 0.4, mastNow = 0.4, active = null, visible = true, resume = 0;
    const radius = 3.35, target = new T.Vector3(0, 0.86, 0.12);
    canvas.addEventListener("pointerdown", e => { drag = { x: e.clientX, y: e.clientY, t: theta, p: phi }; auto = false; clearTimeout(resume); canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener("pointermove", e => { if (!drag) return; theta = drag.t - (e.clientX - drag.x) * 0.008; phi = Math.min(1.5, Math.max(0.35, drag.p - (e.clientY - drag.y) * 0.006)); });
    const up = () => { drag = null; clearTimeout(resume); resume = setTimeout(() => { auto = true; }, 4000); };
    canvas.addEventListener("pointerup", up); canvas.addEventListener("pointercancel", up);
    function resize() {
      const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
      renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix();
    }
    window.addEventListener("resize", resize); resize();
    new IntersectionObserver(es => { visible = es[0].isIntersecting; if (visible) resize(); }).observe(canvas);
    const v = new T.Vector3();
    function project(p, el) {
      v.copy(p).project(cam);
      el.style.left = ((v.x + 1) / 2 * canvas.clientWidth) + "px"; el.style.top = ((1 - v.y) / 2 * canvas.clientHeight) + "px"; el.style.opacity = v.z < 1 ? 1 : 0;
    }
    let last = performance.now();
    function frame(now) {
      requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (!visible) return;
      if (auto) theta += dt * 0.18;
      explodeT += (explodeGoal - explodeT) * Math.min(1, dt * 4); mastNow += (mastGoal - mastNow) * Math.min(1, dt * 3.5);
      rob.setExplode(explodeT); rob.setMast(mastNow);
      const r = radius + explodeT * 0.6;
      cam.position.set(target.x + r * Math.sin(phi) * Math.sin(theta), target.y + r * Math.cos(phi), target.z + r * Math.sin(phi) * Math.cos(theta));
      cam.lookAt(target);
      renderer.render(scene, cam);
      names.forEach((n, i) => { project(rob.anchor(n), pins[i]); pins[i].classList.toggle("on", n === active); });
      ticks.forEach(([h], i) => { v.set(0, h, 0).project(cam); rulerLabels[i].style.top = ((1 - v.y) / 2 * canvas.clientHeight) + "px"; });
    }
    requestAnimationFrame(frame);
    return { setMast(h) { mastGoal = h; }, setExplode(on) { explodeGoal = on ? 1 : 0; }, highlight(n) { active = n; }, setRing(hex) { rob.setRing(hex); } };
  }

  window.OddechRobot = { buildRobot, viewer, COL };
})();
