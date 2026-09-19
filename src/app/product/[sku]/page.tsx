import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { productBySku, products } from '@/lib/catalog';
import { siteConfig } from '@/lib/config';
import ProductView from './product-view';

export function generateStaticParams() {
  return products.map((product) => ({ sku: product.sku }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ sku: string }>;
}): Promise<Metadata> {
  const { sku } = await params;
  const product = productBySku(sku);
  if (!product) return { title: `Product — ${siteConfig.brand.name}` };
  return {
    title: `${product.name}, ${product.pack} — ${siteConfig.brand.name}`,
    description: product.description,
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ sku: string }>;
}) {
  const { sku } = await params;
  const product = productBySku(sku);
  if (!product) notFound();
  return <ProductView product={product} />;
}
