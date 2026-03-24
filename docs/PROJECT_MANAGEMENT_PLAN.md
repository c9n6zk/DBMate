# DBMate — Project Management & Execution Plan Simulation

## Jelenlegi állapot
- Egy schema egyszerre (Zustand localStorage)
- SQLite DB létezik (`data/dbmate.sqlite`): `schemas`, `schema_versions`, `query_history`, `migrations`
- `/api/parse` INSERT-el az SQLite-ba, de utána senki nem olvassa
- `/api/explain` már létezik (alap plan generálás AI-val), de nincs what-if, warnings, recommendations
- Nincs projekt lista, CRUD, schema váltás, version history UI

## Target állapot
- **SQLite** (better-sqlite3, lokális) + single-user
- Projekt CRUD, verzió history, execution plan szimuláció

---

## Phase 1: Schema CRUD API (Backend alap)

**Cél**: CRUD endpointok a meglévő SQLite-hoz.

| Endpoint | Method | Leírás |
|----------|--------|--------|
| `/api/schemas` | GET | Összes schema listázása (id, name, dialect, updatedAt, tableCount) |
| `/api/schemas` | POST | Új üres schema létrehozása (name, dialect) |
| `/api/schemas/[id]` | GET | Egy schema betöltése (teljes schema_json) |
| `/api/schemas/[id]` | PATCH | Átnevezés / mentés (name, schema_json, updated_at) |
| `/api/schemas/[id]` | DELETE | Schema törlése (CASCADE — versions, queries, migrations mind törlődnek) |

**Üres schema alapértékek** (`POST /api/schemas`):
- DB-ben `raw_sql TEXT NOT NULL` és `schema_json TEXT NOT NULL` — üres schemánál:
  ```ts
  raw_sql: ''
  schema_json: JSON.stringify({
    id: nanoid(),
    name,
    dialect,
    tables: [],
    rawSQL: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })
  ```
- Nem hozunk létre initial version-t üres schemához (version csak import/save/fix után)

**PATCH `raw_sql` szinkron**:
- Amikor `schema_json` jön a PATCH-ben, a `raw_sql` mezőt is frissíteni kell: `schema_json.rawSQL`
- Ha csak `name` jön, a `raw_sql` nem változik
  ```ts
  if (schema_json) {
    db.prepare('UPDATE schemas SET schema_json = ?, raw_sql = ?, name = COALESCE(?, name), updated_at = ? WHERE id = ?')
      .run(JSON.stringify(schema_json), schema_json.rawSQL || '', name, now, id);
  } else {
    db.prepare('UPDATE schemas SET name = ?, updated_at = ? WHERE id = ?')
      .run(name, now, id);
  }
  ```

**GET lista — `tableCount` performancia**:
- NEM parse-oljuk a `schema_json`-t minden GET-re
- Új oszlop: `ALTER TABLE schemas ADD COLUMN table_count INTEGER NOT NULL DEFAULT 0`
- `table_count` frissül: INSERT (parse), PATCH (save), applyFix
- DB migráció: `initializeDatabase`-ben hozzáadjuk ha nem létezik + backfill:
  ```sql
  -- Ha az oszlop még nem létezik (PRAGMA-val ellenőrizzük)
  UPDATE schemas SET table_count = json_array_length(json_extract(schema_json, '$.tables'))
  WHERE table_count = 0;
  ```

**`/api/parse` módosítás**:
- Import után a response-ban visszaadja a schema `id`-t (ez már megvan)
- A kliens felelős: import után `fetchSchemaList()` hívás a lista frissítésére
- `table_count` mentése INSERT-kor: `schema.tables.length`

**Validáció** (`src/lib/validations.ts`):
```ts
export const createSchemaRequestSchema = z.object({
  name: z.string().min(1).max(100),
  dialect: dialectSchema,
});

export const updateSchemaRequestSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  schema_json: z.object({}).passthrough().optional(),
}).refine(d => d.name || d.schema_json, 'At least one field required');
```

