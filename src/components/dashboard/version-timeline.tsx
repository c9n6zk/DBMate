'use client';

import { useState, useEffect } from 'react';
import { useSchemaStore } from '@/stores/schema-store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { History, RotateCcw, GitCommit, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { VersionSummary, Schema } from '@/lib/types';
import * as Diff from 'diff';

export function VersionTimeline() {
  const versions = useSchemaStore((s) => s.versions);
  const activeSchemaId = useSchemaStore((s) => s.activeSchemaId);
  const fetchVersions = useSchemaStore((s) => s.fetchVersions);
  const restoreVersion = useSchemaStore((s) => s.restoreVersion);
  const saveVersion = useSchemaStore((s) => s.saveVersion);
  const currentSchema = useSchemaStore((s) => s.currentSchema);
  const isDirty = useSchemaStore((s) => s.isDirty);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [diffData, setDiffData] = useState<Diff.Change[] | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (activeSchemaId) fetchVersions();
  }, [activeSchemaId, fetchVersions]);

  const handleToggleDiff = async (version: VersionSummary) => {
    if (expandedId === version.id) {
      setExpandedId(null);
      setDiffData(null);
      return;
    }

    setExpandedId(version.id);
    setDiffLoading(true);

    try {
      // Load this version's schema
      const res = await fetch(
        `/api/schemas/${version.schemaId}/versions/${version.id}`
      );
      if (!res.ok) throw new Error('Failed to load version');
      const data = await res.json();
      const versionSchema: Schema = data.schema;

      // Diff against current schema
      const currentSQL = currentSchema?.rawSQL ?? '';
      const versionSQL = versionSchema.rawSQL ?? '';
      const changes = Diff.diffLines(versionSQL, currentSQL);
      setDiffData(changes);
    } catch {
      toast.error('Failed to load diff');
      setDiffData(null);
    } finally {
      setDiffLoading(false);
    }
  };

  const handleRestore = async (version: VersionSummary) => {
    const confirm = window.confirm(
      `Restore to version ${version.versionNumber}? This will create a new version with the restored content.`
    );
    if (!confirm) return;

    setRestoring(version.id);
    try {
      await restoreVersion(version.id);
      toast.success(`Restored to version ${version.versionNumber}`);
    } catch {
      toast.error('Failed to restore version');
    } finally {
      setRestoring(null);
    }
  };

  const handleManualSave = async () => {
    setSaving(true);
    try {
      await useSchemaStore.getState().saveCurrentSchema();
      await saveVersion('Manual save');
      toast.success('Version saved');
    } catch {
      toast.error('Failed to save version');
    } finally {
      setSaving(false);
    }
  };

  if (!activeSchemaId) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
        <History className="h-8 w-8" />
        <p className="text-sm">No schema loaded</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">
            Version History
          </span>
          <Badge variant="secondary" className="text-xs">
            {versions.length}
          </Badge>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleManualSave}
          disabled={!isDirty || saving}
          className="h-7 text-xs"
        >
          {saving ? (
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          ) : (
            <GitCommit className="h-3 w-3 mr-1" />
          )}
          Save Version
        </Button>
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto">
        {versions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
            <History className="h-6 w-6" />
            <p className="text-xs">No versions yet</p>
            <p className="text-xs text-muted-foreground/60">
              Import a schema or save changes to create the first version.
            </p>
          </div>
        ) : (
          <div className="relative px-4 py-3">
            {/* Timeline line */}
            <div className="absolute left-[1.65rem] top-6 bottom-6 w-px bg-border" />

            <div className="flex flex-col gap-1">
              {versions.map((version, idx) => (
                <div key={version.id} className="relative flex gap-3">
                  {/* Timeline dot */}
                  <div
                    className={cn(
                      'relative z-10 mt-1.5 h-2.5 w-2.5 rounded-full border-2 shrink-0',
                      idx === 0
                        ? 'border-primary bg-primary'
                        : 'border-muted-foreground/30 bg-background'
                    )}
                  />

                  {/* Content */}
                  <div className="flex-1 min-w-0 pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <Badge
                            variant={idx === 0 ? 'default' : 'outline'}
                            className="text-[10px] px-1.5 py-0 h-4 shrink-0"
                          >
                            v{version.versionNumber}
                          </Badge>
                          <span className="text-xs font-medium truncate">
                            {version.changeDescription}
                          </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {formatTimestamp(version.createdAt)}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleDiff(version)}
                          className="h-6 w-6 p-0"
                          title={expandedId === version.id ? 'Hide diff' : 'Show diff vs current'}
                        >
                          {expandedId === version.id ? (
                            <ChevronUp className="h-3 w-3" />
                          ) : (
                            <ChevronDown className="h-3 w-3" />
                          )}
                        </Button>
                        {idx > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRestore(version)}
                            disabled={restoring === version.id}
                            className="h-6 w-6 p-0"
                            title="Restore this version"
                          >
                            {restoring === version.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <RotateCcw className="h-3 w-3" />
                            )}
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Diff panel */}
                    {expandedId === version.id && (
                      <div className="mt-2 rounded-md border bg-muted/30 overflow-hidden">
                        {diffLoading ? (
                          <div className="flex items-center justify-center py-4">
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          </div>
                        ) : diffData ? (
                          <div className="max-h-[300px] overflow-auto text-[11px] font-mono leading-relaxed">
                            {diffData.map((part, i) => (
                              <div
                                key={i}
                                className={cn(
                                  'px-2 whitespace-pre-wrap',
                                  part.added && 'bg-green-500/10 text-green-700 dark:text-green-400',
                                  part.removed && 'bg-red-500/10 text-red-700 dark:text-red-400',
                                  !part.added && !part.removed && 'text-muted-foreground'
                                )}
                              >
                                {part.value
                                  .split('\n')
                                  .filter((line, li, arr) => li < arr.length - 1 || line !== '')
                                  .map((line, li) => (
                                    <div key={li}>
                                      <span className="select-none opacity-50 mr-2">
                                        {part.added ? '+' : part.removed ? '-' : ' '}
                                      </span>
                                      {line}
                                    </div>
                                  ))}
                              </div>
                            ))}
                            {diffData.every((p) => !p.added && !p.removed) && (
                              <div className="px-2 py-2 text-muted-foreground text-center">
                                No differences — this version matches current schema.
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="px-2 py-2 text-muted-foreground text-center text-xs">
                            Failed to load diff.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function formatTimestamp(iso: string): string {
  try {
    const date = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);

    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 7) return `${diffDay}d ago`;

    return date.toLocaleDateString('hu-HU', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}
