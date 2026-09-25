'use client';

import { Printer } from 'lucide-react';
import { Button } from '@/components/admin/ui';

/** Prints the current page (used on the order detail view). */
export default function PrintButton({ label = 'Print' }: { label?: string }) {
  return (
    <Button type="button" variant="outline" size="md" onClick={() => window.print()}>
      <Printer size={14} /> {label}
    </Button>
  );
}
