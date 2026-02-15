// =============================================================================
// SOF'IA — N8N Webhook Endpoint Constants & URL Helpers
// Centralizes all N8N webhook paths and provides type-safe URL construction.
// SERVER SIDE ONLY — never import from browser code.
// =============================================================================

/**
 * Base URL for all N8N webhooks. Read from environment variable.
 *
 * The trailing path segment "/sofia" is part of the N8N webhook namespace.
 * All endpoints are relative to this base.
 *
 * Default: https://n8n.agence-b.fr/webhook/sofia
 */
const N8N_BASE_URL = process.env.N8N_BASE_URL || 'https://n8n.agence-b.fr/webhook/sofia';

/**
 * Base URL for N8N webhooks that use production UUIDs.
 * Some N8N workflows expose production webhooks with a UUID prefix
 * instead of the /sofia namespace.
 */
const N8N_WEBHOOK_ROOT = 'https://n8n.agence-b.fr/webhook';

// -----------------------------------------------------------------------------
// Webhook endpoint paths (relative to N8N_BASE_URL)
// -----------------------------------------------------------------------------

/**
 * N8N webhook endpoint paths.
 *
 * These correspond to the 8 N8N workflows (WF-01 to WF-08):
 * - UPLOAD: WF-01 — Send documents for analysis
 * - ANALYZE: WF-02 — Launch the full pre-analysis pipeline
 * - STATUS: WF-07 — Poll analysis progress
 * - RESULTS: WF-08 — Retrieve complete analysis results
 */
export const N8N_ENDPOINTS = {
  /**
   * POST /missions/documents/upload
   * Send document references (signed URLs) to N8N for download.
   * WF-01: Document upload workflow
   */
  UPLOAD: '/missions/documents/upload',

  /**
   * POST /missions/analyze
   * Launch the asynchronous pre-analysis pipeline.
   * WF-02: Main pre-analysis orchestration (6 steps)
   *
   * Steps:
   * 1. Parse FEC (tab-delimited DGFiP format)
   * 2. Extract text from PDFs (native or OCR)
   * 3. Match entries to supporting documents
   * 4. LLM-based signal detection
   * 5. Signal consolidation and deduplication
   * 6. Generate 4 deliverables (PDF/XLSX)
   */
  ANALYZE: '/missions/analyze',

  /**
   * GET /missions/analyze/{analysis_id}/status
   * Poll the progress of a running analysis.
   * WF-07: Status polling endpoint
   *
   * Uses a dedicated N8N production webhook UUID prefix.
   *
   * Returns progress with step number, percentage, and message.
   * When status is 'completed', includes a results_summary.
   */
  STATUS: '/f38b7e23-0d26-4439-92d7-cb89922cf2c5/sofia/missions/analyze/:analysisId/status',

  /**
   * GET /missions/analyze/{analysis_id}/results
   * Retrieve the complete analysis results payload.
   * WF-08: Results retrieval endpoint
   *
   * Returns a single JSON payload containing:
   * - completeness: document presence assessment
   * - ecritures: parsed FEC entries
   * - rapprochements: entry-to-document matching
   * - signals: detected documentary signals
   * - deliverables: generated files (base64)
   * - traces: Sofia action log
   *
   * IMPORTANT: Results have a 48-hour TTL on N8N.
   * After expiry, the analysis must be re-run.
   */
  RESULTS: '/missions/analyze/:analysisId/results',
} as const;

// -----------------------------------------------------------------------------
// URL construction helpers
// -----------------------------------------------------------------------------

/**
 * Constructs the full URL for the document upload endpoint.
 *
 * @returns Full URL: {N8N_BASE_URL}/missions/documents/upload
 *
 * @example
 * ```typescript
 * const url = getUploadUrl();
 * // => "https://n8n.agence-b.fr/webhook/sofia/missions/documents/upload"
 * ```
 */
export function getUploadUrl(): string {
  return `${N8N_BASE_URL}${N8N_ENDPOINTS.UPLOAD}`;
}

/**
 * Constructs the full URL for the analysis launch endpoint.
 *
 * @returns Full URL: {N8N_BASE_URL}/missions/analyze
 *
 * @example
 * ```typescript
 * const url = getAnalyzeUrl();
 * // => "https://n8n.agence-b.fr/webhook/sofia/missions/analyze"
 * ```
 */
export function getAnalyzeUrl(): string {
  return `${N8N_BASE_URL}${N8N_ENDPOINTS.ANALYZE}`;
}

/**
 * Constructs the full URL for polling analysis status.
 *
 * Uses the dedicated N8N production webhook UUID for the status endpoint.
 *
 * @param analysisId - The UUID of the analysis to check
 * @returns Full URL: {N8N_WEBHOOK_ROOT}/f38b7e23-.../sofia/missions/analyze/{analysisId}/status
 *
 * @example
 * ```typescript
 * const url = getStatusUrl('550e8400-e29b-41d4-a716-446655440000');
 * // => "https://n8n.agence-b.fr/webhook/f38b7e23-0d26-4439-92d7-cb89922cf2c5/sofia/missions/analyze/550e8400-e29b-41d4-a716-446655440000/status"
 * ```
 */
export function getStatusUrl(analysisId: string): string {
  return `${N8N_WEBHOOK_ROOT}/e346d7bf-a57d-497c-b49f-39ecd88bdb92/sofia/missions/analyze/${encodeURIComponent(analysisId)}/status`;
}

/**
 * Constructs the full URL for retrieving analysis results.
 *
 * @param analysisId - The UUID of the completed analysis
 * @returns Full URL: {N8N_BASE_URL}/missions/analyze/{analysisId}/results
 *
 * @example
 * ```typescript
 * const url = getResultsUrl('550e8400-e29b-41d4-a716-446655440000');
 * // => "https://n8n.agence-b.fr/webhook/sofia/missions/analyze/550e8400-e29b-41d4-a716-446655440000/results"
 * ```
 */
export function getResultsUrl(analysisId: string): string {
  return `${N8N_BASE_URL}/missions/analyze/${encodeURIComponent(analysisId)}/results`;
}

/**
 * Returns the configured N8N base URL.
 * Useful for logging and diagnostics.
 */
export function getBaseUrl(): string {
  return N8N_BASE_URL;
}
