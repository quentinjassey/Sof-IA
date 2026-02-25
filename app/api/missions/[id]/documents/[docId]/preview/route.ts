// =============================================================================
// SOF'IA -- API Route: /api/missions/[id]/documents/[docId]/preview
//
// GET - Serve a document file inline for preview (PDF binary or FEC JSON)
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromServerCookies } from '@/lib/auth/session'
import { createServerSupabaseClient } from '@/lib/supabase/server'

const FEC_PREVIEW_LIMIT = 100

const FEC_STANDARD_HEADERS = [
  'JournalCode', 'JournalLib', 'EcritureNum', 'EcritureDate',
  'CompteNum', 'CompteLib', 'CompAuxNum', 'CompAuxLib',
  'PieceRef', 'PieceDate', 'EcritureLib', 'Debit', 'Credit',
  'EcritureLet', 'DateLet', 'ValidDate', 'Montantdevise', 'Idevise',
]

function isFecFile(filename: string, docType: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase()
  return docType === 'fec' || ext === 'txt' || ext === 'csv' || filename.toLowerCase().includes('fec')
}

function parseFecPreview(text: string, limit: number) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (lines.length === 0) return { headers: [], rows: [], totalLines: 0 }

  // Detect separator: pipe (|), tab (\t), or semicolon (;)
  // FEC standard per DGFiP is pipe-delimited
  const separator = lines[0].includes('|') ? '|' : lines[0].includes('\t') ? '\t' : ';'
  const rawHeaders = lines[0].split(separator).map((h) => h.trim())

  const usesStandardHeaders = rawHeaders.some((h) =>
    FEC_STANDARD_HEADERS.some((s) => s.toLowerCase() === h.toLowerCase())
  )
  const headers = usesStandardHeaders ? rawHeaders : FEC_STANDARD_HEADERS.slice(0, rawHeaders.length)

  const totalLines = lines.length - 1
  const rows: string[][] = []

  for (let i = 1; i < lines.length && rows.length < limit; i++) {
    const cols = lines[i].split(separator).map((c) => c.trim())
    if (cols.length >= 3) rows.push(cols)
  }

  return { headers, rows, totalLines }
}

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

    // FEC files: return parsed JSON preview
    if (isFecFile(doc.filename || '', doc.type || '')) {
      const arrayBuffer = await fileData.arrayBuffer()
      const text = Buffer.from(arrayBuffer).toString('utf-8')
      const preview = parseFecPreview(text, FEC_PREVIEW_LIMIT)

      return NextResponse.json({
        data: {
          filename: doc.filename,
          headers: preview.headers,
          rows: preview.rows,
          totalLines: preview.totalLines,
          previewLimit: FEC_PREVIEW_LIMIT,
          truncated: preview.totalLines > FEC_PREVIEW_LIMIT,
        },
      }, {
        headers: { 'Cache-Control': 'private, max-age=300' },
      })
    }

    // PDF / other: return binary
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
