'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Mail, MapPin, Phone } from 'lucide-react';
import styles from '../bookstore.module.css';
import ShopPageHeader from '../components/ShopPageHeader';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import StoreMap from './StoreMap';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Dictionary keys (not literal copy) so sq and en stay in sync — `t()` below
// resolves them against the active locale.
const faqs = [
  { q: 'contact.faq.1.q', a: 'contact.faq.1.a' },
  { q: 'contact.faq.2.q', a: 'contact.faq.2.a' },
  { q: 'contact.faq.3.q', a: 'contact.faq.3.a' },
  { q: 'contact.faq.4.q', a: 'contact.faq.4.a' },
] as const;

type MerchantContact = {
  email: string | null;
  phone: string | null;
  address: string | null;
  /** Exact pin position from settings; falls back to the address text. */
  mapCoordinates?: string | null;
};

type SubmitStatus = 'idle' | 'sending' | 'success' | 'error';

export default function ContactClient({ merchant }: { merchant: MerchantContact }) {
  const { t } = useLocale();
  const [open, setOpen] = useState<number | null>(0);
  const [status, setStatus] = useState<SubmitStatus>('idle');
  const [errorText, setErrorText] = useState('');
  const statusRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (status === 'error' || status === 'success') {
      statusRef.current?.focus();
    }
  }, [status]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === 'sending') return;

    const form = event.currentTarget;
    const data = new FormData(form);
    const name = String(data.get('name') ?? '').trim();
    const email = String(data.get('email') ?? '').trim();
    const subject = String(data.get('subject') ?? '').trim();
    const message = String(data.get('message') ?? '').trim();

    const clientError =
      name.length < 2
        ? t('contact.error.name')
        : !EMAIL_PATTERN.test(email)
          ? t('contact.error.email')
          : subject.length < 2
            ? t('contact.error.subject')
            : message.length < 5
              ? t('contact.error.message')
              : null;
    if (clientError) {
      setStatus('error');
      setErrorText(clientError);
      return;
    }

    setStatus('sending');
    setErrorText('');
    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ name, email, subject, message }),
      });
      const payload: unknown = await response.json().catch(() => null);
      const record = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : null;
      if (response.ok && record?.ok === true) {
        form.reset();
        setStatus('success');
        return;
      }
      setStatus('error');
      setErrorText(
        typeof record?.error === 'string' && record.error
          ? record.error
          : t('contact.error.submit'),
      );
    } catch {
      setStatus('error');
      setErrorText(t('contact.error.network'));
    }
  }

  return (
    <div className={styles.contactPage}>
      {/* Same banner component as /home/products and /home/blogs. */}
      <ShopPageHeader title={t('contact.title')} crumbs={[{ label: t('contact.title') }]} />

      <section className={styles.contactMain}>
        <div className={styles.container}>
          <div className={styles.contactGrid}>
            <div className={styles.contactInfo}>
              <p className={styles.contactInfoTitle}>{t('contact.info.title')}</p>

              <div className={styles.contactInfoItem}>
                <MapPin className={styles.contactInfoPin} size={26} fill="currentColor" aria-hidden="true" />
                <div className={styles.contactInfoBody}>
                  <h3>{t('contact.info.address')}</h3>
                  <p>{merchant.address ?? t('contact.info.address.placeholder')}</p>
                </div>
              </div>
              <div className={styles.contactInfoItem}>
                <Phone size={26} fill="currentColor" aria-hidden="true" />
                <div className={styles.contactInfoBody}>
                  <h3>{t('contact.info.phone')}</h3>
                  <p>{merchant.phone ?? t('contact.info.phone.placeholder')}</p>
                </div>
              </div>
              <div className={styles.contactInfoItem}>
                <Mail size={26} aria-hidden="true" />
                <div className={styles.contactInfoBody}>
                  <h3>{t('contact.info.email')}</h3>
                  <p>{merchant.email ?? t('contact.info.email.placeholder')}</p>
                </div>
              </div>

              <p className={styles.contactInfoText}>
                {merchant.email || merchant.phone || merchant.address
                  ? t('contact.info.configured')
                  : t('contact.info.todo')}
              </p>
            </div>

            <div className={styles.contactFormPanel}>
              <p className={styles.contactFormTitle}>{t('contact.form.title')}</p>
              <p className={styles.contactFormText}>{t('contact.form.lead')}</p>

              {status === 'success' ? (
                <div
                  className={styles.contactFormText}
                  role="status"
                  aria-live="polite"
                  ref={statusRef}
                  tabIndex={-1}
                >
                  <p>
                    <strong>{t('contact.form.thanks.title')}</strong>{' '}
                    {t('contact.form.thanks.body')}
                  </p>
                  <button
                    type="button"
                    className={styles.contactSubmitBtn}
                    onClick={() => setStatus('idle')}
                  >
                    {t('contact.form.again')}
                  </button>
                </div>
              ) : (
                <form
                  className={styles.contactForm}
                  onSubmit={handleSubmit}
                  noValidate
                  aria-busy={status === 'sending'}
                >
                  <div className={styles.contactFormRow}>
                    <div className={styles.contactFormGroup}>
                      <label htmlFor="contact-name">{t('contact.form.name')}</label>
                      <input
                        id="contact-name"
                        name="name"
                        type="text"
                        placeholder={t('contact.form.name.placeholder')}
                        required
                        minLength={2}
                        maxLength={160}
                        autoComplete="name"
                      />
                    </div>
                    <div className={styles.contactFormGroup}>
                      <label htmlFor="contact-email">{t('contact.form.email')}</label>
                      <input
                        id="contact-email"
                        name="email"
                        type="email"
                        placeholder={t('contact.form.email.placeholder')}
                        required
                        maxLength={254}
                        autoComplete="email"
                      />
                    </div>
                  </div>
                  <div className={styles.contactFormGroup}>
                    <label htmlFor="contact-subject">{t('contact.form.subject')}</label>
                    <input
                      id="contact-subject"
                      name="subject"
                      type="text"
                      placeholder={t('contact.form.subject.placeholder')}
                      required
                      minLength={2}
                      maxLength={200}
                    />
                  </div>
                  <div className={styles.contactFormGroup}>
                    <label htmlFor="contact-message">{t('contact.form.message')}</label>
                    <textarea
                      id="contact-message"
                      name="message"
                      placeholder={t('contact.form.message.placeholder')}
                      required
                      minLength={5}
                      maxLength={5000}
                      rows={6}
                    />
                  </div>

                  {status === 'error' ? (
                    <div
                      className={styles.contactFormText}
                      role="alert"
                      ref={statusRef}
                      tabIndex={-1}
                    >
                      {errorText}
                    </div>
                  ) : null}

                  <button
                    type="submit"
                    className={styles.contactSubmitBtn}
                    disabled={status === 'sending'}
                  >
                    {status === 'sending' ? t('contact.form.sending') : t('contact.form.submit')}
                  </button>
                </form>
              )}

              <p id="contact-form-note" className={styles.contactFormText} role="note">
                {t('contact.form.note')}
              </p>
            </div>
          </div>
        </div>
      </section>

      {merchant.address ? (
        <section className={styles.contactMapSection} aria-label={t('contact.map.aria')}>
          <div className={styles.container}>
            {merchant.mapCoordinates ? (
              // Exact pin + click-to-open info popup (see StoreMap). Google's
              // keyless embed could not deliver the place card on bare
              // coordinates ("Place info couldn't load").
              <StoreMap
                className={styles.contactMap}
                coordinates={merchant.mapCoordinates}
                address={merchant.address}
                ariaLabel={t('contact.map.aria')}
                infoTitle={t('contact.map.info')}
                openExternalLabel={t('contact.map.openExternal')}
                zoomInLabel={t('contact.map.zoomIn')}
                zoomOutLabel={t('contact.map.zoomOut')}
              />
            ) : (
              // Address could not be placed on the map (e.g. offline): link out to
              // OpenStreetMap instead of embedding a keyed/third-party map.
              <a
                className={styles.contactMapFallback}
                href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(merchant.address)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t('contact.map.openExternal')}
              </a>
            )}
            <p className={styles.contactMapCaption}>
              <MapPin size={16} aria-hidden="true" />
              {merchant.address}
            </p>
          </div>
        </section>
      ) : null}

      <section className={styles.contactFaq}>
        <div className={styles.container}>
          <h2 className={styles.contactFaqTitle}>{t('contact.faq.title')}</h2>
          <div className={styles.contactFaqList}>
            {faqs.map((faq, index) => (
              <div key={faq.q} className={styles.contactFaqItem}>
                <button
                  type="button"
                  className={styles.contactFaqBtn}
                  data-open={open === index ? 'true' : 'false'}
                  onClick={() => setOpen(open === index ? null : index)}
                  aria-expanded={open === index}
                >
                  <span className={styles.contactFaqIcon}>{open === index ? '−' : '+'}</span>
                  {t(faq.q)}
                </button>
                {open === index ? <p className={styles.contactFaqAnswer}>{t(faq.a)}</p> : null}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