**Fájlok**:
- `src/app/api/schemas/route.ts` — NEW (GET lista + POST create)
- `src/app/api/schemas/[id]/route.ts` — NEW (GET egy + PATCH + DELETE)
- `src/lib/validations.ts` — bővítés (create/update schema validation)
- `src/lib/db.ts` — `table_count` oszlop hozzáadása + backfill migráció

**Dependency**: Nincs

---

## Phase 2: Store Refactoring (Multi-project)

**Cél**: Zustand store kibővítése több projekt kezelésére.

**Új state**:
```ts
schemaList: SchemaListItem[]  // { id, name, dialect, updatedAt, tableCount }
activeSchemaId: string | null // jelenleg betöltött schema id-ja
isDirty: boolean              // van-e mentetlen változás
isSwitching: boolean          // loadSchema folyamatban van (UI: disable nav + loading overlay)
```

**`isSwitching` használata**:
- `loadSchema` elején `isSwitching = true`, végén `false`
- Amíg `true`: sidebar projekt lista disabled (nem lehet újat kattintani), dashboard loading overlay
- Megakadályozza a dupla-kattintásos race condition-t

**Új akciók**:
```ts
fetchSchemaList(): Promise<void>      // GET /api/schemas → schemaList
loadSchema(id: string): Promise<void> // GET /api/schemas/:id → currentSchema, activeSchemaId
saveCurrentSchema(): Promise<void>    // PATCH /api/schemas/:id (schema_json + updated_at)
createSchema(name: string, dialect: Dialect): Promise<string> // POST /api/schemas → returns id
deleteSchema(id: string): Promise<void>
renameSchema(id: string, name: string): Promise<void>
duplicateSchema(id: string): Promise<string> // GET schema → POST new → returns new id
```

**Import flow módosítás**:
- `importSchema(sql, dialect)` → `/api/parse` hívás → `fetchSchemaList()` → `loadSchema(newId)`
- Import után automatikusan betölti az új sémát és frissíti a listát

**Dirty state kezelés**:
- `setSchema()` híváskor `isDirty = true`
- `saveCurrentSchema()` után `isDirty = false`
- Schema váltáskor (`loadSchema`): ha `isDirty`, confirmation dialog ("Unsaved changes. Save before switching?")
- `beforeunload` event listener: ha `isDirty`, böngésző figyelmeztetés
- **Ctrl+S** billentyűparancs: `saveCurrentSchema()` hívás (global `keydown` event listener)

**localStorage migráció** (egyszeri, mount-on):
- Ha van `currentSchema` localStorage-ban (`dbmate-schema` key), de a schema `id`-ja nincs SQLite-ban:
  1. Egyetlen PATCH `/api/schemas/:id` — ha a schema id már létezik SQLite-ban (korábbi parse), frissítjük
  2. VAGY: POST `/api/parse` a `rawSQL`-lel → ez create + version-t is kezel
  3. localStorage `dbmate-schema` key törlése (`localStorage.removeItem('dbmate-schema')`)
- Ha van SQLite adat: localStorage-t ignorálja, SQLite-ból tölt
- **Edge case**: ha a localStorage schema id-ja megtalálható SQLite-ban (mert `/api/parse` már beírta), csak `activeSchemaId`-t állítjuk be és töröljük a localStorage-t

**Fontos döntések**:
- `schemaList` SQLite-ból jön (fetch on mount), NEM localStorage
- `activeSchemaId` localStorage-ban cachelve → mount-on auto-load
- Schema váltáskor: `healthReport` reset, `migrations` reset, chat reset, `explainPlan` reset, `isDirty = false`

**Dependency**: Phase 1

---

## Phase 3: Sidebar Project Lista (UI)

**Cél**: Mentett sémák a sidebarban, váltás köztük.

**Új komponensek**:
- `src/components/layout/project-list.tsx` — Schema lista + "New" gomb
- `src/components/layout/project-list-item.tsx` — Egy sor: név, dialect badge, dropdown (rename/delete/duplicate)

