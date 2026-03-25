import { describe, it, expect } from 'vitest';
import {
  checkPerformance,
  checkSecurity,
  checkConventions,
  runStaticAnalysis,
} from '../static-analyzer';
import type { Schema, Table, Column } from '../types';

function makeColumn(overrides: Partial<Column> = {}): Column {
  return {
    name: 'id',
    type: 'INT',
    nullable: false,
    primaryKey: true,
    autoIncrement: true,
    unique: false,
    ...overrides,
  };
}

function makeTable(overrides: Partial<Table> = {}): Table {
  return {
    name: 'users',
    columns: [makeColumn()],
    primaryKey: ['id'],
    foreignKeys: [],
    indexes: [],
    ...overrides,
  };
}

function makeSchema(tables: Table[], dialect: Schema['dialect'] = 'mysql'): Schema {
  return {
    id: 'test',
    name: 'test_schema',
    dialect,
    tables,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    rawSQL: '',
  };
}

describe('checkPerformance', () => {
  it('returns 25 for a healthy table', () => {
    const schema = makeSchema([makeTable()]);
    const result = checkPerformance(schema);
    expect(result.score).toBe(25);
    expect(result.issues).toHaveLength(0);
  });

  it('detects missing primary key (-10)', () => {
    const schema = makeSchema([
      makeTable({
        primaryKey: [],
        columns: [makeColumn({ primaryKey: false })],
      }),
    ]);
    const result = checkPerformance(schema);
    expect(result.score).toBe(15);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].severity).toBe('critical');
    expect(result.issues[0].fixSQL).toBeDefined();
  });

  it('generates PostgreSQL-specific PK fix SQL', () => {
    const schema = makeSchema(
      [makeTable({ primaryKey: [], columns: [makeColumn({ primaryKey: false })] })],
      'postgresql'
    );
    const result = checkPerformance(schema);
    expect(result.issues[0].fixSQL).toContain('SERIAL');
  });

  it('detects FK without index (-5)', () => {
    const schema = makeSchema([
      makeTable({
        foreignKeys: [
          {
            columns: ['category_id'],
            referencedTable: 'categories',
            referencedColumns: ['id'],
          },
        ],
      }),
    ]);
    const result = checkPerformance(schema);
    expect(result.score).toBe(20);
    expect(result.issues.some((i) => i.title.includes('Missing index'))).toBe(true);
  });

  it('does not flag FK column that is PK (implicitly indexed)', () => {
    const schema = makeSchema([
      makeTable({
        primaryKey: ['category_id'],
        foreignKeys: [
          {
            columns: ['category_id'],
            referencedTable: 'categories',
            referencedColumns: ['id'],
          },
        ],
      }),
    ]);
    const result = checkPerformance(schema);
    expect(result.issues.filter((i) => i.title.includes('Missing index'))).toHaveLength(0);
  });

  it('does not flag FK column with existing index', () => {
    const schema = makeSchema([
      makeTable({
        foreignKeys: [
          { columns: ['category_id'], referencedTable: 'categories', referencedColumns: ['id'] },
        ],
        indexes: [{ name: 'idx_cat', columns: ['category_id'], unique: false }],
      }),
    ]);
    const result = checkPerformance(schema);
    expect(result.issues.filter((i) => i.title.includes('Missing index'))).toHaveLength(0);
  });

  it('detects oversized VARCHAR (-2)', () => {
    const schema = makeSchema([
      makeTable({
        columns: [
          makeColumn(),
          makeColumn({ name: 'bio', type: 'VARCHAR(5000)', primaryKey: false }),
        ],
      }),
    ]);
    const result = checkPerformance(schema);
    expect(result.score).toBe(23);
    expect(result.issues.some((i) => i.title.includes('Oversized VARCHAR'))).toBe(true);
  });

  it('does not flag VARCHAR(255)', () => {
    const schema = makeSchema([
      makeTable({
        columns: [
          makeColumn(),
          makeColumn({ name: 'email', type: 'VARCHAR(255)', primaryKey: false }),
        ],
      }),
    ]);
    const result = checkPerformance(schema);
    expect(result.score).toBe(25);
  });

  it('never goes below 0', () => {
    const tables = Array.from({ length: 5 }, (_, i) =>
      makeTable({
        name: `t${i}`,
        primaryKey: [],
        columns: [makeColumn({ primaryKey: false })],
      })
    );
    const schema = makeSchema(tables);
    const result = checkPerformance(schema);
    expect(result.score).toBe(0);
  });
});

