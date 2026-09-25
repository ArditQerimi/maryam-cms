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

const NEW_PAGE = 'new';

export default function BuilderPlayground({
  pages,
  defaultPageId = null,
}: {
  pages: Array<{ id: number; title: string }>;
  defaultPageId?: number | null;
}) {
  const router = useRouter();
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [target, setTarget] = useState<string>(
    defaultPageId ? String(defaultPageId) : NEW_PAGE,
  );
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
        toast.error(result.error || 'Could not save the layout.');
        return;
      }

      toast.success(creatingNew ? 'Page created with these blocks.' : 'Page updated.');
      router.push(`/cms/pages/${result.id}/edit`);
    } catch (error) {
      console.error('[cms/builder] save failed', error);
      toast.error('Something went wrong while saving.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex items-center justify-between gap-3">
        <CardTitle>Layout</CardTitle>
        <Badge tone="brand">
          {total} {total === 1 ? 'block' : 'blocks'}
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-zinc-200 bg-zinc-50/70 px-4 py-3">
          <div className="min-w-[200px]">
            <label
              className="mb-1.5 block text-xs font-medium text-zinc-600"
              htmlFor="builder-target"
            >
              Save to
            </label>
            <Select
              id="builder-target"
              value={target}
              onChange={(event) => setTarget(event.target.value)}
            >
              <option value={NEW_PAGE}>— New page —</option>
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
                New page title
              </label>
              <input
                id="builder-title"
                className={inputClass}
                value={title}
                placeholder="Home"
                onChange={(event) => setTitle(event.target.value)}
              />
            </div>
          ) : (
            <p className="flex-1 text-xs text-zinc-500">
              Only the blocks are replaced — the title, SEO fields and status stay as they are.
            </p>
          )}

          <Button onClick={save} disabled={saving || total === 0}>
            <Save size={14} /> {saving ? 'Saving…' : 'Save blocks'}
          </Button>
        </div>

        <div className="min-h-[70vh]">
          <PageBuilder initialBlocks={[]} onChange={setBlocks} />
        </div>
      </CardContent>
    </Card>
  );
}
