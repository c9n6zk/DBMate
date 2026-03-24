'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, GitBranch, GitCompare, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Card } from '@/components/ui/card';
import { useSchemaStore } from '@/stores/schema-store';
import { MigrationList } from '@/components/migrations/migration-list';
import { MigrationDetail } from '@/components/migrations/migration-detail';
import { SchemaTimeline } from '@/components/migrations/schema-timeline';
import { MigrationGenerator } from '@/components/migrations/migration-generator';
import { toast } from 'sonner';
import type { Migration, MigrationFormat } from '@/lib/types';
import { PageTransition } from '@/components/shared/motion';

export default function MigrationsPage() {
  const router = useRouter();
  const { currentSchema, originalSchema } = useSchemaStore();
  const [migrations, setMigrations] = useState<Migration[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  const selectedMigration = migrations.find((m) => m.id === selectedId) ?? null;

  // Load migrations from SQLite
  const loadMigrations = useCallback(async () => {
    if (!currentSchema) return;
    setIsLoading(true);
    try {
      const res = await fetch(
        `/api/migrate?schemaId=${encodeURIComponent(currentSchema.id)}`
      );
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || 'Failed to load migrations');
        return;
      }
      const data = await res.json();
      setMigrations(data.migrations ?? []);
    } catch {
      toast.error('Failed to load migrations');
    } finally {
      setIsLoading(false);
    }
  }, [currentSchema]);

  useEffect(() => {
    loadMigrations();
  }, [loadMigrations]);

  // Generate next version string
  const getNextVersion = useCallback(() => {
    if (migrations.length === 0) return 'V001';
    const maxNum = migrations.reduce((max, m) => {
      const num = parseInt(m.version.replace(/\D/g, ''), 10);
      return isNaN(num) ? max : Math.max(max, num);
    }, 0);
    return `V${String(maxNum + 1).padStart(3, '0')}`;
  }, [migrations]);

  const hasDiff = originalSchema && currentSchema && originalSchema.rawSQL !== currentSchema.rawSQL;

  // Generate migration
  const handleGenerate = useCallback(
    async (change: string) => {
      if (!currentSchema) return;
      setIsGenerating(true);
      try {
        const res = await fetch('/api/migrate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            schema: currentSchema,
            schemaId: currentSchema.id,
            change,
            dialect: currentSchema.dialect,
            format: 'raw' as MigrationFormat,
            nextVersion: getNextVersion(),
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          toast.error(data.error || 'Failed to generate migration');
          return;
        }

        setMigrations((prev) => [...prev, data.migration]);
        setSelectedId(data.migration.id);
        toast.success(`Migration ${data.migration.version} generated`);
      } catch {
        toast.error('Failed to generate migration');
      } finally {
        setIsGenerating(false);
      }
    },
    [currentSchema, getNextVersion]
  );

  // Generate from diff — describes all changes between original and current schema
  const handleGenerateFromDiff = useCallback(async () => {
    if (!originalSchema || !currentSchema) return;
    const change = `Generate migration for all changes between the original and current schema. Original SQL:\n${originalSchema.rawSQL}\n\nCurrent SQL:\n${currentSchema.rawSQL}`;
    await handleGenerate(change);
  }, [originalSchema, currentSchema, handleGenerate]);

  // Apply migration — marks as applied and appends UP SQL to schema history
  const handleApply = useCallback(
    async (id: string) => {
      const migration = migrations.find((m) => m.id === id);
      if (!migration || !currentSchema) return;
      setIsApplying(true);
      try {
        const appliedAt = new Date().toISOString();

        // Update appliedAt in DB
        await fetch(`/api/migrate/apply`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: migration.id, appliedAt }),
        });

        // Append migration SQL to schema's rawSQL for history tracking
        const updatedRawSQL =
          currentSchema.rawSQL +
          '\n\n-- Migration ' + migration.version + ': ' + migration.name +
          '\n' + migration.upSQL;

        useSchemaStore.getState().setSchema({
          ...currentSchema,
          rawSQL: updatedRawSQL,
          updatedAt: appliedAt,
        });

        setMigrations((prev) =>
          prev.map((m) =>
            m.id === id ? { ...m, appliedAt } : m
          )
        );
        toast.success(`Migration ${migration.version} applied`);
      } catch {
        toast.error('Failed to apply migration');
      } finally {
        setIsApplying(false);
      }
    },
    [migrations, currentSchema]
  );

  // Rollback migration
  const handleRollback = useCallback(
    async (id: string) => {
      const migration = migrations.find((m) => m.id === id);
      if (!migration) return;
      setIsApplying(true);
      try {
        setMigrations((prev) =>
          prev.map((m) =>
            m.id === id ? { ...m, appliedAt: undefined } : m
          )
        );
        toast.success(`Migration ${migration.version} rolled back`);
      } finally {
        setIsApplying(false);
      }
    },
    [migrations]
  );

  // Delete migration
  const handleDelete = useCallback(
    (id: string) => {
      const migration = migrations.find((m) => m.id === id);
      if (!migration) return;
      setMigrations((prev) => prev.filter((m) => m.id !== id));
      if (selectedId === id) setSelectedId(null);
      toast.success(`Migration ${migration.version} deleted`);
    },
    [migrations, selectedId]
  );

  // No schema loaded
  if (!currentSchema) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
        <GitBranch className="h-12 w-12 text-muted-foreground" />
        <h2 className="text-2xl font-semibold">Migrations</h2>
        <p className="text-muted-foreground max-w-md">
          Import a schema first to manage migrations.
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
    <div className="max-w-6xl mx-auto space-y-4 p-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <GitBranch className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">Migrations</h2>
          <span className="text-sm text-muted-foreground truncate">
            {currentSchema.name}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {hasDiff && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerateFromDiff}
              disabled={isGenerating}
              className="h-7 text-xs"
            >
              <GitCompare className="h-3 w-3 mr-1" />
              Generate from Diff
            </Button>
          )}
          <span className="text-xs text-muted-foreground">
            {migrations.length} migration{migrations.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Schema Timeline */}
      {migrations.length > 0 && (
        <Card className="p-2">
          <SchemaTimeline
            migrations={migrations}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </Card>
      )}

      <Separator />

      {/* Main content: list + detail */}
      <div className="flex flex-col md:flex-row gap-4 min-h-96">
        {/* Left: Migration List */}
        <div className="w-full md:w-72 shrink-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <MigrationList
              migrations={migrations}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          )}
        </div>

        {/* Right: Detail */}
        <div className="flex-1 min-w-0">
          {selectedMigration ? (
            <MigrationDetail
              migration={selectedMigration}
              onApply={handleApply}
              onRollback={handleRollback}
              onDelete={handleDelete}
              isApplying={isApplying}
            />
          ) : (
            <Card className="h-full flex items-center justify-center">
              <p className="text-sm text-muted-foreground">
                Select a migration to view details
              </p>
            </Card>
          )}
        </div>
      </div>

      <Separator />

      {/* AI Migration Generator */}
      <Card className="p-4">
        <MigrationGenerator
          onGenerate={handleGenerate}
          isGenerating={isGenerating}
          disabled={!currentSchema}
        />
      </Card>
    </div>
    </PageTransition>
  );
}
