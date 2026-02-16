// app/api/missions/[id]/documents/demo/route.ts
// POST: Generate demo financial statement PDFs for pointage scenario
//   1. Read mission.company_id
//   2. Generate 3 PDFs (bilan, CR, annexe)
//   3. Upload to Supabase Storage
//   4. Create document records
//   5. Create trace entries

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
import { getCompanyWithDiscrepancies } from '@/lib/config/pointage-companies'
import { generateAllPointagePdfs } from '@/lib/services/pointage-pdf-generator'

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

  // Verify this is a pointage scenario with a company assigned
  if (mission.scenario !== 'pointage') {
    return errorResponse(
      'Les documents de demonstration ne sont disponibles que pour le scenario "Pointage".',
      'VALIDATION_ERROR',
      400
    )
  }

  if (!mission.company_id) {
    return errorResponse(
      'Aucune entreprise n\'est assignee a cette mission.',
      'VALIDATION_ERROR',
      400
    )
  }

  const company = getCompanyWithDiscrepancies(mission.company_id, missionId)
  if (!company) {
    return errorResponse(
      `Entreprise introuvable : ${mission.company_id}`,
      'INTERNAL_ERROR',
      500
    )
  }

  const supabase = createServerSupabaseClient()

  // Check if documents already exist for this mission
  const { data: existingDocs } = await supabase
    .from('documents')
    .select('id')
    .eq('mission_id', missionId)

  if (existingDocs && existingDocs.length > 0) {
    return errorResponse(
      'Des documents existent deja pour cette mission. Supprimez-les avant de charger les documents de demonstration.',
      'VALIDATION_ERROR',
      409
    )
  }

  // Generate the 3 PDFs
  let pdfs
  try {
    pdfs = await generateAllPointagePdfs(company)
  } catch (err) {
    console.error('Erreur generation PDFs pointage:', err)
    return errorResponse(
      'Erreur lors de la generation des documents PDF.',
      'INTERNAL_ERROR',
      500
    )
  }

  // Upload to Supabase Storage and create document records
  const documentsToCreate = [
    {
      type: 'bilan' as const,
      filename: `bilan_${company.id}_2025.pdf`,
      buffer: pdfs.bilan,
      label: 'Bilan',
    },
    {
      type: 'compte_resultat' as const,
      filename: `compte_resultat_${company.id}_2025.pdf`,
      buffer: pdfs.cr,
      label: 'Compte de resultat',
    },
    {
      type: 'annexe' as const,
      filename: `annexe_${company.id}_2025.pdf`,
      buffer: pdfs.annexe,
      label: 'Annexe aux comptes annuels',
    },
  ]

  const createdDocs = []

  for (const doc of documentsToCreate) {
    const storagePath = `${missionId}/${doc.filename}`

    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(storagePath, doc.buffer, {
        contentType: 'application/pdf',
        upsert: true,
      })

    if (uploadError) {
      console.error(`Erreur upload ${doc.filename}:`, uploadError.message)
      return errorResponse(
        `Erreur lors de l'envoi du document "${doc.filename}".`,
        'INTERNAL_ERROR',
        500
      )
    }

    // Create document record
    const { data: docRecord, error: insertError } = await supabase
      .from('documents')
      .insert({
        mission_id: missionId,
        license_id: session.license_id,
        type: doc.type,
        filename: doc.filename,
        storage_path: storagePath,
        file_size: doc.buffer.length,
        status: 'present',
      })
      .select()
      .single()

    if (insertError) {
      console.error(`Erreur insertion document ${doc.filename}:`, insertError.message)
      return errorResponse(
        `Erreur lors de l'enregistrement du document "${doc.filename}".`,
        'INTERNAL_ERROR',
        500
      )
    }

    createdDocs.push(docRecord)

    // Create trace for each document
    await createTrace({
      mission_id: missionId,
      license_id: session.license_id,
      actor: 'user',
      actor_name: await getActorName(session.license_id),
      action: 'document_added',
      target_type: 'document',
      target_id: docRecord.id,
      details: `Document de demonstration charge : ${doc.label} (${company.name})`,
    })
  }

  // Update mission status to documents_ready
  await supabase
    .from('missions')
    .update({
      status: 'documents_ready',
      updated_at: new Date().toISOString(),
    })
    .eq('id', missionId)

  return successResponse(
    {
      documents: createdDocs,
      company_name: company.name,
      message: `3 documents de demonstration charges pour ${company.name}.`,
    },
    201
  )
}
