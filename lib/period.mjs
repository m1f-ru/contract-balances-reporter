import { zayavkaKey } from './zayavka.mjs';

function isYear(date, year) {
  return String(date ?? '').slice(0, 4) === String(year);
}

/**
 * Период задаётся по дате заявки/Заказа покупателя УНФ.
 *
 * Заказано:
 *   только заявки выбранного года.
 *
 * Отгружено:
 *   только накладные, связанные ссылкой с выбранными заявками,
 *   независимо от даты самой накладной.
 *
 * Принято:
 *   УПД выбранных заявок независимо от даты УПД.
 *
 * Для исторического случая, когда БУХ не содержит нормальный
 * номер заявки, допускается существующее безопасное правило:
 * если у контракта вообще ровно одна заявка УНФ, УПД относится к ней.
 */
export function filterByOrderYear({
  ordered,
  shipped,
  received,
  year,
}) {
  const selectedOrdered = ordered.filter(
    (line) => isYear(line.date, year),
  );

  const selectedOrderRefs = new Set(
    selectedOrdered
      .map((line) =>
        String(line.orderRef ?? line.doc ?? '').trim(),
      )
      .filter(Boolean),
  );

  const selectedZKeys = new Set();
  const selectedContracts = new Set();

  for (const line of selectedOrdered) {
    const zk = zayavkaKey(
      line.contractKey,
      line.number,
    );

    if (zk != null) {
      selectedZKeys.add(zk);
    }

    if (line.contractKey != null) {
      selectedContracts.add(line.contractKey);
    }
  }

  // Считаем все заявки контракта по полной истории,
  // а не только внутри 2025 года.
  // Это не позволит ошибочно принять контракт с несколькими
  // заявками за однозначный только после фильтрации периода.
  const allKeysByContract = new Map();

  for (const line of ordered) {
    if (line.contractKey == null) continue;

    const zk = zayavkaKey(
      line.contractKey,
      line.number,
    );

    if (zk == null) continue;

    let keys = allKeysByContract.get(
      line.contractKey,
    );

    if (!keys) {
      keys = new Set();
      allKeysByContract.set(
        line.contractKey,
        keys,
      );
    }

    keys.add(zk);
  }

  const selectedShipped = shipped.filter(
    (line) =>
      line.order != null &&
      selectedOrderRefs.has(String(line.order)),
  );

  const selectedReceived = received.filter(
    (line) => {
      if (line.contractKey == null) {
        return false;
      }

      const zk = zayavkaKey(
        line.contractKey,
        line.zayavka,
      );

      // Нормальное точное совпадение заявки.
      if (zk != null && selectedZKeys.has(zk)) {
        return true;
      }

      // Старый безопасный fallback:
      // только если у контракта во всей истории
      // ровно одна заявка.
      const allKeys =
        allKeysByContract.get(line.contractKey);

      return (
        selectedContracts.has(line.contractKey) &&
        allKeys?.size === 1
      );
    },
  );

  return {
    ordered: selectedOrdered,
    shipped: selectedShipped,
    received: selectedReceived,
  };
}
