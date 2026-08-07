// Разрез по заявкам: заявка = (контракт, суффикс). Суффикс — часть номера после последнего "/".

export function zayavkaSuffix(number) {
  const s = String(number ?? '').trim();
  const i = s.lastIndexOf('/');
  return (i >= 0 ? s.slice(i + 1) : s).trim();
}

export function zayavkaKey(contractKey, number) {
  if (contractKey == null) return null;
  return contractKey + '#' + zayavkaSuffix(number);
}

/**
 * @param {{ordered:Array, shipped:Array, received:Array}} p
 *   ordered: {contractKey, number, orderRef, qty, sum}; received: {contractKey, zayavka, qty, sum};
 *   shipped: {contractKey, order (ref заявки), qty, sum}
 */
export function reconcileByZayavka({ ordered, shipped, received }) {
  const m = new Map();
  const orderRefToZKey = new Map();
  const contractToOrderedKeys = new Map();
  let nullKeyCount = 0;

  const get = (zk, contractKey, suffix) => {
    if (!m.has(zk)) {
      m.set(zk, {
        contractKey,
        suffix,
        ordQty: 0,
        shipQty: 0,
        recQty: 0,
        ordSum: 0,
        shipSum: 0,
        recSum: 0,
      });
    }
    return m.get(zk);
  };

  // Заказано: формируем базовый набор заявок из УНФ.
  for (const l of ordered) {
    const zk = zayavkaKey(l.contractKey, l.zayavka);

    if (zk == null) {
      nullKeyCount++;
      continue;
    }

    if (l.orderRef) {
      orderRefToZKey.set(String(l.orderRef), zk);
    }

    // Запоминаем все реальные заявки каждого контракта.
    let keys = contractToOrderedKeys.get(l.contractKey);
    if (!keys) {
      keys = new Set();
      contractToOrderedKeys.set(l.contractKey, keys);
    }
    keys.add(zk);

    const r = get(
      zk,
      l.contractKey,
      zayavkaSuffix(l.zayavka),
    );

    r.ordQty += Number(l.qty) || 0;
    r.ordSum += Number(l.sum) || 0;
  }

  // Принято: пытаемся сопоставить УПД из Бухгалтерии с заявкой УНФ.
  for (const l of received) {
    let zk = zayavkaKey(l.contractKey, l.zayavka);

    if (zk == null) {
      nullKeyCount++;
      continue;
    }

    // Если указанный в БУХ номер заявки напрямую не найден,
    // но у этого контракта в УНФ существует ровно одна заявка,
    // соответствие однозначно — относим УПД к ней.
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

  // Отгружено: в первую очередь связываем накладную
  // с заказом по ссылке на документ УНФ.
  for (const l of shipped) {
    let zk = l.order
      ? orderRefToZKey.get(String(l.order))
      : null;

    if (!zk) {
      if (l.contractKey == null) {
        nullKeyCount++;
        continue;
      }

      // Накладная без установленной связи с заявкой.
      zk = l.contractKey + '#-';
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

function round2(x) {
  return Math.round((x + Number.EPSILON) * 100) / 100;
}
