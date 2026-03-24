'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Zap, ArrowLeft, RefreshCw, Loader2, GitCompare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useSchemaStore } from '@/stores/schema-store';
import { HealthScoreGauge } from '@/components/optimizer/health-score-gauge';
import { BreakdownCards } from '@/components/optimizer/breakdown-cards';
import { IssuesList } from '@/components/optimizer/issues-list';
import type { AnalysisIssue } from '@/lib/types';
import { applyFixToSchema } from '@/lib/apply-fix';
import { runStaticAnalysis } from '@/lib/static-analyzer';
import { toast } from 'sonner';
import { PageTransition } from '@/components/shared/motion';
import { DiffView } from '@/components/shared/diff-view';
import { IndexAnalysis } from '@/components/optimizer/index-analysis';

export default function OptimizerPage() {
  const router = useRouter();
  const { currentSchema, originalSchema, healthReport, isAnalyzing, appliedFixTitles } = useSchemaStore();
  const setHealthReport = useSchemaStore((s) => s.setHealthReport);
  const [isApplying, setIsApplying] = useState(false);
  const [showDiff, setShowDiff] = useState(false);
  const hasDiff = originalSchema && currentSchema && originalSchema.rawSQL !== currentSchema.rawSQL;

  const handleAnalyze = useCallback(async () => {
    if (!currentSchema) return;

    useSchemaStore.setState({ isAnalyzing: true });
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schema: currentSchema, appliedFixes: appliedFixTitles }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Analysis failed');
        return;
      }

      setHealthReport(data.report);
      // Persist health report to DB
      await useSchemaStore.getState().saveCurrentSchema();
      toast.success(`Analysis complete: score ${data.report.score}/100`);
    } catch (err) {
      toast.error('Failed to analyze schema');
      console.error(err);
    } finally {
      useSchemaStore.setState({ isAnalyzing: false });
    }
  }, [currentSchema, setHealthReport, appliedFixTitles]);

  const handleApplyFix = useCallback(
    (issue: AnalysisIssue) => {
      const { currentSchema: schema, healthReport: report } = useSchemaStore.getState();
      if (!issue.fixSQL || !schema) return;

      // Structural update (sync — instant)
      const updatedSchema = applyFixToSchema(schema, issue);
      useSchemaStore.getState().setSchema(updatedSchema);

      // Re-run static analysis on updated schema
      if (report) {
        const freshStatic = runStaticAnalysis(updatedSchema);
        const normIssues = report.issues.filter((i) => i.type === 'normalization' && i.id !== issue.id);
        const normScore = report.breakdown.normalization;

        setHealthReport({
          score: freshStatic.breakdown.performance + freshStatic.breakdown.security + freshStatic.breakdown.conventions + normScore,
          breakdown: { ...freshStatic.breakdown, normalization: normScore },
          issues: [...freshStatic.issues, ...normIssues],
          summary: report.summary,
        });
      }

      // Track applied fix title so re-analysis won't re-report it
      useSchemaStore.setState((s) => ({
        appliedFixTitles: [...s.appliedFixTitles, issue.title],
      }));

      toast.success('Fix applied successfully');

      // DB persistence in background (non-blocking)
      const store = useSchemaStore.getState();
      store.saveCurrentSchema()
        .then(() => store.saveVersion(`Applied fix: ${issue.title}`))
        .catch((err) => {
          toast.error('Failed to save fix to database');
          console.error(err);
        });
    },
    [setHealthReport]
  );

  const handleApplyAll = useCallback(async () => {
    setIsApplying(true);
    try {
      const { currentSchema: initialSchema, healthReport: initialReport } = useSchemaStore.getState();
      if (!initialSchema || !initialReport) return;

      const fixable = initialReport.issues.filter((issue) => issue.fixSQL);
      if (fixable.length === 0) return;

      let schema = initialSchema;
      const appliedIds = new Set<string>();
      const appliedTitles = new Set<string>();

      for (const issue of fixable) {
        if (appliedTitles.has(issue.title)) {
          appliedIds.add(issue.id);
          continue;
        }

        const beforeRaw = schema.rawSQL;
        const beforeTables = JSON.stringify(schema.tables);
        schema = applyFixToSchema(schema, issue);

        if (schema.rawSQL !== beforeRaw || JSON.stringify(schema.tables) !== beforeTables) {
          appliedIds.add(issue.id);
          appliedTitles.add(issue.title);
        }
      }

      if (appliedIds.size > 0) {
        // Second pass: auto-apply any new fixable static issues created by the first pass
        // (e.g. missing comments on newly created tables, nullable columns on new tables)
        const MAX_PASSES = 5;
        for (let pass = 0; pass < MAX_PASSES; pass++) {
          const staticResult = runStaticAnalysis(schema);
          const newFixable = staticResult.issues.filter(
            (i) => i.fixSQL && !appliedIds.has(i.id) && !appliedTitles.has(i.title)
          );
          if (newFixable.length === 0) break;

          for (const issue of newFixable) {
            if (appliedTitles.has(issue.title)) continue;
            const beforeRaw = schema.rawSQL;
            const beforeTables = JSON.stringify(schema.tables);
            schema = applyFixToSchema(schema, issue);
            if (schema.rawSQL !== beforeRaw || JSON.stringify(schema.tables) !== beforeTables) {
              appliedIds.add(issue.id);
              appliedTitles.add(issue.title);
            }
          }
        }

        useSchemaStore.getState().setSchema(schema);

        const freshStatic = runStaticAnalysis(schema);
        const remainingNorm = initialReport.issues.filter(
          (i) => i.type === 'normalization' && !appliedIds.has(i.id)
        );
        const normScore = initialReport.breakdown.normalization;

        setHealthReport({
          score: freshStatic.breakdown.performance + freshStatic.breakdown.security + freshStatic.breakdown.conventions + normScore,
          breakdown: { ...freshStatic.breakdown, normalization: normScore },
          issues: [...freshStatic.issues, ...remainingNorm],
          summary: initialReport.summary,
        });

        // Track applied fix titles so re-analysis won't re-report them
        useSchemaStore.setState((s) => ({
          appliedFixTitles: [...s.appliedFixTitles, ...appliedTitles],
        }));

        // Save schema + health report to DB, then create version
        const store = useSchemaStore.getState();
        await store.saveCurrentSchema();
        await store.saveVersion(`Applied ${appliedIds.size} fixes`);

        toast.success(`Applied ${appliedIds.size} fixes`);
      }
    } catch (err) {
      toast.error('Failed to apply fixes');
      console.error(err);
    } finally {
      setIsApplying(false);
    }
  }, [setHealthReport]);

  // No schema loaded
  if (!currentSchema) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
        <Zap className="h-12 w-12 text-muted-foreground" />
        <h2 className="text-2xl font-semibold">Optimizer</h2>
        <p className="text-muted-foreground max-w-md">
          Import a schema first to analyze and optimize it.
        </p>
        <Button variant="outline" onClick={() => router.push('/')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Go to Import
        </Button>
      </div>
    );
  }

  return (
    <PageTransition>
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Zap className="h-5 w-5 text-primary shrink-0" />
          <h2 className="text-xl font-semibold">Schema Optimizer</h2>
          <span className="text-sm text-muted-foreground truncate">
            {currentSchema.name}
          </span>
        </div>
        <Button
          onClick={handleAnalyze}
          disabled={isAnalyzing}
          className="w-full sm:w-auto"
        >
          {isAnalyzing ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          {healthReport ? 'Re-analyze' : 'Analyze Schema'}
        </Button>
      </div>

      {/* Health Score */}
      <div className="flex flex-col md:flex-row items-center gap-6">
        <HealthScoreGauge
          score={healthReport?.score ?? null}
          isAnalyzing={isAnalyzing}
        />
        <div className="flex-1 w-full">
          <BreakdownCards
            breakdown={healthReport?.breakdown ?? null}
            isLoading={isAnalyzing}
          />
        </div>
      </div>

      {healthReport?.summary && (
        <p className="text-sm text-muted-foreground bg-muted/30 rounded-md p-3">
          {healthReport.summary}
        </p>
      )}

      <Separator />

      {/* Issues */}
      <div>
        <h3 className="text-lg font-semibold mb-4">
          Issues
          {healthReport && (
            <span className="text-sm font-normal text-muted-foreground ml-2">
              ({healthReport.issues.length} found)
            </span>
          )}
        </h3>
        <IssuesList
          issues={healthReport?.issues ?? []}
          onApplyFix={handleApplyFix}
          onApplyAll={handleApplyAll}
          isApplying={isApplying}
        />
      </div>

      {/* Index Analysis */}
      {healthReport && (
        <>
          <Separator />
          <IndexAnalysis schema={currentSchema} />
        </>
      )}

      {/* Diff View */}
      {hasDiff && (
        <>
          <Separator />
          <div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDiff(!showDiff)}
              className="mb-3"
            >
              <GitCompare className="h-4 w-4 mr-2" />
              {showDiff ? 'Hide' : 'Show'} Schema Changes
            </Button>
            {showDiff && (
              <DiffView
                original={originalSchema!.rawSQL}
                modified={currentSchema!.rawSQL}
                originalTitle="Original Schema"
                modifiedTitle="Current Schema"
              />
            )}
          </div>
        </>
      )}
    </div>
    </PageTransition>
  );
}
