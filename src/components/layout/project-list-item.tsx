'use client';

import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { MoreHorizontal, Pencil, Trash2, Copy } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { SchemaListItem } from '@/lib/types';

interface ProjectListItemProps {
  schema: SchemaListItem;
  isActive: boolean;
  onSelect: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
}

export function ProjectListItem({
  schema,
  isActive,
  onSelect,
  onRename,
  onDelete,
  onDuplicate,
}: ProjectListItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(schema.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  const handleRenameSubmit = () => {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== schema.name) {
      onRename(schema.id, trimmed);
    } else {
      setEditName(schema.name);
    }
    setIsEditing(false);
  };

  return (
    <div
      className={cn(
        'group flex items-center gap-1.5 rounded-md px-2 py-1 text-xs cursor-pointer transition-colors',
        'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
        isActive && 'bg-sidebar-accent text-sidebar-accent-foreground'
      )}
      onClick={() => !isEditing && onSelect(schema.id)}
    >
      {isEditing ? (
        <input
          ref={inputRef}
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onBlur={handleRenameSubmit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleRenameSubmit();
            if (e.key === 'Escape') {
              setEditName(schema.name);
              setIsEditing(false);
            }
          }}
          className="flex-1 min-w-0 bg-transparent border border-sidebar-border rounded px-1 py-0.5 text-xs outline-none focus:ring-1 focus:ring-sidebar-primary"
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span className="flex-1 min-w-0 truncate">{schema.name}</span>
      )}

      <Badge
        variant="outline"
        className="text-[9px] px-1 py-0 h-4 shrink-0 uppercase opacity-60"
      >
        {{ mysql: 'MY', postgresql: 'PG', sqlite: 'SQ' }[schema.dialect] ?? schema.dialect.slice(0, 2)}
      </Badge>

      <DropdownMenu>
        <DropdownMenuTrigger
          className="h-5 w-5 shrink-0 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 hover:bg-sidebar-accent transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal className="h-3 w-3" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-36">
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              setEditName(schema.name);
              setIsEditing(true);
            }}
          >
            <Pencil className="h-3 w-3 mr-2" />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              onDuplicate(schema.id);
            }}
          >
            <Copy className="h-3 w-3 mr-2" />
            Duplicate
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(schema.id);
            }}
          >
            <Trash2 className="h-3 w-3 mr-2" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
