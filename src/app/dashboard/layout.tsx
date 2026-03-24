import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'View ER diagrams, explore tables, and chat with your database schema using AI.',
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
