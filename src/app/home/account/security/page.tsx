import { redirect } from 'next/navigation';

// Password change now lives inside "Account details"; keep old links working.
export default function AccountSecurityPage() {
  redirect('/home/account/profile');
}
