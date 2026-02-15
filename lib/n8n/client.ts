// =============================================================================
// SOF'IA — N8N API Client
// Server-side HTTP client for communicating with N8N workflows.
//
// IMPORTANT: SERVER SIDE ONLY — never import this module from browser code.
// All N8N communication must happen through Next.js API routes, never from
// the browser. The client automatically adds the X-License-Key header to
// every request for authentication.
//
// Architecture overview:
//   Browser -> Next.js API Route -> N8N Client -> N8N Webhooks
//
// The analysis flow works as follows:
//   1. API route calls startAnalysis() to begin async processing on N8N
//   2. Client polls getAnalysisStatus() every ~4 seconds
//   3. When status is 'completed', calls getAnalysisResults() to get the
//      full payload (ecritures, signals, deliverables, etc.)
//   4. The API route then imports everything into Supabase
//   5. After import, N8N cleans up — nothing persists on N8N side
//
// N8N results have a 48-hour TTL. After expiry, the analysis must be re-run.
// =============================================================================

import type {
  N8NAnalyzeRequest,
  N8NAnalyzeResponse,
  N8NStatusResponse,
  N8NResultsPayload,
  N8NUploadRequest,
  N8NUploadResponse,
  N8NErrorResponse,
  N8NDocumentRef,
  N8NAnalysisOptions,
} from './types';

import { N8NApiError, N8NTimeoutError } from './types';
import type { ScenarioType } from '@/types/database';
import { getAnalyzeUrl, getStatusUrl, getResultsUrl, getUploadUrl, getBaseUrl } from './webhooks';

// -----------------------------------------------------------------------------
// Configuration
// -----------------------------------------------------------------------------

/** Default request timeout in milliseconds (from env or 30 seconds) */
const N8N_TIMEOUT_MS = parseInt(process.env.N8N_TIMEOUT_MS || '30000', 10);

/** Results TTL in hours (from env or 48 hours) */
const RESULTS_TTL_HOURS = parseInt(process.env.RESULTS_TTL_HOURS || '48', 10);

// -----------------------------------------------------------------------------
// Client configuration interface
// -----------------------------------------------------------------------------

interface N8NClientConfig {
  /** License key for X-License-Key header authentication */
  licenseKey: string;
  /** Optional custom timeout in milliseconds (overrides N8N_TIMEOUT_MS) */
  timeoutMs?: number;
}

// -----------------------------------------------------------------------------
// N8N Client Class
// -----------------------------------------------------------------------------

/**
 * HTTP client for server-side communication with N8N workflows.
 *
 * This client handles all HTTP communication with the N8N webhook endpoints,
 * including authentication via X-License-Key headers, request timeouts,
 * and structured error handling.
 *
 * Each instance is tied to a specific license key (from the user's session).
 * All requests include this key so N8N can validate the caller.
 *
 * @example
 * ```typescript
 * // In an API route handler:
 * import { createN8NClient } from '@/lib/n8n/client';
 *
 * const licenseKey = getLicenseKeyFromSession(req);
 * const n8n = createN8NClient(licenseKey);
 *
 * // Start analysis
 * const { analysis_id } = await n8n.startAnalysis({
 *   mission_id: 'uuid',
 *   scenario: 'sondage_ca',
 *   documents: [{ id: 'uuid', type: 'fec', filename: 'FEC.txt', download_url: '...' }],
 * });
 *
 * // Poll status
 * const status = await n8n.getAnalysisStatus(analysis_id);
 *
 * // Get results when completed
 * if (status.status === 'completed') {
 *   const results = await n8n.getAnalysisResults(analysis_id);
 *   // Import results into Supabase...
 * }
 * ```
 */
class N8NClient {
  private readonly licenseKey: string;
  private readonly timeoutMs: number;

  constructor(config: N8NClientConfig) {
    if (!config.licenseKey) {
      throw new Error('N8NClient requires a license key for authentication');
    }
    this.licenseKey = config.licenseKey;
    this.timeoutMs = config.timeoutMs ?? N8N_TIMEOUT_MS;
  }

  // ---------------------------------------------------------------------------
  // Core HTTP methods
  // ---------------------------------------------------------------------------

