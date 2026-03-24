'use client';

import { cn } from '@/lib/utils';
import type { Migration } from '@/lib/types';

interface SchemaTimelineProps {
  migrations: Migration[];
  onSelect: (id: string) => void;
  selectedId: string | null;
}

export function SchemaTimeline({
  migrations,
  onSelect,
  selectedId,
}: SchemaTimelineProps) {
  if (migrations.length === 0) return null;

  const sorted = [...migrations].sort((a, b) =>
    a.version.localeCompare(b.version)
  );

  return (
    <div className="w-full overflow-x-auto">
      <div className="flex items-center min-w-max px-4 py-3">
        {sorted.map((m, i) => {
          const isApplied = !!m.appliedAt;
          const isSelected = m.id === selectedId;
          const isLast = i === sorted.length - 1;

          return (
            <div key={m.id} className="flex items-center">
              {/* Node */}
              <button
                onClick={() => onSelect(m.id)}
                className="flex flex-col items-center gap-1.5 group"
              >
                <div
                  className={cn(
                    'w-4 h-4 rounded-full border-2 transition-all',
                    isApplied
                      ? 'bg-primary border-primary'
                      : 'bg-background border-muted-foreground/40',
                    isSelected && 'ring-2 ring-primary/30 ring-offset-2 ring-offset-background'
                  )}
                />
                <div className="text-center max-w-20">
                  <p
                    className={cn(
                      'text-[10px] font-mono font-bold',
                      isSelected ? 'text-primary' : 'text-muted-foreground'
                    )}
                  >
                    {m.version}
                  </p>
                  <p className="text-[10px] text-muted-foreground truncate group-hover:text-foreground transition-colors">
                    {m.name}
                  </p>
                </div>
              </button>

              {/* Connector line */}
              {!isLast && (
                <div
                  className={cn(
                    'h-0.5 w-16 mx-1 mt-[-1.5rem]',
                    isApplied && sorted[i + 1]?.appliedAt
                      ? 'bg-primary'
                      : 'bg-muted-foreground/20 border-t border-dashed border-muted-foreground/30 h-0'
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
