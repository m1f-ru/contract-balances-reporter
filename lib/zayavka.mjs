export function reconcileByZayavka({ ordered, shipped, received }) {
  const m = new Map();
  const orderRefToZKey = new Map();
  const contractToOrderedKeys = new Map();
  let nullKeyCount = 0;

  const get = (zk, contractKey, suffix) => {
    let r = m.get(zk);

    if (!r) {
      r = {
        contractKey,
        suffix,
        ordQty: 0,
        ordSum: 0,
        shipQty: 0,
        shipSum: 0,
        recQty: 0,
        recSum: 0,
      };

      m.set(zk, r);
    }

    return r;
  };

  // Заказано — заявки из УНФ.
  for (const l of ordered) {
    const zk = zayavkaKey(l.contractKey, l.number);

    if (zk == null) {
      nullKeyCount++;
      continue;
    }

    const r = get(
      zk,
      l.contractKey,
      zayavkaSuffix(l.number),
    );

    r.ordQty += Number(l.qty) || 0;
    r.ordSum += Number(l.sum) || 0;

    if (l.orderRef) {
      orderRefToZKey.set(String(l.orderRef), zk);
    }

    let keys = contractToOrderedKeys.get(l.contractKey);

    if (!keys) {
      keys = new Set();
      contractToOrderedKeys.set(l.contractKey, keys);
    }

    keys.add(zk);
  }

  // Принято — УПД из Бухгалтерии.
  for (const l of received) {
    let zk = zayavkaKey(l.contractKey, l.zayavka);

    if (zk == null) {
      nullKeyCount++;
      continue;
    }

    // Если номер заявки из БУХ не совпал,
    // но у контракта в УНФ ровно одна заявка,
    // привязка однозначна.
    if (!m.has(zk)) {
      const keys = contractToOrderedKeys.get(l.contractKey);

      if (keys?.size === 1) {
        zk = [...keys][0];
      }
    }

    const existing = m.get(zk);

    const suffix = existing
      ? existing.suffix
      : zayavkaSuffix(l.zayavka);

    const r = get(
      zk,
      l.contractKey,
      suffix,
    );

    r.recQty += Number(l.qty) || 0;
    r.recSum += Number(l.sum) || 0;
  }

  // Отгружено — накладные из УНФ.
  for (const l of shipped) {
    let zk = l.order
      ? orderRefToZKey.get(String(l.order))
      : null;

    if (!zk) {
      if (l.contractKey == null) {
        nullKeyCount++;
        continue;
      }

      zk = l.contractKey + '#—';
    }

    const existing = m.get(zk);

    const contractKey = existing
      ? existing.contractKey
      : l.contractKey;

    const suffix = existing
      ? existing.suffix
      : '—';

    const r = get(
      zk,
      contractKey,
      suffix,
    );

    r.shipQty += Number(l.qty) || 0;
    r.shipSum += Number(l.sum) || 0;
  }

  const byZayavka = [...m.values()]
    .map((r) => ({
      contractKey: r.contractKey,
      zayavka: r.suffix,

      ordQty: r.ordQty,
      shipQty: r.shipQty,
      recQty: r.recQty,

      toShipQty: r.ordQty - r.shipQty,
      toAcceptQty: r.shipQty - r.recQty,

      ordSum: round2(r.ordSum),
      shipSum: round2(r.shipSum),
      recSum: round2(r.recSum),

      toShipSum: round2(r.ordSum - r.shipSum),
      toAcceptSum: round2(r.shipSum - r.recSum),
    }))
    .sort(
      (a, b) =>
        String(a.contractKey).localeCompare(String(b.contractKey)) ||
        String(a.zayavka).localeCompare(String(b.zayavka)),
    );

  return {
    byZayavka,
    mismatches: { nullKeyCount },
  };
}
