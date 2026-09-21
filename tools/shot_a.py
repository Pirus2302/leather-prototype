# -*- coding: utf-8 -*-
"""Самопроверка варианта A: скриншоты 1440 и 390, битые картинки, горизонтальный скролл,
ошибки консоли, бургер, фильтр, корзина, форма.
Запуск: python tools/shot_a.py [--slices]
"""
import io
import os
import sys
import json

from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
URL = 'file:///' + ROOT.replace('\\', '/') + '/a.html'
OUT = os.path.join(ROOT, 'docs', 'screens')
SLICES = '--slices' in sys.argv
SLICE_DIR = os.environ.get('SHOT_SLICE_DIR', os.path.join(OUT, '_slices_a'))

os.makedirs(OUT, exist_ok=True)
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

report = {}


def scroll_through(page):
    """Прокрутка шагами до низа: иначе секции с reveal-анимацией и lazy-фото останутся пустыми."""
    h = page.evaluate('document.documentElement.scrollHeight')
    vh = page.viewport_size['height']
    y = 0
    while y < h:
        page.evaluate('y => window.scrollTo(0, y)', y)
        page.wait_for_timeout(260)
        y += int(vh * 0.6)
        h = page.evaluate('document.documentElement.scrollHeight')
    page.evaluate('window.scrollTo(0, document.documentElement.scrollHeight)')
    page.wait_for_timeout(600)
    try:
        page.wait_for_load_state('networkidle', timeout=15000)
    except Exception:
        pass
    page.wait_for_timeout(1600)
    page.evaluate('window.scrollTo(0, 0)')
    page.wait_for_timeout(900)


def check(page, tag):
    info = page.evaluate('''() => {
      const imgs = [...document.images];
      const broken = imgs.filter(i => !(i.complete && i.naturalWidth > 0)).map(i => i.currentSrc || i.src);
      const de = document.documentElement;
      const wide = [];
      if (de.scrollWidth > innerWidth) {
        for (const el of document.querySelectorAll('body *')) {
          const r = el.getBoundingClientRect();
          if (r.right > innerWidth + 1 || r.left < -1) wide.push(el.tagName + '.' + el.className + ' ' + Math.round(r.left) + '..' + Math.round(r.right));
        }
      }
      const pending = [...document.querySelectorAll('[data-reveal]')].filter(e => !e.classList.contains('is-in') && !e.hidden && !e.closest('[hidden]')).length;
      return { images: imgs.length, broken, scrollWidth: de.scrollWidth, innerWidth, hscroll: de.scrollWidth > innerWidth,
               wide: wide.slice(0, 12), revealPending: pending, height: de.scrollHeight,
               brand: document.querySelector('[data-brand]').textContent,
               fabric: document.querySelector('.hero__fabric').classList.contains('is-live') };
    }''')
    report[tag] = info
    return info


def slices(path, tag, step):
    from PIL import Image
    os.makedirs(SLICE_DIR, exist_ok=True)
    im = Image.open(path)
    w, h = im.size
    n = 0
    for top in range(0, h, step):
        n += 1
        im.crop((0, top, w, min(h, top + step))).save(os.path.join(SLICE_DIR, '%s-%02d.jpg' % (tag, n)), quality=72)
    return n


