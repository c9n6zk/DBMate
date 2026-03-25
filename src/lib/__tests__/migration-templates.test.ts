import { describe, it, expect } from 'vitest';
import {
  generateStaticMigration,
  parseMigrationIntent,
  type MigrationOp,
} from '../migration-templates';

describe('generateStaticMigration', () => {
  const schemaId = 'sch-1';
  const version = 'v001';

  describe('ADD_INDEX', () => {
    it('generates CREATE INDEX', () => {
      const op: MigrationOp = { type: 'ADD_INDEX', table: 'users', columns: ['email'] };
      const m = generateStaticMigration(op, 'mysql', version, schemaId);
      expect(m.upSQL).toContain('CREATE INDEX idx_users_email ON users(email)');
      expect(m.downSQL).toContain('DROP INDEX idx_users_email ON users');
    });

    it('generates UNIQUE INDEX', () => {
      const op: MigrationOp = { type: 'ADD_INDEX', table: 'users', columns: ['email'], unique: true };
      const m = generateStaticMigration(op, 'mysql', version, schemaId);
      expect(m.upSQL).toContain('CREATE UNIQUE INDEX');
      expect(m.name).toContain('unique');
    });

    it('uses correct DROP syntax for PostgreSQL', () => {
      const op: MigrationOp = { type: 'ADD_INDEX', table: 'users', columns: ['email'] };
      const m = generateStaticMigration(op, 'postgresql', version, schemaId);
      expect(m.downSQL).toBe('DROP INDEX idx_users_email;');
    });

    it('handles composite indexes', () => {
      const op: MigrationOp = { type: 'ADD_INDEX', table: 'orders', columns: ['user_id', 'status'] };
      const m = generateStaticMigration(op, 'mysql', version, schemaId);
      expect(m.upSQL).toContain('user_id, status');
    });
  });

  describe('ADD_COLUMN', () => {
    it('generates ALTER TABLE ADD COLUMN', () => {
      const op: MigrationOp = {
        type: 'ADD_COLUMN',
        table: 'users',
        column: {
          name: 'age',
          type: 'INT',
          nullable: true,
          primaryKey: false,
          autoIncrement: false,
          unique: false,
        },
      };
      const m = generateStaticMigration(op, 'mysql', version, schemaId);
      expect(m.upSQL).toContain('ALTER TABLE users ADD COLUMN age INT');
      expect(m.downSQL).toContain('DROP COLUMN age');
    });

    it('includes NOT NULL', () => {
      const op: MigrationOp = {
        type: 'ADD_COLUMN',
        table: 'users',
        column: {
          name: 'email',
          type: 'VARCHAR(255)',
          nullable: false,
          primaryKey: false,
          autoIncrement: false,
          unique: false,
        },
      };
      const m = generateStaticMigration(op, 'mysql', version, schemaId);
      expect(m.upSQL).toContain('NOT NULL');
    });

    it('includes DEFAULT value', () => {
      const op: MigrationOp = {
        type: 'ADD_COLUMN',
        table: 'users',
        column: {
          name: 'status',
          type: 'VARCHAR(20)',
          nullable: true,
          primaryKey: false,
          autoIncrement: false,
          unique: false,
          defaultValue: "'active'",
        },
      };
      const m = generateStaticMigration(op, 'mysql', version, schemaId);
      expect(m.upSQL).toContain("DEFAULT 'active'");
    });

    it('SQLite drop column uses comment fallback', () => {
      const op: MigrationOp = {
        type: 'ADD_COLUMN',
        table: 'users',
        column: {
          name: 'age',
          type: 'INT',
          nullable: true,
          primaryKey: false,
          autoIncrement: false,
          unique: false,
        },
      };
      const m = generateStaticMigration(op, 'sqlite', version, schemaId);
      expect(m.downSQL).toContain('SQLite');
    });
  });

  describe('DROP_COLUMN', () => {
    it('generates DROP COLUMN', () => {
      const op: MigrationOp = { type: 'DROP_COLUMN', table: 'users', columnName: 'bio' };
      const m = generateStaticMigration(op, 'mysql', version, schemaId);
      expect(m.upSQL).toContain('DROP COLUMN bio');
    });
  });

  describe('ADD_FK', () => {
    it('generates ADD CONSTRAINT FOREIGN KEY', () => {
      const op: MigrationOp = {
        type: 'ADD_FK',
        table: 'orders',
        fk: {
          columns: ['user_id'],
          referencedTable: 'users',
          referencedColumns: ['id'],
          onDelete: 'CASCADE',
        },
      };
      const m = generateStaticMigration(op, 'mysql', version, schemaId);
      expect(m.upSQL).toContain('FOREIGN KEY (user_id)');
      expect(m.upSQL).toContain('REFERENCES users(id)');
      expect(m.upSQL).toContain('ON DELETE CASCADE');
    });

    it('uses DROP FOREIGN KEY for MySQL', () => {
      const op: MigrationOp = {
        type: 'ADD_FK',
        table: 'orders',
        fk: { columns: ['user_id'], referencedTable: 'users', referencedColumns: ['id'] },
      };
      const m = generateStaticMigration(op, 'mysql', version, schemaId);
      expect(m.downSQL).toContain('DROP FOREIGN KEY');
    });

    it('uses DROP CONSTRAINT for PostgreSQL', () => {
      const op: MigrationOp = {
        type: 'ADD_FK',
        table: 'orders',
        fk: { columns: ['user_id'], referencedTable: 'users', referencedColumns: ['id'] },
      };
      const m = generateStaticMigration(op, 'postgresql', version, schemaId);
      expect(m.downSQL).toContain('DROP CONSTRAINT');
    });
  });

  describe('DROP_FK', () => {
    it('generates DROP FOREIGN KEY (MySQL)', () => {
      const op: MigrationOp = { type: 'DROP_FK', table: 'orders', constraintName: 'fk_user' };
      const m = generateStaticMigration(op, 'mysql', version, schemaId);
      expect(m.upSQL).toContain('DROP FOREIGN KEY fk_user');
    });

    it('generates DROP CONSTRAINT (PostgreSQL)', () => {
      const op: MigrationOp = { type: 'DROP_FK', table: 'orders', constraintName: 'fk_user' };
      const m = generateStaticMigration(op, 'postgresql', version, schemaId);
      expect(m.upSQL).toContain('DROP CONSTRAINT fk_user');
    });
  });

  describe('DROP_INDEX', () => {
    it('generates DROP INDEX ON (MySQL)', () => {
      const op: MigrationOp = { type: 'DROP_INDEX', table: 'users', indexName: 'idx_email' };
      const m = generateStaticMigration(op, 'mysql', version, schemaId);
      expect(m.upSQL).toContain('DROP INDEX idx_email ON users');
    });

    it('generates DROP INDEX (PostgreSQL)', () => {
      const op: MigrationOp = { type: 'DROP_INDEX', table: 'users', indexName: 'idx_email' };
      const m = generateStaticMigration(op, 'postgresql', version, schemaId);
      expect(m.upSQL).toBe('DROP INDEX idx_email;');
    });
  });

  describe('APPLY_FIX', () => {
    it('wraps arbitrary fix SQL', () => {
      const op: MigrationOp = { type: 'APPLY_FIX', fixSQL: 'ALTER TABLE t ADD COLUMN x INT;' };
      const m = generateStaticMigration(op, 'mysql', version, schemaId);
      expect(m.upSQL).toBe('ALTER TABLE t ADD COLUMN x INT;');
      expect(m.downSQL).toContain('Manual rollback');
    });
  });

  describe('common properties', () => {
    it('sets schemaId and version', () => {
      const op: MigrationOp = { type: 'DROP_INDEX', table: 't', indexName: 'idx' };
      const m = generateStaticMigration(op, 'mysql', version, schemaId);
      expect(m.schemaId).toBe(schemaId);
      expect(m.version).toBe(version);
      expect(m.format).toBe('raw');
      expect(m.id).toBeTruthy();
    });
  });
});

