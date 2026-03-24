'use client';

import { Check, Clock, FileText } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { Migration } from '@/lib/types';

interface MigrationListProps {
  migrations: Migration[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function MigrationList({
  migrations,
  selectedId,
  onSelect,
}: MigrationListProps) {
  if (migrations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <FileText className="h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">No migrations yet.</p>
        <p className="text-xs text-muted-foreground mt-1">
          Generate one using the form below.
        </p>
      </div>
    );
  }

  // Sort: pending first, then by version descending
  const sorted = [...migrations].sort((a, b) => {
    const aApplied = !!a.appliedAt;
    const bApplied = !!b.appliedAt;
    if (aApplied !== bApplied) return aApplied ? 1 : -1;
    return b.version.localeCompare(a.version);
  });

  return (
    <ScrollArea className="h-full">
      <div className="space-y-1.5 p-1">
        {sorted.map((m) => {
          const isApplied = !!m.appliedAt;
          const isSelected = m.id === selectedId;

          return (
            <button
              key={m.id}
              onClick={() => onSelect(m.id)}
              className={cn(
                'w-full text-left rounded-md px-3 py-2 transition-colors',
                isSelected
                  ? 'bg-primary/10 border border-primary/20'
                  : 'hover:bg-muted/50 border border-transparent'
              )}
            >
              <div className="flex items-center gap-2">
                {isApplied ? (
                  <Check className="h-3.5 w-3.5 text-green-500 shrink-0" />
                ) : (
                  <Clock className="h-3.5 w-3.5 text-yellow-500 shrink-0" />
                )}
                <Badge
                  variant="outline"
                  className="text-[10px] px-1.5 py-0 font-mono"
                >
                  {m.version}
                </Badge>
                <span className="text-sm font-medium truncate flex-1">
                  {m.name}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1 truncate pl-5.5">
                {m.description}
              </p>
            </button>
          );
        })}
      </div>
    </ScrollArea>
  );
}
