import type { cmscustomers as cmscustomersEn } from '../en/cmscustomers';

export const cmscustomers: typeof cmscustomersEn = {
  /* Shared: filtra, statuse, verifikim, pjesë të tabelave */
  'cmscustomers.filter': 'Filtro',
  'cmscustomers.clear': 'Pastro',
  'cmscustomers.search.label': 'Kërko',
  'cmscustomers.search.placeholder': 'Emri ose email-i…',
  'cmscustomers.status.label': 'Statusi',
  'cmscustomers.status.all': 'Të gjitha statuset',
  'cmscustomers.status.active': 'Aktiv',
  'cmscustomers.status.inactive': 'Joaktiv',
  'cmscustomers.status.pending': 'Në pritje',
  'cmscustomers.status.archived': 'Arkivuar',
  'cmscustomers.status.suspended': 'Pezulluar',
  'cmscustomers.registered': 'Regjistruar',
  'cmscustomers.verified.label': 'Email i konfirmuar',
  'cmscustomers.verified.all': 'Të gjitha llogaritë',
  'cmscustomers.verified.confirmed': 'I konfirmuar',
  'cmscustomers.verified.unconfirmed': 'I pakonfirmuar',
  'cmscustomers.th.email': 'Email-i',
  'cmscustomers.th.orders': 'Porositë',
  'cmscustomers.no_match.desc': 'Provo një term tjetër kërkimi ose pastroni filtrat.',

  /* Lista e klientëve (/cms/customers) */
  'cmscustomers.customers.title': 'Klientët',
  'cmscustomers.customers.description':
    'Llogaritë e regjistruara të dyqanit online dhe kontaktet e CRM-së.',
  'cmscustomers.customers.stat.total': 'Klientët gjithsej',
  'cmscustomers.customers.stat.disabled': 'Çaktivizuar',
  'cmscustomers.customers.stat.new': 'Të rinj këtë muaj',
  'cmscustomers.customers.empty.title': 'Ende pa klientë',
  'cmscustomers.customers.empty.desc':
    'Llogaritë e dyqanit online dhe klientët e POS-it do të shfaqen këtu.',
  'cmscustomers.customers.no_match.title': 'Asnjë klient nuk përputhet me këto filtra',
  'cmscustomers.customers.th.customer': 'Klienti',
  'cmscustomers.customers.th.total_spent': 'Shpenzuar gjithsej',
  'cmscustomers.customers.th.actions': 'Veprimet',
  'cmscustomers.customers.view_profile': 'Shiko profilin',

  /* Profili i klientit (/cms/customers/[id]) */
  'cmscustomers.detail.back_aria': 'Kthehu te klientët',
  'cmscustomers.detail.no_email': 'Pa email',
  'cmscustomers.detail.registered': 'Regjistruar {date}',
  'cmscustomers.detail.stat.total_orders': 'Porositë gjithsej',
  'cmscustomers.detail.stat.total_spent': 'Shpenzuar gjithsej',
  'cmscustomers.detail.stat.average': 'Porosia mesatare',
  'cmscustomers.detail.stat.last_order': 'Porosia e fundit',
  'cmscustomers.detail.personal_info': 'Informacionet personale',
  'cmscustomers.detail.billing_title': 'Adresa e parazgjedhur e faturimit',
  'cmscustomers.detail.shipping_title': 'Adresa e parazgjedhur e dërgesës',
  'cmscustomers.detail.shipping.taken_from': 'Marrë nga',
  'cmscustomers.detail.shipping.latest_fallback': 'porosia e tyre më e fundit',
  'cmscustomers.detail.shipping.none':
    'Asnjë porosi e dyqanit online nuk ka ende adresë dërgese për këtë klient — përdoret adresa e faturimit më sipër.',
  'cmscustomers.detail.order_history': 'Historiku i porosive',
  'cmscustomers.detail.view_all_orders': 'Shiko të gjitha porositë',
  'cmscustomers.detail.empty.title': 'Ende pa porosi',
  'cmscustomers.detail.empty.desc': 'Porositë që vendos ky klient do të shfaqen këtu.',
  'cmscustomers.detail.th.order': 'Porosia',
  'cmscustomers.detail.th.date': 'Data',
  'cmscustomers.detail.th.channel': 'Kanali',
  'cmscustomers.detail.th.payment': 'Pagesa',
  'cmscustomers.detail.th.items': 'Artikujt',
  'cmscustomers.detail.th.total': 'Gjithsej',
  'cmscustomers.detail.channel.storefront': 'Dyqani online',
  'cmscustomers.detail.channel.pos': 'Pika e shitjes',
  'cmscustomers.detail.notes.title': 'Shënimet e llogarisë',
  'cmscustomers.detail.notes.empty': 'Ende pa shënim — shto të parin më poshtë.',
  'cmscustomers.detail.notes.unknown_user': 'Përdorues i panjohur',

  /* Llogaritë e dyqanit (/cms/store-accounts) */
  'cmscustomers.storeaccounts.title': 'Llogaritë e dyqanit',
  'cmscustomers.storeaccounts.description':
    'Llogaritë e tregtisë elektronike që mund të hyjnë, të porosisin dhe të recensojnë — të ndara nga stafi i ERP-së që menaxhon këtë CMS.',
  'cmscustomers.storeaccounts.stat.total': 'Llogaritë e dyqanit',
  'cmscustomers.storeaccounts.stat.unconfirmed': 'I pakonfirmuar',
  'cmscustomers.storeaccounts.empty.title': 'Ende pa llogari dyqani',
  'cmscustomers.storeaccounts.empty.desc':
    'Klientët që regjistrohen në dyqanin online shfaqen këtu.',
  'cmscustomers.storeaccounts.no_match.title': 'Asnjë llogari dyqani nuk përputhet me këto filtra',
  'cmscustomers.storeaccounts.th.account': 'Llogaria',
};
