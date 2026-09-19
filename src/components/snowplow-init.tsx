'use client';

import { Suspense, useEffect, type ReactNode } from 'react';

import { initializeSnowplow } from '@/lib/snowplow-config';
import { useSnowplowTracking } from '@/hooks/use-snowplow-tracking';
import { UserProvider } from '@/contexts/user-context';
import { ShopProvider } from '@/contexts/shop-context';

/**
 * Fires page views on route change. Split into its own component so it can be
 * wrapped in <Suspense> (useSearchParams requires a suspense boundary).
 */
function PageViewTracker() {
  useSnowplowTracking();
  return null;
}

/**
 * Root tracking provider.
 *
 * Provider nesting (mandatory):
 *   <SnowplowInit>   -> inits the tracker, fires page views
 *     <UserProvider> -> sets user_id once the tracker exists
 *       <ShopProvider> -> basket + session activity (demo UI state only)
 *         {children}
 *
 * The tracker is initialized exactly once, before any page view fires.
 */
export default function SnowplowInit({ children }: { children: ReactNode }) {
  // Init on the client after mount. `initializeSnowplow` is guarded by a module
  // flag so it runs exactly once regardless of how often this effect fires; the
  // first page view is fired by the route-change hook (also in an effect), so
  // running here — rather than during render — is early enough.
  useEffect(() => {
    initializeSnowplow();
  }, []);

  return (
    <>
      <Suspense fallback={null}>
        <PageViewTracker />
      </Suspense>
      <UserProvider>
        <ShopProvider>{children}</ShopProvider>
      </UserProvider>
    </>
  );
}
