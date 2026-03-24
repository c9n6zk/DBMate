import { Parser } from 'node-sql-parser';
import { nanoid } from 'nanoid';
import type { Schema, Table, Column, ForeignKey, Index, Dialect } from './types';

const parser = new Parser();

const DIALECT_MAP: Record<Dialect, string> = {
  mysql: 'MySQL',
  postgresql: 'PostgreSQL',
  sqlite: 'SQLite',
};

interface ParseResult {
  schema: Schema;
  warnings: string[];
}

export function parseSQL(sql: string, dialect: Dialect, name?: string): ParseResult {
  const warnings: string[] = [];
  let ast;

  try {
    // node-sql-parser has PostgreSQL limitations, use MySQL as fallback
    const parserDialect = DIALECT_MAP[dialect];
    try {
      ast = parser.astify(sql, { database: parserDialect });
    } catch {
      if (dialect === 'postgresql') {
        warnings.push(
          'PostgreSQL parsing fell back to MySQL mode due to parser limitations.'
        );
        ast = parser.astify(sql, { database: 'MySQL' });
      } else {
        throw new Error('Parse failed');
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown parse error';
    throw new Error(`SQL parse error: ${message}`);
  }

  const statements = Array.isArray(ast) ? ast : [ast];
  const tables: Table[] = [];

  for (const stmt of statements) {
    if (stmt.type !== 'create' || stmt.keyword !== 'table') continue;

    const table = extractTable(stmt, dialect);
    if (table) tables.push(table);
  }

  if (tables.length === 0) {
    throw new Error(
      'No CREATE TABLE statements found. Please provide valid SQL schema.'
    );
  }

  const now = new Date().toISOString();
  const schema: Schema = {
    id: nanoid(),
    name: name || (tables.length === 1 ? tables[0].name : `schema_${tables.length}_tables`),
    dialect,
    tables,
    createdAt: now,
    updatedAt: now,
    rawSQL: sql,
  };

  return { schema, warnings };
}

function extractTable(stmt: any, dialect: Dialect): Table | null {
  const tableName = extractTableName(stmt.table?.[0]);
  if (!tableName) return null;

  const columns: Column[] = [];
  const foreignKeys: ForeignKey[] = [];
  const indexes: Index[] = [];
  const primaryKey: string[] = [];

  // Extract columns from create_definitions
  const definitions = stmt.create_definitions || [];

  for (const def of definitions) {
    if (def.resource === 'column') {
      const col = extractColumn(def);
      if (col) {
        columns.push(col);
        if (col.primaryKey) primaryKey.push(col.name);
      }
    } else if (def.resource === 'constraint') {
      if (def.constraint_type === 'primary key') {
        const pkCols = extractConstraintColumns(def);
        pkCols.forEach((c) => {
          if (!primaryKey.includes(c)) primaryKey.push(c);
          // Mark column as primary key
          const col = columns.find((col) => col.name === c);
          if (col) col.primaryKey = true;
        });
      } else if (
        def.constraint_type === 'FOREIGN KEY' ||
        def.constraint_type === 'foreign key'
      ) {
        const fk = extractForeignKey(def);
        if (fk) foreignKeys.push(fk);
      } else if (
        def.constraint_type === 'unique key' ||
        def.constraint_type === 'unique'
      ) {
        const idxCols = extractConstraintColumns(def);
        indexes.push({
          name: def.constraint || `uq_${tableName}_${idxCols.join('_')}`,
          columns: idxCols,
          unique: true,
        });
      }
    } else if (def.resource === 'index') {
      const idxCols = extractConstraintColumns(def);
      indexes.push({
        name: def.index || `idx_${tableName}_${idxCols.join('_')}`,
        columns: idxCols,
        unique: def.index_type === 'unique',
        type: def.index_using?.toUpperCase() as Index['type'],
      });
    }
  }

  return {
    name: tableName,
    columns,
    primaryKey,
    foreignKeys,
    indexes,
    engine: stmt.table_options?.find((o: any) => o.keyword === 'engine')?.value,
    charset: stmt.table_options?.find((o: any) => o.keyword === 'charset')?.value,
    comment: stmt.table_options?.find((o: any) => o.keyword === 'comment')?.value,
  };
}

function extractTableName(tableRef: any): string | null {
  if (!tableRef) return null;
  return tableRef.table || tableRef;
}

function extractColumn(def: any): Column | null {
  const name = def.column?.column || def.column;
  if (!name) return null;

  const dataType = def.definition?.dataType || '';
  const length = def.definition?.length;
  const type = length ? `${dataType}(${length})` : dataType;

  let nullable = true;
  let primaryKey = false;
  let autoIncrement = false;
  let unique = false;
  let defaultValue: string | undefined;
  let check: string | undefined;
  let comment: string | undefined;

  if (def.nullable) {
    nullable = def.nullable.value !== 'not null';
  }

  if (def.auto_increment) {
    autoIncrement = true;
  }

  // node-sql-parser uses separate fields for inline PRIMARY KEY and UNIQUE
  if (def.primary_key === 'primary key' || def.unique_or_primary === 'primary key') {
    primaryKey = true;
    nullable = false;
  }
  if (def.unique === 'unique' || def.unique_or_primary === 'unique') {
    unique = true;
  }

  if (def.default_val?.value !== undefined) {
    const dv = def.default_val.value;
    if (typeof dv === 'object' && dv !== null) {
      if (dv.type === 'function') {
        defaultValue = dv.name?.name?.[0]?.value || dv.name || 'FUNCTION';
      } else if (dv.value !== undefined) {
        // e.g. { type: 'single_quote_string', value: 'pending' }
        defaultValue = String(dv.value);
      } else {
        defaultValue = JSON.stringify(dv);
      }
    } else {
      defaultValue = String(dv);
    }
  }

  if (def.check) {
    check = typeof def.check === 'string' ? def.check : JSON.stringify(def.check);
  }

  if (def.comment) {
    comment = def.comment.value?.value || def.comment;
  }

  return {
    name,
    type: type.toUpperCase(),
    nullable,
    defaultValue,
    primaryKey,
    autoIncrement,
    unique,
    check,
    comment,
  };
}

function extractConstraintColumns(def: any): string[] {
  if (!def.definition) return [];
  if (Array.isArray(def.definition)) {
    return def.definition.map((d: any) => d.column || d).filter(Boolean);
  }
  return [];
}

function extractForeignKey(def: any): ForeignKey | null {
  const columns = extractConstraintColumns(def);
  const refTable =
    def.reference_definition?.table?.[0]?.table ||
    def.reference_definition?.table;
  const refColumns = (def.reference_definition?.definition || []).map(
    (d: any) => d.column || d
  );

  if (!refTable || columns.length === 0) return null;

  const onAction = (action: any): ForeignKey['onDelete'] => {
    if (!action) return undefined;
    const val = action.value?.toUpperCase();
    if (['CASCADE', 'SET NULL', 'RESTRICT', 'NO ACTION'].includes(val))
      return val as ForeignKey['onDelete'];
    return undefined;
  };

  return {
    name: def.constraint,
    columns,
    referencedTable: refTable,
    referencedColumns: refColumns,
    onDelete: onAction(def.reference_definition?.on_delete),
    onUpdate: onAction(def.reference_definition?.on_update),
  };
}
