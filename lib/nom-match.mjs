const FIELDS = [
  ['article', 'Артикул'],
  ['code', 'Code'],
  ['fullName', 'НаименованиеПолное'],
  ['description', 'Description'],
];

export function normalizeNomValue(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export function buildNomIndexes(rows) {
  const indexes = {};

  for (const [field] of FIELDS) {
    indexes[field] = new Map();

    for (const row of rows) {
      const key = normalizeNomValue(row[field]);
      if (!key) continue;

      const arr = indexes[field].get(key) ?? [];
      arr.push(row);
      indexes[field].set(key, arr);
    }
  }

  return indexes;
}

export function matchNom(buhRow, indexes) {
  const evidence = [];

  for (const [field, title] of FIELDS) {
    const key = normalizeNomValue(buhRow[field]);
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
