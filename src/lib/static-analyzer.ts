import type { Schema, AnalysisIssue, SchemaHealthReport } from '@/lib/types';

/** Deterministic issue ID from type + table + title so IDs stay stable across re-runs */
function issueId(type: string, table: string, title: string): string {
  const key = `${type}:${table}:${title}`;
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 5) - hash + key.charCodeAt(i)) | 0;
  }
  return `static_${(hash >>> 0).toString(36)}`;
}

const SENSITIVE_PATTERNS = /^(password|pwd|passwd|secret|token|api_key|ssn|credit_card|card_number)$/i;

export function checkPerformance(schema: Schema): { score: number; issues: AnalysisIssue[] } {
  let score = 25;
  const issues: AnalysisIssue[] = [];
  const dialect = schema.dialect;

  for (const table of schema.tables) {
    // Missing PK (-10)
    if (table.primaryKey.length === 0) {
      score -= 10;
      const pkSQL =
        dialect === 'postgresql'
          ? `ALTER TABLE ${table.name} ADD COLUMN id SERIAL PRIMARY KEY;`
          : dialect === 'sqlite'
            ? `-- SQLite: Recreate table with: id INTEGER PRIMARY KEY AUTOINCREMENT`
            : `ALTER TABLE ${table.name} ADD COLUMN id INT PRIMARY KEY AUTO_INCREMENT;`;
      const title = `Missing primary key on ${table.name}`;
      issues.push({
        id: issueId('performance', table.name, title),
        type: 'performance',
        severity: 'critical',
        title,
        affectedTable: table.name,
        fixSQL: pkSQL,
        estimatedImpact: 'high',
      });
    }

    // FK column without index (-5 each)
    for (const fk of table.foreignKeys) {
      const hasIndex = table.indexes.some((idx) =>
        fk.columns.every((c) => idx.columns.includes(c))
      );
      // Also check if FK columns are PKs (implicitly indexed)
      const isPK = fk.columns.every((c) => table.primaryKey.includes(c));
      if (!hasIndex && !isPK) {
        score -= 5;
        const idxName = `idx_${table.name}_${fk.columns.join('_')}`;
        const title = `Missing index on ${table.name}.${fk.columns.join(', ')}`;
        issues.push({
          id: issueId('performance', table.name, title),
          type: 'performance',
          severity: 'critical',
          title,
          affectedTable: table.name,
          affectedColumns: fk.columns,
          fixSQL: `CREATE INDEX ${idxName} ON ${table.name}(${fk.columns.join(', ')});`,
          estimatedImpact: 'high',
        });
      }
    }

    // Oversized VARCHAR (-2 each)
    for (const col of table.columns) {
      const match = col.type.match(/VARCHAR\((\d+)\)/i);
      if (match && parseInt(match[1]) > 1000) {
        score -= 2;
        const title = `Oversized VARCHAR(${match[1]}) on ${table.name}.${col.name}`;
        issues.push({
          id: issueId('performance', table.name, title),
          type: 'performance',
          severity: 'warning',
          title,
          affectedTable: table.name,
          affectedColumns: [col.name],
          suggestion: 'Consider using TEXT type instead',
          estimatedImpact: 'low',
        });
      }
    }
  }

  return { score: Math.max(0, score), issues };
}

export function checkSecurity(schema: Schema): { score: number; issues: AnalysisIssue[] } {
  let score = 25;
  const issues: AnalysisIssue[] = [];

  for (const table of schema.tables) {
    // Sensitive column in plain text (-10)
    for (const col of table.columns) {
      if (SENSITIVE_PATTERNS.test(col.name) && !col.type.match(/BLOB|BINARY/i)) {
        score -= 10;
        const title = `Plain text sensitive field: ${table.name}.${col.name}`;
        issues.push({
          id: issueId('security', table.name, title),
          type: 'security',
          severity: 'critical',
          title,
          affectedTable: table.name,
          affectedColumns: [col.name],
          suggestion: 'Hash or encrypt this column',
          estimatedImpact: 'high',
        });
      }
    }

    // Missing audit trail (-3)
    const hasCreatedAt = table.columns.some((c) =>
      /^(created_at|created_on)$/i.test(c.name)
    );
    const hasUpdatedAt = table.columns.some((c) =>
      /^(updated_at|updated_on|modified_at)$/i.test(c.name)
    );
    if (!hasCreatedAt || !hasUpdatedAt) {
      score -= 3;
      const missing = [
        !hasCreatedAt && 'created_at',
        !hasUpdatedAt && 'updated_at',
      ].filter(Boolean) as string[];
      const title = `Missing audit columns on ${table.name}: ${missing.join(', ')}`;
      issues.push({
        id: issueId('security', table.name, title),
        type: 'security',
        severity: 'info',
        title,
        affectedTable: table.name,
        fixSQL: missing
          .map(
            (c) =>
              `ALTER TABLE ${table.name} ADD COLUMN ${c} TIMESTAMP DEFAULT CURRENT_TIMESTAMP;`
          )
          .join('\n'),
        estimatedImpact: 'medium',
      });
    }
  }

  return { score: Math.max(0, score), issues };
}

