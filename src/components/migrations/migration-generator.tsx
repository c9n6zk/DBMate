'use client';

import { useState } from 'react';
import { Bot, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface MigrationGeneratorProps {
  onGenerate: (change: string) => Promise<void>;
  isGenerating: boolean;
  disabled: boolean;
}

export function MigrationGenerator({
  onGenerate,
  isGenerating,
  disabled,
}: MigrationGeneratorProps) {
  const [change, setChange] = useState('');

  const handleSubmit = async () => {
    if (!change.trim() || isGenerating) return;
    await onGenerate(change.trim());
    setChange('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Bot className="h-4 w-4 text-primary" />
        <h4 className="text-sm font-semibold">AI Migration Generator</h4>
      </div>
      <p className="text-xs text-muted-foreground">
        Describe the schema change you want to make. Simple patterns (add index, add column) use instant templates. Complex changes use AI.
      </p>
      <Textarea
        value={change}
        onChange={(e) => setChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="e.g. Add created_at and updated_at columns to all tables"
        className="min-h-16 text-sm resize-none"
        disabled={disabled || isGenerating}
      />
      <div className="flex justify-center">
        <Button
          onClick={handleSubmit}
          disabled={!change.trim() || isGenerating || disabled}
          className="w-full max-w-md"
        >
          {isGenerating ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4 mr-2" />
          )}
          {isGenerating ? 'Generating...' : 'Generate Migration'}
        </Button>
      </div>
    </div>
  );
}
