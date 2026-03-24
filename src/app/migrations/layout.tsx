import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Migrations',
  description: 'Generate and manage database migration scripts with AI assistance.',
};

export default function MigrationsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
