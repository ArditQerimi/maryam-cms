import type { cmscatalog as cmscatalogEn } from '../en/cmscatalog';

export const cmscatalog: typeof cmscatalogEn = {
  /* Produkte — faqet */
  'cmscatalog.title': 'Produktet',
  'cmscatalog.description': 'Menaxho katalogun, çmimet, stokun dhe variantet.',
  'cmscatalog.new': 'Produkt i ri',
  'cmscatalog.new_description': 'Shto një produkt në katalogun e dyqanit.',
  'cmscatalog.edit_title': 'Përditëso: {name}',
  'cmscatalog.edit_description': 'Përditëso detajet, çmimet, imazhet, variantet dhe stokun.',

  /* Produkte — shiriti i statistikave */
  'cmscatalog.stat.total': 'Gjithsej produkte',
  'cmscatalog.stat.active': 'Aktive',
  'cmscatalog.stat.out_of_stock': 'Pa stok',
  'cmscatalog.stat.low_stock': 'Stok i ulët',

  /* Produkte — filtrat */
  'cmscatalog.filter.search': 'Kërko',
  'cmscatalog.filter.search_placeholder': 'Emri ose SKU…',
  'cmscatalog.filter.category': 'Kategoria',
  'cmscatalog.filter.all_categories': 'Të gjitha kategoritë',
  'cmscatalog.filter.status': 'Statusi',
  'cmscatalog.filter.all_statuses': 'Të gjitha statuset',
  'cmscatalog.filter.submit': 'Filtro',
  'cmscatalog.filter.clear': 'Pastro',

  /* Produkte — gjendjet bosh */
  'cmscatalog.empty.filtered_title': 'Asnjë produkt nuk përputhet me këto filtra',
  'cmscatalog.empty.filtered_description': 'Provoni një term tjetër kërkimi ose pastroni filtrat.',
  'cmscatalog.empty.title': 'Ende pa produkte',
  'cmscatalog.empty.description': 'Krijo produktin e parë për të filluar shitjen.',

  /* Produkte — tabela */
  'cmscatalog.th.image': 'Imazhi',
  'cmscatalog.th.name': 'Emri',
  'cmscatalog.th.sku': 'SKU',
  'cmscatalog.th.category': 'Kategoria',
  'cmscatalog.th.price': 'Çmimi',
  'cmscatalog.th.stock': 'Stoku',
  'cmscatalog.th.status': 'Statusi',
  'cmscatalog.th.actions': 'Veprimet',

  /* Produkte — distinktivët dhe veprimet e rreshtit */
  'cmscatalog.stock.out': 'Mbaroi',
  'cmscatalog.stock.low': 'Ulët: {stock}',
  'cmscatalog.action.edit': 'Redakto',
  'cmscatalog.action.view': 'Shiko në dyqan',
  'cmscatalog.action.duplicate': 'Krijo kopje',
  'cmscatalog.action.delete': 'Fshi',
  'cmscatalog.confirm.delete': 'Fshi "{name}"? Ky veprim nuk mund të zhbëhet.',
  'cmscatalog.toast.duplicated': 'Produkti u kopjua.',
  'cmscatalog.toast.deleted': 'Produkti u fshi.',
};
