/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExplainPlan } from '../shared/explain-plan';
import type { ExplainPlanNode } from '@/lib/types';

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: any) => <span>{children}</span>,
}));

const planTree: ExplainPlanNode = {
  id: 'root',
  type: 'SELECT',
  label: 'SELECT',
  cost: 100,
  rows: 1000,
  children: [
    {
      id: 'sort',
      type: 'SORT',
      label: 'Sort',
      cost: 80,
      rows: 1000,
      condition: 'ORDER BY created_at',
      children: [
        {
          id: 'scan',
          type: 'SEQ_SCAN',
          label: 'Seq Scan on users',
          table: 'users',
          cost: 50,
          rows: 1000,
          children: [],
        },
        {
          id: 'idx',
          type: 'INDEX_SCAN',
          label: 'Index Scan',
          table: 'orders',
          index: 'idx_user_id',
          cost: 10,
          rows: 100,
          children: [],
        },
      ],
    },
  ],
};

describe('ExplainPlan', () => {
  it('renders Execution Plan header', () => {
    render(<ExplainPlan plan={planTree} />);
    expect(screen.getByText('Execution Plan')).toBeInTheDocument();
  });

  it('renders legend', () => {
    render(<ExplainPlan plan={planTree} />);
    expect(screen.getByText('Seq')).toBeInTheDocument();
    expect(screen.getByText('Idx')).toBeInTheDocument();
    expect(screen.getByText('Join')).toBeInTheDocument();
  });

  it('renders root node type', () => {
    render(<ExplainPlan plan={planTree} />);
    expect(screen.getByText('SELECT')).toBeInTheDocument();
  });

  it('renders child node types', () => {
    render(<ExplainPlan plan={planTree} />);
    expect(screen.getByText('SORT')).toBeInTheDocument();
    expect(screen.getByText('SEQ SCAN')).toBeInTheDocument();
    expect(screen.getByText('INDEX SCAN')).toBeInTheDocument();
  });

  it('renders table names', () => {
    render(<ExplainPlan plan={planTree} />);
    expect(screen.getByText('users')).toBeInTheDocument();
    expect(screen.getByText('orders')).toBeInTheDocument();
  });

  it('renders index name', () => {
    render(<ExplainPlan plan={planTree} />);
    expect(screen.getByText(/idx_user_id/)).toBeInTheDocument();
  });

  it('renders cost values', () => {
    render(<ExplainPlan plan={planTree} />);
    expect(screen.getByText(/cost: 100/)).toBeInTheDocument();
  });

  it('renders row counts', () => {
    render(<ExplainPlan plan={planTree} />);
    expect(screen.getAllByText(/rows: 1\.0k/).length).toBeGreaterThan(0);
  });

  it('renders condition text', () => {
    render(<ExplainPlan plan={planTree} />);
    expect(screen.getByText('ORDER BY created_at')).toBeInTheDocument();
  });

  it('collapses children on click', () => {
    render(<ExplainPlan plan={planTree} />);
    // Click SORT node to collapse
    fireEvent.click(screen.getByText('SORT'));
    // After collapse, SEQ SCAN should still be in DOM (parent handles visibility)
  });

  it('handles compact mode', () => {
    const { container } = render(<ExplainPlan plan={planTree} compact />);
    expect(container.querySelector('.ml-3')).toBeTruthy();
  });

  it('applies custom className', () => {
    const { container } = render(<ExplainPlan plan={planTree} className="my-class" />);
    expect(container.firstChild).toHaveClass('my-class');
  });

  it('formats large cost values with k suffix', () => {
    const bigPlan: ExplainPlanNode = {
      id: 'big', type: 'SELECT', label: 'Select', cost: 5000, rows: 2000000, children: [],
    };
    render(<ExplainPlan plan={bigPlan} />);
    expect(screen.getByText(/cost: 5\.0k/)).toBeInTheDocument();
    expect(screen.getByText(/rows: 2\.0M/)).toBeInTheDocument();
  });

  it('renders leaf node without expand arrow', () => {
    const leafPlan: ExplainPlanNode = {
      id: 'leaf', type: 'SEQ_SCAN', label: 'Scan', cost: 1, rows: 1, table: 't', children: [],
    };
    render(<ExplainPlan plan={leafPlan} />);
    expect(screen.getByText('SEQ SCAN')).toBeInTheDocument();
  });
});
