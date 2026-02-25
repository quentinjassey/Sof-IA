// =============================================================================
// SOF'IA -- API Route: /api/missions/[id]/deliverables
//
// GET  - List all deliverables for a mission
// POST - Generate/regenerate all deliverables (or specific types)
//
// All routes verify the session cookie and filter by license_id.
// POST creates a trace entry: actor='sofia', action='deliverables_generated'
// or action='deliverables_regenerated'.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromServerCookies } from '@/lib/auth/session'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import {
  generateAllDeliverables,
  regenerateDeliverables,
} from '@/lib/services/deliverable-generator'
import type { DeliverableType, TraceInsert } from '@/types/database'

// Valid deliverable types for request validation
const VALID_DELIVERABLE_TYPES: DeliverableType[] = [
  'checklist_completude',
  'tableau_signaux',
  'tableau_rapprochement',
  'synthese_preanalyse',
  'journal_tracabilite',
]

// -----------------------------------------------------------------------------
// GET /api/missions/[id]/deliverables
// Returns all deliverables for the given mission.
// -----------------------------------------------------------------------------

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify session
    const session = await getSessionFromServerCookies()
    if (!session) {
      return NextResponse.json(
        { error: 'Session invalide ou absente.', code: 'UNAUTHORIZED' },
        { status: 401 }
      )
    }

    const { id: missionId } = await params
    const supabase = createServerSupabaseClient()

    // Verify mission belongs to this license
    const { data: mission, error: missionError } = await supabase
      .from('missions')
      .select('id')
      .eq('id', missionId)
      .eq('license_id', session.license_id)
      .single()

    if (missionError || !mission) {
      return NextResponse.json(
        { error: 'Mission introuvable.', code: 'MISSION_NOT_FOUND' },
        { status: 404 }
      )
    }

    // Fetch deliverables
    const { data: deliverables, error: deliverablesError } = await supabase
      .from('deliverables')
      .select('*')
      .eq('mission_id', missionId)
      .order('generated_at', { ascending: false })

    if (deliverablesError) {
      return NextResponse.json(
        { error: 'Erreur lors de la recuperation des livrables.', code: 'INTERNAL_ERROR' },
        { status: 500 }
      )
    }

    return NextResponse.json({ data: deliverables || [] })
  } catch (error) {
    console.error('[GET /api/missions/[id]/deliverables] Error:', error)
    return NextResponse.json(
      { error: 'Erreur interne du serveur.', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}

// -----------------------------------------------------------------------------
// POST /api/missions/[id]/deliverables
// Generates or regenerates deliverables.
//
// Request body (optional):
//   { types?: DeliverableType[] }
//   If types is omitted, all 4 deliverables are generated.
//
// Side effects:
//   1. Fetches signals, completeness, traces, profile from Supabase
//   2. Generates PDF/XLSX files using pdfmake/exceljs
//   3. Uploads files to Supabase Storage (deliverables bucket)
//   4. Upserts deliverable records in DB
//   5. Creates trace entry: actor='sofia', action='deliverables_generated' or
//      'deliverables_regenerated'
// -----------------------------------------------------------------------------

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify session
    const session = await getSessionFromServerCookies()
    if (!session) {
      return NextResponse.json(
        { error: 'Session invalide ou absente.', code: 'UNAUTHORIZED' },
        { status: 401 }
      )
    }

    const { id: missionId } = await params
    const supabase = createServerSupabaseClient()

    // Verify mission belongs to this license
    const { data: mission, error: missionError } = await supabase
      .from('missions')
      .select('id, status')
      .eq('id', missionId)
      .eq('license_id', session.license_id)
      .single()

    if (missionError || !mission) {
      return NextResponse.json(
        { error: 'Mission introuvable.', code: 'MISSION_NOT_FOUND' },
        { status: 404 }
      )
    }

    // Parse optional request body for specific types
    let types: DeliverableType[] | undefined
    try {
      const body = await request.json().catch(() => ({}))
      if (body.types && Array.isArray(body.types)) {
        // Validate provided types
        const invalidTypes = body.types.filter(
          (t: string) => !VALID_DELIVERABLE_TYPES.includes(t as DeliverableType)
        )
        if (invalidTypes.length > 0) {
          return NextResponse.json(
            {
              error: `Types de livrables invalides : ${invalidTypes.join(', ')}`,
              code: 'VALIDATION_ERROR',
            },
            { status: 400 }
          )
        }
        types = body.types as DeliverableType[]
      }
    } catch {
      // No body or invalid JSON is acceptable (generates all)
    }

    // Check if deliverables already exist (determines if this is generation or regeneration)
    const { data: existingDeliverables } = await supabase
      .from('deliverables')
      .select('id')
      .eq('mission_id', missionId)

    const isRegeneration = existingDeliverables && existingDeliverables.length > 0

    // Generate/regenerate deliverables
    let deliverables
    if (types) {
      deliverables = await regenerateDeliverables(
        supabase,
        missionId,
        session.license_id,
        types
      )
    } else {
      deliverables = await generateAllDeliverables(
        supabase,
        missionId,
        session.license_id
      )
    }

    // Fetch profile for trace actor_name
    const { data: profile } = await supabase
      .from('profiles')
      .select('name, inscription_cncc')
      .eq('license_id', session.license_id)
      .single()

    // Create trace entry
    const traceAction = isRegeneration ? 'deliverables_regenerated' : 'deliverables_generated'
    const traceDetails = types
      ? `${deliverables.length} livrable(s) regenere(s) : ${types.join(', ')}`
      : `${deliverables.length} livrables generes`

    const traceEntry: TraceInsert = {
      mission_id: missionId,
      license_id: session.license_id,
      timestamp: new Date().toISOString(),
      actor: 'sofia',
      actor_name: 'Sof\'IA',
      action: traceAction,
      target_type: 'deliverable',
      details: traceDetails,
    }

    // Also add a user trace if this is a manual regeneration
    if (isRegeneration && profile) {
      const userTraceEntry: TraceInsert = {
        mission_id: missionId,
        license_id: session.license_id,
        timestamp: new Date().toISOString(),
        actor: 'user',
        actor_name: `${profile.name}${profile.inscription_cncc ? `, CAC (${profile.inscription_cncc})` : ''}`,
        action: 'deliverables_regenerated',
        target_type: 'deliverable',
        details: `Regeneration des livrables demandee par le commissaire aux comptes`,
      }

      await supabase.from('traces').insert([traceEntry, userTraceEntry])
    } else {
      await supabase.from('traces').insert(traceEntry)
    }

    return NextResponse.json({ data: deliverables })
  } catch (error) {
    console.error('[POST /api/missions/[id]/deliverables] Error:', error)

    const message = error instanceof Error ? error.message : 'Erreur interne du serveur.'
    return NextResponse.json(
      { error: message, code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}
