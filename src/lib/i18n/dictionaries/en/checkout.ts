/** checkout copy. Keys must stay prefixed with 'checkout'. */
export const checkout = {
  // — Breadcrumb / page header —
  'checkout.crumb.home': 'Home',
  'checkout.crumb.cart': 'Cart',
  'checkout.crumb.checkout': 'Checkout',
  'checkout.header.eyebrow': 'Storefront checkout',
  'checkout.header.title': 'Checkout',
  'checkout.header.subtitle': 'Complete the details in one secure, reviewable flow.',
  'checkout.header.badge': 'Final price confirmed by server',

  // — Steps / loading / empty —
  'checkout.steps.aria': 'Checkout progress',
  'checkout.steps.contact.title': 'Contact',
  'checkout.steps.contact.text': 'Email details',
  'checkout.steps.delivery.title': 'Delivery',
  'checkout.steps.delivery.text': 'Address & method',
  'checkout.steps.payment.title': 'Payment',
  'checkout.steps.payment.text': 'Review & place',
  'checkout.loading.title': 'Loading your checkout…',
  'checkout.loading.text': 'Reading the canonical cart saved in this browser.',
  'checkout.empty.eyebrow': 'Nothing to check out',
  'checkout.empty.title': 'Your cart is empty',
  'checkout.empty.copy':
    'Add a product before starting checkout. Your current cart has not been changed.',
  'checkout.empty.browse': 'Browse products',
  'checkout.empty.viewCart': 'View cart',

  // — Success state —
  'checkout.success.eyebrow': 'Server confirmed',
  'checkout.success.title': 'Order placed',
  'checkout.success.leadPrefix': 'A confirmation was recorded for order ',
  'checkout.success.leadSuffix': '.',
  'checkout.success.email': 'Confirmation email',
  'checkout.success.reference': 'Order reference',
  'checkout.success.viewOrder': 'View order',
  'checkout.success.history': 'Order history',

  // — Totals continuation under the summary —
  'checkout.totals.shipping': 'Shipping',
  'checkout.totals.orderTotal': 'Order total',
  'checkout.totals.estimate':
    'Subtotal after discounts, minus any promotion, plus shipping and tax. The server verifies the final amount, stock, and availability before the order is created.',

  // — Delivery / payment options —
  'checkout.delivery.standard.label': 'Standard delivery',
  'checkout.delivery.standard.detail': 'Availability is confirmed by the store server',
  'checkout.delivery.fallbackLabel': 'Delivery',
  'checkout.delivery.loading': 'Loading…',
  'checkout.delivery.serverQuote': 'Server quote',
  'checkout.payment.check.label': 'Check payments',
  'checkout.payment.cashOnDelivery.label': 'Cash on delivery',
  'checkout.payment.cashOnDelivery.detail': 'Pay when the order is delivered',
  'checkout.shippingType.flat_rate': 'Flat Rate',
  'checkout.shippingType.free_shipping': 'Free Shipping',
  'checkout.shippingType.local_pickup': 'Local Pickup',

  // — Client-side validation (never sent over the wire) —
  'checkout.validation.firstName': 'Enter a first name.',
  'checkout.validation.lastName': 'Enter a last name.',
  'checkout.validation.address1': 'Enter a street address.',
  'checkout.validation.country': 'Select a country or region.',
  'checkout.validation.city': 'Enter a city.',
  'checkout.validation.region': 'Enter a state or province.',
  'checkout.validation.postalCode': 'Enter a postal code.',
  'checkout.validation.emailRequired': 'Enter an email address.',
  'checkout.validation.emailFormat': 'Enter an email address in the format name@example.com.',
  'checkout.validation.delivery': 'Choose a delivery method.',
  'checkout.validation.payment': 'Choose a payment method.',
  'checkout.validation.terms': 'Accept the terms before placing your order.',

  // — Failures raised locally before the request leaves the browser —
  'checkout.failure.validation': 'Check the highlighted fields before placing your order.',
  'checkout.failure.unavailable':
    'Order placement is unavailable until secure server checkout is connected. No order or payment was created.',
  'checkout.failure.cartNotSynced':
    'This local cart must be synchronized with a variant-aware server cart before it can be checked out. No order was created.',
  'checkout.failure.noRandom':
    'This browser could not create a secure checkout request key. No order was created.',
  'checkout.failure.requestFailed':
    'We could not reach secure checkout. No order was created. Check your connection and try again.',
  'checkout.failure.title': 'Checkout could not continue',
  'checkout.failure.noOrder': 'No order or payment was created.',

  // — Cart warning / form chrome —
  'checkout.cartWarning.title': 'Your local cart needs attention',
  'checkout.form.title': 'Checkout details',
  'checkout.form.legend': 'Contact, delivery, payment, and terms',
  'checkout.preview.noticeTitle': 'Checkout preview — order placement is disabled',
  'checkout.preview.noticeCopy':
    'Secure checkout is not connected yet. No payment will be taken and no order will be created from this page.',
  'checkout.pending': 'Contacting secure checkout. Do not close this page…',
  'checkout.errors.one': 'Check this field',
  'checkout.errors.many': 'Check these {count} fields',

  // — Mobile summary —
  'checkout.mobile.summaryLabel': 'Order summary',
  'checkout.mobile.view': 'View',
  'checkout.itemCount.one': '{count} item',
  'checkout.itemCount.other': '{count} items',

  // — Contact step —
  'checkout.contact.step': 'Contact',
  'checkout.contact.heading': 'Where should we send your receipt?',
  'checkout.login.promptTitle': 'Already have an account?',
  'checkout.login.promptCopy': 'Sign in to keep your checkout details with you.',
  'checkout.login.link': 'Log in',
  'checkout.contact.email': 'Email address',
  'checkout.notes.label': 'Order notes',
  'checkout.notes.placeholder': 'Notes about your order, e.g. special notes for delivery.',
  'checkout.contact.phone': 'Phone number',
  'checkout.contact.phoneHint': 'For delivery questions',
  'checkout.contact.marketing':
    'Email me about news and offers. Optional; you can unsubscribe anytime.',

  // — Delivery step —
  'checkout.delivery.step': 'Delivery',
  'checkout.delivery.heading': 'Where is your order going?',
  'checkout.delivery.addressTitle': 'Shipping address',
  'checkout.delivery.billingSame': 'Use this address for billing',
  'checkout.delivery.methodTitle': 'Delivery method',
  'checkout.delivery.methodCopy':
    'Shipping methods are loaded for your address from the store’s shipping zones.',
  'checkout.delivery.choose': 'Choose a delivery method',
  'checkout.billing.title': 'Billing address',
  'checkout.billing.sameCopy': 'Currently matching your shipping address.',
  'checkout.billing.diffCopy': 'Enter a separate address for billing.',
  'checkout.billing.cardTitle': 'Billing details',
  'checkout.billing.different': 'Bill to a different address?',

  // - "Your order" card (table + coupon + totals) -
  'checkout.order.heading': 'Your order',
  'checkout.order.product': 'Product',
  'checkout.order.subtotal': 'Subtotal',
  'checkout.order.total': 'Total',
  'checkout.coupon.prompt': 'Have a coupon?',
  'checkout.coupon.enter': 'Click here to enter your code',
  'checkout.coupon.codeLabel': 'Coupon code',
  'checkout.coupon.apply': 'Apply coupon',
  'checkout.coupon.remove': 'Remove coupon',

  // — Payment step —
  'checkout.payment.step': 'Payment',
  'checkout.payment.heading': 'Choose how to pay',
  'checkout.payment.choose': 'Choose a payment method',
  'checkout.payment.badge': 'Server confirmed',
  'checkout.payment.safety':
    'Card payment is not enabled. This checkout never collects card numbers; a future payment method must use secure provider-hosted fields.',
  'checkout.terms.prefix': 'I agree to the',
  'checkout.terms.terms': 'Terms of Service',
  'checkout.terms.and': 'and acknowledge the',
  'checkout.terms.privacy': 'Privacy Policy',
  'checkout.terms.agree': 'I have read and agree to the website terms and conditions',
  'checkout.payment.privacy':
    'Your personal data will be used to process your order, support your experience throughout this website, and for other purposes described in our',
  'checkout.payment.privacyLink': 'privacy policy.',
  'checkout.submit.pending': 'Placing order…',
  'checkout.submit.retry': 'Try place order again',
  'checkout.submit.place': 'Place order',
  'checkout.submit.help': 'The server must confirm the complete total before an order is created.',
  'checkout.submit.helpDisabled':
    'Disabled until POST /api/storefront/checkout is securely implemented.',
  'checkout.summary.aria': 'Order summary',

  // — Order summary card —
  'checkout.summary.eyebrow': 'Current cart',
  'checkout.summary.heading': 'Order summary',
  'checkout.summary.itemCount.one': '{count} item',
  'checkout.summary.itemCount.other': '{count} items',
  'checkout.summary.itemsAria': 'Items in your current cart',
  'checkout.summary.variant': 'Variant {id}',
  'checkout.summary.defaultVariant': 'Default variant',
  'checkout.summary.subtotal': 'Cart subtotal',
  'checkout.summary.promotion': 'Promotion',
  'checkout.summary.notApplied': 'Not applied',
  'checkout.summary.delivery': 'Delivery',
  'checkout.summary.estimate':
    'These browser totals are display-only. The server must verify stock, variants, promotions, delivery, tax, and the final amount.',
  'checkout.summary.editCart': 'Edit cart',

  // — Address fields —
  'checkout.address.firstName': 'First name',
  'checkout.address.lastName': 'Last name',
  'checkout.address.company': 'Company',
  'checkout.address.address1': 'Street address',
  'checkout.address.address1Placeholder': 'House number and street name',
  'checkout.address.address2': 'Apartment, suite, unit, etc.',
  'checkout.address.country': 'Country / region',
  'checkout.address.city': 'Town / city',
  'checkout.address.region': 'State / province',
  'checkout.address.postalCode': 'ZIP / postal code',
  'checkout.address.optional': 'Optional',
  'checkout.address.selectCountry': 'Select a country',
  'checkout.country.AL': 'Albania',
  'checkout.country.AT': 'Austria',
  'checkout.country.BE': 'Belgium',
  'checkout.country.FR': 'France',
  'checkout.country.DE': 'Germany',
  'checkout.country.IT': 'Italy',
  'checkout.country.XK': 'Kosovo',
  'checkout.country.MK': 'North Macedonia',
  'checkout.country.NL': 'Netherlands',
  'checkout.country.ES': 'Spain',
  'checkout.country.GB': 'United Kingdom',
  'checkout.country.US': 'United States',

  // — Order confirmation page —
  'checkout.confirmation.unavailableEyebrow': 'Order confirmation',
  'checkout.confirmation.unavailableTitle': 'Confirmation unavailable',
  'checkout.confirmation.unavailableCopy':
    'This confirmation is unavailable, expired, or belongs to a different session. No order details can be shown without the original authenticated purchaser or guest order capability.',
  'checkout.confirmation.returnToCheckout': 'Return to checkout',
  'checkout.confirmation.guestNotice':
    'This private confirmation is available only while the host-only confirmation capability remains valid on this device.',
  'checkout.confirmation.historyLink': 'View order history',
  'checkout.confirmation.receivedEyebrow': 'Order received',
  'checkout.confirmation.title': 'Thank you for your order',
  'checkout.confirmation.lead':
    'A confirmed order is recorded. Keep the order reference for merchant support.',
  'checkout.confirmation.ref': 'Order reference',
  'checkout.confirmation.email': 'Confirmation email',
  'checkout.confirmation.placed': 'Placed',
  'checkout.confirmation.status': 'Status',
  'checkout.confirmation.total': 'Order total',
  'checkout.confirmation.currency': 'Currency',
  'checkout.confirmation.delivery': 'Delivery method',
  'checkout.confirmation.payment': 'Payment method',
  'checkout.confirmation.continue': 'Continue shopping',
};
