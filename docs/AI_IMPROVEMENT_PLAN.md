# DBMate AI Feature Improvement Plan

> **Szerzo**: Senior Software Architect review
> **Datum**: 2026-03-11
> **Utolso review**: 2026-03-11 — 52 hiba/gap javitva (v6)
> **Scope**: 10 javitas 4 sprintben — prompt engineering, robusztussag, UX, teljesitmeny

---

## 1. Jelenlegi allapot (Current State)

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│  Frontend    │────▶│  API Routes  │────▶│  Anthropic SDK  │
│  (React)     │◀────│  (Next.js)   │◀────│  (raw text)     │
└─────────────┘     └──────────────┘     └─────────────────┘
                         │                       │
                    extractJSON (kozos)     reszleges Zod validacio
                    + regex (migrate/seed) no retry, no cache
                    apiError (kozos)       no tool_use
```

**Mar megoldott** (DB refactor sprint soran):
- ✅ `extractJSON()` kiemelve kozos modulba (`src/lib/extract-json.ts`) — analyze, explain, index-analysis hasznaljak
- ✅ `apiError()` kozos hiba-kezelo utility (`src/lib/api-helpers.ts`) — minden route hasznalja
- ✅ Zod v4 import konzisztens (`from 'zod/v4'`) — validations.ts
- ✅ Explain route: Zod output validacio (`explainResponseSchema`) + fallback-ek
- ✅ Index-analysis route implementalva (`src/app/api/index-analysis/route.ts`)

**Meg meglevo problemak**:
- `migrate/route.ts` meg `text.match(/\{[\s\S]*\}/)` regexet hasznal (nem `extractJSON`)
- `seed/route.ts` sajat regex INSERT kinyerest hasznal
- Nincs AI output validacio az analyze, migrate, seed route-oknal (explain + index-analysis-nel van)
- Generikus promptok (nem feladat-specifikusak, nincs kozponti menedzsment)
- Nincs retry logika (1 hiba = teljes failure)
- Nincs cache (ugyanaz a kerdes = ujra AI hivas)
- Nincs `isProxyMode()` fuggveny (impliciten mukodik a client creation-ben)

### Erintett fajlok

| Fajl | Jelenlegi AI interakcio | Allapot |
|------|------------------------|---------|
| `src/lib/ai-service.ts` | Kozponti config: model, client, streaming, system prompt | ✅ Mukodokopes |
| `src/lib/extract-json.ts` | Kozos JSON kinyero + repair logika (brace-balancing, escape) | ✅ KOZOS modul (v5 javitas) |
| `src/lib/api-helpers.ts` | Kozos `apiError()` utility minden route-nak | ✅ UJ (v5 javitas) |
| `src/lib/validations.ts` | Zod schemak — `zod/v4` import ✅ | ⚠️ Input + explain + index-analysis output ONLY |
| `src/app/api/analyze/route.ts` | Normalizacio AI + `extractJSON()` (kozos import) | ⚠️ Nincs output Zod validacio |
| `src/app/api/migrate/route.ts` | Migration AI + `text.match(/\{[\s\S]*\}/)` regex | ❌ Nem hasznalja `extractJSON()`-t |
| `src/app/api/explain/route.ts` | Explain plan AI + `extractJSON()` + `explainResponseSchema` Zod validacio | ✅ Legjobb: Zod + fallback |
| `src/app/api/index-analysis/route.ts` | Index hatas AI + `extractJSON()` + `indexAnalysisResponseSchema` Zod validacio | ✅ Zod + fallback (mint explain) |
| `src/app/api/seed/route.ts` | Seed data AI + sajat regex INSERT kinyeres | ❌ Nem hasznalja `extractJSON()`-t |
| `src/app/api/query/route.ts` | Chat AI + SSE streaming | ✅ Mukodokopes |
| `src/lib/static-analyzer.ts` | Lokalis elemzes (nincs AI) — perf/security/conventions | ✅ Teljes |

---

## 2. Celallapot (Target State)

```
┌─────────────┐     ┌──────────────┐     ┌──────────────────┐
│  Frontend    │────▶│  API Routes  │────▶│  Anthropic SDK   │
│  + confidence│◀────│  + retry     │◀────│  + tool_use (opt)│
│  + compare   │     │  + cache     │     │  + few-shot      │
│  + batch fix │     │  + Zod valid │     │  + task prompts  │
└─────────────┘     └──────────────┘     └──────────────────┘
```

---

## 3. Kritikus korulmeny: Proxy kompatibilitas

A projekt jelenleg **claude-code-proxy**-t hasznal (`ANTHROPIC_BASE_URL=http://localhost:42069`), ami OAuth-on keresztul a Claude Max elofizeteshez csatlakozik.

**A proxy NEM tamogatja a `tool_use` API-t.**

### Strategia: Proxy-first, tool_use opcionalis

A **proxy mod az elsodleges** fejlesztesi irany — ezt hasznalja a projekt. A tool_use tamogatas opcionalis bonusz, amit akkor erdemes implementalni, ha kesobb direct API-ra valtunk.

```
┌─────────────────────────────────────────────────────┐
│  Proxy mod (ANTHROPIC_BASE_URL beallitva) ← PRIMARY │
│  → Szoveges valasz + extractJSON() + Zod validacio  │
│  → Jobb prompting + few-shot + retry                │
│                                                     │
│  Direct API mod (ANTHROPIC_API_KEY beallitva) ← OPT │
│  → tool_use: garantalt JSON struktura               │
│  → Zod validacio + retry                            │
└─────────────────────────────────────────────────────┘
```

Detektalas:
```typescript
// src/lib/ai-service.ts
// JAVITVA v3: Az eredeti `!!process.env.ANTHROPIC_BASE_URL` igaz volt
// az `https://api.anthropic.com`-ra is, ami hamis proxy-detektalast okozott volna.
export function isProxyMode(): boolean {
  const baseURL = process.env.ANTHROPIC_BASE_URL;
  return !!baseURL && !baseURL.includes('api.anthropic.com');
}
```

> **A terv minden pontja proxy-kompatibilis.** A tool_use opcionalis bonusz direct API modban.

---

## 4. Sprint 1 — Alapok (Core Infrastructure)

> Ezek a tobbi javitas elofeltetelei.

### 4.1 Strukturalt kimenet — `tool_use` (opcionalis)

**Hatas**: ~~Kritikus~~ Alacsony (proxy-first) | **Kockazat**: Alacsony | **Erintett fajlok**: 4 API route + ai-service.ts + UJ ai-tools.ts

> **JAVITVA v6**: A proxy NEM tamogatja a tool_use-t, es a proxy az elsodleges fejlesztesi mod. A tool_use implementacio **Sprint 4-be (Polish)** atsorolva — csak akkor erdemes, ha direct API-ra valtunk. Sprint 1-ben a **proxy-kompatibilis** javitasok (Zod validacio, retry, extractJSON) az elsodlegesek.

#### Problema

A `migrate/route.ts` meg `text.match(/\{[\s\S]*\}/)` regexet hasznal, a `seed/route.ts` sajat regex INSERT kinyerest. Az `extractJSON()` mar kozos modul (`src/lib/extract-json.ts`), de nem minden route hasznalja.

> **UPDATE v5**: Az `extractJSON()` mar KOZOS modul (`src/lib/extract-json.ts`). Az analyze, explain es index-analysis route-ok mar importaljak. **HATRA VAN**: migrate es seed route-ok migralasa `extractJSON()`-ra (a seed kulonleges, mert SQL-t general, nem JSON-t).

#### Megoldas

Anthropic `tool_use` — az AI-t arra kenyszeritjuk, hogy egy definalt tool-t "hivjon meg", aminek a parameterei a kivant JSON struktura. A tool_use kimenet **mindig** valid JSON.

**De**: Csak direct API modban mukodik. Proxy modban a **kozos** extractJSON() + Zod validacio biztositja a minoseg javulast.

#### Implementacio

```typescript
// src/lib/ai-tools.ts (UJ FAJL)
import type Anthropic from '@anthropic-ai/sdk';

