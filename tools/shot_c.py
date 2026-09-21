# -*- coding: utf-8 -*-
"""Самопроверка варианта C: скриншоты, консоль, картинки, горизонтальный скролл, интерактив."""
import sys
import io
from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

ROOT = Path(__file__).resolve().parent.parent
URL = "file:///" + str(ROOT / "c.html").replace("\\", "/")
OUT = ROOT / "docs" / "screens"
OUT.mkdir(parents=True, exist_ok=True)
# --disable-gpu-rasterization: с GPU-растром SwiftShader в headless оставляет на длинном SVG-слое нити «призрачные» тайлы
# (DOM при этом верный – проверено), поэтому скриншоты снимаем с программным растром
ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl", "--disable-gpu-rasterization"]

only = sys.argv[1] if len(sys.argv) > 1 else "all"
ARGS += sys.argv[2:]   # доп. флаги Chromium, например --disable-gpu-rasterization


def attach(page, tag, log):
    page.on("console", lambda m: log.append(f"[{tag}] console.{m.type}: {m.text}") if m.type in ("error", "warning") else None)
    page.on("pageerror", lambda e: log.append(f"[{tag}] pageerror: {e}"))
    page.on("requestfailed", lambda r: log.append(f"[{tag}] requestfailed: {r.url[:110]}"))
    page.on("response", lambda r: log.append(f"[{tag}] HTTP {r.status}: {r.url[:110]}") if r.status >= 400 else None)


def wait_ready(page):
    page.wait_for_selector("#loader.is-gone", state="attached", timeout=15000)
    page.wait_for_timeout(2600)


def walk(page, step=500, pause=140):
    h = page.evaluate("document.documentElement.scrollHeight")
    y = 0
    while y < h:
        page.evaluate(f"window.scrollTo({{top:{y},behavior:'instant'}})")
        page.wait_for_timeout(pause)
        y += step
        h = page.evaluate("document.documentElement.scrollHeight")
    page.evaluate("window.scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'})")
    page.wait_for_timeout(600)


def report(page, tag):
    info = page.evaluate("""() => {
      const imgs = [...document.images];
      const bad = imgs.filter(i => i.complete && i.naturalWidth === 0).map(i => i.src.slice(0, 90));
      const pending = imgs.filter(i => !i.complete).length;
      const c = document.getElementById('drape');
      let glOk = null;
      try { const g = c.getContext('webgl2'); glOk = !!g; } catch (e) { glOk = false; }
      return { sw: document.documentElement.scrollWidth, iw: window.innerWidth, cw: document.documentElement.clientWidth,
               h: document.documentElement.scrollHeight, bad, pending, total: imgs.length, glOk,
               noPin: document.documentElement.classList.contains('no-pin'),
               locked: document.documentElement.classList.contains('is-locked'),
               threadLen: document.getElementById('th-line').getTotalLength() };
    }""")
    print(f"[{tag}] {info}")
    print(f"[{tag}] horizontal overflow: {'FAIL' if info['sw'] > info['iw'] else 'ok'}")


def shot(page, name, full=False):
    path = OUT / name
    page.screenshot(path=str(path), full_page=full, type="jpeg", quality=70)
    print("saved", path.name)


def full_stitch(page, name, dpr=1):
    """Полный скриншот склейкой вьюпортов. page.screenshot(full_page=True) здесь не годится:
    SwiftShader ограничен текстурой 8192px и Chromium повторяет страницу с начала.
    Для склейки нить показываем дорисованной целиком и прячем иглу, иначе в каждом куске была бы своя игла."""
    page.add_style_tag(content=".thread__st line{visibility:visible!important;opacity:1!important}#th-line{stroke-dashoffset:0!important}#th-needle{display:none}.cursor,.toast{display:none!important}")
    vw = page.evaluate("innerWidth"); vh = page.evaluate("innerHeight")
    total = page.evaluate("document.documentElement.scrollHeight")
    canvas = Image.new("RGB", (int(vw * dpr), int(total * dpr)), (13, 10, 8))
    y = 0
    first = True
    while True:
        y = min(y, total - vh)
        page.evaluate(f"window.scrollTo({{top:{y},behavior:'instant'}})")
        page.wait_for_timeout(900 if first else 650)
        png = page.screenshot(type="png")
        tile = Image.open(io.BytesIO(png)).convert("RGB")
        canvas.paste(tile, (0, int(y * dpr)))
        if first:
            page.add_style_tag(content=".hdr,.vsw{visibility:hidden!important}")
            first = False
        if y >= total - vh:
            break
        y += vh
    canvas.save(str(OUT / name), "JPEG", quality=70)
    print("saved", name, canvas.size)


