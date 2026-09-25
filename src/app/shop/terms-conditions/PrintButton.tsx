'use client';

import styles from '../legal/legal.module.css';

export default function PrintButton() {
  return (
    <button className={styles.printButton} type="button" onClick={() => window.print()}>
      <svg className={styles.printIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M6 9V2h12v7" />
        <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
        <path d="M6 14h12v8H6z" />
      </svg>
      <span>Print / save PDF</span>
    </button>
  );
}
