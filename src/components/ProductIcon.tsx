'use client';

import {
  Apple,
  Banana,
  Bath,
  Bean,
  Beef,
  Beer,
  CakeSlice,
  Candy,
  Carrot,
  ChefHat,
  Cherry,
  Citrus,
  Coffee,
  Cookie,
  Croissant,
  Drumstick,
  Droplets,
  Egg,
  Fish,
  Flame,
  GlassWater,
  Grape,
  Ham,
  IceCreamCone,
  LeafyGreen,
  Martini,
  Milk,
  Nut,
  Package,
  PaintRoller,
  Pizza,
  Popsicle,
  Salad,
  Sandwich,
  Shirt,
  Snowflake,
  Soup,
  Sparkles,
  SprayCan,
  Sprout,
  Trash2,
  Utensils,
  WashingMachine,
  Wheat,
  Wine,
  CupSoda,
  Baby,
  Dog,
  type LucideIcon,
} from 'lucide-react';

import type { IconKey } from '@/lib/catalog';
import { cn } from '@/lib/utils';

/* ---------------------------------------------------------------------------
 * imageApproach is `icons-placeholders`. Rather than a missing-image grey box,
 * every product gets a deliberate line-art tile: a `surface` ground with a
 * thin-stroke Lucide glyph, so the grid reads as a designed catalogue.
 * ------------------------------------------------------------------------- */

const ICONS: Record<IconKey, LucideIcon> = {
  apple: Apple,
  carrot: Carrot,
  salad: Salad,
  'leafy-green': LeafyGreen,
  grape: Grape,
  cherry: Cherry,
  banana: Banana,
  citrus: Citrus,
  sprout: Sprout,
  milk: Milk,
  egg: Egg,
  'cake-slice': CakeSlice,
  croissant: Croissant,
  cookie: Cookie,
  sandwich: Sandwich,
  wheat: Wheat,
  beef: Beef,
  fish: Fish,
  drumstick: Drumstick,
  ham: Ham,
  soup: Soup,
  bean: Bean,
  nut: Nut,
  candy: Candy,
  utensils: Utensils,
  'chef-hat': ChefHat,
  flame: Flame,
  pizza: Pizza,
  popsicle: Popsicle,
  'ice-cream-cone': IceCreamCone,
  snowflake: Snowflake,
  coffee: Coffee,
  'cup-soda': CupSoda,
  'glass-water': GlassWater,
  wine: Wine,
  beer: Beer,
  martini: Martini,
  droplets: Droplets,
  'spray-can': SprayCan,
  'washing-machine': WashingMachine,
  'trash-2': Trash2,
  bath: Bath,
  sparkles: Sparkles,
  'paint-roller': PaintRoller,
  shirt: Shirt,
  dog: Dog,
  baby: Baby,
  package: Package,
};

export function ProductIcon({
  icon,
  className,
  size = 42,
}: {
  icon: IconKey;
  className?: string;
  size?: number;
}) {
  const Icon = ICONS[icon] ?? Package;
  return (
    <Icon
      size={size}
      strokeWidth={1.25}
      className={cn('text-muted', className)}
      aria-hidden
    />
  );
}

/**
 * The product tile — `surface` ground, centred glyph, optional citrus offer
 * badge and an out-of-stock veil.
 */
export function ProductTile({
  icon,
  offer,
  inStock = true,
  className,
  iconSize = 42,
}: {
  icon: IconKey;
  offer?: string;
  inStock?: boolean;
  className?: string;
  iconSize?: number;
}) {
  return (
    <div
      className={cn(
        'relative flex items-center justify-center overflow-hidden bg-surface',
        className
      )}
    >
      {/* A faint grid keeps the tile from reading as an empty placeholder. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            'linear-gradient(to right, #E3E7E5 1px, transparent 1px), linear-gradient(to bottom, #E3E7E5 1px, transparent 1px)',
          backgroundSize: '22px 22px',
        }}
      />
      <ProductIcon icon={icon} size={iconSize} className="relative" />
      {offer && (
        <span className="num absolute left-2 top-2 rounded-sm bg-highlight px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.06em] text-primary">
          {offer}
        </span>
      )}
      {!inStock && (
        <span className="absolute inset-x-0 bottom-0 bg-primary/85 py-1 text-center text-[10px] font-semibold uppercase tracking-wider text-inverse">
          Out of stock
        </span>
      )}
    </div>
  );
}
