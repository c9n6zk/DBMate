import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Optimizer',
  description: 'Analyze and optimize your database schema with AI-powered health scoring.',
};

export default function OptimizerLayout({ children }: { children: React.ReactNode }) {
  return children;
}
