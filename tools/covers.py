from playwright.sync_api import sync_playwright
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-rasterization']
BASE = 'http://localhost:3121/'
OUT = 'D:/MYDEV/leather-prototype/docs/screens/'
with sync_playwright() as p:
    b = p.chromium.launch(args=ARGS)
    for x in 'abc':
        pg = b.new_page(viewport={'width': 1440, 'height': 900})
        errs = []
        pg.on('pageerror', lambda e, errs=errs: errs.append(str(e)))
        pg.goto(BASE + x + '.html'); pg.wait_for_load_state('networkidle'); pg.wait_for_timeout(5000)
        pg.screenshot(path=OUT + x + '-cover.jpg', type='jpeg', quality=78)
        print(x, 'errors:', errs, 'hscroll:', pg.evaluate('document.documentElement.scrollWidth>innerWidth'))
        pg.close()
    pg = b.new_page(viewport={'width': 1024, 'height': 768})
    pg.goto(BASE + 'c.html'); pg.wait_for_load_state('networkidle'); pg.wait_for_timeout(5000)
    pg.screenshot(path=OUT + 'c-1024-cover.jpg', type='jpeg', quality=70)
    b.close()
