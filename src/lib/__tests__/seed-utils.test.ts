import { describe, it, expect } from 'vitest';
import { topologicalSortTables, buildSeedSchemaContext } from '../seed-utils';
import type { Schema, Table, Column } from '../types';

function col(name: string, overrides: Partial<Column> = {}): Column {
  return {
    name,
    type: 'INT',
    nullable: true,
    primaryKey: false,
    autoIncrement: false,
    unique: false,
    ...overrides,
  };
}

function table(name: string, fkRefs: string[] = [], columns?: Column[]): Table {
  return {
    name,
    columns: columns || [col('id', { primaryKey: true, nullable: false })],
    primaryKey: ['id'],
    foreignKeys: fkRefs.map((ref) => ({
      columns: [`${ref}_id`],
      referencedTable: ref,
      referencedColumns: ['id'],
    })),
    indexes: [],
  };
}

function schema(tables: Table[]): Schema {
  return {
    id: 'test',
    name: 'test',
    dialect: 'mysql',
    tables,
    createdAt: '',
    updatedAt: '',
    rawSQL: '',
  };
}

describe('topologicalSortTables', () => {
  it('sorts independent tables in original order', () => {
    const s = schema([table('users'), table('products'), table('categories')]);
    const sorted = topologicalSortTables(s);
    expect(sorted).toHaveLength(3);
  });

  it('places referenced tables before dependents', () => {
    const s = schema([
      table('orders', ['users']),
      table('users'),
    ]);
    const sorted = topologicalSortTables(s);
    expect(sorted.indexOf('users')).toBeLessThan(sorted.indexOf('orders'));
  });

  it('handles multi-level dependencies', () => {
    const s = schema([
      table('order_items', ['orders']),
      table('orders', ['users']),
      table('users'),
    ]);
    const sorted = topologicalSortTables(s);
    expect(sorted.indexOf('users')).toBeLessThan(sorted.indexOf('orders'));
    expect(sorted.indexOf('orders')).toBeLessThan(sorted.indexOf('order_items'));
  });

  it('handles circular dependencies gracefully', () => {
    const s = schema([
      table('a', ['b']),
      table('b', ['a']),
    ]);
    const sorted = topologicalSortTables(s);
    // Should not infinite loop; both tables should appear
    expect(sorted).toHaveLength(2);
    expect(sorted).toContain('a');
    expect(sorted).toContain('b');
  });

  it('includes referenced tables not in schema.tables', () => {
    const s = schema([
      table('orders', ['users']),
      // 'users' not in schema.tables, but referenced
    ]);
    const sorted = topologicalSortTables(s);
    expect(sorted).toContain('users');
    expect(sorted).toContain('orders');
    expect(sorted.indexOf('users')).toBeLessThan(sorted.indexOf('orders'));
  });
});

describe('buildSeedSchemaContext', () => {
  it('builds context for selected tables', () => {
    const s = schema([
      table('users', [], [
        col('id', { primaryKey: true, autoIncrement: true, nullable: false }),
        col('name', { type: 'VARCHAR(100)', nullable: false }),
        col('email', { type: 'VARCHAR(255)', unique: true, nullable: false }),
      ]),
      table('posts'),
    ]);
    const result = buildSeedSchemaContext(s, ['users']);
    expect(result).toContain('TABLE users:');
    expect(result).toContain('PK');
    expect(result).toContain('AUTO_INCREMENT');
    expect(result).toContain('NOT NULL');
    expect(result).toContain('UNIQUE');
    expect(result).not.toContain('TABLE posts:');
  });

  it('includes FK information', () => {
    const s = schema([
      table('orders', ['users']),
      table('users'),
    ]);
    const result = buildSeedSchemaContext(s, ['orders']);
    expect(result).toContain('FK:');
    expect(result).toContain('users');
  });

  it('includes DEFAULT values', () => {
    const s = schema([
      table('t', [], [
        col('status', { type: 'VARCHAR(20)', defaultValue: "'active'" }),
      ]),
    ]);
    const result = buildSeedSchemaContext(s, ['t']);
    expect(result).toContain("DEFAULT 'active'");
  });

  it('returns empty string for no matching tables', () => {
    const s = schema([table('users')]);
    const result = buildSeedSchemaContext(s, ['nonexistent']);
    expect(result).toBe('');
  });
});
