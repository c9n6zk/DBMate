/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SeedPreview } from '../seed/seed-preview';
import type { SeedResult } from '@/lib/types';

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} {...props}>{children}</button>
  ),
}));
vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children }: any) => <div>{children}</div>,
}));
vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: any) => <span>{children}</span>,
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn() } }));

// Mock clipboard
Object.assign(navigator, {
  clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
});

const seeds: SeedResult[] = [
  { tableName: 'users', insertStatements: "INSERT INTO users (name) VALUES ('Alice');", rowCount: 1 },
  { tableName: 'orders', insertStatements: "INSERT INTO orders (user_id) VALUES (1);", rowCount: 1 },
];

describe('SeedPreview', () => {
  it('renders summary badges', () => {
    render(<SeedPreview seeds={seeds} totalRows={2} insertOrder={['users', 'orders']} />);
    expect(screen.getByText(/users: 1 rows/)).toBeInTheDocument();
    expect(screen.getByText(/orders: 1 rows/)).toBeInTheDocument();
  });

  it('renders total rows', () => {
    render(<SeedPreview seeds={seeds} totalRows={2} insertOrder={['users', 'orders']} />);
    expect(screen.getByText(/Total: 2 rows/)).toBeInTheDocument();
  });

  it('renders insert order', () => {
    render(<SeedPreview seeds={seeds} totalRows={2} insertOrder={['users', 'orders']} />);
    expect(screen.getByText(/users → orders/)).toBeInTheDocument();
  });

  it('renders SQL preview', () => {
    render(<SeedPreview seeds={seeds} totalRows={2} insertOrder={['users', 'orders']} />);
    expect(screen.getByText(/INSERT INTO users/)).toBeInTheDocument();
    expect(screen.getByText(/INSERT INTO orders/)).toBeInTheDocument();
  });

  it('renders Copy SQL button', () => {
    render(<SeedPreview seeds={seeds} totalRows={2} insertOrder={['users', 'orders']} />);
    expect(screen.getByText('Copy SQL')).toBeInTheDocument();
  });

  it('renders Download button', () => {
    render(<SeedPreview seeds={seeds} totalRows={2} insertOrder={['users', 'orders']} />);
    expect(screen.getByText('Download seed.sql')).toBeInTheDocument();
  });

  it('copies SQL to clipboard on Copy click', async () => {
    render(<SeedPreview seeds={seeds} totalRows={2} insertOrder={['users', 'orders']} />);
    fireEvent.click(screen.getByText('Copy SQL'));
    expect(navigator.clipboard.writeText).toHaveBeenCalled();
  });

  it('shows "No data generated." for empty seeds', () => {
    render(<SeedPreview seeds={[]} totalRows={0} insertOrder={[]} />);
    expect(screen.getByText('No data generated.')).toBeInTheDocument();
  });

  it('disables buttons when no SQL', () => {
    render(<SeedPreview seeds={[]} totalRows={0} insertOrder={[]} />);
    const copyBtn = screen.getByText('Copy SQL').closest('button');
    expect(copyBtn).toBeDisabled();
  });
});
