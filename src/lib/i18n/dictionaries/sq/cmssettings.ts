import type { cmssettings as cmssettingsEn } from '../en/cmssettings';

export const cmssettings: typeof cmssettingsEn = {
  'cmssettings.common.saveChanges': 'Ruaj ndryshimet',

  /* --------------------------------- general --------------------------------- */
  'cmssettings.general.title': 'Cilësimet e përgjithshme',
  'cmssettings.general.description':
    'Identiteti i sitit, kontakti i administrimit, lokalizimi dhe formatet e parazgjedhura.',
  'cmssettings.general.cardTitle': 'Cilësimet e sitit',
  'cmssettings.general.cardDescription':
    'Shfaqet në dyqan, në panelin e administrimit dhe në email-et e dërguar.',
  'cmssettings.general.exampleLabel': 'Shembull:',
  'cmssettings.general.lastUpdated': 'Përditësuar së fundi më {date}',
  'cmssettings.general.notSavedYet': 'Ende s’është ruajtur',
  'cmssettings.general.sectionTitle': 'Lokalizimi',
  'cmssettings.general.sectionHint': 'Vlen për çmimet, faturat dhe përmbajtjen e planifikuar.',
  'cmssettings.general.summaryTimezone': 'Zona horare',
  'cmssettings.general.summaryDates': ', datat si',
  'cmssettings.general.siteTitleLabel': 'Titulli i sitit',
  'cmssettings.general.siteTitlePlaceholder': 'Dyqani im',
  'cmssettings.general.taglineLabel': 'Slogani',
  'cmssettings.general.taglinePlaceholder': 'Thjesht një dyqan tjetër',
  'cmssettings.general.siteUrlLabel': 'URL-ja e sitit (adresa WordPress)',
  'cmssettings.general.siteUrlHint': 'Vetëm lexim — vjen nga konfigurimi i mjedisit.',
  'cmssettings.general.adminEmailLabel': 'Adresa e emailit e administrimit',
  'cmssettings.general.mapCoordinatesLabel': 'Koordinatat e hartës së kontaktit (gjerësi, gjatësi)',
  'cmssettings.general.mapCoordinatesHint':
    'Pozicioni i saktë i pikës në hartën /home/contact. Kur është bosh, përdoret adresa e dyqanit.',
  'cmssettings.general.timezoneLabel': 'Zona horare',
  'cmssettings.general.dateFormatLabel': 'Formati i datës',
  'cmssettings.general.timeFormatLabel': 'Formati i orës',
  'cmssettings.general.currencyLabel': 'Monedha',
  'cmssettings.general.currencyPositionLabel': 'Pozicioni i simbolit të monedhës',
  'cmssettings.general.currencyPositionBefore': 'Para shumës — €1,234.56',
  'cmssettings.general.currencyPositionAfter': 'Pas shumës — 1,234.56 €',
  'cmssettings.general.decimalSeparatorLabel': 'Ndarësi dhjetor',
  'cmssettings.general.decimalSeparatorPoint': 'Pika (.) — 1234.56',
  'cmssettings.general.decimalSeparatorComma': 'Presja (,) — 1234,56',
  'cmssettings.general.currencyEur': 'EUR — Euro (€)',
  'cmssettings.general.currencyUsd': 'USD — Dollar amerikan ($)',
  'cmssettings.general.currencyGbp': 'GBP — Sterlina britanike (£)',
  'cmssettings.general.currencyAll': 'ALL — Leku shqiptar (L)',
  'cmssettings.general.currencyMkd': 'MKD — Denari maqedonas (ден)',
  'cmssettings.general.currencyRsd': 'RSD — Dinari serb (дин.)',

  /* --------------------------------- reading --------------------------------- */
  'cmssettings.reading.title': 'Cilësimet e leximit',
  'cmssettings.reading.description':
    'Kontrollo çfarë shfaq faqja kryesore dhe sa përmbajtje ngarkon çdo faqe.',
  'cmssettings.reading.cardTitle': 'Faqja jote kryesore',
  'cmssettings.reading.cardDescription':
    'Zgjidh midis postimeve të tua më të reja ose një faqeje të përzgjedhur.',
  'cmssettings.reading.sectionTitle': 'Përmbledhja e faqes së parë',
  'cmssettings.reading.selectPage': '— Zgjidh një faqe —',
  'cmssettings.reading.homepageTypeLabel': 'Faqja kryesore shfaq',
  'cmssettings.reading.homepageLatest': 'Postimet e tua më të reja',
  'cmssettings.reading.homepageStatic': 'Një faqe statike (përzgjidhet më poshtë)',
  'cmssettings.reading.homepageLabel': 'Faqja kryesore',
  'cmssettings.reading.homepageHint': 'Përdoret vetëm kur zgjidhet “Një faqe statike” më lart.',
  'cmssettings.reading.postsPerPageLabel': 'Faqet e blogut shfaqin maksimumi',
  'cmssettings.reading.postsPerPageSuffix': 'postime për faqe',
  'cmssettings.reading.postsPerPageHint': 'Ndërmjet 1 dhe 100.',
  'cmssettings.reading.discussionPageLabel': 'Faqja e diskutimit',
  'cmssettings.reading.discussionPageHint': 'Faqe opsionale që përmban diskutimet e komenteve.',
  'cmssettings.reading.summaryStatic': 'Faqja kryesore e dyqanit është një faqe statike ({page}).',
  'cmssettings.reading.summaryNotSelected': 'ende e pazgjedhur',
  'cmssettings.reading.summaryLatest':
    'Faqja kryesore e dyqanit liston postimet e tua më të fundit të publikuara.',

  /* ------------------------------- discussion -------------------------------- */
  'cmssettings.discussion.title': 'Cilësimet e diskutimit',
  'cmssettings.discussion.description':
    'Vendos kush mund të komentojë dhe sa kontroll kërkojnë komentet.',
  'cmssettings.discussion.cardTitle': 'Cilësimet e komenteve',
  'cmssettings.discussion.cardDescription':
    'Vlen për postimet e blogut dhe çdo faqe që pranon komente.',
  'cmssettings.discussion.sectionTitle': 'Moderimi',
  'cmssettings.discussion.moderationQueued':
    'Komentet presin në panel derisa t’i mirëtoni.',
  'cmssettings.discussion.moderationImmediate': 'Komentet publikohen menjëherë.',
  'cmssettings.discussion.allowCommentsLabel': 'Lejo dërgimin e komenteve të reja',
  'cmssettings.discussion.allowCommentsHint': 'Fikeni për të mbyllur komentimin në gjithë sitin.',
  'cmssettings.discussion.moderateLabel': 'Mbaji komentet për moderim',
  'cmssettings.discussion.moderateHint': 'Komentet e reja duhet të miratohen para se të shfaqen.',
  'cmssettings.discussion.requireNameEmailLabel':
    'Autori i komentit duhet të plotësojë emrin dhe email-in',
  'cmssettings.discussion.requireNameEmailHint':
    'Komentet anonime refuzohen kur aktivizohet.',
  'cmssettings.discussion.notifyLabel': 'Më dërgo email kur dikush komenton',
  'cmssettings.discussion.notifyHint':
    'Dërgon një njoftim në adresën e emailit të administrimit.',
  'cmssettings.discussion.closeAfterLabel': 'Mbyll komentet automatikisht pas N ditësh',
  'cmssettings.discussion.closeAfterSuffix': 'ditë',
  'cmssettings.discussion.closeAfterHint': '0 çaktivizon mbylljen automatike.',

  /* ---------------------------------- media ---------------------------------- */
  'cmssettings.media.title': 'Cilësimet e mediave',
  'cmssettings.media.description':
    'Madhësitë e parazgjedhura të imazheve që gjenerohen për miniatura, karta dhe pamje detaji.',
  'cmssettings.media.cardTitle': 'Madhësitë e imazheve',
  'cmssettings.media.cardDescription':
    'Gjerësia dhe lartësia në piksela. Vendos 0 për të ruajtur përmasën origjinale.',
  'cmssettings.media.sectionTitle': 'Ngarkesat',
  'cmssettings.media.uploadsOrganised':
    'Skedarët grupohen në dosje sipas muajit, çka mban bibliotekat e mëdha të menaxhueshme.',
  'cmssettings.media.uploadsFlat': 'Skedarët ruhen drejtpërdrejt në rrënjën e ngarkesave.',
  'cmssettings.media.sizeWidth': '{size}: gjerësia',
  'cmssettings.media.sizeHeight': '{size}: lartësia',
  'cmssettings.media.sizeThumbnail': 'Miniatura',
  'cmssettings.media.sizeMedium': 'Formati mesatar',
  'cmssettings.media.sizeLarge': 'Formati i madh',
  'cmssettings.media.organiseLabel': 'Organizo ngarkesat në dosje sipas muajit',
  'cmssettings.media.organiseHint': 'Skedarët e rinj ruhen në rrugë si /2026/09/.',

  /* -------------------------------- permalinks -------------------------------- */
  'cmssettings.permalinks.title': 'Lidhjet e qëndrueshme',
  'cmssettings.permalinks.description':
    'Zgjidh strukturën e URL-së që përdoret për postimet dhe faqet.',
  'cmssettings.permalinks.cardTitle': 'Struktura e lidhjes së qëndrueshme',
  'cmssettings.permalinks.cardDescription':
    'Etiketat e disponueshme për strukturën e personalizuar: %year%, %monthnum%, %day%, %postname%, %post_id%, %category%, %author%.',
  'cmssettings.permalinks.sectionTitle': 'Për të ditur',
  'cmssettings.permalinks.sectionBody':
    'Parapamja shfaq një URL shembull për strukturën e zgjedhur. Lidhjet ekzistuese vazhdojnë të funksionojnë — lidhjet e qëndrueshme zgjidhen nga slug-u i ruajtur në çdo rast.',
  'cmssettings.permalinks.fieldLabel': 'Cilësimet e përgjithshme',
  'cmssettings.permalinks.optionPlain': 'I thjeshtë — https://example.com/?p=123',
  'cmssettings.permalinks.optionDayName':
    'Dita dhe emri — https://example.com/2026/09/25/sample-post/',
  'cmssettings.permalinks.optionMonthName':
    'Muaji dhe emri — https://example.com/2026/09/sample-post/',
  'cmssettings.permalinks.optionPostName': 'Emri i postimit — https://example.com/sample-post/',
  'cmssettings.permalinks.optionCustom': 'Strukturë e personalizuar',

  /* ---------------------------------- email ---------------------------------- */
  'cmssettings.email.title': 'Email-i',
  'cmssettings.email.description':
    'Email-et e dërguar për njoftimet e porosive dhe provat — dërgohen nëpërmjet Resend, me SMTP si rezervë.',
  'cmssettings.email.resendCardTitle': 'Resend (i rekomanduar)',
  'cmssettings.email.resendActiveDescription':
    'Aktiv — email-et dërgohen nëpërmjet Resend nga {from}. Cilësimet e SMTP më poshtë nuk përdoren sa kohë RESEND_API_KEY është i vendosur.',
  'cmssettings.email.resendInactiveDescription':
    'Jo aktiv — shto RESEND_API_KEY=re_… në skedarin .env (opsionalisht RESEND_FROM=… për dërguesin tënd), pastaj riinis serverin. Plani falas: 100 email-e në ditë, 3,000 në muaj.',
  'cmssettings.email.statusConfigured': 'I konfiguruar — dërgohet nga {from}',
  'cmssettings.email.statusNotConfigured':
    'Jo i konfiguruar — dërguesi i parazgjedhur do të ishte {from}',
  'cmssettings.email.smtpCardTitle': 'Konfigurimi i SMTP',
  'cmssettings.email.smtpDescriptionResend':
    'Resend është aktiv, prandaj SMTP më poshtë është vetëm rezervë — ruaje si furnizues rezervë.',
  'cmssettings.email.smtpDescriptionConfigured':
    'SMTP është konfiguruar — përdor butonin më poshtë për ta verifikuar nga fillimi në fund.',
  'cmssettings.email.smtpDescriptionEmpty':
    'SMTP nuk është konfiguruar ende. Plotëso hostin, portin dhe kredencialet, ruaj, pastaj dërgo një email provë.',
  'cmssettings.email.sectionTitle': 'Provë dërgimi',
  'cmssettings.email.hostLabel': 'Hosti SMTP',
  'cmssettings.email.portLabel': 'Porti',
  'cmssettings.email.portHint': '587 për TLS, 465 për SSL, 25 pa enkriptim.',
  'cmssettings.email.encryptionLabel': 'Enkriptimi',
  'cmssettings.email.encryptionNone': 'Asnjë',
  'cmssettings.email.usernameLabel': 'Përdoruesi',
  'cmssettings.email.usernamePlaceholder': 'Përdoruesi SMTP',
  'cmssettings.email.passwordLabel': 'Fjalëkalimi',
  'cmssettings.email.passwordPlaceholder': 'Fjalëkalimi SMTP',
  'cmssettings.email.passwordHint':
    'Ruhet në tabelën e cilësimeve — përdor një fjalëkalim aplikacioni kur disponohet.',
  'cmssettings.email.fromNameLabel': 'Emri i dërguesit',
  'cmssettings.email.fromEmailLabel': 'Adresa e emailit e dërguesit',

  /* --------------------------------- payments --------------------------------- */
  'cmssettings.payments.title': 'Pagesat',
  'cmssettings.payments.description':
    'Aktivizo kalimet e pagesave që pranon dhe konfiguro kredencialet e tyre.',
  'cmssettings.payments.enabled': 'Aktiv',
  'cmssettings.payments.disabled': 'Joaktiv',
  'cmssettings.payments.keysFooter':
    'Çelësat ruhen në anën e serverit dhe nuk ekspozohen kurrë në dyqan.',
  'cmssettings.payments.gatewaySettings': 'Cilësimet e {name}',
  'cmssettings.payments.saveGateway': 'Ruaj {name}',
  'cmssettings.payments.stripeName': 'Stripe',
  'cmssettings.payments.stripeDescription': 'Karta, Apple Pay dhe Google Pay nëpërmjet Stripe.',
  'cmssettings.payments.stripeEnableLabel': 'Aktivizo Stripe',
  'cmssettings.payments.stripeEnableHint': 'Shfaq pagesën me kartë në kassen.',
  'cmssettings.payments.modeLabel': 'Modaliteti',
  'cmssettings.payments.stripeModeTest': 'Modaliteti i provës (çelësa provë)',
  'cmssettings.payments.stripeModeLive': 'Modaliteti real (pagesa vërtete)',
  'cmssettings.payments.publishableKeyLabel': 'Çelësi i publikueshëm',
  'cmssettings.payments.secretKeyLabel': 'Çelësi sekret',
  'cmssettings.payments.paypalName': 'PayPal',
  'cmssettings.payments.paypalDescription':
    'Portofoli PayPal dhe pagesa me kartë nëpërmjet PayPal.',
  'cmssettings.payments.paypalEnableLabel': 'Aktivizo PayPal',
  'cmssettings.payments.paypalEnableHint': 'Shfaq butonin PayPal në kassen.',
  'cmssettings.payments.paypalModeSandbox': 'Sandbox (llogari blerësi)',
  'cmssettings.payments.paypalModeLive': 'Real (pagesa vërtete)',
  'cmssettings.payments.clientIdLabel': 'ID e klientit',
  'cmssettings.payments.secretLabel': 'Sekreti',
  'cmssettings.payments.codName': 'Pagesë në dorëzim',
  'cmssettings.payments.codDescription': 'Merr pagesën kur porosia dorëzohet.',
  'cmssettings.payments.codEnableLabel': 'Aktivizo pagesën në dorëzim',
  'cmssettings.payments.codEnableHint': 'I disponueshëm për zonat e dërgimit që e lejojnë.',
  'cmssettings.payments.instructionsLabel': 'Udhëzimet',
  'cmssettings.payments.codInstructionsPlaceholder':
    'Paguaj me para në dorë kur porosia të dorëzohet.',
  'cmssettings.payments.bankName': 'Transfer bankar',
  'cmssettings.payments.bankDescription':
    'Transfer bankar manual me udhëzime për klientin.',
  'cmssettings.payments.bankEnableLabel': 'Aktivizo transferin bankar',
  'cmssettings.payments.bankEnableHint':
    'Porositë mbeten “në pritje” derisa të konfirmohet pagesa.',
  'cmssettings.payments.bankInstructionsPlaceholder': 'Transfero në llogarinë e dyqanit…',
  'cmssettings.payments.ibanLabel': 'Numri i llogarisë / IBAN',

  /* ----------------------------------- tax ----------------------------------- */
  'cmssettings.tax.title': 'Tatimi',
  'cmssettings.tax.description':
    'Përcakto si përfshijnë çmimet tatimin dhe menaxho normat e aplikueshme në kassen.',
  'cmssettings.tax.optionsCardTitle': 'Opsionet e tatimit',
  'cmssettings.tax.optionsCardDescription':
    'Sjellja e përbashkët për shportën, kassen dhe faturat.',
  'cmssettings.tax.sectionTitle': 'Aktualisht në përdorim',
  'cmssettings.tax.pricesIncludeTax': 'Çmimet e produkteve përfshijnë tatimin.',
  'cmssettings.tax.pricesExcludeTax': 'Tatimi shtohet mbi çmimet e produkteve.',
  'cmssettings.tax.totalsShown': 'Totalet shfaqen',
  'cmssettings.tax.totalSingle': 'si një total i vetëm',
  'cmssettings.tax.totalItemised': 'i detajuar',
  'cmssettings.tax.pricesIncludeLabel': 'Çmimet e futura me tatim të përfshirë',
  'cmssettings.tax.pricesIncludeHint':
    'Çmimet e produkteve tashmë përmbajnë tatim. Fikeni për të shtuar tatim në kassen.',
  'cmssettings.tax.showTotalsLabel': 'Shfaq totalet e tatimit',
  'cmssettings.tax.showTotalsItemised':
    'I detajuar — shfaq çdo normë tatimi në rreshtin e vet',
  'cmssettings.tax.showTotalsSingle': 'Total i vetëm — një rresht i kombinuar tatimi',
  'cmssettings.tax.ratesCardTitle': 'Normat e tatimit',
  'cmssettings.tax.ratesCardDescription':
    'Norma sipas shtetit / rajonit / kodit postar. Lëre shtetin bosh për të aplikuar kudo.',
};
