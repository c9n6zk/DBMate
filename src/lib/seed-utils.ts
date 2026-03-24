import type { Schema, Table } from '@/lib/types';

/**
 * Topological sort of tables by FK dependencies.
 * Referenced tables come first so INSERTs respect FK constraints.
 */
export function topologicalSortTables(schema: Schema): string[] {
  const graph = new Map<string, Set<string>>();
  const allTables = new Set<string>();

  for (const table of schema.tables) {
    allTables.add(table.name);
    if (!graph.has(table.name)) graph.set(table.name, new Set());

    for (const fk of table.foreignKeys) {
      // table depends on fk.referencedTable
      graph.get(table.name)!.add(fk.referencedTable);
      if (!graph.has(fk.referencedTable))
        graph.set(fk.referencedTable, new Set());
    }
  }

  const sorted: string[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();

  function visit(node: string) {
    if (visited.has(node)) return;
    if (visiting.has(node)) return; // cycle — break it
    visiting.add(node);
    for (const dep of graph.get(node) ?? []) {
      visit(dep);
    }
    visiting.delete(node);
    visited.add(node);
    sorted.push(node);
  }

  for (const table of allTables) {
    visit(table);
  }

  return sorted;
}

/**
 * Build a compact schema description for the AI seed prompt.
 */
export function buildSeedSchemaContext(
  schema: Schema,
  selectedTables: string[]
): string {
  const tables = schema.tables.filter((t) => selectedTables.includes(t.name));

  return tables
    .map((t) => {
      const cols = t.columns
        .map((c) => {
          const flags: string[] = [];
          if (c.primaryKey) flags.push('PK');
          if (c.autoIncrement) flags.push('AUTO_INCREMENT');
          if (c.unique) flags.push('UNIQUE');
          if (!c.nullable) flags.push('NOT NULL');
          if (c.defaultValue) flags.push(`DEFAULT ${c.defaultValue}`);
          return `  ${c.name} ${c.type} ${flags.join(' ')}`.trimEnd();
        })
        .join('\n');

      const fks = t.foreignKeys
        .map(
          (fk) =>
            `  FK: ${fk.columns.join(',')} -> ${fk.referencedTable}(${fk.referencedColumns.join(',')})`
        )
        .join('\n');

      return `TABLE ${t.name}:\n${cols}${fks ? '\n' + fks : ''}`;
    })
    .join('\n\n');
}
