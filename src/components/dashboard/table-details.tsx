'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { KeyRound, Link2 } from 'lucide-react';
import type { Table } from '@/lib/types';

interface TableDetailsProps {
  table: Table;
  rawSQL: string;
}

function ColumnsTab({ table }: { table: Table }) {
  const fkCols = new Set(table.foreignKeys.flatMap((fk) => fk.columns));

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="pb-1.5 pr-3 font-medium">Name</th>
            <th className="pb-1.5 pr-3 font-medium">Type</th>
            <th className="pb-1.5 pr-3 font-medium">Null</th>
            <th className="pb-1.5 pr-3 font-medium">Key</th>
            <th className="pb-1.5 pr-3 font-medium">Default</th>
            <th className="pb-1.5 font-medium">Extra</th>
          </tr>
        </thead>
        <tbody>
          {table.columns.map((col) => (
            <tr key={col.name} className="border-b border-border/50 hover:bg-muted/30">
              <td className="py-1 pr-3 font-medium flex items-center gap-1">
                {col.primaryKey && <KeyRound className="h-3 w-3 text-amber-500" />}
                {fkCols.has(col.name) && <Link2 className="h-3 w-3 text-blue-500" />}
                {col.name}
              </td>
              <td className="py-1 pr-3 text-muted-foreground uppercase">{col.type}</td>
              <td className="py-1 pr-3">{col.nullable ? 'YES' : 'NO'}</td>
              <td className="py-1 pr-3">
                {col.primaryKey && <Badge variant="secondary" className="text-[10px] px-1 py-0">PK</Badge>}
                {col.unique && !col.primaryKey && <Badge variant="outline" className="text-[10px] px-1 py-0">UNI</Badge>}
              </td>
              <td className="py-1 pr-3 text-muted-foreground">{col.defaultValue ?? '-'}</td>
              <td className="py-1 text-muted-foreground">
                {[
                  col.autoIncrement && 'AUTO_INCREMENT',
                  col.check && `CHECK(${col.check})`,
                ]
                  .filter(Boolean)
                  .join(', ') || '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function IndexesTab({ table }: { table: Table }) {
  if (table.indexes.length === 0) {
    return <p className="text-xs text-muted-foreground py-2">No indexes defined.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="pb-1.5 pr-3 font-medium">Name</th>
            <th className="pb-1.5 pr-3 font-medium">Columns</th>
            <th className="pb-1.5 pr-3 font-medium">Unique</th>
            <th className="pb-1.5 font-medium">Type</th>
          </tr>
        </thead>
        <tbody>
          {table.indexes.map((idx) => (
            <tr key={idx.name} className="border-b border-border/50 hover:bg-muted/30">
              <td className="py-1 pr-3 font-medium">{idx.name}</td>
              <td className="py-1 pr-3 text-muted-foreground">{idx.columns.join(', ')}</td>
              <td className="py-1 pr-3">{idx.unique ? 'YES' : 'NO'}</td>
              <td className="py-1 text-muted-foreground">{idx.type ?? 'BTREE'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ForeignKeysTab({ table }: { table: Table }) {
  if (table.foreignKeys.length === 0) {
    return <p className="text-xs text-muted-foreground py-2">No foreign keys defined.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="pb-1.5 pr-3 font-medium">Column(s)</th>
            <th className="pb-1.5 pr-3 font-medium">References</th>
            <th className="pb-1.5 pr-3 font-medium">ON DELETE</th>
            <th className="pb-1.5 font-medium">ON UPDATE</th>
          </tr>
        </thead>
        <tbody>
          {table.foreignKeys.map((fk, i) => (
            <tr key={fk.name ?? i} className="border-b border-border/50 hover:bg-muted/30">
              <td className="py-1 pr-3 font-medium">{fk.columns.join(', ')}</td>
              <td className="py-1 pr-3 text-muted-foreground">
                {fk.referencedTable}({fk.referencedColumns.join(', ')})
              </td>
              <td className="py-1 pr-3">{fk.onDelete ?? 'RESTRICT'}</td>
              <td className="py-1">{fk.onUpdate ?? 'RESTRICT'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RawSQLTab({ table, rawSQL }: { table: Table; rawSQL: string }) {
  // Extract the CREATE TABLE statement for this specific table
  const regex = new RegExp(
    `CREATE\\s+TABLE\\s+(?:\`|")?${table.name}(?:\`|")?\\s*\\([^;]*;`,
    'is'
  );
  const match = rawSQL.match(regex);
  const sql = match ? match[0] : `-- CREATE TABLE ${table.name} not found in raw SQL`;

  return (
    <pre className="text-xs font-mono bg-muted/50 p-3 rounded overflow-x-auto whitespace-pre-wrap">
      {sql}
    </pre>
  );
}

export function TableDetails({ table, rawSQL }: TableDetailsProps) {

  return (
    <div className="border-t bg-card">
      <div className="flex items-center gap-2 px-4 py-2 border-b bg-muted/30">
        <span className="text-sm font-semibold">{table.name}</span>
        <Badge variant="secondary" className="text-[10px]">
          {table.columns.length} columns
        </Badge>
      </div>
      <ScrollArea className="h-50">
        <div className="p-4">
          <Tabs defaultValue="columns">
            <TabsList>
              <TabsTrigger value="columns">Columns</TabsTrigger>
              <TabsTrigger value="indexes">Indexes</TabsTrigger>
              <TabsTrigger value="fk">Foreign Keys</TabsTrigger>
              <TabsTrigger value="sql">SQL</TabsTrigger>
            </TabsList>
            <TabsContent value="columns" className="mt-3">
              <ColumnsTab table={table} />
            </TabsContent>
            <TabsContent value="indexes" className="mt-3">
              <IndexesTab table={table} />
            </TabsContent>
            <TabsContent value="fk" className="mt-3">
              <ForeignKeysTab table={table} />
            </TabsContent>
            <TabsContent value="sql" className="mt-3">
              <RawSQLTab table={table} rawSQL={rawSQL} />
            </TabsContent>
          </Tabs>
        </div>
      </ScrollArea>
    </div>
  );
}
