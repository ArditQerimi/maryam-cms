'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Save } from 'lucide-react';
import { toast } from 'sonner';
import PageBuilder from '@/app/cms/builder/PageBuilder';
import { countBlocks, type Block } from '@/app/cms/builder/blocks';
import { saveBuilderBlocks } from '@/app/cms/actions/pages';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Select,
  inputClass,
} from '@/components/admin/ui';
import { useLocale } from '@/lib/i18n/LocaleProvider';

const NEW_PAGE = 'new';

export default function BuilderPlayground({
  pages,
  defaultPageId = null,
  previewTheme,
}: {
  pages: Array<{ id: number; title: string; blocks: Block[] }>;
  defaultPageId?: number | null;
  previewTheme?: Record<string, string>;
}) {
  const router = useRouter();
  const { t } = useLocale();
  const [target, setTarget] = useState<string>(
    defaultPageId ? String(defaultPageId) : NEW_PAGE,
  );
  const seed = pages.find((page) => String(page.id) === target)?.blocks ?? [];
  const [blocks, setBlocks] = useState<Block[]>(seed);
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);

  const total = countBlocks(blocks);
  const creatingNew = target === NEW_PAGE;

  async function save() {
    if (saving) return;
    setSaving(true);
    try {
      const result = await saveBuilderBlocks({
        pageId: creatingNew ? null : Number(target),
        title,
        blocks,
      });

      if (!result.ok) {
        toast.error(result.error || t('cmsshared.builder.save_error'));
        return;
      }

      toast.success(
        creatingNew ? t('cmsshared.builder.created') : t('cmsshared.builder.updated'),
      );
      router.push(`/cms/pages/${result.id}/edit`);
    } catch (error) {
      console.error('[cms/builder] save failed', error);
      toast.error(t('cmsshared.builder.save_failed'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex items-center justify-between gap-3">
        <CardTitle>{t('cmsshared.builder.title')}</CardTitle>
        <Badge tone="brand">
          {total === 1
            ? t('cmsshared.builder.count_one', { count: total })
            : t('cmsshared.builder.count_many', { count: total })}
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-zinc-200 bg-zinc-50/70 px-4 py-3">
          <div className="min-w-[200px]">
            <label
              className="mb-1.5 block text-xs font-medium text-zinc-600"
              htmlFor="builder-target"
            >
              {t('cmsshared.builder.save_to')}
            </label>
            <Select
              id="builder-target"
              value={target}
              onChange={(event) => setTarget(event.target.value)}
            >
              <option value={NEW_PAGE}>{t('cmsshared.builder.new_page_option')}</option>
              {pages.map((page) => (
                <option key={page.id} value={String(page.id)}>
                  {page.title}
                </option>
              ))}
            </Select>
          </div>

          {creatingNew ? (
            <div className="min-w-[220px] flex-1">
              <label
                className="mb-1.5 block text-xs font-medium text-zinc-600"
                htmlFor="builder-title"
              >
                {t('cmsshared.builder.new_page_title')}
              </label>
              <input
                id="builder-title"
                className={inputClass}
                value={title}
                placeholder={t('cmsshared.builder.title_placeholder')}
                onChange={(event) => setTitle(event.target.value)}
              />
            </div>
          ) : (
            <p className="flex-1 text-xs text-zinc-500">{t('cmsshared.builder.replace_note')}</p>
          )}

          <Button onClick={save} disabled={saving || total === 0}>
            <Save size={14} />{' '}
            {saving ? t('cmsshared.builder.saving') : t('cmsshared.builder.save_blocks')}
          </Button>
        </div>

        <div className="min-h-[70vh]">
          <PageBuilder
            // Remount on target change so the newly picked page's layout loads.
            key={target}
            initialBlocks={seed}
            onChange={setBlocks}
            pageLabel={
              creatingNew
                ? title || t('cmsshared.builder.new_page')
                : pages.find((p) => String(p.id) === target)?.title || t('cmsshared.builder.page')
            }
            previewTheme={previewTheme}
            onSave={save}
          />
        </div>
      </CardContent>
    </Card>
  );
}
