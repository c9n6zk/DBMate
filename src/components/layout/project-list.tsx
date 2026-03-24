'use client';

import { useState } from 'react';
import { Plus, FolderOpen } from 'lucide-react';
import { useSchemaStore } from '@/stores/schema-store';
import { ProjectListItem } from './project-list-item';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { NewProjectWizard } from '@/components/shared/new-project-wizard';
import { toast } from 'sonner';

interface ProjectListProps {
  collapsed: boolean;
}

export function ProjectList({ collapsed }: ProjectListProps) {
  const schemaList = useSchemaStore((s) => s.schemaList);
  const activeSchemaId = useSchemaStore((s) => s.activeSchemaId);
  const isDirty = useSchemaStore((s) => s.isDirty);
  const isSwitching = useSchemaStore((s) => s.isSwitching);

  const [showNewDialog, setShowNewDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  const handleSelect = async (id: string) => {
    if (isSwitching) return;

    if (isDirty) {
      const save = window.confirm(
        'You have unsaved changes. Save before switching?'
      );
      if (save) {
        await useSchemaStore.getState().saveCurrentSchema();
      }
    }

    await useSchemaStore.getState().loadSchema(id);
  };

  const handleRename = async (id: string, name: string) => {
    try {
      await useSchemaStore.getState().renameSchema(id, name);
      toast.success('Renamed');
    } catch {
      toast.error('Failed to rename');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await useSchemaStore.getState().deleteSchema(id);
      toast.success('Deleted');
      setShowDeleteConfirm(null);
    } catch {
      toast.error('Failed to delete');
    }
  };

  const handleDuplicate = async (id: string) => {
    try {
      await useSchemaStore.getState().duplicateSchema(id);
      toast.success('Duplicated');
    } catch {
      toast.error('Failed to duplicate');
    }
  };

  const deleteTarget = schemaList.find((s) => s.id === showDeleteConfirm);

  if (collapsed) {
    return (
      <button
        onClick={() => setShowNewDialog(true)}
        className="flex items-center justify-center h-7 w-7 mx-auto rounded-md text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
        title="Projects"
      >
        <FolderOpen className="h-3.5 w-3.5" />
      </button>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-0.5 h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-2.5 pt-1">
          <span className="text-[10px] font-semibold uppercase text-sidebar-foreground/50 tracking-wider">
            Projects
          </span>
          <button
            onClick={() => setShowNewDialog(true)}
            className="h-4 w-4 flex items-center justify-center rounded text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
            title="New project"
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>

        {/* List */}
        {schemaList.length === 0 ? (
          <div className="px-2.5 py-2 text-[10px] text-sidebar-foreground/40">
            No projects yet. Import a schema or create one.
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin">
            <div className="flex flex-col gap-0.5 px-1">
              {schemaList.map((schema) => (
                <ProjectListItem
                  key={schema.id}
                  schema={schema}
                  isActive={schema.id === activeSchemaId}
                  onSelect={handleSelect}
                  onRename={handleRename}
                  onDelete={(id) => setShowDeleteConfirm(id)}
                  onDuplicate={handleDuplicate}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* New project wizard */}
      <NewProjectWizard open={showNewDialog} onOpenChange={setShowNewDialog} />

      {/* Delete confirmation dialog */}
      <Dialog
        open={!!showDeleteConfirm}
        onOpenChange={(open) => !open && setShowDeleteConfirm(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Project</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Delete &quot;{deleteTarget?.name}&quot;? This will permanently remove
            all versions, migrations, and query history.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDeleteConfirm(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => showDeleteConfirm && handleDelete(showDeleteConfirm)}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
