import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toCsv } from './output.mjs';

test('toCsv экранирует запятые/кавычки и ставит заголовок', () => {
  const rows = [{ a: 1, b: 'x,y' }, { a: 2, b: 'he "ll" o' }];
  const csv = toCsv(rows, ['a', 'b']);
  const lines = csv.trim().split('\n');
  assert.equal(lines[0], 'a,b');
  assert.equal(lines[1], '1,"x,y"');
  assert.equal(lines[2], '2,"he ""ll"" o"');
});

test('toCsv на пустом наборе — только заголовок', () => {
  assert.equal(toCsv([], ['a', 'b']).trim(), 'a,b');
});

test('toCsvLabeled ставит заголовки-подписи, данные берёт по ключам', async () => {
  const { toCsvLabeled } = await import('./output.mjs');
  const rows = [{ k: 'ОК1', q: 5 }];
  const csv = toCsvLabeled(rows, [['k', 'Контракт'], ['q', 'Кол-во, шт']]);
  const lines = csv.trim().split('\n');
  assert.equal(lines[0], 'Контракт,"Кол-во, шт"');
  assert.equal(lines[1], 'ОК1,5');
});

test('toCsvLabeled на пустом наборе — только заголовки', async () => {
  const { toCsvLabeled } = await import('./output.mjs');
  assert.equal(toCsvLabeled([], [['k', 'Контракт']]).trim(), 'Контракт');
});