export function checkConventions(schema: Schema): { score: number; issues: AnalysisIssue[] } {
  let score = 25;
  const issues: AnalysisIssue[] = [];
  const dialect = schema.dialect;
  const allNames = schema.tables.flatMap((t) => [
    t.name,
    ...t.columns.map((c) => c.name),
  ]);

  // Mixed naming convention (-5)
  const snakeNames = allNames.filter((n) => n.includes('_'));
  const camelNames = allNames.filter((n) => /[a-z][A-Z]/.test(n));
  if (snakeNames.length > 0 && camelNames.length > 0) {
    score -= 5;
    const title = `Mixed naming: ${snakeNames.length} snake_case + ${camelNames.length} camelCase`;
    issues.push({
      id: issueId('convention', schema.tables[0]?.name ?? 'schema-wide', title),
      type: 'convention',
      severity: 'warning',
      title,
      affectedTable: schema.tables[0]?.name ?? 'schema-wide',
      suggestion: 'Pick one convention and apply consistently',
      estimatedImpact: 'medium',
    });
  }

  let nullablePenalty = 0;
  for (const table of schema.tables) {
    // Nullable where NOT NULL expected (-2 each, max -10)
    for (const col of table.columns) {
      if (
        col.nullable &&
        !col.primaryKey &&
        /^(name|email|title|status|type)$/i.test(col.name)
      ) {
        if (nullablePenalty < 10) {
          score -= 2;
          nullablePenalty += 2;
        }
        const title = `${table.name}.${col.name} is nullable but likely should be NOT NULL`;
        const notNullSQL =
          dialect === 'postgresql'
            ? `ALTER TABLE ${table.name} ALTER COLUMN ${col.name} SET NOT NULL;`
            : `ALTER TABLE ${table.name} MODIFY COLUMN ${col.name} ${col.type} NOT NULL;`;
        issues.push({
          id: issueId('convention', table.name, title),
          type: 'convention',
          severity: 'info',
          title,
          affectedTable: table.name,
          affectedColumns: [col.name],
          fixSQL: notNullSQL,
          estimatedImpact: 'low',
        });
      }
    }

    // Missing table comment (-1)
    if (!table.comment) {
      score -= 1;
      const commentSQL =
        dialect === 'postgresql'
          ? `COMMENT ON TABLE ${table.name} IS '${table.name} table';`
          : `ALTER TABLE ${table.name} COMMENT = '${table.name} table';`;
      const title = `Missing comment on table ${table.name}`;
      issues.push({
        id: issueId('convention', table.name, title),
        type: 'convention',
        severity: 'info',
        title,
        affectedTable: table.name,
        fixSQL: commentSQL,
        estimatedImpact: 'low',
      });
    }
  }

  return { score: Math.max(0, score), issues };
}

export function runStaticAnalysis(schema: Schema): Omit<SchemaHealthReport, 'breakdown'> & {
  breakdown: { performance: number; security: number; conventions: number };
} {
  const perf = checkPerformance(schema);
  const sec = checkSecurity(schema);
  const conv = checkConventions(schema);

  return {
    score: perf.score + sec.score + conv.score,
    breakdown: {
      performance: perf.score,
      security: sec.score,
      conventions: conv.score,
    },
    issues: [...perf.issues, ...sec.issues, ...conv.issues],
    summary: '',
  };
}
