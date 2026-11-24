import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const F = window.orbit;
const main = () => {
  if (!F) return;
  const small = innerWidth < 820, hi = !small;
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('space'), antialias: true, powerPreference: 'high-performance' }); } catch (e) { return; }
  if (!renderer.getContext()) return;
  document.documentElement.classList.add('gl');
  renderer.setPixelRatio(Math.min(devicePixelRatio, hi ? 2 : 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(small ? 55 : 40, 1, .05, 5000);
  const rand = (() => { let s = 17; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const loader = new THREE.TextureLoader(), aniso = renderer.capabilities.getMaxAnisotropy();
  const tex = (f, srgb = true) => { const t = loader.load('tex/' + f, () => { loaded++; }); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso; return t; };
  let loaded = 0;

  const L = new THREE.Vector3(-.45, .35, -.82).normalize();
  const sun = new THREE.DirectionalLight('#fff4e6', 3.2); scene.add(sun);
  scene.add(new THREE.AmbientLight('#1a2740', .22));

  // ---------- starfields: panorama + three point layers at different depths ----------
  const sky = new THREE.Mesh(new THREE.SphereGeometry(2400, 64, 32), new THREE.MeshBasicMaterial({ map: tex('sky.jpg'), side: THREE.BackSide, depthWrite: false, color: new THREE.Color(.42, .45, .52) }));
  scene.add(sky);
  const glow = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.2, 'rgba(255,255,255,.6)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
  const starLayer = (n, R0, R1, size) => {
    const p = [], c = [], col = new THREE.Color();
    for (let i = 0; i < n; i++) { const v = new THREE.Vector3(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1).normalize().multiplyScalar(R0 + rand() * (R1 - R0)); p.push(v.x, v.y, v.z);
      const t = rand(); col.setHSL(t < .3 ? .6 : t < .5 ? .11 : .58, t < .6 ? .4 : .05, .82 + rand() * .18); const b = .22 + Math.pow(rand(), 3) * .85; c.push(col.r * b, col.g * b, col.b * b); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
    const grp = new THREE.Group(); grp.add(new THREE.Points(g, new THREE.PointsMaterial({ size, map: glow, vertexColors: true, transparent: true, depthWrite: false, sizeAttenuation: false, blending: THREE.AdditiveBlending }))); scene.add(grp); return grp;
  };
  const layers = [{ g: sky, k: .012 }, { g: starLayer(hi ? 2400 : 1100, 1500, 1900, hi ? 2.2 : 2), k: .035 }, { g: starLayer(hi ? 650 : 300, 700, 1000, hi ? 3.2 : 2.8), k: .09 }, { g: starLayer(hi ? 110 : 50, 220, 380, hi ? 4.4 : 3.8), k: .22 }];

  // ---------- earth ----------
  const R = 10;
  const tilt = new THREE.Group(); tilt.rotation.z = THREE.MathUtils.degToRad(-23.4); scene.add(tilt);
  const spin = new THREE.Group(); tilt.add(spin);
  const cloudTex = tex('clouds.jpg', false); cloudTex.wrapS = THREE.RepeatWrapping;
  const EU = { dayMap: { value: tex('earth_day.jpg') }, nightMap: { value: tex('earth_night.jpg') }, normalMap: { value: tex('earth_normal.jpg', false) }, specMap: { value: tex('earth_spec.jpg', false) }, cloudMap: { value: cloudTex }, cloudShift: { value: 0 }, uL: { value: L } };
  const sphereVS = `varying vec2 vUv; varying vec3 vN; varying vec3 vT; varying vec3 vW;
    void main(){ vUv = uv; vec3 n = normalize(position); vec3 t = normalize(vec3(n.z, 0.0, -n.x) + vec3(1e-5, 0.0, 0.0));
      vN = normalize(mat3(modelMatrix) * n); vT = normalize(mat3(modelMatrix) * t); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
  const earth = new THREE.Mesh(new THREE.SphereGeometry(R, 192, 128), new THREE.ShaderMaterial({ uniforms: EU, vertexShader: sphereVS,
    fragmentShader: `uniform sampler2D dayMap, nightMap, normalMap, specMap, cloudMap; uniform float cloudShift; uniform vec3 uL;
      varying vec2 vUv; varying vec3 vN; varying vec3 vT; varying vec3 vW;
      void main(){
        vec3 Ng = normalize(vN), T = normalize(vT), B = normalize(cross(Ng, T));
        vec3 nm = texture2D(normalMap, vUv).xyz * 2.0 - 1.0; nm.xy *= 1.4; vec3 N = normalize(T * nm.x + B * nm.y + Ng * nm.z);
        vec3 V = normalize(cameraPosition - vW); float ndl = dot(N, uL), ndlG = dot(Ng, uL);
        float dayMask = smoothstep(-0.12, 0.22, ndlG);
        float cl = texture2D(cloudMap, vUv + vec2(cloudShift - 0.0025, 0.0)).r; float shadow = 1.0 - 0.55 * cl;
        vec3 col = texture2D(dayMap, vUv).rgb * max(ndl, 0.0) * 2.4 * shadow * smoothstep(-0.1, 0.25, ndlG);
        vec3 H = normalize(uL + V); float hv = max(dot(Ng, H), 0.0);
        col += vec3(1.0, 0.9, 0.75) * (pow(hv, 260.0) * 2.0 + pow(hv, 18.0) * 0.1) * texture2D(specMap, vUv).r * dayMask * shadow;
        vec3 night = pow(texture2D(nightMap, vUv).rgb, vec3(1.35));
        float lum = dot(night, vec3(0.3, 0.55, 0.15));
        col += vec3(1.0, 0.82, 0.45) * lum * 9.5 * (1.0 - smoothstep(-0.2, 0.06, ndlG)) * (1.0 - 0.55 * cl);
        float mu = max(dot(Ng, V), 0.0), fr = pow(1.0 - mu, 2.3);
        vec3 skyc = mix(vec3(1.0, 0.55, 0.25), vec3(0.32, 0.6, 1.0), smoothstep(0.0, 0.25, ndlG));
        col = mix(col, skyc * 1.25 * smoothstep(-0.15, 0.45, ndlG), fr * 0.5);
        col += vec3(0.04, 0.09, 0.2) * fr * 0.35;
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }` }));
  spin.add(earth);
  spin.add(new THREE.Mesh(new THREE.SphereGeometry(R * 1.006, 160, 110), new THREE.ShaderMaterial({ uniforms: { cloudMap: { value: cloudTex }, cloudShift: EU.cloudShift, uL: EU.uL }, vertexShader: sphereVS, transparent: true, depthWrite: false,
    fragmentShader: `uniform sampler2D cloudMap; uniform float cloudShift; uniform vec3 uL; varying vec2 vUv; varying vec3 vN; varying vec3 vT; varying vec3 vW;
      void main(){ vec3 N = normalize(vN); float a = smoothstep(0.08, 0.95, texture2D(cloudMap, vUv + vec2(cloudShift, 0.0)).r);
        float ndl = dot(N, uL), lit = smoothstep(-0.18, 0.35, ndl);
        vec3 c = mix(vec3(0.95, 0.55, 0.32), vec3(1.0), smoothstep(0.0, 0.4, ndl)) * (0.025 + 1.2 * lit) * (0.55 + 0.45 * max(ndl, 0.0));
        gl_FragColor = vec4(c, a * 0.95);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }` })));
  const shellVS = 'varying vec3 vN; varying vec3 vW; void main(){ vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }';
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(R * 1.028, 128, 96), new THREE.ShaderMaterial({ uniforms: { uL: EU.uL }, side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexShader: shellVS,
    fragmentShader: `uniform vec3 uL; varying vec3 vN; varying vec3 vW;
      void main(){ vec3 V = normalize(cameraPosition - vW); float mu = dot(V, -vN);
        float edge = smoothstep(-0.02, 0.22, mu) * (1.0 - smoothstep(0.22, 0.32, mu));
        float sunSide = dot(normalize(vW), uL), day = smoothstep(-0.35, 0.3, sunSide), fwd = pow(max(dot(-V, uL), 0.0), 8.0);
        vec3 c = mix(vec3(1.0, 0.6, 0.3), vec3(0.45, 0.73, 1.0), smoothstep(-0.1, 0.35, sunSide));
        float i = edge * (day * 1.5 + fwd * 2.4 * smoothstep(-0.5, 0.1, sunSide) + 0.12);
        gl_FragColor = vec4(c * i, 1.0);
        #include <colorspace_fragment>
      }` })));
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(R * 1.12, 96, 64), new THREE.ShaderMaterial({ uniforms: { uL: EU.uL }, side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexShader: shellVS,
    fragmentShader: `uniform vec3 uL; varying vec3 vN; varying vec3 vW;
      void main(){ vec3 V = normalize(cameraPosition - vW); float mu = dot(V, -vN); float f = pow(smoothstep(0.0, 0.62, 0.62 - mu), 4.0);
        float sunSide = dot(normalize(vW), uL); float day = smoothstep(-0.3, 0.4, sunSide) + pow(max(dot(-V, uL), 0.0), 6.0) * 1.2 + 0.08;
        gl_FragColor = vec4(vec3(0.3, 0.55, 1.0) * f * 0.16 * day, 1.0);
        #include <colorspace_fragment>
      }` })));

  // longitude that faces the camera: North America (about 96°W, 38°N)
  const ll = (lat, lon) => { const phi = (lon + 180) * Math.PI / 180, th = (90 - lat) * Math.PI / 180; return new THREE.Vector3(-Math.cos(phi) * Math.sin(th), Math.cos(th), Math.sin(phi) * Math.sin(th)); };
  const NA = ll(38, -92), faceNA = -Math.atan2(NA.x, NA.z);

  // ---------- moon ----------
  const moon = new THREE.Mesh(new THREE.SphereGeometry(2.7, 160, 110), new THREE.MeshStandardMaterial({ map: tex('moon.jpg'), bumpMap: tex('moon.jpg', false), bumpScale: 1.6, roughness: 1, metalness: 0 }));
  const MOON = new THREE.Vector3(-26, 12, -40); moon.position.copy(MOON); scene.add(moon);

  // ---------- tiny satellites with occasional glints ----------
  const orbitPos = (r, inc, raan, nu, out) => { const cO = Math.cos(raan), sO = Math.sin(raan), cn = Math.cos(nu), sn = Math.sin(nu), ci = Math.cos(inc), si = Math.sin(inc); return out.set(r * (cO * cn - sO * sn * ci), r * sn * si, r * (sO * cn + cO * sn * ci)); };
  const satRoot = new THREE.Group(); tilt.add(satRoot);
  const SN = hi ? 260 : 120, sats = [];
  for (let i = 0; i < SN; i++) sats.push({ r: R * (1.06 + rand() * .1), inc: THREE.MathUtils.degToRad([53, 70, 97.6, 43][i % 4]), raan: rand() * Math.PI * 2, nu: rand() * Math.PI * 2, w: .035 + rand() * .03, gf: .2 + rand() * .5, gp: rand() * 100 });
  const sPos = new Float32Array(SN * 3), sCol = new Float32Array(SN * 3), sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(sPos, 3)); sg.setAttribute('color', new THREE.BufferAttribute(sCol, 3));
  satRoot.add(new THREE.Points(sg, new THREE.PointsMaterial({ size: hi ? 3 : 2.6, map: glow, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: false })));

  let composer = null;
  if (hi) { composer = new EffectComposer(renderer); composer.addPass(new RenderPass(scene, camera)); composer.addPass(new UnrealBloomPass(new THREE.Vector2(512, 512), .5, .55, .86)); composer.addPass(new OutputPass()); }

  // ---------- choreography: one keyframe per [data-scene] anchor ----------
  // ex: horizontal screen offset · ty: vertical offset · d: distance · y: camera height · s: extra spin · f: moon focus · l: sun direction · ex2: exposure
  const KEYS = {
    hero:       { ex: 12, ty: 2.5, d: 40, y: 7, s: 0, f: 0, l: [-.5, .3, -.81], ex2: 1 },
    work:       { ex: 0, ty: 10.6, d: 15, y: 2.4, s: .45, f: 0, l: [.06, .32, -.95], ex2: 1 },
    skills:     { ex: 15, ty: -7, d: 54, y: 0, s: .9, f: 0, l: [-.35, .2, -.92], ex2: 1 },
    about:      { ex: 0, ty: 0, d: 10, y: 1, s: 1.2, f: 1, l: [-.95, .12, -.28], ex2: 1 },
    experience: { ex: -12, ty: 0, d: 32, y: 2, s: 1.7, f: 0, l: [-.35, .3, -.89], ex2: 1 },
    education:  { ex: 0, ty: 5, d: 70, y: 6, s: 2.3, f: 0, l: [-.75, .25, -.6], ex2: 1 },
    contact:    { ex: 0, ty: -6, d: 30, y: 6, s: Math.PI * 2, f: 0, l: [-.45, .35, -.82], ex2: 1 }
  };
  if (small) for (const k in KEYS) { const o = KEYS[k]; o.ex = 0; o.d *= 1.35; if (k === 'hero') o.ty = 12; }
  let anchors = [];
  const measure = () => { const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    anchors = [...document.querySelectorAll('[data-scene]')].map(el => { const r = el.getBoundingClientRect(), top = r.top + scrollY;
      const u = el.dataset.scene === 'hero' ? 0 : Math.min(1, Math.max(0, (top + r.height / 2 - innerHeight / 2) / max)); return { u, k: KEYS[el.dataset.scene] }; }).sort((a, b) => a.u - b.u); };
  const lv = new THREE.Vector3(), la = new THREE.Vector3(), lb = new THREE.Vector3();
  const key = u => { let i = 0; while (i < anchors.length - 2 && u > anchors[i + 1].u) i++;
    const A = anchors[i], Bk = anchors[i + 1] || A, t = Bk === A ? 0 : sstep(0, 1, (u - A.u) / Math.max(1e-4, Bk.u - A.u)), a = A.k, b = Bk.k, o = {};
    for (const k of ['ex', 'ty', 'd', 'y', 's', 'f']) o[k] = a[k] + (b[k] - a[k]) * t;
    o.l = lv.copy(la.fromArray(a.l)).lerp(lb.fromArray(b.l), t).normalize(); return o; };

  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  addEventListener('pointermove', e => { mouse.tx = e.clientX / innerWidth - .5; mouse.ty = e.clientY / innerHeight - .5; }, { passive: true });
  const resize = () => { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); if (composer) composer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); measure(); };
  const ro = new ResizeObserver(resize); ro.observe(document.body); resize();

  const v = new THREE.Vector3(), w = new THREE.Vector3(), tgt = new THREE.Vector3(), Ll = new THREE.Vector3(), tiltInv = new THREE.Quaternion();
  let cur = F.target, last = performance.now(), clock = 0, drew = 0;
  const frame = now => {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, .1); last = now;
    const still = F.paused;
    if (still && drew > 2 && loaded >= 8) return;          // motion paused: keep the last frame
    if (!still) clock += dt;
    cur = still ? F.target : cur + (F.target - cur) * Math.min(1, dt * 2.4);
    const t = clock;
    if (!still) { mouse.x += (mouse.tx - mouse.x) * Math.min(1, dt * 2.5); mouse.y += (mouse.ty - mouse.y) * Math.min(1, dt * 2.5); }
    const k = key(cur);
    L.copy(k.l); sun.position.copy(L).multiplyScalar(100);
    spin.rotation.y = faceNA + k.s + t * .004;
    EU.cloudShift.value = t * .0007;

    const focus = v.set(0, 0, 0).lerp(MOON, k.f), sx = -k.ex * (1 - k.f) - (small ? 0 : 3.4 * k.f);
    tgt.set(focus.x + sx, focus.y + k.ty, focus.z);
    camera.position.set(focus.x + sx + mouse.x * (1.6 - k.f), focus.y + k.ty + k.y - mouse.y * (1.1 - k.f * .7), focus.z + k.d);
    camera.lookAt(tgt);
    layers.forEach(({ g, k: kk }) => { g.rotation.y = cur * kk * 4 + mouse.x * kk * .5; g.rotation.x = -cur * kk * 1.2 + mouse.y * kk * .35; g.position.copy(camera.position); });
    moon.rotation.y = .7 + t * .004;

    tilt.updateMatrixWorld(); tiltInv.copy(tilt.quaternion).invert(); Ll.copy(L).applyQuaternion(tiltInv);
    for (let i = 0; i < SN; i++) { const s = sats[i]; orbitPos(s.r, s.inc, s.raan, s.nu + t * s.w, w);
      sPos[i * 3] = w.x; sPos[i * 3 + 1] = w.y; sPos[i * 3 + 2] = w.z;
      const dl = w.dot(Ll), lit = !(dl < 0 && w.lengthSq() - dl * dl < R * R);
      const glint = Math.pow(Math.max(0, Math.sin(t * s.gf + s.gp)), 90) * 3.2;
      const b = lit ? .2 + glint : 0; sCol[i * 3] = b * .95; sCol[i * 3 + 1] = b * .97; sCol[i * 3 + 2] = b; }
    sg.attributes.position.needsUpdate = true; sg.attributes.color.needsUpdate = true;

    if (composer) composer.render(); else renderer.render(scene, camera);
    drew++;
  };
  requestAnimationFrame(frame);
};
try { main(); } catch (e) { console.error(e); }
