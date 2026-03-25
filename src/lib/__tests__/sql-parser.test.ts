import { describe, it, expect } from 'vitest';
import { parseSQL } from '../sql-parser';

describe('parseSQL', () => {
  describe('basic table parsing', () => {
    it('parses a simple CREATE TABLE', () => {
      const sql = 'CREATE TABLE users (id INT PRIMARY KEY, name VARCHAR(100));';
      const result = parseSQL(sql, 'mysql');
      expect(result.schema.tables).toHaveLength(1);
      expect(result.schema.tables[0].name).toBe('users');
      expect(result.schema.tables[0].columns).toHaveLength(2);
    });

    it('extracts column types', () => {
      const sql = 'CREATE TABLE t (id INT, name VARCHAR(100), active BOOLEAN);';
      const result = parseSQL(sql, 'mysql');
      const cols = result.schema.tables[0].columns;
      expect(cols[0].type).toMatch(/INT/i);
      expect(cols[1].type).toMatch(/VARCHAR\(100\)/i);
    });

    it('detects primary key columns', () => {
      const sql = 'CREATE TABLE t (id INT PRIMARY KEY);';
      const result = parseSQL(sql, 'mysql');
      expect(result.schema.tables[0].columns[0].primaryKey).toBe(true);
      expect(result.schema.tables[0].primaryKey).toContain('id');
    });

    it('parses AUTO_INCREMENT', () => {
      const sql = 'CREATE TABLE t (id INT PRIMARY KEY AUTO_INCREMENT);';
      const result = parseSQL(sql, 'mysql');
      expect(result.schema.tables[0].columns[0].autoIncrement).toBe(true);
    });
  });

  describe('multiple tables', () => {
    it('parses multiple CREATE TABLE statements', () => {
      const sql = `
        CREATE TABLE users (id INT PRIMARY KEY);
        CREATE TABLE posts (id INT PRIMARY KEY, user_id INT);
      `;
      const result = parseSQL(sql, 'mysql');
      expect(result.schema.tables).toHaveLength(2);
    });

    it('auto-generates schema name from table count', () => {
      const sql = `
        CREATE TABLE a (id INT PRIMARY KEY);
        CREATE TABLE b (id INT PRIMARY KEY);
      `;
      const result = parseSQL(sql, 'mysql');
      expect(result.schema.name).toBe('schema_2_tables');
    });

    it('uses single table name for single-table schemas', () => {
      const sql = 'CREATE TABLE orders (id INT PRIMARY KEY);';
      const result = parseSQL(sql, 'mysql');
      expect(result.schema.name).toBe('orders');
    });

    it('uses provided name over auto-generated', () => {
      const sql = 'CREATE TABLE t (id INT PRIMARY KEY);';
      const result = parseSQL(sql, 'mysql', 'My Schema');
      expect(result.schema.name).toBe('My Schema');
    });
  });

  describe('constraints', () => {
    it('parses foreign keys', () => {
      const sql = `
        CREATE TABLE orders (
          id INT PRIMARY KEY,
          user_id INT,
          FOREIGN KEY (user_id) REFERENCES users(id)
        );
      `;
      const result = parseSQL(sql, 'mysql');
      const fks = result.schema.tables[0].foreignKeys;
      expect(fks).toHaveLength(1);
      expect(fks[0].columns).toEqual(['user_id']);
      expect(fks[0].referencedTable).toBe('users');
      expect(fks[0].referencedColumns).toEqual(['id']);
    });

    it('parses composite primary key', () => {
      const sql = `
        CREATE TABLE order_items (
          order_id INT,
          item_id INT,
          PRIMARY KEY (order_id, item_id)
        );
      `;
      const result = parseSQL(sql, 'mysql');
      expect(result.schema.tables[0].primaryKey).toEqual(['order_id', 'item_id']);
    });

    it('parses UNIQUE constraint', () => {
      const sql = `
        CREATE TABLE users (
          id INT PRIMARY KEY,
          email VARCHAR(255),
          UNIQUE (email)
        );
      `;
      const result = parseSQL(sql, 'mysql');
      expect(result.schema.tables[0].indexes.some((i) => i.unique)).toBe(true);
    });

    it('parses NOT NULL constraint', () => {
      const sql = 'CREATE TABLE t (id INT PRIMARY KEY, name VARCHAR(100) NOT NULL);';
      const result = parseSQL(sql, 'mysql');
      const nameCol = result.schema.tables[0].columns.find((c) => c.name === 'name');
      expect(nameCol?.nullable).toBe(false);
    });
  });

  describe('dialects', () => {
    it('parses with MySQL dialect', () => {
      const sql = 'CREATE TABLE t (id INT PRIMARY KEY AUTO_INCREMENT);';
      const result = parseSQL(sql, 'mysql');
      expect(result.schema.dialect).toBe('mysql');
    });

    it('parses with SQLite dialect', () => {
      const sql = 'CREATE TABLE t (id INTEGER PRIMARY KEY);';
      const result = parseSQL(sql, 'sqlite');
      expect(result.schema.dialect).toBe('sqlite');
    });

    it('falls back to MySQL for PostgreSQL parsing errors', () => {
      const sql = 'CREATE TABLE t (id INT PRIMARY KEY);';
      const result = parseSQL(sql, 'postgresql');
      expect(result.schema.tables).toHaveLength(1);
    });
  });

  describe('error handling', () => {
    it('throws on invalid SQL', () => {
      expect(() => parseSQL('NOT SQL AT ALL', 'mysql')).toThrow('SQL parse error');
    });

    it('throws when no CREATE TABLE found', () => {
      expect(() => parseSQL('SELECT * FROM users;', 'mysql')).toThrow(
        'No CREATE TABLE statements found'
      );
    });
  });

  describe('schema metadata', () => {
    it('generates a unique ID', () => {
      const sql = 'CREATE TABLE t (id INT PRIMARY KEY);';
      const r1 = parseSQL(sql, 'mysql');
      const r2 = parseSQL(sql, 'mysql');
      expect(r1.schema.id).not.toBe(r2.schema.id);
    });

    it('sets dialect', () => {
      const sql = 'CREATE TABLE t (id INT PRIMARY KEY);';
      expect(parseSQL(sql, 'postgresql').schema.dialect).toBe('postgresql');
    });

    it('stores raw SQL', () => {
      const sql = 'CREATE TABLE t (id INT PRIMARY KEY);';
      expect(parseSQL(sql, 'mysql').schema.rawSQL).toBe(sql);
    });

    it('sets timestamps', () => {
      const sql = 'CREATE TABLE t (id INT PRIMARY KEY);';
      const result = parseSQL(sql, 'mysql');
      expect(result.schema.createdAt).toBeTruthy();
      expect(result.schema.updatedAt).toBeTruthy();
    });
  });
});
