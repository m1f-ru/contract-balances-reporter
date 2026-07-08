// Импорт «Принято» (БУХ УПД) в УНФ. По умолчанию DRY-RUN: только план, без записи.
// Идемпотентность — по ключу источника (Ref_Key УПД). Запись (--apply) включается
// только после согласования целевого объекта УНФ (документ/регистр, виртуальный склад, поля).
import { loadConfig } from '../lib/config.mjs';
import { Client } from '../lib/odata.mjs';
import { refsByInn } from '../lib/contractors.mjs';
import { BuhRepo } from '../lib/buh.mjs';
import { writeJson } from '../lib/output.mjs';

const INN = process.env.CTO_INN ?? '9705101759'; // ГАУ ЦТО
const APPLY = process.argv.includes('--apply');

async function main() {
  const cfg = loadConfig();
  const buhClient = new Client(cfg.buh.base, cfg.buh.userpwd, { pageSize: 1000 });

  console.error(`Читаю «Принято» (УПД БУХ) для ИНН ${INN} …`);
  const buhRefs = await refsByInn(buhClient, INN);
  const received = await new BuhRepo(buhClient, cfg.buh.org).updLines(buhRefs);

  // План импорта = что будет записано в УНФ. Ключ идемпотентности — source (Ref_Key УПД).
  const plan = received.map((l) => ({
    source: l.doc,            // Ref_Key документа УПД — стабильный ключ идемпотентности
    number: l.number, date: l.date,
    contractKey: l.contractKey, zayavka: l.zayavka,
    nom: l.nom, qty: l.qty, sum: l.sum,
  }));
  const docs = new Set(plan.map((p) => p.source)).size;
  const noKey = plan.filter((p) => p.contractKey == null).length;
  writeJson('out/import_plan.json', { count: plan.length, docs, noKey, plan });
  console.error(`План импорта: строк=${plan.length}, документов-УПД=${docs}, строк без контракта=${noKey}.`);

  if (!APPLY) {
    console.error('DRY-RUN — запись НЕ выполнялась. План: out/import_plan.json');
    return;
  }
  console.error('ОШИБКА: --apply заблокирован. Не задан целевой объект записи в УНФ '
    + '(какой документ/регистр, виртуальный склад, поля, ключ идемпотентности). Согласуйте цель — включим запись.');
  process.exit(2);
}

main().catch((e) => { console.error('ОШИБКА:', e.message); process.exit(1); });