**Sidebar módosítás** (`sidebar.tsx`):
- Logo és nav között "Projects" szekció
- **"+" gomb**: új üres schema dialog (név + dialect picker)
- Expanded: kompakt lista (max 5 látható, scrollable)
- Collapsed: folder ikon → popover/sheet a teljes listával
- Aktív schema kiemelve (háttérszín)
- Hover → "..." dropdown: Rename (inline edit), Delete (confirmation dialog), Duplicate (`duplicateSchema`)
- **Empty state**: "No projects yet. Import a schema or create one." + Import link

**Dashboard toolbar** (`dashboard-toolbar.tsx`):
- "Save" gomb hozzáadása (floppy ikon) — disabled ha `!isDirty`
- **Ctrl+S** billentyűparancs → `saveCurrentSchema()` (a store-ban definiálva, Phase 2)
- Dirty indicator: pont a schema név mellett ha mentetlen
- Schema név szerkeszthetővé tétele (kattintásra inline edit → `renameSchema`)

**Unsaved changes dialog**:
- Schema váltáskor ha `isDirty`: "You have unsaved changes. Save / Discard / Cancel"
- Delete-kor: "Delete '{name}'? This will permanently remove all versions, migrations, and query history."

**Dependency**: Phase 2

---

## Phase 4: Version History

**Cél**: Verzió timeline, restore, diff.

**API endpointok**:
| Endpoint | Method | Leírás |
|----------|--------|--------|
| `/api/schemas/[id]/versions` | GET | Verzió lista (version_number, change_description, created_at) |
| `/api/schemas/[id]/versions` | POST | Új verzió mentése (schema_json + change_description) |
| `/api/schemas/[id]/versions/[versionId]` | GET | Egy verzió schema_json-ja (diff-hez) |

**Store kiegészítések**:
```ts
versions: VersionSummary[]
saveVersion(description: string): Promise<void>
restoreVersion(versionId: string): Promise<void>  // → új verziót hoz létre: "Restored from v{N}"
fetchVersions(): Promise<void>
```

**Restore logika**:
- Restore NEM felülírja a history-t, hanem **új verziót hoz létre** a régi tartalommal
- Description: `"Restored from version {N}: {originalDescription}"`
- Ez megőrzi a teljes auditálhatóságot

**Automatikus verzió mentés** (store akciókból hívva):
- Import → `"Initial import"` (már megvan a `/api/parse`-ban)
- Apply fix → `"Applied fix: {issue.title}"`
- Migration apply → `"Applied migration: {name}"`
- Manual save → `"Manual save"` vagy user-supplied description

**`version_number` meghatározása**:
- `POST /api/schemas/[id]/versions` endpoint-ban:
  ```sql
  SELECT COALESCE(MAX(version_number), 0) + 1 AS next_version
  FROM schema_versions WHERE schema_id = ?
  ```
- Version ID: `nanoid()` (NEM `{schemaId}_v{N}` — az törékeny, restore-nál ütközhet)

**Verzió limit**:
- Max 50 verzió/schema — legrégebbi automatikusan törlődik (FIFO)
- Helyes SQLite szintaxis (nem támogatja a `DELETE ... ORDER BY ... LIMIT` kombinációt):
  ```sql
  DELETE FROM schema_versions
  WHERE id IN (
    SELECT id FROM schema_versions
    WHERE schema_id = ?
    ORDER BY version_number ASC
    LIMIT MAX(0, (SELECT COUNT(*) FROM schema_versions WHERE schema_id = ?) - 50)
  )
  ```

**UI**: `src/components/dashboard/version-timeline.tsx`
- Vertikális timeline a dashboard-on (tab: "ER Diagram" | "Versions")
- Minden verzió: number, description, timestamp, diff gomb, restore gomb
- Diff: rawSQL összehasonlítás az existing `DiffView` komponenssel (version N vs N-1 vagy vs current)

