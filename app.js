/* Kifam — اپ ساده‌ی باقی‌مانده، اقساط و بدهی؛ آفلاین و شخصی */
(function () {
  'use strict';
  const C = window.Core;
  const { faNum, faDigits, today, ym, MONTHS } = C;
  const KEY = 'kifam-v1'; // هرگز تغییرش نده؛ داده‌ها با این کلید ذخیره می‌شن
  const VERSION = '۱';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let uidN = 0;
  const uid = () => Date.now().toString(36) + (uidN++).toString(36) + Math.random().toString(36).slice(2, 6);
  const reduceMotion = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- آیکون‌ها (SVG؛ جهتشون در راست‌به‌چپ آینه نمی‌شه) ----------
  const svg = (d, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const IC = {
    right: svg('<path d="m9 5 7 7-7 7"/>'),
    left: svg('<path d="m15 5-7 7 7 7"/>'),
    check: svg('<path d="m5 12.5 4.5 4.5L19 7.5"/>'),
    out: svg('<path d="M12 19V5M6 11l6-6 6 6"/>'),
    in: svg('<path d="M12 5v14M6 13l6 6 6-6"/>'),
    paste: svg('<rect x="7" y="4" width="10" height="4" rx="1.5"/><path d="M8 6H6.5A1.5 1.5 0 0 0 5 7.5v11A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5v-11A1.5 1.5 0 0 0 17.5 6H16M9 13h6M9 16.5h4"/>'),
    cal: svg('<rect x="4" y="5" width="16" height="15" rx="2.5"/><path d="M4 10h16M9 3v4M15 3v4"/>'),
    x: svg('<path d="M6 6l12 12M18 6 6 18"/>'),
    plus: svg('<path d="M12 5v14M5 12h14"/>'),
    swap: svg('<path d="M7 7h11l-3-3M17 17H6l3 3"/>'),
    down: svg('<path d="m6 9 6 6 6-6"/>')
  };

  // ---------- ذخیره‌سازی ----------
  const EXPENSE_CATS = ['وام', 'سایر', 'کادو', 'کرایه', 'غذا', 'کفش و لباس', 'سوپرمارکت', 'آرایشگاه', 'قسط', 'قبوض', 'لوازم جانبی', 'خرید منزل',
    'شارژ ساختمان', 'آرایشی و بهداشتی', 'طلا', 'میوه و سبزیجات', 'سفر', 'کافه', 'هزینه‌های خودرو', 'بنزین', 'دارو و درمان', 'اشتراک‌ها'];
  function defaults() {
    return {
      v: 1,
      settings: { unit: 'toman', opening: 0, lastBackup: null },
      categories: { expense: EXPENSE_CATS.slice() },
      lenders: { loan: ['بلو'], credit: ['اسنپ‌پی', 'دیجی‌پی'] },
      tx: [], loans: [], debts: [], lastCat: {}
    };
  }
  // داده‌ی اولیه‌ی بار اول: موجودی شروع و ۷ قسط فعلی (مبلغ‌ها به تومان)
  function seed() {
    const s = defaults(); s.settings.opening = 367163340;
    const L = [['مسکن ۱', 2673000, 95, '1405/09/13', '', 'loan', 'وام'], ['مسکن ۲', 2014000, 11, '1405/09/13', '', 'loan', 'وام'],
      ['وام الناز', 25850000, 12, '1405/09/13', '', 'loan', 'وام'], ['وام بلو', 5560000, 7, '1405/09/20', 'بلو', 'loan', 'وام'],
      ['۱۰۰ تومنی', 6621438, 18, '1405/09/22', '', 'loan', 'وام'], ['۲۰۰ تومنی', 18815264, 12, '1405/09/22', '', 'loan', 'وام'],
      ['کفش', 2822500, 4, '1405/09/30', '', 'credit', 'قسط']];
    L.forEach(([name, toman, count, due2, lender, kind, cat], k) => {
      const first = C.addMonths(due2, -1, C.jParse(due2).d);
      s.loans.push({ id: 'seed' + k, name, lender, kind, amount: toman * 10, count, first, cat, paid: { 0: { date: first, prior: true } } });
    });
    return s;
  }
  function normalize(d) {
    const s = Object.assign(defaults(), d || {});
    s.settings = Object.assign(defaults().settings, s.settings || {});
    s.categories = Object.assign(defaults().categories, s.categories || {});
    if (!Array.isArray(s.categories.expense)) s.categories.expense = EXPENSE_CATS.slice();
    s.lenders = Object.assign(defaults().lenders, s.lenders || {});
    for (const k of ['loan', 'credit']) if (!Array.isArray(s.lenders[k])) s.lenders[k] = [];
    for (const k of ['tx', 'loans', 'debts']) s[k] = Array.isArray(s[k]) ? s[k].filter(x => x && typeof x === 'object' && x.id) : [];
    s.tx = s.tx.filter(t => typeof t.amount === 'number' && /^\d{4}\/\d{2}\/\d{2}$/.test(t.date || ''));
    s.loans = s.loans.filter(l => l.count > 0 && /^\d{4}\/\d{2}\/\d{2}$/.test(l.first || ''));
    s.loans.forEach(l => { l.paid = l.paid || {}; if (l.kind !== 'credit') l.kind = 'loan'; });
    s.debts.forEach(x => { x.settles = x.settles || []; });
    s.lastCat = s.lastCat || {};
    delete s.fixed; delete s.accounts;
    return s;
  }
  let S;
  function load() {
    try { const raw = localStorage.getItem(KEY); S = raw ? normalize(JSON.parse(raw)) : seed(); if (!raw) save(); }
    catch (e) { S = defaults(); }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(S)); return true; }
    catch (e) { toast('ذخیره نشد: حافظه‌ی مرورگر در دسترس نیست. از داده‌ها بکاپ بگیر.', 'bad'); return false; }
  }

  // ---------- پول ----------
  const unitLabel = () => S.settings.unit === 'toman' ? 'تومان' : 'ریال';
  const disp = rial => S.settings.unit === 'toman' ? rial / 10 : rial;
  const money = (rial, withUnit = true) => faNum(disp(rial)) + (withUnit ? ' ' + unitLabel() : '');
  const toRial = v => S.settings.unit === 'toman' ? v * 10 : v;
  // عدد با علامت (باقی‌مانده می‌تونه منفی باشه)
  const fmtBal = rial => (rial < 0 ? '−' : '') + faNum(disp(Math.abs(rial)));

  // ---------- تاریخ ----------
  const monthName = ymStr => MONTHS[+ymStr.split('/')[1] - 1];
  const monthTitle = ymStr => `${monthName(ymStr)} ${faDigits(ymStr.split('/')[0])}`;
  const dateTitle = js => { const { y, m, d } = C.jParse(js); return `${faDigits(d)} ${MONTHS[m - 1]}${y !== C.jParse(today()).y ? ' ' + faDigits(y) : ''}`; };
  const dateFull = js => { const { y, m, d } = C.jParse(js); return `${faDigits(d)} ${MONTHS[m - 1]} ${faDigits(y)}`; };
  function relDay(js) {
    const n = C.diffDays(today(), js);
    if (n === 0) return 'امروز';
    if (n === 1) return 'فردا';
    if (n === -1) return 'دیروز';
    return n > 0 ? `${faDigits(n)} روز دیگر` : `${faDigits(-n)} روز گذشته`;
  }

  // ---------- فیلدهای فرم ----------
  // تاریخ: دکمه + تقویم ماهانه (datepick.js از Vault)؛ selectهای مخفی منبع مقدارن
  const dateField = (name, value, chips, o) => DatePick.fieldHtml(name, value, { chips, back: 4, fwd: 12, ...o });
  const readDate = (root, name) => DatePick.read(root, name);
  const setDate = (root, name, js) => DatePick.set(root, name, js);
  function ymField(name, value, allowEmpty) {
    const cy = C.jParse(today()).y;
    const [y, m] = value ? value.split('/').map(Number) : [0, 0];
    let ys = allowEmpty ? `<option value="">—</option>` : '';
    for (let i = Math.min(cy - 4, y || cy); i <= Math.max(cy + 12, y || cy); i++) ys += `<option value="${i}" ${i === y ? 'selected' : ''}>${faDigits(i)}</option>`;
    const ms = (allowEmpty ? `<option value="">—</option>` : '') + MONTHS.map((n, i) => `<option value="${i + 1}" ${i + 1 === m ? 'selected' : ''}>${n}</option>`).join('');
    return `<div class="datef ym" data-ym="${name}"><select data-p="m" aria-label="ماه">${ms}</select><select data-p="y" aria-label="سال">${ys}</select></div>`;
  }
  function readYm(root, name) {
    const w = $(`[data-ym="${name}"]`, root);
    const y = $('[data-p=y]', w).value, m = $('[data-p=m]', w).value;
    return y && m ? `${y}/${C.pad(m)}` : null;
  }
  const amountInput = (name, rial, ph) => {
    const shown = rial ? faNum(disp(rial)) : '';
    return `<div class="amtwrap"><input class="amt" name="${name}" inputmode="numeric" autocomplete="off" placeholder="${ph || '۰'}" value="${shown}" data-orig="${rial || ''}" data-init="${shown}"><span>${unitLabel()}</span></div>`;
  };
  function readAmount(root, name) {
    const inp = $(`[name="${name}"]`, root);
    if (inp.dataset.orig && inp.value === inp.dataset.init) return Number(inp.dataset.orig); // مقدار دقیق ریالی دست‌نخورده
    const v = Number(C.normDigits(inp.value).replace(/[^\d]/g, '').slice(0, 15));
    return Math.round(toRial(v || 0));
  }
  const readInt = el => Number(C.normDigits(el.value).replace(/\D/g, '').slice(0, 6)) || 0;

  // ---------- تعهدات ----------
  const findOb = (kind, id) => kind === 'loan' ? S.loans.find(l => l.id === id) : null;
  function getOb(kind, id, key) {
    const rec = findOb(kind, id); if (!rec) return null;
    const month = kind === 'loan' ? ym(C.loanDue(rec, +key)) : key;
    return C.obligationsForMonth(S, month).find(o => o.kind === kind && o.id === id && o.key === String(key)) || null;
  }
  function markPaid(kind, id, key, info) {
    const o = findOb(kind, id); if (!o) return;
    o.paid = o.paid || {}; o.paid[String(key)] = info;
  }
  function unmarkPaid(kind, id, key) {
    const o = findOb(kind, id); if (!o || !o.paid) return;
    const info = o.paid[String(key)]; delete o.paid[String(key)];
    if (info && info.txId) {
      const t = S.tx.find(x => x.id === info.txId);
      if (t) { if (t.auto) S.tx = S.tx.filter(x => x !== t); else delete t.link; }
    }
  }
  function unlinkAllFor(id) { S.tx.forEach(t => { if (t.link && t.link.id === id) delete t.link; }); }
  const obLabel = link => {
    const o = findOb(link.kind, link.id); if (!o) return 'تعهد حذف‌شده';
    return `${o.name}، قسط ${faDigits(+link.key + 1)}`;
  };
  const obDefaultCat = (kind, id) => (findOb(kind, id) || {}).cat || 'وام';

  // ---------- بدهی و طلب ----------
  const debtLeft = d => d.amount - (d.settles || []).reduce((s, x) => s + x.amount, 0);
  const openDebts = () => S.debts.filter(d => debtLeft(d) > 0);
  function debtTotals() {
    let owe = 0, owed = 0;
    openDebts().forEach(d => { if (d.dir === 'owe') owe += debtLeft(d); else owed += debtLeft(d); });
    return { owe, owed };
  }
  const debtTitle = d => (d.dir === 'owe' ? 'بدهکار به ' : 'طلبکار از ') + d.person;

  // ---------- UI عمومی ----------
  let toastTimer;
  function toast(msg, kind, action) {
    const t = $('#toast');
    t.innerHTML = `<span>${esc(msg)}</span>${action ? `<button type="button">${esc(action.label)}</button>` : ''}`;
    t.className = 'show ' + (kind || '');
    if (action) $('button', t).onclick = () => { t.className = ''; action.fn(); };
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.className = ''; }, action ? 5000 : 2800);
  }
  function openSheet(title, html, mount) {
    const ov = document.createElement('div'); ov.className = 'overlay';
    ov.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="grab" aria-hidden="true"></div>
      <div class="sheet-head"><h2>${esc(title)}</h2><button class="iconbtn" data-close aria-label="بستن">${IC.x}</button></div>
      <div class="sheet-body">${html}</div></div>`;
    document.body.appendChild(ov);
    document.body.classList.add('locked');
    requestAnimationFrame(() => requestAnimationFrame(() => ov.classList.add('open')));
    ov.addEventListener('click', e => { if (e.target === ov || e.target.closest('[data-close]')) closeSheet(ov); });
    $$('input.amt', ov).forEach(bindAmount);
    $$('[data-setdate]', ov).forEach(b => b.addEventListener('click', () => {
      setDate(ov, b.closest('[data-date]').dataset.date, C.addDays(today(), +b.dataset.setdate));
    }));
    if (mount) mount(ov);
    return ov;
  }
  function closeSheet(ov) {
    ov = ov || $$('.overlay:not(.closing)').pop(); if (!ov || ov.classList.contains('closing')) return;
    ov.classList.add('closing'); ov.classList.remove('open');
    setTimeout(() => { ov.remove(); if (!$('.overlay')) document.body.classList.remove('locked'); }, reduceMotion() ? 0 : 260);
  }
  const closeAll = () => $$('.overlay').forEach(x => closeSheet(x));
  function bindAmount(inp) {
    inp.addEventListener('input', () => {
      const n = C.normDigits(inp.value).replace(/[^\d]/g, '').slice(0, 15);
      inp.value = n ? faNum(Number(n)) : '';
    });
    inp.addEventListener('focus', () => { if (inp.value) setTimeout(() => inp.select(), 0); });
  }
  function once(btn, fn) { // جلوگیری از ثبت دوباره با دو بار لمس
    btn.addEventListener('click', () => { if (btn.disabled) return; btn.disabled = true; try { if (fn() === false) btn.disabled = false; } catch (e) { btn.disabled = false; throw e; } });
  }

  // شمارش نرم عدد اصلی بعد از تغییر
  const openFolds = new Set();
  document.addEventListener('toggle', e => { const d = e.target; if (d.dataset && d.dataset.fold) d.open ? openFolds.add(d.dataset.fold) : openFolds.delete(d.dataset.fold); }, true);
  const foldAttr = key => `data-fold="${key}" ${openFolds.has(key) ? 'open' : ''}`;
  let lastHero = null;
  function animateHero() {
    const el = $('#heroNum'); if (!el) return;
    const to = Number(el.dataset.v);
    const from = lastHero; lastHero = to;
    if (from === null || from === to || reduceMotion()) return;
    const start = performance.now(), dur = 420;
    const ease = x => 1 - Math.pow(1 - x, 3);
    el.classList.add('ticking');
    const step = now => {
      const p = Math.min(1, (now - start) / dur);
      el.textContent = fmtBal(from + (to - from) * ease(p));
      if (p < 1) requestAnimationFrame(step); else { el.textContent = fmtBal(to); el.classList.remove('ticking'); }
    };
    requestAnimationFrame(step);
  }

  // ---------- صفحه‌ها ----------
  let tab = 'home', txMonth = ym(today()), txFilter = 'all', repMonth = ym(today()), obTab = 'loan';

  function render() {
    $$('.tabbar button').forEach(b => b.setAttribute('aria-current', b.dataset.tab === tab ? 'page' : 'false'));
    const v = $('#view');
    v.innerHTML = ({ home: homeView, tx: txView, ob: obView, rep: repView, set: setView })[tab]();
    $$('input.amt', v).forEach(bindAmount);
    if (tab === 'home') animateHero(); else lastHero = null;
  }
  function go(t) { tab = t; render(); window.scrollTo(0, 0); }

  function obRow(o) {
    const late = !o.paid && o.due < today();
    const soon = !o.paid && !late && C.diffDays(today(), o.due) <= 3;
    return `<li class="ob ${o.paid ? 'paid' : ''} ${late ? 'late' : ''}">
      <button class="tick" data-act="${o.paid ? 'unpay' : 'quickpay'}" data-k="${o.kind}" data-id="${esc(o.id)}" data-key="${esc(o.key)}"
        aria-label="${o.paid ? 'برگرداندن پرداخت' : 'پرداخت'} ${esc(o.name)}" aria-pressed="${o.paid}">${IC.check}</button>
      <button class="ob-body" data-act="pay" data-k="${o.kind}" data-id="${esc(o.id)}" data-key="${esc(o.key)}">
        <span class="ob-main"><strong>${esc(o.name)}</strong><span>${o.sub}، ${dateTitle(o.due)}</span></span>
        <span class="ob-side"><b>${o.variable && !o.paid ? '<i class="approx">حدود</i> ' : ''}${money(o.amount, false)}</b>
        <em class="${late ? 'bad' : soon ? 'warn' : ''}">${o.paid ? 'پرداخت شد' : relDay(o.due)}</em></span>
      </button>
    </li>`;
  }

  function monthStrip(cur, obs) {
    const [y, m] = cur.split('/').map(Number), len = C.monthLen(y, m), t = today(), td = ym(t) === cur ? C.jParse(t).d : 0;
    const byDay = {}; obs.forEach(o => { const d = C.jParse(o.due).d; (byDay[d] = byDay[d] || []).push(o); });
    let cells = '';
    for (let d = 1; d <= len; d++) {
      const list = byDay[d] || [];
      let state = '';
      if (list.length) state = list.every(o => o.paid) ? 'p' : (td && d < td ? 'l' : 'u');
      const lbl = d === 1 || d === len || d % 10 === 0 || d === td;
      cells += `<span class="day ${d === td ? 'today' : ''}" ${list.length ? `title="${faDigits(d)}: ${esc(list.map(o => o.name).join('، '))}"` : ''}>
        ${state ? `<i class="dot ${state}"></i>` : '<i></i>'}${lbl ? `<small>${faDigits(d)}</small>` : ''}</span>`;
    }
    return `<div class="strip" aria-hidden="true">${cells}</div>`;
  }

  function homeView() {
    const t = today(), cur = ym(t), st = C.monthStats(S, cur);
    const bal = C.balance(S), pend = C.pendingTotal(S, cur), after = bal - pend;
    const overdue = C.openObligations(S, cur, -3, -1);
    const unpaidList = overdue.concat(st.obs.filter(o => !o.paid));
    const paidList = st.obs.filter(o => o.paid);
    const backupDays = S.settings.lastBackup ? Math.floor((Date.now() - S.settings.lastBackup) / 864e5) : null;
    const hasData = S.tx.length + S.debts.length > 0;
    const needBackup = hasData && (backupDays === null || backupDays >= 7);
    const { owe, owed } = debtTotals();
    const totalLoanDebt = S.loans.reduce((s, l) => s + C.loanSummary(l).remainingAmount, 0);
    return `
    <header class="top home-top"><div><p class="eyebrow">${C.weekday(t)} ${dateTitle(t)}</p><h1>${monthTitle(cur)}</h1></div><span class="brand" aria-label="Kifam">Kifam</span></header>
    <section class="hero" aria-labelledby="heroLabel">
      <p class="hero-label" id="heroLabel">باقی‌مانده</p>
      <p class="hero-num"><bdi dir="ltr"><span id="heroNum" data-v="${bal}">${fmtBal(bal)}</span></bdi><small>${unitLabel()}</small></p>
      <p class="hero-sub" id="heroAfter">${pend ? `بعد از پرداخت اقساط مانده: <bdi dir="ltr">${fmtBal(after)}</bdi> ${unitLabel()}` : 'قسط پرداخت‌نشده‌ای نداری'}</p>
      ${st.count ? monthStrip(cur, st.obs) : ''}
      <dl class="eq">
        <div><dt>درآمد ${monthName(cur)}</dt><dd>${money(st.income, false)}</dd></div>
        <div><dt>خرج روزمره‌ی ${monthName(cur)}</dt><dd>${money(st.daily, false)}</dd></div>
        <div><dt>اقساط پرداخت‌شده</dt><dd>${money(st.obPaid, false)}</dd></div>
      </dl>
    </section>
    <nav class="quick" aria-label="کارهای سریع">
      <button data-act="add" data-type="income"><span class="qi in">${IC.in}</span>ثبت درآمد</button>
      <button data-act="add" data-type="expense"><span class="qi out">${IC.out}</span>ثبت برداشت</button>
      <button data-act="duelist" class="span2"><span class="qi">${IC.cal}</span>پرداخت قسط</button>
    </nav>
    ${needBackup ? `<div class="banner"><span>${backupDays === null ? 'هنوز از داده‌ها بکاپ نگرفتی.' : `${faDigits(backupDays)} روزه که بکاپ نگرفتی.`} اگه Safari داده‌ها رو پاک کنه یا گوشی عوض بشه، بدون بکاپ از دست می‌رن.</span><button class="btn small" data-act="backup">بکاپ</button></div>` : ''}
    <section class="block">
      <div class="block-head"><h2>اقساط ${monthName(cur)}</h2>${unpaidList.length ? `<span class="count">${faDigits(unpaidList.length)} مانده</span>` : ''}</div>
      ${unpaidList.length ? `<ul class="oblist">${unpaidList.map(obRow).join('')}</ul>` :
        `<p class="empty">${st.count ? 'همه‌ی اقساط این ماه پرداخت شده.' : 'قسطی برای این ماه نیست.'} <button class="linkbtn" data-act="goob">اقساط</button></p>`}
      ${paidList.length ? `<details class="fold" ${foldAttr('homePaid')}><summary>${IC.down}پرداخت‌شده‌ها (${faDigits(paidList.length)})</summary><ul class="oblist">${paidList.map(obRow).join('')}</ul></details>` : ''}
    </section>
    ${totalLoanDebt || owe || owed ? `<section class="block"><h2>کل بدهی و طلب</h2><div class="sums three">
      <button class="sum" data-act="goloan"><span>مانده‌ی اقساط</span><b>${money(totalLoanDebt, false)}</b></button>
      <button class="sum" data-act="godebt"><span>بدهی به اشخاص</span><b class="${owe ? 'neg' : ''}">${money(owe, false)}</b></button>
      <button class="sum" data-act="godebt"><span>طلب از اشخاص</span><b class="${owed ? 'pos' : ''}">${money(owed, false)}</b></button></div></section>` : ''}
    `;
  }

  // دکمه‌ی راست = ماه قبل (فلش به راست)، دکمه‌ی چپ = ماه بعد (فلش به چپ)
  const monthSwitch = (cur, act) => `<div class="mswitch">
    <button data-act="${act}" data-d="-1" aria-label="ماه قبل">${IC.right}</button>
    <strong>${monthTitle(cur)}</strong>
    <button data-act="${act}" data-d="1" aria-label="ماه بعد">${IC.left}</button></div>`;

  function txView() {
    const inMonth = S.tx.filter(t => ym(t.date) === txMonth);
    const list = inMonth.filter(t => txFilter === 'all' || t.type === txFilter)
      .sort((a, b) => (b.date + (b.time || '')).localeCompare(a.date + (a.time || '')) || (b.created || 0) - (a.created || 0));
    const inc = inMonth.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const out = inMonth.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const groups = {}; list.forEach(t => (groups[t.date] = groups[t.date] || []).push(t));
    return `
    <header class="top"><h1>تراکنش‌ها</h1></header>
    ${monthSwitch(txMonth, 'txm')}
    <div class="sums"><div class="sum"><span>درآمد</span><b class="pos">${money(inc)}</b></div><div class="sum"><span>برداشت</span><b class="neg">${money(out)}</b></div></div>
    <div class="chips seg" role="group" aria-label="فیلتر">${[['all', 'همه'], ['expense', 'برداشت'], ['income', 'درآمد'], ['transfer', 'بدهی و طلب']].map(([k, n]) =>
      `<button class="chip ${txFilter === k ? 'on' : ''}" data-act="txf" data-f="${k}" aria-pressed="${txFilter === k}">${n}</button>`).join('')}</div>
    ${list.length ? Object.keys(groups).map(dt => `
      <section class="day-group"><h3>${C.weekday(dt)} ${dateTitle(dt)}</h3><ul class="txlist">${groups[dt].map(txRow).join('')}</ul></section>`).join('')
      : `<p class="empty">توی ${monthTitle(txMonth)} تراکنشی ثبت نشده.</p>`}
    <button class="fab" data-act="chooser" aria-label="ثبت تراکنش">${IC.plus}</button>`;
  }
  function txRow(t) {
    const isT = t.type === 'transfer', up = t.type === 'income' || (isT && t.cash > 0);
    const sign = isT ? (t.cash > 0 ? '+' : t.cash < 0 ? '−' : '') : up ? '+' : '−';
    const title = t.type === 'income' ? 'درآمد' : isT ? 'بدهی و طلب' : (t.cat || 'بدون دسته');
    const icon = catIcon(t.type === 'expense' ? (t.cat || (t.link ? 'قسط' : '')) : null, t.type === 'income' ? 'plus' : 'swap');
    return `<li><button class="txrow" data-act="edit" data-id="${esc(t.id)}">${icon}
      <span class="tx-main"><strong>${esc(title)}</strong>${t.note ? `<span>${esc(t.note)}</span>` : ''}</span>
      <b class="${isT ? (t.cash > 0 ? 'pos' : '') : up ? 'pos' : 'neg'}"><bdi dir="ltr">${sign}${money(t.amount, false)}</bdi></b></button></li>`;
  }

  function obView() {
    const cur = ym(today());
    const loanCard = l => {
      const s = C.loanSummary(l); const pct = Math.round(s.paidCount / l.count * 100);
      return `<li><button class="card loan" data-act="loan" data-id="${esc(l.id)}">
        <div class="lc-top"><strong>${esc(l.name)}</strong><span>${l.kind === 'credit' ? 'خرید اعتباری' : 'وام'}${l.lender ? '، ' + esc(l.lender) : ''}</span></div>
        <div class="meter light" aria-hidden="true"><i style="width:${pct}%"></i></div>
        <div class="lc-grid">
          <div><span>قسط ماهانه</span><b>${money(l.amount, false)}</b></div>
          <div><span>پرداخت‌شده</span><b>${faDigits(s.paidCount)} از ${faDigits(l.count)}</b></div>
          <div><span>مانده‌ی بدهی</span><b>${money(s.remainingAmount, false)}</b></div>
          <div><span>${s.next ? 'قسط بعدی' : 'وضعیت'}</span><b class="${s.next && s.next.due < today() ? 'neg' : ''}">${s.next ? dateTitle(s.next.due) : 'تسویه شد'}</b></div>
        </div>
        ${s.remainingCount ? `<p class="lc-end">آخرین قسط: ${dateFull(s.last)}</p>` : ''}
      </button></li>`;
    };
    const activeL = S.loans.filter(l => C.loanSummary(l).remainingCount > 0), doneL = S.loans.filter(l => C.loanSummary(l).remainingCount <= 0);
    const totalDebt = S.loans.reduce((s, l) => s + C.loanSummary(l).remainingAmount, 0);
    const monthly = C.monthStats(S, cur).obTotal;
    const fold = (title, items, key) => items ? `<details class="fold" ${foldAttr(key)}><summary>${IC.down}${title}</summary><ul class="cards">${items}</ul></details>` : '';
    let body = '';
    if (obTab === 'loan') {
      body = (activeL.length ? `<ul class="cards">${activeL.map(loanCard).join('')}</ul>` : `<p class="empty">${doneL.length ? 'قسط فعالی نداری.' : 'قسطی ثبت نشده. مبلغ قسط، تعداد اقساط و تاریخ اولین قسط رو وارد کن.'}</p>`)
        + fold(`تسویه‌شده‌ها (${faDigits(doneL.length)})`, doneL.map(loanCard).join(''), 'loansDone')
        + `<div class="btnrow"><button class="btn wide" data-act="newloan" data-kind="loan">${IC.plus}وام جدید</button><button class="btn wide ghost" data-act="newloan" data-kind="credit">${IC.plus}خرید اعتباری</button></div>`;
    } else body = debtList();
    return `
    <header class="top"><h1>تعهدات</h1></header>
    ${obTab !== 'debt' ? `<div class="sums"><div class="sum"><span>اقساط ${monthName(cur)}</span><b>${money(monthly)}</b></div><div class="sum"><span>کل مانده‌ی اقساط</span><b>${money(totalDebt)}</b></div></div>` : ''}
    <div class="chips seg" role="group" aria-label="نوع تعهد">${[['loan', 'وام و خرید اعتباری'], ['debt', 'بدهی و طلب']].map(([k, n]) =>
      `<button class="chip ${obTab === k ? 'on' : ''}" data-act="obt" data-t="${k}" aria-pressed="${obTab === k}">${n}</button>`).join('')}</div>
    ${body}`;
  }
  function debtList() {
    const { owe, owed } = debtTotals();
    const open = openDebts().sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999'));
    const done = S.debts.filter(d => debtLeft(d) <= 0).sort((a, b) => (b.closed || '').localeCompare(a.closed || ''));
    const card = d => {
      const left = debtLeft(d), paid = d.amount - left;
      return `<li><button class="card debt ${d.dir}" data-act="debtd" data-id="${esc(d.id)}">
        <div class="lc-top"><strong>${esc(debtTitle(d))}</strong><span>${left > 0 ? (d.due ? 'موعد ' + dateTitle(d.due) : 'بدون موعد') : 'تسویه شد'}</span></div>
        <div class="fx-row"><b class="${left > 0 ? (d.dir === 'owe' ? 'neg' : 'pos') : ''}">${money(left > 0 ? left : d.amount)}</b>${paid > 0 && left > 0 ? `<em>${money(paid, false)} از ${money(d.amount, false)} تسویه شده</em>` : ''}</div>
        ${d.note ? `<p class="lc-end">${esc(d.note)}</p>` : ''}
      </button></li>`;
    };
    return `<div class="sums"><div class="sum"><span>بدهی من</span><b class="neg">${money(owe)}</b></div><div class="sum"><span>طلب من</span><b class="pos">${money(owed)}</b></div></div>
      ${open.length ? `<ul class="cards">${open.map(card).join('')}</ul>` : `<p class="empty">بدهی یا طلب بازی نداری.</p>`}
      ${done.length ? `<details class="fold" ${foldAttr('debtsDone')}><summary>${IC.down}تسویه‌شده‌ها (${faDigits(done.length)})</summary><ul class="cards">${done.map(card).join('')}</ul></details>` : ''}
      <div class="btnrow"><button class="btn wide" data-act="newdebt" data-dir="owe">بدهکارم به…</button><button class="btn wide ghost" data-act="newdebt" data-dir="owed">طلبکارم از…</button></div>`;
  }

  // ---------- نمودارها (SVG دست‌ساز؛ زمان از راست به چپ) ----------
  function shortMoney(rial) {
    const v = Math.abs(disp(rial)), sign = rial < 0 ? '−' : '';
    const f = (x, d) => faDigits((+x.toFixed(d)).toString()).replace('.', '٫');
    if (v >= 1e9) return sign + f(v / 1e9, 1) + ' میلیارد';
    if (v >= 1e6) return sign + f(v / 1e6, v >= 1e8 ? 0 : 1) + ' م';
    if (v >= 1e3) return sign + f(v / 1e3, 0) + ' هزار';
    return sign + faNum(v);
  }
  const pct = (x, d = 0) => x === null || x === undefined || !isFinite(x) ? '—' : faDigits((x * 100).toFixed(d)).replace('.', '٫') + '٪';
  function niceMax(v) {
    if (v <= 0) return 1;
    const p = Math.pow(10, Math.floor(Math.log10(v)));
    for (const f of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (f * p >= v) return f * p;
    return 10 * p;
  }
  const W = 340, PR = 46, PL = 6, PT = 10, PB = 26;
  function axis(max, H) {
    const ph = H - PT - PB; let g = '';
    for (const f of [0, 0.5, 1]) {
      const y = PT + ph * (1 - f);
      g += `<line class="grid" x1="${PL}" x2="${W - PR}" y1="${y}" y2="${y}"/><text class="ax" x="${W - 2}" y="${y + 4}" text-anchor="end">${f ? shortMoney(max * f) : '۰'}</text>`;
    }
    return g;
  }
  // ستونی (انباشته یا گروهی) + خط اختیاری؛ tips: متن هر ستون برای لمس
  function barChart({ labels, series, stacked = true, line = null, tips, H = 180, labelEvery = 1 }) {
    const n = labels.length, pw = W - PR - PL, ph = H - PT - PB, step = pw / n;
    const tot = i => stacked ? series.reduce((s, se) => s + se.values[i], 0) : Math.max(...series.map(se => se.values[i]));
    const max = niceMax(Math.max(1, ...labels.map((_, i) => tot(i)), ...(line ? line.values : [0])));
    const y = v => PT + ph * (1 - v / max);
    let g = axis(max, H), hits = '';
    labels.forEach((lab, i) => {
      const cx = PL + pw - step * (i + 0.5);
      if (stacked) {
        const bw = Math.min(26, step * 0.58); let acc = 0;
        series.forEach(se => { const v = se.values[i]; if (v > 0) { g += `<rect class="${se.cls}" x="${cx - bw / 2}" y="${y(acc + v)}" width="${bw}" height="${Math.max(1, y(acc) - y(acc + v))}" rx="3"/>`; } acc += v; });
      } else {
        const k = series.length, bw = Math.min(16, step * 0.8 / k);
        series.forEach((se, j) => { const v = se.values[i]; const x = cx + (k / 2 - j - 1) * bw; if (v > 0) g += `<rect class="${se.cls}" x="${x + 1}" y="${y(v)}" width="${bw - 2}" height="${Math.max(1, y(0) - y(v))}" rx="3"/>`; });
      }
      if (i % labelEvery === 0) g += `<text class="ax" x="${cx}" y="${H - 8}" text-anchor="middle">${esc(lab)}</text>`;
      hits += `<rect class="hit" x="${cx - step / 2}" y="${PT}" width="${step}" height="${ph}" data-tip="${esc(tips[i])}"/>`;
    });
    if (line) {
      const pts = line.values.map((v, i) => `${PL + pw - step * (i + 0.5)},${y(v)}`);
      g += `<polyline class="ln ${line.cls}" points="${pts.join(' ')}"/>` + line.values.map((v, i) => `<circle class="${line.cls}" cx="${PL + pw - step * (i + 0.5)}" cy="${y(v)}" r="3"/>`).join('');
    }
    return `<svg class="chart-svg" viewBox="0 0 ${W} ${H}" role="img">${g}${hits}</svg>`;
  }
  function lineChart({ labels, series, tips, H = 180, labelEvery = 1, area = false }) {
    const n = labels.length, pw = W - PR - PL, ph = H - PT - PB;
    const max = niceMax(Math.max(1, ...series.flatMap(se => se.values.filter(v => v !== null))));
    const x = i => n === 1 ? PL + pw / 2 : PL + pw - pw * i / (n - 1), y = v => PT + ph * (1 - v / max);
    let g = axis(max, H), hits = '';
    series.forEach(se => {
      const pts = se.values.map((v, i) => v === null ? null : `${x(i)},${y(v)}`).filter(Boolean);
      if (area && pts.length) g += `<polygon class="area ${se.cls}" points="${x(0)},${y(0)} ${pts.join(' ')} ${x(se.values.filter(v => v !== null).length - 1)},${y(0)}"/>`;
      g += `<polyline class="ln ${se.cls} ${se.dash ? 'dash' : ''}" points="${pts.join(' ')}"/>`;
    });
    const step = n > 1 ? pw / (n - 1) : pw;
    labels.forEach((lab, i) => {
      if (lab && i % labelEvery === 0) g += `<text class="ax" x="${x(i)}" y="${H - 8}" text-anchor="middle">${esc(lab)}</text>`;
      hits += `<rect class="hit" x="${x(i) - step / 2}" y="${PT}" width="${step}" height="${ph}" data-tip="${esc(tips[i])}"/>`;
    });
    return `<svg class="chart-svg" viewBox="0 0 ${W} ${H}" role="img">${g}${hits}</svg>`;
  }
  function donut(segs, centerTop, centerBottom) {
    const total = segs.reduce((s, x) => s + x.value, 0) || 1, r = 54, c = 2 * Math.PI * r; let off = 0, g = '';
    segs.forEach(sg => {
      const len = sg.value / total * c;
      g += `<circle class="seg ${sg.cls}" cx="70" cy="70" r="${r}" stroke-dasharray="${Math.max(0, len - 1.5)} ${c}" stroke-dashoffset="${-off}" data-tip="${esc(sg.tip)}"/>`;
      off += len;
    });
    return `<svg class="donut" viewBox="0 0 140 140" role="img"><g transform="rotate(-90 70 70)">${g}</g>
      <text x="70" y="66" text-anchor="middle" class="dc1">${esc(centerTop)}</text><text x="70" y="86" text-anchor="middle" class="dc2">${esc(centerBottom)}</text></svg>`;
  }
  const figure = (title, sub, svgHtml, legend, hint = 'روی نمودار بزن تا عددها رو ببینی') => `<figure class="chart card-block">
    <h2>${title}</h2>${sub ? `<p class="note">${sub}</p>` : ''}${svgHtml}
    ${legend ? `<div class="legend">${legend.map(([cls, name]) => `<span><i class="k ${cls}"></i>${name}</span>`).join('')}</div>` : ''}
    <figcaption class="tip">${hint}</figcaption></figure>`;
  function delta(cur, prev, lowerBetter = true, label = '') {
    if (!prev && !cur) return `<span class="k-s">بدون تغییر</span>`;
    if (!prev) return `<span class="k-s">ماه قبل: ۰</span>`;
    const d = (cur - prev) / prev, up = d > 0, good = lowerBetter ? !up : up;
    if (Math.abs(d) < 0.005) return `<span class="k-s">مثل ${label}</span>`;
    return `<span class="k-s ${good ? 'up-good' : 'up-bad'}">${up ? '▲' : '▼'} ${pct(Math.abs(d))} نسبت به ${label}</span>`;
  }
  const kpi = (label, value, sub, tone = '', help = '') => `<div class="kpi ${tone}" ${help ? `title="${esc(help)}"` : ''}><span class="k-l">${label}</span><b class="k-v">${value}</b>${sub || ''}</div>`;

  function repView() {
    const t = today(), cur = ym(t), K = C.kpis(S, repMonth, t), pm = monthName(K.prev);
    const tone = (v, good, bad, higherBetter = true) => v === null ? '' : higherBetter ? (v >= good ? 'good' : v < bad ? 'bad' : 'warn') : (v <= good ? 'good' : v > bad ? 'bad' : 'warn');
    const cards = [
      kpi('پرداخت به‌موقع', pct(K.onTime.rate), `<span class="k-s">${K.onTime.n ? `${faDigits(K.onTime.ok)} از ${faDigits(K.onTime.n)} پرداخت، ۶ ماه اخیر` : 'هنوز پرداختی ثبت نشده'}</span>`, tone(K.onTime.rate, 0.95, 0.8),
        'درصد اقساطی که تا روز سررسید پرداخت شدن'),
      kpi('پیشرفت اقساط ماه', pct(K.progress), `<span class="k-s">${faDigits(K.paidCount)} از ${faDigits(K.count)} مورد</span>`, K.progress === 1 ? 'good' : ''),
      kpi('بار اقساط ماهانه', shortMoney(K.loanLoad), delta(K.loanLoad, K.loanLoadPrev, true, pm), '', 'جمع اقساط وام‌ها و خریدهای قسطی این ماه'),
      kpi('کل خرج ماه', shortMoney(K.outflow), delta(K.outflow, K.outflowPrev, true, pm), '', 'همه‌ی برداشت‌ها: اقساط و خرج روزمره'),
      kpi('خرج روزمره‌ی روزانه', K.days ? shortMoney(K.dailyAvg) : '—', K.isCur && K.days ? `<span class="k-s">با این روند تا آخر ماه: ${shortMoney(K.dailyProjected)}</span>` : `<span class="k-s">میانگین ${faDigits(K.days)} روز</span>`),
      kpi('کل بدهی وام‌ها', shortMoney(K.debtNow), `<span class="k-s">${K.debtPaidThisMonth ? `${shortMoney(K.debtPaidThisMonth)} کم شد در ${monthName(repMonth)}` : 'در این ماه قسطی پرداخت نشده'}</span>`),
      kpi('آزادی از بدهی', K.debtFree ? monthTitle(K.debtFree) : 'بدهی نداری', `<span class="k-s">${K.debtFree ? `${faDigits(Math.max(0, K.monthsToFree))} ماه دیگه، اگه طبق برنامه پیش بری` : ''}</span>`, K.debtFree ? '' : 'good'),
      kpi('آزاد شدن تا ۳ ماه آینده', K.relief.amount ? shortMoney(K.relief.amount) + ' <small>در ماه</small>' : '—', `<span class="k-s">${K.relief.loans.length ? esc(K.relief.loans.slice(0, 3).join('، ')) + (K.relief.loans.length > 3 ? '…' : '') + ' تموم می‌شن' : 'قسطی در این بازه تموم نمی‌شه'}</span>`, K.relief.amount ? 'good' : ''),
      kpi('سهم اقساط از خرج', pct(K.loanShare), `<span class="k-s">از کل ${shortMoney(K.outflow)}</span>`)
    ];
    if (K.hasIncome) cards.push(
      kpi('نسبت بدهی به درآمد', pct(K.dti), `<span class="k-s">${K.dti <= 0.36 ? 'سالم (زیر ۳۶٪)' : K.dti <= 0.43 ? 'مرزی (۳۶ تا ۴۳٪)' : 'پرخطر (بالای ۴۳٪)'}</span>`, tone(K.dti, 0.36, 0.43, false), 'اقساط ماه تقسیم بر درآمد'),
      kpi('نرخ پس‌انداز', pct(K.savingsRate), `<span class="k-s">درآمد منهای کل خرج</span>`, tone(K.savingsRate, 0.2, 0)));
    else cards.push(`<div class="kpi muted span2"><span class="k-l">با ثبت درآمد</span><span class="k-s">«نسبت بدهی به درآمد» و «نرخ پس‌انداز» هم محاسبه می‌شن.</span></div>`);

    // ۱) تعهدات ۱۲ ماه آینده
    const fc = C.obligationForecast(S, cur, 12);
    const fcChart = barChart({ labels: fc.map(f => monthName(f.ym).slice(0, 3)), labelEvery: 2,
      series: [{ cls: 'c1', values: fc.map(f => f.loans) }],
      tips: fc.map(f => `${monthTitle(f.ym)}: اقساط ${money(f.total)}`) });
    const drop = fc.length > 1 ? fc[0].total - Math.min(...fc.slice(1).map(f => f.total)) : 0;
    // ۲) روند بدهی
    const full = C.debtProjection(S, cur, 240), long = full.length > 25;
    const stepP = full.length > 37 ? Math.ceil((full.length - 1) / 36) : 1;
    const pr = full.filter((p, i) => i === 0 || i % stepP === 0 || i === full.length - 1);
    const yearsSpan = long ? +full[full.length - 1].ym.slice(0, 4) - +cur.slice(0, 4) : 0;
    const prLabels = pr.map((p, i) => {
      if (i === 0) return 'الان';
      if (!long) return i % 3 === 0 ? monthName(p.ym).slice(0, 3) : '';
      const y = +p.ym.slice(0, 4), py = +pr[i - 1].ym.slice(0, 4);
      return y !== py && (yearsSpan <= 8 || y % 2 === 0) ? faDigits(y) : '';
    });
    const prChart = pr.length > 1 ? lineChart({ labels: prLabels, area: true,
      series: [{ cls: 'c1', values: pr.map(p => p.total) }],
      tips: pr.map((p, i) => i === 0 ? `الان: ${money(p.total)} بدهی` : `پایان ${monthTitle(p.ym)}: ${money(p.total)}`) }) : '';
    // ۳) خرج ماه به ماه
    const months = []; for (let i = 0; i < 6; i++) months.push(C.addYm(repMonth, -i));
    const outs = months.map(m => C.monthOutflow(S, m)), incs = months.map(m => C.monthStats(S, m).income);
    const hasInc = incs.some(v => v > 0);
    const mmChart = barChart({ labels: months.map(m => monthName(m).slice(0, 3)),
      series: [{ cls: 'c1', values: outs.map(o => o.loans) }, { cls: 'c4', values: outs.map(o => o.daily) }],
      line: hasInc ? { cls: 'c5', values: incs } : null,
      tips: months.map((m, i) => `${monthTitle(m)}: خرج ${money(outs[i].total)}${hasInc ? `، درآمد ${money(incs[i])}` : ''}`) });
    // ۴) خرج تجمعی: این ماه در برابر ماه قبل
    const cA = C.cumulativeByDay(S, repMonth), cB = C.cumulativeByDay(S, K.prev), L = Math.max(cA.length, cB.length);
    const lastDay = K.isCur ? K.days : cA.length;
    const cumChart = lineChart({ labels: Array.from({ length: L }, (_, i) => (i + 1) % 5 === 0 || i === 0 ? faDigits(i + 1) : ''),
      series: [{ cls: 'c6', dash: true, values: Array.from({ length: L }, (_, i) => i < cB.length ? cB[i] : null) },
               { cls: 'c1', values: Array.from({ length: L }, (_, i) => i < cA.length && i < lastDay ? cA[i] : null) }],
      tips: Array.from({ length: L }, (_, i) => `تا روز ${faDigits(i + 1)}: ${monthName(repMonth)} ${i < lastDay && i < cA.length ? shortMoney(cA[i]) : '—'}، ${pm} ${i < cB.length ? shortMoney(cB[i]) : '—'}`) });
    // ۵) ترکیب خرج بر اساس دسته + مقایسه با ماه قبل
    const catA = C.categoryTotals(S, repMonth), catB = C.categoryTotals(S, K.prev);
    const rows = Object.entries(catA).sort((a, b) => b[1] - a[1]);
    const top = rows.slice(0, 5), rest = rows.slice(5).reduce((s, r) => s + r[1], 0);
    const segs = top.map(([c, v], i) => ({ cls: 'c' + (i + 1), value: v, name: c })).concat(rest ? [{ cls: 'c6', value: rest, name: 'بقیه' }] : []);
    const sumA = rows.reduce((s, r) => s + r[1], 0);
    segs.forEach(sg => { sg.tip = `${sg.name}: ${money(sg.value)} (${pct(sg.value / sumA)})`; });
    const catTable = rows.map(([c, v]) => {
      const p = catB[c] || 0, d = p ? (v - p) / p : null;
      return `<li><span>${esc(c)}</span><b>${shortMoney(v)}</b><em class="${d === null ? '' : d > 0 ? 'up-bad' : 'up-good'}">${d === null ? 'جدید' : (d > 0 ? '▲ ' : '▼ ') + pct(Math.abs(d))}</em></li>`;
    }).join('');
    // ۷) سهم هر وام از بدهی
    const debts = S.loans.map(l => ({ l, r: C.loanSummary(l).remainingAmount })).filter(x => x.r > 0).sort((a, b) => b.r - a.r);
    const dMax = debts.length ? debts[0].r : 1, dSum = debts.reduce((s, x) => s + x.r, 0);

    return `
    <header class="top"><h1>گزارش و شاخص‌ها</h1></header>
    ${monthSwitch(repMonth, 'repm')}
    <section class="kpis" aria-label="شاخص‌ها">${cards.join('')}</section>
    ${figure('اقساط ۱۲ ماه آینده', drop > 0 ? `تا ${monthName(fc.find(f => f.total === Math.min(...fc.slice(1).map(x => x.total))).ym)} ماهانه ${shortMoney(drop)} سبک‌تر می‌شی.` : 'مجموع اقساط هر ماه، از همین ماه.', fcChart, [['c1', 'اقساط']])}
    ${prChart ? figure('روند کاهش بدهی وام‌ها', K.debtFree ? `با پرداخت طبق برنامه، ${monthTitle(K.debtFree)} بدهی صفر می‌شه.` : '', prChart, null) : ''}
    ${figure('خرج ماه به ماه', 'شش ماه منتهی به ' + monthTitle(repMonth), mmChart, [['c1', 'اقساط'], ['c4', 'روزمره']].concat(hasInc ? [['c5', 'درآمد']] : []))}
    ${figure(`خرج تجمعی: ${monthName(repMonth)} در برابر ${pm}`, 'اینکه در هر روز ماه تا اون لحظه چقدر خرج شده.', cumChart, [['c1', monthName(repMonth)], ['c6', pm]])}
    <figure class="chart card-block"><h2>ترکیب خرج ${monthName(repMonth)}</h2>
      ${rows.length ? `<div class="donutwrap">${donut(segs, shortMoney(sumA), 'کل خرج')}<div class="legend col">${segs.map(sg => `<span><i class="k ${sg.cls}"></i>${esc(sg.name)} <b>${pct(sg.value / sumA)}</b></span>`).join('')}</div></div>
      <h3 class="subh">مقایسه‌ی هر دسته با ${pm}</h3><ul class="cmp">${catTable}</ul>
      <figcaption class="tip">روی حلقه بزن تا عددها رو ببینی</figcaption>` : `<p class="empty">خرجی برای این ماه ثبت نشده.</p>`}</figure>
    ${debts.length ? `<section class="card-block chart"><h2>سهم هر وام از بدهی</h2><ul class="catbars">${debts.map(x => `<li><div><span>${esc(x.l.name)}</span><b>${shortMoney(x.r)} <small>${pct(x.r / dSum)}</small></b></div><i style="width:${Math.max(2, x.r / dMax * 100)}%"></i></li>`).join('')}</ul></section>` : ''}
    <section class="block card-block"><h2>خروجی اکسل</h2>
      <p class="note">شاخص‌ها، تراکنش‌ها، خلاصه‌ی ماهانه، خرج هر دسته، اقساط و بدهی و طلب، هر کدوم در یک شیت.</p>
      <div class="formrow"><label>از</label>${ymField('xfrom', C.addYm(cur, -2))}</div>
      <div class="formrow"><label>تا</label>${ymField('xto', cur)}</div>
      <button class="btn wide" data-act="excel">ساخت فایل اکسل</button>
    </section>
    <section class="block card-block" id="calsec"><h2>یادآورها در تقویم آیفون</h2>
      <p class="note">همه‌ی اقساط و موعد بدهی‌های پرداخت‌نشده‌ی ۱۲ ماه آینده، با یک لمس به تقویم «مالی» اضافه می‌شن. یادآورهای قبلی هم خودکار پاک و جایگزین می‌شن.</p>
      <button class="btn wide" data-act="cal">${IC.cal}افزودن به تقویم</button>
      ${SHORTCUT_GUIDE}
    </section>`;
  }

  function setView() {
    const tagList = (items, act, extra) => items.map((c, i) => `<span class="chip tag">${esc(c)}<button data-act="${act}" ${extra} data-i="${i}" aria-label="حذف ${esc(c)}">${IC.x}</button></span>`).join('');
    const days = S.settings.lastBackup ? Math.floor((Date.now() - S.settings.lastBackup) / 864e5) : null;
    const bal = C.balance(S);
    return `
    <header class="top"><h1>تنظیمات</h1></header>
    <section class="block card-block"><h2>اصلاح باقی‌مانده</h2>
      ${amountInput('balance', bal > 0 ? bal : 0)}
      <p class="note">باقی‌مانده‌ی واقعی الانت رو بنویس تا اپ باهاش هماهنگ بشه. بعد از اون، هر درآمد و برداشت که ثبت کنی، خودش حساب می‌شه.</p>
      <button class="btn small" data-act="savebal">ذخیره</button>
    </section>
    <section class="block card-block"><h2>واحد نمایش</h2>
      <div class="chips seg">${[['toman', 'تومان'], ['rial', 'ریال']].map(([k, n]) => `<button class="chip ${S.settings.unit === k ? 'on' : ''}" data-act="unit" data-u="${k}" aria-pressed="${S.settings.unit === k}">${n}</button>`).join('')}</div>
      <p class="note">داده‌ها همیشه به ریال ذخیره می‌شن؛ این فقط نمایش و ورود مبلغ رو عوض می‌کنه.</p>
    </section>
    <section class="block card-block"><h2>دسته‌های خرج</h2><div class="chips wrap">${tagList(S.categories.expense, 'delcat', 'data-type="expense"')}</div>
      <div class="addcat"><input id="newcat-expense" placeholder="دسته‌ی جدید" aria-label="دسته‌ی خرج جدید"><button class="btn small" data-act="addcat" data-type="expense">افزودن</button></div></section>
    <section class="block card-block"><h2>وام‌دهنده‌ها</h2><div class="chips wrap">${tagList(S.lenders.loan, 'dellender', 'data-kind="loan"')}</div>
      <div class="addcat"><input id="newlender-loan" placeholder="وام‌دهنده‌ی جدید" aria-label="وام‌دهنده‌ی جدید"><button class="btn small" data-act="addlender" data-kind="loan">افزودن</button></div></section>
    <section class="block card-block"><h2>پلتفرم‌های خرید اعتباری</h2><div class="chips wrap">${tagList(S.lenders.credit, 'dellender', 'data-kind="credit"')}</div>
      <div class="addcat"><input id="newlender-credit" placeholder="پلتفرم جدید" aria-label="پلتفرم جدید"><button class="btn small" data-act="addlender" data-kind="credit">افزودن</button></div></section>
    <section class="block card-block"><h2>بکاپ</h2>
      <p class="note">${days === null ? 'هنوز بکاپی گرفته نشده.' : days === 0 ? 'آخرین بکاپ: امروز.' : `آخرین بکاپ: ${faDigits(days)} روز پیش.`} فایل بکاپ رو در Files یا iCloud نگه دار. اگه گوشی عوض شد یا داده‌ها پاک شدن، با «بازگردانی» برمی‌گرده.</p>
      <div class="btnrow"><button class="btn" data-act="backup">گرفتن بکاپ</button><label class="btn ghost">بازگردانی از فایل<input type="file" accept=".json,application/json" id="restore" hidden></label></div>
    </section>
    <section class="block card-block help"><h2>راهنما</h2>${HELP}</section>
    <section class="block"><button class="btn danger wide" data-act="wipe">پاک کردن همه‌ی داده‌ها</button></section>
    <p class="ver"><b>Kifam</b> نسخه‌ی ${VERSION}، همه‌ی داده‌ها فقط روی همین گوشی</p>`;
  }

  const SHORTCUT_GUIDE = `<details class="fold guide" data-fold="scguide"><summary>${IC.down}راه‌اندازی یک‌باره (حدود ۵ دقیقه)</summary>
    <ol class="steps">
      <li>در اپ <bdi class="en">Calendar</bdi>، پایین صفحه <bdi class="en">Calendars</bdi> و بعد <bdi class="en">Add Calendar</bdi> رو بزن و یه تقویم به اسم <b>مالی</b> بساز.</li>
      <li>اپ <bdi class="en">Shortcuts</bdi> رو باز کن، <bdi class="en">+</bdi> رو بزن و اسم میان‌بُر رو دقیقاً <bdi class="en">Kifam Calendar</bdi> بذار.</li>
      <li>این اکشن‌ها رو به ترتیب اضافه کن (با جست‌وجوی اسمشون):
        <ol>
          <li><bdi class="en">Get Clipboard</bdi></li>
          <li><bdi class="en">Get Dictionary from Input</bdi></li>
          <li><bdi class="en">Get Dictionary Value</bdi>
            <ul><li>کلید (<bdi class="en">Key</bdi>) رو بنویس <bdi class="en">events</bdi></li></ul></li>
          <li><bdi class="en">Find Calendar Events</bdi>
            <ul><li>فیلتر اول: <bdi class="en">Calendar is</bdi> مالی</li><li>فیلتر دوم: <bdi class="en">Start Date is in the next 2 years</bdi></li></ul></li>
          <li><bdi class="en">Remove Events</bdi>
            <ul><li>گزینه‌ی <bdi class="en">Confirm Before Deleting</bdi> رو خاموش کن</li></ul></li>
          <li><bdi class="en">Repeat with Each</bdi>، ورودیش رو خروجی مرحله‌ی ۳ (<bdi class="en">Dictionary Value</bdi>) بذار. داخل حلقه:
            <ul>
              <li><bdi class="en">Get Dictionary Value</bdi> از <bdi class="en">Repeat Item</bdi>، کلید <bdi class="en">title</bdi></li>
              <li><bdi class="en">Get Dictionary Value</bdi> از <bdi class="en">Repeat Item</bdi>، کلید <bdi class="en">start</bdi></li>
              <li><bdi class="en">Get Dictionary Value</bdi> از <bdi class="en">Repeat Item</bdi>، کلید <bdi class="en">end</bdi></li>
              <li><bdi class="en">Add New Event</bdi> با این تنظیمات:
                <ul><li>عنوان: مقدار <bdi class="en">title</bdi></li><li>تقویم (<bdi class="en">Calendar</bdi>): مالی</li>
                <li>شروع (<bdi class="en">Start Date</bdi>): مقدار <bdi class="en">start</bdi></li><li>پایان (<bdi class="en">End Date</bdi>): مقدار <bdi class="en">end</bdi></li>
                <li>هشدار (<bdi class="en">Alert</bdi>) رو بذار روی <bdi class="en">1 day before</bdi></li></ul></li>
            </ul></li>
          <li>بعد از <bdi class="en">End Repeat</bdi>، اکشن <bdi class="en">Show Notification</bdi> با متن «یادآورها به‌روز شد»</li>
        </ol></li>
      <li>بار اول که اجرا بشه، آیفون برای دسترسی به کلیپ‌بورد و تقویم اجازه می‌خواد؛ <bdi class="en">Always Allow</bdi> رو بزن.</li>
    </ol>
    <p class="note">از این به بعد هر وقت قسطی پرداخت کردی یا وام جدیدی اضافه کردی، «افزودن به تقویم» رو دوباره بزن تا تقویم به‌روز بشه.</p>
  </details>`;

  const HELP = `
  <details class="fold"><summary>${IC.down}باقی‌مانده چطور حساب می‌شه</summary>
    <p>باقی‌مانده = موجودی شروع + همه‌ی درآمدها − همه‌ی برداشت‌ها − اقساط پرداخت‌شده. با هر ثبت یا پرداخت، همون لحظه عوض می‌شه. زیرش می‌بینی بعد از پرداخت اقساط مانده چقدر برات می‌مونه.</p></details>
  <details class="fold"><summary>${IC.down}ثبت درآمد و برداشت</summary>
    <p>درآمد ثابت نیست؛ هر بار که پولی گرفتی «ثبت درآمد» رو بزن و مبلغ رو بنویس. برای برداشت یکی از دسته‌ها رو انتخاب کن.</p></details>
  <details class="fold"><summary>${IC.down}اقساط وام و خرید اعتباری</summary>
    <p>در تب «تعهدات» وام یا خرید اعتباری رو با مبلغ قسط، تعداد و تاریخ اولین قسط اضافه کن. وام‌دهنده یا پلتفرم رو از فهرست انتخاب کن یا دستی بنویس. در صفحه‌ی اول با دایره‌ی تیک، قسط پرداخت می‌شه و از باقی‌مانده کم می‌شه. با «برگرداندن» برمی‌گرده.</p></details>
  <details class="fold"><summary>${IC.down}بدهی و طلب</summary>
    <p>بدهی یا طلب از اشخاص رو در تب «تعهدات» ثبت کن. موقع پرداخت یا دریافت، مبلغ (حتی بخشی از اون) رو تسویه کن. اگه گزینه‌ی «روی باقی‌مانده اعمال بشه» روشن باشه، باقی‌مانده هم تغییر می‌کنه.</p></details>
  <details class="fold"><summary>${IC.down}ویجت دکمه‌های سریع</summary>
    <p>در Shortcuts میان‌بُرهایی بساز که فقط اکشن Open URLs دارن، با آدرس اپ و یکی از این انتهاها: <code>#out</code> برای ثبت برداشت، <code>#in</code> برای ثبت درآمد، <code>#pay</code> برای پرداخت قسط. مبلغ هم می‌شه پیش‌پر کرد: <code>#out?a=250000&amp;n=تاکسی</code>.</p></details>
  <details class="fold"><summary>${IC.down}یادآور اقساط در تقویم</summary>
    <p>در تب گزارش، پایین صفحه، «افزودن به تقویم» رو بزن. بار اول باید میان‌بُر <code>Kifam Calendar</code> رو در Shortcuts بسازی؛ راهنمای قدم‌به‌قدمش همون‌جا زیر دکمه هست.</p></details>`;

  // ---------- فرم تراکنش ----------
  // ---------- آیکون و رنگ دسته‌ها ----------
  const CI = {
    cart: '<path d="M4 5h2l2.2 10h9.3l2-7H7.1"/><circle cx="10" cy="19" r="1.3"/><circle cx="17" cy="19" r="1.3"/>',
    cup: '<path d="M5 9h11v5a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4zM16 10h1.5a2.5 2.5 0 0 1 0 5H16M8 4v2M11.5 4v2"/>',
    car: '<path d="M5 16V11l2-4h10l2 4v5M5 16h14M7.5 16v2M16.5 16v2M4 11h16"/><circle cx="8" cy="13.5" r=".8"/><circle cx="16" cy="13.5" r=".8"/>',
    bolt: '<path d="M13 3 6 13h5l-1 8 7-10h-5z"/>', bag: '<path d="M6 8h12l-1 12H7zM9 8V6a3 3 0 0 1 6 0v2"/>',
    heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
    ticket: '<path d="M4 8a2 2 0 0 0 0 4v4h16v-4a2 2 0 0 0 0-4V4H4zM14 4v16"/>',
    gift: '<rect x="4" y="9" width="16" height="11" rx="1.5"/><path d="M4 13h16M12 9v11M12 9c-2-4-6-4-6-1.5S10 9 12 9zm0 0c2-4 6-4 6-1.5S14 9 12 9z"/>',
    home: '<path d="M4 11 12 4l8 7v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z"/>', dots: '<circle cx="6" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="18" cy="12" r="1"/>',
    work: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5h6v2M3 12h18"/>', pen: '<path d="M4 20l4-1 11-11-3-3L5 16z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>', bank: '<path d="M3 10 12 4l9 6M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18"/>',
    phone: '<rect x="7" y="3" width="10" height="18" rx="2"/><path d="M11 17h2"/>', spark: '<path d="M12 3v5M12 16v5M3 12h5M16 12h5M6 6l3 3M15 15l3 3M6 18l3-3M15 9l3-3"/>',
    shirt: '<path d="M8 4 4 7l2 3 2-1v11h8V9l2 1 2-3-4-3a4 4 0 0 1-8 0z"/>', coin: '<circle cx="12" cy="12" r="8"/><path d="M12 8v8M9.5 10h4a1.5 1.5 0 0 1 0 3h-3a1.5 1.5 0 0 0 0 3h4"/>',
    swap: '<path d="M7 7h11l-3-3M17 17H6l3 3"/>', out: '<path d="M7 17 17 7M8 7h9v9"/>', in: '<path d="M17 7 7 17M16 17H7V8"/>'
  };
  Object.assign(CI, {
    building: '<rect x="5" y="3" width="14" height="18" rx="1.5"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2M11 21v-3h2v3"/>',
    fuel: '<path d="M5 20V5a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v15M4 20h11M5 10h9M14 8l3 3v6a1.5 1.5 0 0 0 3 0V9l-2-2"/>',
    leaf: '<path d="M5 19c0-8 5-13 14-14-1 9-6 14-14 14zM5 19l7-7"/>', plane: '<path d="M10 14 3 11l1-2 8 1 5-6 2 1-3 7 5 3-1 2-6-2-3 5-2-1z"/>',
    scissors: '<circle cx="6" cy="7" r="2.5"/><circle cx="6" cy="17" r="2.5"/><path d="M8 8.5 20 18M8 15.5 20 6"/>', repeat: '<path d="M4 12a7 7 0 0 1 12-5l2 2M20 12a7 7 0 0 1-12 5l-2-2M18 4v5h-5M6 20v-5h5"/>',
    headset: '<path d="M4 14v-2a8 8 0 0 1 16 0v2M4 14h3v5H4zM17 14h3v5h-3z"/>', pill: '<rect x="3" y="9" width="18" height="7" rx="3.5" transform="rotate(-35 12 12.5)"/><path d="M9 8l6 9"/>'
  });
  const CAT_MAP = [
    [/شارژ\s*ساختمان|ساختمان/, 'building', 90], [/بنزین|سوخت/, 'fuel', 15], [/میوه|سبزی/, 'leaf', 120], [/سفر/, 'plane', 195],
    [/آرایشگاه/, 'scissors', 310], [/اشتراک/, 'repeat', 265], [/لوازم\s*جانبی/, 'headset', 240], [/دارو|درمان/, 'pill', 350],
    [/^قسط$/, 'bank', 225], [/خرید\s*منزل/, 'home', 100], [/کفش/, 'shirt', 260], [/خودرو/, 'car', 210], [/^غذا$/, 'cup', 25],
    [/سوپر|خوراک|خواربار|میوه|نان/, 'cart', 150], [/رستوران|کافه|غذا|فست/, 'cup', 25], [/حمل|تاکسی|اسنپ|تپسی|کرایه|بنزین|سوخت|ماشین/, 'car', 210],
    [/قبض|قبوض|شارژ|برق|آب|گاز/, 'bolt', 45], [/خرید|کیف|لوازم/, 'bag', 280], [/سلامت|دارو|پزشک|دکتر|بیمه/, 'heart', 350],
    [/تفریح|سینما|سفر|بازی/, 'ticket', 320], [/هدیه|کادو/, 'gift', 330], [/خانه|اجاره|منزل/, 'home', 100], [/حقوق|دستمزد/, 'work', 140],
    [/پروژه|فریلنس/, 'pen', 190], [/وام|قسط|بانک/, 'bank', 225], [/تلفن|نت|اینترنت|ایرانسل|همراه/, 'phone', 200],
    [/آرایش|زیبایی|آرایشگاه/, 'spark', 300], [/لباس|پوشاک/, 'shirt', 260], [/طلا|سکه|سرمایه/, 'coin', 42], [/درآمد/, 'plus', 140], [/^سایر/, 'dots', 220]
  ];
  function catMeta(name) {
    const n = name || '';
    for (const [re, i, h] of CAT_MAP) if (re.test(n)) return { i, h };
    let h = 0; for (const ch of n) h = (h * 31 + ch.charCodeAt(0)) % 360;
    return { i: null, h, letter: n.trim().charAt(0) || '؟' };
  }
  const catIcon = (name, fallback) => {
    const m = name ? catMeta(name) : { i: fallback || 'dots', h: 220 };
    return `<span class="cat-ic" style="--h:${m.h}" aria-hidden="true">${m.i ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${CI[m.i]}</svg>` : esc(m.letter)}</span>`;
  };
  // پرکاربردها اول: تعداد استفاده در ۹۰ روز اخیر
  function catOrder(type, list) {
    const since = C.addDays(today(), -90), n = {};
    S.tx.forEach(t => { if (t.type === type && t.date >= since && t.cat) n[t.cat] = (n[t.cat] || 0) + 1; });
    return list.map((c, i) => [c, i]).sort((a, b) => (n[b[0]] || 0) - (n[a[0]] || 0) || a[1] - b[1]).map(x => x[0]);
  }

  // ---------- فرم تراکنش ----------
  const withSel = (list, sel) => sel && !list.includes(sel) ? [sel, ...list] : list;
  const catChips = (type, selected) => catOrder(type, withSel(S.categories[type] || [], selected)).map(c => `<button type="button" class="chip cattile ${c === selected ? 'on' : ''}" data-cat="${esc(c)}" aria-pressed="${c === selected}">${catIcon(c)}<span>${esc(c)}</span></button>`).join('');

  function openTxForm(opts = {}) {
    const t = opts.id ? S.tx.find(x => x.id === opts.id) : null;
    if (opts.id && !t) return;
    if (t && t.type === 'transfer') { if (t.debt && S.debts.find(x => x.id === t.debt)) openDebtDetail(t.debt); return; }
    const p = opts.prefill || {};
    const type = t ? t.type : (opts.type === 'income' ? 'income' : 'expense');
    const data = t ? { ...t } : { amount: p.amount || 0, date: today(), note: p.note || '' };
    let cat = t ? (t.cat || '') : (S.lastCat.expense || '');
    const html = `
      <label class="lbl">مبلغ</label>${amountInput('amount', data.amount)}
      <label class="lbl">تاریخ</label>${dateField('date', data.date, true)}
      ${type === 'expense' ? `<label class="lbl">دسته</label><div class="catgrid" id="cats">${catChips('expense', cat)}</div>` : ''}
      ${t && t.link ? `<p class="note">این پرداخت به «${esc(obLabel(t.link))}» وصل است.</p>` : ''}
      <label class="lbl" for="note">توضیح</label><input id="note" value="${esc(data.note || '')}" placeholder="${type === 'income' ? 'مثلاً حقوق، پروژه' : 'اختیاری'}">
      <div class="btnrow"><button class="btn wide" id="savetx">${t ? 'ذخیره‌ی تغییرات' : 'ثبت'}</button>${t ? `<button class="btn danger" id="deltx">حذف</button>` : ''}</div>`;
    openSheet(t ? 'ویرایش تراکنش' : type === 'income' ? 'ثبت درآمد' : 'ثبت برداشت', html, ov => {
      const cg = $('#cats', ov);
      if (cg) cg.addEventListener('click', e => {
        const b = e.target.closest('[data-cat]'); if (!b) return;
        cat = b.dataset.cat; $$('#cats .chip', ov).forEach(c => { c.classList.toggle('on', c === b); c.setAttribute('aria-pressed', c === b); });
      });
      if (!t && !p.amount) setTimeout(() => { const i = $('[name=amount]', ov); if (i) i.focus(); }, 300);
      once($('#savetx', ov), () => {
        const amount = readAmount(ov, 'amount');
        if (!amount) { toast('مبلغ رو وارد کن.', 'bad'); return false; }
        const rec = t || { id: uid(), created: Date.now() };
        Object.assign(rec, { type, amount, date: readDate(ov, 'date'), time: '', cat: type === 'expense' ? (cat || 'سایر') : '', note: $('#note', ov).value.trim() });
        if (!t) S.tx.push(rec);
        if (type === 'expense' && cat) S.lastCat.expense = cat;
        save(); closeSheet(ov); render();
        toast(t ? 'تغییرات ذخیره شد.' : 'ثبت شد.');
      });
      if (t) $('#deltx', ov).addEventListener('click', () => {
        if (!confirm('این تراکنش حذف بشه؟')) return;
        deleteTx(t); save(); closeSheet(ov); render(); toast('حذف شد.');
      });
    });
  }
  function deleteTx(t) {
    if (t.link) { const o = findOb(t.link.kind, t.link.id); if (o && o.paid && o.paid[t.link.key] && o.paid[t.link.key].txId === t.id) delete o.paid[t.link.key]; }
    if (t.debt) { const d = S.debts.find(x => x.id === t.debt); if (d) { d.settles = (d.settles || []).filter(x => x.txId !== t.id); if (debtLeft(d) > 0) delete d.closed; } }
    S.tx = S.tx.filter(x => x !== t);
  }

  function openChooser() {
    openSheet('ثبت تراکنش', `<nav class="quick big">
      <button data-pick="income"><span class="qi in">${IC.in}</span>درآمد</button>
      <button data-pick="expense"><span class="qi out">${IC.out}</span>برداشت</button></nav>`, ov => {
      $('.quick', ov).addEventListener('click', e => {
        const b = e.target.closest('[data-pick]'); if (!b) return;
        closeSheet(ov); openTxForm({ type: b.dataset.pick });
      });
    });
  }

  // ---------- پرداخت ----------
  function openDueList() {
    const body = () => {
      const cur = ym(today()), list = C.openObligations(S, cur, -3, 1);
      if (!list.length) return `<p class="empty">مورد پرداخت‌نشده‌ای نمونده.</p>`;
      const groups = [['عقب‌افتاده', list.filter(o => ym(o.due) < cur)], [monthName(cur) + ' (این ماه)', list.filter(o => ym(o.due) === cur)],
        [monthName(C.addYm(cur, 1)) + ' (ماه بعد)', list.filter(o => ym(o.due) > cur)]];
      return groups.filter(g => g[1].length).map(([t, l]) => `<h3 class="grp">${t}</h3><ul class="oblist">${l.map(obRow).join('')}</ul>`).join('');
    };
    openSheet('پرداخت قسط یا قبض', body(), ov => { ov._refresh = () => { $('.sheet-body', ov).innerHTML = body(); }; });
  }
  // پرداخت یک‌لمسی برای مبلغ ثابت؛ مورد متغیر مبلغ واقعی رو می‌پرسه
  function quickPay(kind, id, key) {
    const o = getOb(kind, id, key); if (!o || o.paid) return;
    if (o.variable) { openPay(kind, id, key); return; }
    const t = { id: uid(), created: Date.now(), type: 'expense', amount: o.estimate, date: today(), time: '', cat: obDefaultCat(kind, id),
      account: '', note: `${o.name}، ${o.sub}`, link: { kind, id, key: String(key) }, auto: true };
    S.tx.push(t); markPaid(kind, id, key, { date: t.date, txId: t.id });
    save(); refreshSheets(); render();
    toast(`${o.name}: ${money(o.estimate)} پرداخت شد.`, '', { label: 'برگرداندن', fn: () => { unmarkPaid(kind, id, key); save(); refreshSheets(); render(); } });
  }
  // ورقه‌های باز (لیست سررسیدها، جزئیات وام) بعد از هر تغییر همون لحظه تازه می‌شن
  function refreshSheets() { $$('.overlay:not(.closing)').forEach(ov => { if (ov._refresh) ov._refresh(); }); }
  function askUnpay(kind, id, key) {
    const o = getOb(kind, id, key); if (!o) return;
    if (!confirm(`پرداخت «${o.name}» برگرده به پرداخت‌نشده؟`)) return;
    unmarkPaid(kind, id, key); save(); refreshSheets(); render(); toast('برگردانده شد.');
  }
  function openPay(kind, id, key) {
    const o = getOb(kind, id, key); if (!o) return;
    if (o.paid) { askUnpay(kind, id, key); return; }
    const recent = S.tx.filter(t => t.type === 'expense' && !t.link && Math.abs(C.diffDays(t.date, today())) <= 45)
      .sort((a, b) => b.date.localeCompare(a.date)).slice(0, 25);
    const html = `
      <p class="payhead"><strong>${esc(o.name)}</strong><span>${o.sub}، سررسید ${dateFull(o.due)}</span></p>
      ${o.variable ? `<p class="smsinfo">مبلغ پیش‌بینی: ${money(o.estimate)}. مبلغ واقعی رو وارد کن.</p>` : ''}
      <label class="check"><input type="checkbox" id="already"> قبلاً به‌عنوان برداشت ثبتش کردم</label>
      <div id="newpay">
        <label class="lbl">${o.variable ? 'مبلغ واقعی' : 'مبلغ پرداختی'}</label>${amountInput('amount', o.estimate)}
        <label class="lbl">تاریخ پرداخت</label>${dateField('date', today(), true)}
      </div>
      <div id="pickpay" hidden>
        <label class="lbl" for="pick">کدوم تراکنش؟</label>
        <select id="pick"><option value="">فقط علامت بزن، به تراکنشی وصل نکن</option>${recent.map(t => `<option value="${esc(t.id)}">${dateTitle(t.date)}، ${money(t.amount)}${t.note ? '، ' + esc(t.note) : ''}</option>`).join('')}</select>
      </div>
      <button class="btn wide" id="dopay">${IC.check}ثبت پرداخت</button>`;
    openSheet('ثبت پرداخت', html, ov => {
      if (o.variable) setTimeout(() => { const i = $('[name=amount]', ov); if (i) { i.focus(); i.select(); } }, 300);
      $('#already', ov).addEventListener('change', e => { $('#newpay', ov).hidden = e.target.checked; $('#pickpay', ov).hidden = !e.target.checked; });
      once($('#dopay', ov), () => {
        if ($('#already', ov).checked) {
          const tt = S.tx.find(x => x.id === $('#pick', ov).value);
          if (tt) { tt.link = { kind, id, key: String(key) }; markPaid(kind, id, key, { date: tt.date, txId: tt.id }); }
          else markPaid(kind, id, key, { date: today() });
        } else {
          const amount = readAmount(ov, 'amount'); if (!amount) { toast('مبلغ رو وارد کن.', 'bad'); return false; }
          const tt = { id: uid(), created: Date.now(), type: 'expense', amount, date: readDate(ov, 'date'), time: '', cat: obDefaultCat(kind, id),
            account: '', note: `${o.name}، ${o.sub.replace('، پیش‌بینی', '')}`, link: { kind, id, key: String(key) }, auto: true };
          S.tx.push(tt); markPaid(kind, id, key, { date: tt.date, txId: tt.id });
        }
        save(); closeSheet(ov); refreshSheets(); render(); toast('پرداخت ثبت شد.');
      });
    });
  }

  // ---------- وام و خرید اعتباری ----------
  function openLoanForm(id, presetKind) {
    const l = id ? S.loans.find(x => x.id === id) : null;
    let kind = l ? l.kind : (presetKind === 'credit' ? 'credit' : 'loan');
    let lender = l ? (l.lender || '') : '';
    const lenderChips = () => withSel(S.lenders[kind] || [], lender).map(n => `<button type="button" class="chip ${n === lender ? 'on' : ''}" data-lender="${esc(n)}" aria-pressed="${n === lender}">${esc(n)}</button>`).join('');
    const html = `
      <div class="chips seg" id="lkind" role="group" aria-label="نوع">${[['loan', 'وام'], ['credit', 'خرید اعتباری']].map(([k, n]) => `<button type="button" class="chip ${kind === k ? 'on' : ''}" data-k="${k}" aria-pressed="${kind === k}">${n}</button>`).join('')}</div>
      <label class="lbl" for="lname">نام</label><input id="lname" value="${esc(l ? l.name : '')}" placeholder="مثلاً وام مسکن یا کفش">
      <label class="lbl" id="llbl">${kind === 'credit' ? 'پلتفرم خرید اعتباری' : 'وام‌دهنده'}</label>
      <div class="chips wrap" id="lenders">${lenderChips()}</div>
      <input id="llender" placeholder="یا نام دیگری رو دستی بنویس" aria-label="نام دستی">
      <label class="lbl">مبلغ هر قسط</label>${amountInput('lamount', l ? l.amount : 0)}
      <label class="lbl" for="lcount">تعداد کل اقساط</label><input id="lcount" inputmode="numeric" value="${l ? faDigits(l.count) : ''}" placeholder="مثلاً ۱۲">
      <label class="lbl">تاریخ سررسید اولین قسط</label>${dateField('lfirst', l ? l.first : today())}
      <p class="note">اقساط بعدی هر ماه همین روز سررسید دارن؛ اگه ماهی این روز رو نداشت، آخرین روز همون ماه حساب می‌شه.</p>
      ${!l ? `<label class="lbl" for="lpaid">چند قسط تا حالا پرداخت شده؟</label><input id="lpaid" inputmode="numeric" placeholder="۰">` : ''}
      <div class="btnrow"><button class="btn wide" id="lsave">${l ? 'ذخیره‌ی تغییرات' : 'افزودن'}</button>${l ? `<button class="btn danger" id="ldel">حذف</button>` : ''}</div>`;
    openSheet(l ? 'ویرایش' : kind === 'credit' ? 'خرید اعتباری جدید' : 'وام جدید', html, ov => {
      const repaint = () => { $('#lenders', ov).innerHTML = lenderChips(); $('#llbl', ov).textContent = kind === 'credit' ? 'پلتفرم خرید اعتباری' : 'وام‌دهنده'; };
      $('#lkind', ov).addEventListener('click', e => {
        const b = e.target.closest('[data-k]'); if (!b) return;
        kind = b.dataset.k; lender = ''; $$('#lkind .chip', ov).forEach(c => { c.classList.toggle('on', c === b); c.setAttribute('aria-pressed', c === b); }); repaint();
      });
      $('#lenders', ov).addEventListener('click', e => {
        const b = e.target.closest('[data-lender]'); if (!b) return;
        lender = lender === b.dataset.lender ? '' : b.dataset.lender; $('#llender', ov).value = ''; repaint();
      });
      $('#llender', ov).addEventListener('input', () => { if ($('#llender', ov).value.trim() && lender) { lender = ''; repaint(); } });
      once($('#lsave', ov), () => {
        const name = $('#lname', ov).value.trim(), amount = readAmount(ov, 'lamount'), count = readInt($('#lcount', ov));
        if (!name || !amount || !count || count > 600) { toast('نام، مبلغ قسط و تعداد اقساط (۱ تا ۶۰۰) لازمه.', 'bad'); return false; }
        const typed = $('#llender', ov).value.trim().slice(0, 40), ln = typed || lender;
        if (ln && !S.lenders[kind].includes(ln)) S.lenders[kind].push(ln);
        const rec = l || { id: uid(), paid: {} };
        const kindChanged = l && l.kind !== kind;
        Object.assign(rec, { name, kind, lender: ln, amount, count, first: readDate(ov, 'lfirst'),
          cat: l && !kindChanged ? (l.cat || 'وام') : (kind === 'credit' ? 'قسط' : 'وام') });
        if (!l) {
          const pc = Math.min(count, readInt($('#lpaid', ov)));
          for (let i = 0; i < pc; i++) rec.paid[i] = { date: C.loanDue(rec, i), prior: true };
          S.loans.push(rec);
        } else Object.keys(rec.paid).forEach(k => { if (+k >= count) unmarkPaid('loan', rec.id, k); });
        save(); closeAll(); obTab = 'loan'; render(); toast(l ? 'ذخیره شد.' : 'اضافه شد.');
      });
      if (l) $('#ldel', ov).addEventListener('click', () => {
        if (!confirm(`«${l.name}» و سابقه‌ی اقساطش حذف بشه؟ تراکنش‌هایی که ثبت شدن می‌مونن.`)) return;
        unlinkAllFor(l.id); S.loans = S.loans.filter(x => x !== l); save(); closeAll(); render(); toast('حذف شد.');
      });
    });
  }
  function loanDetailHtml(l) {
    const s = C.loanSummary(l), t = today();
    let rows = '';
    for (let i = 0; i < l.count; i++) {
      const due = C.loanDue(l, i), paid = l.paid && l.paid[i];
      rows += `<li class="${paid ? 'paid' : due < t ? 'late' : ''}"><button data-inst="${i}">
        <span class="n">${faDigits(i + 1)}</span><span>${dateFull(due)}</span>
        <em>${paid ? (paid.prior ? 'پرداخت‌شده (قبلی)' : 'پرداخت شد') : due < t ? 'عقب‌افتاده' : ''}</em></button></li>`;
    }
    return `
      <div class="sums"><div class="sum"><span>مانده‌ی بدهی</span><b>${money(s.remainingAmount)}</b></div><div class="sum"><span>اقساط باقی‌مانده</span><b>${faDigits(s.remainingCount)} از ${faDigits(l.count)}</b></div></div>
      ${l.total ? `<p class="note">مبلغ کل: ${money(l.total)}</p>` : ''}
      <p class="note">روی هر قسط بزن تا پرداختش رو ثبت کنی یا برگردونیش.</p>
      <ul class="inst">${rows}</ul>
      <button class="btn wide ghost" data-ledit>ویرایش</button>`;
  }
  function openLoanDetail(id) {
    const l0 = S.loans.find(x => x.id === id); if (!l0) return;
    openSheet(l0.name, loanDetailHtml(l0), ov => {
      const body = $('.sheet-body', ov);
      ov._refresh = () => { const l = S.loans.find(x => x.id === id); if (!l) { closeSheet(ov); return; } const top = ov.querySelector('.sheet').scrollTop; body.innerHTML = loanDetailHtml(l); ov.querySelector('.sheet').scrollTop = top; };
      const nextLi = $('.inst li:not(.paid)', ov); if (nextLi) setTimeout(() => nextLi.scrollIntoView({ block: 'center' }), 60);
      body.addEventListener('click', e => {
        const l = S.loans.find(x => x.id === id); if (!l) return;
        if (e.target.closest('[data-ledit]')) { openLoanForm(l.id); return; }
        const b = e.target.closest('[data-inst]'); if (!b) return;
        const i = b.dataset.inst;
        if (l.paid && l.paid[i]) {
          if (!confirm('این قسط به «پرداخت‌نشده» برگرده؟')) return;
          unmarkPaid('loan', l.id, i); save(); refreshSheets(); render();
        } else openPay('loan', l.id, i);
      });
    });
  }

  // ---------- بدهی و طلب ----------
  function openDebtForm(id, dir) {
    const d = id ? S.debts.find(x => x.id === id) : null;
    dir = d ? d.dir : dir || 'owe';
    const people = [...new Set(S.debts.map(x => x.person))];
    const html = `
      <div class="chips seg" id="ddir" role="group">${[['owe', 'بدهکارم به'], ['owed', 'طلبکارم از']].map(([k, n]) => `<button type="button" class="chip ${dir === k ? 'on' : ''}" data-d="${k}" aria-pressed="${dir === k}">${n}</button>`).join('')}</div>
      <label class="lbl" for="dperson">شخص</label><input id="dperson" list="dpeople" value="${esc(d ? d.person : '')}" placeholder="نام">
      <datalist id="dpeople">${people.map(p => `<option value="${esc(p)}">`).join('')}</datalist>
      <label class="lbl">مبلغ</label>${amountInput('damount', d ? d.amount : 0)}
      <label class="lbl">تاریخ</label>${dateField('ddate', d ? d.date : today(), true)}
      <label class="check"><input type="checkbox" id="hasdue" ${d && d.due ? 'checked' : ''}> موعد تسویه داره</label>
      <div id="duewrap" ${d && d.due ? '' : 'hidden'}><label class="lbl">موعد تسویه</label>${dateField('ddue', d && d.due ? d.due : C.addMonths(today(), 1))}</div>
      <label class="lbl" for="dnote">توضیح</label><input id="dnote" value="${esc(d ? d.note : '')}" placeholder="اختیاری">
      <div class="btnrow"><button class="btn wide" id="dsave">${d ? 'ذخیره‌ی تغییرات' : 'ثبت'}</button>${d ? `<button class="btn danger" id="ddel">حذف</button>` : ''}</div>`;
    openSheet(d ? 'ویرایش' : 'بدهی یا طلب جدید', html, ov => {
      $('#ddir', ov).addEventListener('click', e => { const b = e.target.closest('[data-d]'); if (!b) return; dir = b.dataset.d; $$('#ddir .chip', ov).forEach(c => { c.classList.toggle('on', c === b); c.setAttribute('aria-pressed', c === b); }); });
      $('#hasdue', ov).addEventListener('change', e => { $('#duewrap', ov).hidden = !e.target.checked; });
      if (!d) setTimeout(() => { const i = $('#dperson', ov); if (i) i.focus(); }, 300);
      once($('#dsave', ov), () => {
        const person = $('#dperson', ov).value.trim(), amount = readAmount(ov, 'damount');
        if (!person || !amount) { toast('نام شخص و مبلغ لازمه.', 'bad'); return false; }
        const rec = d || { id: uid(), settles: [] };
        Object.assign(rec, { dir, person, amount, date: readDate(ov, 'ddate'), due: $('#hasdue', ov).checked ? readDate(ov, 'ddue') : null, note: $('#dnote', ov).value.trim() });
        if (debtLeft(rec) > 0) delete rec.closed; else if (!rec.closed) rec.closed = today();
        if (!d) S.debts.push(rec);
        save(); closeAll(); obTab = 'debt'; render(); toast(d ? 'ذخیره شد.' : 'ثبت شد.');
      });
      if (d) $('#ddel', ov).addEventListener('click', () => {
        if (!confirm(`«${debtTitle(d)}» حذف بشه؟`)) return;
        S.tx.forEach(t => { if (t.debt === d.id) delete t.debt; });
        S.debts = S.debts.filter(x => x !== d); save(); closeAll(); render(); toast('حذف شد.');
      });
    });
  }
  function openDebtDetail(id) {
    const d = S.debts.find(x => x.id === id); if (!d) return;
    const left = debtLeft(d), verb = d.dir === 'owe' ? 'پرداخت' : 'دریافت';
    const hist = (d.settles || []).map((x, i) => `<li><span>${dateFull(x.date)}</span><b>${money(x.amount)}</b><button class="iconbtn sm" data-undo="${i}" aria-label="حذف این ${verb}">${IC.x}</button></li>`).join('');
    const html = `
      <div class="sums"><div class="sum"><span>کل مبلغ</span><b>${money(d.amount)}</b></div><div class="sum"><span>باقی‌مانده</span><b class="${left > 0 ? (d.dir === 'owe' ? 'neg' : 'pos') : ''}">${money(Math.max(left, 0))}</b></div></div>
      <p class="note">از ${dateFull(d.date)}${d.due ? `، موعد ${dateFull(d.due)}` : ''}${d.note ? `، ${esc(d.note)}` : ''}</p>
      ${left > 0 ? `
        <label class="lbl">مبلغ ${verb}</label>${amountInput('samount', left)}
        <p class="note">برای تسویه‌ی بخشی از مبلغ، عدد رو کمتر کن.</p>
        <label class="lbl">تاریخ</label>${dateField('sdate', today(), true)}
        <label class="check"><input type="checkbox" id="stx" checked> ${d.dir === 'owe' ? 'از باقی‌مانده کم بشه' : 'به باقی‌مانده اضافه بشه'} (در تراکنش‌ها ثبت می‌شه)</label>
        <button class="btn wide" id="settle">ثبت ${verb}</button>` : ''}
      ${hist ? `<h3 class="subh">سابقه‌ی ${verb}‌ها</h3><ul class="settles">${hist}</ul>` : ''}
      <button class="btn wide ghost" id="dedit">ویرایش</button>`;
    openSheet(debtTitle(d), html, ov => {
      if (left > 0) once($('#settle', ov), () => {
        const amount = Math.min(readAmount(ov, 'samount'), left); if (!amount) { toast('مبلغ رو وارد کن.', 'bad'); return false; }
        const date = readDate(ov, 'sdate'), rec = { amount, date };
        if ($('#stx', ov).checked) {
          const t = { id: uid(), created: Date.now(), type: 'transfer', amount, date, time: '', cat: '', cash: d.dir === 'owe' ? -1 : 1,
            note: `${d.dir === 'owe' ? 'پرداخت بدهی به' : 'دریافت طلب از'} ${d.person}`, debt: d.id };
          S.tx.push(t); rec.txId = t.id;
        }
        d.settles.push(rec);
        if (debtLeft(d) <= 0) d.closed = date;
        save(); closeAll(); render(); toast(debtLeft(d) <= 0 ? 'تسویه شد.' : `${verb} ثبت شد.`);
      });
      $$('[data-undo]', ov).forEach(b => b.addEventListener('click', () => {
        if (!confirm(`این ${verb} حذف بشه؟`)) return;
        const [x] = d.settles.splice(+b.dataset.undo, 1);
        if (x && x.txId) S.tx = S.tx.filter(t => t.id !== x.txId);
        if (debtLeft(d) > 0) delete d.closed;
        save(); closeSheet(ov); render(); setTimeout(() => openDebtDetail(d.id), 280);
      }));
      $('#dedit', ov).addEventListener('click', () => openDebtForm(d.id));
    });
  }

  // ---------- خروجی‌ها ----------
  async function shareFile(blob, name, type) {
    const file = new File([blob], name, { type });
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: name }); return true; }
    } catch (e) { if (e && e.name === 'AbortError') return false; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    return true;
  }
  const typeFa = { expense: 'برداشت', income: 'درآمد', transfer: 'بدهی و طلب' };

  function exportExcel() {
    if (!window.XLSX) { toast('کتابخانه‌ی اکسل هنوز بارگذاری نشده. چند ثانیه بعد دوباره بزن.', 'bad'); return; }
    const root = $('#view'); let from = readYm(root, 'xfrom'), to = readYm(root, 'xto');
    if (from > to) [from, to] = [to, from];
    const months = []; for (let m = from; m <= to && months.length < 240; m = C.addYm(m, 1)) months.push(m);
    const inRange = t => ym(t.date) >= from && ym(t.date) <= to;
    const txs = S.tx.filter(inRange).sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
    const X = window.XLSX, wb = X.utils.book_new();
    const add = (rows, name, widths) => { const ws = X.utils.aoa_to_sheet(rows); ws['!cols'] = widths.map(w => ({ wch: w })); X.utils.book_append_sheet(wb, ws, name); };
    const r4 = x => x === null || !isFinite(x) ? '' : Math.round(x * 10000) / 10000;
    add([['ماه', 'کل خرج (ریال)', 'اقساط', 'روزمره', 'درآمد', 'بار اقساط', 'پیشرفت اقساط', 'پرداخت به‌موقع (۶ ماه)', 'سهم اقساط از خرج', 'نسبت بدهی به درآمد', 'نرخ پس‌انداز']]
      .concat(months.map(m => { const k = C.kpis(S, m, today());
        return [monthTitle(m), k.outflow, k.outParts.loans, k.outParts.daily, k.income, k.loanLoad, r4(k.progress), r4(k.onTime.rate), r4(k.loanShare), r4(k.dti), r4(k.savingsRate)]; })),
      'شاخص‌ها', [14, 16, 14, 14, 14, 14, 14, 18, 16, 18, 12]);
    add([['تاریخ', 'نوع', 'دسته', 'مبلغ (ریال)', 'مبلغ (تومان)', 'توضیح', 'مربوط به']]
      .concat(txs.map(t => [t.date, typeFa[t.type], t.cat || '', t.amount, t.amount / 10, t.note || '', t.link ? obLabel(t.link) : ''])),
      'تراکنش‌ها', [12, 14, 16, 16, 14, 32, 26]);
    add([['ماه', 'درآمد (ریال)', 'کل اقساط', 'اقساط پرداخت‌شده', 'اقساط مانده', 'خرج روزمره', 'کل خرج']]
      .concat(months.map(m => { const s = C.monthStats(S, m); return [monthTitle(m), s.income, s.obTotal, s.obPaid, s.obRemaining, s.daily, s.obPaid + s.daily]; })),
      'خلاصه ماهانه', [16, 16, 16, 18, 16, 16, 16]);
    const catOf = t => t.link ? 'اقساط' : (t.cat || 'سایر');
    const exp = txs.filter(t => t.type === 'expense');
    const cats = [...new Set(exp.map(catOf))];
    add([['دسته'].concat(months.map(monthTitle), ['جمع'])].concat(cats.map(c => {
      const vals = months.map(m => exp.filter(t => ym(t.date) === m && catOf(t) === c).reduce((s, t) => s + t.amount, 0));
      return [c].concat(vals, [vals.reduce((a, b) => a + b, 0)]);
    })), 'خرج هر دسته', [18].concat(months.map(() => 14), [16]));
    add([['نام', 'نوع', 'وام‌دهنده/پلتفرم', 'مبلغ قسط (ریال)', 'تعداد کل', 'پرداخت‌شده', 'باقی‌مانده', 'مانده‌ی بدهی (ریال)', 'اولین قسط', 'آخرین قسط', 'قسط بعدی']]
      .concat(S.loans.map(l => { const s = C.loanSummary(l); return [l.name, l.kind === 'credit' ? 'خرید اعتباری' : 'وام', l.lender || '', l.amount, l.count, s.paidCount, s.remainingCount, s.remainingAmount, l.first, s.last, s.next ? s.next.due : 'تسویه']; })),
      'اقساط', [22, 14, 16, 16, 9, 10, 10, 18, 12, 12, 12]);
    add([['نوع', 'شخص', 'مبلغ (ریال)', 'تسویه‌شده', 'باقی‌مانده', 'تاریخ', 'موعد', 'توضیح']]
      .concat(S.debts.map(d => [d.dir === 'owe' ? 'بدهکارم به' : 'طلبکارم از', d.person, d.amount, d.amount - Math.max(debtLeft(d), 0), Math.max(debtLeft(d), 0), d.date, d.due || '', d.note || ''])),
      'بدهی و طلب', [12, 18, 16, 16, 16, 12, 12, 30]);
    wb.Workbook = { Views: [{ RTL: true }] };
    const buf = X.write(wb, { bookType: 'xlsx', type: 'array' });
    const mime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    shareFile(new Blob([buf], { type: mime }), `kifam-${from.replace('/', '-')}_${to.replace('/', '-')}.xlsx`, mime);
  }

  // سررسیدهای پرداخت‌نشده‌ی ۱۲ ماه آینده + موعد بدهی و طلب
  function upcomingItems() {
    const t = today(), cur = ym(t), map = C.txAmountMap(S);
    let obs = [];
    for (let i = 0; i <= 12; i++) obs = obs.concat(C.obligationsForMonth(S, C.addYm(cur, i), map));
    obs = obs.filter(o => !o.paid && o.due >= t);
    openDebts().filter(d => d.due && d.due >= t).forEach(d => obs.push({ kind: 'debt', id: d.id, key: 'd', due: d.due,
      name: debtTitle(d), sub: d.dir === 'owe' ? 'موعد پرداخت بدهی' : 'موعد دریافت طلب', amount: debtLeft(d), variable: false }));
    return obs.sort((a, b) => a.due.localeCompare(b.due));
  }
  const SHORTCUT_NAME = 'Kifam Calendar';
  const openURL = u => (window.__kifamOpenURL || (x => { window.location.href = x; }))(u);
  // داده‌ی میان‌بُر Shortcuts: JSON ساده با تاریخ میلادی که Shortcuts مستقیم می‌فهمه
  function calendarPayload() {
    const g = js => { const x = C.toG(js); return `${x.gy}-${C.pad(x.gm)}-${C.pad(x.gd)}`; };
    return { app: 'Kifam', events: upcomingItems().map(o => ({
      title: `${o.kind === 'loan' ? 'قسط ' : ''}${o.name}: ${o.variable ? 'حدود ' : ''}${money(o.amount)}`,
      start: `${g(o.due)} 09:00`, end: `${g(o.due)} 09:30`,
      notes: `${o.sub}، سررسید ${dateFull(o.due)} (Kifam)` })) };
  }
  async function sendToCalendar() {
    const data = calendarPayload();
    if (!data.events.length) { toast('سررسید یا موعد بازی در ۱۲ ماه آینده نیست.', 'bad'); return; }
    const text = JSON.stringify(data);
    try { await navigator.clipboard.writeText(text); }
    catch (e) { // اگه کپی خودکار نشد، متن رو نشون بده تا دستی کپی بشه
      openSheet('کپی دستی', `<p class="note">کپی خودکار انجام نشد. داخل کادر بزن، Select All و Copy رو بزن، بعد «اجرای میان‌بُر».</p>
        <textarea id="caltext" rows="6" readonly>${esc(text)}</textarea><button class="btn wide" id="runsc">اجرای میان‌بُر</button>`, ov => {
        $('#caltext', ov).addEventListener('focus', e => e.target.select());
        $('#runsc', ov).addEventListener('click', () => { closeSheet(ov); openURL('shortcuts://run-shortcut?name=' + encodeURIComponent(SHORTCUT_NAME)); });
      });
      return;
    }
    toast(`${faDigits(data.events.length)} سررسید کپی شد؛ Shortcuts باز می‌شه…`);
    setTimeout(() => openURL('shortcuts://run-shortcut?name=' + encodeURIComponent(SHORTCUT_NAME)), 350);
  }

  async function backup() {
    const blob = new Blob([JSON.stringify(S, null, 1)], { type: 'application/json' });
    const ok = await shareFile(blob, `kifam-backup-${today().replace(/\//g, '-')}.json`, 'application/json');
    if (ok) { S.settings.lastBackup = Date.now(); save(); render(); toast('فایل بکاپ ساخته شد.'); }
  }
  function restore(file) {
    const r = new FileReader();
    r.onload = () => {
      try {
        const d = JSON.parse(r.result);
        if (!d || typeof d !== 'object' || !Array.isArray(d.tx) || !Array.isArray(d.loans)) throw new Error('bad');
        const n = [`${faDigits(d.tx.length)} تراکنش`, `${faDigits(d.loans.length)} قسط`, `${faDigits((d.debts || []).length)} بدهی و طلب`];
        if (!confirm(`بکاپ شامل ${n.join('، ')} است. جایگزین همه‌ی داده‌های فعلی بشه؟`)) return;
        S = normalize(d); save(); lastHero = null; go('home'); toast('داده‌ها بازگردانی شد.');
      } catch (e) { toast('این فایل بکاپ معتبر نیست.', 'bad'); }
    };
    r.readAsText(file);
  }

  // ---------- رویدادها ----------
  document.addEventListener('click', e => {
    const tb = e.target.closest('.tabbar button'); if (tb) { go(tb.dataset.tab); return; }
    const tipEl = e.target.closest('[data-tip]');
    if (tipEl) {
      const fig = tipEl.closest('.chart'); if (!fig) return;
      $$('.sel', fig).forEach(x => x.classList.remove('sel')); tipEl.classList.add('sel');
      const cap = $('.tip', fig); if (cap) { cap.textContent = tipEl.dataset.tip; cap.classList.add('on'); }
      return;
    }
    const b = e.target.closest('[data-act]'); if (!b) return;
    const a = b.dataset.act, k = b.dataset.k, id = b.dataset.id, key = b.dataset.key;
    const acts = {
      add: () => openTxForm({ type: b.dataset.type }), duelist: openDueList, chooser: openChooser,
      pay: () => openPay(k, id, key), quickpay: () => quickPay(k, id, key), unpay: () => askUnpay(k, id, key),
      edit: () => openTxForm({ id }),
      goob: () => go('ob'), goloan: () => { obTab = 'loan'; go('ob'); }, godebt: () => { obTab = 'debt'; go('ob'); },
      txm: () => { txMonth = C.addYm(txMonth, +b.dataset.d); render(); },
      repm: () => { repMonth = C.addYm(repMonth, +b.dataset.d); render(); },
      txf: () => { txFilter = b.dataset.f; render(); }, obt: () => { obTab = b.dataset.t; render(); },
      newloan: () => openLoanForm(null, b.dataset.kind),
      loan: () => openLoanDetail(id),
      newdebt: () => openDebtForm(null, b.dataset.dir), debtd: () => openDebtDetail(id),
      excel: exportExcel, cal: sendToCalendar, backup,
      unit: () => { S.settings.unit = b.dataset.u; save(); lastHero = null; render(); },
      savebal: () => {
        const inp = $('[name=balance]', $('#view'));
        if (!inp.value.trim()) { toast('باقی‌مانده‌ی فعلی رو وارد کن.', 'bad'); return; }
        S.settings.opening = readAmount($('#view'), 'balance') - C.balance({ settings: { opening: 0 }, tx: S.tx });
        save(); lastHero = null; render(); toast('باقی‌مانده تنظیم شد.'); },
      addcat: () => { const inp = $('#newcat-' + b.dataset.type); const v = inp.value.trim().slice(0, 40); if (!v) return;
        if (!S.categories[b.dataset.type].includes(v)) S.categories[b.dataset.type].push(v); save(); render(); },
      delcat: () => { S.categories[b.dataset.type].splice(+b.dataset.i, 1); save(); render(); },
      addlender: () => { const inp = $('#newlender-' + b.dataset.kind); const v = inp.value.trim().slice(0, 40); if (!v) return;
        if (!S.lenders[b.dataset.kind].includes(v)) S.lenders[b.dataset.kind].push(v); save(); render(); },
      dellender: () => { S.lenders[b.dataset.kind].splice(+b.dataset.i, 1); save(); render(); },
      wipe: () => { if (prompt('برای پاک کردن همه‌چیز، کلمه‌ی «پاک» رو بنویس. این کار برگشت‌پذیر نیست.') !== 'پاک') return;
        S = defaults(); save(); lastHero = null; render(); toast('همه‌ی داده‌ها پاک شد.'); }
    };
    if (acts[a]) acts[a]();
  });
  document.addEventListener('change', e => { if (e.target.id === 'restore' && e.target.files[0]) { restore(e.target.files[0]); e.target.value = ''; } });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('.overlay')) closeSheet(); });

  // لینک‌های مستقیم برای ویجت Shortcuts
  function route() {
    const raw = location.hash.replace('#', '');
    if (!raw) return;
    history.replaceState(null, '', location.pathname + location.search);
    const [h, qs] = raw.split('?');
    const q = new URLSearchParams(qs || '');
    const a = Number(C.normDigits(q.get('a') || '').replace(/\D/g, '').slice(0, 15));
    const pre = { note: (q.get('n') || '').slice(0, 200) }; if (a) pre.amount = Math.round(toRial(a));
    $$('.overlay').forEach(x => x.remove()); document.body.classList.remove('locked');
    go('home');
    if (h === 'add' || h === 'out') openTxForm({ type: 'expense', prefill: pre });
    else if (h === 'income' || h === 'in') openTxForm({ type: 'income', prefill: pre });
    else if (h === 'new') openChooser();
    else if (h === 'pay') openDueList();
  }
  window.addEventListener('hashchange', route);
  // بعد از برگشتن به اپ (مثلاً روز بعد) تاریخ «امروز» تازه بشه
  document.addEventListener('visibilitychange', () => { if (!document.hidden && !$('.overlay')) render(); });

  // ---------- شروع ----------
  window.App = { openSheet, closeSheet }; // datepick.js از اینجا ورقه‌ی تقویم رو باز می‌کنه
  load(); render(); route();
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
  window.__kifam = { get state() { return S; } }; // برای تست
})();
