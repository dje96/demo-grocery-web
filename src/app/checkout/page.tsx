'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Check, CreditCard, MapPin, PartyPopper, Truck } from 'lucide-react';

import {
  deliverySlots,
  formatGBP,
  FREE_DELIVERY_THRESHOLD,
  type DeliverySlot,
} from '@/lib/catalog';
import { useShop, type PlacedOrder } from '@/contexts/shop-context';
import { useUser } from '@/contexts/user-context';
import { trackCheckoutStepEvent } from '@/lib/tracking';
import { cn } from '@/lib/utils';

/* ---------------------------------------------------------------------------
 * Fully functional four-step checkout: slot → address → payment → confirmation.
 * State is real — it reads the basket from ShopProvider and, on submit, calls
 * placeOrder() which persists the order and empties the basket.
 * ------------------------------------------------------------------------- */

type Step = 'slot' | 'address' | 'payment' | 'confirmation';

/**
 * CDI: the four checkout steps of the "Progress Checkout Step" spec, 1-based.
 * `confirmation` is deliberately absent — that screen is the Complete
 * Transaction event, not a checkout step.
 *
 * Steps 1–3 fire on ENTRY to the screen. Step 4 ("Order review") has no screen
 * of its own in this build — the review panel lives inside the payment step —
 * so it fires the moment the shopper confirms that review by submitting a valid
 * payment, immediately before placeOrder().
 */
const CHECKOUT_STEP_INDEX: Record<Exclude<Step, 'confirmation'>, number> = {
  slot: 1,
  address: 2,
  payment: 3,
};
const ORDER_REVIEW_STEP = 4;

const STEPS: { id: Step; label: string; icon: typeof Truck }[] = [
  { id: 'slot', label: 'Delivery slot', icon: Truck },
  { id: 'address', label: 'Address', icon: MapPin },
  { id: 'payment', label: 'Payment', icon: CreditCard },
  { id: 'confirmation', label: 'Confirmation', icon: PartyPopper },
];

interface Address {
  name: string;
  line1: string;
  city: string;
  postcode: string;
  instructions: string;
}

