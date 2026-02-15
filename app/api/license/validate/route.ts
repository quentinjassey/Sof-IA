// app/api/license/validate/route.ts
// POST handler: validates a license key against Supabase and creates a session cookie.
// This is the ONLY route that does NOT require authentication.
//
// Request:  { license_key: string }
// Response: { data: { license_id, license_key, activated_at, valid_until, features } }
//      or:  { error: string, code: string } (401)

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createSessionCookie } from '@/lib/auth/session'

export async function POST(req: NextRequest) {
  try {
    // Parse request body
    const body = await req.json()
    const { license_key } = body

    if (!license_key || typeof license_key !== 'string') {
      return NextResponse.json(
        {
          error: 'La cle de licence est requise.',
          code: 'MISSING_LICENSE_KEY',
        },
        { status: 400 }
      )
    }

    const trimmedKey = license_key.trim()

    // Query Supabase for the license
    const supabase = createServerSupabaseClient()

    const { data: license, error: queryError } = await supabase
      .from('licenses')
      .select('*')
      .eq('license_key', trimmedKey)
      .eq('status', 'active')
      .single()

    if (queryError || !license) {
      return NextResponse.json(
        {
          error: 'Cle de licence invalide ou expiree.',
          code: 'INVALID_LICENSE',
        },
        { status: 401 }
      )
    }

    // Check expiration: valid_until must be in the future (or null for unlimited)
    if (license.valid_until) {
      const validUntil = new Date(license.valid_until)
      if (validUntil < new Date()) {
        return NextResponse.json(
          {
            error: 'Cle de licence expiree.',
            code: 'LICENSE_EXPIRED',
          },
          { status: 401 }
        )
      }
    }

    // Set activated_at if this is the first activation
    const now = new Date().toISOString()
    if (!license.activated_at) {
      await supabase
        .from('licenses')
        .update({ activated_at: now })
        .eq('id', license.id)
    }

    const activatedAt = license.activated_at || now

    // Create session cookie
    const sessionData = {
      license_key: trimmedKey,
      license_id: license.id,
      activated_at: activatedAt,
    }

    const cookie = await createSessionCookie(sessionData)

    // Build response
    const response = NextResponse.json(
      {
        data: {
          license_id: license.id,
          license_key: trimmedKey,
          activated_at: activatedAt,
          valid_until: license.valid_until,
          features: license.features,
        },
      },
      { status: 200 }
    )

    // Set the session cookie
    response.cookies.set(cookie.name, cookie.value, cookie.options as {
      httpOnly?: boolean
      secure?: boolean
      sameSite?: 'strict' | 'lax' | 'none'
      path?: string
      maxAge?: number
    })

    return response
  } catch (error) {
    console.error('License validation error:', error)
    return NextResponse.json(
      {
        error: 'Erreur interne lors de la validation de la licence.',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    )
  }
}
