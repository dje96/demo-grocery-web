'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Tag, Trash2 } from 'lucide-react';

import {
  aisleName,
  buyAgainProducts,
  DELIVERY_FEE,
  formatGBP,
  FREE_DELIVERY_THRESHOLD,
} from '@/lib/catalog';
import { useShop } from '@/contexts/shop-context';
import { ProductTile } from '@/components/ProductIcon';
import { QuantityStepper } from '@/components/AddToBasket';
import { cn } from '@/lib/utils';

/**
 * The basket. Fully functional: real line items from context, quantity edits,
 * removal, a promo field, a running subtotal and the free-delivery threshold
 * progress bar. Every number here is mono/tabular.
 */
export default function CartPage() {
  const {
    resolved,
    itemCount,
    subtotal,
    deliveryFee,
    total,
    promoCode,
    promoDiscount,
    applyPromo,
    clearPromo,
    freeDeliveryProgress,
    amountToFreeDelivery,
    setQty,
    removeItem,
    addItem,
    clearCart,
    hydrated,
  } = useShop();

  const [code, setCode] = useState('');
  const [promoMsg, setPromoMsg] = useState<{ ok: boolean; message: string } | null>(
    null
  );

  const suggestions = buyAgainProducts().filter(
    (p) => !resolved.some((l) => l.product.sku === p.sku)
  );

  if (!hydrated) {
    return (
      <div className="mx-auto max-w-page px-6 py-section">
        <p className="num text-small text-muted">loading your basket…</p>
      </div>
    );
  }

  if (resolved.length === 0) {
    return (
      <div className="mx-auto max-w-page px-6 py-section">
        <h1 className="font-heading text-h1 font-bold tracking-[-0.035em] text-heading">
          Your basket is empty
        </h1>
        <p className="mt-3 max-w-[48ch] text-body">
          Start with an aisle, or add your usual four items in one tap from the
          homepage.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/aisle/produce"
            className="rounded-sm bg-primary px-4 py-[11px] text-small font-semibold text-highlight transition-colors hover:bg-[#1E221F]"
          >
            Shop Produce
          </Link>
          <Link
            href="/"
            className="rounded-sm border-[1.5px] border-border-strong px-4 py-[11px] text-small font-semibold text-primary transition-colors hover:border-primary"
          >
            Back to the homepage
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-page px-6 pb-section pt-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
        <h1 className="font-heading text-h2 font-bold tracking-[-0.03em] text-heading">
          Your basket
        </h1>
        <p className="num text-[12px] text-muted">
          {itemCount} item{itemCount === 1 ? '' : 's'} · {resolved.length} product
          {resolved.length === 1 ? '' : 's'}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* Lines */}
        <div>
          <div className="overflow-hidden rounded-md border border-border">
            {resolved.map((line) => (
              <div
                key={line.product.sku}
                className="flex items-center gap-4 border-b border-border p-3 last:border-b-0"
              >
                <Link href={`/product/${line.product.sku}`} className="shrink-0">
                  <ProductTile
                    icon={line.product.icon}
                    iconSize={26}
                    className="h-16 w-16 rounded-sm border border-border"
                  />
                </Link>

                <div className="min-w-0 flex-1">
                  <p className="num text-[9.5px] font-semibold uppercase tracking-[0.1em] text-muted">
                    {aisleName(line.product.aisle)}
                  </p>
                  <Link
                    href={`/product/${line.product.sku}`}
                    className="block truncate font-heading text-[14.5px] font-bold tracking-[-0.02em] text-heading hover:text-accent"
                  >
                    {line.product.name}
                  </Link>
                  <p className="truncate text-[12px] text-muted">
                    {line.product.pack} ·{' '}
                    <span className="num">{formatGBP(line.product.price)}</span>{' '}
                    <span className="num">{line.product.unitPrice}</span>
                  </p>
                </div>

                <div className="w-[120px] shrink-0">
                  <QuantityStepper
                    qty={line.qty}
                    size="sm"
                    onChange={(n) => setQty(line.product.sku, n)}
                  />
                </div>

                <span className="num w-[68px] shrink-0 text-right text-[15px] font-bold text-primary">
                  {formatGBP(line.lineTotal)}
                </span>

                <button
                  onClick={() => removeItem(line.product.sku)}
                  aria-label={`Remove ${line.product.name}`}
                  className="shrink-0 p-1 text-muted transition-colors hover:text-error"
                >
                  <Trash2 size={15} strokeWidth={1.75} />
                </button>
              </div>
            ))}
          </div>

          <div className="mt-3 flex items-center justify-between gap-4">
            <button
              onClick={clearCart}
              className="text-small font-medium text-link underline-offset-2 hover:underline"
            >
              Empty basket
            </button>
            <Link
              href="/"
              className="text-small font-medium text-link underline-offset-2 hover:underline"
            >
              Continue shopping →
            </Link>
          </div>

          {suggestions.length > 0 && (
            <section className="mt-8 border-t border-border pt-6">
              <h2 className="mb-3 font-heading text-h4 font-bold text-heading">
                Usually with this
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {suggestions.map((product) => (
                  <div
                    key={product.sku}
                    className="flex items-center gap-3 rounded-md border border-border p-2.5"
                  >
                    <ProductTile
                      icon={product.icon}
                      iconSize={20}
                      className="h-11 w-11 shrink-0 rounded-sm"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-heading">
                        {product.name}
                      </p>
                      <p className="num text-[12px] text-muted">
                        {formatGBP(product.price)}
                      </p>
                    </div>
                    <button
                      onClick={() => addItem(product.sku, 1)}
                      className="shrink-0 rounded-sm border border-border-strong px-2.5 py-1.5 text-[12px] font-semibold text-primary transition-colors hover:border-primary"
                    >
                      Add
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Summary */}
        <aside className="lg:sticky lg:top-[120px] lg:self-start">
          <div className="rounded-md border border-border bg-surface p-5">
            <h2 className="num mb-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
              Order summary
            </h2>

            {/* Free delivery progress */}
            <div className="mb-5">
              <div className="mb-1.5 flex items-baseline justify-between gap-3 text-[12.5px]">
                <span className="text-body">
                  {amountToFreeDelivery > 0 ? (
                    <>
                      <span className="num font-semibold text-primary">
                        {formatGBP(amountToFreeDelivery)}
                      </span>{' '}
                      to free delivery
                    </>
                  ) : (
                    'Free delivery unlocked'
                  )}
                </span>
                <span className="num text-muted">{freeDeliveryProgress}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    amountToFreeDelivery > 0 ? 'bg-primary' : 'bg-accent'
                  )}
                  style={{ width: `${freeDeliveryProgress}%` }}
                />
              </div>
            </div>

            <Row label="Subtotal" value={formatGBP(subtotal)} />
            {promoDiscount > 0 && (
              <Row
                label={`Promo ${promoCode}`}
                value={`−${formatGBP(promoDiscount)}`}
                accent
              />
            )}
            <Row
              label="Delivery"
              value={deliveryFee === 0 ? 'FREE' : formatGBP(deliveryFee)}
            />
            <div className="mt-3 flex items-baseline justify-between gap-3 border-t border-border pt-3">
              <span className="font-heading text-[15px] font-bold text-heading">
                Total
              </span>
              <span className="num text-[20px] font-bold tracking-[-0.02em] text-primary">
                {formatGBP(total)}
              </span>
            </div>

            {/* Promo */}
            <div className="mt-5 border-t border-border pt-4">
              {promoCode ? (
                <div className="flex items-center justify-between gap-3 text-[12.5px]">
                  <span className="num inline-flex items-center gap-1.5 rounded-sm bg-highlight px-2 py-1 font-bold text-primary">
                    <Tag size={11} strokeWidth={2.5} /> {promoCode}
                  </span>
                  <button
                    onClick={() => {
                      clearPromo();
                      setPromoMsg(null);
                      setCode('');
                    }}
                    className="font-medium text-link underline-offset-2 hover:underline"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    setPromoMsg(applyPromo(code));
                  }}
                  className="flex gap-2"
                >
                  <input
                    value={code}
                    onChange={(e) => {
                      setCode(e.target.value);
                      setPromoMsg(null);
                    }}
                    placeholder="Promo code"
                    aria-label="Promo code"
                    className="num min-w-0 flex-1 rounded-sm border-[1.5px] border-border-strong bg-background px-3 py-2 text-[12.5px] uppercase text-heading outline-none placeholder:normal-case placeholder:font-body placeholder:text-muted focus:border-primary"
                  />
                  <button
                    type="submit"
                    className="rounded-sm border-[1.5px] border-border-strong px-3 py-2 text-[12.5px] font-semibold text-primary transition-colors hover:border-primary"
                  >
                    Apply
                  </button>
                </form>
              )}
              {promoMsg && (
                <p
                  className={cn(
                    'mt-2 text-[12px]',
                    promoMsg.ok ? 'text-success' : 'text-error'
                  )}
                >
                  {promoMsg.message}
                </p>
              )}
              {!promoCode && !promoMsg && (
                <p className="num mt-2 text-[11px] text-muted">try FRESH10</p>
              )}
            </div>

            <Link
              href="/checkout"
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-sm bg-primary px-4 py-[12px] text-small font-semibold text-highlight transition-colors hover:bg-[#1E221F]"
            >
              Proceed to checkout <ArrowRight size={15} strokeWidth={2} />
            </Link>
            <p className="num mt-3 text-center text-[11px] text-muted">
              delivery from {formatGBP(DELIVERY_FEE)} · free over £
              {FREE_DELIVERY_THRESHOLD}
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1 text-[13px]">
      <span className="text-body">{label}</span>
      <span
        className={cn('num font-semibold', accent ? 'text-success' : 'text-primary')}
      >
        {value}
      </span>
    </div>
  );
}
