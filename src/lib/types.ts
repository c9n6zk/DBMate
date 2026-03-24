// ============ COMMON TYPE ALIASES ============

export type Dialect = 'mysql' | 'postgresql' | 'sqlite';
export type MigrationFormat = 'raw' | 'flyway' | 'liquibase' | 'prisma';
export type SeedRule = 'faker' | 'enum' | 'range' | 'custom';

// ============ SCHEMA TYPES ============

export interface Column {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue?: string;
  primaryKey: boolean;
  autoIncrement: boolean;
  unique: boolean;
  check?: string;
  comment?: string;
}

export interface ForeignKey {
  name?: string;
  columns: string[];
  referencedTable: string;
  referencedColumns: string[];
  onDelete?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';
  onUpdate?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';
}

export interface Index {
  name: string;
  columns: string[];
  unique: boolean;
  type?: 'BTREE' | 'HASH' | 'FULLTEXT';
}

export interface Table {
  name: string;
  columns: Column[];
  primaryKey: string[];
  foreignKeys: ForeignKey[];
  indexes: Index[];
  engine?: string;
  charset?: string;
  comment?: string;
}

export interface Schema {
  id: string;
  name: string;
  dialect: Dialect;
  tables: Table[];
  createdAt: string;
  updatedAt: string;
  rawSQL: string;
}

// Schema list item (lightweight, for sidebar)
export interface SchemaListItem {
  id: string;
  name: string;
  dialect: Dialect;
  updatedAt: string;
  tableCount: number;
}

// ============ VERSION TYPES ============

export interface VersionSummary {
  id: string;
  schemaId: string;
  versionNumber: number;
  changeDescription: string;
  createdAt: string;
}

// ============ ANALYSIS TYPES ============

export type Severity = 'critical' | 'warning' | 'info' | 'success';

export interface AnalysisIssue {
  id: string;
  type: 'normalization' | 'performance' | 'security' | 'convention';
  severity: Severity;
  title: string;
  description?: string;
  affectedTable: string;
  affectedColumns?: string[];
  suggestion?: string;
  fixSQL?: string;
  estimatedImpact?: 'high' | 'medium' | 'low';
}

export interface SchemaHealthReport {
  score: number;
  breakdown: {
    normalization: number;
    performance: number;
    security: number;
    conventions: number;
  };
  issues: AnalysisIssue[];
  summary: string;
}

// ============ QUERY TYPES ============

export interface QueryResult {
  id: string;
  schemaId: string;
  naturalLanguage: string;
  generatedSQL: string;
  explanation: string;
  executionPlan?: string;
  timestamp: string;
}

// ============ EXPLAIN PLAN TYPES ============

export type ExplainNodeType =
  | 'SELECT'
  | 'SEQ_SCAN'
  | 'INDEX_SCAN'
  | 'INDEX_ONLY_SCAN'
  | 'HASH_JOIN'
  | 'NESTED_LOOP'
  | 'MERGE_JOIN'
  | 'SORT'
  | 'AGGREGATE'
  | 'FILTER'
  | 'LIMIT'
  | 'SUBQUERY'
  | 'MATERIALIZE'
  | 'HASH'
  | 'BITMAP_SCAN'
  | 'CTE_SCAN';

export interface ExplainPlanNode {
  id: string;
  type: ExplainNodeType;
  label: string;
  table?: string;
  index?: string;
  cost: number;
  rows: number;
  width?: number;
  condition?: string;
  children: ExplainPlanNode[];
}

// ============ INDEX ANALYSIS TYPES ============

export interface IndexUsage {
  indexName: string;
  table: string;
  usedByQueries: string[];
  unusedReason?: string;
}

export interface SuggestedIndex {
  table: string;
  columns: string[];
  unique?: boolean;
  reason: string;
  estimatedImprovement: string;
  affectedQueries: string[];
}

export interface UnusedIndex {
  indexName: string;
  table: string;
  recommendation: string;
}

export interface IndexAnalysisResult {
  indexUsage: IndexUsage[];
  suggestedIndexes: SuggestedIndex[];
  unusedIndexes: UnusedIndex[];
}

// ============ MIGRATION TYPES ============

export interface Migration {
  id: string;
  schemaId: string;
  version: string;
  name: string;
  upSQL: string;
  downSQL: string;
  description: string;
  appliedAt?: string;
  format: MigrationFormat;
}

export interface MigrationRequest {
  schema: Schema;
  schemaId: string;
  change: string;
  dialect: Dialect;
  format: MigrationFormat;
  nextVersion: string;
  fixSQL?: string;
}

// ============ SEED TYPES ============

export interface SeedTableConfig {
  tableName: string;
  rowCount: number;
  customRules?: {
    columnName: string;
    rule: SeedRule;
    value: string;
  }[];
}

export interface SeedConfig {
  tables: SeedTableConfig[];
  locale: string;
  respectFK: boolean;
}

export interface SeedResult {
  tableName: string;
  insertStatements: string;
  rowCount: number;
}

// ============ CHAT TYPES ============

export interface ChatMessage {
  id: string;
  schemaId: string;
  role: 'user' | 'assistant';
  content: string;
  sql?: string;
  confidence?: 'high' | 'medium' | 'low';
  timestamp: string;
  type: 'query' | 'analysis' | 'optimization' | 'general';
}

// ============ SETTINGS TYPES ============

export interface AppSettings {
  theme: 'light' | 'dark' | 'system';
  language: 'hu' | 'en';
  dialect: Dialect;
  migrationFormat: MigrationFormat;
  seedLocale: string;
  seedDefaultRows: number;
  aiModel: string;
  temperature: number;
  maxTokens: number;
}
