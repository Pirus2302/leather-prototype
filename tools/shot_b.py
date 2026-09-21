# -*- coding: utf-8 -*-
"""Самопроверка варианта B: скриншоты 1440/390, картинки, горизонтальный скролл, консоль, клики по интерактиву."""
import io
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parent.parent
URL = ROOT.joinpath("b.html").as_uri()
OUT = ROOT / "docs" / "screens"
OUT.mkdir(parents=True, exist_ok=True)

problems = []


def note(ok, label, extra=""):
    print(("OK   " if ok else "FAIL ") + label + (f" – {extra}" if extra else ""))
    if not ok:
        problems.append(label)


def scroll_through(page):
    h = page.evaluate("document.documentElement.scrollHeight")
    y = 0
    while y < h:
        page.evaluate(f"window.scrollTo(0, {y})")
        page.wait_for_timeout(180)
        y += 500
        h = page.evaluate("document.documentElement.scrollHeight")
    page.evaluate("window.scrollTo(0, document.documentElement.scrollHeight)")
    page.wait_for_timeout(1200)
    page.evaluate("window.scrollTo(0, 0)")
    page.wait_for_timeout(2000)


def wait_scroll_idle(page, limit=8000):
    """Ждём, пока плавная прокрутка закончится: иначе клик Playwright спорит с ней за позицию."""
    last, same, spent = None, 0, 0
    while spent < limit and same < 3:
        y = page.evaluate("window.scrollY")
        same = same + 1 if y == last else 0
        last = y
        page.wait_for_timeout(150)
        spent += 150


def common_checks(page, tag):
    imgs = page.evaluate(
        """() => Array.from(document.images).map(i => ({src: i.currentSrc || i.src, ok: i.complete && i.naturalWidth > 0}))"""
    )
    broken = [i["src"] for i in imgs if not i["ok"]]
    note(not broken, f"[{tag}] все фото загружены ({len(imgs)} шт.)", "; ".join(broken))
    sw, iw = page.evaluate("[document.documentElement.scrollWidth, window.innerWidth]")
    note(sw <= iw, f"[{tag}] нет горизонтального скролла", f"scrollWidth={sw}, innerWidth={iw}")
    wide = page.evaluate(
        """() => { const iw = window.innerWidth; return Array.from(document.querySelectorAll('body *'))
          .filter(e => !e.closest('.ribbon') && !e.closest('.chips') && !e.closest('.vsw'))
          .map(e => [e, e.getBoundingClientRect()]).filter(([e, r]) => r.width > 0 && (r.right > iw + 1 || r.left < -1))
          .slice(0, 8).map(([e, r]) => e.tagName + '.' + e.className + ' ' + Math.round(r.left) + '..' + Math.round(r.right)); }"""
    )
    note(not wide, f"[{tag}] элементы не вылезают за экран", "; ".join(wide))


