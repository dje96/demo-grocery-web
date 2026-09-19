'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, SlidersHorizontal, X } from 'lucide-react';

import {
  badgesInAisle,
  brandsInAisle,
  productsInAisle,
  type Aisle,
  type Product,
} from '@/lib/catalog';
import { useShop } from '@/contexts/shop-context';
import { trackSearchEvent } from '@/lib/tracking';
import { ProductGrid } from '@/components/ProductCard';
import { cn } from '@/lib/utils';

type Sort = 'relevance' | 'price-asc' | 'price-desc' | 'name';

const SORTS: { id: Sort; label: string }[] = [
  { id: 'relevance', label: 'Most popular' },
  { id: 'price-asc', label: 'Price: low to high' },
  { id: 'price-desc', label: 'Price: high to low' },
  { id: 'name', label: 'Name A–Z' },
];

/**
 * Aisle listing: sticky 240px filter rail against the dense grid (~70/30),
 * collapsing to a drawer below lg. Every count and price in the rail is mono.
 */
export default function AisleView({ aisle }: { aisle: Aisle }) {
  const { recordAisleVisit, recordSearch } = useShop();

  const all = useMemo(() => productsInAisle(aisle.slug), [aisle.slug]);
  const allBadges = useMemo(() => badgesInAisle(aisle.slug), [aisle.slug]);
  const allBrands = useMemo(() => brandsInAisle(aisle.slug), [aisle.slug]);
  const maxPrice = useMemo(
    () => Math.ceil(Math.max(...all.map((p) => p.price), 1)),
    [all]
  );

  const [badges, setBadges] = useState<string[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [priceCap, setPriceCap] = useState<number>(maxPrice);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort>('relevance');
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    recordAisleVisit(aisle.name);
  }, [aisle.name, recordAisleVisit]);

  // Reset the cap whenever the aisle changes.
  useEffect(() => setPriceCap(maxPrice), [maxPrice]);

  const toggle = (
    value: string,
    list: string[],
    set: (next: string[]) => void
  ) =>
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  const filtered: Product[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    const next = all.filter((p) => {
      if (badges.length && !badges.every((b) => p.badges.includes(b))) return false;
      if (brands.length && !brands.includes(p.brand)) return false;
      if (p.price > priceCap) return false;
      if (q && !`${p.name} ${p.pack} ${p.brand}`.toLowerCase().includes(q))
        return false;
      return true;
    });
    switch (sort) {
      case 'price-asc':
        return [...next].sort((a, b) => a.price - b.price);
      case 'price-desc':
        return [...next].sort((a, b) => b.price - a.price);
      case 'name':
        return [...next].sort((a, b) => a.name.localeCompare(b.name));
      default:
        return next;
    }
  }, [all, badges, brands, priceCap, query, sort]);

  const activeFilters = badges.length + brands.length + (priceCap < maxPrice ? 1 : 0);

  /**
   * CDI: Perform Search, `search_type: "full"` — the in-aisle search. Fired on
   * submit and on blur, i.e. only once the shopper has finished typing, so
   * there is no per-keystroke firing to debounce. De-duplicated in tracking.ts,
   * so submit-then-blur sends one event. The term is the raw query, trimmed
   * only; `total_results` is the live match count from this aisle.
   */
  const trackAisleSearch = () => {
    const term = query.trim();
    if (!term) return;
    recordSearch(term);
    trackSearchEvent({ term, searchType: 'full', totalResults: filtered.length });
  };

  const clearAll = () => {
    setBadges([]);
    setBrands([]);
    setPriceCap(maxPrice);
  };

  const rail = (
    <div className="space-y-6">
      <FilterGroup title="Dietary & quality">
        {allBadges.map((badge) => (
          <CheckRow
            key={badge}
            label={badge}
            checked={badges.includes(badge)}
            onChange={() => toggle(badge, badges, setBadges)}
          />
        ))}
      </FilterGroup>

      <FilterGroup title="Brand">
        {allBrands.map((brand) => (
          <CheckRow
            key={brand}
            label={brand}
            checked={brands.includes(brand)}
            onChange={() => toggle(brand, brands, setBrands)}
          />
        ))}
      </FilterGroup>

      <FilterGroup title="Max price">
        <input
          type="range"
          min={1}
          max={maxPrice}
          step={1}
          value={priceCap}
          onChange={(e) => setPriceCap(Number(e.target.value))}
          aria-label="Maximum price"
          className="w-full accent-[#0C0E0D]"
        />
        <p className="num mt-1 text-[11.5px] text-muted">
          up to £{priceCap.toFixed(2)}
        </p>
      </FilterGroup>

      {activeFilters > 0 && (
        <button
          onClick={clearAll}
          className="text-small font-medium text-link underline-offset-2 hover:underline"
        >
          Clear <span className="num">{activeFilters}</span> filter
          {activeFilters === 1 ? '' : 's'}
        </button>
      )}
    </div>
  );

  return (
    <div className="mx-auto max-w-page px-6 pb-section pt-6">
      {/* Breadcrumb + title */}
      <nav className="num mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
        <Link href="/" className="hover:text-primary">
          Home
        </Link>{' '}
        / {aisle.name}
      </nav>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="font-heading text-h2 font-bold tracking-[-0.03em] text-heading">
            {aisle.name}
          </h1>
          <p className="mt-1 text-body text-muted">{aisle.blurb}</p>
        </div>
        <p className="num text-[12px] text-muted">
          {filtered.length} of {all.length} products
        </p>
      </div>

      <div className="flex gap-6">
        {/* Filter rail */}
        <aside className="hidden w-[240px] shrink-0 lg:block">
          <div className="sticky top-[120px] rounded-md border border-border bg-surface p-4">
            {rail}
          </div>
        </aside>

        {/* Grid column */}
        <div className="min-w-0 flex-1">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                trackAisleSearch();
              }}
              className="flex min-w-[12rem] flex-1 items-center gap-2 rounded-sm border-[1.5px] border-border-strong px-3 py-2 focus-within:border-primary"
            >
              <Search size={14} strokeWidth={2} className="shrink-0 text-muted" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onBlur={trackAisleSearch}
                placeholder={`Search in ${aisle.name}`}
                aria-label={`Search in ${aisle.name}`}
                className="w-full bg-transparent text-[13px] text-heading outline-none placeholder:text-muted"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  aria-label="Clear search"
                  className="text-muted hover:text-primary"
                >
                  <X size={13} />
                </button>
              )}
            </form>

            <button
              onClick={() => setDrawerOpen(true)}
              className="inline-flex items-center gap-2 rounded-sm border-[1.5px] border-border-strong px-3 py-2 text-[13px] font-semibold text-primary lg:hidden"
            >
              <SlidersHorizontal size={14} strokeWidth={2} /> Filters
              {activeFilters > 0 && <span className="num">{activeFilters}</span>}
            </button>

            <label className="flex items-center gap-2 text-[12px] text-muted">
              <span className="num uppercase tracking-[0.12em]">Sort</span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as Sort)}
                className="rounded-sm border-[1.5px] border-border-strong bg-background px-2 py-1.5 text-[13px] text-heading outline-none focus:border-primary"
              >
                {SORTS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {filtered.length > 0 ? (
            <ProductGrid products={filtered} className="xl:grid-cols-4" />
          ) : (
            <div className="rounded-md border border-border bg-surface px-6 py-16 text-center">
              <p className="font-heading text-h4 font-bold text-heading">
                Nothing matches those filters
              </p>
              <p className="mt-1 text-small text-muted">
                Try widening the price cap or clearing a dietary filter.
              </p>
              <button
                onClick={clearAll}
                className="mt-4 rounded-sm bg-primary px-4 py-[9px] text-small font-semibold text-highlight hover:bg-[#1E221F]"
              >
                Clear filters
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile filter drawer */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-[80] flex bg-primary/40 lg:hidden"
          onClick={() => setDrawerOpen(false)}
        >
          <div
            className="ml-auto h-full w-[300px] overflow-y-auto bg-background p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-heading text-h4 font-bold text-heading">Filters</h2>
              <button
                onClick={() => setDrawerOpen(false)}
                aria-label="Close filters"
                className="text-muted hover:text-primary"
              >
                <X size={18} />
              </button>
            </div>
            {rail}
            <button
              onClick={() => setDrawerOpen(false)}
              className="mt-6 w-full rounded-sm bg-primary px-4 py-[11px] text-small font-semibold text-highlight"
            >
              Show <span className="num">{filtered.length}</span> products
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="num mb-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
        {title}
      </h3>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function CheckRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-[13px] text-body hover:text-primary">
      <span
        className={cn(
          'flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border',
          checked ? 'border-primary bg-primary' : 'border-border-strong bg-background'
        )}
      >
        {checked && (
          <span className="h-1.5 w-1.5 rounded-[1px] bg-highlight" aria-hidden />
        )}
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="sr-only"
      />
      {label}
    </label>
  );
}
