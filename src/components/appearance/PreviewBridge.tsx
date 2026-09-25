'use client';

import { useEffect } from 'react';
import { fontStack } from '@/lib/theme/fonts';

type ThemeMessage = {
  type: 'cms:theme';
  colors?: Record<string, unknown>;
  fonts?: { heading?: unknown; body?: unknown; baseSize?: unknown };
};

const COLOR_VARS: Record<string, string> = {
  primary: '--cms-primary',
  secondary: '--cms-secondary',
  background: '--cms-background',
  surface: '--cms-surface',
  text: '--cms-text',
  accent: '--cms-accent',
};

function isHex(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(value.trim());
}

/**
 * Rendered by `src/app/shop/layout.tsx`. In normal browsing it renders nothing;
 * when the URL carries `?preview=1` (the customizer iframe) it listens for
 * `cms:theme` messages and applies the payload to the document root — so the
 * preview updates without ever reloading the iframe.
 */
export default function PreviewBridge() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('preview') !== '1') return;

    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      const data = event.data as ThemeMessage | null;
      if (!data || data.type !== 'cms:theme') return;

      const root = document.documentElement;
      const colors = data.colors || {};
      for (const [key, cssVar] of Object.entries(COLOR_VARS)) {
        if (isHex(colors[key])) root.style.setProperty(cssVar, String(colors[key]).trim());
      }

      const fonts = data.fonts;
      const heading = typeof fonts?.heading === 'string' ? fonts.heading : '';
      if (heading) root.style.setProperty('--cms-heading-font', fontStack(heading));
      const body = typeof fonts?.body === 'string' ? fonts.body : '';
      if (body) root.style.setProperty('--cms-body-font', fontStack(body));
      const baseSize = Number(fonts?.baseSize);
      if (Number.isFinite(baseSize) && baseSize >= 12 && baseSize <= 20) {
        root.style.setProperty('--cms-base-size', `${baseSize}px`);
      }
    }

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  return null;
}
