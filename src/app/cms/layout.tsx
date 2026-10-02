import { requireCmsSession } from '@/lib/cms/session';
import Sidebar from '@/components/admin/Sidebar';
import Topbar from '@/components/admin/Topbar';
import { getDictionary, getLocale } from '@/lib/i18n/server';
import { LocaleProvider } from '@/lib/i18n/LocaleProvider';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Admin',
  robots: { index: false, follow: false },
};

/**
 * Shell for every /cms route: collapsible sidebar, sticky topbar and the
 * scrollable content area. Individual pages only render their own content.
 */
export default async function CmsLayout({ children }: { children: React.ReactNode }) {
  const session = await requireCmsSession();
  // Same cookie locale as the storefront (sq default) — powers Sidebar/Topbar
  // copy and the SQ/EN switcher in the topbar.
  const locale = await getLocale();
  const dict = getDictionary(locale);

  return (
    <LocaleProvider locale={locale} dict={dict}>
      <div className="cms-admin flex min-h-screen bg-[#f4f5f7] text-zinc-900">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar
            name={String((session as Record<string, unknown>).name || '')}
            email={String((session as Record<string, unknown>).email || '')}
          />
          <main className="flex-1 px-5 py-6 lg:px-8 lg:py-8">
            <div className="mx-auto w-full max-w-[1400px]">{children}</div>
          </main>
        </div>
      </div>
    </LocaleProvider>
  );
}
