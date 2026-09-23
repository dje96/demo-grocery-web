'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { usePathname } from 'next/navigation';

import {
  DELIVERY_FEE,
  FREE_DELIVERY_THRESHOLD,
  productBySku,
  type Product,
} from '@/lib/catalog';
import {
  trackAddToBasketEvent,
  trackProductViewEvent,
  trackRemoveFromBasketEvent,
  trackTransactionEvent,
} from '@/lib/tracking';

/* ---------------------------------------------------------------------------
 * Basket state + session activity.
 *
 * TWO stores in one provider, both client-only:
 *
 *   • BASKET  — localStorage (`basket-cart`). Survives reloads and tab closes,
 *     so a presenter can build a basket, reload with UTM, and still have it.
 *   • ACTIVITY — sessionStorage (`basket-activity`). Products viewed, searches
 *     run, aisles visited, page count and session start. The Intent tab is
 *     served entirely from Signals (/api/intent reads the `demo_grocery`
 *     service); only `activityMeta` (page count, session start) is read from
 *     here, as display-only panel metrics.
 *
 * Every count and total exposed here is computed IN CODE.
 *
 * CDI: this provider is also the single seam for the Add To Basket / Remove
 * From Basket / View Product events. Every add site in the app (AddToBasket,
 * ProductCard, the homepage buy-again strip, the cart's "usually with this")
 * calls `addItem`, and every cart line control calls `setQty`/`removeItem`/
 * `clearCart`, so firing here guarantees the two things the event specs care
 * about: `product.quantity` is the delta for THIS action, and
 * `cart.total_value` is the subtotal AFTER it.
 * ------------------------------------------------------------------------- */

const CART_KEY = 'basket-cart';
const ACTIVITY_KEY = 'basket-activity';
const ORDER_KEY = 'basket-last-order';

export interface CartLine {
  sku: string;
  qty: number;
}

/** A cart line joined to its product record, for rendering. */
export interface ResolvedLine {
  product: Product;
  qty: number;
  lineTotal: number;
}

export interface ViewedProduct {
  sku: string;
  name: string;
  aisle: string;
  at: number;
}

interface Activity {
  startedAt: number;
  pageCount: number;
  viewed: ViewedProduct[];
  searches: string[];
  aisles: string[];
}

export interface PlacedOrder {
  reference: string;
  placedAt: number;
  slotLabel: string;
  total: number;
  itemCount: number;
  name: string;
}

interface ShopContextValue {
  // basket
  lines: CartLine[];
  resolved: ResolvedLine[];
  itemCount: number;
  subtotal: number;
  deliveryFee: number;
  total: number;
  freeDeliveryProgress: number;
  amountToFreeDelivery: number;
  qtyOf: (sku: string) => number;
  addItem: (sku: string, qty?: number) => void;
  setQty: (sku: string, qty: number) => void;
  removeItem: (sku: string) => void;
  clearCart: () => void;
  // promo
  promoCode: string | null;
  promoDiscount: number;
  applyPromo: (code: string) => { ok: boolean; message: string };
  clearPromo: () => void;
  // activity
  recordProductView: (product: Product) => void;
  recordSearch: (query: string) => void;
  recordAisleVisit: (aisleName: string) => void;
  /** Client-computed session counters the Signals group does not carry
   *  (page count, session start). Posted alongside the session id to
   *  /api/intent and shown as panel metrics — never part of the Jev state. */
  activityMeta: () => { pageCount: number; startedAt: number };
  // order
  lastOrder: PlacedOrder | null;
  placeOrder: (
    order: Omit<PlacedOrder, 'placedAt' | 'reference'> & {
      /** Delivery fee actually charged — rides on transaction.shipping. */
      deliveryFee?: number;
      /** Simulated payment method — rides on transaction.payment_method. */
      paymentMethod?: string;
    }
  ) => PlacedOrder;
  hydrated: boolean;
}

const ShopContext = createContext<ShopContextValue | undefined>(undefined);

const EMPTY_ACTIVITY: Activity = {
  startedAt: Date.now(),
  pageCount: 0,
  viewed: [],
  searches: [],
  aisles: [],
};

