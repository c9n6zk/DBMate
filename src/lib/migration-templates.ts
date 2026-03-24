import { nanoid } from 'nanoid';
import type { Column, Dialect, ForeignKey, Migration } from '@/lib/types';

// ============ MIGRATION OPERATIONS ============

export type MigrationOp =
  | { type: 'ADD_INDEX'; table: string; columns: string[]; unique?: boolean }
  | { type: 'DROP_INDEX'; table: string; indexName: string }
  | { type: 'ADD_COLUMN'; table: string; column: Column }
  | { type: 'DROP_COLUMN'; table: string; columnName: string }
  | { type: 'ADD_FK'; table: string; fk: ForeignKey }
  | { type: 'DROP_FK'; table: string; constraintName: string }
  | { type: 'APPLY_FIX'; fixSQL: string };

// ============ STATIC MIGRATION GENERATOR ============

export function generateStaticMigration(
  op: MigrationOp,
  dialect: Dialect,
  version: string,
  schemaId: string
): Migration {
  const base = {
    id: nanoid(),
    schemaId,
    version,
    format: 'raw' as const,
    appliedAt: undefined,
  };

  switch (op.type) {
    case 'ADD_INDEX': {
      const name = `idx_${op.table}_${op.columns.join('_')}`;
      const uniq = op.unique ? 'UNIQUE ' : '';
      return {
        ...base,
        name: `add_${op.unique ? 'unique_' : ''}index_${op.table}_${op.columns.join('_')}`,
        upSQL: `CREATE ${uniq}INDEX ${name} ON ${op.table}(${op.columns.join(', ')});`,
        downSQL:
          dialect === 'mysql'
            ? `DROP INDEX ${name} ON ${op.table};`
            : `DROP INDEX ${name};`,
        description: `Add ${uniq.trim().toLowerCase() || ''}index on ${op.table}(${op.columns.join(', ')})`,
      };
    }
    case 'ADD_COLUMN': {
      const { table, column } = op;
      const nullable = column.nullable ? '' : ' NOT NULL';
      const def = column.defaultValue ? ` DEFAULT ${column.defaultValue}` : '';
      const downSQL =
        dialect === 'sqlite'
          ? `-- SQLite <3.35: ALTER TABLE DROP COLUMN not supported.\n-- SQLite >=3.35: ALTER TABLE ${table} DROP COLUMN ${column.name};`
          : `ALTER TABLE ${table} DROP COLUMN ${column.name};`;
      return {
        ...base,
        name: `add_${column.name}_to_${table}`,
        upSQL: `ALTER TABLE ${table} ADD COLUMN ${column.name} ${column.type}${nullable}${def};`,
        downSQL,
        description: `Add column ${column.name} to ${table}`,
      };
    }
    case 'DROP_COLUMN': {
      const dropSQL =
        dialect === 'sqlite'
          ? `-- SQLite <3.35: DROP COLUMN not supported. Table rebuild required.\n-- SQLite >=3.35: ALTER TABLE ${op.table} DROP COLUMN ${op.columnName};`
          : `ALTER TABLE ${op.table} DROP COLUMN ${op.columnName};`;
      return {
        ...base,
        name: `drop_${op.columnName}_from_${op.table}`,
        upSQL: dropSQL,
        downSQL: '-- Manual rollback required (recreate column with original type)',
        description: `Drop column ${op.columnName} from ${op.table}`,
      };
    }
    case 'ADD_FK': {
      const constraintName =
        op.fk.name ?? `fk_${op.table}_${op.fk.columns.join('_')}`;
      const onDelete = op.fk.onDelete ? ` ON DELETE ${op.fk.onDelete}` : '';
      const onUpdate = op.fk.onUpdate ? ` ON UPDATE ${op.fk.onUpdate}` : '';
      return {
        ...base,
        name: `add_fk_${op.table}_${op.fk.columns.join('_')}`,
        upSQL:
          `ALTER TABLE ${op.table} ADD CONSTRAINT ${constraintName} ` +
          `FOREIGN KEY (${op.fk.columns.join(', ')}) ` +
          `REFERENCES ${op.fk.referencedTable}(${op.fk.referencedColumns.join(', ')})${onDelete}${onUpdate};`,
        downSQL:
          dialect === 'mysql'
            ? `ALTER TABLE ${op.table} DROP FOREIGN KEY ${constraintName};`
            : `ALTER TABLE ${op.table} DROP CONSTRAINT ${constraintName};`,
        description: `Add foreign key on ${op.table}(${op.fk.columns.join(', ')}) → ${op.fk.referencedTable}`,
      };
    }
    case 'DROP_FK': {
      return {
        ...base,
        name: `drop_fk_${op.constraintName}_from_${op.table}`,
        upSQL:
          dialect === 'mysql'
            ? `ALTER TABLE ${op.table} DROP FOREIGN KEY ${op.constraintName};`
            : `ALTER TABLE ${op.table} DROP CONSTRAINT ${op.constraintName};`,
        downSQL: '-- Manual rollback required (recreate FK with original definition)',
        description: `Drop foreign key ${op.constraintName} from ${op.table}`,
      };
    }
    case 'DROP_INDEX': {
      return {
        ...base,
        name: `drop_index_${op.indexName}_on_${op.table}`,
        upSQL:
          dialect === 'mysql'
            ? `DROP INDEX ${op.indexName} ON ${op.table};`
            : `DROP INDEX ${op.indexName};`,
        downSQL: '-- Manual rollback required (recreate index with original definition)',
        description: `Drop index ${op.indexName} on ${op.table}`,
      };
    }
    case 'APPLY_FIX': {
      return {
        ...base,
        name: `apply_fix_${version}`,
        upSQL: op.fixSQL,
        downSQL: '-- Manual rollback required',
        description: 'Apply optimizer fix',
      };
    }
  }
}

