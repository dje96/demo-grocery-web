'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

import { trackPageViewEvent } from '@/lib/snowplow-config';

/**
 * Fires a Snowplow page view on every route change.
 *
 * Uses refs to avoid duplicate fires:
 * - `lastPathnameRef` guards against the effect re-running for the same path.
 * - `isInitialMountRef` ensures the very first page view fires on mount.
 *
 * Routes in {@link SELF_TRACKED_ROUTES} fire their OWN page view (with extra
 * entity context) from a page-level client component, so the global hook skips
 * them to avoid a duplicate. Add prefixes here for any detail route that
 * attaches an entity to its page_view (e.g. '/title/' or '/product/').
 *
 * Page views are NEVER fired during tracker initialization — only here.
 */
const SELF_TRACKED_ROUTES: string[] = [];

function isSelfTracked(pathname: string): boolean {
  return SELF_TRACKED_ROUTES.some((prefix) => pathname.startsWith(prefix));
}

export function useSnowplowTracking(): void {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastPathnameRef = useRef<string | null>(null);
  const isInitialMountRef = useRef(true);

  useEffect(() => {
    const currentPath = pathname;
    const selfTracked = isSelfTracked(currentPath);

    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      lastPathnameRef.current = currentPath;
      if (!selfTracked) trackPageViewEvent();
      return;
    }

    if (lastPathnameRef.current !== currentPath) {
      lastPathnameRef.current = currentPath;
      if (!selfTracked) trackPageViewEvent();
    }
    // searchParams included so UTM-decorated reloads register as views.
  }, [pathname, searchParams]);
}