export const normalizationAnalysisTool: Anthropic.Tool = {
  name: 'report_normalization',
  description: 'Report normalization analysis results',
  input_schema: {
    type: 'object',
    required: ['normalization', 'issues', 'summary'],
    properties: {
      normalization: { type: 'number', minimum: 0, maximum: 25 },
      issues: {
        type: 'array',
        items: {
          type: 'object',
          required: ['type', 'severity', 'title', 'affectedTable'],
          properties: {
            type: { type: 'string', enum: ['normalization'] },
            severity: { type: 'string', enum: ['critical', 'warning', 'info'] },
            title: { type: 'string' },
            description: { type: 'string' },
            affectedTable: { type: 'string' },
            // JAVITVA v3: affectedColumns hianyzott — az AnalysisIssue tipus tartalmazza
            affectedColumns: { type: 'array', items: { type: 'string' } },
            suggestion: { type: 'string' },
            fixSQL: { type: 'string' },
            estimatedImpact: { type: 'string', enum: ['high', 'medium', 'low'] },
          }
        }
      },
      summary: { type: 'string' }
    }
  }
};

export const migrationTool: Anthropic.Tool = {
  name: 'generate_migration',
  description: 'Generate database migration scripts',
  input_schema: {
    type: 'object',
    required: ['name', 'description', 'upSQL', 'downSQL'],
    properties: {
      name: { type: 'string' },
      description: { type: 'string' },
      upSQL: { type: 'string' },
      downSQL: { type: 'string' },
    }
  }
};

// JAVITVA: Teljes rekurziv JSON schema (nem placeholder!)
export const explainPlanTool: Anthropic.Tool = {
  name: 'report_explain_plan',
  description: 'Report query execution plan as a tree',
  input_schema: {
    type: 'object',
    required: ['id', 'type', 'label', 'cost', 'rows', 'children'],
    properties: {
      id: { type: 'string' },
      type: {
        type: 'string',
        enum: [
          'SELECT', 'SEQ_SCAN', 'INDEX_SCAN', 'INDEX_ONLY_SCAN',
          'HASH_JOIN', 'NESTED_LOOP', 'MERGE_JOIN', 'SORT',
          'AGGREGATE', 'FILTER', 'LIMIT', 'SUBQUERY',
          'MATERIALIZE', 'HASH', 'BITMAP_SCAN', 'CTE_SCAN',
        ],
      },
      label: { type: 'string' },
      table: { type: 'string' },
      index: { type: 'string' },
      cost: { type: 'number', minimum: 0 },
      rows: { type: 'number', minimum: 0 },
      width: { type: 'number' },
      condition: { type: 'string' },
      children: {
        type: 'array',
        // JAVITVA v3: $ref: '#' NEM garantalt az Anthropic tool_use-ban.
        // Fallback: max 3 szint melysegu inline schema (lasd 11. kockazat).
        // Eloszor $ref-el tesztelni — ha nem mukodik, inline-ra valtani.
        items: { $ref: '#' },
      },
    },
  }
};
```

#### Hasznalat az API route-okban (elgazas proxy/direct)

```typescript
// Pelda: analyze route
if (isProxyMode()) {
  // Text mode: structured prompt + extractJSON + Zod
  const response = await client.messages.create({
    model: AI_MODEL, max_tokens: 4096, temperature: 0.1,
    system: systemPrompt(PROMPTS.normalization.system),
    messages: [...fewShotMessages, userMessage],
  });
  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const parsed = extractJSON(text);  // KOZOS fuggveny (ki kell emelni!)
  return aiNormalizationResultSchema.parse(parsed);
} else {
  // Tool mode: guaranteed JSON
  const response = await client.messages.create({
    model: AI_MODEL, max_tokens: 4096, temperature: 0.1,
    system: systemPrompt(PROMPTS.normalization.system),
    tools: [normalizationAnalysisTool],
    tool_choice: { type: 'tool', name: 'report_normalization' },
    messages: [...fewShotMessages, userMessage],
  });
  // JAVITVA: Biztonsagos toolBlock kinyeres (nem ! assertion)
  const toolBlock = response.content.find(b => b.type === 'tool_use');
  if (!toolBlock || toolBlock.type !== 'tool_use') {
    throw new Error('AI did not return a tool_use block');
  }
  return aiNormalizationResultSchema.parse(toolBlock.input);
}
```

#### Endpointok es tool_use alkalmazhatosag

| Route | Tool neve | Miert? |
|-------|-----------|--------|
| `/api/analyze` | `report_normalization` | JSON output: score + issues |
| `/api/migrate` | `generate_migration` | JSON output: upSQL + downSQL |
| `/api/explain` | `report_explain_plan` | JSON output: rekurziv tree |
| `/api/seed` | — (marad text) | Nyers SQL INSERT-eket general, nem JSON-t |
| `/api/query` | — (marad stream) | Szabad szoveges valasz, real-time streaming UX |

> **Megjegyzes**: A tool_use technikai szempontbol kompatibilis a streaminggel az Anthropic SDK-ban. A chat es seed endpointoknal a tool_use azert nem indokolt, mert a kimenet nem strukturalt JSON, hanem szabad szoveg/SQL.

---

### 4.2 Zod AI output validacio

**Hatas**: Kritikus | **Kockazat**: Alacsony | **Erintett fajlok**: validations.ts + 4 API route

#### Problema

A tool_use garantalja a JSON strukturat, de NEM garantalja a szemantikus helyesseget. Proxy modban meg JSON struktura sincs garantalva. Jelenleg CSAK az `explain/route.ts`-ben van Zod output validacio (`explainResponseSchema`). Az analyze, migrate, seed route-oknal nincs.

#### Implementacio

```typescript
// src/lib/validations.ts (BOVITES)
// FONTOS: a projekt 'zod/v4'-et hasznal, NEM 'zod'-ot!
import { z } from 'zod/v4';
import type { ExplainPlanNode, ExplainNodeType } from '@/lib/types';

// --- AI Output Schemas ---

export const aiNormalizationIssueSchema = z.object({
  type: z.literal('normalization'),
  // JAVITVA: 'success' severity is benne a types.ts Severity tipusban,
  // de AI normalizacio SOHA nem ad 'success'-t, ezert itt kihagyjuk.
  severity: z.enum(['critical', 'warning', 'info']),
  title: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  affectedTable: z.string().min(1),
  // JAVITVA v3: affectedColumns hianyzott — az AnalysisIssue tipus tartalmazza
  affectedColumns: z.array(z.string()).optional(),
  suggestion: z.string().max(500).optional(),
  fixSQL: z.string().max(2000).optional(),
  // JAVITVA: estimatedImpact hianyzott — az AnalysisIssue tipus tartalmazza
  estimatedImpact: z.enum(['high', 'medium', 'low']).optional(),
});

export const aiNormalizationResultSchema = z.object({
  normalization: z.number().min(0).max(25),
  issues: z.array(aiNormalizationIssueSchema).max(10),
  summary: z.string().min(1).max(300),
});

export const aiMigrationResultSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().min(1).max(500),
  upSQL: z.string().min(1),
  downSQL: z.string().min(1),
});

// JAVITVA v6: Az explain Zod schema MAR LETEZIK `validations.ts:112-125`-ben
// (`explainPlanNodeSchema` + `explainResponseSchema`). NEM kell ujat letrehozni!
// Csak az analyze es migrate AI output schemak UJ-ak.
// Referencia: `export { explainPlanNodeSchema, explainResponseSchema } from '@/lib/validations';`
```

> **Megjegyzes az `id` mezorol**: Az AI NEM generali az `AnalysisIssue.id` mezot — azt az API route allitja be. A Zod schema TUDATOSAN nem tartalmazza az `id`-t, mert az AI output sema es a vegleges AnalysisIssue tipus kulonbozik. **JAVITVA v3**: A jelenlegi kod `norm_${Math.random().toString(36).slice(2, 10)}` formatumu id-t general (lasd `analyze/route.ts:158`), NEM `crypto.randomUUID()`-ot. Ez megfelelo — a lenyeg, hogy az id a route-ban kerul hozzaadasra, nem az AI-tol jon.

#### Validacio flow

```
AI valasz → [tool_use input VAGY extractJSON(text)] → Zod parse → id hozzaadas → business logic
                                                          │
                                                     Ha hiba → retry (lasd 4.3)
```

#### JAVITVA v4: Score integracio (hianyzott!)

A `runStaticAnalysis()` (`static-analyzer.ts:189`) **3 dimenziot** ad vissza (performance + security + conventions = max 75 pont). Az AI normalizacio (max 25 pont) ezt egesziti ki **100**-ra. Az analyze route merge-oli a kettot:

```typescript
// src/app/api/analyze/route.ts — merge flow
const staticResult = runStaticAnalysis(schema);      // score: 0-75, breakdown: {perf, sec, conv}
const aiResult = await withRetry({ ... });            // { normalization: 0-25, issues, summary }

