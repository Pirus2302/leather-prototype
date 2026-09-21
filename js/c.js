/* ==========================================================================
   Вариант C – «WOW»
   Один rAF-цикл, одна шкала скролла. Всё читает S.y / S.sy (сглаженный скролл)
   ========================================================================== */
(() => {
  'use strict';

  const root = document.documentElement;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const dampK = (lambda, dt) => 1 - Math.exp(-lambda * dt);
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FINE = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const mqNoPin = matchMedia('(max-width: 900px), (hover: none), (pointer: coarse)');

  /* offsetTop-цепочка: в отличие от getBoundingClientRect не зависит от transform у reveal-элементов */
  const absTop = (el) => { let y = 0; while (el) { y += el.offsetTop; el = el.offsetParent; } return y; };
  const absLeft = (el) => { let x = 0; while (el) { x += el.offsetLeft; el = el.offsetParent; } return x; };

  const S = { vw: innerWidth, vh: innerHeight, y: 0, sy: 0, vel: 0, px: innerWidth / 2, py: innerHeight / 2, hasPointer: false };

  /* ------------------------------------------------------------------ текст */
  $$('[data-split]').forEach((el) => {
    const text = el.textContent.trim();
    el.textContent = '';
    [...text].forEach((c, i) => {
      const s = document.createElement('span');
      s.className = 'ch';
      s.style.setProperty('--i', i);
      s.textContent = c;
      el.appendChild(s);
    });
  });

  const quoteEl = $('#quote');
  const words = [];
  if (quoteEl) {
    const parts = quoteEl.textContent.trim().split(/\s+/);
    quoteEl.textContent = '';
    parts.forEach((w, i) => {
      const s = document.createElement('span');
      s.className = 'w';
      s.textContent = w;
      quoteEl.appendChild(s);
      if (i < parts.length - 1) quoteEl.appendChild(document.createTextNode(' '));
      words.push({ el: s, o: -1 });
    });
  }

  /* ------------------------------------------------- шейдер GetLayers «Drape»
     Исходник ассета перенесён как есть (GLSL и пружины курсора не тронуты),
     перекраска только через CONFIG */
  const Drape = (() => {
    const canvas = $('#drape');
    const hero = $('#hero');
    const CONFIG = {
      bgColor: '#0D0A08', colorA: '#1C110A', colorB: '#3A2114', colorC: '#8A4B22', colorD: '#E7A35A',
      scale: 1.0, speed: 0.33, angle: -0.62, foldFreq: 9.0, foldDepth: 0.032, drape: 0.3, drapeScale: 0.45, vary: 0.35, varyFreq: 1.3,
      lightX: 0.55, lightY: 0.62, lightZ: 0.6, diffuse: 0.4, specular: 0.45, shine: 20.0, keyX: 0.28, keyY: 0.2, keySpread: 0.55, ambient: 0.55, iris: 0.2,
      contrast: 1.35, midpoint: 0.32, bandAmount: 0.0, bandCount: 7, bandSoft: 0.45,
      glow: 0.1, sink: 0.1, grain: 0, grainAnim: 0, dither: 1.3, vignette: 0.18, cursor: 1,
      pointerRadius: 0.55, push: 0.22, lift: 0.22, wake: 0.16, wakeRadius: 0.85, parallax: 0.0025,
      maxDpr: mqNoPin.matches ? 1.25 : 1.5,
    };

    const VERT = `#version 300 es
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

    const FRAG = `#version 300 es
precision highp float;
out vec4 fragColor;

uniform vec2  iResolution;
uniform float iTime;
uniform vec2  iMouse;
uniform vec2  iMouseWake;

uniform vec3  uBg, uColorA, uColorB, uColorC, uColorD;
uniform float uScale, uSpeed, uAngle, uFoldFreq, uFoldDepth, uDrape, uDrapeScale, uVary, uVaryFreq;
uniform float uLightX, uLightY, uLightZ, uDiffuse, uSpecular, uShine;
uniform float uKeyX, uKeyY, uKeySpread, uAmbient, uIris;
uniform float uContrast, uMidpoint, uBandAmount, uBandCount, uBandSoft;
uniform float uGlow, uSink, uGrain, uDither, uVignette;
uniform float uPointerRadius, uPush, uLift, uWake, uWakeRadius, uParallax;

#define OCTAVES 1

vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}

float snoise(vec2 p) {
  const float K1 = 0.366025404, K2 = 0.211324865;
  vec2 i = floor(p + (p.x + p.y) * K1);
  vec2 a = p - i + (i.x + i.y) * K2;
  float m = step(a.y, a.x);
  vec2 o = vec2(m, 1.0 - m);
  vec2 b = a - o + K2;
  vec2 c = a - 1.0 + 2.0 * K2;
  vec3 h = max(0.5 - vec3(dot(a, a), dot(b, b), dot(c, c)), 0.0);
  vec3 n = h * h * h * h * vec3(dot(a, hash2(i)), dot(b, hash2(i + o)), dot(c, hash2(i + 1.0)));
  return dot(n, vec3(70.0));
}

float fbm(vec2 p) {
  float v = 0.0, amp = 0.5;
  for (int i = 0; i < OCTAVES; i++) { v += amp * snoise(p); p *= 2.02; amp *= 0.5; }
  return v;
}

void bump(vec2 d, float r, out float g, out vec2 dg) {
  float r2 = max(1e-4, r * r);
  float q = dot(d, d) / r2;
  float k = 1.0 / (1.0 + q * q);
  g = k;
  dg = -4.0 * q * d * k * k / r2;
}

vec3 ramp4(float t) {
  vec3 c = mix(uColorA, uColorB, smoothstep(0.00, 0.44, t));
  c = mix(c, uColorC, smoothstep(0.26, 0.76, t));
  c = mix(c, uColorD, smoothstep(0.58, 1.00, t));
  return c;
}

float triDither(vec2 fc) {
  float a = fract(sin(dot(fc, vec2(12.9898, 78.233))) * 43758.5453);
  float b = fract(sin(dot(fc + 17.0, vec2(12.9898, 78.233))) * 43758.5453);
  return (a + b - 1.0) / 255.0;
}

uniform float uGrainAnim;
float houseGrain(vec2 fc) {
  uvec2 q = uvec2(fc) * uvec2(1597334677u, 3812015801u)
          + uint(floor(iTime * 24.0 * uGrainAnim)) * 2654435769u;
  uint n = q.x ^ q.y; n = n * 1664525u + 1013904223u; n ^= n >> 16u; n *= 2246822519u; n ^= n >> 13u;
  float a = float(n & 0xffffu) / 65535.0;
  n *= 3266489917u; n ^= n >> 16u;
  float b = float(n & 0xffffu) / 65535.0;
  return a + b - 1.0;
}
void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * iResolution) / iResolution.y;
  float t = iTime * uSpeed;

  vec2 p = (uv - iMouse * uParallax) * uScale;

  vec2 axis   = vec2(cos(uAngle), sin(uAngle));
  vec2 across = vec2(-axis.y, axis.x);
  float s     = dot(p, across);
  float along = dot(p, axis);

  s += fbm(p * uDrapeScale + vec2(0.0, t * 0.11)) * uDrape;

  float g1, g2; vec2 dg1, dg2;
  bump(p - iMouse,     uPointerRadius, g1, dg1);
  bump(p - iMouseWake, uWakeRadius,    g2, dg2);

  s += uPush * (g1 - g2 * 0.55);

  float amp = 1.0 + uVary * sin(along * uVaryFreq + t * 0.37);
  float k = uFoldFreq;
  float slope = cos(s * k + t * 0.70) * k
              + cos(s * k * 1.87 - 0.6 - t * 0.43) * k * 1.87 * 0.55
              + cos(s * k * 3.11 + 2.1 + t * 0.29) * k * 3.11 * 0.28;
  slope *= amp * uFoldDepth;

  vec2 grad = across * slope + dg1 * uLift + dg2 * uWake;
  vec3 N = normalize(vec3(-grad, 1.0));

  vec3 L  = normalize(vec3(uLightX, uLightY, uLightZ));
  vec3 Hv = normalize(L + vec3(0.0, 0.0, 1.0));

  float ndl  = max(dot(N, L), 0.0);
  float spec = pow(max(dot(N, Hv), 0.0), uShine);

  vec2 kd = uv - vec2(uKeyX, uKeyY);
  float key = exp(-dot(kd, kd) * uKeySpread);

  float f = (uDiffuse * ndl + uSpecular * spec) * (uAmbient + key);
  f = f / (1.0 + f);
  f = clamp((f - uMidpoint) * uContrast + 0.5, 0.0, 1.0);

  float steps = max(1.0, floor(uBandCount));
  float fs = f * steps;
  float banded = (floor(fs) + smoothstep(0.5 - uBandSoft * 0.5, 0.5 + uBandSoft * 0.5, fract(fs))) / steps;
  f = mix(f, banded, uBandAmount);

  float shot = dot(N.xy, across) * uIris;
  vec3 col = ramp4(clamp(f + shot, 0.0, 1.0));
  col += uColorD * uGlow * pow(f, 4.0);
  col = mix(uBg, col, smoothstep(0.0, max(0.01, uSink), f) * 0.90 + 0.10);

  col *= 1.0 - uVignette * dot(uv, uv);
  { float hgL = clamp(dot(col, vec3(0.299, 0.587, 0.114)), 0.0, 1.0);
    col += houseGrain(gl_FragCoord.xy) * uGrain * mix(1.0, 4.0 * hgL * (1.0 - hgL), 0.6); }
  col += triDither(gl_FragCoord.xy) * uDither;

  fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

    const api = { ok: false, firstFrame: false, visible: true, startIntro, frame, resize };
    let gl, program, clock = 0, introT = -1;
    const LOC = {};
    const F_SPRING = 0.016, F_DAMP = 0.18, W_SPRING = 0.0055, W_DAMP = 0.115;
    const mouse = { x: 0.3, y: 0.1, vx: 0, vy: 0, wx: 0.3, wy: 0.1, wvx: 0, wvy: 0, tx: 0.3, ty: 0.1 };
    const INTRO = { dur: 2.8, ambient: [0.04, CONFIG.ambient], keyX: [-1.35, CONFIG.keyX], keySpread: [2.4, CONFIG.keySpread] };

    const hexToVec3 = (hex) => { const n = parseInt(hex.slice(1), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };
    const loc = (n) => (n in LOC ? LOC[n] : (LOC[n] = gl.getUniformLocation(program, n)));
    const u1f = (n, v) => gl.uniform1f(loc(n), v);
    const u2f = (n, x, y) => gl.uniform2f(loc(n), x, y);
    const u3c = (n, hex) => { const c = hexToVec3(hex); gl.uniform3f(loc(n), c[0], c[1], c[2]); };

    function compile(type, src) {
      const sh = gl.createShader(type);
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
      return sh;
    }

    function applyConfig() {
      u3c('uBg', CONFIG.bgColor); u3c('uColorA', CONFIG.colorA); u3c('uColorB', CONFIG.colorB); u3c('uColorC', CONFIG.colorC); u3c('uColorD', CONFIG.colorD);
      const map = { uScale: 'scale', uSpeed: 'speed', uAngle: 'angle', uFoldFreq: 'foldFreq', uFoldDepth: 'foldDepth', uDrape: 'drape', uDrapeScale: 'drapeScale', uVary: 'vary', uVaryFreq: 'varyFreq',
        uLightX: 'lightX', uLightY: 'lightY', uLightZ: 'lightZ', uDiffuse: 'diffuse', uSpecular: 'specular', uShine: 'shine', uKeyX: 'keyX', uKeyY: 'keyY', uKeySpread: 'keySpread', uAmbient: 'ambient', uIris: 'iris',
        uContrast: 'contrast', uMidpoint: 'midpoint', uBandAmount: 'bandAmount', uBandCount: 'bandCount', uBandSoft: 'bandSoft', uGlow: 'glow', uSink: 'sink', uGrain: 'grain', uGrainAnim: 'grainAnim', uDither: 'dither', uVignette: 'vignette',
        uPointerRadius: 'pointerRadius', uPush: 'push', uLift: 'lift', uWake: 'wake', uWakeRadius: 'wakeRadius', uParallax: 'parallax' };
      for (const k in map) u1f(k, CONFIG[map[k]]);
    }

    function resize() {
      if (!api.ok) return;
      const dpr = Math.min(window.devicePixelRatio || 1, CONFIG.maxDpr);
      const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
      const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      gl.viewport(0, 0, w, h);
      u2f('iResolution', w, h);
    }

    function setIntro(e) {
      u1f('uAmbient', lerp(INTRO.ambient[0], INTRO.ambient[1], e));
      u1f('uKeyX', lerp(INTRO.keyX[0], INTRO.keyX[1], e));
      u1f('uKeySpread', lerp(INTRO.keySpread[0], INTRO.keySpread[1], e));
    }

    function startIntro() { if (api.ok && !RM) introT = 0; }

    /* dtMs – реальный интервал кадра; шаги пружин как в исходнике ассета */
    function frame(dtMs) {
      if (!api.ok || !api.visible) return;
      const ms = dtMs > 50 ? 50 : dtMs < 4.167 ? 4.167 : dtMs;
      const s = ms > 36.7 ? 2.2 : ms * 0.06;
      clock += ms * 0.001;

      mouse.vx += ((mouse.tx - mouse.x) * F_SPRING - mouse.vx * F_DAMP) * s;
      mouse.vy += ((mouse.ty - mouse.y) * F_SPRING - mouse.vy * F_DAMP) * s;
      mouse.x += mouse.vx * s; mouse.y += mouse.vy * s;
      mouse.wvx += ((mouse.tx - mouse.wx) * W_SPRING - mouse.wvx * W_DAMP) * s;
      mouse.wvy += ((mouse.ty - mouse.wy) * W_SPRING - mouse.wvy * W_DAMP) * s;
      mouse.wx += mouse.wvx * s; mouse.wy += mouse.wvy * s;

      if (introT >= 0) {
        introT += ms * 0.001;
        const t = clamp(introT / INTRO.dur, 0, 1);
        setIntro(easeOutCubic(t));
        if (t >= 1) introT = -1;
      }

      u1f('iTime', clock);
      u2f('iMouse', mouse.x, mouse.y);
      u2f('iMouseWake', mouse.wx, mouse.wy);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      api.firstFrame = true;
    }

    try {
      gl = canvas.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'high-performance' });
      if (gl) {
        program = gl.createProgram();
        gl.attachShader(program, compile(gl.VERTEX_SHADER, VERT));
        gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAG));
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
        gl.useProgram(program);
        gl.bindVertexArray(gl.createVertexArray());
        api.ok = true;
        applyConfig();
        resize();
        if (RM) { clock = 14; frame(16); api.visible = false; }   /* один статичный кадр */
        else setIntro(0);
        canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); api.ok = false; });
      }
    } catch (err) {
      api.ok = false;   /* останется CSS-градиент под канвасом */
    }

    if (api.ok && !RM) {
      new IntersectionObserver((es) => { api.visible = es[0].isIntersecting; }, { threshold: 0 }).observe(canvas);
      if (FINE) {
        const aim = (e) => {
          const h = hero.offsetHeight || S.vh;
          mouse.tx = (e.clientX / S.vw - 0.5) * (S.vw / h);
          mouse.ty = 0.5 - (e.clientY + window.scrollY) / h;
        };
        addEventListener('pointermove', aim, { passive: true });
      }
    }
    return api;
  })();

  /* ---------------------------------------------------------------- лоадер */
  const Loader = (() => {
    const el = $('#loader');
    const rect = $('#ls-rect');
    const needle = $('#ls-needle');
    const MIN_VISIBLE = RM ? 300 : 1200;
    const HARD_CAP = 4000;
    const t0 = performance.now();
    let v = 0, done = false, fontsReady = false;

    root.classList.add('is-locked');
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    if (!location.hash) window.scrollTo(0, 0);

    const fr = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    fr.then(() => { fontsReady = true; });

    function exit() {
      if (done) return;
      done = true;
      /* ворота открываются в НАЧАЛЕ ухода шторки: контент въезжает сквозь неё */
      root.classList.add('is-ready');
      Drape.startIntro();
      el.classList.add('is-out');
      let released = false;
      const release = () => {
        if (released) return;
        released = true;
        el.classList.add('is-gone');
        root.classList.remove('is-locked');   /* скролл отпускаем только когда шторка ушла */
      };
      el.addEventListener('transitionend', (e) => { if (e.target === el) release(); });
      setTimeout(release, RM ? 600 : 1500);
    }

    function tick(now, dt) {
      if (done) return;
      const elapsed = now - t0;
      const ready = (fontsReady && (Drape.firstFrame || !Drape.ok)) || elapsed > HARD_CAP;
      if (ready && v >= 0.994) v = 1;
      else { const ceil = ready ? 1 : 0.92; v += (ceil - v) * (ready ? 6 : 1.7) * dt; }
      if (!RM) {
        rect.setAttribute('width', (4 + v * 314).toFixed(1));
        needle.setAttribute('transform', `translate(${(v * 314).toFixed(1)} 12)`);
      }
      if (v >= 1 && elapsed >= MIN_VISIBLE) exit();
    }
    return { tick, get done() { return done; } };
  })();

  /* ------------------------------------------------------ корзина и тост */
  const cartBtn = $('#cart'), cartN = $('#cartN'), toast = $('#toast');
  let cartCount = 0, toastT;
  function say(msg) {
    toast.textContent = msg;
    toast.classList.add('is-on');
    clearTimeout(toastT);
    toastT = setTimeout(() => toast.classList.remove('is-on'), 2600);
  }
  function addToCart(name, btn) {
    cartCount += 1;
    cartN.textContent = cartCount;
    cartBtn.setAttribute('aria-label', `Корзина, товаров: ${cartCount}`);
    cartBtn.classList.remove('is-bump'); void cartBtn.offsetWidth; cartBtn.classList.add('is-bump');
    if (btn) {
      btn.classList.add('is-added'); btn.textContent = 'Добавлено';
      setTimeout(() => { btn.classList.remove('is-added'); btn.textContent = 'В корзину'; }, 1600);
    }
    say(`${name} – в корзине`);
  }
  cartBtn.addEventListener('click', () => say(cartCount ? `В корзине изделий: ${cartCount}. Оформление – через заявку мастеру` : 'Корзина пока пуста'));

  $('#vTrack').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const name = btn.closest('.card').dataset.name;
    if (btn.dataset.act === 'cart') addToCart(name, btn);
    else {
      const wish = $('#wish');
      if (wish && !wish.value.includes(name)) wish.value = (wish.value ? wish.value + '\n' : '') + `Хочу заказать: ${name}`;
      $('#order').scrollIntoView({ behavior: RM ? 'auto' : 'smooth' });
    }
  });

  /* ----------------------------------------------------------------- форма */
  const form = $('#form'), formOk = $('#formOk'), formErr = $('#formErr');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const bad = $$('[required]', form).find((f) => !f.value.trim());
    if (bad) { formErr.hidden = false; bad.focus(); return; }
    formErr.hidden = true;
    form.hidden = true;
    formOk.hidden = false;
    formOk.focus({ preventScroll: true });
  });

  /* ------------------------------------------------------------------ меню */
  const burger = $('#burger'), menu = $('#menu'), hdr = $('#hdr');
  let menuOpen = false;
  function setMenu(open) {
    if (open === menuOpen) return;
    menuOpen = open;
    menu.classList.toggle('is-open', open);
    menu.inert = !open;
    hdr.classList.toggle('is-menu', open);
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
    if (Loader.done) root.classList.toggle('is-locked', open);
    if (open) setTimeout(() => { const a = $('a', menu); if (a) a.focus({ preventScroll: true }); }, 350);
  }
  burger.addEventListener('click', () => setMenu(!menuOpen));
  menu.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && menuOpen) { setMenu(false); burger.focus(); } });

  /* ------------------------------------------------- появление по скроллу */
  if ('IntersectionObserver' in window && !RM) {
    const io = new IntersectionObserver((es) => {
      es.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    $$('[data-reveal], [data-clip]').forEach((el) => io.observe(el));
  } else {
    $$('[data-reveal], [data-clip]').forEach((el) => el.classList.add('in'));
  }

  /* ------------------------------------------------------------ геометрия */
  const page = $('.page');
  const themed = $$('[data-theme]').filter((el) => el !== hdr);
  let themeTops = [];

  /* витрина */
  const V = { sec: $('#vitrina'), stage: $('#vStage'), viewport: $('#vViewport'), track: $('#vTrack'), bar: $('#vBar'), now: $('#vNow'), cards: [], top: 0, max: 0, x: 0, lastX: null, noPin: true, count: 10 };
  V.cards = $$('.card', V.track).map((el) => ({ el, img: $('.card__img', el), tilt: $('.card__tilt', el), left: 0, w: 0, rx: 0, ry: 0, trx: 0, try_: 0, px: null }));

  /* процесс */
  const P = { steps: $$('.step'), imgs: $$('#pFrame img'), now: $('#pNow'), mids: [], active: 0 };
  /* цитата */
  const Q = { top: 0, h: 0 };
  /* бегущая строка */
  const M = { track: $('#mqTrack'), set: $('.mq__set'), w: 0, x: 0, dir: 1, visible: false };
  if (M.track && 'IntersectionObserver' in window) new IntersectionObserver((es) => { M.visible = es[0].isIntersecting; }, { rootMargin: '20% 0px' }).observe($('#mq'));

  /* нить */
  const T = { svg: $('#thread'), line: $('#th-line'), st: $('#th-st'), lines: [], shown: 0, pitch: 23, dash: 13, needle: $('#th-needle'), knot: $('#th-knot'), anchors: $$('[data-thread]'), knotEl: $('#knot'),
    total: 0, step: 8, xs: null, ys: null, n: 0, lastL: -1, W: 0, H: 0, tied: false };

  function buildThread() {
    const W = page.clientWidth, H = page.scrollHeight;
    T.W = W; T.H = H;
    T.svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    T.svg.setAttribute('width', W);
    T.svg.setAttribute('height', H);
    T.svg.style.height = H + 'px';

    const mobile = W <= 900;
    const g = clamp(W * 0.04, 20, 64);
    const xOf = (v, i) => (mobile ? (i % 2 ? 12.5 : 7.5) : v === 'L' ? g * 0.5 : v === 'R' ? W - g * 0.5 : W * parseFloat(v));
    const secs = T.anchors.map((el, i) => { const top = absTop(el); return { x: xOf(el.dataset.thread, i), top, h: el.offsetHeight }; });
    const kx = mobile ? 10 : absLeft(T.knotEl) + T.knotEl.offsetWidth / 2;
    const ky = absTop(T.knotEl) + T.knotEl.offsetHeight / 2;

    let d = `M${secs[0].x.toFixed(1)} 0`;
    for (let i = 0; i < secs.length - 1; i++) {
      const a = secs[i], b = secs[i + 1];
      const c = clamp(Math.min(a.h, b.h) * 0.12, 50, 210);
      const y0 = b.top - c, y1 = b.top + c, my = (y0 + y1) / 2;
      d += ` L${a.x.toFixed(1)} ${y0.toFixed(1)} C${a.x.toFixed(1)} ${my.toFixed(1)} ${b.x.toFixed(1)} ${my.toFixed(1)} ${b.x.toFixed(1)} ${y1.toFixed(1)}`;
    }
    const last = secs[secs.length - 1];
    const yk0 = Math.max(last.top + 230, ky - (mobile ? 120 : 420));
    const myk = (yk0 + ky) / 2;
    d += ` L${last.x.toFixed(1)} ${yk0.toFixed(1)} C${last.x.toFixed(1)} ${(myk + 60).toFixed(1)} ${kx.toFixed(1)} ${(myk - 60).toFixed(1)} ${kx.toFixed(1)} ${ky.toFixed(1)}`;

    T.line.setAttribute('d', d);
    T.knot.setAttribute('transform', `translate(${kx.toFixed(1)} ${ky.toFixed(1)})`);

    T.total = T.line.getTotalLength();
    T.n = Math.ceil(T.total / T.step) + 1;
    T.xs = new Float32Array(T.n); T.ys = new Float32Array(T.n);
    let maxY = 0;
    for (let i = 0; i < T.n; i++) {
      const pt = T.line.getPointAtLength(Math.min(i * T.step, T.total));
      maxY = Math.max(maxY, pt.y);           /* страховка монотонности для бинарного поиска */
      T.xs[i] = pt.x; T.ys[i] = maxY;
    }
    T.line.style.strokeDasharray = `${T.total.toFixed(1)} ${T.total.toFixed(1)}`;
    T.lastL = -1;

    /* стежки – отдельные короткие отрезки вдоль пути: появляются по одному за иглой */
    const NS = 'http://www.w3.org/2000/svg';
    const frag = document.createDocumentFragment();
    const count = Math.max(0, Math.floor((T.total - 6) / T.pitch));
    T.lines = [];
    for (let i = 0; i < count; i++) {
      const a = 3 + i * T.pitch;
      const p1 = T.line.getPointAtLength(a), p2 = T.line.getPointAtLength(a + T.dash);
      const ln = document.createElementNS(NS, 'line');
      ln.setAttribute('x1', p1.x.toFixed(1)); ln.setAttribute('y1', p1.y.toFixed(1));
      ln.setAttribute('x2', p2.x.toFixed(1)); ln.setAttribute('y2', p2.y.toFixed(1));
      if (RM) ln.setAttribute('class', 'on');
      frag.appendChild(ln);
      T.lines.push(ln);
    }
    T.st.textContent = '';
    T.st.appendChild(frag);
    T.shown = RM ? count : 0;
    if (RM) {
      T.line.style.strokeDashoffset = '0';
      T.knot.classList.add('is-tied');
      T.svg.classList.add('is-done');
    }
  }

  function drawThread(targetY) {
    if (!T.n || RM) return;
    /* бинарный поиск длины пути по вертикали */
    let lo = 0, hi = T.n - 1, f = 0;
    if (targetY <= T.ys[0]) hi = 0;
    else if (targetY >= T.ys[hi]) lo = hi;
    else {
      while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (T.ys[mid] <= targetY) lo = mid; else hi = mid; }
      const dy = T.ys[hi] - T.ys[lo];
      f = dy > 0.001 ? clamp((targetY - T.ys[lo]) / dy, 0, 1) : 0;
    }
    const L = Math.min(T.total, (lo + f) * T.step);
    if (Math.abs(L - T.lastL) < 0.4) return;
    T.lastL = L;

    const x = lerp(T.xs[lo], T.xs[hi], f), y = lerp(T.ys[lo], T.ys[hi], f);
    const i2 = Math.min(T.n - 1, hi + 2), i1 = Math.max(0, lo - 1);
    const ang = Math.atan2(T.ys[i2] - T.ys[i1], T.xs[i2] - T.xs[i1]) * 180 / Math.PI;

    T.line.style.strokeDashoffset = (T.total - L).toFixed(1);
    const want = clamp(Math.floor((L - 34) / T.pitch), 0, T.lines.length);
    if (want > T.shown) { for (let i = T.shown; i < want; i++) T.lines[i].setAttribute('class', 'on'); }
    else if (want < T.shown) { for (let i = want; i < T.shown; i++) T.lines[i].removeAttribute('class'); }
    T.shown = want;
    T.needle.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${ang.toFixed(1)})`);

    const end = L >= T.total - 2;
    if (end && !T.tied) { T.tied = true; T.knot.classList.add('is-tied'); }
    T.svg.classList.toggle('is-done', end);
  }

  let lastW = -1, lastDocH = -1;
  function measure(force) {
    S.vw = document.documentElement.clientWidth;
    S.vh = window.innerHeight;

    /* витрина: закреплённая сцена или свайп */
    const np = RM || mqNoPin.matches;
    if (np !== V.noPin || force) {
      V.noPin = np;
      root.classList.toggle('no-pin', np);
      if (np) { V.sec.style.height = ''; V.track.style.transform = ''; V.cards.forEach((c) => { if (c.img) c.img.style.transform = ''; if (c.tilt) c.tilt.style.transform = ''; }); }
      else V.viewport.scrollLeft = 0;
    }
    if (!V.noPin) {
      V.max = Math.max(0, V.track.offsetWidth - V.viewport.clientWidth);
      V.sec.style.height = (V.stage.offsetHeight + V.max) + 'px';
      V.cards.forEach((c) => { c.left = c.el.offsetLeft; c.w = c.el.offsetWidth; });
      V.lastX = null;
    }
    V.top = absTop(V.sec);

    themeTops = themed.map((el) => ({ top: absTop(el), theme: el.dataset.theme }));
    P.mids = P.steps.map((el) => absTop(el) + el.offsetHeight / 2);
    if (quoteEl) { Q.top = absTop(quoteEl); Q.h = quoteEl.offsetHeight; }
    if (M.set) M.w = M.set.offsetWidth;
    Drape.resize();

    const docH = page.scrollHeight;
    if (force || S.vw !== lastW || Math.abs(docH - lastDocH) > 2) {
      lastW = S.vw; lastDocH = docH;
      buildThread();
    }
  }

  let rzT;
  const safeMeasure = (force) => { try { measure(force); } catch (err) { console.error(err); } };
  const queueMeasure = () => { clearTimeout(rzT); rzT = setTimeout(() => safeMeasure(false), 140); };
  addEventListener('resize', queueMeasure, { passive: true });
  addEventListener('orientationchange', queueMeasure, { passive: true });
  if (mqNoPin.addEventListener) mqNoPin.addEventListener('change', queueMeasure);
  if ('ResizeObserver' in window) new ResizeObserver(queueMeasure).observe(page);
  addEventListener('load', () => safeMeasure(true));
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => safeMeasure(true));

  /* фокус с клавиатуры внутри закреплённой ленты: докручиваем страницу до карточки */
  V.viewport.addEventListener('scroll', () => { if (!V.noPin && V.viewport.scrollLeft) V.viewport.scrollLeft = 0; });
  V.track.addEventListener('focusin', (e) => {
    if (V.noPin || !V.max) return;
    const card = e.target.closest('.card');
    if (!card || !e.target.matches(':focus-visible')) return;
    const want = clamp(card.offsetLeft - S.vw * 0.3, 0, V.max);
    window.scrollTo({ top: V.top + want, behavior: 'auto' });
  });

  /* ------------------------------------------- курсор, фото категорий, наклон */
  const cursor = $('#cursor');
  const C = { x: S.px, y: S.py, s: 1, ts: 1 };
  const catfloat = $('#catfloat');
  const CF = { x: 0, y: 0, r: 0, on: false, imgs: $$('img', catfloat) };
  const heroCardIn = $('.hero__card-in'), heroL1 = $('.hero__l1'), heroL2 = $('.hero__l2'), heroCard = $('#heroCard');
  const HC = { rx: 0, ry: 0 };
  let tiltActive = null;

  if (FINE && !RM) {
    addEventListener('pointermove', (e) => {
      S.px = e.clientX; S.py = e.clientY;
      if (!S.hasPointer) { S.hasPointer = true; C.x = S.px; C.y = S.py; CF.x = S.px; CF.y = S.py; cursor.classList.add('is-on'); }
    }, { passive: true });
    document.addEventListener('pointerleave', () => cursor.classList.remove('is-on'));
    document.addEventListener('pointerenter', () => { if (S.hasPointer) cursor.classList.add('is-on'); });
    document.addEventListener('pointerover', (e) => {
      const t = e.target.closest && e.target.closest('a, button, input, textarea, label');
      C.ts = t ? (t.matches('input, textarea, label') ? 0.4 : 2.1) : 1;
    }, { passive: true });

    $$('.cats__row').forEach((row) => {
      row.addEventListener('pointerenter', () => {
        const i = +row.dataset.cat;
        CF.imgs.forEach((im, k) => im.classList.toggle('is-on', k === i));
        if (!CF.on) { CF.x = S.px; CF.y = S.py; }
        CF.on = true; catfloat.classList.add('is-on');
      });
    });
    $('.cats__list').addEventListener('pointerleave', () => { CF.on = false; catfloat.classList.remove('is-on'); });

    V.track.addEventListener('pointermove', (e) => {
      if (V.noPin) return;
      const el = e.target.closest('.card');
      const c = el && V.cards.find((k) => k.el === el);
      if (tiltActive && tiltActive !== c) { tiltActive.trx = 0; tiltActive.try_ = 0; }
      tiltActive = c || null;
      if (!c || el.classList.contains('card--end')) return;
      const r = el.getBoundingClientRect();
      const fx = (e.clientX - r.left) / r.width - 0.5, fy = (e.clientY - r.top) / r.height - 0.5;
      c.try_ = fx * 9; c.trx = -fy * 7;
    }, { passive: true });
    V.track.addEventListener('pointerleave', () => { if (tiltActive) { tiltActive.trx = 0; tiltActive.try_ = 0; tiltActive = null; } });
  }

  /* ---------------------------------------------------------- главный цикл */
  let last = performance.now(), lastY = window.scrollY, curTheme = 'dark', scrolled = false;
  S.y = S.sy = lastY;

  function loop(now) {
    requestAnimationFrame(loop);
    const rawMs = now - last;
    last = now;
    const dt = clamp(rawMs / 1000, 0.001, 0.05);      /* dt зажат: возврат во вкладку не телепортирует */

    Loader.tick(now, dt);
    Drape.frame(rawMs);

    /* единая шкала скролла */
    S.y = window.scrollY;
    S.sy = RM ? S.y : lerp(S.sy, S.y, dampK(10, dt));
    if (Math.abs(S.sy - S.y) < 0.05) S.sy = S.y;
    const rawVel = (S.y - lastY) / dt;
    lastY = S.y;
    S.vel = lerp(S.vel, rawVel, dampK(7, dt));

    /* шапка: чернила под секцию */
    let theme = 'dark';
    for (let i = 0; i < themeTops.length; i++) { if (themeTops[i].top <= S.y + 36) theme = themeTops[i].theme; else break; }
    if (theme !== curTheme) { curTheme = theme; hdr.dataset.theme = theme; }
    const sc = S.y > 30;
    if (sc !== scrolled) { scrolled = sc; hdr.classList.toggle('is-scrolled', sc); }

    /* нить */
    drawThread(S.sy + S.vh * 0.62);

    if (!RM) {
      /* первый экран: лёгкий параллакс и наклон карточки к курсору */
      if (S.sy < S.vh * 1.2) {
        if (S.vw > 900) {
          const ty = `translate3d(0, ${(S.sy * 0.16).toFixed(1)}px, 0)`;
          heroL1.style.transform = ty; heroL2.style.transform = ty;
          heroCard.style.transform = `translate3d(0, ${(-S.sy * 0.14).toFixed(1)}px, 0)`;
        }
        if (FINE && S.hasPointer) {
          const k = dampK(4, dt);
          HC.ry = lerp(HC.ry, (S.px / S.vw - 0.5) * 16, k);
          HC.rx = lerp(HC.rx, -(S.py / S.vh - 0.5) * 11, k);
          heroCardIn.style.transform = `rotateX(${HC.rx.toFixed(2)}deg) rotateY(${HC.ry.toFixed(2)}deg)`;
        }
      }

      /* витрина: вертикальный скролл двигает ленту вбок */
      if (!V.noPin && V.max > 0) {
        const p = clamp((S.sy - V.top) / V.max, 0, 1);
        const x = -p * V.max;
        if (V.lastX === null || Math.abs(x - V.lastX) > 0.05) {
          V.lastX = x;
          V.track.style.transform = `translate3d(${x.toFixed(2)}px, 0, 0)`;
          V.bar.style.transform = `scaleX(${p.toFixed(4)})`;
          const n = String(Math.round(p * (V.count - 1)) + 1).padStart(2, '0');
          if (V.now.textContent !== n) V.now.textContent = n;
          for (const c of V.cards) {
            if (!c.img) continue;
            const cx = c.left + c.w / 2 + x;
            if (cx < -c.w || cx > S.vw + c.w) continue;
            const rel = (cx - S.vw / 2) / S.vw;                    /* -0.5 … 0.5 по экрану */
            c.img.style.transform = `translate3d(${(-rel * 14).toFixed(2)}%, 0, 0)`;
          }
        }
        const kt = dampK(8, dt);
        for (const c of V.cards) {
          if (Math.abs(c.trx - c.rx) < 0.01 && Math.abs(c.try_ - c.ry) < 0.01) continue;
          c.rx = lerp(c.rx, c.trx, kt); c.ry = lerp(c.ry, c.try_, kt);
          if (c.tilt) c.tilt.style.transform = `rotateX(${c.rx.toFixed(2)}deg) rotateY(${c.ry.toFixed(2)}deg)`;
        }
      }

      /* процесс: активный шаг – тот, чей центр ближе к центру экрана */
      if (S.vw > 900 && P.mids.length) {
        const mid = S.y + S.vh * 0.5;
        let best = 0, bd = Infinity;
        for (let i = 0; i < P.mids.length; i++) { const dd = Math.abs(P.mids[i] - mid); if (dd < bd) { bd = dd; best = i; } }
        if (best !== P.active) {
          P.active = best;
          P.steps.forEach((el, i) => el.classList.toggle('is-on', i === best));
          P.imgs.forEach((el, i) => el.classList.toggle('is-on', i === best));
          P.now.textContent = String(best + 1).padStart(2, '0');
        }
      }

      /* цитата: слова разгораются по скроллу */
      if (words.length && S.sy + S.vh > Q.top - 200 && S.sy < Q.top + Q.h + 200) {
        const p = clamp((S.sy + S.vh * 0.82 - Q.top) / (Q.h + S.vh * 0.32), 0, 1);
        const head = p * (words.length + 5);
        for (let i = 0; i < words.length; i++) {
          const o = Math.round(clamp((head - i) / 5, 0, 1) * 40) / 40;
          if (o !== words[i].o) { words[i].o = o; words[i].el.style.opacity = (0.2 + 0.8 * o).toFixed(3); }
        }
      }

      /* бегущая строка: скорость и направление от скорости скролла */
      if (M.visible && M.w > 0) {
        if (Math.abs(S.vel) > 40) M.dir = S.vel > 0 ? 1 : -1;
        const speed = 70 + clamp(Math.abs(S.vel) * 0.45, 0, 2400);
        M.x -= speed * M.dir * dt;
        if (M.x <= -M.w) M.x += M.w; else if (M.x > 0) M.x -= M.w;
        M.track.style.transform = `translate3d(${M.x.toFixed(2)}px, 0, 0)`;
      }

      /* курсор и плавающее фото */
      if (FINE && S.hasPointer) {
        const kc = dampK(22, dt);
        C.x = lerp(C.x, S.px, kc); C.y = lerp(C.y, S.py, kc); C.s = lerp(C.s, C.ts, dampK(12, dt));
        cursor.style.transform = `translate3d(${C.x.toFixed(1)}px, ${C.y.toFixed(1)}px, 0) scale(${C.s.toFixed(3)})`;
        if (CF.on || Math.abs(CF.r) > 0.05) {
          const kf = dampK(7, dt);
          const nx = lerp(CF.x, S.px, kf);
          CF.r = lerp(CF.r, clamp((nx - CF.x) * 0.9, -12, 12), dampK(6, dt));
          CF.x = nx; CF.y = lerp(CF.y, S.py, kf);
          const w = catfloat.offsetWidth, h = catfloat.offsetHeight;
          const fx = clamp(CF.x + 36, 8, S.vw - w - 8), fy = clamp(CF.y - h * 0.55, 8, S.vh - h - 8);
          catfloat.style.transform = `translate3d(${fx.toFixed(1)}px, ${fy.toFixed(1)}px, 0) rotate(${CF.r.toFixed(2)}deg)`;
        }
      }
    }
  }

  try { measure(true); } catch (err) { console.error(err); }
  requestAnimationFrame(loop);
})();
