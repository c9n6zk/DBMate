'use client';

import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import type { Dialect } from '@/lib/types';

interface DialectSelectorProps {
  value: Dialect;
  onChange: (dialect: Dialect) => void;
}

const DIALECTS: { value: Dialect; label: string }[] = [
  { value: 'mysql', label: 'MySQL' },
  { value: 'postgresql', label: 'PostgreSQL' },
  { value: 'sqlite', label: 'SQLite' },
];

export function DialectSelector({ value, onChange }: DialectSelectorProps) {
  return (
    <div className="flex items-center gap-4">
      <Label className="text-sm font-medium shrink-0">Dialect:</Label>
      <RadioGroup
        value={value}
        onValueChange={(v) => onChange(v as Dialect)}
        className="flex gap-4"
      >
        {DIALECTS.map((d) => (
          <div key={d.value} className="flex items-center gap-1.5">
            <RadioGroupItem value={d.value} id={`dialect-${d.value}`} />
            <Label htmlFor={`dialect-${d.value}`} className="text-sm cursor-pointer">
              {d.label}
            </Label>
          </div>
        ))}
      </RadioGroup>
    </div>
  );
}
