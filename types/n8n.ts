// =============================================================================
// SOF'IA — N8N Webhook Payload Type Definitions
// Matches N8N API contracts from ARCHITECTURE_POC_SOFIA.md Sections 4 & 6
// =============================================================================

import type {
  ScenarioType,
  SignalType,
  SignalPriority,
  MatchType,
  ConfidenceLevel,
  DocumentStatus,
  DeliverableType,
  DeliverableFormat,
  ActorType,
  SignalExplicability,
  MatchDetails,
} from './database';

// -----------------------------------------------------------------------------
// Common N8N Types
// -----------------------------------------------------------------------------

/** A document reference sent to N8N with a signed download URL */
export interface N8NDocumentRef {
  id: string;
  type: string;
  filename: string;
  download_url: string;
}

/** Analysis options passed to N8N */
export interface N8NAnalysisOptions {
  /** Number of days around closing date to check for cutoff signals (default: 10) */
  cutoff_window_days?: number;
  /** Minimum priority threshold for signal detection */
  priority_threshold?: SignalPriority;
}

// -----------------------------------------------------------------------------
// N8N Request Types (sent TO N8N)
// -----------------------------------------------------------------------------

/**
 * POST /missions/documents/upload — Upload documents to N8N
 * Documents are already in Supabase Storage; N8N downloads via signed URLs.
 */
export interface N8NDocumentUploadRequest {
  mission_id: string;
  scenario: ScenarioType;
  documents: N8NDocumentRef[];
}

/**
 * POST /missions/analyze — Start the pre-analysis
 * Main entry point for triggering WF-02 (complete pre-analysis workflow).
 */
export interface N8NAnalysisRequest {
  mission_id: string;
  scenario: ScenarioType;
  documents: N8NDocumentRef[];
  options?: N8NAnalysisOptions;
}

// -----------------------------------------------------------------------------
// N8N Response Types (received FROM N8N)
// -----------------------------------------------------------------------------

/** POST /missions/documents/upload — Response */
export interface N8NDocumentUploadResponse {
  mission_id: string;
  documents_received: number;
  ready_for_analysis: boolean;
}

/** POST /missions/analyze — Response (202 Accepted) */
export interface N8NAnalysisStartResponse {
  analysis_id: string;
  mission_id: string;
  status: 'processing';
  estimated_duration_seconds: number;
}

// -----------------------------------------------------------------------------
// N8N Analysis Status Types
// -----------------------------------------------------------------------------

/** Analysis step names (WF-02 pipeline) */
export type N8NAnalysisStep =
  | 'parsing_fec'
  | 'extraction_pdf'
  | 'rapprochement'
  | 'analyse_llm'
  | 'consolidation'
  | 'generation_livrables';

/** N8N processing status values */
export type N8NProcessingStatus = 'processing' | 'completed' | 'failed';

/** Analysis progress details */
export interface N8NAnalysisProgress {
  step: N8NAnalysisStep | string;
  step_number: number;
  total_steps: number;
  percent: number;
  message: string;
}

/** Results summary returned when analysis completes */
export interface N8NResultsSummary {
  ecritures_parsed: number;
  rapprochements_created: number;
  rapprochements_missing: number;
  signals_generated: number;
  signals_by_priority: Record<SignalPriority, number>;
  deliverables_generated: number;
}

/**
 * GET /missions/analyze/{analysis_id}/status — Response
 * Returned during polling to track analysis progress.
 */
export interface N8NAnalysisStatus {
  analysis_id: string;
  status: N8NProcessingStatus;
  progress: N8NAnalysisProgress;
  /** Present only when status is 'completed' */
  results_summary?: N8NResultsSummary;
  /** Present only when status is 'failed' */
  error?: string;
}

// -----------------------------------------------------------------------------
// N8N Analysis Results Types (the full payload)
// -----------------------------------------------------------------------------

