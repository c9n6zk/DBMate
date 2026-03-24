'use client';

import { useState, useCallback } from 'react';
import { Search, Loader2, AlertTriangle, Lightbulb, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSchemaStore } from '@/stores/schema-store';
import { ExplainPlan } from '@/components/shared/explain-plan';
import { IndexSimulator } from '@/components/dashboard/index-simulator';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { ExplainPlanNode } from '@/lib/types';

interface HypotheticalIndex {
  table: string;
  columns: string[];
  unique: boolean;
}

interface RemovedIndex {
  table: string;
  indexName: string;
}

interface ExplainResult {
  plan: ExplainPlanNode;
  totalCost: number;
  warnings: string[];
  recommendations: string[];
}

export function ExplainPlanPanel() {
  const currentSchema = useSchemaStore((s) => s.currentSchema);
  const [sql, setSql] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ExplainResult | null>(null);
  const [comparisonResult, setComparisonResult] = useState<ExplainResult | null>(null);

  // What-if state
  const [hypotheticalIndexes, setHypotheticalIndexes] = useState<HypotheticalIndex[]>([]);
  const [removedIndexes, setRemovedIndexes] = useState<RemovedIndex[]>([]);

  const handleExplain = useCallback(async () => {
    if (!currentSchema || !sql.trim()) return;

    setIsLoading(true);
    setResult(null);
    setComparisonResult(null);

    try {
      // Base explain (without what-if)
      const baseRes = await fetch('/api/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sql: sql.trim(),
          schema: currentSchema,
          dialect: currentSchema.dialect,
        }),
      });

      if (!baseRes.ok) {
        const data = await baseRes.json();
        toast.error(data.error || 'Failed to generate explain plan');
        return;
      }

      const baseData: ExplainResult = await baseRes.json();
      setResult(baseData);

      // If we have what-if modifications, run comparison
      if (hypotheticalIndexes.length > 0 || removedIndexes.length > 0) {
        const whatIfRes = await fetch('/api/explain', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sql: sql.trim(),
            schema: currentSchema,
            dialect: currentSchema.dialect,
            hypotheticalIndexes,
            removedIndexes,
          }),
        });

        if (whatIfRes.ok) {
          const whatIfData: ExplainResult = await whatIfRes.json();
          setComparisonResult(whatIfData);
        }
      }
    } catch {
      toast.error('Failed to generate explain plan');
    } finally {
      setIsLoading(false);
    }
  }, [currentSchema, sql, hypotheticalIndexes, removedIndexes]);

  if (!currentSchema) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
        <Search className="h-8 w-8" />
        <p className="text-sm">No schema loaded</p>
      </div>
    );
  }

  const costDiff =
    result && comparisonResult
      ? ((comparisonResult.totalCost - result.totalCost) / Math.max(result.totalCost, 1)) * 100
      : null;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top: SQL input + Explain button */}
      <div className="p-3 border-b space-y-2">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-primary shrink-0" />
          <span className="text-sm font-medium">Query Explain Plan</span>
        </div>
        <textarea
          value={sql}
          onChange={(e) => setSql(e.target.value)}
          placeholder="SELECT * FROM users WHERE email = 'test@example.com'..."
          className="w-full h-20 px-3 py-2 text-xs font-mono bg-muted/50 border rounded-md resize-none focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <div className="flex items-center gap-2">
          <Button
            onClick={handleExplain}
            disabled={isLoading || !sql.trim()}
            size="sm"
            className="h-7 text-xs"
          >
            {isLoading ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : (
              <Zap className="h-3 w-3 mr-1" />
            )}
            Explain
          </Button>
          {result && (
            <Badge variant="secondary" className="text-xs">
              Cost: {result.totalCost.toFixed(1)}
            </Badge>
          )}
          {costDiff !== null && (
            <Badge
              variant={costDiff < 0 ? 'default' : 'destructive'}
              className="text-xs"
            >
              {costDiff > 0 ? '+' : ''}{costDiff.toFixed(1)}%
              {costDiff < 0 ? ' faster' : ' slower'}
            </Badge>
          )}
        </div>
      </div>

      {/* Main content: scrollable */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {result ? (
          <div className="p-3 space-y-3">
            {/* Warnings */}
            {result.warnings.length > 0 && (
              <div className="rounded-md border border-yellow-500/30 bg-yellow-500/5 p-2 space-y-1">
                <div className="flex items-center gap-1.5 text-yellow-600 dark:text-yellow-400">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  <span className="text-xs font-medium">Warnings</span>
                </div>
                {result.warnings.map((w, i) => (
                  <p key={i} className="text-xs text-yellow-700 dark:text-yellow-300 pl-5">
                    {w}
                  </p>
                ))}
              </div>
            )}

            {/* Recommendations */}
            {result.recommendations.length > 0 && (
              <div className="rounded-md border border-blue-500/30 bg-blue-500/5 p-2 space-y-1">
                <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                  <Lightbulb className="h-3.5 w-3.5 shrink-0" />
                  <span className="text-xs font-medium">Recommendations</span>
                </div>
                {result.recommendations.map((r, i) => (
                  <p key={i} className="text-xs text-blue-700 dark:text-blue-300 pl-5">
                    {r}
                  </p>
                ))}
              </div>
            )}

            {/* Plan trees: side-by-side if comparison exists */}
            {comparisonResult ? (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="text-[10px] font-medium text-muted-foreground mb-1 uppercase tracking-wide">
                    Original
                  </div>
                  <ExplainPlan plan={result.plan} compact />
                </div>
                <div>
                  <div className="text-[10px] font-medium text-muted-foreground mb-1 uppercase tracking-wide">
                    What-if
                    {costDiff !== null && (
                      <span className={cn('ml-1', costDiff < 0 ? 'text-green-500' : 'text-red-500')}>
                        ({costDiff > 0 ? '+' : ''}{costDiff.toFixed(1)}%)
                      </span>
                    )}
                  </div>
                  <ExplainPlan plan={comparisonResult.plan} compact />
                </div>
              </div>
            ) : (
              <ExplainPlan plan={result.plan} />
            )}

            {/* What-if comparison warnings */}
            {comparisonResult && comparisonResult.warnings.length > 0 && (
              <div className="rounded-md border border-orange-500/30 bg-orange-500/5 p-2 space-y-1">
                <div className="flex items-center gap-1.5 text-orange-600 dark:text-orange-400">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  <span className="text-xs font-medium">What-if Warnings</span>
                </div>
                {comparisonResult.warnings.map((w, i) => (
                  <p key={i} className="text-xs text-orange-700 dark:text-orange-300 pl-5">
                    {w}
                  </p>
                ))}
              </div>
            )}
          </div>
        ) : !isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
            <Zap className="h-6 w-6" />
            <p className="text-xs">Enter a SQL query and click Explain</p>
            <p className="text-xs text-muted-foreground/60">
              Supports SELECT queries with what-if index simulation
            </p>
          </div>
        ) : null}
      </div>

      {/* Bottom: Index Simulator */}
      <IndexSimulator
        schema={currentSchema}
        hypotheticalIndexes={hypotheticalIndexes}
        removedIndexes={removedIndexes}
        onHypotheticalChange={setHypotheticalIndexes}
        onRemovedChange={setRemovedIndexes}
      />
    </div>
  );
}