def run(width, height, name, mobile=False):
    with sync_playwright() as p:
        browser = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
        ctx = browser.new_context(viewport={"width": width, "height": height}, device_scale_factor=1,
                                  is_mobile=mobile, has_touch=mobile)
        page = ctx.new_page()
        errors = []
        # «GPU stall due to ReadPixels» – сообщение драйвера от самого скриншота в headless, к странице не относится
        page.on("console", lambda m: errors.append(f"{m.type}: {m.text}")
                if m.type in ("error", "warning") and "GL Driver Message" not in m.text else None)
        page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
        page.on("requestfailed", lambda r: errors.append(f"requestfailed: {r.url}"))
        page.goto(URL, wait_until="networkidle")
        page.wait_for_timeout(2200)
        page.screenshot(path=str(OUT / f"b-{name}-fold.jpg"), type="jpeg", quality=70)
        scroll_through(page)
        common_checks(page, name)
        page.screenshot(path=str(OUT / f"b-{name}.jpg"), type="jpeg", quality=70, full_page=True)

        # Клик Playwright сам доскролливает к элементу; с CSS smooth-scroll каждая попытка запускает новую анимацию,
        # и элемент вечно «not stable». Для прогона кликов плавность отключаем – на саму страницу это не влияет
        page.add_style_tag(content="html{scroll-behavior:auto!important}")

        # --- шейдер ---
        live = page.evaluate("document.querySelector('#makerGl').classList.contains('is-live')")
        note(live, f"[{name}] шейдер chatoyance смонтирован (WebGL2)")

        # --- фильтры ---
        page.evaluate("document.querySelector('#catalog').scrollIntoView()")
        page.wait_for_timeout(500)
        page.click('[data-filter="cat"] .chip[data-value="wallets"]')
        page.wait_for_timeout(700)
        n = page.evaluate("document.querySelectorAll('#grid .card[data-id]:not([hidden])').length")
        note(n == 6 and page.inner_text("#foundN") == "6", f"[{name}] фильтр «Кошельки» → 6", f"видно {n}")
        page.click('[data-filter="avail"] .chip[data-value="custom"]')
        page.wait_for_timeout(700)
        n = page.evaluate("document.querySelectorAll('#grid .card[data-id]:not([hidden])').length")
        note(n == 2 and page.inner_text("#foundN") == "2", f"[{name}] + «Под заказ» → 2", f"видно {n}")
        page.screenshot(path=str(OUT / f"b-{name}-filter.jpg"), type="jpeg", quality=70)
        page.click('[data-filter="cat"] .chip[data-value="all"]')
        page.click('[data-filter="avail"] .chip[data-value="all"]')
        page.wait_for_timeout(700)
        n = page.evaluate("document.querySelectorAll('#grid .card[data-id]:not([hidden])').length")
        note(n == 15, f"[{name}] сброс фильтров → 15", f"видно {n}")
        sw, iw = page.evaluate("[document.documentElement.scrollWidth, window.innerWidth]")
        note(sw <= iw, f"[{name}] после фильтров нет горизонтального скролла", f"{sw}/{iw}")

        # --- корзина ---
        page.click('#grid .card[data-id]:not([hidden]) [data-add]')
        page.wait_for_timeout(250)
        txt = page.inner_text('#grid .card[data-id]:not([hidden]) [data-add]')
        note("Добавлено" in txt, f"[{name}] кнопка показывает «Добавлено ✓»", txt)
        page.click('#grid .card[data-id]:not([hidden]):nth-child(2) [data-add]')
        cnt = page.inner_text("#cartBtn [data-cart-count]")
        note(cnt == "2", f"[{name}] счётчик корзины = 2", cnt)
        page.wait_for_timeout(1300)
        txt = page.inner_text('#grid .card[data-id]:not([hidden]) [data-add]')
        note("Добавлено" not in txt, f"[{name}] кнопка вернулась", txt)
        if mobile:
            page.click("#tabCart")
        else:
            page.click("#cartBtn")
        page.wait_for_timeout(500)
        note(page.is_visible("#cart"), f"[{name}] корзина открылась")
        page.screenshot(path=str(OUT / f"b-{name}-cart.jpg"), type="jpeg", quality=70)
        page.click("#cartOrder")
        page.wait_for_timeout(1500)
        wait_scroll_idle(page)
        wish = page.input_value("#fWish")
        note("Хочу заказать" in wish, f"[{name}] корзина → текст заявки", wish[:70])

        # --- конструктор ---
        page.evaluate("document.querySelector('#custom').scrollIntoView()")
        page.wait_for_timeout(900)
        page.click('.seg__item:has(input[value="wallet"])')
        page.click('.sw:has(input[name="leather"][value="bordo"])')
        page.click('.sw:has(input[name="thread"][value="mustard"])')
        page.fill("#engrave", "Оля 2026")
        page.wait_for_timeout(800)
        st = page.evaluate(
            """() => { const s = getComputedStyle(document.querySelector('#product'));
            return {leather: s.getPropertyValue('--leather').trim(), thread: s.getPropertyValue('--thread').trim(),
              wallet: !document.querySelector('[data-p=wallet]').hasAttribute('hidden'),
              bag: document.querySelector('[data-p=bag]').hasAttribute('hidden'),
              text: document.querySelector('[data-p=wallet] [data-engrave]').textContent}; }"""
        )
        note(st["leather"] == "#6B1F2A" and st["thread"] == "#D9A441" and st["wallet"] and st["bag"] and st["text"] == "ОЛЯ 2026",
             f"[{name}] конструктор перекрашивает превью", str(st))
        page.locator("#maker").screenshot(path=str(OUT / f"b-{name}-maker.jpg"), type="jpeg", quality=75)
        page.click("#makerSend")
        page.wait_for_timeout(1600)
        wait_scroll_idle(page)
        wish = page.input_value("#fWish")
        note("кошелёк" in wish and "бордо" in wish and "«Оля 2026»" in wish and "Хочу заказать" in wish,
             f"[{name}] конструктор → текст заявки", wish.replace("\n", " | ")[:140])

        # --- форма ---
        page.click('#orderForm button[type="submit"]')
        page.wait_for_timeout(300)
        note(page.is_visible("#formError"), f"[{name}] пустая форма показывает ошибку")
        page.fill("#fName", "Оля")
        page.fill("#fContact", "@olya")
        page.click('#orderForm button[type="submit"]')
        page.wait_for_timeout(900)
        note(page.is_visible("#formDone") and "Спасибо, мастер свяжется с вами" in page.inner_text("#formDone"),
             f"[{name}] форма → «Спасибо, мастер свяжется с вами»")
        page.locator("#order").screenshot(path=str(OUT / f"b-{name}-form.jpg"), type="jpeg", quality=70)

        # --- бургер (только мобильный) ---
        if mobile:
            page.evaluate("window.scrollTo(0, 0)")
            page.wait_for_timeout(400)
            page.click("#burger")
            page.wait_for_timeout(600)
            note(page.evaluate("getComputedStyle(document.querySelector('#nav')).visibility") == "visible", f"[{name}] бургер открывает меню")
            page.screenshot(path=str(OUT / f"b-{name}-menu.jpg"), type="jpeg", quality=70)
            page.click('#nav a[href="#about"]')
            page.wait_for_timeout(1200)
            closed = page.evaluate("!document.querySelector('#nav').classList.contains('is-open')")
            y = page.evaluate("window.scrollY")
            note(closed and y > 500, f"[{name}] пункт меню закрывает меню и скроллит", f"scrollY={y}")
            # таб-панель не пересекается с переключателем вариантов
            rects = page.evaluate(
                """() => { const a = document.querySelector('.tabbar').getBoundingClientRect(), b = document.querySelector('.vsw').getBoundingClientRect();
                return {tabRight: a.right, swLeft: b.left, tabH: a.height}; }"""
            )
            note(rects["tabRight"] <= rects["swLeft"] - 4 and rects["tabH"] <= 60, f"[{name}] таб-панель не задевает переключатель", str(rects))
            page.click('.tabbar .tab[data-go-avail="stock"]')
            page.wait_for_timeout(1200)
            n = page.evaluate("document.querySelectorAll('#grid .card[data-id]:not([hidden])').length")
            note(n == 9, f"[{name}] таб «В наличии» → 9 изделий", f"видно {n}")
            page.screenshot(path=str(OUT / f"b-{name}-tab.jpg"), type="jpeg", quality=70)

        # --- пустое состояние (в данных таких сочетаний нет, проверяем принудительно) ---
        page.evaluate("""() => { document.querySelectorAll('#grid .card').forEach(c => c.hidden = true);
          document.querySelector('#grid').hidden = true; document.querySelector('#empty').hidden = false;
          document.querySelector('#empty').scrollIntoView({block: 'center'}); }""")
        page.wait_for_timeout(500)
        page.screenshot(path=str(OUT / f"b-{name}-empty.jpg"), type="jpeg", quality=70)

        note(not errors, f"[{name}] консоль без ошибок", " | ".join(errors[:6]))
        browser.close()


