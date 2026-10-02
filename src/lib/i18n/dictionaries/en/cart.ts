/** cart copy. Keys must stay prefixed with 'cart'. */
export const cart = {
  // — Page header —
  'cart.header.title': 'Shopping cart',
  'cart.header.crumb': 'Cart',
  'cart.header.eyebrow': 'Your selection',
  'cart.header.lead': 'Review quantities and variants before continuing to checkout.',
  'cart.header.count.aria': '{count} items in cart',
  'cart.header.count.one': '{count} item',
  'cart.header.count.other': '{count} items',
  'cart.contents.aria': 'Shopping cart contents',

  // — Sync / storage status line —
  'cart.status.storage.local': 'Saved in this browser',
  'cart.status.storage.memory': 'Available for this tab only',
  'cart.status.storage.unavailable': 'Browser storage unavailable',
  'cart.status.storage.default': 'Local cart',
  'cart.status.syncing': 'Syncing cart with the server…',
  'cart.status.syncedAccount': 'Synced to your account cart',
  'cart.status.syncedServer': 'Synced to the server cart',
  'cart.status.draftError': 'Local draft — sync needs attention',
  'cart.status.draftWaiting': 'Local draft — waiting to sync',
  'cart.status.localOnly': 'Local-only cart',
  'cart.status.authoritative': ' · server quantities and prices are authoritative',
  'cart.status.localTruth': ' · this browser is the source of truth until sync succeeds',
  'cart.status.busySyncing': 'Syncing…',
  'cart.status.busySaving': 'Saving…',

  // — Loading / error / empty —
  'cart.loading.title': 'Loading your cart…',
  'cart.loading.text': 'Checking local and server cart state.',
  'cart.error.title': 'We could not complete that cart change',
  'cart.error.retry': 'Try again',
  'cart.empty.title': 'Your cart is empty',
  'cart.empty.text':
    'Save a book or product here and it will stay available while you keep shopping.',
  'cart.empty.action': 'Continue shopping',

  // — Line items table —
  'cart.table.caption': 'Items currently in your cart',
  'cart.table.product': 'Product',
  'cart.table.price': 'Price',
  'cart.table.quantity': 'Quantity',
  'cart.table.subtotal': 'Subtotal',
  'cart.item.variant': 'Variant {id}',
  'cart.item.unavailable': 'Currently unavailable',
  'cart.item.remove': 'Remove',
  'cart.item.removeAria': 'Remove {name} from cart',
  'cart.quantity.decrease': 'Decrease quantity for {name}',
  'cart.quantity.input': 'Quantity for {name}',
  'cart.quantity.increase': 'Increase quantity for {name}',

  // — Coupon —
  'cart.coupon.label': 'Coupon code',
  'cart.coupon.placeholder': 'Enter code',
  'cart.coupon.checking': 'Checking…',
  'cart.coupon.apply': 'Apply',
  'cart.coupon.remove': 'Remove coupon',
  'cart.coupon.removed': 'Coupon removed. Your cart is unchanged.',
  'cart.coupon.empty': 'Enter a coupon code.',
  'cart.coupon.unavailable': 'Coupons are temporarily unavailable. Try again.',
  'cart.coupon.restored': '{label} restored from your last visit.',
  'cart.coupon.applied': '{label} applied — you save {amount}.',
  'cart.clear': 'Clear cart',

  // — Summary —
  'cart.summary.title': 'Order summary',
  'cart.summary.subtotal': 'Subtotal',
  'cart.summary.coupon': 'Coupon',
  'cart.summary.shipping': 'Shipping',
  'cart.summary.shippingNote': 'Calculated at checkout',
  'cart.summary.total': 'Total',
  'cart.summary.checkout': 'Proceed to checkout',
  'cart.summary.finePrint.synced':
    'Taxes and shipping are confirmed at checkout. Server cart totals are authoritative.',
  'cart.summary.finePrint.local':
    'Taxes and shipping are confirmed at checkout. Local changes remain recoverable if sync fails.',
  'cart.storage_read_error':
    'Your saved cart could not be read in this browser. It is safe to try again, but changes will stay in memory for now.',
  'cart.storage_write_error':
    'Your cart changed, but this browser could not save it locally. It will remain available for this tab only.',
  'cart.error_invalid_item':
    'That cart item is not valid. Quantity must be a whole number between 1 and 99.',
  'cart.error_max_quantity': 'The maximum quantity for one cart line is 99.',
  'cart.storage_invalid_data':
    'The cart changed in another tab and contained invalid saved data. The valid local rows were loaded.',
};
