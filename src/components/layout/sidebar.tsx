'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import {
  Database,
  LayoutDashboard,
  Zap,
  GitBranch,
  Sprout,
  Download,
  Settings,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { ProjectList } from './project-list';

const NAV_ITEMS = [
  { href: '/', label: 'Import', icon: Database },
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/optimizer', label: 'Optimizer', icon: Zap },
  { href: '/migrations', label: 'Migrations', icon: GitBranch },
  { href: '/seed', label: 'Seed Data', icon: Sprout },
  { href: '/export', label: 'Export', icon: Download },
] as const;

const BOTTOM_ITEMS = [
  { href: '/settings', label: 'Settings', icon: Settings },
] as const;

const ALL_ITEMS = [...NAV_ITEMS, ...BOTTOM_ITEMS];

const STORAGE_KEY = 'dbmate-sidebar-collapsed';

function NavLink({
  href,
  label,
  icon: Icon,
  isActive,
  collapsed,
  onClick,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  isActive: boolean;
  collapsed: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 rounded-md text-xs font-medium transition-colors',
        'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
        isActive && 'bg-sidebar-accent text-sidebar-accent-foreground',
        collapsed ? 'justify-center px-2 py-1.5' : 'px-2.5 py-1.5'
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  );
}

function isActivePath(href: string, pathname: string) {
  return href === '/' ? pathname === '/' : pathname.startsWith(href);
}

export function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // Persist collapsed state
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'true') setCollapsed(true);
  }, []);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem(STORAGE_KEY, String(next));
  };

  return (
    <>
      {/* Mobile hamburger button */}
      <div className="md:hidden fixed top-3 left-3 z-50">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger className="inline-flex items-center justify-center rounded-lg h-9 w-9 text-sm font-medium transition-colors hover:bg-muted hover:text-foreground bg-background/80 backdrop-blur border border-border shadow-sm">
            <Menu className="h-5 w-5" />
            <span className="sr-only">Menu</span>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            <div className="flex items-center gap-2 px-4 h-14 border-b border-border">
              <Database className="h-6 w-6 text-primary" />
              <span className="text-lg font-semibold">DBMate</span>
            </div>
            <nav className="flex flex-col gap-1 p-2">
              {NAV_ITEMS.map((item) => (
                <NavLink
                  key={item.href}
                  {...item}
                  isActive={isActivePath(item.href, pathname)}
                  collapsed={false}
                  onClick={() => setMobileOpen(false)}
                />
              ))}
            </nav>
            <div className="p-2 border-t border-border">
              <ProjectList collapsed={false} />
            </div>
            <div className="flex flex-col gap-1 p-2 border-t border-border">
              {BOTTOM_ITEMS.map((item) => (
                <NavLink
                  key={item.href}
                  {...item}
                  isActive={isActivePath(item.href, pathname)}
                  collapsed={false}
                  onClick={() => setMobileOpen(false)}
                />
              ))}
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop sidebar */}
      <aside
        className={cn(
          'hidden md:flex flex-col border-r border-border bg-sidebar text-sidebar-foreground h-screen sticky top-0 shrink-0 transition-[width] duration-200 ease-in-out',
          collapsed ? 'w-12' : 'w-40'
        )}
      >
        {/* Logo + collapse toggle */}
        <div className={cn(
          'flex items-center h-10 border-b border-sidebar-border',
          collapsed ? 'justify-center px-1.5' : 'justify-between px-2.5'
        )}>
          {!collapsed && (
            <div className="flex items-center gap-1.5 min-w-0">
              <Database className="h-4 w-4 text-sidebar-primary shrink-0" />
              <span className="text-sm font-semibold truncate">DBMate</span>
            </div>
          )}
          <button
            onClick={toggleCollapsed}
            className="inline-flex items-center justify-center rounded-md h-6 w-6 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-3.5 w-3.5" />
            ) : (
              <PanelLeftClose className="h-3.5 w-3.5" />
            )}
          </button>
        </div>

        {/* Main nav */}
        <nav className="flex flex-col gap-0.5 p-1.5">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.href}
              {...item}
              isActive={isActivePath(item.href, pathname)}
              collapsed={collapsed}
            />
          ))}
        </nav>

        {/* Project list */}
        <div className="flex-1 min-h-0 p-1.5 border-t border-sidebar-border overflow-hidden">
          <ProjectList collapsed={collapsed} />
        </div>

        {/* Bottom nav */}
        <div className="flex flex-col gap-0.5 p-1.5 border-t border-sidebar-border shrink-0">
          {BOTTOM_ITEMS.map((item) => (
            <NavLink
              key={item.href}
              {...item}
              isActive={pathname.startsWith(item.href)}
              collapsed={collapsed}
            />
          ))}
        </div>
      </aside>
    </>
  );
}
