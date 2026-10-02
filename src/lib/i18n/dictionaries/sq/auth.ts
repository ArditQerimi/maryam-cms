import type { auth as authEn } from '../en/auth';

export const auth: typeof authEn = {
  // — Ballina / identifikimi / regjistrimi —
  'auth.crumb.home': 'Ballina',
  'auth.crumb.myAccount': 'Llogaria ime',
  'auth.crumb.signIn': 'Hyr në llogari',
  'auth.crumb.createAccount': 'Krijo llogari',
  'auth.crumb.resetPassword': 'Rikthe fjalëkalimin',
  'auth.crumb.newPassword': 'Zgjidh një fjalëkalim të ri',
  'auth.crumb.confirmEmail': 'Konfirmo email-in',
  'auth.store.unnamed': 'dyqani',

  // — Faqja e hyrjes —
  'auth.login.eyebrow': 'Llogaria juaj te {store}',
  'auth.login.title': 'Mirë se erdhe përsëri.',
  'auth.login.intro':
    'Hyr në llogari për të parë qartë porositë dhe llogarinë tuaj, pa i futur të dhënat tuaja çdo herë.',
  'auth.login.benefits.aria': 'Përfitimet e llogarisë',
  'auth.login.benefit.history.title': 'Historiku i porosive',
  'auth.login.benefit.history.text': 'Mbaji të gjitha blerjet afër',
  'auth.login.benefit.quick.title': 'Qasje e shpejtë',
  'auth.login.benefit.quick.text': 'Kthehu pa rishkruar të dhënat tuaja',
  'auth.login.benefit.secure.title': 'Një vend i sigurt',
  'auth.login.benefit.secure.text': 'Menaxhoni profilin e dyqanit tuaj',
  'auth.login.trust':
    'Të dhënat tuaja dërgohen në mënyrë të sigurt te shërbimi i identifikimit të dyqanit.',
  'auth.login.card.kicker': 'Hyrje për klientë',
  'auth.login.card.title': 'Hyr në llogarinë tuaj',
  'auth.login.card.copy': 'Futni email-in dhe fjalëkalimin e lidhur me llogarinë tuaj të klientit.',
  'auth.login.notice.passwordReset':
    'Fjalëkalimi juaj u përditësua — hyr me fjalëkalimin e ri.',

  // Kodet e `?error=` që shkruan veprimi i identifikimit.
  'auth.login.error.missing-fields': 'Futni email-in dhe fjalëkalimin tuaj për të vazhduar.',
  'auth.login.error.invalid-email': 'Shkruani një adresë email të vlefshme.',
  'auth.login.error.password-too-short': 'Fjalëkalimi duhet të përmbajë të paktën 8 karaktere.',
  'auth.login.error.invalid-credentials':
    'Nuk mund të bënim hyrjen. Kontrolloni email-in dhe fjalëkalimin, pastaj provoni përsëri.',
  'auth.login.error.account-suspended':
    'Kjo llogari dyqani është pezulluar. Ju lutem kontaktoni dyqanin për ndihmë.',
  'auth.login.error.tenant-domain-required':
    'Kjo llogari i përket një dyqani. Hyni përmes faqes së atij dyqani.',
  'auth.login.error.wrong-audience':
    'Kjo është llogari stafi dhe nuk përdoret në dyqan. Hyni përmes panelit të administrimit.',
  'auth.login.error.company-not-found':
    'Nuk gjetëm dot një dyqan për këtë llogari. Kontrolloni adresën ose kontaktoni mbështetjen.',
  'auth.login.error.tenant-not-found':
    'Dyqani i kësaj llogarie nuk u gjet. Ju lutem provoni më vonë.',
  'auth.login.error.database-error':
    'Nuk mund të arritëm dyqanin tuaj tani. Ju lutem provoni sërish pas pak çastesh.',
  'auth.login.error.server-error': 'Diçka shkoi keq gjatë hyrjes. Ju lutem provoni përsëri.',
  'auth.login.error.fallback':
    'Nuk mund të bënim hyrjen. Kontrolloni të dhënat tuaja dhe provoni përsëri.',

  // — Formulari i hyrjes —
  'auth.login.form.aria': 'Hyrje për klientë',
  'auth.login.form.emailLabel': 'Adresë email',
  'auth.login.form.passwordLabel': 'Fjalëkalim',
  'auth.login.form.passwordPlaceholder': 'Shkruani fjalëkalimin tuaj',
  'auth.login.form.passwordHint': 'Fjalëkalimet duhet të përmbajnë të paktën 8 karaktere.',
  'auth.login.form.showPassword': 'Shfaq fjalëkalimin',
  'auth.login.form.hidePassword': 'Fshih fjalëkalimin',
  'auth.login.form.forgot': 'Harruat fjalëkalimin?',
  'auth.login.form.submit': 'Hyr',
  'auth.login.form.submitPending': 'Duke hyrë…',
  'auth.login.form.submitStatus': 'Duke hyrë',
  'auth.login.form.separator': 'Ende nuk ke llogari?',
  'auth.login.form.createAccount': 'Krijo një llogari',
  'auth.login.form.legal.prefix': 'Duke hyrë, pranoni',
  'auth.login.form.legal.terms': 'Kushtet e Shërbimit',
  'auth.login.form.legal.and': 'dhe',
  'auth.login.form.legal.privacy': 'Politikën e Privatësisë',

  // — Faqja e krijimit të llogarisë —
  'auth.register.eyebrow.join': 'Bashkohu me {store}',
  'auth.register.title': 'Një mënyrë më e shpejtë për të blerë.',
  'auth.register.intro':
    'Krijoni llogarinë tuaj të klientit për qasje të sigurt te historiku i porosive dhe llogaria juaj sa herë ktheheni në dyqan.',
  'auth.register.benefits.aria': 'Përfitimet e llogarisë së blerjeve',
  'auth.register.benefit.quick.title': 'Qasje e shpejtë',
  'auth.register.benefit.quick.text': 'Kthehu në llogarinë tuaj me pak hapa',
  'auth.register.benefit.history.title': 'Historiku i blerjeve',
  'auth.register.benefit.history.text': 'Shqyrto porositë e mëparshme në një vend',
  'auth.register.benefit.account.title': 'Një llogari klienti',
  'auth.register.benefit.account.text': 'Përdor të njëjtat të dhëna për vizitat e ardhshme',
  'auth.register.assurance':
    'Llogaria juaj krijohet vetëm për këtë dyqan. Fjalëkalimet ruhen të hashuara.',
  'auth.register.card.kicker': 'Regjistrim për klientë',
  'auth.register.card.title': 'Krijoni llogarinë tuaj',
  'auth.register.card.copy': 'Të gjitha fushat me yllëzë janë të detyrueshme.',
  'auth.register.success.eyebrow': 'Llogaria u krijua',
  'auth.register.success.title': 'Gati.',
  'auth.register.success.copy':
    'Llogaria juaj e klientit u krijua dhe tashmë jeni të identifikuar. Kontrolloni inbox-in — ju kemi dërguar një lidhje për të konfirmuar adresën email.',
  'auth.register.success.viewOrders': 'Shiko porositë tuaja',
  'auth.register.success.continue': 'Vazhdo blerjet',
  'auth.register.success.note': 'Sesioni juaj është i sigurt me një cookie HTTP-only.',

  // Kodet e kthimit nga veprimi i regjistrimit.
  'auth.register.error.missing-first-name': 'Shkruani emrin tuaj.',
  'auth.register.error.missing-email': 'Shkruani adresën email.',
  'auth.register.error.missing-password': 'Zgjidhni një fjalëkalim.',
  'auth.register.error.missing-confirm-password': 'Shkruani përsëri fjalëkalimin.',
  'auth.register.error.name-too-short': 'Emrat duhet të përmbajnë të paktën 2 karaktere.',
  'auth.register.error.invalid-email': 'Shkruani një adresë email të vlefshme.',
  'auth.register.error.password-too-short': 'Përdorni një fjalëkalim me të paktën 8 karaktere.',
  'auth.register.error.password-mismatch': 'Fjalëkalimet nuk përputhen.',
  'auth.register.error.terms-required':
    'Pranoni Kushtet e Shërbimit dhe Politikën e Privatësisë për të vazhduar.',
  'auth.register.error.email-taken':
    'Për këtë email ekziston tashmë një llogari. Provo të hysh në llogari.',
  'auth.register.error.account-suspended':
    'Ky dyqan është pezulluar, prandaj llogari të reja nuk mund të krijohen.',
  'auth.register.error.registration-unavailable':
    'Nuk mund të krijuam llogarinë tuaj tani. Ju lutem provoni sërish pas pak çastesh.',
  'auth.register.error.session-unavailable':
    'Llogaria juaj u krijua, por nuk mundëm të ju identifikonim automatikisht. Përdorni lidhjen për hyrje më poshtë.',
  'auth.register.error.fallback':
    'Nuk mund të krijuam llogarinë tuaj. Kontrolloni të dhënat dhe provoni përsëri.',

  // — Formulari i regjistrimit —
  'auth.register.form.aria': 'Krijo llogari klienti',
  'auth.register.form.firstName': 'Emri',
  'auth.register.form.lastName': 'Mbiemri',
  'auth.register.form.optional': '(opsionale)',
  'auth.register.form.email': 'Adresë email',
  'auth.register.form.password': 'Fjalëkalim',
  'auth.register.form.confirmPassword': 'Konfirmo fjalëkalimin',
  'auth.register.form.passwordPlaceholder': 'Krijo një fjalëkalim',
  'auth.register.form.confirmPlaceholder': 'Shkruajeni përsëri',
  'auth.register.form.passwordHint': 'Përdorni të paktën 8 karaktere.',
  'auth.register.form.showPassword': 'Shfaq fjalëkalimin',
  'auth.register.form.hidePassword': 'Fshih fjalëkalimin',
  'auth.register.form.showConfirm': 'Shfaq fjalëkalimin e konfirmimit',
  'auth.register.form.hideConfirm': 'Fshih fjalëkalimin e konfirmimit',
  'auth.register.form.terms': 'Pajtohem me kushtet e llogarisë dhe njoftimin për privatësinë.',
  'auth.register.form.policy.prefix': 'Lexoni',
  'auth.register.form.policy.terms': 'Kushtet e Shërbimit',
  'auth.register.form.policy.and': 'dhe',
  'auth.register.form.policy.privacy': 'Politikën e Privatësisë',
  'auth.register.form.submit': 'Krijo llogarinë',
  'auth.register.form.submitPending': 'Duke krijuar llogarinë…',
  'auth.register.form.submitStatus': 'Duke krijuar llogarinë tuaj',
  'auth.register.form.separator': 'Tashmë ke një llogari?',
  'auth.register.form.signInInstead': 'Hyr në vend të kësaj',

  // — Harrova fjalëkalimin —
  'auth.forgot.success.eyebrow': 'Emaili u dërgua',
  'auth.forgot.success.title': 'Kontrolloni inbox-in tuaj.',
  'auth.forgot.success.copy':
    'Nëse për këtë adresë ekziston një llogari, lidhja për ndryshimin e fjalëkalimit është në rrugë e sipër. Lidhja skadon pas 1 ore dhe përdoret vetëm një herë.',
  'auth.forgot.success.back': 'Kthehu te hyrja',
  'auth.forgot.kicker': 'Rikuperim llogarie',
  'auth.forgot.title': 'Ndryshoni fjalëkalimin tuaj',
  'auth.forgot.copy':
    'Shkruani adresën email të llogarisë suaj te {store} dhe do t\'ju dërgojmë një lidhje për të zgjedhur një fjalëkalim të ri.',
  'auth.forgot.emailLabel': 'Adresë email',
  'auth.forgot.submit': 'Dërgomë një lidhje për ndryshim',
  'auth.forgot.footnote.prefix': 'E mbajtët mend gjithsesi?',
  'auth.forgot.footnote.link': 'Kthehu te hyrja',

  // — Ndryshimi i fjalëkalimit —
  'auth.reset.error.weak': 'Fjalëkalimi i ri duhet të jetë të paktën 8 karaktere.',
  'auth.reset.error.mismatch':
    'Fjalëkalimet nuk përputhen. Shkruani të njëjtin fjalëkalim në të dyja fushat.',
  'auth.reset.error.invalid':
    'Kjo lidhje nuk është më e vlefshme ose ka skaduar. Kërkoni një të re më poshtë.',
  'auth.reset.error.failed':
    'Diçka shkoi keq gjatë ruajtjes së fjalëkalimit të ri. Ju lutem provoni përsëri.',
  'auth.reset.kicker': 'Rikuperim llogarie',
  'auth.reset.title': 'Zgjidhni një fjalëkalim të ri',
  'auth.reset.copy.token':
    'Zgjidhni një fjalëkalim të ri për llogarinë tuaj te {store}. Lidhja që përdorët funksionon vetëm një herë.',
  'auth.reset.copy.noToken': 'Kjo lidhje nuk mund të verifikohej.',
  'auth.reset.passwordLabel': 'Fjalëkalim i ri',
  'auth.reset.passwordPlaceholder': 'Të paktën 8 karaktere',
  'auth.reset.passwordHint': 'Përdorni të paktën 8 karaktere.',
  'auth.reset.confirmLabel': 'Konfirmo fjalëkalimin e ri',
  'auth.reset.confirmPlaceholder': 'Përsëritni fjalëkalimin e ri',
  'auth.reset.submit': 'Ruaj fjalëkalimin e ri',
  'auth.reset.invalidLink': 'Kjo lidhje mungon ose është e gabuar. Kërkoni një të re më poshtë.',
  'auth.reset.footnote.prefix': 'Ju duhet një lidhje e re?',
  'auth.reset.footnote.link': 'Kërkoni një lidhje',

  // — Konfirmimi i email-it —
  'auth.verify.error.invalid':
    'Kjo lidhje konfirmimi nuk është më e vlefshme ose është përdorur tashmë.',
  'auth.verify.error.failed':
    'Diçka shkoi keq gjatë konfirmimit të email-it. Ju lutem provoni përsëri.',
  'auth.verify.verified.eyebrow': 'Emaili u konfirmua',
  'auth.verify.verified.title': 'Gati.',
  'auth.verify.verified.copy':
    'Adresa juaj email është konfirmuar, ndaj përditësimet e porosive dhe njoftimet nga {store} do të mbërrijnë në këtë inbox.',
  'auth.verify.verified.action': 'Shko te llogaria ime',
  'auth.verify.sent.eyebrow': 'Emaili u dërgua',
  'auth.verify.sent.title': 'Kontrolloni inbox-in tuaj.',
  'auth.verify.sent.copy':
    'Nëse kjo adresë i përket një llogarie të pakonfirmuar, një lidhje e re konfirmimi është në rrugë e sipër. Ajo skadon pas 24 orësh.',
  'auth.verify.sent.action': 'Kthehu te hyrja',
  'auth.verify.kicker': 'Konfirmoni email-in tuaj',
  'auth.verify.title': 'Konfirmoni adresën tuaj email',
  'auth.verify.copy.token':
    'Me një klikim konfirmoni se kjo adresë është vërtet e juaja dhe përfundoni konfigurimin e llogarisë suaj te {store}.',
  'auth.verify.copy.noToken':
    'Kjo lidhje konfirmimi mungon, ka skaduar ose është përdorur tashmë — kërkoni një të re më poshtë.',
  'auth.verify.confirm': 'Konfirmo email-in tim',
  'auth.verify.resendSeparator': 'Nuk e morët email-in?',
  'auth.verify.emailLabel': 'Adresë email',
  'auth.verify.resend': 'Dërgo një lidhje të re konfirmimi',
  'auth.verify.footnote.prefix': 'Ndryshuat mendje?',
  'auth.verify.footnote.link': 'Kthehu te hyrja',
};
