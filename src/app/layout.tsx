import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { ThemeProvider } from 'next-themes';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';
import { Sidebar } from '@/components/layout/sidebar';
import { SchemaInitializer } from '@/components/shared/schema-initializer';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: {
    default: 'DBMate — AI-Powered Database Assistant',
    template: '%s | DBMate',
  },
  description:
    'Analyze, optimize, and manage SQL database schemas with AI assistance. ER diagrams, health analysis, migrations, seed data, and more.',
  keywords: ['database', 'SQL', 'schema', 'AI', 'optimization', 'migration', 'ER diagram', 'DBMate'],
  authors: [{ name: 'DBMate' }],
  icons: {
    icon: '/favicon.svg',
  },
  openGraph: {
    title: 'DBMate — AI-Powered Database Assistant',
    description: 'Analyze, optimize, and manage SQL database schemas with AI assistance.',
    type: 'website',
    locale: 'hu_HU',
    siteName: 'DBMate',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="hu" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <TooltipProvider delay={0}>
            <SchemaInitializer />
            <div className="flex min-h-screen">
              <Sidebar />
              <main className="flex-1 min-w-0 px-4 pb-4 pt-14 md:p-6">{children}</main>
            </div>
            <Toaster />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
