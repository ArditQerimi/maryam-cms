'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { clearSession } from '@/lib/session';
import {
  changeCurrentCustomerPassword,
  getAccountLoginUrl,
  updateCurrentCustomerProfile,
} from './data';

export type ProfileActionState = {
  status: 'idle' | 'error' | 'success';
  message?: string;
  field?: 'name' | 'phone' | 'form';
  completion?: number;
};

export type PasswordActionState = {
  status: 'idle' | 'error' | 'success';
  message?: string;
  field?: 'currentPassword' | 'newPassword' | 'confirmPassword' | 'form';
  completion?: number;
};

export async function updateAccountProfile(
  previousState: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const result = await updateCurrentCustomerProfile(formData);

  if (!result.ok) {
    return {
      status: 'error',
      message: result.message,
      field: result.field,
    };
  }

  revalidatePath('/home/account');
  revalidatePath('/home/account/profile');

  return {
    status: 'success',
    message: result.unchanged
      ? 'Your profile is already up to date.'
      : 'Your profile has been updated.',
    completion: (previousState.completion || 0) + 1,
  };
}

export async function changeAccountPassword(
  previousState: PasswordActionState,
  formData: FormData,
): Promise<PasswordActionState> {
  const result = await changeCurrentCustomerPassword(formData);

  if (!result.ok) {
    if (result.passwordChanged) {
      await clearSession();
      redirect(getAccountLoginUrl('/home/account/security', 'password-changed'));
    }

    return {
      status: 'error',
      message: result.message,
      field: result.field,
    };
  }

  revalidatePath('/home/account/security');
  return {
    status: 'success',
    message: 'Your password has been changed and this browser has received a new session.',
    completion: (previousState.completion || 0) + 1,
  };
}

export async function logoutCustomer() {
  await clearSession();
  redirect('/home');
}
