from playwright.sync_api import sync_playwright
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-rasterization']
BASE = 'https://pirus2302.github.io/leather-prototype/'
with sync_playwright() as p:
    b = p.chromium.launch(args=ARGS)
    for w, h in ((1440, 900), (390, 844)):
        for x in ('index', 'a', 'b', 'c'):
            pg = b.new_page(viewport={'width': w, 'height': h})
            errs = []
            pg.on('pageerror', lambda e, errs=errs: errs.append(str(e)[:120]))
            pg.on('requestfailed', lambda r, errs=errs: errs.append('FAIL ' + r.url[:90]))
            pg.goto(BASE + x + '.html'); pg.wait_for_load_state('networkidle'); pg.wait_for_timeout(4500)
            total = pg.evaluate('document.documentElement.scrollHeight')
            y = 0
            while y < total:
                pg.evaluate('window.scrollTo(0,%d)' % y); pg.wait_for_timeout(220); y += h
            pg.wait_for_timeout(1200)
            broken = pg.evaluate("[...document.images].filter(i=>i.complete&&i.naturalWidth===0).map(i=>i.src.slice(-60))")
            hs = pg.evaluate('document.documentElement.scrollWidth>innerWidth')
            print(w, x, 'errors:', errs, 'broken:', broken, 'hscroll:', hs)
            if x == 'index' and w == 1440:
                pg.evaluate('window.scrollTo(0,0)'); pg.wait_for_timeout(500)
                pg.screenshot(path='D:/MYDEV/leather-prototype/tools/_index.jpg', type='jpeg', quality=70)
            pg.close()
    b.close()
