/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TableDetails } from '../dashboard/table-details';
import type { Table } from '@/lib/types';

vi.mock('@/components/ui/tabs', () => ({
  Tabs: ({ children }: any) => <div>{children}</div>,
  TabsList: ({ children }: any) => <div role="tablist">{children}</div>,
  TabsTrigger: ({ children, value }: any) => <button role="tab" data-value={value}>{children}</button>,
  TabsContent: ({ children, value }: any) => <div data-tab={value}>{children}</div>,
}));
vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: any) => <span>{children}</span>,
}));
vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children }: any) => <div>{children}</div>,
}));

const testTable: Table = {
  name: 'users',
  columns: [
    { name: 'id', type: 'INT', nullable: false, primaryKey: true, autoIncrement: true, unique: false },
    { name: 'email', type: 'VARCHAR(255)', nullable: false, primaryKey: false, autoIncrement: false, unique: true },
    { name: 'bio', type: 'TEXT', nullable: true, primaryKey: false, autoIncrement: false, unique: false, defaultValue: 'null' },
  ],
  primaryKey: ['id'],
  foreignKeys: [
    { columns: ['dept_id'], referencedTable: 'departments', referencedColumns: ['id'], onDelete: 'CASCADE' },
  ],
  indexes: [
    { name: 'idx_email', columns: ['email'], unique: true, type: 'BTREE' },
  ],
};

const rawSQL = 'CREATE TABLE users (id INT PRIMARY KEY AUTO_INCREMENT, email VARCHAR(255) UNIQUE);';

describe('TableDetails', () => {
  it('renders table name', () => {
    render(<TableDetails table={testTable} rawSQL={rawSQL} />);
    expect(screen.getByText('users')).toBeInTheDocument();
  });

  it('renders column count badge', () => {
    render(<TableDetails table={testTable} rawSQL={rawSQL} />);
    expect(screen.getByText('3 columns')).toBeInTheDocument();
  });

  it('renders all 4 tab triggers', () => {
    render(<TableDetails table={testTable} rawSQL={rawSQL} />);
    expect(screen.getAllByText('Columns').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Indexes').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Foreign Keys').length).toBeGreaterThan(0);
    expect(screen.getAllByText('SQL').length).toBeGreaterThan(0);
  });

  it('renders column names in Columns tab', () => {
    render(<TableDetails table={testTable} rawSQL={rawSQL} />);
    expect(screen.getAllByText('id').length).toBeGreaterThan(0);
    expect(screen.getAllByText('email').length).toBeGreaterThan(0);
    expect(screen.getAllByText('bio').length).toBeGreaterThan(0);
  });

  it('renders column types', () => {
    render(<TableDetails table={testTable} rawSQL={rawSQL} />);
    expect(screen.getByText('INT')).toBeInTheDocument();
    expect(screen.getByText('VARCHAR(255)')).toBeInTheDocument();
    expect(screen.getByText('TEXT')).toBeInTheDocument();
  });

  it('renders PK badge', () => {
    render(<TableDetails table={testTable} rawSQL={rawSQL} />);
    expect(screen.getByText('PK')).toBeInTheDocument();
  });

  it('renders UNI badge for unique columns', () => {
    render(<TableDetails table={testTable} rawSQL={rawSQL} />);
    expect(screen.getByText('UNI')).toBeInTheDocument();
  });

  it('renders nullable as YES/NO', () => {
    render(<TableDetails table={testTable} rawSQL={rawSQL} />);
    expect(screen.getAllByText('YES').length).toBeGreaterThan(0);
    expect(screen.getAllByText('NO').length).toBeGreaterThan(0);
  });

  it('renders AUTO_INCREMENT extra', () => {
    render(<TableDetails table={testTable} rawSQL={rawSQL} />);
    expect(screen.getByText('AUTO_INCREMENT')).toBeInTheDocument();
  });

  it('renders index name', () => {
    render(<TableDetails table={testTable} rawSQL={rawSQL} />);
    expect(screen.getByText('idx_email')).toBeInTheDocument();
  });

  it('renders foreign key references', () => {
    render(<TableDetails table={testTable} rawSQL={rawSQL} />);
    expect(screen.getByText(/departments\(id\)/)).toBeInTheDocument();
    expect(screen.getByText('CASCADE')).toBeInTheDocument();
  });

  it('renders raw SQL', () => {
    render(<TableDetails table={testTable} rawSQL={rawSQL} />);
    expect(screen.getByText(/CREATE TABLE users/)).toBeInTheDocument();
  });

  it('shows "No indexes" for table without indexes', () => {
    const noIdxTable = { ...testTable, indexes: [] };
    render(<TableDetails table={noIdxTable} rawSQL={rawSQL} />);
    expect(screen.getByText('No indexes defined.')).toBeInTheDocument();
  });

  it('shows "No foreign keys" for table without FKs', () => {
    const noFkTable = { ...testTable, foreignKeys: [] };
    render(<TableDetails table={noFkTable} rawSQL={rawSQL} />);
    expect(screen.getByText('No foreign keys defined.')).toBeInTheDocument();
  });
});
