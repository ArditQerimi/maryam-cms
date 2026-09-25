'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Palette, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Badge, Button, Card, CardContent, cn } from '@/components/admin/ui';
import { setActiveTheme } from '@/app/cms/actions/theme';
import type { ThemeDefinition } from '@/lib/theme/types';

/**
 * Theme picker grid. Screenshots come from `public/themes/<id>/screenshot.svg`
 * and are referenced by each theme.json.
 */
export default function ThemeGrid({
  themes,
  activeId,
}: {
  themes: ThemeDefinition[];
  activeId: string;
}) {
  const [pending, setPending] = useState<string | null>(null);

  async function activate(id: string) {
    if (pending) return;
    setPending(id);
    try {
      const result = await setActiveTheme(id);
      if (result.ok) {
        toast.success(`Theme “${themes.find((theme) => theme.id === id)?.name || id}” activated.`);
      } else {
        toast.error(result.error || 'Could not activate the theme.');
      }
    } catch (error) {
      console.error('[cms/appearance] activate failed', error);
      toast.error('Something went wrong while activating the theme.');
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {themes.map((theme) => {
        const isActive = theme.id === activeId;
        return (
          <Card
            key={theme.id}
            className={cn(
              'overflow-hidden transition',
              isActive
                ? 'border-emerald-500 ring-2 ring-emerald-500/20'
                : 'hover:border-zinc-300 hover:shadow-md',
            )}
          >
            <div className="relative aspect-[16/10] w-full border-b border-zinc-100 bg-zinc-50">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={theme.screenshot}
                alt={`${theme.name} theme screenshot`}
                className="h-full w-full object-cover"
              />
              {isActive ? (
                <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white shadow">
                  <Sparkles size={12} /> Active
                </span>
              ) : null}
            </div>

            <CardContent className="flex h-full flex-col">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-900">{theme.name}</h3>
                  <p className="mt-1 text-xs text-zinc-500">{theme.description}</p>
                </div>
                <Badge tone="neutral">v{theme.version}</Badge>
              </div>

              <div className="mt-4 flex items-center gap-1.5">
                {Object.values(theme.colors)
                  .slice(0, 6)
                  .map((color, index) => (
                    <span
                      key={`${color}-${index}`}
                      title={color}
                      className="h-4 w-4 rounded-full ring-1 ring-black/10"
                      style={{ backgroundColor: color }}
                    />
                  ))}
              </div>

              <div className="mt-4 flex items-center gap-2 border-t border-zinc-100 pt-4">
                {isActive ? (
                  <Link
                    href="/cms/appearance/customize"
                    className="inline-flex h-8 flex-1 items-center justify-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50"
                  >
                    <Palette size={14} /> Customize
                  </Link>
                ) : (
                  <Button
                    size="sm"
                    className="flex-1"
                    disabled={pending !== null}
                    onClick={() => void activate(theme.id)}
                  >
                    {pending === theme.id ? 'Activating…' : 'Activate'}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