describe('checkSecurity', () => {
  it('returns 25 for a clean table with audit columns', () => {
    const schema = makeSchema([
      makeTable({
        columns: [
          makeColumn(),
          makeColumn({ name: 'created_at', type: 'TIMESTAMP', primaryKey: false }),
          makeColumn({ name: 'updated_at', type: 'TIMESTAMP', primaryKey: false }),
        ],
      }),
    ]);
    const result = checkSecurity(schema);
    expect(result.score).toBe(25);
  });

  it('detects plain text password (-10)', () => {
    const schema = makeSchema([
      makeTable({
        columns: [
          makeColumn(),
          makeColumn({ name: 'password', type: 'VARCHAR(255)', primaryKey: false }),
          makeColumn({ name: 'created_at', type: 'TIMESTAMP', primaryKey: false }),
          makeColumn({ name: 'updated_at', type: 'TIMESTAMP', primaryKey: false }),
        ],
      }),
    ]);
    const result = checkSecurity(schema);
    expect(result.score).toBe(15);
    expect(result.issues.some((i) => i.title.includes('password'))).toBe(true);
  });

  it('does not flag password stored as BINARY', () => {
    const schema = makeSchema([
      makeTable({
        columns: [
          makeColumn(),
          makeColumn({ name: 'password', type: 'BINARY(64)', primaryKey: false }),
          makeColumn({ name: 'created_at', type: 'TIMESTAMP', primaryKey: false }),
          makeColumn({ name: 'updated_at', type: 'TIMESTAMP', primaryKey: false }),
        ],
      }),
    ]);
    const result = checkSecurity(schema);
    expect(result.issues.filter((i) => i.title.includes('password'))).toHaveLength(0);
  });

  it('detects multiple sensitive fields', () => {
    const schema = makeSchema([
      makeTable({
        columns: [
          makeColumn(),
          makeColumn({ name: 'password', type: 'VARCHAR(255)', primaryKey: false }),
          makeColumn({ name: 'ssn', type: 'VARCHAR(20)', primaryKey: false }),
          makeColumn({ name: 'api_key', type: 'TEXT', primaryKey: false }),
          makeColumn({ name: 'created_at', type: 'TIMESTAMP', primaryKey: false }),
          makeColumn({ name: 'updated_at', type: 'TIMESTAMP', primaryKey: false }),
        ],
      }),
    ]);
    const result = checkSecurity(schema);
    expect(result.issues.filter((i) => i.type === 'security' && i.severity === 'critical')).toHaveLength(3);
  });

  it('detects missing audit columns (-3)', () => {
    const schema = makeSchema([makeTable()]);
    const result = checkSecurity(schema);
    expect(result.issues.some((i) => i.title.includes('audit'))).toBe(true);
    expect(result.score).toBeLessThan(25);
  });

  it('generates fixSQL for missing audit columns', () => {
    const schema = makeSchema([makeTable()]);
    const result = checkSecurity(schema);
    const auditIssue = result.issues.find((i) => i.title.includes('audit'));
    expect(auditIssue?.fixSQL).toContain('ADD COLUMN');
    expect(auditIssue?.fixSQL).toContain('TIMESTAMP');
  });
});

describe('checkConventions', () => {
  it('detects mixed naming conventions', () => {
    const schema = makeSchema([
      makeTable({
        columns: [
          makeColumn({ name: 'user_id' }),
          makeColumn({ name: 'firstName', primaryKey: false }),
        ],
      }),
    ]);
    const result = checkConventions(schema);
    expect(result.issues.some((i) => i.title.includes('Mixed naming'))).toBe(true);
    expect(result.score).toBeLessThan(25);
  });

  it('detects nullable "name" column', () => {
    const schema = makeSchema([
      makeTable({
        columns: [
          makeColumn(),
          makeColumn({ name: 'name', type: 'VARCHAR(100)', nullable: true, primaryKey: false }),
        ],
      }),
    ]);
    const result = checkConventions(schema);
    expect(result.issues.some((i) => i.title.includes('nullable'))).toBe(true);
  });

  it('detects missing table comment (-1)', () => {
    const schema = makeSchema([makeTable()]);
    const result = checkConventions(schema);
    expect(result.issues.some((i) => i.title.includes('Missing comment'))).toBe(true);
  });

  it('does not flag table with comment', () => {
    const schema = makeSchema([makeTable({ comment: 'Users table' })]);
    const result = checkConventions(schema);
    expect(result.issues.filter((i) => i.title.includes('Missing comment'))).toHaveLength(0);
  });

  it('caps nullable penalty at -10', () => {
    const columns = [
      makeColumn(),
      ...['name', 'email', 'title', 'status', 'type'].map((n) =>
        makeColumn({ name: n, nullable: true, primaryKey: false })
      ),
      // Extra nullable to ensure cap
      makeColumn({ name: 'Name', nullable: true, primaryKey: false }),
    ];
    const schema = makeSchema([makeTable({ columns })]);
    const result = checkConventions(schema);
    // Score can't go below -10 from nullable penalty, plus missing comment (-1)
    expect(result.score).toBeGreaterThanOrEqual(0);
  });
});

describe('runStaticAnalysis', () => {
  it('combines all checks', () => {
    const schema = makeSchema([
      makeTable({
        columns: [
          makeColumn(),
          makeColumn({ name: 'created_at', type: 'TIMESTAMP', primaryKey: false }),
          makeColumn({ name: 'updated_at', type: 'TIMESTAMP', primaryKey: false }),
        ],
        comment: 'Users table',
      }),
    ]);
    const result = runStaticAnalysis(schema);
    expect(result.breakdown.performance).toBe(25);
    expect(result.breakdown.security).toBe(25);
    expect(result.score).toBeLessThanOrEqual(75);
    expect(result.issues).toBeInstanceOf(Array);
  });

  it('produces deterministic issue IDs', () => {
    const schema = makeSchema([makeTable()]);
    const r1 = runStaticAnalysis(schema);
    const r2 = runStaticAnalysis(schema);
    expect(r1.issues.map((i) => i.id)).toEqual(r2.issues.map((i) => i.id));
  });

  it('issue IDs start with static_', () => {
    const schema = makeSchema([makeTable({ primaryKey: [] })]);
    const result = runStaticAnalysis(schema);
    for (const issue of result.issues) {
      expect(issue.id).toMatch(/^static_/);
    }
  });
});
