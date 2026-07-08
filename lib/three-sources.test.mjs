import { test } from 'node:test';
import assert from 'node:assert/strict';
import { refsByInn } from './contractors.mjs';
import { UnfRepo } from './unf.mjs';
import { BuhRepo } from './buh.mjs';

function fakeClient(fixtures) {
  return { async getCollection(path) { return fixtures[path] ?? []; }, async callFunction(path) { return fixtures[path] ?? []; } };
}

test('refsByInn собирает все карточки с данным ИНН', async () => {
  const c = fakeClient({ 'Catalog_Контрагенты': [
    { Ref_Key: 'a', ИНН: '9705101759' }, { Ref_Key: 'b', ИНН: '9705101759' }, { Ref_Key: 'c', ИНН: '7700000000' },
  ]});
  const s = await refsByInn(c, '9705101759');
  assert.deepEqual([...s].sort(), ['a', 'b']);
});

test('UnfRepo.orderLines даёт Заказано с ключом контракта', async () => {
  const c = fakeClient({
    'Document_ЗаказПокупателя': [
      { Ref_Key: 'o1', Number: '8102/1', Date: '2026-01-01T00:00:00', Контрагент_Key: 'cto', ОснованиеПечати: '№ ОК32515258102 от 07.11.2025' },
    ],
    'Document_ЗаказПокупателя_Запасы': [
      { Ref_Key: 'o1', Количество: 535, Сумма: 100 },
    ],
  });
  const rows = await new UnfRepo(c, 'ORG').orderLines(new Set(['cto']));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].contractKey, 'ОК32515258102');
  assert.equal(rows[0].qty, 535);
});

test('фильтр по контрагенту отбрасывает чужие документы', async () => {
  const c = fakeClient({
    'Document_ЗаказПокупателя': [
      { Ref_Key: 'o1', Number: '1', Date: 'd', Контрагент_Key: 'cto', ОснованиеПечати: '№ ОК1 от 01.01.2025' },
      { Ref_Key: 'o2', Number: '2', Date: 'd', Контрагент_Key: 'other', ОснованиеПечати: '№ ОК2 от 01.01.2025' },
    ],
    'Document_ЗаказПокупателя_Запасы': [
      { Ref_Key: 'o1', Количество: 5, Сумма: 5 }, { Ref_Key: 'o2', Количество: 9, Сумма: 9 },
    ],
  });
  const rows = await new UnfRepo(c, 'ORG').orderLines(new Set(['cto']));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].qty, 5);
});

test('BuhRepo.updLines без фильтра работает как раньше', async () => {
  const c = fakeClient({
    'Document_РеализацияТоваровУслуг': [{ Ref_Key: 'd1', Number: 'N', Date: 'd', Контрагент_Key: 'x', ДоговорКонтрагента_Key: 'c1' }],
    'Catalog_ДоговорыКонтрагентов': [{ Ref_Key: 'c1', Description: 'Контракт №ОК32515258102', Номер: 'ОК32515258102/1' }],
    'Document_РеализацияТоваровУслуг_Товары': [{ Ref_Key: 'd1', Номенклатура_Key: 'n', Количество: 431, Сумма: 10 }],
  });
  const rows = await new BuhRepo(c, 'ORG').updLines();
  assert.equal(rows[0].contractKey, 'ОК32515258102');
  assert.equal(rows[0].qty, 431);
});
