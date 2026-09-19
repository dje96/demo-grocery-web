'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, Truck } from 'lucide-react';

import {
  aisleName,
  formatGBP,
  FREE_DELIVERY_THRESHOLD,
  relatedProducts,
  type Product,
} from '@/lib/catalog';
import { useShop } from '@/contexts/shop-context';
import { ProductTile } from '@/components/ProductIcon';
import { QuantityStepper } from '@/components/AddToBasket';
import { ProductGrid } from '@/components/ProductCard';
import { cn } from '@/lib/utils';

/**
 * Product detail. Left: the icon tile gallery. Right: price block, stepper,
 * add-to-basket. Below: nutrition + allergens, then a related rail.
 */
export default function ProductView({ product }: { product: Product }) {
  const { addItem, qtyOf, setQty, recordProductView, hydrated } = useShop();
  const [pending, setPending] = useState(1);
  const [added, setAdded] = useState(false);
  const [tab, setTab] = useState<'nutrition' | 'allergens' | 'about'>('about');

  useEffect(() => {
    recordProductView(product);
  }, [product, recordProductView]);

  const inBasket = qtyOf(product.sku);
  const related = relatedProducts(product.sku, 5);

  const add = () => {
    addItem(product.sku, pending);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1800);
  };

  return (
    <div className="mx-auto max-w-page px-6 pb-section pt-6">
      <nav className="num mb-5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
        <Link href="/" className="hover:text-primary">
          Home
        </Link>{' '}
        /{' '}
        <Link href={`/aisle/${product.aisle}`} className="hover:text-primary">
          {aisleName(product.aisle)}
        </Link>{' '}
        / {product.name}
      </nav>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* Gallery */}
        <div>
          <ProductTile
            icon={product.icon}
            offer={product.offer}
            inStock={product.inStock}
            iconSize={120}
            className="h-[380px] rounded-md border border-border"
          />
          <div className="mt-3 grid grid-cols-4 gap-3">
            {[0, 1, 2, 3].map((i) => (
              <ProductTile
                key={i}
                icon={product.icon}
                iconSize={26}
                className={cn(
                  'h-[72px] rounded-sm border',
                  i === 0 ? 'border-primary' : 'border-border'
                )}
              />
            ))}
          </div>
        </div>

        {/* Buy box */}
        <div className="lg:sticky lg:top-[120px] lg:self-start">
          <p className="num mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
            {product.brand}
          </p>
          <h1 className="font-heading text-h2 font-bold leading-[1.14] tracking-[-0.03em] text-heading">
            {product.name}
          </h1>
          <p className="mt-1.5 text-body text-muted">{product.pack}</p>

          <div className="mt-5 flex items-baseline gap-3 border-t border-border pt-5">
            <span className="num text-[32px] font-bold leading-none tracking-[-0.03em] text-primary">
              {formatGBP(product.price)}
            </span>
            <span className="num text-[12px] text-muted">{product.unitPrice}</span>
          </div>

          {product.badges.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {product.badges.map((badge) => (
                <span
                  key={badge}
                  className="rounded-sm border border-border bg-surface px-2 py-1 text-[11px] font-medium text-body"
                >
                  {badge}
                </span>
              ))}
            </div>
          )}

          <p
            className={cn(
              'num mt-4 text-[12px] font-semibold',
              product.inStock ? 'text-success' : 'text-error'
            )}
          >
            {product.inStock ? '● In stock' : '● Out of stock'}
          </p>

          {product.inStock && (
            <div className="mt-5 flex items-center gap-3">
              <QuantityStepper
                qty={pending}
                removeAtZero={false}
                onChange={(n) => setPending(Math.max(1, n))}
              />
              <button
                onClick={add}
                disabled={!hydrated}
                className="flex-1 rounded-sm bg-primary px-4 py-[11px] text-small font-semibold text-highlight transition-colors hover:bg-[#1E221F] disabled:opacity-50"
              >
                {added ? 'Added to basket' : 'Add to basket'}
              </button>
            </div>
          )}

          {inBasket > 0 && (
            <div className="mt-3 flex items-center justify-between gap-3 rounded-sm border border-border bg-surface px-3 py-2.5 text-[12.5px]">
              <span className="flex items-center gap-2 text-body">
                <Check size={14} strokeWidth={2.5} className="text-success" />
                <span className="num font-semibold text-primary">{inBasket}</span> in
                your basket
              </span>
              <button
                onClick={() => setQty(product.sku, 0)}
                className="font-medium text-link underline-offset-2 hover:underline"
              >
                Remove
              </button>
            </div>
          )}

          <p className="mt-4 flex items-start gap-2 text-[12.5px] text-muted">
            <Truck size={14} strokeWidth={1.75} className="mt-0.5 shrink-0" />
            Free delivery on orders over{' '}
            <span className="num text-primary">£{FREE_DELIVERY_THRESHOLD}</span>. Slots
            available today.
          </p>
        </div>
      </div>

      {/* Detail panel */}
      <section className="mt-9 border-t border-border pt-7">
        <div className="mb-4 flex gap-1 border-b border-border">
          {(['about', 'nutrition', 'allergens'] as const).map((id) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                'num px-3 pb-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors',
                tab === id
                  ? 'text-primary shadow-[inset_0_-2px_0_#0C0E0D]'
                  : 'text-muted hover:text-primary'
              )}
            >
              {id}
            </button>
          ))}
        </div>

        {tab === 'about' && (
          <p className="max-w-[62ch] text-body">{product.description}</p>
        )}

        {tab === 'nutrition' && (
          <div className="max-w-[32rem] overflow-hidden rounded-md border border-border">
            <p className="num border-b border-border bg-surface px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
              Typical values per 100g
            </p>
            {product.nutrition.map((row) => (
              <div
                key={row.label}
                className="flex items-center justify-between border-b border-border px-4 py-2.5 text-[13px] last:border-b-0"
              >
                <span className="text-body">{row.label}</span>
                <span className="num font-semibold text-primary">{row.value}</span>
              </div>
            ))}
          </div>
        )}

        {tab === 'allergens' && (
          <div className="max-w-[32rem]">
            {product.allergens.length > 0 ? (
              <>
                <p className="text-body">
                  Contains:{' '}
                  <span className="font-semibold text-heading">
                    {product.allergens.join(', ')}
                  </span>
                </p>
                <p className="mt-2 text-small text-muted">
                  May also contain traces from the same production line. Always check
                  the pack.
                </p>
              </>
            ) : (
              <p className="text-body">
                No declared allergens. Always check the pack on delivery.
              </p>
            )}
          </div>
        )}
      </section>

      {/* Related */}
      {related.length > 0 && (
        <section className="mt-9 border-t border-border pt-7">
          <h2 className="mb-4 font-heading text-h3 font-bold tracking-[-0.025em] text-heading">
            More from {aisleName(product.aisle)}
          </h2>
          <ProductGrid products={related} />
        </section>
      )}
    </div>
  );
}
