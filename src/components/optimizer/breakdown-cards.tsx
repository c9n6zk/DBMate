'use client';

import { memo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Shield, Zap, BookOpen, Layers } from 'lucide-react';

interface BreakdownCardsProps {
  breakdown: {
    performance: number;
    security: number;
    conventions: number;
    normalization: number;
  } | null;
  isLoading: boolean;
}

const categories = [
  { key: 'performance' as const, label: 'Performance', icon: Zap, color: 'bg-blue-500' },
  { key: 'security' as const, label: 'Security', icon: Shield, color: 'bg-red-500' },
  { key: 'conventions' as const, label: 'Conventions', icon: BookOpen, color: 'bg-purple-500' },
  { key: 'normalization' as const, label: 'Normalization', icon: Layers, color: 'bg-green-500' },
];

export const BreakdownCards = memo(function BreakdownCards({ breakdown, isLoading }: BreakdownCardsProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {categories.map(({ key, label, icon: Icon, color }) => {
        const value = breakdown?.[key] ?? 0;

        return (
          <Card key={key}>
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-2">
                <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium">{label}</span>
              </div>
              {isLoading ? (
                <Skeleton className="h-4 w-full" />
              ) : (
                <>
                  <div className="flex items-baseline gap-1 mb-1.5">
                    <span className="text-lg font-bold">{value}</span>
                    <span className="text-xs text-muted-foreground">/25</span>
                  </div>
                  <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${color}`}
                      style={{ width: `${(value / 25) * 100}%` }}
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
});
