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
};
