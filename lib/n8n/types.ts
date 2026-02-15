// =============================================================================
// SOF'IA — N8N API Type Definitions
// Types for all N8N webhook request/response payloads.
// These types represent the data exchanged between Next.js API routes and N8N.
// SERVER SIDE ONLY — never import from browser code.
// =============================================================================

import type {
  ScenarioType,
  SignalType,
  SignalPriority,
  MatchType,
  ConfidenceLevel,
  DeliverableType,
  DeliverableFormat,
  DocumentType,
  MatchDetails,
  SignalExplicability,
} from '@/types/database';

// -----------------------------------------------------------------------------
// Document references sent to N8N
// -----------------------------------------------------------------------------

/** Document metadata sent to N8N with signed download URL */
export interface N8NDocumentRef {
  /** Document ID from Supabase */
  id: string;
  /** Document type (fec, facture_vente, etc.) */
  type: DocumentType;
  /** Original filename */
  filename: string;
  /** Signed Supabase Storage URL (valid for 1 hour) */
  download_url: string;
}

// -----------------------------------------------------------------------------
// Analysis request/response (POST /missions/analyze)
// -----------------------------------------------------------------------------

/** Options for fine-tuning the analysis behavior */
export interface N8NAnalysisOptions {
  /** Number of days around closing date for cutoff analysis (default: 10) */
  cutoff_window_days?: number;
  /** Minimum priority level for signal detection (default: 'low') */
  priority_threshold?: SignalPriority;
}

/** Request body for POST /missions/analyze */
export interface N8NAnalyzeRequest {
  /** Mission UUID */
  mission_id: string;
  /** Analysis scenario type */
  scenario: ScenarioType;
  /** Documents with signed download URLs */
  documents: N8NDocumentRef[];
  /** Optional analysis configuration */
  options?: N8NAnalysisOptions;
}

/** Response from POST /missions/analyze (HTTP 202 Accepted) */
export interface N8NAnalyzeResponse {
  /** Generated analysis UUID */
  analysis_id: string;
  /** Mission UUID echoed back */
  mission_id: string;
  /** Initial status (always 'processing') */
  status: 'processing';
  /** Estimated duration in seconds */
  estimated_duration_seconds: number;
}

// -----------------------------------------------------------------------------
// Analysis status (GET /missions/analyze/{id}/status)
// -----------------------------------------------------------------------------

/** Progress details during analysis */
export interface N8NAnalysisProgress {
  /** Current step name (e.g., 'rapprochement') */
  step: string;
  /** Current step number (1-based) */
  step_number: number;
  /** Total number of steps */
  total_steps: number;
  /** Overall progress percentage (0-100) */
  percent: number;
  /** Human-readable progress message */
  message: string;
}

/** Analysis status values */
export type N8NAnalysisStatus = 'pending' | 'processing' | 'completed' | 'failed';

/** Response from GET /missions/analyze/{id}/status */
export interface N8NStatusResponse {
  /** Analysis UUID */
  analysis_id: string;
  /** Current analysis status */
  status: N8NAnalysisStatus;
  /** Progress information (present when status is 'processing' or 'completed') */
  progress?: N8NAnalysisProgress;
  /** Summary of results (present when status is 'completed') */
  results_summary?: N8NResultsSummary;
  /** Error details (present when status is 'failed') */
  error?: string;
}

/** Summary of analysis results, included in status when completed */
export interface N8NResultsSummary {
  ecritures_parsed: number;
  rapprochements_created: number;
  rapprochements_missing: number;
  signals_generated: number;
  signals_by_priority: {
    high: number;
    medium: number;
    low: number;
  };
  deliverables_generated: number;
}

// -----------------------------------------------------------------------------
// Analysis results (GET /missions/analyze/{id}/results)
// -----------------------------------------------------------------------------

/** Completeness entry in the N8N results payload */
export interface N8NCompletenessEntry {
  type: string;
  label: string;
  required: boolean;
  status: 'present' | 'missing' | 'incomplete';
  count: number;
  note?: string;
}

/** Parsed accounting entry in the N8N results payload */
export interface N8NEcriture {
  id: string;
  journal_code: string;
  journal_lib?: string;
  ecriture_num: string;
  ecriture_date: string;
  compte_num: string;
  compte_lib?: string;
  comp_aux_num?: string;
  comp_aux_lib?: string;
  piece_ref?: string;
  piece_date?: string;
  ecriture_lib?: string;
  debit: number;
  credit: number;
  lettrage?: string;
  date_lettrage?: string;
  valid_date?: string;
}

