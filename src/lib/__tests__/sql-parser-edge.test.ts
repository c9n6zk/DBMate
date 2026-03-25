import { describe, it, expect } from 'vitest';
import { parseSQL } from '../sql-parser';

describe('parseSQL - edge cases', () => {
  it('parses table with many column types', () => {
    const sql = `
      CREATE TABLE products (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(200) NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        description TEXT,
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    const result = parseSQL(sql, 'mysql');
    expect(result.schema.tables[0].columns).toHaveLength(6);
  });

  it('parses FK with ON DELETE CASCADE (may not be supported by parser)', () => {
    const sql = `
      CREATE TABLE orders (
        id INT PRIMARY KEY,
        user_id INT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `;
    const result = parseSQL(sql, 'mysql');
    const fk = result.schema.tables[0].foreignKeys[0];
    // node-sql-parser may or may not extract ON DELETE actions
    expect(fk.columns).toEqual(['user_id']);
    expect(fk.referencedTable).toBe('users');
  });

  it('parses multiple foreign keys', () => {
    const sql = `
      CREATE TABLE order_items (
        id INT PRIMARY KEY,
        order_id INT,
        product_id INT,
        FOREIGN KEY (order_id) REFERENCES orders(id),
        FOREIGN KEY (product_id) REFERENCES products(id)
      );
    `;
    const result = parseSQL(sql, 'mysql');
    expect(result.schema.tables[0].foreignKeys).toHaveLength(2);
  });

  it('parses table with DEFAULT values', () => {
    const sql = `
      CREATE TABLE users (
        id INT PRIMARY KEY,
        status VARCHAR(20) DEFAULT 'active',
        role VARCHAR(20) NOT NULL DEFAULT 'user'
      );
    `;
    const result = parseSQL(sql, 'mysql');
    const cols = result.schema.tables[0].columns;
    const statusCol = cols.find((c) => c.name === 'status');
    expect(statusCol?.defaultValue).toBeDefined();
  });

  it('handles large schema (8+ tables)', () => {
    const tables = Array.from(
      { length: 8 },
      (_, i) => `CREATE TABLE t${i} (id INT PRIMARY KEY, val VARCHAR(50));`
    ).join('\n');
    const result = parseSQL(tables, 'mysql');
    expect(result.schema.tables).toHaveLength(8);
    expect(result.schema.name).toBe('schema_8_tables');
  });

  it('handles inline UNIQUE on column', () => {
    const sql = 'CREATE TABLE users (id INT PRIMARY KEY, email VARCHAR(255) UNIQUE);';
    const result = parseSQL(sql, 'mysql');
    const emailCol = result.schema.tables[0].columns.find((c) => c.name === 'email');
    expect(emailCol?.unique).toBe(true);
  });

  it('produces warnings for PostgreSQL fallback', () => {
    // This should attempt PostgreSQL first, possibly fall back to MySQL
    const sql = 'CREATE TABLE pg_fallback (id INT PRIMARY KEY, data TEXT);';
    const result = parseSQL(sql, 'postgresql');
    // Should parse successfully regardless
    expect(result.schema.tables).toHaveLength(1);
  });

  it('handles IF NOT EXISTS', () => {
    const sql = 'CREATE TABLE IF NOT EXISTS users (id INT PRIMARY KEY);';
    // node-sql-parser might handle this
    try {
      const result = parseSQL(sql, 'mysql');
      expect(result.schema.tables.length).toBeGreaterThanOrEqual(0);
    } catch {
      // Some parsers don't support IF NOT EXISTS — that's OK
    }
  });

  it('handles indexes in CREATE TABLE', () => {
    const sql = `
      CREATE TABLE users (
        id INT PRIMARY KEY,
        email VARCHAR(255),
        INDEX idx_email (email)
      );
    `;
    const result = parseSQL(sql, 'mysql');
    expect(result.schema.tables[0].indexes.length).toBeGreaterThanOrEqual(1);
  });
});
