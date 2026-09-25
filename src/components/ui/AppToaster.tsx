'use client';

import { Toaster } from 'sonner';

export default function AppToaster() {
  return (
    <Toaster
      position="top-right"
      richColors
      closeButton
      duration={3200}
      toastOptions={{
        style: {
          fontSize: '14px',
        },
      }}
    />
  );
}
