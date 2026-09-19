import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { aisleBySlug, aisles } from '@/lib/catalog';
import { siteConfig } from '@/lib/config';
import AisleView from './aisle-view';

export function generateStaticParams() {
  return aisles.map((aisle) => ({ slug: aisle.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const aisle = aisleBySlug(slug);
  if (!aisle) return { title: `Aisle — ${siteConfig.brand.name}` };
  return {
    title: `${aisle.name} — ${siteConfig.brand.name}`,
    description: aisle.blurb,
  };
}

export default async function AislePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const aisle = aisleBySlug(slug);
  if (!aisle) notFound();
  return <AisleView aisle={aisle} />;
}
