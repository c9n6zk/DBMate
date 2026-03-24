'use client';

import { useState } from 'react';
import { Check, Copy, Download, Trash2, Clock, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatMigration } from '@/lib/migration-formatter';
import { toast } from 'sonner';
import type { Migration, MigrationFormat } from '@/lib/types';

interface MigrationDetailProps {
  migration: Migration;
  onApply: (id: string) => Promise<void>;
  onRollback: (id: string) => Promise<void>;
  onDelete: (id: string) => void;
  isApplying: boolean;
}

export function MigrationDetail({
  migration,
  onApply,
  onRollback,
  onDelete,
  isApplying,
}: MigrationDetailProps) {
  const [format, setFormat] = useState<MigrationFormat>(migration.format);
  const [copiedUp, setCopiedUp] = useState(false);
  const [copiedDown, setCopiedDown] = useState(false);

  const isApplied = !!migration.appliedAt;
  const formatted = formatMigration(migration, format);

  const handleCopy = async (sql: string, direction: 'up' | 'down') => {
    await navigator.clipboard.writeText(sql);
    if (direction === 'up') {
      setCopiedUp(true);
      setTimeout(() => setCopiedUp(false), 2000);
    } else {
      setCopiedDown(true);
      setTimeout(() => setCopiedDown(false), 2000);
    }
    toast.success('SQL copied');
  };

  const handleDownload = () => {
    const blob = new Blob([formatted], { type: 'text/sql' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${migration.version}__${migration.name}.sql`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono text-xs">
              {migration.version}
            </Badge>
            <span className="text-sm font-semibold">{migration.name}</span>
          </div>
          {isApplied ? (
            <Badge className="bg-green-500/10 text-green-500 border-green-500/20 text-[10px]">
              Applied
            </Badge>
          ) : (
            <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20 text-[10px]">
              Pending
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{migration.description}</p>

        {/* Format selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Format:</span>
          <Select value={format} onValueChange={(v) => setFormat(v as MigrationFormat)}>
            <SelectTrigger size="sm" className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="raw">Raw SQL</SelectItem>
              <SelectItem value="flyway">Flyway</SelectItem>
              <SelectItem value="liquibase">Liquibase</SelectItem>
              <SelectItem value="prisma">Prisma</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent className="flex-1 min-h-0 space-y-3 pt-0">
        {/* UP/DOWN Tabs */}
        <Tabs defaultValue="up">
          <TabsList>
            <TabsTrigger value="up">UP (Apply)</TabsTrigger>
            <TabsTrigger value="down">DOWN (Rollback)</TabsTrigger>
            <TabsTrigger value="formatted">Formatted</TabsTrigger>
          </TabsList>
          <TabsContent value="up" className="mt-3">
            <div className="relative">
              <Button
                variant="ghost"
                size="sm"
                className="absolute top-1 right-1 h-6 w-6 p-0"
                onClick={() => handleCopy(migration.upSQL, 'up')}
              >
                {copiedUp ? (
                  <Check className="h-3 w-3 text-green-500" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </Button>
              <ScrollArea className="h-48">
                <pre className="text-xs font-mono bg-muted/50 p-3 rounded border whitespace-pre-wrap">
                  {migration.upSQL}
                </pre>
              </ScrollArea>
            </div>
          </TabsContent>
          <TabsContent value="down" className="mt-3">
            <div className="relative">
              <Button
                variant="ghost"
                size="sm"
                className="absolute top-1 right-1 h-6 w-6 p-0"
                onClick={() => handleCopy(migration.downSQL, 'down')}
              >
                {copiedDown ? (
                  <Check className="h-3 w-3 text-green-500" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </Button>
              <ScrollArea className="h-48">
                <pre className="text-xs font-mono bg-muted/50 p-3 rounded border whitespace-pre-wrap">
                  {migration.downSQL}
                </pre>
              </ScrollArea>
            </div>
          </TabsContent>
          <TabsContent value="formatted" className="mt-3">
            <ScrollArea className="h-48">
              <pre className="text-xs font-mono bg-muted/50 p-3 rounded border whitespace-pre-wrap">
                {formatted}
              </pre>
            </ScrollArea>
          </TabsContent>
        </Tabs>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2">
          {isApplied ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onRollback(migration.id)}
              disabled={isApplying}
              className="h-7 text-xs"
            >
              {isApplying ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <Clock className="h-3 w-3 mr-1" />
              )}
              Rollback
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => onApply(migration.id)}
              disabled={isApplying}
              className="h-7 text-xs"
            >
              {isApplying ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <Check className="h-3 w-3 mr-1" />
              )}
              Apply
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            className="h-7 text-xs"
          >
            <Download className="h-3 w-3 mr-1" />
            Download
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(migration.id)}
            className="h-7 text-xs ml-auto text-destructive hover:text-destructive"
          >
            <Trash2 className="h-3 w-3 mr-1" />
            Delete
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
