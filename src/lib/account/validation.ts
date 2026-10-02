const ACCOUNT_RETURN_FALLBACK = '/home/account';
const ACCOUNT_RETURN_MAX_LENGTH = 512;
const ACCOUNT_RETURN_UNSAFE = /[\u0000-\u001f\u007f\\]/i;
const ACCOUNT_RETURN_ENCODED_SEPARATOR = /%(?:2f|5c|00|0d|0a)/i;
const INTERNAL_ORIGIN = 'https://account.invalid';

const PROFILE_PROTECTED_FIELDS = new Set([
  'id',
  'userId',
  'companyId',
  'tenantId',
  'role',
  'roleId',
  'tenantRole',
  'tenantRoleId',
  'platformRole',
  'status',
  'storeId',
  'email',
  'password',
  'passwordHash',
  'photoUrl',
  'createdAt',
  'updatedAt',
  'lastLogin',
]);

const CONTROL_OR_FORMAT_CHARACTER = /[\p{Cc}\p{Cf}]/u;
const NAME_MIN_CODE_POINTS = 2;
const NAME_MAX_CODE_POINTS = 100;
const PHONE_MAX_CODE_POINTS = 50;
const PASSWORD_MIN_CODE_POINTS = 12;
const PASSWORD_MAX_CODE_POINTS = 72;
const PASSWORD_MAX_UTF8_BYTES = 72;

export type ProfileField = 'name' | 'phone' | 'form';
export type PasswordField = 'currentPassword' | 'newPassword' | 'confirmPassword' | 'form';

export type ProfileValues = {
  name: string;
  phone: string | null;
};

export type ProfileValidationResult =
  | { ok: true; values: ProfileValues }
  | { ok: false; code: 'protected-fields' | 'name-invalid' | 'phone-invalid'; field: ProfileField; message: string };

export type PasswordValues = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

export type PasswordValidationResult =
  | { ok: true; values: PasswordValues }
  | {
      ok: false;
      code:
        | 'current-password-invalid'
        | 'new-password-weak'
        | 'new-password-invalid'
        | 'password-mismatch';
      field: PasswordField;
      message: string;
    };

export type PasswordStrength = {
  score: 0 | 1 | 2 | 3 | 4;
  label: 'Too short' | 'Weak' | 'Fair' | 'Good' | 'Strong';
};

function codePointLength(value: string) {
  return Array.from(value).length;
}

function isWellFormedUnicode(value: string) {
  for (let index = 0; index < value.length; index += 1) {
    const unit = value.charCodeAt(index);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (next < 0xdc00 || next > 0xdfff) return false;
      index += 1;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) {
      return false;
    }
  }
  return true;
}

function utf8ByteLength(value: string) {
  return new TextEncoder().encode(value).byteLength;
}

function readStringField(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === 'string' ? value : null;
}

export function hasProtectedProfileFields(formData: FormData) {
  for (const key of PROFILE_PROTECTED_FIELDS) {
    if (formData.has(key)) return true;
  }
  return false;
}

function validateName(value: string | null) {
  if (value === null || !isWellFormedUnicode(value) || CONTROL_OR_FORMAT_CHARACTER.test(value)) {
    return { ok: false as const, message: 'Enter a valid name using letters, numbers, spaces, or punctuation.' };
  }

  const normalized = value.trim().replace(/\s+/gu, ' ');
  const length = codePointLength(normalized);
  if (length < NAME_MIN_CODE_POINTS || length > NAME_MAX_CODE_POINTS) {
    return {
      ok: false as const,
      message: `Name must be between ${NAME_MIN_CODE_POINTS} and ${NAME_MAX_CODE_POINTS} characters.`,
    };
  }

  return { ok: true as const, value: normalized };
}

function validatePhone(value: string | null) {
  if (value === null) {
    return { ok: false as const, message: 'Enter a valid phone number or leave the field empty.' };
  }
  if (!isWellFormedUnicode(value) || CONTROL_OR_FORMAT_CHARACTER.test(value)) {
    return { ok: false as const, message: 'Enter a valid phone number or leave the field empty.' };
  }

  const normalized = value.normalize('NFKC').trim();
  if (normalized === '') return { ok: true as const, value: null };

  const length = codePointLength(normalized);
  const digitCount = (normalized.match(/[0-9]/gu) || []).length;
  if (
    length > PHONE_MAX_CODE_POINTS ||
    !/^\+?[0-9][0-9\s().-]*$/u.test(normalized) ||
    digitCount < 5 ||
    digitCount > 20
  ) {
    return { ok: false as const, message: 'Enter a valid international or local phone number.' };
  }

  return { ok: true as const, value: normalized };
}

export function parseProfileForm(formData: FormData): ProfileValidationResult {
  if (hasProtectedProfileFields(formData)) {
    return {
      ok: false,
      code: 'protected-fields',
      field: 'form',
      message: 'Only your name and phone number can be changed here. Protected account fields were not accepted.',
    };
  }

  const name = validateName(readStringField(formData, 'name'));
  if (!name.ok) return { ...name, code: 'name-invalid', field: 'name' };

  const phone = validatePhone(readStringField(formData, 'phone'));
  if (!phone.ok) return { ...phone, code: 'phone-invalid', field: 'phone' };

  return { ok: true, values: { name: name.value, phone: phone.value } };
}

