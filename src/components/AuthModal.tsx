'use client';

import { useState } from 'react';
import { X } from 'lucide-react';

import { useUser } from '@/contexts/user-context';
import { siteConfig } from '@/lib/config';

/**
 * Sign in / create account.
 *
 * Identity is driven ONLY through `useUser()` — `login` / `signup` handle
 * setUserId, the anonymous→known stitch and the login event. Nothing here
 * touches the tracker directly.
 */
export default function AuthModal({
  mode,
  onClose,
}: {
  mode: 'login' | 'signup';
  onClose: () => void;
}) {
  const { login, signup } = useUser();
  const [tab, setTab] = useState<'login' | 'signup'>(mode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes('@')) {
      setError('Enter a valid email address.');
      return;
    }
    if (password.length < 4) {
      setError('Passwords are at least 4 characters.');
      return;
    }
    if (tab === 'login') login(email, 'email');
    else signup(email, 'email');
    onClose();
  };

  const field =
    'w-full rounded-sm border-[1.5px] border-border-strong bg-background px-3 py-2.5 text-body text-heading outline-none placeholder:text-muted focus:border-primary';

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-primary/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[26rem] rounded-md border border-border bg-surface-raised shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
          <div>
            <h2
              id="auth-title"
              className="font-heading text-h3 font-bold tracking-[-0.025em] text-heading"
            >
              {tab === 'login' ? 'Sign in' : 'Create an account'}
            </h2>
            <p className="mt-1 text-small text-muted">
              {tab === 'login'
                ? `Your ${siteConfig.brand.name} basket, slots and buy-again list.`
                : 'Save your basket, reorder in two taps, book slots earlier.'}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-sm p-1 text-muted transition-colors hover:text-heading"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-3 px-6 py-5">
          <div>
            <label
              htmlFor="auth-email"
              className="num mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.12em] text-muted"
            >
              Email
            </label>
            <input
              id="auth-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError(null);
              }}
              placeholder="you@example.com"
              className={field}
            />
          </div>
          <div>
            <label
              htmlFor="auth-password"
              className="num mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.12em] text-muted"
            >
              Password
            </label>
            <input
              id="auth-password"
              type="password"
              autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError(null);
              }}
              placeholder="••••••••"
              className={field}
            />
          </div>

          {error && <p className="text-small text-error">{error}</p>}

          <button
            type="submit"
            className="w-full rounded-sm bg-primary px-4 py-[11px] text-small font-semibold text-highlight transition-colors hover:bg-[#1E221F]"
          >
            {tab === 'login' ? 'Sign in' : 'Create account'}
          </button>

          <p className="pt-1 text-center text-small text-muted">
            {tab === 'login' ? "Don't have an account?" : 'Already shop with us?'}{' '}
            <button
              type="button"
              onClick={() => {
                setTab(tab === 'login' ? 'signup' : 'login');
                setError(null);
              }}
              className="font-medium text-link underline-offset-2 hover:underline"
            >
              {tab === 'login' ? 'Create one' : 'Sign in'}
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}
