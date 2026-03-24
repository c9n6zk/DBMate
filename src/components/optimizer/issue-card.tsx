'use client';

import { useState } from 'react';
import { Check, Copy, ChevronDown, ChevronRight, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { AnalysisIssue } from '@/lib/types';
import { toast } from 'sonner';

interface IssueCardProps {
  issue: AnalysisIssue;
  onApplyFix: (issue: AnalysisIssue) => void;
  onDismiss: (issueId: string) => void;
  isApplying: boolean;
  forceExpanded?: boolean;
}

const severityConfig = {
  critical: { label: 'Critical', className: 'bg-red-500/10 text-red-500 border-red-500/20' },
  warning: { label: 'Warning', className: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' },
  info: { label: 'Info', className: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
  success: { label: 'OK', className: 'bg-green-500/10 text-green-500 border-green-500/20' },
};

export function IssueCard({ issue, onApplyFix, onDismiss, isApplying, forceExpanded }: IssueCardProps) {
  const [localExpanded, setLocalExpanded] = useState(false);
  const expanded = forceExpanded ?? localExpanded;
  const [copied, setCopied] = useState(false);
  const severity = severityConfig[issue.severity];

  const handleCopy = async () => {
    if (!issue.fixSQL) return;
    await navigator.clipboard.writeText(issue.fixSQL);
    setCopied(true);
    toast.success('SQL copied');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-md border bg-card text-card-foreground overflow-hidden">
      {/* Header row — always visible */}
      <button
        onClick={() => setLocalExpanded(!expanded)}
        className="w-full flex items-center gap-1.5 px-3 py-1.5 text-left hover:bg-muted/30 transition-colors"
      >
        {expanded ? (
          <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
        )}
        <Badge variant="outline" className={cn('text-[9px] leading-none px-1 py-0', severity.className)}>
          {severity.label}
        </Badge>
        <span className="text-xs font-medium truncate flex-1">{issue.title}</span>
        {issue.estimatedImpact && (
          <span className={cn('text-[9px] uppercase font-medium', {
            'text-red-400': issue.estimatedImpact === 'high',
            'text-yellow-400': issue.estimatedImpact === 'medium',
            'text-muted-foreground': issue.estimatedImpact === 'low',
          })}>{issue.estimatedImpact}</span>
        )}
        <Badge variant="secondary" className="text-[9px] leading-none px-1 py-0">
          {issue.type}
        </Badge>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="px-3 pb-2 space-y-1.5 border-t border-border/50">
          {/* Meta + description in one line */}
          <div className="flex items-center gap-2 pt-1.5 text-[11px] text-muted-foreground flex-wrap">
            <span><strong>{issue.affectedTable}</strong></span>
            {issue.affectedColumns && (
              <span className="text-muted-foreground/70">{issue.affectedColumns.join(', ')}</span>
            )}
            {issue.description && <span>— {issue.description}</span>}
            {issue.suggestion && !issue.description && <span className="italic">— {issue.suggestion}</span>}
          </div>

          {/* Fix SQL — compact */}
          {issue.fixSQL && (
            <pre className="text-[11px] leading-tight font-mono bg-muted/40 px-2 py-1.5 rounded overflow-x-auto whitespace-pre-wrap">
              {issue.fixSQL}
            </pre>
          )}

          {/* Actions — inline, tight */}
          <div className="flex items-center gap-1.5">
            {issue.fixSQL && (
              <>
                <Button
                  size="sm"
                  onClick={() => onApplyFix(issue)}
                  disabled={isApplying}
                  className="h-6 text-[11px] px-2"
                >
                  {isApplying ? (
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  ) : (
                    <Check className="h-3 w-3 mr-1" />
                  )}
                  Apply
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopy}
                  className="h-6 text-[11px] px-2"
                >
                  {copied ? (
                    <Check className="h-3 w-3 mr-1 text-green-500" />
                  ) : (
                    <Copy className="h-3 w-3 mr-1" />
                  )}
                  Copy
                </Button>
              </>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDismiss(issue.id)}
              className="h-6 text-[11px] px-2 ml-auto"
            >
              <X className="h-3 w-3 mr-1" />
              Dismiss
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