**Dependency**: Phase 1, 2

---

## Phase 5: Execution Plan Simulation

**Cél**: A **meglévő** `/api/explain` endpoint kibővítése what-if index analízissel, warnings-szal, recommendations-zel.

**Jelenlegi állapot** (`src/app/api/explain/route.ts`):
- Már létezik, működik: schema + sql → AI → ExplainPlanNode fa
- Hiányosságok: nincs what-if (hypothetical/removed indexes), nincs warnings/recommendations, nincs Zod validáció a response-ra, `JSON.parse` helyett `extractJSON` kellene

**Módosítandó request**:
```ts
// Jelenlegi
{ sql: string, schema: Schema, dialect: Dialect }

// Bővített
{
  sql: string,
  schema: Schema,
  dialect: Dialect,
  hypotheticalIndexes?: HypotheticalIndex[],
  removedIndexes?: { table: string; indexName: string }[]
}
```

**Bővített response** (Zod-validált):
```ts
{
  plan: ExplainPlanNode,          // fa struktúra (ez már megvan)
  totalCost: number,              // ÚJ: gyökér node cost-ja
  warnings: string[],             // ÚJ: pl. "No index on users.email for WHERE clause"
  recommendations: string[]       // ÚJ: pl. "Consider adding index on (email)"
}
```

**AI system prompt módosítás** (a meglévő `EXPLAIN_SYSTEM_PROMPT`-ot bővítjük):
- Hozzáadni: hypothetical/removed index kontextus
- Hozzáadni: warnings és recommendations kérése a JSON-ban
- Teljes JSON struktúra specifikáció a prompt-ban:
  ```
  Return ONLY valid JSON with this structure:
  {
    "plan": { ...ExplainPlanNode tree... },
    "totalCost": <number>,
    "warnings": ["..."],
    "recommendations": ["..."]
  }
  ```

**`extractJSON` használata**:
- A jelenlegi explain route `JSON.parse`-t használ egyszerű markdown strippel
- Átírni az `extractJSON` pattern-re (ami az `/api/analyze` route-ban már bevált)
- `extractJSON`-t kiemelni shared utility-be: `src/lib/extract-json.ts`

**Response Zod validáció** (`src/lib/validations.ts`):
```ts
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
```

**Fontos: `zod` → `zod/v4` migráció**:
- A jelenlegi explain route `import { z } from 'zod'`-ot használ (nem v4)
- Átírni: `import { z } from 'zod/v4'` — konzisztencia a többi fájllal

**Új komponensek**:

### `src/components/dashboard/explain-plan-tree.tsx`
- `ExplainPlanNode` fa vizualizáció (indentált kártyák vagy vertikális flow)
- Node-onként: típus ikon, label, tábla, használt index, becsült cost, becsült sorok
- Színkódolás: piros = `SEQ_SCAN`, zöld = `INDEX_SCAN`, sárga = `SORT`, kék = JOIN-ok
- Relatív cost bar (node cost / total cost %)

### `src/components/dashboard/explain-plan-panel.tsx`
- SQL input (CodeMirror, reuse existing setup)
- "Explain" gomb + loading state
- Renderelt plan tree
- Warnings és recommendations megjelenítése
- "What-if" szekció: hypothetical indexek hozzáadása/eltávolítása

### `src/components/dashboard/index-simulator.tsx`
- Jelenlegi indexek listája (checkbox-szal kikapcsolhatók)
- "Add hypothetical index" form: table picker, column picker (multi-select), unique toggle
- "Compare" gomb: eredeti vs módosított plan side-by-side
- Cost diff: "+15% slower" / "-40% faster" jelzés

**Elhelyezés**: Dashboard-on tab rendszer: "ER Diagram" | "Explain Plan" | "Versions"

