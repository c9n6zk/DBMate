'use client';

import { memo, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Database,
  Search,
  GitMerge,
  ArrowDownUp,
  Filter,
  Layers,
  Hash,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import type { ExplainPlanNode, ExplainNodeType } from '@/lib/types';

// Color coding: red = expensive scans, green = index usage, yellow = joins, blue = other
function getNodeColor(type: ExplainNodeType): string {
  switch (type) {
    case 'SEQ_SCAN':
      return 'text-red-500 bg-red-500/10 border-red-500/30';
    case 'INDEX_SCAN':
    case 'INDEX_ONLY_SCAN':
    case 'BITMAP_SCAN':
      return 'text-green-600 bg-green-500/10 border-green-500/30';
    case 'HASH_JOIN':
    case 'NESTED_LOOP':
    case 'MERGE_JOIN':
      return 'text-yellow-600 bg-yellow-500/10 border-yellow-500/30';
    case 'SORT':
    case 'AGGREGATE':
      return 'text-orange-500 bg-orange-500/10 border-orange-500/30';
    case 'SELECT':
      return 'text-blue-500 bg-blue-500/10 border-blue-500/30';
    default:
      return 'text-muted-foreground bg-muted/50 border-border';
  }
}

function getNodeIcon(type: ExplainNodeType) {
  switch (type) {
    case 'SEQ_SCAN':
      return Database;
    case 'INDEX_SCAN':
    case 'INDEX_ONLY_SCAN':
    case 'BITMAP_SCAN':
      return Search;
    case 'HASH_JOIN':
    case 'NESTED_LOOP':
    case 'MERGE_JOIN':
      return GitMerge;
    case 'SORT':
      return ArrowDownUp;
    case 'FILTER':
      return Filter;
    case 'AGGREGATE':
      return Layers;
    case 'HASH':
      return Hash;
    default:
      return Database;
  }
}

function formatCost(cost: number): string {
  if (cost >= 1000) return `${(cost / 1000).toFixed(1)}k`;
  return cost.toFixed(1);
}

function formatRows(rows: number): string {
  if (rows >= 1_000_000) return `${(rows / 1_000_000).toFixed(1)}M`;
  if (rows >= 1000) return `${(rows / 1000).toFixed(1)}k`;
  return String(rows);
}

interface ExplainTreeNodeProps {
  node: ExplainPlanNode;
  depth: number;
  maxCost: number;
  compact?: boolean;
}

function ExplainTreeNode({ node, depth, maxCost, compact }: ExplainTreeNodeProps) {
  const [expanded, setExpanded] = useState(true);
  const children = node.children ?? [];
  const hasChildren = children.length > 0;
  const Icon = getNodeIcon(node.type);
  const colorClass = getNodeColor(node.type);
  const costPct = maxCost > 0 ? (node.cost / maxCost) * 100 : 0;

  return (
    <div className="select-none min-w-0">
      <div
        className={cn(
          'flex items-start gap-1.5 py-1 px-1.5 rounded-md cursor-pointer hover:bg-accent/50 transition-colors min-w-0',
          depth > 0 && (compact ? 'ml-3' : 'ml-5')
        )}
        onClick={() => hasChildren && setExpanded(!expanded)}
      >
        {/* Expand/collapse */}
        <div className="w-3.5 h-3.5 mt-0.5 shrink-0">
          {hasChildren ? (
            expanded ? (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            )
          ) : (
            <span className="block w-3.5" />
          )}
        </div>

        {/* Node card */}
        <div className={cn('flex-1 min-w-0 rounded-md border p-1.5', colorClass)}>
          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
            <Icon className="h-3 w-3 shrink-0" />
            <span className="text-[11px] font-semibold">{node.type.replace(/_/g, ' ')}</span>
            {node.table && (
              <Badge variant="outline" className="text-[9px] h-3.5 px-1 truncate max-w-30">
                {node.table}
              </Badge>
            )}
            {node.index && (
              <Badge variant="outline" className="text-[9px] h-3.5 px-1 border-green-500/40 text-green-600 truncate max-w-25">
                idx: {node.index}
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[9px] opacity-70">
              cost: {formatCost(node.cost)}
            </span>
            <span className="text-[9px] opacity-70">
              rows: {formatRows(node.rows)}
            </span>
          </div>

          {/* Cost bar */}
          <div className="mt-0.5 h-0.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                costPct > 70 ? 'bg-red-500' : costPct > 40 ? 'bg-yellow-500' : 'bg-green-500'
              )}
              style={{ width: `${Math.max(costPct, 2)}%` }}
            />
          </div>

          {node.condition && (
            <p className="text-[9px] mt-0.5 opacity-60 font-mono truncate">
              {node.condition}
            </p>
          )}
        </div>
      </div>

      {/* Children */}
      {hasChildren && expanded && (
        <div className={cn('border-l border-dashed border-muted-foreground/20 min-w-0', compact ? 'ml-3' : 'ml-4')}>
          {children.map((child) => (
            <ExplainTreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              maxCost={maxCost}
              compact={compact}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function getMaxCost(node: ExplainPlanNode): number {
  let max = node.cost;
  for (const child of node.children ?? []) {
    max = Math.max(max, getMaxCost(child));
  }
  return max;
}

interface ExplainPlanProps {
  plan: ExplainPlanNode;
  compact?: boolean;
  className?: string;
}

function ExplainPlanComponent({ plan, compact, className }: ExplainPlanProps) {
  const maxCost = getMaxCost(plan);

  return (
    <div className={cn('rounded-md border bg-card overflow-hidden', className)}>
      <div className="flex items-center gap-1.5 px-2 py-1 border-b bg-muted/30">
        <Search className="h-3 w-3 text-primary" />
        <span className="text-[10px] font-semibold">Execution Plan</span>
        <div className="ml-auto flex items-center gap-2">
          <Legend color="bg-red-500" label="Seq" />
          <Legend color="bg-green-500" label="Idx" />
          <Legend color="bg-yellow-500" label="Join" />
        </div>
      </div>
      <div className="p-1.5 min-w-0 overflow-hidden">
        <ExplainTreeNode node={plan} depth={0} maxCost={maxCost} compact={compact} />
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1">
      <span className={cn('w-2 h-2 rounded-full', color)} />
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </div>
  );
}

export const ExplainPlan = memo(ExplainPlanComponent);
