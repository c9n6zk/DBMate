import { describe, it, expect } from 'vitest';
import { generateSchemaDoc } from '../doc-generator';
import type { Schema } from '../types';

function makeSchema(): Schema {
  return {
    id: 'test',
    name: 'E-Commerce',
    dialect: 'postgresql',
    tables: [
      {
        name: 'users',
        columns: [
          { name: 'id', type: 'SERIAL', nullable: false, primaryKey: true, autoIncrement: true, unique: false },
          { name: 'email', type: 'VARCHAR(255)', nullable: false, primaryKey: false, autoIncrement: false, unique: true, comment: 'Unique email' },
        ],
        primaryKey: ['id'],
        foreignKeys: [],
        indexes: [
          { name: 'idx_email', columns: ['email'], unique: true },
        ],
        comment: 'Application users',
      },
      {
        name: 'orders',
        columns: [
          { name: 'id', type: 'SERIAL', nullable: false, primaryKey: true, autoIncrement: true, unique: false },
          { name: 'user_id', type: 'INT', nullable: false, primaryKey: false, autoIncrement: false, unique: false },
          { name: 'total', type: 'DECIMAL(10,2)', nullable: true, primaryKey: false, autoIncrement: false, unique: false, defaultValue: '0' },
        ],
        primaryKey: ['id'],
        foreignKeys: [
          { columns: ['user_id'], referencedTable: 'users', referencedColumns: ['id'], onDelete: 'CASCADE' },
        ],
        indexes: [],
      },
    ],
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    rawSQL: '',
  };
}

describe('generateSchemaDoc', () => {
  it('includes schema name as title', () => {
    const doc = generateSchemaDoc(makeSchema());
    expect(doc).toContain('# E-Commerce');
  });

  it('includes dialect', () => {
    const doc = generateSchemaDoc(makeSchema());
    expect(doc).toContain('Dialect: postgresql');
  });

  it('includes table count', () => {
    const doc = generateSchemaDoc(makeSchema());
    expect(doc).toContain('Tables: 2');
  });

  it('generates table of contents', () => {
    const doc = generateSchemaDoc(makeSchema());
    expect(doc).toContain('## Table of Contents');
    expect(doc).toContain('[users]');
    expect(doc).toContain('[orders]');
  });

  it('includes column table headers', () => {
    const doc = generateSchemaDoc(makeSchema());
    expect(doc).toContain('| Column | Type | Nullable | PK | Default | Comment |');
  });

  it('includes column data', () => {
    const doc = generateSchemaDoc(makeSchema());
    expect(doc).toContain('| email | VARCHAR(255) | No |');
    expect(doc).toContain('Unique email');
  });

  it('includes index section', () => {
    const doc = generateSchemaDoc(makeSchema());
    expect(doc).toContain('### Indexes');
    expect(doc).toContain('idx_email');
  });

  it('includes foreign key section', () => {
    const doc = generateSchemaDoc(makeSchema());
    expect(doc).toContain('### Foreign Keys');
    expect(doc).toContain('users(id)');
    expect(doc).toContain('CASCADE');
  });

  it('includes table comments', () => {
    const doc = generateSchemaDoc(makeSchema());
    expect(doc).toContain('> Application users');
  });

  it('includes default values', () => {
    const doc = generateSchemaDoc(makeSchema());
    expect(doc).toContain('0');
  });

  it('omits indexes section when no indexes', () => {
    const doc = generateSchemaDoc(makeSchema());
    // orders table has no indexes, but users does
    const ordersSection = doc.split('## orders')[1];
    expect(ordersSection).not.toContain('### Indexes');
  });
});