def quick(width, height, name):
    """Промежуточные ширины: только скриншот и проверка скролла."""
    with sync_playwright() as p:
        browser = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
        page = browser.new_context(viewport={"width": width, "height": height}).new_page()
        page.goto(URL, wait_until="networkidle")
        page.wait_for_timeout(2000)
        scroll_through(page)
        common_checks(page, name)
        page.screenshot(path=str(OUT / f"b-{name}.jpg"), type="jpeg", quality=60, full_page=True)
        browser.close()


def reduced_motion_check():
    with sync_playwright() as p:
        browser = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
        ctx = browser.new_context(viewport={"width": 1440, "height": 900}, reduced_motion="reduce")
        page = ctx.new_page()
        page.goto(URL, wait_until="networkidle")
        page.wait_for_timeout(1200)
        vis = page.evaluate("""() => Array.from(document.querySelectorAll('.bento .cell, .reveal'))
          .every(e => getComputedStyle(e).opacity === '1')""")
        note(vis, "[reduced-motion] всё видно без анимации")
        anim = page.evaluate("getComputedStyle(document.querySelector('.ribbon__track')).animationName")
        note(anim == "none", "[reduced-motion] лента остановлена", anim)
        browser.close()


if __name__ == "__main__":
    run(1440, 900, "1440")
    run(390, 844, "390", mobile=True)
    quick(1024, 800, "1024")
    quick(768, 1024, "768")
    reduced_motion_check()
    print("\nИТОГО проблем:", len(problems))
    for x in problems:
        print(" -", x)
