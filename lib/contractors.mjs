// Резолвинг контрагентов по ИНН → набор Ref_Key (в базе может быть несколько карточек с одним ИНН).

/**
 * @param {*} client OData-клиент с getCollection
 * @param {string} inn
 * @returns {Promise<Set<string>>}
 */
export async function refsByInn(client, inn) {
  const rows = await client.getCollection('Catalog_Контрагенты', {
    '$format': 'json', '$select': 'Ref_Key,ИНН',
  });
  const target = String(inn).trim();
  const set = new Set();
  for (const r of rows) {
    if (r.Ref_Key && String(r.ИНН ?? '').trim() === target) set.add(String(r.Ref_Key));
  }
  return set;
}
