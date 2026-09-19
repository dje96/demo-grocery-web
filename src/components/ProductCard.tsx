'use client';

import Link from 'next/link';

import { aisleName, formatGBP, type Product } from '@/lib/catalog';
import { ProductTile } from '@/components/ProductIcon';
import AddToBasket from '@/components/AddToBasket';
import { cn } from '@/lib/utils';

/**
 * The catalogue's core unit. Order is fixed by the style reference:
 * eyebrow (aisle, mono uppercase) → name → pack → price row → basket control.
 * Price and unit price are mono/tabular; nothing else on the card is.
 */
export default function ProductCard({
  product,
  className,
}: {
  product: Product;
  className?: string;
}) {
  return (
    <article
      className={cn(
        'group flex min-w-0 flex-col rounded-md border border-border bg-background transition-shadow hover:shadow-sm',
        className
      )}
    >
      <Link href={`/product/${product.sku}`} className="block">
        <ProductTile
          icon={product.icon}
          offer={product.offer}
          inStock={product.inStock}
          className="h-[118px] rounded-t-md"
        />
      </Link>

      <div className="flex flex-1 flex-col p-3">
        <p className="num mb-1.5 text-[9.5px] font-semibold uppercase tracking-[0.1em] text-muted">
          {aisleName(product.aisle)}
        </p>
        <h3 className="mb-0.5 font-heading text-[14.5px] font-bold leading-[1.25] tracking-[-0.02em] text-heading">
          <Link href={`/product/${product.sku}`} className="hover:text-accent">
            {product.name}
          </Link>
        </h3>
        <p className="mb-2.5 line-clamp-1 text-[12px] text-muted">{product.pack}</p>

        <div className="mt-auto">
          <div className="mb-2.5 flex items-baseline gap-2">
            <span className="num text-[17px] font-bold tracking-[-0.02em] text-primary">
              {formatGBP(product.price)}
            </span>
            <span className="num text-[10.5px] text-muted">{product.unitPrice}</span>
          </div>
          <AddToBasket sku={product.sku} inStock={product.inStock} />
        </div>
      </div>
    </article>
  );
}

/** The dense 2 → 3 → 4 → 5 up grid, 16px gap. */
export function ProductGrid({
  products,
  className,
}: {
  products: Product[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        'grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5',
        className
      )}
    >
      {products.map((product) => (
        <ProductCard key={product.sku} product={product} />
      ))}
    </div>
  );
}
