'use client';

import { useState } from 'react';

/**
 * Newsletter capture used by the `newsletter` widget. There is no
 * newsletter/subscribe endpoint anywhere in `src/app/api/**`, so this form
 * never posts anywhere — it acknowledges the address locally and explains
 * that the list is not open yet (instead of inventing an endpoint).
 */
export default function NewsletterForm({ inputId }: { inputId: string }) {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  return (
    <form
      className="shop-widget-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (email.trim()) setSubmitted(true);
      }}
    >
      <label className="shop-widget-field" htmlFor={inputId}>
        <span className="shop-widget-label">Email address</span>
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
        Subscribe
      </button>
      <p className="shop-widget-note" role="status">
        {submitted
          ? 'Thank you! Our newsletter list opens soon — watch this space.'
          : 'Newsletter signup is coming soon — leave your address and check back with us.'}
      </p>
    </form>
  );
}
