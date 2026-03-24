# DBMate — AI-Powered Database Assistant

LLM-alapu adatbazis-asszisztens webalkalmazas, amely kepes SQL sema importalasra, elemzesre, termeszetes nyelvu lekerdezesek SQL-re alakitasara, valamint teljesitmenyoptimalizalasi es normalizacios javaslatok tetelere.

![ER Diagram](docs/screenshots/05-dashboard-er-diagram.png)

## Funkciok

- **Schema Import** — SQL paste, file upload, template gallery (E-Commerce, Blog, Healthcare, LMS)
- **ER Diagram** — Interaktiv diagram @xyflow/react-tel, FK kapcsolatok, drag & drop
- **AI Chat** — Termeszetes nyelv -> SQL konverzio, confidence badge, streaming valaszok
- **Explain Plan** — SQL vegrehajtasi terv vizualizacio, what-if index szimulacio
- **Schema Optimizer** — Hibrid (statikus + AI) elemzes: Performance, Security, Conventions, Normalization
- **Migration Generator** — UP/DOWN SQL, template + AI fallback, Flyway/Liquibase/Prisma formatum
- **Seed Data** — AI-alapu tesztadat-generalas, FK-constraint respektalas, locale-tamogatas
- **Export** — SQL, JSON, ZIP, PNG, Markdown dokumentacio
- **Version History** — Timeline, diff, restore
- **Settings** — Tema, dialektus, nyelv, AI konfiguracio

## Tech Stack

| Technologia | Verzio | Szerep |
|---|---|---|
| Next.js | 16.1.6 | Full-stack framework (App Router) |
| React | 19 | UI |
| TypeScript | 5.x | Tipusbiztonsag |
| TailwindCSS | 4 | Stiluskezeles |
| Zustand | 5.0 | Allapotkezeles |
| Zod | v4 | Validacio |
| better-sqlite3 | 12.6 | Lokalis SQLite adatbazis |
| Anthropic SDK | 0.78 | Claude API kliens |
| @xyflow/react | 12.10 | ER diagram |
| CodeMirror 6 | 6.0 | SQL szerkeszto |

## Telepites es futtatas

### Elofeltetel

- **Node.js** >= 18
- **pnpm** >= 9 (`npm install -g pnpm`)
- **Anthropic API kulcs** (Claude)

### 1. Repo klonozasa

```bash
git clone https://github.com/c9n6zk/DBMate.git
cd DBMate
```

### 2. Fuggosegek telepitese

```bash
pnpm install
```

### 3. Kornyezeti valtozok beallitasa

Hozz letre egy `.env.local` fajlt a projekt gyokereben:

```env
# Anthropic API kulcs (kotelezo)
ANTHROPIC_API_KEY=sk-ant-...ide-ird-a-kulcsod...

# AI modell (opcionalis, alapertelmezett: claude-sonnet-4-6)
AI_MODEL=claude-sonnet-4-6
```

> **Megjegyzes:** API kulcs nelkul az alkalmazas elindul, de az AI funkciok (chat, analyze, migrate, seed, explain) nem mukodnek. A statikus funkciok (import, ER diagram, export) kulcs nelkul is hasznalhatoak.

### 4. Fejlesztoi szerver inditasa

```bash
pnpm dev
```

Az alkalmazas elerheto: **http://localhost:3000**

### 5. Production build

```bash
pnpm build
pnpm start
```

## Projekt struktura

```
src/
├── app/                  # Next.js App Router oldalak + API route-ok
│   ├── api/              # 14 API vegpont (parse, analyze, chat, migrate, seed, ...)
│   ├── dashboard/        # ER diagram, Explain Plan, Versions
│   ├── optimizer/        # Health score, issues, index analysis
│   ├── migrations/       # Migration lista + AI generator
│   ├── seed/             # Tesztadat generator
│   ├── export/           # Export formatumok
│   └── settings/         # Felhasznaloi beallitasok
├── components/           # 60+ React komponens
│   ├── chat/             # AI chat panel
│   ├── dashboard/        # ER diagram, table details
│   ├── optimizer/        # Health score gauge, issue cards
│   ├── migrations/       # Migration list/detail
│   ├── seed/             # Table selector, preview
│   ├── import/           # SQL editor, file dropzone
│   ├── layout/           # Sidebar, project list
│   ├── shared/           # Error boundary, skeletons, diff viewer
│   └── ui/               # 18 shadcn/base-ui komponens
├── lib/                  # 20 utility/service modul
│   ├── ai-service.ts     # Claude API kliens, streaming
│   ├── ai-prompts.ts     # System prompt-ok, few-shot peldak
│   ├── extract-json.ts   # Robusztus JSON parser AI valaszokhoz
│   ├── static-analyzer.ts # Statikus sema elemzo
│   ├── db.ts             # SQLite init + migracok
│   ├── validations.ts    # Zod semak
│   └── types.ts          # TypeScript tipusok
├── stores/               # 3 Zustand store (schema, chat, settings)
└── data/                 # Schema template-ek (SQL fajlok)
```

## Screenshotok

Reszletes kepek: [`docs/screenshots/`](docs/screenshots/)

| Feature | Screenshot |
|---|---|
| Welcome | [01-welcome.png](docs/screenshots/01-welcome.png) |
| ER Diagram | [05-dashboard-er-diagram.png](docs/screenshots/05-dashboard-er-diagram.png) |
| AI Chat | [07-ai-chat-response.png](docs/screenshots/07-ai-chat-response.png) |
| NL->SQL | [08-nl-to-sql.png](docs/screenshots/08-nl-to-sql.png) |
| Explain Plan | [09-explain-plan.png](docs/screenshots/09-explain-plan.png) |
| Optimizer | [12-optimizer-analysis.png](docs/screenshots/12-optimizer-analysis.png) |
| Migrations | [15-migration-generated.png](docs/screenshots/15-migration-generated.png) |
| Seed Data | [16-seed-generator.png](docs/screenshots/16-seed-generator.png) |
| Export | [17-export.png](docs/screenshots/17-export.png) |

## Dokumentacio

- [SUBMISSION.md](docs/SUBMISSION.md) — Leadasi dokumentacio, prompt engineering tanulsagok
- [MASTER_PLAN.md](docs/MASTER_PLAN.md) — Reszletes tervezesi dokumentum
- [AI_IMPROVEMENT_PLAN.md](docs/AI_IMPROVEMENT_PLAN.md) — AI kod-review es javitasi terv

## Szerzo

**Jaky Daniel Fulop** — MSC Prompt Engineering, 2026