**Fájlok**:
- `src/app/api/explain/route.ts` — MÓDOSÍTÁS (nem NEW!)
- `src/lib/extract-json.ts` — NEW (kiemelve az analyze route-ból)
- `src/lib/validations.ts` — bővítés (explainPlanNodeSchema, explainResponseSchema)
- `src/app/api/analyze/route.ts` — MÓDOSÍTÁS (import `extractJSON` a shared utility-ből)

**Dependency**: Nincs (de schema kell hozzá, tehát Phase 2 után lesz hasznos)

---

## Phase 6: Index Impact Analysis

**Cél**: Melyik index melyik query-nek segít, és milyen indexek hiányoznak.

**Új endpoint**: `POST /api/index-analysis`
```ts
// Request
{
  schema: Schema,
  queries: string[]  // query_history-ból VAGY manuálisan megadott query-k
}

// Response
{
  indexUsage: {
    indexName: string
    table: string
    usedByQueries: string[]
    unusedReason?: string        // "No query references this table/column"
  }[]
  suggestedIndexes: {
    table: string
    columns: string[]
    reason: string
    estimatedImprovement: string  // "~60% faster for SELECT on users WHERE email = ?"
    affectedQueries: string[]
  }[]
  unusedIndexes: {
    indexName: string
    table: string
    recommendation: string       // "Consider removing — adds write overhead"
  }[]
}
```

**`extractJSON` + Zod validáció**: ugyanaz a pattern mint Phase 5-ben (shared `extractJSON` + response Zod schema)

**Query forrás** (prioritás sorrendben):
1. `query_history` tábla az adott schema-hoz
2. **Manual query input** — ha nincs history, vagy user extra query-ket akar tesztelni
3. Minimum 1 query kell — ha 0 query van: "Add at least one query to analyze index usage"

**"Apply" gomb mechanizmus** — suggested index alkalmazása:
1. `applyFixToSchema()` hívás (meglévő utility, `src/lib/apply-fix.ts`) — synthetic `AnalysisIssue` létrehozása:
   ```ts
   const syntheticIssue: AnalysisIssue = {
     id: nanoid(),
     type: 'performance',
     severity: 'warning',
     title: `Add index on ${suggestion.table}(${suggestion.columns.join(', ')})`,
     affectedTable: suggestion.table,
     fixSQL: `CREATE ${suggestion.unique ? 'UNIQUE ' : ''}INDEX idx_${suggestion.table}_${suggestion.columns.join('_')} ON ${suggestion.table}(${suggestion.columns.join(', ')})`,
   };
   applyFixToSchema(currentSchema, syntheticIssue);
   ```
2. Automatikus version mentés: `"Applied index: idx_{table}_{cols}"`
3. Dirty state: `isDirty = true` → user save-elhet

**UI**: `src/components/optimizer/index-analysis.tsx`
- **Query input szekció**: lista a history-ból (checkbox) + textarea manual query-khez
- "Index Usage" kártya — mely indexek használtak a query-k alapján
- "Unused Indexes" kártya — felesleges indexek amik lassítják a write-okat
- "Suggested Indexes" kártya — AI javaslatok + "Apply" gomb (fenti mechanizmus)
- Before/after cost összehasonlítás (Phase 5 explain plan újrahívásával)

**Elhelyezés**: Optimizer oldalon, az issues lista alatt.

**Dependency**: Phase 5, query history (de manual input-tal nélküle is működik)

---

## Cross-cutting concerns

### Shared `extractJSON` utility
- A jelenlegi `extractJSON` implementáció az `analyze/route.ts`-ben van inline
- Phase 5-ben kiemelni: `src/lib/extract-json.ts` — minden AI response JSON parsing ezt használja
- Érintett route-ok: `/api/analyze`, `/api/explain`, `/api/index-analysis`, `/api/seed`, `/api/migrate`

### Zod import konzisztencia
- Minden fájl: `import { z } from 'zod/v4'` (nem `'zod'`)
- Jelenlegi eltérés: `explain/route.ts` `import { z } from 'zod'` → javítandó Phase 5-ben

