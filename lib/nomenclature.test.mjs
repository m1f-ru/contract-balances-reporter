import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildNomMap, normalizeName } from './nomenclature.mjs';

const buh = [
  { key: 'b1', article: 'A-100', name: 'Стол  письменный' },
  { key: 'b2', article: '', name: 'Стул офисный' },
];
const unf = [
  { key: 'u1', article: 'A-100', name: 'Стол письменный' },
  { key: 'u2', article: '', name: 'Тумба' },
];

test('нормализация имени схлопывает пробелы и регистр', () => {
  assert.equal(normalizeName('Стол  ПИСЬМЕННЫЙ '), 'стол письменный');
});

test('маппинг по артикулу, фолбэк по имени', () => {
  const m = buildNomMap(buh, unf, 'article');
  assert.equal(m.buhToCanon.get('b1'), 'A-100'); // совпал артикул
  assert.equal(m.unfToCanon.get('u1'), 'A-100');
});

test('несопоставленные позиции перечислены', () => {
  const m = buildNomMap(buh, unf, 'article');
  // b2 (Стул) и u2 (Тумба) не имеют пары ни по артикулу, ни по имени
  assert.deepEqual([...m.unmatchedBuh].sort(), ['b2']);
  assert.deepEqual([...m.unmatchedUnf].sort(), ['u2']);
});
