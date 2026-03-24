'use client';

import { Download, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useSchemaStore } from '@/stores/schema-store';
import { toast } from 'sonner';

export function DashboardToolbar() {
  const {
    currentSchema,
    healthReport,
    exportSchema,
  } = useSchemaStore();

  if (!currentSchema) return null;

  const handleExport = (format: 'sql' | 'json') => {
    const content = exportSchema(format);
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentSchema.name}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported as ${format.toUpperCase()}`);
  };

  const healthScore = healthReport?.score ?? null;

  return (
    <div className="flex items-center gap-2 pl-12 pr-2 md:px-4 py-2 border-b bg-muted/30 overflow-x-auto scrollbar-thin">
      <Database className="h-4 w-4 text-primary shrink-0" />
      <span className="font-semibold text-sm truncate max-w-30 sm:max-w-50">
        {currentSchema.name}
      </span>
      <Badge variant="secondary" className="text-xs shrink-0">
        {currentSchema.tables.length} tables
      </Badge>
      <Badge variant="outline" className="text-xs uppercase shrink-0 hidden sm:inline-flex">
        {currentSchema.dialect}
      </Badge>

      <Separator orientation="vertical" className="h-5 mx-1 hidden sm:block" />

      {/* Health score — hidden on very small screens */}
      {healthScore !== null && (
        <>
          <div className="hidden sm:flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Health:</span>
            <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${healthScore}%`,
                  backgroundColor:
                    healthScore >= 80
                      ? 'hsl(var(--chart-2))'
                      : healthScore >= 50
                        ? 'hsl(var(--chart-4))'
                        : 'hsl(var(--destructive))',
                }}
              />
            </div>
            <span className="text-xs font-medium">{healthScore}</span>
          </div>
          <Separator orientation="vertical" className="h-5 mx-1 hidden sm:block" />
        </>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Export */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleExport('sql')}
        className="h-7 text-xs shrink-0"
      >
        <Download className="h-3 w-3 mr-1" />
        SQL
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleExport('json')}
        className="h-7 text-xs shrink-0"
      >
        <Download className="h-3 w-3 mr-1" />
        JSON
      </Button>
    </div>
  );
}
