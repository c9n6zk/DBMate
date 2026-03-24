import type { Schema } from '@/lib/types';
import { escapeRegex } from '@/lib/utils';

export interface SeedValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Heuristic validation of AI-generated seed INSERT SQL against the schema.
 * Checks column names exist, NOT NULL columns are included, and tables are present.
 */
export function validateSeedSQL(sql: string, schema: Schema): SeedValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const table of schema.tables) {
    // Match INSERT INTO <table> (col1, col2, ...) patterns
    const patternWithCols = new RegExp(
      `INSERT INTO\\s+${escapeRegex(table.name)}\\s*\\(([^)]+)\\)`,
      'gi'
    );
    // No 'g' flag — avoids lastIndex footgun with .test()
    const patternNoCols = new RegExp(
      `INSERT INTO\\s+${escapeRegex(table.name)}\\s+VALUES`,
      'i'
    );

    const matches = [...sql.matchAll(patternWithCols)];
    if (matches.length === 0) {
      if (patternNoCols.test(sql)) {
        warnings.push(
          `INSERT INTO ${table.name} without column list — column order must match schema`
        );
      }
      continue;
    }

    const schemaCols = table.columns.map((c) => c.name);
    const requiredCols = table.columns
      .filter((c) => !c.nullable && !c.autoIncrement && !c.defaultValue)
      .map((c) => c.name);

    for (const match of matches) {
      const insertCols = match[1]
        .split(',')
        .map((c) => c.trim().replace(/[`"[\]]/g, ''));

      // 1. Check column names exist in schema
      for (const col of insertCols) {
        if (!schemaCols.includes(col)) {
          errors.push(`Unknown column "${col}" in INSERT INTO ${table.name}`);
        }
      }

      // 2. Check NOT NULL columns are present
      for (const col of requiredCols) {
        if (!insertCols.includes(col)) {
          warnings.push(
            `NOT NULL column "${col}" missing from INSERT INTO ${table.name}`
          );
        }
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}
