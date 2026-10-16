import { Suspense } from 'react';
import { useLocation } from 'react-router-dom';
import AppErrorBoundary from './AppErrorBoundary';

// No loading screen of its own: while a tab's code downloads the current page stays
// on screen, then the new page shows its own skeleton/data.
// The error boundary is reset (not remounted) when the route changes: a page that
// fails shows the error only for that route and the next tab starts clean, while
// tabs that share one page component keep it mounted and just update in place.
export default function RouteLoadingBoundary({ children }) {
  const { pathname } = useLocation();
  return (
    <AppErrorBoundary resetKey={pathname}>
      <Suspense fallback={null}>{children}</Suspense>
    </AppErrorBoundary>
  );
}
