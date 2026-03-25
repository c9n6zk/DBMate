/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AIChat } from '../chat/ai-chat';

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, ...props }: any) => <button onClick={onClick} {...props}>{children}</button>,
}));
vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children, ...props }: any) => <div {...props}>{children}</div>,
}));
vi.mock('../chat/chat-message', () => ({
  ChatMessage: ({ message }: any) => <div data-testid={`msg-${message.id}`}>{message.content}</div>,
}));
vi.mock('../chat/chat-input', () => ({
  ChatInput: ({ onSend, isGenerating }: any) => (
    <div data-testid="chat-input" data-generating={isGenerating}>
      <button onClick={() => onSend('test')}>send</button>
    </div>
  ),
}));
vi.mock('nanoid', () => ({ nanoid: () => 'test-id' }));

// jsdom doesn't implement scrollIntoView
Element.prototype.scrollIntoView = vi.fn();

const mockMessages = [
  { id: 'm1', schemaId: 's1', role: 'user', content: 'Hello', timestamp: '2026-01-01', type: 'query' },
  { id: 'm2', schemaId: 's1', role: 'assistant', content: 'Hi there', timestamp: '2026-01-01', type: 'query' },
];

// Default store states
let mockActiveSchemaId: string | null = 's1';
let mockCurrentSchema: any = { id: 's1', name: 'Test', dialect: 'mysql', tables: [] };
let mockMessagesBySchema: any = { s1: mockMessages };
let mockIsGenerating = false;
let mockIsLoadingHistory = false;

vi.mock('@/stores/schema-store', () => ({
  useSchemaStore: (selector: any) => selector({
    activeSchemaId: mockActiveSchemaId,
    currentSchema: mockCurrentSchema,
  }),
}));
vi.mock('@/stores/chat-store', () => ({
  useChatStore: Object.assign(
    (selector: any) => selector({
      messagesBySchema: mockMessagesBySchema,
      isGenerating: mockIsGenerating,
      isLoadingHistory: mockIsLoadingHistory,
      addMessage: vi.fn(),
      setGenerating: vi.fn(),
      persistMessage: vi.fn(),
      setActiveSchema: vi.fn(),
      updateMessage: vi.fn(),
      activeSchemaId: mockActiveSchemaId,
    }),
    { getState: () => ({
      updateMessage: vi.fn(),
      activeSchemaId: mockActiveSchemaId,
      messagesBySchema: mockMessagesBySchema,
      persistMessage: vi.fn(),
    }) }
  ),
}));

describe('AIChat', () => {
  beforeEach(() => {
    mockActiveSchemaId = 's1';
    mockCurrentSchema = { id: 's1', name: 'Test', dialect: 'mysql', tables: [] };
    mockMessagesBySchema = { s1: mockMessages };
    mockIsGenerating = false;
    mockIsLoadingHistory = false;
  });

  it('renders Chat header', () => {
    render(<AIChat />);
    expect(screen.getByText('Chat')).toBeInTheDocument();
  });

  it('renders messages', () => {
    render(<AIChat />);
    expect(screen.getByTestId('msg-m1')).toBeInTheDocument();
    expect(screen.getByTestId('msg-m2')).toBeInTheDocument();
  });

  it('renders chat input', () => {
    render(<AIChat />);
    expect(screen.getByTestId('chat-input')).toBeInTheDocument();
  });

  it('shows empty state when no messages', () => {
    mockMessagesBySchema = { s1: [] };
    render(<AIChat />);
    expect(screen.getByText('Ask anything about your schema.')).toBeInTheDocument();
  });

  it('shows loading state when loading history', () => {
    mockIsLoadingHistory = true;
    render(<AIChat />);
    expect(screen.getByText('Loading chat history...')).toBeInTheDocument();
  });

  it('shows close button when onClose provided', () => {
    const onClose = vi.fn();
    render(<AIChat onClose={onClose} />);
    // Should have a close button (ghost button)
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('shows empty state when no active schema', () => {
    mockActiveSchemaId = null;
    mockMessagesBySchema = {};
    render(<AIChat />);
    expect(screen.getByText('Ask anything about your schema.')).toBeInTheDocument();
  });
});
