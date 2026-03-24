'use client';

import { RouteError } from '@/components/shared/route-error';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError title="Dashboard Error" error={error} reset={reset} />;
}
