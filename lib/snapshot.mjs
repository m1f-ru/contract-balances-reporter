// Снимок сверки для регистра «СверкаОстатков» (заявка-строки). Чистая функция.

/**
 * @param {Array} byZayavka строки reconcileByZayavka
 * @param {string} nowIso метка времени обновления (ISO)
 * @returns {Array} строки под поля регистра
 */
export function buildSnapshot(byZayavka, nowIso) {
  return byZayavka.map((z) => ({
    Контракт: z.contractKey,
    Заявка: z.zayavka,
    ЗаказаноКол: z.ordQty,
    ОтгруженоКол: z.shipQty,
    ПринятоКол: z.recQty,
    ОстатокКОтгрузкеКол: z.toShipQty,
    ОстатокКПриемкеКол: z.toAcceptQty,
    ЗаказаноСумма: z.ordSum,
    ОтгруженоСумма: z.shipSum,
    ПринятоСумма: z.recSum,
    ОстатокКОтгрузкеСумма: r.toShipSum,
    ОстатокКПриемкеСумма: r.toAcceptSum,
    ДатаОбновления: nowIso,
  }));
}