with sync_playwright() as p:
    browser = p.chromium.launch()

    for tag, vw, vh in (('1440', 1440, 900), ('1024', 1024, 768), ('768', 768, 1024), ('390', 390, 844)):
        ctx = browser.new_context(viewport={'width': vw, 'height': vh}, device_scale_factor=1,
                                  has_touch=(vw < 600), is_mobile=(vw < 600))
        page = ctx.new_page()
        errors = []
        failed = []
        # «GL Driver Message … ReadPixels» – это сам скриншотер читает WebGL-холст, к странице не относится
        page.on('console', lambda m, e=errors: e.append(m.text) if (m.type in ('error', 'warning') and 'GL Driver Message' not in m.text) else None)
        page.on('pageerror', lambda ex, e=errors: e.append('pageerror: ' + str(ex)))
        page.on('requestfailed', lambda r, f=failed: f.append(r.url))

        page.goto(URL, wait_until='load')
        page.wait_for_timeout(3200)
        page.screenshot(path=os.path.join(OUT, 'a-%s-hero.jpg' % tag), type='jpeg', quality=72)

        scroll_through(page)
        info = check(page, tag)
        full = os.path.join(OUT, 'a-%s.jpg' % tag)
        page.screenshot(path=full, full_page=True, type='jpeg', quality=70)
        if SLICES:
            info['slices'] = slices(full, tag, 1100 if vw > 600 else 1500)

        # --- интерактив ---
        inter = {}
        # фильтр
        page.evaluate("document.querySelector('#showcase').scrollIntoView()")
        page.wait_for_timeout(500)
        page.click('[data-filter="custom"]')
        page.wait_for_timeout(700)
        inter['filter_custom_visible'] = page.evaluate("[...document.querySelectorAll('.card')].filter(c => !c.hidden).length")
        inter['filter_custom_wrong'] = page.evaluate("[...document.querySelectorAll('.card')].filter(c => !c.hidden && c.dataset.status !== 'custom').length")
        inter['count_label'] = page.evaluate("document.querySelector('.shop__count').textContent.trim()")
        page.click('[data-filter="stock"]')
        page.wait_for_timeout(700)
        inter['filter_stock_visible'] = page.evaluate("[...document.querySelectorAll('.card')].filter(c => !c.hidden).length")
        if tag == '1440':
            page.locator('.card:not([hidden])').nth(1).hover()
            page.wait_for_timeout(900)
            page.screenshot(path=os.path.join(OUT, 'a-1440-filter.jpg'), type='jpeg', quality=70)
        # корзина
        btn = page.locator('.card:not([hidden]) [data-add]').first
        if vw > 600:
            page.locator('.card:not([hidden])').first.hover()
            page.wait_for_timeout(500)
        btn.click()
        page.wait_for_timeout(300)
        inter['cart_after_click'] = page.evaluate("document.querySelector('[data-cart-count]').textContent")
        inter['toast'] = page.evaluate("document.querySelector('[data-toast]').textContent")
        page.click('[data-filter="all"]')
        page.wait_for_timeout(700)
        inter['filter_all_visible'] = page.evaluate("[...document.querySelectorAll('.card')].filter(c => !c.hidden).length")

        # бургер
        if vw < 1181:
            page.evaluate('window.scrollTo(0, 0)')
            page.wait_for_timeout(300)
            page.click('[data-burger]')
            page.wait_for_timeout(900)
            inter['menu_open'] = page.evaluate("document.querySelector('[data-menu]').classList.contains('is-open')")
            page.screenshot(path=os.path.join(OUT, 'a-%s-menu.jpg' % tag), type='jpeg', quality=70)
            page.click('[data-menu] a[href="#about"]')
            page.wait_for_timeout(1200)
            inter['menu_closed_after_link'] = not page.evaluate("document.querySelector('[data-menu]').classList.contains('is-open')")
            page.wait_for_timeout(1500)
            inter['about_top'] = page.evaluate("Math.round(document.querySelector('#about').getBoundingClientRect().top)")
            inter['scrolled_to_about'] = abs(inter['about_top']) < 140

        # форма
        page.evaluate("document.querySelector('#order').scrollIntoView()")
        page.wait_for_timeout(700)
        page.click('[data-form] button[type=submit]')
        page.wait_for_timeout(200)
        inter['form_empty_shows_error'] = page.evaluate("!document.querySelector('[data-form-error]').hidden")
        page.fill('[name=name]', 'Тест')
        page.fill('[name=contact]', '@test')
        page.click('[data-form] button[type=submit]')
        page.wait_for_timeout(300)
        inter['form_done'] = page.evaluate("!document.querySelector('[data-form-done]').hidden && document.querySelector('[data-form]').hidden")
        inter['form_done_text'] = page.evaluate("document.querySelector('.form__done-title').textContent")
        inter['hscroll_after'] = page.evaluate("document.documentElement.scrollWidth > innerWidth")

        report[tag]['interactions'] = inter
        report[tag]['console'] = errors
        report[tag]['requestfailed'] = failed
        ctx.close()

    # prefers-reduced-motion: всё видно сразу, цикл шейдера стоит
    ctx = browser.new_context(viewport={'width': 1440, 'height': 900}, reduced_motion='reduce')
    page = ctx.new_page()
    page.goto(URL, wait_until='load')
    page.wait_for_timeout(1500)
    report['reduced'] = page.evaluate('''() => ({
      hiddenReveals: [...document.querySelectorAll('[data-reveal]')].filter(e => getComputedStyle(e).opacity === '0').length,
      titleVisible: getComputedStyle(document.querySelector('.hero__title .line > span')).transform,
      veil: getComputedStyle(document.querySelector('.veil')).display
    })''')
    ctx.close()
    browser.close()

print(json.dumps(report, ensure_ascii=False, indent=1))
