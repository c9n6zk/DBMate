'use client';

import { useCallback, useEffect, useRef } from 'react';
import { PanelRightClose } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChatMessage } from './chat-message';
import { ChatInput } from './chat-input';
import { useChatStore } from '@/stores/chat-store';
import { useSchemaStore } from '@/stores/schema-store';
import { nanoid } from 'nanoid';
import type { ChatMessage as ChatMessageType } from '@/lib/types';

interface AIChatProps {
  onClose?: () => void;
}

const EMPTY_MESSAGES: ChatMessageType[] = [];

export function AIChat({ onClose }: AIChatProps) {
  const activeSchemaId = useSchemaStore((s) => s.activeSchemaId);
  const messages = useChatStore(
    (s) => (activeSchemaId ? s.messagesBySchema[activeSchemaId] : null) ?? EMPTY_MESSAGES
  );
  const isGenerating = useChatStore((s) => s.isGenerating);
  const isLoadingHistory = useChatStore((s) => s.isLoadingHistory);
  const addMessage = useChatStore((s) => s.addMessage);
  const setGenerating = useChatStore((s) => s.setGenerating);
  const persistMessage = useChatStore((s) => s.persistMessage);
  const setActiveSchema = useChatStore((s) => s.setActiveSchema);

  const currentSchema = useSchemaStore((s) => s.currentSchema);

  const bottomRef = useRef<HTMLDivElement>(null);
  const streamingContentRef = useRef('');

  // Sync schema store's activeSchemaId → chat store
  useEffect(() => {
    setActiveSchema(activeSchemaId ?? null);
  }, [activeSchemaId, setActiveSchema]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = useCallback(
    async (text: string) => {
      if (!currentSchema) return;

      // Add user message
      const userMsg: ChatMessageType = {
        id: nanoid(),
        schemaId: currentSchema.id,
        role: 'user',
        content: text,
        timestamp: new Date().toISOString(),
        type: 'query',
      };
      addMessage(userMsg);
      setGenerating(true);

      // Persist user message to DB
      persistMessage(userMsg);

      // Create placeholder assistant message
      const assistantId = nanoid();
      const assistantMsg: ChatMessageType = {
        id: assistantId,
        schemaId: currentSchema.id,
        role: 'assistant',
        content: '',
        timestamp: new Date().toISOString(),
        type: 'query',
      };
      addMessage(assistantMsg);
      streamingContentRef.current = '';

      try {
        const res = await fetch('/api/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question: text,
            schema: currentSchema,
            history: messages.slice(-18),
            dialect: currentSchema.dialect,
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          useChatStore.getState().updateMessage(assistantId, {
            content: `Error: ${err.error || 'Failed to get response'}`,
          });
          return;
        }

        // Read SSE stream
        const reader = res.body?.getReader();
        if (!reader) return;

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === 'text') {
                streamingContentRef.current += data.content;
                useChatStore.getState().updateMessage(assistantId, {
                  content: streamingContentRef.current,
                });
              } else if (data.type === 'done') {
                const parsed = JSON.parse(data.content);
                const finalMsg: Partial<ChatMessageType> = {
                  content: parsed.fullContent,
                  sql: parsed.sql || undefined,
                  confidence: parsed.confidence || undefined,
                };
                useChatStore.getState().updateMessage(assistantId, finalMsg);

                // Persist completed assistant message to DB
                const store = useChatStore.getState();
                const activeId = store.activeSchemaId;
                if (activeId) {
                  const fullMsg = store.messagesBySchema[activeId]?.find(
                    (m) => m.id === assistantId
                  );
                  if (fullMsg) {
                    store.persistMessage(fullMsg);
                  }
                }
              } else if (data.type === 'error') {
                useChatStore.getState().updateMessage(assistantId, {
                  content: `Error: ${data.content}`,
                });
              }
            } catch {
              // Skip malformed SSE chunks
            }
          }
        }
      } catch (err) {
        const errMsg =
          err instanceof Error ? err.message : 'Connection failed';
        useChatStore.getState().updateMessage(assistantId, {
          content: `Error: ${errMsg}`,
        });
      } finally {
        setGenerating(false);
      }
    },
    [currentSchema, messages, addMessage, setGenerating, persistMessage]
  );

  return (
    <div className="relative flex flex-col h-full min-h-0 border-l overflow-hidden">
      {/* Header */}
      <div className="flex items-center px-3 py-1 border-b bg-muted/30">
        <span className="font-medium text-xs flex-1 text-muted-foreground">Chat</span>
        {onClose && (
          <Button variant="ghost" size="icon" className="h-5 w-5" onClick={onClose}>
            <PanelRightClose className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 min-h-0">
        {isLoadingHistory ? (
          <div className="flex items-center justify-center h-full min-h-[200px] p-6">
            <p className="text-xs text-muted-foreground">Loading chat history...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full min-h-[200px] p-6 pb-24 text-center">
            <p className="text-xs text-muted-foreground">
              Ask anything about your schema.
            </p>
          </div>
        ) : (
          <div className="py-1 pb-16">
            {messages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} />
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </ScrollArea>

      {/* Floating input */}
      <div className="absolute bottom-0 left-0 right-0 px-2 pb-1.5 bg-linear-to-t from-background via-background to-transparent pt-4">
        <ChatInput onSend={handleSend} isGenerating={isGenerating} />
      </div>
    </div>
  );
}
