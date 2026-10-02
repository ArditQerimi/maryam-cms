import type { cmsorders as cmsordersEn } from '../en/cmsorders';

export const cmsorders: typeof cmsordersEn = {
  // Etiketa e statusit të porosisë — vetëm për shfaqje, kurrë vlera në DB.
  'cmsorders.status.all': 'Të gjitha',
  'cmsorders.status.pending': 'Në pritje',
  'cmsorders.status.completed': 'Përfunduar',
  'cmsorders.status.cancelled': 'Anuluar',
  'cmsorders.status.returned': 'Kthyer',

  // Lista e porosive
  'cmsorders.orders.title': 'Porositë',
  'cmsorders.orders.description':
    'Ndiq shitjet e dyqanit online dhe POS-it, plotësiminë e porosive, rimborsimet dhe shënimet.',
  'cmsorders.orders.stat_total': 'Totali i porosive',
  'cmsorders.orders.stat_revenue': 'Të ardhura bruto',
  'cmsorders.orders.filter_search': 'Kërko',
  'cmsorders.orders.filter_placeholder': 'Referencë ose klient…',
  'cmsorders.orders.filter_from': 'Nga',
  'cmsorders.orders.filter_to': 'Deri',
  'cmsorders.orders.filter_submit': 'Filtro',
  'cmsorders.orders.filter_clear': 'Pastro',
  'cmsorders.orders.empty_filtered_title': 'Asnjë porosi nuk përputhet me këto filtra',
  'cmsorders.orders.empty_filtered_desc':
    'Provo një term tjetër kërkimi, një periudhë dates ose një status tjetër.',
  'cmsorders.orders.empty_title': 'Asnjë porosi ende',
  'cmsorders.orders.empty_desc': 'Porositë e bëra në dyqan dhe në POS do të shfaqen këtu.',
  'cmsorders.orders.th_order': 'Porosia',
  'cmsorders.orders.th_date': 'Data',
  'cmsorders.orders.th_customer': 'Klienti',
  'cmsorders.orders.th_items': 'Artikujt',
  'cmsorders.orders.th_payment': 'Pagesa',
  'cmsorders.orders.th_total': 'Totali',
  'cmsorders.orders.th_status': 'Statusi',
  'cmsorders.orders.th_actions': 'Veprimet',
  'cmsorders.orders.channel_storefront': 'Dyqani online',
  'cmsorders.orders.channel_pos': 'Pika e shitjes',
  'cmsorders.orders.guest': 'I ftuar',
  'cmsorders.orders.action_view': 'Shiko',
  'cmsorders.orders.action_fulfil': 'Plotëso',

  // Detajet e porosisë
  'cmsorders.detail.title': 'Porosia {reference}',
  'cmsorders.detail.description': 'Porosi nga {channel} · vendosur më {date}',
  'cmsorders.detail.action_all_orders': 'Të gjitha porositë',
  'cmsorders.detail.product': 'Produkti',
  'cmsorders.detail.price': 'Çmimi',
  'cmsorders.detail.qty': 'Sasia',
  'cmsorders.detail.subtotal': 'Nëntotali',
  'cmsorders.detail.discount': 'Zbritja',
  'cmsorders.detail.tax': 'Tatimi',
  'cmsorders.detail.grand_total': 'Totali përfundimtar',
  'cmsorders.detail.notes_title': 'Shënimet e porosisë',
  'cmsorders.detail.note_visible': 'i dukshëm klientit',
  'cmsorders.detail.notes_empty': 'Ende asnjë shënim për këtë porosi.',
  'cmsorders.detail.status_title': 'Statusi',
  'cmsorders.detail.order_state': 'Gjendja e porosisë',
  'cmsorders.detail.fulfilment_title': 'Plotësimi dhe gjurmimi',
  'cmsorders.detail.customer_title': 'Klienti',
  'cmsorders.detail.walk_in': 'Klient rastësor',
  'cmsorders.detail.storefront_account': 'Llogari në dyqan online: {value}',
  'cmsorders.detail.no_storefront_account': 'Asnjë llogari dyqani online e lidhur me këtë porosi.',
  'cmsorders.detail.payment_title': 'Pagesa',
  'cmsorders.detail.method': 'Metoda',
  'cmsorders.detail.delivery': 'Dërgesa',
  'cmsorders.detail.currency': 'Monedha',
  'cmsorders.detail.contact': 'Kontakti',
  'cmsorders.detail.marketing_optin': 'Pranimi i marketingut: {value}',
  'cmsorders.detail.billing_same': 'faturimi njësoj si dërgesa: {value}',
  'cmsorders.detail.yes': 'po',
  'cmsorders.detail.no': 'jo',
  'cmsorders.detail.billing_title': 'Adresa e faturimit',
  'cmsorders.detail.shipping_title': 'Adresa e dërgesës',
  'cmsorders.detail.actions_title': 'Veprimet',
  'cmsorders.detail.refund_note': 'Rimborsimet dhe anulimet regjistrohen në shënimet e porosisë.',
  'cmsorders.detail.lines': '{count} rreshta',

  // Zonat e dërgesës
  'cmsorders.shipping.zones_title': 'Zonat e dërgesës',
  'cmsorders.shipping.zones_description':
    'Zonat përcetojnë çfarë metodash dërgese sheh klienti në arkë, bazuar në shtetin dhe rajonin e destinacionit.',
  'cmsorders.shipping.zones_empty_title': 'Asnjë zonë dërgese ende',
  'cmsorders.shipping.zones_empty_desc':
    'Krijo zonën tënde të parë (për shembull “Evropë” ose “Marrje në vend nga Kosova”) për të filluar ofrimin e metodash të dërgesës në arkë.',
  'cmsorders.shipping.zones_help':
    'Zonat krahasohen nga lart-poshtë me shtetin dhe rajonin e adresës së dërgesës. Kur nuk përputhet asnjë zonë, arkës i jepet automatikisht një metodë falas “Dërgesë standarde” që porositë të mos ndalen kurrë.',
  'cmsorders.shipping.state_fallback': 'Shteti {code}',

  // Klasat e dërgesës
  'cmsorders.shipping.classes_title': 'Klasat e dërgesës',
  'cmsorders.shipping.classes_description':
    'Grupe të përdorshme për të llogaritur tarifat e dërgesës.',
  'cmsorders.shipping.classes_what': 'Çfarë janë klasat e dërgesës?',
  'cmsorders.shipping.classes_intro': 'Klasat e dërgesës',
  'cmsorders.shipping.classes_strong':
    'grupojnë produktet që ndajnë të njëjtën tarifë dërgese',
  'cmsorders.shipping.classes_rest':
    '— për shembull mobilje të mëdha, enë qelqi të brishta ose produce të freskëta. Në vend që të çmimosh çdo produkt veç e veç, përcakton një klasë njëherë dhe tarifat e dërgesës mund të synojnë gjithçka në atë grup.',
  'cmsorders.shipping.classes_note':
    'Klasat ruhen në cilësimet e këtij dyqani dhe janë të disponueshme për çdo zonë dërgese dhe për çdo llogaritje tarife.',
};
