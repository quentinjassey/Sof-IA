// =============================================================================
// SOF'IA — API Fetch Utility
// Typed fetch wrapper for all client-side API calls.
// Handles JSON parsing, error responses, and base URL resolution.
// =============================================================================

/**
 * Custom error class for API errors.
 * Includes the error code from the API response for programmatic handling.
 */
export class ApiError extends Error {
  public readonly code: string
  public readonly status: number

  constructor(message: string, code: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
  }
}

/**
 * Options for apiFetch, extending standard RequestInit.
 */
interface ApiFetchOptions extends Omit<RequestInit, 'body'> {
  body?: Record<string, unknown> | FormData
}

/**
 * Typed fetch wrapper for API calls.
 *
 * - Automatically prepends the base URL for relative paths
 * - Serializes objects as JSON with appropriate Content-Type
 * - Parses JSON responses
 * - Throws ApiError on non-2xx responses
 *
 * @param path - API path (e.g., '/api/profile') or full URL
 * @param options - Fetch options with typed body
 * @returns The parsed response data of type T
 *
 * @example
 * ```ts
 * const profile = await apiFetch<Profile>('/api/profile')
 * const updated = await apiFetch<Profile>('/api/profile', {
 *   method: 'PUT',
 *   body: { name: 'Jean Dupont' },
 * })
 * ```
 */
export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {}
): Promise<T> {
  const { body, headers: customHeaders, ...restOptions } = options

  // Build headers
  const headers = new Headers(customHeaders)

  // Build request options
  const fetchOptions: RequestInit = {
    ...restOptions,
    headers,
  }

  // Handle body serialization
  if (body !== undefined) {
    if (body instanceof FormData) {
      // Let browser set Content-Type with boundary for FormData
      fetchOptions.body = body
    } else {
      headers.set('Content-Type', 'application/json')
      fetchOptions.body = JSON.stringify(body)
    }
  }

  // Resolve URL: if path starts with '/', it's relative to the app origin
  const url = path.startsWith('http') ? path : path

  // Make the request
  let response: Response
  try {
    response = await fetch(url, fetchOptions)
  } catch (err) {
    throw new ApiError(
      'Erreur reseau. Verifiez votre connexion.',
      'NETWORK_ERROR',
      0
    )
  }

  // Handle non-JSON responses (e.g., file downloads)
  const contentType = response.headers.get('content-type')
  if (contentType && !contentType.includes('application/json')) {
    if (!response.ok) {
      throw new ApiError(
        `Erreur serveur (${response.status})`,
        'SERVER_ERROR',
        response.status
      )
    }
    // Return the response itself for non-JSON (caller handles it)
    return response as unknown as T
  }

  // Parse JSON response
  let json: Record<string, unknown>
  try {
    json = await response.json()
  } catch {
    throw new ApiError(
      'Reponse invalide du serveur.',
      'PARSE_ERROR',
      response.status
    )
  }

  // Handle error responses
  if (!response.ok) {
    const errorMessage =
      (json.error as string) || `Erreur serveur (${response.status})`
    const errorCode = (json.code as string) || 'UNKNOWN_ERROR'
    throw new ApiError(errorMessage, errorCode, response.status)
  }

  // Return the data property if it exists, otherwise the full JSON
  if ('data' in json) {
    return json.data as T
  }

  return json as T
}
