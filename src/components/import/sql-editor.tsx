'use client';

import { useEffect, useRef } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, placeholder } from '@codemirror/view';
import { sql, MySQL, PostgreSQL, SQLite } from '@codemirror/lang-sql';
import { oneDark } from '@codemirror/theme-one-dark';
import { basicSetup } from 'codemirror';
import { useTheme } from 'next-themes';
import type { Dialect } from '@/lib/types';

const DIALECT_MAP = {
  mysql: MySQL,
  postgresql: PostgreSQL,
  sqlite: SQLite,
} as const;

interface SQLEditorProps {
  value: string;
  onChange: (value: string) => void;
  dialect: Dialect;
  readOnly?: boolean;
  className?: string;
}

export function SQLEditor({
  value,
  onChange,
  dialect,
  readOnly = false,
  className = '',
}: SQLEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    if (!containerRef.current) return;

    const extensions = [
      basicSetup,
      sql({ dialect: DIALECT_MAP[dialect] }),
      placeholder('-- Paste your CREATE TABLE statements here...'),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          onChange(update.state.doc.toString());
        }
      }),
      EditorView.theme({
        '&': { height: '100%', fontSize: '14px' },
        '.cm-scroller': { overflow: 'auto' },
        '.cm-content': { minHeight: '200px' },
      }),
    ];

    if (resolvedTheme === 'dark') {
      extensions.push(oneDark);
    }

    if (readOnly) {
      extensions.push(EditorState.readOnly.of(true));
    }

    const state = EditorState.create({
      doc: value,
      extensions,
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Re-create editor when theme or dialect changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedTheme, dialect, readOnly]);

  // Sync external value changes
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const currentValue = view.state.doc.toString();
    if (currentValue !== value) {
      view.dispatch({
        changes: { from: 0, to: currentValue.length, insert: value },
      });
    }
  }, [value]);

  return (
    <div
      ref={containerRef}
      className={`border border-border rounded-md overflow-hidden ${className}`}
    />
  );
}
