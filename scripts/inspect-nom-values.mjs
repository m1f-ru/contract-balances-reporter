import { loadConfig } from '../lib/config.mjs';
import { Client } from '../lib/odata.mjs';

function extractEntity(xml, entityName) {
  const escaped = entityName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const re = new RegExp(
    `<EntityType\\s+Name="${escaped}"[^>]*>[\\s\\S]*?<\\/EntityType>`,
    'i',
  );

  const block = xml.match(re)?.[0];

  if (!block) {
    return {
      found: false,
      properties: [],
    };
  }

  const properties = [
    ...block.matchAll(/<Property\s+Name="([^"]+)"/g),
  ].map((m) => m[1]);

  return {
    found: true,
    properties: [...new Set(properties)].sort(),
  };
}

async function main() {
  const cfg = loadConfig();

  const client = new Client(
    cfg.unf.base,
    cfg.unf.userpwd,
    { timeout: 60 },
  );

  const url =
    cfg.unf.base.replace(/\/+$/, '') +
    '/odata/standard.odata/$metadata';

  const response = await client.request(url);

  for (const entityName of [
    'Document_ЗаказПокупателя_Запасы',
    'Document_РасходнаяНакладная_Запасы',
  ]) {
    const result = extractEntity(response.body, entityName);

    console.log(`\n=== ${entityName} ===`);
    console.log(`Найден: ${result.found}`);
    console.log('Поля:');

    for (const p of result.properties) {
      console.log(`- ${p}`);
    }
  }
}

main().catch((e) => {
  console.error('ОШИБКА:', e.message);
  process.exit(1);
});
