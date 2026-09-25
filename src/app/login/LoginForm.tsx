'use client';

import { useState, useActionState } from 'react';
import { Eye, EyeOff, LayoutDashboard, Palette, Package, ShieldCheck } from 'lucide-react';
import { cmsLogin, type LoginFormState } from './actions';

const FALLBACK_ERRORS: Record<string, string> = {
  'missing-fields': 'Email and password are required.',
  'invalid-email': 'That email address is not valid.',
  'password-too-short': 'Password must be at least 6 characters.',
  'account-suspended': 'This account is suspended.',
  'company-not-found': 'No store is configured for this host.',
  'tenant-domain-required': 'Store login is not available on this host.',
  'database-error': 'Could not reach the database. Try again.',
  'invalid-credentials': 'Incorrect email or password.',
};

const FEATURES = [
  {
    icon: LayoutDashboard,
    title: 'Content & pages',
    text: 'Visual page builder, blog posts and a full media library.',
  },
  {
    icon: Package,
    title: 'Commerce',
    text: 'Products, orders, customers, coupons, discounts and shipping zones.',
  },
  {
    icon: Palette,
    title: 'Themes',
    text: 'Live theme customizer, navigation menus and widgets.',
  },
];

export default function LoginForm({
  returnTo,
  errorCode,
}: {
  returnTo?: string;
  errorCode?: string;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const [state, formAction, pending] = useActionState<LoginFormState, FormData>(cmsLogin, {
    error: errorCode ? FALLBACK_ERRORS[errorCode] || FALLBACK_ERRORS['invalid-credentials'] : null,
  });

  return (
    <div className="flex min-h-screen">
      {/* Brand panel */}
      <aside className="relative hidden w-[40%] flex-col justify-between overflow-hidden bg-[#1e1e2e] p-12 text-white lg:flex">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#6d6be8]/25 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -left-20 h-80 w-80 rounded-full bg-[#6d6be8]/15 blur-3xl"
        />

        <div className="relative">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#6d6be8] font-bold">
              M
            </div>
            <span className="text-lg font-semibold tracking-tight">Maryam CMS</span>
          </div>
        </div>

        <div className="relative space-y-8">
          <div>
            <h1 className="text-3xl font-semibold leading-tight">
              Run your storefront
              <br />
              from one control panel.
            </h1>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/60">
              Content, themes and commerce management for the store that shares its
              database with your point of sale.
            </p>
          </div>

          <ul className="space-y-5">
            {FEATURES.map((feature) => (
              <li key={feature.title} className="flex gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10">
                  <feature.icon size={16} className="text-[#a5a3f5]" />
                </span>
                <span>
                  <span className="block text-sm font-medium">{feature.title}</span>
                  <span className="block text-xs leading-relaxed text-white/50">
                    {feature.text}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative flex items-center gap-2 text-xs text-white/40">
          <ShieldCheck size={14} />
          Staff access only — every request is verified against your session.
        </p>
      </aside>

      {/* Form panel */}
      <main className="flex w-full items-center justify-center px-6 py-12 lg:w-[60%]">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#6d6be8] font-bold text-white">
                M
              </div>
              <span className="text-lg font-semibold text-zinc-900">Maryam CMS</span>
            </div>
          </div>

          <h2 className="text-2xl font-semibold tracking-tight text-zinc-900">Sign in</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Use your store staff account to open the admin panel.
          </p>

          <form action={formAction} className="mt-8 space-y-5">
            {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}
            <input type="hidden" name="audience" value="staff" />

            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-zinc-700">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="username"
                required
                placeholder="you@store.com"
                className="w-full rounded-lg border border-zinc-300 bg-white px-3.5 py-2.5 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-[#6d6be8] focus:ring-2 focus:ring-[#6d6be8]/20"
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-zinc-700">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3.5 py-2.5 pr-11 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-[#6d6be8] focus:ring-2 focus:ring-[#6d6be8]/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-zinc-400 transition hover:text-zinc-600"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {state.error ? (
              <p
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700"
              >
                {state.error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-lg bg-[#6d6be8] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#5b59d6] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <p className="mt-6 text-xs text-zinc-400">
            Storefront customers should sign in through the{' '}
            <a href="/shop/login" className="text-[#6d6be8] underline underline-offset-2">
              shop login
            </a>
            .
          </p>
        </div>
      </main>
    </div>
  );
}
