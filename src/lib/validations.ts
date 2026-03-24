import { z } from 'zod/v4';
import type { ExplainPlanNode } from '@/lib/types';

// ============ CONSTANTS ============

export const MAX_SQL_INPUT_SIZE = 500_000; // 500KB max SQL input
export const MAX_CHAT_MESSAGE_LENGTH = 2_000; // 2000 chars max NL question
export const AI_RATE_LIMIT = 10; // Max 10 AI calls / minute / session
export const MAX_CHAT_HISTORY = 20; // Max 20 messages sent as context

// ============ ZOD SCHEMAS ============

export const dialectSchema = z.enum(['mysql', 'postgresql', 'sqlite']);
export const migrationFormatSchema = z.enum(['raw', 'flyway', 'liquibase', 'prisma']);
export const severitySchema = z.enum(['critical', 'warning', 'info', 'success']);

// POST /api/parse
export const parseRequestSchema = z.object({
  sql: z
    .string()
    .min(1, 'SQL input is required')
    .max(MAX_SQL_INPUT_SIZE, `SQL input too large (max ${MAX_SQL_INPUT_SIZE / 1000}KB)`),
  dialect: dialectSchema,
  name: z.string().max(100).optional(),
});

// POST /api/query
export const queryRequestSchema = z.object({
  question: z
    .string()
    .min(1, 'Question is required')
    .max(MAX_CHAT_MESSAGE_LENGTH, `Question too long (max ${MAX_CHAT_MESSAGE_LENGTH} chars)`),
  schema: z.object({}).passthrough(), // Schema object validated separately
  history: z.array(z.object({}).passthrough()).max(MAX_CHAT_HISTORY).optional(),
  dialect: dialectSchema,
});

// POST /api/analyze
export const analyzeRequestSchema = z.object({
  schema: z.object({}).passthrough(),
  appliedFixes: z.array(z.string()).optional(),
});

// POST /api/migrate
export const migrateRequestSchema = z.object({
  schema: z.object({}).passthrough(),
  schemaId: z.string().min(1),
  change: z.string().min(1).max(2000),
  dialect: dialectSchema,
  format: migrationFormatSchema,
  nextVersion: z.string(),
  fixSQL: z.string().optional(),
});

// POST /api/seed
export const seedRequestSchema = z.object({
  schema: z.object({}).passthrough(),
  config: z.object({
    tables: z.array(
      z.object({
        tableName: z.string().min(1),
        rowCount: z.number().int().min(1).max(1000),
        customRules: z
          .array(
            z.object({
              columnName: z.string().min(1),
              rule: z.enum(['faker', 'enum', 'range', 'custom']),
              value: z.string(),
            })
          )
          .optional(),
      })
    ),
    locale: z.string().min(2).max(5),
    respectFK: z.boolean(),
  }),
});

// POST /api/explain
export const explainRequestSchema = z.object({
  sql: z
    .string()
    .min(1, 'SQL query is required')
    .max(MAX_SQL_INPUT_SIZE, `SQL too large (max ${MAX_SQL_INPUT_SIZE / 1000}KB)`),
  schema: z.object({}).passthrough(),
  dialect: dialectSchema,
  hypotheticalIndexes: z
    .array(
      z.object({
        table: z.string().min(1),
        columns: z.array(z.string().min(1)).min(1),
        unique: z.boolean().optional(),
      })
    )
    .optional(),
  removedIndexes: z
    .array(
      z.object({
        table: z.string().min(1),
        indexName: z.string().min(1),
      })
    )
    .optional(),
});

// Explain response validation
const explainNodeTypeEnum = z.enum([
  'SELECT', 'SEQ_SCAN', 'INDEX_SCAN', 'INDEX_ONLY_SCAN',
  'HASH_JOIN', 'NESTED_LOOP', 'MERGE_JOIN', 'SORT',
  'AGGREGATE', 'FILTER', 'LIMIT', 'SUBQUERY',
  'MATERIALIZE', 'HASH', 'BITMAP_SCAN', 'CTE_SCAN',
]);

