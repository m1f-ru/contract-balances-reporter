import { mkdir, writeFile } from 'node:fs/promises';
import { Client } from '../lib/odata.mjs';

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Не задана переменная ${name}`);
  return value;
}

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
      navigationProperties: [],
    };
  }

  const properties = [
    ...block.matchAll(/<Property\s+Name="([^"]+)"/g),
  ].map((m) => m[1]);

  const navigationProperties = [
    ...block.matchAll(/<NavigationProperty\s+Name="([^"]+)"/g),
  ].map((m) => m[1]);

  return {
    found: true,
    properties: [...new Set(properties)].sort(),
    navigationProperties: [...new Set(navigationProperties)].sort(),
  };
}

async function inspect(name, base, user, pass) {
  const client = new Client(
    base,
    `${user}:${pass}`,
    { timeout: 60, pageSize: 1000 },
  );

  const metadataUrl =
    base.replace(/\/+$/, '') +
    '/odata/standard.odata/$metadata';

  const response = await client.request(metadataUrl);

  const entity = extractEntity(
    response.body,
    'Catalog_Номенклатура',
  );

  return {
    source: name,
    entity: 'Catalog_Номенклатура',
    ...entity,
  };
}

async function main() {
  const result = [];

  result.push(
    await inspect(
      'УНФ',
      required('UNF_BASE'),
      required('UNF_USER'),
      required('UNF_PASS'),
    ),
  );

  result.push(
    await inspect(
      'БУХ',
      required('BUH_BASE'),
      required('BUH_USER'),
      required('BUH_PASS'),
    ),
  );

  await mkdir('out', { recursive: true });

  await writeFile(
    'out/nom-metadata.json',
    JSON.stringify(result, null, 2),
    'utf8',
  );

  for (const item of result) {
    console.log(`\n=== ${item.source} ===`);
    console.log(`Catalog_Номенклатура найден: ${item.found}`);

    console.log('Поля:');
    for (const p of item.properties) {
      console.log(`- ${p}`);
    }

    if (item.navigationProperties.length) {
      console.log('Связи:');
      for (const p of item.navigationProperties) {
        console.log(`- ${p}`);
      }
    }
  }
}

main().catch((e) => {
  console.error('ОШИБКА:', e.message);
  process.exit(1);
});
