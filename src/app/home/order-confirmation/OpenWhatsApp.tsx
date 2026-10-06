'use client';

import { useEffect, useState } from 'react';
import styles from './order-confirmation.module.css';

/**
 * Takes a customer who has JUST placed an order straight to WhatsApp (once per
 * order — reloading the confirmation page does not bounce them again). The
 * visible button stays as the fallback if the browser blocks the redirect.
 */
export default function OpenWhatsApp({
  href,
  orderNumber,
  placedAt,
}: {
  href: string;
  orderNumber: string;
  /** Order creation time (ms). Only a just-placed order opens WhatsApp by itself. */
  placedAt: number;
}) {
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    if (Date.now() - placedAt > 3 * 60 * 1000) return;
    const key = `whatsapp-opened:${orderNumber}`;
    try {
      if (window.sessionStorage.getItem(key)) return;
      window.sessionStorage.setItem(key, '1');
    } catch {
      // No storage (private mode): the button still works.
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpening(true);
    const timer = window.setTimeout(() => window.location.assign(href), 1400);
    return () => window.clearTimeout(timer);
  }, [placedAt, href, orderNumber]);

  return (
    <div className={styles.whatsappOrder}>
      <a className={styles.whatsappBtn} href={href} target="_blank" rel="noopener noreferrer">
        Dërgo porosinë në WhatsApp
      </a>
      <p className={styles.whatsappNote}>
        {opening
          ? 'Po hapet WhatsApp me porosinë tënde…'
          : 'Porosia është ruajtur. Dërgo mesazhin në WhatsApp që ta konfirmojmë.'}
      </p>
    </div>
  );
}
