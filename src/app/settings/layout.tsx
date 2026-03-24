import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Settings',
  description: 'Configure database defaults, AI model settings, and application preferences.',
};

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
