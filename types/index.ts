// =============================================================================
// SOF'IA — Type Definitions Index
// Re-exports all types from the types/ directory
// =============================================================================

// Database types (Supabase PostgreSQL schema)
export type {
  // Enum types
  ScenarioType,
  MissionStatus,
  SignalPriority,
  HumanDecision,
  ActorType,
  DocumentStatus,
  LicenseStatus,
  DocumentType,
  SignalType,
  DeliverableType,
  DeliverableFormat,
  MatchType,
  ConfidenceLevel,
  TraceAction,
  TraceTargetType,

  // Row types (SELECT)
  License,
  Profile,
  Mission,
  Document,
  Ecriture,
  Rapprochement,
  Signal,
  Deliverable,
  Trace,
  Completeness,

  // JSONB structure types
  MatchDetails,
  SignalExplicability,

  // Insert types
  LicenseInsert,
  ProfileInsert,
  MissionInsert,
  DocumentInsert,
  EcritureInsert,
  RapprochementInsert,
  SignalInsert,
  DeliverableInsert,
  TraceInsert,
  CompletenessInsert,

  // Update types
  LicenseUpdate,
  ProfileUpdate,
  MissionUpdate,
  DocumentUpdate,
  SignalUpdate,
  DeliverableUpdate,

  // Database interface (for Supabase client generic)
  Database,
} from './database';

// API types (request/response contracts)
export type {
  // Generic response wrappers
  ApiSuccessResponse,
  ApiErrorResponse,
  ApiResponse,

  // License
  LicenseValidateRequest,
  LicenseValidateData,
  LicenseValidateResponse,
  LicenseErrorCode,
  LicenseStatusData,
  LicenseStatusResponse,

  // Profile
  ProfileCreateRequest,
  ProfileCreateResponse,
  ProfileUpdateRequest,
  ProfileUpdateResponse,
  ProfileGetResponse,

  // Mission
  MissionCreateRequest,
  MissionCreateResponse,
  MissionListResponse,
  MissionStats,
  MissionDetailData,
  MissionDetailResponse,
  MissionUpdateRequest,
  MissionUpdateResponse,
  MissionDeleteResponse,

  // Document
  DocumentListResponse,
  DocumentUploadResponse,
  DocumentDeleteResponse,
  CompletenessEntry,
  CompletenessResponse,

  // Analysis
  AnalysisStartData,
  AnalysisStartResponse,
  AnalysisProgress,
  AnalysisStatusValue,
  AnalysisStatusData,
  AnalysisStatusResponse,
  ResultsSummary,
  AnalysisResultsData,
  AnalysisResultsResponse,

  // Signal
  PaginationMeta,
  SignalListParams,
  SignalListData,
  SignalListResponse,
  SignalDetailResponse,
  SignalUpdateRequest,
  SignalUpdateResponse,
  SignalStats,
  SignalStatsResponse,

  // Deliverable
  DeliverableListResponse,
  DeliverableDownloadHeaders,
  DeliverableRegenerateRequest,
  DeliverableRegenerateResponse,

  // Trace
  TraceListParams,
  TraceListResponse,

  // Session
  SessionData,

  // Error codes
  ErrorCode,
} from './api';

export { isApiError } from './api';

// N8N types (webhook payloads)
export type {
  // Request types (sent to N8N)
  N8NDocumentRef,
  N8NAnalysisOptions,
  N8NDocumentUploadRequest,
  N8NAnalysisRequest,

  // Response types (received from N8N)
  N8NDocumentUploadResponse,
  N8NAnalysisStartResponse,

  // Status types
  N8NAnalysisStep,
  N8NProcessingStatus,
  N8NAnalysisProgress,
  N8NResultsSummary,
  N8NAnalysisStatus,

  // Results payload types
  N8NCompletenessEntry,
  N8NEcriture,
  N8NRapprochement,
  N8NSignal,
  N8NLLMSignalOutput,
  N8NDeliverable,
  N8NTrace,
  N8NAnalysisResults,

  // Client config
  N8NClientConfig,
  N8NEndpoints,
} from './n8n';
