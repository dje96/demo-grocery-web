/**
 * Basket — product catalogue.
 *
 * The full grocery catalogue for the demo: 8 aisles, 76 SKUs. `src/lib/config.ts`
 * re-exports the aisles as `categories` so the plumbing's config contract is
 * honored, while pages import the richer types from here.
 *
 * Every product carries a Lucide icon key (imageApproach is `icons-placeholders`),
 * a pack description, a £ price, a PRE-COMPUTED unit price string, and dietary
 * badges. Numerics are rendered by the UI in IBM Plex Mono (`.num`).
 */

export type AisleSlug =
  | 'produce'
  | 'dairy-eggs'
  | 'bakery'
  | 'meat-fish'
  | 'pantry'
  | 'frozen'
  | 'drinks'
  | 'household';

/** Keys into the icon map in `src/components/ProductIcon.tsx`. */
export type IconKey =
  | 'apple'
  | 'carrot'
  | 'salad'
  | 'leafy-green'
  | 'grape'
  | 'cherry'
  | 'banana'
  | 'citrus'
  | 'sprout'
  | 'milk'
  | 'egg'
  | 'cake-slice'
  | 'croissant'
  | 'cookie'
  | 'sandwich'
  | 'wheat'
  | 'beef'
  | 'fish'
  | 'drumstick'
  | 'ham'
  | 'soup'
  | 'bean'
  | 'nut'
  | 'candy'
  | 'utensils'
  | 'chef-hat'
  | 'flame'
  | 'pizza'
  | 'popsicle'
  | 'ice-cream-cone'
  | 'snowflake'
  | 'coffee'
  | 'cup-soda'
  | 'glass-water'
  | 'wine'
  | 'beer'
  | 'martini'
  | 'droplets'
  | 'spray-can'
  | 'washing-machine'
  | 'trash-2'
  | 'bath'
  | 'sparkles'
  | 'paint-roller'
  | 'shirt'
  | 'dog'
  | 'baby'
  | 'package';

export interface Aisle {
  slug: AisleSlug;
  name: string;
  blurb: string;
  icon: IconKey;
}

export interface Product {
  sku: string;
  name: string;
  aisle: AisleSlug;
  brand: string;
  /** Pack description, e.g. "Ripe & ready · Pack of 4". */
  pack: string;
  /** Price in GBP. */
  price: number;
  /** PRE-COMPUTED unit price label, e.g. "96p/ea". Never derived in the view. */
  unitPrice: string;
  description: string;
  badges: string[];
  icon: IconKey;
  /** Small citrus flag on the product tile. */
  offer?: 'OFFER' | 'NEW' | 'LOW PRICE';
  inStock: boolean;
  allergens: string[];
  /** Per-100g / per-serving nutrition rows for the product detail panel. */
  nutrition: { label: string; value: string }[];
}

// ─── Aisles ──────────────────────────────────────────────────────────────────

export const aisles: Aisle[] = [
  { slug: 'produce', name: 'Produce', blurb: 'Fruit, veg and salad picked this week', icon: 'carrot' },
  { slug: 'dairy-eggs', name: 'Dairy & Eggs', blurb: 'Milk, cheese, yoghurt and eggs', icon: 'milk' },
  { slug: 'bakery', name: 'Bakery', blurb: 'Baked in store every morning', icon: 'croissant' },
  { slug: 'meat-fish', name: 'Meat & Fish', blurb: 'British butchery and day-boat fish', icon: 'beef' },
  { slug: 'pantry', name: 'Pantry', blurb: 'Store-cupboard staples and oils', icon: 'soup' },
  { slug: 'frozen', name: 'Frozen', blurb: 'Freezer fillers and desserts', icon: 'snowflake' },
  { slug: 'drinks', name: 'Drinks', blurb: 'Coffee, soft drinks, beer and wine', icon: 'cup-soda' },
  { slug: 'household', name: 'Household', blurb: 'Cleaning, laundry and home essentials', icon: 'spray-can' },
];

const N = (label: string, value: string) => ({ label, value });

const STD_NUTRITION = [
  N('Energy', '—'),
  N('Fat', '—'),
  N('Carbohydrate', '—'),
  N('Protein', '—'),
  N('Salt', '—'),
];

function nut(kcal: string, fat: string, carbs: string, protein: string, salt: string) {
  return [
    N('Energy', kcal),
    N('Fat', fat),
    N('Carbohydrate', carbs),
    N('Protein', protein),
    N('Salt', salt),
  ];
}

// ─── Products ────────────────────────────────────────────────────────────────

