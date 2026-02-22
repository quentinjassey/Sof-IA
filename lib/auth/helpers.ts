// lib/auth/helpers.ts
// Shared utilities for extracting and verifying session data from API route requests.
// All API routes use these helpers to enforce license-based authentication.

import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie, type SessionData } from './session'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { Profile } from '@/types/database'

// ---------------------------------------------------------------
// Session extraction
// ---------------------------------------------------------------

/**
 * Extracts session data from the request cookie.
 * Returns null if no valid session cookie is present.
 */
export async function getSessionFromRequest(
  req: NextRequest
): Promise<SessionData | null> {
  return getSessionFromCookie(req)
}

/**
 * Extracts session data from the request cookie.
 * Throws a NextResponse 401 if no valid session exists.
 * Use this in API routes that require authentication.
 */
export async function requireSession(
  req: NextRequest
): Promise<SessionData> {
  const session = await getSessionFromCookie(req)
  if (!session) {
    throw NextResponse.json(
      { error: 'Session invalide ou absente.', code: 'UNAUTHORIZED' },
      { status: 401 }
    )
  }
  return session
}

// ---------------------------------------------------------------
// Mission ownership verification
// ---------------------------------------------------------------

/**
 * Verifies that a mission exists and belongs to the given license_id.
 * Returns the mission data if valid, throws a NextResponse 404 otherwise.
 */
export async function requireMissionOwnership(
  missionId: string,
  licenseId: string
) {
  const supabase = createServerSupabaseClient()

  const { data: mission, error } = await supabase
    .from('missions')
    .select('*')
    .eq('id', missionId)
    .eq('license_id', licenseId)
    .single()

  if (error || !mission) {
    throw NextResponse.json(
      { error: 'Mission non trouvee ou acces non autorise.', code: 'MISSION_NOT_FOUND' },
      { status: 404 }
    )
  }

  return mission
}

// ---------------------------------------------------------------
// Project ownership verification
// ---------------------------------------------------------------

/**
 * Verifies that a project exists and belongs to the given license_id.
 * Returns the project data if valid, throws a NextResponse 404 otherwise.
 */
export async function requireProjectOwnership(
  projectId: string,
  licenseId: string
) {
  const supabase = createServerSupabaseClient()

  const { data: project, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .eq('license_id', licenseId)
    .single()

  if (error || !project) {
    throw NextResponse.json(
      { error: 'Projet non trouve ou acces non autorise.', code: 'PROJECT_NOT_FOUND' },
      { status: 404 }
    )
  }

  return project
}

// ---------------------------------------------------------------
// Profile helpers
// ---------------------------------------------------------------

/**
 * Fetches the CAC profile for a license. Returns null if not found.
 */
export async function getProfileForLicense(
  licenseId: string
): Promise<Profile | null> {
  const supabase = createServerSupabaseClient()

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('license_id', licenseId)
    .single()

  if (error || !data) {
    return null
  }

  return data as Profile
}

/**
 * Builds the actor_name string for trace entries based on the CAC profile.
 * Format: "Jean Dupont, CAC (CNCC-75-12345)"
 * Fallback: "Utilisateur" if no profile found.
 */
export async function getActorName(licenseId: string): Promise<string> {
  const profile = await getProfileForLicense(licenseId)
  if (!profile) {
    return 'Utilisateur'
  }
  if (profile.inscription_cncc) {
    return `${profile.name}, CAC (${profile.inscription_cncc})`
  }
  return profile.name
}

// ---------------------------------------------------------------
// Trace creation helper
// ---------------------------------------------------------------

/**
 * Creates a trace entry in the traces table.
 * Used by all API routes to maintain the audit trail.
 */
export async function createTrace(params: {
  mission_id: string
  license_id: string
  actor: 'sofia' | 'user'
  actor_name: string
  action: string
  target_type?: 'mission' | 'document' | 'signal' | 'deliverable' | null
  target_id?: string | null
  details?: string | null
}): Promise<void> {
  const supabase = createServerSupabaseClient()

  await supabase.from('traces').insert({
    mission_id: params.mission_id,
    license_id: params.license_id,
    timestamp: new Date().toISOString(),
    actor: params.actor,
    actor_name: params.actor_name,
    action: params.action,
    target_type: params.target_type ?? null,
    target_id: params.target_id ?? null,
    details: params.details ?? null,
  })
}

// ---------------------------------------------------------------
// Error response helpers
// ---------------------------------------------------------------

/**
 * Creates a standardized JSON error response.
 */
export function errorResponse(
  message: string,
  code: string,
  status: number = 400
): NextResponse {
  return NextResponse.json({ error: message, code }, { status })
}

/**
 * Creates a standardized JSON success response.
 */
export function successResponse<T>(data: T, status: number = 200): NextResponse {
  return NextResponse.json({ data }, { status })
}
