'use client';

import { useState, useCallback, type KeyboardEvent } from 'react';
import { ArrowUp, Loader2 } from 'lucide-react';
import { MAX_CHAT_MESSAGE_LENGTH } from '@/lib/validations';

interface ChatInputProps {
  onSend: (message: string) => void;
  isGenerating: boolean;
}

export function ChatInput({ onSend, isGenerating }: ChatInputProps) {
  const [input, setInput] = useState('');

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || isGenerating) return;
    onSend(trimmed);
    setInput('');
  }, [input, isGenerating, onSend]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  return (
    <div className="flex items-center gap-1.5 rounded-full border bg-muted/50 backdrop-blur-sm pl-3 pr-1 py-1">
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Message..."
        maxLength={MAX_CHAT_MESSAGE_LENGTH}
        disabled={isGenerating}
        className="flex-1 bg-transparent text-xs placeholder:text-muted-foreground resize-none outline-none min-h-5 max-h-16 py-0.5 leading-snug"
        rows={1}
      />
      <button
        onClick={handleSend}
        disabled={!input.trim() || isGenerating}
        className="flex items-center justify-center h-6 w-6 rounded-full bg-foreground text-background shrink-0 disabled:opacity-30 hover:opacity-80 transition-opacity"
      >
        {isGenerating ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <ArrowUp className="h-3 w-3" />
        )}
      </button>
    </div>
  );
}
