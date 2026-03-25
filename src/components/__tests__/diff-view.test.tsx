/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DiffView } from '../shared/diff-view';

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props}>{children}</button>
  ),
}));

describe('DiffView', () => {
  const original = 'line1\nline2\nline3';
  const modified = 'line1\nline2_modified\nline3\nline4';

  it('renders inline mode by default', () => {
    render(<DiffView original={original} modified={modified} />);
    expect(screen.getByText('Inline')).toBeInTheDocument();
    expect(screen.getByText('Side by side')).toBeInTheDocument();
  });

  it('shows addition/deletion stats', () => {
    render(<DiffView original={original} modified={modified} />);
    // Should show + and - counts
    const addedEl = screen.getByText(/\+\d/);
    const removedEl = screen.getByText(/-\d/);
    expect(addedEl).toBeInTheDocument();
    expect(removedEl).toBeInTheDocument();
  });

  it('switches to side-by-side mode on button click', () => {
    render(<DiffView original={original} modified={modified} />);
    fireEvent.click(screen.getByText('Side by side'));
    // Should show column titles
    expect(screen.getByText('Original')).toBeInTheDocument();
    expect(screen.getByText('Modified')).toBeInTheDocument();
  });

  it('uses custom titles in side-by-side mode', () => {
    render(
      <DiffView
        original={original}
        modified={modified}
        originalTitle="Before"
        modifiedTitle="After"
      />
    );
    fireEvent.click(screen.getByText('Side by side'));
    expect(screen.getByText('Before')).toBeInTheDocument();
    expect(screen.getByText('After')).toBeInTheDocument();
  });

  it('shows diff markers (+/-) in inline mode', () => {
    const { container } = render(
      <DiffView original="old line" modified="new line" />
    );
    const text = container.textContent;
    expect(text).toContain('+');
    expect(text).toContain('-');
  });

  it('handles identical content', () => {
    render(<DiffView original="same" modified="same" />);
    expect(screen.getByText('+0')).toBeInTheDocument();
    expect(screen.getByText('-0')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <DiffView original="" modified="" className="my-class" />
    );
    expect(container.firstChild).toHaveClass('my-class');
  });
});
