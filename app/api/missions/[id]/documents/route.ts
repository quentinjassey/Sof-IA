// app/api/missions/[id]/documents/route.ts
// GET:    List all documents for a mission
// POST:   Upload documents (FormData with files + types)
// PATCH:  Update document type(s) (single or bulk)
// DELETE: Remove document(s) (single or bulk)

import { NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import {
  requireSession,
  requireMissionOwnership,
  getActorName,
  createTrace,
  errorResponse,
  successResponse,
} from '@/lib/auth/helpers'
import type { DocumentType } from '@/types/database'
import { getExpectedDocuments, type ScenarioType } from '@/lib/config/expected-documents'

// Valid document types
const VALID_DOC_TYPES: DocumentType[] = [
  'fec',
  'facture_vente',
  'facture_achat',
  'bon_livraison',
  'contrat',
  'annexe',
  'bilan',
  'compte_resultat',
  'autre',
]

/**
 * Auto-detect document type from filename.
 * Falls back to 'autre' if no pattern matches.
 */
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

// ---------------------------------------------------------------
// GET /api/missions/[id]/documents — List documents for a mission
// ---------------------------------------------------------------

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

  // Verify mission ownership
  try {
    await requireMissionOwnership(id, session.license_id)
  } catch (response) {
    return response as Response
  }

  const supabase = createServerSupabaseClient()

  const { data: documents, error } = await supabase
    .from('documents')
    .select('*')
    .eq('mission_id', id)
    .order('added_at', { ascending: true })

  if (error) {
    return errorResponse(
      'Erreur lors de la recuperation des documents.',
      'INTERNAL_ERROR',
      500
    )
  }

  return successResponse(documents ?? [])
}

// ---------------------------------------------------------------
// POST /api/missions/[id]/documents — Upload documents
// Expects FormData with:
//   - files: File[] (one or more files)
//   - types: string[] (optional, parallel array of document types)
// ---------------------------------------------------------------

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: missionId } = await params

  let session
  try {
    session = await requireSession(req)
  } catch (response) {
    return response as Response
  }

  let mission
  try {
    mission = await requireMissionOwnership(missionId, session.license_id)
  } catch (response) {
    return response as Response
  }

  // Parse FormData
  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return errorResponse(
      'Requete invalide. Un formulaire multipart est attendu.',
      'VALIDATION_ERROR',
      400
    )
  }

  // Extract files
  const files: File[] = []
  const entries = formData.getAll('files')
  for (const entry of entries) {
    if (entry instanceof File) {
      files.push(entry)
    }
  }

  // Also support single 'file' field
  const singleFile = formData.get('file')
  if (singleFile instanceof File) {
    files.push(singleFile)
  }

  if (files.length === 0) {
    return errorResponse(
      'Aucun fichier fourni. Ajoutez des fichiers dans le champ "files" ou "file".',
      'VALIDATION_ERROR',
      400
    )
  }

  // Extract optional types array
  const typesRaw = formData.getAll('types')
  const types: (DocumentType | null)[] = typesRaw.map((t) => {
    const typeStr = t.toString()
    return VALID_DOC_TYPES.includes(typeStr as DocumentType)
      ? (typeStr as DocumentType)
      : null
  })

  const supabase = createServerSupabaseClient()
  const uploadedDocs: Record<string, unknown>[] = []
  const actorName = await getActorName(session.license_id)

  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    const docType: DocumentType = types[i] ?? detectDocumentType(file.name)
    const storagePath = `documents/${missionId}/${file.name}`

    // Upload file to Supabase Storage
    const fileBuffer = Buffer.from(await file.arrayBuffer())

    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(storagePath, fileBuffer, {
        contentType: file.type || 'application/octet-stream',
        upsert: true, // Overwrite if same filename
      })

    if (uploadError) {
      // Continue with other files but log the error
      console.error(`Erreur upload ${file.name}:`, uploadError.message)
      continue
    }

    // Insert document record in DB
    const { data: doc, error: insertError } = await supabase
      .from('documents')
      .insert({
        mission_id: missionId,
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

    // Create trace: document_added
    await createTrace({
      mission_id: missionId,
      license_id: session.license_id,
      actor: 'user',
      actor_name: actorName,
      action: 'document_added',
      target_type: 'document',
      target_id: doc.id,
      details: `Document ajoute : "${file.name}" (type: ${docType}, taille: ${file.size} octets)`,
    })
  }

  if (uploadedDocs.length === 0) {
    return errorResponse(
      'Aucun document n\'a pu etre envoye. Verifiez les fichiers et reessayez.',
      'UPLOAD_FAILED',
      500
    )
  }

  // Check if all required documents are now present; if so, update mission status
  const scenarioType = mission.scenario as ScenarioType
  const expectedDocs = getExpectedDocuments(scenarioType)
  const requiredDocs = expectedDocs.filter((d) => d.required)

  // Get all current documents for this mission
  const { data: allDocs } = await supabase
    .from('documents')
    .select('type')
    .eq('mission_id', missionId)

  const presentTypes = new Set((allDocs ?? []).map((d) => d.type))
  const allRequiredPresent = requiredDocs.every((rd) => presentTypes.has(rd.type))

  if (allRequiredPresent && (mission.status === 'created' || mission.status === 'upload_failed')) {
    await supabase
      .from('missions')
      .update({
        status: 'documents_ready',
        updated_at: new Date().toISOString(),
      })
      .eq('id', missionId)
  }

  return successResponse(uploadedDocs, 201)
}

