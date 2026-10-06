'use client';

import { useEffect } from 'react';

/**
 * Makes the first section of the home page end exactly at the bottom of the
 * first screen. Measures where that section really starts (below the sticky
 * header, any margins…) instead of guessing the header height in CSS, and
 * exposes the result as `--first-screen-h` on the wrapper.
 */
export default function FirstScreenFit({ targetId }: { targetId: string }) {
  useEffect(() => {
    const wrapper = document.getElementById(targetId);
    const first = wrapper?.firstElementChild as HTMLElement | null;
    if (!wrapper || !first) return;

    const fit = () => {
      const top = first.getBoundingClientRect().top + window.scrollY;
      const height = Math.max(320, window.innerHeight - top);
      wrapper.style.setProperty('--first-screen-h', `${height}px`);
    };

    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [targetId]);

  return null;
}
