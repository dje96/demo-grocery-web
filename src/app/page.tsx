'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import {
  aisles,
  buyAgainProducts,
  deliverySlots,
  formatGBP,
  FREE_DELIVERY_THRESHOLD,
  newProducts,
  offerProducts,
  productsInAisle,
  type DeliverySlot,
} from '@/lib/catalog';
import { useShop } from '@/contexts/shop-context';
import { ProductGrid } from '@/components/ProductCard';
import { ProductIcon } from '@/components/ProductIcon';
import { cn } from '@/lib/utils';

/**
 * No marketing hero. The page opens on a 65/35 band — delivery slot card and a
 * buy-again strip — so the first product row lands above the fold on a laptop.
 */
export default function Home() {
  const { addItem, hydrated } = useShop();
  const [slots, setSlots] = useState<DeliverySlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [reserved, setReserved] = useState(false);

  // Slots depend on the clock, so resolve them client-side after mount.
  useEffect(() => {
    const next = deliverySlots();
    setSlots(next);
    setSelectedSlot(next.find((s) => s.available)?.id ?? null);
  }, []);

  const nextSlot = slots.find((s) => s.id === selectedSlot) ?? null;
  const buyAgain = buyAgainProducts();
  const offers = offerProducts();
  const fresh = newProducts();

  return (
    <div className="mx-auto max-w-page px-6 pb-section">
      {/* ── Band: delivery slot (65) + buy again (35) ─────────────────────── */}
      <section className="grid gap-6 pt-7 lg:grid-cols-[65fr_35fr]">
        <div className="rounded-md border border-border bg-surface p-6">
          <p className="num mb-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
            Delivery
          </p>
          <h1 className="mb-2.5 font-heading text-[40px] font-bold leading-[1.1] tracking-[-0.035em] text-heading">
            Delivered in
            <br />
            under 60 minutes
          </h1>
          <p className="mb-[18px] max-w-[46ch] text-[14px]">
            Pick a slot and we&apos;ll hold it while you shop. Free over{' '}
            <span className="num font-semibold text-primary">
              £{FREE_DELIVERY_THRESHOLD}
            </span>
            .
          </p>

          <div className="mb-[18px] flex flex-wrap gap-2">
            {slots.length === 0 ? (
              <span className="num rounded-sm border border-border bg-background px-2.5 py-[7px] text-[12px] text-muted">
                loading slots…
              </span>
            ) : (
              slots.map((slot) => (
                <button
                  key={slot.id}
                  disabled={!slot.available}
                  onClick={() => {
                    setSelectedSlot(slot.id);
                    setReserved(false);
                  }}
                  className={cn(
                    'num rounded-sm border px-2.5 py-[7px] text-[12px] transition-colors',
                    !slot.available
                      ? 'cursor-not-allowed border-border bg-background text-muted line-through'
                      : slot.id === selectedSlot
                        ? 'border-primary bg-primary text-highlight'
                        : 'border-border bg-background text-primary hover:border-border-strong'
                  )}
                >
                  {slot.label}
                </button>
              ))
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setReserved(true)}
              disabled={!nextSlot}
              className="rounded-sm bg-primary px-4 py-[9px] text-small font-semibold text-highlight transition-colors hover:bg-[#1E221F] disabled:opacity-40"
            >
              {reserved ? 'Holding' : 'Reserve'}{' '}
              <span className="num">
                {nextSlot ? nextSlot.label.split('–')[0] : '—'}
              </span>{' '}
              {reserved ? 'for 10 min' : 'slot'}
            </button>
            <Link
              href="/checkout"
              className="rounded-sm border-[1.5px] border-border-strong px-4 py-[9px] text-small font-semibold text-primary transition-colors hover:border-primary"
            >
              See all slots
            </Link>
            {nextSlot && (
              <span className="num text-[12px] text-muted">
                {formatGBP(nextSlot.fee)} · free over £{FREE_DELIVERY_THRESHOLD}
              </span>
            )}
          </div>
        </div>

        <div className="rounded-md border border-border p-[18px]">
          <h2 className="mb-1 font-heading text-[15px] font-bold tracking-[-0.02em] text-heading">
            Buy again
          </h2>
          <p className="mb-3.5 text-[12.5px] text-muted">
            From your last <span className="num">3</span> orders
          </p>
          {buyAgain.map((product) => (
            <div
              key={product.sku}
              className="flex items-center justify-between gap-3 border-t border-border py-2.5 text-[13px] first:border-t-0"
            >
              <Link
                href={`/product/${product.sku}`}
                className="min-w-0 flex-1 truncate text-primary hover:text-accent"
              >
                {product.name}
              </Link>
              <span className="num shrink-0 text-[12.5px] font-semibold text-primary">
                {formatGBP(product.price)}
              </span>
              <button
                onClick={() => addItem(product.sku, 1)}
                disabled={!hydrated}
                aria-label={`Add ${product.name} to basket`}
                className="num shrink-0 rounded-sm border border-border-strong px-2 py-1 text-[11px] font-semibold text-primary transition-colors hover:border-primary"
              >
                +
              </button>
            </div>
          ))}
          <button
            onClick={() => buyAgain.forEach((p) => addItem(p.sku, 1))}
            disabled={!hydrated}
            className="mt-3 inline-flex items-center gap-1 text-small font-medium text-link underline-offset-2 hover:underline"
          >
            Add all <span className="num">{buyAgain.length}</span>
            <ArrowRight size={13} strokeWidth={2} />
          </button>
        </div>
      </section>

      {/* ── Offers ────────────────────────────────────────────────────────── */}
      <Section title="Offers this week" sub="Ends Sunday" href="/aisle/produce">
        <ProductGrid products={offers} />
      </Section>

      {/* ── Aisles ────────────────────────────────────────────────────────── */}
      <Section title="Shop the aisles" sub={`${aisles.length} aisles`}>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-8">
          {aisles.map((aisle) => (
            <Link
              key={aisle.slug}
              href={`/aisle/${aisle.slug}`}
              className="group flex flex-col items-start gap-3 rounded-md border border-border p-3 transition-shadow hover:shadow-sm"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-sm bg-surface">
                <ProductIcon icon={aisle.icon} size={22} />
              </span>
              <span>
                <span className="block font-heading text-[14px] font-bold tracking-[-0.02em] text-heading group-hover:text-accent">
                  {aisle.name}
                </span>
                <span className="num mt-0.5 block text-[10.5px] text-muted">
                  {productsInAisle(aisle.slug).length} products
                </span>
              </span>
            </Link>
          ))}
        </div>
      </Section>

      {/* ── New in ────────────────────────────────────────────────────────── */}
      <Section title="New in" sub="Landed this week">
        <ProductGrid products={fresh} />
      </Section>
    </div>
  );
}

function Section({
  title,
  sub,
  href,
  children,
}: {
  title: string;
  sub?: string;
  href?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-9 border-t border-border pt-7">
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <h2 className="font-heading text-h3 font-bold tracking-[-0.025em] text-heading">
          {title}
        </h2>
        {href ? (
          <Link
            href={href}
            className="text-small font-medium text-link underline-offset-2 hover:underline"
          >
            {sub ?? 'View all'} →
          </Link>
        ) : (
          sub && (
            <span className="num text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
              {sub}
            </span>
          )
        )}
      </div>
      {children}
    </section>
  );
}
