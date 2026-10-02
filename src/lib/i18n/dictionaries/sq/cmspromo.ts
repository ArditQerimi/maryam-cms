import type { cmspromo as cmspromoEn } from '../en/cmspromo';

export const cmspromo: typeof cmspromoEn = {
  // I përbashkët për kuponat dhe zbritjet
  'cmspromo.th.type': 'Lloji',
  'cmspromo.th.value': 'Vlera',
  'cmspromo.th.date_range': 'Periudha',
  'cmspromo.th.status': 'Statusi',
  'cmspromo.th.actions': 'Veprimet',
  'cmspromo.type.percentage': 'Përqindja',
  'cmspromo.type.fixed': 'Fikse',
  'cmspromo.date.no_expiry': 'Pa skadencë',
  'cmspromo.date.unlimited': 'Pa limit',
  'cmspromo.action.edit': 'Ndrysho',
  'cmspromo.action.delete': 'Fshi',

  // Kuponat
  'cmspromo.coupons.title': 'Kuponat',
  'cmspromo.coupons.description': 'Kodë zbritjesh që klientët mund të përdorin në arkë.',
  'cmspromo.coupons.edit_title': 'Ndrysho kuponin: {code}',
  'cmspromo.coupons.create_title': 'Krijo kupon',
  'cmspromo.coupons.search_label': 'Kërko sipas kodit',
  'cmspromo.coupons.search': 'Kërko',
  'cmspromo.coupons.clear': 'Pastro',
  'cmspromo.coupons.empty_title': 'Asnjë kupon ende',
  'cmspromo.coupons.empty_desc': 'Krijo kodin tënd të parë kuponi me formularin më lart.',
  'cmspromo.coupons.empty_search_title': 'Asnjë kupon nuk përputhet me kërkimin',
  'cmspromo.coupons.empty_search_desc': 'Provo një kod tjetër kuponi.',
  'cmspromo.coupons.th_code': 'Kodi',
  'cmspromo.coupons.th_usage_limit': 'Limiti i përdorimit',
  'cmspromo.coupons.confirm_delete': 'Të fshihet kuponi "{code}"? Ky veprim nuk mund të zhbëhet.',
  'cmspromo.coupons.delete_success': 'Kuponi u fshi.',

  // Zbritjet — i përbashkët (produkt + kategori)
  'cmspromo.discount.edit_title': 'Ndrysho zbritjen: {name}',
  'cmspromo.discount.delete_success': 'Zbritja u fshi.',

  // Zbritjet e produkteve
  'cmspromo.product.title': 'Zbritjet e produkteve',
  'cmspromo.product.description': 'Ulje çmimesh me afat, të aplikuar për produkte individuale.',
  'cmspromo.product.link_category': 'Zbritjet e kategorive',
  'cmspromo.product.create_title': 'Krijo zbritje produkti',
  'cmspromo.product.deleted_fallback': 'produkt i fshirë',
  'cmspromo.product.empty_title': 'Asnjë zbritje produkti ende',
  'cmspromo.product.empty_desc': 'Krijo një zbritje më lart për të nisur një promovim për një produkt.',
  'cmspromo.product.th_product': 'Produkti',
  'cmspromo.product.deleted_row': 'Produkt i fshirë',
  'cmspromo.product.confirm_delete':
    'Të fshihet kjo zbritje produkti? Ky veprim nuk mund të zhbëhet.',

  // Zbritjet e kategorive
  'cmspromo.category.title': 'Zbritjet e kategorive',
  'cmspromo.category.description':
    'Ulje çmimesh me afat, të aplikuar për çdo produkt në një kategori.',
  'cmspromo.category.link_product': 'Zbritjet e produkteve',
  'cmspromo.category.create_title': 'Krijo zbritje kategorie',
  'cmspromo.category.deleted_fallback': 'kategori e fshirë',
  'cmspromo.category.empty_title': 'Asnjë zbritje kategorie ende',
  'cmspromo.category.empty_desc':
    'Krijo një zbritje më lart për të nisur një promovim për një kategori të tërë.',
  'cmspromo.category.th_category': 'Kategoria',
  'cmspromo.category.deleted_row': 'Kategori e fshirë',
  'cmspromo.category.confirm_delete':
    'Të fshihet kjo zbritje kategorie? Ky veprim nuk mund të zhbëhet.',
};
