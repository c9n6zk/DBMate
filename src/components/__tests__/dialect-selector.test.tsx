/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DialectSelector } from '../import/dialect-selector';

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, ...props }: any) => <label {...props}>{children}</label>,
}));
vi.mock('@/components/ui/radio-group', () => ({
  RadioGroup: ({ children, value, onValueChange, ...props }: any) => (
    <div role="radiogroup" data-value={value} {...props}>{children}</div>
  ),
  RadioGroupItem: ({ value, id, ...props }: any) => (
    <input type="radio" value={value} id={id} {...props} />
  ),
}));

describe('DialectSelector', () => {
  const onChange = vi.fn();

  it('renders all 3 dialect options', () => {
    render(<DialectSelector value="mysql" onChange={onChange} />);
    expect(screen.getByText('MySQL')).toBeInTheDocument();
    expect(screen.getByText('PostgreSQL')).toBeInTheDocument();
    expect(screen.getByText('SQLite')).toBeInTheDocument();
  });

  it('renders Dialect label', () => {
    render(<DialectSelector value="mysql" onChange={onChange} />);
    expect(screen.getByText('Dialect:')).toBeInTheDocument();
  });

  it('has 3 radio inputs', () => {
    render(<DialectSelector value="mysql" onChange={onChange} />);
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(3);
  });
});
