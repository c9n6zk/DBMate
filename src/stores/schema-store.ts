import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  Schema,
  SchemaListItem,
  SchemaHealthReport,
  Migration,
  Dialect,
  MigrationRequest,
  VersionSummary,
} from '@/lib/types';

interface SchemaStore {
  // Multi-project state
  schemaList: SchemaListItem[];
  activeSchemaId: string | null;
  isDirty: boolean;
  isSwitching: boolean;

  // Current schema state
  currentSchema: Schema | null;
  originalSchema: Schema | null;
  schemaVersions: Schema[];
  schemaVersionIndex: number;
  healthReport: SchemaHealthReport | null;
  appliedFixTitles: string[];
  migrations: Migration[];
  versions: VersionSummary[];

  // Async state
  isLoading: boolean;
  isAnalyzing: boolean;
  error: string | null;

  // Multi-project actions
  fetchSchemaList: () => Promise<void>;
  loadSchema: (id: string) => Promise<void>;
  saveCurrentSchema: () => Promise<void>;
  createSchema: (name: string, dialect: Dialect) => Promise<string>;
  deleteSchema: (id: string) => Promise<void>;
  renameSchema: (id: string, name: string) => Promise<void>;
  duplicateSchema: (id: string) => Promise<string>;
  importSchema: (sql: string, dialect: Dialect, name?: string) => Promise<void>;

  // Schema editing actions
  setSchema: (schema: Schema) => void;
  setHealthReport: (report: SchemaHealthReport) => void;
  exportSchema: (format: 'sql' | 'json') => string;
  undo: () => void;
  redo: () => void;

  // Migration stub (used by migrations page)
  generateMigration: (
    request: Omit<MigrationRequest, 'schema' | 'schemaId'>
  ) => Promise<Migration>;

  // Version history actions
  fetchVersions: () => Promise<void>;
  saveVersion: (description: string) => Promise<void>;
  restoreVersion: (versionId: string) => Promise<void>;

  // Utility
  clearError: () => void;
  markDirty: () => void;
}

/** Reset per-schema state when switching projects */
function perSchemaReset() {
  return {
    healthReport: null,
    appliedFixTitles: [] as string[],
    migrations: [],
    versions: [],
    schemaVersions: [],
    schemaVersionIndex: -1,
    isDirty: false,
    error: null,
  };
}