// ============ INTENT RECOGNITION (NL → MigrationOp) ============

const INTENT_PATTERNS: {
  pattern: RegExp;
  extract: (m: RegExpMatchArray) => MigrationOp | null;
}[] = [
  {
    pattern: /add (?:an? )?(?:unique )?index (?:on )?(\w+)\(([^)]+)\)/i,
    extract: (m) => ({
      type: 'ADD_INDEX',
      table: m[1],
      columns: m[2].split(',').map((c) => c.trim()),
      unique: /unique/i.test(m[0]),
    }),
  },
  {
    pattern: /drop index (\w+) on (\w+)/i,
    extract: (m) => ({ type: 'DROP_INDEX', table: m[2], indexName: m[1] }),
  },
  {
    pattern: /add column (\w+) (\w+(?:\([^)]*\))?) to (\w+)/i,
    extract: (m) => ({
      type: 'ADD_COLUMN',
      table: m[3],
      column: {
        name: m[1],
        type: m[2],
        nullable: true,
        primaryKey: false,
        autoIncrement: false,
        unique: false,
      } as Column,
    }),
  },
  {
    pattern: /drop column (\w+) from (\w+)/i,
    extract: (m) => ({ type: 'DROP_COLUMN', table: m[2], columnName: m[1] }),
  },
  {
    pattern:
      /add foreign key (?:on )?(\w+)\(([^)]+)\) referenc(?:es|ing) (\w+)\(([^)]+)\)/i,
    extract: (m) => ({
      type: 'ADD_FK',
      table: m[1],
      fk: {
        columns: m[2].split(',').map((c) => c.trim()),
        referencedTable: m[3],
        referencedColumns: m[4].split(',').map((c) => c.trim()),
      } as ForeignKey,
    }),
  },
  {
    pattern: /drop (?:foreign key|constraint) (\w+) (?:on|from) (\w+)/i,
    extract: (m) => ({ type: 'DROP_FK', table: m[2], constraintName: m[1] }),
  },
];

export function parseMigrationIntent(change: string): MigrationOp | null {
  for (const { pattern, extract } of INTENT_PATTERNS) {
    const match = change.match(pattern);
    if (match) return extract(match);
  }
  return null;
}
