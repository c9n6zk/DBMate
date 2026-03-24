'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import { KeyRound, Link2, Hash } from 'lucide-react';
import type { Table } from '@/lib/types';
import { cn } from '@/lib/utils';

export type TableNodeData = {
  table: Table;
  selected: boolean;
};

type TableNodeType = Node<TableNodeData, 'table'>;

function TableNodeComponent({ data }: NodeProps<TableNodeType>) {
  const { table, selected } = data;
  const fkColumnNames = new Set(table.foreignKeys.flatMap((fk) => fk.columns));

  return (
    <div
      className={cn(
        'rounded-lg border bg-card text-card-foreground shadow-sm min-w-[200px] max-w-[280px]',
        selected && 'ring-2 ring-primary border-primary'
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/50 rounded-t-lg">
        <Hash className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="font-semibold text-sm truncate">{table.name}</span>
      </div>

      {/* Columns */}
      <div className="divide-y divide-border/50">
        {table.columns.map((col) => {
          const isPK = col.primaryKey;
          const isFK = fkColumnNames.has(col.name);
          return (
            <div
              key={col.name}
              className="flex items-center gap-1.5 px-3 py-1 text-xs hover:bg-muted/30"
            >
              <span className="w-4 flex-shrink-0">
                {isPK ? (
                  <KeyRound className="h-3 w-3 text-amber-500" />
                ) : isFK ? (
                  <Link2 className="h-3 w-3 text-blue-500" />
                ) : null}
              </span>
              <span
                className={cn(
                  'truncate flex-1',
                  isPK && 'font-semibold',
                  col.unique && 'underline decoration-dotted'
                )}
              >
                {col.name}
              </span>
              <span className="text-muted-foreground text-[10px] uppercase flex-shrink-0">
                {col.type}
              </span>
            </div>
          );
        })}
      </div>

      {/* Footer summary */}
      <div className="flex items-center gap-3 px-3 py-1.5 border-t text-[10px] text-muted-foreground bg-muted/30 rounded-b-lg">
        <span>{table.indexes.length} idx</span>
        <span>{table.foreignKeys.length} FK</span>
        <span>{table.columns.length} cols</span>
      </div>

      {/* Handles for edges */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-2 !h-2 !bg-blue-500 !border-background"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!w-2 !h-2 !bg-amber-500 !border-background"
      />
    </div>
  );
}

export const TableNode = memo(TableNodeComponent);
