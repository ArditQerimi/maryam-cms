import type { checkout as checkoutEn } from '../en/checkout';

export const checkout: typeof checkoutEn = {
  // — Ballina / ballina e porosisë —
  'checkout.crumb.home': 'Ballina',
  'checkout.crumb.cart': 'Shporta',
  'checkout.crumb.checkout': 'Përfundo porosinë',
  'checkout.header.eyebrow': 'Porosia në dyqan',
  'checkout.header.title': 'Përfundo porosinë',
  'checkout.header.subtitle': 'Plotësoni të dhënat në një rrjedhë të vetme të sigurt dhe të rishikueshme.',
  'checkout.header.badge': 'Çmimi përfundimtar i konfirmuar nga serveri',

  // — Hapat / ngarkimi / bosh —
  'checkout.steps.aria': 'Progresi i porosisë',
  'checkout.steps.contact.title': 'Kontakti',
  'checkout.steps.contact.text': 'Të dhënat e email-it',
  'checkout.steps.delivery.title': 'Dërgesa',
  'checkout.steps.delivery.text': 'Adresa dhe metoda',
  'checkout.steps.payment.title': 'Pagesa',
  'checkout.steps.payment.text': 'Rishikim dhe porositje',
  'checkout.loading.title': 'Duke ngarkuar porosinë tuaj…',
  'checkout.loading.text': 'Duke lexuar shportën kanonike të ruajtur në këtë shfletues.',
  'checkout.empty.eyebrow': 'Asgjë për të porositur',
  'checkout.empty.title': 'Shporta juaj është bosh',
  'checkout.empty.copy':
    'Shtoni një produkt përpara se të filloni porosinë. Shporta juaj aktuale nuk ka ndryshuar.',
  'checkout.empty.browse': 'Shfleto produktet',
  'checkout.empty.viewCart': 'Shiko shportën',

  // — Gjendja e suksesit —
  'checkout.success.eyebrow': 'Serveri e konfirmoi',
  'checkout.success.title': 'Porosia u vendos',
  'checkout.success.leadPrefix': 'U regjistrua një konfirmim për porosinë ',
  'checkout.success.leadSuffix': '.',
  'checkout.success.email': 'Emaili i konfirmimit',
  'checkout.success.reference': 'Referenca e porosisë',
  'checkout.success.viewOrder': 'Shiko porosinë',
  'checkout.success.history': 'Historiku i porosive',

  // — Totales nën përmbledhjen —
  'checkout.totals.shipping': 'Transporti',
  'checkout.totals.orderTotal': 'Totali i porosisë',
  'checkout.totals.estimate':
    'Nëntotali pas zbritjeve, minus çdo promovim, plus transporti dhe taksa. Serveri verifikon shumën përfundimtare, stokun dhe disponueshmërinë përpara se të krijohet porosia.',

  // — Opsionet e dërgesës dhe pagesës —
  'checkout.delivery.standard.label': 'Dërgesë standarde',
  'checkout.delivery.standard.detail': 'Disponueshmëria konfirmohet nga serveri i dyqanit',
  'checkout.delivery.fallbackLabel': 'Dërgesa',
  'checkout.delivery.loading': 'Duke ngarkuar…',
  'checkout.delivery.serverQuote': 'Oferta e serverit',
  'checkout.payment.check.label': 'Pagesa me çek',
  'checkout.payment.cashOnDelivery.label': 'Pagesa në dorëzim',
  'checkout.payment.cashOnDelivery.detail': 'Paguani kur porosia të dorëzohet',
  'checkout.shippingType.flat_rate': 'Tarifë fikse',
  'checkout.shippingType.free_shipping': 'Transport falas',
  'checkout.shippingType.local_pickup': 'Marrje në dyqan',

  // — Validimi në anën e klientit (nuk dërgohet në rrjet) —
  'checkout.validation.firstName': 'Shkruani emrin.',
  'checkout.validation.lastName': 'Shkruani mbiemrin.',
  'checkout.validation.address1': 'Shkruani adresën e rrugës.',
  'checkout.validation.country': 'Zgjidhni një shtet ose rajon.',
  'checkout.validation.city': 'Shkruani qytetin.',
  'checkout.validation.region': 'Shkruani rajonin ose provincën.',
  'checkout.validation.postalCode': 'Shkruani kodin postar.',
  'checkout.validation.emailRequired': 'Shkruani një adresë email.',
  'checkout.validation.emailFormat': 'Shkruani një adresë email në formatin name@example.com.',
  'checkout.validation.delivery': 'Zgjidhni një metodë dërgese.',
  'checkout.validation.payment': 'Zgjidhni një metodë pagese.',
  'checkout.validation.terms': 'Pranoni kushtet përpara se të bëni porosinë.',

  // — Gabimet e ngritura lokalisht para se kërkesa të largohet nga shfletuesi —
  'checkout.failure.validation': 'Kontrolloni fushat e theksuara përpara se të bëni porosinë.',
  'checkout.failure.unavailable':
    'Bërja e porosisë nuk është e disponueshme derisa të lidhet porosia e sigurt në server. Nuk u krijua as porosi dhe as pagesë.',
  'checkout.failure.cartNotSynced':
    'Kjo shportë lokale duhet të sinkronizohet me një shportë serveri që merr parasysh variantet përpara se të përfundojë. Nuk u krijua porosi.',
  'checkout.failure.noRandom':
    'Ky shfletues nuk mund të krijojë një çelës të sigurt kërkese për porosinë. Nuk u krijua porosi.',
  'checkout.failure.requestFailed':
    'Nuk mund të arritëm porosinë e sigurt. Nuk u krijua porosi. Kontrolloni lidhjen dhe provoni përsëri.',
  'checkout.failure.title': 'Porosia nuk mund të vazhdonte',
  'checkout.failure.noOrder': 'Nuk u krijua as porosi dhe as pagesë.',

  // — Paralajmërimi i shportës / pjesët e formularit —
  'checkout.cartWarning.title': 'Shporta juaj lokale kërkon vëmendje',
  'checkout.form.title': 'Detajet e porosisë',
  'checkout.form.legend': 'Kontakti, dërgesa, pagesa dhe kushtet',
  'checkout.preview.noticeTitle': 'Parapamje e porosisë — bërja e porosisë është çaktivizuar',
  'checkout.preview.noticeCopy':
    'Pagesa e sigurt nuk është lidhur ende. Nuk do të merret asnjë pagesë dhe nuk do të krijohet asnjë porosi nga kjo faqe.',
  'checkout.pending': 'Duke u lidhur me porosinë e sigurt. Mos e mbyllni këtë faqe…',
  'checkout.errors.one': 'Kontrolloni këtë fushë',
  'checkout.errors.many': 'Kontrolloni këto {count} fusha',

  // — Përmbledhja në celular —
  'checkout.mobile.summaryLabel': 'Përmbledhja e porosisë',
  'checkout.mobile.view': 'Shiko',
  'checkout.itemCount.one': '{count} artikull',
  'checkout.itemCount.other': '{count} artikuj',

  // — Hapi i kontaktit —
  'checkout.contact.step': 'Kontakti',
  'checkout.contact.heading': 'Ku duhet t\'ju dërgojmë kuitancën tuaj?',
  'checkout.login.promptTitle': 'Tashmë keni një llogari?',
  'checkout.login.promptCopy': 'Hyr në llogari që të dhënat e porosisë t\'i keni gjithmonë me vete.',
  'checkout.login.link': 'Hyr',
  'checkout.contact.email': 'Adresë email',
  'checkout.notes.label': 'Shënime për porosinë',
  'checkout.notes.placeholder': 'Shënime për porosinë tuaj, p.sh. udhëzime të veçanta për dërgesën.',
  'checkout.contact.phone': 'Numri i telefonit',
  'checkout.contact.phoneHint': 'Për pyetje rreth dërgesës',
  'checkout.contact.marketing':
    'Dërgomë email për lajme dhe oferta. Opsionale; mund të çregjistroheni kur të dëshironi.',

  // — Hapi i dërgesës —
  'checkout.delivery.step': 'Dërgesa',
  'checkout.delivery.heading': 'Ku po shkon porosia juaj?',
  'checkout.delivery.addressTitle': 'Adresa e dërgesës',
  'checkout.delivery.billingSame': 'Përdor këtë adresë për faturimin',
  'checkout.delivery.methodTitle': 'Metoda e dërgesës',
  'checkout.delivery.methodCopy':
    'Metodat e transportit ngarkohen për adresën tuaj nga zonat e transportit të dyqanit.',
  'checkout.delivery.choose': 'Zgjidhni një metodë dërgese',
  'checkout.billing.title': 'Adresa e faturimit',
  'checkout.billing.sameCopy': 'Aktualisht përputhet me adresën e dërgesës.',
  'checkout.billing.diffCopy': 'Shkruani një adresë të veçantë për faturimin.',
  'checkout.billing.cardTitle': 'Të dhënat e faturimit',
  'checkout.billing.different': 'Faturo në adresë tjetër?',

  // - Karta 'Porosia juaj' (tabela + kupon + totalet) -
  'checkout.order.heading': 'Porosia juaj',
  'checkout.order.product': 'Produkti',
  'checkout.order.subtotal': 'Nëntotali',
  'checkout.order.total': 'Totali',
  'checkout.coupon.prompt': 'Keni një kupon?',
  'checkout.coupon.enter': 'Klikoni këtu për të futur kodin tuaj',
  'checkout.coupon.codeLabel': 'Kodi i kuponit',
  'checkout.coupon.apply': 'Apliko kuponin',
  'checkout.coupon.remove': 'Hiq kuponin',

  // — Hapi i pagesës —
  'checkout.payment.step': 'Pagesa',
  'checkout.payment.heading': 'Zgjidhni si të paguani',
  'checkout.payment.choose': 'Zgjidhni një metodë pagese',
  'checkout.payment.badge': 'Serveri e konfirmoi',
  'checkout.payment.safety':
    'Pagesa me kartë nuk është e aktivizuar. Kjo porosi nuk mbledh kurrë numra kartash; një metodë e ardhshme pagese duhet të përdorë fusha të sigurta të strehuara nga ofruesi.',
  'checkout.terms.prefix': 'Pajtohem me',
  'checkout.terms.terms': 'Kushtet e Shërbimit',
  'checkout.terms.and': 'dhe njoh',
  'checkout.terms.privacy': 'Politikën e Privatësisë',
  'checkout.terms.agree': 'Jam njohur dhe pajtohem me termat dhe kushtet e website-t',
  'checkout.payment.privacy': 'Të dhënat tuaja personale do të përdoren për të procesuar porosinë tuaj, për mbështetur përvojën tuaj në këtë website, dhe për qëlime të tjera të përshkruara në',
  'checkout.payment.privacyLink': 'politikën tonë të privatësisë.',
  'checkout.submit.pending': 'Duke vendosur porosinë…',
  'checkout.submit.retry': 'Provo përsëri ta bësh porosinë',
  'checkout.submit.place': 'Bëj porosinë',
  'checkout.submit.help': 'Serveri duhet të konfirmojë totalin e plotë përpara se të krijohet porosia.',
  'checkout.submit.helpDisabled':
    'Çaktivizuar derisa POST /api/storefront/checkout të implementohet në mënyrë të sigurt.',
  'checkout.summary.aria': 'Përmbledhja e porosisë',

  // — Karta e përmbledhjes —
  'checkout.summary.eyebrow': 'Shporta aktuale',
  'checkout.summary.heading': 'Përmbledhja e porosisë',
  'checkout.summary.itemCount.one': '{count} artikull',
  'checkout.summary.itemCount.other': '{count} artikuj',
  'checkout.summary.itemsAria': 'Artikujt në shportën tuaj aktuale',
  'checkout.summary.variant': 'Varianti {id}',
  'checkout.summary.defaultVariant': 'Varianti i parazgjedhur',
  'checkout.summary.subtotal': 'Nëntotali i shportës',
  'checkout.summary.promotion': 'Promovimi',
  'checkout.summary.notApplied': 'Nuk është aplikuar',
  'checkout.summary.delivery': 'Dërgesa',
  'checkout.summary.estimate':
    'Totalet e këtij shfletuesi janë vetëm për shfaqje. Serveri duhet të verifikojë stokun, variantet, promovimet, dërgesën, taksën dhe shumën përfundimtare.',
  'checkout.summary.editCart': 'Ndrysho shportën',

  // — Fushat e adresës —
  'checkout.address.firstName': 'Emri',
  'checkout.address.lastName': 'Mbiemri',
  'checkout.address.company': 'Kompania',
  'checkout.address.address1': 'Adresa',
  'checkout.address.address1Placeholder': 'Numri i shtëpisë dhe emri i rrugës',
  'checkout.address.address2': 'Apartamenti, njësia, etj.',
  'checkout.address.country': 'Shteti / rajoni',
  'checkout.address.city': 'Qyteti',
  'checkout.address.region': 'Rajoni / provinca',
  'checkout.address.postalCode': 'Kodi postar',
  'checkout.address.optional': 'Opsionale',
  'checkout.address.selectCountry': 'Zgjidhni një shtet',
  'checkout.country.AL': 'Shqipëri',
  'checkout.country.AT': 'Austri',
  'checkout.country.BE': 'Belgjikë',
  'checkout.country.FR': 'Francë',
  'checkout.country.DE': 'Gjermani',
  'checkout.country.IT': 'Itali',
  'checkout.country.XK': 'Kosovë',
  'checkout.country.NL': 'Holandë',
  'checkout.country.ES': 'Spanjë',
  'checkout.country.GB': 'Mbretëria e Bashkuar',
  'checkout.country.US': 'Shtetet e Bashkuara',

  // — Faqja e konfirmimit të porosisë —
  'checkout.confirmation.unavailableEyebrow': 'Konfirmimi i porosisë',
  'checkout.confirmation.unavailableTitle': 'Konfirmimi nuk është i disponueshëm',
  'checkout.confirmation.unavailableCopy':
    'Ky konfirmim nuk është i disponueshëm, ka skaduar ose i përket një sesioni tjetër. Asnjë detaj porosie nuk mund të shfaqet pa blerësin autentik origjinal ose pa aftësinë e porosisë si mysafir.',
  'checkout.confirmation.returnToCheckout': 'Kthehu te porosia',
  'checkout.confirmation.guestNotice':
    'Ky konfirmim privat është i disponueshëm vetëm ndërsa aftësia e konfirmimit vetëm për host mbetet e vlefshme në këtë pajisje.',
  'checkout.confirmation.historyLink': 'Shiko historikun e porosive',
  'checkout.confirmation.receivedEyebrow': 'Porosia u pranua',
  'checkout.confirmation.title': 'Faleminderit për porosinë tuaj',
  'checkout.confirmation.lead':
    'Një porosi e konfirmuar është regjistruar. Ruani referencën e porosisë për mbështetjen e tregtarit.',
  'checkout.confirmation.ref': 'Referenca e porosisë',
  'checkout.confirmation.email': 'Emaili i konfirmimit',
  'checkout.confirmation.placed': 'U vendos',
  'checkout.confirmation.status': 'Statusi',
  'checkout.confirmation.total': 'Totali i porosisë',
  'checkout.confirmation.currency': 'Monedha',
  'checkout.confirmation.delivery': 'Metoda e dërgesës',
  'checkout.confirmation.payment': 'Metoda e pagesës',
  'checkout.confirmation.continue': 'Vazhdo blerjet',
};
