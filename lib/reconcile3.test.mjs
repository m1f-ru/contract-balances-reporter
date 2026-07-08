import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reconcile3 } from './reconcile.mjs';

test('три источника: остатки к отгрузке и к приёмке (числа с боевого контракта)', () => {
  const r = reconcile3({
    ordered:  [{ contractKey: 'ОК1', qty: 571, sum: 5710 }],
    shipped:  [{ contractKey: 'ОК1', qty: 504, sum: 5040 }],
    received: [{ contractKey: 'ОК1', qty: 431, sum: 4310 }],
  });
  const c = r.byContract.find(x => x.contractKey === 'ОК1');
  assert.equal(c.ordQty, 571);
  assert.equal(c.shipQty, 504);
  assert.equal(c.recQty, 431);
  assert.equal(c.toShipQty, 67);    // 571 - 504
  assert.equal(c.toAcceptQty, 73);  // 504 - 431
});

test('частичные суммируются; строки без контракта считаются в nullKeyCount', () => {
  const r = reconcile3({
    ordered:  [{ contractKey: 'ОК1', qty: 10, sum: 1 }, { contractKey: 'ОК1', qty: 5, sum: 1 }],
    shipped:  [{ contractKey: null, qty: 3, sum: 1 }],
    received: [],
  });
  const c = r.byContract.find(x => x.contractKey === 'ОК1');
  assert.equal(c.ordQty, 15);
  assert.equal(r.mismatches.nullKeyCount, 1);
});

test('контракт только в одном источнике: остатки корректны', () => {
  const r = reconcile3({
    ordered:  [{ contractKey: 'ОК2', qty: 10, sum: 100 }],
    shipped:  [],
    received: [],
  });
  const c = r.byContract.find(x => x.contractKey === 'ОК2');
  assert.equal(c.ordQty, 10);
  assert.equal(c.toShipQty, 10);    // ничего не отгружено
  assert.equal(c.toAcceptQty, 0);   // ничего не отгружено → нечего принимать
  assert.equal(c.ordSum, 100);
});
