import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildNomIndexes,
  matchNom,
} from './nom-match.mjs';

function nom({
  ref,
  article = '',
  code = '',
  fullName = '',
  description = '',
}) {
  return {
    ref,
    article,
    code,
    fullName,
    description,
  };
}

test('номенклатура: точное совпадение по артикулу', () => {
  const unf = [
    nom({
      ref: 'unf-1',
      article: 'ABC-123',
      code: 'UNF-001',
      fullName: 'Стол',
      description: 'Стол',
    }),
  ];

  const indexes = buildNomIndexes(unf);

  const result = matchNom(
    nom({
      ref: 'buh-1',
      article: '  abc-123  ',
      code: 'OTHER',
      fullName: 'Другое',
      description: 'Другое',
    }),
    indexes,
  );

  assert.equal(result.status, 'matched');
  assert.equal(result.method, 'Артикул');
  assert.equal(result.unf.ref, 'unf-1');
});

test('номенклатура: неоднозначное совпадение не принимается автоматически', () => {
  const unf = [
    nom({
      ref: 'unf-1',
      code: 'SAME-CODE',
      fullName: 'Товар 1',
    }),
    nom({
      ref: 'unf-2',
      code: 'SAME-CODE',
      fullName: 'Товар 2',
    }),
  ];

  const indexes = buildNomIndexes(unf);

  const result = matchNom(
    nom({
      ref: 'buh-1',
      code: 'SAME-CODE',
    }),
    indexes,
  );

  assert.equal(result.status, 'ambiguous');
});

test('номенклатура: конфликт разных точных признаков не принимается автоматически', () => {
  const unf = [
    nom({
      ref: 'unf-1',
      article: 'ART-1',
      code: 'CODE-1',
    }),
    nom({
      ref: 'unf-2',
      article: 'ART-2',
      code: 'CODE-2',
    }),
  ];

  const indexes = buildNomIndexes(unf);

  const result = matchNom(
    nom({
      ref: 'buh-1',
      article: 'ART-1',
      code: 'CODE-2',
    }),
    indexes,
  );

  assert.equal(result.status, 'conflict');
});

test('номенклатура: отсутствие соответствия остаётся unmatched', () => {
  const unf = [
    nom({
      ref: 'unf-1',
      article: 'ART-1',
      code: 'CODE-1',
      fullName: 'Стол',
      description: 'Стол',
    }),
  ];

  const indexes = buildNomIndexes(unf);

  const result = matchNom(
    nom({
      ref: 'buh-1',
      article: 'OTHER',
      code: 'OTHER',
      fullName: 'Диван',
      description: 'Диван',
    }),
    indexes,
  );

  assert.equal(result.status, 'unmatched');
});
