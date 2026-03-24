# DBMate — AI-Powered Database Assistant

LLM-alapú adatbázis-asszisztens webalkalmazás, amely képes SQL séma importálásra, elemzésre, természetes nyelvű lekérdezések SQL-re alakítására, valamint teljesítményoptimalizálási és normalizációs javaslatok tételére.

![ER Diagram](docs/screenshots/05-dashboard-er-diagram.png)

## Funkciók

- **Schema Import** — SQL beillesztés, fájl feltöltés, template galéria (E-Commerce, Blog, Healthcare, LMS)
- **ER Diagram** — Interaktív diagram @xyflow/react-tel, FK kapcsolatok, drag & drop
- **AI Chat** — Természetes nyelv → SQL konverzió, confidence badge, streaming válaszok
- **Explain Plan** — SQL végrehajtási terv vizualizáció, what-if index szimuláció
- **Schema Optimizer** — Hibrid (statikus + AI) elemzés: Performance, Security, Conventions, Normalization
- **Migration Generator** — UP/DOWN SQL, template + AI fallback, Flyway/Liquibase/Prisma formátum
- **Seed Data** — AI-alapú tesztadat-generálás, FK-constraint respektálás, locale-támogatás
- **Export** — SQL, JSON, ZIP, PNG, Markdown dokumentáció
- **Version History** — Timeline, diff, restore
- **Settings** — Téma, dialektus, nyelv, AI konfiguráció

## Tech Stack

| Technológia | Verzió | Szerep |
|---|---|---|
| Next.js | 16.1.6 | Full-stack framework (App Router) |
| React | 19 | UI |
| TypeScript | 5.x | Típusbiztonság |
| TailwindCSS | 4 | Stíluskezelés |
| Zustand | 5.0 | Állapotkezelés |
| Zod | v4 | Validáció |
| better-sqlite3 | 12.6 | Lokális SQLite adatbázis |
| Anthropic SDK | 0.78 | Claude API kliens |
| @xyflow/react | 12.10 | ER diagram |
| CodeMirror 6 | 6.0 | SQL szerkesztő |

## Telepítés és futtatás

### Előfeltétel

- **Node.js** >= 18
- **pnpm** >= 9 (`npm install -g pnpm`)
- **Anthropic API kulcs** (Claude)

### 1. Repo klónozása

```bash
git clone https://github.com/c9n6zk/DBMate.git
cd DBMate
```

### 2. Függőségek telepítése

```bash
pnpm install
```

### 3. Környezeti változók beállítása

Hozz létre egy `.env.local` fájlt a projekt gyökerében:

```env
# 1. opció: Anthropic API kulcs (ha van)
ANTHROPIC_API_KEY=sk-ant-...ide-ird-a-kulcsod...

# 2. opció: Claude Max proxy (ha nincs API kulcs, de van Claude Max előfizetés)
# ANTHROPIC_BASE_URL=http://localhost:42069

# AI modell (opcionális, alapértelmezett: claude-sonnet-4-6)
AI_MODEL=claude-sonnet-4-6
```

> **Megjegyzés:** Az AI funkciókhoz (chat, analyze, migrate, seed, explain) szükség van vagy Anthropic API kulcsra, vagy a Claude Max proxy-ra. A statikus funkciók (import, ER diagram, export) ezek nélkül is használhatóak. A fejlesztés során Claude Max előfizetést használtunk egy saját OAuth proxy-n keresztül, mert nem rendelkeztünk API kulccsal.

### 4. Fejlesztői szerver indítása

```bash
pnpm dev
```

Az alkalmazás elérhető: **http://localhost:3000**

### 5. Production build

```bash
pnpm build
pnpm start
```

## Projekt struktúra

```
src/
├── app/                  # Next.js App Router oldalak + API route-ok
│   ├── api/              # 14 API végpont (parse, analyze, chat, migrate, seed, ...)
│   ├── dashboard/        # ER diagram, Explain Plan, Versions
│   ├── optimizer/        # Health score, issues, index analysis
│   ├── migrations/       # Migráció lista + AI generator
│   ├── seed/             # Tesztadat generátor
│   ├── export/           # Export formátumok
│   └── settings/         # Felhasználói beállítások
├── components/           # 60+ React komponens
│   ├── chat/             # AI chat panel
│   ├── dashboard/        # ER diagram, tábla részletek
│   ├── optimizer/        # Health score gauge, issue kártyák
│   ├── migrations/       # Migráció lista/részletek
│   ├── seed/             # Tábla választó, előnézet
│   ├── import/           # SQL szerkesztő, fájl dropzone
│   ├── layout/           # Sidebar, projekt lista
│   ├── shared/           # Error boundary, skeleton-ök, diff nézet
│   └── ui/               # 18 shadcn/base-ui komponens
├── lib/                  # 20 utility/service modul
│   ├── ai-service.ts     # Claude API kliens, streaming
│   ├── ai-prompts.ts     # System prompt-ok, few-shot példák
│   ├── extract-json.ts   # Robusztus JSON parser AI válaszokhoz
│   ├── static-analyzer.ts # Statikus séma elemző
│   ├── db.ts             # SQLite init + migrációk
│   ├── validations.ts    # Zod sémák
│   └── types.ts          # TypeScript típusok
├── stores/               # 3 Zustand store (schema, chat, settings)
└── data/                 # Schema template-ek (SQL fájlok)
```

## Screenshotok

Részletes képek: [`docs/screenshots/`](docs/screenshots/)

| Feature | Screenshot |
|---|---|
| Welcome | [01-welcome.png](docs/screenshots/01-welcome.png) |
| ER Diagram | [05-dashboard-er-diagram.png](docs/screenshots/05-dashboard-er-diagram.png) |
| AI Chat | [07-ai-chat-response.png](docs/screenshots/07-ai-chat-response.png) |
| NL→SQL | [08-nl-to-sql.png](docs/screenshots/08-nl-to-sql.png) |
| Explain Plan | [09-explain-plan.png](docs/screenshots/09-explain-plan.png) |
| Optimizer | [12-optimizer-analysis.png](docs/screenshots/12-optimizer-analysis.png) |
| Migrations | [15-migration-generated.png](docs/screenshots/15-migration-generated.png) |
| Seed Data | [16-seed-generator.png](docs/screenshots/16-seed-generator.png) |
| Export | [17-export.png](docs/screenshots/17-export.png) |

## Dokumentáció

- [SUBMISSION.md](docs/SUBMISSION.md) — Leadási dokumentáció, prompt engineering tanulságok
- [MASTER_PLAN.md](docs/MASTER_PLAN.md) — Részletes tervezési dokumentum
- [AI_IMPROVEMENT_PLAN.md](docs/AI_IMPROVEMENT_PLAN.md) — AI kód-review és javítási terv

## Szerző

**Jáky Dániel Fülöp** — MSC Prompt Engineering, 2026
