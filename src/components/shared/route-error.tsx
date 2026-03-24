'use client';

import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function RouteError({
  title,
  error,
  reset,
}: {
  title: string;
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
      <AlertTriangle className="h-12 w-12 text-destructive" />
      <h2 className="text-2xl font-semibold">{title}</h2>
      <p className="text-muted-foreground max-w-md text-sm">
        {error.message || 'An unexpected error occurred.'}
      </p>
      <Button variant="outline" onClick={reset}>
        <RefreshCw className="h-4 w-4 mr-2" />
        Try again
      </Button>
    </div>
  );
}
