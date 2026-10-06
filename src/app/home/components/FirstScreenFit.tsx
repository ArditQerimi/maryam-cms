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

    // Phones fire 'resize' when the address bar slides in/out while scrolling;
    // only refit when the width changes so the page does not jump.
    let width = window.innerWidth;
    const onResize = () => {
      if (window.innerWidth === width) return;
      width = window.innerWidth;
      fit();
    };

    fit();
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', fit);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', fit);
    };
  }, [targetId]);

  return null;
}
