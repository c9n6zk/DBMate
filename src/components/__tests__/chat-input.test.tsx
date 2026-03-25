/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChatInput } from '../chat/chat-input';

describe('ChatInput', () => {
  const onSend = vi.fn();

  beforeEach(() => onSend.mockReset());

  it('renders textarea with placeholder', () => {
    render(<ChatInput onSend={onSend} isGenerating={false} />);
    expect(screen.getByPlaceholderText('Message...')).toBeInTheDocument();
  });

  it('calls onSend when send button clicked', () => {
    render(<ChatInput onSend={onSend} isGenerating={false} />);
    const textarea = screen.getByPlaceholderText('Message...');
    fireEvent.change(textarea, { target: { value: 'Hello' } });
    fireEvent.click(screen.getByRole('button'));
    expect(onSend).toHaveBeenCalledWith('Hello');
  });

  it('clears input after send', () => {
    render(<ChatInput onSend={onSend} isGenerating={false} />);
    const textarea = screen.getByPlaceholderText('Message...') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'Hello' } });
    fireEvent.click(screen.getByRole('button'));
    expect(textarea.value).toBe('');
  });

  it('sends on Enter key', () => {
    render(<ChatInput onSend={onSend} isGenerating={false} />);
    const textarea = screen.getByPlaceholderText('Message...');
    fireEvent.change(textarea, { target: { value: 'Test' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });
    expect(onSend).toHaveBeenCalledWith('Test');
  });

  it('does not send on Shift+Enter', () => {
    render(<ChatInput onSend={onSend} isGenerating={false} />);
    const textarea = screen.getByPlaceholderText('Message...');
    fireEvent.change(textarea, { target: { value: 'Test' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });
    expect(onSend).not.toHaveBeenCalled();
  });

  it('does not send empty message', () => {
    render(<ChatInput onSend={onSend} isGenerating={false} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onSend).not.toHaveBeenCalled();
  });

  it('does not send whitespace-only message', () => {
    render(<ChatInput onSend={onSend} isGenerating={false} />);
    const textarea = screen.getByPlaceholderText('Message...');
    fireEvent.change(textarea, { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button'));
    expect(onSend).not.toHaveBeenCalled();
  });

  it('disables textarea when generating', () => {
    render(<ChatInput onSend={onSend} isGenerating={true} />);
    expect(screen.getByPlaceholderText('Message...')).toBeDisabled();
  });

  it('does not send when generating', () => {
    render(<ChatInput onSend={onSend} isGenerating={true} />);
    const textarea = screen.getByPlaceholderText('Message...');
    fireEvent.change(textarea, { target: { value: 'Hello' } });
    fireEvent.keyDown(textarea, { key: 'Enter' });
    expect(onSend).not.toHaveBeenCalled();
  });
});
