import test from 'node:test';
import assert from 'node:assert/strict';

import { reconcileByNom } from './nom-reconcile.mjs';

test('товарная сверка объединяет УНФ и БУХ через карту номенклатуры', () => {
  const ordered = [
    {
      contractKey: 'ОК-TEST',
      number: 'ОК-TEST/1',
      orderRef: 'order-1',
      nom: 'unf-nom-1',
      qty: 10,
      sum: 1000,
    },
  ];

  const shipped = [
    {
      contractKey: 'ОК-TEST',
      order: 'order-1',
      nom: 'unf-nom-1',
      qty: 6,
      sum: 600,
    },
  ];

  const received = [
    {
      contractKey: 'ОК-TEST',
      zayavka: '1',
      nom: 'buh-nom-1',
      qty: 5,
      sum: 500,
    },
  ];

  const buhToUnfMap = new Map([
    [
      'buh-nom-1',
      {
        status: 'matched',
        unfRef: 'unf-nom-1',
        method: 'Артикул',
      },
    ],
  ]);

  const rows = reconcileByNom({
    ordered,
    shipped,
    received,
    buhToUnfMap,
  });

  assert.equal(rows.length, 1);

  const row = rows[0];

  assert.equal(row.contractKey, 'ОК-TEST');
  assert.equal(row.zayavka, '1');
  assert.equal(row.unfNomRef, 'unf-nom-1');
  assert.equal(row.buhNomRef, 'buh-nom-1');

  assert.equal(row.ordQty, 10);
  assert.equal(row.shipQty, 6);
  assert.equal(row.recQty, 5);

  assert.equal(row.toShipQty, 4);
  assert.equal(row.toAcceptQty, 1);

  assert.equal(row.ordSum, 1000);
  assert.equal(row.shipSum, 600);
  assert.equal(row.recSum, 500);

  assert.equal(row.toShipSum, 400);
  assert.equal(row.toAcceptSum, 100);
});

test('несопоставленная позиция БУХ остаётся отдельной строкой', () => {
  const rows = reconcileByNom({
    ordered: [],
    shipped: [],
    received: [
      {
        contractKey: 'ОК-TEST',
        zayavka: '1',
        nom: 'buh-unmatched',
        qty: 2,
        sum: 250,
      },
    ],
    buhToUnfMap: new Map(),
  });

  assert.equal(rows.length, 1);

  const row = rows[0];

  assert.equal(row.nomKey, 'buh:buh-unmatched');
  assert.equal(row.unfNomRef, null);
  assert.equal(row.buhNomRef, 'buh-unmatched');
  assert.equal(row.matchStatus, 'unmatched');

  assert.equal(row.ordQty, 0);
  assert.equal(row.shipQty, 0);
  assert.equal(row.recQty, 2);

  assert.equal(row.toAcceptQty, -2);
  assert.equal(row.recSum, 250);
  assert.equal(row.toAcceptSum, -250);
});
