'use client';

import { useMemo, useState } from 'react';
import Cropper, { type Area, type MediaSize } from 'react-easy-crop';
import { X } from 'lucide-react';
import { Button } from '@/components/admin/ui';
import { originalUrl, readCrop, withCrop } from '@/lib/cloudinary-url';
import { useLocale } from '@/lib/i18n/LocaleProvider';

type Ratio = { key: string; value: number | null };

/**
 * Crops a photo already in Cloudinary. The window shows the whole original (with the current crop
 * selected); saving returns the same photo with the crop in its URL, so the file itself is never
 * changed and it can be cropped again later.
 */
export default function ImageCropModal({
  url,
  onClose,
  onSave,
}: {
  url: string;
  onClose: () => void;
  onSave: (croppedUrl: string) => void;
}) {
  const { t } = useLocale();
  const source = useMemo(() => originalUrl(url), [url]);
  const previous = useMemo(() => readCrop(url), [url]);
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null);
  const [ratioKey, setRatioKey] = useState(previous ? 'current' : 'original');
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);

  const ratios: Ratio[] = [
    ...(previous ? [{ key: 'current', value: previous.width / previous.height }] : []),
    { key: 'original', value: natural ? natural.width / natural.height : null },
    { key: '3:4', value: 3 / 4 },
    { key: '1:1', value: 1 },
    { key: '4:3', value: 4 / 3 },
  ];
  const aspect = ratios.find((ratio) => ratio.key === ratioKey)?.value ?? (natural ? natural.width / natural.height : 3 / 4);
  const label = (key: string) => (key === 'current' ? t('cmscommon.crop.current') : key === 'original' ? t('cmscommon.crop.original') : key);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={t('cmscommon.crop.title')}>
      <button type="button" aria-label={t('cmscommon.crop.cancel')} onClick={onClose} className="absolute inset-0 bg-zinc-950/60 backdrop-blur-sm" />
      <div className="relative flex h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-5 py-3">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">{t('cmscommon.crop.title')}</h2>
            <p className="text-xs text-zinc-500">{t('cmscommon.crop.hint')}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100" aria-label={t('cmscommon.crop.cancel')}>
            <X size={16} />
          </button>
        </div>

        <div className="relative flex-1 bg-zinc-900">
          <Cropper
            key={ratioKey}
            image={source}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={(_, pixels) => setArea(pixels)}
            onMediaLoaded={(media: MediaSize) => setNatural({ width: media.naturalWidth, height: media.naturalHeight })}
            initialCroppedAreaPixels={ratioKey === 'current' && previous ? previous : undefined}
            restrictPosition
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-zinc-200 px-5 py-3">
          <div className="flex flex-wrap gap-1" role="group" aria-label={t('cmscommon.crop.ratio')}>
            {ratios.map((ratio) => (
              <button
                key={ratio.key}
                type="button"
                onClick={() => {
                  setRatioKey(ratio.key);
                  setZoom(1);
                  setCrop({ x: 0, y: 0 });
                }}
                className={`rounded-md border px-2.5 py-1 text-xs font-medium ${
                  ratioKey === ratio.key ? 'border-[#6d6be8] bg-[#6d6be8]/10 text-[#4f4dd6]' : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50'
                }`}
              >
                {label(ratio.key)}
              </button>
            ))}
          </div>
          <label className="flex min-w-40 flex-1 items-center gap-2 text-xs text-zinc-600">
            {t('cmscommon.crop.zoom')}
            <input type="range" min={1} max={4} step={0.05} value={zoom} onChange={(event) => setZoom(Number(event.target.value))} className="flex-1" />
          </label>
          <div className="ml-auto flex gap-2">
            {previous ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => onSave(source)}>
                {t('cmscommon.crop.remove')}
              </Button>
            ) : null}
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              {t('cmscommon.crop.cancel')}
            </Button>
            <Button type="button" size="sm" disabled={!area} onClick={() => area && onSave(withCrop(url, area))}>
              {t('cmscommon.crop.save')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