/** Promo codes the demo accepts. Percentage off the subtotal. */
const PROMOS: Record<string, { pct: number; label: string }> = {
  FRESH10: { pct: 10, label: '10% off your basket' },
  BASKET5: { pct: 5, label: '5% off your basket' },
};

function readJSON<T>(storage: Storage, key: string, fallback: T): T {
  try {
    const raw = storage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(storage: Storage, key: string, value: unknown): void {
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota / private mode — the demo still works, it just won't persist */
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function ShopProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [promoCode, setPromoCode] = useState<string | null>(null);
  const [lastOrder, setLastOrder] = useState<PlacedOrder | null>(null);
  const [hydrated, setHydrated] = useState(false);
  // Activity lives in a ref: it changes on every page view and never needs to
  // re-render the tree. The Intent panel reads its counters on demand.
  const activityRef = useRef<Activity>(EMPTY_ACTIVITY);
  // Mirror of `lines`, so the basket mutators can compute the NEXT lines (and
  // therefore the subtotal AFTER the action) outside a setState updater. Doing
  // the arithmetic here rather than in the updater keeps the CDI events free of
  // React's double-invoked-updater behaviour in development.
  const linesRef = useRef<CartLine[]>([]);
  // Last SKU a product_view was tracked for — guards the duplicate that
  // StrictMode's double-invoked effects would otherwise send in development.
  const lastViewedSkuRef = useRef<string | null>(null);
  const pathname = usePathname();

  // Hydrate after first paint to avoid a server/client mismatch.
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      const stored = readJSON<CartLine[]>(window.localStorage, CART_KEY, []);
      linesRef.current = stored;
      setLines(stored);
      setLastOrder(readJSON<PlacedOrder | null>(window.localStorage, ORDER_KEY, null));
      activityRef.current = readJSON<Activity>(window.sessionStorage, ACTIVITY_KEY, {
        ...EMPTY_ACTIVITY,
        startedAt: Date.now(),
      });
      setHydrated(true);
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  // Persist the basket on every change (after hydration, so we never write the
  // empty initial state over a saved basket).
  useEffect(() => {
    if (!hydrated) return;
    writeJSON(window.localStorage, CART_KEY, lines);
  }, [lines, hydrated]);

  const persistActivity = useCallback(() => {
    writeJSON(window.sessionStorage, ACTIVITY_KEY, activityRef.current);
  }, []);

  // Count pages as the shopper moves. Route change, not render.
  useEffect(() => {
    if (!hydrated) return;
    activityRef.current = {
      ...activityRef.current,
      pageCount: activityRef.current.pageCount + 1,
    };
    persistActivity();
  }, [pathname, hydrated, persistActivity]);

  // ─── Basket ──────────────────────────────────────────────────────────────

  const qtyOf = useCallback(
    (sku: string) => lines.find((l) => l.sku === sku)?.qty ?? 0,
    [lines]
  );

  /** Subtotal for an arbitrary set of lines — used to derive the basket value
   *  AFTER an action, which is what the cart entity must carry. */
  const subtotalOf = useCallback(
    (next: CartLine[]) =>
      round2(
        next.reduce((sum, l) => {
          const product = productBySku(l.sku);
          return product ? sum + product.price * l.qty : sum;
        }, 0)
      ),
    []
  );

  /** Commit the next lines to both state and the mirror ref. */
  const commitLines = useCallback((next: CartLine[]) => {
    linesRef.current = next;
    setLines(next);
  }, []);

  /**
   * Move `delta` units of `sku` and fire the matching CDI event.
   * delta > 0 → Add To Basket · delta < 0 → Remove From Basket.
   * `product.quantity` is |delta|; `cart.total_value` is the subtotal after.
   */
  const moveUnits = useCallback(
    (sku: string, delta: number, next: CartLine[]) => {
      if (delta === 0) return;
      const product = productBySku(sku);
      if (!product) return;
      const after = subtotalOf(next);
      if (delta > 0) trackAddToBasketEvent(product, delta, after);
      else trackRemoveFromBasketEvent(product, -delta, after);
    },
    [subtotalOf]
  );

  const addItem = useCallback(
    (sku: string, qty = 1) => {
      const prev = linesRef.current;
      const existing = prev.find((l) => l.sku === sku);
      const nextQty = existing
        ? Math.min(99, existing.qty + qty)
        : Math.min(99, qty);
      const delta = nextQty - (existing?.qty ?? 0);
      const next = existing
        ? prev.map((l) => (l.sku === sku ? { ...l, qty: nextQty } : l))
        : [...prev, { sku, qty: nextQty }];
      commitLines(next);
      moveUnits(sku, delta, next);
    },
    [commitLines, moveUnits]
  );

  const setQty = useCallback(
    (sku: string, qty: number) => {
      const prev = linesRef.current;
      const before = prev.find((l) => l.sku === sku)?.qty ?? 0;
      const target = qty <= 0 ? 0 : Math.min(99, qty);
      const next =
        target === 0
          ? prev.filter((l) => l.sku !== sku)
          : prev.map((l) => (l.sku === sku ? { ...l, qty: target } : l));
      commitLines(next);
      moveUnits(sku, target - before, next);
    },
    [commitLines, moveUnits]
  );

  const removeItem = useCallback(
    (sku: string) => {
      const prev = linesRef.current;
      const before = prev.find((l) => l.sku === sku)?.qty ?? 0;
      const next = prev.filter((l) => l.sku !== sku);
      commitLines(next);
      moveUnits(sku, -before, next);
    },
    [commitLines, moveUnits]
  );

  /**
   * "Empty basket". Emits one Remove From Basket per line, each carrying the
   * running subtotal after that line came out — so the LAST event (which is the
   * one Signals keeps for `cart_value`) reports 0.
   */
  const clearCart = useCallback(() => {
    let remaining = linesRef.current;
    for (const line of linesRef.current) {
      remaining = remaining.filter((l) => l.sku !== line.sku);
      moveUnits(line.sku, -line.qty, remaining);
    }
    commitLines([]);
    setPromoCode(null);
  }, [commitLines, moveUnits]);

  const resolved = useMemo<ResolvedLine[]>(
    () =>
      lines
        .map((line) => {
          const product = productBySku(line.sku);
          if (!product) return null;
          return {
            product,
            qty: line.qty,
            lineTotal: round2(product.price * line.qty),
          };
        })
        .filter((l): l is ResolvedLine => l !== null),
    [lines]
  );

  const itemCount = useMemo(
    () => resolved.reduce((sum, l) => sum + l.qty, 0),
    [resolved]
  );

  const subtotal = useMemo(
    () => round2(resolved.reduce((sum, l) => sum + l.lineTotal, 0)),
    [resolved]
  );

  const promoDiscount = useMemo(() => {
    if (!promoCode) return 0;
    const promo = PROMOS[promoCode];
    return promo ? round2((subtotal * promo.pct) / 100) : 0;
  }, [promoCode, subtotal]);

  const discountedSubtotal = round2(subtotal - promoDiscount);

  const deliveryFee =
    discountedSubtotal >= FREE_DELIVERY_THRESHOLD || discountedSubtotal === 0
      ? 0
      : DELIVERY_FEE;

  const total = round2(discountedSubtotal + deliveryFee);

  const amountToFreeDelivery = round2(
    Math.max(0, FREE_DELIVERY_THRESHOLD - discountedSubtotal)
  );

  const freeDeliveryProgress = Math.min(
    100,
    Math.round((discountedSubtotal / FREE_DELIVERY_THRESHOLD) * 100)
  );

  const applyPromo = useCallback((code: string) => {
    const key = code.trim().toUpperCase();
    if (!key) return { ok: false, message: 'Enter a code.' };
    const promo = PROMOS[key];
    if (!promo) return { ok: false, message: `"${key}" isn't a valid code.` };
    setPromoCode(key);
    return { ok: true, message: promo.label + ' applied.' };
  }, []);

  const clearPromo = useCallback(() => setPromoCode(null), []);

  // ─── Activity ────────────────────────────────────────────────────────────

  const recordProductView = useCallback(
    (product: Product) => {
      // CDI: View Product. Guarded on the SKU so a remount (or StrictMode's
      // double-invoked effect in dev) cannot send the same view twice.
      if (lastViewedSkuRef.current !== product.sku) {
        lastViewedSkuRef.current = product.sku;
        trackProductViewEvent(product);
      }
      const viewed = activityRef.current.viewed.filter(
        (v) => v.sku !== product.sku
      );
      viewed.push({
        sku: product.sku,
        name: product.name,
        aisle: product.aisle,
        at: Date.now(),
      });
      activityRef.current = {
        ...activityRef.current,
        viewed: viewed.slice(-30),
      };
      persistActivity();
    },
    [persistActivity]
  );

  const recordSearch = useCallback(
    (query: string) => {
      const q = query.trim();
      if (!q) return;
      const searches = activityRef.current.searches.filter(
        (s) => s.toLowerCase() !== q.toLowerCase()
      );
      searches.push(q);
      activityRef.current = {
        ...activityRef.current,
        searches: searches.slice(-20),
      };
      persistActivity();
    },
    [persistActivity]
  );

  const recordAisleVisit = useCallback(
    (aisleName: string) => {
      if (activityRef.current.aisles.includes(aisleName)) return;
      activityRef.current = {
        ...activityRef.current,
        aisles: [...activityRef.current.aisles, aisleName].slice(-20),
      };
      persistActivity();
    },
    [persistActivity]
  );

  const activityMeta = useCallback(
    () => ({
      pageCount: activityRef.current.pageCount,
      startedAt: activityRef.current.startedAt,
    }),
    []
  );

  // ─── Order ───────────────────────────────────────────────────────────────

  /**
   * Place the order, empty the basket, and fire Complete Transaction EXACTLY
   * ONCE. `revenue` is the order total the shopper actually paid — it already
   * includes the delivery fee where one is charged — and `deliveryFee` rides on
   * the transaction entity's `shipping`.
   */
  const placeOrder = useCallback(
    (
      order: Omit<PlacedOrder, 'placedAt' | 'reference'> & {
        deliveryFee?: number;
        paymentMethod?: string;
      }
    ) => {
      const { deliveryFee: fee = 0, paymentMethod = 'card', ...rest } = order;
      const placed: PlacedOrder = {
        ...rest,
        placedAt: Date.now(),
        reference: `BK-${Math.floor(100000 + Math.random() * 900000)}`,
      };

      // CDI: Complete Transaction. Fired from the snapshot of the basket taken
      // BEFORE it is emptied, one product entity per line with its line
      // quantity. Signals reads this as purchase_completed, so it must not be
      // duplicated — placeOrder is called once, from the payment submit.
      const lineSnapshot = resolved.map((l) => ({
        product: l.product,
        qty: l.qty,
      }));
      if (lineSnapshot.length > 0) {
        trackTransactionEvent({
          transactionId: placed.reference,
          revenue: placed.total,
          totalQuantity: placed.itemCount,
          shipping: fee,
          paymentMethod,
          discountCode: promoCode,
          discountAmount: promoDiscount,
          lines: lineSnapshot,
        });
      }

      setLastOrder(placed);
      writeJSON(window.localStorage, ORDER_KEY, placed);
      commitLines([]);
      setPromoCode(null);
      return placed;
    },
    [commitLines, promoCode, promoDiscount, resolved]
  );

  const value = useMemo<ShopContextValue>(
    () => ({
      lines,
      resolved,
      itemCount,
      subtotal,
      deliveryFee,
      total,
      freeDeliveryProgress,
      amountToFreeDelivery,
      qtyOf,
      addItem,
      setQty,
      removeItem,
      clearCart,
      promoCode,
      promoDiscount,
      applyPromo,
      clearPromo,
      recordProductView,
      recordSearch,
      recordAisleVisit,
      activityMeta,
      lastOrder,
      placeOrder,
      hydrated,
    }),
    [
      lines,
      resolved,
      itemCount,
      subtotal,
      deliveryFee,
      total,
      freeDeliveryProgress,
      amountToFreeDelivery,
      qtyOf,
      addItem,
      setQty,
      removeItem,
      clearCart,
      promoCode,
      promoDiscount,
      applyPromo,
      clearPromo,
      recordProductView,
      recordSearch,
      recordAisleVisit,
      activityMeta,
      lastOrder,
      placeOrder,
      hydrated,
    ]
  );

  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
}

export function useShop(): ShopContextValue {
  const ctx = useContext(ShopContext);
  if (ctx === undefined) {
    throw new Error('useShop must be used within a ShopProvider');
  }
  return ctx;
}
