import {
  zayavkaKey,
  zayavkaSuffix,
} from './zayavka.mjs';

/**
 * Товарная сверка:
 * контракт × заявка × номенклатура УНФ.
 *
 * received должен уже содержать исходный nom из БУХ.
 * buhToUnfMap — результат buildBuhToUnfMap().
 */
export function reconcileByNom({
  ordered,
  shipped,
  received,
  buhToUnfMap,
}) {
  const rows = new Map();

  const orderRefToZKey = new Map();
  const contractToOrderedKeys = new Map();

  function rememberOrderedKey(contractKey, zk) {
    let keys = contractToOrderedKeys.get(contractKey);

    if (!keys) {
      keys = new Set();
      contractToOrderedKeys.set(contractKey, keys);
    }

    keys.add(zk);
  }

  function getRow({
    contractKey,
    zayavka,
    nomKey,
    unfNomRef = null,
    buhNomRef = null,
    matchStatus = 'matched',
    matchMethod = null,
  }) {
    const key = [
      contractKey ?? '',
      zayavka ?? '',
      nomKey ?? '',
    ].join('#');

    let row = rows.get(key);

    if (!row) {
      row = {
        contractKey,
        zayavka,
        nomKey,
        unfNomRef,
        buhNomRef,
        matchStatus,
        matchMethod,

        ordQty: 0,
        ordSum: 0,

        shipQty: 0,
        shipSum: 0,

        recQty: 0,
        recSum: 0,
      };

      rows.set(key, row);
    }

    return row;
  }

  // 1. Заказано — УНФ.
  for (const line of ordered) {
    if (line.contractKey == null) continue;

    const zk = zayavkaKey(
      line.contractKey,
      line.number,
    );

    if (zk == null) continue;

    const suffix = zayavkaSuffix(line.number);

    if (line.orderRef) {
      orderRefToZKey.set(
        String(line.orderRef),
        zk,
      );
    }

    rememberOrderedKey(
      line.contractKey,
      zk,
    );

    const nomRef = String(line.nom ?? '').trim();

    if (!nomRef) continue;

    const row = getRow({
      contractKey: line.contractKey,
      zayavka: suffix,
      nomKey: `unf:${nomRef}`,
      unfNomRef: nomRef,
      matchStatus: 'matched',
      matchMethod: 'УНФ',
    });

    row.ordQty += Number(line.qty) || 0;
    row.ordSum += Number(line.sum) || 0;
  }

  // 2. Отгружено — УНФ.
  for (const line of shipped) {
    const nomRef = String(line.nom ?? '').trim();

    if (!nomRef) continue;

    let zk = line.order
      ? orderRefToZKey.get(String(line.order))
      : null;

    let contractKey = line.contractKey;
    let suffix = '—';

    if (zk) {
      const pos = zk.indexOf('#');

      contractKey = zk.slice(0, pos);
      suffix = zk.slice(pos + 1);
    }

    if (contractKey == null) continue;

    const row = getRow({
      contractKey,
      zayavka: suffix,
      nomKey: `unf:${nomRef}`,
      unfNomRef: nomRef,
      matchStatus: 'matched',
      matchMethod: 'УНФ',
    });

    row.shipQty += Number(line.qty) || 0;
    row.shipSum += Number(line.sum) || 0;
  }

  // 3. Принято — БУХ.
  for (const line of received) {
    if (line.contractKey == null) continue;

    let zk = zayavkaKey(
      line.contractKey,
      line.zayavka,
    );

    if (zk == null) continue;

    // Та же безопасная логика, что используется
    // в сверке заявок: если у контракта ровно
    // одна заявка УНФ, её можно выбрать однозначно.
    if (!contractToOrderedKeys
      .get(line.contractKey)
      ?.has(zk)) {

      const keys =
        contractToOrderedKeys.get(line.contractKey);

      if (keys?.size === 1) {
        zk = [...keys][0];
      }
    }

    const pos = zk.indexOf('#');

    const contractKey = zk.slice(0, pos);
    const suffix = zk.slice(pos + 1);

    const buhRef = String(line.nom ?? '').trim();

    if (!buhRef) continue;

    const match =
      buhToUnfMap.get(buhRef) ?? {
        status: 'unmatched',
        unfRef: null,
        method: null,
      };

    const unfRef = match.unfRef
      ? String(match.unfRef)
      : null;

    const nomKey = unfRef
      ? `unf:${unfRef}`
      : `buh:${buhRef}`;

    const row = getRow({
      contractKey,
      zayavka: suffix,
      nomKey,
      unfNomRef: unfRef,
      buhNomRef: buhRef,
      matchStatus: match.status,
      matchMethod: match.method,
    });

    if (!row.buhNomRef) {
      row.buhNomRef = buhRef;
    }

    row.recQty += Number(line.qty) || 0;
    row.recSum += Number(line.sum) || 0;
  }

  return [...rows.values()]
    .map((row) => ({
      ...row,

      ordSum: round2(row.ordSum),
      shipSum: round2(row.shipSum),
      recSum: round2(row.recSum),

      toShipQty:
        row.ordQty - row.shipQty,

      toAcceptQty:
        row.shipQty - row.recQty,

      toShipSum: round2(
        row.ordSum - row.shipSum,
      ),

      toAcceptSum: round2(
        row.shipSum - row.recSum,
      ),
    }))
    .sort(
      (a, b) =>
        String(a.contractKey)
          .localeCompare(String(b.contractKey)) ||
        String(a.zayavka)
          .localeCompare(String(b.zayavka)) ||
        String(a.nomKey)
          .localeCompare(String(b.nomKey)),
    );
}

function round2(value) {
  return Math.round(
    (Number(value) + Number.EPSILON) * 100,
  ) / 100;
}
