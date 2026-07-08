import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RegNumber } from './regnum.mjs';

test('ОК-номер из наименования договора БУХ (с суффиксом заявки)', () => {
  assert.equal(
    RegNumber.extract('Заявка №ОК32414391803/9КР (Сумма 399 883,19р) Контракт №ОК32414391803'),
    'ОК32414391803');
});

test('ОК-номер из ОснованиеПечати УНФ', () => {
  assert.equal(RegNumber.extract('№ ОК32515258102 от 07.11.2025'), 'ОК32515258102');
});

test('ЗК-номер', () => {
  assert.equal(RegNumber.extract('№ ЗК32515275823 от 27.10.2025'), 'ЗК32515275823');
});

test('договор подряда МАО не даёт ОК/ЗК (коротких цифр)', () => {
  assert.equal(RegNumber.extract('Договор подряда № МАО-416-25-Р66 от 21.08.2025г.'), null);
});
