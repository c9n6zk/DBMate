'use client';

import { useEffect } from 'react';
import { useSchemaStore } from '@/stores/schema-store';

/**
 * Hook that:
 * 1. Warns before page unload when there are unsaved changes
 * 2. Handles Ctrl+S to save the current schema
 * 3. Fetches schema list on mount and auto-loads the last active schema
 */
export function useDirtyGuard() {
  const isDirty = useSchemaStore((s) => s.isDirty);
  const saveCurrentSchema = useSchemaStore((s) => s.saveCurrentSchema);

  // beforeunload warning
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  // Ctrl+S save shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        const { isDirty: dirty, activeSchemaId } = useSchemaStore.getState();
        if (dirty && activeSchemaId) {
          saveCurrentSchema().then(() => {
            useSchemaStore.getState().saveVersion('Manual save');
          });
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [saveCurrentSchema]);
}

/**
 * Migrate legacy localStorage data (pre-SQLite era) into the SQLite backend.
 * Old format stored full `currentSchema` in Zustand persisted state.
 * New format only caches `activeSchemaId`; SQLite is the source of truth.
 */
async function migrateLegacyLocalStorage(
  schemaList: { id: string }[],
  loadSchema: (id: string) => Promise<void>
) {
  const STORAGE_KEY = 'dbmate-schema';
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    const stored = JSON.parse(raw);
    const legacySchema = stored?.state?.currentSchema;
    if (!legacySchema?.id || !legacySchema?.rawSQL) return;

    // Legacy data detected — currentSchema shouldn't be in persisted state
    console.info('[migrateLegacyLocalStorage] Found legacy schema in localStorage:', legacySchema.id);

    const existsInDb = schemaList.some((s) => s.id === legacySchema.id);

    if (existsInDb) {
      // Schema already in SQLite (from /api/parse), just load it
      await loadSchema(legacySchema.id);
    } else {
      // Re-import via /api/parse to persist into SQLite
      const res = await fetch('/api/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sql: legacySchema.rawSQL,
          dialect: legacySchema.dialect ?? 'mysql',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        await useSchemaStore.getState().fetchSchemaList();
        await loadSchema(data.schema.id);
        console.info('[migrateLegacyLocalStorage] Re-imported legacy schema as:', data.schema.id);
      }
    }

    // Clean up: overwrite with new format (only activeSchemaId)
    const { activeSchemaId } = useSchemaStore.getState();
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ state: { activeSchemaId }, version: 0 })
    );
    console.info('[migrateLegacyLocalStorage] Migration complete, localStorage cleaned up');
  } catch (err) {
    console.error('[migrateLegacyLocalStorage] Migration failed (non-critical):', err);
  }
}

/**
 * Hook to initialize schema list on mount and auto-load last active schema.
 * Also migrates legacy localStorage data if found.
 * Call this once in the root layout.
 */
export function useSchemaInit() {
  const fetchSchemaList = useSchemaStore((s) => s.fetchSchemaList);
  const loadSchema = useSchemaStore((s) => s.loadSchema);

  useEffect(() => {
    async function init() {
      await fetchSchemaList();
      const { activeSchemaId, currentSchema, schemaList } =
        useSchemaStore.getState();

      // Migrate legacy localStorage data (one-time, if found)
      await migrateLegacyLocalStorage(schemaList, loadSchema);

      // If we have a cached activeSchemaId but no loaded schema, load it
      const freshState = useSchemaStore.getState();
      if (freshState.activeSchemaId && !freshState.currentSchema) {
        const exists = freshState.schemaList.some((s) => s.id === freshState.activeSchemaId);
        if (exists) {
          await loadSchema(freshState.activeSchemaId);
        }
      }
    }
    init();
  }, [fetchSchemaList, loadSchema]);
}
