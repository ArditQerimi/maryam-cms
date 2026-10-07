/** cmssettings copy (CMS admin). Keys must stay prefixed with 'cmssettings'. */
export const cmssettings = {
  'cmssettings.common.saveChanges': 'Save changes',

  /* --------------------------------- general --------------------------------- */
  'cmssettings.general.title': 'General settings',
  'cmssettings.general.description':
    'Site identity, admin contact, localisation and formatting defaults.',
  'cmssettings.general.cardTitle': 'Site settings',
  'cmssettings.general.cardDescription': 'Shown across the storefront, admin and outgoing emails.',
  'cmssettings.general.exampleLabel': 'Example:',
  'cmssettings.general.lastUpdated': 'Last updated {date}',
  'cmssettings.general.notSavedYet': 'Not saved yet',
  'cmssettings.general.sectionTitle': 'Localisation',
  'cmssettings.general.sectionHint': 'Applies to prices, receipts and scheduled content.',
  'cmssettings.general.summaryTimezone': 'Timezone',
  'cmssettings.general.summaryDates': ', dates as',
  'cmssettings.general.siteTitleLabel': 'Site title',
  'cmssettings.general.siteTitlePlaceholder': 'My store',
  'cmssettings.general.taglineLabel': 'Tagline',
  'cmssettings.general.taglinePlaceholder': 'Just another store',
  'cmssettings.general.siteUrlLabel': 'Site URL (WordPress address)',
  'cmssettings.general.siteUrlHint': 'Read-only — comes from the environment configuration.',
  'cmssettings.general.adminEmailLabel': 'Administration email address',
  'cmssettings.general.mapCoordinatesLabel': 'Contact map coordinates (latitude, longitude)',
  'cmssettings.general.mapCoordinatesHint':
    'Exact pin position on the /home/contact map. Falls back to the store address when empty.',
  'cmssettings.general.whatsappLabel': 'WhatsApp number for orders',
  'cmssettings.general.whatsappHint':
    'With country code (e.g. +383…). After an order is saved, customers are taken to WhatsApp with the order message prepared from the stored order.',
  'cmssettings.whatsapp.title': 'WhatsApp',
  'cmssettings.whatsapp.description': 'Link the shop WhatsApp so new orders reach you automatically.',
  'cmssettings.whatsapp.cardTitle': 'WhatsApp link',
  'cmssettings.whatsapp.cardDescription': 'Scan the code once with the shop phone. The link stays active until you log out from the phone.',
  'cmssettings.whatsapp.loading': 'Checking…',
  'cmssettings.whatsapp.notConfigured': 'The WhatsApp agent is not configured. Set WHATSAPP_AGENT_URL, WHATSAPP_AGENT_TOKEN and WHATSAPP_AGENT_TO for the store.',
  'cmssettings.whatsapp.unreachable': 'The WhatsApp agent cannot be reached. Start it (npm start in the whatsapp-agent folder) and check WHATSAPP_AGENT_URL.',
  'cmssettings.whatsapp.linked': 'WhatsApp is linked {number}',
  'cmssettings.whatsapp.sendsTo': 'New orders are sent to {number}.',
  'cmssettings.whatsapp.sendTest': 'Send a test message',
  'cmssettings.whatsapp.sending': 'Sending…',
  'cmssettings.whatsapp.testSent': 'Test message sent.',
  'cmssettings.whatsapp.scanHelp': 'On the phone: WhatsApp → Linked devices → Link a device, then scan this code.',
  'cmssettings.whatsapp.qrLoading': 'Waiting for the code…',
  'cmssettings.general.timezoneLabel': 'Timezone',
  'cmssettings.general.dateFormatLabel': 'Date format',
  'cmssettings.general.timeFormatLabel': 'Time format',
  'cmssettings.general.currencyLabel': 'Currency',
  'cmssettings.general.currencyPositionLabel': 'Currency symbol position',
  'cmssettings.general.currencyPositionBefore': 'Before amount — €1,234.56',
  'cmssettings.general.currencyPositionAfter': 'After amount — 1,234.56 €',
  'cmssettings.general.decimalSeparatorLabel': 'Decimal separator',
  'cmssettings.general.decimalSeparatorPoint': 'Point (.) — 1234.56',
  'cmssettings.general.decimalSeparatorComma': 'Comma (,) — 1234,56',
  'cmssettings.general.currencyEur': 'EUR — Euro (€)',
  'cmssettings.general.currencyUsd': 'USD — US Dollar ($)',
  'cmssettings.general.currencyGbp': 'GBP — Pound Sterling (£)',
  'cmssettings.general.currencyAll': 'ALL — Albanian Lek (L)',
  'cmssettings.general.currencyMkd': 'MKD — Macedonian Denar (ден)',
  'cmssettings.general.currencyRsd': 'RSD — Serbian Dinar (дин.)',

  /* --------------------------------- reading --------------------------------- */
  'cmssettings.reading.title': 'Reading settings',
  'cmssettings.reading.description':
    'Control what the homepage shows and how much content each page loads.',
  'cmssettings.reading.cardTitle': 'Your homepage',
  'cmssettings.reading.cardDescription':
    'Choose between a live feed of your newest posts or a hand-picked page.',
  'cmssettings.reading.sectionTitle': 'Front page summary',
  'cmssettings.reading.selectPage': '— Select a page —',
  'cmssettings.reading.homepageTypeLabel': 'Homepage displays',
  'cmssettings.reading.homepageLatest': 'Your latest posts',
  'cmssettings.reading.homepageStatic': 'A static page (selected below)',
  'cmssettings.reading.homepageLabel': 'Homepage',
  'cmssettings.reading.homepageHint': 'Used only when “A static page” is selected above.',
  'cmssettings.reading.postsPerPageLabel': 'Blog pages show at most',
  'cmssettings.reading.postsPerPageSuffix': 'posts per page',
  'cmssettings.reading.postsPerPageHint': 'Between 1 and 100.',
  'cmssettings.reading.discussionPageLabel': 'Discussion page',
  'cmssettings.reading.discussionPageHint': 'Optional page that hosts the comment threads.',
  'cmssettings.reading.summaryStatic': 'The storefront homepage is a static page ({page}).',
  'cmssettings.reading.summaryNotSelected': 'not selected yet',
  'cmssettings.reading.summaryLatest':
    'The storefront homepage lists your latest published posts.',

  /* ------------------------------- discussion -------------------------------- */
  'cmssettings.discussion.title': 'Discussion settings',
  'cmssettings.discussion.description':
    'Decide who can comment and how much review comments need.',
  'cmssettings.discussion.cardTitle': 'Comment settings',
  'cmssettings.discussion.cardDescription':
    'Applies to blog posts and any page that accepts comments.',
  'cmssettings.discussion.sectionTitle': 'Moderation',
  'cmssettings.discussion.moderationQueued':
    'Comments are queued in the admin until you approve them.',
  'cmssettings.discussion.moderationImmediate': 'Comments publish immediately.',
  'cmssettings.discussion.allowCommentsLabel': 'Allow people to submit new comments',
  'cmssettings.discussion.allowCommentsHint': 'Turn off to close commenting site-wide.',
  'cmssettings.discussion.moderateLabel': 'Hold comments for moderation',
  'cmssettings.discussion.moderateHint': 'New comments must be approved before they appear.',
  'cmssettings.discussion.requireNameEmailLabel':
    'Comment author must fill out name and email',
  'cmssettings.discussion.requireNameEmailHint': 'Anonymous comments are rejected when enabled.',
  'cmssettings.discussion.notifyLabel': 'Email me when anyone comments',
  'cmssettings.discussion.notifyHint':
    'Sends a notification to the administration email address.',
  'cmssettings.discussion.closeAfterLabel': 'Automatically close comments after N days',
  'cmssettings.discussion.closeAfterSuffix': 'days',
  'cmssettings.discussion.closeAfterHint': '0 disables automatic closing.',

  /* ---------------------------------- media ---------------------------------- */
  'cmssettings.media.title': 'Media settings',
  'cmssettings.media.description':
    'Default image sizes generated for thumbnails, cards and detail views.',
  'cmssettings.media.cardTitle': 'Image sizes',
  'cmssettings.media.cardDescription':
    'Width and height in pixels. Set to 0 to keep the original dimension.',
  'cmssettings.media.sectionTitle': 'Uploads',
  'cmssettings.media.uploadsOrganised':
    'Files are grouped into month folders, which keeps large libraries manageable.',
  'cmssettings.media.uploadsFlat': 'Files are stored flat in the uploads root.',
  'cmssettings.media.sizeWidth': '{size} width',
  'cmssettings.media.sizeHeight': '{size} height',
  'cmssettings.media.sizeThumbnail': 'Thumbnail size',
  'cmssettings.media.sizeMedium': 'Medium size',
  'cmssettings.media.sizeLarge': 'Large size',
  'cmssettings.media.organiseLabel': 'Organise uploads into month-based folders',
  'cmssettings.media.organiseHint': 'New files are stored under /2026/09/ style paths.',

  /* -------------------------------- permalinks -------------------------------- */
  'cmssettings.permalinks.title': 'Permalinks',
  'cmssettings.permalinks.description': 'Choose the URL structure used for posts and pages.',
  'cmssettings.permalinks.cardTitle': 'Permanent link structure',
  'cmssettings.permalinks.cardDescription':
    'Available tags for the custom structure: %year%, %monthnum%, %day%, %postname%, %post_id%, %category%, %author%.',
  'cmssettings.permalinks.sectionTitle': 'Good to know',
  'cmssettings.permalinks.sectionBody':
    'The preview shows a sample URL for the selected structure. Existing links keep working — permalinks are resolved from the stored slugs either way.',
  'cmssettings.permalinks.fieldLabel': 'Common settings',
  'cmssettings.permalinks.optionPlain': 'Plain — https://example.com/?p=123',
  'cmssettings.permalinks.optionDayName':
    'Day and name — https://example.com/2026/09/25/sample-post/',
  'cmssettings.permalinks.optionMonthName':
    'Month and name — https://example.com/2026/09/sample-post/',
  'cmssettings.permalinks.optionPostName': 'Post name — https://example.com/sample-post/',
  'cmssettings.permalinks.optionCustom': 'Custom structure',

  /* ---------------------------------- email ---------------------------------- */
  'cmssettings.email.title': 'Email',
  'cmssettings.email.description':
    'Outgoing mail for order notifications and tests — sent through Resend, with SMTP as a fallback.',
  'cmssettings.email.resendCardTitle': 'Resend (recommended)',
  'cmssettings.email.resendActiveDescription':
    'Active — emails go out through Resend from {from}. The SMTP settings below stay unused while RESEND_API_KEY is set.',
  'cmssettings.email.resendInactiveDescription':
    'Not active — add RESEND_API_KEY=re_… to the .env file (optionally RESEND_FROM=… for your own sender), then restart the server. Free plan: 100 emails/day, 3,000/month.',
  'cmssettings.email.statusConfigured': 'Configured — sending from {from}',
  'cmssettings.email.statusNotConfigured': 'Not configured — default sender would be {from}',
  'cmssettings.email.smtpCardTitle': 'SMTP configuration',
  'cmssettings.email.smtpDescriptionResend':
    'Resend is active, so SMTP below is only a fallback — keep it as a backup provider.',
  'cmssettings.email.smtpDescriptionConfigured':
    'SMTP is configured — use the button below to verify it end to end.',
  'cmssettings.email.smtpDescriptionEmpty':
    'SMTP is not configured yet. Fill in the host, port and credentials, save, then send a test email.',
  'cmssettings.email.sectionTitle': 'Test delivery',
  'cmssettings.email.hostLabel': 'SMTP host',
  'cmssettings.email.portLabel': 'Port',
  'cmssettings.email.portHint': '587 for TLS, 465 for SSL, 25 for unencrypted.',
  'cmssettings.email.encryptionLabel': 'Encryption',
  'cmssettings.email.encryptionNone': 'None',
  'cmssettings.email.usernameLabel': 'Username',
  'cmssettings.email.usernamePlaceholder': 'SMTP user',
  'cmssettings.email.passwordLabel': 'Password',
  'cmssettings.email.passwordPlaceholder': 'SMTP password',
  'cmssettings.email.passwordHint':
    'Stored in the settings table — use an app password when available.',
  'cmssettings.email.fromNameLabel': 'From name',
  'cmssettings.email.fromEmailLabel': 'From email address',

  /* --------------------------------- payments --------------------------------- */
  'cmssettings.payments.title': 'Payments',
  'cmssettings.payments.description':
    'Enable the gateways you accept and configure their credentials.',
  'cmssettings.payments.enabled': 'Enabled',
  'cmssettings.payments.disabled': 'Disabled',
  'cmssettings.payments.keysFooter':
    'Keys are stored server-side and never exposed to the storefront.',
  'cmssettings.payments.gatewaySettings': '{name} settings',
  'cmssettings.payments.saveGateway': 'Save {name}',
  'cmssettings.payments.stripeName': 'Stripe',
  'cmssettings.payments.stripeDescription': 'Cards, Apple Pay and Google Pay via Stripe.',
  'cmssettings.payments.stripeEnableLabel': 'Enable Stripe',
  'cmssettings.payments.stripeEnableHint': 'Shows card payment at checkout.',
  'cmssettings.payments.modeLabel': 'Mode',
  'cmssettings.payments.stripeModeTest': 'Test mode (test keys)',
  'cmssettings.payments.stripeModeLive': 'Live mode (real charges)',
  'cmssettings.payments.publishableKeyLabel': 'Publishable key',
  'cmssettings.payments.secretKeyLabel': 'Secret key',
  'cmssettings.payments.paypalName': 'PayPal',
  'cmssettings.payments.paypalDescription': 'PayPal wallet and card payments through PayPal.',
  'cmssettings.payments.paypalEnableLabel': 'Enable PayPal',
  'cmssettings.payments.paypalEnableHint': 'Shows the PayPal button at checkout.',
  'cmssettings.payments.paypalModeSandbox': 'Sandbox (buyer account)',
  'cmssettings.payments.paypalModeLive': 'Live (real payments)',
  'cmssettings.payments.clientIdLabel': 'Client ID',
  'cmssettings.payments.secretLabel': 'Secret',
  'cmssettings.payments.codName': 'Cash on delivery',
  'cmssettings.payments.codDescription': 'Collect payment when the order is delivered.',
  'cmssettings.payments.codEnableLabel': 'Enable cash on delivery',
  'cmssettings.payments.codEnableHint': 'Available for shipping zones that allow it.',
  'cmssettings.payments.instructionsLabel': 'Instructions',
  'cmssettings.payments.codInstructionsPlaceholder':
    'Pay with cash when your order is delivered.',
  'cmssettings.payments.bankName': 'Bank transfer',
  'cmssettings.payments.bankDescription':
    'Manual bank transfer with instructions for the customer.',
  'cmssettings.payments.bankEnableLabel': 'Enable bank transfer',
  'cmssettings.payments.bankEnableHint':
    'Orders stay “pending” until the payment is confirmed.',
  'cmssettings.payments.bankInstructionsPlaceholder': 'Transfer to the store account…',
  'cmssettings.payments.ibanLabel': 'Account number / IBAN',

  /* ----------------------------------- tax ----------------------------------- */
  'cmssettings.tax.title': 'Tax',
  'cmssettings.tax.description':
    'Define how prices include tax and manage the rates applied at checkout.',
  'cmssettings.tax.optionsCardTitle': 'Tax options',
  'cmssettings.tax.optionsCardDescription':
    'Global behaviour shared by the cart, checkout and invoices.',
  'cmssettings.tax.sectionTitle': 'Currently applied',
  'cmssettings.tax.pricesIncludeTax': 'Product prices include tax.',
  'cmssettings.tax.pricesExcludeTax': 'Tax is added on top of product prices.',
  'cmssettings.tax.totalsShown': 'Totals are shown',
  'cmssettings.tax.totalSingle': 'as a single total',
  'cmssettings.tax.totalItemised': 'itemised',
  'cmssettings.tax.pricesIncludeLabel': 'Prices entered tax inclusive',
  'cmssettings.tax.pricesIncludeHint':
    'Product prices already contain tax. Turn off to add tax at checkout.',
  'cmssettings.tax.showTotalsLabel': 'Display tax totals',
  'cmssettings.tax.showTotalsItemised': 'Itemised — show each tax rate as its own line',
  'cmssettings.tax.showTotalsSingle': 'Single total — one combined tax line',
  'cmssettings.tax.ratesCardTitle': 'Tax rates',
  'cmssettings.tax.ratesCardDescription':
    'Country / state / postcode specific rates. Leave country blank to apply everywhere.',
};
