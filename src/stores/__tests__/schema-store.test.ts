import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useSchemaStore } from '../schema-store';
import type { Schema } from '@/lib/types';

const mockFetch = vi.fn();
global.fetch = mockFetch;

const testSchema: Schema = {
  id: 'schema-1',
  name: 'Test Schema',
  dialect: 'mysql',
  tables: [
    {
      name: 'users',
      columns: [
        { name: 'id', type: 'INT', nullable: false, primaryKey: true, autoIncrement: true, unique: false },
      ],
      primaryKey: ['id'],
      foreignKeys: [],
      indexes: [],
    },
  ],
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
  rawSQL: 'CREATE TABLE users (id INT PRIMARY KEY);',
};

describe('SchemaStore', () => {
  beforeEach(() => {
    useSchemaStore.setState({
      schemaList: [],
      activeSchemaId: null,
      currentSchema: null,
      originalSchema: null,
      schemaVersions: [],
      schemaVersionIndex: -1,
      healthReport: null,
      appliedFixTitles: [],
      migrations: [],
      versions: [],
      isDirty: false,
      isSwitching: false,
      isLoading: false,
      isAnalyzing: false,
      error: null,
    });
    mockFetch.mockReset();
  });

  describe('setSchema', () => {
    it('sets current schema and marks dirty', () => {
      useSchemaStore.getState().setSchema(testSchema);

      const state = useSchemaStore.getState();
      expect(state.currentSchema).toEqual(testSchema);
      expect(state.isDirty).toBe(true);
      expect(state.schemaVersions).toHaveLength(1);
      expect(state.schemaVersionIndex).toBe(0);
    });

    it('preserves original schema on subsequent sets', () => {
      useSchemaStore.getState().setSchema(testSchema);

      const modified = { ...testSchema, name: 'Modified' };
      useSchemaStore.getState().setSchema(modified);

      expect(useSchemaStore.getState().originalSchema).toEqual(testSchema);
      expect(useSchemaStore.getState().currentSchema?.name).toBe('Modified');
    });
  });

  describe('exportSchema', () => {
    it('exports as JSON', () => {
      useSchemaStore.getState().setSchema(testSchema);

      const json = useSchemaStore.getState().exportSchema('json');
      expect(JSON.parse(json)).toEqual(testSchema);
    });

    it('exports as SQL (rawSQL)', () => {
      useSchemaStore.getState().setSchema(testSchema);

      const sql = useSchemaStore.getState().exportSchema('sql');
      expect(sql).toBe(testSchema.rawSQL);
    });

    it('returns empty string when no schema', () => {
      expect(useSchemaStore.getState().exportSchema('json')).toBe('');
      expect(useSchemaStore.getState().exportSchema('sql')).toBe('');
    });
  });

  describe('undo/redo', () => {
    it('does nothing when no versions', () => {
      useSchemaStore.getState().undo();
      expect(useSchemaStore.getState().currentSchema).toBeNull();
    });

    it('does nothing when at index 0', () => {
      useSchemaStore.getState().setSchema(testSchema);
      useSchemaStore.getState().undo();
      // Still at index 0
      expect(useSchemaStore.getState().schemaVersionIndex).toBe(0);
    });

    it('redo does nothing when at latest version', () => {
      useSchemaStore.getState().setSchema(testSchema);
      useSchemaStore.getState().redo();
      expect(useSchemaStore.getState().schemaVersionIndex).toBe(0);
    });
  });

  describe('setHealthReport', () => {
    it('sets health report', () => {
      const report = {
        score: 75,
        breakdown: { performance: 25, security: 20, conventions: 15, normalization: 15 },
        issues: [],
        summary: 'Good',
      };
      useSchemaStore.getState().setHealthReport(report);
      expect(useSchemaStore.getState().healthReport).toEqual(report);
    });
  });

  describe('clearError', () => {
    it('clears error state', () => {
      useSchemaStore.setState({ error: 'Something went wrong' });
      useSchemaStore.getState().clearError();
      expect(useSchemaStore.getState().error).toBeNull();
    });
  });

  describe('markDirty', () => {
    it('marks state as dirty', () => {
      useSchemaStore.getState().markDirty();
      expect(useSchemaStore.getState().isDirty).toBe(true);
    });
  });

  describe('fetchSchemaList', () => {
    it('fetches and sets schema list', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          schemas: [{ id: 's1', name: 'Schema 1', dialect: 'mysql', updatedAt: '2026-01-01', tableCount: 2 }],
        }),
      });

      await useSchemaStore.getState().fetchSchemaList();
      expect(useSchemaStore.getState().schemaList).toHaveLength(1);
      expect(useSchemaStore.getState().schemaList[0].name).toBe('Schema 1');
    });

    it('handles fetch error gracefully', async () => {
      mockFetch.mockRejectedValue(new Error('Network'));
      await useSchemaStore.getState().fetchSchemaList();
      // Should not throw, list stays empty
      expect(useSchemaStore.getState().schemaList).toEqual([]);
    });
  });

  describe('loadSchema', () => {
    it('loads schema from API', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          schema: testSchema,
          healthReport: null,
          versions: [],
        }),
      });

      await useSchemaStore.getState().loadSchema('schema-1');

      const state = useSchemaStore.getState();
      expect(state.currentSchema).toEqual(testSchema);
      expect(state.activeSchemaId).toBe('schema-1');
      expect(state.isLoading).toBe(false);
    });

    it('does not reload same schema', async () => {
      useSchemaStore.setState({
        activeSchemaId: 'schema-1',
        currentSchema: testSchema,
      });

      await useSchemaStore.getState().loadSchema('schema-1');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('sets error on failure', async () => {
      mockFetch.mockResolvedValue({ ok: false });

      await useSchemaStore.getState().loadSchema('bad-id');
      expect(useSchemaStore.getState().error).toBeTruthy();
      expect(useSchemaStore.getState().isLoading).toBe(false);
    });
  });

  describe('deleteSchema', () => {
    it('clears state when deleting active schema', async () => {
      useSchemaStore.setState({
        activeSchemaId: 'schema-1',
        currentSchema: testSchema,
      });

      mockFetch
        .mockResolvedValueOnce({ ok: true }) // DELETE
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ schemas: [] }),
        }); // fetchSchemaList

      await useSchemaStore.getState().deleteSchema('schema-1');

      expect(useSchemaStore.getState().currentSchema).toBeNull();
      expect(useSchemaStore.getState().activeSchemaId).toBeNull();
    });

    it('preserves state when deleting non-active schema', async () => {
      useSchemaStore.setState({
        activeSchemaId: 'schema-1',
        currentSchema: testSchema,
      });

      mockFetch
        .mockResolvedValueOnce({ ok: true })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ schemas: [] }),
        });

      await useSchemaStore.getState().deleteSchema('other-schema');

      expect(useSchemaStore.getState().currentSchema).toEqual(testSchema);
      expect(useSchemaStore.getState().activeSchemaId).toBe('schema-1');
    });
  });
});
