/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
}));
vi.mock('next/link', () => ({
  default: ({ children, href, className, title, onClick }: any) => (
    <a href={href} className={className} title={title} onClick={onClick}>{children}</a>
  ),
}));
vi.mock('@/components/ui/sheet', () => ({
  Sheet: ({ children }: any) => <div>{children}</div>,
  SheetContent: ({ children }: any) => <div data-testid="sheet-content">{children}</div>,
  SheetTrigger: ({ children, className }: any) => <button className={className}>{children}</button>,
}));
vi.mock('@/components/layout/project-list', () => ({
  ProjectList: ({ collapsed }: any) => <div data-testid="project-list" data-collapsed={String(collapsed)} />,
}));

import { Sidebar } from '../layout/sidebar';

describe('Sidebar', () => {
  beforeEach(() => {
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {});
  });

  it('renders navigation items in desktop sidebar', () => {
    render(<Sidebar />);
    // Desktop sidebar renders nav items
    expect(screen.getAllByText('Import').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Dashboard').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Optimizer').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Migrations').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Seed Data').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Export').length).toBeGreaterThan(0);
  });

  it('renders DBMate logo', () => {
    render(<Sidebar />);
    expect(screen.getAllByText('DBMate').length).toBeGreaterThan(0);
  });

  it('renders project list', () => {
    render(<Sidebar />);
    expect(screen.getAllByTestId('project-list').length).toBeGreaterThan(0);
  });

  it('renders Settings link', () => {
    render(<Sidebar />);
    expect(screen.getAllByText('Settings').length).toBeGreaterThan(0);
  });

  it('has links with correct hrefs', () => {
    render(<Sidebar />);
    const links = screen.getAllByRole('link');
    const hrefs = links.map((l) => l.getAttribute('href'));
    expect(hrefs).toContain('/');
    expect(hrefs).toContain('/dashboard');
    expect(hrefs).toContain('/optimizer');
  });

  it('renders collapse toggle button', () => {
    render(<Sidebar />);
    const collapseBtn = screen.getByTitle('Collapse sidebar');
    expect(collapseBtn).toBeInTheDocument();
  });
});
