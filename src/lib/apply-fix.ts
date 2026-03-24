import type { Schema, AnalysisIssue, Table, Column, ForeignKey } from './types';

/**
 * Apply a fix from an AnalysisIssue directly to the schema structure.
 * Handles multi-statement fixSQL (separated by ;).
 * Returns a new schema with the fix applied (immutable).
 */
export function applyFixToSchema(schema: Schema, issue: AnalysisIssue): Schema {
  if (!issue.fixSQL) return schema;

  const fixSQL = issue.fixSQL.trim();

  // Split into individual statements, filter out comments and non-SQL text
  const statements = fixSQL
    .split(/;\s*/)
    .map((s) => s.trim())
    .filter((s) => s && !s.startsWith('--') && /^(ALTER|CREATE|DROP|COMMENT|INSERT|UPDATE|DELETE)\s/i.test(s));

  // Deep copy tables
  let tables: Table[] = schema.tables.map((t) => ({
    ...t,
    columns: [...t.columns],
    indexes: [...t.indexes],
    foreignKeys: [...t.foreignKeys],
    primaryKey: [...t.primaryKey],
  }));

  let anyApplied = false;

  for (const stmt of statements) {
    const result = applySingleStatement(tables, stmt, issue.affectedTable);
    if (result.applied) {
      tables = result.tables;
      anyApplied = true;
    }
  }

  if (!anyApplied) {
    console.warn(`[applyFix] No statements structurally applied for "${issue.title}"`);
  }

  return buildUpdatedSchema(schema, tables, fixSQL);
}

interface ApplyResult {
  tables: Table[];
  applied: boolean;
}

/**
 * Apply a single SQL statement to the tables structure.
 */
