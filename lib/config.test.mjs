import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from './config.mjs';

test('env перекрывает и даёт обе базы', () => {
  const env = {
    UNF_BASE: 'https://u', UNF_USER: 'ru', UNF_PASS: 'rp', UNF_ORG: 'og1',
    BUH_BASE: 'https://b', BUH_USER: 'bu', BUH_PASS: 'bp', BUH_ORG: 'og2',
  };
  const cfg = loadConfig({ env, file: null });
  assert.equal(cfg.unf.base, 'https://u');
  assert.equal(cfg.buh.org, 'og2');
  assert.equal(cfg.unf.userpwd, 'ru:rp');
});

test('нет ни env, ни файла → внятная ошибка', () => {
  assert.throws(() => loadConfig({ env: {}, file: null }), /конфиг/i);
});
