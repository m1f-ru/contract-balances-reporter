import { loadConfig } from '../lib/config.mjs';
import { Client } from '../lib/odata.mjs';
import { BuhRepo } from '../lib/buh.mjs';
import { UnfRepo } from '../lib/unf.mjs';
import { buildNomMap } from '../lib/nomenclature.mjs';
import { reconcile } from '../lib/reconcile.mjs';
import { writeJson, writeCsv } from '../lib/output.mjs';

const NOM_KEY = process.env.NOM_MATCH_BY ?? 'name'; // article|code|name (уточняется у заказчика)

async function readNomenclature(client) {
  // Справочник номенклатуры (для маппинга и подписей). Артикул может отсутствовать.
  const rows = await client.getCollection('Catalog_Номенклатура', {
    '$format': 'json', '$select': 'Ref_Key,Description,Артикул,Code',
  });
  return rows.map(r => ({ key: r.Ref_Key, name: r.Description, article: r.Артикул, code: r.Code }));
}

async function main() {
  const cfg = loadConfig();
  const buhClient = new Client(cfg.buh.base, cfg.buh.userpwd, { pageSize: 1000 });
  const unfClient = new Client(cfg.unf.base, cfg.unf.userpwd, { pageSize: 1000 });

  console.error('Читаю УПД (БУХ) …');
  const buhLines = await new BuhRepo(buhClient, cfg.buh.org).updLines();
  console.error(`  строк УПД: ${buhLines.length}`);

  console.error('Читаю накладные (УНФ) …');
  const unfLines = await new UnfRepo(unfClient, cfg.unf.org).naklLines();
  console.error(`  строк накладных: ${unfLines.length}`);

  console.error('Читаю номенклатуру обеих баз …');
  const buhNom = await readNomenclature(buhClient);
  const unfNom = await readNomenclature(unfClient);
  const nm = buildNomMap(buhNom, unfNom, NOM_KEY);

  // Каноникализируем nom в строках; несопоставленные → null (шт не считаем).
  const canonize = (lines, side) => lines.map(l => ({
    ...l, nom: (side === 'buh' ? nm.buhToCanon : nm.unfToCanon).get(l.nom) ?? null,
  }));

  const res = reconcile({
    unfLines: canonize(unfLines, 'unf'),
    buhLines: canonize(buhLines, 'buh'),
  });

  writeJson('out/ostatki.json', res);
  writeCsv('out/ostatki_po_kontraktam.csv', res.byContract,
    ['contractKey', 'planSum', 'shipSum', 'remSum', 'planQty', 'shipQty', 'remQty']);
  writeCsv('out/ostatki_po_poziciyam.csv', res.byItem,
    ['contractKey', 'nom', 'planQty', 'shipQty', 'remQty', 'planSum', 'shipSum', 'remSum']);
  writeJson('out/nesovpadenia.json', {
    ...res.mismatches,
    unmatchedNomBuh: [...nm.unmatchedBuh].length,
    unmatchedNomUnf: [...nm.unmatchedUnf].length,
  });

  console.error(`Готово. Контрактов: ${res.byContract.length}. `
    + `Только план: ${res.mismatches.onlyPlan.length}, только отгрузки: ${res.mismatches.onlyShip.length}, `
    + `строк без ключа: ${res.mismatches.nullKeyCount}.`);
}

main().catch(e => { console.error('ОШИБКА:', e.message); process.exit(1); });