def shader_pixels(page, tag):
    px = page.evaluate("""() => new Promise(res => requestAnimationFrame(() => {
      const c = document.getElementById('drape');
      const t = document.createElement('canvas'); t.width = 64; t.height = 36;
      const x = t.getContext('2d'); x.drawImage(c, 0, 0, 64, 36);
      const d = x.getImageData(0, 0, 64, 36).data; let mn = 255, mx = 0, sum = 0;
      for (let i = 0; i < d.length; i += 4) { const l = (d[i] + d[i+1] + d[i+2]) / 3; mn = Math.min(mn, l); mx = Math.max(mx, l); sum += l; }
      res({ min: mn, max: mx, avg: +(sum / (d.length / 4)).toFixed(1), w: c.width, h: c.height });
    }))""")
    print(f"[{tag}] shader pixels (readback в том же кадре может быть 0 без preserveDrawingBuffer): {px}")


with sync_playwright() as p:
    browser = p.chromium.launch(args=ARGS)
    log = []

    if only in ("all", "desktop"):
        ctx = browser.new_context(viewport={"width": 1440, "height": 900})
        page = ctx.new_page()
        attach(page, "1440", log)
        page.goto(URL)
        page.wait_for_timeout(700)
        shot(page, "c-loader.jpg")
        wait_ready(page)
        page.mouse.move(900, 380)
        page.wait_for_timeout(900)
        shader_pixels(page, "1440")
        shot(page, "c-view-1-hero.jpg")

        pos = page.evaluate("""() => {
          const top = (s) => { let el = document.querySelector(s), y = 0; while (el) { y += el.offsetTop; el = el.offsetParent; } return y; };
          const v = document.getElementById('vitrina');
          const steps = [...document.querySelectorAll('.step')];
          const st = (el) => { let y = 0; while (el) { y += el.offsetTop; el = el.offsetParent; } return y; };
          return { cats: top('#cats') - 40, paths: top('#paths') + 160, vStart: top('#vitrina'), vMid: top('#vitrina') + (v.offsetHeight - innerHeight) * 0.5,
                   vEnd: top('#vitrina') + (v.offsetHeight - innerHeight) * 0.97,
                   step3: st(steps[2]) + steps[2].offsetHeight / 2 - innerHeight / 2, about: top('#about') + 60, mq: top('#mq') - 200,
                   delivery: top('#delivery') - 60, final: top('#order') + 40, bottom: document.documentElement.scrollHeight };
        }""")
        print("positions", pos)
        walk(page)
        report(page, "1440")
        for key, name in [("cats", "c-view-2-cats.jpg"), ("paths", "c-view-3-paths.jpg"), ("vMid", "c-view-4-vitrina-mid.jpg"), ("vEnd", "c-view-4b-vitrina-end.jpg"),
                          ("step3", "c-view-5-process-step3.jpg"), ("about", "c-view-6-about.jpg"), ("mq", "c-view-7-marquee.jpg"),
                          ("delivery", "c-view-8-delivery.jpg"), ("final", "c-view-9-final.jpg"), ("bottom", "c-view-10-footer.jpg")]:
            page.evaluate(f"window.scrollTo({{top:{pos[key]},behavior:'instant'}})")
            page.wait_for_timeout(1500)
            if key == "cats":
                page.mouse.move(520, 470)
                page.wait_for_timeout(900)
            if key == "paths":
                page.mouse.move(1050, 500)
                page.wait_for_timeout(1200)
            if key == "vMid":
                page.mouse.move(640, 520)
                page.wait_for_timeout(700)
            shot(page, name)
            page.mouse.move(5, 5)

        # интерактив: корзина и форма
        page.evaluate(f"window.scrollTo({{top:{pos['vStart'] + 10},behavior:'instant'}})")
        page.wait_for_timeout(800)
        page.click(".card [data-act='cart']")
        page.wait_for_timeout(300)
        print("[1440] cart count:", page.inner_text("#cartN"), "| toast:", page.inner_text("#toast"))
        page.evaluate(f"window.scrollTo({{top:{pos['final']},behavior:'instant'}})")
        page.wait_for_timeout(800)
        page.click("#form button[type=submit]")
        print("[1440] empty submit -> error visible:", page.is_visible("#formErr"))
        page.fill("input[name=name]", "Анна")
        page.fill("input[name=contact]", "@anna")
        page.click("#form button[type=submit]")
        page.wait_for_timeout(300)
        print("[1440] form ok visible:", page.is_visible("#formOk"), "|", page.inner_text("#formOk").replace("\n", " / "))
        print("[1440] knot tied:", page.evaluate("document.getElementById('th-knot').classList.contains('is-tied')"))

        # полный скриншот
        page.reload()
        wait_ready(page)
        walk(page)
        full_stitch(page, "c-1440.jpg")
        ctx.close()

    if only in ("all", "mobile"):
        ctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
        page = ctx.new_page()
        attach(page, "390", log)
        page.goto(URL)
        wait_ready(page)
        shot(page, "c-390-view-hero.jpg")
        page.click("#burger")
        page.wait_for_timeout(1300)
        shot(page, "c-390-view-menu.jpg")
        print("[390] menu open:", page.evaluate("document.getElementById('menu').classList.contains('is-open')"))
        page.click("#menu a[href='#process']")
        page.wait_for_timeout(1600)
        print("[390] menu closed:", not page.evaluate("document.getElementById('menu').classList.contains('is-open')"), "| scrollY:", page.evaluate("scrollY"))
        shot(page, "c-390-view-process.jpg")
        walk(page, step=420)
        report(page, "390")
        vy = page.evaluate("(() => { let el = document.getElementById('vitrina'), y = 0; while (el) { y += el.offsetTop; el = el.offsetParent; } return y; })()")
        page.evaluate(f"window.scrollTo({{top:{vy + 60},behavior:'instant'}})")
        page.wait_for_timeout(900)
        page.evaluate("document.getElementById('vViewport').scrollTo({left:420,behavior:'instant'})")
        page.wait_for_timeout(700)
        shot(page, "c-390-view-vitrina.jpg")
        print("[390] after swipe: page scrollX =", page.evaluate("scrollX"), "| scrollWidth =", page.evaluate("document.documentElement.scrollWidth"))
        ctx.close()
        # полный скриншот – при DPR 1: на DPR 2 страница выше лимита текстуры (16384px) и Chromium склеивает её с повтором
        ctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=1, is_mobile=True, has_touch=True)
        page = ctx.new_page()
        attach(page, "390-full", log)
        page.goto(URL)
        wait_ready(page)
        walk(page, step=420)
        full_stitch(page, "c-390.jpg")
        ctx.close()

    if only in ("all", "sizes"):
        for w, h in ((1024, 768), (768, 1024)):
            ctx = browser.new_context(viewport={"width": w, "height": h})
            page = ctx.new_page()
            attach(page, str(w), log)
            page.goto(URL)
            wait_ready(page)
            shot(page, f"c-{w}-view-hero.jpg")
            walk(page)
            report(page, str(w))
            for sel, nm in (("#paths", "paths"), ("#vitrina", "vitrina"), ("#process", "process"), ("#order", "final")):
                yy = page.evaluate("(s) => { let el = document.querySelector(s), y = 0; while (el) { y += el.offsetTop; el = el.offsetParent; } return y; }", sel)
                page.evaluate(f"window.scrollTo({{top:{yy + 200},behavior:'instant'}})")
                page.wait_for_timeout(1300)
                shot(page, f"c-{w}-view-{nm}.jpg")
            ctx.close()

    if only in ("all", "rm"):
        ctx = browser.new_context(viewport={"width": 1440, "height": 900}, reduced_motion="reduce")
        page = ctx.new_page()
        attach(page, "rm", log)
        page.goto(URL)
        page.wait_for_selector("#loader.is-gone", state="attached", timeout=15000)
        page.wait_for_timeout(800)
        report(page, "rm")
        shot(page, "c-view-rm-hero.jpg")
        ctx.close()

    browser.close()
    print("---- log ----")
    for line in log:
        print(line)
    print("---- end ----")