export const explainPlanNodeSchema: z.ZodType<ExplainPlanNode> = z.lazy(() =>
  z.object({
    id: z.string(),
    type: explainNodeTypeEnum,
    label: z.string(),
    table: z.string().optional(),
    index: z.string().optional(),
    cost: z.number(),
    rows: z.number(),
    width: z.number().optional(),
    condition: z.string().optional(),
    children: z.array(explainPlanNodeSchema),
  })
);

export const explainResponseSchema = z.object({
  plan: explainPlanNodeSchema,
  totalCost: z.number(),
  warnings: z.array(z.string()),
  recommendations: z.array(z.string()),
});

// POST /api/index-analysis
export const indexAnalysisRequestSchema = z.object({
  schema: z.object({}).passthrough(),
  queries: z.array(z.string().min(1)).min(1, 'At least one query is required'),
});

export const indexAnalysisResponseSchema = z.object({
  indexUsage: z.array(
    z.object({
      indexName: z.string(),
      table: z.string(),
      usedByQueries: z.array(z.string()),
      unusedReason: z.string().optional(),
    })
  ),
  suggestedIndexes: z.array(
    z.object({
      table: z.string(),
      columns: z.array(z.string()),
      unique: z.boolean().optional(),
      reason: z.string(),
      estimatedImprovement: z.string(),
      affectedQueries: z.array(z.string()),
    })
  ),
  unusedIndexes: z.array(
    z.object({
      indexName: z.string(),
      table: z.string(),
      recommendation: z.string(),
    })
  ),
});

// ============ AI OUTPUT SCHEMAS ============

// Normalization AI response (analyze route)
// Note: 'id' is NOT included — the route generates it after validation
export const aiNormalizationIssueSchema = z.object({
  type: z.literal('normalization'),
  severity: z.enum(['critical', 'warning', 'info']),
  title: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  affectedTable: z.string().min(1),
  affectedColumns: z.array(z.string()).optional(),
  suggestion: z.string().max(500).optional(),
  fixSQL: z.string().max(2000).optional(),
  estimatedImpact: z.enum(['high', 'medium', 'low']).optional(),
});

export const aiNormalizationResultSchema = z.object({
  normalization: z.number().min(0).max(25),
  issues: z.array(aiNormalizationIssueSchema).max(10),
  summary: z.string().min(1).max(300),
});

// Migration AI response (migrate route)
export const aiMigrationResultSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().min(1).max(500),
  upSQL: z.string().min(1),
  downSQL: z.string().min(1),
});

// POST /api/schemas
export const createSchemaRequestSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  dialect: dialectSchema,
});

// PATCH /api/schemas/[id]
export const updateSchemaRequestSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    schema_json: z.record(z.string(), z.unknown()).optional(),
    health_report: z.record(z.string(), z.unknown()).nullable().optional(),
  })
  .refine((d) => d.name || d.schema_json, 'At least one field required');

// POST /api/history
export const historyCreateSchema = z.object({
  schemaId: z.string().min(1),
  nlInput: z.string().min(1),
  sqlOutput: z.string().min(1),
  explanation: z.string().optional(),
});

// GET /api/chat?schemaId=X&limit=100
export const chatQuerySchema = z.object({
  schemaId: z.string().min(1),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

// POST /api/chat
export const saveChatSchema = z.object({
  messages: z.array(
    z.object({
      id: z.string().min(1),
      schemaId: z.string().min(1),
      role: z.enum(['user', 'assistant']),
      content: z.string(),
      sql: z.string().optional(),
      confidence: z.enum(['high', 'medium', 'low']).optional(),
      type: z.enum(['query', 'analysis', 'optimization', 'general']).default('query'),
      timestamp: z.string(),
    })
  ).min(1),
});

// DELETE /api/chat?schemaId=X
export const chatDeleteSchema = z.object({
  schemaId: z.string().min(1),
});

// PUT /api/settings
export const updateSettingsSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).optional(),
  language: z.enum(['hu', 'en']).optional(),
  dialect: dialectSchema.optional(),
  migrationFormat: migrationFormatSchema.optional(),
  seedLocale: z.string().min(2).max(5).optional(),
  seedDefaultRows: z.number().int().min(1).max(1000).optional(),
  aiModel: z.string().min(1).optional(),
  temperature: z.number().min(0).max(1).optional(),
  maxTokens: z.number().int().min(256).max(16384).optional(),
});
