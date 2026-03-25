/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: any) => open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
}));
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} {...props}>{children}</button>
  ),
}));
vi.mock('@/components/ui/input', () => ({
  Input: (props: any) => <input {...props} />,
}));
vi.mock('@/components/ui/label', () => ({
  Label: ({ children, ...props }: any) => <label {...props}>{children}</label>,
}));
vi.mock('@/components/import/sql-editor', () => ({
  SQLEditor: (props: any) => <textarea data-testid="sql-editor" value={props.value} onChange={(e: any) => props.onChange(e.target.value)} />,
}));
vi.mock('@/components/import/file-dropzone', () => ({
  FileDropzone: ({ onFileContent }: any) => (
    <div data-testid="file-dropzone">
      <button onClick={() => onFileContent('CREATE TABLE t(id INT);', 'test.sql')}>mock-upload</button>
    </div>
  ),
}));
vi.mock('@/components/import/template-gallery', () => ({
  TemplateGallery: ({ onSelect }: any) => (
    <div data-testid="template-gallery">
      <button onClick={() => onSelect('CREATE TABLE t(id INT);', 'mysql', 'TestTemplate')}>load-template</button>
    </div>
  ),
}));
vi.mock('@/stores/schema-store', () => ({
  useSchemaStore: Object.assign(
    (selector: any) => {
      if (typeof selector === 'function') {
        return selector({
          createSchema: vi.fn().mockResolvedValue('new-id'),
          importSchema: vi.fn().mockResolvedValue(undefined),
          currentSchema: { tables: [{ name: 'test' }] },
        });
      }
    },
    { getState: () => ({
      createSchema: vi.fn().mockResolvedValue('new-id'),
      importSchema: vi.fn().mockResolvedValue(undefined),
      currentSchema: { tables: [{ name: 'test' }] },
    }) }
  ),
}));
vi.mock('@/stores/settings-store', () => {
  const storeState = { settings: { dialect: 'mysql' } };
  const useSettingsStore = (selector?: any) => {
    if (typeof selector === 'function') return selector(storeState);
    return storeState;
  };
  useSettingsStore.getState = () => storeState;
  return { useSettingsStore };
});
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { NewProjectWizard } from '../shared/new-project-wizard';

describe('NewProjectWizard', () => {
  const onOpenChange = vi.fn();

  it('renders step 1 when open', () => {
    render(<NewProjectWizard open={true} onOpenChange={onOpenChange} />);
    expect(screen.getByText('Project Name')).toBeInTheDocument();
  });

  it('shows dialect options', () => {
    render(<NewProjectWizard open={true} onOpenChange={onOpenChange} />);
    expect(screen.getByText('PostgreSQL')).toBeInTheDocument();
    expect(screen.getByText('MySQL')).toBeInTheDocument();
    expect(screen.getByText('SQLite')).toBeInTheDocument();
  });

  it('has Next button disabled when name is empty', () => {
    render(<NewProjectWizard open={true} onOpenChange={onOpenChange} />);
    const nextBtn = screen.getByText('Next');
    expect(nextBtn).toBeDisabled();
  });

  it('enables Next when name entered', () => {
    render(<NewProjectWizard open={true} onOpenChange={onOpenChange} />);
    fireEvent.change(screen.getByPlaceholderText('My Database'), { target: { value: 'Test' } });
    expect(screen.getByText('Next')).not.toBeDisabled();
  });

  it('goes to step 2 on Next click', () => {
    render(<NewProjectWizard open={true} onOpenChange={onOpenChange} />);
    fireEvent.change(screen.getByPlaceholderText('My Database'), { target: { value: 'Test' } });
    fireEvent.click(screen.getByText('Next'));
    expect(screen.getByText('Start Empty')).toBeInTheDocument();
    expect(screen.getByText('Paste SQL')).toBeInTheDocument();
  });

  it('shows Back button in step 2', () => {
    render(<NewProjectWizard open={true} onOpenChange={onOpenChange} />);
    fireEvent.change(screen.getByPlaceholderText('My Database'), { target: { value: 'Test' } });
    fireEvent.click(screen.getByText('Next'));
    expect(screen.getByText('Back')).toBeInTheDocument();
  });

  it('goes back to step 1 on Back click', () => {
    render(<NewProjectWizard open={true} onOpenChange={onOpenChange} />);
    fireEvent.change(screen.getByPlaceholderText('My Database'), { target: { value: 'Test' } });
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('Back'));
    expect(screen.getByText('Project Name')).toBeInTheDocument();
  });

  it('shows SQL editor on Paste SQL', () => {
    render(<NewProjectWizard open={true} onOpenChange={onOpenChange} />);
    fireEvent.change(screen.getByPlaceholderText('My Database'), { target: { value: 'T' } });
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('Paste SQL'));
    expect(screen.getByTestId('sql-editor')).toBeInTheDocument();
  });

  it('shows dropzone on Upload File', () => {
    render(<NewProjectWizard open={true} onOpenChange={onOpenChange} />);
    fireEvent.change(screen.getByPlaceholderText('My Database'), { target: { value: 'T' } });
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('Upload File'));
    expect(screen.getByTestId('file-dropzone')).toBeInTheDocument();
  });

  it('shows template gallery on Template', () => {
    render(<NewProjectWizard open={true} onOpenChange={onOpenChange} />);
    fireEvent.change(screen.getByPlaceholderText('My Database'), { target: { value: 'T' } });
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('Template'));
    expect(screen.getByTestId('template-gallery')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(<NewProjectWizard open={false} onOpenChange={onOpenChange} />);
    expect(screen.queryByText('Project Name')).not.toBeInTheDocument();
  });
});
