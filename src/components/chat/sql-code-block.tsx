'use client';

import { useCallback, useState } from 'react';
import { Check, Copy, Loader2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useSchemaStore } from '@/stores/schema-store';
import { ExplainPlan } from '@/components/shared/explain-plan';
import { toast } from 'sonner';
import type { ExplainPlanNode } from '@/lib/types';

interface SQLCodeBlockProps {
  sql: string;
  className?: string;
}

export function SQLCodeBlock({ sql, className }: SQLCodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const [explainPlan, setExplainPlan] = useState<ExplainPlanNode | null>(null);
  const [isExplaining, setIsExplaining] = useState(false);
  const currentSchema = useSchemaStore((s) => s.currentSchema);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExplain = useCallback(async () => {
    if (!currentSchema || isExplaining) return;

    // Toggle off if already shown
    if (explainPlan) {
      setExplainPlan(null);
      return;
    }

    setIsExplaining(true);
    try {
      const res = await fetch('/api/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sql,
          schema: currentSchema,
          dialect: currentSchema.dialect,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || 'Failed to generate explain plan');
        return;
      }

      const data = await res.json();
      setExplainPlan(data.plan);
    } catch {
      toast.error('Failed to generate explain plan');
    } finally {
      setIsExplaining(false);
    }
  }, [currentSchema, sql, explainPlan, isExplaining]);

  // Only show Explain button for SELECT queries
  const isSelect = sql.trim().toUpperCase().startsWith('SELECT');

  return (
    <div className={cn('relative group rounded-md border bg-muted/50 my-1', className)}>
      <div className="flex items-center justify-between px-2 py-0.5 border-b bg-muted/30">
        <span className="text-[9px] uppercase font-medium text-muted-foreground tracking-wide">
          sql
        </span>
        <div className="flex items-center">
          {isSelect && currentSchema && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleExplain}
              className="h-5 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
              disabled={isExplaining}
            >
              {isExplaining ? (
                <Loader2 className="h-2.5 w-2.5 mr-0.5 animate-spin" />
              ) : (
                <Search className="h-2.5 w-2.5 mr-0.5" />
              )}
              {explainPlan ? 'Hide' : 'Explain'}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="h-5 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
          >
            {copied ? (
              <Check className="h-2.5 w-2.5 text-green-500" />
            ) : (
              <Copy className="h-2.5 w-2.5" />
            )}
          </Button>
        </div>
      </div>
      <pre className="px-2.5 py-2 overflow-x-auto text-[11px] font-mono leading-relaxed whitespace-pre-wrap text-muted-foreground">
        {sql}
      </pre>

      {/* Explain Plan visualization */}
      {explainPlan && (
        <div className="border-t overflow-hidden">
          <ExplainPlan plan={explainPlan} compact />
        </div>
      )}
    </div>
  );
}
