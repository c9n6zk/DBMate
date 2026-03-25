'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Database,
  FileUp,
  ClipboardPaste,
  LayoutTemplate,
  Loader2,
  ArrowLeft,
  ArrowRight,
  Plus,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SQLEditor } from '@/components/import/sql-editor';
import { FileDropzone } from '@/components/import/file-dropzone';
import { TemplateGallery } from '@/components/import/template-gallery';
import { useSchemaStore } from '@/stores/schema-store';
import { useSettingsStore } from '@/stores/settings-store';
import type { Dialect } from '@/lib/types';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type ImportMethod = 'empty' | 'paste' | 'upload' | 'template';

interface NewProjectWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** If provided, skip step 1 and jump straight to step 2 with this method pre-selected */
  initialMethod?: ImportMethod;
}

const DIALECT_OPTIONS: { value: Dialect; label: string }[] = [
  { value: 'postgresql', label: 'PostgreSQL' },
  { value: 'mysql', label: 'MySQL' },
  { value: 'sqlite', label: 'SQLite' },
];

const METHOD_OPTIONS: {
  value: ImportMethod;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    value: 'empty',
    label: 'Start Empty',
    description: 'Create a blank project and build from scratch',
    icon: Plus,
  },
  {
    value: 'paste',
    label: 'Paste SQL',
    description: 'Paste your CREATE TABLE statements',
    icon: ClipboardPaste,
  },
  {
    value: 'upload',
    label: 'Upload File',
    description: 'Import a .sql or .txt file',
    icon: FileUp,
  },
  {
    value: 'template',
    label: 'Template',
    description: 'Start from a pre-built schema',
    icon: LayoutTemplate,
  },
];

