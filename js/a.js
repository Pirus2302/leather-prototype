/* Вариант A – «Красивая и современная». Ванильный JS, без сборки */
(function () {
  'use strict';

  var root = document.documentElement;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var reduceMq = window.matchMedia('(prefers-reduced-motion: reduce)');
  var reduced = function () { return reduceMq.matches; };

  /* ---------- 1. Вуаль и появление первого экрана ----------
     Вуаль без счётчика (ничего не измеряем – ничего не показываем).
     Контент стоит на месте в скрытом состоянии и начинает появляться
     в момент СТАРТА ухода вуали, сквозь неё */
  var readyDone = false;
  function ready() {
    if (readyDone) return;
    readyDone = true;
    root.classList.add('is-ready');
    mountFabricSoon();
  }
  var minVisible = new Promise(function (r) { setTimeout(r, reduced() ? 0 : 320); });
  var fontsReady = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
  Promise.all([minVisible, fontsReady]).then(ready);
  setTimeout(ready, 1400); /* жёсткий потолок: вуаль не может запереть посетителя */

  /* ---------- 2. Шапка ---------- */
  var head = $('.head');
  function onScrollHead() { head.classList.toggle('is-scrolled', window.scrollY > 24); }
  onScrollHead();
  window.addEventListener('scroll', onScrollHead, { passive: true });

  /* ---------- 3. Бургер и полноэкранное меню ---------- */
  var burger = $('[data-burger]');
  var menu = $('[data-menu]');
  function setMenu(open) {
    menu.classList.toggle('is-open', open);
    head.classList.toggle('is-menu', open);
    document.body.classList.toggle('is-locked', open);
    burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    burger.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
    if (open) {
      var first = $('a', menu);
      if (first) setTimeout(function () { first.focus({ preventScroll: true }); }, 60);
    }
  }
  burger.addEventListener('click', function () { setMenu(!menu.classList.contains('is-open')); });
  $$('a', menu).forEach(function (a) { a.addEventListener('click', function () { setMenu(false); }); });
  document.addEventListener('keydown', function (e) {
    if (!menu.classList.contains('is-open')) return;
    if (e.key === 'Escape') { setMenu(false); burger.focus(); return; }
    if (e.key === 'Tab') {
      var items = [burger].concat($$('a', menu));
      var i = items.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); items[items.length - 1].focus(); }
      else if (!e.shiftKey && i === items.length - 1) { e.preventDefault(); items[0].focus(); }
    }
  });
  window.matchMedia('(min-width: 1181px)').addEventListener('change', function (e) { if (e.matches) setMenu(false); });

  /* ---------- 4. Появление секций: один раз, по входу во вьюпорт ---------- */
  var revealEls = $$('[data-reveal]');
  if ('IntersectionObserver' in window && !reduced()) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.add('is-in');
        io.unobserve(en.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('is-in'); });
  }

  /* ---------- 5. Лёгкий параллакс у нескольких фото ---------- */
  var plx = $$('[data-parallax]').map(function (img) {
    return { img: img, box: img.parentElement, k: parseFloat(img.getAttribute('data-parallax')) || 0.06 };
  });
  var plxQueued = false;
  var wideMq = window.matchMedia('(min-width: 861px)');
  function plxFrame() {
    plxQueued = false;
    var vh = window.innerHeight;
    var on = wideMq.matches && !reduced();
    plx.forEach(function (p) {
      if (!on) { p.img.style.transform = ''; return; }
      var r = p.box.getBoundingClientRect();
      if (r.bottom < -200 || r.top > vh + 200) return;
      var d = (r.top + r.height / 2) - vh / 2;
      var lim = r.height * 0.05;
      var y = Math.max(-lim, Math.min(lim, -d * p.k));
      p.img.style.transform = 'translate3d(0,' + y.toFixed(1) + 'px,0)';
    });
  }
  function plxQueue() { if (!plxQueued) { plxQueued = true; requestAnimationFrame(plxFrame); } }
  if (plx.length) {
    window.addEventListener('scroll', plxQueue, { passive: true });
    window.addEventListener('resize', plxQueue, { passive: true });
    plxQueue();
  }

  /* ---------- 6. Фильтр витрины ---------- */
  var grid = $('[data-grid]');
  var tabs = $$('[data-filter]');
  var cards = $$('.card', grid);
  var countEl = $('[data-shop-count]');
  var wordEl = $('[data-shop-word]');
  function plural(n) {
    var a = n % 10, b = n % 100;
    if (a === 1 && b !== 11) return 'изделие';
    if (a >= 2 && a <= 4 && (b < 12 || b > 14)) return 'изделия';
    return 'изделий';
  }
  function layoutCards() {
    var i = 0;
    cards.forEach(function (c) {
      if (c.hidden) { c.classList.remove('is-drop'); return; }
      c.classList.toggle('is-drop', i % 4 === 1 || i % 4 === 3); /* журнальная лесенка: 2-я и 4-я колонки ниже */
      i++;
    });
    countEl.textContent = String(i);
    wordEl.textContent = plural(i);
  }
  function applyFilter(f) {
    tabs.forEach(function (t) {
      var act = t.getAttribute('data-filter') === f;
      t.classList.toggle('is-active', act);
      t.setAttribute('aria-pressed', act ? 'true' : 'false');
    });
    cards.forEach(function (c) {
      c.hidden = !(f === 'all' || c.getAttribute('data-status') === f);
      if (!c.hidden) c.classList.add('is-in');
    });
    layoutCards();
  }
  var switchTimer = 0;
  function setFilter(f, instant) {
    clearTimeout(switchTimer);
    if (instant || reduced()) { applyFilter(f); return; }
    grid.classList.add('is-switching');
    switchTimer = setTimeout(function () {
      applyFilter(f);
      grid.classList.remove('is-switching');
    }, 280);
  }
  tabs.forEach(function (t) {
    t.addEventListener('click', function () { setFilter(t.getAttribute('data-filter')); });
  });
  $$('[data-filter-link]').forEach(function (a) {
    a.addEventListener('click', function () { setFilter(a.getAttribute('data-filter-link'), true); });
  });
  layoutCards();

  /* ---------- 7. Корзина и «Заказать» ---------- */
  var cartBtn = $('[data-cart]');
  var cartCount = $('[data-cart-count]');
  var toast = $('[data-toast]');
  var inCart = 0;
  var toastTimer = 0;
  function say(text) {
    toast.textContent = text;
    toast.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove('is-on'); }, 2600);
  }
  $$('[data-add]').forEach(function (b) {
    var label = b.textContent;
    b.addEventListener('click', function () {
      inCart++;
      cartCount.textContent = String(inCart);
      cartBtn.setAttribute('aria-label', 'Корзина, товаров: ' + inCart);
      cartBtn.classList.add('has-items');
      cartBtn.classList.remove('is-bump');
      void cartBtn.offsetWidth;
      cartBtn.classList.add('is-bump');
      b.textContent = 'Добавлено';
      b.classList.add('is-done');
      setTimeout(function () { b.textContent = label; b.classList.remove('is-done'); }, 1600);
      say(b.getAttribute('data-add') + ' – в корзине');
    });
  });
  cartBtn.addEventListener('click', function () {
    say(inCart ? 'В корзине: ' + inCart + '. Оставьте заявку – мастер свяжется с вами' : 'Корзина пока пустая');
  });

  var wish = $('[data-wish]');
  $$('[data-order]').forEach(function (b) {
    b.addEventListener('click', function () {
      var name = b.getAttribute('data-order');
      var line = 'Хочу заказать: ' + name;
      if (wish && wish.value.indexOf(name) === -1) wish.value = wish.value ? wish.value + '\n' + line : line;
      var target = $('#order');
      target.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
      say(name + ' – добавили в заявку');
    });
  });

  /* ---------- 8. Форма заявки (без реальной отправки) ---------- */
  var form = $('[data-form]');
  var formDone = $('[data-form-done]');
  var formErr = $('[data-form-error]');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var ok = true;
      $$('[required]', form).forEach(function (inp) {
        var bad = !inp.value.trim();
        inp.closest('.field').classList.toggle('is-error', bad);
        inp.setAttribute('aria-invalid', bad ? 'true' : 'false');
        if (bad && ok) { inp.focus(); ok = false; }
      });
      formErr.hidden = ok;
      if (!ok) return;
      form.hidden = true;
      formDone.hidden = false;
      formDone.setAttribute('tabindex', '-1');
      formDone.focus({ preventScroll: true });
    });
  }

  /* ---------- 9. Живая фактура под первым экраном ----------
     GetLayers · gradient «charmeuse» (materialize, target: other).
     Шейдер вставлен дословно. Цвет меняется ТОЛЬКО через CONFIG.
     Адаптация под страницу: холст меряется по своему контейнеру, а не по окну;
     ленивый запуск после первого экрана; цикл останавливается вне вьюпорта,
     в фоновой вкладке и при prefers-reduced-motion (остаётся один статичный кадр) */
  var CONFIG = {
    bgColor:  '#f4eee4',   /* слоновая кость – фон страницы */
    colorA:   '#f2eadf',
    colorB:   '#ebdfcd',
    colorC:   '#e2cdb2',   /* разбелённый коньяк */
    colorD:   '#cfa27c',   /* коньяк, сильно разбелённый: только на гребне блика */

    scale:            1.05,
    speed:            0.33,
    flow:             0.55,
    tilt:             0.78,
    curl:             0.34,
    curlScale:        0.90,
    streak:           2.40,
    dyeScale:         1.70,
    fine:             0.42,

    horizon:          0.02,
    spread:           2.20,
    lightCurve:       1.25,
    amount:           0.36,
    contrast:         1.00,
    midpoint:         0.38,
    sink:             0.12,
    glow:             0.06,

    grain:            0,
    grainAnim:        0,
    dither:           1.30,
    vignette:         0.05,
    cursor:           1,

    pointerRadius:    0.75,
    pointerSwirl:     1.30,
    pointerLift:      0.15,
    pointerSmear:     1.60,
    trailStretch:     9.00,
    parallax:         0.0042,

    maxDpr:           1.0
  };

  var VERT = `#version 300 es
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

  var FRAG = `#version 300 es
