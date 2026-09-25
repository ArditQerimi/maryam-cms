'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import { Bell, ExternalLink, LogOut, UserRound } from 'lucide-react';
import { cmsLogout } from '@/app/login/actions';

const TITLES: Array<[string, string]> = [
  ['/cms/dashboard', 'Dashboard'],
  ['/cms/pages', 'Pages'],
  ['/cms/posts', 'Posts'],
  ['/cms/media', 'Media'],
  ['/cms/products', 'Products'],
  ['/cms/orders', 'Orders'],
  ['/cms/customers', 'Customers'],
  ['/cms/coupons', 'Coupons'],
  ['/cms/discounts', 'Discounts'],
  ['/cms/shipping', 'Shipping'],
  ['/cms/reports', 'Reports'],
  ['/cms/appearance', 'Appearance'],
  ['/cms/settings', 'Settings'],
  ['/cms/builder', 'Page builder'],
];

function breadcrumb(pathname: string) {
  const match = TITLES.find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  const root = match?.[1] || 'CMS';
  const tail = pathname
    .replace(match?.[0] || '', '')
    .split('/')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).replace(/-/g, ' '));

  return tail.length ? [root, ...tail] : [root];
}

export default function Topbar({ name, email }: { name: string; email: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const parts = breadcrumb(pathname);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const initials = (name || email || '?')
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-zinc-200 bg-white/90 px-5 backdrop-blur">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm">
        {parts.map((part, index) => (
          <span key={`${part}-${index}`} className="flex items-center gap-1.5">
            {index > 0 ? <span className="text-zinc-300">/</span> : null}
            <span
              className={
                index === parts.length - 1
                  ? 'font-medium text-zinc-900'
                  : 'text-zinc-400'
              }
            >
              {part}
            </span>
          </span>
        ))}
      </nav>

      <div className="flex items-center gap-2">
        <a
          href="/shop"
          target="_blank"
          rel="noreferrer"
          className="hidden items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 transition hover:bg-zinc-50 sm:inline-flex"
        >
          View shop <ExternalLink size={13} />
        </a>

        <button
          type="button"
          aria-label="Notifications"
          className="rounded-lg p-2 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-700"
        >
          <Bell size={17} />
        </button>

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="flex items-center gap-2.5 rounded-lg py-1 pl-1 pr-2 transition hover:bg-zinc-100"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#6d6be8]/15 text-xs font-semibold text-[#4f4dd6]">
              {initials || <UserRound size={15} />}
            </span>
            <span className="hidden text-left leading-tight sm:block">
              <span className="block max-w-[160px] truncate text-sm font-medium text-zinc-800">
                {name || email}
              </span>
              <span className="block max-w-[160px] truncate text-[11px] text-zinc-400">
                {email}
              </span>
            </span>
          </button>

          {open && (
            <div className="absolute right-0 mt-2 w-56 overflow-hidden rounded-xl border border-zinc-200 bg-white py-1.5 shadow-lg">
              <div className="px-4 py-2">
                <p className="truncate text-sm font-medium text-zinc-900">{name || email}</p>
                <p className="truncate text-xs text-zinc-500">{email}</p>
              </div>
              <div className="my-1 h-px bg-zinc-100" />
              <Link
                href="/cms/settings/general"
                onClick={() => setOpen(false)}
                className="block px-4 py-2 text-sm text-zinc-700 transition hover:bg-zinc-50"
              >
                Settings
              </Link>
              <Link
                href="/shop"
                target="_blank"
                onClick={() => setOpen(false)}
                className="block px-4 py-2 text-sm text-zinc-700 transition hover:bg-zinc-50"
              >
                View shop
              </Link>
              <div className="my-1 h-px bg-zinc-100" />
              <form action={cmsLogout}>
                <button
                  type="submit"
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 transition hover:bg-red-50"
                >
                  <LogOut size={14} /> Sign out
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
