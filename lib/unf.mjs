import { contractKey } from './contractKey.mjs';

const NAKL = 'Document_РасходнаяНакладная';
const NAKL_LINES = 'Document_РасходнаяНакладная_Запасы';
const ORDERS = 'Document_ЗаказПокупателя';
const ORDER_LINES = 'Document_ЗаказПокупателя_Запасы';

export class UnfRepo {
  constructor(client, org) {
    this.client = client;
    this.org = org;
  }

  /** Строки товарных накладных (Отгружено). @param {Set<string>|null} contractorRefs */
  async naklLines(contractorRefs = null) {
    const heads = await this.client.getCollection(NAKL, {
      '$format': 'json',
      '$select': 'Ref_Key,Number,Date,Контрагент_Key,ОснованиеПечати,Заказ',
      '$filter': `Организация_Key eq guid'${this.org}' and Posted eq true`,
    });

    const kept = contractorRefs
      ? heads.filter((h) =>
          contractorRefs.has(String(h.Контрагент_Key)),
        )
      : heads;

    const headByRef = new Map();

    for (const h of kept) {
      headByRef.set(h.Ref_Key, {
        number: h.Number,
        date: h.Date,
        contractKey: contractKey(h.ОснованиеПечати ?? ''),
        order: h.Заказ,
      });
    }

    const lines = await this.client.getCollection(NAKL_LINES, {
      '$format': 'json',
      '$select': 'Ref_Key,Номенклатура_Key,Количество,Сумма',
    });

    const out = [];

    for (const l of lines) {
      const h = headByRef.get(l.Ref_Key);
      if (!h) continue;

      out.push({
        doc: l.Ref_Key,
        number: h.number,
        date: h.date,
        contractKey: h.contractKey,
        order: h.order,
        nom: l.Номенклатура_Key,
        qty: Number(l.Количество) || 0,
        sum: Number(l.Сумма) || 0,
      });
    }

    return out;
  }

  /** Строки заказов покупателя (Заказано). @param {Set<string>|null} contractorRefs */
  async orderLines(contractorRefs = null) {
    const heads = await this.client.getCollection(ORDERS, {
      '$format': 'json',
      '$select': 'Ref_Key,Number,Date,Контрагент_Key,ОснованиеПечати',
      '$filter': `Организация_Key eq guid'${this.org}' and Posted eq true`,
    });

    const kept = contractorRefs
      ? heads.filter((h) =>
          contractorRefs.has(String(h.Контрагент_Key)),
        )
      : heads;

    const headByRef = new Map();

    for (const h of kept) {
      headByRef.set(h.Ref_Key, {
        number: h.Number,
        date: h.Date,
        contractKey: contractKey(h.ОснованиеПечати ?? ''),
      });
    }

    const lines = await this.client.getCollection(ORDER_LINES, {
      '$format': 'json',
      '$select': 'Ref_Key,Номенклатура,Номенклатура_Type,Количество,Сумма',
    });

    const out = [];

    for (const l of lines) {
      const h = headByRef.get(l.Ref_Key);
      if (!h) continue;

      const nom =
        !l.Номенклатура_Type ||
        l.Номенклатура_Type === 'StandardODATA.Catalog_Номенклатура'
          ? l.Номенклатура
          : null;

      out.push({
        doc: l.Ref_Key,
        orderRef: l.Ref_Key,
        number: h.number,
        date: h.date,
        contractKey: h.contractKey,
        nom,
        qty: Number(l.Количество) || 0,
        sum: Number(l.Сумма) || 0,
      });
    }

    return out;
  }
}
