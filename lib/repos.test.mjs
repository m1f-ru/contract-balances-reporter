import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BuhRepo } from './buh.mjs';
import { UnfRepo } from './unf.mjs';

// Фейковый клиент: маршрутизирует по имени сущности в переданной таблице фикстур.
function fakeClient(fixtures) {
  return {
    async getCollection(path, q) { return fixtures[path] ?? []; },
    async callFunction(path, q) { return fixtures[path] ?? []; },
  };
}

test('BuhRepo.updLines проставляет contractKey по договору-заявке', async () => {
  const client = fakeClient({
    'Document_РеализацияТоваровУслуг': [
      { Ref_Key: 'd1', Number: '8346', Date: '2026-06-05T00:00:00', ДоговорКонтрагента_Key: 'c1' },
    ],
    'Catalog_ДоговорыКонтрагентов': [
      { Ref_Key: 'c1', Description: 'Заявка №ОК32414391803/9КР Контракт №ОК32414391803', Номер: 'ОК32414391803/9КР' },
    ],
    'Document_РеализацияТоваровУслуг_Товары': [
      { Ref_Key: 'd1', Номенклатура_Key: 'n1', Количество: 66, Сумма: 264424.58 },
    ],
  });
  const rows = await new BuhRepo(client, 'ORG').updLines();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].contractKey, 'ОК32414391803');
  assert.equal(rows[0].zayavka, 'ОК32414391803/9КР');
  assert.equal(rows[0].nom, 'n1');
  assert.equal(rows[0].qty, 66);
  assert.equal(rows[0].sum, 264424.58);
});

test('UnfRepo.naklLines проставляет contractKey из ОснованиеПечати', async () => {
  const client = fakeClient({
    'Document_РасходнаяНакладная': [
      { Ref_Key: 'r1', Number: 'НФНФ-000106', Date: '2026-07-03T00:00:00', ОснованиеПечати: '№ ОК32515258102 от 07.11.2025' },
    ],
    'Document_РасходнаяНакладная_Запасы': [
      { Ref_Key: 'r1', Номенклатура_Key: 'm1', Количество: 120, Сумма: 626796 },
    ],
  });
  const rows = await new UnfRepo(client, 'ORG').naklLines();
  assert.equal(rows[0].contractKey, 'ОК32515258102');
  assert.equal(rows[0].nom, 'm1');
  assert.equal(rows[0].qty, 120);
});
