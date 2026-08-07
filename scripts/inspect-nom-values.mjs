import { loadConfig } from '../lib/config.mjs';
import { Client } from '../lib/odata.mjs';
import { refsByInn } from '../lib/contractors.mjs';
import { UnfRepo } from '../lib/unf.mjs';
import { BuhRepo } from '../lib/buh.mjs';

const INN = process.env.CTO_INN ?? '9705101759';
const NOM = 'Catalog_Номенклатура';

function norm(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

async function loadNom(client, refs) {
  const result = [];

  for (const ref of refs) {
    const rows = await client.getCollection(NOM, {
      '$format': 'json',
      '$select': 'Ref_Key,Code,Description,Артикул,НаименованиеПолное',
      '$filter': `Ref_Key eq guid'${ref}'`,
    });

    const r = rows[0];
    if (!r) continue;

    result.push({
      ref: String(r.Ref_Key),
      code: String(r.Code ?? '').trim(),
      article: String(r.Артикул ?? '').trim(),
      description: String(r.Description ?? '').trim(),
      fullName: String(r.НаименованиеПолное ?? '').trim(),
    });
  }

  return result;
}

function makeIndex(rows, field) {
  const index = new Map();

  for (const row of rows) {
    const key = norm(row[field]);
    if (!key) continue;

    const arr = index.get(key) ?? [];
    arr.push(row);
    index.set(key, arr);
  }

  return index;
}

function compareField(unf, buh, field, title) {
  const u = makeIndex(unf, field);
  const b = makeIndex(buh, field);

  let uniqueMatches = 0;
  let ambiguousMatches = 0;
  const matchedBuh = new Set();
  const examples = [];

  for (const [key, ur] of u) {
    const br = b.get(key);
    if (!br) continue;

    if (ur.length === 1 && br.length === 1) {
      uniqueMatches++;
      matchedBuh.add(br[0].ref);

      if (examples.length < 10) {
        examples.push({
          value: ur[0][field],
          unf: ur[0].description || ur[0].fullName,
          buh: br[0].description || br[0].fullName,
        });
      }
    } else {
      ambiguousMatches++;
    }
  }

  return {
    field: title,
    uniqueMatches,
    ambiguousMatches,
    buhMatched: matchedBuh.size,
    buhTotal: buh.length,
    coveragePercent: buh.length
      ? Math.round((matchedBuh.size / buh.length) * 10000) / 100
      : 0,
    examples,
  };
}

async function main() {
  const cfg = loadConfig();

  const unfClient = new Client(
    cfg.unf.base,
    cfg.unf.userpwd,
    { pageSize: 1000 },
  );

  const buhClient = new Client(
    cfg.buh.base,
    cfg.buh.userpwd,
    { pageSize: 1000 },
  );

  const unfRefs = await refsByInn(unfClient, INN);
  const buhRefs = await refsByInn(buhClient, INN);

  const shipped = await new UnfRepo(
    unfClient,
    cfg.unf.org,
  ).naklLines(unfRefs);

  const received = await new BuhRepo(
    buhClient,
    cfg.buh.org,
  ).updLines(buhRefs);

  const unfNomRefs = [
    ...new Set(
      shipped
        .map((x) => String(x.nom ?? ''))
        .filter(Boolean),
    ),
  ];

  const buhNomRefs = [
    ...new Set(
      received
        .map((x) => String(x.nom ?? ''))
        .filter(Boolean),
    ),
  ];

  console.log(`УНФ: уникальных товаров в отгрузках ${unfNomRefs.length}`);
  console.log(`БУХ: уникальных товаров в УПД ${buhNomRefs.length}`);

  const unfNom = await loadNom(unfClient, unfNomRefs);
  const buhNom = await loadNom(buhClient, buhNomRefs);

  console.log(`УНФ: карточек номенклатуры прочитано ${unfNom.length}`);
  console.log(`БУХ: карточек номенклатуры прочитано ${buhNom.length}`);

  const result = [
    compareField(unfNom, buhNom, 'article', 'Артикул'),
    compareField(unfNom, buhNom, 'code', 'Code'),
    compareField(unfNom, buhNom, 'description', 'Description'),
    compareField(unfNom, buhNom, 'fullName', 'НаименованиеПолное'),
  ];

  console.log('\n=== РЕЗУЛЬТАТ СОПОСТАВЛЕНИЯ ===');
  console.log(JSON.stringify(result, null, 2));
}

main().catch((e) => {
  console.error('ОШИБКА:', e.message);
  process.exit(1);
});
