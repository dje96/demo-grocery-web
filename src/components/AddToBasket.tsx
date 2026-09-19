'use client';

import { Minus, Plus, Trash2 } from 'lucide-react';

import { useShop } from '@/contexts/shop-context';
import { cn } from '@/lib/utils';

/**
 * Bare quantity stepper. The qty is mono/tabular so the control doesn't shift
 * width between 1 and 10.
 */
export function QuantityStepper({
  qty,
  onChange,
  size = 'md',
  removeAtZero = true,
}: {
  qty: number;
  onChange: (next: number) => void;
  size?: 'sm' | 'md';
  removeAtZero?: boolean;
}) {
  const btn = cn(
    'flex shrink-0 items-center justify-center bg-background text-primary transition-colors hover:bg-surface disabled:opacity-40',
    size === 'sm' ? 'h-8 w-8' : 'h-[38px] w-[38px]'
  );
  return (
    <div className="flex items-stretch overflow-hidden rounded-sm border-[1.5px] border-primary">
      <button
        type="button"
        onClick={() => onChange(qty - 1)}
        className={btn}
        aria-label={qty === 1 && removeAtZero ? 'Remove from basket' : 'Decrease quantity'}
      >
        {qty === 1 && removeAtZero ? (
          <Trash2 size={14} strokeWidth={1.75} />
        ) : (
          <Minus size={15} strokeWidth={2} />
        )}
      </button>
      <span
        className={cn(
          'num flex flex-1 items-center justify-center font-bold text-primary',
          size === 'sm' ? 'min-w-[2.25rem] text-[12px]' : 'min-w-[2.75rem] text-[13px]'
        )}
        aria-live="polite"
      >
        {qty}
      </span>
      <button
        type="button"
        onClick={() => onChange(qty + 1)}
        className={btn}
        aria-label="Increase quantity"
        disabled={qty >= 99}
      >
        <Plus size={15} strokeWidth={2} />
      </button>
    </div>
  );
}

/**
 * The card-foot control: a full-width primary button that becomes a mono
 * quantity stepper once the SKU is in the basket.
 */
export default function AddToBasket({
  sku,
  inStock = true,
  size = 'md',
  label = 'Add to basket',
}: {
  sku: string;
  inStock?: boolean;
  size?: 'sm' | 'md';
  label?: string;
}) {
  const { qtyOf, addItem, setQty, hydrated } = useShop();
  const qty = qtyOf(sku);

  if (!inStock) {
    return (
      <button
        type="button"
        disabled
        className={cn(
          'w-full cursor-not-allowed rounded-sm border-[1.5px] border-border bg-surface font-semibold text-muted',
          size === 'sm' ? 'px-3 py-1.5 text-[12px]' : 'px-4 py-[9px] text-small'
        )}
      >
        Out of stock
      </button>
    );
  }

  // Before hydration the basket is unknown; render the neutral "add" state so
  // the server and client markup agree.
  if (hydrated && qty > 0) {
    return <QuantityStepper qty={qty} size={size} onChange={(n) => setQty(sku, n)} />;
  }

  return (
    <button
      type="button"
      onClick={() => addItem(sku, 1)}
      className={cn(
        'w-full rounded-sm bg-primary font-semibold text-highlight transition-colors hover:bg-[#1E221F]',
        size === 'sm' ? 'px-3 py-1.5 text-[12px]' : 'px-4 py-[9px] text-small'
      )}
    >
      {label}
    </button>
  );
}
