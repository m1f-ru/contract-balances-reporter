import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contractKey, zayavkaId } from './contractKey.mjs';

test('ОК из наименования договора БУХ', () => {
  assert.equal(contractKey('Заявка №ОК32414391803/9КР (Сумма 399 883,19р) Контракт №ОК32414391803'), 'ОК32414391803');
});

test('ОК из ОснованиеПечати УНФ (тот же ключ, что БУХ)', () => {
  assert.equal(contractKey('№ ОК32515258102 от 07.11.2025'), 'ОК32515258102');
});

test('договор подряда МАО нормализуется в стабильный ключ', () => {
  const a = contractKey('Договор подряда № МАО-416-25-Р66 от 21.08.2025г. ДС №1');
  const b = contractKey('Договор подряда МАО-416-25-Р66');
  assert.equal(a, 'МАО-416-25-Р66');
  assert.equal(a, b, 'обе базы дают один ключ');
});

test('пустой/мусорный текст → null', () => {
  assert.equal(contractKey(''), null);
  assert.equal(contractKey('Основной договор'), null);
});

test('zayavkaId возвращает номер заявки с суффиксом', () => {
  assert.equal(zayavkaId('ОК32414391803/9КР'), 'ОК32414391803/9КР');
  assert.equal(zayavkaId('  ОК32515258102/1  '), 'ОК32515258102/1');
});
