import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Seed Data',
  description: 'Generate realistic test data for your database tables with locale support.',
};

export default function SeedLayout({ children }: { children: React.ReactNode }) {
  return children;
}
