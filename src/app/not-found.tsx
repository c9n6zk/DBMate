import Link from 'next/link';
import { FileQuestion } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
      <FileQuestion className="h-12 w-12 text-muted-foreground" />
      <h2 className="text-xl font-semibold">Page not found</h2>
      <p className="text-muted-foreground">
        The page you are looking for does not exist.
      </p>
      <Link
        href="/"
        className="inline-flex items-center justify-center rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
      >
        Go to Import
      </Link>
    </div>
  );
}
