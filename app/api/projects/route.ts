import { NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import {
  requireSession,
  errorResponse,
  successResponse,
} from '@/lib/auth/helpers'

// GET /api/projects — List all projects for the current license
export async function GET(req: NextRequest) {
  let session
  try {
    session = await requireSession(req)
  } catch (response) {
    return response as Response
  }

  const supabase = createServerSupabaseClient()

  const { data: projects, error } = await supabase
    .from('projects')
    .select('*')
    .eq('license_id', session.license_id)
    .order('created_at', { ascending: false })

  if (error) {
    return errorResponse(
      'Erreur lors de la recuperation des projets.',
      'INTERNAL_ERROR',
      500
    )
  }

  return successResponse(projects ?? [])
}

// POST /api/projects — Create a new project
export async function POST(req: NextRequest) {
  let session
  try {
    session = await requireSession(req)
  } catch (response) {
    return response as Response
  }

  let body: { name?: string; description?: string }
  try {
    body = await req.json()
  } catch {
    return errorResponse('Corps de requete invalide.', 'VALIDATION_ERROR', 400)
  }

  const { name, description } = body

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return errorResponse(
      'Le champ "name" est requis et doit etre une chaine non vide.',
      'VALIDATION_ERROR',
      400
    )
  }

  const supabase = createServerSupabaseClient()
  const now = new Date().toISOString()

  const { data: project, error: insertError } = await supabase
    .from('projects')
    .insert({
      license_id: session.license_id,
      name: name.trim(),
      description: description?.trim() || null,
      created_at: now,
      updated_at: now,
    })
    .select()
    .single()

  if (insertError || !project) {
    return errorResponse(
      'Erreur lors de la creation du projet.',
      'INTERNAL_ERROR',
      500
    )
  }

  return successResponse(project, 201)
}
