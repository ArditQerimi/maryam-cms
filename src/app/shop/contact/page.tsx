'use client';

import { useState } from 'react';
import Link from 'next/link';
import styles from '../bookstore.module.css';

const faqs = [
  {
    q: 'Ku mund të shohër titujt dhe çmimet aktuale?',
    a: 'Hap katalogun për filtrat e disponueshëm, ose hap një produkt për sku, variant, stock dhe çmim të verifikuar nga serveri.',
  },
  {
    q: 'Ku mund të shohër politikat e dorëzimit dhe kthimit?',
    a: 'Kontrollo politikat e publikuara të Shipping, Refund dhe Terms & Conditions. Ato duhet të përputhen me termat aktualë të tregtarit para publikimit.',
  },
  {
    q: 'Si mund të krijoj një llogari?',
    a: 'Përdord butonin Register në krye të faqes. Pas regjistrimit mund të shqyrtesh llogarinë dhe porositë e tua.',
  },
  {
    q: 'Si kontactoj tregtarin?',
    a: 'Kontaktet reale të tregtarit duhet të konfigurohen nga administratori. Faqja nuk paraqet numra, email-e ose adresa të panjohura si të verifikuara.',
  },
];

export default function ShopContactPage() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className={styles.contactPage}>
      <div className={styles.container}>
        <nav className={styles.contactBreadcrumb} aria-label="breadcrumbs">
          <Link href="/shop">Home</Link>
          <span>/</span>
          <span>Na Kontaktoni</span>
        </nav>
        <h1 className={styles.contactPageHeader}>Na Kontaktoni</h1>
      </div>

      <section className={styles.contactMain}>
        <div className={styles.container}>
          <div className={styles.contactGrid}>
            <div className={styles.contactInfo}>
              <p className={styles.contactInfoTitle}>Informacionet e kontaktit</p>

              <div className={styles.contactInfoItem}>
                <div className={styles.contactInfoBody}>
                  <h3>Email</h3>
                  <p>[Emaili i verifikuar i tregtarit]</p>
                </div>
              </div>
              <div className={styles.contactInfoItem}>
                <div className={styles.contactInfoBody}>
                  <h3>Telefon</h3>
                  <p>[Numri i verifikuar i tregtarit]</p>
                </div>
              </div>
              <div className={styles.contactInfoItem}>
                <div className={styles.contactInfoBody}>
                  <h3>Adresa</h3>
                  <p>[Adresa e verifikuar e tregtarit]</p>
                </div>
              </div>

              <p className={styles.contactInfoText}>
                Administratori duhet të plotësojë këto të dhëna me informacionin e
                vet të biznesit para se faqja të publikohet si kanal kontakti.
              </p>
            </div>

            <div className={styles.contactFormPanel}>
              <p className={styles.contactFormTitle}>Formulari i kontaktit</p>
              <p className={styles.contactFormText}>
                Dërgimi është i paaktivizuar derisa tregtari të konfigurojë një
                ofrues email-i ose një endpoint të verifikuar.
              </p>
              <form className={styles.contactForm} aria-describedby="contact-form-unavailable">
                <fieldset disabled>
                  <div className={styles.contactFormRow}>
                    <div className={styles.contactFormGroup}>
                      <label htmlFor="name">Emri juaj</label>
                      <input id="name" type="text" placeholder="Emri juaj" required />
                    </div>
                    <div className={styles.contactFormGroup}>
                      <label htmlFor="email">Email juaj</label>
                      <input id="email" type="email" placeholder="email@shembull.com" required />
                    </div>
                  </div>
                  <div className={styles.contactFormGroup}>
                    <label htmlFor="subject">Titulli</label>
                    <input id="subject" type="text" placeholder="Çfarë dëshironi të ndjekë?" />
                  </div>
                  <div className={styles.contactFormGroup}>
                    <label htmlFor="message">Mesazhi juaj</label>
                    <textarea id="message" placeholder="Shkruani mesazhin tuaj" />
                  </div>
                  <button type="submit" className={styles.contactSubmitBtn} disabled>
                    Dërgimi është i paaktivizuar
                  </button>
                </fieldset>
              </form>
              <p id="contact-form-unavailable" className={styles.contactFormText} role="note">
                Ky nuk është një submit funksional dhe nuk ruajtë apo dërgon mesazhe.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.contactFaq}>
        <div className={styles.container}>
          <h2 className={styles.contactFaqTitle}>Pyetje të shpeshta</h2>
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
                  {faq.q}
                </button>
                {open === index ? <p className={styles.contactFaqAnswer}>{faq.a}</p> : null}
              </div>
            ))}
          </div>

          <div className={styles.contactFormRow}>
            <Link href="/shop/shipping-policy">Shipping Policy</Link>
            <Link href="/shop/refund-policy">Refund Policy</Link>
            <Link href="/shop/terms-conditions">Terms &amp; Conditions</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
