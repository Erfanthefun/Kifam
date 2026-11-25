# تست end-to-end با Playwright (موبایل، حالت تیره)
import subprocess, time, json, sys, os
from playwright.sync_api import sync_playwright
srv = subprocess.Popen(['python3', '-m', 'http.server', '8765'], cwd=os.path.dirname(os.path.abspath(__file__)) + '/..', stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
R = {'ok': 0, 'bad': []}
def chk(name, cond, info=''):
    if cond: R['ok'] += 1
    else: R['bad'].append(f'{name} {info}')
FA = str.maketrans('۰۱۲۳۴۵۶۷۸۹٬', '0123456789,')
def num(txt):  # «−۱٬۲۳۴ تومان» -> int
    t = txt.translate(FA); neg = '−' in t or t.strip().startswith('-')
    d = ''.join(c for c in t if c.isdigit()); return -int(d) if neg else int(d)
try:
  with sync_playwright() as p:
    b = p.chromium.launch(); ctx = b.new_context(viewport={'width': 390, 'height': 844}, color_scheme='dark', accept_downloads=True)
    ctx.grant_permissions(['clipboard-read', 'clipboard-write'])
    pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('dialog', lambda d: d.accept('پاک') if d.type == 'prompt' else d.accept())
    pg.add_init_script("window.__kifamOpenURL = u => { window.__lastURL = u; };")
    pg.goto('http://localhost:8765/index.html'); pg.wait_for_timeout(400)
    st = lambda: pg.evaluate('window.__kifam.state')
    hero = lambda: num(pg.inner_text('#heroNum'))
    # --- شروع
    chk('باقی‌مانده اولیه', hero() == 36716334, hero())
    chk('۷ قسط', len(st()['loans']) == 7)
    chk('۲۲ دسته', len(st()['categories']['expense']) == 22)
    chk('بعد از اقساط', num(pg.inner_text('#heroAfter')) == 36716334 - (2673000+2014000+25850000+5560000+6621438+18815264+2822500), pg.inner_text('#heroAfter'))
    chk('۷ ردیف قسط', pg.locator('.oblist .ob').count() == 7)
    # --- پرداخت یک‌لمسی و برگرداندن
    pg.locator('.ob .tick').first.click(); pg.wait_for_timeout(700)
    chk('بعد از پرداخت قسط', hero() == 36716334 - 2673000, hero())
    chk('تراکنش خودکار', any(t.get('auto') for t in st()['tx']))
    pg.click('#toast button'); pg.wait_for_timeout(500)
    chk('برگرداندن', hero() == 36716334 and not st()['tx'], hero())
    # --- درآمد
    pg.click('[data-act=add][data-type=income]'); pg.wait_for_timeout(500)
    pg.fill('[name=amount]', '5000000'); pg.click('#savetx'); pg.wait_for_timeout(600)
    chk('درآمد', hero() == 36716334 + 5000000, hero())
    # --- برداشت با دسته
    pg.click('[data-act=add][data-type=expense]'); pg.wait_for_timeout(500)
    pg.fill('[name=amount]', '250000'); pg.click('[data-cat="آرایشگاه"]'); pg.click('#savetx'); pg.wait_for_timeout(600)
    chk('برداشت', hero() == 36716334 + 5000000 - 250000, hero())
    chk('دسته ثبت شد', st()['tx'][-1]['cat'] == 'آرایشگاه')
    # --- انتخاب تاریخ با تقویم Vault
    pg.click('[data-act=add][data-type=expense]'); pg.wait_for_timeout(500)
    pg.click('.datebtn'); pg.wait_for_timeout(500)
    chk('تقویم باز شد', pg.locator('.calday').count() >= 28)
    pg.locator('.calday:not([disabled])').nth(0).click(); pg.wait_for_timeout(500)
    chk('تاریخ عوض شد', '۱ ' in pg.inner_text('.datebtn .dt') or '۱' in pg.inner_text('.datebtn .dt'))
    pg.click('[data-close]'); pg.wait_for_timeout(400)
    # --- تراکنش‌ها
    pg.click('.tabbar [data-tab=tx]'); pg.wait_for_timeout(300)
    chk('لیست تراکنش', pg.locator('.txrow').count() == 2)
    pg.locator('.txrow').first.click(); pg.wait_for_timeout(500)
    pg.fill('[name=amount]', '300000'); pg.click('#savetx'); pg.wait_for_timeout(500)
    chk('ویرایش', st()['tx'][-1]['amount'] == 3000000 or any(t['amount'] == 3000000 for t in st()['tx']))
    pg.locator('.txrow').nth(0).click(); pg.wait_for_timeout(400); pg.click('#deltx'); pg.wait_for_timeout(500)
    chk('حذف', len(st()['tx']) == 1)
    # --- وام‌دهنده و خرید اعتباری
    pg.click('.tabbar [data-tab=ob]'); pg.wait_for_timeout(300)
    pg.click('[data-act=newloan][data-kind=credit]'); pg.wait_for_timeout(500)
    chk('پلتفرم‌ها', pg.locator('#lenders .chip').count() == 2)
    pg.fill('#lname', 'لپ‌تاپ'); pg.click('[data-lender="اسنپ‌پی"]'); pg.fill('[name=lamount]', '1000000'); pg.fill('#lcount', '4'); pg.fill('#lpaid', '1'); pg.click('#lsave'); pg.wait_for_timeout(600)
    L = st()['loans'][-1]
    chk('خرید اعتباری', L['kind'] == 'credit' and L['lender'] == 'اسنپ‌پی' and L['cat'] == 'قسط' and len(L['paid']) == 1, L)
    pg.click('[data-act=newloan][data-kind=loan]'); pg.wait_for_timeout(500)
    pg.fill('#lname', 'وام دستی'); pg.fill('#llender', 'بانک نو'); pg.fill('[name=lamount]', '500000'); pg.fill('#lcount', '6'); pg.click('#lsave'); pg.wait_for_timeout(600)
    chk('وام‌دهنده‌ی دستی ذخیره شد', 'بانک نو' in st()['lenders']['loan'] and st()['loans'][-1]['lender'] == 'بانک نو')
    # --- بدهی و طلب
    pg.click('[data-act=obt][data-t=debt]'); pg.wait_for_timeout(300)
    pg.click('[data-act=newdebt][data-dir=owe]'); pg.wait_for_timeout(500)
    pg.fill('#dperson', 'علی'); pg.fill('[name=damount]', '1000000'); pg.click('#dsave'); pg.wait_for_timeout(600)
    pg.click('.tabbar [data-tab=home]'); pg.wait_for_timeout(400); h0 = hero()
    pg.click('.tabbar [data-tab=ob]'); pg.click('[data-act=obt][data-t=debt]'); pg.wait_for_timeout(300)
    pg.click('[data-act=debtd]'); pg.wait_for_timeout(500)
    pg.fill('[name=samount]', '400000'); pg.click('#settle'); pg.wait_for_timeout(700)
    pg.click('.tabbar [data-tab=home]'); pg.wait_for_timeout(500)
    chk('پرداخت بدهی از باقی‌مانده کم شد', hero() == h0 - 400000, (h0, hero()))
    pg.click('.tabbar [data-tab=ob]'); pg.click('[data-act=obt][data-t=debt]'); pg.click('[data-act=newdebt][data-dir=owed]'); pg.wait_for_timeout(500)
    pg.fill('#dperson', 'رضا'); pg.fill('[name=damount]', '200000'); pg.click('#dsave'); pg.wait_for_timeout(600)
    h1 = (pg.click('.tabbar [data-tab=home]'), pg.wait_for_timeout(400), hero())[2]
    pg.click('.tabbar [data-tab=ob]'); pg.click('[data-act=obt][data-t=debt]'); pg.wait_for_timeout(300)
    pg.locator('[data-act=debtd]').filter(has_text='رضا').click(); pg.wait_for_timeout(500)
    pg.click('#settle'); pg.wait_for_timeout(700)
    pg.click('.tabbar [data-tab=home]'); pg.wait_for_timeout(400)
    chk('دریافت طلب به باقی‌مانده اضافه شد', hero() == h1 + 200000, (h1, hero()))
    # --- گزارش
    pg.click('.tabbar [data-tab=rep]'); pg.wait_for_timeout(500)
    chk('KPI', pg.locator('.kpi').count() >= 8, pg.locator('.kpi').count())
    chk('نمودارها', pg.locator('.chart').count() >= 5, pg.locator('.chart').count())
    pg.screenshot(path='/tmp/e_rep.png', full_page=True)
    with pg.expect_download() as dl: pg.click('[data-act=excel]')
    path = dl.value.path(); chk('اکسل', os.path.getsize(path) > 3000)
    pg.click('[data-act=cal]'); pg.wait_for_timeout(900)
    url = pg.evaluate('window.__lastURL || ""'); chk('میان‌بر تقویم', 'Kifam%20Calendar' in url, url)
    clip = json.loads(pg.evaluate('navigator.clipboard.readText()')); chk('رویدادهای تقویم', clip['app'] == 'Kifam' and len(clip['events']) >= 7, len(clip['events']))
    # --- تنظیمات
    pg.click('.tabbar [data-tab=set]'); pg.wait_for_timeout(400)
    pg.fill('[name=balance]', '10000000'); pg.click('[data-act=savebal]'); pg.wait_for_timeout(500)
    pg.click('.tabbar [data-tab=home]'); pg.wait_for_timeout(400); chk('اصلاح باقی‌مانده', hero() == 10000000, hero())
    pg.click('.tabbar [data-tab=set]'); pg.fill('#newlender-credit', 'تست‌پی'); pg.click('[data-act=addlender][data-kind=credit]'); pg.wait_for_timeout(300)
    chk('افزودن پلتفرم', 'تست‌پی' in st()['lenders']['credit'])
    pg.fill('#newcat-expense', 'دسته‌ی تازه'); pg.click('[data-act=addcat]'); pg.wait_for_timeout(300); chk('دسته‌ی جدید', 'دسته‌ی تازه' in st()['categories']['expense'])
    # --- بکاپ و بازگردانی
    with pg.expect_download() as dl: pg.click('[data-act=backup]')
    bpath = dl.value.path(); data = json.load(open(bpath, encoding='utf8')); chk('بکاپ', len(data['loans']) == 9 and data['settings']['opening'] != 0)
    pg.click('[data-act=wipe]'); pg.wait_for_timeout(500)
    chk('پاک شد', len(st()['loans']) == 0 and st()['settings']['opening'] == 0)
    pg.set_input_files('#restore', bpath); pg.wait_for_timeout(700)
    pg.click('.tabbar [data-tab=home]'); pg.wait_for_timeout(300); chk('بازگردانی', hero() == 10000000 and len(st()['loans']) == 9, hero())
    # --- ماندگاری
    pg.reload(); pg.wait_for_timeout(500); chk('ماندگاری بعد از reload', hero() == 10000000)
    # --- لینک‌های ویجت
    pg.goto('http://localhost:8765/index.html#out?a=250000&n=تاکسی'); pg.wait_for_timeout(600)
    chk('لینک ویجت', pg.locator('.overlay [name=amount]').count() == 1 and '۲۵۰٬۰۰۰' in pg.input_value('[name=amount]'))
    # --- بدون اسکرول افقی
    for w in (320, 390, 768):
        pg.set_viewport_size({'width': w, 'height': 800}); pg.reload(); pg.wait_for_timeout(300)
        for tab in ('home', 'tx', 'ob', 'rep', 'set'):
            pg.click(f'.tabbar [data-tab={tab}]'); pg.wait_for_timeout(150)
            chk(f'اسکرول افقی {w}/{tab}', pg.evaluate('document.documentElement.scrollWidth <= window.innerWidth + 1'))
    chk('بدون خطای JS', not errs, errs)
    b.close()
finally:
    srv.kill()
print(f"{R['ok']} بررسی پاس" + (f" | {len(R['bad'])} خطا" if R['bad'] else ''))
for x in R['bad']: print('FAIL', x)
sys.exit(1 if R['bad'] else 0)
