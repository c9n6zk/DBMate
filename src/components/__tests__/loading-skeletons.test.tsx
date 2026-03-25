/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import {
  DashboardSkeleton,
  OptimizerSkeleton,
  MigrationsSkeleton,
  ExportSkeleton,
  SeedSkeleton,
} from '../shared/loading-skeletons';

vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: ({ className }: { className: string }) => <div data-testid="skeleton" className={className} />,
}));
vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: any) => <div data-testid="card">{children}</div>,
  CardContent: ({ children }: any) => <div>{children}</div>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
}));

describe('Loading Skeletons', () => {
  it('DashboardSkeleton renders without errors', () => {
    const { container } = render(<DashboardSkeleton />);
    expect(container.querySelectorAll('[data-testid="skeleton"]').length).toBeGreaterThan(0);
  });

  it('OptimizerSkeleton renders without errors', () => {
    const { container } = render(<OptimizerSkeleton />);
    expect(container.querySelectorAll('[data-testid="skeleton"]').length).toBeGreaterThan(0);
  });

  it('MigrationsSkeleton renders without errors', () => {
    const { container } = render(<MigrationsSkeleton />);
    expect(container.querySelectorAll('[data-testid="skeleton"]').length).toBeGreaterThan(0);
  });

  it('ExportSkeleton renders without errors', () => {
    const { container } = render(<ExportSkeleton />);
    expect(container.querySelectorAll('[data-testid="skeleton"]').length).toBeGreaterThan(0);
  });

  it('SeedSkeleton renders without errors', () => {
    const { container } = render(<SeedSkeleton />);
    expect(container.querySelectorAll('[data-testid="skeleton"]').length).toBeGreaterThan(0);
  });
});
