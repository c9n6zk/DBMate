import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useChatStore } from '../chat-store';
import type { ChatMessage } from '@/lib/types';

const mockFetch = vi.fn();
global.fetch = mockFetch;

function makeMessage(id: string, schemaId: string, role: 'user' | 'assistant' = 'user'): ChatMessage {
  return {
    id,
    schemaId,
    role,
    content: `Message ${id}`,
    timestamp: '2026-01-01T00:00:00Z',
    type: 'query',
  };
}

describe('ChatStore', () => {
  beforeEach(() => {
    useChatStore.setState({
      messagesBySchema: {},
      activeSchemaId: null,
      queryHistory: [],
      isGenerating: false,
      isLoadingHistory: false,
    });
    mockFetch.mockReset();
  });

  describe('addMessage', () => {
    it('adds message to correct schema', () => {
      useChatStore.getState().addMessage(makeMessage('m1', 'schema-1'));
      const msgs = useChatStore.getState().messagesBySchema['schema-1'];
      expect(msgs).toHaveLength(1);
      expect(msgs[0].id).toBe('m1');
    });

    it('appends to existing messages', () => {
      useChatStore.getState().addMessage(makeMessage('m1', 'schema-1'));
      useChatStore.getState().addMessage(makeMessage('m2', 'schema-1'));
      const msgs = useChatStore.getState().messagesBySchema['schema-1'];
      expect(msgs).toHaveLength(2);
    });

    it('separates messages by schema', () => {
      useChatStore.getState().addMessage(makeMessage('m1', 'schema-1'));
      useChatStore.getState().addMessage(makeMessage('m2', 'schema-2'));
      expect(useChatStore.getState().messagesBySchema['schema-1']).toHaveLength(1);
      expect(useChatStore.getState().messagesBySchema['schema-2']).toHaveLength(1);
    });
  });

  describe('updateMessage', () => {
    it('updates message content', () => {
      useChatStore.setState({
        activeSchemaId: 'schema-1',
        messagesBySchema: { 'schema-1': [makeMessage('m1', 'schema-1')] },
      });

      useChatStore.getState().updateMessage('m1', { content: 'Updated' });
      const msgs = useChatStore.getState().messagesBySchema['schema-1'];
      expect(msgs[0].content).toBe('Updated');
    });

    it('does nothing without activeSchemaId', () => {
      useChatStore.setState({
        activeSchemaId: null,
        messagesBySchema: { 'schema-1': [makeMessage('m1', 'schema-1')] },
      });

      useChatStore.getState().updateMessage('m1', { content: 'Updated' });
      const msgs = useChatStore.getState().messagesBySchema['schema-1'];
      expect(msgs[0].content).toBe('Message m1');
    });

    it('adds sql and confidence to assistant message', () => {
      const assistantMsg = makeMessage('m1', 'schema-1', 'assistant');
      useChatStore.setState({
        activeSchemaId: 'schema-1',
        messagesBySchema: { 'schema-1': [assistantMsg] },
      });

      useChatStore.getState().updateMessage('m1', {
        sql: 'SELECT * FROM users;',
        confidence: 'high',
      });
      const msgs = useChatStore.getState().messagesBySchema['schema-1'];
      expect(msgs[0].sql).toBe('SELECT * FROM users;');
      expect(msgs[0].confidence).toBe('high');
    });
  });

  describe('getMessages', () => {
    it('returns messages for active schema', () => {
      useChatStore.setState({
        activeSchemaId: 'schema-1',
        messagesBySchema: {
          'schema-1': [makeMessage('m1', 'schema-1')],
          'schema-2': [makeMessage('m2', 'schema-2')],
        },
      });

      const msgs = useChatStore.getState().getMessages();
      expect(msgs).toHaveLength(1);
      expect(msgs[0].id).toBe('m1');
    });

    it('returns empty array without active schema', () => {
      expect(useChatStore.getState().getMessages()).toEqual([]);
    });
  });

  describe('setActiveSchema', () => {
    it('sets active schema ID', () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ messages: [] }),
      });

      useChatStore.getState().setActiveSchema('schema-1');
      expect(useChatStore.getState().activeSchemaId).toBe('schema-1');
    });

    it('does not re-fetch if same schema', () => {
      useChatStore.setState({ activeSchemaId: 'schema-1' });

      useChatStore.getState().setActiveSchema('schema-1');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('loads history for new schema without cached messages', () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ messages: [makeMessage('m1', 'new-schema')] }),
      });

      useChatStore.getState().setActiveSchema('new-schema');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/chat?schemaId=new-schema')
      );
    });
  });

  describe('clearHistory', () => {
    it('clears in-memory messages', async () => {
      mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
      useChatStore.setState({
        messagesBySchema: { 'schema-1': [makeMessage('m1', 'schema-1')] },
      });

      await useChatStore.getState().clearHistory('schema-1');
      expect(useChatStore.getState().messagesBySchema['schema-1']).toBeUndefined();
    });

    it('calls DELETE API', async () => {
      mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
      useChatStore.setState({
        messagesBySchema: { 'schema-1': [] },
      });

      await useChatStore.getState().clearHistory('schema-1');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('schemaId=schema-1'),
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });

  describe('setGenerating', () => {
    it('sets generating flag', () => {
      useChatStore.getState().setGenerating(true);
      expect(useChatStore.getState().isGenerating).toBe(true);
      useChatStore.getState().setGenerating(false);
      expect(useChatStore.getState().isGenerating).toBe(false);
    });
  });

  describe('persistMessage', () => {
    it('calls POST /api/chat with message', async () => {
      mockFetch.mockResolvedValue({ ok: true });
      const msg = makeMessage('m1', 'schema-1');

      await useChatStore.getState().persistMessage(msg);
      expect(mockFetch).toHaveBeenCalledWith('/api/chat', expect.objectContaining({
        method: 'POST',
      }));
    });

    it('does not throw on fetch error', async () => {
      mockFetch.mockRejectedValue(new Error('Network'));
      const msg = makeMessage('m1', 'schema-1');

      // Should not throw
      await useChatStore.getState().persistMessage(msg);
    });
  });
});
