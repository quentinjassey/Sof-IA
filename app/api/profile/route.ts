// app/api/profile/route.ts
// CRUD operations for CAC (Commissaire aux Comptes) profile.
// All handlers require valid session (enforced by middleware).
//
// GET:  Fetch profile by license_id from session
// POST: Create profile (name, cabinet, inscription_cncc, email)
// PUT:  Update profile
//
// Profile data is linked to the license and used in deliverables,
// audit trail, and all generated documents.

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getSessionFromCookie } from '@/lib/auth/session'

// ---------- GET /api/profile ----------
export async function GET(req: NextRequest) {
  try {
    const session = await getSessionFromCookie(req)
    if (!session) {
      return NextResponse.json(
        { error: 'Non autorise.', code: 'AUTH_REQUIRED' },
        { status: 401 }
      )
    }

    const supabase = createServerSupabaseClient()

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('license_id', session.license_id)
      .single()

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows found, which is a valid case (no profile yet)
      console.error('Profile fetch error:', error)
      return NextResponse.json(
        { error: 'Erreur lors de la recuperation du profil.', code: 'QUERY_ERROR' },
        { status: 500 }
      )
    }

    // Return null if no profile exists (valid case for first-time users)
    return NextResponse.json({ data: profile || null })
  } catch (error) {
    console.error('Profile GET error:', error)
    return NextResponse.json(
      { error: 'Erreur interne.', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}

// ---------- POST /api/profile ----------
export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromCookie(req)
    if (!session) {
      return NextResponse.json(
        { error: 'Non autorise.', code: 'AUTH_REQUIRED' },
        { status: 401 }
      )
    }

    const body = await req.json()
    const { name, cabinet, inscription_cncc, email } = body

    // Validate required fields
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Le nom est requis.', code: 'MISSING_NAME' },
        { status: 400 }
      )
    }

    if (!cabinet || typeof cabinet !== 'string' || cabinet.trim().length === 0) {
      return NextResponse.json(
        { error: 'Le nom du cabinet est requis.', code: 'MISSING_CABINET' },
        { status: 400 }
      )
    }

    const supabase = createServerSupabaseClient()

    // Check if a profile already exists for this license
    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('license_id', session.license_id)
      .single()

    if (existing) {
      return NextResponse.json(
        {
          error: 'Un profil existe deja pour cette licence. Utilisez PUT pour le modifier.',
          code: 'PROFILE_EXISTS',
        },
        { status: 409 }
      )
    }

    // Create profile
    const profileData = {
      license_id: session.license_id,
      name: name.trim(),
      cabinet: cabinet.trim(),
      inscription_cncc: inscription_cncc?.trim() || null,
      email: email?.trim() || null,
    }

    const { data: profile, error: insertError } = await supabase
      .from('profiles')
      .insert(profileData)
      .select()
      .single()

    if (insertError) {
      console.error('Profile insert error:', insertError)
      return NextResponse.json(
        { error: 'Erreur lors de la creation du profil.', code: 'INSERT_ERROR' },
        { status: 500 }
      )
    }

    return NextResponse.json({ data: profile }, { status: 201 })
  } catch (error) {
    console.error('Profile POST error:', error)
    return NextResponse.json(
      { error: 'Erreur interne.', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}

// ---------- PUT /api/profile ----------
export async function PUT(req: NextRequest) {
  try {
    const session = await getSessionFromCookie(req)
    if (!session) {
      return NextResponse.json(
        { error: 'Non autorise.', code: 'AUTH_REQUIRED' },
        { status: 401 }
      )
    }

    const body = await req.json()
    const { name, cabinet, inscription_cncc, email } = body

    // Build update object with only provided fields
    const updateData: Record<string, string | null> = {}

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        return NextResponse.json(
          { error: 'Le nom ne peut pas etre vide.', code: 'INVALID_NAME' },
          { status: 400 }
        )
      }
      updateData.name = name.trim()
    }

    if (cabinet !== undefined) {
      if (typeof cabinet !== 'string' || cabinet.trim().length === 0) {
        return NextResponse.json(
          { error: 'Le nom du cabinet ne peut pas etre vide.', code: 'INVALID_CABINET' },
          { status: 400 }
        )
      }
      updateData.cabinet = cabinet.trim()
    }

    if (inscription_cncc !== undefined) {
      updateData.inscription_cncc = inscription_cncc?.trim() || null
    }

    if (email !== undefined) {
      updateData.email = email?.trim() || null
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'Aucune donnee a mettre a jour.', code: 'NO_DATA' },
        { status: 400 }
      )
    }

    // Add updated_at timestamp
    updateData.updated_at = new Date().toISOString()

    const supabase = createServerSupabaseClient()

    const { data: profile, error: updateError } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('license_id', session.license_id)
      .select()
      .single()

    if (updateError) {
      console.error('Profile update error:', updateError)
      // Check if profile exists
      if (updateError.code === 'PGRST116') {
        return NextResponse.json(
          {
            error: 'Aucun profil trouve. Creez un profil avec POST.',
            code: 'PROFILE_NOT_FOUND',
          },
          { status: 404 }
        )
      }
      return NextResponse.json(
        { error: 'Erreur lors de la mise a jour du profil.', code: 'UPDATE_ERROR' },
        { status: 500 }
      )
    }

    if (!profile) {
      return NextResponse.json(
        {
          error: 'Aucun profil trouve pour cette licence.',
          code: 'PROFILE_NOT_FOUND',
        },
        { status: 404 }
      )
    }

    return NextResponse.json({ data: profile })
  } catch (error) {
    console.error('Profile PUT error:', error)
    return NextResponse.json(
      { error: 'Erreur interne.', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}
