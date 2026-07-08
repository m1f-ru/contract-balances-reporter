import { readFileSync } from 'node:fs';

/**
 * Собирает конфиг из env и/или config.local.json. env имеет приоритет.
 * @param {{env?:object, file?:string|null}} opts
 */
export function loadConfig(opts = {}) {
  const env = opts.env ?? process.env;
  const file = opts.file === undefined ? 'config.local.json' : opts.file;

  let fromFile = { unf: {}, buh: {} };
  if (file) {
    try {
      fromFile = JSON.parse(readFileSync(file, 'utf8'));
    } catch { /* нет файла — ок, надеемся на env */ }
  }

  const pick = (base, prefix) => {
    const f = fromFile[base] ?? {};
    const baseUrl = env[prefix + '_BASE'] ?? f.base;
    const user = env[prefix + '_USER'] ?? f.user;
    const pass = env[prefix + '_PASS'] ?? f.pass;
    const org = env[prefix + '_ORG'] ?? f.org;
    if (!baseUrl || !user || !pass || !org) {
      throw new Error(`Не найден конфиг для ${base}: нужны ${prefix}_BASE/USER/PASS/ORG или config.local.json`);
    }
    return { base: baseUrl, user, pass, org, userpwd: `${user}:${pass}` };
  };

  return { unf: pick('unf', 'UNF'), buh: pick('buh', 'BUH') };
}
