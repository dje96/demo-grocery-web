'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Clock, LogOut, Search, ShoppingBasket, User } from 'lucide-react';

import { useUser } from '@/contexts/user-context';
import { useShop } from '@/contexts/shop-context';
import {
  aisles,
  formatGBP,
  nextAvailableSlot,
  searchProducts,
  type Product,
} from '@/lib/catalog';
import { siteConfig } from '@/lib/config';
import { trackSearchEvent } from '@/lib/tracking';
import AuthModal from '@/components/AuthModal';
import { ProductIcon } from '@/components/ProductIcon';
import { cn } from '@/lib/utils';

/* ---------------------------------------------------------------------------
 * Three-zone sticky nav: wordmark · wide search · slot chip + account + basket
 * pill. A secondary aisle bar sits beneath on desktop, active aisle marked by a
 * 2px underline. Search IS grocery navigation here, so it takes the centre and
 * suggests live.
 *
 * Auth goes through useUser() only — the tracker is never touched directly.
 * ------------------------------------------------------------------------- */

export default function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoggedIn, logout } = useUser();
  const { itemCount, subtotal, recordSearch } = useShop();

  const [query, setQuery] = useState('');
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup' | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [slotLabel, setSlotLabel] = useState<string | null>(null);

  const searchRef = useRef<HTMLDivElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);

  // Next slot is time-dependent, so resolve it on the client only — otherwise
  // the server render and the hydration disagree at an hour boundary.
  useEffect(() => {
    const tick = () => setSlotLabel(nextAvailableSlot()?.label ?? null);
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  // Close the popovers on an outside click.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSuggestOpen(false);
      }
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) {
        setAccountOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const suggestions: Product[] = useMemo(
    () => (query.trim().length >= 2 ? searchProducts(query, 6) : []),
    [query]
  );

  /**
   * CDI: Perform Search, `search_type: "quick"` — the live suggestion dropdown.
   *
   * DEBOUNCED at 700ms and gated at 3 characters so one query is one event, not
   * one event per keystroke. The term sent is the raw text as typed, trimmed
   * only: never lowercased, normalised or stemmed, because that raw text is
   * exactly what separates "cheese" from "Yeo Valley salted butter" for the
   * intent model. `total_results` is the full match count, computed here.
   */
  useEffect(() => {
    const term = query.trim();
    if (term.length < 3) return;
    const id = window.setTimeout(() => {
      trackSearchEvent({
        term,
        searchType: 'quick',
        totalResults: searchProducts(term, 9999).length,
      });
    }, 700);
    return () => window.clearTimeout(id);
  }, [query]);

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    recordSearch(q);
    // CDI: Perform Search, `search_type: "full"` — an explicitly submitted
    // search. Raw term, trimmed only.
    const matches = searchProducts(q, 9999);
    trackSearchEvent({ term: q, searchType: 'full', totalResults: matches.length });
    const top = matches[0];
    setSuggestOpen(false);
    if (top) router.push(`/product/${top.sku}`);
  };

  const goToSuggestion = (product: Product) => {
    const q = query.trim();
    recordSearch(q);
    // Picking from the dropdown IS the quick search. De-duplicated in
    // tracking.ts, so this is a no-op when the debounce already sent it.
    if (q) {
      trackSearchEvent({
        term: q,
        searchType: 'quick',
        totalResults: searchProducts(q, 9999).length,
      });
    }
    setSuggestOpen(false);
    setQuery('');
    router.push(`/product/${product.sku}`);
  };

  const activeAisle = pathname.startsWith('/aisle/')
    ? pathname.split('/')[2]
    : null;

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-border bg-background">
        {/* Primary bar */}
        <div className="mx-auto flex h-[62px] max-w-page items-center gap-4 px-6 sm:gap-6">
          <Link
            href="/"
            className="shrink-0 font-heading text-[20px] font-bold tracking-[-0.05em] text-primary"
          >
            {siteConfig.brand.name}
          </Link>

          {/* Search — the centre zone */}
          <div ref={searchRef} className="relative hidden min-w-0 flex-1 sm:block">
            <form onSubmit={submitSearch}>
              <div className="flex items-center gap-2.5 rounded-sm border-[1.5px] border-border-strong bg-background px-3 py-2 focus-within:border-primary">
                <Search size={15} strokeWidth={2} className="shrink-0 text-muted" />
                <input
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setSuggestOpen(true);
                  }}
                  onFocus={() => setSuggestOpen(true)}
                  placeholder="Search 12,000 products"
                  aria-label="Search products"
                  className="w-full bg-transparent text-[13.5px] text-heading outline-none placeholder:text-muted"
                />
              </div>
            </form>

            {suggestOpen && suggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-md border border-border bg-surface-raised shadow-md">
                {suggestions.map((product) => (
                  <button
                    key={product.sku}
                    onClick={() => goToSuggestion(product)}
                    className="flex w-full items-center gap-3 border-b border-border px-3 py-2.5 text-left last:border-b-0 hover:bg-surface"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-surface">
                      <ProductIcon icon={product.icon} size={16} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-heading">
                        {product.name}
                      </span>
                      <span className="block truncate text-[11px] text-muted">
                        {product.pack}
                      </span>
                    </span>
                    <span className="num shrink-0 text-[12.5px] font-bold text-primary">
                      {formatGBP(product.price)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right zone */}
          <div className="ml-auto flex shrink-0 items-center gap-3 sm:gap-3.5">
            <span className="num hidden items-center gap-1.5 rounded-sm border border-border bg-surface px-2.5 py-1.5 text-[11.5px] font-medium text-primary lg:inline-flex">
              <Clock size={12} strokeWidth={2} className="text-muted" />
              Next slot <span className="text-muted">·</span>{' '}
              {slotLabel ? slotLabel.split('–')[0] : '—'}
            </span>

            <div ref={accountRef} className="relative">
              <button
                onClick={() =>
                  isLoggedIn ? setAccountOpen((o) => !o) : setAuthMode('login')
                }
                className="flex items-center gap-1.5 text-[13px] text-body transition-colors hover:text-primary"
              >
                <User size={15} strokeWidth={1.75} />
                <span className="hidden sm:inline">
                  {isLoggedIn ? user?.email?.split('@')[0] : 'Account'}
                </span>
              </button>

              {accountOpen && isLoggedIn && (
                <div className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-md border border-border bg-surface-raised shadow-md">
                  <p className="border-b border-border px-3 py-2.5 text-[11px] text-muted">
                    Signed in as
                    <span className="mt-0.5 block truncate font-medium text-heading">
                      {user?.email}
                    </span>
                  </p>
                  <button
                    onClick={() => {
                      logout();
                      setAccountOpen(false);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[13px] text-body hover:bg-surface hover:text-primary"
                  >
                    <LogOut size={14} strokeWidth={1.75} /> Sign out
                  </button>
                </div>
              )}
            </div>

            <Link
              href="/cart"
              className="inline-flex items-center gap-2 rounded-sm bg-primary px-3 py-[7px] text-[12.5px] font-semibold text-highlight transition-colors hover:bg-[#1E221F]"
            >
              <ShoppingBasket size={14} strokeWidth={2} />
              <span className="hidden sm:inline">Basket</span>
              <span className="num text-[12.5px] font-bold">{itemCount}</span>
              {subtotal > 0 && (
                <span className="num hidden text-[12.5px] font-bold opacity-80 md:inline">
                  {formatGBP(subtotal)}
                </span>
              )}
            </Link>
          </div>
        </div>

        {/* Secondary aisle bar */}
        <div className="hidden border-t border-border md:block">
          <div className="no-scrollbar mx-auto flex h-[42px] max-w-page items-center gap-[22px] overflow-x-auto px-6">
            {aisles.map((aisle) => {
              const active = activeAisle === aisle.slug;
              return (
                <Link
                  key={aisle.slug}
                  href={`/aisle/${aisle.slug}`}
                  className={cn(
                    'whitespace-nowrap text-nav tracking-[0.01em] transition-colors',
                    active
                      ? 'font-semibold text-primary shadow-[inset_0_-2px_0_#0C0E0D] pb-3'
                      : 'text-body hover:text-primary'
                  )}
                >
                  {aisle.name}
                </Link>
              );
            })}
          </div>
        </div>
      </header>

      {authMode && (
        <AuthModal mode={authMode} onClose={() => setAuthMode(null)} />
      )}
    </>
  );
}
