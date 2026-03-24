'use client';

import { Settings, Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSettingsStore } from '@/stores/settings-store';
import type { Dialect, MigrationFormat } from '@/lib/types';
import { PageTransition } from '@/components/shared/motion';

export default function SettingsPage() {
  const { settings, updateSettings } = useSettingsStore();
  const { theme, setTheme } = useTheme();

  return (
    <PageTransition>
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Settings className="h-6 w-6" />
        <h2 className="text-2xl font-semibold">Settings</h2>
      </div>

      {/* Appearance */}
      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="theme">Theme</Label>
            <Select
              value={theme ?? 'system'}
              onValueChange={(v) => { if (v) setTheme(v); }}
            >
              <SelectTrigger id="theme">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">
                  <span className="flex items-center gap-2">
                    <Sun className="h-4 w-4" />
                    Light
                  </span>
                </SelectItem>
                <SelectItem value="dark">
                  <span className="flex items-center gap-2">
                    <Moon className="h-4 w-4" />
                    Dark
                  </span>
                </SelectItem>
                <SelectItem value="system">
                  <span className="flex items-center gap-2">
                    <Monitor className="h-4 w-4" />
                    System
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Database defaults */}
      <Card>
        <CardHeader>
          <CardTitle>Database Defaults</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="dialect">Default Dialect</Label>
            <Select
              value={settings.dialect}
              onValueChange={(v) => updateSettings({ dialect: v as Dialect })}
            >
              <SelectTrigger id="dialect">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mysql">MySQL</SelectItem>
                <SelectItem value="postgresql">PostgreSQL</SelectItem>
                <SelectItem value="sqlite">SQLite</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="migrationFormat">Migration Format</Label>
            <Select
              value={settings.migrationFormat}
              onValueChange={(v) =>
                updateSettings({ migrationFormat: v as MigrationFormat })
              }
            >
              <SelectTrigger id="migrationFormat">
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

          <div className="grid gap-2">
            <Label htmlFor="language">Language</Label>
            <Select
              value={settings.language}
              onValueChange={(v) =>
                updateSettings({ language: v as 'hu' | 'en' })
              }
            >
              <SelectTrigger id="language">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hu">Magyar</SelectItem>
                <SelectItem value="en">English</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* AI Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>AI Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label>Model</Label>
            <p className="text-sm text-muted-foreground">
              {settings.aiModel}
            </p>
          </div>
          <div className="grid gap-2">
            <Label>Temperature</Label>
            <p className="text-sm text-muted-foreground">
              {settings.temperature}
            </p>
          </div>
          <div className="grid gap-2">
            <Label>Max Tokens</Label>
            <p className="text-sm text-muted-foreground">
              {settings.maxTokens}
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            API key is configured server-side via .env.local
          </p>
        </CardContent>
      </Card>
    </div>
    </PageTransition>
  );
}
