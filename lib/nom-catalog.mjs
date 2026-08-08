import {
  buildNomIndexes,
  matchNom,
} from './nom-match.mjs';

const NOM = 'Catalog_Номенклатура';

export async function loadNomCatalog(client, refs) {
  const uniqueRefs = [
    ...new Set(
      [...refs]
        .map((x) => String(x ?? '').trim())
        .filter(Boolean),
    ),
  ];

  const out = [];

  for (const ref of uniqueRefs) {
    const rows = await client.getCollection(NOM, {
      '$format': 'json',
      '$select': 'Ref_Key,Code,Description,Артикул,НаименованиеПолное',
      '$filter': `Ref_Key eq guid'${ref}'`,
    });

    const r = rows[0];
    if (!r) continue;

    out.push({
      ref: String(r.Ref_Key),
      code: String(r.Code ?? '').trim(),
      article: String(r.Артикул ?? '').trim(),
      description: String(r.Description ?? '').trim(),
      fullName: String(r.НаименованиеПолное ?? '').trim(),
    });
  }

  return out;
}

export function makeCatalogMap(rows) {
  return new Map(
    rows.map((row) => [String(row.ref), row]),
  );
}

export function buildBuhToUnfMap(unfRows, buhRows) {
  const indexes = buildNomIndexes(unfRows);
  const map = new Map();

  const stats = {
    total: buhRows.length,
    matched: 0,
    conflict: 0,
    ambiguous: 0,
    unmatched: 0,
  };

  for (const buh of buhRows) {
    const result = matchNom(buh, indexes);

    stats[result.status]++;

    if (result.status === 'matched') {
      map.set(String(buh.ref), {
        status: 'matched',
        unfRef: String(result.unf.ref),
        method: result.method,
      });
    } else {
      map.set(String(buh.ref), {
        status: result.status,
        unfRef: null,
        method: null,
      });
    }
  }

  stats.coveragePercent = stats.total
    ? Math.round((stats.matched / stats.total) * 10000) / 100
    : 0;

  return {
    map,
    stats,
  };
}
