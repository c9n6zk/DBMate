import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ChatMessage, QueryResult, SeedConfig, SeedResult } from '@/lib/types';

interface ChatStore {
  // Per-schema message cache
  messagesBySchema: Record<string, ChatMessage[]>;
  activeSchemaId: string | null;
  queryHistory: QueryResult[];
  isGenerating: boolean;
  isLoadingHistory: boolean;

  // Actions
  setActiveSchema: (schemaId: string | null) => void;
  loadChatHistory: (schemaId: string) => Promise<void>;
  persistMessage: (message: ChatMessage) => Promise<void>;
  clearHistory: (schemaId: string) => Promise<void>;
  addMessage: (message: ChatMessage) => void;
  updateMessage: (id: string, patch: Partial<ChatMessage>) => void;
  setGenerating: (value: boolean) => void;
  getMessages: () => ChatMessage[];

  // Legacy stubs
  sendMessage: (nl: string) => Promise<QueryResult>;
  generateSeedData: (config: SeedConfig) => Promise<SeedResult[]>;
  loadHistory: (schemaId: string) => Promise<void>;
}

export const useChatStore = create<ChatStore>()(
  persist(
    (set, get) => ({
      messagesBySchema: {},
      activeSchemaId: null,
      queryHistory: [],
      isGenerating: false,
      isLoadingHistory: false,

      setActiveSchema: (schemaId: string | null) => {
        const prev = get().activeSchemaId;
        if (prev === schemaId) return;
        set({ activeSchemaId: schemaId });
        if (schemaId && !get().messagesBySchema[schemaId]) {
          get().loadChatHistory(schemaId);
        }
      },

      loadChatHistory: async (schemaId: string) => {
        set({ isLoadingHistory: true });
        try {
          const res = await fetch(`/api/chat?schemaId=${encodeURIComponent(schemaId)}`);
          if (res.ok) {
            const data = await res.json();
            set((state) => ({
              messagesBySchema: {
                ...state.messagesBySchema,
                [schemaId]: data.messages ?? [],
              },
            }));
          }
        } catch {
          // Non-critical: cache miss just means empty chat
        } finally {
          set({ isLoadingHistory: false });
        }
      },

      persistMessage: async (message: ChatMessage) => {
        try {
          await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messages: [message],
            }),
          });
        } catch {
          console.error('Failed to persist chat message');
        }
      },

      clearHistory: async (schemaId: string) => {
        // Clear in-memory
        set((state) => {
          const next = { ...state.messagesBySchema };
          delete next[schemaId];
          return { messagesBySchema: next };
        });
        // Clear in DB
        try {
          await fetch(`/api/chat?schemaId=${encodeURIComponent(schemaId)}`, {
            method: 'DELETE',
          });
        } catch {
          // Non-critical
        }
      },

      addMessage: (message: ChatMessage) =>
        set((state) => {
          const schemaId = message.schemaId;
          const existing = state.messagesBySchema[schemaId] ?? [];
          return {
            messagesBySchema: {
              ...state.messagesBySchema,
              [schemaId]: [...existing, message],
            },
          };
        }),

      updateMessage: (id: string, patch: Partial<ChatMessage>) =>
        set((state) => {
          const activeId = state.activeSchemaId;
          if (!activeId) return state;
          const msgs = state.messagesBySchema[activeId];
          if (!msgs) return state;
          return {
            messagesBySchema: {
              ...state.messagesBySchema,
              [activeId]: msgs.map((msg) =>
                msg.id === id ? { ...msg, ...patch } : msg
              ),
            },
          };
        }),

      setGenerating: (value: boolean) => set({ isGenerating: value }),

      getMessages: () => {
        const state = get();
        if (!state.activeSchemaId) return [];
        return state.messagesBySchema[state.activeSchemaId] ?? [];
      },

      // Legacy stubs
      sendMessage: async (_nl: string) => {
        throw new Error('Use AIChat component for streaming');
      },

      generateSeedData: async (_config: SeedConfig) => {
        throw new Error('Not implemented');
      },

      loadHistory: async (schemaId: string) => {
        return get().loadChatHistory(schemaId);
      },
    }),
    {
      name: 'dbmate-chat',
      partialize: (state) => ({
        activeSchemaId: state.activeSchemaId,
      }),
    }
  )
);

// Run legacy migration on module load (client-side only)
if (typeof window !== 'undefined') {
  migrateLegacyChat();
}

/** Migrate old localStorage chat messages to the DB (runs once) */
async function migrateLegacyChat() {
  const MIGRATION_KEY = 'dbmate-chat-migrated';
  if (typeof window === 'undefined') return;
  if (localStorage.getItem(MIGRATION_KEY)) return;

  try {
    const raw = localStorage.getItem('dbmate-chat');
    if (!raw) {
      localStorage.setItem(MIGRATION_KEY, '1');
      return;
    }

    const parsed = JSON.parse(raw);
    const messages: ChatMessage[] = parsed?.state?.messages ?? [];
    if (messages.length === 0) {
      localStorage.setItem(MIGRATION_KEY, '1');
      return;
    }

    // Group by schemaId and POST to DB
    const grouped: Record<string, ChatMessage[]> = {};
    for (const m of messages) {
      if (!m.schemaId) continue;
      (grouped[m.schemaId] ??= []).push(m);
    }

    for (const [, msgs] of Object.entries(grouped)) {
      await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: msgs }),
      });
    }

    // Mark as migrated
    localStorage.setItem(MIGRATION_KEY, '1');
  } catch {
    // Non-critical: if migration fails, messages stay in localStorage
    // and will be retried on next load
  }
}
