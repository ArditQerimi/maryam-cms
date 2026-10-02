import type { cart as cartEn } from '../en/cart';

export const cart: typeof cartEn = {
  // — Ballina e faqes —
  'cart.header.title': 'Shporta e blerjeve',
  'cart.header.crumb': 'Shporta',
  'cart.header.eyebrow': 'Zgjedhja juaj',
  'cart.header.lead': 'Rishikoni sasitë dhe variantet përpara se të vazhdoni me porosinë.',
  'cart.header.count.aria': '{count} artikuj në shportë',
  'cart.header.count.one': '{count} artikull',
  'cart.header.count.other': '{count} artikuj',
  'cart.contents.aria': 'Përmbajtja e shportës',

  // — Rreshti i gjendjes së sinkronizimit —
  'cart.status.storage.local': 'Ruajtur në këtë shfletues',
  'cart.status.storage.memory': 'I disponueshëm vetëm për këtë skedë',
  'cart.status.storage.unavailable': 'Ruajtja e shfletuesit nuk është e disponueshme',
  'cart.status.storage.default': 'Shportë lokale',
  'cart.status.syncing': 'Duke sinkronizuar shportën me serverin…',
  'cart.status.syncedAccount': 'Sinkronizuar me shportën e llogarisë tuaj',
  'cart.status.syncedServer': 'Sinkronizuar me shportën e serverit',
  'cart.status.draftError': 'Skicë lokale — sinkronizimi kërkon vëmendje',
  'cart.status.draftWaiting': 'Skicë lokale — në pritje të sinkronizimit',
  'cart.status.localOnly': 'Vetëm shportë lokale',
  'cart.status.authoritative': ' · sasitë dhe çmimet e serverit janë autoritative',
  'cart.status.localTruth': ' · ky shfletues është burimi i vërtetë derisa sinkronizimi të ketë sukses',
  'cart.status.busySyncing': 'Duke sinkronizuar…',
  'cart.status.busySaving': 'Duke ruajtur…',

  // — Ngarkim / gabim / bosh —
  'cart.loading.title': 'Duke ngarkuar shportën tuaj…',
  'cart.loading.text': 'Duke kontrolluar gjendjen e shportës lokale dhe të serverit.',
  'cart.error.title': 'Nuk mund të përfundonim ndryshimin e shportës',
  'cart.error.retry': 'Provo përsëri',
  'cart.empty.title': 'Shporta juaj është bosh',
  'cart.empty.text':
    'Ruajini këtu një libër ose produkt dhe do të mbetet i disponueshëm ndërsa vazhdoni të blini.',
  'cart.empty.action': 'Vazhdo blerjet',

  // — Tabela e artikujve —
  'cart.table.caption': 'Artikujt që ndodhen aktualisht në shportën tuaj',
  'cart.table.product': 'Produkti',
  'cart.table.price': 'Çmimi',
  'cart.table.quantity': 'Sasia',
  'cart.table.subtotal': 'Nëntotali',
  'cart.item.variant': 'Varianti {id}',
  'cart.item.unavailable': 'Aktualisht i padisponueshëm',
  'cart.item.remove': 'Hiq',
  'cart.item.removeAria': 'Hiq {name} nga shporta',
  'cart.quantity.decrease': 'Ul sasinë për {name}',
  'cart.quantity.input': 'Sasia për {name}',
  'cart.quantity.increase': 'Rrit sasinë për {name}',

  // — Kuponi —
  'cart.coupon.label': 'Kodi i kuponit',
  'cart.coupon.placeholder': 'Shkruani kodin',
  'cart.coupon.checking': 'Duke verifikuar…',
  'cart.coupon.apply': 'Apliko',
  'cart.coupon.remove': 'Hiq kuponin',
  'cart.coupon.removed': 'Kuponi u hoq. Shporta juaj nuk ka ndryshuar.',
  'cart.coupon.empty': 'Shkruani një kod kuponësh.',
  'cart.coupon.unavailable': 'Kuponat nuk janë të disponueshëm përkohësisht. Provo përsëri.',
  'cart.coupon.restored': '{label} u rikthye nga vizita juaj e fundit.',
  'cart.coupon.applied': '{label} u aplikua — ju kurseni {amount}.',
  'cart.clear': 'Pastro shportën',

  // — Përmbledhja —
  'cart.summary.title': 'Përmbledhja e porosisë',
  'cart.summary.subtotal': 'Nëntotali',
  'cart.summary.coupon': 'Kuponi',
  'cart.summary.shipping': 'Transporti',
  'cart.summary.shippingNote': 'Llogaritet gjatë porosisë',
  'cart.summary.total': 'Totali',
  'cart.summary.checkout': 'Përfundo porosinë',
  'cart.summary.finePrint.synced':
    'Taksat dhe transporti konfirmohen gjatë porosisë. Totalet e shportës në server janë autoritative.',
  'cart.summary.finePrint.local':
    'Taksat dhe transporti konfirmohen gjatë porosisë. Ndryshimet lokale mbeten të rikuperueshme nëse sinkronizimi dështon.',
  'cart.storage_read_error':
    'Shporta e ruajtur nuk mund të lexohej në këtë shfletues. Mund ta provoni sërish me siguri, por ndryshimet do të mbeten në kujtesë për tani.',
  'cart.storage_write_error':
    'Shporta juaj u ndryshua, por ky shfletues nuk mund ta ruante lokalisht. Do të mbetet e disponueshme vetëm për këtë skedë.',
  'cart.error_invalid_item':
    'Ky artikull i shportës nuk është i vlefshëm. Sasia duhet të jetë një numër i plotë midis 1 dhe 99.',
  'cart.error_max_quantity': 'Sasia maksimale për një rresht të shportës është 99.',
  'cart.storage_invalid_data':
    'Shporta u ndryshua në një skedë tjetër dhe përmbante të dhëna të pavlefshme të ruajtura. Rreshtat e vlefshëm lokalë u ngarkuan.',
};
