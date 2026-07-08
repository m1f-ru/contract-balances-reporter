// Нормализованный ключ сшивки контракта между БУХ и УНФ.
import { RegNumber } from './regnum.mjs';

// Договор подряда и подобные: буквенно-цифровой шифр вида МАО-416-25-Р66.
// Токен = 2+ заглавных букв, дефис, и далее группы цифр/букв через дефисы.
const CODE_RE = /([А-ЯA-Z]{2,})-(\d+(?:-[0-9A-Za-zА-Яа-я]+)+)/u;

/**
 * Ключ контракта или null. Приоритет: ОК/ЗК-госконтракт → шифр договора (МАО-...).
 * @param {string} text наименование договора (БУХ) или ОснованиеПечати (УНФ)
 * @returns {string|null}
 */
export function contractKey(text) {
  if (typeof text !== 'string' || text.trim() === '') {
    return null;
  }
  const gk = RegNumber.extract(text);
  if (gk !== null) {
    return gk;
  }
  const m = CODE_RE.exec(text);
  if (m !== null) {
    return (m[1] + '-' + m[2]).toUpperCase();
  }
  return null;
}

/**
 * Номер заявки (для БУХ) — это номер договора-заявки как есть, без обрамления.
 * @param {string} nomerDogovora поле Номер справочника ДоговорыКонтрагентов
 * @returns {string} нормализованный (trim + схлопывание пробелов) номер
 */
export function zayavkaId(nomerDogovora) {
  if (typeof nomerDogovora !== 'string') {
    return '';
  }
  return nomerDogovora.replace(/\s+/gu, ' ').trim();
}
