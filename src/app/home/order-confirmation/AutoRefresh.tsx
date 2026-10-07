'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Re-reads the order every few seconds while it waits for the shop, so the page flips to "confirmed" by itself. */
export default function AutoRefresh({ everySeconds = 15 }: { everySeconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const timer = window.setInterval(() => router.refresh(), everySeconds * 1000);
    return () => window.clearInterval(timer);
  }, [router, everySeconds]);
  return null;
}