export const products: Product[] = [
  // ── Produce ──────────────────────────────────────────────────────────────
  {
    sku: 'PRD-0101', name: 'Organic Hass Avocados', aisle: 'produce', brand: 'Basket Organic',
    pack: 'Ripe & ready · Pack of 4', price: 3.85, unitPrice: '96p/ea',
    description: 'Grown in Andalusia and delivered within 48 hours of picking. Ripe and ready to eat — no waiting on the windowsill.',
    badges: ['Organic', 'Vegan'], icon: 'apple', offer: 'OFFER', inStock: true, allergens: [],
    nutrition: nut('160 kcal', '14.7g', '1.8g', '2.0g', '0.01g'),
  },
  {
    sku: 'PRD-0102', name: 'Cherry Tomatoes On The Vine', aisle: 'produce', brand: 'Basket',
    pack: 'On the vine · 250g', price: 1.75, unitPrice: '70p/100g',
    description: 'Sweet vine-ripened cherry tomatoes from the Isle of Wight. Picked on the truss for a longer shelf life.',
    badges: ['Vegan', 'British'], icon: 'cherry', offer: 'NEW', inStock: true, allergens: [],
    nutrition: nut('20 kcal', '0.3g', '3.1g', '0.7g', '0.02g'),
  },
  {
    sku: 'PRD-0103', name: 'Baby Leaf Spinach', aisle: 'produce', brand: 'Basket',
    pack: 'Washed & ready · 200g', price: 1.40, unitPrice: '70p/100g',
    description: 'Tender baby leaves, triple washed and ready to use straight from the bag.',
    badges: ['Vegan', 'High iron'], icon: 'leafy-green', inStock: true, allergens: [],
    nutrition: nut('25 kcal', '0.6g', '1.6g', '2.8g', '0.16g'),
  },
  {
    sku: 'PRD-0104', name: 'British Maris Piper Potatoes', aisle: 'produce', brand: 'Basket',
    pack: 'Loose · 2.5kg', price: 2.30, unitPrice: '92p/kg',
    description: 'The all-rounder. Fluffy inside for roasting and mashing, holds together for chips.',
    badges: ['Vegan', 'British'], icon: 'sprout', inStock: true, allergens: [],
    nutrition: nut('75 kcal', '0.3g', '16.2g', '1.8g', '0.01g'),
  },
  {
    sku: 'PRD-0105', name: 'Bananas', aisle: 'produce', brand: 'Basket Fairtrade',
    pack: 'Loose · Pack of 5', price: 1.05, unitPrice: '21p/ea',
    description: 'Fairtrade bananas from smallholder co-operatives in the Dominican Republic.',
    badges: ['Vegan', 'Fairtrade'], icon: 'banana', inStock: true, allergens: [],
    nutrition: nut('95 kcal', '0.3g', '21.0g', '1.2g', '0.00g'),
  },
  {
    sku: 'PRD-0106', name: 'Seedless Red Grapes', aisle: 'produce', brand: 'Basket',
    pack: 'Punnet · 500g', price: 2.75, unitPrice: '55p/100g',
    description: 'Crisp, seedless and deep red. Best straight from the fridge.',
    badges: ['Vegan'], icon: 'grape', inStock: true, allergens: [],
    nutrition: nut('69 kcal', '0.2g', '15.5g', '0.6g', '0.00g'),
  },
  {
    sku: 'PRD-0107', name: 'Chantenay Carrots', aisle: 'produce', brand: 'Basket',
    pack: 'Sweet & small · 400g', price: 1.15, unitPrice: '29p/100g',
    description: 'Small, sweet and no peeling required. Roast whole with a little honey.',
    badges: ['Vegan', 'British'], icon: 'carrot', inStock: true, allergens: [],
    nutrition: nut('41 kcal', '0.2g', '7.6g', '0.9g', '0.07g'),
  },
  {
    sku: 'PRD-0108', name: 'Mixed Salad Bowl', aisle: 'produce', brand: 'Basket',
    pack: 'Four leaf mix · 180g', price: 1.60, unitPrice: '89p/100g',
    description: 'Lollo rosso, lambs lettuce, rocket and baby gem. Washed and ready to dress.',
    badges: ['Vegan', 'Gluten free'], icon: 'salad', inStock: true, allergens: [],
    nutrition: nut('17 kcal', '0.4g', '1.9g', '1.3g', '0.03g'),
  },
  {
    sku: 'PRD-0109', name: 'Sicilian Lemons', aisle: 'produce', brand: 'Basket',
    pack: 'Unwaxed · Pack of 4', price: 1.45, unitPrice: '36p/ea',
    description: 'Unwaxed Sicilian lemons — zest as freely as you juice.',
    badges: ['Vegan'], icon: 'citrus', inStock: true, allergens: [],
    nutrition: nut('29 kcal', '0.3g', '3.2g', '1.1g', '0.00g'),
  },
  {
    sku: 'PRD-0110', name: 'Tenderstem Broccoli', aisle: 'produce', brand: 'Basket',
    pack: 'Trimmed · 200g', price: 2.20, unitPrice: '£1.10/100g',
    description: 'Long, tender stems — no trimming, no waste. Two minutes in a hot pan.',
    badges: ['Vegan', 'British'], icon: 'sprout', inStock: false, allergens: [],
    nutrition: nut('35 kcal', '0.4g', '3.0g', '3.8g', '0.03g'),
  },

  // ── Dairy & Eggs ─────────────────────────────────────────────────────────
  {
    sku: 'DRY-0201', name: 'Semi-Skimmed Milk', aisle: 'dairy-eggs', brand: 'Basket British Dairy',
    pack: 'British · 2 litres', price: 1.45, unitPrice: '73p/l',
    description: 'Fresh British semi-skimmed milk from a pool of 42 farms, all Red Tractor assured.',
    badges: ['British', 'Vegetarian'], icon: 'milk', inStock: true, allergens: ['Milk'],
    nutrition: nut('50 kcal', '1.8g', '4.8g', '3.6g', '0.11g'),
  },
  {
    sku: 'DRY-0202', name: 'Free-Range Large Eggs', aisle: 'dairy-eggs', brand: 'Basket',
    pack: 'Free range · Box of 6', price: 2.20, unitPrice: '37p/ea',
    description: 'Large free-range eggs from British hens with year-round outdoor access.',
    badges: ['Free range', 'British', 'Vegetarian'], icon: 'egg', offer: 'OFFER', inStock: true, allergens: ['Egg'],
    nutrition: nut('131 kcal', '9.0g', '0.0g', '12.6g', '0.38g'),
  },
  {
    sku: 'DRY-0203', name: 'Mature Cheddar', aisle: 'dairy-eggs', brand: 'Basket West Country',
    pack: 'Extra mature · 350g', price: 3.90, unitPrice: '£1.11/100g',
    description: 'West Country farmhouse cheddar matured for 18 months. Crumbly, sharp, deeply savoury.',
    badges: ['Vegetarian', 'British'], icon: 'cake-slice', inStock: true, allergens: ['Milk'],
    nutrition: nut('416 kcal', '34.9g', '0.1g', '25.4g', '1.80g'),
  },
  {
    sku: 'DRY-0204', name: 'Greek Style Natural Yoghurt', aisle: 'dairy-eggs', brand: 'Basket',
    pack: 'Thick set · 500g', price: 2.10, unitPrice: '42p/100g',
    description: 'Strained for a thick, spoon-standing set. Nothing but milk and live cultures.',
    badges: ['Vegetarian', 'High protein'], icon: 'milk', inStock: true, allergens: ['Milk'],
    nutrition: nut('133 kcal', '10.2g', '4.7g', '5.7g', '0.14g'),
  },
  {
    sku: 'DRY-0205', name: 'Salted British Butter', aisle: 'dairy-eggs', brand: 'Basket',
    pack: 'Churned block · 250g', price: 2.40, unitPrice: '96p/100g',
    description: 'Slow-churned British butter with a clean salt finish. Good on toast, better in pastry.',
    badges: ['Vegetarian', 'British'], icon: 'cake-slice', inStock: true, allergens: ['Milk'],
    nutrition: nut('744 kcal', '82.2g', '0.6g', '0.6g', '1.70g'),
  },
  {
    sku: 'DRY-0206', name: 'Oat Drink Barista', aisle: 'dairy-eggs', brand: 'Basket Plant',
    pack: 'Barista blend · 1 litre', price: 1.85, unitPrice: '£1.85/l',
    description: 'Steams and foams like whole milk without splitting in hot coffee.',
    badges: ['Vegan', 'Dairy free'], icon: 'milk', offer: 'NEW', inStock: true, allergens: ['Oats'],
    nutrition: nut('59 kcal', '3.0g', '6.7g', '1.0g', '0.10g'),
  },
  {
    sku: 'DRY-0207', name: 'Mozzarella Ball', aisle: 'dairy-eggs', brand: 'Basket',
    pack: 'In brine · 125g', price: 0.95, unitPrice: '76p/100g',
    description: 'Soft cow’s milk mozzarella in brine. Tear over tomatoes, or melt onto a pizza base.',
    badges: ['Vegetarian'], icon: 'cake-slice', inStock: true, allergens: ['Milk'],
    nutrition: nut('254 kcal', '19.0g', '1.6g', '18.5g', '0.55g'),
  },
  {
    sku: 'DRY-0208', name: 'Double Cream', aisle: 'dairy-eggs', brand: 'Basket',
    pack: 'Fresh · 300ml', price: 1.70, unitPrice: '57p/100ml',
    description: 'Fresh double cream that whips in under a minute and holds its peak.',
    badges: ['Vegetarian', 'British'], icon: 'milk', inStock: true, allergens: ['Milk'],
    nutrition: nut('449 kcal', '47.5g', '2.7g', '1.7g', '0.08g'),
  },
  {
    sku: 'DRY-0209', name: 'Blueberry Skyr', aisle: 'dairy-eggs', brand: 'Basket',
    pack: 'Fat free · 4 x 150g', price: 3.25, unitPrice: '81p/pot',
    description: 'Icelandic-style strained skyr with a blueberry compote layer. 18g of protein per pot.',
    badges: ['High protein', 'Vegetarian'], icon: 'milk', inStock: true, allergens: ['Milk'],
    nutrition: nut('67 kcal', '0.2g', '5.9g', '10.5g', '0.09g'),
  },

  // ── Bakery ───────────────────────────────────────────────────────────────
  {
    sku: 'BAK-0301', name: 'Sourdough Bloomer', aisle: 'bakery', brand: 'Basket Bakery',
    pack: 'Baked in store · 800g', price: 2.80, unitPrice: '35p/100g',
    description: 'A 36-hour ferment, baked in store each morning. Open crumb, blistered crust.',
    badges: ['Vegan'], icon: 'wheat', inStock: true, allergens: ['Wheat', 'Gluten'],
    nutrition: nut('247 kcal', '1.1g', '48.8g', '8.6g', '1.10g'),
  },
  {
    sku: 'BAK-0302', name: 'All-Butter Croissants', aisle: 'bakery', brand: 'Basket Bakery',
    pack: 'Pack of 4', price: 2.25, unitPrice: '56p/ea',
    description: 'Laminated with French butter over 27 folds. Warm for six minutes before serving.',
    badges: ['Vegetarian'], icon: 'croissant', offer: 'OFFER', inStock: true, allergens: ['Wheat', 'Gluten', 'Milk', 'Egg'],
    nutrition: nut('406 kcal', '22.0g', '43.0g', '8.0g', '0.90g'),
  },
  {
    sku: 'BAK-0303', name: 'Seeded Wholemeal Loaf', aisle: 'bakery', brand: 'Basket Bakery',
    pack: 'Sliced · 800g', price: 1.60, unitPrice: '20p/100g',
    description: 'Stoneground wholemeal with sunflower, pumpkin and linseed through the crumb.',
    badges: ['Vegan', 'High fibre'], icon: 'wheat', inStock: true, allergens: ['Wheat', 'Gluten', 'Sesame'],
    nutrition: nut('232 kcal', '3.6g', '36.5g', '10.1g', '0.95g'),
  },
  {
    sku: 'BAK-0304', name: 'Brioche Burger Buns', aisle: 'bakery', brand: 'Basket Bakery',
    pack: 'Pack of 4', price: 1.75, unitPrice: '44p/ea',
    description: 'Enriched, glossy and soft enough to squash — but they hold a loaded burger.',
    badges: ['Vegetarian'], icon: 'sandwich', inStock: true, allergens: ['Wheat', 'Gluten', 'Milk', 'Egg'],
    nutrition: nut('310 kcal', '8.4g', '48.0g', '9.2g', '1.05g'),
  },
  {
    sku: 'BAK-0305', name: 'Pain Au Chocolat', aisle: 'bakery', brand: 'Basket Bakery',
    pack: 'Pack of 4', price: 2.50, unitPrice: '63p/ea',
    description: 'Two batons of dark Belgian chocolate in all-butter laminated pastry.',
    badges: ['Vegetarian'], icon: 'croissant', inStock: true, allergens: ['Wheat', 'Gluten', 'Milk', 'Egg', 'Soya'],
    nutrition: nut('427 kcal', '24.0g', '44.0g', '7.5g', '0.75g'),
  },
  {
    sku: 'BAK-0306', name: 'Soft White Rolls', aisle: 'bakery', brand: 'Basket Bakery',
    pack: 'Pack of 6', price: 1.10, unitPrice: '18p/ea',
    description: 'Pillowy white rolls, floured tops. Lunchbox standard.',
    badges: ['Vegan'], icon: 'sandwich', inStock: true, allergens: ['Wheat', 'Gluten'],
    nutrition: nut('263 kcal', '2.0g', '51.0g', '8.9g', '1.00g'),
  },
  {
    sku: 'BAK-0307', name: 'Salted Caramel Cookies', aisle: 'bakery', brand: 'Basket Bakery',
    pack: 'Pack of 4', price: 2.00, unitPrice: '50p/ea',
    description: 'Thick, chewy and studded with caramel shards, finished with sea salt flakes.',
    badges: ['Vegetarian'], icon: 'cookie', offer: 'NEW', inStock: true, allergens: ['Wheat', 'Gluten', 'Milk', 'Egg'],
    nutrition: nut('468 kcal', '22.5g', '60.0g', '5.4g', '0.85g'),
  },
  {
    sku: 'BAK-0308', name: 'Rustic Ciabatta', aisle: 'bakery', brand: 'Basket Bakery',
    pack: 'Part baked · 2 pack', price: 1.35, unitPrice: '68p/ea',
    description: 'Part-baked ciabatta — ten minutes in the oven to a crackling crust.',
    badges: ['Vegan'], icon: 'wheat', inStock: true, allergens: ['Wheat', 'Gluten'],
    nutrition: nut('271 kcal', '3.2g', '51.2g', '9.0g', '1.20g'),
  },
  {
    sku: 'BAK-0309', name: 'Gluten Free Seeded Loaf', aisle: 'bakery', brand: 'Basket Free From',
    pack: 'Sliced · 400g', price: 2.85, unitPrice: '71p/100g',
    description: 'A gluten free loaf that actually toasts. Rice, buckwheat and four seeds.',
    badges: ['Gluten free', 'Vegan'], icon: 'wheat', inStock: true, allergens: ['Soya'],
    nutrition: nut('254 kcal', '6.8g', '40.1g', '3.9g', '1.05g'),
  },

  // ── Meat & Fish ──────────────────────────────────────────────────────────
  {
    sku: 'MTF-0401', name: 'British Chicken Breast Fillets', aisle: 'meat-fish', brand: 'Basket Butchery',
    pack: 'Skinless · 650g', price: 5.50, unitPrice: '£8.46/kg',
    description: 'RSPCA Assured British chicken breast, trimmed and skinless.',
    badges: ['High protein', 'British', 'RSPCA Assured'], icon: 'drumstick', inStock: true, allergens: [],
    nutrition: nut('106 kcal', '1.1g', '0.0g', '24.0g', '0.15g'),
  },
  {
    sku: 'MTF-0402', name: '28-Day Aged Ribeye Steak', aisle: 'meat-fish', brand: 'Basket Butchery',
    pack: 'Dry aged · 2 x 225g', price: 12.50, unitPrice: '£27.78/kg',
    description: 'Dry-aged for 28 days on the bone, then cut thick. Rest it as long as you cook it.',
    badges: ['High protein', 'British'], icon: 'beef', offer: 'OFFER', inStock: true, allergens: [],
    nutrition: nut('219 kcal', '13.9g', '0.0g', '23.1g', '0.16g'),
  },
  {
    sku: 'MTF-0403', name: 'Scottish Salmon Fillets', aisle: 'meat-fish', brand: 'Basket Fishmonger',
    pack: 'Skin on · 2 x 130g', price: 5.75, unitPrice: '£22.12/kg',
    description: 'Responsibly farmed Scottish salmon, pin-boned, skin on for crisping.',
    badges: ['High protein', 'Omega-3'], icon: 'fish', inStock: true, allergens: ['Fish'],
    nutrition: nut('215 kcal', '13.6g', '0.0g', '22.8g', '0.13g'),
  },
  {
    sku: 'MTF-0404', name: 'British Beef Mince 5% Fat', aisle: 'meat-fish', brand: 'Basket Butchery',
    pack: 'Lean · 500g', price: 4.25, unitPrice: '£8.50/kg',
    description: 'Lean British beef mince — good for a bolognese that doesn’t need draining.',
    badges: ['High protein', 'British'], icon: 'beef', inStock: true, allergens: [],
    nutrition: nut('129 kcal', '5.0g', '0.0g', '21.0g', '0.20g'),
  },
  {
    sku: 'MTF-0405', name: 'Dry-Cure Smoked Back Bacon', aisle: 'meat-fish', brand: 'Basket Butchery',
    pack: 'Smoked · 300g', price: 3.40, unitPrice: '£11.33/kg',
    description: 'Dry-cured over ten days and oak smoked. No added water, so it fries rather than boils.',
    badges: ['British'], icon: 'ham', inStock: true, allergens: [],
    nutrition: nut('215 kcal', '14.0g', '0.6g', '22.0g', '2.50g'),
  },
  {
    sku: 'MTF-0406', name: 'Cumberland Sausages', aisle: 'meat-fish', brand: 'Basket Butchery',
    pack: 'Thick · Pack of 6', price: 3.60, unitPrice: '60p/ea',
    description: 'Coarse-cut pork with white pepper and a coil of sage. Outdoor-bred British pork.',
    badges: ['British'], icon: 'ham', inStock: true, allergens: ['Wheat', 'Gluten', 'Sulphites'],
    nutrition: nut('287 kcal', '22.0g', '6.0g', '15.5g', '1.40g'),
  },
  {
    sku: 'MTF-0407', name: 'King Prawns', aisle: 'meat-fish', brand: 'Basket Fishmonger',
    pack: 'Raw & peeled · 200g', price: 4.50, unitPrice: '£22.50/kg',
    description: 'Raw, peeled and deveined king prawns. Two minutes a side, no more.',
    badges: ['High protein', 'MSC certified'], icon: 'fish', inStock: true, allergens: ['Crustaceans'],
    nutrition: nut('76 kcal', '0.7g', '0.4g', '17.6g', '0.60g'),
  },
  {
    sku: 'MTF-0408', name: 'Cod Loin Fillets', aisle: 'meat-fish', brand: 'Basket Fishmonger',
    pack: 'Line caught · 2 x 140g', price: 6.25, unitPrice: '£22.32/kg',
    description: 'Thick, flaking cod loin from line-caught Atlantic stocks.',
    badges: ['High protein', 'MSC certified'], icon: 'fish', inStock: false, allergens: ['Fish'],
    nutrition: nut('82 kcal', '0.7g', '0.0g', '18.3g', '0.24g'),
  },
  {
    sku: 'MTF-0409', name: 'Plant Based Mince', aisle: 'meat-fish', brand: 'Basket Plant',
    pack: 'Soya & pea · 400g', price: 2.95, unitPrice: '£7.38/kg',
    description: 'Browns and crumbles like beef mince. Soya and pea protein, nothing exotic.',
    badges: ['Vegan', 'High protein'], icon: 'bean', offer: 'NEW', inStock: true, allergens: ['Soya'],
    nutrition: nut('157 kcal', '6.4g', '5.5g', '17.2g', '0.85g'),
  },

  // ── Pantry ───────────────────────────────────────────────────────────────
  {
    sku: 'PAN-0501', name: 'Cold-Pressed Olive Oil', aisle: 'pantry', brand: 'Basket Select',
    pack: 'Extra virgin · 500ml', price: 6.50, unitPrice: '£1.30/100ml',
    description: 'Single-estate Puglian oil, cold pressed within four hours of harvest. Grassy and peppery.',
    badges: ['Vegan', 'Gluten free'], icon: 'droplets', inStock: true, allergens: [],
    nutrition: nut('824 kcal', '91.6g', '0.0g', '0.0g', '0.00g'),
  },
  {
    sku: 'PAN-0502', name: 'Bronze Die Spaghetti', aisle: 'pantry', brand: 'Basket Select',
    pack: 'Durum wheat · 500g', price: 1.30, unitPrice: '26p/100g',
    description: 'Extruded through bronze dies for a rough surface that actually holds sauce.',
    badges: ['Vegan'], icon: 'utensils', inStock: true, allergens: ['Wheat', 'Gluten'],
    nutrition: nut('358 kcal', '1.5g', '71.2g', '12.5g', '0.01g'),
  },
  {
    sku: 'PAN-0503', name: 'Italian Chopped Tomatoes', aisle: 'pantry', brand: 'Basket',
    pack: 'Tinned · 4 x 400g', price: 2.40, unitPrice: '60p/tin',
    description: 'Late-harvest Italian plum tomatoes, chopped in their own juice. No citric acid.',
    badges: ['Vegan', 'Gluten free'], icon: 'soup', offer: 'LOW PRICE', inStock: true, allergens: [],
    nutrition: nut('22 kcal', '0.2g', '3.6g', '1.1g', '0.03g'),
  },
  {
    sku: 'PAN-0504', name: 'Basmati Rice', aisle: 'pantry', brand: 'Basket',
    pack: 'Aged 12 months · 1kg', price: 2.85, unitPrice: '£2.85/kg',
    description: 'Aged for twelve months so the grains stay long and separate.',
    badges: ['Vegan', 'Gluten free'], icon: 'package', inStock: true, allergens: [],
    nutrition: nut('349 kcal', '0.9g', '77.6g', '8.5g', '0.01g'),
  },
  {
    sku: 'PAN-0505', name: 'Chickpeas', aisle: 'pantry', brand: 'Basket',
    pack: 'In water · 4 x 400g', price: 2.20, unitPrice: '55p/tin',
    description: 'Firm chickpeas in water with no added salt. Drain, don’t rinse, for better hummus.',
    badges: ['Vegan', 'Gluten free', 'High fibre'], icon: 'bean', inStock: true, allergens: [],
    nutrition: nut('115 kcal', '2.4g', '16.1g', '7.2g', '0.02g'),
  },
  {
    sku: 'PAN-0506', name: 'Peanut Butter, Crunchy', aisle: 'pantry', brand: 'Basket',
    pack: '100% nuts · 340g', price: 2.75, unitPrice: '81p/100g',
    description: 'Just roasted peanuts and a pinch of salt. Stir the oil back in.',
    badges: ['Vegan', 'No added sugar', 'High protein'], icon: 'nut', inStock: true, allergens: ['Peanuts'],
    nutrition: nut('614 kcal', '50.5g', '9.5g', '27.1g', '0.60g'),
  },
  {
    sku: 'PAN-0507', name: 'Colombian Ground Coffee', aisle: 'pantry', brand: 'Basket Select',
    pack: 'Medium roast · 227g', price: 4.20, unitPrice: '£1.85/100g',
    description: 'Washed Huila beans, medium roast. Caramel and cocoa, ground for filter.',
    badges: ['Fairtrade', 'Vegan'], icon: 'coffee', inStock: true, allergens: [],
    nutrition: STD_NUTRITION,
  },
  {
    sku: 'PAN-0508', name: 'Rolled Porridge Oats', aisle: 'pantry', brand: 'Basket',
    pack: 'Scottish · 1kg', price: 1.50, unitPrice: '£1.50/kg',
    description: 'Scottish rolled oats, jumbo cut. Four minutes on the hob for a proper porridge.',
    badges: ['Vegan', 'High fibre'], icon: 'wheat', inStock: true, allergens: ['Oats', 'Gluten'],
    nutrition: nut('372 kcal', '8.0g', '58.0g', '11.0g', '0.02g'),
  },
  {
    sku: 'PAN-0509', name: 'Dark Chocolate 70%', aisle: 'pantry', brand: 'Basket Select',
    pack: 'Single origin · 100g', price: 2.10, unitPrice: '£2.10/100g',
    description: 'Single-origin Ecuadorian cacao at 70%. Snaps cleanly, melts slowly.',
    badges: ['Vegetarian', 'Fairtrade'], icon: 'candy', inStock: true, allergens: ['Soya', 'Milk'],
    nutrition: nut('576 kcal', '42.0g', '33.0g', '9.0g', '0.02g'),
  },
  {
    sku: 'PAN-0510', name: 'Maldon Sea Salt Flakes', aisle: 'pantry', brand: 'Basket Select',
    pack: 'Pyramid flakes · 250g', price: 3.10, unitPrice: '£1.24/100g',
    description: 'Hand-harvested pyramid flakes that crush between your fingers.',
    badges: ['Vegan', 'Gluten free'], icon: 'sparkles', inStock: true, allergens: [],
    nutrition: STD_NUTRITION,
  },

  // ── Frozen ───────────────────────────────────────────────────────────────
  {
    sku: 'FRZ-0601', name: 'Garden Peas', aisle: 'frozen', brand: 'Basket',
    pack: 'Frozen in 2hrs · 900g', price: 1.75, unitPrice: '19p/100g',
    description: 'Podded and frozen within two hours of picking, so they stay sweet.',
    badges: ['Vegan', 'Gluten free'], icon: 'bean', inStock: true, allergens: [],
    nutrition: nut('81 kcal', '0.9g', '9.6g', '5.4g', '0.01g'),
  },
  {
    sku: 'FRZ-0602', name: 'Triple Cooked Chips', aisle: 'frozen', brand: 'Basket',
    pack: 'Chunky cut · 1kg', price: 2.80, unitPrice: '28p/100g',
    description: 'Blanched, chilled, then fried twice. Fluffy middle, glassy shell.',
    badges: ['Vegan'], icon: 'flame', offer: 'OFFER', inStock: true, allergens: [],
    nutrition: nut('162 kcal', '5.4g', '24.5g', '2.8g', '0.30g'),
  },
  {
    sku: 'FRZ-0603', name: 'Stone Baked Margherita Pizza', aisle: 'frozen', brand: 'Basket Select',
    pack: 'Stone baked · 380g', price: 3.50, unitPrice: '92p/100g',
    description: 'A 24-hour proved base, San Marzano passata and fior di latte.',
    badges: ['Vegetarian'], icon: 'pizza', inStock: true, allergens: ['Wheat', 'Gluten', 'Milk'],
    nutrition: nut('252 kcal', '8.2g', '33.0g', '11.0g', '1.10g'),
  },
  {
    sku: 'FRZ-0604', name: 'Vanilla Bean Ice Cream', aisle: 'frozen', brand: 'Basket Select',
    pack: 'Madagascan vanilla · 500ml', price: 3.95, unitPrice: '79p/100ml',
    description: 'Churned slowly with real Madagascan vanilla seeds and British double cream.',
    badges: ['Vegetarian'], icon: 'ice-cream-cone', inStock: true, allergens: ['Milk', 'Egg'],
    nutrition: nut('212 kcal', '12.0g', '22.5g', '3.5g', '0.12g'),
  },
  {
    sku: 'FRZ-0605', name: 'Breaded Cod Fillets', aisle: 'frozen', brand: 'Basket',
    pack: 'Crumbed · 4 pack', price: 4.40, unitPrice: '£1.10/ea',
    description: 'Whole cod fillets in a light golden crumb. Oven only — no frying needed.',
    badges: ['MSC certified'], icon: 'fish', inStock: true, allergens: ['Fish', 'Wheat', 'Gluten'],
    nutrition: nut('198 kcal', '8.0g', '17.0g', '13.5g', '0.70g'),
  },
  {
    sku: 'FRZ-0606', name: 'Mixed Berry Blend', aisle: 'frozen', brand: 'Basket',
    pack: 'Four fruits · 500g', price: 3.20, unitPrice: '64p/100g',
    description: 'Strawberry, raspberry, blackberry and blueberry. Straight into the blender.',
    badges: ['Vegan', 'Gluten free'], icon: 'cherry', inStock: true, allergens: [],
    nutrition: nut('44 kcal', '0.4g', '7.2g', '1.1g', '0.01g'),
  },
  {
    sku: 'FRZ-0607', name: 'Vegetable Spring Rolls', aisle: 'frozen', brand: 'Basket',
    pack: 'Party size · 12 pack', price: 2.65, unitPrice: '22p/ea',
    description: 'Crisp wrappers around cabbage, carrot and glass noodle.',
    badges: ['Vegan'], icon: 'popsicle', inStock: true, allergens: ['Wheat', 'Gluten', 'Soya', 'Sesame'],
    nutrition: nut('221 kcal', '9.0g', '29.0g', '4.2g', '0.95g'),
  },
  {
    sku: 'FRZ-0608', name: 'Yorkshire Puddings', aisle: 'frozen', brand: 'Basket',
    pack: 'Tall risen · 12 pack', price: 1.90, unitPrice: '16p/ea',
    description: 'Deep, crisp-walled Yorkshires. Five minutes from freezer to table.',
    badges: ['Vegetarian', 'British'], icon: 'chef-hat', inStock: true, allergens: ['Wheat', 'Gluten', 'Milk', 'Egg'],
    nutrition: nut('306 kcal', '11.0g', '41.0g', '9.5g', '0.85g'),
  },
  {
    sku: 'FRZ-0609', name: 'Salted Caramel Gelato Sticks', aisle: 'frozen', brand: 'Basket Select',
    pack: 'Dipped · 4 pack', price: 4.25, unitPrice: '£1.06/ea',
    description: 'Salted caramel gelato on a stick, dipped in cracking dark chocolate.',
    badges: ['Vegetarian'], icon: 'popsicle', offer: 'NEW', inStock: true, allergens: ['Milk', 'Soya'],
    nutrition: nut('286 kcal', '18.0g', '27.5g', '3.6g', '0.30g'),
  },

  // ── Drinks ───────────────────────────────────────────────────────────────
  {
    sku: 'DRK-0701', name: 'Still Spring Water', aisle: 'drinks', brand: 'Basket',
    pack: 'Still · 6 x 1.5l', price: 2.40, unitPrice: '27p/l',
    description: 'Naturally filtered Welsh spring water in 100% recycled bottles.',
    badges: ['Vegan', 'Recyclable'], icon: 'glass-water', inStock: true, allergens: [],
    nutrition: STD_NUTRITION,
  },
  {
    sku: 'DRK-0702', name: 'Sicilian Lemonade', aisle: 'drinks', brand: 'Basket Select',
    pack: 'Sparkling · 4 x 250ml', price: 3.30, unitPrice: '83p/ea',
    description: 'Sparkling lemonade pressed from Sicilian lemons. Sharp, barely sweet.',
    badges: ['Vegan'], icon: 'cup-soda', inStock: true, allergens: [],
    nutrition: nut('34 kcal', '0.0g', '8.2g', '0.0g', '0.01g'),
  },
  {
    sku: 'DRK-0703', name: 'Cold Brew Coffee', aisle: 'drinks', brand: 'Basket Select',
    pack: 'Black · 750ml', price: 3.75, unitPrice: '50p/100ml',
    description: 'Steeped for 18 hours cold. Low acid, no bitterness, serve over ice.',
    badges: ['Vegan', 'No added sugar'], icon: 'coffee', offer: 'NEW', inStock: true, allergens: [],
    nutrition: nut('4 kcal', '0.0g', '0.4g', '0.2g', '0.01g'),
  },
  {
    sku: 'DRK-0704', name: 'English Breakfast Tea', aisle: 'drinks', brand: 'Basket',
    pack: '160 bags', price: 3.40, unitPrice: '2p/bag',
    description: 'A brisk Assam-led blend that stands up to milk. Rainforest Alliance certified.',
    badges: ['Vegan', 'Fairtrade'], icon: 'coffee', inStock: true, allergens: [],
    nutrition: STD_NUTRITION,
  },
  {
    sku: 'DRK-0705', name: 'Orange Juice, Not From Concentrate', aisle: 'drinks', brand: 'Basket',
    pack: 'Smooth · 1.5 litres', price: 2.75, unitPrice: '£1.83/l',
    description: 'Pressed oranges, chilled, never concentrated. Nothing added.',
    badges: ['Vegan', 'No added sugar'], icon: 'citrus', inStock: true, allergens: [],
    nutrition: nut('42 kcal', '0.1g', '8.7g', '0.6g', '0.00g'),
  },
  {
    sku: 'DRK-0706', name: 'Craft Session IPA', aisle: 'drinks', brand: 'Basket Select',
    pack: '4.2% · 4 x 330ml', price: 6.50, unitPrice: '£1.63/can',
    description: 'A sessionable IPA with Citra and Mosaic — grapefruit up front, dry finish.',
    badges: ['Vegan'], icon: 'beer', inStock: true, allergens: ['Barley', 'Gluten'],
    nutrition: STD_NUTRITION,
  },
  {
    sku: 'DRK-0707', name: 'Marlborough Sauvignon Blanc', aisle: 'drinks', brand: 'Basket Select',
    pack: '12.5% · 750ml', price: 8.50, unitPrice: '£11.33/l',
    description: 'Cut-grass and passionfruit from New Zealand’s Wairau Valley. Serve very cold.',
    badges: ['Vegan'], icon: 'wine', offer: 'OFFER', inStock: true, allergens: ['Sulphites'],
    nutrition: STD_NUTRITION,
  },
  {
    sku: 'DRK-0708', name: 'Alcohol Free Sparkling Aperitif', aisle: 'drinks', brand: 'Basket Select',
    pack: '0.0% · 750ml', price: 7.25, unitPrice: '97p/100ml',
    description: 'Bitter orange and gentian, no alcohol. Top with soda and a slice.',
    badges: ['Vegan', 'Alcohol free'], icon: 'martini', inStock: true, allergens: [],
    nutrition: nut('28 kcal', '0.0g', '6.8g', '0.0g', '0.02g'),
  },
  {
    sku: 'DRK-0709', name: 'Cola, Zero Sugar', aisle: 'drinks', brand: 'Basket',
    pack: 'Zero sugar · 8 x 330ml', price: 3.60, unitPrice: '45p/can',
    description: 'Zero sugar cola in fully recyclable cans.',
    badges: ['Vegan', 'No added sugar'], icon: 'cup-soda', inStock: true, allergens: [],
    nutrition: nut('1 kcal', '0.0g', '0.0g', '0.0g', '0.01g'),
  },

  // ── Household ────────────────────────────────────────────────────────────
  {
    sku: 'HOU-0801', name: 'Non-Bio Laundry Liquid', aisle: 'household', brand: 'Basket Home',
    pack: '60 washes · 2.1 litres', price: 6.75, unitPrice: '11p/wash',
    description: 'Non-bio liquid that works at 20°C. Dermatologically tested, no dyes.',
    badges: ['Sensitive skin'], icon: 'washing-machine', offer: 'OFFER', inStock: true, allergens: [],
    nutrition: STD_NUTRITION,
  },
  {
    sku: 'HOU-0802', name: 'Dishwasher Tablets All-In-One', aisle: 'household', brand: 'Basket Home',
    pack: '60 tablets', price: 7.50, unitPrice: '13p/tab',
    description: 'Salt, rinse aid and detergent in a wrapper that dissolves. No unwrapping.',
    badges: ['Recyclable'], icon: 'sparkles', inStock: true, allergens: [],
    nutrition: STD_NUTRITION,
  },
  {
    sku: 'HOU-0803', name: 'Kitchen Roll', aisle: 'household', brand: 'Basket Home',
    pack: '3 ply · 4 rolls', price: 3.20, unitPrice: '80p/roll',
    description: 'Three-ply, from FSC certified forests. Holds together when wet.',
    badges: ['FSC certified', 'Recyclable'], icon: 'package', inStock: true, allergens: [],
    nutrition: STD_NUTRITION,
  },
  {
    sku: 'HOU-0804', name: 'Antibacterial Surface Spray', aisle: 'household', brand: 'Basket Home',
    pack: 'Multi-surface · 750ml', price: 2.10, unitPrice: '28p/100ml',
    description: 'Kills 99.9% of bacteria on worktops, hobs and sinks. Refill bottles available.',
    badges: ['Recyclable'], icon: 'spray-can', inStock: true, allergens: [],
    nutrition: STD_NUTRITION,
  },
  {
    sku: 'HOU-0805', name: 'Toilet Tissue', aisle: 'household', brand: 'Basket Home',
    pack: 'Quilted · 9 rolls', price: 5.40, unitPrice: '60p/roll',
    description: 'Quilted three-ply from recycled and FSC certified fibre.',
    badges: ['FSC certified', 'Recyclable'], icon: 'bath', inStock: true, allergens: [],
    nutrition: STD_NUTRITION,
  },
  {
    sku: 'HOU-0806', name: 'Compostable Food Waste Bags', aisle: 'household', brand: 'Basket Home',
    pack: '10 litre · 50 bags', price: 2.95, unitPrice: '6p/bag',
    description: 'Certified home-compostable caddy liners that hold a week without leaking.',
    badges: ['Compostable', 'Vegan'], icon: 'trash-2', offer: 'NEW', inStock: true, allergens: [],
    nutrition: STD_NUTRITION,
  },
  {
    sku: 'HOU-0807', name: 'Washing Up Liquid, Lemon', aisle: 'household', brand: 'Basket Home',
    pack: 'Concentrated · 900ml', price: 1.85, unitPrice: '21p/100ml',
    description: 'Concentrated so half a squeeze does a full sink. Plant-derived surfactants.',
    badges: ['Vegan', 'Recyclable'], icon: 'droplets', inStock: true, allergens: [],
    nutrition: STD_NUTRITION,
  },
  {
    sku: 'HOU-0808', name: 'Fabric Conditioner, Cotton Fresh', aisle: 'household', brand: 'Basket Home',
    pack: '58 washes · 1.45 litres', price: 3.90, unitPrice: '7p/wash',
    description: 'Softens without coating. Scent holds for around ten days in the wardrobe.',
    badges: ['Recyclable'], icon: 'shirt', inStock: true, allergens: [],
    nutrition: STD_NUTRITION,
  },
  {
    sku: 'HOU-0809', name: 'Aluminium Foil', aisle: 'household', brand: 'Basket Home',
    pack: 'Extra wide · 30m', price: 2.45, unitPrice: '8p/m',
    description: 'Extra-wide heavy-duty foil on a box that actually tears straight.',
    badges: ['Recyclable'], icon: 'package', inStock: true, allergens: [],
    nutrition: STD_NUTRITION,
  },
  {
    sku: 'HOU-0810', name: 'Bin Liners, Drawstring', aisle: 'household', brand: 'Basket Home',
    pack: '50 litre · 30 bags', price: 3.15, unitPrice: '11p/bag',
    description: 'Drawstring liners made from 90% recycled plastic. Tear resistant.',
    badges: ['Recyclable'], icon: 'trash-2', inStock: true, allergens: [],
    nutrition: STD_NUTRITION,
  },
];

