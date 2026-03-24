'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShoppingCart, FileText, Heart, GraduationCap } from 'lucide-react';
import type { Dialect } from '@/lib/types';

import { ECOMMERCE_SQL, BLOG_SQL, HEALTHCARE_SQL, LMS_SQL } from '@/data/templates';

interface TemplateInfo {
  id: string;
  name: string;
  description: string;
  tables: number;
  icon: React.ComponentType<{ className?: string }>;
  sql: string;
  dialect: Dialect;
}

const TEMPLATES: TemplateInfo[] = [
  {
    id: 'e-commerce',
    name: 'E-Commerce',
    description: 'Online store with products, orders, payments',
    tables: 8,
    icon: ShoppingCart,
    sql: ECOMMERCE_SQL,
    dialect: 'mysql',
  },
  {
    id: 'blog',
    name: 'Blog',
    description: 'Blog platform with posts, tags, comments',
    tables: 6,
    icon: FileText,
    sql: BLOG_SQL,
    dialect: 'mysql',
  },
  {
    id: 'healthcare',
    name: 'Healthcare',
    description: 'Hospital management with patients, doctors',
    tables: 12,
    icon: Heart,
    sql: HEALTHCARE_SQL,
    dialect: 'mysql',
  },
  {
    id: 'lms',
    name: 'LMS',
    description: 'Learning platform with courses, quizzes',
    tables: 9,
    icon: GraduationCap,
    sql: LMS_SQL,
    dialect: 'mysql',
  },
];

interface TemplateGalleryProps {
  onSelect: (sql: string, dialect: Dialect, name: string) => void;
  className?: string;
}

export function TemplateGallery({ onSelect, className }: TemplateGalleryProps) {
  return (
    <div className={className ?? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"}>
      {TEMPLATES.map((t) => (
        <Card key={t.id} className="flex flex-col">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <t.icon className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">{t.name}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col gap-3">
            <p className="text-sm text-muted-foreground flex-1">
              {t.description}
            </p>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {t.tables} tables
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onSelect(t.sql, t.dialect, t.name)}
              >
                Load
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
