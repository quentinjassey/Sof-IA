// =============================================================================
// SOF'IA — Upload Utility with Progress Tracking
// Uses XMLHttpRequest for real upload progress events.
// =============================================================================

export interface UploadProgressEvent {
  loaded: number
  total: number
  percent: number
}

/**
 * Uploads a FormData payload with real progress tracking via XMLHttpRequest.
 *
 * @param url - The upload endpoint URL
 * @param formData - FormData to send
 * @param onProgress - Callback fired on each progress event
 * @param signal - Optional AbortSignal to cancel the upload
 * @returns A Response-like object with ok, status, and json()
 */
export function uploadWithProgress(
  url: string,
  formData: FormData,
  onProgress: (event: UploadProgressEvent) => void,
  signal?: AbortSignal
): Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Upload aborted', 'AbortError'))
      return
    }

    const xhr = new XMLHttpRequest()

    xhr.upload.onprogress = (e: ProgressEvent) => {
      if (e.lengthComputable) {
        onProgress({
          loaded: e.loaded,
          total: e.total,
          percent: Math.round((e.loaded / e.total) * 100),
        })
      }
    }

    xhr.onload = () => {
      resolve({
        ok: xhr.status >= 200 && xhr.status < 300,
        status: xhr.status,
        json: () => {
          try {
            return Promise.resolve(JSON.parse(xhr.responseText))
          } catch {
            return Promise.reject(new SyntaxError('Invalid JSON response'))
          }
        },
      })
    }

    xhr.onerror = () => {
      reject(new TypeError('Network error'))
    }

    xhr.onabort = () => {
      reject(new DOMException('Upload aborted', 'AbortError'))
    }

    if (signal) {
      signal.addEventListener('abort', () => xhr.abort(), { once: true })
    }

    xhr.open('POST', url)
    xhr.send(formData)
  })
}
