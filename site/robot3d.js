/* Oddech robot: a Three.js model shared by the robot viewer (section 04), the simulation (section 06), the blueprint and
   the Gazebo twin (section 04·b), and the viewer itself. It is drawn from the same part list as the Gazebo model:
   gazebo/blueprint.json (window.ODDECH_ROBOT), written by gazebo/tools/build_model.py. That list uses ROS frames
   (x forward, y left, z up); three.js here is y up, so a ROS point (x, y, z) is drawn at (x, z, -y). Units are metres;
   the origin is on the floor under the robot's centre; local +X is forward. */
(function () {
  "use strict";
  const T = window.THREE, R = window.ODDECH_ROBOT;
  const COL = {}; for (const k in R.colors) COL[k] = parseInt(R.colors[k], 16);
  const STOWED = 0.4;                                     // nose height with the mast down
  const P3 = v => new T.Vector3(v[0], v[2], -v[1]);       // ROS point -> three.js

  function linkOrigin(name, q) {                          // a link's origin (ROS) at mast extension q per stage
    if (name === "base_footprint") return [0, 0, 0];
    const j = R.joints.find(x => x.child === name), o = linkOrigin(j.parent, q);
    return [o[0] + j.xyz[0], o[1] + j.xyz[1], o[2] + j.xyz[2] + (j.type === "prismatic" ? q : 0)];
  }
  function partGeometry(p) {
    const d = p.dims; let g;
    if (p.shape === "cyl") {
      const arc = d.arc;                                  // ROS azimuth from +x towards +y = three.js theta - pi/2
      g = arc ? new T.CylinderGeometry(d.r2, d.r1, d.h, Math.max(8, Math.round(d.seg * arc[1] / (2 * Math.PI))), 1, true, arc[0] + Math.PI / 2, arc[1])
        : new T.CylinderGeometry(d.r2, d.r1, d.h, d.seg);
      if (p.axis === "x") g.rotateZ(-Math.PI / 2); else if (p.axis === "y") g.rotateX(-Math.PI / 2);
    } else if (p.shape === "box") g = new T.BoxGeometry(d.sx, d.sz, d.sy);
    else if (p.shape === "sphere") g = new T.SphereGeometry(d.r, d.seg, Math.max(6, d.seg >> 1));
    else { g = new T.TorusGeometry(d.R, d.r, d.tube, d.seg); g.rotateX(Math.PI / 2); }
    return g;
  }
  const MAT = {};
  function partMaterial(p) {
    const key = p.col + (p.glow ? "*" : "") + (p.dims.arc ? "~" : "");
    if (MAT[key]) return MAT[key];
    const c = COL[p.col], o = { color: c, roughness: 0.45, metalness: 0.04 };
    if (p.col === "metal") Object.assign(o, { metalness: 0.6, roughness: 0.32 });
    if (p.col === "stage") Object.assign(o, { metalness: 0.3, roughness: 0.3 });
    if (p.col === "lidar") Object.assign(o, { roughness: 0.15, metalness: 0.3, emissive: 0x1a1210 });
    if (p.col === "bay") Object.assign(o, { roughness: 0.2, metalness: 0.2 });
    if (p.col === "glass") Object.assign(o, { transparent: true, opacity: 0.55, roughness: 0.1 });
    if (p.col === "dark" || p.col === "mid" || p.col === "vent") o.roughness = 0.7;
    if (p.col === "filter") o.roughness = 0.95;
    if (p.glow) Object.assign(o, { emissive: p.col === "well" ? 0xff8a5c : c, emissiveIntensity: p.col === "indigo" ? 1.2 : 0.7 });
    if (p.dims.arc) o.side = T.DoubleSide;
    return (MAT[key] = new T.MeshStandardMaterial(o));
  }

  function buildRobot(opts) {
    opts = Object.assign({ sampler: true, shadows: true }, opts || {});
    const g = new T.Group(), parts = {}, links = {}, shells = [];
    const linkGroup = name => {
      if (name === "base_link") return g;
      if (!links[name]) { links[name] = new T.Group(); links[name].position.copy(P3(linkOrigin(name, 0))); g.add(links[name]); }
      return links[name];
    };
    for (const p of R.parts) {
      if (!opts.sampler && p.group === "sampler") continue;
      let m = partMaterial(p);
      if (["body", "deck", "chassis"].indexOf(p.name) >= 0) { m = m.clone(); shells.push({ m, k: p.name === "chassis" ? 0.6 : 0.78 }); }
      const mesh = new T.Mesh(partGeometry(p), m);         // shells fade in the exploded view, so they get their own material
      mesh.position.copy(P3(p.xyz));
      mesh.userData = { part: p.group, base: mesh.position.clone(), dy: p.dy || 0, spec: p };
      if (opts.shadows) { mesh.castShadow = true; mesh.receiveShadow = !p.glow; }
      linkGroup(p.link).add(mesh);
      (parts[p.group] = parts[p.group] || []).push(mesh);
    }
    const ring = parts.ring.find(m => m.userData.spec.name === "light_ring").material, head = links.head_link;
    let mastH = STOWED, explode = 0;
    function place() {
      const q = Math.max(0, mastH - STOWED) / 4, up = explode * 0.7;
      for (const name in parts) {
        if (name === "mast" || name === "head") continue;
        for (const m of parts[name]) m.position.y = m.userData.base.y + explode * m.userData.dy;
      }
      for (const k of ["mast_stage_1", "mast_stage_2", "mast_stage_3", "mast_stage_4", "head_link"]) { links[k].position.copy(P3(linkOrigin(k, q))); links[k].position.y += up; }
      for (const s of shells) { s.m.transparent = explode > 0.01; s.m.opacity = 1 - s.k * explode; s.m.depthWrite = s.k < 0.7 || explode < 0.5; }
    }
    place();
    return {
      group: g, parts, head, links,
      setMast(h) { mastH = Math.min(1.6, Math.max(STOWED, h)); place(); },
      setExplode(t) { explode = t; place(); },
      setRing(hex) { ring.color.setHex(hex); ring.emissive.setHex(hex); },
      setWheels(l, r) { links.wheel_left_link.rotation.z = -l; links.wheel_right_link.rotation.z = -r; },   // ROS +y axle = three.js -z
      anchor(name) {                                       // a local point to pin a label on
        const up = explode * 0.7;
        const A = { head: [0.0, mastH + 0.06 + up, 0], mast: [0.0, (0.352 + mastH) / 2 + up, 0.03], ring: [0.13, 0.34 + explode * 0.66, 0.08],
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

  window.OddechRobot = { buildRobot, viewer, COL, partGeometry, linkOrigin, P3 };
})();
