'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Loader2,
  Plus,
  X,
  CheckCircle2,
  XCircle,
  Lightbulb,
  Database,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSchemaStore } from '@/stores/schema-store';
import { applyFixToSchema } from '@/lib/apply-fix';
import { runStaticAnalysis } from '@/lib/static-analyzer';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { nanoid } from 'nanoid';
import type {
  Schema,
  AnalysisIssue,
  IndexAnalysisResult,
  SuggestedIndex,
} from '@/lib/types';

interface IndexAnalysisProps {
  schema: Schema;
}

export function IndexAnalysis({ schema }: IndexAnalysisProps) {
  const [historyQueries, setHistoryQueries] = useState<string[]>([]);
  const [selectedQueries, setSelectedQueries] = useState<Set<string>>(new Set());
  const [manualQuery, setManualQuery] = useState('');
  const [manualQueries, setManualQueries] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [result, setResult] = useState<IndexAnalysisResult | null>(null);
  const [applyingIdx, setApplyingIdx] = useState<number | null>(null);

  const activeSchemaId = useSchemaStore((s) => s.activeSchemaId);

  // Fetch query history on mount
  useEffect(() => {
    if (!activeSchemaId) return;
    setIsLoadingHistory(true);
    fetch(`/api/index-analysis?schemaId=${activeSchemaId}`)
      .then((r) => r.json())
      .then((data) => {
        const queries: string[] = data.queries ?? [];
        setHistoryQueries(queries);
        // Auto-select all
        setSelectedQueries(new Set(queries));
      })
      .catch(() => {})
      .finally(() => setIsLoadingHistory(false));
  }, [activeSchemaId]);

  const allQueries = [
    ...Array.from(selectedQueries),
    ...manualQueries,
  ];

  const handleAddManualQuery = () => {
    const trimmed = manualQuery.trim();
    if (!trimmed || manualQueries.includes(trimmed)) return;
    setManualQueries((prev) => [...prev, trimmed]);
    setManualQuery('');
  };

  const handleRemoveManualQuery = (q: string) => {
    setManualQueries((prev) => prev.filter((mq) => mq !== q));
  };

  const handleToggleHistory = (q: string) => {
    setSelectedQueries((prev) => {
      const next = new Set(prev);
      if (next.has(q)) next.delete(q);
      else next.add(q);
      return next;
    });
  };

  const handleAnalyze = useCallback(async () => {
    if (allQueries.length === 0) {
      toast.error('Add at least one query to analyze index usage');
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      const res = await fetch('/api/index-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schema, queries: allQueries }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || 'Index analysis failed');
        return;
      }

      const data: IndexAnalysisResult = await res.json();
      setResult(data);
      toast.success('Index analysis complete');
    } catch {
      toast.error('Failed to analyze indexes');
    } finally {
      setIsLoading(false);
    }
  }, [schema, allQueries]);

  const handleApplySuggestion = useCallback(
    (suggestion: SuggestedIndex, idx: number) => {
      const { currentSchema, healthReport } = useSchemaStore.getState();
      if (!currentSchema) return;

      setApplyingIdx(idx);
      try {
        const syntheticIssue: AnalysisIssue = {
          id: nanoid(),
          type: 'performance',
          severity: 'warning',
          title: `Add index on ${suggestion.table}(${suggestion.columns.join(', ')})`,
          affectedTable: suggestion.table,
          fixSQL: `CREATE ${suggestion.unique ? 'UNIQUE ' : ''}INDEX idx_${suggestion.table}_${suggestion.columns.join('_')} ON ${suggestion.table}(${suggestion.columns.join(', ')})`,
        };

        const updatedSchema = applyFixToSchema(currentSchema, syntheticIssue);
        useSchemaStore.getState().setSchema(updatedSchema);

        // Re-run static analysis
        if (healthReport) {
          const freshStatic = runStaticAnalysis(updatedSchema);
          const normScore = healthReport.breakdown.normalization;
          const normIssues = healthReport.issues.filter((i) => i.type === 'normalization');
          useSchemaStore.getState().setHealthReport({
            score: freshStatic.breakdown.performance + freshStatic.breakdown.security + freshStatic.breakdown.conventions + normScore,
            breakdown: { ...freshStatic.breakdown, normalization: normScore },
            issues: [...freshStatic.issues, ...normIssues],
            summary: healthReport.summary,
          });
        }

        // Auto-save + version
        const store = useSchemaStore.getState();
        store.saveCurrentSchema().then(() => {
          store.saveVersion(`Applied index: idx_${suggestion.table}_${suggestion.columns.join('_')}`);
        });

        toast.success(`Index applied on ${suggestion.table}(${suggestion.columns.join(', ')})`);

        // Remove from results
        if (result) {
          setResult({
            ...result,
            suggestedIndexes: result.suggestedIndexes.filter((_, i) => i !== idx),
          });
        }
      } catch {
        toast.error('Failed to apply index');
      } finally {
        setApplyingIdx(null);
      }
    },
    [result]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Database className="h-4 w-4 text-primary" />
        <h3 className="text-lg font-semibold">Index Impact Analysis</h3>
      </div>

      {/* Query sources */}
      <div className="space-y-3 rounded-md border p-3 bg-muted/20">
        <div className="text-sm font-medium">Queries to analyze</div>

        {/* History queries */}
        {isLoadingHistory ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Loading query history...
          </div>
        ) : historyQueries.length > 0 ? (
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">From query history:</div>
            <div className="max-h-[120px] overflow-y-auto space-y-1">
              {historyQueries.map((q) => (
                <label
                  key={q}
                  className="flex items-start gap-2 text-xs font-mono cursor-pointer hover:bg-muted/50 rounded p-1"
                >
                  <input
                    type="checkbox"
                    checked={selectedQueries.has(q)}
                    onChange={() => handleToggleHistory(q)}
                    className="mt-0.5 h-3 w-3 shrink-0"
                  />
                  <span className="truncate">{q}</span>
                </label>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            No query history found. Add queries manually below.
          </p>
        )}

        {/* Manual queries */}
        {manualQueries.length > 0 && (
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Manual queries:</div>
            {manualQueries.map((q) => (
              <div
                key={q}
                className="flex items-center gap-2 text-xs font-mono bg-muted/50 rounded p-1"
              >
                <span className="truncate flex-1">{q}</span>
                <button
                  onClick={() => handleRemoveManualQuery(q)}
                  className="text-muted-foreground hover:text-destructive shrink-0"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add manual query */}
        <div className="flex gap-1.5">
          <input
            type="text"
            value={manualQuery}
            onChange={(e) => setManualQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddManualQuery()}
            placeholder="SELECT * FROM users WHERE email = ?"
            className="flex-1 h-7 px-2 text-xs font-mono bg-background border rounded focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={handleAddManualQuery}
            disabled={!manualQuery.trim()}
            className="h-7 text-xs"
          >
            <Plus className="h-3 w-3 mr-0.5" />
            Add
          </Button>
        </div>

        {/* Analyze button */}
        <Button
          onClick={handleAnalyze}
          disabled={isLoading || allQueries.length === 0}
          size="sm"
          className="w-full"
        >
          {isLoading ? (
            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
          ) : (
            <Search className="h-3.5 w-3.5 mr-1.5" />
          )}
          Analyze Index Usage ({allQueries.length} quer{allQueries.length === 1 ? 'y' : 'ies'})
        </Button>
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-3">
          {/* Index Usage */}
          {result.indexUsage.length > 0 && (
            <div className="rounded-md border p-3 space-y-2">
              <div className="flex items-center gap-1.5 text-sm font-medium">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                Index Usage ({result.indexUsage.length})
              </div>
              {result.indexUsage.map((iu) => (
                <div key={`${iu.table}.${iu.indexName}`} className="text-xs space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                      {iu.table}
                    </Badge>
                    <span className="font-medium font-mono">{iu.indexName}</span>
                    {iu.usedByQueries.length > 0 ? (
                      <Badge variant="default" className="text-[10px] h-4 px-1.5">
                        {iu.usedByQueries.length} quer{iu.usedByQueries.length === 1 ? 'y' : 'ies'}
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="text-[10px] h-4 px-1.5">
                        unused
                      </Badge>
                    )}
                  </div>
                  {iu.unusedReason && (
                    <p className="text-muted-foreground pl-5">{iu.unusedReason}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Unused Indexes */}
          {result.unusedIndexes.length > 0 && (
            <div className="rounded-md border border-red-500/30 bg-red-500/5 p-3 space-y-2">
              <div className="flex items-center gap-1.5 text-sm font-medium text-red-600 dark:text-red-400">
                <XCircle className="h-3.5 w-3.5" />
                Unused Indexes ({result.unusedIndexes.length})
              </div>
              {result.unusedIndexes.map((ui) => (
                <div key={`${ui.table}.${ui.indexName}`} className="text-xs space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                      {ui.table}
                    </Badge>
                    <span className="font-medium font-mono line-through opacity-60">
                      {ui.indexName}
                    </span>
                  </div>
                  <p className="text-muted-foreground pl-5">{ui.recommendation}</p>
                </div>
              ))}
            </div>
          )}

          {/* Suggested Indexes */}
          {result.suggestedIndexes.length > 0 && (
            <div className="rounded-md border border-blue-500/30 bg-blue-500/5 p-3 space-y-2">
              <div className="flex items-center gap-1.5 text-sm font-medium text-blue-600 dark:text-blue-400">
                <Lightbulb className="h-3.5 w-3.5" />
                Suggested Indexes ({result.suggestedIndexes.length})
              </div>
              {result.suggestedIndexes.map((si, idx) => (
                <div
                  key={`${si.table}.${si.columns.join('_')}`}
                  className="rounded border bg-background p-2 space-y-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Badge variant="outline" className="text-[10px] h-4 px-1.5 shrink-0">
                        {si.table}
                      </Badge>
                      <span className="text-xs font-medium font-mono truncate">
                        ({si.columns.join(', ')})
                      </span>
                      {si.unique && (
                        <Badge variant="outline" className="text-[10px] h-4 px-1 shrink-0 border-green-500/40 text-green-600">
                          UQ
                        </Badge>
                      )}
                    </div>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => handleApplySuggestion(si, idx)}
                      disabled={applyingIdx === idx}
                      className="h-6 text-[10px] px-2 shrink-0"
                    >
                      {applyingIdx === idx ? (
                        <Loader2 className="h-2.5 w-2.5 animate-spin" />
                      ) : (
                        'Apply'
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">{si.reason}</p>
                  <div className="flex items-center gap-1.5">
                    <Badge
                      variant="secondary"
                      className={cn(
                        'text-[10px] h-4 px-1.5',
                        si.estimatedImprovement.includes('faster') && 'text-green-600'
                      )}
                    >
                      {si.estimatedImprovement}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">
                      affects {si.affectedQueries.length} quer{si.affectedQueries.length === 1 ? 'y' : 'ies'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty state */}
          {result.indexUsage.length === 0 &&
            result.unusedIndexes.length === 0 &&
            result.suggestedIndexes.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No index issues found — your schema is well-indexed for these queries.
              </p>
            )}
        </div>
      )}
    </div>
  );
}
