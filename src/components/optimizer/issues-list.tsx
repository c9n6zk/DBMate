'use client';

import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { IssueCard } from './issue-card';
import { Search, ChevronsDownUp, ChevronsUpDown, Wrench } from 'lucide-react';
import type { AnalysisIssue } from '@/lib/types';

interface IssuesListProps {
  issues: AnalysisIssue[];
  onApplyFix: (issue: AnalysisIssue) => void;
  onApplyAll?: () => void;
  isApplying: boolean;
}

const SEVERITY_ORDER = ['critical', 'warning', 'info', 'success'] as const;

type FilterType = 'all' | 'performance' | 'security' | 'normalization' | 'convention';

export function IssuesList({ issues, onApplyFix, onApplyAll, isApplying }: IssuesListProps) {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<FilterType>('all');
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [allExpanded, setAllExpanded] = useState<boolean | undefined>(undefined);

  const filteredIssues = useMemo(() => {
    return issues
      .filter((i) => !dismissedIds.has(i.id))
      .filter((i) => typeFilter === 'all' || i.type === typeFilter)
      .filter(
        (i) =>
          !search ||
          i.title.toLowerCase().includes(search.toLowerCase()) ||
          i.affectedTable.toLowerCase().includes(search.toLowerCase())
      )
      .sort(
        (a, b) =>
          SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity)
      );
  }, [issues, search, typeFilter, dismissedIds]);

  const typeCounts = useMemo(() => {
    const active = issues.filter((i) => !dismissedIds.has(i.id));
    return {
      all: active.length,
      performance: active.filter((i) => i.type === 'performance').length,
      security: active.filter((i) => i.type === 'security').length,
      normalization: active.filter((i) => i.type === 'normalization').length,
      convention: active.filter((i) => i.type === 'convention').length,
    };
  }, [issues, dismissedIds]);

  const handleDismiss = (id: string) => {
    setDismissedIds((prev) => new Set([...prev, id]));
  };

  const fixableIssues = filteredIssues.filter((i) => i.fixSQL);

  const handleApplyAll = () => {
    if (onApplyAll) {
      onApplyAll();
    } else {
      for (const issue of fixableIssues) {
        onApplyFix(issue);
      }
    }
  };

  const filterButtons: { key: FilterType; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'performance', label: 'Performance' },
    { key: 'security', label: 'Security' },
    { key: 'normalization', label: 'Normalization' },
    { key: 'convention', label: 'Convention' },
  ];

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        {filterButtons.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTypeFilter(key)}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              typeFilter === key
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            {label}
            <Badge variant="secondary" className="text-[10px] px-1 py-0 ml-0.5">
              {typeCounts[key]}
            </Badge>
          </button>
        ))}
        <div className="relative ml-auto">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search issues..."
            className="h-8 w-48 pl-7 text-xs"
          />
        </div>
      </div>

      {/* Bulk actions */}
      {filteredIssues.length > 0 && (
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => { setAllExpanded((prev) => prev === true ? false : true); }}
          >
            {allExpanded ? (
              <><ChevronsDownUp className="h-3 w-3 mr-1" /> Collapse All</>
            ) : (
              <><ChevronsUpDown className="h-3 w-3 mr-1" /> Expand All</>
            )}
          </Button>
          {fixableIssues.length > 0 && (
            <Button
              size="sm"
              className="h-7 text-xs"
              onClick={handleApplyAll}
              disabled={isApplying}
            >
              <Wrench className="h-3 w-3 mr-1" />
              Apply All Fixes ({fixableIssues.length})
            </Button>
          )}
        </div>
      )}

      {/* Issues */}
      {filteredIssues.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          {issues.length === 0
            ? 'No issues found. Run analysis first.'
            : 'No matching issues.'}
        </p>
      ) : (
        <div className="space-y-1">
          {filteredIssues.map((issue) => (
            <IssueCard
              key={issue.id}
              issue={issue}
              onApplyFix={onApplyFix}
              onDismiss={handleDismiss}
              isApplying={isApplying}
              forceExpanded={allExpanded}
            />
          ))}
        </div>
      )}
    </div>
  );
}
