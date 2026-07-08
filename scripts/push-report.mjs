// Считает сверку и формирует снимок для регистра «СверкаОстатков» расширения УНФ.
// По умолчанию DRY-RUN (печатает снимок, пишет out/snapshot.json). --apply пока заблокирован:
// регистр появляется только после сборки и загрузки расширения (этап B), тогда включим запись.
import { loadConfig } from '../lib/config.mjs';
import { Client } from '../lib/odata.mjs';
import { refsByInn } from '../lib/contractors.mjs';
import { BuhRepo } from '../lib/buh.mjs';
import { UnfRepo } from '../lib/unf.mjs';
import { reconcileByZayavka } from '../lib/zayavka.mjs';
import { buildSnapshot } from '../lib/snapshot.mjs';
import { writeJson } from '../lib/output.mjs';

const INN = process.env.CTO_INN ?? '9705101759';
const APPLY = process.argv.includes('--apply');

async function main() {
  const cfg = loadConfig();
  const buhClient = new Client(cfg.buh.base, cfg.buh.userpwd, { pageSize: 1000 });
  const unfClient = new Client(cfg.unf.base, cfg.unf.userpwd, { pageSize: 1000 });

  const unfRefs = await refsByInn(unfClient, INN);
  const buhRefs = await refsByInn(buhClient, INN);
  const ordered = await new UnfRepo(unfClient, cfg.unf.org).orderLines(unfRefs);
  const shipped = await new UnfRepo(unfClient, cfg.unf.org).naklLines(unfRefs);
  const received = await new BuhRepo(buhClient, cfg.buh.org).updLines(buhRefs);

  const { byZayavka } = reconcileByZayavka({ ordered, shipped, received });
  const rows = buildSnapshot(byZayavka, new Date().toISOString());
  writeJson('out/snapshot.json', { count: rows.length, rows });

  const contracts = new Set(rows.map((r) => r.Контракт)).size;
  console.error(`Снимок: строк(заявок)=${rows.length}, контрактов=${contracts}. Файл: out/snapshot.json`);

  if (!APPLY) { console.error('DRY-RUN — запись в регистр не выполнялась.'); return; }
  console.error('ОШИБКА: --apply пока заблокирован. Регистр «СверкаОстатков» появится после сборки и загрузки '
    + 'расширения (этап B) и публикации регистра в OData. После этого включим боевую запись.');
  process.exit(2);
}
main().catch((e) => { console.error('ОШИБКА:', e.message); process.exit(1); });