function validateCurrentPassword(value: string | null) {
  if (
    value === null ||
    value.length === 0 ||
    codePointLength(value) > PASSWORD_MAX_CODE_POINTS ||
    utf8ByteLength(value) > PASSWORD_MAX_UTF8_BYTES ||
    !isWellFormedUnicode(value) ||
    CONTROL_OR_FORMAT_CHARACTER.test(value)
  ) {
    return {
      ok: false as const,
      message: 'Enter your current password using at most 72 characters.',
    };
  }

  return { ok: true as const, value };
}

function validateNewPassword(value: string | null): PasswordValidationResult {
  if (value === null || !isWellFormedUnicode(value) || CONTROL_OR_FORMAT_CHARACTER.test(value)) {
    return {
      ok: false,
      code: 'new-password-invalid',
      field: 'newPassword',
      message: 'Choose a valid password without control characters.',
    };
  }

  const length = codePointLength(value);
  if (
    length < PASSWORD_MIN_CODE_POINTS ||
    length > PASSWORD_MAX_CODE_POINTS ||
    utf8ByteLength(value) > PASSWORD_MAX_UTF8_BYTES
  ) {
    return {
      ok: false,
      code: 'new-password-invalid',
      field: 'newPassword',
      message: 'Use a new password between 12 and 72 characters.',
    };
  }

  const hasLowercase = /\p{Ll}/u.test(value);
  const hasUppercase = /\p{Lu}/u.test(value);
  const hasNumber = /\p{Nd}/u.test(value);
  if (!hasLowercase || !hasUppercase || !hasNumber) {
    return {
      ok: false,
      code: 'new-password-weak',
      field: 'newPassword',
      message: 'Include at least one lowercase letter, one uppercase letter, and one number.',
    };
  }

  return { ok: true, values: { currentPassword: '', newPassword: value, confirmPassword: '' } };
}

export function parsePasswordChangeForm(formData: FormData): PasswordValidationResult {
  const current = validateCurrentPassword(readStringField(formData, 'currentPassword'));
  if (!current.ok) {
    return {
      ok: false,
      code: 'current-password-invalid',
      field: 'currentPassword',
      message: current.message,
    };
  }

  const next = validateNewPassword(readStringField(formData, 'newPassword'));
  if (!next.ok) return next;

  const confirmPassword = readStringField(formData, 'confirmPassword');
  if (
    confirmPassword === null ||
    confirmPassword.length === 0 ||
    !isWellFormedUnicode(confirmPassword) ||
    CONTROL_OR_FORMAT_CHARACTER.test(confirmPassword) ||
    utf8ByteLength(confirmPassword) > PASSWORD_MAX_UTF8_BYTES
  ) {
    return {
      ok: false,
      code: 'new-password-invalid',
      field: 'confirmPassword',
      message: 'Enter the new password again.',
    };
  }

  if (confirmPassword !== next.values.newPassword) {
    return {
      ok: false,
      code: 'password-mismatch',
      field: 'confirmPassword',
      message: 'The new passwords do not match.',
    };
  }

  if (current.value === next.values.newPassword) {
    return {
      ok: false,
      code: 'new-password-weak',
      field: 'newPassword',
      message: 'Choose a new password that is different from your current password.',
    };
  }

  return {
    ok: true,
    values: {
      currentPassword: current.value,
      newPassword: next.values.newPassword,
      confirmPassword,
    },
  };
}

export function getPasswordStrength(value: string): PasswordStrength {
  const length = codePointLength(value);
  if (length < PASSWORD_MIN_CODE_POINTS) return { score: 0, label: 'Too short' };

  let score = 1;
  if (/\p{Ll}/u.test(value) && /\p{Lu}/u.test(value) && /\p{Nd}/u.test(value)) score += 1;
  if (/[^\p{L}\p{N}\s]/u.test(value)) score += 1;
  if (length >= 16 && score >= 2) score += 1;
  if (length > PASSWORD_MAX_CODE_POINTS || utf8ByteLength(value) > PASSWORD_MAX_UTF8_BYTES) {
    return { score: 1, label: 'Weak' };
  }

  const labels: PasswordStrength['label'][] = ['Too short', 'Weak', 'Fair', 'Good', 'Strong'];
  return { score: Math.min(score, 4) as PasswordStrength['score'], label: labels[Math.min(score, 4)] };
}

function isAllowedAccountReturnPath(pathname: string) {
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  return normalized === ACCOUNT_RETURN_FALLBACK || normalized.startsWith(`${ACCOUNT_RETURN_FALLBACK}/`);
}

/** Return only a root-relative path inside this account segment. */
export function getSafeAccountReturnTo(value: unknown) {
  if (typeof value !== 'string') return ACCOUNT_RETURN_FALLBACK;

  const candidate = value.trim();
  if (
    !candidate ||
    candidate.length > ACCOUNT_RETURN_MAX_LENGTH ||
    !candidate.startsWith('/') ||
    candidate.startsWith('//') ||
    ACCOUNT_RETURN_UNSAFE.test(candidate) ||
    ACCOUNT_RETURN_ENCODED_SEPARATOR.test(candidate)
  ) {
    return ACCOUNT_RETURN_FALLBACK;
  }

  try {
    const url = new URL(candidate, INTERNAL_ORIGIN);
    if (url.origin !== INTERNAL_ORIGIN || !isAllowedAccountReturnPath(url.pathname)) {
      return ACCOUNT_RETURN_FALLBACK;
    }
    return url.pathname;
  } catch {
    return ACCOUNT_RETURN_FALLBACK;
  }
}
