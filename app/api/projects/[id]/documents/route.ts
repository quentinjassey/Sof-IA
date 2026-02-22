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
  'fec', 'facture_vente', 'facture_achat', 'bon_livraison',
  'contrat', 'annexe', 'bilan', 'compte_resultat', 'autre',
]

function detectDocumentType(filename: string): DocumentType {
  const lower = filename.toLowerCase()

  if (lower.endsWith('.txt') || lower.endsWith('.csv')) {
    if (lower.includes('fec')) return 'fec'
  }
  if (lower.includes('facture') && lower.includes('achat')) return 'facture_achat'
  if (lower.includes('facture') || lower.startsWith('fa-') || lower.startsWith('fa_')) return 'facture_vente'
  if (lower.includes('bon') || lower.includes('livraison') || lower.startsWith('bl-') || lower.startsWith('bl_')) return 'bon_livraison'
  if (lower.includes('contrat') || lower.startsWith('ct-') || lower.startsWith('ct_')) return 'contrat'
  if (lower.includes('annexe')) return 'annexe'
  if (lower.includes('bilan')) return 'bilan'
  if (lower.includes('compte') && lower.includes('resultat')) return 'compte_resultat'
  if (lower.includes('fec')) return 'fec'

  return 'autre'
}

// GET /api/projects/[id]/documents — List documents for a project
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

  try {
    await requireProjectOwnership(id, session.license_id)
  } catch (response) {
    return response as Response
  }

  const supabase = createServerSupabaseClient()

  const { data: documents, error } = await supabase
    .from('documents')
    .select('*')
    .eq('project_id', id)
    .order('added_at', { ascending: true })

  if (error) {
    return errorResponse('Erreur lors de la recuperation des documents.', 'INTERNAL_ERROR', 500)
  }

  return successResponse(documents ?? [])
}

// POST /api/projects/[id]/documents — Upload documents to a project
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params

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

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return errorResponse('Requete invalide. Un formulaire multipart est attendu.', 'VALIDATION_ERROR', 400)
  }

  const files: File[] = []
  for (const entry of formData.getAll('files')) {
    if (entry instanceof File) files.push(entry)
  }
  const singleFile = formData.get('file')
  if (singleFile instanceof File) files.push(singleFile)

  if (files.length === 0) {
    return errorResponse('Aucun fichier fourni.', 'VALIDATION_ERROR', 400)
  }

  const typesRaw = formData.getAll('types')
  const types: (DocumentType | null)[] = typesRaw.map((t) => {
    const typeStr = t.toString()
    return VALID_DOC_TYPES.includes(typeStr as DocumentType) ? (typeStr as DocumentType) : null
  })

  const supabase = createServerSupabaseClient()
  const uploadedDocs: Record<string, unknown>[] = []

  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    const docType: DocumentType = types[i] ?? detectDocumentType(file.name)
    const storagePath = `documents/${projectId}/${file.name}`

    const fileBuffer = Buffer.from(await file.arrayBuffer())

    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(storagePath, fileBuffer, {
        contentType: file.type || 'application/octet-stream',
        upsert: true,
      })

    if (uploadError) {
      console.error(`Erreur upload ${file.name}:`, uploadError.message)
      continue
    }

    const { data: doc, error: insertError } = await supabase
      .from('documents')
      .insert({
        project_id: projectId,
        mission_id: null,
        license_id: session.license_id,
        type: docType,
        filename: file.name,
        storage_path: storagePath,
        file_size: file.size,
        status: 'present',
        added_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (insertError || !doc) {
      console.error(`Erreur insertion document ${file.name}:`, insertError?.message)
      continue
    }

    uploadedDocs.push(doc)
  }

  if (uploadedDocs.length === 0) {
    return errorResponse(
      'Aucun document n\'a pu etre envoye. Verifiez les fichiers et reessayez.',
      'UPLOAD_FAILED',
      500
    )
  }

  return successResponse(uploadedDocs, 201)
}

// DELETE /api/projects/[id]/documents?documentId=uuid
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params

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

  const url = new URL(req.url)
  const documentId = url.searchParams.get('documentId')

  if (!documentId) {
    return errorResponse('Le parametre "documentId" est requis.', 'VALIDATION_ERROR', 400)
  }

  const supabase = createServerSupabaseClient()

  const { data: document, error: fetchError } = await supabase
    .from('documents')
    .select('*')
    .eq('id', documentId)
    .eq('project_id', projectId)
    .single()

  if (fetchError || !document) {
    return errorResponse('Document non trouve dans ce projet.', 'NOT_FOUND', 404)
  }

  await supabase.storage.from('documents').remove([document.storage_path])

  const { error: deleteError } = await supabase
    .from('documents')
    .delete()
    .eq('id', documentId)

  if (deleteError) {
    return errorResponse('Erreur lors de la suppression du document.', 'INTERNAL_ERROR', 500)
  }

  return successResponse({ success: true as const })
}