export function NewProjectWizard({
  open,
  onOpenChange,
  initialMethod,
}: NewProjectWizardProps) {
  const router = useRouter();
  const { settings } = useSettingsStore();

  // Step 1 state
  const [projectName, setProjectName] = useState('');
  const [dialect, setDialect] = useState<Dialect>(settings.dialect);

  // Step 2 state
  const [step, setStep] = useState<1 | 2>(1);
  const [method, setMethod] = useState<ImportMethod | null>(
    initialMethod ?? null
  );
  const [sql, setSql] = useState('');
  const [isBusy, setIsBusy] = useState(false);

  // Sync initialMethod prop when dialog opens with a specific method
  useEffect(() => {
    if (open && initialMethod) {
      setMethod(initialMethod);
    }
  }, [open, initialMethod]);

  const reset = useCallback(() => {
    setProjectName('');
    setDialect(settings.dialect);
    setStep(1);
    setMethod(initialMethod ?? null);
    setSql('');
    setIsBusy(false);
  }, [settings.dialect, initialMethod]);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) reset();
      onOpenChange(open);
    },
    [onOpenChange, reset]
  );

  // ── Step 1 → Step 2 ──
  const goToStep2 = () => {
    if (!projectName.trim()) {
      toast.error('Please enter a project name.');
      return;
    }
    setStep(2);
  };

  // ── Create empty project ──
  const handleCreateEmpty = async () => {
    setIsBusy(true);
    try {
      await useSchemaStore.getState().createSchema(projectName.trim(), dialect);
      toast.success('Project created');
      handleOpenChange(false);
      router.push('/dashboard');
    } catch {
      toast.error('Failed to create project');
    } finally {
      setIsBusy(false);
    }
  };

  // ── Import SQL (paste or upload or template) ──
  const handleImportSQL = async () => {
    if (!sql.trim()) {
      toast.error('Please enter or upload SQL first.');
      return;
    }
    setIsBusy(true);
    try {
      await useSchemaStore
        .getState()
        .importSchema(sql, dialect, projectName.trim());
      const schema = useSchemaStore.getState().currentSchema;
      toast.success(
        `Schema parsed: ${schema?.tables.length ?? 0} tables found`
      );
      handleOpenChange(false);
      router.push('/dashboard');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Parse failed';
      toast.error(message);
    } finally {
      setIsBusy(false);
    }
  };

  // ── Method selected → either create empty or show SQL input ──
  const handleMethodSelect = (m: ImportMethod) => {
    setMethod(m);
    if (m === 'empty') {
      handleCreateEmpty();
    }
  };

  const handleFileContent = useCallback(
    (content: string, fileName: string) => {
      setSql(content);
      if (!projectName.trim() && fileName) {
        setProjectName(fileName.replace(/\.(sql|txt)$/i, ''));
      }
      toast.success('File loaded');
    },
    [projectName]
  );

  const handleTemplateSelect = useCallback(
    (templateSql: string, templateDialect: Dialect, templateName: string) => {
      setSql(templateSql);
      setDialect(templateDialect);
      if (!projectName.trim()) setProjectName(templateName);
      toast.success('Template loaded');
    },
    [projectName]
  );

  // Determine dialog width based on step/method
  const isWide =
    step === 2 && method !== null && method !== 'empty';
  const isExtraWide = step === 2 && method === 'template';

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className={cn(
          'transition-all duration-200 max-h-[85vh] overflow-y-auto',
          isExtraWide
            ? 'max-w-3xl'
            : isWide
              ? 'max-w-2xl'
              : 'max-w-md'
        )}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="h-4 w-4 text-primary" />
            {step === 1
              ? 'New Project'
              : method && method !== 'empty'
                ? 'Import Schema'
                : 'Choose How to Start'}
          </DialogTitle>
        </DialogHeader>

        {/* ── STEP 1: Name + Dialect ── */}
        {step === 1 && (
          <div className="flex flex-col gap-4 pt-1">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="wizard-name" className="text-xs">
                Project Name
              </Label>
              <Input
                id="wizard-name"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="My Database"
                className="h-9 text-sm max-w-xs mx-auto w-full"
                onKeyDown={(e) => e.key === 'Enter' && goToStep2()}
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Database Dialect</Label>
              <div className="flex gap-2">
                {DIALECT_OPTIONS.map((d) => (
                  <button
                    key={d.value}
                    onClick={() => setDialect(d.value)}
                    className={cn(
                      'px-3 py-1.5 rounded-md text-xs font-medium border transition-colors flex-1',
                      dialect === d.value
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background border-border hover:bg-muted'
                    )}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
            <Button
              onClick={goToStep2}
              disabled={!projectName.trim()}
              className="h-9 text-sm max-w-xs mx-auto w-full"
            >
              Next
              <ArrowRight className="ml-2 h-3.5 w-3.5" />
            </Button>
          </div>
        )}

        {/* ── STEP 2: Choose method ── */}
        {step === 2 && !method && (
          <div className="flex flex-col gap-3 pt-1">
            <button
              onClick={() => setStep(1)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors w-fit"
            >
              <ArrowLeft className="h-3 w-3" />
              Back
            </button>
            <div className="grid grid-cols-2 gap-2">
              {METHOD_OPTIONS.map((m) => (
                <button
                  key={m.value}
                  onClick={() => handleMethodSelect(m.value)}
                  disabled={isBusy}
                  className={cn(
                    'flex flex-col items-center gap-2 p-4 rounded-lg border border-border transition-all text-center',
                    'hover:border-primary/50 hover:bg-primary/5',
                    isBusy && 'opacity-50 pointer-events-none'
                  )}
                >
                  <m.icon className="h-6 w-6 text-primary" />
                  <span className="text-sm font-medium">{m.label}</span>
                  <span className="text-[11px] text-muted-foreground leading-tight">
                    {m.description}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── STEP 2b: Paste SQL ── */}
        {step === 2 && method === 'paste' && (
          <div className="flex flex-col gap-3 pt-1">
            <button
              onClick={() => setMethod(null)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors w-fit"
            >
              <ArrowLeft className="h-3 w-3" />
              Back
            </button>
            <SQLEditor
              value={sql}
              onChange={setSql}
              dialect={dialect}
              className="min-h-48 max-h-[40vh]"
            />
            <Button
              onClick={handleImportSQL}
              disabled={isBusy || !sql.trim()}
              className="h-9 text-sm max-w-xs mx-auto w-full"
            >
              {isBusy ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Parse & Create
            </Button>
          </div>
        )}

        {/* ── STEP 2b: Upload File ── */}
        {step === 2 && method === 'upload' && (
          <div className="flex flex-col gap-3 pt-1">
            <button
              onClick={() => setMethod(null)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors w-fit"
            >
              <ArrowLeft className="h-3 w-3" />
              Back
            </button>
            <FileDropzone onFileContent={handleFileContent} />
            {sql && (
              <SQLEditor
                value={sql}
                onChange={setSql}
                dialect={dialect}
                className="min-h-36 max-h-[30vh]"
              />
            )}
            <Button
              onClick={handleImportSQL}
              disabled={isBusy || !sql.trim()}
              className="h-9 text-sm max-w-xs mx-auto w-full"
            >
              {isBusy ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Parse & Create
            </Button>
          </div>
        )}

        {/* ── STEP 2b: Template ── */}
        {step === 2 && method === 'template' && (
          <div className="flex flex-col gap-3 pt-1">
            <button
              onClick={() => setMethod(null)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors w-fit"
            >
              <ArrowLeft className="h-3 w-3" />
              Back
            </button>
            <TemplateGallery
              onSelect={handleTemplateSelect}
              className="grid grid-cols-2 gap-3"
            />
            {sql && (
              <>
                <SQLEditor
                  value={sql}
                  onChange={setSql}
                  dialect={dialect}
                  className="min-h-36 max-h-[30vh]"
                />
                <Button
                  onClick={handleImportSQL}
                  disabled={isBusy || !sql.trim()}
                  className="h-9 text-sm max-w-xs mx-auto w-full"
                >
                  {isBusy ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Parse & Create
                </Button>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
