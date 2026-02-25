import { NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import {
  requireSession,
  requireProjectOwnership,
  errorResponse,
  successResponse,
} from '@/lib/auth/helpers'
import type { DocumentType } from '@/types/database'

const VALID_DOC_TYPES: DocumentType[] = [
  'fec', 'facture_vente', 'facture_achat', 'bon_livraison', 'bon_commande',
  'contrat', 'annexe', 'bilan', 'compte_resultat', 'autre',
]

// GET /api/projects/[id]/documents/[docId] — Get single document
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  const { id: projectId, docId } = await params

  let session
  try {
    session = await requireSession(req)
  } catch (response) {
    return response as Response
  }

  try {
    await requireProjectOwnership(projectId, session.license_id)
  } catch (response) {
    return response as Response
  }

  const supabase = createServerSupabaseClient()

  const { data: doc, error } = await supabase
    .from('documents')
    .select('*')
    .eq('id', docId)
    .eq('project_id', projectId)
    .single()

  if (error || !doc) {
    return errorResponse('Document non trouve.', 'NOT_FOUND', 404)
  }

  return successResponse(doc)
}

// PATCH /api/projects/[id]/documents/[docId] — Reclassify a document
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  const { id: projectId, docId } = await params

  let session
  try {
    session = await requireSession(req)
  } catch (response) {
    return response as Response
  }

  try {
    await requireProjectOwnership(projectId, session.license_id)
  } catch (response) {
    return response as Response
  }

  let body: { type?: string }
  try {
    body = await req.json()
  } catch {
    return errorResponse('Corps de requete invalide.', 'VALIDATION_ERROR', 400)
  }

  if (!body.type || !VALID_DOC_TYPES.includes(body.type as DocumentType)) {
    return errorResponse(
      `Le champ "type" doit etre l'un de : ${VALID_DOC_TYPES.join(', ')}.`,
      'VALIDATION_ERROR',
      400
    )
  }

  const supabase = createServerSupabaseClient()

  const { data: existingDoc, error: fetchError } = await supabase
    .from('documents')
    .select('id')
    .eq('id', docId)
    .eq('project_id', projectId)
    .single()

  if (fetchError || !existingDoc) {
    return errorResponse('Document non trouve dans ce projet.', 'NOT_FOUND', 404)
  }

  const { data: updated, error: updateError } = await supabase
    .from('documents')
    .update({ type: body.type })
    .eq('id', docId)
    .select()
    .single()

  if (updateError || !updated) {
    return errorResponse('Erreur lors de la reclassification.', 'INTERNAL_ERROR', 500)
  }

  return successResponse(updated)
}
