/* Вариант B – логика: каталог с фильтрами, корзина, конструктор, форма, движение, шейдер */
(function () {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const root = document.documentElement;
  const reduceMq = window.matchMedia('(prefers-reduced-motion: reduce)');
  const reduced = () => reduceMq.matches;

  // Сборка DOM без строковой разметки: пользовательский текст (гравировка) никогда не попадает в HTML-парсер
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    if (attrs) {
      Object.entries(attrs).forEach(([k, v]) => {
        if (v === false || v == null) return;
        if (k === 'class') el.className = v;
        else if (k === 'text') el.textContent = v;
        else el.setAttribute(k, v === true ? '' : String(v));
      });
    }
    kids.flat().forEach((kid) => { if (kid != null) el.append(kid); });
    return el;
  }

  /* ======================================================================
     Данные (заглушки из брифа)
     ====================================================================== */
  const CATS = { bags: 'Сумки', wallets: 'Кошельки', keys: 'Брелки' };
  const P = (id, name, cat, price, avail, photo, alt) => ({ id, name, cat, price, avail, photo, alt });
  const PRODUCTS = [
    P('tote', 'Тоут «Будни»', 'bags', 420, 'stock', '1624687943971-e86af76d57de', 'Кожаная сумка-тоут'),
    P('wallet-red', 'Кошелёк «Рыжий»', 'wallets', 150, 'stock', '1689844496310-b261f7602bc2', 'Рыжий кожаный кошелёк'),
    P('cube', 'Сумка «Кубик»', 'bags', 310, 'custom', '1713425884561-e3cbb2cfbc78', 'Небольшая кожаная сумка'),
    P('key-loop', 'Брелок-петля', 'keys', 25, 'stock', '1676276550349-580c49631496', 'Кожаный брелок-петля'),
    P('sac', 'Сумка «Саквояж»', 'bags', 560, 'stock', '1691480150204-66dd1eb77391', 'Кожаная сумка-саквояж'),
    P('bifold', 'Бифолд «Классик»', 'wallets', 140, 'stock', '1635100299010-0410d7434a93', 'Кожаный кошелёк-бифолд'),
    P('post', 'Мессенджер «Почтальон»', 'bags', 480, 'custom', '1473188588951-666fce8e7c68', 'Кожаная сумка-мессенджер'),
    P('card-min', 'Картхолдер «Минимум»', 'wallets', 60, 'stock', '1560472355-536de3962603', 'Кожаный картхолдер'),
    P('key-tag', 'Брелок-бирка с гравировкой', 'keys', 30, 'custom', '1676488690948-8020c4851c50', 'Кожаный брелок-бирка'),
    P('boat', 'Кроссбоди «Лодочка»', 'bags', 290, 'stock', '1718622795525-2295971921ba', 'Кожаная сумка кроссбоди'),
    P('bifold-dark', 'Бифолд «Тёмный»', 'wallets', 145, 'custom', '1620109176813-e91290f6c795', 'Тёмный кожаный бифолд'),
    P('city', 'Рюкзак «Город»', 'bags', 520, 'custom', '1622560480605-d83c853bc5c3', 'Кожаный рюкзак'),
    P('cream', 'Кошелёк на кнопке «Крем»', 'wallets', 120, 'custom', '1636023189308-06668418548d', 'Кремовый кошелёк на кнопке'),
    P('home', 'Ключница «Дом»', 'keys', 55, 'stock', '1675582122314-cabef1d757ec', 'Кожаная ключница'),
    P('card-bordo', 'Картхолдер «Бордо»', 'wallets', 65, 'stock', '1512414947060-048d53abb081', 'Бордовый картхолдер'),
  ];
  const byId = Object.fromEntries(PRODUCTS.map((p) => [p.id, p]));
  const img = (id, w, ht) => `https://images.unsplash.com/photo-${id}?w=${w}&h=${ht}&fit=crop&q=75&auto=format`;
  const byn = (n) => `${n} BYN`;
  const plural = (n, one, few, many) => {
    const a = n % 10, b = n % 100;
    if (a === 1 && b !== 11) return one;
    if (a >= 2 && a <= 4 && (b < 12 || b > 14)) return few;
    return many;
  };

  /* ======================================================================
     Каталог + фильтры
     ====================================================================== */
  const grid = $('#grid');
  const foundN = $('#foundN');
  const emptyBox = $('#empty');
  const filter = { cat: 'all', avail: 'all' };

  function buildCard(p) {
    const stock = p.avail === 'stock';
    const label = stock ? 'В корзину' : 'Заказать';
    return h('li', { class: 'card', 'data-id': p.id, 'data-cat': p.cat, 'data-avail': p.avail },
      h('article', { class: 'card__in stitch' },
        h('div', { class: 'card__media' },
          h('img', { src: img(p.photo, 640, 800), alt: p.alt, width: 640, height: 800, loading: 'lazy', decoding: 'async' }),
          h('span', { class: `tag ${stock ? 'tag--stock' : 'tag--custom'}`, text: stock ? 'В наличии' : 'Под заказ' })),
        h('div', { class: 'card__body' },
          h('p', { class: 'card__cat', text: CATS[p.cat] }),
          h('h3', { class: 'card__title', text: p.name }),
          h('div', { class: 'card__foot' },
            h('p', { class: 'card__price' }, h('span', { class: 'price', text: byn(p.price) })),
            h('button', { class: `btn btn--sm ${stock ? 'btn--green' : 'btn--accent'}`, type: 'button', 'data-add': p.id, 'data-label': label,
              'aria-label': `${label}: ${p.name}`, text: label })))));
  }

  // Последняя плитка – приглашение сшить своё: закрывает сетку и не участвует в счётчике
  const promo = h('li', { class: 'card card--promo' },
    h('a', { class: 'card__in stitch', href: '#custom' },
      h('div', null,
        h('span', { class: 'tag tag--on-dark', text: 'Под заказ' }),
        h('p', { class: 'promo__title', style: 'margin-top:18px', text: 'Не нашли своё?' }),
        h('p', { class: 'promo__text', text: 'Сошьём по вашим пожеланиям: другая кожа, другая нить, ваша гравировка' })),
      h('span', { class: 'promo__foot' }, 'Собрать своё изделие', h('span', { class: 'arrowbtn', 'aria-hidden': 'true', text: '→' }))));

  grid.replaceChildren(...PRODUCTS.map(buildCard), promo);
  const cards = $$('.card:not(.card--promo)', grid);

  const match = (el) =>
    (filter.cat === 'all' || el.dataset.cat === filter.cat) &&
    (filter.avail === 'all' || el.dataset.avail === filter.avail);

  function syncChips() {
    $$('[data-filter]').forEach((group) => {
      const key = group.dataset.filter;
      $$('.chip', group).forEach((chip) => {
        const on = chip.dataset.value === filter[key];
        chip.setAttribute('aria-pressed', String(on));
        if (on && group.scrollWidth > group.clientWidth) {
          group.scrollTo({ left: chip.offsetLeft - 40, behavior: reduced() ? 'auto' : 'smooth' });
        }
      });
    });
  }

  function applyFilter(animate = true) {
    syncChips();
    const doAnim = animate && !reduced() && 'animate' in Element.prototype;
    const first = new Map();
    if (doAnim) cards.forEach((c) => { if (!c.hidden) first.set(c, c.getBoundingClientRect()); });

    let n = 0;
    cards.forEach((c) => { const ok = match(c); c.hidden = !ok; if (ok) n += 1; });
    foundN.textContent = String(n);
    emptyBox.hidden = n !== 0;
    grid.hidden = n === 0;

    if (!doAnim) return;
    let k = 0;
    cards.forEach((c) => {
      if (c.hidden) return;
      const last = c.getBoundingClientRect();
      const f = first.get(c);
      if (f) {
        const dx = f.left - last.left, dy = f.top - last.top;
        if (dx || dy) {
          c.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }],
            { duration: 520, easing: 'cubic-bezier(.22,1,.36,1)' });
        }
      } else {
        c.animate([{ opacity: 0, transform: 'scale(.9) translateY(14px)' }, { opacity: 1, transform: 'none' }],
          { duration: 460, delay: Math.min(k, 8) * 35, easing: 'cubic-bezier(.34,1.56,.64,1)', fill: 'backwards' });
        k += 1;
      }
    });
    foundN.animate([{ transform: 'translateY(-40%)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 320, easing: 'cubic-bezier(.22,1,.36,1)' });
  }

  $$('[data-filter]').forEach((group) => {
    group.addEventListener('click', (e) => {
      const chip = e.target.closest('.chip');
      if (!chip) return;
      filter[group.dataset.filter] = chip.dataset.value;
      applyFilter();
    });
  });

  // Ссылки-пути: шапка, бенто, подвал, таб-панель ведут в каталог с уже выставленным фильтром
  document.addEventListener('click', (e) => {
    const go = e.target.closest('[data-go-cat], [data-go-avail], [data-go-reset]');
    if (!go) return;
    if (go.hasAttribute('data-go-reset')) { filter.cat = 'all'; filter.avail = 'all'; }
    if (go.dataset.goCat) { filter.cat = go.dataset.goCat; filter.avail = 'all'; }
    if (go.dataset.goAvail) { filter.avail = go.dataset.goAvail; filter.cat = 'all'; }
    revealAllCards();
    applyFilter(false);
    if (go.tagName === 'BUTTON') $('#catalog').scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth' });
  });

  // Счётчики в бенто считаются из тех же данных
  $$('[data-count-cat]').forEach((el) => { el.textContent = PRODUCTS.filter((p) => p.cat === el.dataset.countCat).length; });
  $$('[data-count-avail]').forEach((el) => {
    const n = PRODUCTS.filter((p) => p.avail === el.dataset.countAvail).length;
    el.textContent = `${n} ${plural(n, 'изделие', 'изделия', 'изделий')}`;
  });

  /* ======================================================================
     Корзина
     ====================================================================== */
  const cart = new Map();
  const cartBox = $('#cart'), cartBtn = $('#cartBtn'), tabCart = $('#tabCart');
  const cartList = $('#cartList'), cartEmpty = $('#cartEmpty'), cartFoot = $('#cartFoot'), cartTotal = $('#cartTotal');
  let cartOpener = null;

  function cartCount() { let n = 0; cart.forEach((q) => { n += q; }); return n; }

  function renderCart(bump) {
    const n = cartCount();
    $$('[data-cart-count]').forEach((el) => {
      el.textContent = String(n);
      el.toggleAttribute('data-empty', n === 0);
      if (bump && !reduced()) { el.classList.remove('is-bump'); void el.offsetWidth; el.classList.add('is-bump'); }
    });
    $('[data-cart-sr]').textContent = `В корзине ${n} ${plural(n, 'изделие', 'изделия', 'изделий')}`;
    let total = 0;
    cartList.replaceChildren(...Array.from(cart.entries()).map(([id, q]) => {
      const p = byId[id]; total += p.price * q;
      return h('li', { class: 'cart__item' },
        h('img', { src: img(p.photo, 160, 184), alt: '', width: 56, height: 64, loading: 'lazy' }),
        h('div', null,
          h('p', { class: 'cart__name', text: p.name }),
          h('p', { class: 'cart__meta', text: p.avail === 'stock' ? 'В наличии' : 'Под заказ, 7–14 дней' })),
        h('div', { class: 'cart__side' },
          h('span', { class: 'cart__price num', text: byn(p.price * q) }),
          h('span', { class: 'qty' },
            h('button', { type: 'button', 'data-qty': -1, 'data-id': id, 'aria-label': `Убрать одно: ${p.name}`, text: '−' }),
            h('span', { class: 'num', text: String(q) }),
            h('button', { type: 'button', 'data-qty': 1, 'data-id': id, 'aria-label': `Добавить одно: ${p.name}`, text: '+' }))));
    }));
    cartTotal.textContent = byn(total);
    cartEmpty.hidden = n > 0;
    cartFoot.hidden = n === 0;
  }

  function openCart(opener) {
    cartOpener = opener || cartBtn;
    cartBox.hidden = false;
    cartBtn.setAttribute('aria-expanded', 'true');
    tabCart.classList.add('is-active');
    closeNav();
    const f = $('button, a', cartBox); if (f) f.focus({ preventScroll: true });
  }
  function closeCart(returnFocus) {
    if (cartBox.hidden) return;
    cartBox.hidden = true;
    cartBtn.setAttribute('aria-expanded', 'false');
    tabCart.classList.remove('is-active');
    if (returnFocus && cartOpener) cartOpener.focus({ preventScroll: true });
  }
  cartBtn.addEventListener('click', () => (cartBox.hidden ? openCart(cartBtn) : closeCart(true)));
  tabCart.addEventListener('click', () => (cartBox.hidden ? openCart(tabCart) : closeCart(true)));
  cartBox.addEventListener('click', (e) => {
    if (e.target.closest('[data-cart-close]')) { closeCart(!e.target.closest('a')); return; }
    const q = e.target.closest('[data-qty]');
    if (q) {
      const id = q.dataset.id, next = (cart.get(id) || 0) + Number(q.dataset.qty);
      if (next <= 0) cart.delete(id); else cart.set(id, next);
      renderCart(true);
      const again = $(`[data-qty="${q.dataset.qty}"][data-id="${id}"]`, cartBox) || $('button, a', cartBox);
      if (again) again.focus({ preventScroll: true });
    }
  });
  document.addEventListener('click', (e) => {
    if (cartBox.hidden) return;
    if (!e.target.isConnected || e.target.closest('#cart, #cartBtn, #tabCart, [data-add]')) return;
    closeCart(false);
  });

  grid.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-add]');
    if (!btn) return;
    const id = btn.dataset.add;
    cart.set(id, (cart.get(id) || 0) + 1);
    renderCart(true);
    btn.classList.add('is-done');
    btn.textContent = 'Добавлено ✓';
    clearTimeout(btn._t);
    btn._t = setTimeout(() => { btn.classList.remove('is-done'); btn.textContent = btn.dataset.label; }, 1100);
  });

  $('#cartOrder').addEventListener('click', () => {
    const lines = Array.from(cart.entries()).map(([id, q]) => `${byId[id].name} – ${q} шт.`);
    setAuto('cart', `Хочу заказать: ${lines.join(', ')}`, 'Состав корзины добавлен в заявку');
    closeCart(false);
    goToForm();
  });

  /* ======================================================================
     Форма заявки
     ====================================================================== */
  const form = $('#orderForm'), wish = $('#fWish'), hint = $('#formHint'), formError = $('#formError'), formDone = $('#formDone');
  const auto = { cart: '', custom: '' };

  function setAuto(kind, text, note) {
    let v = wish.value;
    if (auto[kind]) v = v.replace(auto[kind], '');
    v = v.replace(/\n{3,}/g, '\n\n').trim();
    auto[kind] = text;
    wish.value = v ? `${v}\n${text}` : text;
    hint.textContent = note;
    hint.hidden = false;
  }

  function goToForm() {
    formDone.hidden = true;
    $('#order').scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
    setTimeout(() => $('#fName').focus({ preventScroll: true }), reduced() ? 0 : 700);
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const need = [$('#fName'), $('#fContact')];
    let bad = null;
    need.forEach((f) => {
      const miss = !f.value.trim();
      f.classList.toggle('is-invalid', miss);
      f.setAttribute('aria-invalid', String(miss));
      if (miss && !bad) bad = f;
    });
    formError.hidden = !bad;
    if (bad) { bad.focus(); return; }
    formDone.hidden = false;
    $('#formAgain').focus({ preventScroll: true });
  });
  form.addEventListener('input', (e) => {
    if (e.target.classList.contains('is-invalid') && e.target.value.trim()) {
      e.target.classList.remove('is-invalid'); e.target.removeAttribute('aria-invalid');
      if (!$('.is-invalid', form)) formError.hidden = true;
    }
  });
  $('#formAgain').addEventListener('click', () => {
    form.reset(); auto.cart = ''; auto.custom = ''; hint.hidden = true; formDone.hidden = true;
    $('#fName').focus({ preventScroll: true });
  });

  /* ======================================================================
     Конструктор «Соберите своё изделие»
     ====================================================================== */
  const LEATHER = {
    cognac: { name: 'коньяк', hex: '#A5602B' }, choco: { name: 'шоколад', hex: '#4A2C1A' }, black: { name: 'чёрный', hex: '#1F1B18' },
    bordo: { name: 'бордо', hex: '#6B1F2A' }, olive: { name: 'оливка', hex: '#5C6138' }, cream: { name: 'крем', hex: '#E3CFAE' },
  };
  const THREAD = {
    cream: { name: 'кремовая', hex: '#F1E6D0' }, mustard: { name: 'горчичная', hex: '#D9A441' },
    terra: { name: 'терракотовая', hex: '#C4582C' }, black: { name: 'чёрная', hex: '#1F1B18' },
  };
  const TYPES = { bag: { name: 'сумка', cat: 'bags' }, wallet: { name: 'кошелёк', cat: 'wallets' }, key: { name: 'брелок', cat: 'keys' } };
  const maker = $('#makerForm'), product = $('#product'), engrave = $('#engrave');
  const state = { type: 'bag', leather: 'cognac', thread: 'cream', text: '' };

  const lum = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
      .map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; })
      .reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
  };
  const chip = (label, value) => h('span', null, h('b', { text: `${label}: ` }), value);

  function renderMaker(changed) {
    const l = LEATHER[state.leather], t = THREAD[state.thread], ty = TYPES[state.type];
    product.style.setProperty('--leather', l.hex);
    product.style.setProperty('--thread', t.hex);
    const dark = lum(l.hex) < 0.09;
    product.style.setProperty('--engrave', dark ? 'rgba(255,255,255,.34)' : 'rgba(0,0,0,.45)');
    product.style.setProperty('--engrave-hi', dark ? 'rgba(0,0,0,.5)' : 'rgba(255,255,255,.2)');

    $$('[data-p]', product).forEach((g) => {
      const on = g.dataset.p === state.type;
      if (on && g.hasAttribute('hidden') && !reduced()) { g.classList.remove('is-enter'); void g.getBoundingClientRect(); g.classList.add('is-enter'); }
      g.toggleAttribute('hidden', !on);
    });
    if (changed === 'thread' && !reduced()) {
      product.classList.remove('is-stitching'); void product.getBoundingClientRect(); product.classList.add('is-stitching');
    }

    // Гравировка: шрифт ужимается, чтобы надпись помещалась на изделии
    const text = state.text.trim().toUpperCase();
    $$('[data-engrave]', product).forEach((el) => {
      el.textContent = text;
      const isKey = el.classList.contains('p-engrave--v');
      const base = isKey ? 15 : 19, fit = isKey ? 5 : 7;
      el.style.fontSize = `${text.length > fit ? Math.max(7.5, (base * fit) / text.length) : base}px`;
    });
    $('#productDesc').textContent = `Превью: ${ty.name}, кожа ${l.name}, нить ${t.name}${text ? `, гравировка «${text}»` : ''}`;

    $('[data-out="leather"]').textContent = l.name;
    $('[data-out="thread"]').textContent = t.name;
    $('#engraveLeft').textContent = String(12 - state.text.length);
    $('#makerSum').replaceChildren(
      chip('Изделие', ty.name), chip('Кожа', l.name), chip('Нить', t.name), chip('Гравировка', text ? `«${text}»` : 'без неё'));
    const min = Math.min(...PRODUCTS.filter((p) => p.cat === ty.cat).map((p) => p.price));
    $('#makerPrice').textContent = `от ${byn(min)}`;
  }

  maker.addEventListener('change', (e) => {
    const { name, value } = e.target;
    if (name === 'type' || name === 'leather' || name === 'thread') { state[name] = value; renderMaker(name); }
  });
  maker.addEventListener('submit', (e) => e.preventDefault());
  engrave.addEventListener('input', () => { state.text = engrave.value.slice(0, 12); renderMaker('text'); });
  $('#makerSend').addEventListener('click', () => {
    const l = LEATHER[state.leather], t = THREAD[state.thread], ty = TYPES[state.type], text = state.text.trim();
    setAuto('custom', `Хочу под заказ: ${ty.name}. Кожа – ${l.name}, нить – ${t.name}, гравировка – ${text ? `«${text}»` : 'не нужна'}`,
      'Параметры из конструктора добавлены в заявку');
    goToForm();
  });
  renderMaker();

  /* ======================================================================
     Шапка, бургер, активные пункты
     ====================================================================== */
  const header = $('#header'), nav = $('#nav'), burger = $('#burger');
  function closeNav() {
    if (!nav.classList.contains('is-open')) return;
    nav.classList.remove('is-open'); document.body.classList.remove('is-locked');
    burger.setAttribute('aria-expanded', 'false'); burger.setAttribute('aria-label', 'Открыть меню');
  }
  burger.addEventListener('click', () => {
    const open = !nav.classList.contains('is-open');
    if (!open) { closeNav(); return; }
    closeCart(false);
    nav.classList.add('is-open'); document.body.classList.add('is-locked');
    burger.setAttribute('aria-expanded', 'true'); burger.setAttribute('aria-label', 'Закрыть меню');
  });
  nav.addEventListener('click', (e) => { if (e.target.closest('a')) closeNav(); });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!cartBox.hidden) closeCart(true); else if (nav.classList.contains('is-open')) { closeNav(); burger.focus(); }
  });
  window.matchMedia('(min-width: 901px)').addEventListener('change', closeNav);

  const onScroll = () => header.classList.toggle('is-stuck', window.scrollY > 8);
  window.addEventListener('scroll', onScroll, { passive: true }); onScroll();

  // Подсветка активного раздела в таб-панели
  if ('IntersectionObserver' in window) {
    const tabs = $$('.tabbar .tab[href]');
    const mark = (id) => tabs.forEach((t) => {
      const own = t.getAttribute('href') === `#${id}`;
      const isStockTab = t.dataset.goAvail === 'stock';
      t.classList.toggle('is-active', own && (id !== 'catalog' || isStockTab === (filter.avail === 'stock')));
    });
    const seen = new IntersectionObserver((es) => es.forEach((en) => { if (en.isIntersecting) mark(en.target.id); }), { rootMargin: '-45% 0px -50% 0px' });
    ['top', 'catalog', 'custom', 'about', 'delivery', 'order'].forEach((id) => { const el = document.getElementById(id); if (el) seen.observe(el); });
  }

  /* ======================================================================
     Движение: сборка бенто, слова заголовка, появление по скроллу, лента
     ====================================================================== */
  $$('[data-split]').forEach((el) => {
    const full = el.textContent.trim();
    const words = full.split(/ +/); // неразрывный пробел перед тире слово не делит
    el.setAttribute('aria-label', full);
    const nodes = [];
    words.forEach((w, i) => {
      if (i) nodes.push(' ');
      nodes.push(h('span', { class: 'w', 'aria-hidden': 'true', style: `--w:${i}`, text: w }));
    });
    el.replaceChildren(...nodes);
  });

  let readyDone = false;
  const ready = () => {
    if (readyDone) return; readyDone = true;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      root.classList.add('is-ready');
      setTimeout(() => root.classList.add('is-settled'), reduced() ? 0 : 1500);
    }));
  };
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(ready);
  setTimeout(ready, 700); // шрифты не должны задерживать первый экран

  cards.forEach((c, i) => { c.classList.add('reveal'); c.style.setProperty('--d', `${(i % 4) * 70}ms`); });
  function revealAllCards() { cards.forEach((c) => { c.classList.remove('reveal', 'is-in'); c.style.removeProperty('--d'); }); }
  [['.trio__item', 90], ['.dcard', 80], ['.step', 60]].forEach(([sel, step]) => $$(sel).forEach((el, i) => el.style.setProperty('--d', `${i * step}ms`)));
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((es) => es.forEach((en) => {
      if (!en.isIntersecting) return;
      en.target.classList.add('is-in'); io.unobserve(en.target);
      // после появления задержка больше не нужна – иначе она мешает hover и фильтрам
      setTimeout(() => { en.target.classList.remove('reveal', 'is-in'); en.target.style.removeProperty('--d'); }, 1600);
    }), { rootMargin: '0px 0px -6% 0px', threshold: 0.06 });
    $$('.reveal').forEach((el) => io.observe(el));
  } else {
    $$('.reveal').forEach((el) => el.classList.remove('reveal'));
  }
  // Любое действие с фильтром сразу проявляет все карточки: скрытая reveal-карточка не должна выпадать из перестроения
  $$('[data-filter]').forEach((g) => g.addEventListener('click', revealAllCards, true));

  // Лента: содержимое дублируется, чтобы цикл был бесшовным
  $$('[data-ribbon]').forEach((track) => {
    const base = Array.from(track.children);
    let reps = 1;
    while (track.scrollWidth < window.innerWidth * 1.2 && reps < 8) { base.forEach((n) => track.append(n.cloneNode(true))); reps += 1; }
    Array.from(track.children).forEach((n) => track.append(n.cloneNode(true)));
  });

  renderCart(false);
  applyFilter(false);

  /* ======================================================================
     GetLayers · gradient «chatoyance» (фон блока-конструктора)
     GLSL не тронут. Цвет – только через CONFIG: ролл 006 (orange/dark) + тёплый тинт под коньяк/терракоту.
     Ленивая инициализация, пауза вне экрана и на скрытой вкладке, при reduced motion – один статичный кадр.
     ====================================================================== */
  const CHATOYANCE_BASE = {
    bgColor: '#070313', colorA: '#1a0f33', colorB: '#6b2bc8', colorC: '#e02bc8', colorD: '#f9d9ff',
    scale: 1.75, speed: 0.33, angle: -1.18, wander: 0.44, wanderScale: 0.82, fibreFreq: 7.8, fibreGain: 0.52, fibreLac: 2.15, twist: 1.3, tilt: 0.9,
    lightAz: 0.88, lightHeight: 0.34, sheen: 76, specular: 0.6, diffuse: 0.08, ambient: 0.03, falloff: 0.85,
    contrast: 1.2, midpoint: 0.52, sink: 0.22, glow: 0.22, grain: 0, grainAnim: 0, dither: 1.45, vignette: 0.16, cursor: 1,
    pointerRadius: 0.5, pointerComb: 0.66, pointerLift: 0.18, maxDpr: 1.0,
  };
  const CHATOYANCE_ROLL_006 = {
    bgColor: '#0d0402', colorA: '#340c05', colorB: '#e8342b', colorC: '#f5a52b', colorD: '#fff0c2',
    scale: 1.18, speed: 0.33, angle: 0.68, wander: 0.28, wanderScale: 0.5, fibreFreq: 8.2, fibreGain: 0.5, fibreLac: 2.08, twist: 0.86, tilt: 0.66,
    lightAz: 0.92, lightHeight: 0.56, sheen: 30, specular: 0.42, diffuse: 0.2, ambient: 0.07, falloff: 0.8,
    contrast: 1.15, midpoint: 0.58, sink: 0.12, glow: 0.15, grain: 0, grainAnim: 0, dither: 1.28, vignette: 0.07, cursor: 1,
    pointerRadius: 0.68, pointerComb: 0.4, pointerLift: 0.11, maxDpr: 1,
  };
  const CHATOYANCE_TINT = { bgColor: '#160a05', colorA: '#34140a', colorB: '#7a3214', colorC: '#b04a22', colorD: '#dc8a44', glow: 0.08 };
  const CONFIG = Object.assign({}, CHATOYANCE_BASE, CHATOYANCE_ROLL_006, CHATOYANCE_TINT);

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
uniform vec2  iMouse;          // aspect-corrected units, same space as uv

