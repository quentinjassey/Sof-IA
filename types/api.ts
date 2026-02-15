// =============================================================================
// SOF'IA — API Request/Response Type Definitions
// Matches API route contracts from ARCHITECTURE_POC_SOFIA_ANNEXES.md Section E
// =============================================================================

import type {
  ScenarioType,
  MissionStatus,
  HumanDecision,
  SignalPriority,
  DeliverableType,
  DeliverableFormat,
  Profile,
  Mission,
  Document,
  Signal,
  Deliverable,
  Trace,
  Completeness,
  DocumentStatus,
} from './database';

// -----------------------------------------------------------------------------
// Generic Response Wrappers
// -----------------------------------------------------------------------------

/** Standard success response */
export interface ApiSuccessResponse<T> {
  data: T;
}

/** Standard error response */
export interface ApiErrorResponse {
  error: string;
  code: string;
}

/** Union type for any API response */
export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

/** Type guard to check if a response is an error */
export function isApiError<T>(response: ApiResponse<T>): response is ApiErrorResponse {
  return 'error' in response;
}

// -----------------------------------------------------------------------------
// License API Types
// -----------------------------------------------------------------------------

/** POST /api/license/validate — Request */
export interface LicenseValidateRequest {
  license_key: string;
}

/** POST /api/license/validate — Response data */
export interface LicenseValidateData {
  valid: boolean;
  license_id: string;
  valid_until: string;
  features: ScenarioType[];
}

/** POST /api/license/validate — Full response */
export type LicenseValidateResponse = ApiResponse<LicenseValidateData>;

/** License validation error codes */
export type LicenseErrorCode = 'INVALID_KEY' | 'EXPIRED' | 'REVOKED';

/** GET /api/license/status — Response data */
export interface LicenseStatusData {
  valid: boolean;
  license_id: string;
  days_remaining: number;
}

/** GET /api/license/status — Full response */
export type LicenseStatusResponse = ApiResponse<LicenseStatusData>;

// -----------------------------------------------------------------------------
// Profile API Types
// -----------------------------------------------------------------------------

/** POST /api/profile — Request */
export interface ProfileCreateRequest {
  name: string;
  cabinet: string;
  inscription_cncc?: string;
  email?: string;
}

/** POST /api/profile — Response */
export type ProfileCreateResponse = ApiResponse<Profile>;

/** PUT /api/profile — Request */
export interface ProfileUpdateRequest {
  name?: string;
  cabinet?: string;
  inscription_cncc?: string;
  email?: string;
}

/** PUT /api/profile — Response */
export type ProfileUpdateResponse = ApiResponse<Profile>;

/** GET /api/profile — Response */
export type ProfileGetResponse = ApiResponse<Profile | null>;

// -----------------------------------------------------------------------------
// Mission API Types
// -----------------------------------------------------------------------------

/** POST /api/missions — Request */
export interface MissionCreateRequest {
  name: string;
  scenario: ScenarioType;
}

/** POST /api/missions — Response */
export type MissionCreateResponse = ApiResponse<Mission>;

/** GET /api/missions — Response */
export type MissionListResponse = ApiResponse<Mission[]>;

/** Statistics for a single mission */
export interface MissionStats {
  documents_count: number;
  signals_count: number;
  signals_by_priority: Record<SignalPriority, number>;
  signals_by_decision: Record<HumanDecision, number>;
}

/** GET /api/missions/[id] — Response data (Mission with stats) */
export interface MissionDetailData extends Mission {
  stats: MissionStats;
}

/** GET /api/missions/[id] — Response */
export type MissionDetailResponse = ApiResponse<MissionDetailData>;

/** PUT /api/missions/[id] — Request */
export interface MissionUpdateRequest {
  name?: string;
  status?: MissionStatus;
}

/** PUT /api/missions/[id] — Response */
export type MissionUpdateResponse = ApiResponse<Mission>;

/** DELETE /api/missions/[id] — Response */
export type MissionDeleteResponse = ApiResponse<{ success: true }>;

// -----------------------------------------------------------------------------
// Document API Types
// -----------------------------------------------------------------------------

/** GET /api/missions/[id]/documents — Response */
export type DocumentListResponse = ApiResponse<Document[]>;

/** POST /api/missions/[id]/documents — Response */
export type DocumentUploadResponse = ApiResponse<Document[]>;

/** DELETE /api/missions/[id]/documents — Response */
export type DocumentDeleteResponse = ApiResponse<{ success: true }>;

/** Completeness entry (used in completeness check) */
export interface CompletenessEntry {
  type: string;
  label: string;
  required: boolean;
  status: DocumentStatus;
  count: number;
  note?: string;
}

/** GET /api/missions/[id]/documents/completeness — Response */
export type CompletenessResponse = ApiResponse<CompletenessEntry[]>;

// -----------------------------------------------------------------------------
// Analysis API Types
// -----------------------------------------------------------------------------

/** POST /api/missions/[id]/analysis — Response data */
export interface AnalysisStartData {
  analysis_id: string;
  status: 'uploading';
}

