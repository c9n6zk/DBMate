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
  return {
    id: 'test',
    name: 'test',
    dialect: 'mysql',
    tables,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    rawSQL: '',
  };
}

function makeIssue(fixSQL: string, table: string = 'users'): AnalysisIssue {
  return {
    id: 'issue-1',
    type: 'performance',
    severity: 'critical',
    title: 'Test issue',
    affectedTable: table,
    fixSQL,
  };
}

describe('applyFixToSchema', () => {
  describe('CREATE INDEX', () => {
    it('adds index to table', () => {
      const schema = makeSchema([
        makeTable('users', [col('id', { primaryKey: true }), col('email')]),
      ]);
      const issue = makeIssue('CREATE INDEX idx_email ON users(email);');
      const result = applyFixToSchema(schema, issue);
      const usersTable = result.tables.find((t) => t.name === 'users')!;
      expect(usersTable.indexes).toHaveLength(1);
      expect(usersTable.indexes[0].name).toBe('idx_email');
      expect(usersTable.indexes[0].columns).toEqual(['email']);
    });

    it('adds UNIQUE index', () => {
      const schema = makeSchema([
        makeTable('users', [col('id', { primaryKey: true }), col('email')]),
      ]);
      const issue = makeIssue('CREATE UNIQUE INDEX idx_email ON users(email);');
      const result = applyFixToSchema(schema, issue);
      expect(result.tables[0].indexes[0].unique).toBe(true);
    });

    it('skips duplicate index', () => {
      const schema = makeSchema([
        makeTable('users', [col('id', { primaryKey: true })], {
          indexes: [{ name: 'idx_email', columns: ['email'], unique: false }],
        }),
      ]);
      const issue = makeIssue('CREATE INDEX idx_email ON users(email);');
      const result = applyFixToSchema(schema, issue);
      expect(result.tables[0].indexes).toHaveLength(1);
    });
  });

  describe('ALTER TABLE ADD COLUMN', () => {
    it('adds new column', () => {
      const schema = makeSchema([
        makeTable('users', [col('id', { primaryKey: true })]),
      ]);
      const issue = makeIssue('ALTER TABLE users ADD COLUMN email VARCHAR(255) NOT NULL;');
      const result = applyFixToSchema(schema, issue);
      const usersTable = result.tables.find((t) => t.name === 'users')!;
      expect(usersTable.columns).toHaveLength(2);
      expect(usersTable.columns[1].name).toBe('email');
      expect(usersTable.columns[1].nullable).toBe(false);
    });

    it('adds column with DEFAULT', () => {
      const schema = makeSchema([
        makeTable('users', [col('id', { primaryKey: true })]),
      ]);
      const issue = makeIssue("ALTER TABLE users ADD COLUMN status VARCHAR(20) DEFAULT 'active';");
      const result = applyFixToSchema(schema, issue);
      const statusCol = result.tables[0].columns.find((c) => c.name === 'status');
      expect(statusCol?.defaultValue).toBe("'active'");
    });
  });

  describe('ALTER TABLE DROP COLUMN', () => {
    it('removes column', () => {
      const schema = makeSchema([
        makeTable('users', [col('id', { primaryKey: true }), col('bio')]),
      ]);
      const issue = makeIssue('ALTER TABLE users DROP COLUMN bio;');
      const result = applyFixToSchema(schema, issue);
      expect(result.tables[0].columns).toHaveLength(1);
      expect(result.tables[0].columns[0].name).toBe('id');
    });

    it('cleans up primary key references when dropping PK column', () => {
      const schema = makeSchema([
        makeTable('users', [
          col('id', { primaryKey: true }),
          col('name', { primaryKey: true }),
        ]),
      ]);
      const issue = makeIssue('ALTER TABLE users DROP COLUMN name;');
      const result = applyFixToSchema(schema, issue);
      expect(result.tables[0].primaryKey).not.toContain('name');
    });
  });

  describe('ALTER TABLE MODIFY COLUMN', () => {
    it('changes column type', () => {
      const schema = makeSchema([
        makeTable('users', [col('id', { primaryKey: true }), col('age', { type: 'SMALLINT' })]),
      ]);
      const issue = makeIssue('ALTER TABLE users MODIFY COLUMN age INT NOT NULL;');
      const result = applyFixToSchema(schema, issue);
      const ageCol = result.tables[0].columns.find((c) => c.name === 'age');
      expect(ageCol?.type).toBe('INT');
      expect(ageCol?.nullable).toBe(false);
    });
  });

  describe('ALTER TABLE SET NOT NULL (PostgreSQL)', () => {
    it('sets column to NOT NULL', () => {
      const schema = makeSchema([
        makeTable('users', [col('id', { primaryKey: true }), col('name', { nullable: true })]),
      ]);
      const issue = makeIssue('ALTER TABLE users ALTER COLUMN name SET NOT NULL;');
      const result = applyFixToSchema(schema, issue);
      const nameCol = result.tables[0].columns.find((c) => c.name === 'name');
      expect(nameCol?.nullable).toBe(false);
    });
  });

  describe('ALTER TABLE RENAME COLUMN', () => {
    it('renames column', () => {
      const schema = makeSchema([
        makeTable('users', [col('id', { primaryKey: true }), col('fname')]),
      ]);
      const issue = makeIssue('ALTER TABLE users RENAME COLUMN fname TO first_name;');
      const result = applyFixToSchema(schema, issue);
      expect(result.tables[0].columns.find((c) => c.name === 'first_name')).toBeDefined();
      expect(result.tables[0].columns.find((c) => c.name === 'fname')).toBeUndefined();
    });

    it('updates PK, FK, and index references on rename', () => {
      const schema = makeSchema([
        makeTable('users', [col('user_id', { primaryKey: true })], {
          primaryKey: ['user_id'],
          indexes: [{ name: 'idx', columns: ['user_id'], unique: false }],
          foreignKeys: [
            { columns: ['user_id'], referencedTable: 'other', referencedColumns: ['id'] },
          ],
        }),
      ]);
      const issue = makeIssue('ALTER TABLE users RENAME COLUMN user_id TO id;');
      const result = applyFixToSchema(schema, issue);
      expect(result.tables[0].primaryKey).toContain('id');
      expect(result.tables[0].indexes[0].columns).toContain('id');
      expect(result.tables[0].foreignKeys[0].columns).toContain('id');
    });
  });

  describe('COMMENT ON TABLE (PostgreSQL)', () => {
    it('sets table comment', () => {
      const schema = makeSchema([
        makeTable('users', [col('id', { primaryKey: true })]),
      ]);
      const issue = makeIssue("COMMENT ON TABLE users IS 'User accounts';");
      const result = applyFixToSchema(schema, issue);
      expect(result.tables[0].comment).toBe('User accounts');
    });
  });

  describe('ALTER TABLE COMMENT (MySQL)', () => {
    it('sets table comment via ALTER', () => {
      const schema = makeSchema([
        makeTable('users', [col('id', { primaryKey: true })]),
      ]);
      const issue = makeIssue("ALTER TABLE users COMMENT = 'User accounts';");
      const result = applyFixToSchema(schema, issue);
      expect(result.tables[0].comment).toBe('User accounts');
    });
  });

  describe('CREATE TABLE', () => {
    it('adds new table', () => {
      const schema = makeSchema([
        makeTable('users', [col('id', { primaryKey: true })]),
      ]);
      const issue = makeIssue(
        'CREATE TABLE audit_log (id INT PRIMARY KEY, action VARCHAR(100) NOT NULL)',
        'audit_log'
      );
      const result = applyFixToSchema(schema, issue);
      expect(result.tables).toHaveLength(2);
      expect(result.tables.find((t) => t.name === 'audit_log')).toBeDefined();
    });

    it('does not duplicate existing table', () => {
      const schema = makeSchema([
        makeTable('users', [col('id', { primaryKey: true })]),
      ]);
      const issue = makeIssue('CREATE TABLE users (id INT PRIMARY KEY)');
      const result = applyFixToSchema(schema, issue);
      expect(result.tables).toHaveLength(1);
    });
  });

  describe('DROP TABLE', () => {
    it('removes table', () => {
      const schema = makeSchema([
        makeTable('users', [col('id', { primaryKey: true })]),
        makeTable('temp', [col('id', { primaryKey: true })]),
      ]);
      const issue = makeIssue('DROP TABLE temp;', 'temp');
      const result = applyFixToSchema(schema, issue);
      expect(result.tables).toHaveLength(1);
      expect(result.tables[0].name).toBe('users');
    });
  });

  describe('multi-statement fix', () => {
    it('applies multiple statements', () => {
      const schema = makeSchema([
        makeTable('users', [col('id', { primaryKey: true })]),
      ]);
      const issue = makeIssue(
        'ALTER TABLE users ADD COLUMN created_at TIMESTAMP;\n' +
        'ALTER TABLE users ADD COLUMN updated_at TIMESTAMP;'
      );
      const result = applyFixToSchema(schema, issue);
      expect(result.tables[0].columns).toHaveLength(3);
    });
  });

  describe('immutability', () => {
    it('does not mutate original schema', () => {
      const schema = makeSchema([
        makeTable('users', [col('id', { primaryKey: true })]),
      ]);
      const originalTableCount = schema.tables.length;
      const originalColCount = schema.tables[0].columns.length;

      applyFixToSchema(schema, makeIssue('ALTER TABLE users ADD COLUMN email VARCHAR(255);'));

      expect(schema.tables.length).toBe(originalTableCount);
      expect(schema.tables[0].columns.length).toBe(originalColCount);
    });
  });

  describe('no fixSQL', () => {
    it('returns schema unchanged when no fixSQL', () => {
      const schema = makeSchema([makeTable('users', [col('id', { primaryKey: true })])]);
      const issue: AnalysisIssue = {
        id: 'x',
        type: 'convention',
        severity: 'info',
        title: 'No fix',
        affectedTable: 'users',
      };
      const result = applyFixToSchema(schema, issue);
      expect(result).toBe(schema);
    });
  });

  describe('rawSQL update', () => {
    it('appends fix SQL to rawSQL', () => {
      const schema = makeSchema([
        makeTable('users', [col('id', { primaryKey: true })]),
      ]);
      schema.rawSQL = 'CREATE TABLE users (id INT PRIMARY KEY);';
      const fix = 'ALTER TABLE users ADD COLUMN email VARCHAR(255);';
      const result = applyFixToSchema(schema, makeIssue(fix));
      expect(result.rawSQL).toContain(fix);
    });
  });
});
