// Сопоставление номенклатуры БУХ↔УНФ. Канонический ключ = значение ключа
// сопоставления (артикул/код/нормализованное имя) первой стороны, где нашлось.

export function normalizeName(s) {
  return String(s ?? '').replace(/\s+/gu, ' ').trim().toLowerCase();
}

/**
 * @param {Array} buh [{key, article, code, name}]
 * @param {Array} unf [{key, article, code, name}]
 * @param {'article'|'code'|'name'} by основной ключ; при пустом — фолбэк на имя
 */
export function buildNomMap(buh, unf, by = 'name') {
  const val = (item) => {
    const primary = by === 'name' ? normalizeName(item.name) : String(item[by] ?? '').trim();
    return primary !== '' ? primary : normalizeName(item.name);
  };

  const unfByVal = new Map();
  for (const u of unf) unfByVal.set(val(u), u.key);

  const buhToCanon = new Map();
  const unfToCanon = new Map();
  const unmatchedBuh = new Set();
  const matchedUnfKeys = new Set();

  for (const b of buh) {
    const v = val(b);
    if (unfByVal.has(v)) {
      buhToCanon.set(b.key, v);
      unfToCanon.set(unfByVal.get(v), v);
      matchedUnfKeys.add(unfByVal.get(v));
    } else {
      unmatchedBuh.add(b.key);
    }
  }
  const unmatchedUnf = new Set(unf.filter(u => !matchedUnfKeys.has(u.key)).map(u => u.key));

  return { buhToCanon, unfToCanon, unmatchedBuh, unmatchedUnf };
}
