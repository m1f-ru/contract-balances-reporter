import test from 'node:test';
import assert from 'node:assert/strict';

import { filterByOrderYear } from './period.mjs';

test('период 2025 сохраняет связанные отгрузку и УПД 2026 года', () => {
  const ordered = [
    {
      contractKey: 'ОК-TEST',
      number: 'ОК-TEST/1',
      orderRef: 'order-2025',
      doc: 'order-2025',
      date: '2025-12-20T00:00:00',
      qty: 10,
      sum: 1000,
    },
    {
      contractKey: 'ОК-OTHER',
      number: 'ОК-OTHER/1',
      orderRef: 'order-2026',
      doc: 'order-2026',
      date: '2026-01-10T00:00:00',
      qty: 5,
      sum: 500,
    },
  ];

  const shipped = [
    {
      contractKey: 'ОК-TEST',
      order: 'order-2025',
      date: '2026-01-15T00:00:00',
      qty: 8,
      sum: 800,
    },
    {
      contractKey: 'ОК-OTHER',
      order: 'order-2026',
      date: '2026-01-20T00:00:00',
      qty: 5,
      sum: 500,
    },
  ];

  const received = [
    {
      contractKey: 'ОК-TEST',
      zayavka: '1',
      date: '2026-02-01T00:00:00',
      qty: 8,
      sum: 800,
    },
    {
      contractKey: 'ОК-OTHER',
      zayavka: '1',
      date: '2026-02-02T00:00:00',
      qty: 5,
      sum: 500,
    },
  ];

  const result = filterByOrderYear({
    ordered,
    shipped,
    received,
    year: 2025,
  });

  assert.equal(result.ordered.length, 1);
  assert.equal(result.ordered[0].orderRef, 'order-2025');

  assert.equal(result.shipped.length, 1);
  assert.equal(result.shipped[0].order, 'order-2025');

  assert.equal(result.received.length, 1);
  assert.equal(result.received[0].contractKey, 'ОК-TEST');
});

test('период не применяет fallback БУХ, если у контракта несколько заявок в истории', () => {
  const ordered = [
    {
      contractKey: 'ОК-MULTI',
      number: 'ОК-MULTI/1',
      orderRef: 'order-1',
      date: '2025-06-01T00:00:00',
    },
    {
      contractKey: 'ОК-MULTI',
      number: 'ОК-MULTI/2',
      orderRef: 'order-2',
      date: '2026-01-01T00:00:00',
    },
  ];

  const received = [
    {
      contractKey: 'ОК-MULTI',
      zayavka: 'НЕИЗВЕСТНО',
      date: '2026-02-01T00:00:00',
    },
  ];

  const result = filterByOrderYear({
    ordered,
    shipped: [],
    received,
    year: 2025,
  });

  assert.equal(result.ordered.length, 1);
  assert.equal(result.received.length, 0);
});

test('пустой период возвращает пустые наборы', () => {
  const result = filterByOrderYear({
    ordered: [
      {
        contractKey: 'ОК-2026',
        number: 'ОК-2026/1',
        orderRef: 'order-2026',
        date: '2026-03-01T00:00:00',
      },
    ],
    shipped: [
      {
        contractKey: 'ОК-2026',
        order: 'order-2026',
        date: '2026-03-10T00:00:00',
      },
    ],
    received: [
      {
        contractKey: 'ОК-2026',
        zayavka: '1',
        date: '2026-03-20T00:00:00',
      },
    ],
    year: 2025,
  });

  assert.deepEqual(result, {
    ordered: [],
    shipped: [],
    received: [],
  });
});
