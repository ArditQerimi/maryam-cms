/** account copy. Keys must stay prefixed with 'account'. */
export const account = {
  // Layout (account area shell)
  'account.layout.crumbStore': 'Store',
  'account.layout.crumbAccount': 'Account',
  'account.layout.eyebrow': 'Private customer area',
  'account.layout.title': 'My account',
  'account.layout.subtitle': 'Account details and services for {storeName}.',
  'account.layout.contentAria': 'Account page content',
  'account.layout.storeFallback': 'the store',

  // Sidebar navigation
  'account.nav.overview': 'Overview',
  'account.nav.orders': 'Orders',
  'account.nav.wishlist': 'Wishlist',
  'account.nav.profile': 'Account details',
  'account.nav.security': 'Security',
  'account.nav.addresses': 'Addresses',
  'account.nav.identityLabel': 'Customer account',
  'account.nav.aria': 'Customer account',
  'account.nav.signingOut': 'Signing out…',
  'account.nav.signOut': 'Sign out',
  'account.nav.returnToStore': 'Return to store',
  'account.nav.signOutAria': 'Sign out of customer account',

  // Loading / error / not-found boundaries
  'account.loading.sr': 'Loading your customer account',
  'account.notFound.eyebrow': 'Access unavailable',
  'account.notFound.title': 'This customer account page is not available.',
  'account.notFound.body':
    'The request did not match an active customer session for this exact store, or the page does not exist.',
  'account.notFound.return': 'Return to store',
  'account.error.eyebrow': 'Account unavailable',
  'account.error.title': 'We could not load this account page.',
  'account.error.body':
    'No account details were changed. Check the page again, or return to the store if the problem continues.',
  'account.error.retry': 'Try again',

  // Overview
  'account.overview.eyebrow': 'Account overview',
  'account.overview.greeting': 'Good to see you, {name}.',
  'account.overview.intro':
    'Review your details or continue to the store services already connected to your customer session.',
  'account.details.eyebrow': 'Your details',
  'account.details.title': 'Customer profile',
  'account.details.edit': 'Edit profile',
  'account.details.name': 'Name',
  'account.details.email': 'Sign-in email',
  'account.details.phone': 'Phone',
  'account.details.memberSince': 'Member since',
  'account.details.notProvided': 'Not provided',
  'account.details.unavailable': 'Unavailable',
  'account.details.note':
    'The current sign-in flow does not record verified-email state, so this address is not labelled as verified.',
  'account.services.eyebrow': 'Account services',
  'account.services.title': 'Where would you like to go?',
  'account.services.orders.title': 'Orders',
  'account.services.orders.body': 'Open the existing order-history screen for this store.',
  'account.services.orders.action': 'View order account',
  'account.services.wishlist.title': 'Wishlist',
  'account.services.wishlist.body': 'Return to products saved by the current wishlist experience.',
  'account.services.wishlist.action': 'Open wishlist',
  'account.services.profile.title': 'Profile',
  'account.services.profile.body':
    'Update the name and phone number attached to this customer account.',
  'account.services.profile.action': 'Edit profile',
  'account.services.security.title': 'Security',
  'account.services.security.body': 'Change your password with current-password verification.',
  'account.services.security.action': 'Open security',
  'account.services.addresses.title': 'Addresses',
  'account.services.addresses.body':
    'Address persistence is not connected yet, so no saved address is shown.',
  'account.services.addresses.action': 'See availability',
  'account.services.store.title': 'Store',
  'account.services.store.body':
    'Continue browsing the catalog without leaving your account area.',
  'account.services.store.action': 'Return to store',
  'account.banner.aria': 'Account security reminder',
  'account.banner.title': 'Keep sign-in details private',
  'account.banner.body':
    'Use the sign-out control in account navigation when you finish on a shared device.',

  // Orders
  'account.orders.eyebrow': 'Purchase history',
  'account.orders.title': 'Orders',
  'account.orders.lead': 'Orders placed on this storefront with your customer account.',
  'account.orders.emptyTitle': 'No orders yet',
  'account.orders.emptyBody':
    'When you place an order it appears here immediately, together with its items, total, delivery method, and payment method.',
  'account.orders.emptyAction': 'Start shopping',
  'account.orders.reference': 'Order reference',
  'account.orders.placed': 'Placed',
  'account.orders.total': 'Order total',
  'account.orders.delivery': 'Delivery',
  'account.orders.payment': 'Payment',
  'account.orders.confirmationEmail': 'Confirmation email',
  'account.orders.itemsSubtotal': 'Items subtotal',
  'account.orders.note':
    'Only online orders linked to your customer account are shown. Point-of-sale purchases and other customers\' orders are never included.',

  // Addresses
  'account.addresses.eyebrow': 'Address book',
  'account.addresses.title': 'Addresses',
  'account.addresses.lead': 'A clear view of what is\u2014and is not\u2014available for this account.',
  'account.addresses.notConnected': 'Not connected yet',
  'account.addresses.emptyTitle': 'No saved address data is available',
  'account.addresses.emptyBody':
    'The tenant user record does not provide an address source, and this increment does not add address persistence. No example or checkout address is displayed as if it belonged to you.',
  'account.addresses.return': 'Return to store',
  'account.addresses.note':
    'Checkout remains separate. Enabling saved addresses requires a company-bound address data model and authenticated address DAL before this page can offer create, edit, select, or delete actions.',

  // Profile
  'account.profile.eyebrow': 'Personal information',
  'account.profile.title': 'Your profile',
  'account.profile.lead': 'Keep the contact details associated with this store account current.',
  'account.profile.readOnly': 'Read-only account data',
  'account.profile.detailsTitle': 'Profile details',
  'account.profile.signInEmail': 'Sign-in email',
  'account.profile.memberSince': 'Member since',
  'account.profile.unavailable': 'Unavailable',
  'account.profile.note':
    'This sign-in flow has no verified-email token or verified-email field. The address is shown as your sign-in email and cannot be changed here.',
  'account.profileForm.kicker': 'Personal details',
  'account.profileForm.title': 'Edit your profile',
  'account.profileForm.intro':
    'Changes apply only to your customer record for this store.',
  'account.profileForm.nameLabel': 'Full name',
  'account.profileForm.nameHint': 'Up to 100 characters. International names are supported.',
  'account.profileForm.phoneLabel': 'Phone number',
  'account.profileForm.phoneHint':
    'Optional. Use digits and standard +, -, (), or space characters.',
  'account.profileForm.footer': 'Email and account permissions are not editable from this form.',
  'account.profileForm.saving': 'Saving…',
  'account.profileForm.save': 'Save changes',
  'account.profileForm.saveStatus': 'Saving your profile',

  // Security page
  'account.security.eyebrow': 'Account protection',
  'account.security.title': 'Security',
  'account.security.lead':
    'Change your password and review the identity attached to this session.',
  'account.security.identityAria': 'Signed-in customer',
  'account.security.identityLabel': 'Signed-in customer',
  'account.security.activeSession': 'Active session',
  'account.security.bannerAria': 'Session rotation behavior',
  'account.security.bannerTitle': 'Current-session rotation',
  'account.security.bannerBody':
    'A successful password change replaces the signed session cookie in this browser. The existing stateless session system cannot retroactively revoke a token already copied elsewhere.',
  'account.securityForm.updating': 'Updating…',
  'account.securityForm.submit': 'Change password',
  'account.securityForm.currentPassword': 'Current password',
  'account.securityForm.newPassword': 'New password',
  'account.securityForm.confirmPassword': 'Confirm new password',
  'account.securityForm.currentHint': 'Enter the password currently used to sign in.',
  'account.securityForm.newHint': 'Use 12\u201372 characters with uppercase, lowercase, and a number.',
  'account.securityForm.confirmHint': 'Enter the new password a second time.',
  'account.securityForm.showCurrent': 'Show current password',
  'account.securityForm.hideCurrent': 'Hide current password',
  'account.securityForm.showNew': 'Show new password',
  'account.securityForm.hideNew': 'Hide new password',
  'account.securityForm.showConfirm': 'Show confirm new password',
  'account.securityForm.hideConfirm': 'Hide confirm new password',
  'account.securityForm.strengthLabel': 'Password strength',
  'account.securityForm.kicker': 'Password',
  'account.securityForm.title': 'Choose a new password',
  'account.securityForm.intro': 'Your current password is required before any change is made.',
  'account.securityForm.serverNote':
    'Passwords are checked on the server and are never written to logs or returned by the form.',
  'account.securityForm.footer':
    'After success, the session in this browser is replaced with a newly signed session.',
  'account.securityForm.changeStatus': 'Changing your password',

  // Account wishlist preview
  'account.wishlist.eyebrow': 'Saved for later',
  'account.wishlist.title': 'Wishlist',
  'account.wishlist.leadOne': '{count} saved product on your account.',
  'account.wishlist.leadOther': '{count} saved products on your account.',
  'account.wishlist.leadEmpty': 'Products you save are stored with your customer account.',
  'account.wishlist.emptyTitle': 'Nothing saved yet',
  'account.wishlist.emptyBody':
    'Tap the heart on any product to save it here for later. Saved products stay with your account on every device you sign in from.',
  'account.wishlist.browse': 'Browse products',
  'account.wishlist.summaryAria': 'Saved products',
  'account.wishlist.openFull': 'Open full wishlist',
  'account.wishlist.note':
    'Wishlist changes made while signed in are saved to your customer profile on the server, so they follow you across devices.',

  // Password strength meter (SecurityForm)
  'account.strength.too_short': 'Too short',
  'account.strength.weak': 'Weak',
  'account.strength.fair': 'Fair',
  'account.strength.good': 'Good',
  'account.strength.strong': 'Strong',

  // My-account layout (sidebar + pages)
  'account.nav.dashboard': 'Dashboard',
  'account.nav.downloads': 'Downloads',
  'account.nav.compare': 'Compare',
  'account.nav.logOut': 'Log out',

  // Dashboard
  'account.dashboard.hello': 'Hello',
  'account.dashboard.notPrefix': 'not',
  'account.dashboard.copy1': 'From your account dashboard you can view your',
  'account.dashboard.link1': 'recent orders',
  'account.dashboard.copy2': 'manage your',
  'account.dashboard.link2': 'shipping and billing addresses',
  'account.dashboard.copy3': 'and',
  'account.dashboard.link3': 'edit your password and account details',

  // Orders table
  'account.orders.colOrder': 'Order',
  'account.orders.colDate': 'Date',
  'account.orders.colStatus': 'Status',
  'account.orders.colTotal': 'Total',
  'account.orders.colActions': 'Actions',
  'account.orders.view': 'View',
  'account.orders.totalForItem': '{total} for {count} item',
  'account.orders.totalForItems': '{total} for {count} items',
  'account.orders.emptyNotice': 'No order has been made yet.',
  'account.orders.browse': 'Browse products',

  // Single order
  'account.order.prefix': 'Order',
  'account.order.placedOn': 'was placed on',
  'account.order.andIs': 'and is currently',
  'account.order.details': 'Order details',
  'account.order.product': 'Product',
  'account.order.total': 'Total',
  'account.order.subtotal': 'Subtotal:',
  'account.order.shipping': 'Shipping:',
  'account.order.payment': 'Payment method:',
  'account.order.grandTotal': 'Total:',
  'account.order.billing': 'Billing address',
  'account.order.shippingAddress': 'Shipping address',

  // Downloads
  'account.downloads.empty': 'No downloads available yet.',

  // Addresses
  'account.addresses.billing': 'Billing address',
  'account.addresses.shipping': 'Shipping address',
  'account.addresses.none': 'You have not set up this type of address yet.',
  'account.addresses.intro': 'The following addresses will be used on the checkout page by default.',
  'account.addresses.save': 'Save address',
  'account.addresses.editBilling': 'Edit Billing address',
  'account.addresses.editShipping': 'Edit Shipping address',

  // Account details form
  'account.form.firstName': 'First name',
  'account.form.lastName': 'Last name',
  'account.form.displayName': 'Display name',
  'account.form.displayNameHint':
    'This will be how your name will be displayed in the account section and in reviews',
  'account.form.email': 'Email address',
  'account.form.phone': 'Phone',
  'account.form.passwordChange': 'Password change',
  'account.form.currentPassword': 'Current password (leave blank to leave unchanged)',
  'account.form.newPassword': 'New password (leave blank to leave unchanged)',
  'account.form.confirmPassword': 'Confirm new password',
  'account.form.showPassword': 'Show password',
  'account.form.hidePassword': 'Hide password',
  'account.form.save': 'Save changes',
  'account.form.saving': 'Saving…',

  // Compare / wishlist inside the account
  'account.compare.empty': 'No product is added to the comparison table.',
  'account.compare.product': 'Product',
  'account.compare.price': 'Price',
  'account.compare.remove': 'Remove',
  'account.compare.open': 'Open full comparison',
  'account.wishlist.empty': 'There are no products on the Wishlist!',
};
