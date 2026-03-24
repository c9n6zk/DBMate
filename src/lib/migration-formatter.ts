import type { Migration, MigrationFormat } from '@/lib/types';

export function formatMigration(
  migration: Migration,
  format: MigrationFormat
): string {
  switch (format) {
    case 'flyway':
      return `-- ${migration.version}__${migration.name}.sql\n${migration.upSQL}`;
    case 'liquibase':
      return (
        `<changeSet id="${migration.version}" author="dbmate">\n` +
        `  <sql>${migration.upSQL}</sql>\n` +
        `  <rollback><sql>${migration.downSQL}</sql></rollback>\n` +
        `</changeSet>`
      );
    case 'prisma':
      return `-- migration.sql\n${migration.upSQL}`;
    case 'raw':
      return `-- UP\n${migration.upSQL}\n\n-- DOWN\n${migration.downSQL}`;
  }
}
