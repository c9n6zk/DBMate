import { describe, it, expect } from 'vitest';
import { applyFixToSchema } from '../apply-fix';
import type { Schema, Table, Column, AnalysisIssue } from '../types';

function col(name: string, overrides: Partial<Column> = {}): Column {
  return {
    name, type: 'INT', nullable: true, primaryKey: false,
    autoIncrement: false, unique: false, ...overrides,
  };
}

function makeTable(name: string, columns: Column[], extras: Partial<Table> = {}): Table {
  return {
    name, columns,
    primaryKey: columns.filter((c) => c.primaryKey).map((c) => c.name),
    foreignKeys: [], indexes: [], ...extras,
  };
}

function makeSchema(tables: Table[]): Schema {
  return { id: 'test', name: 'test', dialect: 'mysql', tables, createdAt: '', updatedAt: '', rawSQL: '' };
}

function issue(fixSQL: string, table: string = 'users'): AnalysisIssue {
  return { id: 'i1', type: 'performance', severity: 'critical', title: 'Fix', affectedTable: table, fixSQL };
}

describe('applyFixToSchema - coverage gaps', () => {
  describe('ADD COLUMN - existing column update', () => {
    it('updates existing column to PK', () => {
      const schema = makeSchema([
        makeTable('users', [col('id'), col('email')], { primaryKey: [] }),
      ]);
      const result = applyFixToSchema(
        schema,
        issue('ALTER TABLE users ADD COLUMN id INT PRIMARY KEY AUTO_INCREMENT;')
      );
      const idCol = result.tables[0].columns.find((c) => c.name === 'id');
      expect(idCol?.primaryKey).toBe(true);
      expect(idCol?.autoIncrement).toBe(true);
      expect(result.tables[0].primaryKey).toContain('id');
    });

    it('updates existing column to auto increment only', () => {
      const schema = makeSchema([
        makeTable('users', [col('id', { primaryKey: true })]),
      ]);
      const result = applyFixToSchema(
        schema,
        issue('ALTER TABLE users ADD COLUMN id INT AUTO_INCREMENT;')
      );
      const idCol = result.tables[0].columns.find((c) => c.name === 'id');
      expect(idCol?.autoIncrement).toBe(true);
    });

    it('no change if existing column already has PK and autoInc', () => {
      const schema = makeSchema([
        makeTable('users', [col('id', { primaryKey: true, autoIncrement: true })]),
      ]);
      // This ADD COLUMN matches existing col, but no changes needed
      const result = applyFixToSchema(
        schema,
        issue('ALTER TABLE users ADD COLUMN id INT;')
      );
      // Schema returned but anyApplied might be false (rawSQL still appended)
      expect(result.tables[0].columns).toHaveLength(1);
    });
  });

  describe('ADD COLUMN - PK column push', () => {
    it('adds new column as PRIMARY KEY', () => {
      const schema = makeSchema([
        makeTable('users', [col('name')], { primaryKey: [] }),
      ]);
      const result = applyFixToSchema(
        schema,
        issue('ALTER TABLE users ADD COLUMN id INT PRIMARY KEY;')
      );
      expect(result.tables[0].primaryKey).toContain('id');
      expect(result.tables[0].columns.find((c) => c.name === 'id')?.primaryKey).toBe(true);
    });
  });

  describe('ADD COLUMN - UNIQUE column', () => {
    it('adds UNIQUE column', () => {
      const schema = makeSchema([
        makeTable('users', [col('id', { primaryKey: true })]),
      ]);
      const result = applyFixToSchema(
        schema,
        issue('ALTER TABLE users ADD COLUMN email VARCHAR(255) UNIQUE NOT NULL;')
      );
      const emailCol = result.tables[0].columns.find((c) => c.name === 'email');
      expect(emailCol?.unique).toBe(true);
      expect(emailCol?.nullable).toBe(false);
    });
  });

  describe('DROP COLUMN - column not found', () => {
    it('does nothing when column does not exist', () => {
      const schema = makeSchema([
        makeTable('users', [col('id', { primaryKey: true })]),
      ]);
      const result = applyFixToSchema(
        schema,
        issue('ALTER TABLE users DROP COLUMN nonexistent;')
      );
      expect(result.tables[0].columns).toHaveLength(1);
    });
  });

  describe('DROP COLUMN - FK cleanup', () => {
    it('removes FK referencing dropped column', () => {
      const schema = makeSchema([
        makeTable('orders', [col('id', { primaryKey: true }), col('user_id')], {
          foreignKeys: [{ columns: ['user_id'], referencedTable: 'users', referencedColumns: ['id'] }],
        }),
      ]);
      const result = applyFixToSchema(
        schema,
        issue('ALTER TABLE orders DROP COLUMN user_id;', 'orders')
      );
      expect(result.tables[0].foreignKeys).toHaveLength(0);
    });
  });

  describe('CREATE INDEX - table not found', () => {
    it('does nothing when table not found', () => {
      const schema = makeSchema([
        makeTable('users', [col('id', { primaryKey: true })]),
      ]);
      const result = applyFixToSchema(
        schema,
        issue('CREATE INDEX idx_x ON nonexistent(col);')
      );
      // No error, just not applied
      expect(result.tables).toHaveLength(1);
    });
  });

  describe('ALTER TABLE - table not found', () => {
    it('does nothing when ALTER targets missing table', () => {
      const schema = makeSchema([
        makeTable('users', [col('id', { primaryKey: true })]),
      ]);
      const result = applyFixToSchema(
        schema,
        issue('ALTER TABLE missing_table ADD COLUMN x INT;', 'missing_table')
      );
      expect(result.tables).toHaveLength(1);
    });
  });

  describe('ALTER TABLE - unmatched action', () => {
    it('handles ALTER with unrecognized action syntax', () => {
      const schema = makeSchema([
        makeTable('users', [col('id', { primaryKey: true })]),
      ]);
      // This ALTER doesn't match any known pattern
      const result = applyFixToSchema(
        schema,
        issue('ALTER TABLE users SET SCHEMA public;')
      );
      // Should not crash
      expect(result.tables).toHaveLength(1);
    });
  });

  describe('DROP TABLE - table not found', () => {
    it('does nothing for nonexistent table', () => {
      const schema = makeSchema([
        makeTable('users', [col('id', { primaryKey: true })]),
      ]);
      const result = applyFixToSchema(
        schema,
        issue('DROP TABLE nonexistent;', 'nonexistent')
      );
      expect(result.tables).toHaveLength(1);
    });
  });

  describe('COMMENT ON TABLE - table not found', () => {
    it('does nothing for nonexistent table', () => {
      const schema = makeSchema([
        makeTable('users', [col('id', { primaryKey: true })]),
      ]);
      const result = applyFixToSchema(
        schema,
        issue("COMMENT ON TABLE missing IS 'test';", 'missing')
      );
      expect(result.tables).toHaveLength(1);
    });
  });

  describe('CREATE TABLE with UNIQUE constraint', () => {
    it('parses UNIQUE constraint in CREATE TABLE', () => {
      const schema = makeSchema([]);
      const result = applyFixToSchema(
        schema,
        issue(
          `CREATE TABLE users (
            id INT PRIMARY KEY,
            email VARCHAR(255),
            UNIQUE (email)
          )`,
          'users'
        )
      );
      expect(result.tables[0].indexes.some((i) => i.unique)).toBe(true);
    });
  });

  describe('ALTER TABLE ADD FK with ON UPDATE', () => {
    it('handles ON UPDATE CASCADE', () => {
      const schema = makeSchema([
        makeTable('orders', [col('id', { primaryKey: true }), col('user_id')]),
      ]);
      const result = applyFixToSchema(
        schema,
        issue('ALTER TABLE orders ADD CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE;', 'orders')
      );
      const fk = result.tables[0].foreignKeys[0];
      expect(fk.onDelete).toBe('SET NULL');
      expect(fk.onUpdate).toBe('CASCADE');
    });
  });

  describe('DROP FK - FK not found', () => {
    it('does nothing when FK name not found', () => {
      const schema = makeSchema([
        makeTable('orders', [col('id', { primaryKey: true })], {
          foreignKeys: [{ name: 'fk_other', columns: ['x'], referencedTable: 'y', referencedColumns: ['z'] }],
        }),
      ]);
      const result = applyFixToSchema(
        schema,
        issue('ALTER TABLE orders DROP FOREIGN KEY fk_nonexistent;', 'orders')
      );
      expect(result.tables[0].foreignKeys).toHaveLength(1);
    });
  });
});
