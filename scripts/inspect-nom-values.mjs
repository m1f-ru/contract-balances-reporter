import { loadConfig } from '../lib/config.mjs';
import { Client } from '../lib/odata.mjs';
import { refsByInn } from '../lib/contractors.mjs';
import { UnfRepo } from '../lib/unf.mjs';
import { BuhRepo } from '../lib/buh.mjs';

const INN = process.env.CTO_INN ?? '9705101759';
const NOM = 'Catalog_Номенклатура';

const FIELDS = [
  ['article', 'Артикул'],
  ['code', 'Code'],
  ['fullName', 'НаименованиеПолное'],
  ['description', 'Description'],
];

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

function buildIndexes(rows) {
  const indexes = {};

  for (const [field] of FIELDS) {
    indexes[field] = new Map();

    for (const row of rows) {
      const key = norm(row[field]);
      if (!key) continue;

      const arr = indexes[field].get(key) ?? [];
      arr.push(row);
      indexes[field].set(key, arr);
    }
  }

  return indexes;
}

function matchOne(buhRow, indexes) {
  const evidence = [];

  for (const [field, title] of FIELDS) {
    const key = norm(buhRow[field]);
    if (!key) continue;

    const candidates = indexes[field].get(key) ?? [];

    if (candidates.length) {
      evidence.push({
        field,
        title,
        value: buhRow[field],
        candidates,
      });
    }
  }

  const uniqueEvidence = evidence.filter(
    (e) => e.candidates.length === 1,
  );

  const uniqueRefs = [
    ...new Set(
      uniqueEvidence.map((e) => e.candidates[0].ref),
    ),
  ];

  if (uniqueRefs.length > 1) {
    return {
      status: 'conflict',
      evidence,
    };
  }

  if (uniqueRefs.length === 1) {
    const chosenRef = uniqueRefs[0];

    const contradiction = evidence.some(
      (e) =>
        e.candidates.length > 0 &&
        !e.candidates.some((x) => x.ref === chosenRef),
    );

    if (contradiction) {
      return {
        status: 'conflict',
        evidence,
      };
    }

    const chosen = uniqueEvidence.find(
      (e) => e.candidates[0].ref === chosenRef,
    );

    return {
      status: 'matched',
      method: chosen.title,
      unf: chosen.candidates[0],
      evidence,
    };
  }

  if (evidence.length) {
    return {
      status: 'ambiguous',
      evidence,
    };
  }

  return {
    status: 'unmatched',
    evidence: [],
  };
}

function shortRow(row) {
  return {
    article: row.article,
    code: row.code,
    description: row.description,
    fullName: row.fullName,
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

  const unfRepo = new UnfRepo(
    unfClient,
    cfg.unf.org,
  );

  const ordered = await unfRepo.orderLines(unfRefs);
  const shipped = await unfRepo.naklLines(unfRefs);

  const received = await new BuhRepo(
    buhClient,
    cfg.buh.org,
  ).updLines(buhRefs);

  const unfNomRefs = [
    ...new Set(
      [...ordered, ...shipped]
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

  console.log(
    `УНФ: уникальных товаров в заказах и отгрузках ${unfNomRefs.length}`,
  );

  console.log(
    `БУХ: уникальных товаров в УПД ${buhNomRefs.length}`,
  );

  const unfNom = await loadNom(unfClient, unfNomRefs);
  const buhNom = await loadNom(buhClient, buhNomRefs);

  console.log(
    `УНФ: карточек номенклатуры прочитано ${unfNom.length}`,
  );

  console.log(
    `БУХ: карточек номенклатуры прочитано ${buhNom.length}`,
  );

  const indexes = buildIndexes(unfNom);

  const stats = {
    total: buhNom.length,
    matched: 0,
    conflict: 0,
    ambiguous: 0,
    unmatched: 0,
    methods: {},
  };

  const problems = [];

  for (const buhRow of buhNom) {
    const result = matchOne(buhRow, indexes);

    stats[result.status]++;

    if (result.status === 'matched') {
      stats.methods[result.method] =
        (stats.methods[result.method] ?? 0) + 1;

      continue;
    }

    if (problems.length < 30) {
      problems.push({
        status: result.status,
        buh: shortRow(buhRow),
        evidence: result.evidence.map((e) => ({
          field: e.title,
          value: e.value,
          candidateCount: e.candidates.length,
          candidates: e.candidates
            .slice(0, 5)
            .map(shortRow),
        })),
      });
    }
  }

  stats.coveragePercent = stats.total
    ? Math.round((stats.matched / stats.total) * 10000) / 100
    : 0;

  console.log('\n=== КАСКАДНОЕ СОПОСТАВЛЕНИЕ ===');
  console.log(JSON.stringify(stats, null, 2));

  console.log('\n=== ПРОБЛЕМНЫЕ ПОЗИЦИИ ===');
  console.log(JSON.stringify(problems, null, 2));
}

main().catch((e) => {
  console.error('ОШИБКА:', e.message);
  process.exit(1);
});
