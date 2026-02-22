import { NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import {
  requireSession,
  requireProjectOwnership,
  errorResponse,
  successResponse,
} from '@/lib/auth/helpers'

// GET /api/projects/[id] — Get project detail with stats
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  let session
  try {
    session = await requireSession(req)
  } catch (response) {
    return response as Response
  }

  let project
  try {
    project = await requireProjectOwnership(id, session.license_id)
  } catch (response) {
    return response as Response
  }

  const supabase = createServerSupabaseClient()

  const [docsResult, missionsResult] = await Promise.all([
    supabase
      .from('documents')
      .select('id, type, filename, file_size, status, added_at, storage_path')
      .eq('project_id', id)
      .order('added_at', { ascending: true }),
    supabase
      .from('missions')
      .select('*')
      .eq('project_id', id)
      .order('created_at', { ascending: false }),
  ])

  return successResponse({
    ...project,
    documents: docsResult.data ?? [],
    missions: missionsResult.data ?? [],
    document_count: docsResult.data?.length ?? 0,
    mission_count: missionsResult.data?.length ?? 0,
  })
}

// PUT /api/projects/[id] — Update project
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  let session
  try {
    session = await requireSession(req)
  } catch (response) {
    return response as Response
  }

  try {
    await requireProjectOwnership(id, session.license_id)
  } catch (response) {
    return response as Response
  }

  let body: { name?: string; description?: string }
  try {
    body = await req.json()
  } catch {
    return errorResponse('Corps de requete invalide.', 'VALIDATION_ERROR', 400)
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.name !== undefined) updates.name = body.name.trim()
  if (body.description !== undefined) updates.description = body.description?.trim() || null

  const supabase = createServerSupabaseClient()

  const { data, error } = await supabase
    .from('projects')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error || !data) {
    return errorResponse('Erreur lors de la mise a jour du projet.', 'INTERNAL_ERROR', 500)
  }

  return successResponse(data)
}

// DELETE /api/projects/[id] — Delete project (cascade: missions, documents, etc.)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  let session
  try {
    session = await requireSession(req)
  } catch (response) {
    return response as Response
  }

  try {
    await requireProjectOwnership(id, session.license_id)
  } catch (response) {
    return response as Response
  }

  const supabase = createServerSupabaseClient()

  // Clean up storage files for project documents
  const { data: docs } = await supabase
    .from('documents')
    .select('storage_path')
    .eq('project_id', id)

  if (docs && docs.length > 0) {
    const paths = docs.map((d) => d.storage_path)
    await supabase.storage.from('documents').remove(paths)
  }

  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', id)

  if (error) {
    return errorResponse('Erreur lors de la suppression du projet.', 'INTERNAL_ERROR', 500)
  }

  return successResponse({ success: true as const })
}