describe('parseMigrationIntent', () => {
  it('parses "add index on users(email)"', () => {
    const result = parseMigrationIntent('add index on users(email)');
    expect(result).toEqual({
      type: 'ADD_INDEX',
      table: 'users',
      columns: ['email'],
      unique: false,
    });
  });

  it('parses "add unique index on users(email)"', () => {
    const result = parseMigrationIntent('add unique index on users(email)');
    expect(result).toEqual({
      type: 'ADD_INDEX',
      table: 'users',
      columns: ['email'],
      unique: true,
    });
  });

  it('parses "drop index idx_email on users"', () => {
    const result = parseMigrationIntent('drop index idx_email on users');
    expect(result).toEqual({
      type: 'DROP_INDEX',
      table: 'users',
      indexName: 'idx_email',
    });
  });

  it('parses "add column age INT to users"', () => {
    const result = parseMigrationIntent('add column age INT to users');
    expect(result).not.toBeNull();
    expect(result!.type).toBe('ADD_COLUMN');
    if (result!.type === 'ADD_COLUMN') {
      expect(result!.table).toBe('users');
      expect(result!.column.name).toBe('age');
      expect(result!.column.type).toBe('INT');
    }
  });

  it('parses "drop column bio from posts"', () => {
    const result = parseMigrationIntent('drop column bio from posts');
    expect(result).toEqual({
      type: 'DROP_COLUMN',
      table: 'posts',
      columnName: 'bio',
    });
  });

  it('parses "add foreign key on orders(user_id) references users(id)"', () => {
    const result = parseMigrationIntent(
      'add foreign key on orders(user_id) references users(id)'
    );
    expect(result).not.toBeNull();
    expect(result!.type).toBe('ADD_FK');
  });

  it('parses "drop constraint fk_user from orders"', () => {
    const result = parseMigrationIntent('drop constraint fk_user from orders');
    expect(result).toEqual({
      type: 'DROP_FK',
      table: 'orders',
      constraintName: 'fk_user',
    });
  });

  it('returns null for unrecognized input', () => {
    expect(parseMigrationIntent('do something random')).toBeNull();
  });
});
