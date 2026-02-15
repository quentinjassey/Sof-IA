# N8N Integration Guide — SOF'IA POC

> **Audience:** Human developer building N8N workflows to integrate with the SOF'IA Next.js webapp.
>
> **Context:** SOF'IA is an AI-powered documentary pre-analysis tool for statutory auditors (CAC). The Next.js app handles UI, auth, storage, and data persistence. N8N handles document processing, LLM-based signal detection, and initial deliverable generation.
>
> **Key Principle:** N8N is a temporary processing service. All persistent data lives in Supabase. After analysis, N8N results are imported into Supabase, and N8N can clean up.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Authentication](#2-authentication)
3. [Webhook Endpoints to Build](#3-webhook-endpoints-to-build)
4. [Data Models — Input & Output](#4-data-models--input--output)
5. [Analysis Pipeline (6 Steps)](#5-analysis-pipeline-6-steps)
6. [Signal Rules Reference](#6-signal-rules-reference)
7. [Expected Documents per Scenario](#7-expected-documents-per-scenario)
8. [LLM Prompt Guidelines](#8-llm-prompt-guidelines)
9. [Error Handling](#9-error-handling)
10. [Testing & Validation](#10-testing--validation)

---

## 1. Architecture Overview

```
┌──────────────┐     POST /analyze      ┌──────────────┐
│              │ ────────────────────►   │              │
│   Next.js    │     GET /status         │     N8N      │
│   (Vercel)   │ ────────────────────►   │  (agence-b)  │
│              │     GET /results        │              │
│              │ ────────────────────►   │              │
└──────┬───────┘                         └──────┬───────┘
       │                                        │
       │  Supabase (PostgreSQL + Storage)       │  Downloads docs
       │  ← All persistent data                 │  via signed URLs
       ▼                                        ▼
┌──────────────┐                         ┌──────────────┐
│  Supabase    │                         │  LLM API     │
│  (DB + S3)   │                         │  (Claude/    │
│              │                         │   GPT/etc.)  │
└──────────────┘                         └──────────────┘
```

**Flow:**
1. User uploads documents → Supabase Storage
2. User clicks "Lancer la pre-analyse" → Next.js generates signed URLs
3. Next.js calls N8N `POST /missions/analyze` with signed URLs
4. Next.js polls N8N `GET /missions/analyze/{id}/status` every 4 seconds
5. When done, Next.js calls `GET /missions/analyze/{id}/results`
6. Next.js imports the full payload into Supabase
7. N8N can clean up temporary data

**N8N Base URL:** `https://n8n.agence-b.fr/webhook/sofia`

---

## 2. Authentication

Every request from Next.js includes:

```
X-License-Key: DEMO-SOFI-2026-0001
```

**Your N8N workflows MUST:**
- Read the `X-License-Key` header on every webhook
- Validate it's a non-empty string
- Include it in any Supabase calls if needed
- Reject requests without a valid key (return 401)

**Test license keys:**
- `DEMO-SOFI-2026-0001` — Full access, all 3 scenarios
- `DEMO-SOFI-2026-0002` — Full access, all 3 scenarios
- `DEMO-SOFI-2026-JURY` — Jury evaluation key

---

## 3. Webhook Endpoints to Build

You need to build **4 webhook endpoints** in N8N:

### 3.1. POST /missions/analyze

**Full URL:** `https://n8n.agence-b.fr/webhook/sofia/missions/analyze`

**Purpose:** Start the asynchronous pre-analysis pipeline.

**Request Body:**
```json
{
  "mission_id": "uuid-string",
  "scenario": "sondage_ca",
  "documents": [
    {
      "id": "uuid-string",
      "type": "fec",
      "filename": "FEC_ACME_2025.txt",
      "download_url": "https://xxx.supabase.co/storage/v1/object/sign/documents/..."
    },
    {
      "id": "uuid-string",
      "type": "facture_vente",
      "filename": "FAC-2025-0847.pdf",
      "download_url": "https://xxx.supabase.co/storage/v1/object/sign/documents/..."
    }
  ],
  "options": {
    "cutoff_window_days": 10,
    "priority_threshold": "low"
  }
}
```

**Expected Response (202 Accepted):**
```json
{
  "analysis_id": "uuid-you-generate",
  "mission_id": "uuid-from-request",
  "status": "processing",
  "estimated_duration_seconds": 30
}
```

**What to do:**
1. Generate a unique `analysis_id` (UUID)
2. Store the request context (mission_id, scenario, documents) keyed by analysis_id
3. Start the async 6-step pipeline (see Section 5)
4. Return immediately with the analysis_id

---

### 3.2. GET /missions/analyze/{analysisId}/status

**Full URL:** `https://n8n.agence-b.fr/webhook/sofia/missions/analyze/{analysisId}/status`

**Purpose:** Let Next.js poll progress. Called every 4 seconds.

**Response — While Processing:**
```json
{
  "analysis_id": "uuid",
  "status": "processing",
  "progress": {
    "step": "rapprochement",
    "step_number": 3,
    "total_steps": 6,
    "percent": 50,
    "message": "Rapprochement des ecritures avec les pieces justificatives..."
  }
}
```

**Response — Completed:**
```json
{
  "analysis_id": "uuid",
  "status": "completed",
  "progress": {
    "step": "termine",
    "step_number": 6,
    "total_steps": 6,
    "percent": 100,
    "message": "Pre-analyse terminee."
  },
  "results_summary": {
    "ecritures_parsed": 9,
    "rapprochements_created": 6,
    "rapprochements_missing": 3,
    "signals_generated": 4,
    "signals_by_priority": {
      "high": 3,
      "medium": 1,
      "low": 0
    },
    "deliverables_generated": 4
  }
}
```

**Response — Failed:**
```json
{
  "analysis_id": "uuid",
  "status": "failed",
  "error": "Erreur lors du parsing du FEC : format non reconnu."
}
```

**The 6 steps and their labels:**

| step_number | step key | message (French) |
|---|---|---|
| 1 | `parsing_fec` | Analyse du fichier des ecritures comptables (FEC)... |
| 2 | `extraction_pdf` | Extraction du texte des documents PDF... |
| 3 | `rapprochement` | Rapprochement des ecritures avec les pieces justificatives... |
| 4 | `analyse_llm` | Analyse documentaire par intelligence artificielle... |
| 5 | `consolidation` | Consolidation et deduplication des signaux... |
| 6 | `generation_livrables` | Generation des livrables documentaires... |

---

### 3.3. GET /missions/analyze/{analysisId}/results

**Full URL:** `https://n8n.agence-b.fr/webhook/sofia/missions/analyze/{analysisId}/results`

**Purpose:** Return the complete analysis payload. Called once after status = "completed".

**This is the critical endpoint.** The entire payload is a single JSON response containing all data that gets imported into Supabase.

**Response (200):** See [Section 4.2](#42-results-payload-n8n--nextjs) for the full schema.

**Important:**
- This response can be large (base64-encoded files). Set timeout to 60s minimum.
- Results have a **48-hour TTL**. After that, N8N can clean up and return 410 Gone.
- Next.js will call this exactly once per successful analysis.

---

### 3.4. POST /missions/documents/upload (Optional)

**Full URL:** `https://n8n.agence-b.fr/webhook/sofia/missions/documents/upload`

**Purpose:** Pre-validate documents before analysis. This endpoint is optional — the `POST /analyze` endpoint receives the same document list with signed URLs.

**Request Body:**
```json
{
  "mission_id": "uuid",
  "scenario": "sondage_ca",
  "documents": [
    {
      "id": "uuid",
      "type": "fec",
      "filename": "FEC_ACME_2025.txt",
      "download_url": "https://signed-url..."
    }
  ]
}
```

**Response (200):**
```json
{
  "mission_id": "uuid",
  "documents_received": 3,
  "ready_for_analysis": true
}
```

---

## 4. Data Models — Input & Output

### 4.1. Document Types (Input)

The `type` field on each document tells you what kind of file it is:

| type | Description | Format |
|---|---|---|
| `fec` | Fichier des Ecritures Comptables | Tab-delimited TXT (DGFiP spec) |
| `facture_vente` | Sales invoice | PDF |
| `facture_achat` | Purchase invoice | PDF |
| `bon_livraison` | Delivery note / reception note | PDF |
| `contrat` | Contract | PDF |
| `annexe` | Notes to financial statements | PDF or TXT |
| `bilan` | Balance sheet | PDF or TXT |
| `compte_resultat` | Income statement | PDF or TXT |
| `autre` | Other document | Any |

### 4.2. Results Payload (N8N → Next.js)

This is the exact JSON structure your `GET /results` endpoint must return:

```typescript
{
  // --- Metadata ---
  "analysis_id": "uuid",
  "mission_id": "uuid",
  "completed_at": "2026-02-15T14:30:00.000Z",  // ISO 8601

  // --- 1. Document Completeness ---
  "completeness": [
    {
      "type": "fec",                    // matches document type
      "label": "Fichier des ecritures comptables (FEC)",
      "required": true,
      "status": "present",              // "present" | "missing" | "incomplete"
      "count": 1,
      "note": null                      // optional explanation
    },
    {
      "type": "bon_livraison",
      "label": "Bons de livraison",
      "required": true,
      "status": "incomplete",
      "count": 6,
      "note": "6 BL fournis pour 9 factures"
    }
  ],

  // --- 2. Parsed FEC Entries ---
  "ecritures": [
    {
      "id": "uuid-you-generate",
      "journal_code": "VE",
      "journal_lib": "Journal des ventes",
      "ecriture_num": "VE-2025-0847",
      "ecriture_date": "2025-11-15",    // YYYY-MM-DD
      "compte_num": "411000",
      "compte_lib": "Clients",
      "comp_aux_num": "CLI-DUPONT",
      "comp_aux_lib": "SA Dupont Equipements",
      "piece_ref": "FAC-2025-0847",
      "piece_date": "2025-11-15",
      "ecriture_lib": "Vente marchandises Dupont",
      "debit": 28800.00,                // NUMERIC(15,2)
      "credit": 0.00,
      "lettrage": null,
      "date_lettrage": null,
      "valid_date": "2025-11-15"
    }
  ],

  // --- 3. Entry-to-Document Matching ---
  "rapprochements": [
    {
      "id": "uuid-you-generate",
      "ecriture_id": "uuid-of-ecriture-above",
      "document_id": "uuid-of-uploaded-document-or-null",
      "match_type": "exact",            // "exact" | "partial" | "missing"
      "match_details": {
        "montant_match": true,
        "date_match": true,
        "reference_match": true,
        "details": "Facture FAC-2025-0847 correspond au BL-2025-0612"
      },
      "confidence": "high"              // "high" | "medium" | "low"
    },
    {
      "id": "uuid",
      "ecriture_id": "uuid-of-another-ecriture",
      "document_id": null,              // null = no matching document found
      "match_type": "missing",
      "match_details": {
        "montant_match": false,
        "date_match": false,
        "reference_match": false,
        "details": "Aucun bon de livraison correspondant"
      },
      "confidence": "high"
    }
  ],

  // --- 4. Documentary Signals ---
  "signals": [
    {
      "id": "uuid-you-generate",
      "document_id": "uuid-or-null",
      "ecriture_id": "uuid-or-null",
      "rapprochement_id": "uuid-or-null",
      "type": "absence_piece",
      "description": "Facture FAC-2025-0851 (SAS Moreau Industries, 35 000,00 EUR HT) sans bon de livraison associe. La facture mentionne une livraison prevue courant decembre 2025, mais aucun bon de livraison n'a ete fourni.",
      "source_document": "FAC-2025-0851",
      "source_page": 1,
      "source_extract": "Livraison et installation prevues courant decembre 2025",
      "rule_triggered": "SCA-001",
      "rule_description": "Facture de vente sans bon de livraison associe",
      "priority": "high",
      "explicability": {
        "reasoning": "La facture FAC-2025-0851 fait reference a une livraison mais aucun bon de livraison n'a ete fourni dans le dossier. L'absence de ce justificatif ne permet pas de confirmer la realite de la livraison.",
        "documents_compared": [
          {
            "document": "FAC-2025-0851",
            "element": "Mention de livraison en page 1"
          },
          {
            "document": "FEC_ACME_2025.txt",
            "element": "Ecriture VE-2025-0851, debit 35 000,00 EUR"
          }
        ],
        "rule_source": "NEP 500"
      }
    }
  ],

  // --- 5. Generated Deliverables ---
  "deliverables": [
    {
      "id": "uuid-you-generate",
      "type": "checklist_completude",
      "title": "Check-list de completude documentaire",
      "format": "pdf",
      "content_json": { },              // structured data for regeneration
      "file_base64": "JVBERi0xLjQK..."  // base64-encoded PDF content
    },
    {
      "id": "uuid",
      "type": "tableau_signaux",
      "title": "Tableau des signaux documentaires",
      "format": "xlsx",
      "content_json": { },
      "file_base64": "UEsDBBQAAAA..."   // base64-encoded XLSX
    },
    {
      "id": "uuid",
      "type": "synthese_preanalyse",
      "title": "Synthese de pre-analyse (NEP 230)",
      "format": "pdf",
      "content_json": { },
      "file_base64": "JVBERi0xLjQK..."
    },
    {
      "id": "uuid",
      "type": "journal_tracabilite",
      "title": "Journal de tracabilite",
      "format": "pdf",
      "content_json": { },
      "file_base64": "JVBERi0xLjQK..."
    }
  ],

  // --- 6. Analysis Traces ---
  "traces": [
    {
      "timestamp": "2026-02-15T14:28:00.000Z",
      "actor": "sofia",
      "action": "analysis_started",
      "details": "Pre-analyse demarree — Scenario : Sondage sur le chiffre d'affaires"
    },
    {
      "timestamp": "2026-02-15T14:28:05.000Z",
      "actor": "sofia",
      "action": "fec_parsed",
      "details": "FEC analyse : 9 ecritures extraites du journal VE"
    },
    {
      "timestamp": "2026-02-15T14:28:12.000Z",
      "actor": "sofia",
      "action": "pdf_extracted",
      "details": "8 documents PDF traites (extraction texte)"
    },
    {
      "timestamp": "2026-02-15T14:28:20.000Z",
      "actor": "sofia",
      "action": "rapprochement_completed",
      "details": "9 rapprochements realises : 6 exacts, 0 partiels, 3 absents"
    },
    {
      "timestamp": "2026-02-15T14:28:28.000Z",
      "actor": "sofia",
      "action": "signals_generated",
      "details": "4 signaux documentaires generes (3 eleves, 1 moyen, 0 faible)"
    },
    {
      "timestamp": "2026-02-15T14:28:30.000Z",
      "actor": "sofia",
      "action": "deliverables_generated",
      "details": "4 livrables generes (2 PDF, 1 XLSX, 1 PDF)"
    }
  ]
}
```

---

## 5. Analysis Pipeline (6 Steps)

Build these as sequential workflow steps in N8N:

### Step 1: Parse FEC (`parsing_fec`)

**Input:** Download the `fec` document via its signed URL.

**FEC Format (DGFiP spec):**
- Tab-delimited text file (TSV)
- First row = headers
- Encoding: UTF-8 or ISO-8859-1
- Fields: JournalCode, JournalLib, EcritureNum, EcritureDate, CompteNum, CompteLib, CompAuxNum, CompAuxLib, PieceRef, PieceDate, EcritureLib, Debit, Credit, EcritureLet, DateLet, ValidDate, etc.
- Dates: `YYYYMMDD` format (e.g., `20251215`)
- Amounts: French format with comma as decimal separator (e.g., `35000,00`) — convert to numeric

**Output:** Array of `ecritures` objects (see Section 4.2).

**Convert dates** from `YYYYMMDD` to `YYYY-MM-DD` for the output.

---

### Step 2: Extract PDF Text (`extraction_pdf`)

**Input:** Download all PDF documents via signed URLs.

**Process:**
- Extract text from each PDF (native text extraction first, OCR fallback)
- Store extracted text keyed by document ID
- Note page numbers for later reference

**Output:** Internal text store for matching and LLM analysis.

---

### Step 3: Match Entries to Documents (`rapprochement`)

**Input:** Parsed ecritures + extracted PDF text.

**Process:**
- For each ecriture, find the corresponding supporting document(s)
- Match by: `piece_ref` → document filename/content, amounts, dates
- Classify each match: `exact`, `partial`, or `missing`
- Calculate confidence level

**Output:** Array of `rapprochements` objects (see Section 4.2).

---

### Step 4: LLM Signal Detection (`analyse_llm`)

**Input:** Ecritures, rapprochements, extracted PDF text, scenario type, signal rules.

**Process:**
- Send document data to LLM (Claude, GPT, Mistral — provider-agnostic)
- Use the signal rules catalog (Section 6) to guide detection
- LLM identifies factual documentary signals
- See Section 8 for prompt guidelines

**Output:** Array of `signals` objects (see Section 4.2).

**CRITICAL RULES for signal generation:**
- Every signal MUST have `explicability` with `reasoning`, `documents_compared`, and `rule_source`
- Every signal MUST reference a specific `rule_triggered` (e.g., `SCA-001`)
- Descriptions MUST be factual observations, never conclusions
- Use required vocabulary: "signal documentaire", "constat factuel", "necessite l'attention du CAC"
- NEVER use: "anomalie", "significatif", "fraude", "conclusion d'audit"

---

### Step 5: Consolidation (`consolidation`)

**Input:** Raw signals from LLM.

**Process:**
- Deduplicate signals (same document + same rule = merge)
- Validate all required fields are present
- Assign final priority levels
- Verify signal count matches expectations per scenario (see Section 10)

**Output:** Cleaned array of `signals`.

---

### Step 6: Generate Deliverables (`generation_livrables`)

**Input:** All analysis data (completeness, ecritures, rapprochements, signals).

**Generate 4 files:**

| Type | Format | Content |
|---|---|---|
| `checklist_completude` | PDF | Table of expected vs received documents with status |
| `tableau_signaux` | XLSX | All signals with type, source, rule, priority (NO decision column — that's added by Next.js after CAC review) |
| `synthese_preanalyse` | PDF | Scope, documents analyzed, main findings, analysis limits |
| `journal_tracabilite` | PDF | Chronological log of all Sof'IA actions during analysis |

**Each deliverable MUST include:**
- The mandatory disclaimer: "Analyse automatique — a valider par le commissaire aux comptes. Sof'IA ne se substitue pas au jugement professionnel."
- No automated conclusions or opinions

**Return:** Base64-encoded file content in the `file_base64` field.

**Note:** Next.js will regenerate these deliverables after CAC decisions (adding decision columns to the XLSX, updating the synthesis). The initial versions from N8N are pre-decision drafts.

---

## 6. Signal Rules Reference

These are the rules your LLM should use to detect signals. The `rule_triggered` field in each signal must match one of these IDs.

### Common Rules (All Scenarios)

| ID | Type | Priority | Description |
|---|---|---|---|
| DOC-001 | absence_piece | high | Piece referencee dans le FEC mais non fournie dans le dossier |
| DOC-002 | incompletude | medium | Document fourni mais incomplet (pages manquantes, illisible) |
| DOC-003 | rupture_chaine | low | Document dans un format non exploitable |

### Sondage CA Rules (`sondage_ca` scenario)

| ID | Type | Priority | Description | NEP |
|---|---|---|---|---|
| SCA-001 | absence_piece | high | Facture de vente sans bon de livraison associe | NEP 500 |
| SCA-002 | incoherence_montant | high | Ecart de montant > 1% entre facture et ecriture FEC | NEP 500 |
| SCA-003 | incoherence_date | medium | Ecart > 5 jours entre date facture et date BL | NEP 500 |
| SCA-004 | rupture_chaine | high | Reference piece (PieceRef) du FEC introuvable dans les documents | NEP 500 |
| SCA-005 | rattachement_temporel | high | Vente comptabilisee en N, livraison effectuee en N+1 | NEP 500 §A14 |

### Cut-off Rules (`cutoff` scenario)

| ID | Type | Priority | Description | NEP |
|---|---|---|---|---|
| CUT-001 | rattachement_temporel | high | Facture avant cloture, livraison apres cloture | NEP 500 §A14 |
| CUT-002 | rattachement_temporel | high | Facture apres cloture, livraison/reception avant cloture | NEP 500 §A14 |
| CUT-003 | incoherence_date | medium | Ecart temporel superieur a la fenetre de cut-off | NEP 500 |
| CUT-004 | absence_piece | high | Operation sans justificatif de date de livraison/prestation | NEP 500 |
| CUT-005 | incoherence_montant | medium | Avoir emis en N+1 annulant (partiellement) une vente enregistree en N | NEP 500 |

### Pointage Rules (`pointage` scenario)

| ID | Type | Priority | Description | NEP |
|---|---|---|---|---|
| PTG-001 | incoherence_montant | high | Ecart de montant entre bilan et annexe sur un meme poste | NEP 500 |
| PTG-002 | incompletude | high | Information obligatoire absente de l'annexe (Art. L.123-13 C.Com) | NEP 500 |
| PTG-003 | incoherence_montant | high | Total actif different du total passif | NEP 500 |
| PTG-004 | incompletude | medium | Poste du bilan/CR sans note explicative dans l'annexe | NEP 500 |
| PTG-005 | rupture_chaine | medium | Variation notable d'un poste (>20%) sans explication suffisante | NEP 500 |

---

## 7. Expected Documents per Scenario

### Sondage CA (`sondage_ca`)

| Document Type | Required | Description |
|---|---|---|
| `fec` | Yes | FEC du journal de ventes |
| `facture_vente` | Yes | Factures de l'echantillon selectionne |
| `bon_livraison` | Yes | Bons de livraison associes |
| `contrat` | No | Contrats clients (si applicable) |
| `annexe` | No | Annexe aux comptes annuels |

### Cut-off (`cutoff`)

| Document Type | Required | Description |
|---|---|---|
| `fec` | Yes | FEC journaux VE + HA autour de la cloture |
| `facture_vente` | Yes | Factures de vente periode de cloture |
| `facture_achat` | Yes | Factures fournisseurs periode de cloture |
| `bon_livraison` | Yes | BL clients + bons de reception fournisseurs |
| `contrat` | No | Contrats prestations continues |

### Pointage (`pointage`)

| Document Type | Required | Description |
|---|---|---|
| `bilan` | Yes | Bilan (actif + passif) |
| `compte_resultat` | Yes | Compte de resultat |
| `annexe` | Yes | Annexe aux comptes annuels |
| `fec` | No | FEC (pour verification complementaire) |

---

## 8. LLM Prompt Guidelines

When calling the LLM for signal detection, your system prompt MUST include:

```
ROLE: You are a documentary pre-analysis assistant for a statutory auditor
(commissaire aux comptes). You identify factual documentary signals.
You NEVER qualify an anomaly, NEVER conclude, NEVER recommend.

ABSOLUTE RULES:
- Never make audit conclusions
- Never qualify as "significant" or "not significant"
- Never recommend an opinion
- All signals are objective documentary observations
- Always cite exact source (document, page, extract)
- Use "signal documentaire" (never "anomalie")
- Use "constat factuel" (never "conclusion")
- Use "necessite l'attention du CAC" (never "significatif")

OUTPUT FORMAT: Return a JSON array of signals. Each signal must include:
- type: one of [absence_piece, incoherence_date, incoherence_montant,
        rupture_chaine, rattachement_temporel, incompletude]
- description: factual observation in French
- rule_triggered: matching rule ID (SCA-001, CUT-002, PTG-005, etc.)
- priority: high | medium | low
- source_document: document reference
- source_page: page number (integer)
- source_extract: exact quote from source document
- explicability.reasoning: why this signal was triggered (factual)
- explicability.documents_compared: which documents were analyzed
- explicability.rule_source: NEP reference (e.g., "NEP 500, §A14")
```

**Provider-agnostic:** Use Claude, GPT, Mistral, or any other LLM. The prompt above works with all providers.

---

## 9. Error Handling

### Error Response Format

All error responses should use this format:

```json
{
  "error": "Human-readable error message in French",
  "code": "ERROR_CODE",
  "details": "Technical details (optional)"
}
```

### Error Codes

| Code | HTTP Status | Meaning |
|---|---|---|
| `INVALID_LICENSE` | 401 | License key missing or invalid |
| `ANALYSIS_NOT_FOUND` | 404 | analysis_id not found |
| `RESULTS_EXPIRED` | 410 | Results TTL (48h) exceeded |
| `FEC_PARSE_ERROR` | 422 | FEC file format unreadable |
| `PDF_EXTRACT_ERROR` | 422 | PDF text extraction failed |
| `LLM_ERROR` | 502 | LLM API call failed |
| `INTERNAL_ERROR` | 500 | Unexpected N8N error |

### TTL & Cleanup

- Analysis results MUST be available for **48 hours** after completion
- After 48h, return `410 Gone` with code `RESULTS_EXPIRED`
- N8N can clean up temporary files after 48h
- Downloaded documents (from signed URLs) can be deleted after analysis completes

---

## 10. Testing & Validation

### Expected Signals per Scenario

Use these to validate your pipeline produces correct results:

**Sondage CA — 4 signals expected:**

| Signal | Rule | Type | Priority | Source |
|---|---|---|---|---|
| S1 | SCA-001 | absence_piece | high | FAC-2025-0851 (35 000 EUR, no BL) |
| S2 | SCA-001 | absence_piece | high | FAC-2025-0854 (18 000 EUR, no BL) |
| S3 | SCA-002 | incoherence_montant | high | FAC-2025-0852 vs BL-2025-0616 (750 EUR gap, 6%) |
| S4 | SCA-005 | rattachement_temporel | high | FAC-2025-0855 (30/12/2025) vs BL-2025-0617 (03/01/2026) |

**Cut-off — 4 signals expected:**

| Signal | Rule | Type | Priority | Source |
|---|---|---|---|---|
| S1 | CUT-001 | rattachement_temporel | high | FAC-2025-1182 (29/12) vs BL-2025-0782 (05/01) — 44 000 EUR |
| S2 | CUT-002 | rattachement_temporel | high | FRN-2025-0489 (02/01) vs BR-2025-0345 (28/12) — 7 800 EUR |
| S3 | CUT-004 | absence_piece | high | FAC-2025-1183 (service, no proof of completion) — 16 000 EUR |
| S4 | CUT-005 | incoherence_montant | medium | AV-2026-0001 cancels part of FAC-2025-1181 — 6 000 EUR |

**Pointage — 3 signals expected:**

| Signal | Rule | Type | Priority | Source |
|---|---|---|---|---|
| S1 | PTG-001 | incoherence_montant | high | Bilan immo 996k vs Annexe Note 3 981k (15 000 EUR gap) |
| S2 | PTG-002 | incompletude | medium | Missing off-balance-sheet commitments in annexe |
| S3 | PTG-005 | rupture_chaine | medium | +82.7% variation "Autres charges externes" (40k unexplained) |

### Test Data

Sample data files are in the `data/` folder of the repository:
- `data/sondage_ca/` — FEC + 8 invoices + 6 delivery notes
- `data/cutoff/` — FEC + invoices around Dec 31 + delivery/reception notes
- `data/pointage/` — Balance sheet + P&L + Notes (annexe)

**Fictional company:** ACME Distribution SAS — Year ended 2025-12-31

### Validation Checklist

Before considering your N8N integration complete, verify:

- [ ] All 4 webhooks respond correctly
- [ ] FEC parsing handles tab-delimited format with French number formatting
- [ ] PDF text extraction works on all sample documents
- [ ] Entry-to-document matching identifies exact/partial/missing correctly
- [ ] LLM generates signals using required vocabulary (no forbidden words)
- [ ] Signal count matches expected (4 + 4 + 3 = 11 across all scenarios)
- [ ] Every signal has complete explicability (reasoning + documents + rule)
- [ ] All 4 deliverables generate as valid PDF/XLSX
- [ ] Deliverables include the mandatory disclaimer
- [ ] Status endpoint returns progress for all 6 steps
- [ ] Results endpoint returns complete payload with all sections
- [ ] Results available for 48 hours after completion
- [ ] Error responses use the correct format and French messages
- [ ] `X-License-Key` header is validated on every request