uniform vec3  uBg, uColorA, uColorB, uColorC, uColorD;
uniform float uScale, uSpeed, uAngle, uWander, uWanderScale;
uniform float uFibreFreq, uFibreGain, uFibreLac, uTwist, uTilt;
uniform float uLightAz, uLightHeight, uSheen, uSpecular, uDiffuse, uAmbient, uFalloff;
uniform float uContrast, uMidpoint, uSink, uGlow;
uniform float uGrain, uDither, uVignette;
uniform float uPointerRadius, uPointerComb, uPointerLift;

#define FIBRES 4

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

vec2 rot(vec2 v, float a) { float c = cos(a), s = sin(a); return vec2(c * v.x - s * v.y, s * v.x + c * v.y); }

// ---- house grain. ONE look across the collection: an integer hash (no sin() streaks),
// triangular so it reads as film rather than static, weighted into the midtones so it
// never crusts a black or a white. Static by default; uGrainAnim re-seeds it 24x/s.
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

  // pointer neighbourhood. 1/(1+q)^2 has a gentler shoulder and a much longer tail than a
  // gaussian, which is what keeps the reach felt rather than seen.
  vec2 dm = uv - iMouse;
  float q = dot(dm, dm) / max(1e-4, uPointerRadius * uPointerRadius);
  float near = 1.0 / ((1.0 + q) * (1.0 + q));

  // THE COMB. Rotating the domain around the cursor *and* the fibre angle by the same decaying
  // amount is a rigid rotation of the fibre bundle: the grain turns, it does not smear. Because
  // the amount decays with distance the bundle shears, which is what a comb through hair does.
  float swirl = near * uPointerComb;
  vec2 m = iMouse * uScale;
  vec2 p = rot(uv * uScale - m, swirl) + m;

  // 1. THE GRAIN. Two slow octaves bend the fibre direction; nothing here is visible on its own.
  float bend = snoise(p * uWanderScale + vec2(t * 0.11, -t * 0.08)) * 0.66
             + snoise(p * uWanderScale * 2.17 - vec2(t * 0.06, t * 0.09)) * 0.28;
  float a = uAngle + swirl + uWander * bend;
  vec2 dir = vec2(cos(a), sin(a));
  vec2 nrm = vec2(-dir.y, dir.x);

  // 2. THE LIFT. Sines across the grain, phase-modulated along it, tilt each fibre out of the
  // plane. The tangent stays unit length, so this brightens nothing by itself - it only decides
  // which fibres are aimed at the light.
  float xs = dot(p, nrm), ys = dot(p, dir);
  float lift = 0.0, amp = 1.0, k = uFibreFreq;
  for (int i = 0; i < FIBRES; i++) {
    float fi = float(i);
    lift += amp * sin(k * xs + uTwist * sin(k * 0.19 * ys + t * (0.57 + fi * 0.23)) + t * (0.79 + fi * 0.37));
    amp *= uFibreGain;
    k   *= uFibreLac;
  }
  vec3 T = normalize(vec3(dir, lift * uTilt));

  // 3. KAJIYA-KAY. What a cylinder returns: the lobe peaks where the incoming and outgoing angles
  // to the tangent are supplementary, so the sheen is a band drawn by the fibre *orientation*
  // rather than a shape anyone painted. The view is straight on, V = (0, 0, 1).
  vec3 L = normalize(vec3(cos(uLightAz), sin(uLightAz), uLightHeight));
  float cl = dot(T, L), sl = sqrt(max(0.0, 1.0 - cl * cl));
  float cv = T.z,       sv = sqrt(max(0.0, 1.0 - cv * cv));
  float lobe = max(0.0, sl * sv - cl * cv);
  float sheen = uSheen / (1.0 + uSheen * fwidth(lobe));   // widen the lobe where it turns faster than a pixel
  float spec = pow(lobe, sheen);

  // 4. EXPOSURE. One broad ramp toward the light so the frame has a lit side and a quiet one.
  float axis = dot(uv, vec2(cos(uLightAz), sin(uLightAz)));
  float expo = 1.0 + uFalloff * (smoothstep(-0.8, 0.8, axis) - 0.5) * 2.0;

  float lum = (uAmbient + uDiffuse * sl + uSpecular * spec) * expo + near * uPointerLift;
  float f = clamp((lum - uMidpoint) * uContrast + 0.5, 0.0, 1.0);

  vec3 col = ramp4(f);
  col += uColorD * uGlow * pow(f, 4.0);
  col = mix(uBg, col, smoothstep(0.0, max(0.01, uSink), f) * 0.90 + 0.10);

  col *= 1.0 - uVignette * dot(uv, uv);
  { float hgL = clamp(dot(col, vec3(0.299, 0.587, 0.114)), 0.0, 1.0);
    col += houseGrain(gl_FragCoord.xy) * uGrain * mix(1.0, 4.0 * hgL * (1.0 - hgL), 0.6); }
  col += triDither(gl_FragCoord.xy) * uDither;

  fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

  function mountChatoyance(canvas, host) {
    const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' });
    if (!gl) return false; // остаётся CSS-градиент панели

    const compile = (type, src) => {
      const sh = gl.createShader(type); gl.shaderSource(sh, src); gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
      return sh;
    };
    let program;
    try {
      program = gl.createProgram();
      gl.attachShader(program, compile(gl.VERTEX_SHADER, VERT));
      gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    } catch (err) { return false; }
    gl.useProgram(program);
    gl.bindVertexArray(gl.createVertexArray());

    const LOC = {};
    const loc = (n) => (n in LOC ? LOC[n] : (LOC[n] = gl.getUniformLocation(program, n)));
    const u1f = (n, v) => gl.uniform1f(loc(n), v);
    const u2f = (n, x, y) => gl.uniform2f(loc(n), x, y);
    const u3c = (n, hex) => { const v = parseInt(hex.slice(1), 16); gl.uniform3f(loc(n), ((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255); };

    u3c('uBg', CONFIG.bgColor); u3c('uColorA', CONFIG.colorA); u3c('uColorB', CONFIG.colorB); u3c('uColorC', CONFIG.colorC); u3c('uColorD', CONFIG.colorD);
    [['uScale', 'scale'], ['uSpeed', 'speed'], ['uAngle', 'angle'], ['uWander', 'wander'], ['uWanderScale', 'wanderScale'],
      ['uFibreFreq', 'fibreFreq'], ['uFibreGain', 'fibreGain'], ['uFibreLac', 'fibreLac'], ['uTwist', 'twist'], ['uTilt', 'tilt'],
      ['uLightAz', 'lightAz'], ['uLightHeight', 'lightHeight'], ['uSheen', 'sheen'], ['uSpecular', 'specular'], ['uDiffuse', 'diffuse'],
      ['uAmbient', 'ambient'], ['uFalloff', 'falloff'], ['uContrast', 'contrast'], ['uMidpoint', 'midpoint'], ['uSink', 'sink'], ['uGlow', 'glow'],
      ['uGrain', 'grain'], ['uGrainAnim', 'grainAnim'], ['uDither', 'dither'], ['uVignette', 'vignette'],
      ['uPointerRadius', 'pointerRadius'], ['uPointerComb', 'pointerComb'], ['uPointerLift', 'pointerLift']]
      .forEach(([u, k]) => u1f(u, CONFIG[k]));

    let running = false;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, CONFIG.maxDpr);
      const r = host.getBoundingClientRect();
      const w = Math.max(1, Math.round(r.width * dpr)), ht = Math.max(1, Math.round(r.height * dpr));
      if (canvas.width !== w || canvas.height !== ht) { canvas.width = w; canvas.height = ht; }
      gl.viewport(0, 0, w, ht); u2f('iResolution', w, ht);
    };

    const SPRING = 0.014, DAMP = 0.17;
    const mouse = { x: 0.35, y: 0.1, vx: 0, vy: 0, tx: 0.35, ty: 0.1 };
    const aim = (e) => {
      if (!CONFIG.cursor) return;
      const r = host.getBoundingClientRect();
      mouse.tx = ((e.clientX - r.left) / r.width - 0.5) * (r.width / r.height);
      mouse.ty = 0.5 - (e.clientY - r.top) / r.height;
    };
    host.addEventListener('pointermove', aim, { passive: true });
    host.addEventListener('pointerdown', aim, { passive: true });

    let clock = 3.0, prevT = 0, visible = false, raf = 0;
    const draw = () => { u1f('iTime', clock); u2f('iMouse', mouse.x, mouse.y); gl.drawArrays(gl.TRIANGLES, 0, 3); };
    const frame = (now) => {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      const raw = now - prevT; prevT = now;
      const ms = raw > 50 ? 50 : raw < 4.167 ? 4.167 : raw;
      const s = ms > 36.7 ? 2.2 : ms * 0.06;
      clock += ms * 0.001;
      mouse.vx += ((mouse.tx - mouse.x) * SPRING - mouse.vx * DAMP) * s;
      mouse.vy += ((mouse.ty - mouse.y) * SPRING - mouse.vy * DAMP) * s;
      mouse.x += mouse.vx * s; mouse.y += mouse.vy * s;
      draw();
    };
    const sync = () => {
      const should = visible && !document.hidden && !reduced();
      if (should && !running) { running = true; prevT = performance.now(); raf = requestAnimationFrame(frame); }
      if (!should && running) { running = false; cancelAnimationFrame(raf); }
    };

    let resizeQueued = false;
    const queueResize = () => {
      if (resizeQueued) return; resizeQueued = true;
      requestAnimationFrame(() => { resizeQueued = false; resize(); if (!running) draw(); });
    };
    if ('ResizeObserver' in window) new ResizeObserver(queueResize).observe(host);
    else window.addEventListener('resize', queueResize, { passive: true });

    new IntersectionObserver((es) => { visible = es[0].isIntersecting; sync(); }, { threshold: 0 }).observe(host);
    document.addEventListener('visibilitychange', sync);
    reduceMq.addEventListener('change', () => { sync(); if (!running) draw(); });
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); running = false; cancelAnimationFrame(raf); canvas.classList.remove('is-live'); });

    resize(); draw();                 // первый кадр до показа – канвас не вспыхивает пустым
    canvas.classList.add('is-live');
    sync();
    return true;
  }

  const makerHost = $('#maker'), makerCanvas = $('#makerGl');
  if (makerHost && makerCanvas && 'IntersectionObserver' in window) {
    const lazy = new IntersectionObserver((es) => {
      if (!es[0].isIntersecting) return;
      lazy.disconnect();
      try { mountChatoyance(makerCanvas, makerHost); } catch (err) { /* остаётся статичный градиент */ }
    }, { rootMargin: '600px 0px' });
    lazy.observe(makerHost);
  }
})();
