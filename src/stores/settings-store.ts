import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AppSettings } from '@/lib/types';

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  language: 'hu',
  dialect: 'mysql',
  migrationFormat: 'raw',
  seedLocale: 'hu',
  seedDefaultRows: 50,
  aiModel: 'claude-sonnet-4-6',
  temperature: 0.1,
  maxTokens: 4096,
};

interface SettingsStore {
  settings: AppSettings;
  isLoaded: boolean;
  loadSettings: () => Promise<void>;
  updateSettings: (partial: Partial<AppSettings>) => void;
  resetSettings: () => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set, get) => ({
      settings: { ...DEFAULT_SETTINGS },
      isLoaded: false,

      loadSettings: async () => {
        try {
          const res = await fetch('/api/settings');
          if (!res.ok) return;
          const data = await res.json();
          const dbSettings = data.settings ?? {};

          // DB wins over localStorage, defaults fill gaps
          set({
            settings: { ...DEFAULT_SETTINGS, ...get().settings, ...dbSettings },
            isLoaded: true,
          });
        } catch {
          // Fallback to localStorage cache (already hydrated by persist)
          set({ isLoaded: true });
        }
      },

      updateSettings: (partial) => {
        // Update in-memory immediately
        set((state) => ({
          settings: { ...state.settings, ...partial },
        }));

        // Persist to DB (fire and forget)
        fetch('/api/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(partial),
        }).catch(() => {
          console.error('Failed to persist settings to DB');
        });
      },

      resetSettings: () => {
        set({ settings: { ...DEFAULT_SETTINGS } });

        // Persist reset to DB
        fetch('/api/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(DEFAULT_SETTINGS),
        }).catch(() => {
          console.error('Failed to persist settings reset to DB');
        });
      },
    }),
    {
      name: 'dbmate-settings',
      partialize: (state) => ({
        settings: state.settings,
      }),
    }
  )
);

// Load settings from DB on module init (client-side)
if (typeof window !== 'undefined') {
  // Small delay to ensure Next.js is ready
  setTimeout(() => {
    useSettingsStore.getState().loadSettings();
  }, 100);
}
