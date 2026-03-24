'use client';

import { memo } from 'react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

interface HealthScoreGaugeProps {
  score: number | null;
  isAnalyzing: boolean;
}

function getScoreColor(score: number): string {
  if (score >= 75) return 'text-green-500';
  if (score >= 50) return 'text-yellow-500';
  return 'text-red-500';
}

function getScoreLabel(score: number): string {
  if (score >= 90) return 'Excellent';
  if (score >= 75) return 'Good';
  if (score >= 50) return 'Fair — room for improvement';
  if (score >= 25) return 'Poor — needs attention';
  return 'Critical — major issues found';
}

function getStrokeColor(score: number): string {
  if (score >= 75) return '#22c55e';
  if (score >= 50) return '#eab308';
  return '#ef4444';
}

export const HealthScoreGauge = memo(function HealthScoreGauge({ score, isAnalyzing }: HealthScoreGaugeProps) {
  if (isAnalyzing) {
    return (
      <div className="flex flex-col items-center gap-3 py-4">
        <Skeleton className="w-32 h-32 rounded-full" />
        <Skeleton className="w-24 h-4" />
      </div>
    );
  }

  const displayScore = score ?? 0;
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const filledLength = (displayScore / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-2 py-4">
      <div className="relative w-32 h-32">
        <svg
          viewBox="0 0 120 120"
          className="w-full h-full -rotate-90"
        >
          {/* Background circle */}
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth="10"
          />
          {/* Filled arc */}
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke={getStrokeColor(displayScore)}
            strokeWidth="10"
            strokeDasharray={`${filledLength} ${circumference - filledLength}`}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn('text-3xl font-bold', getScoreColor(displayScore))}>
            {displayScore}
          </span>
          <span className="text-xs text-muted-foreground">/100</span>
        </div>
      </div>
      <p className="text-sm text-muted-foreground text-center">
        {score !== null ? getScoreLabel(displayScore) : 'Not analyzed yet'}
      </p>
    </div>
  );
});
