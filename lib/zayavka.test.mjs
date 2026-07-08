import { test } from 'node:test';
import assert from 'node:assert/strict';
import { zayavkaSuffix, zayavkaKey, reconcileByZayavka } from './zayavka.mjs';

test('суффикс заявки = часть после последнего "/", иначе весь номер', () => {
  assert.equal(zayavkaSuffix('8102/1'), '1');
  assert.equal(zayavkaSuffix('ОК32515258102/1'), '1');
  assert.equal(zayavkaSuffix('НФНФ-000003'), 'НФНФ-000003');
  assert.equal(zayavkaSuffix('  8102/2  '), '2');
});

test('ключ заявки сшивает УНФ и БУХ по контракту+суффиксу; null-контракт → null', () => {
  assert.equal(zayavkaKey('ОК1', '8102/1'), zayavkaKey('ОК1', 'ОК32515258102/1'));
  assert.equal(zayavkaKey(null, '8102/1'), null);
});

test('reconcileByZayavka: Заказано, Отгружено(по ссылке на заявку), Принято(по суффиксу)', () => {
  const r = reconcileByZayavka({
    ordered:  [{ contractKey: 'ОК1', number: '8102/1', orderRef: 'r1', qty: 535, sum: 5350 }],
    shipped:  [{ contractKey: 'ОК1', order: 'r1', qty: 504, sum: 5040 }],
    received: [{ contractKey: 'ОК1', zayavka: 'ОК32515258102/1', qty: 431, sum: 4310 }],
  });
  const z = r.byZayavka.find(x => x.contractKey === 'ОК1' && x.zayavka === '1');
  assert.equal(z.ordQty, 535);
  assert.equal(z.shipQty, 504);
  assert.equal(z.recQty, 431);
  assert.equal(z.toShipQty, 31);   // 535 - 504
  assert.equal(z.toAcceptQty, 73); // 504 - 431
});

test('накладная без привязки к заявке уходит в суффикс "—"', () => {
  const r = reconcileByZayavka({
    ordered: [], received: [],
    shipped: [{ contractKey: 'ОК2', order: '', qty: 9, sum: 90 }],
  });
  const z = r.byZayavka.find(x => x.contractKey === 'ОК2');
  assert.equal(z.zayavka, '—');
  assert.equal(z.shipQty, 9);
});
