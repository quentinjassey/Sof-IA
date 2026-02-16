// =============================================================================
// SOF'IA -- API Route: /api/missions/[id]/documents/[docId]/preview
//
// GET - Serve a document file inline for PDF preview in modal
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromServerCookies } from '@/lib/auth/session'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const session = await getSessionFromServerCookies()
    if (!session) {
      return NextResponse.json(
        { error: 'Session invalide ou absente.', code: 'UNAUTHORIZED' },
        { status: 401 }
      )
    }

    const { id: missionId, docId } = await params
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

    // Fetch document metadata
    const { data: doc, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', docId)
      .eq('mission_id', missionId)
      .single()

    if (docError || !doc) {
      return NextResponse.json(
        { error: 'Document introuvable.', code: 'DOCUMENT_NOT_FOUND' },
        { status: 404 }
      )
    }

    if (!doc.storage_path) {
      return NextResponse.json(
        { error: 'Le fichier n\'est pas disponible.', code: 'FILE_NOT_FOUND' },
        { status: 404 }
      )
    }

    // Download file from Supabase Storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('documents')
      .download(doc.storage_path)

    if (downloadError || !fileData) {
      console.error('[GET /preview] Storage download error:', downloadError?.message)
      return NextResponse.json(
        { error: 'Erreur lors du téléchargement du fichier.', code: 'INTERNAL_ERROR' },
        { status: 500 }
      )
    }

    // Determine content type from filename
    const ext = doc.filename?.split('.').pop()?.toLowerCase()
    const contentType = ext === 'pdf' ? 'application/pdf' : 'application/octet-stream'

    const arrayBuffer = await fileData.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${doc.filename || 'document.pdf'}"`,
        'Content-Length': buffer.length.toString(),
        'Cache-Control': 'private, max-age=300',
      },
    })
  } catch (error) {
    console.error('[GET /api/missions/[id]/documents/[docId]/preview] Error:', error)
    return NextResponse.json(
      { error: 'Erreur interne du serveur.', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}
