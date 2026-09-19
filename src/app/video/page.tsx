'use client';

import { useEffect, useRef } from 'react';

import { startYouTubeTracking, endYouTubeTracking } from '@/lib/snowplow-config';

/**
 * YouTube media-tracking demo page (reusable plumbing).
 *
 * Tracks a muted, embedded YouTube video with the Snowplow media plugin:
 * percent-progress boundaries + default media events. The iframe MUST carry
 * `enablejsapi=1` and a stable `id` the plugin attaches to. Swap the videoId
 * for the demo's own clip.
 */
const VIDEO_ID = '4ClPw87tiV0';
const PLAYER_ID = 'demo-youtube-player';

export default function VideoPage() {
  const sessionIdRef = useRef<string>('');

  useEffect(() => {
    const sessionId = crypto.randomUUID();
    sessionIdRef.current = sessionId;
    startYouTubeTracking({
      id: PLAYER_ID,
      video: VIDEO_ID,
      boundaries: [25, 50, 75, 100],
      captureEvents: ['DefaultEvents'],
    });
    return () => {
      endYouTubeTracking(sessionId);
    };
  }, []);

  return (
    <div className="mx-auto max-w-page px-6 py-section">
      <h1 className="font-heading text-h2 font-bold text-heading">Watch</h1>
      <p className="mt-2 text-body">
        This video is tracked with the Snowplow YouTube media plugin.
      </p>
      <div className="mt-6 aspect-video w-full overflow-hidden rounded-lg border border-border">
        <iframe
          id={PLAYER_ID}
          className="h-full w-full"
          src={`https://www.youtube.com/embed/${VIDEO_ID}?enablejsapi=1&mute=1`}
          title="Tracked video"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    </div>
  );
}
