import { loadConfig } from '../lib/config.mjs';
import { Client } from '../lib/odata.mjs';
import { refsByInn } from '../lib/contractors.mjs';
import { BuhRepo } from '../lib/buh.mjs';
import { UnfRepo } from '../lib/unf.mjs';
import { reconcile3 } from '../lib/reconcile.mjs';
import { reconcileByZayavka } from '../lib/zayavka.mjs';
import { writeJson, writeCsv, writeCsvLabeled } from '../lib/output.mjs';

const INN = process.env.CTO_INN ?? '9705101759'; // ГАУ ЦТО

async function main() {
  const cfg = loadConfig();
  const buhClient = new Client(cfg.buh.base, cfg.buh.userpwd, { pageSize: 1000 });
  const unfClient = new Client(cfg.unf.base, cfg.unf.userpwd, { pageSize: 1000 });

  console.error(`Резолвлю контрагента ИНН ${INN} …`);
  const unfRefs = await refsByInn(unfClient, INN);
  const buhRefs = await refsByInn(buhClient, INN);
  console.error(`  карточек: УНФ=${unfRefs.size}, БУХ=${buhRefs.size}`);

  console.error('Заказано (ЗаказПокупателя, УНФ) …');
  const ordered = await new UnfRepo(unfClient, cfg.unf.org).orderLines(unfRefs);
  console.error('Отгружено (РасходнаяНакладная, УНФ) …');
  const shipped = await new UnfRepo(unfClient, cfg.unf.org).naklLines(unfRefs);
  console.error('Принято (УПД, БУХ) …');
  const received = await new BuhRepo(buhClient, cfg.buh.org).updLines(buhRefs);
  console.error(`  строк: Заказано=${ordered.length}, Отгружено=${shipped.length}, Принято=${received.length}`);

  const res = reconcile3({ ordered, shipped, received });

  writeJson('out/tri.json', res);
  writeCsv('out/tri_po_kontraktam.csv', res.byContract,
    ['contractKey','ordQty','shipQty','recQty','toShipQty','toAcceptQty','ordSum','shipSum','recSum','toShipSum','toAcceptSum']);
  writeCsvLabeled('out/otchet_gau_cto.csv', res.byContract, [
    ['contractKey', 'Контракт'],
    ['ordQty', 'Заказано, шт'],
    ['shipQty', 'Отгружено, шт'],
    ['recQty', 'Принято, шт'],
    ['toShipQty', 'Остаток к отгрузке, шт'],
    ['toAcceptQty', 'Остаток к приёмке, шт'],
    ['ordSum', 'Заказано, ₽'],
    ['shipSum', 'Отгружено, ₽'],
    ['recSum', 'Принято, ₽'],
    ['toShipSum', 'Остаток к отгрузке, ₽'],
    ['toAcceptSum', 'Остаток к приёмке, ₽'],
  ]);

  const byZ = reconcileByZayavka({ ordered, shipped, received });
  writeJson('out/tri_po_zayavkam.json', byZ);
  writeCsvLabeled('out/otchet_gau_cto_zayavki.csv', byZ.byZayavka, [
    ['contractKey', 'Контракт'],
    ['zayavka', 'Заявка'],
    ['ordQty', 'Заказано, шт'],
    ['shipQty', 'Отгружено, шт'],
    ['recQty', 'Принято, шт'],
    ['toShipQty', 'Остаток к отгрузке, шт'],
    ['toAcceptQty', 'Остаток к приёмке, шт'],
  ]);
  console.error(`Заявок: ${byZ.byZayavka.length}.`);

  console.error(`Готово. Контрактов ГАУ ЦТО: ${res.byContract.length}. Строк без контракта (правит оператор): ${res.mismatches.nullKeyCount}.`);
}
main().catch(e => { console.error('ОШИБКА:', e.message); process.exit(1); });
