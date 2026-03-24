'use client';

import { RouteError } from '@/components/shared/route-error';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError title="Optimizer Error" error={error} reset={reset} />;
}
