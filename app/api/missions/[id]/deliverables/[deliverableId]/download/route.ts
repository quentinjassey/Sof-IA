// =============================================================================
// SOF'IA -- API Route: /api/missions/[id]/deliverables/[deliverableId]/download
//
// GET - Download a specific deliverable file (PDF or XLSX)
//
// Generates a signed URL from Supabase Storage and streams the file back
// with the appropriate Content-Type and Content-Disposition headers.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromServerCookies } from '@/lib/auth/session'
import { createServerSupabaseClient } from '@/lib/supabase/server'

// MIME type mapping
const FORMAT_CONTENT_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}

// Human-readable filenames for downloads
const DELIVERABLE_FILENAMES: Record<string, string> = {
  checklist_completude: 'Sof_IA_Checklist_Completude',
  tableau_signaux: 'Sof_IA_Tableau_Signaux',
  synthese_preanalyse: 'Sof_IA_Synthese_PreAnalyse',
  journal_tracabilite: 'Sof_IA_Journal_Tracabilite',
}

// -----------------------------------------------------------------------------
// GET /api/missions/[id]/deliverables/[deliverableId]/download
// Downloads a specific deliverable file.
//
// Response:
//   - Binary file stream (PDF or XLSX)
//   - Content-Type: application/pdf or application/vnd.openxmlformats-...
//   - Content-Disposition: attachment; filename="..."
// -----------------------------------------------------------------------------

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; deliverableId: string }> }
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

    const { id: missionId, deliverableId } = await params
    const supabase = createServerSupabaseClient()

    // Verify mission belongs to this license
    const { data: mission, error: missionError } = await supabase
      .from('missions')
      .select('id, name')
      .eq('id', missionId)
      .eq('license_id', session.license_id)
      .single()

    if (missionError || !mission) {
      return NextResponse.json(
        { error: 'Mission introuvable.', code: 'MISSION_NOT_FOUND' },
        { status: 404 }
      )
    }

    // Fetch deliverable metadata
    const { data: deliverable, error: deliverableError } = await supabase
      .from('deliverables')
      .select('*')
      .eq('id', deliverableId)
      .eq('mission_id', missionId)
      .single()

    if (deliverableError || !deliverable) {
      return NextResponse.json(
        { error: 'Livrable introuvable.', code: 'DELIVERABLE_NOT_FOUND' },
        { status: 404 }
      )
    }

    // Verify storage_path exists
    if (!deliverable.storage_path) {
      return NextResponse.json(
        {
          error: 'Le fichier du livrable n\'est pas disponible. Veuillez regenerer les livrables.',
          code: 'DELIVERABLE_NOT_FOUND',
        },
        { status: 404 }
      )
    }

    // Download file from Supabase Storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('deliverables')
      .download(deliverable.storage_path)

    if (downloadError || !fileData) {
      console.error(
        '[GET /download] Storage download error:',
        downloadError?.message
      )
      return NextResponse.json(
        {
          error: 'Erreur lors du telechargement du fichier. Veuillez regenerer les livrables.',
          code: 'INTERNAL_ERROR',
        },
        { status: 500 }
      )
    }

    // Determine content type
    const contentType =
      FORMAT_CONTENT_TYPES[deliverable.format] || 'application/octet-stream'

    // Build a descriptive filename
    const baseName =
      DELIVERABLE_FILENAMES[deliverable.type] || 'Sof_IA_Livrable'
    const extension = deliverable.format === 'xlsx' ? '.xlsx' : '.pdf'
    const sanitizedMissionName = mission.name
      .replace(/[^a-zA-Z0-9\s\-_]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 40)
    const filename = `${baseName}_${sanitizedMissionName}${extension}`

    // Convert Blob to Buffer
    const arrayBuffer = await fileData.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Return file as response with appropriate headers
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': buffer.length.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    })
  } catch (error) {
    console.error(
      '[GET /api/missions/[id]/deliverables/[deliverableId]/download] Error:',
      error
    )
    return NextResponse.json(
      { error: 'Erreur interne du serveur.', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}
