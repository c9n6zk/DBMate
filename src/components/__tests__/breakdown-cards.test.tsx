/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BreakdownCards } from '../optimizer/breakdown-cards';

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, ...props }: any) => <div data-testid="card" {...props}>{children}</div>,
  CardContent: ({ children, ...props }: any) => <div {...props}>{children}</div>,
}));
vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: ({ className }: { className: string }) => <div data-testid="skeleton" className={className} />,
}));

describe('BreakdownCards', () => {
  const breakdown = { performance: 20, security: 15, conventions: 25, normalization: 10 };

  it('renders 4 category cards', () => {
    render(<BreakdownCards breakdown={breakdown} isLoading={false} />);
    expect(screen.getAllByTestId('card')).toHaveLength(4);
  });

  it('displays category labels', () => {
    render(<BreakdownCards breakdown={breakdown} isLoading={false} />);
    expect(screen.getByText('Performance')).toBeInTheDocument();
    expect(screen.getByText('Security')).toBeInTheDocument();
    expect(screen.getByText('Conventions')).toBeInTheDocument();
    expect(screen.getByText('Normalization')).toBeInTheDocument();
  });

  it('displays score values', () => {
    render(<BreakdownCards breakdown={breakdown} isLoading={false} />);
    expect(screen.getByText('20')).toBeInTheDocument();
    expect(screen.getByText('15')).toBeInTheDocument();
    expect(screen.getByText('25')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
  });

  it('shows /25 denominators', () => {
    render(<BreakdownCards breakdown={breakdown} isLoading={false} />);
    expect(screen.getAllByText('/25')).toHaveLength(4);
  });

  it('shows skeletons when loading', () => {
    render(<BreakdownCards breakdown={null} isLoading={true} />);
    expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(0);
  });

  it('shows 0 values when breakdown is null and not loading', () => {
    render(<BreakdownCards breakdown={null} isLoading={false} />);
    expect(screen.getAllByText('0')).toHaveLength(4);
  });
});
