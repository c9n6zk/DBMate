'use client';

import { useCallback, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MAX_SQL_INPUT_SIZE } from '@/lib/validations';

interface FileDropzoneProps {
  onFileContent: (content: string, fileName: string) => void;
}

export function FileDropzone({ onFileContent }: FileDropzoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (file: File) => {
      setError(null);

      if (!file.name.endsWith('.sql') && !file.name.endsWith('.txt')) {
        setError('Only .sql and .txt files are supported.');
        return;
      }

      if (file.size > MAX_SQL_INPUT_SIZE) {
        setError(`File too large (max ${MAX_SQL_INPUT_SIZE / 1000}KB).`);
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result;
        if (typeof content === 'string') {
          onFileContent(content, file.name);
        }
      };
      reader.onerror = () => setError('Failed to read file.');
      reader.readAsText(file);
    },
    [onFileContent]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  return (
    <div className="space-y-2">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          'flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8 cursor-pointer transition-colors',
          isDragOver
            ? 'border-primary bg-primary/5'
            : 'border-border hover:border-primary/50'
        )}
      >
        <Upload className="h-8 w-8 text-muted-foreground" />
        <div className="text-center">
          <p className="text-sm font-medium">
            Drag & drop your .sql file here
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            or click to browse (max {MAX_SQL_INPUT_SIZE / 1000}KB)
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".sql,.txt"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
