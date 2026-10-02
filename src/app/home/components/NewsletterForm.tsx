'use client';

import { useState } from 'react';
import { useLocale } from '@/lib/i18n/LocaleProvider';

/**
 * Newsletter capture used by the `newsletter` widget. There is no
 * newsletter/subscribe endpoint anywhere in `src/app/api/**`, so this form
 * never posts anywhere — it acknowledges the address locally and explains
 * that the list is not open yet (instead of inventing an endpoint).
 */
export default function NewsletterForm({ inputId }: { inputId: string }) {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const { t } = useLocale();

  return (
    <form
      className="shop-widget-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (email.trim()) setSubmitted(true);
      }}
    >
      <label className="shop-widget-field" htmlFor={inputId}>
        <span className="shop-widget-label">{t('home.widget.newsletter.label')}</span>
        <input
          id={inputId}
          type="email"
          name="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          required
        />
      </label>
      <button type="submit" className="button is-outline shop-widget-button">
        {t('home.widget.newsletter.submit')}
      </button>
      <p className="shop-widget-note" role="status">
        {submitted
          ? t('home.widget.newsletter.thanks')
          : t('home.widget.newsletter.pending')}
      </p>
    </form>
  );
}
