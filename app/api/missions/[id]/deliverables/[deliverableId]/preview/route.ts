// =============================================================================
// SOF'IA -- API Route: /api/missions/[id]/deliverables/[deliverableId]/preview
//
// GET - Serve a deliverable file inline for PDF preview in modal
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromServerCookies } from '@/lib/auth/session'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; deliverableId: string }> }
) {
  try {
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
      .select('id')
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

    if (!deliverable.storage_path) {
      return NextResponse.json(
        { error: 'Le fichier n\'est pas disponible.', code: 'FILE_NOT_FOUND' },
        { status: 404 }
      )
    }

    // Only PDF deliverables can be previewed
    if (deliverable.format !== 'pdf') {
      return NextResponse.json(
        { error: 'L\'aperçu n\'est disponible que pour les fichiers PDF.', code: 'NOT_PDF' },
        { status: 400 }
      )
    }

    // Download file from Supabase Storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('deliverables')
      .download(deliverable.storage_path)

    if (downloadError || !fileData) {
      console.error('[GET /preview] Storage download error:', downloadError?.message)
      return NextResponse.json(
        { error: 'Erreur lors du téléchargement du fichier.', code: 'INTERNAL_ERROR' },
        { status: 500 }
      )
    }

    const arrayBuffer = await fileData.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${deliverable.title || 'livrable.pdf'}"`,
        'Content-Length': buffer.length.toString(),
        'Cache-Control': 'private, max-age=300',
      },
    })
  } catch (error) {
    console.error('[GET /api/missions/[id]/deliverables/[deliverableId]/preview] Error:', error)
    return NextResponse.json(
      { error: 'Erreur interne du serveur.', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}
