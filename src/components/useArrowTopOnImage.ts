'use client';

import { useEffect, type RefObject } from 'react';

/**
 * Cards in a carousel are taller than their pictures (title, price, button…),
 * so arrows centred on the whole carousel land on the text. This puts them on
 * the vertical middle of the first picture instead, by setting
 * `--carousel-arrow-top` on the carousel wrapper (the track's parent).
 * With no picture in the slides the arrows stay centred (CSS fallback 50%).
 */
export function useArrowTopOnImage(trackRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const track = trackRef.current;
    const wrapper = track?.parentElement;
    if (!track || !wrapper) return;

    const place = () => {
      const image = track.querySelector('img');
      if (!image) {
        wrapper.style.removeProperty('--carousel-arrow-top');
        return;
      }
      const imageBox = image.getBoundingClientRect();
      const wrapperBox = wrapper.getBoundingClientRect();
      if (imageBox.height < 40) return;
      wrapper.style.setProperty(
        '--carousel-arrow-top',
        `${imageBox.top - wrapperBox.top + imageBox.height / 2}px`,
      );
    };

    place();
    const observer = new ResizeObserver(place);
    observer.observe(track);
    const image = track.querySelector('img');
    if (image) observer.observe(image);
    image?.addEventListener('load', place);
    window.addEventListener('resize', place);
    return () => {
      observer.disconnect();
      image?.removeEventListener('load', place);
      window.removeEventListener('resize', place);
    };
  }, [trackRef]);
}
