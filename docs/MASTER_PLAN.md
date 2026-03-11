# DBMate — Teljes Implementációs Terv

> AI-Powered Database Assistant
> Verzió: 1.0 | Dátum: 2026-03-11

---

## Tartalomjegyzék

1. [Projekt Áttekintés](#1-projekt-áttekintés)
2. [Technológiai Stack](#2-technológiai-stack)
3. [Alkalmazás Architektúra](#3-alkalmazás-architektúra)
4. [Adatmodellek & Típusok](#4-adatmodellek--típusok)
5. [Oldalak & UI/UX Részletes Terv](#5-oldalak--uiux-részletes-terv)
6. [Feature-ök Részletes Specifikáció](#6-feature-ök-részletes-specifikáció)
7. [AI Integráció & Prompt Engineering](#7-ai-integráció--prompt-engineering)
8. [Implementációs Fázisok & Sorrend](#8-implementációs-fázisok--sorrend)
9. [Projekt Struktúra](#9-projekt-struktúra)
10. [API Endpointok](#10-api-endpointok)
11. [SQLite Adatbázis Séma](#11-sqlite-adatbázis-séma)
12. [API Key Kezelés](#12-api-key-kezelés)
13. [Health Score: Hibrid Megközelítés](#13-health-score-hibrid-megközelítés)
14. [Input Validáció & Biztonság](#14-input-validáció--biztonság)
15. [Share Feature — Javított Architektúra](#15-share-feature--javított-architektúra)
16. [Többnyelvűség (i18n) Stratégia](#16-többnyelvűség-i18n-stratégia)
17. [Responsive Design Stratégia](#17-responsive-design-stratégia)
18. [Implementációs Progress Tracker](#18-implementációs-progress-tracker)

---

## 1. Projekt Áttekintés

### Mi a DBMate?
Egy webalkalmazás, amely AI segítségével elemzi, optimalizálja és kezeli SQL adatbázis sémákat. A felhasználó SQL-t importál, és az alkalmazás:
- Vizualizálja a sémát ER diagramként
- Elemzi a normalizációs problémákat
- Természetes nyelven fogad kérdéseket és SQL-t generál
- Optimalizációs javaslatokat ad
- Migrációs scripteket generál
- Teszt adatokat generál
- Exportálja a módosított sémát

### Célközönség
- Egyetemi hallgatók (adatbázis kurzusok)
- Junior/medior fejlesztők
- DBA-k gyors séma audithoz
- Nem-technikai stakeholderek (NL→SQL)

---

## 2. Technológiai Stack

```
┌─────────────────────────────────────────────────────┐
│                    FRONTEND                         │
│  Next.js 15 (App Router) + React 19 + TypeScript   │
│  TailwindCSS 4 + shadcn/ui                         │
│  ReactFlow (ER diagram) + dagre (auto-layout)      │
│  CodeMirror 6 + @codemirror/lang-sql (SQL editor)    │
│  Recharts (grafikonok, health score)                │
│  Zustand (state management)                         │
│  Framer Motion (animációk)                          │
│  react-markdown + remark-gfm (AI válasz render)    │
│  DOMPurify (XSS védelem markdown renderben)         │
│  diff (schema diff megjelenítés)                    │
│  html-to-image (ER diagram PNG/SVG export)          │
│  next-themes (dark mode provider)                   │
├─────────────────────────────────────────────────────┤
│                    BACKEND                          │
│  Next.js API Routes (Route Handlers)                │
│  node-sql-parser (SQL → AST)                        │
│  @anthropic-ai/sdk (Claude API)                     │
│  better-sqlite3 (lokális storage)                   │
│  zod (API request/response validáció)               │
│  nanoid (unique ID generálás)                       │
│  jszip (ZIP bundle export)                          │
│  pako (gzip compress — share feature)               │
├─────────────────────────────────────────────────────┤
│                    AI ENGINE                        │
│  Claude claude-sonnet-4-6 (gyors, pontos)           │
│  Streaming válaszok (SSE)                           │
│  Kontextus-tudatos prompt rendszer                  │
└─────────────────────────────────────────────────────┘
```

### Miért ezek?

| Döntés | Indoklás |
|--------|----------|
| Next.js 15 | Fullstack, API routes beépítve, SSR/SSG, Vercel deploy |
| shadcn/ui | Copy-paste komponensek, teljes kontroll, szép design |
| ReactFlow + dagre | Legjobb React graph könyvtár + automatikus layout algoritmus az ER diagramhoz |
| CodeMirror 6 + @codemirror/lang-sql | Professzionális SQL editor, syntax highlighting, autocomplete, dialect-aware |
| Zustand | Egyszerű, gyors state management, nincs boilerplate |
| node-sql-parser | SQL parser, MySQL/PostgreSQL/SQLite. ⚠️ PG korlátai vannak — fallback kezelés kell |
| SQLite (better-sqlite3) | Zero-config, fájl-alapú, lokális storage. ⚠️ Vercel-en NEM fut (natív addon) |
| Claude API | Legjobb kód/SQL generálás, 200K kontextus ablak |
| zod | Runtime type-safe validáció API request/response-okra — elkapja a hibás inputot |
| react-markdown + DOMPurify | AI markdown válaszok biztonságos renderelése, XSS védelem |
| dagre | Directed graph layout — ER diagram automatikus elrendezése FK relációk alapján |
| pako | gzip tömörítés a share feature URL-encoded data-jához |
| Recharts | Lightweight charting — Health Score gauge, breakdown grafikonok |
| Framer Motion | Page transition animációk, card reveals, smooth UX |
| diff | Szöveg diff algoritmus — eredeti vs. módosított séma összehasonlítás |
| jszip | ZIP bundle export (schema + migrations + seed + ER diagram + docs) |

---

## 3. Alkalmazás Architektúra

### 3.1 Magas Szintű Architektúra

```
┌──────────────────────────────────────────────────────────────────┐
│                         BROWSER                                  │
│                                                                  │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌───────────┐  │
│  │   Import    │  │ Dashboard  │  │ Optimizer  │  │  Export   │  │
│  │   Page      │  │   Page     │  │   Page     │  │  Page     │  │
│  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘  └─────┬─────┘  │
│        └───────────────┴───────────────┴───────────────┘         │
│                              │                                    │
│                    ┌─────────┴──────────┐                        │
│                    │   Zustand Stores    │                        │
│                    │  ┌──────────────┐  │                        │
│                    │  │ SchemaStore  │  │                        │
│                    │  │ ChatStore    │  │                        │
│                    │  │ SettingsStore│  │                        │
│                    │  └──────────────┘  │                        │
│                    └─────────┬──────────┘                        │
│                              │                                    │
├──────────────────────────────┼────────────────────────────────────┤
│                         API LAYER                                │
│                              │                                    │
│  ┌──────────┐  ┌──────────┐  │  ┌──────────┐  ┌──────────────┐  │
│  │ /api/    │  │ /api/    │  │  │ /api/    │  │ /api/        │  │
│  │ parse    │  │ analyze  │  │  │ query    │  │ migrate      │  │
│  └────┬─────┘  └────┬─────┘  │  └────┬─────┘  └──────┬───────┘  │
│       │              │       │       │                │          │
│  ┌────┴─────┐  ┌─────┴────┐  │  ┌────┴─────┐  ┌──────┴───────┐  │
│  │ /api/    │  │ /api/    │  │  │ /api/    │  │ /api/        │  │
│  │ export   │  │ seed     │  │  │ history  │  │ share        │  │
│  └────┬─────┘  └────┬─────┘  │  └────┬─────┘  └──────┬───────┘  │
│       └──────────────┴───────┴───────┴────────────────┘          │
│                              │                                    │
├──────────────────────────────┼────────────────────────────────────┤
│                       SERVICES                                    │
│                              │                                    │
│  ┌──────────────┐  ┌────────┴───────┐  ┌──────────────────────┐  │
│  │ SQL Parser   │  │  AI Service    │  │  Database Service    │  │
│  │ Service      │  │  (Claude API)  │  │  (SQLite)            │  │
│  └──────────────┘  └────────────────┘  └──────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

### 3.2 Adatfolyam (Data Flow)

```
                    ┌─────────────────┐
                    │   USER INPUT    │
                    │  (SQL / NL / UI)│
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │   INPUT ROUTER  │
                    │  (típus detekt) │
                    └───┬────┬────┬───┘
                        │    │    │
           ┌────────────┘    │    └────────────┐
           │                 │                 │
  ┌────────▼─────┐  ┌───────▼──────┐  ┌───────▼──────┐
  │  SQL PARSER  │  │  AI SERVICE  │  │  DIRECT DB   │
  │              │  │              │  │  OPERATION   │
  │ SQL text →   │  │ NL → prompt  │  │              │
  │ AST → JSON   │  │ → Claude API │  │ export/      │
  │ → Schema     │  │ → response   │  │ import/save  │
  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘
         │                 │                  │
         └─────────┬───────┘──────────────────┘
                   │
          ┌────────▼────────┐
          │   SCHEMA STORE  │
          │   (Zustand)     │
          │                 │
          │ • tables[]      │
          │ • relations[]   │
          │ • history[]     │
          │ • suggestions[] │
          └────────┬────────┘
                   │
          ┌────────▼────────┐
          │    UI UPDATE    │
          │                 │
          │ • ER Diagram    │
          │ • Chat válasz   │
          │ • Health Score  │
          │ • Suggestions   │
          └─────────────────┘
```

### 3.3 AI Service Flow (Részletes)

```
User Message
     │
     ▼
┌─────────────────────┐
│  Context Builder    │
│                     │
│  1. Schema JSON     │ ← Zustand store-ból
│  2. User message    │ ← Input field-ből
│  3. Chat history    │ ← Előző üzenetek (max 20)
│  4. Task type       │ ← query/analyze/optimize/seed/migrate
│  5. Dialect         │ ← MySQL/PostgreSQL/SQLite
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Prompt Assembly    │
│                     │
│  System prompt      │ ← Task-specifikus template
│  + Schema context   │ ← Tömörített séma leírás
│  + User messages    │ ← Conversation history
│  + Output format    │ ← JSON/SQL/Markdown
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Claude API Call    │
│  (Streaming SSE)    │
│                     │
│  model: claude-sonnet-4-6  │
│  max_tokens: 4096   │
│  temperature: 0.1   │ ← Alacsony = determinisztikus SQL
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Response Parser    │
│                     │
│  1. SQL kód kinyerés│ ← ```sql blokkok
│  2. JSON parsing    │ ← Structured output
│  3. Markdown format │ ← Magyarázatok
│  4. Action items    │ ← Alkalmazható javaslatok
└──────────┬──────────┘
           │
           ▼
    Frontend Update
```

---

## 4. Adatmodellek & Típusok

### 4.1 Core TypeScript Típusok

```typescript
// ============ COMMON TYPE ALIASES ============

type Dialect = 'mysql' | 'postgresql' | 'sqlite';
type MigrationFormat = 'raw' | 'flyway' | 'liquibase' | 'prisma';
type SeedRule = 'faker' | 'enum' | 'range' | 'custom';

// ============ SCHEMA TYPES ============

interface Column {
  name: string;
  type: string;              // VARCHAR(100), INT, etc.
  nullable: boolean;
  defaultValue?: string;
  primaryKey: boolean;
  autoIncrement: boolean;
  unique: boolean;
  check?: string;            // CHECK constraint: "age >= 0", "status IN ('a','b')"
  comment?: string;
}

interface ForeignKey {
  name?: string;                   // Constraint név: "fk_orders_customer_id" (DROP_FK-hoz kell)
  columns: string[];               // Composite FK support: ["order_id"] or ["org_id", "dept_id"]
  referencedTable: string;
  referencedColumns: string[];     // Matching referenced columns
  onDelete?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';
  onUpdate?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';
}

interface Index {
  name: string;
  columns: string[];
  unique: boolean;
  type?: 'BTREE' | 'HASH' | 'FULLTEXT';
}

interface Table {
  name: string;
  columns: Column[];
  primaryKey: string[];       // Composite PK support: ["order_id", "product_id"]
  foreignKeys: ForeignKey[];
  indexes: Index[];
  engine?: string;           // InnoDB, MyISAM
  charset?: string;
  comment?: string;
}

interface Schema {
  id: string;                // nanoid
  name: string;
  dialect: Dialect;
  tables: Table[];
  createdAt: string;
  updatedAt: string;
  rawSQL: string;            // Eredeti SQL
}

// ============ ANALYSIS TYPES ============

type Severity = 'critical' | 'warning' | 'info' | 'success';

interface AnalysisIssue {
  id: string;                // nanoid — minden issue egyedi azonosítóval rendelkezik
  type: 'normalization' | 'performance' | 'security' | 'convention';
  severity: Severity;
  title: string;
  description?: string;      // Részletes leírás (opcionális — title is elég lehet)
  affectedTable: string;
  affectedColumns?: string[];
  suggestion?: string;       // Javítási javaslat szövegesen
  fixSQL?: string;           // Automatikusan alkalmazható SQL
  estimatedImpact?: 'high' | 'medium' | 'low';  // Statikus analyzer nem mindig tudja
}

interface SchemaHealthReport {
  score: number;             // 0-100
  breakdown: {
    normalization: number;   // 0-25
    performance: number;     // 0-25
    security: number;        // 0-25
    conventions: number;     // 0-25
  };
  issues: AnalysisIssue[];
  summary: string;
}

// ============ QUERY TYPES ============

interface QueryResult {
  id: string;
  schemaId: string;          // Melyik sémához tartozik
  naturalLanguage: string;
  generatedSQL: string;
  explanation: string;
  executionPlan?: string;
  timestamp: string;
}

// ============ MIGRATION TYPES ============

interface Migration {
  id: string;
  schemaId: string;          // Melyik sémához tartozik
  version: string;           // "V001", "V002"
  name: string;              // "add_index_on_orders_customer_id"
  upSQL: string;
  downSQL: string;
  description: string;
  appliedAt?: string;
  format: MigrationFormat;
}

// A generateMigration() döntési logikához (Feature 10):
interface MigrationRequest {
  schema: Schema;
  schemaId: string;
  change: string;             // Szabad szöveges leírás a változtatásról
  dialect: Dialect;
  format: MigrationFormat;
  nextVersion: string;        // "V004" — auto-incrementelt
  fixSQL?: string;            // Ha Apply Fix gombból jön (statikus path)
}

// ============ SEED TYPES ============

interface SeedTableConfig {
  tableName: string;
  rowCount: number;
  customRules?: {
    columnName: string;
    rule: SeedRule;
    value: string;           // "faker:person.firstName" / "enum:active,inactive"
  }[];
}

interface SeedConfig {
  tables: SeedTableConfig[];
  locale: string;            // 'hu', 'en'
  respectFK: boolean;        // FK constraint betartása (dependency order)
}

interface SeedResult {
  tableName: string;
  insertStatements: string;
  rowCount: number;
}

// ============ STORE TYPES ============
// 3 külön Zustand store (lásd: src/stores/)

// --- schema-store.ts ---
// SZINKRON STRATÉGIA: A Zustand store az "igazság forrása" a session alatt.
// Az SQLite `schema_versions` tábla a PERZISZTENS backup.
// - importSchema: store + SQLite INSERT (version 1)
// - applyFix/módosítás: store push + SQLite INSERT (version N+1)
// - undo/redo: CSAK store index mozgatás (SQLite-ot NEM módosítja)
// - App újraindítás: SQLite-ból betölti a verziókat a store-ba
interface SchemaStore {
  // State
  currentSchema: Schema | null;
  schemaVersions: Schema[];        // In-memory: session undo/redo stack
  schemaVersionIndex: number;      // Aktuális pozíció az undo/redo stack-ben
  healthReport: SchemaHealthReport | null;
  migrations: Migration[];

  // Async state
  isLoading: boolean;
  isAnalyzing: boolean;
  error: string | null;

  // Actions
  importSchema: (sql: string, dialect: Dialect) => Promise<void>;   // → store + SQLite
  analyzeSchema: () => Promise<void>;
  applyFix: (issueId: string) => Promise<void>;                    // → store push + SQLite INSERT
  generateMigration: (request: Omit<MigrationRequest, 'schema' | 'schemaId'>) => Promise<Migration>;
    // A store automatikusan hozzáadja: schema = currentSchema, schemaId = currentSchema.id
  exportSchema: (format: 'sql' | 'json') => string;  // Séma export (SQL dump vagy JSON)
  undo: () => void;              // schemaVersionIndex - 1 (csak store)
  redo: () => void;              // schemaVersionIndex + 1 (csak store)
  loadVersions: (schemaId: string) => Promise<void>;  // SQLite → store (app induláskor)
  clearError: () => void;
}

// --- chat-store.ts ---
interface ChatStore {
  messages: ChatMessage[];
  queryHistory: QueryResult[];
  isGenerating: boolean;

  sendMessage: (nl: string) => Promise<QueryResult>;
  generateSeedData: (config: SeedConfig) => Promise<SeedResult[]>;
  loadHistory: (schemaId: string) => Promise<void>;  // SQLite → store (app induláskor / séma váltáskor)
  clearHistory: (schemaId: string) => void;
}

// --- settings-store.ts ---
interface SettingsStore {
  settings: AppSettings;

  updateSettings: (partial: Partial<AppSettings>) => void;
  resetSettings: () => void;
}

interface ChatMessage {
  id: string;
  schemaId: string;            // Melyik sémához tartozik a chat
  role: 'user' | 'assistant';
  content: string;
  sql?: string;
  timestamp: string;
  type: 'query' | 'analysis' | 'optimization' | 'general';
}

interface AppSettings {
  // Appearance
  theme: 'light' | 'dark' | 'system';
  language: 'hu' | 'en';

  // Database defaults
  dialect: Dialect;
  migrationFormat: MigrationFormat;
  seedLocale: string;          // 'hu', 'en'
  seedDefaultRows: number;     // default: 50

  // AI configuration
  aiModel: string;             // 'claude-sonnet-4-6'
  temperature: number;         // default: 0.1
  maxTokens: number;           // default: 4096
}
```

---

## 5. Oldalak & UI/UX Részletes Terv

### Az alkalmazás 5 fő oldallal rendelkezik:

```
┌─────────────────────────────────────────────────────┐
│  SIDEBAR NAVIGATION                                 │
│                                                     │
│  ┌──────────────────┐                               │
│  │  🏠 Import       │  ← Schema betöltés            │
│  │  📊 Dashboard    │  ← Fő munkaterület            │
│  │  ⚡ Optimizer    │  ← Health + javaslatok         │
│  │  🔄 Migrations  │  ← Migration kezelés           │
│  │  📤 Export       │  ← Exportálás                  │
│  └──────────────────┘                               │
│                                                     │
│  ┌──────────────────┐                               │
│  │  ALSÓ SECTION    │                               │
│  │  ⚙ Settings     │                               │
│  │  📚 History      │                               │
│  │  🔗 Share        │                               │
│  └──────────────────┘                               │
└─────────────────────────────────────────────────────┘
```

---

### 5.1 IMPORT PAGE (`/`)

**Cél:** SQL séma importálása fájlból vagy beillesztéssel

```
┌─────────────────────────────────────────────────────────────────┐
│  ┌─ HEADER ──────────────────────────────────────────────────┐  │
│  │  🗄️ DBMate                              [🌙/☀️] [⚙️]    │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─ HERO SECTION ────────────────────────────────────────────┐  │
│  │                                                           │  │
│  │         Welcome to DBMate                                 │  │
│  │         Your AI-Powered Database Assistant                │  │
│  │                                                           │  │
│  │  Import your SQL schema to get started                    │  │
│  │                                                           │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─ IMPORT OPTIONS (Tabs) ───────────────────────────────────┐  │
│  │  [ Paste SQL ]  [ Upload File ]  [ Template ]             │  │
│  │                                                           │  │
│  │  ╔═══════════════════════════════════════════════════════╗ │  │
│  │  ║  -- Paste your CREATE TABLE statements here          ║ │  │
│  │  ║                                                      ║ │  │
│  │  ║  CREATE TABLE users (                                ║ │  │
│  │  ║    id INT PRIMARY KEY AUTO_INCREMENT,                ║ │  │
│  │  ║    name VARCHAR(100) NOT NULL,                       ║ │  │
│  │  ║    email VARCHAR(255) UNIQUE,                        ║ │  │
│  │  ║    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP    ║ │  │
│  │  ║  );                                                  ║ │  │
│  │  ║                                                      ║ │  │
│  │  ║  ▊ (CodeMirror SQL editor)                           ║ │  │
│  │  ╚═══════════════════════════════════════════════════════╝ │  │
│  │                                                           │  │
│  │  Dialect: (●) MySQL  ( ) PostgreSQL  ( ) SQLite          │  │
│  │                                                           │  │
│  │           [ 🔍 Parse & Analyze Schema ]                   │  │
│  │                                                           │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─ TEMPLATE GALLERY (ha "Template" tab aktív) ──────────────┐ │
│  │                                                           │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │  │
│  │  │ 🛒       │  │ 📝       │  │ 🏥       │  │ 📚       │  │  │
│  │  │E-Commerce│  │  Blog    │  │Healthcare│  │   LMS    │  │  │
│  │  │ 8 tables │  │ 5 tables │  │ 12 tables│  │ 9 tables │  │  │
│  │  │ [Load]   │  │ [Load]   │  │ [Load]   │  │ [Load]   │  │  │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │  │
│  │                                                           │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │  │
│  │  │ 💬       │  │ 📊       │  │ 🎮       │  │ 📋       │  │  │
│  │  │  Chat    │  │Analytics │  │  Gaming  │  │Task Mgmt │  │  │
│  │  │ 6 tables │  │ 7 tables │  │ 10 tables│  │ 6 tables │  │  │
│  │  │ [Load]   │  │ [Load]   │  │ [Load]   │  │ [Load]   │  │  │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │  │
│  │                                                           │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─ RECENT SCHEMAS ─────────────────────────────────────────┐  │
│  │  📁 e-commerce_v2.sql    │ 8 tables │ 2 hours ago [Open] │  │
│  │  📁 blog_schema.sql      │ 5 tables │ Yesterday   [Open] │  │
│  │  📁 healthcare_db.sql    │ 12 tables│ 3 days ago  [Open] │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

**Komponensek:**
- `SchemaImport` — fő konténer
- `SQLEditor` — CodeMirror 6 SQL editor szintaxis kiemeléssel
- `FileDropzone` — Drag & drop .sql fájl feltöltés
- `DialectSelector` — MySQL/PostgreSQL/SQLite radio group
- `TemplateGallery` — Előre definiált séma sablonok kártyái
- `RecentSchemas` — Korábban importált sémák listája (SQLite-ból)

**Interakciók:**
1. Felhasználó beilleszti az SQL-t VAGY feltölt egy fájlt VAGY kiválaszt egy template-et
2. Kiválasztja a dialektust
3. "Parse & Analyze" gombra kattint
4. A rendszer parse-olja a SQL-t → `node-sql-parser`
5. Eredmény: Schema JSON → Zustand store
6. Átirányítás a Dashboard oldalra

---

### 5.2 DASHBOARD PAGE (`/dashboard`)

**Cél:** Fő munkaterület — ER diagram + AI chat + tábla részletek

```
┌─────────────────────────────────────────────────────────────────┐
│  ┌─ TOOLBAR ─────────────────────────────────────────────────┐  │
│  │  Schema: e-commerce_v2 │ 8 tables │ MySQL                │  │
│  │  [Undo] [Redo]  │  Health: ██████░░ 75  │  [Export] [Share]│ │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─ LEFT PANEL (resizable) ──┬─ RIGHT PANEL ────────────────┐  │
│  │                           │                               │  │
│  │    ER DIAGRAM             │   AI ASSISTANT CHAT           │  │
│  │    (ReactFlow)            │                               │  │
│  │                           │  ┌─────────────────────────┐  │  │
│  │  ┌─────────┐              │  │ 🤖 Szia! A sémád be    │  │  │
│  │  │ users   │              │  │ van töltve. Kérdezz     │  │  │
│  │  │─────────│              │  │ bármit az adatbázisról! │  │  │
│  │  │ id (PK) │              │  └─────────────────────────┘  │  │
│  │  │ name    │              │                               │  │
│  │  │ email   │──FK──┐       │  ┌─────────────────────────┐  │  │
│  │  └─────────┘      │       │  │ 👤 Listázd az összes   │  │  │
│  │                   │       │  │ ügyfelet akiknek 3-nál  │  │  │
│  │  ┌─────────┐      │       │  │ több rendelése van      │  │  │
│  │  │ orders  │◄─────┘       │  └─────────────────────────┘  │  │
│  │  │─────────│              │                               │  │
│  │  │ id (PK) │              │  ┌─────────────────────────┐  │  │
│  │  │ user_id │              │  │ 🤖 Íme a lekérdezés:   │  │  │
│  │  │ total   │──FK──┐       │  │                         │  │  │
│  │  └─────────┘      │       │  │ ```sql                  │  │  │
│  │                   │       │  │ SELECT u.name,          │  │  │
│  │  ┌─────────┐      │       │  │   COUNT(o.id) AS cnt   │  │  │
│  │  │products │◄─────┘       │  │ FROM users u            │  │  │
│  │  │─────────│              │  │ JOIN orders o            │  │  │
│  │  │ id (PK) │              │  │   ON o.user_id = u.id  │  │  │
│  │  │ name    │              │  │ GROUP BY u.id           │  │  │
│  │  │ price   │              │  │ HAVING cnt > 3;        │  │  │
│  │  └─────────┘              │  │ ```                     │  │  │
│  │                           │  │                         │  │  │
│  │  [Zoom+] [Zoom-] [Fit]   │  │ 📋 Copy  ▶ Explain     │  │  │
│  │  [PNG Export] [SVG Export]│  └─────────────────────────┘  │  │
│  │                           │                               │  │
│  │                           │  ┌─────────────────────────┐  │  │
│  │                           │  │ Kérdezz valamit...  [➤] │  │  │
│  │                           │  └─────────────────────────┘  │  │
│  │                           │                               │  │
│  │                           │  Quick Actions:               │  │
│  │                           │  [Analyze] [Optimize]         │  │
│  │                           │  [Seed Data] [Migration]      │  │
│  │                           │                               │  │
│  └───────────────────────────┴───────────────────────────────┘  │
│                                                                 │
│  ┌─ BOTTOM PANEL (collapsible) ─────────────────────────────┐  │
│  │  [ Columns ]  [ Indexes ]  [ Foreign Keys ]  [ SQL ]      │  │
│  │                                                           │  │
│  │  Selected: users                                          │  │
│  │  ┌────────┬──────────────┬──────┬─────┬──────┬─────────┐  │  │
│  │  │ Name   │ Type         │ Null │ Key │ Uniq │ Default │  │  │
│  │  ├────────┼──────────────┼──────┼─────┼──────┼─────────┤  │  │
│  │  │ id     │ INT          │ NO   │ PK  │ YES  │ AUTO    │  │  │
│  │  │ name   │ VARCHAR(100) │ NO   │     │      │         │  │  │
│  │  │ email  │ VARCHAR(255) │ YES  │     │ YES  │         │  │  │
│  │  │ status │ VARCHAR(20)  │ YES  │     │      │ active  │  │  │
│  │  └────────┴──────────────┴──────┴─────┴──────┴─────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

**Komponensek:**
- `DashboardToolbar` — séma info, health score mini, akció gombok
- `ERDiagram` — ReactFlow alapú interaktív ER diagram
  - `TableNode` — egyedi ReactFlow node: tábla kártya oszlopokkal
  - `RelationEdge` — egyedi ReactFlow edge: FK relációk vonalai
- `AIChat` — chat interface az AI asszisztenssel
  - `ChatMessage` — egyedi üzenet buborék (user/assistant)
  - `SQLCodeBlock` — SQL kód megjelenítés copy gombbal
  - `ChatInput` — input mező quick action gombokkal
- `TableDetails` — alsó panel, kiválasztott tábla részletei
  - `ColumnsTab` — oszlopok táblázata
  - `IndexesTab` — indexek listája
  - `ForeignKeysTab` — FK relációk
  - `RawSQLTab` — az adott tábla CREATE TABLE SQL-je

**Interakciók:**
1. ER diagramon tábla kattintás → alsó panel frissül a tábla részleteivel
2. ER diagramon FK vonal kattintás → mindkét tábla kiemelve
3. Chat-ben természetes nyelv beírása → AI SQL-t generál
4. SQL kód blokkban "Copy" → vágólapra másolás
5. SQL kód blokkban "Explain" → részletes magyarázat kérése
6. Quick Actions gombok → speciális AI feladatok indítása
7. ER diagram exportálása PNG/SVG formátumban
8. Zoom/fit kontrollok a diagramon

**ER Diagram Node Design:**

```
┌──────────────────────────┐
│  📋 users            [⋮] │  ← Tábla neve + menü
├──────────────────────────┤
│  🔑 id          INT      │  ← PK ikon
│  ── name        VARCHAR  │
│  ── email       VARCHAR  │  ← Unique: aláhúzva
│  🔗 role_id     INT      │  ← FK ikon
│  ── created_at  DATETIME │
├──────────────────────────┤
│  📊 2 indexes  🔗 1 FK   │  ← Összefoglaló sor
└──────────────────────────┘
```

---

### 5.3 OPTIMIZER PAGE (`/optimizer`)

**Cél:** Schema Health Score + részletes analízis + javítási javaslatok

```
┌─────────────────────────────────────────────────────────────────┐
│  ┌─ HEADER ──────────────────────────────────────────────────┐  │
│  │  ⚡ Schema Optimizer    │  Schema: e-commerce_v2          │  │
│  │                         │  [Re-analyze] [Apply All Fixes] │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─ HEALTH SCORE SECTION ────────────────────────────────────┐  │
│  │                                                           │  │
│  │  ┌──────────────────────────────────────────────────────┐ │  │
│  │  │                                                      │ │  │
│  │  │              ┌─────────────┐                         │ │  │
│  │  │              │             │                         │ │  │
│  │  │              │     75      │  Overall Health Score   │ │  │
│  │  │              │    /100     │                         │ │  │
│  │  │              │             │  "Good, but room        │ │  │
│  │  │              └─────────────┘   for improvement"      │ │  │
│  │  │           (Animated gauge chart)                     │ │  │
│  │  │                                                      │ │  │
│  │  └──────────────────────────────────────────────────────┘ │  │
│  │                                                           │  │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────┐ │  │
│  │  │Normalizáció│ │Performance │ │ Security   │ │Konvenc.│ │  │
│  │  │            │ │            │ │            │ │        │ │  │
│  │  │  ████░░    │ │  █████░    │ │  ██████    │ │ ███░░░ │ │  │
│  │  │   20/25   │ │   22/25   │ │   25/25   │ │  8/25  │ │  │
│  │  │            │ │            │ │            │ │        │ │  │
│  │  └────────────┘ └────────────┘ └────────────┘ └────────┘ │  │
│  │                                                           │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─ ISSUES LIST ─────────────────────────────────────────────┐  │
│  │                                                           │  │
│  │  Filter: [All ▾]  [Critical ▾]  [Table ▾]    🔍 Search   │  │
│  │                                                           │  │
│  │  ┌─ CRITICAL ─────────────────────────────────────────┐   │  │
│  │  │  🔴 Missing index on orders.customer_id            │   │  │
│  │  │                                                     │   │  │
│  │  │  Table: orders │ Type: Performance │ Impact: HIGH   │   │  │
│  │  │                                                     │   │  │
│  │  │  A `customer_id` oszlop foreign key, de nincs rajta │   │  │
│  │  │  index. Ez minden JOIN műveletnél full table scan-t  │   │  │
│  │  │  eredményez, ami nagy adatmennyiségnél drasztikusan  │   │  │
│  │  │  lassítja a lekérdezéseket.                         │   │  │
│  │  │                                                     │   │  │
│  │  │  Suggested fix:                                     │   │  │
│  │  │  ┌───────────────────────────────────────────────┐  │   │  │
│  │  │  │ CREATE INDEX idx_orders_customer              │  │   │  │
│  │  │  │   ON orders(customer_id);                     │  │   │  │
│  │  │  └───────────────────────────────────────────────┘  │   │  │
│  │  │                                                     │   │  │
│  │  │  [✅ Apply Fix]  [📋 Copy SQL]  [❌ Dismiss]       │   │  │
│  │  └─────────────────────────────────────────────────────┘   │  │
│  │                                                           │  │
│  │  ┌─ WARNING ──────────────────────────────────────────┐   │  │
│  │  │  🟡 Denormalized data: users.city_name             │   │  │
│  │  │                                                     │   │  │
│  │  │  Table: users │ Type: Normalization │ Impact: MED   │   │  │
│  │  │                                                     │   │  │
│  │  │  A `city_name` közvetlenül a users táblában van     │   │  │
│  │  │  tárolva. Ez redundanciát okoz: ha egy város neve   │   │  │
│  │  │  változik, minden users rekordot frissíteni kell.   │   │  │
│  │  │                                                     │   │  │
│  │  │  Suggested fix: Extract to separate table           │   │  │
│  │  │  ┌───────────────────────────────────────────────┐  │   │  │
│  │  │  │ CREATE TABLE cities (                         │  │   │  │
│  │  │  │   id INT PRIMARY KEY AUTO_INCREMENT,          │  │   │  │
│  │  │  │   name VARCHAR(100) NOT NULL UNIQUE           │  │   │  │
│  │  │  │ );                                            │  │   │  │
│  │  │  │ ALTER TABLE users ADD city_id INT;            │  │   │  │
│  │  │  │ ALTER TABLE users ADD FOREIGN KEY             │  │   │  │
│  │  │  │   (city_id) REFERENCES cities(id);            │  │   │  │
│  │  │  │ ALTER TABLE users DROP COLUMN city_name;      │  │   │  │
│  │  │  └───────────────────────────────────────────────┘  │   │  │
│  │  │                                                     │   │  │
│  │  │  [✅ Apply Fix]  [📋 Copy SQL]  [❌ Dismiss]       │   │  │
│  │  └─────────────────────────────────────────────────────┘   │  │
│  │                                                           │  │
│  │  ┌─ INFO ─────────────────────────────────────────────┐   │  │
│  │  │  🟢 Consider ENUM for orders.status                │   │  │
│  │  │  Table: orders │ Type: Convention │ Impact: LOW     │   │  │
│  │  │  ► [Expand for details]                             │   │  │
│  │  └─────────────────────────────────────────────────────┘   │  │
│  │                                                           │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─ DIFF VIEW (ha Apply utáni állapot) ──────────────────────┐ │
│  │  [ Original ]  [ Optimized ]  [ Side-by-Side ]            │  │
│  │                                                           │  │
│  │  - VARCHAR(20)                    (piros = törölt)        │  │
│  │  + ENUM('active','inactive')      (zöld = hozzáadott)     │  │
│  │                                                           │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

**Komponensek:**
- `HealthScoreGauge` — Animált körkörös gauge chart (Recharts)
- `BreakdownCards` — 4 kategória mini progress bar-ral
- `IssuesList` — Szűrhető, rendezhető issue kártyák
- `IssueCard` — Egyedi issue részletekkel + SQL fix + akció gombok
  - Severity szín kódolás (piros/sárga/zöld/kék)
  - Collapsible részletek
  - Apply/Copy/Dismiss gombok
- `DiffViewer` — Eredeti vs. módosított séma összehasonlítás
  - Side-by-side és inline mód
  - Szín kódolt diff (piros törlés, zöld hozzáadás)

**Health Score Számítás Logika:**

> **Részletes implementáció kóddal: lásd [Feature 1 (6. fejezet)](#feature-1-schema-health-score)**

```
Normalization (0-25) — AI (Claude API):
  - 1NF hiba (repeating groups, multi-valued columns)
  - 2NF hiba (partial dependencies in composite PKs)
  - 3NF hiba (transitive dependencies)
  - BCNF hiba
  - Pontozás: AI adja vissza (0-25 skálán)

Performance (0-25) — 100% statikus:
  - Hiányzó PK: -10
  - FK oszlop index nélkül: -5/db
  - VARCHAR túl nagy méret (>1000): -2/db

Security (0-25) — 100% statikus:
  - Sensitive oszlop plain text (password/token/ssn/stb.): -10/db
  - Hiányzó audit trail (created_at/updated_at): -3/tábla

Conventions (0-25) — 100% statikus:
  - Inkonzisztens naming (camelCase + snake_case mix): -5
  - Hiányzó NOT NULL ahol kellene (name/email/title/status/type): -2/db (max -10)
  - Nincs comment a táblákon: -1/db
```

---

### 5.4 MIGRATIONS PAGE (`/migrations`)

**Cél:** Migration scriptek kezelése, generálása, verzió history

```
┌─────────────────────────────────────────────────────────────────┐
│  ┌─ HEADER ──────────────────────────────────────────────────┐  │
│  │  🔄 Migrations    │  Format: [Flyway ▾]                   │  │
│  │                    │  [+ New Migration] [Generate from Diff]│ │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─ LEFT: MIGRATION LIST ────┬─ RIGHT: DETAILS ─────────────┐  │
│  │                           │                               │  │
│  │  ┌─ V003 ──────────────┐  │  Migration: V003              │  │
│  │  │ ✅ add_index_orders │  │  Name: add_index_orders       │  │
│  │  │ Applied: 2 min ago  │  │  Status: Applied              │  │
│  │  └─────────────────────┘  │  Created: 2026-03-11 14:30    │  │
│  │                           │                               │  │
│  │  ┌─ V002 ──────────────┐  │  ┌─ UP ────────────────────┐  │  │
│  │  │ ✅ create_cities    │  │  │  Tab: [UP] [DOWN]       │  │  │
│  │  │ Applied: 1 hour ago │  │  │                         │  │  │
│  │  └─────────────────────┘  │  │  CREATE INDEX           │  │  │
│  │                           │  │    idx_orders_customer   │  │  │
│  │  ┌─ V001 ──────────────┐  │  │    ON orders            │  │  │
│  │  │ ✅ initial_schema   │  │  │    (customer_id);       │  │  │
│  │  │ Applied: 2 hours ago│  │  │                         │  │  │
│  │  └─────────────────────┘  │  └─────────────────────────┘  │  │
│  │                           │                               │  │
│  │  ┌─ PENDING ───────────┐  │  ┌─ DOWN ──────────────────┐  │  │
│  │  │ ⏳ V004             │  │  │                         │  │  │
│  │  │ add_audit_columns   │  │  │  DROP INDEX             │  │  │
│  │  │ [Apply] [Edit]      │  │  │    idx_orders_customer  │  │  │
│  │  └─────────────────────┘  │  │    ON orders;           │  │  │
│  │                           │  │                         │  │  │
│  │                           │  └─────────────────────────┘  │  │
│  │                           │                               │  │
│  │                           │  Description:                 │  │
│  │                           │  "Index hozzáadása az orders  │  │
│  │                           │   tábla customer_id oszlopá-  │  │
│  │                           │   hoz a JOIN teljesítmény     │  │
│  │                           │   javítása érdekében."        │  │
│  │                           │                               │  │
│  │                           │  [📋 Copy] [📥 Download]     │  │
│  │                           │  [✏️ Edit] [🗑️ Delete]       │  │
│  └───────────────────────────┴───────────────────────────────┘  │
│                                                                 │
│  ┌─ SCHEMA VERSIONING TIMELINE ──────────────────────────────┐  │
│  │                                                           │  │
│  │  V001          V002           V003          V004          │  │
│  │   ●─────────────●──────────────●─ ─ ─ ─ ─ ─ ○            │  │
│  │   │             │              │             │            │  │
│  │  Initial     +cities       +index        +audit          │  │
│  │  schema      +city_id      customer_id   columns         │  │
│  │  8 tables    +1 table      orders        (pending)       │  │
│  │              +1 FK                                        │  │
│  │                                                           │  │
│  │  [View Diff V001→V002] [View Diff V002→V003]             │  │
│  │                                                           │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─ AI MIGRATION GENERATOR ──────────────────────────────────┐  │
│  │                                                           │  │
│  │  Describe the change you want to make:                    │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │ Add created_at and updated_at columns to all       │  │  │
│  │  │ tables that don't have them yet                     │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  │                                                           │  │
│  │  [🤖 Generate Migration]                                  │  │
│  │                                                           │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

**Komponensek:**
- `MigrationList` — bal oldali lista az összes migrációval
- `MigrationDetail` — jobb panel: UP/DOWN SQL, leírás, akciók
- `SchemaTimeline` — vizuális timeline a verzió történettel
- `MigrationGenerator` — AI-alapú migration generáló input
- `FormatSelector` — Flyway/Liquibase/Prisma/Raw SQL formátum

**Migration Formátumok:**

```
Flyway:
  V001__initial_schema.sql          (UP)
  U001__initial_schema.sql          (DOWN/Undo)

Liquibase:
  <changeSet id="001" author="dbmate">
    <sql>CREATE INDEX ...</sql>
    <rollback><sql>DROP INDEX ...</sql></rollback>
  </changeSet>

Prisma:
  migration.sql fájl + _meta.json

Raw SQL:
  -- UP
  CREATE INDEX ...;
  -- DOWN
  DROP INDEX ...;
```

---

### 5.5 EXPORT PAGE (`/export`)

**Cél:** Séma + migration + seed data exportálása

```
┌─────────────────────────────────────────────────────────────────┐
│  ┌─ HEADER ──────────────────────────────────────────────────┐  │
│  │  📤 Export    │  Schema: e-commerce_v2 (optimized)         │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─ EXPORT OPTIONS ──────────────────────────────────────────┐  │
│  │                                                           │  │
│  │  ┌─────────────────┐  ┌─────────────────┐                │  │
│  │  │  📄 Schema SQL   │  │  📄 Migrations  │                │  │
│  │  │                 │  │                 │                │  │
│  │  │ Complete schema │  │ All migration   │                │  │
│  │  │ as CREATE TABLE │  │ files bundled   │                │  │
│  │  │ statements      │  │                 │                │  │
│  │  │                 │  │ Format:         │                │  │
│  │  │ Include:        │  │ (●) Flyway      │                │  │
│  │  │ [✓] Indexes     │  │ ( ) Liquibase   │                │  │
│  │  │ [✓] FK-s        │  │ ( ) Prisma      │                │  │
│  │  │ [✓] Comments    │  │ ( ) Raw SQL     │                │  │
│  │  │ [ ] DROP IF EX. │  │                 │                │  │
│  │  │                 │  │                 │                │  │
│  │  │ [📥 Download]   │  │ [📥 Download]   │                │  │
│  │  └─────────────────┘  └─────────────────┘                │  │
│  │                                                           │  │
│  │  ┌─────────────────┐  ┌─────────────────┐                │  │
│  │  │  🌱 Seed Data   │  │  📊 ER Diagram  │                │  │
│  │  │                 │  │                 │                │  │
│  │  │ Generated test  │  │ Visual diagram  │                │  │
│  │  │ data as INSERT  │  │ export          │                │  │
│  │  │ statements      │  │                 │                │  │
│  │  │                 │  │ Format:         │                │  │
│  │  │ Rows per table: │  │ (●) PNG         │                │  │
│  │  │ [  50  ]        │  │ ( ) SVG         │                │  │
│  │  │                 │  │                 │                │  │
│  │  │ [Configure ▾]   │  │ Resolution:     │                │  │
│  │  │                 │  │ [2x ▾]          │                │  │
│  │  │ [📥 Download]   │  │                 │                │  │
│  │  └─────────────────┘  │ [📥 Download]   │                │  │
│  │                       └─────────────────┘                │  │
│  │                                                           │  │
│  │  ┌─────────────────┐  ┌─────────────────┐                │  │
│  │  │  📝 Docs        │  │  📦 Full Bundle │                │  │
│  │  │                 │  │                 │                │  │
│  │  │ Auto-generated  │  │ Everything in   │                │  │
│  │  │ documentation   │  │ a ZIP file:     │                │  │
│  │  │ in Markdown     │  │                 │                │  │
│  │  │                 │  │ • schema.sql    │                │  │
│  │  │ Include:        │  │ • migrations/   │                │  │
│  │  │ [✓] Table desc  │  │ • seed.sql      │                │  │
│  │  │ [✓] Relations   │  │ • er-diagram.png│                │  │
│  │  │ [✓] ER diagram  │  │ • docs.md       │                │  │
│  │  │                 │  │ • report.json   │                │  │
│  │  │ [📥 Download]   │  │                 │                │  │
│  │  └─────────────────┘  │ [📥 Download]   │                │  │
│  │                       └─────────────────┘                │  │
│  │                                                           │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─ PREVIEW ─────────────────────────────────────────────────┐  │
│  │                                                           │  │
│  │  (CodeMirror - read only - a kiválasztott export preview) │  │
│  │                                                           │  │
│  │  -- Generated by DBMate                                   │  │
│  │  -- Schema: e-commerce_v2                                 │  │
│  │  -- Date: 2026-03-11                                      │  │
│  │  -- Dialect: MySQL                                        │  │
│  │                                                           │  │
│  │  CREATE TABLE users (                                     │  │
│  │    id INT PRIMARY KEY AUTO_INCREMENT,                     │  │
│  │    ...                                                    │  │
│  │                                                           │  │
│  │                                    [📋 Copy to Clipboard] │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

### 5.6 SEED DATA GENERATOR (Modal / Panel a Dashboard-on)

```
┌─────────────────────────────────────────────────────────────────┐
│  🌱 Seed Data Generator                              [✕ Close] │
│                                                                 │
│  ┌─ TABLE SELECTION ─────────────────────────────────────────┐  │
│  │                                                           │  │
│  │  [✓] users       Rows: [ 50 ]                            │  │
│  │  [✓] orders      Rows: [ 200]   (auto: ~4x users)        │  │
│  │  [✓] products    Rows: [ 30 ]                            │  │
│  │  [✓] categories  Rows: [ 10 ]                            │  │
│  │  [ ] logs         Rows: [ -- ]   (skipped)                │  │
│  │                                                           │  │
│  │  Locale: [Magyar (hu) ▾]                                  │  │
│  │  Respect FK constraints: [✓]                              │  │
│  │  Include realistic data: [✓]                              │  │
│  │                                                           │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─ COLUMN RULES (users) ───────────────────────────────────┐  │
│  │                                                           │  │
│  │  Column          Rule              Preview                │  │
│  │  ──────────────────────────────────────────────────       │  │
│  │  id              Auto-increment     1, 2, 3...           │  │
│  │  name            faker:person.name  "Kovács Anna"        │  │
│  │  email           faker:internet     "kovacs@email.hu"    │  │
│  │  phone           faker:phone.hu     "+36 30 123 4567"    │  │
│  │  status          enum:active,       "active"             │  │
│  │                  inactive,blocked                         │  │
│  │  created_at      date:2023-2026     "2024-06-15 14:30"   │  │
│  │                                                           │  │
│  │  [Edit Rules]                                             │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─ PREVIEW ─────────────────────────────────────────────────┐  │
│  │                                                           │  │
│  │  INSERT INTO users (name, email, phone, status)           │  │
│  │  VALUES                                                   │  │
│  │    ('Kovács Anna', 'kovacs.anna@email.hu',                │  │
│  │     '+36301234567', 'active'),                            │  │
│  │    ('Nagy Péter', 'nagy.peter@gmail.com',                 │  │
│  │     '+36209876543', 'active'),                            │  │
│  │    ('Szabó Eszter', 'szabo.e@outlook.hu',                 │  │
│  │     '+36701112233', 'inactive'),                          │  │
│  │    ...                                                    │  │
│  │                                                           │  │
│  │  -- Generated: 50 rows for users                          │  │
│  │  -- Generated: 200 rows for orders                        │  │
│  │  -- Generated: 30 rows for products                       │  │
│  │  -- Total: 290 INSERT statements                          │  │
│  │                                                           │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  [🤖 Generate with AI]  [📋 Copy]  [📥 Download seed.sql]     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

### 5.7 QUERY HISTORY (Side Panel)

```
┌─────────────────────────────────────────┐
│  📚 Query History               [✕]     │
│                                         │
│  🔍 Search queries...                   │
│                                         │
│  ┌─ Today ────────────────────────────┐ │
│  │                                     │ │
│  │  14:32 "Összes ügyfél 3+ rend..."  │ │
│  │  SELECT u.name, COUNT(o.id)...     │ │
│  │  [Re-run] [Copy] [Delete]          │ │
│  │                                     │ │
│  │  14:15 "Top 10 termék eladás..."   │ │
│  │  SELECT p.name, SUM(oi.qty)...     │ │
│  │  [Re-run] [Copy] [Delete]          │ │
│  │                                     │ │
│  └─────────────────────────────────────┘ │
│                                         │
│  ┌─ Yesterday ────────────────────────┐ │
│  │  ...                               │ │
│  └─────────────────────────────────────┘ │
│                                         │
│  [Clear All History]                    │
└─────────────────────────────────────────┘
```

---

### 5.8 SHARE DIALOG

```
┌─────────────────────────────────────────┐
│  🔗 Share Schema                 [✕]    │
│                                         │
│  Share a read-only link to your schema: │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ localhost:3000/share?data=eJz.. │    │
│  │                          [📋]   │    │
│  └─────────────────────────────────┘    │
│                                         │
│  Include:                               │
│  [✓] Schema (tables, relations)         │
│  [✓] ER Diagram                         │
│  [ ] Health Report                      │
│  [ ] Query History                      │
│                                         │
│  Expires: [7 days ▾]                    │
│                                         │
│  [Generate Link]                        │
└─────────────────────────────────────────┘
```

---

### 5.9 SETTINGS PAGE (`/settings`)

```
┌─────────────────────────────────────────────────────────────────┐
│  ⚙️ Settings                                                    │
│                                                                 │
│  ┌─ Appearance ──────────────────────────────────────────────┐  │
│  │  Theme:    (●) Light  ( ) Dark  ( ) System                │  │
│  │  Language: [Magyar ▾]                                     │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─ Database ────────────────────────────────────────────────┐  │
│  │  Default Dialect: [MySQL ▾]                               │  │
│  │  Migration Format: [Flyway ▾]                             │  │
│  │  Seed Data Locale: [Magyar (hu) ▾]                        │  │
│  │  Default Seed Rows: [50]                                  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─ AI Configuration ───────────────────────────────────────┐  │
│  │  API Status: ✅ Configured (.env.local)  [Test Connection]│  │
│  │  Model: [claude-sonnet-4-6 ▾]                                │  │
│  │  Temperature: [0.1] (alacsony = pontosabb SQL)            │  │
│  │  Max tokens: [4096]                                       │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─ Data Management ────────────────────────────────────────┐  │
│  │  [Clear Query History]                                    │  │
│  │  [Clear All Schemas]                                      │  │
│  │  [Export App Data (JSON)]                                 │  │
│  │  [Import App Data]                                        │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. Feature-ök Részletes Specifikáció

### Feature 1: Schema Health Score

**Leírás:** Vizuális pontszám (0-100) amely 4 kategória alapján értékeli a sémát.

**Implementáció: HIBRID (3 statikus + 1 AI kategória)**

#### 1/A. Statikus ellenőrzések — `static-analyzer.ts` (NEM igényel AI-t, azonnali)

**Performance (0-25) — 100% statikus:**
```typescript
function checkPerformance(schema: Schema): { score: number; issues: AnalysisIssue[] } {
  let score = 25;
  const issues: AnalysisIssue[] = [];
  const dialect = schema.dialect;

  for (const table of schema.tables) {
    // Hiányzó PK (-10)
    if (table.primaryKey.length === 0) {
      score -= 10;
      const pkSQL = dialect === 'postgresql'
        ? `ALTER TABLE ${table.name} ADD COLUMN id SERIAL PRIMARY KEY;`
        : dialect === 'sqlite'
        ? `-- SQLite: ALTER TABLE cannot add PK. Recreate table with: id INTEGER PRIMARY KEY AUTOINCREMENT`
        : `ALTER TABLE ${table.name} ADD COLUMN id INT PRIMARY KEY AUTO_INCREMENT;`;
      issues.push({
        id: nanoid(), type: 'performance', severity: 'critical',
        title: `Missing primary key on ${table.name}`,
        affectedTable: table.name, fixSQL: pkSQL, estimatedImpact: 'high',
      });
    }
    // FK oszlop index nélkül (-5/db)
    for (const fk of table.foreignKeys) {
      const hasIndex = table.indexes.some(idx =>
        fk.columns.every(c => idx.columns.includes(c))
      );
      if (!hasIndex) {
        score -= 5;
        const idxName = `idx_${table.name}_${fk.columns.join('_')}`;
        issues.push({
          id: nanoid(), type: 'performance', severity: 'critical',
          title: `Missing index on ${table.name}.${fk.columns.join(', ')}`,
          affectedTable: table.name, affectedColumns: fk.columns,
          fixSQL: `CREATE INDEX ${idxName} ON ${table.name}(${fk.columns.join(', ')});`,
          estimatedImpact: 'high',
        });
      }
    }
    // VARCHAR túl nagy méret (-2/db)
    for (const col of table.columns) {
      const match = col.type.match(/VARCHAR\((\d+)\)/i);
      if (match && parseInt(match[1]) > 1000) {
        score -= 2;
        issues.push({
          id: nanoid(), type: 'performance', severity: 'warning',
          title: `Oversized VARCHAR(${match[1]}) on ${table.name}.${col.name}`,
          affectedTable: table.name, affectedColumns: [col.name],
          suggestion: 'Consider using TEXT type instead', estimatedImpact: 'low',
        });
      }
    }
  }
  return { score: Math.max(0, score), issues };
}
```

**Security (0-25) — 100% statikus:**
```typescript
const SENSITIVE_PATTERNS = /^(password|pwd|passwd|secret|token|api_key|ssn|credit_card|card_number)$/i;

function checkSecurity(schema: Schema): { score: number; issues: AnalysisIssue[] } {
  let score = 25;
  const issues: AnalysisIssue[] = [];

  for (const table of schema.tables) {
    // Sensitive oszlop plain text (-10)
    for (const col of table.columns) {
      if (SENSITIVE_PATTERNS.test(col.name) && !col.type.match(/BLOB|BINARY/i)) {
        score -= 10;
        issues.push({
          id: nanoid(), type: 'security', severity: 'critical',
          title: `Plain text sensitive field: ${table.name}.${col.name}`,
          affectedTable: table.name, affectedColumns: [col.name],
          suggestion: 'Hash or encrypt this column', estimatedImpact: 'high',
        });
      }
    }
    // Hiányzó audit trail (-3)
    const hasCreatedAt = table.columns.some(c => /^(created_at|created_on)$/i.test(c.name));
    const hasUpdatedAt = table.columns.some(c => /^(updated_at|updated_on|modified_at)$/i.test(c.name));
    if (!hasCreatedAt || !hasUpdatedAt) {
      score -= 3;
      const missing = [!hasCreatedAt && 'created_at', !hasUpdatedAt && 'updated_at'].filter(Boolean);
      issues.push({
        id: nanoid(), type: 'security', severity: 'info',
        title: `Missing audit columns on ${table.name}: ${missing.join(', ')}`,
        affectedTable: table.name,
        fixSQL: missing.map(c =>
          `ALTER TABLE ${table.name} ADD COLUMN ${c} TIMESTAMP DEFAULT CURRENT_TIMESTAMP;`
        ).join('\n'),
        estimatedImpact: 'medium',
      });
    }
  }
  return { score: Math.max(0, score), issues };
}
```

**Conventions (0-25) — 100% statikus:**
```typescript
function checkConventions(schema: Schema): { score: number; issues: AnalysisIssue[] } {
  let score = 25;
  const issues: AnalysisIssue[] = [];
  const allNames = schema.tables.flatMap(t => [t.name, ...t.columns.map(c => c.name)]);

  // Naming inkonzisztencia (-5 ha camelCase + snake_case keverék)
  const snakeNames = allNames.filter(n => n.includes('_'));
  const camelNames = allNames.filter(n => /[a-z][A-Z]/.test(n));
  if (snakeNames.length > 0 && camelNames.length > 0) {
    score -= 5;
    issues.push({
      id: nanoid(), type: 'convention', severity: 'warning',
      title: `Mixed naming: ${snakeNames.length} snake_case + ${camelNames.length} camelCase`,
      affectedTable: schema.tables[0]?.name ?? 'schema-wide',
      suggestion: 'Pick one convention and apply consistently', estimatedImpact: 'medium',
    });
  }

  let nullablePenalty = 0;
  for (const table of schema.tables) {
    // Hiányzó NOT NULL ahol kellene (-2/db, max -10 összesen)
    for (const col of table.columns) {
      if (col.nullable && !col.primaryKey && /^(name|email|title|status|type)$/i.test(col.name)) {
        if (nullablePenalty < 10) {
          score -= 2;
          nullablePenalty += 2;
        }
        issues.push({
          id: nanoid(), type: 'convention', severity: 'info',
          title: `${table.name}.${col.name} is nullable but likely should be NOT NULL`,
          affectedTable: table.name, affectedColumns: [col.name],
        });
      }
    }
    // Nincs comment (-1/db)
    if (!table.comment) {
      score -= 1;
    }
  }
  return { score: Math.max(0, score), issues };
}
```

#### 1/B. AI elemzés — csak Normalization (0-25):
```
Analyze ONLY the normalization quality of this schema.
Do NOT check performance, security, or naming (those are handled locally).

Schema: {{FULL_SCHEMA_JSON}}

Check for:
1. 1NF violations (repeating groups, multi-valued columns)
2. 2NF violations (partial dependencies in composite PKs)
3. 3NF violations (transitive dependencies)
4. BCNF violations

Return JSON:
{
  "normalization": <0-25>,
  "issues": [{ "type": "normalization", "severity": "...", "title": "...",
               "description": "...", "affectedTable": "...", "suggestion": "...", "fixSQL": "..." }],
  "summary": "Brief normalization assessment"
}
```

#### 1/C. Score összeállítás:
```typescript
async function analyzeSchema(schema: Schema): Promise<SchemaHealthReport> {
  // 1. Statikus (azonnali, ~0ms)
  const perf = checkPerformance(schema);
  const sec  = checkSecurity(schema);
  const conv = checkConventions(schema);

  // 2. AI normalization (~2-5s, egyetlen API hívás) — graceful fallback ha AI nem elérhető
  let norm: { normalization: number; issues: AnalysisIssue[]; summary: string };
  try {
    norm = await analyzeNormalizationWithAI(schema);
  } catch (error) {
    // AI hiba (rate limit, network, API key hiányzik) → normalization = 0, figyelmeztetéssel
    norm = {
      normalization: 0,
      issues: [],
      summary: `⚠️ Normalization analysis unavailable (AI error: ${error instanceof Error ? error.message : 'unknown'}). ` +
               `Performance, security, and conventions scores are still accurate.`,
    };
  }

  return {
    score: perf.score + sec.score + conv.score + norm.normalization,
    breakdown: {
      performance: perf.score, security: sec.score,
      conventions: conv.score, normalization: norm.normalization,
    },
    issues: [...perf.issues, ...sec.issues, ...conv.issues, ...norm.issues],
    summary: norm.summary,
  };
}
```

**UI:** Gauge chart (Recharts PieChart 270°-os ív), animált szám, szín kódok (piros <50, sárga 50-75, zöld 75+)
- Perf/Security/Conventions score **azonnal** megjelenik (statikus)
- Normalization kártyán skeleton/spinner amíg az AI válaszol
- **~75% AI token megtakarítás** az eredeti 100% AI-hoz képest

---

### Feature 2: Query History

**Implementáció:**
- SQLite tábla: `query_history (id, schema_id, nl_input, sql_output, explanation, created_at)`
- Max 100 bejegyzés/séma, FIFO
- Keresés NL input-ban (LIKE %query%)
- Re-run: betölti az NL-t a chat input-ba

---

### Feature 3: Diff View

**Implementáció:**
- `diff` npm csomag használata
- Eredeti vs. módosított SQL szöveg összehasonlítás
- Két mód: side-by-side (két CodeMirror egymás mellett) és inline (egyben, szín kódolva)
- Piros háttér = törölt sorok, zöld háttér = hozzáadott sorok

---

### Feature 4: Multi-dialect Support

**Implementáció:**
- `node-sql-parser` támogatja mindhárom dialektust
- Dialect kiválasztás az Import oldalon
- Az AI prompt-ban átadjuk a dialektust → dialect-specifikus SQL-t generál
- Export-nál a kiválasztott dialektus szintaxisát használja

**Különbségek kezelése:**
```
MySQL:       AUTO_INCREMENT, UNSIGNED, ENGINE=InnoDB
PostgreSQL:  SERIAL, BIGSERIAL, GENERATED ALWAYS AS IDENTITY
SQLite:      AUTOINCREMENT, nincs ENUM, korlátozott ALTER TABLE
```

---

### Feature 5: Dark Mode

**Implementáció:**
- shadcn/ui beépített dark mode támogatás (`next-themes`)
- `<ThemeProvider>` a root layout-ban
- CodeMirror dark theme: `@codemirror/theme-one-dark`
- ReactFlow dark háttér: custom CSS
- Zustand settings store: `theme: 'light' | 'dark' | 'system'`

---

### Feature 6: ER Diagram Export

**Implementáció:**
- ReactFlow `.toObject()` → JSON export
- `html-to-image` könyvtár: DOM → PNG/SVG
- Exportálás előtt: zoom-to-fit, fehér háttér beállítás
- Két felbontás: 1x (normál) és 2x (retina/nyomtatás)

---

### Feature 7: Schema Versioning

**Implementáció:**
- Minden séma módosítás (Apply Fix, Manual Edit) → új verzió a `schema_versions` táblában
- SQLite: `schema_versions (id, schema_id, version_number, schema_json, change_description, created_at)`
- Timeline vizualizáció: horizontális pont vonal, kattintásra diff megjelenítés
- Undo/Redo: verzió váltás a timeline-on

---

### Feature 8: Explain Plan Visualization

**Implementáció:**
- Felhasználó megírja a query-t (vagy AI generálja)
- Az AI-tól kérjük az EXPLAIN elemzését (nem valódi DB-n futtatjuk)
- Vizualizáció: fa struktúra a query lépésekről

```
EXPLAIN vizualizáció:

  ┌─────────────────┐
  │ SELECT          │ cost: 45.2
  │ (Final Result)  │ rows: 150
  └────────┬────────┘
           │
  ┌────────▼────────┐
  │ HASH JOIN       │ cost: 42.1
  │ users ⋈ orders  │ rows: 150
  └───┬─────────┬───┘
      │         │
┌─────▼───┐ ┌───▼──────┐
│ SEQ SCAN│ │INDEX SCAN │
│ users   │ │ orders    │
│ cost:2.1│ │ cost: 8.5 │
│ rows:100│ │ rows: 500 │
└─────────┘ └───────────┘
```

- Szín kódok: piros = SEQ SCAN (drága), zöld = INDEX SCAN (olcsó), sárga = HASH JOIN

---

### Feature 9: Collaboration (Share Link)

**Implementáció (részletek a 15. fejezetben):**
- **Opció A (alapértelmezett):** Schema JSON → gzip (pako) → base64url encode → URL query param. Max ~50KB sémáig működik, nincs szerver-oldali storage igény
- **Opció B (self-hosted):** SQLite `shares` tábla, nanoid short link, lejárat kezelés
- Read-only nézet: ER diagram + tábla lista, chat nélkül
- Lejárat (Opció B): 24h / 7d / 30d / never

---

### Feature 10: Automatikus Migrációs Script Generálás

**Implementáció: HIBRID (statikus template-ek + AI fallback)**

#### 10/A. Statikus migration template-ek — `migration-templates.ts` (NEM igényel AI-t)

Az alábbi egyszerű műveletek **statikus kódból** generálhatók, ~0ms:

```typescript
type MigrationOp =
  | { type: 'ADD_INDEX'; table: string; columns: string[]; unique?: boolean }
  | { type: 'DROP_INDEX'; table: string; indexName: string }
  | { type: 'ADD_COLUMN'; table: string; column: Column }
  | { type: 'DROP_COLUMN'; table: string; columnName: string }
  | { type: 'ADD_FK'; table: string; fk: ForeignKey }
  | { type: 'DROP_FK'; table: string; constraintName: string }
  | { type: 'APPLY_FIX'; fixSQL: string }; // fixSQL from AnalysisIssue

function generateStaticMigration(
  op: MigrationOp, dialect: Dialect, version: string, schemaId: string
): Migration {
  const base = { id: nanoid(), schemaId, version, format: 'raw' as const, appliedAt: undefined };

  switch (op.type) {
    case 'ADD_INDEX': {
      const name = `idx_${op.table}_${op.columns.join('_')}`;
      const uniq = op.unique ? 'UNIQUE ' : '';
      return {
        ...base,
        name: `add_${op.unique ? 'unique_' : ''}index_${op.table}_${op.columns.join('_')}`,
        upSQL: `CREATE ${uniq}INDEX ${name} ON ${op.table}(${op.columns.join(', ')});`,
        downSQL: dialect === 'mysql'
          ? `DROP INDEX ${name} ON ${op.table};`
          : `DROP INDEX ${name};`,  // PG/SQLite
        description: `Add ${uniq}index on ${op.table}(${op.columns.join(', ')})`,
      };
    }
    case 'ADD_COLUMN': {
      const { table, column } = op;
      const nullable = column.nullable ? '' : ' NOT NULL';
      const def = column.defaultValue ? ` DEFAULT ${column.defaultValue}` : '';
      const downSQL = dialect === 'sqlite'
        ? `-- SQLite <3.35: ALTER TABLE DROP COLUMN nem támogatott.\n-- SQLite >=3.35: ALTER TABLE ${table} DROP COLUMN ${column.name};`
        : `ALTER TABLE ${table} DROP COLUMN ${column.name};`;
      return {
        ...base,
        name: `add_${column.name}_to_${table}`,
        upSQL: `ALTER TABLE ${table} ADD COLUMN ${column.name} ${column.type}${nullable}${def};`,
        downSQL,
        description: `Add column ${column.name} to ${table}`,
      };
    }
    case 'DROP_COLUMN': {
      const dropSQL = dialect === 'sqlite'
        ? `-- SQLite <3.35: DROP COLUMN nem támogatott. Tábla újraépítés szükséges.\n-- SQLite >=3.35: ALTER TABLE ${op.table} DROP COLUMN ${op.columnName};`
        : `ALTER TABLE ${op.table} DROP COLUMN ${op.columnName};`;
      return {
        ...base,
        name: `drop_${op.columnName}_from_${op.table}`,
        upSQL: dropSQL,
        downSQL: '-- TODO: Manual rollback required (recreate column with original type)',
        description: `Drop column ${op.columnName} from ${op.table}`,
      };
    }
    case 'APPLY_FIX': {
      // fixSQL from AnalysisIssue → wrap as UP, infer DOWN
      return {
        ...base,
        name: `apply_fix_${version}`,
        upSQL: op.fixSQL,
        downSQL: '-- TODO: Manual rollback required',
        description: 'Apply optimizer fix',
      };
    }
    case 'DROP_INDEX': {
      return {
        ...base,
        name: `drop_index_${op.indexName}_on_${op.table}`,
        upSQL: dialect === 'mysql'
          ? `DROP INDEX ${op.indexName} ON ${op.table};`
          : `DROP INDEX ${op.indexName};`,  // PG/SQLite
        downSQL: '-- TODO: Manual rollback required (recreate index with original definition)',
        description: `Drop index ${op.indexName} on ${op.table}`,
      };
    }
    case 'ADD_FK': {
      const constraintName = op.fk.name ?? `fk_${op.table}_${op.fk.columns.join('_')}`;
      const onDelete = op.fk.onDelete ? ` ON DELETE ${op.fk.onDelete}` : '';
      const onUpdate = op.fk.onUpdate ? ` ON UPDATE ${op.fk.onUpdate}` : '';
      return {
        ...base,
        name: `add_fk_${op.table}_${op.fk.columns.join('_')}`,
        upSQL: `ALTER TABLE ${op.table} ADD CONSTRAINT ${constraintName} ` +
               `FOREIGN KEY (${op.fk.columns.join(', ')}) ` +
               `REFERENCES ${op.fk.referencedTable}(${op.fk.referencedColumns.join(', ')})${onDelete}${onUpdate};`,
        downSQL: dialect === 'mysql'
          ? `ALTER TABLE ${op.table} DROP FOREIGN KEY ${constraintName};`
          : `ALTER TABLE ${op.table} DROP CONSTRAINT ${constraintName};`,  // PG/SQLite
        description: `Add foreign key on ${op.table}(${op.fk.columns.join(', ')}) → ${op.fk.referencedTable}`,
      };
    }
    case 'DROP_FK': {
      return {
        ...base,
        name: `drop_fk_${op.constraintName}_from_${op.table}`,
        upSQL: dialect === 'mysql'
          ? `ALTER TABLE ${op.table} DROP FOREIGN KEY ${op.constraintName};`
          : `ALTER TABLE ${op.table} DROP CONSTRAINT ${op.constraintName};`,
        downSQL: '-- TODO: Manual rollback required (recreate FK with original definition)',
        description: `Drop foreign key ${op.constraintName} from ${op.table}`,
      };
    }
  }
}
```

**Statikus formátum konverzió — `migration-formatter.ts` (0% AI):**

```typescript
function formatMigration(migration: Migration, format: MigrationFormat): string {
  switch (format) {
    case 'flyway':
      return `-- ${migration.version}__${migration.name}.sql\n${migration.upSQL}`;
    case 'liquibase':
      return `<changeSet id="${migration.version}" author="dbmate">\n` +
             `  <sql>${migration.upSQL}</sql>\n` +
             `  <rollback><sql>${migration.downSQL}</sql></rollback>\n` +
             `</changeSet>`;
    case 'prisma':
      return `-- migration.sql\n${migration.upSQL}`;
    case 'raw':
      return `-- UP\n${migration.upSQL}\n\n-- DOWN\n${migration.downSQL}`;
  }
}
```

#### 10/B. AI fallback — komplex migrációk

Az alábbi esetek **AI-t igényelnek** (szabad szöveges kérés, komplex refaktorálás):

```
Flow:
1. User beírja: "Add created_at and updated_at to all tables that don't have them"
   VAGY: "Split users table into users + addresses"
2. A rendszer felismeri, hogy ez nem egyszerű template művelet → AI-hoz küldi

AI Prompt (szűkített, csak komplex esetekre):

Generate a database migration for a complex schema change.

Current schema: {{SCHEMA_JSON}}
Requested change: "{{CHANGE_DESCRIPTION}}"
Dialect: {{DIALECT}}

Requirements:
- Generate both UP (apply) and DOWN (rollback) scripts
- DOWN must perfectly reverse the UP
- Handle data preservation where needed

Return JSON:
{ "name": "...", "description": "...", "upSQL": "...", "downSQL": "..." }
```

#### 10/C. Intent felismerés — `parseMigrationIntent` (NL → MigrationOp):
```typescript
// Egyszerű regex-alapú pattern matching a szabad szöveges kérésre.
// Ha felismerhető, MigrationOp-ot ad vissza → statikus template.
// Ha nem, null → AI fallback.
// ⚠️ MEGJEGYZÉS: A pattern-ek angol nyelvűek. Magyar nyelvű kérés → null → AI fallback,
//   ami természetesen kezeli a magyar NL-t is. Ez szándékos: a statikus path angol
//   "Add index on X(Y)" formátumot vár, a szabad szöveges magyar kérés AI-ra megy.
const INTENT_PATTERNS: { pattern: RegExp; extract: (m: RegExpMatchArray) => MigrationOp | null }[] = [
  {
    pattern: /add (?:an? )?(?:unique )?index (?:on )?(\w+)\(([^)]+)\)/i,
    extract: (m) => ({
      type: 'ADD_INDEX', table: m[1],
      columns: m[2].split(',').map(c => c.trim()),
      unique: /unique/i.test(m[0]),
    }),
  },
  {
    pattern: /drop index (\w+) on (\w+)/i,
    extract: (m) => ({ type: 'DROP_INDEX', table: m[2], indexName: m[1] }),
  },
  {
    pattern: /add column (\w+) (\w+(?:\([^)]*\))?) to (\w+)/i,
    extract: (m) => ({
      type: 'ADD_COLUMN', table: m[3],
      column: { name: m[1], type: m[2], nullable: true, primaryKey: false,
                autoIncrement: false, unique: false } as Column,
    }),
  },
  {
    pattern: /drop column (\w+) from (\w+)/i,
    extract: (m) => ({ type: 'DROP_COLUMN', table: m[2], columnName: m[1] }),
  },
  {
    pattern: /add foreign key (?:on )?(\w+)\(([^)]+)\) referenc(?:es|ing) (\w+)\(([^)]+)\)/i,
    extract: (m) => ({
      type: 'ADD_FK', table: m[1],
      fk: {
        columns: m[2].split(',').map(c => c.trim()),
        referencedTable: m[3],
        referencedColumns: m[4].split(',').map(c => c.trim()),
      } as ForeignKey,
    }),
  },
  {
    pattern: /drop (?:foreign key|constraint) (\w+) (?:on|from) (\w+)/i,
    extract: (m) => ({ type: 'DROP_FK', table: m[2], constraintName: m[1] }),
  },
];

function parseMigrationIntent(change: string): MigrationOp | null {
  for (const { pattern, extract } of INTENT_PATTERNS) {
    const match = change.match(pattern);
    if (match) return extract(match);
  }
  return null; // → AI fallback
}
```

#### 10/D. Döntési logika:
```typescript
async function generateMigration(request: MigrationRequest): Promise<Migration> {
  // 1. Ha van fixSQL (Apply Fix gombból) → statikus
  if (request.fixSQL) {
    return generateStaticMigration(
      { type: 'APPLY_FIX', fixSQL: request.fixSQL },
      request.dialect, request.nextVersion, request.schemaId
    );
  }

  // 2. Ha felismerhető pattern (ADD INDEX, ADD COLUMN, stb.) → statikus
  const parsed = parseMigrationIntent(request.change);
  if (parsed) {
    return generateStaticMigration(parsed, request.dialect, request.nextVersion, request.schemaId);
  }

  // 3. Egyébként → AI fallback
  return await generateMigrationWithAI(request);
}
```

**Formátum példák:**

Flyway:
```sql
-- V003__add_index_orders_customer_id.sql
CREATE INDEX idx_orders_customer_id ON orders(customer_id);

-- U003__add_index_orders_customer_id.sql
DROP INDEX idx_orders_customer_id ON orders;
```

Prisma:
```sql
-- migration.sql
CREATE INDEX "idx_orders_customer_id" ON "orders"("customer_id");
```

**Eredmény:** Egyszerű migrációk ~70% statikusan, ~30% AI → jelentős token megtakarítás

---

### Feature 11: Seed Data Generator

**Részletes implementáció:**

```
Input:  Séma JSON + konfiguráció (táblák, sorok száma, locale, egyedi szabályok)
Output: INSERT INTO statements

Flow:
1. User megnyitja a Seed Data Generator-t
2. Kiválasztja a táblákat és sorok számát
3. Opcionálisan testreszabja az oszlop szabályokat
4. "Generate" → AI generálja a realisztikus adatokat
5. Preview → Copy/Download
```

**AI Prompt:**
```
Generate realistic seed data for the following database schema.

Schema:
{{SCHEMA_JSON}}

Configuration:
- Tables to seed: {{TABLE_LIST_WITH_ROW_COUNTS}}
- Locale: {{LOCALE}} (use locale-appropriate names, addresses, etc.)
- Respect all foreign key constraints
- Ensure UNIQUE constraints are not violated
- Use realistic, diverse data (not "test1", "test2")

Column-specific rules:
{{CUSTOM_RULES}}

Requirements:
- Generate valid INSERT INTO statements
- Insert in dependency order (referenced tables first)
- Include proper escaping for strings
- Status/enum columns: use realistic distribution (e.g., 70% active, 20% inactive, 10% blocked)
- Dates: distribute across the specified range
- Prices: realistic ranges for the domain
- Names: use {{LOCALE}} locale names

Return the complete INSERT statements as SQL.
```

**Intelligens feature-ök:**
- **FK Dependency Resolution:** Topological sort a táblákon → helyes INSERT sorrend
- **Realistic Distribution:** Nem egyenletes, hanem valószerű eloszlás (Gauss, Pareto)
- **Cross-table Consistency:** Ha egy user-nek 5 order-je van, azok összege reális
- **Locale-aware:** Magyar nevek, magyar telefonszámok, magyar címek
- **Auto Row Count:** FK alapján automatikusan javasolja: ha 50 user, akkor ~200 order

---

## 7. AI Integráció & Prompt Engineering

### 7.1 System Prompt (minden kérésnél küldve)

```
You are DBMate AI, an expert database analyst, SQL engineer, and optimization consultant.

## Your Capabilities (only tasks that require AI):
1. Generate correct, optimized SQL queries from natural language
2. Analyze schemas for NORMALIZATION issues (1NF through BCNF) — performance/security/conventions are handled locally
3. Generate complex migration scripts (multi-table refactoring, data transformation)
4. Generate realistic seed/test data with locale-appropriate values
5. Simulate EXPLAIN plans for queries (no real DB execution)
6. Explain SQL concepts clearly

NOTE: Simple tasks (missing index detection, naming checks, basic migration templates) are handled
by the local static analyzer. You are called ONLY for tasks requiring semantic understanding.

## Rules:
- ALWAYS reference actual table and column names from the provided schema
- NEVER invent tables or columns that don't exist in the schema
- Output SQL in ```sql code blocks
- Keep explanations concise but clear
- When suggesting changes, provide executable SQL
- Consider the specified SQL dialect for syntax
- For Hungarian locale requests, use Hungarian names and data
- Be honest about limitations — if a query can't be expressed in SQL, say so

## Current Context:
- Schema: {{SCHEMA_NAME}}
- Dialect: {{DIALECT}}
- Tables: {{TABLE_COUNT}}
- Table names: {{TABLE_NAMES}}
```

### 7.2 Task-Specifikus Promptok

**NL→SQL:**
```
Schema context:
{{FULL_SCHEMA_JSON}}

User question: "{{USER_QUESTION}}"

Generate a SQL query that answers this question.
Return JSON: { "sql": "...", "explanation": "..." }
```

**Schema Normalization Analysis (AI-only — perf/security/conventions are static):**
```
Analyze ONLY the normalization quality of this schema.
Do NOT check performance, security, or naming conventions — those are handled by the local static analyzer.

{{FULL_SCHEMA_JSON}}

Check for:
1. 1NF violations (repeating groups, multi-valued columns, non-atomic values)
2. 2NF violations (partial dependencies in composite primary keys)
3. 3NF violations (transitive dependencies — e.g., city_name stored directly instead of via FK)
4. BCNF violations (non-trivial functional dependencies where determinant is not a superkey)

Return JSON:
{
  "normalization": <0-25>,
  "issues": [{ "type": "normalization", "severity": "...", "title": "...",
               "description": "...", "affectedTable": "...", "suggestion": "...", "fixSQL": "..." }],
  "summary": "Brief normalization assessment"
}
```

**Migration Generation (AI fallback — simple migrations use static templates):**
```
This is a COMPLEX migration that cannot be handled by static templates.
Simple operations (ADD INDEX, ADD/DROP COLUMN, ADD FK) are handled locally.

Current schema: {{SCHEMA_JSON}}
Requested change: "{{CHANGE_DESCRIPTION}}"
Dialect: {{DIALECT}}

Generate migration with UP and DOWN scripts.
DOWN must perfectly reverse the UP. Handle data preservation where needed.
Return JSON: { "name": "...", "upSQL": "...", "downSQL": "...", "description": "..." }
```

**Seed Data:**
```
Schema: {{SCHEMA_JSON}}
Tables: {{TABLE_CONFIG}}
Locale: {{LOCALE}}
Custom rules: {{RULES}}

Generate INSERT statements. Respect FK order and constraints.
```

---

## 8. Implementációs Fázisok & Sorrend

### FÁZIS 1: Alapok (1-2 nap)
> Projekt setup, core infrastruktúra

```
1.1  Next.js 15 projekt inicializálás (pnpm create next-app)
1.2  shadcn/ui telepítés és konfigurálás
1.3  TailwindCSS 4 + dark mode setup
1.4  Alapvető layout: sidebar navigation + content area (responsive: hamburger menu mobile-on)
1.5  Zustand store létrehozása (schema, settings, loading/error states)
1.6  SQLite database setup (better-sqlite3) — teljes séma (lásd 11. fejezet)
1.7  Alap routing: /, /dashboard, /optimizer, /migrations, /export, /settings
1.8  Input validációs utility-k (MAX_SQL_INPUT_SIZE, rate limiter, DOMPurify)
```

**Deliverable:** Navigálható app váz, dark mode toggle működik, responsive sidebar

---

### FÁZIS 2: Schema Import & Parsing (1 nap)
> SQL beolvasás és parse-olás

```
2.1  CodeMirror 6 integrálás SQL syntax highlighting-gal
2.2  SQL Parser Service (node-sql-parser wrapper)
     - Parse CREATE TABLE → structured JSON
     - FK relációk kinyerése
     - Index-ek kinyerése
     - Hiba kezelés (invalid SQL)
2.3  Import Page UI: paste area + file upload + dialect selector
2.4  Template Gallery: 4-8 előre definiált séma
2.5  /api/parse endpoint
2.6  Zustand store update: importSchema action
2.7  Parse utáni redirect → Dashboard
```

**Deliverable:** SQL beillesztés → parse → structured data a store-ban

---

### FÁZIS 3: ER Diagram & Dashboard (1-2 nap)
> Vizuális séma megjelenítés és alap dashboard

```
3.1  ReactFlow setup + custom TableNode komponens
     - Tábla név header
     - Oszlopok lista (PK/FK ikonok, típus)
     - Összefoglaló sor (index/FK count)
3.2  Custom RelationEdge: FK vonalak (1:N, N:M jelölés)
3.3  Auto-layout algoritmus (dagre vagy elkjs)
3.4  Zoom/Pan/Fit kontrollok
3.5  Tábla kattintás → bottom panel: tábla részletek
3.6  Dashboard toolbar: séma info, mini health score
3.7  Bottom panel: Columns/Indexes/FK/SQL tabs
```

**Deliverable:** Interaktív ER diagram, tábla részletek panel

---

### FÁZIS 4: AI Chat Integration (1 nap)
> Claude API integráció, NL→SQL

```
4.1  Claude API client setup (@anthropic-ai/sdk)
4.2  AI Service: context builder + prompt assembly
4.3  /api/query endpoint (streaming SSE)
4.4  Chat UI: message list + input + quick actions
4.5  ChatMessage komponens: markdown render + SQL code block
4.6  SQL code block: copy gomb + syntax highlighting
4.7  Streaming válasz megjelenítés (SSE → progressive render)
4.8  Error handling: API errors, rate limits
```

**Deliverable:** Működő AI chat, NL→SQL generálás

---

### FÁZIS 5: Schema Analysis & Optimizer (1 nap)
> Health score (hibrid), issue detection, fix javaslatok

```
5.1  static-analyzer.ts: checkPerformance(), checkSecurity(), checkConventions()
     - Determinisztikus issue detection (FK index, PK, naming, audit, sensitive cols)
     - Automatikus fixSQL generálás a talált issue-khoz
5.2  /api/analyze endpoint (hibrid: statikus + AI normalization)
5.3  AI prompt: CSAK normalization elemzés (1NF-BCNF), szűkített scope
5.4  HealthScoreGauge komponens (Recharts)
     - Statikus 3 kategória azonnal megjelenik
     - Normalization: skeleton amíg AI válaszol
5.5  Breakdown kártyák (4 kategória)
5.6  IssueCard komponens (severity, leírás, fix SQL, akció gombok)
5.7  Issue szűrés (severity, table, type)
5.8  "Apply Fix" funkció:
     - Fix SQL alkalmazása a schema store-ra
     - Séma frissítése a parse-olt fix-szel
     - Új verzió mentése
     - Statikus migration generálás az Apply Fix-ből (lásd 6.1)
5.9  Diff View: eredeti vs. módosított
```

**Deliverable:** Health score gauge (hibrid), issue lista, Apply Fix + auto migration működik

---

### FÁZIS 6: Migration System (1 nap)
> Migration generálás (hibrid: statikus template + AI fallback), kezelés, verzió timeline

```
6.1  migration-templates.ts: generateStaticMigration()
     - Statikus template-ek: ADD_INDEX, DROP_INDEX, ADD_COLUMN, DROP_COLUMN, ADD_FK, DROP_FK, APPLY_FIX
     - Dialect-aware SQL generálás (MySQL vs PostgreSQL vs SQLite szintaxis)
6.2  migration-formatter.ts: formatMigration()
     - Flyway/Liquibase/Prisma/Raw formátum konverzió — 100% statikus
6.3  /api/migrate endpoint (hibrid döntési logika):
     - fixSQL → statikus template
     - Egyszerű pattern (ADD INDEX, ADD COLUMN) → statikus
     - Komplex/szabad szöveges → AI fallback
6.4  Migration lista UI (bal panel: list, jobb panel: details)
6.5  UP/DOWN tab a migration részleteknél
6.6  Format selector (Flyway/Liquibase/Prisma/Raw)
6.7  Schema Timeline vizualizáció
6.8  "Generate from Diff" funkció — statikus (két verzió Schema diff-je)
6.9  Migration AI Generator input — komplex kérésekhez
6.10 Apply/Rollback gombok
6.11 SQLite storage: migrations tábla
```

**Deliverable:** Hibrid migration generálás (egyszerű: instant, komplex: AI), timeline, formátum export

---

### FÁZIS 7: Seed Data Generator (0.5 nap)
> Teszt adat generálás AI-val

```
7.1  Seed Data Generator modal/panel UI
7.2  Tábla selector + row count konfigurálás
7.3  Column rules editor (faker/enum/range/custom)
7.4  /api/seed endpoint
7.5  AI Seed prompt (locale-aware, FK-respecting)
7.6  Preview panel (generated INSERT statements)
7.7  Copy/Download funkciók
7.8  FK dependency sorter (topological sort)
```

**Deliverable:** Seed data generálás, preview, export

---

### FÁZIS 8: Export & Extras (0.5 nap)
> Export oldal, query history, share

```
8.1  Export Page UI: 6 export kártya
8.2  Schema SQL export (teljes CREATE TABLE dump)
8.3  Migrations bundle export (ZIP)
8.4  Seed data export
8.5  ER Diagram export (PNG/SVG via html-to-image)
8.6  Documentation generator (Markdown)
8.7  Full bundle export (ZIP: schema + migrations + seed + ER + docs)
8.8  Query History panel
8.9  Share link generátor
8.10 Settings page
```

**Deliverable:** Teljes export funkció, query history, share

---

### FÁZIS 9: Explain Plan & Polish (0.5 nap)
> Explain plan vizualizáció, animációk, végső finomítás

```
9.1  Explain Plan vizualizáció (fa struktúra)
9.2  Framer Motion animációk (page transitions, card reveals)
9.3  Loading skeleton-ek mindenhol
9.4  Error boundary-k
9.5  Responsive design finomítás
9.6  Performance optimalizáció (React.memo, useMemo)
9.7  SEO meta tags
9.8  Favicon + OG image
9.9  Végső tesztelés minden feature-rel
```

**Deliverable:** Kész, polírozott alkalmazás

---

### Összefoglaló Timeline

```
Fázis    Feature                         Nap
──────────────────────────────────────────────
  1      Projekt Setup & Infrastruktúra   1-2
  2      Schema Import & Parsing          1
  3      ER Diagram & Dashboard           1-2
  4      AI Chat (NL→SQL)                 1
  5      Optimizer & Health Score         1
  6      Migration System                 1
  7      Seed Data Generator              0.5
  8      Export & Extras                  0.5
  9      Polish & Explain Plan            0.5
──────────────────────────────────────────────
         ÖSSZESEN                         ~7-9 nap
```

---

## 9. Projekt Struktúra

```
dbmate/
├── src/
│   ├── app/
│   │   ├── globals.css                # TailwindCSS 4 @import "tailwindcss" + @theme config + dark mode
│   │   ├── layout.tsx                 # Root layout + providers (importálja globals.css-t)
│   │   ├── page.tsx                   # Import Page (/)
│   │   ├── dashboard/
│   │   │   └── page.tsx               # Dashboard Page
│   │   ├── optimizer/
│   │   │   └── page.tsx               # Optimizer Page
│   │   ├── migrations/
│   │   │   └── page.tsx               # Migrations Page
│   │   ├── export/
│   │   │   └── page.tsx               # Export Page
│   │   ├── settings/
│   │   │   └── page.tsx               # Settings Page
│   │   ├── share/
│   │   │   ├── page.tsx               # Opció A: /share?data=eJz... (URL-encoded)
│   │   │   └── [id]/page.tsx          # Opció B: /share/[nanoid] (self-hosted SQLite)
│   │   ├── loading.tsx                # Global loading UI (skeleton)
│   │   ├── error.tsx                  # Global error boundary
│   │   ├── not-found.tsx              # 404 page
│   │   └── api/
│   │       ├── parse/route.ts         # SQL parsing
│   │       ├── analyze/route.ts       # Schema analysis (hybrid: local + AI)
│   │       ├── query/route.ts         # NL → SQL (streaming SSE)
│   │       ├── migrate/route.ts       # Migration generation
│   │       ├── seed/route.ts          # Seed data generation
│   │       ├── export/route.ts        # Export generation
│   │       ├── health/route.ts        # API key status check (GET → {configured: bool})
│   │       ├── history/
│   │       │   ├── route.ts           # GET: list, POST: create
│   │       │   └── [id]/route.ts      # DELETE: single entry
│   │       └── share/
│   │           ├── route.ts           # POST: create share link
│   │           └── [id]/route.ts      # GET: retrieve shared schema
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   ├── sidebar.tsx            # Main navigation sidebar
│   │   │   ├── header.tsx             # Top bar
│   │   │   └── theme-toggle.tsx       # Dark/light mode switch
│   │   │
│   │   ├── import/
│   │   │   ├── sql-editor.tsx         # CodeMirror SQL editor
│   │   │   ├── file-dropzone.tsx      # Drag & drop upload
│   │   │   ├── dialect-selector.tsx   # MySQL/PG/SQLite radio
│   │   │   └── template-gallery.tsx   # Schema template cards
│   │   │
│   │   ├── dashboard/
│   │   │   ├── er-diagram.tsx         # ReactFlow ER diagram
│   │   │   ├── table-node.tsx         # Custom ReactFlow node
│   │   │   ├── relation-edge.tsx      # Custom ReactFlow edge
│   │   │   ├── table-details.tsx      # Bottom panel tabs
│   │   │   └── dashboard-toolbar.tsx  # Top toolbar
│   │   │
│   │   ├── chat/
│   │   │   ├── ai-chat.tsx            # Chat container
│   │   │   ├── chat-message.tsx       # Message bubble
│   │   │   ├── chat-input.tsx         # Input + quick actions
│   │   │   └── sql-code-block.tsx     # SQL display + copy
│   │   │
│   │   ├── optimizer/
│   │   │   ├── health-gauge.tsx       # Gauge chart
│   │   │   ├── breakdown-cards.tsx    # 4 category cards
│   │   │   ├── issue-card.tsx         # Individual issue
│   │   │   ├── issues-list.tsx        # Filterable issue list
│   │   │   └── diff-viewer.tsx        # Schema diff display
│   │   │
│   │   ├── migrations/
│   │   │   ├── migration-list.tsx     # Left panel list
│   │   │   ├── migration-detail.tsx   # Right panel detail
│   │   │   ├── schema-timeline.tsx    # Version timeline
│   │   │   └── migration-generator.tsx # AI generator input
│   │   │
│   │   ├── seed/
│   │   │   ├── seed-generator.tsx     # Main seed panel
│   │   │   ├── table-selector.tsx     # Table checkbox list
│   │   │   ├── column-rules.tsx       # Per-column config
│   │   │   └── seed-preview.tsx       # INSERT preview
│   │   │
│   │   ├── export/
│   │   │   ├── export-card.tsx        # Individual export option
│   │   │   └── export-preview.tsx     # CodeMirror preview
│   │   │
│   │   ├── shared/
│   │   │   ├── query-history.tsx      # History side panel
│   │   │   ├── share-dialog.tsx       # Share link modal
│   │   │   └── explain-plan.tsx       # Query plan visualization
│   │   │
│   │   └── ui/                        # shadcn/ui components
│   │       ├── button.tsx
│   │       ├── card.tsx
│   │       ├── dialog.tsx
│   │       ├── tabs.tsx
│   │       ├── toast.tsx
│   │       └── ... (shadcn components)
│   │
│   ├── lib/
│   │   ├── sql-parser.ts              # node-sql-parser wrapper
│   │   ├── ai-client.ts              # Claude API client + streaming (CSAK AI feladatokra)
│   │   ├── ai-prompts.ts             # AI prompt templates (normalization, NL→SQL, seed, explain)
│   │   ├── static-analyzer.ts        # Statikus health score: performance/security/conventions
│   │   ├── migration-templates.ts    # Statikus migration generálás (ADD INDEX, ADD COLUMN, stb.)
│   │   ├── migration-formatter.ts    # Formátum konverzió (Flyway/Liquibase/Prisma/Raw) — statikus
│   │   ├── schema-exporter.ts        # Export schema as SQL — statikus
│   │   ├── dependency-sorter.ts      # Topological sort for FK — statikus
│   │   ├── db.ts                     # SQLite database setup + migrations
│   │   ├── validations.ts            # Zod schemas for API request/response
│   │   ├── rate-limiter.ts           # In-memory rate limiter (AI API calls)
│   │   ├── utils.ts                  # Utility functions
│   │   └── types.ts                  # All TypeScript types
│   │
│   ├── stores/
│   │   ├── schema-store.ts           # Main schema state
│   │   ├── chat-store.ts             # Chat messages state
│   │   └── settings-store.ts         # App settings state
│   │
│   ├── i18n/
│   │   ├── hu.json                   # Magyar UI szövegek
│   │   ├── en.json                   # English UI strings
│   │   └── index.ts                  # useTranslation hook
│   │
│   ├── hooks/
│   │   ├── use-schema.ts             # Schema store hook
│   │   ├── use-ai.ts                 # AI query hook (streaming)
│   │   └── use-export.ts             # Export utilities hook
│   │
│   └── data/
│       └── templates/                 # Schema templates
│           ├── e-commerce.sql
│           ├── blog.sql
│           ├── healthcare.sql
│           ├── lms.sql
│           ├── chat.sql
│           ├── analytics.sql
│           ├── gaming.sql
│           └── task-management.sql
│
├── public/
│   ├── favicon.ico
│   └── og-image.png
│
├── .env.local                         # ANTHROPIC_API_KEY=sk-...
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
├── next.config.ts                    # TailwindCSS 4: CSS-based config (@theme in globals.css)
├── components.json                    # shadcn/ui config
└── README.md
```

---

## 10. API Endpointok

### 10.1 Endpoint Összefoglaló

| Method | Endpoint | Leírás | Input | Output |
|--------|----------|--------|-------|--------|
| GET | `/api/health` | API key status check | - | `{ configured: boolean }` |
| POST | `/api/parse` | SQL parse-olás | `{ sql, dialect }` | `{ schema: Schema }` |
| POST | `/api/analyze` | Séma analízis (hibrid) | `{ schema }` | `{ report: SchemaHealthReport }` |
| POST | `/api/query` | NL → SQL (SSE) | `{ question, schema, history }` | Stream: `{ sql, explanation }` |
| POST | `/api/migrate` | Migration generálás | `{ schema, schemaId, change, dialect, format, nextVersion, fixSQL? }` | `{ migration: Migration }` |
| POST | `/api/seed` | Seed data generálás | `{ schema, config }` | `{ seeds: SeedResult[] }` |
| POST | `/api/export` | Export generálás | `{ schema, type, options }` | `{ content, filename }` |
| GET | `/api/history` | Query history lekérés | `?schema_id=xxx` | `{ queries: QueryResult[] }` |
| POST | `/api/history` | Query history mentés | `{ schemaId, nlInput, sqlOutput, explanation }` | `{ id: string }` |
| DELETE | `/api/history/[id]` | Query history törlés | - | `{ success: true }` |
| POST | `/api/share` | Share link létrehozás | `{ schema, options }` | `{ shareId, url }` |
| GET | `/api/share/[id]` | Shared schema lekérés | - | `{ schema, options }` |

### 10.2 Részletes Endpoint Specifikációk

**POST /api/parse**
```typescript
// Request
{
  sql: string;        // Raw SQL (CREATE TABLE statements)
  dialect: Dialect;
}

// Response 200
{
  schema: Schema;     // Parsed schema object
  warnings: string[]; // Parse warnings (pl. nem támogatott szintaxis)
}

// Response 400
{
  error: string;      // Parse error üzenet
  line?: number;      // Hiba sor száma
  position?: number;  // Hiba pozíció
}
```

**POST /api/query (SSE Streaming)**
```typescript
// Request
{
  question: string;              // Natural language question
  schema: Schema;                // Current schema
  history: ChatMessage[];        // Previous messages (max 20)
  dialect: Dialect;
}

// SSE Response (chunked)
data: {"type": "text", "content": "A lekérdezés..."}
data: {"type": "sql", "content": "SELECT u.name..."}
data: {"type": "text", "content": "\nMagyarázat: ..."}
data: {"type": "done", "id": "query_abc123", "sql": "SELECT u.name...", "explanation": "A lekérdezés..."}
// A "done" event tartalmazza az összegyűjtött sql + explanation mezőket,
// így a kliens közvetlenül QueryResult-ot tud belőle építeni a history-hoz.
```

**POST /api/analyze**
```typescript
// Request
{
  schema: Schema;
}

// Response 200
{
  report: SchemaHealthReport;
}
```

**POST /api/migrate**
```typescript
// Request (megegyezik MigrationRequest típussal)
{
  schema: Schema;
  schemaId: string;
  change: string;           // Szabad szöveges leírás a változtatásról
  dialect: Dialect;
  format: MigrationFormat;
  nextVersion: string;      // "V004" — backend auto-incrementeli ha üres
  fixSQL?: string;          // Ha Apply Fix gombból jön → statikus migration path
}

// Response 200
{
  migration: Migration;
}
```

**POST /api/seed**
```typescript
// Request
{
  schema: Schema;
  config: {
    tables: {
      tableName: string;
      rowCount: number;
      customRules?: { columnName: string; rule: SeedRule; value: string }[];
    }[];
    locale: string;
    respectFK: boolean;
  };
}

// Response 200
{
  seeds: SeedResult[];
  totalRows: number;
  insertOrder: string[];  // FK-dependency order
}
```

---

## Kiegészítés: Kulcsfontosságú Implementációs Döntések

### Miért SSE (Server-Sent Events) és nem WebSocket?
- Egyirányú kommunikáció elegendő (server → client)
- Next.js API Routes natívan támogatja
- Egyszerűbb implementáció
- Automatikus reconnect
- **SSE Proxy Pattern:** A `/api/query` endpoint Claude API SSE-t fogad → transzformálja → továbbítja a kliensnek. A backend `for await (const event of stream)` loop-pal olvassa a Claude-ot, és `ReadableStream`-en keresztül küldi a frontendnek.

### Miért Zustand és nem Redux?
- Minimális boilerplate
- TypeScript first-class support
- Nem kell Provider wrapper (kivéve persist middleware)
- Tökéletes méret ehhez a projekthez

### Miért SQLite és nem PostgreSQL?
- Zero-config — nincs szükség külön DB szerverre
- Tökéletes lokális storage-nak (history, settings, schemas)
- Az app NEM futtat a felhasználó sémáján query-ket — csak elemzi
- Egyszerűbb deployment
- **⚠️ Deployment megjegyzés:** `better-sqlite3` natív addon, nem fut Vercel Edge/Serverless-ben. Lokális dev/self-hosted deploy-hoz ideális. Vercel deploy esetén `@libsql/client` (Turso) vagy API-backed storage-ra kell cserélni.

### Miért Claude és nem GPT-4?
- Jobb kód/SQL generálás
- Nagyobb kontextus ablak (200K token)
- Strukturáltabb output
- Jobb magyar nyelv támogatás

---

## 11. SQLite Adatbázis Séma

A lokális SQLite adatbázis a következő táblákat tartalmazza:

```sql
-- Importált sémák
CREATE TABLE schemas (
  id TEXT PRIMARY KEY,            -- nanoid
  name TEXT NOT NULL,
  dialect TEXT NOT NULL CHECK(dialect IN ('mysql','postgresql','sqlite')),
  raw_sql TEXT NOT NULL,
  schema_json TEXT NOT NULL,       -- JSON: Schema object
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Séma verziók (undo/redo + timeline)
CREATE TABLE schema_versions (
  id TEXT PRIMARY KEY,
  schema_id TEXT NOT NULL REFERENCES schemas(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  schema_json TEXT NOT NULL,       -- JSON: Schema object snapshot
  change_description TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(schema_id, version_number)
);

-- Query history
CREATE TABLE query_history (
  id TEXT PRIMARY KEY,
  schema_id TEXT NOT NULL REFERENCES schemas(id) ON DELETE CASCADE,
  nl_input TEXT NOT NULL,
  sql_output TEXT NOT NULL,
  explanation TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
-- Max 100/séma, FIFO: DELETE FROM query_history WHERE schema_id=?
--   AND id NOT IN (SELECT id FROM query_history WHERE schema_id=? ORDER BY created_at DESC LIMIT 100)

-- Migrációk
CREATE TABLE migrations (
  id TEXT PRIMARY KEY,
  schema_id TEXT NOT NULL REFERENCES schemas(id) ON DELETE CASCADE,
  version TEXT NOT NULL,           -- "V001", "V002"
  name TEXT NOT NULL,
  up_sql TEXT NOT NULL,
  down_sql TEXT NOT NULL,
  description TEXT,
  format TEXT NOT NULL CHECK(format IN ('raw','flyway','liquibase','prisma')),
  applied_at TEXT,                 -- NULL ha pending
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(schema_id, version)
);

-- Share linkek
CREATE TABLE shares (
  id TEXT PRIMARY KEY,             -- nanoid short link
  schema_json TEXT NOT NULL,       -- A megosztott séma snapshot
  options_json TEXT,               -- Include options (ER, health, etc.)
  expires_at TEXT,                 -- Lejárati dátum, NULL = never
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- App beállítások (singleton)
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
-- Keys: 'theme', 'dialect', 'language', 'ai_model', 'temperature', 'max_tokens', 'migration_format', 'seed_locale', 'seed_default_rows'
```

---

## 12. API Key Kezelés

**Döntés:** Az API key kizárólag szerver-oldali `.env.local` fájlban tárolódik.

```
# .env.local
ANTHROPIC_API_KEY=sk-ant-...
```

A Settings oldal **NEM** teszi lehetővé az API key szerkesztését. Az AI Configuration szekcióban csak a model, temperature, és max_tokens állítható. A key jelenléte a `/api/health` endpoint-on keresztül ellenőrizhető (válasz: `{ configured: true/false }`, magát a key-t soha nem küldjük a frontendnek).

Ha a jövőben multi-user/SaaS modellre váltunk, akkor user-provided key-eket titkosítva (AES-256) kell tárolni a DB-ben, és csak szerver-oldalon dekódolni.

---

## 13. Health Score: Hibrid Megközelítés

> **Részletes implementáció kóddal: lásd [Feature 1 (6. fejezet)](#feature-1-schema-health-score)**

**Összefoglaló:**

| Kategória | Megközelítés | Fájl | Sebesség |
|-----------|-------------|------|----------|
| Performance (0-25) | **100% statikus** | `static-analyzer.ts` | ~0ms |
| Security (0-25) | **100% statikus** | `static-analyzer.ts` | ~0ms |
| Conventions (0-25) | **100% statikus** | `static-analyzer.ts` | ~0ms |
| Normalization (0-25) | **AI** (Claude API) | `ai-client.ts` | ~2-5s |

- A statikus 3 kategória **azonnal** megjelenik a UI-ban
- A normalization score skeleton/spinner-rel töltődik be
- **~75% AI token megtakarítás** az eredeti 100% AI-hoz képest
- Determinisztikus: ugyanaz az input = ugyanaz az output (statikus részeken)

---

## 14. Input Validáció & Biztonság

```typescript
// Konstansok
const MAX_SQL_INPUT_SIZE = 500_000;  // 500KB max SQL input
const MAX_CHAT_MESSAGE_LENGTH = 2000; // 2000 karakter max NL kérdés
const AI_RATE_LIMIT = 10;            // Max 10 AI hívás / perc / session
const MAX_CHAT_HISTORY = 20;         // Max 20 üzenet küldve kontextusként

// SQL input validáció (api/parse)
if (sql.length > MAX_SQL_INPUT_SIZE) {
  return Response.json({ error: 'SQL input túl nagy (max 500KB)' }, { status: 413 });
}

// Chat XSS prevention
// A frontend markdown rendererben DOMPurify-val sanitize-álunk
// SQL code block-ok read-only CodeMirror-ban jelennek meg (nem HTML-ként)

// Rate limiting
// In-memory Map<sessionId, { count, resetAt }> a szerver-oldalon
// 429 Too Many Requests válasz ha túllépve
```

---

## 15. Share Feature — Javított Architektúra

Mivel az app lokális SQLite-ot használ, a share feature **kétféleképpen** működhet:

### Opció A: URL-encoded data (max ~50KB sémáig)
```
1. Schema JSON → gzip compress → base64url encode
2. URL: /share?data=eJzLSM3JyVco...
3. A fogadó oldal decode → decompress → Schema JSON
4. Előny: nincs szerver-oldali storage szükséges
5. Hátrány: URL méretkorlát (~8KB IE, ~2MB modern böngészők)
6. Korlát: ~50KB schema JSON → ~15KB gzip → ~20KB base64
```

### Opció B: Lokális share (self-hosted deploy)
```
1. Schema JSON → SQLite shares tábla
2. Short link: /share/[nanoid]
3. Csak ugyanazon a szerveren érhető el
4. Egyetemi demóhoz tökéletes (egy gépen fut)
```

**Ajánlás:** Opció A az alapértelmezett (zero infrastructure), Opció B opcionális self-hosted módhoz.

---

## 16. Többnyelvűség (i18n) Stratégia

**Megközelítés:** Egyszerű JSON-alapú fordítás, külső könyvtár nélkül.

```
src/
  i18n/
    hu.json          # Magyar fordítások
    en.json          # Angol fordítások
    index.ts         # useTranslation hook + LanguageProvider
```

```typescript
// i18n/index.ts
import hu from './hu.json';
import en from './en.json';

const translations = { hu, en } as const;

export function useTranslation() {
  const { settings } = useSettingsStore();
  const t = (key: string) => {
    const keys = key.split('.');
    let value: any = translations[settings.language];
    for (const k of keys) value = value?.[k];
    return value ?? key; // fallback: show key
  };
  return { t, language: settings.language };
}

// Használat: const { t } = useTranslation();
// t('dashboard.title') → "Vezérlőpult" / "Dashboard"
```

**Scope:** Csak statikus UI szövegek (gombok, címek, placeholder-ek). Az AI válaszok nyelve a rendszer promptban szabályozva (`language` setting → AI prompt-ban "Respond in Hungarian/English"`).

**JSON struktúra példa (hu.json):**
```json
{
  "nav": { "import": "Importálás", "dashboard": "Vezérlőpult", "optimizer": "Optimalizáló" },
  "import": { "title": "SQL Séma Importálás", "paste": "SQL beillesztése", "upload": "Fájl feltöltés" },
  "common": { "copy": "Másolás", "download": "Letöltés", "delete": "Törlés", "cancel": "Mégse" }
}
```

---

## 17. Responsive Design Stratégia

A layout mobilon is használható kell legyen. Tervezési elvek a Fázis 1-től:

```
Desktop (>1024px):          Tablet (768-1024px):       Mobile (<768px):
┌────┬──────────────┐      ┌──────────────────┐       ┌──────────────┐
│Side│   Content    │      │  ☰ Top Nav       │       │ ☰ Top Nav    │
│bar │              │      │  Content         │       │ Content      │
│    │              │      │                  │       │ (full width) │
│    │              │      │                  │       │              │
└────┴──────────────┘      └──────────────────┘       │ [ER] [Chat]  │
                                                       │ (tab switch) │
                                                       └──────────────┘

- Sidebar → hamburger menu (tablet/mobile)
- Dashboard split panel → tab-os nézet (ER / Chat / Details)
- Optimizer gauge + issues → vertical stack
- CodeMirror: full width, kisebb font
```

---

## 18. Implementációs Progress Tracker

> **Utoljára frissítve:** 2026-03-11
> **Aktuális fázis:** Tervezés kész — implementáció még nem indult

### Fázis Státuszok

| Fázis | Leírás | Státusz | Megjegyzések |
|-------|--------|---------|-------------|
| 1 | Projekt Setup & Infrastruktúra | ⬜ Nem indult | |
| 2 | Schema Import & Parsing | ⬜ Nem indult | |
| 3 | ER Diagram & Dashboard | ⬜ Nem indult | |
| 4 | AI Chat Integration | ⬜ Nem indult | |
| 5 | Optimizer & Health Score | ⬜ Nem indult | |
| 6 | Migration System | ⬜ Nem indult | |
| 7 | Seed Data Generator | ⬜ Nem indult | |
| 8 | Export & Extras | ⬜ Nem indult | |
| 9 | Polish & Explain Plan | ⬜ Nem indult | |

**Státusz jelmagyarázat:** ⬜ Nem indult | 🟡 Folyamatban | ✅ Kész | ⚠️ Blokkolva

### Részletes Feladat Státuszok

#### Fázis 1: Projekt Setup & Infrastruktúra
- [ ] 1.1 Next.js 15 projekt inicializálás (pnpm create next-app)
- [ ] 1.2 shadcn/ui telepítés és konfigurálás
- [ ] 1.3 TailwindCSS 4 + dark mode setup
- [ ] 1.4 Alapvető layout: sidebar navigation + content area
- [ ] 1.5 Zustand store létrehozása (schema, settings, loading/error states)
- [ ] 1.6 SQLite database setup (better-sqlite3)
- [ ] 1.7 Alap routing: /, /dashboard, /optimizer, /migrations, /export, /settings
- [ ] 1.8 Input validációs utility-k (MAX_SQL_INPUT_SIZE, rate limiter, DOMPurify)

#### Fázis 2: Schema Import & Parsing
- [ ] 2.1 CodeMirror 6 integrálás SQL syntax highlighting-gal
- [ ] 2.2 SQL Parser Service (node-sql-parser wrapper)
- [ ] 2.3 Import Page UI: paste area + file upload + dialect selector
- [ ] 2.4 Template Gallery: 4-8 előre definiált séma
- [ ] 2.5 /api/parse endpoint
- [ ] 2.6 Zustand store update: importSchema action
- [ ] 2.7 Parse utáni redirect → Dashboard

#### Fázis 3: ER Diagram & Dashboard
- [ ] 3.1 ReactFlow setup + custom TableNode komponens
- [ ] 3.2 Custom RelationEdge: FK vonalak
- [ ] 3.3 Auto-layout algoritmus (dagre)
- [ ] 3.4 Zoom/Pan/Fit kontrollok
- [ ] 3.5 Tábla kattintás → bottom panel: tábla részletek
- [ ] 3.6 Dashboard toolbar: séma info, mini health score
- [ ] 3.7 Bottom panel: Columns/Indexes/FK/SQL tabs

#### Fázis 4: AI Chat Integration
- [ ] 4.1 Claude API client setup (@anthropic-ai/sdk)
- [ ] 4.2 AI Service: context builder + prompt assembly
- [ ] 4.3 /api/query endpoint (streaming SSE)
- [ ] 4.4 Chat UI: message list + input + quick actions
- [ ] 4.5 ChatMessage komponens: markdown render + SQL code block
- [ ] 4.6 SQL code block: copy gomb + syntax highlighting
- [ ] 4.7 Streaming válasz megjelenítés (SSE → progressive render)
- [ ] 4.8 Error handling: API errors, rate limits

#### Fázis 5: Schema Analysis & Optimizer
- [ ] 5.1 static-analyzer.ts: checkPerformance(), checkSecurity(), checkConventions()
- [ ] 5.2 /api/analyze endpoint (hibrid: statikus + AI normalization)
- [ ] 5.3 AI prompt: CSAK normalization elemzés (1NF-BCNF)
- [ ] 5.4 HealthScoreGauge komponens (Recharts)
- [ ] 5.5 Breakdown kártyák (4 kategória)
- [ ] 5.6 IssueCard komponens
- [ ] 5.7 Issue szűrés (severity, table, type)
- [ ] 5.8 "Apply Fix" funkció + auto migration
- [ ] 5.9 Diff View: eredeti vs. módosított

#### Fázis 6: Migration System
- [ ] 6.1 migration-templates.ts: generateStaticMigration()
- [ ] 6.2 migration-formatter.ts: formatMigration()
- [ ] 6.3 /api/migrate endpoint (hibrid döntési logika)
- [ ] 6.4 Migration lista UI
- [ ] 6.5 UP/DOWN tab
- [ ] 6.6 Format selector
- [ ] 6.7 Schema Timeline vizualizáció
- [ ] 6.8 "Generate from Diff" funkció
- [ ] 6.9 Migration AI Generator input
- [ ] 6.10 Apply/Rollback gombok
- [ ] 6.11 SQLite storage: migrations tábla

#### Fázis 7: Seed Data Generator
- [ ] 7.1 Seed Data Generator modal/panel UI
- [ ] 7.2 Tábla selector + row count
- [ ] 7.3 Column rules editor
- [ ] 7.4 /api/seed endpoint
- [ ] 7.5 AI Seed prompt (locale-aware, FK-respecting)
- [ ] 7.6 Preview panel
- [ ] 7.7 Copy/Download funkciók
- [ ] 7.8 FK dependency sorter (topological sort)

#### Fázis 8: Export & Extras
- [ ] 8.1 Export Page UI: 6 export kártya
- [ ] 8.2 Schema SQL export
- [ ] 8.3 Migrations bundle export (ZIP)
- [ ] 8.4 Seed data export
- [ ] 8.5 ER Diagram export (PNG/SVG)
- [ ] 8.6 Documentation generator (Markdown)
- [ ] 8.7 Full bundle export (ZIP)
- [ ] 8.8 Query History panel
- [ ] 8.9 Share link generátor
- [ ] 8.10 Settings page

#### Fázis 9: Polish & Explain Plan
- [ ] 9.1 Explain Plan vizualizáció
- [ ] 9.2 Framer Motion animációk
- [ ] 9.3 Loading skeleton-ek
- [ ] 9.4 Error boundary-k
- [ ] 9.5 Responsive design finomítás
- [ ] 9.6 Performance optimalizáció (React.memo, useMemo)
- [ ] 9.7 SEO meta tags
- [ ] 9.8 Favicon + OG image
- [ ] 9.9 Végső tesztelés

### Ismert Problémák & Döntések

| # | Dátum | Probléma / Döntés | Megoldás | Státusz |
|---|-------|-------------------|----------|---------|
| — | — | *(még nincs)* | — | — |

<!-- Frissítési útmutató:
  - Feladat kész: [ ] → [x], + dátum a megjegyzésekbe
  - Fázis kész: ⬜ → ✅
  - Fázis folyamatban: ⬜ → 🟡
  - Blocker: ⬜ → ⚠️, + sor az "Ismert Problémák" táblába
-->

---

*Ez a dokumentum a DBMate alkalmazás teljes implementációs terve. Minden fázis, feature és komponens részletesen le van írva a fejlesztés megkezdéséhez.*
