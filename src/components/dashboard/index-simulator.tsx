'use client';

import { useState } from 'react';
import { Plus, X, ChevronUp, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Schema } from '@/lib/types';

interface HypotheticalIndex {
  table: string;
  columns: string[];
  unique: boolean;
}

interface RemovedIndex {
  table: string;
  indexName: string;
}

interface IndexSimulatorProps {
  schema: Schema;
  hypotheticalIndexes: HypotheticalIndex[];
  removedIndexes: RemovedIndex[];
  onHypotheticalChange: (indexes: HypotheticalIndex[]) => void;
  onRemovedChange: (indexes: RemovedIndex[]) => void;
}

export function IndexSimulator({
  schema,
  hypotheticalIndexes,
  removedIndexes,
  onHypotheticalChange,
  onRemovedChange,
}: IndexSimulatorProps) {
  const [expanded, setExpanded] = useState(false);
  const [addingNew, setAddingNew] = useState(false);
  const [newTable, setNewTable] = useState('');
  const [newColumns, setNewColumns] = useState<string[]>([]);
  const [newUnique, setNewUnique] = useState(false);

  // Gather all existing indexes from schema
  const existingIndexes = schema.tables.flatMap((t) =>
    t.indexes.map((idx) => ({
      table: t.name,
      indexName: idx.name,
      columns: idx.columns,
      unique: idx.unique,
    }))
  );

  const tables = schema.tables.map((t) => t.name);
  const selectedTableObj = schema.tables.find((t) => t.name === newTable);
  const availableColumns = selectedTableObj?.columns.map((c) => c.name) ?? [];

  const handleToggleRemoved = (table: string, indexName: string) => {
    const exists = removedIndexes.some((r) => r.table === table && r.indexName === indexName);
    if (exists) {
      onRemovedChange(removedIndexes.filter((r) => !(r.table === table && r.indexName === indexName)));
    } else {
      onRemovedChange([...removedIndexes, { table, indexName }]);
    }
  };

  const handleAddHypothetical = () => {
    if (!newTable || newColumns.length === 0) return;
    onHypotheticalChange([
      ...hypotheticalIndexes,
      { table: newTable, columns: [...newColumns], unique: newUnique },
    ]);
    setNewTable('');
    setNewColumns([]);
    setNewUnique(false);
    setAddingNew(false);
  };

  const handleRemoveHypothetical = (idx: number) => {
    onHypotheticalChange(hypotheticalIndexes.filter((_, i) => i !== idx));
  };

  const handleToggleColumn = (col: string) => {
    setNewColumns((prev) =>
      prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]
    );
  };

  const totalModifications = hypotheticalIndexes.length + removedIndexes.length;

  return (
    <div className="border-t bg-muted/20">
      {/* Header — toggle */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-muted/40 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium">Index Simulator</span>
          {totalModifications > 0 && (
            <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
              {totalModifications} change{totalModifications !== 1 ? 's' : ''}
            </Badge>
          )}
        </div>
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2 max-h-[250px] overflow-y-auto">
          {/* Existing indexes with disable toggle */}
          {existingIndexes.length > 0 && (
            <div className="space-y-1">
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                Existing Indexes
              </span>
              {existingIndexes.map((idx) => {
                const isRemoved = removedIndexes.some(
                  (r) => r.table === idx.table && r.indexName === idx.indexName
                );
                return (
                  <div
                    key={`${idx.table}.${idx.indexName}`}
                    className={cn(
                      'flex items-center gap-2 px-2 py-1 rounded text-xs',
                      isRemoved ? 'bg-red-500/10 line-through opacity-60' : 'bg-muted/50'
                    )}
                  >
                    <button
                      onClick={() => handleToggleRemoved(idx.table, idx.indexName)}
                      className={cn(
                        'w-3.5 h-3.5 rounded border shrink-0 transition-colors',
                        isRemoved
                          ? 'bg-red-500 border-red-500'
                          : 'border-muted-foreground/40 hover:border-red-500'
                      )}
                      title={isRemoved ? 'Re-enable index' : 'Disable index (what-if)'}
                    >
                      {isRemoved && <X className="h-2.5 w-2.5 text-white mx-auto" />}
                    </button>
                    <span className="text-muted-foreground">{idx.table}.</span>
                    <span className="font-medium truncate">{idx.indexName}</span>
                    <span className="text-muted-foreground/60 truncate">
                      ({idx.columns.join(', ')})
                    </span>
                    {idx.unique && (
                      <Badge variant="outline" className="text-[9px] h-3.5 px-1 shrink-0">
                        UQ
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Hypothetical indexes */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                Hypothetical Indexes
              </span>
              {!addingNew && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setAddingNew(true)}
                  className="h-5 px-1.5 text-[10px]"
                >
                  <Plus className="h-2.5 w-2.5 mr-0.5" />
                  Add
                </Button>
              )}
            </div>

            {hypotheticalIndexes.map((hypo, i) => (
              <div
                key={i}
                className="flex items-center gap-2 px-2 py-1 rounded text-xs bg-green-500/10"
              >
                <span className="text-green-600 dark:text-green-400 font-medium">+</span>
                <span className="text-muted-foreground">{hypo.table}.</span>
                <span className="font-medium truncate">
                  ({hypo.columns.join(', ')})
                </span>
                {hypo.unique && (
                  <Badge variant="outline" className="text-[9px] h-3.5 px-1 shrink-0 border-green-500/40 text-green-600">
                    UQ
                  </Badge>
                )}
                <button
                  onClick={() => handleRemoveHypothetical(i)}
                  className="ml-auto text-muted-foreground hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}

            {/* Add form */}
            {addingNew && (
              <div className="rounded-md border bg-muted/30 p-2 space-y-1.5">
                <div className="flex gap-1.5">
                  <select
                    value={newTable}
                    onChange={(e) => {
                      setNewTable(e.target.value);
                      setNewColumns([]);
                    }}
                    className="flex-1 h-6 text-xs rounded border bg-background px-1.5"
                  >
                    <option value="">Table...</option>
                    {tables.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                  <label className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={newUnique}
                      onChange={(e) => setNewUnique(e.target.checked)}
                      className="h-3 w-3"
                    />
                    Unique
                  </label>
                </div>

                {newTable && (
                  <div className="flex flex-wrap gap-1">
                    {availableColumns.map((col) => (
                      <button
                        key={col}
                        onClick={() => handleToggleColumn(col)}
                        className={cn(
                          'px-1.5 py-0.5 rounded text-[10px] border transition-colors',
                          newColumns.includes(col)
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-background border-border hover:border-primary/50'
                        )}
                      >
                        {col}
                        {newColumns.includes(col) && (
                          <span className="ml-0.5 text-[8px]">
                            {newColumns.indexOf(col) + 1}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    onClick={handleAddHypothetical}
                    disabled={!newTable || newColumns.length === 0}
                    className="h-5 px-2 text-[10px]"
                  >
                    Add Index
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setAddingNew(false);
                      setNewTable('');
                      setNewColumns([]);
                      setNewUnique(false);
                    }}
                    className="h-5 px-2 text-[10px]"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {hypotheticalIndexes.length === 0 && !addingNew && existingIndexes.length === 0 && (
              <p className="text-[10px] text-muted-foreground/60 py-1">
                No indexes in schema. Add hypothetical indexes to simulate performance.
              </p>
            )}
          </div>

          {/* Clear all button */}
          {totalModifications > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onHypotheticalChange([]);
                onRemovedChange([]);
              }}
              className="h-6 text-[10px] w-full"
            >
              Clear all what-if changes
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