precision highp float;
out vec4 fragColor;

uniform vec2  iResolution;
uniform float iTime;
uniform vec2  iMouse;          // smoothed pointer, aspect-corrected units (same space as uv)
uniform vec2  iTrail;          // slower follower — (iMouse - iTrail) is the inertia vector

uniform vec3  uBg, uColorA, uColorB, uColorC, uColorD;
uniform float uScale, uSpeed, uFlow, uTilt, uCurl, uCurlScale, uStreak, uDyeScale;
uniform float uFine, uHorizon, uSpread, uLightCurve, uAmount, uContrast, uMidpoint, uSink, uGlow;
uniform float uGrain, uDither, uVignette;
uniform float uPointerRadius, uPointerSwirl, uPointerLift, uPointerSmear, uTrailStretch, uParallax;

#define STEPS 6

// sin-free hash. The house hash costs two sin() per call and this shader calls it 3× per
// noise tap × every march tap — the trig alone put the mobile tier under the fps floor.
vec2 hash2(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return -1.0 + 2.0 * fract((p3.xx + p3.yz) * p3.zy);
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

// the field the fibres are combed along — analytic, so a march step costs no noise
float flowAngle(vec2 q, float t, vec2 mp, float rp) {
  vec2 dm = q - mp;
  float g = max(0.0, 1.0 - dot(dm, dm) / rp);       // compact-support bump: a gaussian's tail is
  g *= g;                                           // invisible here and exp() is not free at 12 taps
  return uTilt
       + uCurl * sin(q.x * uCurlScale - q.y * uCurlScale * 0.64 + t * 1.10)
       + uPointerSwirl * g;                         // the cursor combs the grain into a whorl
}

// the dye that gets smeared along the flow
float dye(vec2 q, float t) {
  return snoise(q * uDyeScale + vec2(t * 0.17, -t * 0.11));
}

vec3 ramp4(float t) {
  vec3 c = mix(uColorA, uColorB, smoothstep(0.00, 0.36, t));
  c = mix(c, uColorC, smoothstep(0.32, 0.70, t));
  c = mix(c, uColorD, smoothstep(0.66, 1.00, t));
  return c;
}

// triangular-PDF dither — the only reliable cure for 8-bit gradient banding
float triDither(vec2 fc) {
  float a = fract(sin(dot(fc, vec2(12.9898, 78.233))) * 43758.5453);
  float b = fract(sin(dot(fc + 17.0, vec2(12.9898, 78.233))) * 43758.5453);
  return (a + b - 1.0) / 255.0;
}

// ---- house grain. ONE look across the collection: an integer hash (no sin() streaks),
// triangular so it reads as film rather than static, weighted into the midtones so it
// never crusts a black or a white. Static by default; uGrainAnim re-seeds it 24×/s.
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
  float tf = t * uFlow * 6.0;                       // the combing field runs on its own clock

  // ---- pointer: a resting bump, plus a comet stretched along the direction of travel
  vec2  d  = uv - iMouse;
  float rr = max(1e-4, uPointerRadius * uPointerRadius);
  float near = exp(-dot(d, d) / rr);

  vec2  vel  = iMouse - iTrail;                     // inertia vector — collapses to zero at rest
  float vlen = length(vel);
  vec2  vdir = vlen > 1e-5 ? vel / vlen : vec2(1.0, 0.0);   // guarded: never normalize() a vector that can be zero
  vec2  dc   = uv - mix(iMouse, iTrail, 0.5);       // the comet spans pointer -> where it came from
  vec2  dw   = vec2(dot(dc, vdir), dot(dc, vec2(-vdir.y, vdir.x)));
  dw.x /= 1.0 + vlen * uTrailStretch;               // elongates with speed, relaxes to a disc when still
  float comet = exp(-dot(dw, dw) / rr);

  // ---- march space
  vec2 p  = (uv - iMouse * uParallax) * uScale;
  vec2 mp = iMouse * (1.0 - uParallax) * uScale;
  float rp = rr * uScale * uScale;

  // ---- line-integral convolution: comb the dye along the flow, both ways from here
  float len = uStreak * (1.0 + comet * uPointerSmear);   // the cursor drags longer fibres
  float stepLen = len / float(STEPS);
  vec2 sa = p, sb = p;
  float acc = 0.0, wsum = 0.0;
  for (int i = 0; i < STEPS; i++) {
    float fi = (float(i) + 0.5) / float(STEPS);
    float w = 1.0 - fi * fi; w *= w;                // window that reaches zero smoothly — a window with
                                                    // weight left at the last tap gives every fibre a hard tip
    acc  += w * (dye(sa, t) + dye(sb, t));
    wsum += 2.0 * w;
    float aa = flowAngle(sa, tf, mp, rp);
    float ab = flowAngle(sb, tf, mp, rp);
    sa += vec2(cos(aa), sin(aa)) * stepLen;
    sb -= vec2(cos(ab), sin(ab)) * stepLen;
  }
  float lic = acc / wsum * 1.55;                    // averaging along the line eats amplitude; put it back

  /* ---- fine filaments, two taps instead of a longer march. Rotating into the local flow
          frame and then squashing one axis of the sample coordinate makes ordinary noise
          come out as long thin fibres — and because the frame is the flow's, they turn
          inside the pointer's whorl exactly like the marched ribbons do. ---- */
  float a0 = flowAngle(p, tf, mp, rp);
  float c0 = cos(a0), s0 = sin(a0);
  vec2 pf = vec2(p.x * c0 + p.y * s0, -p.x * s0 + p.y * c0);
  float fine = snoise(vec2(pf.x * 0.30, pf.y * 4.20) + vec2(t * 0.06, 0.0)) * 0.62
             + snoise(vec2(pf.x * 0.46, pf.y * 8.10) + vec2(9.1, 3.7)) * 0.30;

  // ---- broad tonal drift, once (not per step)
  float broad = snoise(p * 0.55 + vec2(t * 0.09, -t * 0.07));

  // ---- light axis: a soft ridge of sheen laid across the grain. The fibres only perturb it,
  //      so the composition stays a ribbon between two calm fields instead of a half-and-half ramp.
  float axis = dot(uv, vec2(-sin(uTilt), cos(uTilt)));
  float s = (axis - uHorizon) * uSpread;
  float alt = pow(exp(-s * s), max(0.05, uLightCurve)) * 0.74;   // 0.74: the ridge crest stops short of
                                                                 // the top stop, so the accent never plateaus

  float f = alt + (lic + fine * uFine + broad * 0.30) * uAmount;
  f += (near * 0.45 + comet * 0.55) * uPointerLift; // the sheen breathes where the cursor rests
  // levels, pivoted on the midpoint rather than on 0.5 — this field rests near zero,
  // and the template's recentring would drag the whole calm field into mid-ramp
  f = clamp((f - uMidpoint) * uContrast + uMidpoint, 0.0, 1.0);

  vec3 col = ramp4(f);
  col += uColorD * uGlow * pow(f, 5.0);
  col = mix(uBg, col, smoothstep(0.0, max(0.01, uSink), f) * 0.90 + 0.10);

  col *= 1.0 - uVignette * dot(uv, uv);
  { float hgL = clamp(dot(col, vec3(0.299, 0.587, 0.114)), 0.0, 1.0);
    col += houseGrain(gl_FragCoord.xy) * uGrain * mix(1.0, 4.0 * hgL * (1.0 - hgL), 0.6); }
  col += triDither(gl_FragCoord.xy) * uDither;

  fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

  var fabricMounted = false;
  function mountFabricSoon() {
    var idle = window.requestIdleCallback || function (cb) { return setTimeout(cb, 200); };
    idle(function () { try { mountFabric(); } catch (err) { /* без WebGL2 остаётся ровный фон */ } });
  }

  function mountFabric() {
    if (fabricMounted) return;
    var canvas = $('[data-fabric]');
    if (!canvas) return;
    var host = canvas.parentElement;
    var gl = canvas.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' });
    if (!gl) return;
    fabricMounted = true;

    function hexToVec3(hex) {
      var n = parseInt(hex.slice(1), 16);
      return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
    }
    function compile(type, src) {
      var sh = gl.createShader(type);
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
      return sh;
    }
    var program = gl.createProgram();
    gl.attachShader(program, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);
    gl.bindVertexArray(gl.createVertexArray());

    var LOC = {};
    var loc = function (n) { return (n in LOC) ? LOC[n] : (LOC[n] = gl.getUniformLocation(program, n)); };
    var u1f = function (n, v) { gl.uniform1f(loc(n), v); };
    var u2f = function (n, x, y) { gl.uniform2f(loc(n), x, y); };
    var u3c = function (n, hex) { var c = hexToVec3(hex); gl.uniform3f(loc(n), c[0], c[1], c[2]); };

    var cw = 1, ch = 1;
    function resize() {
      var dpr = Math.min(window.devicePixelRatio || 1, CONFIG.maxDpr);
      cw = Math.max(1, host.clientWidth); ch = Math.max(1, host.clientHeight);
      var w = Math.max(1, Math.round(cw * dpr));
      var h = Math.max(1, Math.round(ch * dpr));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      gl.viewport(0, 0, w, h);
      u2f('iResolution', w, h);
    }
    function applyConfig() {
      u3c('uBg', CONFIG.bgColor);
      u3c('uColorA', CONFIG.colorA);
      u3c('uColorB', CONFIG.colorB);
      u3c('uColorC', CONFIG.colorC);
      u3c('uColorD', CONFIG.colorD);
      u1f('uScale', CONFIG.scale);
      u1f('uSpeed', CONFIG.speed);
      u1f('uFlow', CONFIG.flow);
      u1f('uTilt', CONFIG.tilt);
      u1f('uCurl', CONFIG.curl);
      u1f('uCurlScale', CONFIG.curlScale);
      u1f('uStreak', CONFIG.streak);
      u1f('uDyeScale', CONFIG.dyeScale);
      u1f('uFine', CONFIG.fine);
      u1f('uHorizon', CONFIG.horizon);
      u1f('uSpread', CONFIG.spread);
      u1f('uLightCurve', CONFIG.lightCurve);
      u1f('uAmount', CONFIG.amount);
      u1f('uContrast', CONFIG.contrast);
      u1f('uMidpoint', CONFIG.midpoint);
      u1f('uSink', CONFIG.sink);
      u1f('uGlow', CONFIG.glow);
      u1f('uGrain', CONFIG.grain);
      u1f('uGrainAnim', CONFIG.grainAnim);
      u1f('uDither', CONFIG.dither);
      u1f('uVignette', CONFIG.vignette);
      u1f('uPointerRadius', CONFIG.pointerRadius);
      u1f('uPointerSwirl', CONFIG.pointerSwirl);
      u1f('uPointerLift', CONFIG.pointerLift);
      u1f('uPointerSmear', CONFIG.pointerSmear);
      u1f('uTrailStretch', CONFIG.trailStretch);
      u1f('uParallax', CONFIG.parallax);
      resize();
    }

    /* указатель: координаты в пространстве холста, а не окна */
    var mouse = { x: 0.35, y: 0.1, ax: 0.35, ay: 0.1, tx: 0.35, ty: 0.1, lx: 0.35, ly: 0.1 };
    function aim(e) {
      if (!CONFIG.cursor || reduced()) return;
      var r = host.getBoundingClientRect();
      if (!r.width || !r.height) return;
      var a = r.width / r.height;
      mouse.tx = ((e.clientX - r.left) / r.width - 0.5) * a;
      mouse.ty = 0.5 - (e.clientY - r.top) / r.height;
    }
    window.addEventListener('pointermove', aim, { passive: true });
    window.addEventListener('pointerdown', aim, { passive: true });

    var resizeQueued = false;
    window.addEventListener('resize', function () {
      if (resizeQueued) return;
      resizeQueued = true;
      requestAnimationFrame(function () { resizeQueued = false; resize(); if (!running) drawStill(); });
    }, { passive: true });

    var visible = true, running = false, rafId = 0;
    var prevT = 0, clock = 7.0;

    function draw() {
      u1f('iTime', clock);
      u2f('iMouse', mouse.x, mouse.y);
      u2f('iTrail', mouse.lx, mouse.ly);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    function drawStill() { draw(); }

    function frame(now) {
      if (!running) return;
      rafId = requestAnimationFrame(frame);
      var raw = now - prevT;
      prevT = now;
      var ms = raw > 50 ? 50 : raw < 4.167 ? 4.167 : raw;
      var s = ms > 36.7 ? 2.2 : ms * 0.06;
      clock += ms * 0.001;
      var kLead = 0.130 * s, kBody = 0.055 * s, kTrail = 0.017 * s;
      mouse.ax += (mouse.tx - mouse.ax) * kLead;
      mouse.ay += (mouse.ty - mouse.ay) * kLead;
      mouse.x  += (mouse.ax - mouse.x)  * kBody;
      mouse.y  += (mouse.ay - mouse.y)  * kBody;
      mouse.lx += (mouse.x - mouse.lx)  * kTrail;
      mouse.ly += (mouse.y - mouse.ly)  * kTrail;
      draw();
    }
    function sync() {
      var should = visible && !document.hidden && !reduced();
      if (should && !running) { running = true; prevT = performance.now(); rafId = requestAnimationFrame(frame); }
      else if (!should && running) { running = false; cancelAnimationFrame(rafId); }
    }

    applyConfig();
    draw(); /* первый кадр нарисован – только теперь проявляем холст */
    host.classList.add('is-live');

    new IntersectionObserver(function (es) { visible = es[0].isIntersecting; sync(); }, { threshold: 0 }).observe(host);
    document.addEventListener('visibilitychange', sync);
    if (reduceMq.addEventListener) reduceMq.addEventListener('change', function () { sync(); if (!running) drawStill(); });
    sync();
  }
})();
