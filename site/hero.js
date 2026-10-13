/* Hero: a slow field of smog particles. The pointer is a breath that clears the air around it. */
(function () {
  "use strict";
  const T = window.THREE, canvas = document.getElementById("heroCanvas");
  if (!T || !canvas) return;
  let renderer;
  try { renderer = new T.WebGLRenderer({ canvas, antialias: false, alpha: false }); } catch (e) { return; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5)); renderer.setClearColor(0x0F0E0C, 1);
  const scene = new T.Scene(), cam = new T.PerspectiveCamera(50, 1, 0.1, 60); cam.position.set(0, 0, 9);
  const N = window.innerWidth < 900 ? 2600 : 5200, X = 10, Y = 5.2, Z = 4;
  const pos = new Float32Array(N * 3), base = new Float32Array(N * 3), col = new Float32Array(N * 3), alpha = new Float32Array(N), size = new Float32Array(N), seed = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    pos[3 * i] = base[3 * i] = (Math.random() * 2 - 1) * X; pos[3 * i + 1] = base[3 * i + 1] = (Math.random() * 2 - 1) * Y; pos[3 * i + 2] = base[3 * i + 2] = (Math.random() * 2 - 1) * Z;
    const warm = Math.random() < 0.08; const c = warm ? [0.85, 0.53, 0.36] : [0.66 + 0.1 * Math.random(), 0.61 + 0.08 * Math.random(), 0.55 + 0.06 * Math.random()];
    col[3 * i] = c[0]; col[3 * i + 1] = c[1]; col[3 * i + 2] = c[2];
    alpha[i] = 0.25 + 0.5 * Math.random(); size[i] = 0.025 + 0.06 * Math.pow(Math.random(), 2.2); seed[i] = Math.random() * 100;
  }
  const g = new T.BufferGeometry();
  g.setAttribute("position", new T.BufferAttribute(pos, 3)); g.setAttribute("aColor", new T.BufferAttribute(col, 3));
  g.setAttribute("aAlpha", new T.BufferAttribute(alpha, 1)); g.setAttribute("aSize", new T.BufferAttribute(size, 1));
  const m = new T.ShaderMaterial({
    uniforms: { uScale: { value: 500 }, uFade: { value: 1 } }, transparent: true, depthWrite: false, blending: T.AdditiveBlending,
    vertexShader: "attribute vec3 aColor; attribute float aAlpha; attribute float aSize; uniform float uScale; uniform float uFade; varying vec3 vC; varying float vA;" +
      "void main(){ vC = aColor; vA = aAlpha * uFade; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = max(1.0, aSize * uScale / -mv.z); gl_Position = projectionMatrix * mv; }",
    fragmentShader: "varying vec3 vC; varying float vA; void main(){ vec2 d = gl_PointCoord - 0.5; float r = dot(d,d); if (r > 0.25) discard; gl_FragColor = vec4(vC, vA * smoothstep(0.25, 0.0, r) * 0.55); }",
  });
  const pts = new T.Points(g, m); pts.frustumCulled = false; scene.add(pts);
  // the robot has its own narrow camera, so it stands upright on the right without wide-angle distortion
  let rob = null, rScene = null, rCam = null;
  if (window.OddechRobot) {
    renderer.outputEncoding = T.sRGBEncoding; renderer.toneMapping = T.ACESFilmicToneMapping;
    rScene = new T.Scene(); rCam = new T.PerspectiveCamera(22, 1, 0.1, 50);
    rob = window.OddechRobot.buildRobot({ shadows: false }); rob.setRing(0xD9875C); rScene.add(rob.group);
    rScene.add(new T.HemisphereLight(0xd8cdbd, 0x1a1714, 0.9));
    const key = new T.DirectionalLight(0xfff0de, 2.2); key.position.set(-3, 4, 5); rScene.add(key);
    const rim = new T.DirectionalLight(0xD9875C, 1.8); rim.position.set(4, 2.5, -4); rScene.add(rim);
  }
  const mouse = new T.Vector2(9, 9), hit = new T.Vector3(99, 99, 0), ray = new T.Raycaster(), plane = new T.Plane(new T.Vector3(0, 0, 1), 0);
  let breath = 0, visible = true;
  window.addEventListener("pointermove", e => {
    const r = canvas.getBoundingClientRect(); if (e.clientY > r.bottom) return;
    mouse.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); breath = 1;
  });
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix();
    m.uniforms.uScale.value = h * renderer.getPixelRatio() / (2 * Math.tan(cam.fov * Math.PI / 360));
    if (rob) { rCam.aspect = w / h; rCam.updateProjectionMatrix(); const hw = 5.4 * Math.tan(11 * Math.PI / 180) * rCam.aspect, x = -hw * 0.58; rCam.position.set(x, 0.95, 5.4); rCam.lookAt(x, 0.76, 0); }
  }
  window.addEventListener("resize", resize); resize();
  new IntersectionObserver(es => { visible = es[0].isIntersecting; }).observe(canvas);
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let t = 0, last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!visible) return;
    t += reduce ? 0 : dt;
    ray.setFromCamera(mouse, cam); if (!ray.ray.intersectPlane(plane, hit)) hit.set(99, 99, 0);
    breath *= 0.985;
    const R = 2.1 * (0.6 + 0.4 * breath), R2 = R * R;
    for (let i = 0; i < N; i++) {
      const i3 = 3 * i, s = seed[i];
      let x = base[i3] + Math.sin(t * 0.07 + s) * 0.6 + t * 0.05, y = base[i3 + 1] + Math.sin(t * 0.11 + s * 1.7) * 0.35 + t * 0.018;
      x = ((x + X) % (2 * X) + 2 * X) % (2 * X) - X; y = ((y + Y) % (2 * Y) + 2 * Y) % (2 * Y) - Y;
      const dx = x - hit.x, dy = y - hit.y, d2 = dx * dx + dy * dy;
      if (d2 < R2) { const d = Math.sqrt(d2) || 1e-3, push = (R - d) * 0.9; x += dx / d * push; y += dy / d * push; }
      const jump = Math.abs(x - pos[i3]) > X || Math.abs(y - pos[i3 + 1]) > Y;             // wrapped around: no streak across the screen
      pos[i3] = jump ? x : pos[i3] + (x - pos[i3]) * 0.12; pos[i3 + 1] = jump ? y : pos[i3 + 1] + (y - pos[i3 + 1]) * 0.12;
    }
    g.attributes.position.needsUpdate = true;
    if (rob) { rob.group.rotation.y = 0.5 + t * 0.12; rob.setMast(0.4 + 1.2 * (0.5 - 0.5 * Math.cos(t * 0.32))); }
    const sc = window.scrollY || document.documentElement.scrollTop, h = canvas.clientHeight || 1;
    m.uniforms.uFade.value = Math.max(0, 1 - sc / h * 0.9); cam.position.y = -sc / h * 1.2; cam.position.z = 9 - sc / h * 1.5;
    renderer.render(scene, cam);
    if (rob && canvas.clientWidth > 900) { renderer.autoClear = false; renderer.clearDepth(); renderer.render(rScene, rCam); renderer.autoClear = true; }
  }
  requestAnimationFrame(frame);
})();