// ---------------------------------------------------------------
// PATCH /api/missions/[id]/documents — Update document type(s)
// Body: { documentIds: string[], type: string }
//    or { documentId: string, type: string }
// ---------------------------------------------------------------

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: missionId } = await params

  let session
  try {
    session = await requireSession(req)
  } catch (response) {
    return response as Response
  }

  try {
    await requireMissionOwnership(missionId, session.license_id)
  } catch (response) {
    return response as Response
  }

  // Parse body
  let body: { documentIds?: string[]; documentId?: string; type?: string }
  try {
    body = await req.json()
  } catch {
    return errorResponse('Corps de requete JSON invalide.', 'VALIDATION_ERROR', 400)
  }

  // Normalize to array of IDs
  const docIds: string[] = body.documentIds ?? (body.documentId ? [body.documentId] : [])
  const newType = body.type

  if (docIds.length === 0) {
    return errorResponse(
      'Le parametre "documentIds" ou "documentId" est requis.',
      'VALIDATION_ERROR',
      400
    )
  }

  if (!newType || !VALID_DOC_TYPES.includes(newType as DocumentType)) {
    return errorResponse(
      `Type de document invalide. Types acceptes : ${VALID_DOC_TYPES.join(', ')}`,
      'VALIDATION_ERROR',
      400
    )
  }

  const supabase = createServerSupabaseClient()
  const actorName = await getActorName(session.license_id)
  let updated = 0

  for (const docId of docIds) {
    // Fetch document to verify ownership and get old type
    const { data: doc, error: fetchError } = await supabase
      .from('documents')
      .select('id, type, filename')
      .eq('id', docId)
      .eq('mission_id', missionId)
      .single()

    if (fetchError || !doc) {
      continue // Skip documents not belonging to this mission
    }

    const oldType = doc.type

    // Update type
    const { error: updateError } = await supabase
      .from('documents')
      .update({ type: newType })
      .eq('id', docId)

    if (updateError) {
      console.error(`Erreur mise a jour type document ${docId}:`, updateError.message)
      continue
    }

    updated++

    // Create trace entry
    await createTrace({
      mission_id: missionId,
      license_id: session.license_id,
      actor: 'user',
      actor_name: actorName,
      action: 'document_type_changed',
      target_type: 'document',
      target_id: docId,
      details: `Type du document "${doc.filename}" modifie : ${oldType} → ${newType}`,
    })
  }

  return successResponse({ updated })
}

// ---------------------------------------------------------------
// DELETE /api/missions/[id]/documents
// Single:  ?documentId=uuid
// Bulk:    ?documentIds=uuid1,uuid2,uuid3
// ---------------------------------------------------------------

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: missionId } = await params

  let session
  try {
    session = await requireSession(req)
  } catch (response) {
    return response as Response
  }

  // Verify mission ownership
  try {
    await requireMissionOwnership(missionId, session.license_id)
  } catch (response) {
    return response as Response
  }

  // Get document IDs from query params
  const url = new URL(req.url)
  const singleId = url.searchParams.get('documentId')
  const bulkIds = url.searchParams.get('documentIds')

  // Build array of IDs to delete
  let docIds: string[] = []
  if (bulkIds) {
    docIds = bulkIds.split(',').map((id) => id.trim()).filter(Boolean)
  } else if (singleId) {
    docIds = [singleId]
  }

  if (docIds.length === 0) {
    return errorResponse(
      'Le parametre "documentId" ou "documentIds" est requis.',
      'VALIDATION_ERROR',
      400
    )
  }

  const supabase = createServerSupabaseClient()
  const actorName = await getActorName(session.license_id)
  let deleted = 0
  let errors = 0

  for (const docId of docIds) {
    // Verify document belongs to this mission
    const { data: document, error: fetchError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', docId)
      .eq('mission_id', missionId)
      .single()

    if (fetchError || !document) {
      errors++
      continue
    }

    // Delete from Supabase Storage
    const { error: storageError } = await supabase.storage
      .from('documents')
      .remove([document.storage_path])

    if (storageError) {
      console.error(`Erreur suppression Storage ${document.storage_path}:`, storageError.message)
      // Continue anyway — the DB record is the source of truth
    }

    // Delete from DB
    const { error: deleteError } = await supabase
      .from('documents')
      .delete()
      .eq('id', docId)

    if (deleteError) {
      errors++
      continue
    }

    deleted++

    // Create trace: document_deleted
    await createTrace({
      mission_id: missionId,
      license_id: session.license_id,
      actor: 'user',
      actor_name: actorName,
      action: 'document_deleted',
      target_type: 'document',
      target_id: docId,
      details: `Document supprime : "${document.filename}"`,
    })
  }

  // For single deletes, keep backward-compatible response shape
  if (!bulkIds) {
    if (deleted === 0) {
      return errorResponse(
        'Document non trouve dans cette mission.',
        'NOT_FOUND',
        404
      )
    }
    return successResponse({ success: true as const })
  }

  return successResponse({ deleted, errors })
}