function applySingleStatement(
  tables: Table[],
  stmt: string,
  affectedTable: string
): ApplyResult {
  // --- CREATE TABLE ---
  const createTableResult = tryCreateTable(tables, stmt);
  if (createTableResult) return createTableResult;

  // --- DROP TABLE ---
  const dropTableResult = tryDropTable(tables, stmt);
  if (dropTableResult) return dropTableResult;

  // --- CREATE INDEX ---
  const createIndexResult = tryCreateIndex(tables, stmt);
  if (createIndexResult) return createIndexResult;

  // --- COMMENT ON TABLE (PostgreSQL) ---
  const commentOnMatch = stmt.match(/COMMENT\s+ON\s+TABLE\s+[`"']?(\w+)[`"']?\s+IS\s+'([^']*)'/i);
  if (commentOnMatch) {
    const tName = commentOnMatch[1];
    const comment = commentOnMatch[2];
    const tIdx = tables.findIndex((t) => t.name.toLowerCase() === tName.toLowerCase());
    if (tIdx !== -1) {
      const updated = [...tables];
      updated[tIdx] = { ...updated[tIdx], comment };
      console.log(`[applyFix] Set comment on "${tName}": "${comment}"`);
      return { tables: updated, applied: true };
    }
  }

  // --- ALTER TABLE variants ---
  const alterResult = tryAlterTable(tables, stmt, affectedTable);
  if (alterResult) return alterResult;

  console.log(`[applyFix] Unhandled statement (rawSQL-only):`, JSON.stringify(stmt));
  return { tables, applied: false };
}

// ==================== CREATE TABLE ====================

function tryCreateTable(tables: Table[], stmt: string): ApplyResult | null {
  const match = stmt.match(
    /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"']?(\w+)[`"']?\s*\(([\s\S]+)\)\s*$/i
  );
  if (!match) return null;

  const tableName = match[1];
  const body = match[2];

  // Skip if table already exists
  if (tables.some((t) => t.name.toLowerCase() === tableName.toLowerCase())) {
    console.log(`[applyFix] Table "${tableName}" already exists, skipping CREATE`);
    return { tables, applied: false };
  }

  const columns: Column[] = [];
  const primaryKey: string[] = [];
  const foreignKeys: ForeignKey[] = [];
  const indexes: { name: string; columns: string[]; unique: boolean }[] = [];

  // Parse column definitions and constraints from the body
  const parts = splitCreateTableBody(body);

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    // PRIMARY KEY (col1, col2)
    const pkConstraint = trimmed.match(/(?:CONSTRAINT\s+\S+\s+)?PRIMARY\s+KEY\s*\(([^)]+)\)/i);
    if (pkConstraint) {
      const cols = pkConstraint[1].split(',').map((c) => c.trim().replace(/[`"']/g, ''));
      primaryKey.push(...cols);
      continue;
    }

    // FOREIGN KEY (col) REFERENCES table(col)
    const fkConstraint = trimmed.match(
      /(?:CONSTRAINT\s+[`"']?(\w+)[`"']?\s+)?FOREIGN\s+KEY\s*\(([^)]+)\)\s*REFERENCES\s+[`"']?(\w+)[`"']?\s*\(([^)]+)\)([^,]*)/i
    );
    if (fkConstraint) {
      const fkCols = fkConstraint[2].split(',').map((c) => c.trim().replace(/[`"']/g, ''));
      const refTable = fkConstraint[3];
      const refCols = fkConstraint[4].split(',').map((c) => c.trim().replace(/[`"']/g, ''));
      const rest = fkConstraint[5] || '';
      const onDelete = extractAction(rest, 'DELETE');
      const onUpdate = extractAction(rest, 'UPDATE');
      foreignKeys.push({
        name: fkConstraint[1] || undefined,
        columns: fkCols,
        referencedTable: refTable,
        referencedColumns: refCols,
        ...(onDelete ? { onDelete } : {}),
        ...(onUpdate ? { onUpdate } : {}),
      });
      continue;
    }

    // UNIQUE (col1, col2)
    const uniqueConstraint = trimmed.match(/(?:CONSTRAINT\s+\S+\s+)?UNIQUE\s*\(([^)]+)\)/i);
    if (uniqueConstraint) {
      const cols = uniqueConstraint[1].split(',').map((c) => c.trim().replace(/[`"']/g, ''));
      indexes.push({ name: `uq_${tableName}_${cols.join('_')}`, columns: cols, unique: true });
      continue;
    }

    // Regular column definition
    const col = parseColumnDef(trimmed);
    if (col) {
      columns.push(col);
      if (col.primaryKey) primaryKey.push(col.name);
    }
  }

  const newTable: Table = {
    name: tableName,
    columns,
    primaryKey,
    foreignKeys,
    indexes,
  };

  console.log(`[applyFix] Created table "${tableName}" with ${columns.length} columns`);
  return { tables: [...tables, newTable], applied: true };
}

// ==================== DROP TABLE ====================

function tryDropTable(tables: Table[], stmt: string): ApplyResult | null {
  const match = stmt.match(/DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?[`"']?(\w+)[`"']?/i);
  if (!match) return null;

  const tableName = match[1];
  const filtered = tables.filter((t) => t.name.toLowerCase() !== tableName.toLowerCase());

  if (filtered.length === tables.length) {
    console.log(`[applyFix] Table "${tableName}" not found for DROP`);
    return { tables, applied: false };
  }

  console.log(`[applyFix] Dropped table "${tableName}"`);
  return { tables: filtered, applied: true };
}

// ==================== CREATE INDEX ====================

function tryCreateIndex(tables: Table[], stmt: string): ApplyResult | null {
  const match = stmt.match(
    /CREATE\s+(?:(UNIQUE)\s+)?INDEX\s+[`"']?(\w+)[`"']?\s+ON\s+[`"']?(\w+)[`"']?\s*\(([^)]+)\)/i
  );
  if (!match) return null;

  const isUnique = !!match[1];
  const idxName = match[2];
  const tableName = match[3];
  const cols = match[4].split(',').map((c) => c.trim().replace(/[`"']/g, ''));

  const tableIdx = tables.findIndex((t) => t.name.toLowerCase() === tableName.toLowerCase());
  if (tableIdx === -1) {
    console.log(`[applyFix] Table "${tableName}" not found for CREATE INDEX`);
    return { tables, applied: false };
  }

  // Skip if index already exists
  if (tables[tableIdx].indexes.some((i) => i.name === idxName)) {
    return { tables, applied: false };
  }

  const updated = [...tables];
  updated[tableIdx] = {
    ...updated[tableIdx],
    indexes: [...updated[tableIdx].indexes, { name: idxName, columns: cols, unique: isUnique }],
  };

  console.log(`[applyFix] Created index "${idxName}" on ${tableName}(${cols.join(', ')})`);
  return { tables: updated, applied: true };
}

// ==================== ALTER TABLE ====================

function tryAlterTable(tables: Table[], stmt: string, affectedTable: string): ApplyResult | null {
  const alterMatch = stmt.match(/ALTER\s+TABLE\s+[`"']?(\w+)[`"']?\s+([\s\S]+)/i);
  if (!alterMatch) {
    if (/alter/i.test(stmt)) {
      console.log(`[applyFix] ALTER detected but regex didn't match:`, JSON.stringify(stmt.slice(0, 120)));
    }
    return null;
  }

  const tableName = alterMatch[1];
  const action = alterMatch[2].trim();

  const tableIdx = tables.findIndex((t) => t.name.toLowerCase() === tableName.toLowerCase());
  if (tableIdx === -1) {
    console.log(`[applyFix] Table "${tableName}" not found for ALTER`);
    return { tables, applied: false };
  }

  const table = {
    ...tables[tableIdx],
    columns: [...tables[tableIdx].columns],
    indexes: [...tables[tableIdx].indexes],
    foreignKeys: [...tables[tableIdx].foreignKeys],
    primaryKey: [...tables[tableIdx].primaryKey],
  };

  let applied = false;

  // Keywords that are NOT column names — used to guard ADD COLUMN and DROP COLUMN
  const SQL_KEYWORDS = /^(PRIMARY|FOREIGN|UNIQUE|CHECK|CONSTRAINT|INDEX|KEY)$/i;

  // === ADD PRIMARY KEY (col1, col2) — must be before ADD COLUMN ===
  const addPkMatch = action.match(/ADD\s+(?:CONSTRAINT\s+\S+\s+)?PRIMARY\s+KEY\s*\(([^)]+)\)/i);
  if (!applied && addPkMatch) {
    const pkCols = addPkMatch[1].split(',').map((c) => c.trim().replace(/[`"']/g, ''));
    table.primaryKey = pkCols;
    table.columns = table.columns.map((c) =>
      pkCols.some((pk) => pk.toLowerCase() === c.name.toLowerCase())
        ? { ...c, primaryKey: true, nullable: false }
        : c
    );
    applied = true;
    console.log(`[applyFix] Added PRIMARY KEY(${pkCols.join(', ')}) on "${tableName}"`);
  }

  // === ADD CONSTRAINT ... FOREIGN KEY — must be before ADD COLUMN ===
  const addFkMatch = action.match(
    /ADD\s+(?:CONSTRAINT\s+[`"']?(\w+)[`"']?\s+)?FOREIGN\s+KEY\s*\(([^)]+)\)\s*REFERENCES\s+[`"']?(\w+)[`"']?\s*\(([^)]+)\)([^;]*)/i
  );
  if (!applied && addFkMatch) {
    const fkName = addFkMatch[1] || undefined;
    const fkCols = addFkMatch[2].split(',').map((c) => c.trim().replace(/[`"']/g, ''));
    const refTable = addFkMatch[3];
    const refCols = addFkMatch[4].split(',').map((c) => c.trim().replace(/[`"']/g, ''));
    const rest = addFkMatch[5] || '';
    const onDelete = extractAction(rest, 'DELETE');
    const onUpdate = extractAction(rest, 'UPDATE');

    table.foreignKeys.push({
      name: fkName,
      columns: fkCols,
      referencedTable: refTable,
      referencedColumns: refCols,
      ...(onDelete ? { onDelete } : {}),
      ...(onUpdate ? { onUpdate } : {}),
    });
    applied = true;
    console.log(`[applyFix] Added FK on "${tableName}"(${fkCols.join(',')}) → "${refTable}"(${refCols.join(',')})`);
  }

  // === ADD COLUMN (guarded against SQL keywords) ===
  const addColMatch = action.match(/ADD\s+(?:COLUMN\s+)?[`"']?(\w+)[`"']?\s+(\w+(?:\([^)]*\))?)\s*(.*)/i);
  if (!applied && addColMatch && !SQL_KEYWORDS.test(addColMatch[1])) {
    const colName = addColMatch[1];
    const colType = addColMatch[2].toUpperCase();
    const rest = addColMatch[3] || '';
    const isPK = /PRIMARY\s+KEY/i.test(rest);
    const isAutoInc = /AUTO_INCREMENT|SERIAL|AUTOINCREMENT/i.test(colType + ' ' + rest);
    const isNotNull = /NOT\s+NULL/i.test(rest) || isPK;
    const isUnique = /UNIQUE/i.test(rest);
    const defaultMatch = rest.match(/DEFAULT\s+(\S+)/i);
    const refMatch = rest.match(/REFERENCES\s+[`"']?(\w+)[`"']?\s*\(([^)]+)\)/i);

    const existingCol = table.columns.find((c) => c.name === colName);

    if (existingCol) {
      let changed = false;
      if (isPK && !existingCol.primaryKey) {
        table.columns = table.columns.map((c) =>
          c.name === colName ? { ...c, primaryKey: true, nullable: false } : c
        );
        if (!table.primaryKey.includes(colName)) table.primaryKey.push(colName);
        changed = true;
      }
      if (isAutoInc && !existingCol.autoIncrement) {
        table.columns = table.columns.map((c) =>
          c.name === colName ? { ...c, autoIncrement: true } : c
        );
        changed = true;
      }
      if (changed) {
        applied = true;
        console.log(`[applyFix] Updated existing column "${colName}" in "${tableName}" (PK=${isPK}, autoInc=${isAutoInc})`);
      }
    } else {
      table.columns.push({
        name: colName,
        type: colType.replace(/,?$/, ''),
        nullable: !isNotNull,
        primaryKey: isPK,
        autoIncrement: isAutoInc,
        unique: isUnique,
        defaultValue: defaultMatch?.[1]?.replace(/[;,]$/, ''),
      });

      if (isPK) table.primaryKey.push(colName);

      if (refMatch) {
        const refTable = refMatch[1];
        const refCols = refMatch[2].split(',').map((c) => c.trim().replace(/[`"']/g, ''));
        table.foreignKeys.push({
          columns: [colName],
          referencedTable: refTable,
          referencedColumns: refCols,
        });
      }

      applied = true;
      console.log(`[applyFix] Added column "${colName}" (${colType}) to "${tableName}"`);
    }
  }

  // === DROP FOREIGN KEY ===
  const dropFkMatch = action.match(/DROP\s+FOREIGN\s+KEY\s+[`"']?(\w+)[`"']?/i);
  if (!applied && dropFkMatch) {
    const fkName = dropFkMatch[1];
    const before = table.foreignKeys.length;
    table.foreignKeys = table.foreignKeys.filter(
      (fk) => fk.name?.toLowerCase() !== fkName.toLowerCase()
    );
    if (table.foreignKeys.length < before) {
      applied = true;
      console.log(`[applyFix] Dropped foreign key "${fkName}" from "${tableName}"`);
    }
  }

  // === DROP PRIMARY KEY ===
  if (!applied && /DROP\s+PRIMARY\s+KEY/i.test(action)) {
    table.columns = table.columns.map((c) =>
      c.primaryKey ? { ...c, primaryKey: false } : c
    );
    table.primaryKey = [];
    applied = true;
    console.log(`[applyFix] Dropped PRIMARY KEY from "${tableName}"`);
  }

  // === DROP COLUMN (guarded against FOREIGN KEY / PRIMARY KEY) ===
  const dropColMatch = action.match(/DROP\s+(?:COLUMN\s+)?[`"']?(\w+)[`"']?/i);
  if (!applied && dropColMatch && !SQL_KEYWORDS.test(dropColMatch[1])) {
    const colName = dropColMatch[1];
    const before = table.columns.length;
    table.columns = table.columns.filter((c) => c.name.toLowerCase() !== colName.toLowerCase());

    if (table.columns.length < before) {
      table.primaryKey = table.primaryKey.filter((pk) => pk.toLowerCase() !== colName.toLowerCase());
      table.foreignKeys = table.foreignKeys.filter(
        (fk) => !fk.columns.some((c) => c.toLowerCase() === colName.toLowerCase())
      );
      applied = true;
      console.log(`[applyFix] Dropped column "${colName}" from "${tableName}"`);
    }
  }

  // MODIFY COLUMN (MySQL: MODIFY COLUMN name TYPE NOT NULL, etc.)
  const modifyMatch = action.match(/MODIFY\s+(?:COLUMN\s+)?[`"']?(\w+)[`"']?\s+(\w+(?:\([^)]*\))?)\s*(.*)/i);
  if (!applied && modifyMatch) {
    const colName = modifyMatch[1];
    const newType = modifyMatch[2].toUpperCase();
    const rest = modifyMatch[3] || '';
    const notNull = /NOT\s+NULL/i.test(rest);
    table.columns = table.columns.map((c) =>
      c.name.toLowerCase() === colName.toLowerCase()
        ? { ...c, type: newType, ...(notNull ? { nullable: false } : {}) }
        : c
    );
    applied = true;
    console.log(`[applyFix] Modified column "${colName}" in "${tableName}" (type=${newType}, notNull=${notNull})`);
  }

  // ALTER COLUMN ... SET NOT NULL (PostgreSQL)
  const setNotNullMatch = action.match(/ALTER\s+(?:COLUMN\s+)?[`"']?(\w+)[`"']?\s+SET\s+NOT\s+NULL/i);
  if (!applied && setNotNullMatch) {
    const colName = setNotNullMatch[1];
    table.columns = table.columns.map((c) =>
      c.name.toLowerCase() === colName.toLowerCase() ? { ...c, nullable: false } : c
    );
    applied = true;
    console.log(`[applyFix] Set NOT NULL on "${colName}" in "${tableName}"`);
  }

  // COMMENT = '...' (MySQL table comment)
  const commentMatch = action.match(/COMMENT\s*=\s*'([^']*)'/i);
  if (!applied && commentMatch) {
    table.comment = commentMatch[1];
    applied = true;
    console.log(`[applyFix] Set comment on "${tableName}": "${commentMatch[1]}"`);
  }

  // RENAME COLUMN
  const renameColMatch = action.match(
    /RENAME\s+COLUMN\s+[`"']?(\w+)[`"']?\s+TO\s+[`"']?(\w+)[`"']?/i
  );
  if (!applied && renameColMatch) {
    const oldName = renameColMatch[1];
    const newName = renameColMatch[2];
    table.columns = table.columns.map((c) =>
      c.name.toLowerCase() === oldName.toLowerCase() ? { ...c, name: newName } : c
    );
    table.primaryKey = table.primaryKey.map((pk) =>
      pk.toLowerCase() === oldName.toLowerCase() ? newName : pk
    );
    table.foreignKeys = table.foreignKeys.map((fk) => ({
      ...fk,
      columns: fk.columns.map((c) => (c.toLowerCase() === oldName.toLowerCase() ? newName : c)),
    }));
    table.indexes = table.indexes.map((idx) => ({
      ...idx,
      columns: idx.columns.map((c) => (c.toLowerCase() === oldName.toLowerCase() ? newName : c)),
    }));
    applied = true;
    console.log(`[applyFix] Renamed column "${oldName}" → "${newName}" in "${tableName}"`);
  }

  if (!applied) {
    console.log(`[applyFix] ALTER TABLE matched but no action applied for: ${action.slice(0, 80)}`);
    return { tables, applied: false };
  }

  const updated = [...tables];
  updated[tableIdx] = table;
  return { tables: updated, applied: true };
}

// ==================== Helpers ====================

function extractAction(rest: string, verb: 'DELETE' | 'UPDATE') {
  const match = rest.match(new RegExp(`ON\\s+${verb}\\s+(CASCADE|SET\\s+NULL|RESTRICT|NO\\s+ACTION)`, 'i'));
  if (!match) return undefined;
  return match[1].toUpperCase().replace(/\s+/g, ' ') as ForeignKey['onDelete'];
}

/**
 * Split CREATE TABLE body by commas, respecting parenthesized groups.
 */
function splitCreateTableBody(body: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';

  for (const ch of body) {
    if (ch === '(') {
      depth++;
      current += ch;
    } else if (ch === ')') {
      depth--;
      current += ch;
    } else if (ch === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

/**
 * Parse a single column definition like: `id INT PRIMARY KEY AUTO_INCREMENT`
 */
function parseColumnDef(def: string): Column | null {
  const match = def.match(/^[`"']?(\w+)[`"']?\s+(\w+(?:\([^)]*\))?)\s*(.*)/i);
  if (!match) return null;

  // Skip if it looks like a constraint keyword
  const name = match[1];
  if (/^(PRIMARY|FOREIGN|UNIQUE|CHECK|CONSTRAINT|INDEX|KEY)$/i.test(name)) return null;

  const type = match[2].toUpperCase();
  const rest = match[3] || '';

  const isPK = /PRIMARY\s+KEY/i.test(rest);
  const isAutoInc = /AUTO_INCREMENT|AUTOINCREMENT|SERIAL/i.test(type + ' ' + rest);
  const isNotNull = /NOT\s+NULL/i.test(rest) || isPK;
  const isUnique = /UNIQUE/i.test(rest);
  const defaultMatch = rest.match(/DEFAULT\s+(\S+)/i);

  return {
    name,
    type: type.replace(/,?$/, ''),
    nullable: !isNotNull,
    primaryKey: isPK,
    autoIncrement: isAutoInc,
    unique: isUnique,
    defaultValue: defaultMatch?.[1]?.replace(/[;,]$/, ''),
  };
}

function buildUpdatedSchema(schema: Schema, tables: Table[], fixSQL: string): Schema {
  return {
    ...schema,
    tables,
    rawSQL: schema.rawSQL + '\n\n' + fixSQL,
    updatedAt: new Date().toISOString(),
  };
}
