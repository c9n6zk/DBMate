'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Sprout } from 'lucide-react';
import { PageTransition } from '@/components/shared/motion';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useSchemaStore } from '@/stores/schema-store';
import { useSettingsStore } from '@/stores/settings-store';
import {
  TableSelector,
  type TableSeedConfig,
} from '@/components/seed/table-selector';
import { SeedPreview } from '@/components/seed/seed-preview';
import { toast } from 'sonner';
import type { SeedResult } from '@/lib/types';

export default function SeedPage() {
  const router = useRouter();
  const { currentSchema } = useSchemaStore();
  const { settings } = useSettingsStore();

  const [locale, setLocale] = useState(settings.seedLocale);
  const [respectFK, setRespectFK] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  // Seeds result
  const [seeds, setSeeds] = useState<SeedResult[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [insertOrder, setInsertOrder] = useState<string[]>([]);

  // Table configs
  const initialConfigs = useMemo((): TableSeedConfig[] => {
    if (!currentSchema) return [];
    return currentSchema.tables.map((t) => ({
      tableName: t.name,
      enabled: true,
      rowCount: settings.seedDefaultRows,
    }));
  }, [currentSchema, settings.seedDefaultRows]);

  const [tableConfigs, setTableConfigs] =
    useState<TableSeedConfig[]>(initialConfigs);

  const enabledTables = tableConfigs.filter((c) => c.enabled);

  const handleGenerate = useCallback(async () => {
    if (!currentSchema || enabledTables.length === 0) return;
    setIsGenerating(true);
    setSeeds([]);
    try {
      const res = await fetch('/api/seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schema: currentSchema,
          config: {
            tables: enabledTables.map((c) => ({
              tableName: c.tableName,
              rowCount: c.rowCount,
            })),
            locale,
            respectFK,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to generate seed data');
        return;
      }

      setSeeds(data.seeds);
      setTotalRows(data.totalRows);
      setInsertOrder(data.insertOrder);
      toast.success(`Seed data generated: ${data.totalRows} total rows`);
    } catch {
      toast.error('Failed to generate seed data');
    } finally {
      setIsGenerating(false);
    }
  }, [currentSchema, enabledTables, locale, respectFK]);

  // No schema loaded
  if (!currentSchema) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
        <Sprout className="h-12 w-12 text-muted-foreground" />
        <h2 className="text-2xl font-semibold">Seed Data Generator</h2>
        <p className="text-muted-foreground max-w-md">
          Import a schema first to generate test data.
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
    <div className="max-w-4xl mx-auto space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Sprout className="h-5 w-5 text-primary" />
        <h2 className="text-xl font-semibold">Seed Data Generator</h2>
        <span className="text-sm text-muted-foreground">
          {currentSchema.name}
        </span>
      </div>

      {/* Configuration */}
      <Card className="p-4 space-y-4">
        {/* Table selector */}
        <TableSelector
          tables={currentSchema.tables}
          configs={tableConfigs}
          onChange={setTableConfigs}
        />

        <Separator />

        {/* Options */}
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Locale:</Label>
            <Select value={locale} onValueChange={(v) => v && setLocale(v)}>
              <SelectTrigger size="sm" className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hu">Magyar (hu)</SelectItem>
                <SelectItem value="en">English (en)</SelectItem>
                <SelectItem value="de">Deutsch (de)</SelectItem>
                <SelectItem value="fr">Français (fr)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Switch
              checked={respectFK}
              onCheckedChange={(checked) => setRespectFK(!!checked)}
              size="sm"
            />
            <Label className="text-xs text-muted-foreground">
              Respect FK constraints
            </Label>
          </div>
        </div>

        {/* Generate button */}
        <div className="flex justify-center">
          <Button
            onClick={handleGenerate}
            disabled={isGenerating || enabledTables.length === 0}
            className="w-full max-w-md"
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Sprout className="h-4 w-4 mr-2" />
            )}
            {isGenerating
              ? 'Generating...'
              : `Generate Seed Data (${enabledTables.length} table${enabledTables.length !== 1 ? 's' : ''})`}
          </Button>
        </div>
      </Card>

      {/* Preview */}
      {seeds.length > 0 && (
        <Card className="p-4">
          <SeedPreview
            seeds={seeds}
            totalRows={totalRows}
            insertOrder={insertOrder}
          />
        </Card>
      )}
    </div>
    </PageTransition>
  );
}