/** POST /api/missions/[id]/analysis — Response */
export type AnalysisStartResponse = ApiResponse<AnalysisStartData>;

/** Analysis progress step details */
export interface AnalysisProgress {
  step: string;
  step_number: number;
  total_steps: number;
  percent: number;
  message: string;
}

/** Analysis status enumeration (client-facing) */
export type AnalysisStatusValue =
  | 'uploading'
  | 'analyzing'
  | 'importing'
  | 'completed'
  | 'failed';

/** GET /api/missions/[id]/analysis/status — Response data */
export interface AnalysisStatusData {
  status: AnalysisStatusValue;
  progress?: AnalysisProgress;
  error?: string;
}

/** GET /api/missions/[id]/analysis/status — Response */
export type AnalysisStatusResponse = ApiResponse<AnalysisStatusData>;

/** Results summary after import */
export interface ResultsSummary {
  ecritures_parsed: number;
  rapprochements_created: number;
  rapprochements_missing: number;
  signals_generated: number;
  signals_by_priority: Record<SignalPriority, number>;
  deliverables_generated: number;
}

/** GET /api/missions/[id]/analysis/results — Response data */
export interface AnalysisResultsData {
  summary: ResultsSummary;
  imported: boolean;
}

/** GET /api/missions/[id]/analysis/results — Response */
export type AnalysisResultsResponse = ApiResponse<AnalysisResultsData>;

// -----------------------------------------------------------------------------
// Signal API Types
// -----------------------------------------------------------------------------

/** Pagination metadata */
export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
}

/** GET /api/missions/[id]/signals — Query params */
export interface SignalListParams {
  priority?: SignalPriority;
  decision?: HumanDecision;
  type?: string;
  page?: number;
  limit?: number;
}

/** GET /api/missions/[id]/signals — Response data */
export interface SignalListData {
  data: Signal[];
  pagination: PaginationMeta;
}

/** GET /api/missions/[id]/signals — Response (note: flat structure, not nested ApiResponse) */
export type SignalListResponse = SignalListData;

/** GET /api/missions/[id]/signals/[signalId] — Response */
export type SignalDetailResponse = ApiResponse<Signal>;

/** PUT /api/missions/[id]/signals/[signalId] — Request */
export interface SignalUpdateRequest {
  decision: Exclude<HumanDecision, 'pending'>;
  comment: string;
}

/** PUT /api/missions/[id]/signals/[signalId] — Response */
export type SignalUpdateResponse = ApiResponse<Signal>;

/** Signal statistics */
export interface SignalStats {
  total: number;
  by_priority: Record<SignalPriority, number>;
  by_decision: Record<HumanDecision, number>;
}

/** GET /api/missions/[id]/signals/stats — Response */
export type SignalStatsResponse = ApiResponse<SignalStats>;

// -----------------------------------------------------------------------------
// Deliverable API Types
// -----------------------------------------------------------------------------

/** GET /api/missions/[id]/deliverables — Response */
export type DeliverableListResponse = ApiResponse<Deliverable[]>;

/**
 * GET /api/missions/[id]/deliverables/[delivId] — Response
 * Returns binary file stream (PDF or XLSX), not JSON.
 * Content-Type: application/pdf or application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
 */
export interface DeliverableDownloadHeaders {
  'content-type': 'application/pdf' | 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  'content-disposition': string;
}

/** POST /api/missions/[id]/deliverables/regenerate — Request */
export interface DeliverableRegenerateRequest {
  types?: DeliverableType[];
}

/** POST /api/missions/[id]/deliverables/regenerate — Response */
export type DeliverableRegenerateResponse = ApiResponse<Deliverable[]>;

// -----------------------------------------------------------------------------
// Trace API Types
// -----------------------------------------------------------------------------

/** GET /api/missions/[id]/traces — Query params */
export interface TraceListParams {
  limit?: number;
}

/** GET /api/missions/[id]/traces — Response */
export type TraceListResponse = ApiResponse<Trace[]>;

// -----------------------------------------------------------------------------
// Session Cookie Types
// -----------------------------------------------------------------------------

/** Session data stored in httpOnly cookie (encrypted) */
export interface SessionData {
  license_key: string;
  license_id: string;
  activated_at: string;
}

// -----------------------------------------------------------------------------
// Common Error Codes
// -----------------------------------------------------------------------------

/** Standard error codes used across API routes */
export type ErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'INVALID_KEY'
  | 'EXPIRED'
  | 'REVOKED'
  | 'VALIDATION_ERROR'
  | 'MISSION_NOT_FOUND'
  | 'SIGNAL_NOT_FOUND'
  | 'DELIVERABLE_NOT_FOUND'
  | 'ANALYSIS_IN_PROGRESS'
  | 'ANALYSIS_FAILED'
  | 'UPLOAD_FAILED'
  | 'IMPORT_FAILED'
  | 'RESULTS_EXPIRED'
  | 'INTERNAL_ERROR';
