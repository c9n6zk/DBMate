import { describe, it, expect } from 'vitest';
import { applyFixToSchema } from '../apply-fix';
import type { Schema, Table, Column, AnalysisIssue } from '../types';

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

function makeTable(name: string, columns: Column[], extras: Partial<Table> = {}): Table {
  return {
    name,
    columns,
    primaryKey: columns.filter((c) => c.primaryKey).map((c) => c.name),
    foreignKeys: [],
    indexes: [],
    ...extras,
  };
}

function makeSchema(tables: Table[]): Schema {
  return { id: 'test', name: 'test', dialect: 'mysql', tables, createdAt: '', updatedAt: '', rawSQL: '' };
}

function issue(fixSQL: string, table: string = 'users'): AnalysisIssue {
  return { id: 'i1', type: 'performance', severity: 'critical', title: 'Fix', affectedTable: table, fixSQL };
}

describe('applyFixToSchema - edge cases', () => {
  it('handles ADD COLUMN with REFERENCES (inline FK)', () => {
    const schema = makeSchema([makeTable('orders', [col('id', { primaryKey: true })])]);
    const result = applyFixToSchema(
      schema,
      issue('ALTER TABLE orders ADD COLUMN user_id INT REFERENCES users(id);', 'orders')
    );
    const table = result.tables.find((t) => t.name === 'orders')!;
    expect(table.columns.find((c) => c.name === 'user_id')).toBeDefined();
    expect(table.foreignKeys).toHaveLength(1);
    expect(table.foreignKeys[0].referencedTable).toBe('users');
  });

  it('handles ADD PRIMARY KEY constraint', () => {
    const schema = makeSchema([
      makeTable('t', [col('a'), col('b')], { primaryKey: [] }),
    ]);
    const result = applyFixToSchema(
      schema,
      issue('ALTER TABLE t ADD PRIMARY KEY (a, b);', 't')
    );
    expect(result.tables[0].primaryKey).toEqual(['a', 'b']);
    expect(result.tables[0].columns[0].primaryKey).toBe(true);
    expect(result.tables[0].columns[1].primaryKey).toBe(true);
  });

  it('handles DROP PRIMARY KEY', () => {
    const schema = makeSchema([
      makeTable('t', [col('id', { primaryKey: true })]),
    ]);
    const result = applyFixToSchema(
      schema,
      issue('ALTER TABLE t DROP PRIMARY KEY;', 't')
    );
    expect(result.tables[0].primaryKey).toEqual([]);
    expect(result.tables[0].columns[0].primaryKey).toBe(false);
  });

  it('handles ADD CONSTRAINT FOREIGN KEY', () => {
    const schema = makeSchema([
      makeTable('orders', [col('id', { primaryKey: true }), col('user_id')]),
    ]);
    const result = applyFixToSchema(
      schema,
      issue('ALTER TABLE orders ADD CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;', 'orders')
    );
    expect(result.tables[0].foreignKeys).toHaveLength(1);
    expect(result.tables[0].foreignKeys[0].name).toBe('fk_user');
    expect(result.tables[0].foreignKeys[0].onDelete).toBe('CASCADE');
  });

  it('handles DROP FOREIGN KEY', () => {
    const schema = makeSchema([
      makeTable('orders', [col('id', { primaryKey: true })], {
        foreignKeys: [{ name: 'fk_user', columns: ['user_id'], referencedTable: 'users', referencedColumns: ['id'] }],
      }),
    ]);
    const result = applyFixToSchema(
      schema,
      issue('ALTER TABLE orders DROP FOREIGN KEY fk_user;', 'orders')
    );
    expect(result.tables[0].foreignKeys).toHaveLength(0);
  });

  it('handles CREATE TABLE with FK constraints', () => {
    const schema = makeSchema([]);
    const result = applyFixToSchema(
      schema,
      issue(
        `CREATE TABLE audit_log (
          id INT PRIMARY KEY AUTO_INCREMENT,
          user_id INT NOT NULL,
          action VARCHAR(100) NOT NULL,
          FOREIGN KEY (user_id) REFERENCES users(id)
        )`,
        'audit_log'
      )
    );
    expect(result.tables).toHaveLength(1);
    expect(result.tables[0].name).toBe('audit_log');
    expect(result.tables[0].foreignKeys).toHaveLength(1);
    expect(result.tables[0].columns.length).toBeGreaterThanOrEqual(3);
  });

  it('handles DROP TABLE IF EXISTS', () => {
    const schema = makeSchema([
      makeTable('t', [col('id', { primaryKey: true })]),
    ]);
    const result = applyFixToSchema(
      schema,
      issue('DROP TABLE IF EXISTS t;', 't')
    );
    expect(result.tables).toHaveLength(0);
  });

  it('handles case-insensitive table name matching', () => {
    const schema = makeSchema([
      makeTable('Users', [col('id', { primaryKey: true }), col('bio')]),
    ]);
    const result = applyFixToSchema(
      schema,
      issue('ALTER TABLE users DROP COLUMN bio;', 'Users')
    );
    expect(result.tables[0].columns).toHaveLength(1);
  });

  it('handles multi-statement fix with semicolons', () => {
    const schema = makeSchema([
      makeTable('users', [col('id', { primaryKey: true })]),
    ]);
    const fixSQL = [
      'ALTER TABLE users ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;',
      'ALTER TABLE users ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;',
      "COMMENT ON TABLE users IS 'User accounts';",
    ].join('\n');
    const result = applyFixToSchema(schema, issue(fixSQL));
    expect(result.tables[0].columns).toHaveLength(3);
    expect(result.tables[0].comment).toBe('User accounts');
  });

  it('ignores comment-only lines in multi-statement fix', () => {
    const schema = makeSchema([
      makeTable('users', [col('id', { primaryKey: true })]),
    ]);
    // Comments are filtered by the statement split + filter logic
    const fixSQL = '-- This is a comment;\nALTER TABLE users ADD COLUMN x INT;';
    const result = applyFixToSchema(schema, issue(fixSQL));
    expect(result.tables[0].columns).toHaveLength(2);
  });
});
