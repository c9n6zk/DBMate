'use client';

import { useState } from 'react';
import {
  Database,
  Plus,
  ClipboardPaste,
  FileUp,
  LayoutTemplate,
} from 'lucide-react';
import { NewProjectWizard } from '@/components/shared/new-project-wizard';
import { PageTransition } from '@/components/shared/motion';

type ImportMethod = 'empty' | 'paste' | 'upload' | 'template';

const ACTIONS: {
  method?: ImportMethod;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    label: 'New Project',
    description: 'Create a project from scratch or import SQL',
    icon: Plus,
  },
  {
    method: 'paste',
    label: 'Paste SQL',
    description: 'Paste your CREATE TABLE statements',
    icon: ClipboardPaste,
  },
  {
    method: 'upload',
    label: 'Upload File',
    description: 'Import a .sql or .txt file',
    icon: FileUp,
  },
  {
    method: 'template',
    label: 'From Template',
    description: 'Start from a pre-built schema',
    icon: LayoutTemplate,
  },
];

export default function ImportPage() {
  const [wizardOpen, setWizardOpen] = useState(false);
  const [initialMethod, setInitialMethod] = useState<
    ImportMethod | undefined
  >();

  const openWizard = (method?: ImportMethod) => {
    setInitialMethod(method);
    setWizardOpen(true);
  };

  return (
    <PageTransition>
      <div className="flex flex-col items-center justify-center gap-6 sm:gap-8 max-w-2xl mx-auto min-h-[60vh] px-2 sm:px-0">
        {/* Hero */}
        <div className="flex flex-col items-center gap-3 text-center">
          <Database className="h-10 w-10 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">
            Welcome to DBMate
          </h1>
          <p className="text-sm text-muted-foreground max-w-md">
            Design, optimize, and manage your database schemas.
            Create a new project or import an existing SQL schema to get started.
          </p>
        </div>

        {/* Action cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full">
          {ACTIONS.map((action) => (
            <button
              key={action.label}
              onClick={() => openWizard(action.method)}
              className="flex flex-col items-center gap-2 sm:gap-2.5 p-3 sm:p-5 rounded-lg border border-border transition-all text-center hover:border-primary/50 hover:bg-primary/5 hover:shadow-sm"
            >
              <action.icon className="h-7 w-7 text-primary" />
              <span className="text-sm font-medium">{action.label}</span>
              <span className="text-[11px] text-muted-foreground leading-tight">
                {action.description}
              </span>
            </button>
          ))}
        </div>
      </div>

      <NewProjectWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        initialMethod={initialMethod}
      />
    </PageTransition>
  );
}
