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
import { getCompanyWithDiscrepancies as getCutoffCompanyWithDiscrepancies } from '@/lib/config/cutoff-companies'
import { generateAllCutoffPdfs } from '@/lib/services/cutoff-pdf-generator'

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

  // Verify this is a pointage or cutoff scenario with a company assigned
  if (mission.scenario !== 'pointage' && mission.scenario !== 'cutoff') {
    return errorResponse(
      'Les documents de demonstration ne sont disponibles que pour les scenarios "Pointage" et "Cut-off".',
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

  // ---- CUTOFF SCENARIO ----
  if (mission.scenario === 'cutoff') {
    const cutoffCompany = getCutoffCompanyWithDiscrepancies(mission.company_id, missionId)
    if (!cutoffCompany) {
      return errorResponse(
        `Entreprise introuvable : ${mission.company_id}`,
        'INTERNAL_ERROR',
        500
      )
    }

    // Generate all cutoff documents (FEC + invoices + delivery notes)
    let cutoffPdfs
    try {
      cutoffPdfs = await generateAllCutoffPdfs(cutoffCompany)
    } catch (err) {
      console.error('Erreur generation PDFs cutoff:', err)
      return errorResponse(
        'Erreur lors de la generation des documents PDF.',
        'INTERNAL_ERROR',
        500
      )
    }

    const documentsToCreate: Array<{ type: string; filename: string; buffer: Buffer; label: string; contentType: string }> = []

    // FEC (text file)
    documentsToCreate.push({
      type: 'fec',
      filename: `FEC_${cutoffCompany.id}_2025.txt`,
      buffer: cutoffPdfs.fec,
      label: 'Fichier des ecritures comptables (FEC)',
      contentType: 'text/plain',
    })

    // Invoices (PDFs)
    for (const inv of cutoffPdfs.invoices) {
      const typeLabel = inv.type === 'avoir' ? 'facture_vente' : inv.type === 'achat' ? 'facture_achat' : 'facture_vente'
      documentsToCreate.push({
        type: typeLabel,
        filename: `${inv.ref.replace(/\//g, '-')}.pdf`,
        buffer: inv.buffer,
        label: `${inv.type === 'avoir' ? 'Avoir' : inv.type === 'achat' ? 'Facture fournisseur' : 'Facture de vente'} ${inv.ref}`,
        contentType: 'application/pdf',
      })
    }

    // Delivery / Reception notes (PDFs)
    for (const dn of cutoffPdfs.delivery_notes) {
      const typeLabel = dn.type === 'reception' ? 'bon_livraison' : 'bon_livraison'
      documentsToCreate.push({
        type: typeLabel,
        filename: `${dn.ref.replace(/\//g, '-')}.pdf`,
        buffer: dn.buffer,
        label: `${dn.type === 'reception' ? 'Bon de reception' : 'Bon de livraison'} ${dn.ref}`,
        contentType: 'application/pdf',
      })
    }

    const createdDocs = []
    const actorName = await getActorName(session.license_id)

    for (const doc of documentsToCreate) {
      const storagePath = `${missionId}/${doc.filename}`

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(storagePath, doc.buffer, {
          contentType: doc.contentType,
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

      await createTrace({
        mission_id: missionId,
        license_id: session.license_id,
        actor: 'user',
        actor_name: actorName,
        action: 'document_added',
        target_type: 'document',
        target_id: docRecord.id,
        details: `Document de demonstration charge : ${doc.label} (${cutoffCompany.name})`,
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
        company_name: cutoffCompany.name,
        message: `${createdDocs.length} documents de demonstration charges pour ${cutoffCompany.name}.`,
      },
      201
    )
  }

  // ---- POINTAGE SCENARIO ----
  const company = getCompanyWithDiscrepancies(mission.company_id, missionId)
  if (!company) {
    return errorResponse(
      `Entreprise introuvable : ${mission.company_id}`,
      'INTERNAL_ERROR',
      500
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