const healthReport: SchemaHealthReport = {
  score: staticResult.score + aiResult.normalization,  // 0-100
  breakdown: {
    ...staticResult.breakdown,                         // performance, security, conventions
    normalization: aiResult.normalization,              // AI-bol jon
  },
  issues: [
    ...staticResult.issues,
    ...aiResult.issues.map(i => ({ ...i, id: `norm_${Math.random().toString(36).slice(2, 10)}` })),
  ],
  summary: aiResult.summary,
};
```

> **Fontos**: A Zod `aiNormalizationResultSchema` CSAK az AI kimenetet validalja (normalization + issues + summary). A vegso `SchemaHealthReport` a statikus + AI eredmeny MERGE-je — ezt NEM Zod validalja, hanem a TypeScript tipus biztositja.

---

### 4.3 Retry logika hibavisszacsatolassal

**Hatas**: Magas | **Kockazat**: Alacsony | **Erintett fajlok**: UJ ai-retry.ts + API route-ok

#### Problema

Ha az AI hibas JSON-t ad (kulonosen proxy modban), egyetlen hiba = teljes failure. Egy retry alacsonyabb temperature-rel sokszor javitja.

#### Rate limit interakcio

**Fontos**: A retry-ok NEM szamitanak kulon rate limit pontnak. A `checkRateLimit(ip)` egyszer hivodik a route elejen, a retry-k az eredeti request reszei.

```
Request beerkezik
  └─ checkRateLimit(ip) → 1x ellenorzes
  └─ withRetry({ call, validate })
       ├─ Attempt 0: AI hivas (temp=0.1)
       ├─ Attempt 1: AI hivas (temp=0.05) + hibauzenet visszacsatolasa
       └─ Attempt 2: AI hivas (temp=0.0)  + hibauzenet visszacsatolasa
```

#### Implementacio

```typescript
// src/lib/ai-retry.ts (UJ FAJL)
import type { z } from 'zod/v4';

interface AICallOptions<T> {
  // JAVITVA: `lastError` parameter — az elozo hiba szovege, hogy az AI javithassa
  call: (attempt: number, lastError: string | null) => Promise<unknown>;
  schema: z.ZodType<T>;
  maxRetries?: number;        // default: 2 (= max 3 kiserlet)
  // JAVITVA v4: A seed endpoint temperature=0.3, a tobbi 0.1 — nem lehet hardcode-olni!
  baseTemperature?: number;   // default: 0.1
}

// JAVITVA v4: getTemperature() helper — a base temperature endpointonkent valtozik
// JAVITVA v6: EXPORTALNI KELL — route-level kod is hasznalja (pl. seed retry flow)
export function getTemperature(base: number, attempt: number): number {
  return Math.max(0, base - attempt * 0.05);
}

export async function withRetry<T>(opts: AICallOptions<T>): Promise<T> {
  const maxRetries = opts.maxRetries ?? 2;
  const baseTemp = opts.baseTemperature ?? 0.1;
  let lastError: string | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const raw = await opts.call(attempt, lastError);
      const validation = opts.schema.safeParse(raw);
      if (validation.success) return validation.data;

      // JAVITVA: Hiba szoveg megorzese a kovetkezo kiserlethez
      lastError = `JSON validation failed: ${JSON.stringify(validation.error.issues.slice(0, 3))}`;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }

  throw new Error(lastError ?? 'AI call failed after retries');
}
```

> **JAVITAS**: Az eredeti terv NEM csatolta vissza a Zod validacios hibakat az AI-nak retry-nal. Csak a temperature-t csokkentette, ami strukturalis hibakat nem javit. Most a `lastError`-t hozzafuzzuk a retry uzenethez, pl.: `"Your previous response had validation errors: ... Please fix and try again."` Ez dramatikusan noveli a retry sikeresseget.

#### Hasznalat

```typescript
// Pelda: analyze route-ban
const result = await withRetry({
  // JAVITVA v4: baseTemperature hasznalata hardcoded 0.1 helyett
  baseTemperature: 0.1,  // seed: 0.3, explain/migrate: 0.1
  call: async (attempt, lastError) => {
    const temp = getTemperature(0.1, attempt);  // baseTemperature-bol jon
    // Retry eseten hozzafuzzuk a hibat
    const retryHint = lastError
      ? `\n\n[RETRY: Your previous response had errors: ${lastError}. Fix the issues and respond with valid JSON only.]`
      : '';

    if (isProxyMode()) {
      // Proxy: retryHint a user content-ben (szoveges mod)
      const response = await client.messages.create({
        model: AI_MODEL, max_tokens: 4096, temperature: temp,
        system: systemPrompt(PROMPTS.normalization.system),
        messages: [{ role: 'user', content: userContent + retryHint }],
      });
      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      return extractJSON(text);  // KOZOS fuggveny
    } else {
      // JAVITVA v4: tool_use modban a retryHint a SYSTEM prompt-ba kerul,
      // mert tool_choice: 'tool' kenyszeriti a tool kimenetet — a user content-ben
      // levo utasitasok kevesbe hatekonyan ervenysulnek.
      const systemText = PROMPTS.normalization.system + (retryHint || '');
      const response = await client.messages.create({
        model: AI_MODEL, max_tokens: 4096, temperature: temp,
        system: systemPrompt(systemText),
        tools: [normalizationAnalysisTool],
        tool_choice: { type: 'tool', name: 'report_normalization' },
        messages: [{ role: 'user', content: userContent }],
      });
      const toolBlock = response.content.find(b => b.type === 'tool_use');
      if (!toolBlock || toolBlock.type !== 'tool_use') {
        throw new Error('AI did not return a tool_use block');
      }
      return toolBlock.input;
    }
  },
  schema: aiNormalizationResultSchema,
});
```

### 4.4 `extractJSON()` kozossitese

> ✅ **RESZBEN KESZ** (v5 update)

Az `extractJSON()` mar kozos modul: `src/lib/extract-json.ts`. Robusztus brace-balancing + escape + repair logikaval.

**Jelenlegi hasznalat**:
- ✅ `analyze/route.ts` — importalja `extractJSON`-t
- ✅ `explain/route.ts` — importalja `extractJSON`-t
- ✅ `index-analysis/route.ts` — importalja `extractJSON`-t
- ❌ `migrate/route.ts` — meg `text.match(/\{[\s\S]*\}/)` regexet hasznal
- ❌ `seed/route.ts` — sajat regex (de SQL kimenetet general, nem JSON-t — lasd 6.4)

**Hatra levo teendo**: `migrate/route.ts`-ben csere `extractJSON()`-ra. A seed route kulonleges eset (nyers SQL output).

---

## 5. Sprint 2 — Prompt Engineering

> **JAVITVA**: Sprint 2 NEM fugg Sprint 1-tol! A promptok es few-shot peldak fuggetlen optimalizaciok. Sprint 1 (Zod + retry) es Sprint 2 (prompts + few-shot) **parhuzamosan** implementalhatoak. A ket sprint eredmenyeit a vegso integracioban kell osszefuzni.

### 5.1 Feladat-specifikus rendszer promptok

**Hatas**: Magas | **Kockazat**: Alacsony | **Erintett fajlok**: UJ ai-prompts.ts + API route-ok

#### Problema

A chat egy generikus `SYSTEM_PROMPT`-ot hasznal (`ai-service.ts` 4-22. sorai). Az analyze, seed, migrate route-ok sajat inline system prompt-ot adnak at a `systemPrompt()` fuggvenynek — nincs kozponti menedzsment.

> **JAVITVA v3**: Az `ai-service.ts`-ben levo generikus system prompt (4-22. sor) TORLENDO a `PROMPTS` bevezetesevel. A route-ok a `PROMPTS.*.system`-et fogjak hasznalni a `systemPrompt()` hivo parameterekent. A jelenlegi inline prompt stringek (pl. `'You are a database migration expert...'`) az egyes route-okbol is torlendok.

#### Implementacio

```typescript
// src/lib/ai-prompts.ts (UJ FAJL)

