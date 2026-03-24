'use client';

import { useDirtyGuard, useSchemaInit } from './use-dirty-guard';

/**
 * Client component that initializes schema state and sets up guards.
 * Renders nothing — just runs hooks.
 */
export function SchemaInitializer() {
  useSchemaInit();
  useDirtyGuard();
  return null;
}
