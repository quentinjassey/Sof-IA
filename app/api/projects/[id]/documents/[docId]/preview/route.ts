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

    const { id: projectId, docId } = await params
    const supabase = createServerSupabaseClient()

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .eq('license_id', session.license_id)
      .single()

    if (projectError || !project) {
      return NextResponse.json(
        { error: 'Projet introuvable.', code: 'PROJECT_NOT_FOUND' },
        { status: 404 }
      )
    }

    const { data: doc, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', docId)
      .eq('project_id', projectId)
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

    const { data: fileData, error: downloadError } = await supabase.storage
      .from('documents')
      .download(doc.storage_path)

    if (downloadError || !fileData) {
      console.error('[GET /preview] Storage download error:', downloadError?.message)
      return NextResponse.json(
        { error: 'Erreur lors du telechargement du fichier.', code: 'INTERNAL_ERROR' },
        { status: 500 }
      )
    }

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
    console.error('[GET /api/projects/[id]/documents/[docId]/preview] Error:', error)
    return NextResponse.json(
      { error: 'Erreur interne du serveur.', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}
