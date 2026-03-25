/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { IssuesList } from '../optimizer/issues-list';
import type { AnalysisIssue } from '@/lib/types';

vi.mock('@/components/ui/input', () => ({
  Input: (props: any) => <input {...props} />,
}));
vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, ...props }: any) => <span {...props}>{children}</span>,
}));
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} {...props}>{children}</button>
  ),
}));
vi.mock('../optimizer/issue-card', () => ({
  IssueCard: ({ issue, onDismiss }: any) => (
    <div data-testid={`issue-${issue.id}`}>
      <span>{issue.title}</span>
      <button onClick={() => onDismiss(issue.id)}>dismiss</button>
    </div>
  ),
}));

const issues: AnalysisIssue[] = [
  { id: 'p1', type: 'performance', severity: 'critical', title: 'Missing PK', affectedTable: 'users', fixSQL: 'ALTER...' },
  { id: 's1', type: 'security', severity: 'warning', title: 'Plain text password', affectedTable: 'users' },
  { id: 'n1', type: 'normalization', severity: 'info', title: '3NF violation', affectedTable: 'orders', fixSQL: 'ALTER...' },
  { id: 'c1', type: 'convention', severity: 'info', title: 'Mixed naming', affectedTable: 'products' },
];

describe('IssuesList', () => {
  const onApplyFix = vi.fn();

  it('renders all issues', () => {
    render(<IssuesList issues={issues} onApplyFix={onApplyFix} isApplying={false} />);
    expect(screen.getByText('Missing PK')).toBeInTheDocument();
    expect(screen.getByText('Plain text password')).toBeInTheDocument();
    expect(screen.getByText('3NF violation')).toBeInTheDocument();
    expect(screen.getByText('Mixed naming')).toBeInTheDocument();
  });

  it('shows filter buttons with counts', () => {
    render(<IssuesList issues={issues} onApplyFix={onApplyFix} isApplying={false} />);
    expect(screen.getByText('All')).toBeInTheDocument();
    expect(screen.getByText('Performance')).toBeInTheDocument();
    expect(screen.getByText('Security')).toBeInTheDocument();
    expect(screen.getByText('Normalization')).toBeInTheDocument();
    expect(screen.getByText('Convention')).toBeInTheDocument();
  });

  it('filters by type when button clicked', () => {
    render(<IssuesList issues={issues} onApplyFix={onApplyFix} isApplying={false} />);
    fireEvent.click(screen.getByText('Security'));
    expect(screen.getByText('Plain text password')).toBeInTheDocument();
    expect(screen.queryByText('Missing PK')).not.toBeInTheDocument();
  });

  it('filters by search text', () => {
    render(<IssuesList issues={issues} onApplyFix={onApplyFix} isApplying={false} />);
    const searchInput = screen.getByPlaceholderText('Search issues...');
    fireEvent.change(searchInput, { target: { value: 'password' } });
    expect(screen.getByText('Plain text password')).toBeInTheDocument();
    expect(screen.queryByText('Missing PK')).not.toBeInTheDocument();
  });

  it('searches by table name', () => {
    render(<IssuesList issues={issues} onApplyFix={onApplyFix} isApplying={false} />);
    const searchInput = screen.getByPlaceholderText('Search issues...');
    fireEvent.change(searchInput, { target: { value: 'orders' } });
    expect(screen.getByText('3NF violation')).toBeInTheDocument();
    expect(screen.queryByText('Missing PK')).not.toBeInTheDocument();
  });

  it('dismisses issue when dismiss clicked', () => {
    render(<IssuesList issues={issues} onApplyFix={onApplyFix} isApplying={false} />);
    const dismissButtons = screen.getAllByText('dismiss');
    fireEvent.click(dismissButtons[0]); // dismiss first issue
    expect(screen.queryByTestId('issue-p1')).not.toBeInTheDocument();
  });

  it('shows empty state when no issues', () => {
    render(<IssuesList issues={[]} onApplyFix={onApplyFix} isApplying={false} />);
    expect(screen.getByText(/No issues found/)).toBeInTheDocument();
  });

  it('shows "No matching issues" when all filtered out', () => {
    render(<IssuesList issues={issues} onApplyFix={onApplyFix} isApplying={false} />);
    const searchInput = screen.getByPlaceholderText('Search issues...');
    fireEvent.change(searchInput, { target: { value: 'zzzznotfound' } });
    expect(screen.getByText('No matching issues.')).toBeInTheDocument();
  });

  it('shows Apply All Fixes button with count', () => {
    render(<IssuesList issues={issues} onApplyFix={onApplyFix} isApplying={false} />);
    expect(screen.getByText(/Apply All Fixes/)).toBeInTheDocument();
  });

  it('shows Expand All button', () => {
    render(<IssuesList issues={issues} onApplyFix={onApplyFix} isApplying={false} />);
    expect(screen.getByText(/Expand All/)).toBeInTheDocument();
  });

  it('toggles to Collapse All on click', () => {
    render(<IssuesList issues={issues} onApplyFix={onApplyFix} isApplying={false} />);
    fireEvent.click(screen.getByText(/Expand All/));
    expect(screen.getByText(/Collapse All/)).toBeInTheDocument();
  });

  it('calls onApplyAll when provided', () => {
    const onApplyAll = vi.fn();
    render(<IssuesList issues={issues} onApplyFix={onApplyFix} onApplyAll={onApplyAll} isApplying={false} />);
    fireEvent.click(screen.getByText(/Apply All Fixes/));
    expect(onApplyAll).toHaveBeenCalled();
  });

  it('calls onApplyFix for each fixable issue when onApplyAll not provided', () => {
    onApplyFix.mockReset();
    render(<IssuesList issues={issues} onApplyFix={onApplyFix} isApplying={false} />);
    fireEvent.click(screen.getByText(/Apply All Fixes/));
    // 2 issues have fixSQL: p1 and n1
    expect(onApplyFix).toHaveBeenCalledTimes(2);
  });
});
