# SOF'IA — Master Backlog Structure
> Generated: 2026-02-14
> POC Deadline: March 2, 2026 midnight
> Based on: ARCHITECTURE_POC_SOFIA.md, ANNEXES, CONTEXTE_PROJET_SOFIA.md

---

## I. EXECUTIVE SUMMARY

### 1. Project Scope
**Single Use Case:** Automate documentary pre-analysis of accounting documents, journals, and supporting documents to identify areas requiring CAC attention, WITHOUT EVER SUBSTITUTING FOR PROFESSIONAL JUDGMENT.

### 2. POC Validation Criteria (3-Minute Test)
- ✅ Do I understand what Sof'IA does?
- ✅ Do I see what deliverables the CAC gets?
- ✅ Do I see where the human validates and remains in control?

### 3. Critical Dates
- **POC Submission:** March 2, 2026 at midnight (HARD DEADLINE)
- **Presentation slides:** March 6, 2026 (email)
- **Final pitch:** March 9, 2026 (4 minutes, no live demo)

### 4. Tech Stack
- **Frontend/Backend:** Next.js 14+ App Router (Vercel)
- **Database:** Supabase (PostgreSQL + Storage)
- **AI Processing:** N8N (https://n8n.agence-b.fr/)
- **Authentication:** License key-based (httpOnly cookies)

---

## II. POC USER STORIES (10 CRITICAL)

These are the MINIMUM features required for POC validation. All must be completed by March 2.

| ID | Priority | User Story | Acceptance Criteria | Estimated Effort |
|---|---|---|---|---|
| **POC-01** | P0 | Select a mission scenario | Home screen lists 3 scenarios (sondage_ca, cutoff, pointage). CAC can create mission with name + scenario selection. | 2 days |
| **POC-02** | P0 | View expected vs received documents | Comparison table shows expected documents (per scenario config) vs received (uploaded). Status: present/missing/incomplete. Completeness % displayed. | 2 days |
| **POC-03** | P0 | Match documents to entries | System displays rapprochements table (FEC entries ↔ supporting docs). Match types: exact/partial/missing. Confidence level shown. | 3 days |
| **POC-04** | P0 | View documentary signals | Signals list with filters (priority, type, decision). Each signal shows: type, description, rule ID, priority badge, decision status. | 2 days |
| **POC-05** | P0 | Understand signal explicability | Signal detail view includes: reasoning, compared documents, rule source (NEP ref), source extract, page/line reference. PDF viewer for source document. | 3 days |
| **POC-06** | P0 | Validate/reject/investigate signals | Decision buttons + mandatory comment field (if rejected). Updates signal.human_decision + creates trace entry. Disclaimer visible. | 2 days |
| **POC-07** | P0 | Generate documentary checklist | PDF deliverable with: document type, expected, received, status table. Includes CAC identity (name, CNCC, cabinet). Mentions scope and limits. | 2 days |
| **POC-08** | P0 | Signals table with decisions | XLSX deliverable with columns: signal type, description, source doc, page, rule, priority, CAC decision, CAC comment, date. | 2 days |
| **POC-09** | P0 | Pre-analysis synthesis | PDF deliverable: scope, documents analyzed, main findings, CAC decisions summary, explicit limits, validation section for CAC signature. NEP 230 compliant. | 3 days |
| **POC-10** | P0 | Traceability journal | PDF deliverable: chronological log of all actions (Sofia + CAC). Columns: timestamp, actor, actor_name, action, details. Immutable. | 2 days |

**Total Critical Path:** ~23 days (must parallelize)

---

## III. TECHNICAL IMPLEMENTATION TASKS (BY DOMAIN)

### A. INFRASTRUCTURE & SETUP (Week 1: Feb 14-16)

#### A.1 Project Initialization
- [ ] **SETUP-001** [4h] Scaffold Next.js 14+ with TypeScript + Tailwind CSS + App Router
- [ ] **SETUP-002** [2h] Configure ESLint + Prettier
- [ ] **SETUP-003** [2h] Setup environment variables (.env.local template)
- [ ] **SETUP-004** [2h] Configure project structure (app/, lib/, components/, types/)
- [ ] **SETUP-005** [2h] Setup package.json dependencies (see ANNEXES I.4)

**Dependencies:** None | **Estimated:** 12h | **Priority:** P0

#### A.2 Supabase Setup
- [ ] **SUP-001** [2h] Create Supabase project + configure connection
- [ ] **SUP-002** [4h] Execute migration 001_initial.sql (complete schema - 15 tables)
- [ ] **SUP-003** [1h] Execute seed.sql (test license keys)
- [ ] **SUP-004** [2h] Create Storage buckets: "documents" and "deliverables"
- [ ] **SUP-005** [3h] Configure RLS policies for license isolation
- [ ] **SUP-006** [3h] Create Supabase clients (server + browser) in lib/supabase/
- [ ] **SUP-007** [2h] Generate TypeScript types from schema

**Dependencies:** SETUP-001 | **Estimated:** 17h | **Priority:** P0

#### A.3 Authentication & Session
- [ ] **AUTH-001** [4h] Implement middleware.ts (cookie verification on all /api/* routes)
- [ ] **AUTH-002** [3h] Create lib/auth/session.ts (encrypt/decrypt cookie with iron-session)
- [ ] **AUTH-003** [2h] Implement license validation logic (check Supabase licenses table)
- [ ] **AUTH-004** [2h] Add license_id injection to API route headers

**Dependencies:** SUP-002, SUP-006 | **Estimated:** 11h | **Priority:** P0

### B. LICENSE & PROFILE FLOWS (Week 1: Feb 14-16)

#### B.1 License Activation
- [ ] **LIC-001** [3h] Create (auth)/activate/page.tsx (license input screen)
- [ ] **LIC-002** [2h] Create components/license/LicenseInput.tsx (validation UI)
- [ ] **LIC-003** [4h] Create POST /api/license/validate route
  - Query Supabase licenses table
  - Validate key + status + expiration
  - Set httpOnly cookie with license data
- [ ] **LIC-004** [2h] Create GET /api/license/status route (check session validity)
- [ ] **LIC-005** [2h] Implement redirect logic (no cookie → /activate)

**Dependencies:** AUTH-001, AUTH-002, SUP-002 | **Estimated:** 13h | **Priority:** P0

#### B.2 CAC Profile Setup
- [ ] **PROF-001** [3h] Create (auth)/setup/page.tsx (profile configuration screen)
- [ ] **PROF-002** [2h] Create components/profile/ProfileForm.tsx
- [ ] **PROF-003** [4h] Create /api/profile route (GET/POST/PUT)
  - GET: Fetch profile by license_id
  - POST: Create new profile
  - PUT: Update existing profile
- [ ] **PROF-004** [2h] Add profile existence check to routing logic
- [ ] **PROF-005** [1h] Create profile type definitions in types/

**Dependencies:** LIC-003, SUP-002 | **Estimated:** 12h | **Priority:** P0

### C. MISSION MANAGEMENT (Week 1: Feb 14-16)

#### C.1 Mission CRUD
- [ ] **MIS-001** [4h] Create /api/missions route (GET/POST)
  - GET: List missions for license_id
  - POST: Create mission (name + scenario) + insert trace
- [ ] **MIS-002** [3h] Create /api/missions/[id] route (GET/PUT/DELETE)
  - GET: Mission details + stats (signals count, etc.)
  - PUT: Update mission (name, status)
  - DELETE: Cascade delete
- [ ] **MIS-003** [2h] Define mission types in types/mission.ts
- [ ] **MIS-004** [2h] Create mission status state machine logic

**Dependencies:** SUP-002, AUTH-001 | **Estimated:** 11h | **Priority:** P0

#### C.2 Mission UI
- [ ] **MIS-UI-001** [4h] Create (app)/missions/page.tsx (home screen)
  - List existing missions
  - "New mission" form: name + scenario selection
- [ ] **MIS-UI-002** [3h] Create components/mission/ScenarioSelector.tsx (3 cards)
- [ ] **MIS-UI-003** [2h] Create components/mission/MissionCard.tsx (list item)
- [ ] **MIS-UI-004** [3h] Create (app)/missions/[id]/page.tsx (redirect to documents)

**Dependencies:** MIS-001, MIS-002 | **Estimated:** 12h | **Priority:** P0

### D. DOCUMENT MANAGEMENT (Week 1: Feb 14-16)

#### D.1 Document Upload & Storage
- [ ] **DOC-001** [4h] Create /api/missions/[id]/documents route (GET/POST/DELETE)
  - POST: Upload files to Supabase Storage, insert documents table, update mission status
  - GET: List documents for mission
  - DELETE: Remove from Storage + DB
- [ ] **DOC-002** [3h] Implement signed URL generation for N8N (1h validity)
- [ ] **DOC-003** [2h] Create document type definitions in types/
- [ ] **DOC-004** [3h] Implement file hash calculation (SHA-256)

**Dependencies:** SUP-004, MIS-001 | **Estimated:** 12h | **Priority:** P0

#### D.2 Completeness Calculation
- [ ] **DOC-005** [4h] Create lib/config/expected-documents.ts
  - Map scenarios → expected documents (type, label, required)
- [ ] **DOC-006** [4h] Create /api/missions/[id]/documents/completeness route
  - Compare expected vs received
  - Calculate status: present/missing/incomplete
  - Return percentage + details
- [ ] **DOC-007** [2h] Create completeness type definitions

**Dependencies:** DOC-001 | **Estimated:** 10h | **Priority:** P0

#### D.3 Document Upload UI
- [ ] **DOC-UI-001** [5h] Create (app)/missions/[id]/documents/page.tsx
  - Document list table
  - Completeness chart/progress bar
  - "Launch analysis" button (enabled if ≥1 required doc)
- [ ] **DOC-UI-002** [4h] Create components/documents/FileDropzone.tsx (drag & drop)
- [ ] **DOC-UI-003** [3h] Create components/documents/DocumentTable.tsx
- [ ] **DOC-UI-004** [2h] Create components/documents/CompletenessChart.tsx

**Dependencies:** DOC-001, DOC-006 | **Estimated:** 14h | **Priority:** P0

### E. ANALYSIS ORCHESTRATION (Week 2: Feb 17-23)

#### E.1 N8N Client
- [ ] **N8N-001** [3h] Create lib/n8n/client.ts (HTTP client with X-License-Key header)
- [ ] **N8N-002** [2h] Implement timeout + retry logic
- [ ] **N8N-003** [2h] Define N8N request/response types

**Dependencies:** None | **Estimated:** 7h | **Priority:** P0

#### E.2 Analysis Launch
- [ ] **ANL-001** [6h] Create POST /api/missions/[id]/analysis route
  - Validate mission has required documents
  - Generate signed URLs for all documents
  - POST to N8N /missions/analyze with signed URLs
  - Store analysis_id in mission
  - Update mission.status = 'analyzing'
  - Insert trace (analysis_started)
- [ ] **ANL-002** [2h] Implement error handling (upload_failed status)
- [ ] **ANL-003** [2h] Define analysis types in types/analysis.ts

**Dependencies:** N8N-001, DOC-002 | **Estimated:** 10h | **Priority:** P0

#### E.3 Analysis Status Polling
- [ ] **ANL-004** [5h] Create GET /api/missions/[id]/analysis/status route
  - Relay to N8N GET /missions/analyze/{id}/status
  - Parse progress (step, percent, message)
  - When completed: trigger results import
  - Handle errors (analysis_failed status)
- [ ] **ANL-005** [3h] Implement polling logic with exponential backoff
- [ ] **ANL-006** [2h] Add timeout handling (10min max)

**Dependencies:** ANL-001 | **Estimated:** 10h | **Priority:** P0

#### E.4 Results Import
- [ ] **ANL-007** [8h] Create lib/services/results-importer.ts
  - Fetch from N8N GET /missions/analyze/{id}/results
  - Parse payload (ecritures, rapprochements, signals, completeness, deliverables, traces)
  - Batch insert into Supabase tables
  - Upload deliverable files to Storage
  - Update mission.status = 'analyzed'
- [ ] **ANL-008** [3h] Create GET /api/missions/[id]/analysis/results route
- [ ] **ANL-009** [2h] Implement transaction rollback on import failure
- [ ] **ANL-010** [2h] Add TTL check (48h expiry handling)

**Dependencies:** ANL-004 | **Estimated:** 15h | **Priority:** P0

#### E.5 Analysis Progress UI
- [ ] **ANL-UI-001** [5h] Create (app)/missions/[id]/analysis/page.tsx
  - Progress bar with 6 steps
  - Current step indicator
  - Estimated time remaining
  - Error state with "Retry" button
- [ ] **ANL-UI-002** [3h] Create components/analysis/ProgressBar.tsx
- [ ] **ANL-UI-003** [3h] Implement SWR polling hook (4s interval)
- [ ] **ANL-UI-004** [2h] Add success redirect to signals page

**Dependencies:** ANL-004, ANL-007 | **Estimated:** 13h | **Priority:** P0

### F. SIGNAL DETECTION RULES (Week 2: Feb 17-23)

#### F.1 Signal Rules Catalog
- [ ] **SIG-001** [4h] Create lib/config/signal-rules.ts
  - Define all rules: DOC-*, SCA-*, CUT-*, PTG-*
  - Map rule ID → type, description, priority, NEP reference
  - Map scenarios → applicable rules
- [ ] **SIG-002** [2h] Create signal type definitions in types/signal.ts

**Dependencies:** None | **Estimated:** 6h | **Priority:** P0

### G. SIGNAL REVIEW & DECISIONS (Week 2-3: Feb 17-28)

#### G.1 Signals API
- [ ] **SIG-API-001** [4h] Create GET /api/missions/[id]/signals route
  - Support filters: priority, type, decision status
  - Pagination (page, limit)
  - Join with documents, ecritures, rapprochements
- [ ] **SIG-API-002** [4h] Create GET /api/missions/[id]/signals/[signalId] route
  - Return signal with full explicability
  - Include source document metadata
  - Include related FEC entry
- [ ] **SIG-API-003** [5h] Create PUT /api/missions/[id]/signals/[signalId] route
  - Update human_decision (validated/rejected/to_investigate)
  - Update human_comment (mandatory if rejected)
  - Set decided_at timestamp
  - Insert trace entry
- [ ] **SIG-API-004** [3h] Create GET /api/missions/[id]/signals/stats route
  - Count by priority (high/medium/low)
  - Count by decision (pending/validated/rejected/to_investigate)

**Dependencies:** SUP-002, SIG-001 | **Estimated:** 16h | **Priority:** P0

#### G.2 Signals List UI
- [ ] **SIG-UI-001** [5h] Create (app)/missions/[id]/signals/page.tsx
  - Signals table with filters
  - Priority badges (red/yellow/gray)
  - Decision status badges
  - Stats summary panel
  - Mandatory disclaimer visible
- [ ] **SIG-UI-002** [4h] Create components/signals/SignalTable.tsx
- [ ] **SIG-UI-003** [2h] Create components/signals/PriorityBadge.tsx
- [ ] **SIG-UI-004** [3h] Add filter dropdowns (priority, type, decision)

**Dependencies:** SIG-API-001, SIG-API-004 | **Estimated:** 14h | **Priority:** P0

#### G.3 Signal Detail & Decision UI
- [ ] **SIG-UI-005** [6h] Create (app)/missions/[id]/signals/[signalId]/page.tsx
  - Signal description + rule triggered
  - Explicability section (reasoning, compared docs, rule source)
  - Source document viewer (react-pdf)
  - FEC entry details
  - Decision buttons + comment field
  - Mandatory disclaimer
- [ ] **SIG-UI-006** [4h] Create components/signals/SignalDetail.tsx
- [ ] **SIG-UI-007** [3h] Create components/signals/DecisionButtons.tsx
- [ ] **SIG-UI-008** [4h] Integrate react-pdf viewer for source documents
- [ ] **SIG-UI-009** [2h] Implement comment validation (mandatory if rejected)

**Dependencies:** SIG-API-002, SIG-API-003 | **Estimated:** 19h | **Priority:** P0

### H. DELIVERABLES GENERATION (Week 3: Feb 24-28)

#### H.1 Initial Generation (N8N)
- [ ] **DELIV-001** [2h] Define deliverable types in types/deliverable.ts
- [ ] **DELIV-002** [3h] Verify N8N workflow WF-06 generates all 4 deliverables
- [ ] **DELIV-003** [2h] Test deliverable base64 decoding + storage

**Dependencies:** ANL-007 | **Estimated:** 7h | **Priority:** P0

#### H.2 Server-Side Regeneration
- [ ] **DELIV-004** [6h] Create lib/services/deliverable-generator.ts
  - Template engine for each deliverable type
  - Fetch data from Supabase (signals, traces, completeness, profile)
  - Generate PDF (pdfmake) and XLSX (exceljs)
- [ ] **DELIV-005** [4h] Implement checklist generation (PDF)
  - Template from ANNEXES H.1
  - Include CAC identity + date
- [ ] **DELIV-006** [5h] Implement signals table generation (XLSX)
  - Template from ANNEXES H.2
  - Include decision + comment columns
  - Two sheets: Signals + Summary
- [ ] **DELIV-007** [6h] Implement synthesis generation (PDF)
  - Template from ANNEXES H.3
  - Sections: scope, findings, decisions, limits, validation
  - NEP 230 compliant language
- [ ] **DELIV-008** [5h] Implement trace journal generation (PDF)
  - Template from ANNEXES H.4
  - Chronological table with all traces
  - Actor names include CAC identity

**Dependencies:** DELIV-001 | **Estimated:** 26h | **Priority:** P0

#### H.3 Deliverables API
- [ ] **DELIV-API-001** [3h] Create GET /api/missions/[id]/deliverables route
  - List all deliverables for mission
  - Include metadata (type, format, generated_at, storage_path)
- [ ] **DELIV-API-002** [4h] Create GET /api/missions/[id]/deliverables/[delivId] route
  - Stream file from Supabase Storage
  - Set Content-Type and Content-Disposition headers
- [ ] **DELIV-API-003** [5h] Create POST /api/missions/[id]/deliverables/regenerate route
  - Call deliverable-generator for specified types (or all)
  - Upload regenerated files to Storage
  - Update deliverables table
  - Insert trace (deliverables_regenerated)

**Dependencies:** DELIV-004 to DELIV-008 | **Estimated:** 12h | **Priority:** P0

#### H.4 Deliverables UI
- [ ] **DELIV-UI-001** [5h] Create (app)/missions/[id]/deliverables/page.tsx
  - Card for each deliverable type
  - Preview + Download buttons
  - "Regenerate all" button
  - Show generation timestamp
  - Mandatory disclaimer
- [ ] **DELIV-UI-002** [3h] Create components/deliverables/DeliverableCard.tsx
- [ ] **DELIV-UI-003** [2h] Create components/deliverables/ExportButton.tsx
- [ ] **DELIV-UI-004** [2h] Implement download triggers (browser download)

**Dependencies:** DELIV-API-001, DELIV-API-003 | **Estimated:** 12h | **Priority:** P0

### I. TRACEABILITY JOURNAL (Week 3: Feb 24-28)

#### I.1 Trace Recording
- [ ] **TRACE-001** [3h] Create trace helper functions in lib/services/
  - insertTrace(mission_id, actor, action, details)
  - Get actor_name from profile or 'Sof'IA'
- [ ] **TRACE-002** [4h] Add trace insertions to all API routes
  - mission_created, document_added, analysis_started, etc.
  - signal_validated, signal_rejected, signal_to_investigate
  - deliverables_generated, deliverables_regenerated

**Dependencies:** SUP-002 | **Estimated:** 7h | **Priority:** P0

#### I.2 Trace Display
- [ ] **TRACE-003** [4h] Create GET /api/missions/[id]/traces route
  - Query traces table ordered by timestamp DESC
  - Support limit parameter
- [ ] **TRACE-004** [5h] Create (app)/missions/[id]/traces/page.tsx
  - Chronological timeline view
  - Color-code by actor (Sofia vs CAC)
  - Show timestamp, actor, action, details
- [ ] **TRACE-005** [3h] Create components/trace/TraceTimeline.tsx

**Dependencies:** TRACE-001 | **Estimated:** 12h | **Priority:** P0

### J. LAYOUT & NAVIGATION (Week 1-3: Throughout)

#### J.1 Main Layout
- [ ] **LAY-001** [4h] Create (app)/(app)/layout.tsx
  - Header with logo + mission name + CAC name
  - Sidebar with mission navigation
  - Footer with version
- [ ] **LAY-002** [3h] Create components/layout/Header.tsx
- [ ] **LAY-003** [4h] Create components/layout/Sidebar.tsx
  - Mission tree: Docs, Signals, Deliverables, Traces
  - "New Mission" button
  - Settings link
- [ ] **LAY-004** [2h] Create components/layout/Footer.tsx

**Dependencies:** None | **Estimated:** 13h | **Priority:** P1

#### J.2 Common Components
- [ ] **LAY-005** [2h] Create components/common/SofiaDisclaimer.tsx (mandatory)
- [ ] **LAY-006** [2h] Create components/common/LoadingSpinner.tsx
- [ ] **LAY-007** [2h] Setup Lucide React icons
- [ ] **LAY-008** [3h] Configure Tailwind theme (colors, typography)

**Dependencies:** None | **Estimated:** 9h | **Priority:** P1

### K. SAMPLE DATA CREATION (Buffer: Mar 1-2)

#### K.1 Sondage CA Dataset
- [ ] **DATA-001** [4h] Create FEC_demo.txt (50 entries, journal VE)
  - Follow DGFiP tab-delimited format
  - Date range: Oct 2025 - Jan 2026
- [ ] **DATA-002** [6h] Generate 8 sales invoices (PDF)
  - FA-2025-001 to FA-2025-008
  - Realistic format with amounts matching FEC
- [ ] **DATA-003** [4h] Generate 6 delivery notes (PDF)
  - BL-2025-001 to BL-2025-006
  - Intentional gaps for signals (2 missing BL)
  - One BL dated after year-end (temporal signal)
- [ ] **DATA-004** [2h] Verify expected signals will be detected

**Dependencies:** None | **Estimated:** 16h | **Priority:** P0

#### K.2 Cutoff Dataset
- [ ] **DATA-005** [3h] Create FEC_demo.txt for cutoff (30 entries around Dec 31)
- [ ] **DATA-006** [4h] Generate 5 sales invoices + 3 supplier invoices (PDF)
- [ ] **DATA-007** [3h] Generate 5 delivery/reception notes (PDF)
  - Include temporal mismatches (invoice before, delivery after)
- [ ] **DATA-008** [2h] Verify cutoff signals will be detected

**Dependencies:** None | **Estimated:** 12h | **Priority:** P0

#### K.3 Pointage Dataset
- [ ] **DATA-009** [4h] Generate balance sheet (PDF, ~15 line items)
- [ ] **DATA-010** [3h] Generate P&L (PDF, ~10 line items)
- [ ] **DATA-011** [5h] Generate notes/annexe (PDF with notes)
  - Include intentional discrepancies with balance sheet
  - Missing mandatory disclosures
- [ ] **DATA-012** [2h] Verify pointage signals will be detected

**Dependencies:** None | **Estimated:** 14h | **Priority:** P0

### L. TESTING & POLISH (Buffer: Mar 1-2)

#### L.1 End-to-End Testing
- [ ] **TEST-001** [4h] Test complete flow with sondage_ca dataset
  - License activation → profile setup → mission creation → document upload → analysis → signal review → deliverables
- [ ] **TEST-002** [4h] Test complete flow with cutoff dataset
- [ ] **TEST-003** [4h] Test complete flow with pointage dataset
- [ ] **TEST-004** [3h] Test error scenarios (upload fail, N8N timeout, TTL expiry)
- [ ] **TEST-005** [2h] Test decision flow (validate/reject/investigate)
- [ ] **TEST-006** [2h] Verify all disclaimers visible on analysis screens
- [ ] **TEST-007** [2h] Verify forbidden vocabulary not present
- [ ] **TEST-008** [2h] Verify all deliverables include CAC identity
- [ ] **TEST-009** [2h] Verify audit trail completeness

**Dependencies:** All above | **Estimated:** 25h | **Priority:** P0

#### L.2 UI Polish
- [ ] **POL-001** [3h] Review and refine typography, spacing, colors
- [ ] **POL-002** [2h] Add loading states to all async operations
- [ ] **POL-003** [2h] Add error states to all forms
- [ ] **POL-004** [2h] Ensure responsive design (desktop focus, but mobile-friendly)
- [ ] **POL-005** [2h] Review and improve button copy, labels, help text

**Dependencies:** All UI tasks | **Estimated:** 11h | **Priority:** P1

### M. DEPLOYMENT (Buffer: Mar 1-2)

#### M.1 Vercel Deployment
- [ ] **DEPLOY-001** [2h] Connect GitHub repo to Vercel
- [ ] **DEPLOY-002** [2h] Configure environment variables in Vercel dashboard
- [ ] **DEPLOY-003** [1h] Configure custom domain (optional)
- [ ] **DEPLOY-004** [2h] Test production build
- [ ] **DEPLOY-005** [2h] Verify N8N connectivity from Vercel
- [ ] **DEPLOY-006** [2h] Verify Supabase connectivity from Vercel
- [ ] **DEPLOY-007** [1h] Test with all 3 test license keys

**Dependencies:** TEST-001 to TEST-009 | **Estimated:** 12h | **Priority:** P0

#### M.2 Documentation
- [ ] **DOC-DOC-001** [2h] Create README.md with access instructions
- [ ] **DOC-DOC-002** [1h] Document test license keys and credentials
- [ ] **DOC-DOC-003** [1h] Create deployment checklist
- [ ] **DOC-DOC-004** [1h] Document known limitations

**Dependencies:** DEPLOY-004 | **Estimated:** 5h | **Priority:** P1

---

## IV. DEPENDENCIES GRAPH

### Critical Path (Must-Have for March 2)
```
SETUP → Supabase → Auth → License/Profile → Missions → Documents
                                                            ↓
                              N8N Client ← Analysis Launch → Upload
                                    ↓                         ↓
                            Status Polling → Results Import → Storage
                                                ↓
                                         Signals API ← Rules Config
                                                ↓
                                         Signals UI → Decision Flow
                                                ↓
                                    Deliverables Generator
                                                ↓
                                    Deliverables API/UI
                                                ↓
                                         Trace Recording
                                                ↓
                                         Sample Data → E2E Testing → Deployment
```

### Parallel Workstreams
1. **Stream A (Infrastructure):** SETUP → Supabase → Auth → N8N Client
2. **Stream B (Core Features):** License → Profile → Missions → Documents → Analysis
3. **Stream C (Review Features):** Signals Rules → Signals API/UI → Decisions
4. **Stream D (Output):** Deliverables Generator → Deliverables API/UI → Traces
5. **Stream E (Data & Testing):** Sample Data → Testing → Deployment

---

## V. PRIORITIES & MUST-HAVES

### P0 - CRITICAL (Must Complete for POC Validation)
All tasks marked P0 above. These implement the 10 POC user stories.

**Total P0 Effort:** ~380 hours

### P1 - IMPORTANT (Quality & UX)
- Layout & Navigation (LAY-*)
- UI Polish (POL-*)
- Documentation (DOC-DOC-*)

**Total P1 Effort:** ~28 hours

### P2 - NICE-TO-HAVE (Post-March 2)
- Advanced filtering on signals
- Bulk decision operations
- Export customization options
- Multi-language support
- Advanced analytics dashboard

---

## VI. RISK REGISTER

| Risk | Impact | Probability | Mitigation | Owner |
|---|---|---|---|---|
| N8N integration delays | High | Medium | Mock N8N responses for parallel development. Test N8N webhooks early. | Backend Dev |
| Sample data quality issues | High | Medium | Start data creation early (Week 2). Test with N8N as soon as WF-02 available. | Data Team |
| Deliverable generation complexity | High | Low | Use proven libraries (pdfmake, exceljs). Start with simplest template (checklist). | Backend Dev |
| Supabase RLS configuration errors | Medium | Medium | Test license isolation early. Use test license keys from seed.sql. | Backend Dev |
| Tight deadline (March 2) | High | Medium | Aggressive parallelization. Daily standups. Cut P1/P2 features if needed. | Team Lead |
| Ethical boundary violations in UI | High | Low | Code review checklist: forbidden vocab, mandatory disclaimer, decision UI. | Frontend Dev |

---

## VII. TEAM ALLOCATION RECOMMENDATION

### Recommended Team Structure (3-4 developers)

**Developer 1 (Backend Lead):**
- Infrastructure setup (SETUP-*, SUP-*, AUTH-*)
- N8N integration (N8N-*, ANL-*)
- Results import (ANL-007, ANL-008)
- API routes (MIS-*, DOC-*, SIG-API-*, DELIV-API-*, TRACE-*)

**Developer 2 (Frontend Lead):**
- UI components (LAY-*, all *-UI-* tasks)
- React hooks & state management
- PDF viewer integration
- File upload/drag-drop

**Developer 3 (Full-Stack):**
- Deliverables generation (DELIV-004 to DELIV-008)
- Signal rules catalog (SIG-001)
- Expected documents config (DOC-005)
- Sample data creation (DATA-*)

**Developer 4 (QA/DevOps - Optional):**
- Testing (TEST-*)
- Deployment (DEPLOY-*)
- Documentation (DOC-DOC-*)
- Sample data validation

---

## VIII. WEEK-BY-WEEK BREAKDOWN

### Week 1: February 14-16 (3 days)
**Goal:** Foundation + License/Profile + Missions + Documents
- **Day 1:** SETUP, Supabase setup, Auth middleware
- **Day 2:** License activation, Profile setup, Mission CRUD
- **Day 3:** Document upload, Completeness, Document UI

**Deliverables by EOW1:**
- ✅ License activation works
- ✅ Profile can be created/edited
- ✅ Missions can be created with scenarios
- ✅ Documents can be uploaded to Supabase Storage
- ✅ Completeness % displays correctly

### Week 2: February 17-23 (7 days)
**Goal:** Analysis Flow + Signals
- **Day 4-5:** N8N client, Analysis launch, Status polling
- **Day 6-7:** Results import, Analysis progress UI
- **Day 8-9:** Signal rules, Signals API, Signals list UI
- **Day 10:** Signal detail UI, Decision flow

**Deliverables by EOW2:**
- ✅ Analysis can be launched and polls N8N
- ✅ Results import to Supabase successfully
- ✅ Signals display in list with filters
- ✅ Signal detail shows explicability
- ✅ Decisions can be recorded

### Week 3: February 24-28 (5 days)
**Goal:** Deliverables + Traces + Polish
- **Day 11-12:** Deliverables generator (all 4 types)
- **Day 13:** Deliverables API/UI, Regeneration
- **Day 14:** Trace recording, Trace display
- **Day 15:** UI polish, Testing prep

**Deliverables by EOW3:**
- ✅ All 4 deliverables generate correctly
- ✅ Deliverables regenerate after CAC decisions
- ✅ Audit trail displays all actions
- ✅ UI is polished and professional

### Buffer: March 1-2 (2 days)
**Goal:** Sample Data + E2E Testing + Deployment
- **Day 16:** Finalize all 3 sample datasets
- **Day 17:** E2E testing, bug fixes, Vercel deployment

**Final Deliverables:**
- ✅ POC deployed to Vercel
- ✅ All 3 scenarios testable with sample data
- ✅ All 10 POC user stories validated
- ✅ Documentation complete

---

## IX. VALIDATION CHECKLIST

### Before Final Submission (March 2 Midnight)

#### Functional Completeness
- [ ] All 10 POC user stories implemented (POC-01 to POC-10)
- [ ] All 3 scenarios work (sondage_ca, cutoff, pointage)
- [ ] All 4 deliverables generate correctly
- [ ] Human validation flow complete (validate/reject/investigate)
- [ ] Audit trail shows all actions chronologically

#### Ethical Compliance
- [ ] No forbidden vocabulary (anomalie, significatif, fraude, conclusion)
- [ ] Mandatory disclaimer on all analysis screens
- [ ] All signals have complete explicability
- [ ] Human decision is mandatory (no auto-dismissal)
- [ ] CAC identity in all deliverables

#### Technical Quality
- [ ] No N8N calls from browser (only API routes)
- [ ] License filtering on all Supabase queries
- [ ] Error states have retry buttons
- [ ] Session cookies are httpOnly, secure
- [ ] RLS policies enforce license isolation

#### Data & Testing
- [ ] Test license keys work (DEMO-SOFI-2026-0001, 0002, JURY)
- [ ] All 3 sample datasets present in data/ folder
- [ ] Expected signals detected for each scenario
- [ ] E2E tests pass for all 3 scenarios
- [ ] Deliverables integrate into CAC file without rework

#### Deployment
- [ ] Vercel deployment successful
- [ ] Environment variables configured
- [ ] N8N connectivity verified
- [ ] Supabase connectivity verified
- [ ] README with access instructions

#### 3-Minute Test
- [ ] **Q1:** Do I understand what Sof'IA does? → YES
- [ ] **Q2:** Do I see what deliverables the CAC gets? → YES
- [ ] **Q3:** Do I see where human validates and remains in control? → YES

---

## X. SUCCESS METRICS

### POC Validation Criteria
1. **Comprehension:** Jury understands positioning in <3 minutes
2. **Deliverables:** All 4 deliverables are professional and non-generic
3. **Human Control:** Validation UI is clear and mandatory
4. **Explicability:** Every signal traces back to source with reasoning
5. **Traceability:** Audit trail is complete and immutable

### Technical Success
- All API routes return data in <2s (excluding N8N analysis)
- Analysis completes in <5 minutes for sample datasets
- Zero security vulnerabilities (license isolation, RLS, httpOnly cookies)
- Zero ethical violations (no forbidden vocabulary, mandatory disclaimers)

### User Experience Success
- License activation flow takes <1 minute
- Document upload supports drag-drop
- Signal review is intuitive (filters, priority badges)
- Deliverables download with one click
- Error messages are actionable

---

## XI. REFERENCE DOCUMENTS

### Architecture Documents (Single Source of Truth)
1. **CONTEXTE_PROJET_SOFIA.md** - Business context, ethical framework, use cases
2. **ARCHITECTURE_POC_SOFIA.md** - System architecture, data models, workflows
3. **ARCHITECTURE_POC_SOFIA_ANNEXES.md** - SQL schema, API specs, UI specs, sample data

### Key Configuration Files
- **lib/config/expected-documents.ts** - Document requirements per scenario
- **lib/config/signal-rules.ts** - Detection rules catalog (DOC-*, SCA-*, CUT-*, PTG-*)
- **supabase/migrations/001_initial.sql** - Complete database schema
- **supabase/seed.sql** - Test license keys

### UI Mockups
- See ARCHITECTURE_POC_SOFIA_ANNEXES.md Section F for screen-by-screen specs

### Template References
- See ARCHITECTURE_POC_SOFIA_ANNEXES.md Section H for deliverable templates

---

## XII. COMMUNICATION PLAN

### Daily Standups (15 min)
- What I completed yesterday
- What I'm working on today
- Blockers (N8N, Supabase, etc.)
- Risk escalation

### Weekly Milestones
- **End of Week 1:** Demo license → profile → mission → documents
- **End of Week 2:** Demo full analysis flow → signals → decisions
- **End of Week 3:** Demo all deliverables → audit trail
- **March 2 EOD:** Final submission

### Escalation Path
- **Technical blocker >4h:** Escalate to team lead
- **N8N integration issues:** Contact N8N admin (agence-b.fr)
- **Ethical boundary question:** Review CONTEXTE_PROJET_SOFIA.md Section 5
- **Deadline risk:** Cut P1/P2 features, focus P0 only

---

## XIII. POST-SUBMISSION ACTIVITIES

### March 3-6: Pitch Preparation
- [ ] Review POC with team (identify demo flow)
- [ ] Draft 4-minute pitch script (5 people, see CONTEXTE Section 11)
- [ ] Create presentation slides (if projecting visuals)
- [ ] Practice pitch timing (4 min hard limit)
- [ ] Submit slides by email (Friday March 6)

### March 9: Final Pitch (4 minutes)
**No live demo allowed. POC must be self-contained.**

**Pitch Structure:**
1. **Person 1 (30s):** The CAC paradox - time spent on mechanics vs judgment
2. **Person 2 (1m):** Sof'IA solution - pre-analysis without substitution
3. **Person 3 (1m):** Three use cases - sondage_ca, cutoff, pointage
4. **Person 4 (1m):** Four deliverables - checklist, signals, synthesis, journal
5. **Person 5 (30s):** Vision - explicability, traceability, human governance

---

## APPENDIX A: GLOSSARY

**CAC:** Commissaire aux Comptes (Statutory Auditor)
**FEC:** Fichier des Écritures Comptables (Accounting Entries File, DGFiP format)
**NEP 230:** Professional standard for audit documentation
**Cut-off:** Year-end cutoff / temporal allocation verification
**Sondage CA:** Revenue sampling procedure
**Pointage:** Reconciliation / matching of accounting entries to supporting documents
**Signal documentaire:** Documentary signal (factual observation, not an anomaly)
**RLS:** Row Level Security (Supabase/PostgreSQL)
**POC:** Proof of Concept
**CNCC:** Compagnie Nationale des Commissaires aux Comptes (French statutory auditors association)

---

## APPENDIX B: QUICK COMMAND REFERENCE

```bash
# Development
npm install
npm run dev              # Start dev server (localhost:3000)
npm run type-check       # TypeScript validation
npm run build            # Production build
npm start                # Production server

# Supabase
supabase start                                  # Local Supabase
supabase db reset                               # Reset local DB
supabase db push                                # Push migrations
supabase gen types typescript --local > types.ts # Generate types

# Testing
npm run test             # Unit tests (if implemented)
npm run test:e2e         # E2E tests (if implemented)

# Deployment
vercel                   # Deploy to Vercel
vercel --prod            # Deploy to production
```

---

**END OF MASTER BACKLOG**

Total Estimated Effort: ~408 hours (P0 + P1)
Critical Path Duration: ~15 working days (with parallelization)
Team Size Recommendation: 3-4 developers
Deadline: March 2, 2026 midnight (HARD)
