import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getPasswordStrength,
  getSafeAccountReturnTo,
  parsePasswordChangeForm,
  parseProfileForm,
} from './validation';

function profileForm(values: Record<string, string>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(values)) formData.set(key, value);
  return formData;
}

function passwordForm(values: Record<string, string>) {
  return profileForm(values);
}

test('profile validation accepts bounded Unicode names and international phone text', () => {
  const result = parseProfileForm(profileForm({
    name: '  Аме́лия   García  ',
    phone: '+44 (20) 7946-0958',
  }));

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.values.name, 'Аме́лия García');
    assert.equal(result.values.phone, '+44 (20) 7946-0958');
  }
});

test('profile validation permits an empty phone as an explicit clear', () => {
  const result = parseProfileForm(profileForm({ name: 'Ada Lovelace', phone: '' }));
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.values.phone, null);
});

test('profile validation rejects control characters, malformed phone text, and bounded overflow', () => {
  const controlName = parseProfileForm(profileForm({ name: 'Ada\nLovelace', phone: '' }));
  assert.equal(controlName.ok, false);
  if (!controlName.ok) assert.equal(controlName.field, 'name');

  const badPhone = parseProfileForm(profileForm({ name: 'Ada Lovelace', phone: '+1-CALL-NOW' }));
  assert.equal(badPhone.ok, false);
  if (!badPhone.ok) assert.equal(badPhone.field, 'phone');

  const longName = parseProfileForm(profileForm({ name: 'A'.repeat(101), phone: '' }));
  assert.equal(longName.ok, false);
  if (!longName.ok) assert.equal(longName.code, 'name-invalid');
});

test('profile validation rejects protected identity and email fields from client form data', () => {
  for (const field of ['userId', 'companyId', 'tenantRoleId', 'status', 'storeId', 'email']) {
    const result = parseProfileForm(profileForm({
      name: 'Ada Lovelace',
      phone: '',
      [field]: field === 'email' ? 'new@example.com' : '999',
    }));
    assert.equal(result.ok, false, field);
    if (!result.ok) assert.equal(result.code, 'protected-fields');
  }
});

test('password validation requires a strong bounded new password and exact confirmation', () => {
  const valid = parsePasswordChangeForm(passwordForm({
    currentPassword: 'CurrentBook2025!',
    newPassword: 'SpectralBook2026!',
    confirmPassword: 'SpectralBook2026!',
  }));
  assert.equal(valid.ok, true);

  const weak = parsePasswordChangeForm(passwordForm({
    currentPassword: 'CurrentBook2025!',
    newPassword: 'alllowercase',
    confirmPassword: 'alllowercase',
  }));
  assert.equal(weak.ok, false);
  if (!weak.ok) assert.equal(weak.code, 'new-password-weak');

  const mismatch = parsePasswordChangeForm(passwordForm({
    currentPassword: 'CurrentBook2025!',
    newPassword: 'SpectralBook2026!',
    confirmPassword: 'SpectralBook2027!',
  }));
  assert.equal(mismatch.ok, false);
  if (!mismatch.ok) assert.equal(mismatch.code, 'password-mismatch');
});

test('password validation does not echo submitted values in errors', () => {
  const result = parsePasswordChangeForm(passwordForm({
    currentPassword: 'CurrentSecret2025!',
    newPassword: 'weak',
    confirmPassword: 'weak',
  }));
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.message.includes('CurrentSecret2025!'), false);
    assert.equal(result.message.includes('weak'), false);
  }
});

test('client strength guidance never reports a strong score for short input', () => {
  assert.deepEqual(getPasswordStrength('Aa1!'), { score: 0, label: 'Too short' });
  assert.equal(getPasswordStrength('SpectralBook2026!').score >= 3, true);
});

test('account return paths stay root-relative and inside the account segment', () => {
  assert.equal(getSafeAccountReturnTo('/shop/account/profile'), '/shop/account/profile');
  assert.equal(getSafeAccountReturnTo('/shop/account?token=client'), '/shop/account');
  assert.equal(getSafeAccountReturnTo('https://evil.example/shop/account'), '/shop/account');
  assert.equal(getSafeAccountReturnTo('//evil.example/shop/account'), '/shop/account');
  assert.equal(getSafeAccountReturnTo('/customer/orders'), '/shop/account');
  assert.equal(getSafeAccountReturnTo('/shop/account%2f..%2fcustomer'), '/shop/account');
});