### API error handling pattern
- Minden route ugyanazt a try/catch mintát követi → opcionálisan kiemelés:
  ```ts
  // src/lib/api-helpers.ts
  export function apiError(err: unknown, context: string): NextResponse {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`${context}:`, err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
  ```
- Nem kötelező Phase 1-ben, de Phase 5-6-nál érdemes bevezetni

---

## Fázis sorrend és prioritás

```
Phase 1 ──→ Phase 2 ──→ Phase 3    ← P0 (alap CRUD + UI)
               │
               ├──→ Phase 4         ← P1 (version history)
               │
Phase 5 ──────────→ Phase 6         ← P1-P2 (explain + index analysis)
```

| Phase | Prioritás | Méret | Függőség |
|-------|-----------|-------|----------|
| 1: Schema CRUD API | P0 | S | — |
| 2: Store Refactoring | P0 | M | Phase 1 |
| 3: Sidebar Project List | P0 | M | Phase 2 |
| 4: Version History | P1 | M | Phase 1, 2 |
| 5: Explain Plan bővítés | P1 | M | — (meglévő endpoint módosítás, nem L) |
| 6: Index Analysis | P2 | L | Phase 5 |

---

## Kulcs döntések

1. **SQLite = source of truth** — schemaList SQLite-ból, localStorage csak cache (`activeSchemaId`)
2. **Nincs új page a projekt kezeléshez** — sidebar-ban van a lista, schema váltás nem navigál
3. **Verzió = explicit** — nem auto-save minden változásra, hanem: import, fix, migration, manual save
4. **Restore = új verzió** — restore nem írja felül a history-t, hanem új verziót hoz létre
5. **Explain plan = meglévő endpoint bővítés** — `/api/explain` már létezik, what-if + warnings hozzáadás
6. **Chat per-schema** — schema váltáskor chat reset, history opcionálisan betölthető query_history-ból
7. **Dirty state tracking** — mentetlen változások figyelmeztetés schema váltásnál és page leave-nél
8. **Import = POST /api/parse + list refresh** — nem kell külön "create from SQL" endpoint
9. **extractJSON = shared utility** — minden AI JSON response parsing egy helyen
10. **Version ID = nanoid()** — nem schema-id-alapú pattern (törékeny restore-nál)
11. **table_count = denormalizált oszlop** — performáns lista lekérdezés, frissül INSERT/PATCH-kor
12. **Apply index = applyFixToSchema** — Phase 6 suggested index-ek ugyanazt a mechanizmust használják mint az optimizer fix-ek

---

## Új típusok (`src/lib/types.ts`)

```ts
// Schema list item (lightweight, for sidebar)
export interface SchemaListItem {
  id: string;
  name: string;
  dialect: Dialect;
  updatedAt: string;
  tableCount: number;
}

// Version summary (for timeline)
export interface VersionSummary {
  id: string;
  schemaId: string;
  versionNumber: number;
  changeDescription: string;
  createdAt: string;
}

// Explain plan response (Phase 5)
export interface ExplainPlanResponse {
  plan: ExplainPlanNode;
  totalCost: number;
  warnings: string[];
  recommendations: string[];
}

// Index analysis response (Phase 6)
export interface IndexUsageItem {
  indexName: string;
  table: string;
  usedByQueries: string[];
  unusedReason?: string;
}

export interface IndexSuggestion {
  table: string;
  columns: string[];
  unique: boolean;
  reason: string;
  estimatedImprovement: string;
  affectedQueries: string[];
}

export interface UnusedIndex {
  indexName: string;
  table: string;
  recommendation: string;
}

export interface IndexAnalysisResponse {
  indexUsage: IndexUsageItem[];
  suggestedIndexes: IndexSuggestion[];
  unusedIndexes: UnusedIndex[];
}

// Hypothetical index (for what-if analysis)
export interface HypotheticalIndex {
  table: string;
  columns: string[];
  unique: boolean;
}
```
