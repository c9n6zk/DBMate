/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TableSelector, type TableSeedConfig } from '../seed/table-selector';
import type { Table } from '@/lib/types';

vi.mock('@/components/ui/input', () => ({
  Input: (props: any) => <input {...props} />,
}));
vi.mock('@/components/ui/label', () => ({
  Label: ({ children, ...props }: any) => <label {...props}>{children}</label>,
}));
vi.mock('@/components/ui/switch', () => ({
  Switch: ({ checked, onCheckedChange, ...props }: any) => (
    <input type="checkbox" checked={checked} onChange={(e) => onCheckedChange(e.target.checked)} {...props} />
  ),
}));

const tables: Table[] = [
  { name: 'users', columns: [], primaryKey: [], foreignKeys: [], indexes: [] },
  { name: 'orders', columns: [], primaryKey: [], foreignKeys: [], indexes: [] },
];

const configs: TableSeedConfig[] = [
  { tableName: 'users', enabled: true, rowCount: 50 },
  { tableName: 'orders', enabled: false, rowCount: 50 },
];

describe('TableSelector', () => {
  const onChange = vi.fn();

  beforeEach(() => onChange.mockReset());

  it('renders table names', () => {
    render(<TableSelector tables={tables} configs={configs} onChange={onChange} />);
    expect(screen.getByText('users')).toBeInTheDocument();
    expect(screen.getByText('orders')).toBeInTheDocument();
  });

  it('renders "Tables to seed" label', () => {
    render(<TableSelector tables={tables} configs={configs} onChange={onChange} />);
    expect(screen.getByText('Tables to seed')).toBeInTheDocument();
  });

  it('shows Toggle all / Select all text', () => {
    render(<TableSelector tables={tables} configs={configs} onChange={onChange} />);
    // One is enabled, one is not => "Toggle all"
    expect(screen.getByText('Toggle all')).toBeInTheDocument();
  });

  it('shows "Deselect all" when all enabled', () => {
    const allEnabled = configs.map((c) => ({ ...c, enabled: true }));
    render(<TableSelector tables={tables} configs={allEnabled} onChange={onChange} />);
    expect(screen.getByText('Deselect all')).toBeInTheDocument();
  });

  it('shows "Select all" when none enabled', () => {
    const noneEnabled = configs.map((c) => ({ ...c, enabled: false }));
    render(<TableSelector tables={tables} configs={noneEnabled} onChange={onChange} />);
    expect(screen.getByText('Select all')).toBeInTheDocument();
  });

  it('has checkboxes for each table', () => {
    render(<TableSelector tables={tables} configs={configs} onChange={onChange} />);
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBeGreaterThanOrEqual(3); // 1 toggle all + 2 tables
  });
});