export const PROMPTS = {
  chat: {
    system: `You are DBMate AI — a senior database consultant.
Your role: Generate correct, optimized SQL from natural language.

## Persona
- Precise, concise, practical
- Always reference actual schema objects
- Admit uncertainty rather than hallucinate

## Output Format
- SQL in \`\`\`sql blocks
- Brief explanation after each query
- Suggest alternatives when multiple approaches exist

## Constraints
- NEVER invent tables/columns not in the schema
- Use the specified SQL dialect syntax
- For Hungarian locale: use Hungarian names/data`,
    maxHistory: 18,
  },

  normalization: {
    system: `You are a database normalization expert (1NF through BCNF).
Analyze ONLY normalization quality. Do NOT check performance, security, or naming.

## Analysis Scope
1. 1NF: repeating groups, multi-valued columns, non-atomic values
2. 2NF: partial dependencies on composite keys
3. 3NF: transitive dependencies (e.g., city stored instead of city_id FK)
4. BCNF: non-trivial FDs where determinant is not superkey

## Rules
- Max 10 issues, prioritized by severity
- Each issue must reference a specific table
- fixSQL must be executable in the given dialect
- Score 0-25 (25 = fully normalized)

## Output Format
Return ONLY a JSON object:
{ "normalization": <0-25>, "issues": [...], "summary": "..." }`,
  },

  migration: {
    system: `You are a database migration expert.
Generate safe, reversible migrations.

## Rules
- DOWN must perfectly reverse UP
- Preserve existing data (use ALTER, not DROP+CREATE)
- Handle edge cases (NULL defaults, FK constraints)
- Use correct dialect syntax
- Include comments for complex operations

## Output Format
Return ONLY a JSON object:
{ "name": "...", "description": "...", "upSQL": "...", "downSQL": "..." }`,
  },

  explain: {
    // JAVITVA: A teljes EXPLAIN_SYSTEM_PROMPT (explain/route.ts-bol kiemelve)
    system: `You are a database query execution plan simulator. Given a SQL query and schema, generate a realistic EXPLAIN plan as a JSON tree.

## Rules:
- Return ONLY valid JSON — no markdown, no explanation, no code blocks
- The JSON must be a single ExplainPlanNode object
- Each node has: id (string), type (enum), label (string), table (optional string), index (optional string), cost (number), rows (number estimated), condition (optional string), children (array of nodes)
- Valid types: SELECT, SEQ_SCAN, INDEX_SCAN, INDEX_ONLY_SCAN, HASH_JOIN, NESTED_LOOP, MERGE_JOIN, SORT, AGGREGATE, FILTER, LIMIT, SUBQUERY, MATERIALIZE, HASH, BITMAP_SCAN, CTE_SCAN
- Cost is cumulative (parent cost >= sum of children costs)
- Use realistic row estimates based on table structure
- SEQ_SCAN for tables without relevant indexes on filter/join columns
- INDEX_SCAN when an index exists on the filtered/joined column
- For JOINs, pick HASH_JOIN (large tables), NESTED_LOOP (small inner), or MERGE_JOIN (pre-sorted)
- Add SORT nodes when ORDER BY is present without matching index
- Add AGGREGATE nodes for GROUP BY / COUNT / SUM etc.
- Add FILTER nodes for WHERE conditions
- Add LIMIT nodes for LIMIT clauses

## What-if simulation:
- If HYPOTHETICAL INDEXES are provided, treat them as if they exist — use INDEX_SCAN for these
- If REMOVED INDEXES are provided, treat them as if they don't exist — use SEQ_SCAN instead

## Response format:
Return ONLY this JSON structure:
{ "plan": { ...ExplainPlanNode tree... }, "totalCost": <number>, "warnings": [...], "recommendations": [...] }`,
  },

  seed: {
    system: `You are a database seed data generator.
Generate realistic, diverse test data.

## Rules
- Respect ALL foreign key constraints
- Use locale-appropriate names, addresses, phone numbers
- Realistic value distributions (not uniform)
- Status enums: ~70% active, ~20% inactive, ~10% other
- Dates: spread across last 2 years
- Prices: realistic for domain
- UNIQUE constraints must not be violated
- Auto-increment PKs: sequential from 1

## Output Format
Return ONLY raw SQL INSERT statements. No markdown, no explanation.`,
  },
} as const;
```

---

### 5.2 Few-shot peldak a promptokban

**Hatas**: Magas | **Kockazat**: Alacsony | **Erintett fajlok**: ai-prompts.ts

#### Proxy mod (szoveges few-shot)

Egyszerubb — sima user/assistant parok JSON peldaval:

```typescript
export const FEW_SHOT_TEXT = {
  normalization: [
    {
      role: 'user' as const,
      content: `Analyze: [{"name":"orders","columns":[{"name":"id","type":"INT","primaryKey":true},
        {"name":"customer_name","type":"VARCHAR(100)"},{"name":"customer_email","type":"VARCHAR(100)"},
        {"name":"product","type":"VARCHAR(100)"},{"name":"quantity","type":"INT"}],
        "foreignKeys":[],"primaryKey":["id"]}]`,
    },
    {
      role: 'assistant' as const,
      // JAVITVA v4: affectedColumns + estimatedImpact hozzaadva a peldahoz
      // — kulonben az AI nem tanulja meg hasznalni oket a few-shot-bol
      content: JSON.stringify({
        normalization: 15,
        issues: [{
          type: 'normalization', severity: 'warning',
          title: '3NF violation: customer data in orders',
          description: 'customer_name and customer_email create transitive dependency',
          affectedTable: 'orders',
          affectedColumns: ['customer_name', 'customer_email'],
          suggestion: 'Extract to customers table with FK',
          fixSQL: 'CREATE TABLE customers (id INT PRIMARY KEY, name VARCHAR(100), email VARCHAR(100)); ALTER TABLE orders ADD customer_id INT REFERENCES customers(id);',
          estimatedImpact: 'medium',
        }],
        summary: 'Schema violates 3NF due to transitive dependencies in orders table.'
      }),
    },
  ],

  // JAVITVA: migration es explain few-shot hozzaadva (eredetileg hianyzott!)
  migration: [
    {
      role: 'user' as const,
      content: `Schema: users(id INT PK, name VARCHAR(100), email VARCHAR(255))
Dialect: postgresql
Change: Add phone column to users table`,
    },
    {
      role: 'assistant' as const,
      content: JSON.stringify({
        name: 'add_phone_to_users',
        description: 'Add phone column to users table for contact information',
        upSQL: 'ALTER TABLE users ADD COLUMN phone VARCHAR(20);',
        downSQL: 'ALTER TABLE users DROP COLUMN phone;',
      }),
    },
  ],

  explain: [
    {
      role: 'user' as const,
      content: `SQL: SELECT u.name, COUNT(o.id) FROM users u JOIN orders o ON u.id = o.user_id GROUP BY u.name;
Schema: users(id INT PK, name VARCHAR), orders(id INT PK, user_id INT FK->users.id, total DECIMAL)`,
    },
    {
      role: 'assistant' as const,
      content: JSON.stringify({
        id: 'node-1', type: 'AGGREGATE', label: 'GROUP BY u.name', cost: 45.2, rows: 50,
        children: [{
          id: 'node-2', type: 'HASH_JOIN', label: 'JOIN users, orders', cost: 32.1, rows: 500,
          condition: 'u.id = o.user_id',
          children: [
            { id: 'node-3', type: 'SEQ_SCAN', label: 'Scan users', table: 'users', cost: 5.0, rows: 50, children: [] },
            { id: 'node-4', type: 'SEQ_SCAN', label: 'Scan orders', table: 'orders', cost: 12.0, rows: 500, children: [] },
          ]
        }]
      }),
    },
  ],

  seed: [
    {
      role: 'user' as const,
      content: `Schema: users(id INT PK AUTO, name VARCHAR(50), email VARCHAR(100) UNIQUE, status ENUM('active','inactive'))
Config: 3 rows, locale: hu, dialect: postgresql`,
    },
    {
      role: 'assistant' as const,
      content: `INSERT INTO users (id, name, email, status) VALUES
(1, 'Kovacs Istvan', 'kovacs.istvan@example.hu', 'active'),
(2, 'Nagy Katalin', 'nagy.katalin@example.hu', 'active'),
(3, 'Toth Peter', 'toth.peter@example.hu', 'inactive');`,
    },
  ],
};
```

#### Direct API mod (tool_use few-shot)

Komplexebb — az assistant uzenetben `tool_use` block kell, utana user uzenetben `tool_result`:

```typescript
export const FEW_SHOT_TOOL = {
  normalization: [
    {
      role: 'user' as const,
      content: `Analyze: [{"name":"orders","columns":[...]}]`,
    },
    {
      role: 'assistant' as const,
      content: [
        {
          type: 'tool_use' as const,
          id: 'toolu_example_norm_1',
          name: 'report_normalization',
          input: {
            normalization: 15,
            issues: [{
              type: 'normalization', severity: 'warning',
              title: '3NF violation: customer data in orders',
              description: 'customer_name and customer_email create transitive dependency',
              affectedTable: 'orders',
              suggestion: 'Extract to customers table with FK',
              fixSQL: 'CREATE TABLE customers (...);'
            }],
            summary: 'Schema violates 3NF due to transitive dependencies.'
          }
        }
      ],
    },
    // KOTELEZO: tool_result a few-shot tool_use utan
    {
      role: 'user' as const,
      content: [
        {
          type: 'tool_result' as const,
          tool_use_id: 'toolu_example_norm_1',
          content: 'OK',
        }
      ],
    },
  ],
};
```

> **Fontos**: A few-shot `assistant` uzenet `content: ''` NEM helyes tool_use modban! A content-nek tartalmaznia kell a teljes tool_use block-ot, es utana kell egy user message `tool_result`-tal.

---

## 6. Sprint 3 — UX fejlesztesek

### 6.1 Confidence indikator

**Hatas**: Kozepes | **Erintett fajlok**: query route + chat component

A chat endpoint streaming-et hasznal, tool_use nem indokolt. Ezert post-processing heurisztika.

> **JAVITVA**: Az eredeti heurisztika **tevesan** alacsony confidence-t adott CTE-knek es window fuggvenyeknek. Ezek nem jelzik rosszabb AI eredmenyt — csak komplexebb SQL-t. A javitott heurisztika a **sema-illesztes**re es **nem letezo objekumokra** figyel.

```typescript
// src/lib/ai-service.ts (bovites)
export function estimateConfidence(sql: string, schema: Schema): 'high' | 'medium' | 'low' {
  const tableNames = schema.tables.map(t => t.name.toLowerCase());
  const columnNames = schema.tables.flatMap(t => t.columns.map(c => c.name.toLowerCase()));

  // SQL-bol kinyert tabla- es oszlopnevek
  const sqlLower = sql.toLowerCase();

  // JAVITVA v4: Az eredeti regex `/(?:from|join)\s+(\w+)/gi` hibazott:
  //   - `FROM public.users` → `public`-ot kapja el (pont nem \w)
  //   - `FROM "users"` → ures match (idezojel nem \w)
  // Javitas: pont-elvalasztas + idezojel-kezeles
  // 1. Hivatkozik-e nem letezo tablara? → LOW
  const fromMatches = sqlLower.match(/(?:from|join)\s+[`"[\]]?(?:\w+\.)?(\w+)[`"\]]?/gi) || [];
  const referencedTables = fromMatches.map(m => {
    // Az utolso \w+ szekvencia a tablanev (schema.table eseten is)
    const words = m.match(/\w+/g) || [];
    return words[words.length - 1]; // 'from' 'public' 'users' → 'users'
  });
  const unknownTables = referencedTables.filter(t => !tableNames.includes(t));
  if (unknownTables.length > 0) return 'low';

  // 2. Egyszeruseg-alapu ertekeles
  const joinCount = (sqlLower.match(/\bjoin\b/gi) || []).length;
  const hasSubquery = /\bselect\b.*\bselect\b/is.test(sql);

  if (joinCount === 0 && !hasSubquery) return 'high';
  if (joinCount <= 2 && !hasSubquery) return 'medium';
  return 'low';
}
```

> **Streaming kontextus**: A `streamChatResponse()` async generator-e a "done" event-ben adja vissza a teljes `sql` stringet. A confidence szamitas ITT tortenik.

#### JAVITVA v3: `streamChatResponse()` modositas (hianyzott!)

```typescript
// src/lib/ai-service.ts — streamChatResponse() "done" event modositasa
// Jelenlegi: yield { type: 'done', content: JSON.stringify({ fullContent, sql }) }
// Uj:
const confidence = sql ? estimateConfidence(sql, schema) : null;
yield {
  type: 'done' as const,
  content: JSON.stringify({ fullContent, sql, confidence }),
};
```

> **JAVITVA v6**: A `streamChatResponse()` MAR kap `schema: Schema` parametert (ai-service.ts:103-106). Nem kell a signaturat boviteni — a `schema` valtozo mar elerheto a fuggvenyen belul. Csak az `estimateConfidence(sql, schema)` hivast kell hozzaadni a "done" event-ben.

#### JAVITVA v4: Query history DB sema bovites (hianyzott!)

A `query/route.ts` (68-86. sor) a "done" event-ben persist-al SQLite-ba. Ha a done event bovul `confidence`-szel, a DB semat is bőviteni kell:

```sql
-- Migration: add confidence column to query_history
ALTER TABLE query_history ADD COLUMN confidence TEXT; -- 'high' | 'medium' | 'low' | NULL
```

```typescript
// query/route.ts — modositott INSERT (70-82. sor)
const parsed = JSON.parse(chunk.content);
db.prepare(
  `INSERT INTO query_history (id, schema_id, nl_input, sql_output, explanation, confidence, created_at)
   VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
).run(queryId, typedSchema.id, question, parsed.sql || '', parsed.fullContent, parsed.confidence || null);
```

Frontend: Badge a generalt SQL mellett — `High confidence` / `Medium` / `Low`

---

### 6.2 Explain Plan Before/After osszehasonlitas

**Hatas**: Kozepes | **Erintett fajlok**: optimizer component + explain route

- Az optimizer "Fix" gomb melle egy "Compare Plan" gomb
- Ket explain hivas: eredeti SQL → fixalt SQL
- Side-by-side vizualizacio (mar letezo `ExplainPlanTree` komponens, duplikalva)
- Diff kiemeles: zold = javult cost, piros = romlott

```typescript
// Frontend state bovites
interface PlanComparison {
  before: ExplainPlanNode;
  after: ExplainPlanNode;
  costDelta: number; // negativ = javulas
}
```

---

### 6.3 Batch Fix az Optimizer-ben

**Hatas**: Kozepes | **Erintett fajlok**: optimizer component + migrate route

- "Fix All Critical" gomb — osszegyujti az osszes `severity: 'critical'` && `fixSQL` issue-t
- Egyetlen migration-be kombinalja

#### Fix sorrend logika

> **JAVITVA**: Az eredeti string-matching alapu sorrend (`includes('ADD COLUMN')`) tul naiv es torekeny. Ehelyett a `node-sql-parser`-t hasznaljuk (a projektben mar fuggoseg!) a fixSQL tipusanak meghatarozasara.

```typescript
import { Parser } from 'node-sql-parser';

type FixCategory = 'create_table' | 'add_column' | 'create_index' | 'alter_constraint' | 'other';

// JAVITVA v6: `dialect` parameter SZUKSEGES — node-sql-parser default MySQL,
// PostgreSQL-specifikus szintaxis (pl. CREATE INDEX CONCURRENTLY) parse hiba nelkul bukik.
function categorizeFixSQL(sql: string, dialect: 'mysql' | 'postgresql' | 'sqlite' = 'mysql'): FixCategory {
  try {
    // JAVITVA v6: dialect mapping — node-sql-parser 'PostgresQL' stringet var (nem standard!)
    const dbType = dialect === 'postgresql' ? 'PostgresQL' : dialect === 'sqlite' ? 'SQLite' : 'MySQL';
    const parser = new Parser();
    const ast = parser.astify(sql, { database: dbType });
    const first = Array.isArray(ast) ? ast[0] : ast;

    if (first.type === 'create' && first.keyword === 'table') return 'create_table';
    if (first.type === 'create' && first.keyword === 'index') return 'create_index';
    if (first.type === 'alter') {
      // ADD COLUMN vs ADD CONSTRAINT
      const spec = first.expr?.[0];
      if (spec?.action === 'add' && spec?.resource === 'column') return 'add_column';
      return 'alter_constraint';
    }
  } catch {
    // Parsolas sikertelen — fallback
  }
  return 'other';
}

const CATEGORY_ORDER: Record<FixCategory, number> = {
  create_table: 1,    // Uj tablak eloszor (FK celok lehetnek)
  add_column: 2,      // Oszlopok hozzaadasa
  create_index: 3,    // Indexek az uj oszlopokra
  alter_constraint: 4, // Constraint modositasok legvegen
  other: 5,
};

// JAVITVA v6: dialect parameter tovabbitasa a categorizeFixSQL-nek
function orderFixes(issues: AnalysisIssue[], dialect: 'mysql' | 'postgresql' | 'sqlite' = 'mysql'): AnalysisIssue[] {
  return [...issues].sort((a, b) => {
    const ca = categorizeFixSQL(a.fixSQL ?? '', dialect);
    const cb = categorizeFixSQL(b.fixSQL ?? '', dialect);
    return CATEGORY_ORDER[ca] - CATEGORY_ORDER[cb];
  });
}

// JAVITVA v3: MySQL es SQLite is tamogatja a BEGIN/COMMIT tranzakciot!
// Az eredeti verzio csak PostgreSQL-t kezelte.
// JAVITVA v4: `dialect` parameter eltavolitva — minden dialektusra `BEGIN;...COMMIT;`
// JAVITVA v6: `dialect` parameter VISSZAALLITVA — szukseges a categorizeFixSQL-hez (parsolas)
function combineFixes(issues: AnalysisIssue[], dialect: 'mysql' | 'postgresql' | 'sqlite' = 'mysql'): string {
  const ordered = orderFixes(issues, dialect);
  const fixes = ordered.filter(i => i.fixSQL).map(i => i.fixSQL!);
  const body = fixes.join('\n\n');

  return `BEGIN;\n\n${body}\n\nCOMMIT;`;
}
```

---

### 6.4 Seed SQL validacio

**Hatas**: Kozepes | **Erintett fajlok**: seed route + UJ seed-validator.ts

#### Egyszerusitett megkozelites

> A teljes INSERT SQL parsolas (ertekek, tipusok) lenyegeben egy mini SQL parser lenne — aranytalanul nagy munka. Helyette **oszlop-szintu heurisztikus validacio**:

```typescript
// src/lib/seed-validator.ts (UJ FAJL)

interface SeedValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// JAVITVA v3: Az escapeRegex() MAR LETEZIK a seed/route.ts:129-ben!
// Ki kell emelni kozos helyre (pl. src/lib/utils.ts) es MINDKET helyen importalni.
// NE duplikaljuk — a seed-validator.ts importalja a kozos verziót.
import { escapeRegex } from '@/lib/utils'; // kozos export

export function validateSeedSQL(sql: string, schema: Schema): SeedValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const table of schema.tables) {
    // JAVITVA: Kezeli az INSERT INTO ... (...) es INSERT INTO ... VALUES (...) formakat is
    const patternWithCols = new RegExp(
      `INSERT INTO\\s+${escapeRegex(table.name)}\\s*\\(([^)]+)\\)`, 'gi'
    );
    // JAVITVA v4: A patternNoCols-bol `g` flag ELTAVOLITVA — `.test()` + `g` flag
    // JavaScript footgun: a lastIndex elorelepes miatt masodszori hivas mas poziciorol indul.
    // Mivel itt csak egyszer hivjuk `.test()`-et tablanként, a `g` flag felesleges es veszelyes.
    const patternNoCols = new RegExp(
      `INSERT INTO\\s+${escapeRegex(table.name)}\\s+VALUES`, 'i'
    );

    // JAVITVA v3: matchAll — az eredeti exec() csak az ELSO INSERT-et talalte meg tablanként!
    const matches = [...sql.matchAll(patternWithCols)];
    if (matches.length === 0) {
      // Nincs oszloplista — ez is valid SQL, de figyelmeztessunk
      if (patternNoCols.test(sql)) {
        warnings.push(`INSERT INTO ${table.name} without column list — column order must match schema`);
      }
      continue;
    }

    const schemaCols = table.columns.map(c => c.name);
    const requiredCols = table.columns
      .filter(c => !c.nullable && !c.autoIncrement && !c.defaultValue)
      .map(c => c.name);

    for (const match of matches) {
      // 1. Oszlopnevek ellenorzese (leteznek-e a semaban)
      const insertCols = match[1].split(',').map(c => c.trim().replace(/[`"[\]]/g, ''));
      for (const col of insertCols) {
        if (!schemaCols.includes(col)) {
          errors.push(`Unknown column "${col}" in INSERT INTO ${table.name}`);
        }
      }

      // 2. NOT NULL oszlopok benne vannak-e
      for (const col of requiredCols) {
        if (!insertCols.includes(col)) {
          warnings.push(`NOT NULL column "${col}" missing from INSERT INTO ${table.name}`);
        }
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}
```

#### JAVITVA v4: Seed retry mechanizmus (hianyzott!)

A seed endpoint kimenete nyers SQL (nem JSON), ezert a `withRetry()` wrapper NEM hasznalhato kozvetlenul.
Helyette seed-specifikus retry flow:

```typescript
// src/app/api/seed/route.ts — seed retry flow
let seedSQL = '';
let validation: SeedValidationResult;
const MAX_SEED_RETRIES = 1; // seed dragabb, max 1 retry

for (let attempt = 0; attempt <= MAX_SEED_RETRIES; attempt++) {
  const retryHint = attempt > 0 && validation!
    ? `\n\n[RETRY: Previous output had errors: ${validation!.errors.join('; ')}. Fix these issues.]`
    : '';

  const response = await client.messages.create({
    model: AI_MODEL,
    max_tokens: 8192,
    temperature: getTemperature(0.3, attempt), // JAVITVA v4: baseTemp=0.3
    system: systemPrompt(PROMPTS.seed.system),
    messages: [{ role: 'user', content: userContent + retryHint }],
  });

  seedSQL = response.content[0].type === 'text' ? response.content[0].text : '';
  validation = validateSeedSQL(seedSQL, schema);

  if (validation.valid) break;
}
// Ha meg mindig invalid: warnings-szal visszaadjuk, errors eseten hibauzenet
```

---

## 7. Sprint 4 — Teljesitmeny (Polish)

### 7.1 Anthropic prompt caching (beta_cache_control)

> **JAVITVA**: Az eredeti in-memory LRU cache megoldas **torolve**. Okai:
>
> 1. **FIFO, nem LRU**: A `Map.keys().next().value` FIFO torles, nem least-recently-used. Valodi LRU-hoz minden `get()`-nel mozgatni kell az entry-t a Map vegere.
> 2. **Ephemeral**: Next.js dev restart, serverless deploy, vagy HMR torli a memoriat.
> 3. **Alacsony ROI**: Csak az analyze es explain endpoint profitalna belole (2/5 endpoint).
>
> Helyette: **Anthropic beta prompt caching**, ami a system prompt + few-shot peldakat server-oldalon cache-eli.

```typescript
// src/lib/ai-service.ts (bovites)
// Anthropic beta: cache_control a system prompt-ra
// Ez NEM in-memory cache — az Anthropic szerveren tarolja a prompt tokeneket

// JAVITVA v4: A letezo `systemPrompt()` bovitese cache tamogatassal,
// NEM uj fuggveny. Igy a route-oknak nem kell valasztaniuk ket fuggveny kozott.
// A `withCache` parameter opcionalis — proxy modban false (mert nem tamogatja).
// JAVITVA v6: Explicit return type SZUKSEGES — kulonben TypeScript kulon tipust
// inferral a ket branch-nak (cache_control-lal vs nelkul), es az Anthropic SDK
// `system` parameter nem fogadja el a union-t. Megoldas: Anthropic.MessageCreateParams['system']
import type Anthropic from '@anthropic-ai/sdk';

type SystemPromptBlock = Anthropic.MessageCreateParams['system'];

export function systemPrompt(text: string, withCache = false): SystemPromptBlock {
  if (withCache && !isProxyMode()) {
    return [{
      type: 'text' as const,
      text,
      cache_control: { type: 'ephemeral' as const },
    }];
  }
  return [{ type: 'text' as const, text }];
}
// A regi `systemPromptWithCache()` TOROLVE — egy fuggveny kezeli mindkettot.
```

#### Mikor erdemes hasznalni

| Endpoint | Cache-elheto resz | Megtakaritas |
|----------|-------------------|--------------|
| `/api/analyze` | System prompt + few-shot (fix tartalom) | ~300 token/hivas |
| `/api/explain` | System prompt (fix tartalom) | ~200 token/hivas |
| `/api/seed` | System prompt + few-shot (fix tartalom) | ~300 token/hivas |
| `/api/query` | System prompt (fix tartalom) | ~150 token/hivas |
| `/api/migrate` | System prompt + few-shot (fix tartalom) | ~200 token/hivas |

> **Megjegyzes**: A prompt caching dij-csokkentest jelent, NEM valaszido-csokkentest. A proxy tamogatas tesztelendo — ha a proxy nem tamogatja a `cache_control` extension-t, graceful fallback: sima system prompt.

---

## 8. Uj fajlok osszefoglalas

| Fajl | Cel | Sprint | Allapot |
|------|-----|--------|---------|
| `src/lib/extract-json.ts` | Kozos JSON kinyero + repair logika | 1 | ✅ KESZ |
| `src/lib/api-helpers.ts` | Kozos `apiError()` hiba-kezelo | 1 | ✅ KESZ |
| `src/lib/ai-tools.ts` | Anthropic tool definiciok (JSON schema) — CSAK direct API modhoz | 4 (opt) | ❌ TODO (alacsony prioritas) |
| `src/lib/ai-retry.ts` | Generic retry wrapper Zod validacioval + `getTemperature()` export | 1 | ❌ TODO |
| `src/lib/ai-prompts.ts` | Centralizalt prompt konyvtar + few-shot | 2 | ❌ TODO |
| `src/lib/seed-validator.ts` | Seed INSERT validacio sema ellen | 3 | ❌ TODO |
| `src/lib/utils.ts` | Kozos utility-k: `escapeRegex()` (seed/route.ts-bol kiemelve) | 3 | ❌ TODO |

> **Torolve**: `ai-cache.ts` — nem szukseges, lasd 7.1 javitas.

## 9. Modositott fajlok osszefoglalas

| Fajl | Valtozas | Sprint | Allapot |
|------|----------|--------|---------|
| `src/lib/validations.ts` | + AI output Zod schemas (analyze, migrate, seed) | 1 | ⚠️ Explain + index-analysis output KESZ, analyze/migrate/seed TODO |
| `src/lib/ai-service.ts` | + `isProxyMode()`, + `estimateConfidence()`, + prompt cache, generikus prompt torlese, `streamChatResponse()` confidence bovites | 1-3 | ❌ TODO |
| `src/app/api/analyze/route.ts` | tool_use (opt) + Zod output validacio + retry | 1 | ⚠️ Mar hasznal extractJSON-t, de nincs output Zod/retry |
| `src/app/api/migrate/route.ts` | tool_use (opt) + Zod + retry + **regex → extractJSON csere** | 1 | ❌ TODO (meg regex) |
| `src/app/api/explain/route.ts` | tool_use (opt) + retry (Zod ✅ mar van) | 1 | ⚠️ Zod KESZ, retry TODO |
| `src/app/api/index-analysis/route.ts` | + retry (Zod ✅ + extractJSON ✅ mar van) | 1 | ⚠️ Zod KESZ, retry TODO |
| `src/app/api/seed/route.ts` | Few-shot + seed validator + seed retry | 2-3 | ❌ TODO |
| `src/app/api/query/route.ts` | Confidence a "done" SSE event-ben + DB schema bovites (`confidence` oszlop) | 3 | ❌ TODO |
| Optimizer UI komponensek | Batch fix + Before/After | 3 | ❌ TODO |
| Chat UI komponens | Confidence badge | 3 | ❌ TODO |
| `src/lib/utils.ts` | + `escapeRegex()` kozos export (seed/route.ts-bol kiemelve) | 3 | ❌ TODO |

---

## 10. Implementacios sorrend es fuggosegek

```
Sprint 1 (Alapok — proxy-first) ────────── Sprint 2 (Prompts)
  ├─ 4.2 Zod AI output schemak                ├─ 5.1 Task-specific prompts
  │      (analyze, migrate, seed               └─ 5.2 Few-shot examples
  │       — explain ✅, index-analysis ✅)           │
  ├─ 4.3 Retry logika + hiba visszacsatolas         │
  │      + getTemperature() export                   │
  └─ 4.4 extractJSON() kozossitese ✅ RESZBEN       │
  │      (migrate meg regex!)                       │
  └────────────── INTEGRACIO ◄─────────────────────┘
                           │
                           ▼
Sprint 3 (UX) — fugg Sprint 1+2 integraciotol
  ├─ 6.1 Confidence indicator (parhuzamosithato)
  ├─ 6.2 Explain Before/After (fugg: explain route stabil)
  ├─ 6.3 Batch Fix + dialect-aware SQL parse (fugg: optimizer stabil)
  └─ 6.4 Seed SQL validacio + utils.ts (fuggetlen, parhuzamosithato)
       │
       ▼
Sprint 4 (Polish) — fuggetlen, barmikor
  ├─ 7.1 Anthropic prompt caching
  └─ 4.1 tool_use (ATSOROLVA — csak direct API modhoz, proxy nem tamogatja)
```

> **JAVITVA v5**: A 4.4 reszben kesz — `extractJSON()` kozos modul, de migrate route meg nem hasznalja. Sprint 1 es 2 parhuzamosan futhatnak, nincs kemeny fuggoseg kozottuk.
> **JAVITVA v6**: 4.1 tool_use Sprint 4-be atsorolva (proxy-first strategia). index-analysis Zod KESZ. `getTemperature()` export + `categorizeFixSQL` dialect + `utils.ts` uj fajl hozzaadva.

---

## 11. Kockazatok es mitigacio

| Kockazat | Valoszinuseg | Mitigacio | Allapot |
|----------|-------------|-----------|---------|
| Proxy nem tamogatja a tool_use-t | **Megerositett** | Proxy-first strategia: text+Zod az elsodleges, tool_use opcionalis | Aktiv |
| Few-shot noveli a token hasznalat | Alacsony | Rovid peldak, max 1 per endpoint (~200 token/endpoint) | Aktiv |
| Retry lassitja a UX-t | Kozepes | Max 2 retry + hiba visszacsatolas (javitja a sikert) + loading indicator | Aktiv |
| Zod v4 API kulonbsegek | Alacsony | Tesztelve: z.lazy(), z.enum() mukodik | Aktiv |
| Seed validator tul sok false positive | Kozepes | Csak errors (nem warnings) blokkolnak | Aktiv |
| Proxy nem tamogatja cache_control-t | Kozepes | Graceful fallback: sima system prompt | Aktiv |
| `$ref: '#'` rekurzio nem tamogatott Anthropic tool_use-ban | Kozepes | Tesztelni eloszor; fallback: 3 szint melysegu inline JSON Schema | Aktiv |
| Proxy nem tamogatja streaming-et (`messages.stream()`) | Alacsony | A query route mar ma is mukodik proxy-n at — tesztelve, OK | ✅ Megoldva |
| `explain/route.ts` `zod`-ot importal `zod/v4` helyett | ~~Megerositett~~ | ~~Sprint 1-ben javitando~~ — Zod import `validations.ts`-ben kozponti, `zod/v4` ✅ | ✅ Megoldva |
| `extractJSON()` lokalis fuggveny, nem kozos | ~~Magas~~ | ~~Ki kell emelni kozos modulba~~ — `src/lib/extract-json.ts` kozos modul ✅ | ✅ Megoldva |

---

## 12. Javitasok osszefoglalasa

### v2 javitasok (14 db)

| # | Problema | Hol volt | Javitas |
|---|---------|----------|---------|
| 1 | Port tevedesen `:42069` volt `:3000` helyett | Section 3 | Javitva |
| 2 | `extractJSON()` lokalis fuggveny — a terv kozosnek feltetelezte | Section 4.1 | 4.4 uj feladat: kozossites |
| 3 | `explainPlanTool.input_schema` placeholder volt | Section 4.1 | Teljes rekurziv JSON Schema megirva |
| 4 | `toolBlock!.input` unsafe non-null assertion | Section 4.1 | Biztonsagos null-check + throw |
| 5 | `estimatedImpact` hianyzott a Zod schemabol | Section 4.2 | Hozzaadva |
| 6 | Retry NEM csatolta vissza a Zod hibakat az AI-nak | Section 4.3 | `lastError` parameter + retryHint |
| 7 | Sprint 2 hamis fuggoseg Sprint 1-tol | Section 10 | Parhuzamosithato, integracio a vegen |
| 8 | Confidence heurisztika teveesen low-t adott CTE/window-ra | Section 6.1 | Schema-matching alapu heurisztika |
| 9 | Confidence nem jelolte, hol jon a SQL streaming kontextusban | Section 6.1 | "done" SSE event-be integralt |
| 10 | LRU cache valoban FIFO volt | Section 7.1 | Torolve, Anthropic prompt caching helyett |
| 11 | In-memory cache ephemeral Next.js-ben | Section 7.1 | Torolve |
| 12 | Few-shot hianyzott migration es explain-hez | Section 5.2 | Hozzaadva |
| 13 | Batch fix sorrend naiv string-matching | Section 6.3 | `node-sql-parser` AST alapu kategorializalas |
| 14 | Seed validator `escapeRegex` nem volt definialva | Section 6.4 | Fuggveny hozzaadva + INSERT WITHOUT columns kezeles |

### v3 javitasok (11 db)

| # | Tipus | Problema | Hol volt | Javitas |
|---|-------|---------|----------|---------|
| 15 | Gap | `affectedColumns?: string[]` hianyzott tool JSON schema-bol ES Zod schema-bol | Section 4.1, 4.2 | Hozzaadva mindkettohoz |
| 16 | Risk | `$ref: '#'` rekurziv JSON Schema NEM garantalt Anthropic tool_use-ban | Section 4.1 | Kockazat + fallback dokumentalva, risk tablaba felveve |
| 17 | Bug | `combineFixes()` csak PostgreSQL-t wrappelte `BEGIN/COMMIT`-ba — MySQL/SQLite is tamogatja | Section 6.3 | Minden dialektusra alkalmazva |
| 18 | Bug | Seed validator `exec()` csak ELSO INSERT-et talalte meg tablanként | Section 6.4 | `matchAll()` ciklusra cserelve |
| 19 | Gap | Letezo generikus system prompt (`ai-service.ts:4-22`) sorsa nem targyalt | Section 5.1 | Torles + route inline promptok torles dokumentalva |
| 20 | Contradiction | Terv `crypto.randomUUID()`-ot irt, kod `Math.random().toString(36)` + `norm_` prefix-et hasznal | Section 4.2 | Javitva a tenyleges kodreszletre |
| 21 | Gap | `streamChatResponse()` modositas confidence-hez NEM volt leirva | Section 6.1 | Teljes kod + schema parameter bovites hozzaadva |
| 22 | Weakness | `isProxyMode()` hamis pozitiv `api.anthropic.com` URL-re | Section 3 | URL szures hozzaadva |
| 23 | Tech debt | `explain/route.ts` `'zod'`-ot importal `'zod/v4'` helyett | Section 1 | Flaggelve + kockazat tablaba felveve |
| 24 | Duplication | `escapeRegex()` mar letezik `seed/route.ts:129`-ben — terv ujra definialja | Section 6.4 | Kozos helyre kiemelendo (`src/lib/utils.ts`), import-ra cserelve |
| 25 | Risk | Proxy streaming kompatibilitas nem targyalt (`messages.stream()`) | Section 11 | Kockazat tablaba felveve |

### v4 javitasok (10 db)

| # | Tipus | Problema | Hol volt | Javitas |
|---|-------|---------|----------|---------|
| 26 | Bug | `withRetry` temperature reduction hardcode-olja base=0.1, de a seed endpoint 0.3-at hasznal | Section 4.3 | `baseTemperature` parameter + `getTemperature()` helper |
| 27 | Bug | `estimateConfidence()` regex hibazik schema-qualified neveknél (`FROM public.users` → `public`-ot kapja el) | Section 6.1 | Regex javitva: pont-elvalasztas + idezojel-kezeles |
| 28 | Gap | Few-shot normalization pelda nem tartalmazza `affectedColumns` es `estimatedImpact` mezokat | Section 5.2 | Pelda bovitve mindket mezővel |
| 29 | Gap | Query history SQLite tabla nem kap `confidence` oszlopot a done event boviteskor | Section 6.1 | DB sema + INSERT bovites dokumentalva |
| 30 | Gap | Seed endpoint-nak nincs retry mechanizmusa validacios hiba eseten | Section 6.4 | Seed-specifikus retry flow hozzaadva |
| 31 | Dead code | `combineFixes(dialect)` parameter unused v3 fix utan — minden dialektus `BEGIN;...COMMIT;` | Section 6.3 | Parameter eltavolitva |
| 32 | Weakness | `retryHint` tool_use modban user content-be fuzve — system prompt-ban hatekonyabb | Section 4.3 | Tool_use: system prompt, proxy: user content |
| 33 | Gap | `systemPromptWithCache()` vs `systemPrompt()` viszony definialatlan | Section 7.1 | Egyetlen `systemPrompt(text, withCache?)` fuggvenyre egyszerusitve |
| 34 | Weakness | Seed validator `patternNoCols` regex `g` flag + `.test()` = JavaScript lastIndex footgun | Section 6.4 | `g` flag eltavolitva |
| 35 | Gap | Score integracio (statikus 75 + AI normalizacio 25 = 100) nem dokumentalt | Section 4.2 | Merge flow + kodpelda hozzaadva |

### v5 javitasok (7 db) — DB refactor sprint utani allapot-frissites

| # | Tipus | Problema | Hol volt | Javitas |
|---|-------|---------|----------|---------|
| 36 | Outdated | `extractJSON()` "lokalis fuggveny az analyze/route.ts-ben" — mar kozos modul | Section 1, 4.1, 4.4 | Frissitve: `src/lib/extract-json.ts` kozos modul, 3 route importalja |
| 37 | Outdated | `explain/route.ts` `zod`-ot importal `zod/v4` helyett — mar javitva | Section 1, 11 | Frissitve: Zod import `validations.ts`-ben kozponti, minden import `zod/v4` |
| 38 | Missing | `src/lib/api-helpers.ts` kozos `apiError()` utility nem szerepelt a tervben | Section 8, 9 | Hozzaadva mint elkeszult uj fajl |
| 39 | Missing | `src/app/api/index-analysis/route.ts` route nem szerepelt a tervben | Section 1, 9 | Hozzaadva az erintett fajlok tablaba |
| 40 | Outdated | Section 1 tabla pontatlan — analyze "LOKALIS fuggveny", explain "markdown strip + JSON.parse" | Section 1 | Tabla ujrairva a tenyleges allapottal es allapot-oszloppal |
| 41 | Bug | Proxy port `localhost:3000`-kent hivatkozva `localhost:42069` helyett | Section 3 | Port javitva |
| 42 | Outdated | Section 8-9-10 nem jelolte, mi KESZ es mi TODO | Section 8, 9, 10 | Allapot oszlop hozzaadva minden tablaban |

### v6 javitasok (10 db) — Senior architect review

| # | Tipus | Problema | Hol volt | Javitas |
|---|-------|---------|----------|---------|
| 43 | Bug | `index-analysis/route.ts` MAR hasznal Zod output validaciot (`indexAnalysisResponseSchema.safeParse`) — terv tevesen "nincs Zod"-ot irt | Section 1 tabla, Section 9 | Allapot javitva ✅-ra mindket tablaban |
| 44 | Contradiction | `PROMPTS.normalization.system` "Max 5 issues" vs `aiNormalizationResultSchema` `.max(10)` | Section 5.1 vs 4.2 | Prompt javitva: "Max 10 issues" (Zod az iranyado) |
| 45 | Gap | `PROMPTS.explain.system` hianyzik a What-if simulation szekcioja (hypothetical/removed indexes) — a jelenlegi `EXPLAIN_SYSTEM_PROMPT` tartalmazza | Section 5.1 | What-if + Response format szekciok hozzaadva |
| 46 | Redundancy | `aiExplainNodeSchema` ujkent javasolva, de `explainPlanNodeSchema` MAR LETEZIK `validations.ts:112-125`-ben identikus strukturaval | Section 4.2 | Torolve, referencia a letezo schema-ra |
| 47 | Bug | Terv allitja: `streamChatResponse()` signaturaja BOVUL `schema: Schema` parameterrel — de az MAR a 2. parameter (`ai-service.ts:103-106`) | Section 6.1 | Javitva: nem kell boviteni, a schema mar elerheto |
| 48 | Gap | `getTemperature()` modul-szinten definialva (`ai-retry.ts`) de NEM exportalva — route-level kod hivatkozik ra (seed retry flow) | Section 4.3 | `export` hozzaadva a fuggveny definiciohoz |
| 49 | Bug | `categorizeFixSQL()` `parser.astify(sql)` dialect nelkul hivja — default MySQL, PostgreSQL/SQLite szintaxis parse hiba | Section 6.3 | `dialect` parameter + `dbType` mapping hozzaadva (node-sql-parser `PostgresQL` stringet var) |
| 50 | Gap | `src/lib/utils.ts` (kozos `escapeRegex()`) nem szerepelt a Section 8 uj fajlok tablaban | Section 8 | Hozzaadva Sprint 3 TODO-kent |
| 51 | Type safety | `systemPrompt()` `cache_control`-lal bovitve ket kulonbozo return tipust ad — TypeScript union nem illeszkedik az Anthropic SDK `system` parameter tipusahoz | Section 7.1 | Explicit `Anthropic.MessageCreateParams['system']` return type hozzaadva |
| 52 | Priority mismatch | `ai-tools.ts` Sprint 1 "Kritikus"-kent jelolve, de a proxy (PRIMARY fejlesztesi mod) NEM tamogatja a tool_use-t — felesleges munka | Section 4.1, 8, 10 | Sprint 4-be (Polish) atsorolva, prioritas csokkenve |
