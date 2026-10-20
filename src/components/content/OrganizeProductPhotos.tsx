'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FolderSync, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { organizeProductPhotos, type OrganizeReport } from '@/app/cms/actions/media';
import { Button } from '@/components/admin/ui';
import { useLocale } from '@/lib/i18n/LocaleProvider';

/**
 * Moves product photos into <root>/cms/products/<product id>/ in Cloudinary (and fixes their links).
 * "Check" only counts; "Move" works in batches until nothing is left.
 */
export default function OrganizeProductPhotos() {
  const { t } = useLocale();
  const router = useRouter();
  const [busy, setBusy] = useState<'check' | 'move' | null>(null);
  const [report, setReport] = useState<OrganizeReport | null>(null);
  const [progress, setProgress] = useState({ moved: 0, failed: 0 });
  const [errors, setErrors] = useState<string[]>([]);

  async function check() {
    setBusy('check');
    try {
      const result = await organizeProductPhotos(true);
      if (!result.ok) toast.error(result.error || t('cmscontent.organize.error'));
      setReport(result);
      setProgress({ moved: 0, failed: 0 });
      setErrors([]);
    } finally {
      setBusy(null);
    }
  }

  async function move() {
    if (!report || !window.confirm(t('cmscontent.organize.confirm', { count: report.pending, root: report.root }))) return;
    setBusy('move');
    let moved = 0;
    let failed = 0;
    const seen: string[] = [];
    try {
      // Batches until everything is moved, or a batch moves nothing (only failures left).
      for (let round = 0; round < 50; round += 1) {
        const result = await organizeProductPhotos(false);
        if (!result.ok) {
          toast.error(result.error || t('cmscontent.organize.error'));
          break;
        }
        moved += result.moved;
        failed = result.failed;
        seen.push(...result.errors);
        setProgress({ moved, failed });
        setReport(result);
        if (result.pending === 0 || result.moved === 0) break;
      }
      setErrors(seen.slice(0, 5));
      if (failed === 0) toast.success(t('cmscontent.organize.done', { count: moved }));
      else toast.error(t('cmscontent.organize.partial', { moved, failed }));
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mb-6 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
            <FolderSync size={16} /> {t('cmscontent.organize.title')}
          </h2>
          <p className="mt-1 text-sm text-zinc-600">{t('cmscontent.organize.description')}</p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={check} disabled={busy !== null}>
            {busy === 'check' ? <Loader2 size={14} className="animate-spin" /> : null}
            {t('cmscontent.organize.check')}
          </Button>
          {report && report.ok && report.pending > 0 ? (
            <Button type="button" size="sm" onClick={move} disabled={busy !== null}>
              {busy === 'move' ? <Loader2 size={14} className="animate-spin" /> : null}
              {t('cmscontent.organize.move', { count: report.pending })}
            </Button>
          ) : null}
        </div>
      </div>

      {report && report.ok ? (
        <div className="mt-3 space-y-2 rounded-lg bg-zinc-50 p-3 text-sm text-zinc-700">
          <p>
            {t('cmscontent.organize.target')} <code className="text-xs">{report.root}/cms/products/&lt;ID&gt;/</code>
          </p>
          {busy === 'move' || progress.moved > 0 || progress.failed > 0 ? (
            <p>{t('cmscontent.organize.progress', { moved: progress.moved, failed: progress.failed, pending: report.pending })}</p>
          ) : (
            <p>{report.pending === 0 ? t('cmscontent.organize.nothing') : t('cmscontent.organize.found', { count: report.pending })}</p>
          )}
          {report.samples.length > 0 && progress.moved === 0 ? (
            <ul className="space-y-1 text-xs text-zinc-500">
              {report.samples.map((sample) => (
                <li key={sample.from} className="break-all">
                  <span className="font-medium text-zinc-700">{sample.product}</span>: {sample.from} → {sample.to}
                </li>
              ))}
            </ul>
          ) : null}
          {errors.length > 0 ? (
            <ul className="space-y-1 text-xs text-red-700">
              {errors.map((error) => (
                <li key={error} className="break-all">{error}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
