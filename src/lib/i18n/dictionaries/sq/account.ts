import type { account as accountEn } from '../en/account';

export const account: typeof accountEn = {
  // Layout (account area shell)
  'account.layout.crumbStore': 'Dyqani',
  'account.layout.crumbAccount': 'Llogaria',
  'account.layout.eyebrow': 'Hapësirë private për klientë',
  'account.layout.title': 'Llogaria ime',
  'account.layout.subtitle': 'Detajet dhe shërbimet e llogarisë për {storeName}.',
  'account.layout.contentAria': 'Përmbajtja e faqes së llogarisë',
  'account.layout.storeFallback': 'dyqani',

  // Sidebar navigation
  'account.nav.overview': 'Përmbledhje',
  'account.nav.orders': 'Porositë',
  'account.nav.wishlist': 'Lista e dëshirave',
  'account.nav.profile': 'Detajet e llogarisë',
  'account.nav.security': 'Siguria',
  'account.nav.addresses': 'Adresat',
  'account.nav.identityLabel': 'Llogaria e klientit',
  'account.nav.aria': 'Llogaria e klientit',
  'account.nav.signingOut': 'Duke u çkyçur…',
  'account.nav.signOut': 'Çkyçu',
  'account.nav.returnToStore': 'Kthehu te dyqani',
  'account.nav.signOutAria': 'Çkyçu nga llogaria e klientit',

  // Loading / error / not-found boundaries
  'account.loading.sr': 'Duke ngarkuar llogarinë tuaj të klientit',
  'account.notFound.eyebrow': 'Qasja e padisponueshme',
  'account.notFound.title': 'Kjo faqe e llogarisë së klientit nuk është e disponueshme.',
  'account.notFound.body':
    'Kërkesa nuk përputhej me një sesion aktiv të klientit për këtë dyqan, ose faqja nuk ekziston.',
  'account.notFound.return': 'Kthehu te dyqani',
  'account.error.eyebrow': 'Llogaria e padisponueshme',
  'account.error.title': 'Nuk mundëm të ngarkonim këtë faqe të llogarisë.',
  'account.error.body':
    'Asnjë detaj i llogarisë nuk u ndryshua. Kontrolloni faqen përsëri, ose kthehuni te dyqani nëse problemi vazhdon.',
  'account.error.retry': 'Provo përsëri',

  // Overview
  'account.overview.eyebrow': 'Përmbledhje e llogarisë',
  'account.overview.greeting': 'Mirë se të shohim, {name}.',
  'account.overview.intro':
    'Rishikoni detajet tuaj ose vazhdoni te shërbimet e dyqanit të lidhura me sesionin tuaj si klient.',
  'account.details.eyebrow': 'Detajet tuaja',
  'account.details.title': 'Profili i klientit',
  'account.details.edit': 'Ndrysho profilin',
  'account.details.name': 'Emri',
  'account.details.email': 'Email-i i hyrjes',
  'account.details.phone': 'Telefoni',
  'account.details.memberSince': 'Anëtar që nga',
  'account.details.notProvided': 'Nuk është dhënë',
  'account.details.unavailable': 'E padisponueshme',
  'account.details.note':
    'Fluxi aktual i hyrjes nuk regjiston gjendjen e email-it të verifikuar, prandaj kjo adresë nuk shënohet si e verifikuar.',
  'account.services.eyebrow': 'Shërbimet e llogarisë',
  'account.services.title': 'Ku dëshironi të shkoni?',
  'account.services.orders.title': 'Porositë',
  'account.services.orders.body': 'Hap ekzistuesin e historikut të porosive për këtë dyqan.',
  'account.services.orders.action': 'Shiko llogarinë e porosive',
  'account.services.wishlist.title': 'Lista e dëshirave',
  'account.services.wishlist.body':
    'Kthehu te produktet e ruajtura nga lista e dëshirave.',
  'account.services.wishlist.action': 'Hap listën e dëshirave',
  'account.services.profile.title': 'Profili',
  'account.services.profile.body':
    'Përditësoni emrin dhe numrin e telefonit të lidhur me këtë llogari klienti.',
  'account.services.profile.action': 'Ndrysho profilin',
  'account.services.security.title': 'Siguria',
  'account.services.security.body':
    'Ndryshoni fjalëkalimin tuaj me verifikimin e fjalëkalimit aktual.',
  'account.services.security.action': 'Hap sigurinë',
  'account.services.addresses.title': 'Adresat',
  'account.services.addresses.body':
    'Ruajtja e adresave nuk është lidhur ende, prandaj nuk shfaqet asnjë adresë e ruajtur.',
  'account.services.addresses.action': 'Shiko disponueshmërinë',
  'account.services.store.title': 'Dyqani',
  'account.services.store.body':
    'Vazhdoni të shfletoni katalogun pa lënë hapësirën e llogarisë suaj.',
  'account.services.store.action': 'Kthehu te dyqani',
  'account.banner.aria': 'Kujtesë sigurie për llogarinë',
  'account.banner.title': 'Mbani të dhënat e hyrjes private',
  'account.banner.body':
    'Përdorni butonin e çkyçjes në navigimin e llogarisë kur përfundoni në një pajisje të përbashkët.',

  // Orders
  'account.orders.eyebrow': 'Historiku i blerjeve',
  'account.orders.title': 'Porositë',
  'account.orders.lead': 'Porositë e bëra në këtë dyqan me llogarinë tuaj të klientit.',
  'account.orders.emptyTitle': 'Ende pa porosi',
  'account.orders.emptyBody':
    'Kur bëni një porosi, ajo shfaqet këtu menjëherë, së bashku me artikujt, totalin, mënyrën e dërgesës dhe mënyrën e pagesës.',
  'account.orders.emptyAction': 'Fillo blerjen',
  'account.orders.reference': 'Referenca e porosisë',
  'account.orders.placed': 'Bërë më',
  'account.orders.total': 'Totali i porosisë',
  'account.orders.delivery': 'Dërgesa',
  'account.orders.payment': 'Pagesa',
  'account.orders.confirmationEmail': 'Email-i i konfirmimit',
  'account.orders.itemsSubtotal': 'Nëntotali i artikujve',
  'account.orders.note':
    'Shfaqen vetëm porositë online të lidhura me llogarinë tuaj të klientit. Blerjet në pikën e shitjes dhe porositë e klientëve të tjerë nuk përfshihen kurrë.',

  // Addresses
  'account.addresses.eyebrow': 'Libri i adresave',
  'account.addresses.title': 'Adresat',
  'account.addresses.lead':
    'Një pamje e qartë e asaj që është—dhe e asaj që nuk është—e disponueshme për këtë llogari.',
  'account.addresses.notConnected': 'Ende nuk është lidhur',
  'account.addresses.emptyTitle': 'Nuk ka të dhëna adresash të ruajtura',
  'account.addresses.emptyBody':
    'Regjistri i përdoruesit të tenant-it nuk ofron një burim adresash, dhe kjo përmirësim nuk shton ruajtjen e adresave. Asnjë adresë shembull ose e checkout-it nuk shfaqet sikur t\'i përket juve.',
  'account.addresses.return': 'Kthehu te dyqani',
  'account.addresses.note':
    'Checkout-i mbetet i ndarë. Aktivizimi i adresave të ruajtura kërkon një model të dhënash adresash të lidhur me kompaninë dhe një DAL të adresave të autentikuara para se kjo faqe të ofrojë veprime krijimi, ndryshimi, zgjedhjeje ose fshirjeje.',

  // Profile
  'account.profile.eyebrow': 'Informacionet personale',
  'account.profile.title': 'Profili juaj',
  'account.profile.lead':
    'Mbani të dhënat e kontaktit të lidhura me këtë llogari dyqani të përditësuara.',
  'account.profile.readOnly': 'Të dhëna llogarie vetëm për lexim',
  'account.profile.detailsTitle': 'Detajet e profilit',
  'account.profile.signInEmail': 'Email-i i hyrjes',
  'account.profile.memberSince': 'Anëtar që nga',
  'account.profile.unavailable': 'E padisponueshme',
  'account.profile.note':
    'Ky fluks hyrjeje nuk ka token email-i të verifikuar as fushë email-i të verifikuar. Adresa shfaqet si email-i juaj i hyrjes dhe nuk mund të ndryshohet këtu.',
  'account.profileForm.kicker': 'Detajet personale',
  'account.profileForm.title': 'Ndryshoni profilin tuaj',
  'account.profileForm.intro':
    'Ndryshimet aplikohen vetëm për regjistrin tuaj si klient në këtë dyqan.',
  'account.profileForm.nameLabel': 'Emri i plotë',
  'account.profileForm.nameHint': 'Deri në 100 karaktere. Emrat ndërkombëtarë mbështeten.',
  'account.profileForm.phoneLabel': 'Numri i telefonit',
  'account.profileForm.phoneHint':
    'Opsionale. Përdorni shifra dhe shenjat standarde +, -, () ose hapësirë.',
  'account.profileForm.footer':
    'Email-i dhe lejet e llogarisë nuk ndryshohen nga ky formular.',
  'account.profileForm.saving': 'Duke ruajtur…',
  'account.profileForm.save': 'Ruaj ndryshimet',
  'account.profileForm.saveStatus': 'Duke ruajtur profilin tuaj',

  // Security page
  'account.security.eyebrow': 'Mbrojtja e llogarisë',
  'account.security.title': 'Siguria',
  'account.security.lead':
    'Ndryshoni fjalëkalimin tuaj dhe shihni identitetin e lidhur me këtë sesion.',
  'account.security.identityAria': 'Klienti i hyrë',
  'account.security.identityLabel': 'Klienti i hyrë',
  'account.security.activeSession': 'Sesion aktiv',
  'account.security.bannerAria': 'Sillesi i ndërrimit të sesionit',
  'account.security.bannerTitle': 'Rrotullimi i sesionit aktual',
  'account.security.bannerBody':
    'Ndryshimi i suksesshëm i fjalëkalimit zëvendëson cookie-n e sesionit të nënshkruar në këtë shfletues. Sistemi ekzistues i sesionit pa gjendje nuk mund të tërheqë pasape një token që është kopjuar diku tjetër.',
  'account.securityForm.updating': 'Duke përditësuar…',
  'account.securityForm.submit': 'Ndrysho fjalëkalimin',
  'account.securityForm.currentPassword': 'Fjalëkalimi aktual',
  'account.securityForm.newPassword': 'Fjalëkalimi i ri',
  'account.securityForm.confirmPassword': 'Konfirmoni fjalëkalimin e ri',
  'account.securityForm.currentHint': 'Shkruani fjalëkalimin që përdoret aktualisht për hyrje.',
  'account.securityForm.newHint': 'Përdorni 12–72 karaktere me të mëdha, të vogla dhe një shifër.',
  'account.securityForm.confirmHint': 'Shkruani fjalëkalimin e ri për herë të dytë.',
  'account.securityForm.showCurrent': 'Shfaq fjalëkalimin aktual',
  'account.securityForm.hideCurrent': 'Fshih fjalëkalimin aktual',
  'account.securityForm.showNew': 'Shfaq fjalëkalimin e ri',
  'account.securityForm.hideNew': 'Fshih fjalëkalimin e ri',
  'account.securityForm.showConfirm': 'Shfaq fjalëkalimin e ri për konfirmim',
  'account.securityForm.hideConfirm': 'Fshih fjalëkalimin e ri për konfirmim',
  'account.securityForm.strengthLabel': 'Forca e fjalëkalimit',
  'account.securityForm.kicker': 'Fjalëkalimi',
  'account.securityForm.title': 'Zgjidhni një fjalëkalim të ri',
  'account.securityForm.intro':
    'Fjalëkalimi juaj aktual kërkohet para se të bëhet ndonjë ndryshim.',
  'account.securityForm.serverNote':
    'Fjalëkalimet kontrollohen në server dhe kurrë nuk shkruhen në log-e dhe as nuk kthehen nga formulari.',
  'account.securityForm.footer':
    'Pas suksesit, sesioni në këtë shfletues zëvendësohet me një sesion të nënshkruar rishtas.',
  'account.securityForm.changeStatus': 'Duke ndryshuar fjalëkalimin tuaj',

  // Account wishlist preview
  'account.wishlist.eyebrow': 'Ruajtur për më vonë',
  'account.wishlist.title': 'Lista e dëshirave',
  'account.wishlist.leadOne': '{count} produkt i ruajtur në llogarinë tuaj.',
  'account.wishlist.leadOther': '{count} produkte të ruajtura në llogarinë tuaj.',
  'account.wishlist.leadEmpty': 'Produktet që ruani ruhen bashkë me llogarinë tuaj të klientit.',
  'account.wishlist.emptyTitle': 'Ende asgjë e ruajtur',
  'account.wishlist.emptyBody':
    'Klikoni zemrën mbi çdo produkt për ta ruajtur këtu për më vonë. Produktet e ruajtura qëndrojnë me llogarinë tuaj në çdo pajisje nga ku hyni.',
  'account.wishlist.browse': 'Shfleto produktet',
  'account.wishlist.summaryAria': 'Produktet e ruajtura',
  'account.wishlist.openFull': 'Hap listën e plotë të dëshirave',
  'account.wishlist.note':
    'Ndryshimet e listës së dëshirave të bëra gjatë hyrjes ruhen në profilin tuaj të klientit në server, prandaj ju ndjekin në të gjitha pajisjet.',

  // Matësi i fortësisë së fjalëkalimit (SecurityForm)
  'account.strength.too_short': 'Shumë i shkurtër',
  'account.strength.weak': 'I dobët',
  'account.strength.fair': 'Mesatar',
  'account.strength.good': 'I mirë',
  'account.strength.strong': 'I fortë',

  // Faqet e llogarisë sime (sidebar + faqet)
  'account.nav.dashboard': 'Paneli',
  'account.nav.downloads': 'Shkarkimet',
  'account.nav.compare': 'Krahasimi',
  'account.nav.logOut': 'Dil',

  // Paneli
  'account.dashboard.hello': 'Përshëndetje',
  'account.dashboard.notPrefix': 'jo',
  'account.dashboard.copy1': 'Nga paneli i llogarisë mund të shihni',
  'account.dashboard.link1': 'porositë e fundit',
  'account.dashboard.copy2': 'të menaxhoni',
  'account.dashboard.link2': 'adresat e dërgesës dhe të faturimit',
  'account.dashboard.copy3': 'dhe',
  'account.dashboard.link3': 'të ndryshoni fjalëkalimin dhe detajet e llogarisë',

  // Tabela e porosive
  'account.orders.colOrder': 'Porosia',
  'account.orders.colDate': 'Data',
  'account.orders.colStatus': 'Statusi',
  'account.orders.colTotal': 'Totali',
  'account.orders.colActions': 'Veprime',
  'account.orders.view': 'Shiko',
  'account.orders.totalForItem': '{total} për {count} artikull',
  'account.orders.totalForItems': '{total} për {count} artikuj',
  'account.orders.emptyNotice': 'Nuk është bërë asnjë porosi ende.',
  'account.orders.browse': 'Shfleto produktet',

  // Një porosi
  'account.order.prefix': 'Porosia',
  'account.order.placedOn': 'u bë më',
  'account.order.andIs': 'dhe aktualisht është',
  'account.order.details': 'Detajet e porosisë',
  'account.order.product': 'Produkti',
  'account.order.total': 'Totali',
  'account.order.subtotal': 'Nëntotali:',
  'account.order.shipping': 'Dërgesa:',
  'account.order.payment': 'Mënyra e pagesës:',
  'account.order.grandTotal': 'Totali:',
  'account.order.billing': 'Adresa e faturimit',
  'account.order.shippingAddress': 'Adresa e dërgesës',

  // Shkarkimet
  'account.downloads.empty': 'Nuk ka shkarkime të disponueshme ende.',

  // Adresat
  'account.addresses.billing': 'Adresa e faturimit',
  'account.addresses.shipping': 'Adresa e dërgesës',
  'account.addresses.none': 'Nuk e keni vendosur ende këtë lloj adrese.',
  'account.addresses.intro': 'Adresat e mëposhtme do të përdoren si parazgjedhje në faqen e pagesës.',
  'account.addresses.save': 'Ruaj adresën',
  'account.addresses.editBilling': 'Ndrysho adresën e faturimit',
  'account.addresses.editShipping': 'Ndrysho adresën e dërgesës',

  // Forma e detajeve të llogarisë
  'account.form.firstName': 'Emri',
  'account.form.lastName': 'Mbiemri',
  'account.form.displayName': 'Emri i shfaqur',
  'account.form.displayNameHint':
    'Kështu do të shfaqet emri juaj në seksionin e llogarisë dhe në vlerësime',
  'account.form.email': 'Adresa e email-it',
  'account.form.phone': 'Telefoni',
  'account.form.passwordChange': 'Ndryshimi i fjalëkalimit',
  'account.form.currentPassword': 'Fjalëkalimi aktual (lëreni bosh për ta mbajtur)',
  'account.form.newPassword': 'Fjalëkalimi i ri (lëreni bosh për ta mbajtur)',
  'account.form.confirmPassword': 'Konfirmoni fjalëkalimin e ri',
  'account.form.showPassword': 'Shfaq fjalëkalimin',
  'account.form.hidePassword': 'Fshih fjalëkalimin',
  'account.form.save': 'Ruaj ndryshimet',
  'account.form.saving': 'Duke ruajtur…',

  // Krahasimi / lista e dëshirave brenda llogarisë
  'account.compare.empty': 'Asnjë produkt nuk është shtuar në tabelën e krahasimit.',
  'account.compare.product': 'Produkti',
  'account.compare.price': 'Çmimi',
  'account.compare.remove': 'Hiq',
  'account.compare.open': 'Hap krahasimin e plotë',
  'account.wishlist.empty': 'Nuk ka produkte në listën e dëshirave!',
};
