import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export function toCsv(rows, columns) {
  const esc = (v) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const head = columns.join(',');
  const body = rows.map(r => columns.map(c => esc(r[c])).join(',')).join('\n');
  return body ? head + '\n' + body + '\n' : head + '\n';
}

export function writeJson(path, data) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2), 'utf8');
}

export function writeCsv(path, rows, columns) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, '﻿' + toCsv(rows, columns), 'utf8'); // BOM для Excel/кириллицы
}

/** Как toCsv, но с явными подписями колонок. columns = [[key, 'Заголовок'], ...] */
export function toCsvLabeled(rows, columns) {
  const keys = columns.map(c => c[0]);
  const labels = columns.map(c => c[1]);
  const esc = (v) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const head = labels.map(esc).join(',');
  const body = rows.map(r => keys.map(k => esc(r[k])).join(',')).join('\n');
  return body ? head + '\n' + body + '\n' : head + '\n';
}

export function writeCsvLabeled(path, rows, columns) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, '﻿' + toCsvLabeled(rows, columns), 'utf8'); // BOM для Excel
}
