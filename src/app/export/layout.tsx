import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Export',
  description: 'Export your schema as SQL, migrations, documentation, ER diagrams, and more.',
};

export default function ExportLayout({ children }: { children: React.ReactNode }) {
  return children;
}
