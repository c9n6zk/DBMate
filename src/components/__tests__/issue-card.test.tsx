/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { IssueCard } from '../optimizer/issue-card';
import type { AnalysisIssue } from '@/lib/types';

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} {...props}>{children}</button>
  ),
}));
vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, ...props }: any) => <span {...props}>{children}</span>,
}));

const mockIssue: AnalysisIssue = {
  id: 'issue-1',
  type: 'performance',
  severity: 'critical',
  title: 'Missing primary key on orders',
  description: 'No PK found',
  affectedTable: 'orders',
  affectedColumns: ['id'],
  fixSQL: 'ALTER TABLE orders ADD COLUMN id INT PRIMARY KEY;',
  estimatedImpact: 'high',
};

describe('IssueCard', () => {
  const onApplyFix = vi.fn();
  const onDismiss = vi.fn();

  it('renders issue title', () => {
    render(
      <IssueCard issue={mockIssue} onApplyFix={onApplyFix} onDismiss={onDismiss} isApplying={false} />
    );
    expect(screen.getByText('Missing primary key on orders')).toBeInTheDocument();
  });

  it('renders severity badge', () => {
    render(
      <IssueCard issue={mockIssue} onApplyFix={onApplyFix} onDismiss={onDismiss} isApplying={false} />
    );
    expect(screen.getByText('Critical')).toBeInTheDocument();
  });

  it('renders type badge', () => {
    render(
      <IssueCard issue={mockIssue} onApplyFix={onApplyFix} onDismiss={onDismiss} isApplying={false} />
    );
    expect(screen.getByText('performance')).toBeInTheDocument();
  });

  it('renders impact level', () => {
    render(
      <IssueCard issue={mockIssue} onApplyFix={onApplyFix} onDismiss={onDismiss} isApplying={false} />
    );
    expect(screen.getByText('high')).toBeInTheDocument();
  });

  it('expands on click to show details', () => {
    render(
      <IssueCard issue={mockIssue} onApplyFix={onApplyFix} onDismiss={onDismiss} isApplying={false} />
    );
    // Click the header to expand
    fireEvent.click(screen.getByText('Missing primary key on orders'));
    expect(screen.getByText('orders')).toBeInTheDocument();
    expect(screen.getByText(/ALTER TABLE/)).toBeInTheDocument();
  });

  it('shows fix SQL in expanded view', () => {
    render(
      <IssueCard issue={mockIssue} onApplyFix={onApplyFix} onDismiss={onDismiss} isApplying={false} forceExpanded />
    );
    expect(screen.getByText(/ALTER TABLE orders ADD COLUMN id/)).toBeInTheDocument();
  });

  it('calls onApplyFix when Apply button clicked', () => {
    render(
      <IssueCard issue={mockIssue} onApplyFix={onApplyFix} onDismiss={onDismiss} isApplying={false} forceExpanded />
    );
    fireEvent.click(screen.getByText('Apply'));
    expect(onApplyFix).toHaveBeenCalledWith(mockIssue);
  });

  it('calls onDismiss when Dismiss button clicked', () => {
    render(
      <IssueCard issue={mockIssue} onApplyFix={onApplyFix} onDismiss={onDismiss} isApplying={false} forceExpanded />
    );
    fireEvent.click(screen.getByText('Dismiss'));
    expect(onDismiss).toHaveBeenCalledWith('issue-1');
  });

  it('renders warning severity', () => {
    const warningIssue = { ...mockIssue, severity: 'warning' as const };
    render(
      <IssueCard issue={warningIssue} onApplyFix={onApplyFix} onDismiss={onDismiss} isApplying={false} />
    );
    expect(screen.getByText('Warning')).toBeInTheDocument();
  });

  it('renders info severity', () => {
    const infoIssue = { ...mockIssue, severity: 'info' as const };
    render(
      <IssueCard issue={infoIssue} onApplyFix={onApplyFix} onDismiss={onDismiss} isApplying={false} />
    );
    expect(screen.getByText('Info')).toBeInTheDocument();
  });

  it('shows suggestion when no description', () => {
    const issueWithSuggestion = { ...mockIssue, description: undefined, suggestion: 'Use TEXT type' };
    render(
      <IssueCard issue={issueWithSuggestion} onApplyFix={onApplyFix} onDismiss={onDismiss} isApplying={false} forceExpanded />
    );
    expect(screen.getByText(/Use TEXT type/)).toBeInTheDocument();
  });

  it('hides Apply/Copy buttons when no fixSQL', () => {
    const noFixIssue = { ...mockIssue, fixSQL: undefined };
    render(
      <IssueCard issue={noFixIssue} onApplyFix={onApplyFix} onDismiss={onDismiss} isApplying={false} forceExpanded />
    );
    expect(screen.queryByText('Apply')).not.toBeInTheDocument();
    expect(screen.queryByText('Copy')).not.toBeInTheDocument();
    // Dismiss should still be there
    expect(screen.getByText('Dismiss')).toBeInTheDocument();
  });
});
