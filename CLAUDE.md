# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ⚠️ FUNDAMENTAL RULES - READ THIS FIRST

### The Absolute Positioning Rule

**Single Use Case:** Sof'IA automates documentary pre-analysis of accounting documents, journals, and supporting documents to identify areas requiring special attention and guide the auditor's judgment, WITHOUT EVER SUBSTITUTING FOR IT.

⚠️ **CRITICAL:** Every feature, screen, and piece of wording MUST reinforce this statement. If it doesn't, it's out of scope.

### What Sof'IA DOES:
- Documentary pre-analysis
- Matching documents, journals, and supporting evidence
- Factual, traceable alerts/signals
- Explicability: source, page, rule triggered
- Visible human validation
- Generation of work file deliverables

### What Sof'IA DOES NOT DO:
- Sample selection (CAC's responsibility)
- Statistical extrapolation
- Audit conclusions
- "Material" vs "immaterial" qualification
- Opinion recommendations
- Fraud detection presented as certain
- Automated accounting corrections

### POC Success Criteria (3 Minutes Test)

The POC must answer YES to these questions in under 3 minutes:
1. **Do I understand what Sof'IA does?**
2. **Do I see what deliverables the CAC gets?**
3. **Do I see where the human validates and remains in control?**

### Regulatory & Ethical Framework
- **Human supervision:** Systematic, mandatory for every signal
- **Explicability:** Every signal includes reasoning, compared documents, rule source
- **Traceability:** Immutable log of all actions (Sofia + CAC)
- **Confidentiality:** GDPR compliance, data protection
- **Professional standards:** NEP 230 (audit documentation), IA Act compliance

⚠️ **Any functionality that weakens these principles is OUT OF SCOPE.**

## Project Overview

SOF'IA is an AI-powered document pre-analysis tool for statutory auditors (Commissaires aux Comptes - CAC) in France. This is a proof-of-concept webapp built for the HackAudit competition.

**Competition Deadlines:**
- **POC Submission:** March 2, 2026 at midnight (HARD DEADLINE)
- **Presentation slides:** Submit by March 6, 2026 (email)
- **Final pitch:** March 9, 2026 (4 minutes presentation)
- **Important:** No live demo during pitch - POC must be self-contained

**Core Architecture:**
- **Frontend/Backend:** Next.js 14+ (App Router) deployed on Vercel
- **Database & Storage:** Supabase (PostgreSQL + Storage buckets)
- **AI Processing:** N8N workflows (hosted at https://n8n.agence-b.fr/)
- **Authentication:** License key-based (no passwords), session via httpOnly cookies

**Key Principle:** N8N is a temporary processing service. All persistent data lives in Supabase. After analysis completes, N8N results are imported into Supabase and N8N cleans up.

## Architecture Reference Documents

**CRITICAL:** Always consult these documents before implementing features:
- `CONTEXTE_PROJET_SOFIA.md` - Business context, ethical framework, use cases, CAC profession overview
- `ARCHITECTURE_POC_SOFIA.md` - Main architecture, data models, API contracts, workflows
- `ARCHITECTURE_POC_SOFIA_ANNEXES.md` - Technical details: SQL schema, API route specs, UI specs, sample data requirements

These documents are the single source of truth for:
- Ethical boundaries and positioning (CONTEXTE)
- POC validation criteria and success metrics (CONTEXTE)
- Database schema (Supabase tables, RLS policies)
- API route contracts (request/response formats)
- N8N webhook specifications
- UI screen layouts and user flows
- Signal detection rules (SCA-*, CUT-*, PTG-*)
- Expected documents per scenario

## POC Backlog - 10 User Stories

| ID | User Story | Description |
|----|-----------|-------------|
| POC-01 | Select a mission scenario | Home screen listing 3 concrete examples |
| POC-02 | View expected vs received documents | Comparison table: expected documents vs received |
| POC-03 | Match documents to entries | Factual matching of entries ↔ supporting documents |
| POC-04 | View documentary signals | List of objective documentary signals |
| POC-05 | Understand why a signal was generated | Detailed view with source document + explanation |
| POC-06 | Validate, reject, or investigate a signal | Decision buttons + mandatory comment field |
| POC-07 | Generate documentary checklist | Structured document with scope and limits |
| POC-08 | Signals table with decisions | Summary table with source and human decision |
| POC-09 | Pre-analysis synthesis | Structured narrative summary for NEP 230 file |
| POC-10 | Traceability journal | Chronological log of AI and human actions |

## Expected Deliverables - All 4 Required

### Deliverable 1 - Documentary Completeness Checklist
- Document type, expected, received, status (present/missing/incomplete)
- Purpose: Collection tracking, justification, traceability

### Deliverable 2 - Documentary Signals Table
- For each signal: type, source document, page/line, rule triggered, priority level, human decision (validated/rejected/to investigate)
- **Validation Criterion:** Must be exportable as XLSX with all columns

### Deliverable 3 - Pre-Analysis Synthesis
- Scope, documents analyzed, main documentary findings, analysis limits, explicit mention of human validation
- **Purpose:** Direct integration into work file (NEP 230 compliance)

### Deliverable 4 - Traceability Journal
- Date, document analyzed, signal detected, rule triggered, CAC action, optional comment
- **Purpose:** File defense during inspections, total transparency

### Deliverable Validation Criteria
A deliverable is validated if:
1. **A CAC can integrate it into their file without reworking it**
2. **It's understandable without oral explanation**
3. **It contains NO automated conclusions**

All deliverables must:
- Be displayable on screen
- Be exportable (PDF or simple spreadsheet)
- Use CAC professional vocabulary
- Include CAC identity (name, CNCC number, firm) from profiles table

## User Flow - 6 Screens (Mandatory Sequence)

### Screen 1 - Home & Mission Context
- Mission type, selected example, available documents
- Action: Select example + "Launch pre-analysis" button

### Screen 2 - Analyzed Documents & Completeness
- List received vs expected documents, status (present/missing/incomplete)
- Rule: No judgment, only factual observations

### Screen 3 - Detected Documentary Signals
- Table: signal type, document, page/line, rule triggered, priority level
- Rule: Signals are documentary alerts, NEVER qualified anomalies

### Screen 4 - Signal Detail & Explicability
- Source document extract, highlighted element, factual explanation
- **Visible mention:** "Analyse automatique — à valider par le commissaire aux comptes"

### Screen 5 - Human Validation
- For each signal: status (validated/rejected/to investigate) + free comment field
- Rule: No signal disappears without traced human action

### Screen 6 - Generated Deliverables
- Checklist, signals table, pre-analysis synthesis, traceability journal
- All visible and downloadable

**Critical Design Rule:** Every screen showing Sofia results MUST display the mandatory disclaimer.

## Development Commands

This project uses the standard Next.js development workflow:

```bash
# Install dependencies
npm install

# Development server (default port 3000)
npm run dev

# Type checking
npm run type-check  # or: npx tsc --noEmit

# Build for production
npm run build

# Start production server
npm start
```

## Project Structure

```
app/
├── (auth)/              # License activation + profile setup (no main layout)
│   ├── activate/        # License key entry
│   └── setup/           # CAC profile configuration
├── (app)/               # Main app (with header/sidebar layout)
│   ├── missions/        # Mission management + scenario selection
│   │   └── [id]/
│   │       ├── documents/     # Document upload + completeness check
│   │       ├── analysis/      # Analysis progress (polling N8N)
│   │       ├── signals/       # Signal review + decisions
│   │       ├── deliverables/  # Generated PDF/XLSX exports
│   │       └── traces/        # Audit trail
│   └── settings/        # Profile & license settings
└── api/                 # API Routes (replace Electron IPC channels)
    ├── license/         # License validation (no auth required for /validate)
    ├── profile/         # CAC profile CRUD
    └── missions/[id]/   # Mission, documents, analysis, signals, deliverables, traces

lib/
├── supabase/            # Supabase clients (server + browser)
├── n8n/                 # N8N API client (adds X-License-Key header)
├── auth/                # Session cookie management (encrypt/decrypt)
├── services/
│   ├── results-importer.ts       # Imports N8N analysis payload → Supabase
│   └── deliverable-generator.ts  # Server-side PDF/XLSX generation (pdfmake, exceljs)
└── config/
    ├── expected-documents.ts     # Document requirements per scenario
    └── signal-rules.ts           # Catalog of detection rules (DOC-*, SCA-*, CUT-*, PTG-*)

components/              # React components organized by domain
├── layout/              # Header, Sidebar, Footer
├── license/             # License input validation
├── documents/           # Drag-drop upload, completeness charts
├── analysis/            # Progress bars with steps
├── signals/             # Signal tables, cards, priority badges, decision buttons
├── deliverables/        # Deliverable cards, export buttons
└── trace/               # Timeline view for audit trail

middleware.ts            # Auth middleware: verifies cookie session on all /api/* routes except /api/license/validate

supabase/
├── migrations/
│   └── 001_initial.sql  # Complete PostgreSQL schema (see ARCHITECTURE_POC_SOFIA_ANNEXES.md Section B)
└── seed.sql             # Test license keys (DEMO-SOFI-2026-*)

data/                    # Fictional datasets for demos
├── sondage_ca/          # Revenue sampling scenario (FEC + invoices + delivery notes)
├── cutoff/              # Year-end cutoff scenario
└── pointage/            # Financial statements reconciliation scenario
```

## Core Concepts

### 1. License-Based Authentication
- No username/password. License key activates the app.
- License validation checks Supabase `licenses` table directly (no N8N involved).
- Session stored in httpOnly cookie with `{ license_key, license_id, activated_at }`.
- Middleware (`middleware.ts`) validates cookie on every API request.

### 2. Three Analysis Scenarios

**Common Principle Across All Scenarios:**
Sof'IA acts ONLY in documentary pre-analysis. The CAC remains sole decision-maker. Human validation is always visible and traced.

#### Scenario 1: Revenue Sampling (`sondage_ca`)
- **When:** Planning phase and work on sales cycle
- **CAC objective:** Prepare documentary file for entries selected BY THE CAC
- **Sof'IA does:** Match supporting documents to selected entries, flag documentary absences or inconsistencies, trace controls performed
- **Sof'IA does NOT:** Select the sample, extrapolate, conclude
- **Documents:** FEC + sales invoices + delivery notes
- **Signals:** Missing delivery notes (SCA-001), amount/date mismatches (SCA-002, SCA-003), temporal cutoff issues (SCA-005)

#### Scenario 2: Year-End Cutoff (`cutoff`)
- **When:** Closing work around financial year-end date
- **CAC objective:** Identify transactions requiring special attention for temporal allocation
- **Sof'IA does:** Identify operations near closing date, match invoices/deliveries/services, flag ambiguous documentary situations
- **Sof'IA does NOT:** Qualify accounting errors, reclassify entries
- **Documents:** FEC + invoices/receipts around Dec 31 + delivery/reception notes
- **Signals:** Invoice before closing/delivery after (CUT-001), invoice after/delivery before (CUT-002), operations without date proof (CUT-004)

#### Scenario 3: Financial Statements Reconciliation (`pointage`)
- **When:** Finalization phase before report issuance
- **CAC objective:** Verify documentary consistency and completeness of annual accounts
- **Sof'IA does:** Check presence of expected information, verify factual consistency between financial statements and notes, flag inconsistencies or absences
- **Sof'IA does NOT:** Validate accounts, conclude on regulatory compliance
- **Documents:** Balance sheet + P&L + Notes (annexe)
- **Signals:** Amount discrepancies balance sheet/notes (PTG-001), missing mandatory disclosures (PTG-002), unexplained significant variations (PTG-005)

**Implementation Note:** The webapp offers a single user journey, adapted to three datasets. No functionality should be developed for only one scenario without being compatible with the other two.

See `lib/config/expected-documents.ts` and `lib/config/signal-rules.ts` for complete mappings.

### 3. Analysis Workflow (Async)
1. User uploads documents → Supabase Storage (`documents/{mission_id}/`)
2. User clicks "Launch Analysis" → API route generates signed URLs (1h validity)
3. API route sends signed URLs to N8N webhook (`POST /missions/analyze`)
4. Client polls status every 4s (`GET /api/missions/[id]/analysis/status`)
5. When N8N completes, API route fetches full results (`GET /missions/analyze/{id}/results`)
6. Results imported to Supabase:
   - `ecritures` (parsed FEC entries)
   - `rapprochements` (document-to-entry matching)
   - `signals` (detected issues)
   - `completeness` (document checklist)
   - `deliverables` (PDF/XLSX files → Storage)
   - `traces` (audit trail)
7. N8N cleans up temporary data. Mission is now fully in Supabase.

### 4. Signals & Human Decisions
- All signals start with `human_decision = 'pending'`
- CAC reviews each signal (explicability, source document, FEC entry)
- Decisions: `validated`, `rejected`, `to_investigate`
- Each decision creates a trace entry

### 5. Deliverable Regeneration (Server-Side)
After CAC decisions, deliverables are regenerated by Next.js API routes (not N8N):
- **Check-list**: Static data from `completeness` table
- **Signals table (XLSX)**: Adds decision + comment columns
- **Synthesis (PDF)**: Template + Supabase data
- **Audit trail (PDF)**: Concatenates traces (Sofia + CAC actions)

Libraries: `pdfmake` for PDF, `exceljs` for XLSX (both run in API routes on Vercel).

### 6. N8N Interaction
All N8N calls go through API routes (server-side only). Never call N8N from browser.

N8N webhooks base URL: `https://n8n.agence-b.fr/webhook/sofia`

Authentication: `X-License-Key` header (from session cookie)

Main endpoints:
- `POST /missions/analyze` - Start analysis (accepts signed Supabase URLs)
- `GET /missions/analyze/{id}/status` - Poll progress
- `GET /missions/analyze/{id}/results` - Fetch complete results (single payload with everything)

N8N workflows (WF-01 to WF-08) handle:
- FEC parsing (tab-delimited format per DGFiP spec)
- PDF text extraction (OCR if needed)
- Document-to-entry matching
- LLM-based signal detection (agnostic provider: Claude/GPT/Mistral)
- Deliverable generation (initial only, regeneration happens in Next.js)

## Key Implementation Rules

### Compliance & Legal

#### Mandatory Disclaimer (Display on EVERY Analysis Screen)
```
"Analyse automatique — à valider par le commissaire aux comptes.
Sof'IA ne se substitue pas au jugement professionnel."
```

This must be visible on:
- Signals list screen
- Signal detail screen
- Deliverables screen
- Any screen showing Sofia's analysis results

#### Forbidden Vocabulary - NEVER Use These Terms
Sof'IA must NEVER use these words or concepts:
- "Anomalie" (use "signal documentaire" instead)
- "Significatif" / "non significatif"
- "Fraude détectée" (only "situation documentaire nécessitant attention")
- "Recommandation d'opinion"
- "Conclusion d'audit"
- Any definitive judgment language

#### Required Vocabulary - Always Use
- "Signal documentaire" (not "anomaly")
- "Constat factuel" (factual observation)
- "Nécessite attention du CAC" (requires CAC attention)
- "À valider par le commissaire aux comptes" (to be validated by auditor)
- "Pré-analyse" (pre-analysis, never "audit")

#### Explicability Requirements
Every signal MUST include:
1. **Reasoning:** Why was this signal triggered (factual)
2. **Compared documents:** Which documents were analyzed
3. **Rule source:** Which rule was triggered (e.g., CUT-001, NEP 500 §A14)
4. **Source extract:** Exact quote from source document
5. **Page/line reference:** Precise location in document

#### Human Supervision
- All signals start with `human_decision = 'pending'`
- NO signal can be hidden or auto-dismissed
- CAC must explicitly decide: validated / rejected / to_investigate
- Comment is MANDATORY when rejecting a signal
- Every decision creates a trace entry (immutable log)

#### Audit Trail (NEP 230 Compliance)
Every action goes to `traces` table:
- Sofia actions: `actor = 'sofia'`, `actor_name = 'Sof\'IA'`
- CAC actions: `actor = 'user'`, `actor_name = '{CAC name}, CAC (CNCC-{number})'`
- Log is immutable (no UPDATE, no DELETE on traces)
- Chronological order with precise timestamps

### Data Isolation (RLS)
- All tables have `license_id` foreign key.
- API routes filter ALL queries by `license_id` from session cookie.
- One license = one CAC = isolated data silo.
- For POC: RLS enforced in API routes. In production: native Supabase RLS policies.

### Error Handling
- Mission statuses track errors: `upload_failed`, `analysis_failed`
- Failed analyses can be retried (button in UI)
- N8N results have 48h TTL. After expiry, must re-run analysis.
- If import fails, retry import (results still on N8N within TTL)

### Security
- Cookie: httpOnly, secure, sameSite=strict, encrypted (`iron-session` or `jose`)
- Supabase: `SUPABASE_SERVICE_ROLE_KEY` only on server (API routes). Anon key for browser if needed.
- N8N: `X-License-Key` header added by API routes, never exposed to browser.
- Storage: Signed URLs (1h validity) for N8N download. RLS policies for CAC access.

## Environment Variables

Required in `.env.local`:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...  # Server-side only

# N8N
N8N_BASE_URL=https://n8n.agence-b.fr/webhook/sofia
N8N_TIMEOUT_MS=30000

# Session
SESSION_SECRET=<32+ char secret for cookie encryption>

# App
NEXT_PUBLIC_APP_VERSION=0.1.0
POLL_INTERVAL_MS=4000
RESULTS_TTL_HOURS=48
```

## Supabase Setup

1. Create Supabase project
2. Run migration: `supabase/migrations/001_initial.sql` (complete schema in ARCHITECTURE_POC_SOFIA_ANNEXES.md Section B)
3. Run seed: `supabase/seed.sql` (test license keys)
4. Create Storage buckets: `documents` and `deliverables`
5. Configure RLS policies (reference in migration file)

## Sample Data

Three fictional datasets in `data/` folder (see Section G in annexes):
- `sondage_ca/`: FEC + 8 invoices + 6 delivery notes (2 signals: missing BL, 1 temporal issue, 1 amount mismatch)
- `cutoff/`: FEC + invoices around Dec 31 + delivery notes (signals: temporal attribution errors)
- `pointage/`: Balance sheet + P&L + Notes (signals: amount discrepancies, missing disclosures)

Fictional company: **ACME Distribution SAS** — Year ended 2025-12-31

## Common Patterns

### Reading from Supabase (API Route)
```typescript
import { createServerClient } from '@/lib/supabase/client'

const supabase = createServerClient()
const license_id = getLicenseIdFromCookie(req) // middleware injects this

const { data, error } = await supabase
  .from('missions')
  .select('*')
  .eq('license_id', license_id)
```

### Calling N8N (API Route)
```typescript
import { n8nClient } from '@/lib/n8n/client'

const license_key = getLicenseKeyFromCookie(req)
const response = await n8nClient.post('/missions/analyze', {
  mission_id,
  scenario,
  documents: signedUrls
}, {
  headers: { 'X-License-Key': license_key }
})
```

### Creating Audit Trail Entry
```typescript
await supabase.from('traces').insert({
  mission_id,
  timestamp: new Date().toISOString(),
  actor: 'user', // or 'sofia'
  actor_name: profile.name, // from profiles table
  action: 'signal_validated',
  target_type: 'signal',
  target_id: signal_id,
  details: 'CAC validated signal CUT-001'
})
```

## Development Timeline & Milestones

### Competition Schedule
- **POC submission deadline:** March 2, 2026 at midnight ⚠️ HARD DEADLINE
- **Presentation slides:** Submit by Friday, March 6, 2026 (email)
- **Final pitch:** Monday, March 9, 2026 (4 minutes, no live demo)

### Development Phases
- **Week 1 (Feb 14-16):** Setup, license/profile flows, mission creation, document upload
- **Week 2 (Feb 17-23):** N8N workflows, analysis orchestration, polling UI, results import, signals list
- **Week 3 (Feb 24-28):** Signal detail + decisions, deliverables + regeneration, traces, UI polish
- **Buffer (Mar 1-2):** Sample data finalization, E2E testing, Vercel deployment

### Critical Requirements
- **POC must be self-contained** - No live demo allowed during pitch
- **All 4 deliverables must work** - Checklist, signals table, synthesis, journal
- **All 3 scenarios must be demonstrated** - Complete datasets in `data/` folder
- **Human validation must be visible** - Every screen showing results has disclaimer + decision UI

## Important Notes

### Technical Constraints
- This is a webapp (always online). No offline mode, no sync, no Electron.
- NEVER call N8N from browser. All N8N interaction via API routes.
- NEVER store data permanently in N8N. It's a processing service only.
- After analysis import, mission is fully self-contained in Supabase.
- Session cookie is the ONLY auth mechanism. No JWT, no OAuth, no passwords.
- All monetary amounts: `NUMERIC(15,2)` in Postgres.
- All dates in FEC: French format `YYYYMMDD` or `YYYY-MM-DD`.
- All deliverables include CAC identity (name, CNCC number, cabinet) from `profiles` table.

### Audience & Perception
- **Target audience:** Professional statutory auditors (jury members are CACs)
- **What they must feel:** "This tool understands my profession, helps without exposing me, strengthens my file quality, respects my role and responsibility"
- **What they fear:** Tools that make decisions for them, black boxes, liability exposure, non-compliance
- **What convinces them:** Traceability, explicability, human control, professional vocabulary, integration into existing workflow (NEP 230)

### Design Philosophy
- **Non-generic deliverables:** Must look professional, not AI-generated boilerplate
- **Credibility:** Realistic sample data (ACME Distribution SAS), proper FEC format, real audit scenarios
- **Transparency:** Everything is traceable, explainable, reversible
- **Respect:** Never cross into professional judgment territory

## API Route Conventions

- Success: `{ data: T }`
- Error: `{ error: string, code: string }`
- Middleware checks cookie on all routes except `/api/license/validate`
- All routes under `/api/missions/[id]/*` verify mission belongs to license

See Section E in ARCHITECTURE_POC_SOFIA_ANNEXES.md for complete API contracts.

## UI Component Guidelines

- Use Lucide React for icons
- Tailwind CSS for styling (no custom CSS files)
- Priority badges: high=red, medium=yellow, low=gray
- Signal types map to icons (see signal-rules.ts)
- PDF viewer: react-pdf for embedded source document viewing
- Drag-drop: react-dropzone for document upload
- Always show Sofia disclaimer on analysis screens

## Development Decision Framework

**Before implementing ANY feature, ask:**

1. **Does this reinforce the positioning statement?**
   - "Automates documentary pre-analysis to guide judgment, without substituting for it"
   - If NO → Don't implement it

2. **Can a CAC integrate this deliverable without reworking it?**
   - Must be understandable without oral explanation
   - Must use professional vocabulary
   - Must contain NO automated conclusions
   - If NO → Redesign it

3. **Is human supervision visible and mandatory?**
   - Can the CAC see where they must validate?
   - Is validation traced in the journal?
   - Can signals be hidden without human action?
   - If hidden without validation → Fix it

4. **Is explicability complete?**
   - Source document cited?
   - Page/line referenced?
   - Rule triggered identified?
   - Reasoning explained factually?
   - If any missing → Add it

5. **Does the wording respect ethical boundaries?**
   - Check forbidden vocabulary list (no "anomalie", "significatif", "fraude")
   - Use required vocabulary ("signal documentaire", "constat factuel")
   - Mandatory disclaimer visible?
   - If boundaries crossed → Rewrite it

**Consequence:** If a feature doesn't clearly help the CAC better document their work without deciding for them, it should NOT be developed.

## Critical Files to Review First

When starting work, read these in order:
1. `ARCHITECTURE_POC_SOFIA.md` (sections 1-6: overview, data models, API, workflows)
2. `ARCHITECTURE_POC_SOFIA_ANNEXES.md` (section B: SQL schema, E: API contracts, F: UI specs)
3. `lib/config/expected-documents.ts` (document requirements)
4. `lib/config/signal-rules.ts` (detection rules catalog)
5. `middleware.ts` (auth flow)
6. `supabase/migrations/001_initial.sql` (complete schema)

## N8N Workflow Reference

8 workflows (WF-01 to WF-08):
- WF-02: Main pre-analysis orchestration (6 steps: FEC parse → PDF extract → matching → LLM analysis → signal consolidation → deliverable generation)
- WF-07: Status polling endpoint
- WF-08: Results retrieval (single payload with all data)

LLM prompts emphasize:
- **Role:** "You are a documentary pre-analysis assistant for a statutory auditor. You identify factual documentary signals. You NEVER qualify an anomaly, NEVER conclude, NEVER recommend."
- Factual observations only (no conclusions)
- No "material" vs "immaterial" qualification
- No audit opinions or recommendations
- Always cite source (document, page, extract)
- Return structured JSON for each signal
- **Absolute rules in prompt:**
  - Never make audit conclusions
  - Never qualify as "significant" or "not significant"
  - Never recommend an opinion
  - All signals are objective documentary observations
  - Always cite exact source (document, page, extract)

## Testing Approach

- Use test license keys from `supabase/seed.sql`: `DEMO-SOFI-2026-0001`, `DEMO-SOFI-2026-0002`, `DEMO-SOFI-2026-JURY`
- Test each scenario with corresponding sample data from `data/` folder
- Verify signals match expected signals documented in Section G (annexes)
- Test error cases: upload timeout, N8N failure, TTL expiry, missing documents
- Test decision flow: validate → regenerate deliverables → verify CAC comment appears in XLSX
- Test audit trail: verify every action creates a trace entry

## Deployment (Vercel)

1. Push to main branch → automatic build + deploy
2. Set environment variables in Vercel dashboard
3. Default domain: `sofia-poc.vercel.app` (custom domain optional)
4. N8N must be pre-configured at https://n8n.agence-b.fr/ with workflows activated

## Understanding the Auditor (CAC) Context

### The CAC Paradox
The time spent on mechanical tasks (reading, searching, verifying documents) is time NOT spent on analysis and professional judgment. Sof'IA addresses this friction point.

### What CACs Actually Do
**Statutory auditors (Commissaires aux Comptes):**
- Certify the regularity, accuracy, and fair presentation of annual accounts
- Engage their personal and professional liability on their opinion
- Must document all work in defensible audit files (NEP 230)
- Face increasing document volumes with tight deadlines
- Are subject to professional inspections

**Key operational challenges:**
- Collection and analysis of growing document volumes
- Work with heterogeneous, poorly structured formats
- Constrained closure deadlines
- Robust, defensible documentation requirements

### Common Audit Procedures (Context for the 3 Scenarios)

**Revenue Sampling (sondage_ca):**
- Test sample of sales to verify revenue is real, complete, correctly allocated to period
- Focus on high amounts, sensitive periods (year-end), risky customers
- Match: invoice + delivery note/proof of service + sometimes contract + payment
- Critical point: temporal cutoff (verify sale recorded in correct period)

**Year-End Cutoff (cut-off):**
- Ensure each transaction is recorded in the correct accounting period
- Verify products and expenses are allocated to the period when actually realized
- Focus on operations around Dec 31 (late invoices, deliveries, pressure to "make the numbers")
- Risk: inflated revenue, shifted expenses, artificially smoothed results

**Financial Statements Reconciliation (pointage):**
- Verify what's written in accounting is real, justified, and accurate
- Match accounting entries with supporting documents
- Check: Does the transaction exist? Is it correctly recorded? Right period? Justified by reliable documents?

## The 4-Minute Pitch Structure

**Person 1 - The Problem (WHY):**
The CAC paradox: time spent on mechanical document work is time lost for analysis and professional judgment. Sof'IA addresses this friction.

**Person 2 - The Solution (WHAT):**
Sof'IA is an AI solution that automates documentary pre-analysis to guide CAC judgment, without ever substituting for it. Takes as input: accounting journals (FEC), notes, supporting documents. Never selects samples, never qualifies anomalies, never concludes. The tool illuminates. Judgment remains human.

**Person 3 - Use Cases (HOW):**
Three concrete examples: revenue sampling, cutoff, financial statements/notes reconciliation. In each case, the CAC saves time without losing control.

**Person 4 - Deliverables (VALUE):**
Completeness checklist, documentary signals table, pre-analysis synthesis, traceability journal. Time saved, more robust file, better judgment quality.

**Person 5 - Vision (WHY IT MATTERS):**
Sof'IA was designed to reinforce competence, independence, and ethics. It's explainable, traceable, human-governed. Sof'IA allows the CAC to remain the enlightened guarantor of financial information reliability.

## Changes from v2 (Electron)

This is v3 (Next.js webapp). Previous v2 used Electron + SQLite + local filesystem.

Major simplifications in v3:
- No Electron (webapp instead)
- No SQLite (Supabase PostgreSQL instead)
- No local file storage (Supabase Storage instead)
- No IPC channels (API routes instead)
- No offline mode (always online)
- No sync (one-way: N8N → Supabase)
- No connectivity indicators (webapp = always online)
- License validation via Supabase directly (no N8N involved)
- No multipart upload to N8N (signed URLs instead)

These architecture docs reflect v3 only.

## Reference Documentation Hierarchy

This project has THREE essential reference documents (read in this order):

1. **CONTEXTE_PROJET_SOFIA.md** - Business context, ethical rules, use cases, pitch structure
   - The "why" and "what for"
   - Ethical boundaries and forbidden functionality
   - CAC profession context and needs
   - POC validation criteria

2. **ARCHITECTURE_POC_SOFIA.md** - Technical architecture, data models, workflows
   - The "how" at architecture level
   - System components and interactions
   - API contracts with N8N
   - User flows and deliverables

3. **ARCHITECTURE_POC_SOFIA_ANNEXES.md** - Implementation details
   - The "how" at code level
   - Complete SQL schema
   - Detailed API route specifications
   - UI screen specs with mockups
   - Sample data requirements

**When implementing a feature:**
1. Check CONTEXTE for ethical compliance
2. Check ARCHITECTURE for architectural patterns
3. Check ANNEXES for technical specifications
4. Then implement following this CLAUDE.md as your guide

All three documents + CLAUDE.md form the complete specification of the POC.

## Quick Reference Checklist

### Before Committing Code - Verify:
- [ ] No forbidden vocabulary (anomalie, significatif, fraude détectée, conclusion)
- [ ] Mandatory disclaimer on all analysis screens
- [ ] All signals have explicability (reasoning + compared docs + rule + extract + page)
- [ ] Human decision is mandatory (no auto-dismissal of signals)
- [ ] Trace entry created for every action (Sofia + CAC)
- [ ] CAC identity included in all deliverables (name, CNCC, cabinet)
- [ ] No N8N calls from browser (only from API routes)
- [ ] License filtering on all Supabase queries
- [ ] Error states have retry buttons
- [ ] Comments are clear and professional

### Before Claiming "Feature Complete" - Test:
- [ ] Works for all 3 scenarios (sondage_ca, cutoff, pointage)
- [ ] All 4 deliverables generate correctly
- [ ] Human validation flow works (validate/reject/investigate + comment)
- [ ] Deliverables regenerate after CAC decisions
- [ ] Trace journal shows all actions chronologically
- [ ] Signal explicability displays source document + reasoning
- [ ] Error cases handled gracefully (upload fail, N8N timeout, TTL expiry)
- [ ] POC answers YES to 3-minute test questions

### Before Final Submission - Confirm:
- [ ] Test license keys work (DEMO-SOFI-2026-0001, 0002, JURY)
- [ ] All 3 sample datasets in `data/` folder
- [ ] Expected signals are detected for each scenario
- [ ] Vercel deployment successful
- [ ] Environment variables configured
- [ ] POC is self-contained (no live demo needed)
- [ ] README updated with access instructions
- [ ] All deliverables integrate into CAC file without rework
