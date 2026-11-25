// تست هسته: تقویم شمسی، اقساط، باقی‌مانده
require('../core.js'); const C = globalThis.Core; const assert = require('assert');
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok', name); };
t('تقویم شمسی ۱۳۹۰–۱۴۲۰ برابر Intl', () => {
  const f = new Intl.DateTimeFormat('en-u-ca-persian-nu-latn', { year: 'numeric', month: 'numeric', day: 'numeric' });
  for (let d = new Date(2011, 0, 1); d < new Date(2041, 0, 1); d.setDate(d.getDate() + 1)) {
    const p = f.formatToParts(d), g = k => +p.find(x => x.type === k).value;
    assert.strictEqual(C.toJ(d), C.jStr(g('year'), g('month'), g('day')));
  }
});
t('monthGrid از شنبه', () => { const g = C.monthGrid(1405, 9); assert.strictEqual(g.length % 7, 0); assert.strictEqual(g.filter(Boolean).length, 30); });
t('addMonths محدودیت روز', () => { assert.strictEqual(C.addMonths('1405/06/31', 6, 31), '1405/12/29'); assert.strictEqual(C.addMonths('1405/09/13', -1, 13), '1405/08/13'); });
const base = () => ({ settings: { opening: 1000 }, tx: [], debts: [], loans: [{ id: 'l', name: 'L', amount: 100, count: 3, first: '1405/08/13', paid: { 0: { prior: true } } }] });
t('باقی‌مانده: شروع + درآمد − برداشت ± تسویه', () => {
  const s = base();
  s.tx.push({ id: 'a', type: 'income', amount: 500 }, { id: 'b', type: 'expense', amount: 200 }, { id: 'c', type: 'transfer', amount: 50, cash: -1 }, { id: 'd', type: 'transfer', amount: 30, cash: 1 }, { id: 'e', type: 'transfer', amount: 999 });
  assert.strictEqual(C.balance(s), 1000 + 500 - 200 - 50 + 30);
});
t('اقساط ماه و پرداخت‌نشده‌ها', () => {
  const s = base(); const st = C.monthStats(s, '1405/09');
  assert.strictEqual(st.count, 1); assert.strictEqual(st.obRemaining, 100); assert.strictEqual(st.obs[0].due, '1405/09/13');
  assert.strictEqual(C.pendingTotal(s, '1405/09'), 100);
  s.loans[0].paid[1] = { date: '1405/09/13', txId: 'x' }; s.tx.push({ id: 'x', type: 'expense', amount: 120, date: '1405/09/13', link: { kind: 'loan', id: 'l', key: '1' } });
  assert.strictEqual(C.pendingTotal(s, '1405/09'), 0);
  assert.strictEqual(C.monthStats(s, '1405/09').obPaid, 120);
});
t('عقب‌افتاده در pendingTotal', () => { const s = base(); assert.strictEqual(C.pendingTotal(s, '1405/10'), 100 + 100); });
t('وام‌ها و KPI', () => {
  const s = base(); const sm = C.loanSummary(s.loans[0]); assert.strictEqual(sm.paidCount, 1); assert.strictEqual(sm.remainingAmount, 200); assert.strictEqual(sm.last, '1405/10/13');
  const k = C.kpis(s, '1405/09', '1405/09/04'); assert.strictEqual(k.debtNow, 200); assert.strictEqual(k.hasIncome, false);
  s.tx.push({ id: 'i', type: 'income', amount: 1000, date: '1405/09/02' }); assert.strictEqual(C.kpis(s, '1405/09', '1405/09/04').dti, 0.1);
  assert.strictEqual(C.obligationForecast(s, '1405/09', 3).map(f => f.total).join(), '100,100,0');
});
console.log(n, 'گروه پاس');
