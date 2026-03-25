/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HealthScoreGauge } from '../optimizer/health-score-gauge';

// Mock ui components
vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: ({ className }: { className: string }) => <div data-testid="skeleton" className={className} />,
}));

describe('HealthScoreGauge', () => {
  it('shows skeleton when analyzing', () => {
    render(<HealthScoreGauge score={null} isAnalyzing={true} />);
    expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(0);
  });

  it('displays score value', () => {
    render(<HealthScoreGauge score={85} isAnalyzing={false} />);
    expect(screen.getByText('85')).toBeInTheDocument();
    expect(screen.getByText('/100')).toBeInTheDocument();
  });

  it('shows "Excellent" for score >= 90', () => {
    render(<HealthScoreGauge score={95} isAnalyzing={false} />);
    expect(screen.getByText('Excellent')).toBeInTheDocument();
  });

  it('shows "Good" for score 75-89', () => {
    render(<HealthScoreGauge score={80} isAnalyzing={false} />);
    expect(screen.getByText('Good')).toBeInTheDocument();
  });

  it('shows "Fair" for score 50-74', () => {
    render(<HealthScoreGauge score={60} isAnalyzing={false} />);
    expect(screen.getByText(/Fair/)).toBeInTheDocument();
  });

  it('shows "Poor" for score 25-49', () => {
    render(<HealthScoreGauge score={30} isAnalyzing={false} />);
    expect(screen.getByText(/Poor/)).toBeInTheDocument();
  });

  it('shows "Critical" for score < 25', () => {
    render(<HealthScoreGauge score={10} isAnalyzing={false} />);
    expect(screen.getByText(/Critical/)).toBeInTheDocument();
  });

  it('shows "Not analyzed yet" when score is null', () => {
    render(<HealthScoreGauge score={null} isAnalyzing={false} />);
    expect(screen.getByText('Not analyzed yet')).toBeInTheDocument();
  });

  it('displays 0 when score is null (displayScore fallback)', () => {
    render(<HealthScoreGauge score={null} isAnalyzing={false} />);
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('renders SVG circles', () => {
    const { container } = render(<HealthScoreGauge score={75} isAnalyzing={false} />);
    const circles = container.querySelectorAll('circle');
    expect(circles.length).toBe(2); // background + filled arc
  });
});
