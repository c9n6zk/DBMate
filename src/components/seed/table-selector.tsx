'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import type { Table } from '@/lib/types';

export interface TableSeedConfig {
  tableName: string;
  enabled: boolean;
  rowCount: number;
}

interface TableSelectorProps {
  tables: Table[];
  configs: TableSeedConfig[];
  onChange: (configs: TableSeedConfig[]) => void;
}

export function TableSelector({
  tables,
  configs,
  onChange,
}: TableSelectorProps) {
  const updateConfig = (tableName: string, patch: Partial<TableSeedConfig>) => {
    onChange(
      configs.map((c) =>
        c.tableName === tableName ? { ...c, ...patch } : c
      )
    );
  };

  const allEnabled = configs.every((c) => c.enabled);
  const noneEnabled = configs.every((c) => !c.enabled);

  const toggleAll = (enabled: boolean) => {
    onChange(configs.map((c) => ({ ...c, enabled })));
  };

  const [bulkRows, setBulkRows] = useState(configs[0]?.rowCount ?? 50);

  const setAllRows = (rowCount: number) => {
    setBulkRows(rowCount);
    onChange(configs.map((c) => ({ ...c, rowCount })));
  };

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">Tables to seed</Label>

      {/* Bulk controls */}
      <div className="flex items-center gap-3 px-3 py-2 rounded-md border border-dashed bg-muted/50">
        <Switch
          checked={allEnabled}
          onCheckedChange={(checked) => toggleAll(!!checked)}
        />
        <span className="text-xs font-medium text-muted-foreground flex-1">
          {allEnabled ? 'Deselect all' : noneEnabled ? 'Select all' : 'Toggle all'}
        </span>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">All rows:</span>
          <Input
            type="number"
            min={1}
            max={1000}
            value={bulkRows}
            onChange={(e) => {
              const val = Math.max(1, Math.min(1000, parseInt(e.target.value) || 1));
              setAllRows(val);
            }}
            className="w-20 h-7 text-xs"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        {tables.map((table) => {
          const config = configs.find((c) => c.tableName === table.name);
          if (!config) return null;

          return (
            <div
              key={table.name}
              className="flex items-center gap-3 px-3 py-2 rounded-md border bg-card"
            >
              <Switch
                checked={config.enabled}
                onCheckedChange={(checked) =>
                  updateConfig(table.name, { enabled: !!checked })
                }
              />
              <span className="text-sm font-medium flex-1 font-mono">
                {table.name}
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Rows:</span>
                <Input
                  type="number"
                  min={1}
                  max={1000}
                  value={config.rowCount}
                  onChange={(e) =>
                    updateConfig(table.name, {
                      rowCount: Math.max(
                        1,
                        Math.min(1000, parseInt(e.target.value) || 1)
                      ),
                    })
                  }
                  disabled={!config.enabled}
                  className="w-20 h-7 text-xs"
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
