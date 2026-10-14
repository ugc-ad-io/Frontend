import { Suspense } from 'react';
import { useLocation } from 'react-router-dom';
import Loader from './Loader';
import AppErrorBoundary from './AppErrorBoundary';

// Keyed by route: a page that fails to download or render shows the error only
// for that route, and moving to any other tab starts clean. Without the key the
// error screen stuck to every later tab until a manual reload.
export default function RouteLoadingBoundary({ children }) {
  const { pathname } = useLocation();
  return (
    <AppErrorBoundary key={pathname}>
      <Suspense fallback={<Loader label="Loading page..." />}>{children}</Suspense>
    </AppErrorBoundary>
  );
}
