// Переключатель вариантов главной. Только для показа клиенту, в боевой сайт не идёт
(function () {
  const variants = [
    { href: 'index.html', label: '≡', title: 'Все варианты' },
    { href: 'a.html', label: 'A', title: 'Красивая и современная' },
    { href: 'b.html', label: 'B', title: 'Удобная и креативная' },
    { href: 'c.html', label: 'C', title: 'WOW' },
  ];
  const current = location.pathname.split('/').pop() || 'index.html';

  const css = `
  .vsw{position:fixed;right:12px;bottom:12px;z-index:2147483000;display:flex;align-items:center;gap:4px;
    padding:4px;border-radius:999px;background:rgba(20,16,12,.86);backdrop-filter:blur(10px);
    font:600 12px/1 system-ui,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.28)}
  .vsw a{display:grid;place-items:center;min-width:32px;height:32px;padding:0 10px;border-radius:999px;
    color:#e9dfd2;text-decoration:none;transition:background .2s,color .2s}
  .vsw a:hover{background:rgba(255,255,255,.12)}
  .vsw a[aria-current="page"]{background:#e9dfd2;color:#14100c}
  .vsw a:focus-visible{outline:2px solid #fff;outline-offset:2px}
  @media print{.vsw{display:none}}`;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  const nav = document.createElement('nav');
  nav.className = 'vsw';
  nav.setAttribute('aria-label', 'Варианты главной страницы');
  variants.forEach((v) => {
    const a = document.createElement('a');
    a.href = v.href;
    a.title = v.title;
    a.textContent = v.label;
    if (v.href === current) a.setAttribute('aria-current', 'page');
    nav.appendChild(a);
  });
  document.body.appendChild(nav);
})();
