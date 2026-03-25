import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useSettingsStore } from '../settings-store';

// Mock fetch for store tests
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('SettingsStore', () => {
  beforeEach(() => {
    // Reset store state
    useSettingsStore.setState({
      settings: {
        theme: 'system',
        language: 'hu',
        dialect: 'mysql',
        migrationFormat: 'raw',
        seedLocale: 'hu',
        seedDefaultRows: 50,
        aiModel: 'claude-sonnet-4-6',
        temperature: 0.1,
        maxTokens: 4096,
      },
      isLoaded: false,
    });
    mockFetch.mockReset();
  });

  describe('default state', () => {
    it('has correct default settings', () => {
      const state = useSettingsStore.getState();
      expect(state.settings.theme).toBe('system');
      expect(state.settings.language).toBe('hu');
      expect(state.settings.dialect).toBe('mysql');
      expect(state.settings.temperature).toBe(0.1);
      expect(state.settings.maxTokens).toBe(4096);
      expect(state.isLoaded).toBe(false);
    });
  });

  describe('updateSettings', () => {
    it('updates settings in memory immediately', () => {
      mockFetch.mockResolvedValue({ ok: true });

      useSettingsStore.getState().updateSettings({ theme: 'dark' });
      expect(useSettingsStore.getState().settings.theme).toBe('dark');
    });

    it('preserves other settings when updating', () => {
      mockFetch.mockResolvedValue({ ok: true });

      useSettingsStore.getState().updateSettings({ theme: 'dark' });
      expect(useSettingsStore.getState().settings.language).toBe('hu');
      expect(useSettingsStore.getState().settings.dialect).toBe('mysql');
    });

    it('fires fetch to persist settings to DB', () => {
      mockFetch.mockResolvedValue({ ok: true });

      useSettingsStore.getState().updateSettings({ theme: 'dark' });

      expect(mockFetch).toHaveBeenCalledWith('/api/settings', expect.objectContaining({
        method: 'PUT',
      }));
    });

    it('updates multiple settings at once', () => {
      mockFetch.mockResolvedValue({ ok: true });

      useSettingsStore.getState().updateSettings({
        theme: 'light',
        language: 'en',
        temperature: 0.5,
      });

      const settings = useSettingsStore.getState().settings;
      expect(settings.theme).toBe('light');
      expect(settings.language).toBe('en');
      expect(settings.temperature).toBe(0.5);
    });
  });

  describe('resetSettings', () => {
    it('resets all settings to defaults', () => {
      mockFetch.mockResolvedValue({ ok: true });

      // Modify settings first
      useSettingsStore.getState().updateSettings({ theme: 'dark', language: 'en' });
      // Reset
      useSettingsStore.getState().resetSettings();

      const settings = useSettingsStore.getState().settings;
      expect(settings.theme).toBe('system');
      expect(settings.language).toBe('hu');
    });
  });

  describe('loadSettings', () => {
    it('loads settings from API and merges with defaults', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          settings: { theme: 'dark', language: 'en' },
        }),
      });

      await useSettingsStore.getState().loadSettings();

      const state = useSettingsStore.getState();
      expect(state.isLoaded).toBe(true);
      expect(state.settings.theme).toBe('dark');
      expect(state.settings.language).toBe('en');
      // Defaults should fill gaps
      expect(state.settings.dialect).toBe('mysql');
    });

    it('falls back gracefully on API error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await useSettingsStore.getState().loadSettings();

      expect(useSettingsStore.getState().isLoaded).toBe(true);
      // Should keep current settings (defaults)
      expect(useSettingsStore.getState().settings.theme).toBe('system');
    });
  });
});