export const useSchemaStore = create<SchemaStore>()(
  persist(
    (set, get) => ({
      // Multi-project state
      schemaList: [],
      activeSchemaId: null,
      isDirty: false,
      isSwitching: false,

      // Current schema state
      currentSchema: null,
      originalSchema: null,
      schemaVersions: [],
      schemaVersionIndex: -1,
      healthReport: null,
      appliedFixTitles: [],
      migrations: [],
      versions: [],

      // Async state
      isLoading: false,
      isAnalyzing: false,
      error: null,

      // ========== Multi-project actions ==========

      fetchSchemaList: async () => {
        try {
          const res = await fetch('/api/schemas');
          if (!res.ok) throw new Error('Failed to fetch schema list');
          const data = await res.json();
          set({ schemaList: data.schemas });
        } catch (err) {
          console.error('fetchSchemaList error:', err);
        }
      },

      loadSchema: async (id: string) => {
        const { activeSchemaId, isSwitching, currentSchema } = get();
        if (isSwitching || (id === activeSchemaId && currentSchema !== null)) return;

        set({ isSwitching: true, isLoading: true, error: null });
        try {
          const res = await fetch(`/api/schemas/${id}`);
          if (!res.ok) throw new Error('Failed to load schema');
          const data = await res.json();
          const schema: Schema = data.schema;

          set({
            currentSchema: schema,
            originalSchema: schema,
            activeSchemaId: id,
            ...perSchemaReset(),
            healthReport: data.healthReport ?? null,
            schemaVersions: [schema],
            schemaVersionIndex: 0,
            isLoading: false,
            isSwitching: false,
          });

          // Fetch version history for this schema
          get().fetchVersions();
        } catch (err) {
          set({
            isLoading: false,
            isSwitching: false,
            error: (err as Error).message,
          });
        }
      },

      saveCurrentSchema: async () => {
        const { currentSchema, activeSchemaId, healthReport } = get();
        if (!currentSchema || !activeSchemaId) return;

        try {
          const res = await fetch(`/api/schemas/${activeSchemaId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              schema_json: currentSchema,
              health_report: healthReport ?? null,
            }),
          });
          if (!res.ok) throw new Error('Failed to save schema');

          set({ isDirty: false });

          // Refresh list to reflect updated timestamp / table count
          get().fetchSchemaList();
        } catch (err) {
          set({ error: (err as Error).message });
        }
      },

      createSchema: async (name: string, dialect: Dialect) => {
        const res = await fetch('/api/schemas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, dialect }),
        });
        if (!res.ok) throw new Error('Failed to create schema');
        const data = await res.json();
        const newId: string = data.schema.id;

        // Refresh list and load the new schema
        await get().fetchSchemaList();
        await get().loadSchema(newId);
        return newId;
      },

      deleteSchema: async (id: string) => {
        const res = await fetch(`/api/schemas/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed to delete schema');

        const { activeSchemaId } = get();

        // If we deleted the active schema, clear it
        if (activeSchemaId === id) {
          set({
            currentSchema: null,
            originalSchema: null,
            activeSchemaId: null,
            ...perSchemaReset(),
          });
        }

        await get().fetchSchemaList();
      },

      renameSchema: async (id: string, name: string) => {
        const res = await fetch(`/api/schemas/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name }),
        });
        if (!res.ok) throw new Error('Failed to rename schema');

        // Update name in current schema if it's the active one
        const { activeSchemaId, currentSchema } = get();
        if (activeSchemaId === id && currentSchema) {
          set({ currentSchema: { ...currentSchema, name } });
        }

        await get().fetchSchemaList();
      },

      duplicateSchema: async (id: string) => {
        // Load source schema
        const res = await fetch(`/api/schemas/${id}`);
        if (!res.ok) throw new Error('Failed to load schema for duplication');
        const data = await res.json();
        const source: Schema = data.schema;

        // Create new with "(copy)" suffix
        const createRes = await fetch('/api/schemas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: `${source.name} (copy)`,
            dialect: source.dialect,
          }),
        });
        if (!createRes.ok) throw new Error('Failed to create duplicate');
        const createData = await createRes.json();
        const newId: string = createData.schema.id;

        // Copy content to the new schema
        const patchRes = await fetch(`/api/schemas/${newId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ schema_json: { ...source, id: newId, name: `${source.name} (copy)` } }),
        });
        if (!patchRes.ok) throw new Error('Failed to copy schema content');

        await get().fetchSchemaList();
        return newId;
      },

      importSchema: async (sql: string, dialect: Dialect, name?: string) => {
        set({ isLoading: true, error: null });
        try {
          const res = await fetch('/api/parse', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sql, dialect, ...(name ? { name } : {}) }),
          });

          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Parse failed');

          const schema: Schema = data.schema;

          // Refresh list and set as active
          await get().fetchSchemaList();

          set({
            currentSchema: schema,
            originalSchema: schema,
            activeSchemaId: schema.id,
            ...perSchemaReset(),
            schemaVersions: [schema],
            schemaVersionIndex: 0,
            isLoading: false,
          });

          // Save initial version and fetch version list
          await get().saveVersion('Initial import');
        } catch (err) {
          set({ isLoading: false, error: (err as Error).message });
          throw err;
        }
      },

      // ========== Schema editing actions ==========

      setSchema: (schema: Schema) => {
        const { originalSchema } = get();
        set({
          currentSchema: schema,
          originalSchema: originalSchema ?? schema,
          schemaVersions: [schema],
          schemaVersionIndex: 0,
          isDirty: true,
        });
      },

      setHealthReport: (report: SchemaHealthReport) => {
        set({ healthReport: report });
      },

      exportSchema: (format: 'sql' | 'json') => {
        const schema = get().currentSchema;
        if (!schema) return '';
        if (format === 'json') return JSON.stringify(schema, null, 2);
        return schema.rawSQL;
      },

      undo: () => {
        const { schemaVersionIndex, schemaVersions } = get();
        if (schemaVersionIndex > 0) {
          const newIndex = schemaVersionIndex - 1;
          set({
            schemaVersionIndex: newIndex,
            currentSchema: schemaVersions[newIndex],
            isDirty: true,
          });
        }
      },

      redo: () => {
        const { schemaVersionIndex, schemaVersions } = get();
        if (schemaVersionIndex < schemaVersions.length - 1) {
          const newIndex = schemaVersionIndex + 1;
          set({
            schemaVersionIndex: newIndex,
            currentSchema: schemaVersions[newIndex],
            isDirty: true,
          });
        }
      },

      generateMigration: async (_request) => {
        throw new Error('Not implemented');
      },

      // ========== Version history actions ==========

      fetchVersions: async () => {
        const { activeSchemaId } = get();
        if (!activeSchemaId) return;

        try {
          const res = await fetch(`/api/schemas/${activeSchemaId}/versions`);
          if (!res.ok) throw new Error('Failed to fetch versions');
          const data = await res.json();
          set({ versions: data.versions });
        } catch (err) {
          console.error('fetchVersions error:', err);
        }
      },

      saveVersion: async (description: string) => {
        const { currentSchema, activeSchemaId } = get();
        if (!currentSchema || !activeSchemaId) return;

        try {
          const res = await fetch(`/api/schemas/${activeSchemaId}/versions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              schema_json: currentSchema,
              change_description: description,
            }),
          });
          if (!res.ok) throw new Error('Failed to save version');

          // Refresh version list
          await get().fetchVersions();
        } catch (err) {
          console.error('saveVersion error:', err);
        }
      },

      restoreVersion: async (versionId: string) => {
        const { activeSchemaId } = get();
        if (!activeSchemaId) return;

        try {
          const res = await fetch(
            `/api/schemas/${activeSchemaId}/versions/${versionId}`
          );
          if (!res.ok) throw new Error('Failed to load version');
          const data = await res.json();
          const restoredSchema: Schema = data.schema;
          const fromVersion: number = data.version.versionNumber;

          // Update current schema with restored content
          set({
            currentSchema: restoredSchema,
            originalSchema: restoredSchema,
            schemaVersions: [restoredSchema],
            schemaVersionIndex: 0,
            isDirty: true,
          });

          // Save to DB
          await get().saveCurrentSchema();

          // Create a new version documenting the restore
          await get().saveVersion(`Restored from version ${fromVersion}`);
        } catch (err) {
          set({ error: (err as Error).message });
        }
      },

      clearError: () => set({ error: null }),

      markDirty: () => set({ isDirty: true }),
    }),
    {
      name: 'dbmate-schema',
      partialize: (state) => ({
        activeSchemaId: state.activeSchemaId,
      }),
    }
  )
);
