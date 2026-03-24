'use client';

import { useCallback, useEffect, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  Panel,
  useNodesState,
  useEdgesState,
  useReactFlow,
  useStore,
  type Node,
  type Edge,
  BackgroundVariant,
  type ReactFlowState,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';
import { TableNode, type TableNodeData } from './table-node';
import { RelationEdge, type RelationEdgeData } from './relation-edge';
import type { Schema } from '@/lib/types';

const NODE_WIDTH = 240;
const NODE_HEIGHT_BASE = 60; // header + footer
const NODE_ROW_HEIGHT = 22; // per column row

const nodeTypes = { table: TableNode };
const edgeTypes = { relation: RelationEdge };

function getLayoutedElements(
  nodes: Node<TableNodeData>[],
  edges: Edge<RelationEdgeData>[]
) {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'LR', nodesep: 60, ranksep: 100 });

  nodes.forEach((node) => {
    const colCount = node.data.table.columns.length;
    const height = NODE_HEIGHT_BASE + colCount * NODE_ROW_HEIGHT;
    g.setNode(node.id, { width: NODE_WIDTH, height });
  });

  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });

  dagre.layout(g);

  const layoutedNodes = nodes.map((node) => {
    const dagreNode = g.node(node.id);
    const colCount = node.data.table.columns.length;
    const height = NODE_HEIGHT_BASE + colCount * NODE_ROW_HEIGHT;
    return {
      ...node,
      position: {
        x: dagreNode.x - NODE_WIDTH / 2,
        y: dagreNode.y - height / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
}

function buildGraph(schema: Schema, selectedTable: string | null) {
  const nodes: Node<TableNodeData>[] = schema.tables.map((table) => ({
    id: table.name,
    type: 'table',
    position: { x: 0, y: 0 },
    data: {
      table,
      selected: table.name === selectedTable,
    },
  }));

  const edges: Edge<RelationEdgeData>[] = [];
  const edgeSet = new Set<string>();

  schema.tables.forEach((table) => {
    table.foreignKeys.forEach((fk) => {
      const edgeId = `${table.name}->${fk.referencedTable}`;
      if (edgeSet.has(edgeId)) return;
      edgeSet.add(edgeId);

      edges.push({
        id: edgeId,
        source: table.name,
        target: fk.referencedTable,
        type: 'relation',
        data: {
          label: fk.columns.join(', '),
          onDelete: fk.onDelete,
          sourceCardinality: 'N',
          targetCardinality: '1',
        },
      });
    });
  });

  return getLayoutedElements(nodes, edges);
}

interface ERDiagramProps {
  schema: Schema;
  selectedTable: string | null;
  onSelectTable: (tableName: string | null) => void;
}

const viewportSelector = (s: ReactFlowState) => ({
  x: s.transform[0],
  y: s.transform[1],
  zoom: s.transform[2],
  width: s.width,
  height: s.height,
});

function FixedMiniMap({ nodes }: { nodes: Node<TableNodeData>[] }) {
  const vp = useStore(viewportSelector);

  // Compute bounding box: union of all nodes + current viewport, with a minimum world size
  const bbox = useMemo(() => {
    const MIN_W = 2000;
    const MIN_H = 1400;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const node of nodes) {
      const colCount = (node.data as TableNodeData).table.columns.length;
      const h = NODE_HEIGHT_BASE + colCount * NODE_ROW_HEIGHT;
      if (node.position.x < minX) minX = node.position.x;
      if (node.position.y < minY) minY = node.position.y;
      if (node.position.x + NODE_WIDTH > maxX) maxX = node.position.x + NODE_WIDTH;
      if (node.position.y + h > maxY) maxY = node.position.y + h;
    }

    if (nodes.length === 0) { minX = 0; minY = 0; maxX = MIN_W; maxY = MIN_H; }

    // Include viewport bounds
    const vpX = -vp.x / vp.zoom;
    const vpY = -vp.y / vp.zoom;
    const vpW = vp.width / vp.zoom;
    const vpH = vp.height / vp.zoom;
    if (vpX < minX) minX = vpX;
    if (vpY < minY) minY = vpY;
    if (vpX + vpW > maxX) maxX = vpX + vpW;
    if (vpY + vpH > maxY) maxY = vpY + vpH;

    // Enforce minimum world size centered on content
    let w = maxX - minX;
    let h = maxY - minY;
    if (w < MIN_W) { const cx = minX + w / 2; minX = cx - MIN_W / 2; w = MIN_W; }
    if (h < MIN_H) { const cy = minY + h / 2; minY = cy - MIN_H / 2; h = MIN_H; }

    const pad = 0.15;
    return { x: minX - w * pad, y: minY - h * pad, w: w * (1 + pad * 2), h: h * (1 + pad * 2) };
  }, [nodes, vp]);

  // Viewport rect in graph coordinates
  const vpRect = {
    x: -vp.x / vp.zoom,
    y: -vp.y / vp.zoom,
    w: vp.width / vp.zoom,
    h: vp.height / vp.zoom,
  };

  return (
    <Panel position="bottom-right">
      <svg
        width={180}
        height={120}
        viewBox={`${bbox.x} ${bbox.y} ${bbox.w} ${bbox.h}`}
        className="rounded border border-border bg-muted/30"
      >
        {/* Node rectangles */}
        {nodes.map((node) => {
          const colCount = (node.data as TableNodeData).table.columns.length;
          const h = NODE_HEIGHT_BASE + colCount * NODE_ROW_HEIGHT;
          return (
            <rect
              key={node.id}
              x={node.position.x}
              y={node.position.y}
              width={NODE_WIDTH}
              height={h}
              fill="#ffffff"
              rx={3}
            />
          );
        })}
        {/* Viewport indicator */}
        <rect
          x={vpRect.x}
          y={vpRect.y}
          width={vpRect.w}
          height={vpRect.h}
          fill="hsl(210 100% 50% / 0.1)"
          stroke="hsl(210 100% 60%)"
          strokeWidth={bbox.w / 180}
          rx={2}
        />
      </svg>
    </Panel>
  );
}

function ERDiagramInner({ schema, selectedTable, onSelectTable }: ERDiagramProps) {
  const { fitView } = useReactFlow();

  const { nodes: layoutedNodes, edges: layoutedEdges } = useMemo(
    () => buildGraph(schema, selectedTable),
    [schema, selectedTable]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutedEdges);

  // Sync when schema or selection changes
  useEffect(() => {
    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
  }, [layoutedNodes, layoutedEdges, setNodes, setEdges]);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      onSelectTable(node.id === selectedTable ? null : node.id);
    },
    [onSelectTable, selectedTable]
  );

  const onPaneClick = useCallback(() => {
    onSelectTable(null);
  }, [onSelectTable]);


  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={onNodeClick}
      onPaneClick={onPaneClick}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      fitView
      fitViewOptions={{ padding: 0.2 }}
      minZoom={0.1}
      maxZoom={2}
      proOptions={{ hideAttribution: true }}
      className="bg-background"
    >
      <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
      <Controls showInteractive={false} />
      <FixedMiniMap nodes={nodes} />
    </ReactFlow>
  );
}

export function ERDiagram(props: ERDiagramProps) {
  return <ERDiagramInner {...props} />;
}
