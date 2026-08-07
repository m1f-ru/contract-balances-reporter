test('buildSnapshot маппит строку заявки в поля регистра', () => {
  const byZayavka = [{
    contractKey: 'ОК1', zayavka: '1',
    ordQty: 535, shipQty: 504, recQty: 431, toShipQty: 31, toAcceptQty: 73,
    ordSum: 5350, shipSum: 5040, recSum: 4310,
    toShipSum: 310, toAcceptSum: 730,
  }];

  const rows = buildSnapshot(byZayavka, '2026-07-07T00:00:00Z');

  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0], {
    Контракт: 'ОК1', Заявка: '1',
    ЗаказаноКол: 535, ОтгруженоКол: 504, ПринятоКол: 431,
    ОстатокКОтгрузкеКол: 31, ОстатокКПриемкеКол: 73,
    ЗаказаноСумма: 5350, ОтгруженоСумма: 5040, ПринятоСумма: 4310,
    ОстатокКОтгрузкеСумма: 310, ОстатокКПриемкеСумма: 730,
    ДатаОбновления: '2026-07-07T00:00:00Z',
  });
});
