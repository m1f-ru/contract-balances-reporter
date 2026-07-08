import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reconcile } from './reconcile.mjs';

const unf = [ // план (товарные накладные)
  { contractKey: 'ОК1', nom: 'A', qty: 100, sum: 1000 },
  { contractKey: 'ОК1', nom: 'B', qty: 50,  sum: 500 },
  { contractKey: 'ОК2', nom: 'A', qty: 10,  sum: 100 },
];
const buh = [ // отгружено (УПД), частичные отгрузки суммируются
  { contractKey: 'ОК1', nom: 'A', qty: 40, sum: 400 },
  { contractKey: 'ОК1', nom: 'A', qty: 20, sum: 200 },
  { contractKey: 'ОК3', nom: 'A', qty: 5,  sum: 50 },
];

test('остаток по контракту в ₽ = план − отгружено', () => {
  const r = reconcile({ unfLines: unf, buhLines: buh });
  const ok1 = r.byContract.find(x => x.contractKey === 'ОК1');
  assert.equal(ok1.planSum, 1500);
  assert.equal(ok1.shipSum, 600);
  assert.equal(ok1.remSum, 900);
});

test('остаток по позиции в шт (частичные отгрузки суммируются)', () => {
  const r = reconcile({ unfLines: unf, buhLines: buh });
  const ok1a = r.byItem.find(x => x.contractKey === 'ОК1' && x.nom === 'A');
  assert.equal(ok1a.planQty, 100);
  assert.equal(ok1a.shipQty, 60);
  assert.equal(ok1a.remQty, 40);
});

test('контракт только в УНФ и только в БУХ попадают в нестыковки', () => {
  const r = reconcile({ unfLines: unf, buhLines: buh });
  assert.deepEqual(r.mismatches.onlyPlan.sort(), ['ОК2']);   // есть план, нет отгрузок
  assert.deepEqual(r.mismatches.onlyShip.sort(), ['ОК3']);   // есть отгрузки, нет плана
});

test('строки без contractKey уходят в nullKey, а не теряются', () => {
  const r = reconcile({ unfLines: [{ contractKey: null, nom: 'A', qty: 1, sum: 1 }], buhLines: [] });
  assert.equal(r.mismatches.nullKeyCount, 1);
});

test('контракт с нулевыми значениями на стороне плана НЕ считается onlyShip (по присутствию)', () => {
  const r = reconcile({
    unfLines: [{ contractKey: 'Z1', nom: 'A', qty: 0, sum: 0 }],
    buhLines: [{ contractKey: 'Z1', nom: 'A', qty: 5, sum: 50 }],
  });
  assert.deepEqual(r.mismatches.onlyShip, []);
  assert.deepEqual(r.mismatches.onlyPlan, []);
});

test('перепоставка даёт отрицательный остаток', () => {
  const r = reconcile({
    unfLines: [{ contractKey: 'ОК9', nom: 'A', qty: 100, sum: 1000 }],
    buhLines: [{ contractKey: 'ОК9', nom: 'A', qty: 150, sum: 1500 }],
  });
  const c = r.byContract.find(x => x.contractKey === 'ОК9');
  assert.equal(c.remQty, -50);
  assert.equal(c.remSum, -500);
});

test('нечисловые qty/sum коэрсятся в 0 без падения', () => {
  const r = reconcile({
    unfLines: [{ contractKey: 'ОК', nom: 'A', qty: undefined, sum: null }],
    buhLines: [],
  });
  const c = r.byContract.find(x => x.contractKey === 'ОК');
  assert.equal(c.planQty, 0);
  assert.equal(c.planSum, 0);
});