/** Completeness entry in the N8N results payload */
export interface N8NCompletenessEntry {
  type: string;
  label: string;
  required: boolean;
  status: DocumentStatus;
  count: number;
  note?: string;
}

/** Parsed FEC entry in the N8N results payload */
export interface N8NEcriture {
  id: string;
  journal_code: string | null;
  journal_lib: string | null;
  ecriture_num: string | null;
  ecriture_date: string | null;
  compte_num: string | null;
  compte_lib: string | null;
  comp_aux_num: string | null;
  comp_aux_lib: string | null;
  piece_ref: string | null;
  piece_date: string | null;
  ecriture_lib: string | null;
  debit: number;
  credit: number;
  lettrage: string | null;
  date_lettrage: string | null;
  valid_date: string | null;
}

/** Rapprochement entry in the N8N results payload */
export interface N8NRapprochement {
  id: string;
  ecriture_id: string;
  document_id: string | null;
  match_type: MatchType;
  match_details: MatchDetails | null;
  confidence: ConfidenceLevel | null;
}

/**
 * Signal as returned by N8N (from LLM output + deterministic detection).
 * This is the raw signal before being stored in Supabase.
 */
export interface N8NSignal {
  id: string;
  document_id: string | null;
  ecriture_id: string | null;
  rapprochement_id: string | null;
  type: SignalType;
  description: string;
  source_document: string | null;
  source_page: number | null;
  source_extract: string | null;
  rule_triggered: string | null;
  rule_description: string | null;
  priority: SignalPriority;
  explicability: SignalExplicability | null;
}

/** Raw LLM signal output (before consolidation in WF-02 step 5) */
export interface N8NLLMSignalOutput {
  type: SignalType;
  description: string;
  source_document: string;
  source_page: number | null;
  source_extract: string;
  rule_triggered: string;
  priority: SignalPriority;
  reasoning: string;
}

/** Deliverable entry in the N8N results payload (includes base64 file content) */
export interface N8NDeliverable {
  id: string;
  type: DeliverableType;
  title: string;
  format: DeliverableFormat;
  content_json: Record<string, unknown>;
  /** Base64-encoded file content (PDF or XLSX) */
  file_base64: string;
}

/** Trace entry in the N8N results payload */
export interface N8NTrace {
  timestamp: string;
  actor: ActorType;
  action: string;
  details: string;
}

/**
 * GET /missions/analyze/{analysis_id}/results — Full results payload
 *
 * This is the single payload that contains ALL analysis results.
 * The Next.js API route receives this, decomposes it, and stores
 * everything in Supabase. After this import, N8N is no longer needed
 * for this mission.
 */
export interface N8NAnalysisResults {
  analysis_id: string;
  mission_id: string;
  completed_at: string;

  /** Document completeness assessment */
  completeness: N8NCompletenessEntry[];

  /** Parsed FEC entries */
  ecritures: N8NEcriture[];

  /** Entry-to-document matching results */
  rapprochements: N8NRapprochement[];

  /** Detected documentary signals */
  signals: N8NSignal[];

  /** Generated deliverables (with base64 file content) */
  deliverables: N8NDeliverable[];

  /** Audit trail entries from the analysis process */
  traces: N8NTrace[];
}

// -----------------------------------------------------------------------------
// N8N Client Configuration
// -----------------------------------------------------------------------------

/** Configuration for the N8N API client */
export interface N8NClientConfig {
  /** Base URL for N8N webhooks (e.g., https://n8n.agence-b.fr/webhook/sofia) */
  baseUrl: string;
  /** Request timeout in milliseconds */
  timeoutMs: number;
  /** License key added as X-License-Key header */
  licenseKey: string;
}

/** N8N webhook endpoints */
export interface N8NEndpoints {
  documentUpload: '/missions/documents/upload';
  analyze: '/missions/analyze';
  status: `/missions/analyze/${string}/status`;
  results: `/missions/analyze/${string}/results`;
}