/** Entry-to-document matching in the N8N results payload */
export interface N8NRapprochement {
  id: string;
  ecriture_id: string;
  document_id: string | null;
  match_type: MatchType;
  match_details: MatchDetails;
  confidence: ConfidenceLevel;
}

/** Documentary signal in the N8N results payload */
export interface N8NSignal {
  id: string;
  document_id?: string | null;
  ecriture_id?: string | null;
  rapprochement_id?: string | null;
  type: SignalType;
  description: string;
  source_document?: string;
  source_page?: number;
  source_extract?: string;
  rule_triggered?: string;
  rule_description?: string;
  priority: SignalPriority;
  explicability?: SignalExplicability;
}

/** Deliverable in the N8N results payload (includes base64 file content) */
export interface N8NDeliverable {
  id: string;
  type: DeliverableType;
  title: string;
  format: DeliverableFormat;
  /** Structured data for future regeneration */
  content_json: Record<string, unknown>;
  /** Base64-encoded file content (PDF or XLSX) */
  file_base64: string;
}

/** Trace entry in the N8N results payload */
export interface N8NTrace {
  timestamp: string;
  actor: 'sofia';
  action: string;
  details: string;
}

/** Complete results payload from GET /missions/analyze/{id}/results */
export interface N8NResultsPayload {
  /** Analysis UUID */
  analysis_id: string;
  /** Mission UUID */
  mission_id: string;
  /** Completion timestamp */
  completed_at: string;
  /** Document completeness assessment */
  completeness: N8NCompletenessEntry[];
  /** Parsed FEC accounting entries */
  ecritures: N8NEcriture[];
  /** Entry-to-document matching results */
  rapprochements: N8NRapprochement[];
  /** Detected documentary signals */
  signals: N8NSignal[];
  /** Generated deliverables with file content */
  deliverables: N8NDeliverable[];
  /** Sofia action traces from analysis */
  traces: N8NTrace[];
}

// -----------------------------------------------------------------------------
// Document upload (POST /missions/documents/upload)
// -----------------------------------------------------------------------------

/** Request body for POST /missions/documents/upload */
export interface N8NUploadRequest {
  mission_id: string;
  scenario: ScenarioType;
  documents: N8NDocumentRef[];
}

/** Response from POST /missions/documents/upload */
export interface N8NUploadResponse {
  mission_id: string;
  documents_received: number;
  ready_for_analysis: boolean;
}

// -----------------------------------------------------------------------------
// Error types
// -----------------------------------------------------------------------------

/** Standard N8N error response */
export interface N8NErrorResponse {
  error: string;
  code?: string;
  details?: string;
}

/** Custom error class for N8N API communication failures */
export class N8NApiError extends Error {
  /** HTTP status code from N8N */
  public readonly statusCode: number;
  /** Error code from N8N response (if available) */
  public readonly code: string;
  /** Additional error details */
  public readonly details?: string;

  constructor(message: string, statusCode: number, code?: string, details?: string) {
    super(message);
    this.name = 'N8NApiError';
    this.statusCode = statusCode;
    this.code = code || 'N8N_ERROR';
    this.details = details;
  }
}

/** Error class for N8N request timeouts */
export class N8NTimeoutError extends Error {
  /** The timeout duration in milliseconds that was exceeded */
  public readonly timeoutMs: number;

  constructor(timeoutMs: number) {
    super(`N8N request timed out after ${timeoutMs}ms`);
    this.name = 'N8NTimeoutError';
    this.timeoutMs = timeoutMs;
  }
}

// -----------------------------------------------------------------------------
// Client-facing status types (normalized for the frontend polling)
// -----------------------------------------------------------------------------

/** Normalized analysis status for the frontend */
export interface AnalysisStatusInfo {
  /** Current overall status */
  status: 'uploading' | 'analyzing' | 'importing' | 'completed' | 'failed';
  /** Progress percentage (0-100) */
  progress: number;
  /** Current step description */
  current_step: string;
  /** Detailed step breakdown */
  steps: AnalysisStep[];
  /** Error message (present when status is 'failed') */
  error?: string;
}

/** Individual step in the analysis pipeline */
export interface AnalysisStep {
  /** Step name */
  name: string;
  /** Step status */
  status: 'pending' | 'running' | 'completed' | 'failed';
  /** When the step started */
  started_at?: string;
  /** When the step completed */
  completed_at?: string;
}