  /**
   * Performs an authenticated HTTP request to N8N.
   *
   * Every request includes:
   * - X-License-Key header for N8N-side authentication
   * - Content-Type: application/json
   * - AbortController-based timeout
   *
   * @param url - Full URL to call
   * @param options - Fetch options (method, body, etc.)
   * @param customTimeoutMs - Optional timeout override for this specific request
   * @returns Parsed JSON response
   * @throws {N8NTimeoutError} When the request exceeds the configured timeout
   * @throws {N8NApiError} When N8N returns a non-2xx status code
   */
  private async request<T>(
    url: string,
    options: RequestInit = {},
    customTimeoutMs?: number
  ): Promise<T> {
    const effectiveTimeout = customTimeoutMs ?? this.timeoutMs;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), effectiveTimeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'X-License-Key': this.licenseKey,
          ...options.headers,
        },
      });

      if (!response.ok) {
        let errorBody: N8NErrorResponse | null = null;
        try {
          errorBody = await response.json() as N8NErrorResponse;
        } catch {
          // Response body is not valid JSON — use status text
        }

        throw new N8NApiError(
          errorBody?.error || `N8N responded with HTTP ${response.status}: ${response.statusText}`,
          response.status,
          errorBody?.code,
          errorBody?.details
        );
      }

      // Handle empty responses (e.g., 204 No Content)
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        return {} as T;
      }

      return await response.json() as T;
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new N8NTimeoutError(effectiveTimeout);
      }
      // Re-throw N8NApiError and N8NTimeoutError as-is
      if (error instanceof N8NApiError || error instanceof N8NTimeoutError) {
        throw error;
      }
      // Wrap unexpected errors
      throw new N8NApiError(
        `Failed to communicate with N8N: ${error instanceof Error ? error.message : String(error)}`,
        0,
        'NETWORK_ERROR'
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Sends a POST request to N8N.
   */
  private async post<T>(url: string, body: unknown): Promise<T> {
    return this.request<T>(url, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  /**
   * Sends a GET request to N8N.
   */
  private async get<T>(url: string, customTimeoutMs?: number): Promise<T> {
    return this.request<T>(url, { method: 'GET' }, customTimeoutMs);
  }

  // ---------------------------------------------------------------------------
  // Public API — Document Upload
  // ---------------------------------------------------------------------------

  /**
   * Sends document references (signed URLs) to N8N for download.
   *
   * This corresponds to N8N workflow WF-01. N8N downloads the documents
   * from Supabase Storage using the signed URLs (valid for 1 hour).
   *
   * Note: Documents are already stored in Supabase Storage at this point.
   * We only send the signed download URLs, not the actual file content.
   *
   * @param params - Upload parameters including mission ID, scenario, and document refs
   * @returns Confirmation with document count and readiness status
   * @throws {N8NApiError} If N8N rejects the upload request
   * @throws {N8NTimeoutError} If the request exceeds the timeout
   */
  async uploadDocuments(params: {
    mission_id: string;
    scenario: ScenarioType;
    documents: N8NDocumentRef[];
  }): Promise<N8NUploadResponse> {
    const body: N8NUploadRequest = {
      mission_id: params.mission_id,
      scenario: params.scenario,
      documents: params.documents,
    };

    return this.post<N8NUploadResponse>(getUploadUrl(), body);
  }

  // ---------------------------------------------------------------------------
  // Public API — Analysis
  // ---------------------------------------------------------------------------

  /**
   * Launches the asynchronous pre-analysis pipeline on N8N.
   *
   * This corresponds to N8N workflow WF-02, which orchestrates 6 steps:
   *   1. Parse FEC (tab-delimited DGFiP format)
   *   2. Extract text from PDFs (native or OCR)
   *   3. Match accounting entries to supporting documents
   *   4. LLM-based signal detection (provider-agnostic)
   *   5. Signal consolidation and deduplication
   *   6. Generate 4 deliverables (checklist, signals table, synthesis, trace journal)
   *
   * The analysis runs asynchronously. Use getAnalysisStatus() to poll progress,
   * and getAnalysisResults() to retrieve the final payload when complete.
   *
   * @param params - Analysis parameters:
   *   - mission_id: UUID of the mission in Supabase
   *   - scenario: 'sondage_ca' | 'cutoff' | 'pointage'
   *   - documents: Array of document references with signed download URLs
   *   - options: Optional analysis configuration (cutoff window, priority threshold)
   *
   * @returns Analysis confirmation with analysis_id for subsequent polling
   * @throws {N8NApiError} If N8N rejects the analysis request (e.g., invalid license)
   * @throws {N8NTimeoutError} If the initial request exceeds the timeout
   *
   * @example
   * ```typescript
   * const result = await n8n.startAnalysis({
   *   mission_id: '550e8400-e29b-41d4-a716-446655440000',
   *   scenario: 'cutoff',
   *   documents: [
   *     { id: 'doc1', type: 'fec', filename: 'FEC_2025.txt', download_url: 'https://...' },
   *     { id: 'doc2', type: 'facture_vente', filename: 'FA-001.pdf', download_url: 'https://...' },
   *   ],
   *   options: { cutoff_window_days: 10 },
   * });
   * // result.analysis_id => use for polling
   * ```
   */
  async startAnalysis(params: {
    mission_id: string;
    scenario: ScenarioType;
    documents: N8NDocumentRef[];
    options?: N8NAnalysisOptions;
  }): Promise<N8NAnalyzeResponse> {
    const body: N8NAnalyzeRequest = {
      mission_id: params.mission_id,
      scenario: params.scenario,
      documents: params.documents,
      options: params.options,
    };

    return this.post<N8NAnalyzeResponse>(getAnalyzeUrl(), body);
  }

  /**
   * Polls the progress of a running analysis.
   *
   * This corresponds to N8N workflow WF-07. The API route should call this
   * at regular intervals (default: every 4 seconds, configured by POLL_INTERVAL_MS).
   *
   * Possible status values:
   * - 'pending': Analysis is queued but not yet started
   * - 'processing': Analysis is actively running (check progress for details)
   * - 'completed': Analysis is done, results available via getAnalysisResults()
   * - 'failed': Analysis failed, check error field for details
   *
   * When status is 'processing', the progress object contains:
   * - step: Current step name (e.g., 'parsing_fec', 'rapprochement', 'analyse_llm')
   * - step_number: Current step (1-6)
   * - total_steps: Always 6
   * - percent: Overall progress (0-100)
   * - message: Human-readable message for the UI
   *
   * @param analysisId - UUID of the analysis to check
   * @returns Current status with progress and optional results summary
   * @throws {N8NApiError} If N8N returns an error (e.g., analysis not found)
   * @throws {N8NTimeoutError} If the request exceeds the timeout
   *
   * @example
   * ```typescript
   * const status = await n8n.getAnalysisStatus('550e8400-...');
   * if (status.status === 'processing') {
   *   console.log(`Step ${status.progress?.step_number}/6: ${status.progress?.message}`);
   * }
   * if (status.status === 'completed') {
   *   // Ready to fetch full results
   * }
   * ```
   */
  async getAnalysisStatus(analysisId: string): Promise<N8NStatusResponse> {
    return this.get<N8NStatusResponse>(getStatusUrl(analysisId));
  }

  /**
   * Retrieves the complete analysis results payload from N8N.
   *
   * This corresponds to N8N workflow WF-08. This is the critical endpoint
   * in the architecture: a single request returns ALL analysis data.
   *
   * The returned payload contains:
   * - completeness: Document presence/absence assessment per type
   * - ecritures: All parsed FEC accounting entries
   * - rapprochements: Entry-to-document matching results
   * - signals: Detected documentary signals (all start as human_decision='pending')
   * - deliverables: Generated files (PDF/XLSX) as base64 with structured data
   * - traces: Sofia action log from the analysis pipeline
   *
   * After receiving this payload, the API route must:
   * 1. Import everything into Supabase (DB tables + Storage for files)
   * 2. Update the mission status to 'analyzed'
   * 3. The mission is then fully self-contained in Supabase
   *
   * IMPORTANT: Results have a 48-hour TTL on N8N. After expiry, the analysis
   * must be completely re-run. Check isResultsExpired() to verify before calling.
   *
   * Uses an extended timeout (minimum 60s) because the results payload can be
   * large, especially with base64-encoded deliverable files.
   *
   * @param analysisId - UUID of the completed analysis
   * @returns Complete results payload with all analysis data
   * @throws {N8NApiError} If results are expired (TTL exceeded) or analysis not found
   * @throws {N8NTimeoutError} If the request exceeds the timeout
   *
   * @example
   * ```typescript
   * const results = await n8n.getAnalysisResults('550e8400-...');
   * console.log(`${results.ecritures.length} entries parsed`);
   * console.log(`${results.signals.length} signals detected`);
   * // Now import into Supabase...
   * ```
   */
  async getAnalysisResults(analysisId: string): Promise<N8NResultsPayload> {
    // Use a longer timeout for results retrieval — the payload can be large
    // (contains base64-encoded PDF/XLSX deliverables)
    const resultsTimeoutMs = Math.max(this.timeoutMs, 60000);
    return this.get<N8NResultsPayload>(getResultsUrl(analysisId), resultsTimeoutMs);
  }

  // ---------------------------------------------------------------------------
  // Utility methods
  // ---------------------------------------------------------------------------

  /**
   * Checks whether analysis results may have expired based on the 48-hour TTL.
   *
   * N8N stores analysis results temporarily (default: 48 hours). After this
   * period, the results are purged and the analysis must be re-run.
   *
   * @param completedAt - ISO 8601 timestamp of when the analysis completed
   * @returns true if the results have likely expired
   *
   * @example
   * ```typescript
   * if (n8n.isResultsExpired('2026-02-12T10:00:00Z')) {
   *   // Results are expired — must re-run analysis
   * }
   * ```
   */
  isResultsExpired(completedAt: string): boolean {
    const completedDate = new Date(completedAt);
    const now = new Date();
    const diffHours = (now.getTime() - completedDate.getTime()) / (1000 * 60 * 60);
    return diffHours >= RESULTS_TTL_HOURS;
  }

  /**
   * Returns the configured N8N base URL for diagnostics and logging.
   */
  getBaseUrl(): string {
    return getBaseUrl();
  }

  /**
   * Returns the configured timeout in milliseconds.
   */
  getTimeoutMs(): number {
    return this.timeoutMs;
  }

  /**
   * Returns the results TTL in hours.
   */
  getResultsTtlHours(): number {
    return RESULTS_TTL_HOURS;
  }
}

// -----------------------------------------------------------------------------
// Factory function
// -----------------------------------------------------------------------------

/**
 * Creates a new N8N client instance configured with the given license key.
 *
 * This is the primary way to instantiate the client in API routes. The license
 * key is extracted from the session cookie by the auth middleware and passed
 * to this function.
 *
 * @param licenseKey - The user's license key (from session cookie)
 * @param options - Optional configuration overrides
 * @returns Configured N8NClient instance
 *
 * @example
 * ```typescript
 * // In an API route:
 * import { createN8NClient } from '@/lib/n8n/client';
 * import { getSession } from '@/lib/auth/session';
 *
 * export async function POST(req: Request) {
 *   const session = await getSession(req);
 *   const n8n = createN8NClient(session.license_key);
 *
 *   const result = await n8n.startAnalysis({ ... });
 *   return Response.json({ data: result });
 * }
 * ```
 */
export function createN8NClient(
  licenseKey: string,
  options?: { timeoutMs?: number }
): N8NClient {
  return new N8NClient({
    licenseKey,
    timeoutMs: options?.timeoutMs,
  });
}

// Re-export error classes for use in API routes
export { N8NApiError, N8NTimeoutError } from './types';

// Re-export commonly used types for convenience
export type {
  N8NAnalyzeResponse,
  N8NStatusResponse,
  N8NResultsPayload,
  N8NDocumentRef,
  N8NAnalysisOptions,
  N8NResultsSummary,
  N8NAnalysisStatus,
  AnalysisStatusInfo,
  AnalysisStep,
} from './types';
