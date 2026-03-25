/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MigrationList } from '../migrations/migration-list';
import type { Migration } from '@/lib/types';

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, ...props }: any) => <div {...props}>{children}</div>,
}));
vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, ...props }: any) => <span {...props}>{children}</span>,
}));
vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children, ...props }: any) => <div {...props}>{children}</div>,
}));

const migrations: Migration[] = [
  {
    id: 'm1', schemaId: 's1', version: 'v001', name: 'add_index',
    upSQL: 'CREATE INDEX...', downSQL: 'DROP INDEX...', description: 'Add index',
    format: 'raw', appliedAt: '2026-01-01',
  },
  {
    id: 'm2', schemaId: 's1', version: 'v002', name: 'add_column',
    upSQL: 'ALTER TABLE...', downSQL: 'ALTER TABLE...', description: 'Add column',
    format: 'raw',
  },
];

describe('MigrationList', () => {
  const onSelect = vi.fn();

  it('renders empty state when no migrations', () => {
    render(<MigrationList migrations={[]} selectedId={null} onSelect={onSelect} />);
    expect(screen.getByText('No migrations yet.')).toBeInTheDocument();
  });

  it('renders migration items', () => {
    render(<MigrationList migrations={migrations} selectedId={null} onSelect={onSelect} />);
    expect(screen.getByText('add_index')).toBeInTheDocument();
    expect(screen.getByText('add_column')).toBeInTheDocument();
  });

  it('shows version badges', () => {
    render(<MigrationList migrations={migrations} selectedId={null} onSelect={onSelect} />);
    expect(screen.getByText('v001')).toBeInTheDocument();
    expect(screen.getByText('v002')).toBeInTheDocument();
  });

  it('calls onSelect when item clicked', () => {
    render(<MigrationList migrations={migrations} selectedId={null} onSelect={onSelect} />);
    fireEvent.click(screen.getByText('add_column'));
    expect(onSelect).toHaveBeenCalledWith('m2');
  });

  it('sorts pending migrations first', () => {
    const { container } = render(
      <MigrationList migrations={migrations} selectedId={null} onSelect={onSelect} />
    );
    const buttons = container.querySelectorAll('button');
    // Pending (m2, no appliedAt) should come first
    expect(buttons[0].textContent).toContain('add_column');
  });

  it('shows descriptions', () => {
    render(<MigrationList migrations={migrations} selectedId={null} onSelect={onSelect} />);
    expect(screen.getByText('Add index')).toBeInTheDocument();
    expect(screen.getByText('Add column')).toBeInTheDocument();
  });
});
