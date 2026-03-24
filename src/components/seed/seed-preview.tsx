'use client';

import { useState } from 'react';
import { Check, Copy, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import type { SeedResult } from '@/lib/types';

interface SeedPreviewProps {
  seeds: SeedResult[];
  totalRows: number;
  insertOrder: string[];
}

export function SeedPreview({ seeds, totalRows, insertOrder }: SeedPreviewProps) {
  const [copied, setCopied] = useState(false);

  const fullSQL = seeds
    .map((s) => s.insertStatements)
    .filter(Boolean)
    .join('\n\n');

  const handleCopy = async () => {
    await navigator.clipboard.writeText(fullSQL);
    setCopied(true);
    toast.success('SQL copied');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([fullSQL], { type: 'text/sql' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'seed.sql';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3">
      {/* Summary */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-medium">Generated:</span>
        {seeds.map((s) => (
          <Badge key={s.tableName} variant="secondary" className="text-xs">
            {s.tableName}: {s.rowCount} rows
          </Badge>
        ))}
        <Badge variant="outline" className="text-xs ml-auto">
          Total: {totalRows} rows
        </Badge>
      </div>

      {/* Insert order */}
      <p className="text-xs text-muted-foreground">
        Insert order: {insertOrder.join(' → ')}
      </p>

      {/* SQL Preview */}
      <ScrollArea className="h-72">
        <pre className="text-xs font-mono bg-muted/50 p-3 rounded border whitespace-pre-wrap">
          {fullSQL || 'No data generated.'}
        </pre>
      </ScrollArea>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={handleCopy} disabled={!fullSQL}>
          {copied ? (
            <Check className="h-3 w-3 mr-1 text-green-500" />
          ) : (
            <Copy className="h-3 w-3 mr-1" />
          )}
          Copy SQL
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleDownload}
          disabled={!fullSQL}
        >
          <Download className="h-3 w-3 mr-1" />
          Download seed.sql
        </Button>
      </div>
    </div>
  );
}
