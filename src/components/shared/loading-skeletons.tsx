'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

// Dashboard skeleton — ER diagram area + chat panel
export function DashboardSkeleton() {
  return (
    <div className="flex flex-col h-screen -m-4 md:-m-6">
      {/* Toolbar skeleton */}
      <div className="flex items-center gap-3 px-4 py-2 border-b">
        <Skeleton className="h-5 w-5 rounded" />
        <Skeleton className="h-4 w-32" />
        <div className="ml-auto flex gap-2">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-20" />
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* ER Diagram area */}
        <div className="flex-1 p-4 space-y-4">
          <Skeleton className="h-full min-h-[300px] w-full rounded-lg" />
        </div>

        {/* Chat panel */}
        <div className="w-95 shrink-0 border-l hidden lg:flex flex-col">
          <div className="px-4 py-2.5 border-b">
            <Skeleton className="h-4 w-24" />
          </div>
          <div className="flex-1 p-4 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="h-7 w-7 rounded-full shrink-0" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Optimizer skeleton — gauge + cards + issues
export function OptimizerSkeleton() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-9 w-32" />
      </div>

      <div className="flex flex-col md:flex-row items-center gap-6">
        {/* Gauge */}
        <Skeleton className="h-44 w-44 rounded-full shrink-0" />
        {/* Breakdown cards */}
        <div className="flex-1 w-full grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-3 space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-6 w-12" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Skeleton className="h-12 w-full rounded-md" />

      {/* Issues list */}
      <div className="space-y-3">
        <Skeleton className="h-5 w-24" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-1/2" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// Migrations skeleton — timeline + list + detail
export function MigrationsSkeleton() {
  return (
    <div className="max-w-6xl mx-auto space-y-4 p-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-40" />
      </div>

      {/* Timeline */}
      <div className="flex items-center gap-2 py-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <Skeleton className="h-6 w-6 rounded-full" />
            {i < 4 && <Skeleton className="h-0.5 w-8" />}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* List */}
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-3 space-y-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Detail */}
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-48" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-40 w-full" />
            <div className="flex gap-2">
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-8 w-24" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Export skeleton — card grid
export function ExportSkeleton() {
  return (
    <div className="max-w-4xl mx-auto space-y-6 p-4">
      <Skeleton className="h-6 w-32" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent className="space-y-2">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-7 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// Seed skeleton
export function SeedSkeleton() {
  return (
    <div className="max-w-4xl mx-auto space-y-4 p-4">
      <Skeleton className="h-6 w-48" />
      <Card>
        <CardContent className="p-4 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <Skeleton className="h-4 w-32" />
              <div className="flex gap-2">
                <Skeleton className="h-8 w-12" />
                <Skeleton className="h-8 w-16" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
      <Skeleton className="h-10 w-full" />
    </div>
  );
}
