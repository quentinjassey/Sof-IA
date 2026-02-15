// =============================================================================
// GET /api/missions/[id]/traces
// Immutable audit trail for a mission — chronological log of all actions.
//
// The traces table is append-only. No UPDATE or DELETE is permitted.
// Every action (Sof'IA and CAC) is recorded with precise timestamps.
// This is required for NEP 230 compliance (audit documentation).
//
// Supports filtering by actor type: ?actor=sofia or ?actor=user
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getSessionFromServerCookies } from '@/lib/auth/session'
import type { ActorType } from '@/types/database'

const VALID_ACTORS: ActorType[] = ['sofia', 'user']
const DEFAULT_LIMIT = 200
const MAX_LIMIT = 1000

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Verify session
    const session = await getSessionFromServerCookies()
    if (!session) {
      return NextResponse.json(
        { error: 'Session non valide. Veuillez vous reconnecter.', code: 'UNAUTHORIZED' },
        { status: 401 }
      )
    }

    const { id: missionId } = await params
    const supabase = createServerSupabaseClient()

    // 2. Verify mission belongs to this license
    const { data: mission, error: missionError } = await supabase
      .from('missions')
      .select('id, license_id')
      .eq('id', missionId)
      .eq('license_id', session.license_id)
      .single()

    if (missionError || !mission) {
      return NextResponse.json(
        { error: 'Mission non trouvee.', code: 'MISSION_NOT_FOUND' },
        { status: 404 }
      )
    }

    // 3. Parse query parameters
    const searchParams = request.nextUrl.searchParams
    const actorFilter = searchParams.get('actor') as ActorType | null
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, parseInt(searchParams.get('limit') || String(DEFAULT_LIMIT), 10))
    )

    // 4. Validate actor filter
    if (actorFilter && !VALID_ACTORS.includes(actorFilter)) {
      return NextResponse.json(
        {
          error: `Acteur invalide. Valeurs acceptees : ${VALID_ACTORS.join(', ')}`,
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
      )
    }

    // 5. Build query — chronological order (oldest first for audit trail)
    let query = supabase
      .from('traces')
      .select('*')
      .eq('mission_id', missionId)
      .order('timestamp', { ascending: true })
      .limit(limit)

    // Apply actor filter if specified
    if (actorFilter) {
      query = query.eq('actor', actorFilter)
    }

    // 6. Execute query
    const { data: traces, error: queryError } = await query

    if (queryError) {
      console.error('Erreur lors de la recuperation des traces:', queryError)
      return NextResponse.json(
        { error: 'Erreur lors de la recuperation du journal de tracabilite.', code: 'INTERNAL_ERROR' },
        { status: 500 }
      )
    }

    return NextResponse.json({ data: traces || [] })
  } catch (error) {
    console.error('Erreur inattendue dans GET /traces:', error)
    return NextResponse.json(
      { error: 'Erreur interne du serveur.', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}
