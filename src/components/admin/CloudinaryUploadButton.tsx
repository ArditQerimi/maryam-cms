'use client';

import { useEffect, useRef, useState } from 'react';
import { CldUploadWidget } from 'next-cloudinary';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { getProductUploadConfig, recordProductUpload, signProductUpload } from '@/app/cms/actions/media';
import { Button } from '@/components/admin/ui';
import { useLocale } from '@/lib/i18n/LocaleProvider';

type UploadConfig = { cloudName: string; apiKey: string; folder: string };
type UploadInfo = { public_id?: string; secure_url?: string };

// One request per product, shared by all the buttons on the page (cover, gallery tiles).
const configs = new Map<string, ReturnType<typeof getProductUploadConfig>>();
function loadConfig(productId: number | null) {
  const key = String(productId ?? 'new');
  if (!configs.has(key)) configs.set(key, getProductUploadConfig(productId));
  return configs.get(key)!;
}

/**
 * Opens Cloudinary's own upload modal (computer, camera, link) for a product's photos. `crop`
 * (single photo) shows Cloudinary's cropping step. Files go to the product's folder; every upload is
 * signed by the server (signProductUpload) and added to the CMS media library.
 */
export default function CloudinaryUploadButton({
  productId,
  multiple = false,
  crop = false,
  onUploaded,
  children,
  variant = 'outline',
  size = 'sm',
  className,
  title,
}: {
  productId: number | null;
  multiple?: boolean;
  crop?: boolean;
  /** Called once per uploaded photo, in upload order. */
  onUploaded: (url: string) => void;
  children: React.ReactNode;
  variant?: 'outline' | 'ghost' | 'secondary' | 'primary';
  size?: 'sm' | 'md';
  className?: string;
  title?: string;
}) {
  const { t } = useLocale();
  const [config, setConfig] = useState<UploadConfig | null>(null);
  const [error, setError] = useState('');
  // The widget keeps the first callbacks it gets; the ref always points at the latest onUploaded.
  const onUploadedRef = useRef(onUploaded);
  useEffect(() => {
    onUploadedRef.current = onUploaded;
  }, [onUploaded]);

  useEffect(() => {
    let alive = true;
    void loadConfig(productId).then((result) => {
      if (!alive) return;
      if (result.ok) setConfig({ cloudName: result.cloudName, apiKey: result.apiKey, folder: result.folder });
      else setError(result.error);
    });
    return () => {
      alive = false;
    };
  }, [productId]);

  if (!config) {
    return (
      <Button type="button" variant={variant} size={size} className={className} disabled title={error || undefined}>
        {error ? children : <Loader2 size={14} className="animate-spin" />}
      </Button>
    );
  }

  return (
    <CldUploadWidget
      config={{ cloud: { cloudName: config.cloudName, apiKey: config.apiKey } }}
      options={{
        folder: config.folder,
        sources: ['local', 'camera', 'url'],
        multiple,
        maxFiles: multiple ? 12 : 1,
        cropping: crop && !multiple,
        showSkipCropButton: true,
        croppingShowDimensions: true,
        clientAllowedFormats: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
        maxFileSize: 8 * 1024 * 1024,
        showPoweredBy: false,
        uploadSignature: (callback: (signature: string) => void, paramsToSign: Record<string, unknown>) => {
          void signProductUpload(paramsToSign).then((result) => {
            if (result.ok) callback(result.signature);
            else toast.error(t('cmsshared.product_editor.upload_denied'));
          });
        },
      }}
      onSuccess={(result) => {
        const info = (typeof result.info === 'object' ? result.info : {}) as UploadInfo;
        void recordProductUpload(productId, info).then((saved) => {
          if (saved.ok && saved.url) onUploadedRef.current(saved.url);
          else toast.error(t('cmsshared.product_editor.upload_rejected'));
        });
      }}
      onError={() => toast.error(t('cmsshared.product_editor.upload_failed'))}
    >
      {({ open }) => (
        <Button type="button" variant={variant} size={size} className={className} title={title} onClick={() => open()}>
          {children}
        </Button>
      )}
    </CldUploadWidget>
  );
}
