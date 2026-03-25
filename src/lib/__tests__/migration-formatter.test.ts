import { describe, it, expect } from 'vitest';
import { formatMigration } from '../migration-formatter';
import type { Migration } from '../types';

const baseMigration: Migration = {
  id: 'mig-1',
  schemaId: 'sch-1',
  version: 'v001',
  name: 'add_email_index',
  upSQL: 'CREATE INDEX idx_email ON users(email);',
  downSQL: 'DROP INDEX idx_email;',
  description: 'Add email index',
  format: 'raw',
};

describe('formatMigration', () => {
  it('formats as raw (UP + DOWN)', () => {
    const result = formatMigration(baseMigration, 'raw');
    expect(result).toContain('-- UP');
    expect(result).toContain(baseMigration.upSQL);
    expect(result).toContain('-- DOWN');
    expect(result).toContain(baseMigration.downSQL);
  });

  it('formats as flyway', () => {
    const result = formatMigration(baseMigration, 'flyway');
    expect(result).toContain('v001__add_email_index.sql');
    expect(result).toContain(baseMigration.upSQL);
    expect(result).not.toContain(baseMigration.downSQL);
  });

  it('formats as liquibase', () => {
    const result = formatMigration(baseMigration, 'liquibase');
    expect(result).toContain('<changeSet');
    expect(result).toContain('id="v001"');
    expect(result).toContain('author="dbmate"');
    expect(result).toContain(`<sql>${baseMigration.upSQL}</sql>`);
    expect(result).toContain('<rollback>');
    expect(result).toContain(baseMigration.downSQL);
  });

  it('formats as prisma', () => {
    const result = formatMigration(baseMigration, 'prisma');
    expect(result).toContain('-- migration.sql');
    expect(result).toContain(baseMigration.upSQL);
    expect(result).not.toContain(baseMigration.downSQL);
  });
});
