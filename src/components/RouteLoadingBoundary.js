import { Suspense } from 'react';
import { useLocation } from 'react-router-dom';
import Loader from './Loader';

export default function RouteLoadingBoundary({ children }) {
  const { pathname } = useLocation();
  return <Suspense key={pathname} fallback={<Loader label="Loading page..." />}>{children}</Suspense>;
}
