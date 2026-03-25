/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RouteError } from '../shared/route-error';

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props}>{children}</button>
  ),
}));

describe('RouteError', () => {
  const reset = vi.fn();
  const error = Object.assign(new Error('Something broke'), { digest: 'abc123' });

  it('renders title', () => {
    render(<RouteError title="Dashboard Error" error={error} reset={reset} />);
    expect(screen.getByText('Dashboard Error')).toBeInTheDocument();
  });

  it('renders error message', () => {
    render(<RouteError title="Error" error={error} reset={reset} />);
    expect(screen.getByText('Something broke')).toBeInTheDocument();
  });

  it('shows fallback message when error has no message', () => {
    const emptyError = Object.assign(new Error(''), {});
    render(<RouteError title="Error" error={emptyError} reset={reset} />);
    expect(screen.getByText('An unexpected error occurred.')).toBeInTheDocument();
  });

  it('calls reset when Try again clicked', () => {
    render(<RouteError title="Error" error={error} reset={reset} />);
    fireEvent.click(screen.getByText('Try again'));
    expect(reset).toHaveBeenCalled();
  });
});
