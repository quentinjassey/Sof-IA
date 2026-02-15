// app/api/license/status/route.ts
// GET handler: returns current license information from session + Supabase.
// Requires valid session (enforced by middleware).
//
// Response: { data: { valid, license_id, license_key, activated_at, valid_until, features, days_remaining, ... } }

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getSessionFromCookie } from '@/lib/auth/session'

export async function GET(req: NextRequest) {
  try {
    // Get session from cookie (middleware already validated, but double-check)
    const session = await getSessionFromCookie(req)

    if (!session) {
      return NextResponse.json(
        {
          error: 'Aucune session active. Veuillez activer votre licence.',
          code: 'NO_SESSION',
        },
        { status: 401 }
      )
    }

    // Fetch latest license info from Supabase
    const supabase = createServerSupabaseClient()

    const { data: license, error: queryError } = await supabase
      .from('licenses')
      .select('*')
      .eq('id', session.license_id)
      .single()

    if (queryError || !license) {
      return NextResponse.json(
        {
          error: 'Licence introuvable.',
          code: 'LICENSE_NOT_FOUND',
        },
        { status: 404 }
      )
    }

    // Check if license is still active
    const isActive = license.status === 'active'

    // Calculate days remaining
    let daysRemaining = -1 // -1 means unlimited
    if (license.valid_until) {
      const validUntil = new Date(license.valid_until)
      const now = new Date()
      const diffMs = validUntil.getTime() - now.getTime()
      daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)))
    }

    // Check if expired
    const isExpired = license.valid_until
      ? new Date(license.valid_until) < new Date()
      : false

    return NextResponse.json({
      data: {
        valid: isActive && !isExpired,
        license_id: license.id,
        license_key: license.license_key,
        activated_at: license.activated_at,
        valid_until: license.valid_until,
        features: license.features,
        status: license.status,
        days_remaining: daysRemaining,
        max_missions: license.max_missions,
      },
    })
  } catch (error) {
    console.error('License status error:', error)
    return NextResponse.json(
      {
        error: 'Erreur interne lors de la verification de la licence.',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    )
  }
}
