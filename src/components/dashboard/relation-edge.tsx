'use client';

import { memo } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
  type Edge,
} from '@xyflow/react';

export type RelationEdgeData = {
  label: string;
  onDelete?: string;
  sourceCardinality: '1' | 'N';
  targetCardinality: '1' | 'N';
};

type RelationEdgeType = Edge<RelationEdgeData, 'relation'>;

export const RelationEdge = memo(function RelationEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: EdgeProps<RelationEdgeType>) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const sourceLabel = data?.sourceCardinality ?? '1';
  const targetLabel = data?.targetCardinality ?? 'N';

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: selected ? 'var(--primary)' : 'var(--foreground)',
          strokeWidth: selected ? 2.5 : 2,
          opacity: selected ? 1 : 0.8,
        }}
      />
      <EdgeLabelRenderer>
        {/* Source cardinality */}
        <div
          className="nodrag nopan absolute text-[10px] font-mono font-bold text-muted-foreground bg-background px-1 rounded"
          style={{
            transform: `translate(-50%, -50%) translate(${sourceX + (targetX - sourceX) * 0.15}px,${sourceY + (targetY - sourceY) * 0.15 - 10}px)`,
            pointerEvents: 'none',
          }}
        >
          {sourceLabel}
        </div>
        {/* Target cardinality */}
        <div
          className="nodrag nopan absolute text-[10px] font-mono font-bold text-muted-foreground bg-background px-1 rounded"
          style={{
            transform: `translate(-50%, -50%) translate(${sourceX + (targetX - sourceX) * 0.85}px,${sourceY + (targetY - sourceY) * 0.85 - 10}px)`,
            pointerEvents: 'none',
          }}
        >
          {targetLabel}
        </div>
        {/* Edge label */}
        {data?.label && (
          <div
            className="nodrag nopan absolute text-[10px] text-muted-foreground bg-background/90 px-1.5 py-0.5 rounded border"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'none',
            }}
          >
            {data.label}
          </div>
        )}
      </EdgeLabelRenderer>
    </>
  );
});
