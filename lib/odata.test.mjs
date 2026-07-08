import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Client } from './odata.mjs';

const c = new Client('https://example/', 'u:p');

test('buildUrl: guid-литерал не percent-кодируется, кириллица кодируется', () => {
  const url = c.buildUrl('Document_РеализацияТоваровУслуг', {
    '$filter': "Организация_Key eq guid'1fbc43ca-89fa-11ef-8dbe-fa163e08443c'",
  });
  assert.ok(url.includes("guid'1fbc43ca-89fa-11ef-8dbe-fa163e08443c'"), 'guid дословно');
  assert.ok(url.includes('%D0%9E%D1%80%D0%B3%D0%B0%D0%BD%D0%B8%D0%B7%D0%B0%D1%86%D0%B8%D1%8F'), 'кириллица percent');
  assert.ok(!url.includes(' '), 'пробелов в URL нет');
});
