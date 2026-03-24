'use client';

import { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import DOMPurify from 'isomorphic-dompurify';
import { cn } from '@/lib/utils';
import { SQLCodeBlock } from './sql-code-block';
import type { ChatMessage as ChatMessageType } from '@/lib/types';

interface ChatMessageProps {
  message: ChatMessageType;
}

function ConfidenceBadge({ level }: { level: 'high' | 'medium' | 'low' }) {
  const config = {
    high: { label: 'High confidence', className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
    medium: { label: 'Medium confidence', className: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
    low: { label: 'Low confidence', className: 'bg-red-500/15 text-red-400 border-red-500/30' },
  }[level];

  return (
    <span className={cn('inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-full border', config.className)}>
      {config.label}
    </span>
  );
}

function ChatMessageComponent({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const sanitized = DOMPurify.sanitize(message.content);

  return (
    <div
      className={cn(
        'flex px-2',
        isUser ? 'justify-end pt-2 pb-0.5' : 'justify-start py-0.5'
      )}
    >
      <div
        className={cn(
          'px-2.5 py-1.5',
          isUser
            ? 'max-w-[88%] bg-primary text-primary-foreground rounded-2xl rounded-br-sm'
            : 'w-full text-foreground'
        )}
      >
        {!isUser && message.confidence && (
          <div className="mb-1">
            <ConfidenceBadge level={message.confidence} />
          </div>
        )}
        <div className="prose prose-sm dark:prose-invert max-w-none text-[13px] leading-normal [&_pre]:bg-transparent [&_pre]:p-0 [&_pre]:m-0 [&_p]:my-0.5 [&_ul]:my-0.5 [&_ol]:my-0.5 [&_li]:my-0 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              code({ className, children, ...props }) {
                const match = /language-sql/.exec(className || '');
                const codeString = String(children).replace(/\n$/, '');
                if (match) {
                  return <SQLCodeBlock sql={codeString} />;
                }
                return (
                  <code
                    className={cn(
                      'bg-muted px-1 py-0.5 rounded text-xs font-mono',
                      className
                    )}
                    {...props}
                  >
                    {children}
                  </code>
                );
              },
              pre({ children }) {
                return <>{children}</>;
              },
            }}
          >
            {sanitized}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}

export const ChatMessage = memo(ChatMessageComponent);
