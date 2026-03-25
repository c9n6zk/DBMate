import { describe, it, expect } from 'vitest';
import { orderFixes, combineFixes } from '../batch-fix';
import type { AnalysisIssue } from '../types';

function issue(fixSQL: string, title: string = 'test'): AnalysisIssue {
  return {
    id: title,
    type: 'performance',
    severity: 'critical',
    title,
    affectedTable: 'test',
    fixSQL,
  };
}

describe('orderFixes', () => {
  it('orders CREATE TABLE before ALTER TABLE', () => {
    const issues = [
      issue('ALTER TABLE users ADD COLUMN x INT;', 'alter'),
      issue('CREATE TABLE audit (id INT PRIMARY KEY);', 'create'),
    ];
    const ordered = orderFixes(issues, 'mysql');
    expect(ordered[0].title).toBe('create');
    expect(ordered[1].title).toBe('alter');
  });

  it('orders CREATE INDEX after ADD COLUMN', () => {
    const issues = [
      issue('CREATE INDEX idx ON users(email);', 'index'),
      issue('ALTER TABLE users ADD COLUMN email VARCHAR(255);', 'column'),
    ];
    const ordered = orderFixes(issues, 'mysql');
    expect(ordered[0].title).toBe('column');
    expect(ordered[1].title).toBe('index');
  });

  it('handles issues without fixSQL', () => {
    const issues: AnalysisIssue[] = [
      { id: 'x', type: 'convention', severity: 'info', title: 'no fix', affectedTable: 'test' },
      issue('CREATE TABLE t (id INT);', 'with fix'),
    ];
    const ordered = orderFixes(issues, 'mysql');
    expect(ordered).toHaveLength(2);
  });
});

describe('combineFixes', () => {
  it('wraps in BEGIN/COMMIT', () => {
    const issues = [issue('ALTER TABLE t ADD COLUMN x INT;')];
    const result = combineFixes(issues, 'mysql');
    expect(result).toMatch(/^BEGIN;/);
    expect(result).toMatch(/COMMIT;$/);
  });

  it('combines multiple fixes', () => {
    const issues = [
      issue('ALTER TABLE t ADD COLUMN x INT;'),
      issue('CREATE INDEX idx ON t(x);'),
    ];
    const result = combineFixes(issues, 'mysql');
    expect(result).toContain('ADD COLUMN x INT');
    expect(result).toContain('CREATE INDEX idx');
  });

  it('filters out issues without fixSQL', () => {
    const issues: AnalysisIssue[] = [
      { id: 'x', type: 'convention', severity: 'info', title: 'no fix', affectedTable: 't' },
    ];
    const result = combineFixes(issues, 'mysql');
    expect(result).toBe('BEGIN;\n\n\n\nCOMMIT;');
  });
});
