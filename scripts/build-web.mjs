// Готовит web/data.json для веб-отчёта (GitHub Pages). Read-only: читает БУХ+УНФ,
// считает сверку по контрактам и заявкам, кладёт JSON рядом со страницей web/index.html.
import { loadConfig } from '../lib/config.mjs';
import { Client } from '../lib/odata.mjs';
import { refsByInn } from '../lib/contractors.mjs';
import { BuhRepo } from '../lib/buh.mjs';
import { UnfRepo } from '../lib/unf.mjs';
import { reconcile3 } from '../lib/reconcile.mjs';
import { reconcileByZayavka } from '../lib/zayavka.mjs';
import { writeJson } from '../lib/output.mjs';

const INN = process.env.CTO_INN ?? '9705101759'; // ГАУ ЦТО

async function main() {
  const cfg = loadConfig();
  const buhClient = new Client(cfg.buh.base, cfg.buh.userpwd, { pageSize: 1000 });
  const unfClient = new Client(cfg.unf.base, cfg.unf.userpwd, { pageSize: 1000 });

  const unfRefs = await refsByInn(unfClient, INN);
  const buhRefs = await refsByInn(buhClient, INN);
  const ordered = await new UnfRepo(unfClient, cfg.unf.org).orderLines(unfRefs);
  const shipped = await new UnfRepo(unfClient, cfg.unf.org).naklLines(unfRefs);
  const received = await new BuhRepo(buhClient, cfg.buh.org).updLines(buhRefs);

  const byContract = reconcile3({ ordered, shipped, received }).byContract;
  const byZayavka = reconcileByZayavka({ ordered, shipped, received }).byZayavka;

  writeJson('web/data.json', {
    generatedAt: new Date().toISOString(),
    inn: INN,
    customer: 'ГАУ ЦТО',
    byContract,
    byZayavka,
  });
  console.error(`web/data.json готов: контрактов ${byContract.length}, заявок ${byZayavka.length}.`);
}

main().catch((e) => { console.error('ОШИБКА:', e.message); process.exit(1); });
