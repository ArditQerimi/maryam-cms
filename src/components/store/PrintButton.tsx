'use client';

import { Printer } from 'lucide-react';
import { Button } from '@/components/admin/ui';
import { useLocale } from '@/lib/i18n/LocaleProvider';

/** Prints the current page (used on the order detail view). */
export default function PrintButton({ label }: { label?: string }) {
  const { t } = useLocale();
  return (
    <Button type="button" variant="outline" size="md" onClick={() => window.print()}>
      <Printer size={14} /> {label ?? t('cmsshared.print_button.label')}
    </Button>
  );
}
