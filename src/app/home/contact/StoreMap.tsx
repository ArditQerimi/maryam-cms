'use client';

import { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';

type StoreMapProps = {
  /** Exact pin position, already validated as "lat,lng". */
  coordinates: string;
  address: string;
  ariaLabel: string;
  infoTitle: string;
  openExternalLabel: string;
  zoomInLabel: string;
  zoomOutLabel: string;
  className?: string;
};

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => ESCAPES[ch] ?? ch);
}

/**
 * Interactive store map: a Leaflet view (OpenStreetMap/CARTO tiles, no API
 * key) pinned on the exact saved coordinates. Clicking — or keyboard-focusing
 * and pressing Enter on — the pin opens a popup with the address and a link
 * out to Google Maps, the interaction Google's keyless embed could not
 * deliver ("Place info couldn't load" on bare coordinates).
 */
export default function StoreMap({
  coordinates,
  address,
  ariaLabel,
  infoTitle,
  openExternalLabel,
  zoomInLabel,
  zoomOutLabel,
  className,
}: StoreMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let disposed = false;
    let map: import('leaflet').Map | null = null;

    void (async () => {
      const L = await import('leaflet');
      if (disposed || !containerRef.current) return;

      const [lat, lng] = coordinates.split(',').map((part) => Number(part.trim()));
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

      const reduceMotion =
        typeof window.matchMedia === 'function'
          && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      map = L.map(container, {
        center: [lat, lng],
        zoom: 17,
        scrollWheelZoom: false,
        zoomAnimation: !reduceMotion,
        fadeAnimation: !reduceMotion,
        markerZoomAnimation: !reduceMotion,
        zoomControl: false,
      });

      // Titles live on the control, not the map options.
      L.control.zoom({ zoomInTitle: zoomInLabel, zoomOutTitle: zoomOutLabel }).addTo(map);

      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        subdomains: 'abcd',
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> '
          + 'contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      }).addTo(map);

      const pin = L.divIcon({
        className: 'store-map-pin',
        html: '',
        iconSize: [22, 31],
        iconAnchor: [11, 31],
        popupAnchor: [0, -30],
      });

      const externalUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
      const popupHtml =
        '<div class="store-map-popup">'
        + `<strong>${escapeHtml(infoTitle)}</strong>`
        + `<span>${escapeHtml(address)}</span>`
        + `<a href="${externalUrl}" target="_blank" rel="noopener noreferrer">`
        + `${escapeHtml(openExternalLabel)}</a>`
        + '</div>';

      L.marker([lat, lng], { icon: pin, title: infoTitle, alt: infoTitle, keyboard: true })
        .addTo(map)
        .bindPopup(popupHtml);
    })();

    return () => {
      disposed = true;
      map?.remove();
      map = null;
    };
  }, [coordinates, address, infoTitle, openExternalLabel, zoomInLabel, zoomOutLabel]);

  return <div ref={containerRef} className={className} role="region" aria-label={ariaLabel} />;
}
