/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TemplateGallery } from '../import/template-gallery';

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  CardContent: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  CardHeader: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  CardTitle: ({ children, ...props }: any) => <h3 {...props}>{children}</h3>,
}));
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props}>{children}</button>
  ),
}));
vi.mock('@/data/templates', () => ({
  ECOMMERCE_SQL: 'CREATE TABLE products (id INT);',
  BLOG_SQL: 'CREATE TABLE posts (id INT);',
  HEALTHCARE_SQL: 'CREATE TABLE patients (id INT);',
  LMS_SQL: 'CREATE TABLE courses (id INT);',
}));

describe('TemplateGallery', () => {
  const onSelect = vi.fn();

  it('renders 4 templates', () => {
    render(<TemplateGallery onSelect={onSelect} />);
    expect(screen.getByText('E-Commerce')).toBeInTheDocument();
    expect(screen.getByText('Blog')).toBeInTheDocument();
    expect(screen.getByText('Healthcare')).toBeInTheDocument();
    expect(screen.getByText('LMS')).toBeInTheDocument();
  });

  it('shows table counts', () => {
    render(<TemplateGallery onSelect={onSelect} />);
    expect(screen.getByText('8 tables')).toBeInTheDocument();
    expect(screen.getByText('6 tables')).toBeInTheDocument();
    expect(screen.getByText('12 tables')).toBeInTheDocument();
    expect(screen.getByText('9 tables')).toBeInTheDocument();
  });

  it('shows descriptions', () => {
    render(<TemplateGallery onSelect={onSelect} />);
    expect(screen.getByText(/Online store/)).toBeInTheDocument();
    expect(screen.getByText(/Blog platform/)).toBeInTheDocument();
  });

  it('has 4 Load buttons', () => {
    render(<TemplateGallery onSelect={onSelect} />);
    const loadButtons = screen.getAllByText('Load');
    expect(loadButtons).toHaveLength(4);
  });

  it('calls onSelect with correct args when Load clicked', () => {
    render(<TemplateGallery onSelect={onSelect} />);
    const loadButtons = screen.getAllByText('Load');
    fireEvent.click(loadButtons[0]); // E-Commerce
    expect(onSelect).toHaveBeenCalledWith(
      'CREATE TABLE products (id INT);',
      'mysql',
      'E-Commerce'
    );
  });

  it('accepts custom className', () => {
    const { container } = render(
      <TemplateGallery onSelect={onSelect} className="custom-class" />
    );
    expect(container.firstChild).toHaveClass('custom-class');
  });
});
