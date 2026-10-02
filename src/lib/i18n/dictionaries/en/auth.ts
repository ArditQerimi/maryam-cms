/** auth copy. Keys must stay prefixed with 'auth'. */
export const auth = {
  // Shared chrome for the sign-in / registration / recovery flows.
  'auth.crumb.home': 'Home',
  'auth.crumb.myAccount': 'My account',
  'auth.crumb.signIn': 'Sign in',
  'auth.crumb.createAccount': 'Create account',
  'auth.crumb.resetPassword': 'Reset password',
  'auth.crumb.newPassword': 'Choose a new password',
  'auth.crumb.confirmEmail': 'Confirm email',
  /** Fallback shown when the tenant has no display name. */
  'auth.store.unnamed': 'the store',

  // — Sign in page —
  'auth.login.eyebrow': 'Your {store} account',
  'auth.login.title': 'Welcome back.',
  'auth.login.intro':
    'Sign in for a clear view of your orders and customer account, without entering your credentials every time.',
  'auth.login.benefits.aria': 'Account benefits',
  'auth.login.benefit.history.title': 'Order history',
  'auth.login.benefit.history.text': 'Keep every purchase close at hand',
  'auth.login.benefit.quick.title': 'Quick access',
  'auth.login.benefit.quick.text': 'Return without re-entering your credentials',
  'auth.login.benefit.secure.title': 'One secure place',
  'auth.login.benefit.secure.text': 'Manage your storefront profile',
  'auth.login.trust':
    'Your credentials are sent securely to the store’s authentication service.',
  'auth.login.card.kicker': 'Customer sign in',
  'auth.login.card.title': 'Sign in to your account',
  'auth.login.card.copy': 'Enter the email and password associated with your customer account.',
  'auth.login.notice.passwordReset':
    'Your password has been updated — sign in with your new password.',

  // Sign-in feedback mapped from the `?error=` codes written by the auth action.
  'auth.login.error.missing-fields': 'Enter both your email address and password to continue.',
  'auth.login.error.invalid-email': 'Enter a valid email address.',
  'auth.login.error.password-too-short': 'Your password must contain at least 8 characters.',
  'auth.login.error.invalid-credentials':
    'We could not sign you in. Check your email and password, then try again.',
  'auth.login.error.account-suspended':
    'This store account is suspended. Please contact the store for help.',
  'auth.login.error.tenant-domain-required':
    'This account belongs to a store. Sign in through that store’s website.',
  'auth.login.error.wrong-audience':
    'This is a staff account and cannot be used on the shop. Sign in through the admin panel instead.',
  'auth.login.error.company-not-found':
    'We could not find a store for this account. Check the address or contact support.',
  'auth.login.error.tenant-not-found':
    'The store for this account could not be found. Please try again later.',
  'auth.login.error.database-error':
    'We could not reach your store right now. Please try again shortly.',
  'auth.login.error.server-error': 'Something went wrong while signing in. Please try again.',
  'auth.login.error.fallback':
    'We could not sign you in. Check your details and try again.',

  // — Sign-in form —
  'auth.login.form.aria': 'Customer sign in',
  'auth.login.form.emailLabel': 'Email address',
  'auth.login.form.passwordLabel': 'Password',
  'auth.login.form.passwordPlaceholder': 'Enter your password',
  'auth.login.form.passwordHint': 'Passwords must contain at least 8 characters.',
  'auth.login.form.showPassword': 'Show password',
  'auth.login.form.hidePassword': 'Hide password',
  'auth.login.form.forgot': 'Forgot your password?',
  'auth.login.form.submit': 'Sign in',
  'auth.login.form.submitPending': 'Signing in…',
  'auth.login.form.submitStatus': 'Signing in',
  'auth.login.form.separator': 'New to {brand}?',
  'auth.login.form.createAccount': 'Create an account',
  'auth.login.form.legal.prefix': 'By signing in, you agree to our',
  'auth.login.form.legal.terms': 'Terms of Service',
  'auth.login.form.legal.and': 'and',
  'auth.login.form.legal.privacy': 'Privacy Policy',

  // — Create account page —
  'auth.register.eyebrow.join': 'Join {store}',
  'auth.register.title': 'A faster way to shop.',
  'auth.register.intro':
    'Create your customer account for secure access to order history and your account whenever you return to the store.',
  'auth.register.benefits.aria': 'Shopping account benefits',
  'auth.register.benefit.quick.title': 'Quick access',
  'auth.register.benefit.quick.text': 'Return to your account in a few steps',
  'auth.register.benefit.history.title': 'Purchase history',
  'auth.register.benefit.history.text': 'Review previous orders in one place',
  'auth.register.benefit.account.title': 'One customer account',
  'auth.register.benefit.account.text': 'Use the same credentials for future visits',
  'auth.register.assurance':
    'Your account is created against this store only. Passwords are hashed before they are stored.',
  'auth.register.card.kicker': 'Customer registration',
  'auth.register.card.title': 'Create your account',
  'auth.register.card.copy': 'All fields marked with an asterisk are required.',
  'auth.register.success.eyebrow': 'Account created',
  'auth.register.success.title': "You're all set.",
  'auth.register.success.copy':
    "Your customer account has been created and you are now signed in. Check your inbox — we've emailed you a link to confirm your email address.",
  'auth.register.success.viewOrders': 'View your orders',
  'auth.register.success.continue': 'Continue shopping',
  'auth.register.success.note': 'Your session is secured with an HTTP-only cookie.',

  // Registration feedback mapped from the error codes returned by the action.
  'auth.register.error.missing-first-name': 'Enter your first name.',
  'auth.register.error.missing-email': 'Enter your email address.',
  'auth.register.error.missing-password': 'Choose a password.',
  'auth.register.error.missing-confirm-password': 'Enter your password again.',
  'auth.register.error.name-too-short': 'Names must contain at least 2 characters.',
  'auth.register.error.invalid-email': 'Enter a valid email address.',
  'auth.register.error.password-too-short': 'Use a password with at least 8 characters.',
  'auth.register.error.password-mismatch': 'The passwords do not match.',
  'auth.register.error.terms-required':
    'Agree to the Terms of Service and Privacy Policy to continue.',
  'auth.register.error.email-taken':
    'An account already exists for this email. Try signing in instead.',
  'auth.register.error.account-suspended':
    'This store is suspended, so new accounts cannot be created.',
  'auth.register.error.registration-unavailable':
    'We could not create your account right now. Please try again shortly.',
  'auth.register.error.session-unavailable':
    'Your account was created, but we could not sign you in automatically. Use the sign-in link below.',
  'auth.register.error.fallback':
    'We could not create your account. Check your details and try again.',

  // — Registration form —
  'auth.register.form.aria': 'Create customer account',
  'auth.register.form.firstName': 'First name',
  'auth.register.form.lastName': 'Last name',
  'auth.register.form.optional': '(optional)',
  'auth.register.form.email': 'Email address',
  'auth.register.form.password': 'Password',
  'auth.register.form.confirmPassword': 'Confirm password',
  'auth.register.form.passwordPlaceholder': 'Create a password',
  'auth.register.form.confirmPlaceholder': 'Enter it again',
  'auth.register.form.passwordHint': 'Use at least 8 characters.',
  'auth.register.form.showPassword': 'Show password',
  'auth.register.form.hidePassword': 'Hide password',
  'auth.register.form.showConfirm': 'Show confirm password',
  'auth.register.form.hideConfirm': 'Hide confirm password',
  'auth.register.form.terms': 'I agree to the account terms and privacy notice.',
  'auth.register.form.policy.prefix': 'Read our',
  'auth.register.form.policy.terms': 'Terms of Service',
  'auth.register.form.policy.and': 'and',
  'auth.register.form.policy.privacy': 'Privacy Policy',
  'auth.register.form.submit': 'Create account',
  'auth.register.form.submitPending': 'Creating account…',
  'auth.register.form.submitStatus': 'Creating your account',
  'auth.register.form.separator': 'Already have an account?',
  'auth.register.form.signInInstead': 'Sign in instead',

  // — Forgot password —
  'auth.forgot.success.eyebrow': 'Email sent',
  'auth.forgot.success.title': 'Check your inbox.',
  'auth.forgot.success.copy':
    'If an account exists for that address, a password reset link is on its way. The link expires in 1 hour and can be used once.',
  'auth.forgot.success.back': 'Back to sign in',
  'auth.forgot.kicker': 'Account recovery',
  'auth.forgot.title': 'Reset your password',
  'auth.forgot.copy':
    'Enter the email address of your {store} account and we\'ll send you a link to choose a new password.',
  'auth.forgot.emailLabel': 'Email address',
  'auth.forgot.submit': 'Email me a reset link',
  'auth.forgot.footnote.prefix': 'Remembered it after all?',
  'auth.forgot.footnote.link': 'Back to sign in',

  // — Reset password —
  'auth.reset.error.weak': 'The new password must be at least 8 characters long.',
  'auth.reset.error.mismatch':
    'The two passwords do not match. Type the same password in both fields.',
  'auth.reset.error.invalid':
    'This reset link is no longer valid or has expired. Request a fresh one below.',
  'auth.reset.error.failed':
    'Something went wrong while saving the new password. Please try again.',
  'auth.reset.kicker': 'Account recovery',
  'auth.reset.title': 'Choose a new password',
  'auth.reset.copy.token':
    'Pick a new password for your {store} account. The link you used works only once.',
  'auth.reset.copy.noToken': 'This link could not be verified.',
  'auth.reset.passwordLabel': 'New password',
  'auth.reset.passwordPlaceholder': 'At least 8 characters',
  'auth.reset.passwordHint': 'Use at least 8 characters.',
  'auth.reset.confirmLabel': 'Confirm new password',
  'auth.reset.confirmPlaceholder': 'Repeat the new password',
  'auth.reset.submit': 'Save new password',
  'auth.reset.invalidLink': 'This reset link is missing or malformed. Request a fresh one below.',
  'auth.reset.footnote.prefix': 'Need a new link?',
  'auth.reset.footnote.link': 'Request a reset link',

  // — Confirm email —
  'auth.verify.error.invalid':
    'This confirmation link is no longer valid or has already been used.',
  'auth.verify.error.failed':
    'Something went wrong while confirming your email. Please try again.',
  'auth.verify.verified.eyebrow': 'Email confirmed',
  'auth.verify.verified.title': "You're all set.",
  'auth.verify.verified.copy':
    'Your email address is confirmed, so order updates and account notices from {store} will reach this inbox.',
  'auth.verify.verified.action': 'Go to my account',
  'auth.verify.sent.eyebrow': 'Email sent',
  'auth.verify.sent.title': 'Check your inbox.',
  'auth.verify.sent.copy':
    'If this address belongs to an unconfirmed account, a fresh confirmation link is on its way. It expires in 24 hours.',
  'auth.verify.sent.action': 'Back to sign in',
  'auth.verify.kicker': 'Confirm your email',
  'auth.verify.title': 'Confirm your email address',
  'auth.verify.copy.token':
    'One tap confirms that this address is really yours and completes your {store} account setup.',
  'auth.verify.copy.noToken':
    'This confirmation link is missing, expired, or already used — request a fresh one below.',
  'auth.verify.confirm': 'Confirm my email',
  'auth.verify.resendSeparator': "Didn't receive the email?",
  'auth.verify.emailLabel': 'Email address',
  'auth.verify.resend': 'Send a new confirmation link',
  'auth.verify.footnote.prefix': 'Changed your mind?',
  'auth.verify.footnote.link': 'Back to sign in',
};
