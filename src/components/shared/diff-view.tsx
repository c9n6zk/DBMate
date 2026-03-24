'use client';

import { memo, useMemo, useState } from 'react';
import { diffLines, type Change } from 'diff';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Columns2, Rows3 } from 'lucide-react';

interface DiffViewProps {
  original: string;
  modified: string;
  originalTitle?: string;
  modifiedTitle?: string;
  className?: string;
}

function DiffViewComponent({
  original,
  modified,
  originalTitle = 'Original',
  modifiedTitle = 'Modified',
  className,
}: DiffViewProps) {
  const [mode, setMode] = useState<'inline' | 'side-by-side'>('inline');

  const changes = useMemo(() => diffLines(original, modified), [original, modified]);

  const stats = useMemo(() => {
    let added = 0;
    let removed = 0;
    for (const c of changes) {
      if (c.added) added += c.count ?? 0;
      if (c.removed) removed += c.count ?? 0;
    }
    return { added, removed };
  }, [changes]);

  return (
    <div className={cn('rounded-md border bg-card overflow-hidden', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
        <div className="flex items-center gap-3 text-xs">
          <span className="text-green-600 font-medium">+{stats.added}</span>
          <span className="text-red-500 font-medium">-{stats.removed}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant={mode === 'inline' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setMode('inline')}
            className="h-6 px-2 text-xs"
          >
            <Rows3 className="h-3 w-3 mr-1" />
            Inline
          </Button>
          <Button
            variant={mode === 'side-by-side' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setMode('side-by-side')}
            className="h-6 px-2 text-xs"
          >
            <Columns2 className="h-3 w-3 mr-1" />
            Side by side
          </Button>
        </div>
      </div>

      {mode === 'inline' ? (
        <InlineDiff changes={changes} />
      ) : (
        <SideBySideDiff
          changes={changes}
          originalTitle={originalTitle}
          modifiedTitle={modifiedTitle}
        />
      )}
    </div>
  );
}

function InlineDiff({ changes }: { changes: Change[] }) {
  return (
    <div className="max-h-96 overflow-auto">
      <pre className="text-xs font-mono p-0">
        {changes.map((change, i) => {
          const lines = change.value.split('\n');
          if (lines[lines.length - 1] === '') lines.pop();

          return lines.map((line, j) => (
            <div
              key={`${i}-${j}`}
              className={cn(
                'px-3 py-0.5 min-h-[1.25rem]',
                change.added && 'bg-green-500/10 text-green-700 dark:text-green-400',
                change.removed && 'bg-red-500/10 text-red-700 dark:text-red-400'
              )}
            >
              <span className="inline-block w-4 text-muted-foreground select-none">
                {change.added ? '+' : change.removed ? '-' : ' '}
              </span>
              {line}
            </div>
          ));
        })}
      </pre>
    </div>
  );
}

function SideBySideDiff({
  changes,
  originalTitle,
  modifiedTitle,
}: {
  changes: Change[];
  originalTitle: string;
  modifiedTitle: string;
}) {
  const leftLines: { text: string; type: 'removed' | 'unchanged' | 'empty' }[] = [];
  const rightLines: { text: string; type: 'added' | 'unchanged' | 'empty' }[] = [];

  for (const change of changes) {
    const lines = change.value.split('\n');
    if (lines[lines.length - 1] === '') lines.pop();

    if (change.removed) {
      for (const line of lines) {
        leftLines.push({ text: line, type: 'removed' });
        rightLines.push({ text: '', type: 'empty' });
      }
    } else if (change.added) {
      for (const line of lines) {
        leftLines.push({ text: '', type: 'empty' });
        rightLines.push({ text: line, type: 'added' });
      }
    } else {
      for (const line of lines) {
        leftLines.push({ text: line, type: 'unchanged' });
        rightLines.push({ text: line, type: 'unchanged' });
      }
    }
  }

  return (
    <div className="max-h-96 overflow-auto">
      <div className="grid grid-cols-2 divide-x">
        <div>
          <div className="px-3 py-1 text-[10px] font-medium text-muted-foreground bg-muted/20 border-b sticky top-0">
            {originalTitle}
          </div>
          <pre className="text-xs font-mono">
            {leftLines.map((line, i) => (
              <div
                key={i}
                className={cn(
                  'px-3 py-0.5 min-h-[1.25rem]',
                  line.type === 'removed' && 'bg-red-500/10 text-red-700 dark:text-red-400',
                  line.type === 'empty' && 'bg-muted/20'
                )}
              >
                {line.text}
              </div>
            ))}
          </pre>
        </div>
        <div>
          <div className="px-3 py-1 text-[10px] font-medium text-muted-foreground bg-muted/20 border-b sticky top-0">
            {modifiedTitle}
          </div>
          <pre className="text-xs font-mono">
            {rightLines.map((line, i) => (
              <div
                key={i}
                className={cn(
                  'px-3 py-0.5 min-h-[1.25rem]',
                  line.type === 'added' && 'bg-green-500/10 text-green-700 dark:text-green-400',
                  line.type === 'empty' && 'bg-muted/20'
                )}
              >
                {line.text}
              </div>
            ))}
          </pre>
        </div>
      </div>
    </div>
  );
}

export const DiffView = memo(DiffViewComponent);