// ─── Lookups ─────────────────────────────────────────────────────────────────

export const aisleBySlug = (slug: string): Aisle | undefined =>
  aisles.find((a) => a.slug === slug);

export const aisleName = (slug: AisleSlug): string =>
  aisleBySlug(slug)?.name ?? slug;

export const productBySku = (sku: string): Product | undefined =>
  products.find((p) => p.sku === sku);

export const productsInAisle = (slug: string): Product[] =>
  products.filter((p) => p.aisle === slug);

/** Every dietary/quality badge present in an aisle, for the filter rail. */
export const badgesInAisle = (slug: string): string[] =>
  Array.from(new Set(productsInAisle(slug).flatMap((p) => p.badges))).sort();

/** Every brand present in an aisle, for the filter rail. */
export const brandsInAisle = (slug: string): string[] =>
  Array.from(new Set(productsInAisle(slug).map((p) => p.brand))).sort();

export function searchProducts(query: string, limit = 24): Product[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const terms = q.split(/\s+/);
  const scored = products
    .map((p) => {
      const hay = `${p.name} ${p.brand} ${p.pack} ${p.aisle} ${p.badges.join(' ')}`.toLowerCase();
      const hits = terms.filter((t) => hay.includes(t)).length;
      const nameHit = p.name.toLowerCase().includes(q) ? 2 : 0;
      return { p, score: hits + nameHit };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.p);
}

/** Same aisle, excluding the product itself. */
export function relatedProducts(sku: string, limit = 5): Product[] {
  const product = productBySku(sku);
  if (!product) return products.slice(0, limit);
  return productsInAisle(product.aisle)
    .filter((p) => p.sku !== sku)
    .slice(0, limit);
}

/** Homepage "offers" rail. */
export const offerProducts = (): Product[] => products.filter((p) => p.offer === 'OFFER');

/** Homepage "new in" rail. */
export const newProducts = (): Product[] => products.filter((p) => p.offer === 'NEW');

/** Stable pseudo "buy again" list — the staples a returning shopper reorders. */
export const BUY_AGAIN_SKUS = ['DRY-0201', 'BAK-0301', 'DRY-0202', 'PRD-0102'] as const;

export const buyAgainProducts = (): Product[] =>
  BUY_AGAIN_SKUS.map((sku) => productBySku(sku)).filter(
    (p): p is Product => Boolean(p)
  );

// ─── Money & delivery ────────────────────────────────────────────────────────

export const FREE_DELIVERY_THRESHOLD = 40;
export const DELIVERY_FEE = 3.95;

/** £4.50 / 45p — always rendered inside a `.num` element. */
export function formatGBP(amount: number): string {
  return `£${amount.toFixed(2)}`;
}

export interface DeliverySlot {
  id: string;
  label: string;
  /** Hour the slot starts, 24h. */
  startHour: number;
  fee: number;
  available: boolean;
}

/**
 * Slots for today, derived from the current hour so the "next slot" chip in the
 * header is always live. Deterministic given the hour — no randomness, so the
 * server and client agree after hydration.
 */
export function deliverySlots(now: Date = new Date()): DeliverySlot[] {
  const hour = now.getHours();
  const starts = [10, 12, 14, 16, 18, 20];
  return starts.map((h) => ({
    id: `slot-${h}`,
    label: `${String(h).padStart(2, '0')}:00–${String(h + 1).padStart(2, '0')}:00`,
    startHour: h,
    fee: h >= 18 ? 4.95 : 3.95,
    available: h > hour,
  }));
}

export function nextAvailableSlot(now: Date = new Date()): DeliverySlot | null {
  return deliverySlots(now).find((s) => s.available) ?? null;
}