export default function CheckoutPage() {
  const { resolved, itemCount, subtotal, promoCode, promoDiscount, placeOrder, hydrated } =
    useShop();
  const { user, isLoggedIn } = useUser();

  const [step, setStep] = useState<Step>('slot');
  const [slots, setSlots] = useState<DeliverySlot[]>([]);
  const [slotId, setSlotId] = useState<string | null>(null);
  const [address, setAddress] = useState<Address>({
    name: '',
    line1: '',
    city: '',
    postcode: '',
    instructions: '',
  });
  const [card, setCard] = useState({ number: '', expiry: '', cvc: '' });
  const [errors, setErrors] = useState<string[]>([]);
  const [order, setOrder] = useState<PlacedOrder | null>(null);
  const [placing, setPlacing] = useState(false);

  useEffect(() => {
    const next = deliverySlots();
    setSlots(next);
    setSlotId(next.find((s) => s.available)?.id ?? null);
  }, []);

  useEffect(() => {
    if (user?.email && !address.name) {
      setAddress((a) => ({ ...a, name: user.email.split('@')[0] }));
    }
  }, [user, address.name]);

  const slot = slots.find((s) => s.id === slotId) ?? null;

  // ── CDI: Progress Checkout Step, once per step entry ─────────────────────
  // Guarded on a ref so StrictMode's double-invoked effect (dev) sends one
  // event per entry, while a genuine re-entry after "Back" still fires again.
  // The subtotal, slot and account type are read as of the moment of entry and
  // deliberately kept out of the dependency list — depending on them would fire
  // duplicate step events every time the shopper changed a slot.
  const firedStepRef = useRef<Step | null>(null);
  useEffect(() => {
    // Wait for the basket to hydrate from localStorage, or step 1 would report
    // a cart total of 0 and Signals would read a stale `cart_value`.
    if (!hydrated) return;
    if (step === 'confirmation') return;
    if (firedStepRef.current === step) return;
    firedStepRef.current = step;
    trackCheckoutStepEvent({
      step: CHECKOUT_STEP_INDEX[step],
      subtotal,
      deliveryMethod: `slot ${slot?.label ?? 'not selected'}`,
      accountType: isLoggedIn ? 'existing user' : 'guest checkout',
      couponCode: promoCode,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, hydrated]);

  const discounted = Math.round((subtotal - promoDiscount) * 100) / 100;
  const deliveryFee = useMemo(() => {
    if (discounted >= FREE_DELIVERY_THRESHOLD) return 0;
    return slot?.fee ?? 0;
  }, [discounted, slot]);
  const total = Math.round((discounted + deliveryFee) * 100) / 100;

  // Nothing to check out and no order just placed — send them back.
  if (hydrated && resolved.length === 0 && step !== 'confirmation') {
    return (
      <div className="mx-auto max-w-page px-6 py-section">
        <h1 className="font-heading text-h1 font-bold tracking-[-0.035em] text-heading">
          Nothing to check out
        </h1>
        <p className="mt-3 text-body">Add a few things to your basket first.</p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-sm bg-primary px-4 py-[11px] text-small font-semibold text-highlight hover:bg-[#1E221F]"
        >
          Start shopping
        </Link>
      </div>
    );
  }

  const stepIndex = STEPS.findIndex((s) => s.id === step);

  const goAddress = () => {
    if (!slot) {
      setErrors(['Pick a delivery slot to continue.']);
      return;
    }
    setErrors([]);
    setStep('address');
  };

  const goPayment = () => {
    const next: string[] = [];
    if (address.name.trim().length < 2) next.push('Enter the name for the delivery.');
    if (address.line1.trim().length < 4) next.push('Enter a street address.');
    if (address.city.trim().length < 2) next.push('Enter a town or city.');
    if (!/^[A-Za-z]{1,2}\d[A-Za-z\d]?\s*\d[A-Za-z]{2}$/.test(address.postcode.trim()))
      next.push('Enter a valid UK postcode, e.g. E9 5QB.');
    setErrors(next);
    if (next.length === 0) setStep('payment');
  };

  const submitOrder = () => {
    const next: string[] = [];
    const digits = card.number.replace(/\s/g, '');
    if (!/^\d{16}$/.test(digits)) next.push('Card number must be 16 digits.');
    if (!/^\d{2}\/\d{2}$/.test(card.expiry)) next.push('Expiry must be MM/YY.');
    if (!/^\d{3}$/.test(card.cvc)) next.push('CVC must be 3 digits.');
    setErrors(next);
    if (next.length > 0) return;

    // CDI: step 4 — the order review the shopper has just confirmed.
    trackCheckoutStepEvent({
      step: ORDER_REVIEW_STEP,
      subtotal,
      deliveryMethod: `slot ${slot?.label ?? 'not selected'}`,
      accountType: isLoggedIn ? 'existing user' : 'guest checkout',
      paymentMethod: 'card',
      shippingPostcode: address.postcode.trim().toUpperCase(),
      couponCode: promoCode,
    });

    setPlacing(true);
    // Simulated authorization.
    window.setTimeout(() => {
      // CDI: Complete Transaction fires inside placeOrder() — exactly once.
      const placed = placeOrder({
        slotLabel: slot?.label ?? '—',
        total,
        itemCount,
        name: address.name,
        deliveryFee,
        paymentMethod: 'card',
      });
      setOrder(placed);
      setPlacing(false);
      setStep('confirmation');
    }, 700);
  };

  const field =
    'w-full rounded-sm border-[1.5px] border-border-strong bg-background px-3 py-2.5 text-body text-heading outline-none placeholder:text-muted focus:border-primary';

  return (
    <div className="mx-auto max-w-page px-6 pb-section pt-6">
      <h1 className="font-heading text-h2 font-bold tracking-[-0.03em] text-heading">
        Checkout
      </h1>

      {/* Stepper */}
      <ol className="mb-6 mt-5 flex flex-wrap gap-x-6 gap-y-2 border-b border-border pb-5">
        {STEPS.map((s, i) => {
          const done = i < stepIndex;
          const current = i === stepIndex;
          return (
            <li key={s.id} className="flex items-center gap-2">
              <span
                className={cn(
                  'num flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-bold',
                  done
                    ? 'border-transparent bg-accent text-inverse'
                    : current
                      ? 'border-transparent bg-primary text-highlight'
                      : 'border-border-strong text-muted'
                )}
              >
                {done ? <Check size={11} strokeWidth={3} /> : i + 1}
              </span>
              <span
                className={cn(
                  'text-[12.5px]',
                  current ? 'font-semibold text-primary' : 'text-muted'
                )}
              >
                {s.label}
              </span>
            </li>
          );
        })}
      </ol>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div>
          {errors.length > 0 && (
            <ul className="mb-4 space-y-1 rounded-sm border border-error/40 bg-error/5 px-4 py-3 text-[13px] text-error">
              {errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}

          {/* ── Step 1: slot ─────────────────────────────────────────────── */}
          {step === 'slot' && (
            <section className="rounded-md border border-border p-5">
              <h2 className="font-heading text-h4 font-bold text-heading">
                Choose a delivery slot
              </h2>
              <p className="mt-1 text-small text-muted">
                Slots for today. Evening slots carry a small premium.
              </p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {slots.map((s) => (
                  <button
                    key={s.id}
                    disabled={!s.available}
                    onClick={() => setSlotId(s.id)}
                    className={cn(
                      'flex items-center justify-between gap-3 rounded-sm border px-3 py-3 text-left transition-colors',
                      !s.available
                        ? 'cursor-not-allowed border-border bg-surface text-muted'
                        : s.id === slotId
                          ? 'border-primary bg-primary text-highlight'
                          : 'border-border hover:border-border-strong'
                    )}
                  >
                    <span className="num text-[13px] font-semibold">{s.label}</span>
                    <span className="num text-[12px] opacity-80">
                      {!s.available ? 'full' : formatGBP(s.fee)}
                    </span>
                  </button>
                ))}
              </div>
              <button
                onClick={goAddress}
                className="mt-5 rounded-sm bg-primary px-4 py-[11px] text-small font-semibold text-highlight hover:bg-[#1E221F]"
              >
                Continue to address
              </button>
            </section>
          )}

          {/* ── Step 2: address ──────────────────────────────────────────── */}
          {step === 'address' && (
            <section className="rounded-md border border-border p-5">
              <h2 className="font-heading text-h4 font-bold text-heading">
                Delivery address
              </h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Field label="Name">
                  <input
                    className={field}
                    value={address.name}
                    onChange={(e) => setAddress({ ...address, name: e.target.value })}
                    placeholder="Alex Morgan"
                  />
                </Field>
                <Field label="Postcode">
                  <input
                    className={cn(field, 'num uppercase')}
                    value={address.postcode}
                    onChange={(e) =>
                      setAddress({ ...address, postcode: e.target.value })
                    }
                    placeholder="E9 5QB"
                  />
                </Field>
                <Field label="Address" span>
                  <input
                    className={field}
                    value={address.line1}
                    onChange={(e) => setAddress({ ...address, line1: e.target.value })}
                    placeholder="42 Cold Chain Road"
                  />
                </Field>
                <Field label="Town or city">
                  <input
                    className={field}
                    value={address.city}
                    onChange={(e) => setAddress({ ...address, city: e.target.value })}
                    placeholder="London"
                  />
                </Field>
                <Field label="Driver instructions">
                  <input
                    className={field}
                    value={address.instructions}
                    onChange={(e) =>
                      setAddress({ ...address, instructions: e.target.value })
                    }
                    placeholder="Leave with the neighbour at 44"
                  />
                </Field>
              </div>
              <div className="mt-5 flex gap-3">
                <button
                  onClick={() => setStep('slot')}
                  className="rounded-sm border-[1.5px] border-border-strong px-4 py-[11px] text-small font-semibold text-primary hover:border-primary"
                >
                  Back
                </button>
                <button
                  onClick={goPayment}
                  className="rounded-sm bg-primary px-4 py-[11px] text-small font-semibold text-highlight hover:bg-[#1E221F]"
                >
                  Continue to payment
                </button>
              </div>
            </section>
          )}

          {/* ── Step 3: payment ──────────────────────────────────────────── */}
          {step === 'payment' && (
            <section className="rounded-md border border-border p-5">
              <h2 className="font-heading text-h4 font-bold text-heading">Payment</h2>
              <p className="num mt-1 text-[11px] uppercase tracking-[0.12em] text-muted">
                simulated — no card is charged
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Field label="Card number" span>
                  <input
                    className={cn(field, 'num')}
                    value={card.number}
                    inputMode="numeric"
                    onChange={(e) => setCard({ ...card, number: e.target.value })}
                    placeholder="4242 4242 4242 4242"
                  />
                </Field>
                <Field label="Expiry">
                  <input
                    className={cn(field, 'num')}
                    value={card.expiry}
                    onChange={(e) => setCard({ ...card, expiry: e.target.value })}
                    placeholder="12/28"
                  />
                </Field>
                <Field label="CVC">
                  <input
                    className={cn(field, 'num')}
                    value={card.cvc}
                    inputMode="numeric"
                    onChange={(e) => setCard({ ...card, cvc: e.target.value })}
                    placeholder="123"
                  />
                </Field>
              </div>

              <div className="mt-5 rounded-sm border border-border bg-surface p-4">
                <h3 className="num mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                  Review
                </h3>
                <p className="text-[13px] text-body">
                  <span className="num font-semibold text-primary">{itemCount}</span>{' '}
                  items to{' '}
                  <span className="font-semibold text-heading">
                    {address.line1}, {address.city}
                  </span>
                  , {address.postcode.toUpperCase()} in the{' '}
                  <span className="num font-semibold text-primary">
                    {slot?.label ?? '—'}
                  </span>{' '}
                  slot.
                </p>
              </div>

              <div className="mt-5 flex gap-3">
                <button
                  onClick={() => setStep('address')}
                  className="rounded-sm border-[1.5px] border-border-strong px-4 py-[11px] text-small font-semibold text-primary hover:border-primary"
                >
                  Back
                </button>
                <button
                  onClick={submitOrder}
                  disabled={placing}
                  className="rounded-sm bg-primary px-4 py-[11px] text-small font-semibold text-highlight hover:bg-[#1E221F] disabled:opacity-60"
                >
                  {placing ? 'Authorising…' : `Place order · ${formatGBP(total)}`}
                </button>
              </div>
            </section>
          )}

          {/* ── Step 4: confirmation ─────────────────────────────────────── */}
          {step === 'confirmation' && order && (
            <section className="rounded-md border border-border p-6">
              <span className="num inline-block rounded-sm bg-highlight px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-primary">
                Order confirmed
              </span>
              <h2 className="mt-4 font-heading text-h1 font-bold tracking-[-0.035em] text-heading">
                Thanks, {order.name}.
              </h2>
              <p className="mt-2 max-w-[52ch] text-body">
                Your order is being picked now. You&apos;ll get a text when the driver
                sets off, and you can swap anything until an hour before the slot.
              </p>

              <dl className="mt-6 grid gap-x-8 gap-y-3 sm:grid-cols-2">
                <Summary label="Order reference" value={order.reference} />
                <Summary label="Delivery slot" value={order.slotLabel} />
                <Summary label="Items" value={String(order.itemCount)} />
                <Summary label="Total paid" value={formatGBP(order.total)} />
              </dl>

              <div className="mt-7 flex flex-wrap gap-3">
                <Link
                  href="/"
                  className="rounded-sm bg-primary px-4 py-[11px] text-small font-semibold text-highlight hover:bg-[#1E221F]"
                >
                  Back to shopping
                </Link>
                <Link
                  href="/aisle/bakery"
                  className="rounded-sm border-[1.5px] border-border-strong px-4 py-[11px] text-small font-semibold text-primary hover:border-primary"
                >
                  Browse Bakery
                </Link>
              </div>
            </section>
          )}
        </div>

        {/* Order summary rail */}
        {step !== 'confirmation' && (
          <aside className="lg:sticky lg:top-[120px] lg:self-start">
            <div className="rounded-md border border-border bg-surface p-5">
              <h2 className="num mb-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                Your order
              </h2>
              <div className="max-h-[220px] space-y-2 overflow-y-auto pr-1">
                {resolved.map((line) => (
                  <div
                    key={line.product.sku}
                    className="flex items-baseline justify-between gap-3 text-[12.5px]"
                  >
                    <span className="min-w-0 flex-1 truncate text-body">
                      <span className="num font-semibold text-primary">
                        {line.qty}×
                      </span>{' '}
                      {line.product.name}
                    </span>
                    <span className="num shrink-0 font-semibold text-primary">
                      {formatGBP(line.lineTotal)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-4 space-y-1 border-t border-border pt-3 text-[13px]">
                <SummaryRow label="Subtotal" value={formatGBP(subtotal)} />
                {promoDiscount > 0 && (
                  <SummaryRow
                    label={`Promo ${promoCode}`}
                    value={`−${formatGBP(promoDiscount)}`}
                  />
                )}
                <SummaryRow
                  label={slot ? `Delivery ${slot.label}` : 'Delivery'}
                  value={deliveryFee === 0 ? 'FREE' : formatGBP(deliveryFee)}
                />
              </div>
              <div className="mt-3 flex items-baseline justify-between gap-3 border-t border-border pt-3">
                <span className="font-heading text-[15px] font-bold text-heading">
                  Total
                </span>
                <span className="num text-[20px] font-bold tracking-[-0.02em] text-primary">
                  {formatGBP(total)}
                </span>
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  span,
  children,
}: {
  label: string;
  span?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={cn('block', span && 'sm:col-span-2')}>
      <span className="num mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
        {label}
      </span>
      {children}
    </label>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="min-w-0 truncate text-body">{label}</span>
      <span className="num shrink-0 font-semibold text-primary">{value}</span>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="num text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
        {label}
      </dt>
      <dd className="num mt-1 text-[16px] font-bold text-primary">{value}</dd>
    </div>
  );
}
