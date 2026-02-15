// =============================================================================
// SOF'IA — Session Hook
// Manages session state: profile data, license info, loading, and logout.
// =============================================================================

'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch, ApiError } from '@/lib/utils/api'
import type { Profile } from '@/types/database'

/** License information returned by GET /api/license/status */
export interface LicenseInfo {
  valid: boolean
  license_id: string
  license_key: string
  activated_at: string | null
  valid_until: string | null
  features: string[]
  status: string
  days_remaining: number
  max_missions: number
}

/** Return type for useSession hook */
export interface UseSessionReturn {
  /** CAC profile data (null if not yet created) */
  profile: Profile | null
  /** Current license information */
  licenseInfo: LicenseInfo | null
  /** Whether session data is currently loading */
  isLoading: boolean
  /** Error message if session fetch failed */
  error: string | null
  /** Clears session cookie and redirects to /activate */
  logout: () => Promise<void>
  /** Refreshes session data from server */
  refresh: () => Promise<void>
}

/**
 * Custom hook for managing user session state.
 *
 * Fetches profile and license data on mount. Provides a logout function
 * that clears the session cookie and redirects to the activation page.
 *
 * @example
 * ```tsx
 * const { profile, licenseInfo, isLoading, error, logout } = useSession()
 *
 * if (isLoading) return <Spinner />
 * if (error) return <ErrorMessage message={error} />
 *
 * return <div>Bienvenue, {profile?.name}</div>
 * ```
 */
export function useSession(): UseSessionReturn {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [licenseInfo, setLicenseInfo] = useState<LicenseInfo | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchSessionData = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      // Fetch profile and license status in parallel
      const [profileData, licenseData] = await Promise.all([
        apiFetch<Profile | null>('/api/profile').catch(() => null),
        apiFetch<LicenseInfo>('/api/license/status'),
      ])

      setProfile(profileData)
      setLicenseInfo(licenseData)
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'AUTH_REQUIRED' || err.status === 401) {
          // Session expired or invalid — redirect to activation
          router.push('/activate')
          return
        }
        setError(err.message)
      } else {
        setError('Erreur lors du chargement de la session.')
      }
    } finally {
      setIsLoading(false)
    }
  }, [router])

  useEffect(() => {
    fetchSessionData()
  }, [fetchSessionData])

  const logout = useCallback(async () => {
    try {
      // Call the logout API to clear the session cookie server-side
      await apiFetch('/api/license/logout', { method: 'POST' }).catch(() => {
        // If logout endpoint doesn't exist yet, we still clear client-side
      })
    } finally {
      // Clear local state
      setProfile(null)
      setLicenseInfo(null)
      // Redirect to activation page
      router.push('/activate')
    }
  }, [router])

  return {
    profile,
    licenseInfo,
    isLoading,
    error,
    logout,
    refresh: fetchSessionData,
  }
}
