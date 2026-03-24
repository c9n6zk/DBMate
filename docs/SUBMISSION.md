# DBMate — LLM-alapú adatbázis-asszisztens

**Feladat azonosítója:** Prompt Engineering — Házi feladat
**Feladat címe:** Egy LLM-alapú adatbázis-asszisztens webalkalmazás fejlesztése
**Beadó:** Jáky Dániel Fülöp
**Dátum:** 2026-03-24
**Git repository:** [https://github.com/c9n6zk/DBMate](https://github.com/c9n6zk/DBMate)

---

## 1. A feladat leírása

Egy LLM-alapú adatbázis-asszisztens webalkalmazás fejlesztése, amely képes SQL adatbázis-sémák importálására és elemzésére. Az alkalmazás természetes nyelvű lekérdezéseket SQL-re alakít, valamint javaslatokat tesz indexelésre, teljesítményoptimalizálásra és az adatbázis normalizálására. A javasolt módosítások automatikusan alkalmazhatók, és a módosított sémák exportálhatók.

## 2. A megoldás körülményei

A fejlesztés teljes egészében **Claude Code** (Anthropic CLI) segítségével történt, prompt engineering technikákat alkalmazva a tervezéstől a kódgenerálásig. A projekt ~124 TypeScript/TSX forrásfájlból áll, amelyeket fázisonként, iteratívan készítettem el.

A fejlesztési folyamat három fő lépésre tagolódott:

1. **Tervezés** — Részletes Master Plan dokumentum (~2800 sor) készítése, amely definiálta az architektúrát, az API végpontokat, az adatbázissémát és az UI wireframe-eket. Ez lett a „kontextus ablak", amelyre a fejlesztés során minden prompt hivatkozott.

2. **Fázisonkénti implementáció** — 6 fejlesztési fázisban készült el a teljes alkalmazás (Import → Dashboard → Optimizer → Migrations → Seed → Export), minden fázisban a korábbi kód kontextusára építve. Az AI-modell konzisztens kódot generált, mert a Master Plan állandó referenciát biztosított.

3. **AI Improvement Plan** — Egy önálló review ciklus, ahol az AI saját kódját elemezte és 35 javítási pontot azonosított (v6-ig iterálva). Ezek közül a kritikusakat implementáltuk: centralizált JSON parsing (`extractJSON`), retry+Zod validáció, few-shot prompting, hibrid statikus+AI elemzés.

### API elérés: Claude Max proxy vs. API kulcs

A fejlesztés során **nem rendelkeztünk Anthropic API kulccsal** — ehelyett a **Claude Max előfizetés** (claude.ai webes felület) által biztosított tokent használtuk. Ehhez egy saját **OAuth proxy szervert** fejlesztettünk (Node.js, külön repository: `claude-code-proxy`), amely a claude.ai session tokent felhasználva közvetíti az API hívásokat a lokális Next.js szerver felé.

Ez komoly kihívást jelentett, mert a proxy **nem támogatja az Anthropic `tool_use` API-t** (structured output) — csak szöveges (`text`) válaszokat tud visszaadni. Így az AI válaszokból saját JSON-parserrel kellett kinyerni a strukturált adatot.

Ennek megoldására **kettős stratégiát** dolgoztunk ki:
- **Proxy mód** (Claude Max) — Az AI szöveges válaszából a `extractJSON()` függvény robusztusan kinyeri a JSON-t (markdown code block kezelés, csonkolt JSON javítás, brace-balancing), majd Zod sémával validáljuk.
- **Közvetlen API mód** (Anthropic API kulcs) — Ha a felhasználónak van API kulcsa, a natív `tool_use` API-t használjuk structured output-tal.

A mód automatikus detekciója az `isProxyMode()` függvénnyel történik (ellenőrzi, hogy az `ANTHROPIC_BASE_URL` környezeti változó be van-e állítva).

**Az alkalmazás tehát mindkét módon működik:**
- `.env.local`-ban `ANTHROPIC_API_KEY=sk-ant-...` → közvetlen API mód
- `.env.local`-ban `ANTHROPIC_BASE_URL=http://localhost:42069` → proxy mód (Claude Max előfizetéssel)

## 3. Technológiai stack

| Technológia | Verzió | Szerep |
|---|---|---|
| Next.js | 16.1.6 | Full-stack keretrendszer (App Router, API Routes) |
| React | 19 | UI könyvtár |
| TypeScript | 5.x | Típusbiztonság |
| TailwindCSS | 4 | Stíluskezelés |
| Zustand | 5.0 | Állapotkezelés (3 store) |
| Zod | v4 | Validáció (API határok) |
| better-sqlite3 | 12.6 | Lokális SQLite adatbázis |
| Anthropic SDK | 0.78 | Claude API kliens |
| @xyflow/react | 12.10 | ER diagram vizualizáció |
| CodeMirror 6 | 6.0 | SQL szerkesztő |
| node-sql-parser | 5.4 | SQL elemzés |

## 4. Funkciók és screenshotok

### 4.1. Import és projektkezelés

Az alkalmazás többféle módot kínál séma importálásra: új projekt létrehozása, SQL beillesztése, fájl feltöltés, vagy előre definiált template kiválasztása (E-Commerce, Blog, Healthcare, LMS).

![Welcome oldal](screenshots/01-welcome.png)
*Welcome oldal — 4 import opció, sidebar projektlista*

![New Project dialog](screenshots/02-new-project-dialog.png)
*Új projekt létrehozása — név, dialektus választás (PostgreSQL/MySQL/SQLite)*

![Template Gallery](screenshots/03-template-gallery.png)
*Template galéria — előre definiált sémák egy kattintással betölthetők*

![SQL Editor](screenshots/04-sql-editor.png)
*SQL szerkesztő — CodeMirror 6 syntax highlighting, Parse & Create gomb*

### 4.2. Dashboard — ER Diagram és séma nézet

A dashboard interaktív ER diagramot jelenít meg a @xyflow/react könyvtárral. A táblák húzhatók, a kapcsolatok (1:N, N:M) vizuálisan megjelennek. Egy táblára kattintva a részletes oszlop-információk jelennek meg.

![ER Diagram](screenshots/05-dashboard-er-diagram.png)
*Interaktív ER diagram — 8 tábla, FK kapcsolatok, oszloptípusok*

![Table Details](screenshots/06-table-details.png)
*Tábla részletek — Columns, Indexes, Foreign Keys, SQL tab-ok*

### 4.3. AI Chat — Természetes nyelv → SQL

A chat komponens természetes nyelvű kérdésekre válaszol a séma kontextusában. A válaszok tartalmazzák a generált SQL-t, magyarázatot, és egy confidence badge-et (High/Medium/Low). Az AI streaming SSE-vel válaszol.

![AI Chat válasz](screenshots/07-ai-chat-response.png)
*AI chat — magyar nyelvű válasz, "High confidence" badge, táblázatos formátum*

![NL→SQL generálás](screenshots/08-nl-to-sql.png)
*NL→SQL — komplex lekérdezés generálása (JOIN, GROUP BY, ORDER BY), Explain gomb*

### 4.4. Explain Plan vizualizáció

A generált SQL-hez az AI végrehajtási tervet készít, amely fa-struktúrában jelenik meg (LIMIT → SORT → AGGREGATE → HASH JOIN → SEQ SCAN). Költségbecslés és sorlétszám minden lépésnél.

![Explain Plan](screenshots/09-explain-plan.png)
*Explain Plan fa — végrehajtási terv vizualizáció a chat-ben*

![Explain Plan tab](screenshots/10-explain-plan-tab.png)
*Explain Plan tab — külön nézet what-if index szimulációval*

### 4.5. Version History

A séma minden módosítása verzióként mentődik. A timeline nézetben visszaállítható bármely korábbi verzió, és diff-összehasonlítás is elérhető.

![Versions](screenshots/11-versions.png)
*Version History — timeline, v1/v2, Show diff, Restore gombok*

### 4.6. Schema Optimizer

A hibrid (statikus + AI) elemző 4 kategóriában pontozza a sémát: Performance, Security, Conventions, Normalization. Az összesített health score 0-100 között mozog. Minden issue-hoz automatikus fix SQL javaslat tartozik, amely egy kattintással alkalmazható.

![Optimizer Analysis](screenshots/12-optimizer-analysis.png)
*Optimizer — Health Score 37/100, 31 issue, kategóriánkénti bontás*

![Issue Detail](screenshots/13-optimizer-issue-detail.png)
*Issue részletek — CREATE INDEX javaslat, Apply/Copy/Dismiss gombok*

### 4.7. Migration Generator

A migrációs rendszer kettős stratégiával működik: egyszerű minták (index hozzáadás, oszlop hozzáadás) azonnali template-ekből generálódnak, komplex változások AI-t használnak. Minden migráció tartalmaz UP és DOWN scriptet, formátum-választási lehetőséggel (Raw, Flyway, Liquibase, Prisma).

![Migrations](screenshots/14-migrations-empty.png)
*Migrations oldal — AI Migration Generator form*

![Migration Generated](screenshots/15-migration-generated.png)
*Generált migráció — V001, UP/DOWN SQL, Apply/Download gombok*

### 4.8. Seed Data Generator

Teszadat-generálás AI segítségével, locale-tudatos (pl. magyar nevek, címek), FK-constraint tiszteletben tartásával, topológiai sorrendben.

![Seed Generator](screenshots/16-seed-generator.png)
*Seed Data Generator — tábla-választó, sorlétszám, locale, FK respektálás*

### 4.9. Export

Többféle export formátum: Schema SQL, Migrations ZIP, Seed Data, ER Diagram PNG, auto-generált Markdown dokumentáció, és Full Bundle ZIP.

![Export](screenshots/17-export.png)
*Export — 6 export formátum, egy kattintásos letöltés*

### 4.10. Settings

Felhasználói beállítások: téma (dark/light/system), alapértelmezett dialektus, migrációs formátum, nyelv, AI konfiguráció.

![Settings](screenshots/18-settings.png)
*Settings — Appearance, Database Defaults, AI Configuration*

## 5. Prompt Engineering technikák és tanulságok

### 5.1. Ami jól működött

- **Master Plan mint kontextus** — Egy ~2800 soros terv dokumentum, amelyre minden prompt hivatkozott. Ez biztosította, hogy az AI konzisztens architektúrát és API-t generáljon fázisokon átívelően. Ez volt a legfontosabb döntés: a „kontextus ablak gondos kezelése" exponenciálisan javította a kód minőségét.

- **Few-shot prompting az AI válaszokhoz** — Az AI service minden endpoint-jához (chat, analyze, migrate, seed, explain) dedikált few-shot példákat definiáltunk (`src/lib/ai-prompts.ts`), amelyek a várt JSON-struktúrát mutatják be. Ez drámaian csökkentette a parse hibákat.

- **Retry + Zod validáció** — Automatikus újrapróbálkozás sémával: ha az AI válasz nem felel meg a Zod sémának, növelt temperature-rel újrageneráljuk, a hibát kontextusba injektálva (`[RETRY: Your previous response had errors: ...]`). Ez a megközelítés ~95%-os sikerességi rátát ért el.

- **Hibrid statikus + AI elemzés** — Az optimizer nem kizárólag AI-ra támaszkodik: a statikus elemző (`src/lib/static-analyzer.ts`) azonnal felismeri a hiányzó indexeket, audit oszlopokat, naming convention sértéseket — míg a komplexebb normalizációs analízist az AI végzi. Ez gyorsabb és megbízhatóbb, mint ha mindent az AI-ra bíznánk.

### 5.2. Ami nehéz volt / tanulságok

- **Proxy limitáció megkerülése** — Lásd a 2. fejezet részletes leírását. A legfontosabb tanulság: az LLM output mindig „piszkos" — érdemes defensíven parseolni. Az `extractJSON()` függvény (~80 sor) megbízhatóbban működik, mint bármilyen regex-alapú megoldás, mert brace-balancing-gel és csonkolt JSON javítással dolgozik.

- **Kontextus ablak menedzselés** — A legnagyobb kihívás az volt, hogy a Master Plan + az aktuális kód + a prompt együtt ne lépje túl a kontextus limitet. Megoldás: fázisonkénti prompt-ok, amelyek csak a releváns részt tartalmazzák, és a séma JSON kompakt formátumban (oszlopnév + típus, FK-k nélkül a részletek).

- **AI „hallucinálás" kezelése** — Az AI időnként nem létező oszlopnevekre vagy függvényekre hivatkozott. A Zod validáció + retry mechanizmus ezt kezeli: ha a válasz nem valid, a hiba üzenetet visszaadjuk az AI-nak, amely tipikusan a második próbálkozásra javít.

- **Lokalizáció** — A magyar nyelvű válaszok generálása külön system prompt instrukciókat igényelt. Érdekes tanulság, hogy az AI hajlamos visszaváltani angolra, ha a séma angol — a system prompt-ban explicit „Válaszolj magyarul" utasítás kellett.

### 5.3. Architektúra döntések

- **Next.js API Routes az LLM proxy-ként** — A szerver oldali API route-ok kezelik az AI hívásokat, így az API kulcs nem kerül a kliensre. A streaming SSE-vel a chat válaszok real-time jelennek meg.

- **SQLite mint lokális adatbázis** — Egyetlen fájl, nincs külső függőség, WAL mód a párhuzamos olvasáshoz. A sémák, verziók, migrációk, chat history mind itt tárolódnak.

- **Zustand állapotkezelés** — 3 store (schema, chat, settings) a persist middleware-rel, localStorage-ba mentve. Ez lehetővé teszi, hogy a felhasználó böngésző-frissítés után is a korábbi állapotban folytassa.

## 6. Összefoglaló

| Metrika | Érték |
|---|---|
| Forrásfájlok | 124 TypeScript/TSX |
| API végpontok | 14 |
| UI komponensek | 60+ |
| Oldalak/route-ok | 7 + error/loading |
| AI funkciók | 6 (chat, analyze, migrate, seed, explain, index-analysis) |
| Build status | Sikeres (0 hiba) |
| Screenshot-ok | 18 |
