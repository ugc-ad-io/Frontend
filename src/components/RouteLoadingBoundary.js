import { Suspense, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Skeleton, SkeletonCards } from './Skeleton';
import AppErrorBoundary from './AppErrorBoundary';
import { onRouteLoading } from '../lib/retryLazy';

// Shown while a tab's code downloads. A light page-shaped skeleton, not the dark
// full-screen video loader, so changing tabs goes straight to a skeleton and then
// the page's own skeleton/data, with no separate "Loading page..." screen in between.
function RouteSkeleton() {
  return (
    <div role="status" aria-label="Loading" style={{ minHeight: '100vh', background: '#f7f8fc' }}>
      <div style={{ height: 64, background: '#fff', borderBottom: '1px solid #eef0f6', display: 'flex', alignItems: 'center', gap: 16, padding: '0 24px' }}>
        <Skeleton width={36} height={36} radius={10} />
        <Skeleton width={120} height={14} />
      </div>
      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <Skeleton width={220} height={22} />
        <Skeleton width={320} height={12} />
        <SkeletonCards count={6} height={160} />
      </div>
    </div>
  );
}

// True once a tab's code has been downloading for a moment. Fast (cached) downloads
// never reach it, so there is no skeleton flash.
function useRouteDownloading(delayMs = 100) {
  const [downloading, setDownloading] = useState(false);
  useEffect(() => {
    let timer;
    const off = onRouteLoading((count) => {
      if (count > 0) { timer = timer || setTimeout(() => setDownloading(true), delayMs); return; }
      clearTimeout(timer); timer = undefined; setDownloading(false);
    });
    return () => { off(); clearTimeout(timer); };
  }, [delayMs]);
  return downloading;
}

// The error boundary is reset (not remounted) when the route changes: a page that
// fails shows the error only for that route and the next tab starts clean, while
// tabs that share one page component keep it mounted and just update in place.
export default function RouteLoadingBoundary({ children }) {
  const { pathname } = useLocation();
  const downloading = useRouteDownloading();
  return (
    <AppErrorBoundary resetKey={pathname}>
      <Suspense fallback={<RouteSkeleton />}>{children}</Suspense>
      {downloading && <div style={{ position: 'fixed', inset: 0, zIndex: 9998, overflow: 'hidden' }}><RouteSkeleton /></div>}
    </AppErrorBoundary>
  );
}
