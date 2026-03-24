import { Parser } from 'node-sql-parser';
import type { AnalysisIssue, Dialect } from '@/lib/types';

type FixCategory =
  | 'create_table'
  | 'add_column'
  | 'create_index'
  | 'alter_constraint'
  | 'other';

const CATEGORY_ORDER: Record<FixCategory, number> = {
  create_table: 1,
  add_column: 2,
  create_index: 3,
  alter_constraint: 4,
  other: 5,
};

/**
 * Use node-sql-parser to classify a fix SQL statement.
 * Dialect-aware: maps project Dialect to node-sql-parser's dbType strings.
 */
function categorizeFixSQL(
  sql: string,
  dialect: Dialect = 'mysql'
): FixCategory {
  try {
    const dbType =
      dialect === 'postgresql'
        ? 'PostgresQL'
        : dialect === 'sqlite'
          ? 'SQLite'
          : 'MySQL';
    const parser = new Parser();
    const ast = parser.astify(sql, { database: dbType });
    const first = Array.isArray(ast) ? ast[0] : ast;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- node-sql-parser AST types are loose
    const node = first as any;

    if (node.type === 'create' && node.keyword === 'table')
      return 'create_table';
    if (node.type === 'create' && node.keyword === 'index')
      return 'create_index';
    if (node.type === 'alter') {
      const spec = node.expr?.[0];
      if (spec?.action === 'add' && spec?.resource === 'column')
        return 'add_column';
      return 'alter_constraint';
    }
  } catch {
    // Parse failed — fallback
  }
  return 'other';
}

/** Sort issues by fix SQL execution order (tables first, constraints last). */
export function orderFixes(
  issues: AnalysisIssue[],
  dialect: Dialect = 'mysql'
): AnalysisIssue[] {
  return [...issues].sort((a, b) => {
    const ca = categorizeFixSQL(a.fixSQL ?? '', dialect);
    const cb = categorizeFixSQL(b.fixSQL ?? '', dialect);
    return CATEGORY_ORDER[ca] - CATEGORY_ORDER[cb];
  });
}

/** Combine multiple fix SQLs into a single transactional script. */
export function combineFixes(
  issues: AnalysisIssue[],
  dialect: Dialect = 'mysql'
): string {
  const ordered = orderFixes(issues, dialect);
  const fixes = ordered.filter((i) => i.fixSQL).map((i) => i.fixSQL!);
  const body = fixes.join('\n\n');
  return `BEGIN;\n\n${body}\n\nCOMMIT;`;
}
