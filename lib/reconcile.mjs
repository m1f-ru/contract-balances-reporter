// Чистая агрегация остатков. Без ввода-вывода.

/**
 * @param {{unfLines:Array, buhLines:Array}} p строки с {contractKey, nom, qty, sum}
 */
export function reconcile({ unfLines, buhLines }) {
  let nullKeyCount = 0;
  const contract = new Map(); // contractKey → {planSum, shipSum, planQty, shipQty}
  const item = new Map();     // "contractKey\tnom" → {planQty, shipQty, planSum, shipSum}
  const planKeys = new Set(); // контракты, реально встреченные на стороне плана (УНФ)
  const shipKeys = new Set(); // ... и на стороне отгрузок (БУХ)

  const bump = (map, k, field, qty, sum) => {
    const r = map.get(k) ?? { planSum: 0, shipSum: 0, planQty: 0, shipQty: 0 };
    r[field + 'Qty'] += Number(qty) || 0;
    r[field + 'Sum'] += Number(sum) || 0;
    map.set(k, r);
  };

  const feed = (lines, field, present) => {
    for (const l of lines) {
      if (l.contractKey == null) { nullKeyCount++; continue; }
      present.add(l.contractKey);
      bump(contract, l.contractKey, field, l.qty, l.sum);
      if (l.nom != null) {
        bump(item, l.contractKey + '\t' + l.nom, field, l.qty, l.sum);
      }
    }
  };
  feed(unfLines, 'plan', planKeys);
  feed(buhLines, 'ship', shipKeys);

  const byKey = (a, b) => String(a).localeCompare(String(b));

  const byContract = [...contract.entries()].map(([contractKey, r]) => ({
    contractKey,
    planSum: round2(r.planSum), shipSum: round2(r.shipSum), remSum: round2(r.planSum - r.shipSum),
    planQty: r.planQty, shipQty: r.shipQty, remQty: r.planQty - r.shipQty,
  })).sort((a, b) => byKey(a.contractKey, b.contractKey));

  const byItem = [...item.entries()].map(([k, r]) => {
    const [contractKey, nom] = k.split('\t');
    return {
      contractKey, nom,
      planQty: r.planQty, shipQty: r.shipQty, remQty: r.planQty - r.shipQty,
      planSum: round2(r.planSum), shipSum: round2(r.shipSum), remSum: round2(r.planSum - r.shipSum),
    };
  }).sort((a, b) => byKey(a.contractKey, b.contractKey) || byKey(a.nom, b.nom));

  // Нестыковки — по ПРИСУТСТВИЮ стороны, а не по нулевым суммам.
  const onlyPlan = [...planKeys].filter(k => !shipKeys.has(k)).sort(byKey);
  const onlyShip = [...shipKeys].filter(k => !planKeys.has(k)).sort(byKey);

  return { byContract, byItem, mismatches: { onlyPlan, onlyShip, nullKeyCount } };
}

function round2(x) { return Math.round((x + Number.EPSILON) * 100) / 100; }

/**
 * Трёхисточниковая сверка по контракту: Заказано / Отгружено / Принято.
 * @param {{ordered:Array, shipped:Array, received:Array}} p строки с {contractKey, qty, sum}
 * @returns {{byContract:Array, mismatches:{nullKeyCount:number}}}
 */
export function reconcile3({ ordered, shipped, received }) {
  const m = new Map(); // contractKey → {ordQty,ordSum, shipQty,shipSum, recQty,recSum}
  let nullKeyCount = 0;

  const feed = (lines, field) => {
    for (const l of lines) {
      if (l.contractKey == null) { nullKeyCount++; continue; }
      const r = m.get(l.contractKey) ?? { ordQty: 0, ordSum: 0, shipQty: 0, shipSum: 0, recQty: 0, recSum: 0 };
      r[field + 'Qty'] += Number(l.qty) || 0;
      r[field + 'Sum'] += Number(l.sum) || 0;
      m.set(l.contractKey, r);
    }
  };
  feed(ordered, 'ord');
  feed(shipped, 'ship');
  feed(received, 'rec');

  const byContract = [...m.entries()].map(([contractKey, r]) => ({
    contractKey,
    ordQty: r.ordQty, shipQty: r.shipQty, recQty: r.recQty,
    toShipQty: r.ordQty - r.shipQty,      // остаток к отгрузке = Заказано − Отгружено
    toAcceptQty: r.shipQty - r.recQty,    // остаток к приёмке = Отгружено − Принято
    ordSum: round2(r.ordSum), shipSum: round2(r.shipSum), recSum: round2(r.recSum),
    toShipSum: round2(r.ordSum - r.shipSum),
    toAcceptSum: round2(r.shipSum - r.recSum),
  })).sort((a, b) => String(a.contractKey).localeCompare(String(b.contractKey)));

  return { byContract, mismatches: { nullKeyCount } };
}
