import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { siteConfig } from './config';

/**
 * Merge Tailwind classes, resolving conflicts (later wins).
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Supported UTM / click-id parameters for simulated campaign traffic.
 */
export interface UtmParams {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  gclid?: string;
  msclkid?: string;
  dclid?: string;
}

function pickRandom<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

/**
 * Rebuild a URL with a random set of UTM parameters drawn from the site
 * config. Used by the demo footer's "UTM Reload" control to simulate
 * marketing campaign traffic. Snowplow's Campaign Attribution Enrichment
 * picks these up automatically from the page URL.
 *
 * If explicit params are passed, they take precedence over the random pick.
 */
export function buildUrlWithUtm(baseUrl: string, params?: UtmParams): string {
  const url = new URL(baseUrl);

  // Clear any existing UTM / click-id params so we start clean.
  const utmKeys = [
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_term',
    'utm_content',
    'gclid',
    'msclkid',
    'dclid',
  ];
  utmKeys.forEach((k) => url.searchParams.delete(k));

  const marketing = siteConfig.marketing?.utmParameters;

  const resolved: UtmParams = {
    utm_source:
      params?.utm_source ??
      (marketing?.sources?.length ? pickRandom(marketing.sources) : 'google'),
    utm_medium:
      params?.utm_medium ??
      (marketing?.mediums?.length ? pickRandom(marketing.mediums) : 'cpc'),
    utm_campaign:
      params?.utm_campaign ??
      (marketing?.campaigns?.length
        ? pickRandom(marketing.campaigns)
        : 'brand'),
    ...(params?.utm_term ? { utm_term: params.utm_term } : {}),
    ...(params?.utm_content ? { utm_content: params.utm_content } : {}),
    ...(params?.gclid ? { gclid: params.gclid } : {}),
    ...(params?.msclkid ? { msclkid: params.msclkid } : {}),
    ...(params?.dclid ? { dclid: params.dclid } : {}),
  };

  Object.entries(resolved).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value);
  });

  return url.toString();
}
