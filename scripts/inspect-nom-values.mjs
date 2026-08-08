import { loadConfig } from '../lib/config.mjs';
import { Client } from '../lib/odata.mjs';

const ORDER_LINES = 'Document_ЗаказПокупателя_Запасы';

async function main() {
  const cfg = loadConfig();

  const client = new Client(
    cfg.unf.base,
    cfg.unf.userpwd,
    { timeout: 60, pageSize: 1000 },
  );

  const rows = await client.callFunction(ORDER_LINES, {
    '$format': 'json',
    '$select': 'Ref_Key,Номенклатура,Номенклатура_Type,Количество,Сумма',
    '$top': '10',
  });

  console.log(`Получено строк: ${rows.length}`);

  console.log('\n=== ОБРАЗЕЦ НОМЕНКЛАТУРЫ ЗАКАЗА ===');

  for (const row of rows) {
    console.log(JSON.stringify({
      Номенклатура: row.Номенклатура,
      Номенклатура_Type: row.Номенклатура_Type,
    }));
  }
}

main().catch((e) => {
  console.error('ОШИБКА:', e.message);
  process.exit(1);
});
