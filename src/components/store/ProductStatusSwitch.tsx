'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { setProductActive } from '@/app/cms/actions/products';
import { useLocale } from '@/lib/i18n/LocaleProvider';

/**
 * On = shown in the shop (Active), off = hidden (Inactive). Other statuses (Pending, Archived…) show
 * as off with their name; switching one on makes it Active.
 */
export default function ProductStatusSwitch({ productId, name, status }: { productId: number; name: string; status: string }) {
  const { t } = useLocale();
  const router = useRouter();
  const [active, setActive] = useState(status === 'Active');
  const [pending, startTransition] = useTransition();
  const label = active ? t('cmscatalog.status.active') : status === 'Active' || status === 'Inactive' ? t('cmscatalog.status.inactive') : status;

  function toggle() {
    const next = !active;
    setActive(next);
    startTransition(async () => {
      const result = await setProductActive(productId, next);
      if (!result.ok) {
        setActive(!next);
        toast.error(result.error || t('cmscatalog.toast.status_error'));
        return;
      }
      toast.success(next ? t('cmscatalog.toast.activated') : t('cmscatalog.toast.deactivated'));
      router.refresh();
    });
  }

  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium" title={active ? t('cmscatalog.status.hint_hide') : t('cmscatalog.status.hint_show')}>
      <button
        type="button"
        role="switch"
        aria-checked={active}
        aria-label={t('cmscatalog.status.switch_aria', { name })}
        disabled={pending}
        onClick={toggle}
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6d6be8] disabled:opacity-60 ${
          active ? 'bg-emerald-500' : 'bg-zinc-300'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 rounded-full bg-white shadow transition ${active ? 'translate-x-[18px]' : 'translate-x-0.5'}`}
        />
      </button>
      <span className={active ? 'text-emerald-700' : 'text-zinc-500'}>{label}</span>
    </label>
  );
}
