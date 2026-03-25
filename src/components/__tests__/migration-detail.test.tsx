/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MigrationDetail } from '../migrations/migration-detail';
import type { Migration } from '@/lib/types';

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: any) => <div>{children}</div>,
  CardContent: ({ children }: any) => <div>{children}</div>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
}));
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} {...props}>{children}</button>
  ),
}));
vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: any) => <span>{children}</span>,
}));
vi.mock('@/components/ui/tabs', () => ({
  Tabs: ({ children }: any) => <div>{children}</div>,
  TabsList: ({ children }: any) => <div>{children}</div>,
  TabsTrigger: ({ children }: any) => <button>{children}</button>,
  TabsContent: ({ children, value }: any) => <div data-tab={value}>{children}</div>,
}));
vi.mock('@/components/ui/select', () => ({
  Select: ({ children }: any) => <div>{children}</div>,
  SelectContent: ({ children }: any) => <div>{children}</div>,
  SelectItem: ({ children, value }: any) => <option value={value}>{children}</option>,
  SelectTrigger: ({ children }: any) => <div>{children}</div>,
  SelectValue: () => <span>Raw SQL</span>,
}));
vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children }: any) => <div>{children}</div>,
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn() } }));

const pendingMigration: Migration = {
  id: 'm1', schemaId: 's1', version: 'v001', name: 'add_index',
  upSQL: 'CREATE INDEX idx_email ON users(email);',
  downSQL: 'DROP INDEX idx_email;',
  description: 'Add email index',
  format: 'raw',
};

const appliedMigration: Migration = {
  ...pendingMigration, id: 'm2',
  appliedAt: '2026-01-01T00:00:00Z',
};

describe('MigrationDetail', () => {
  const onApply = vi.fn().mockResolvedValue(undefined);
  const onRollback = vi.fn().mockResolvedValue(undefined);
  const onDelete = vi.fn();

  it('renders migration version and name', () => {
    render(<MigrationDetail migration={pendingMigration} onApply={onApply} onRollback={onRollback} onDelete={onDelete} isApplying={false} />);
    expect(screen.getByText('v001')).toBeInTheDocument();
    expect(screen.getByText('add_index')).toBeInTheDocument();
  });

  it('renders description', () => {
    render(<MigrationDetail migration={pendingMigration} onApply={onApply} onRollback={onRollback} onDelete={onDelete} isApplying={false} />);
    expect(screen.getByText('Add email index')).toBeInTheDocument();
  });

  it('shows Pending badge for unapplied migration', () => {
    render(<MigrationDetail migration={pendingMigration} onApply={onApply} onRollback={onRollback} onDelete={onDelete} isApplying={false} />);
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('shows Applied badge for applied migration', () => {
    render(<MigrationDetail migration={appliedMigration} onApply={onApply} onRollback={onRollback} onDelete={onDelete} isApplying={false} />);
    expect(screen.getByText('Applied')).toBeInTheDocument();
  });

  it('renders tab triggers (UP, DOWN, Formatted)', () => {
    render(<MigrationDetail migration={pendingMigration} onApply={onApply} onRollback={onRollback} onDelete={onDelete} isApplying={false} />);
    expect(screen.getByText('UP (Apply)')).toBeInTheDocument();
    expect(screen.getByText('DOWN (Rollback)')).toBeInTheDocument();
    expect(screen.getByText('Formatted')).toBeInTheDocument();
  });

  it('displays UP SQL content', () => {
    render(<MigrationDetail migration={pendingMigration} onApply={onApply} onRollback={onRollback} onDelete={onDelete} isApplying={false} />);
    expect(screen.getAllByText(/CREATE INDEX idx_email/).length).toBeGreaterThan(0);
  });

  it('displays DOWN SQL content', () => {
    render(<MigrationDetail migration={pendingMigration} onApply={onApply} onRollback={onRollback} onDelete={onDelete} isApplying={false} />);
    expect(screen.getAllByText(/DROP INDEX idx_email/).length).toBeGreaterThan(0);
  });

  it('shows Apply button for pending migration', () => {
    render(<MigrationDetail migration={pendingMigration} onApply={onApply} onRollback={onRollback} onDelete={onDelete} isApplying={false} />);
    expect(screen.getByText('Apply')).toBeInTheDocument();
  });

  it('shows Rollback button for applied migration', () => {
    render(<MigrationDetail migration={appliedMigration} onApply={onApply} onRollback={onRollback} onDelete={onDelete} isApplying={false} />);
    expect(screen.getByText('Rollback')).toBeInTheDocument();
  });

  it('calls onApply when Apply clicked', () => {
    render(<MigrationDetail migration={pendingMigration} onApply={onApply} onRollback={onRollback} onDelete={onDelete} isApplying={false} />);
    fireEvent.click(screen.getByText('Apply'));
    expect(onApply).toHaveBeenCalledWith('m1');
  });

  it('calls onDelete when Delete clicked', () => {
    render(<MigrationDetail migration={pendingMigration} onApply={onApply} onRollback={onRollback} onDelete={onDelete} isApplying={false} />);
    fireEvent.click(screen.getByText('Delete'));
    expect(onDelete).toHaveBeenCalledWith('m1');
  });

  it('shows Download button', () => {
    render(<MigrationDetail migration={pendingMigration} onApply={onApply} onRollback={onRollback} onDelete={onDelete} isApplying={false} />);
    expect(screen.getByText('Download')).toBeInTheDocument();
  });

  it('shows formatted output', () => {
    render(<MigrationDetail migration={pendingMigration} onApply={onApply} onRollback={onRollback} onDelete={onDelete} isApplying={false} />);
    // Raw format: -- UP + -- DOWN
    expect(screen.getByText(/-- UP/)).toBeInTheDocument();
  });
});
