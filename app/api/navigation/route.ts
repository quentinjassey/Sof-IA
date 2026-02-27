import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getSessionFromServerCookies } from '@/lib/auth/session'

export async function GET(_request: NextRequest) {
  try {
    const session = await getSessionFromServerCookies()
    if (!session) {
      return NextResponse.json(
        { error: 'Session non valide.', code: 'UNAUTHORIZED' },
        { status: 401 }
      )
    }

    const supabase = createServerSupabaseClient()
    const license_id = session.license_id

    const [projectsRes, missionsRes] = await Promise.all([
      supabase
        .from('projects')
        .select('id, name')
        .eq('license_id', license_id)
        .order('created_at', { ascending: false }),
      supabase
        .from('missions')
        .select('id, name, project_id, scenario, status')
        .eq('license_id', license_id)
        .order('created_at', { ascending: false }),
    ])

    return NextResponse.json({
      data: {
        projects: projectsRes.data || [],
        missions: missionsRes.data || [],
      },
    })
  } catch (error) {
    console.error('Erreur dans GET /api/navigation:', error)
    return NextResponse.json(
      { error: 'Erreur interne du serveur.', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}
