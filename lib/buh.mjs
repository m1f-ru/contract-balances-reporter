import { contractKey, zayavkaId } from './contractKey.mjs';

const HEAD = 'Document_РеализацияТоваровУслуг';
const LINES = 'Document_РеализацияТоваровУслуг_Товары';
const CONTRACTS = 'Catalog_ДоговорыКонтрагентов';

export class BuhRepo {
  constructor(client, org) { this.client = client; this.org = org; }

  /** Строки УПД (Принято) с ключом контракта и номером заявки.
   *  @param {Set<string>|null} contractorRefs если задан — только эти контрагенты. */
  async updLines(contractorRefs = null) {
    const heads = await this.client.getCollection(HEAD, {
      '$format': 'json',
      '$select': 'Ref_Key,Number,Date,Контрагент_Key,ДоговорКонтрагента_Key',
      '$filter': `Организация_Key eq guid'${this.org}' and Posted eq true`,
    });
    const kept = contractorRefs ? heads.filter(h => contractorRefs.has(String(h.Контрагент_Key))) : heads;

    const contractRefs = [...new Set(kept.map(h => h.ДоговорКонтрагента_Key).filter(Boolean))];
    const contracts = new Map();
    for (const ref of contractRefs) {
      const rows = await this.client.getCollection(CONTRACTS, {
        '$format': 'json', '$select': 'Ref_Key,Description,Номер',
        '$filter': `Ref_Key eq guid'${ref}'`,
      });
      if (rows[0]) contracts.set(ref, rows[0]);
    }

    const headByRef = new Map();
    for (const h of kept) {
      const c = contracts.get(h.ДоговорКонтрагента_Key) ?? {};
      headByRef.set(h.Ref_Key, {
        number: h.Number, date: h.Date,
        contractKey: contractKey(c.Description ?? '') ?? contractKey(c.Номер ?? ''),
        zayavka: zayavkaId(c.Номер ?? ''),
      });
    }

    const lines = await this.client.getCollection(LINES, {
      '$format': 'json', '$select': 'Ref_Key,Номенклатура_Key,Количество,Сумма',
    });

    const out = [];
    for (const l of lines) {
      const h = headByRef.get(l.Ref_Key);
      if (!h) continue;
      out.push({
        doc: l.Ref_Key, number: h.number, date: h.date,
        contractKey: h.contractKey, zayavka: h.zayavka,
        nom: l.Номенклатура_Key, qty: Number(l.Количество) || 0, sum: Number(l.Сумма) || 0,
      });
    }
    return out;
  }
}
