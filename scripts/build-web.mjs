// Готовит web/data.json для веб-отчёта (GitHub Pages).
// Read-only: читает БУХ+УНФ, считает сверку и кладёт JSON рядом с web/index.html.

import { loadConfig } from '../lib/config.mjs';
import { Client } from '../lib/odata.mjs';
import { refsByInn } from '../lib/contractors.mjs';
import { BuhRepo } from '../lib/buh.mjs';
import { UnfRepo } from '../lib/unf.mjs';
import { reconcile3 } from '../lib/reconcile.mjs';
import { reconcileByZayavka } from '../lib/zayavka.mjs';
import { writeJson } from '../lib/output.mjs';
import { filterByOrderYear } from '../lib/period.mjs';

import {
  loadNomCatalog,
  makeCatalogMap,
  buildBuhToUnfMap,
} from '../lib/nom-catalog.mjs';

import { reconcileByNom } from '../lib/nom-reconcile.mjs';

const INN = process.env.CTO_INN ?? '9705101759'; // ГАУ ЦТО
const REPORT_YEAR = Number(process.env.REPORT_YEAR ?? '2025');

function refsFromLines(lines) {
  return [
    ...new Set(
      lines
        .map((line) => String(line.nom ?? '').trim())
        .filter(Boolean),
    ),
  ];
}

function displayName(row) {
  return (
    row.fullName ||
    row.description ||
    row.article ||
    row.code ||
    row.ref ||
    ''
  );
}

async function main() {
  if (
    !Number.isInteger(REPORT_YEAR) ||
    REPORT_YEAR < 2000 ||
    REPORT_YEAR > 2100
  ) {
    throw new Error(
      `Некорректный REPORT_YEAR: ${REPORT_YEAR}`,
    );
  }

  const cfg = loadConfig();

  const buhClient = new Client(
    cfg.buh.base,
    cfg.buh.userpwd,
    { pageSize: 1000 },
  );

  const unfClient = new Client(
    cfg.unf.base,
    cfg.unf.userpwd,
    { pageSize: 1000 },
  );

  const unfRefs = await refsByInn(unfClient, INN);
  const buhRefs = await refsByInn(buhClient, INN);

  const unfRepo = new UnfRepo(
    unfClient,
    cfg.unf.org,
  );

  const buhRepo = new BuhRepo(
    buhClient,
    cfg.buh.org,
  );

  // Сначала читаем полную историю.
  const orderedAll = await unfRepo.orderLines(unfRefs);
  const shippedAll = await unfRepo.naklLines(unfRefs);
  const receivedAll = await buhRepo.updLines(buhRefs);

  // Период определяется по дате заявки / Заказа покупателя УНФ.
  // Связанные отгрузки и УПД сохраняются даже если оформлены позднее.
  const {
    ordered,
    shipped,
    received,
  } = filterByOrderYear({
    ordered: orderedAll,
    shipped: shippedAll,
    received: receivedAll,
    year: REPORT_YEAR,
  });

  // Сверка по контрактам и заявкам.
  const byContract = reconcile3({
    ordered,
    shipped,
    received,
  }).byContract;

  const byZayavka = reconcileByZayavka({
    ordered,
    shipped,
    received,
  }).byZayavka;

  // Номенклатура только реально участвующих строк выбранного периода.
  const unfNomRefs = refsFromLines([
    ...ordered,
    ...shipped,
  ]);

  const buhNomRefs = refsFromLines(received);

  const unfNom = await loadNomCatalog(
    unfClient,
    unfNomRefs,
  );

  const buhNom = await loadNomCatalog(
    buhClient,
    buhNomRefs,
  );

  const unfNomMap = makeCatalogMap(unfNom);
  const buhNomMap = makeCatalogMap(buhNom);

  const {
    map: buhToUnfMap,
    stats: nomMatchStats,
  } = buildBuhToUnfMap(
    unfNom,
    buhNom,
  );

  // Контракт × заявка × товар.
  const byNomRaw = reconcileByNom({
    ordered,
    shipped,
    received,
    buhToUnfMap,
  });

  const byNom = byNomRaw.map((row) => {
    const unfCard = row.unfNomRef
      ? unfNomMap.get(String(row.unfNomRef))
      : null;

    const buhCard = row.buhNomRef
      ? buhNomMap.get(String(row.buhNomRef))
      : null;

    const card = unfCard ?? buhCard ?? {};

    return {
      ...row,

      nomName: displayName(card),
      nomArticle: card.article ?? '',
      nomCode: card.code ?? '',

      hasQtyDiff:
        row.toShipQty !== 0 ||
        row.toAcceptQty !== 0,

      hasSumDiff:
        row.toShipSum !== 0 ||
        row.toAcceptSum !== 0,
    };
  });

  writeJson('web/data.json', {
    generatedAt: new Date().toISOString(),
    inn: INN,
    customer: 'ГАУ ЦТО',
    periodYear: REPORT_YEAR,

    byContract,
    byZayavka,
    byNom,
    nomMatchStats,
  });

  console.error(
    `web/data.json готов: ` +
    `период ${REPORT_YEAR}, ` +
    `контрактов ${byContract.length}, ` +
    `заявок ${byZayavka.length}, ` +
    `товарных строк ${byNom.length}, ` +
    `сопоставление ${nomMatchStats.matched}/${nomMatchStats.total}.`,
  );
}

main().catch((e) => {
  console.error('ОШИБКА:', e.message);
  process.exit(1);
});
