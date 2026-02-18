// =============================================================================
// SOF'IA — Service OCR via Gemini Vision (OpenRouter)
// Extrait le texte de PDFs scannes et d'images via un modele de vision.
// Utilise comme fallback quand pdf-parse ne trouve pas de texte exploitable.
// =============================================================================

import { SupabaseClient } from '@supabase/supabase-js'
import { callOpenRouterVision } from '@/lib/llm/openrouter'

export interface OcrResult {
  text: string
  pageCount: number
  method: 'vision_ocr'
}

const OCR_SYSTEM_PROMPT = `Tu es un assistant d'extraction de texte pour des documents financiers français (bilans, comptes de résultat, annexes aux comptes annuels).
Extrais INTÉGRALEMENT le texte visible dans ce document, en préservant :
- La structure des tableaux (utilise des tabulations pour les colonnes)
- Les montants exacts sans arrondi
- Les titres et sous-titres
- La numérotation des notes
Ne fais AUCUN commentaire, AUCUNE interprétation. Retourne UNIQUEMENT le texte extrait.`

const OCR_USER_PROMPT = `Extrais tout le texte de ce document financier. Préserve la structure des tableaux et les montants exacts.`

// MIME types supported
const MIME_MAP: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.tiff': 'image/tiff',
  '.tif': 'image/tiff',
}

/**
 * Determine le type MIME a partir de l'extension du fichier.
 */
function getMimeType(filename: string): string {
  const ext = '.' + filename.split('.').pop()?.toLowerCase()
  return MIME_MAP[ext] || 'application/octet-stream'
}

/**
 * Telecharge un fichier depuis Supabase Storage et extrait le texte
 * via Gemini Vision (OpenRouter).
 *
 * Supporte : PDF (scannes), JPG, PNG, TIFF
 */
export async function extractTextViaVision(
  supabase: SupabaseClient,
  storagePath: string,
  filename: string
): Promise<OcrResult> {
  console.log(`[OCR] Debut extraction vision pour ${filename} (${storagePath})`)

  // 1. Download from Supabase Storage
  const { data: fileData, error: downloadError } = await supabase.storage
    .from('documents')
    .download(storagePath)

  if (downloadError || !fileData) {
    throw new Error(`Impossible de telecharger ${filename}: ${downloadError?.message || 'fichier vide'}`)
  }

  // 2. Read file and check size
  const arrayBuffer = await fileData.arrayBuffer()
  const fileSize = arrayBuffer.byteLength

  if (fileSize === 0) {
    throw new Error(`Le fichier ${filename} est vide.`)
  }

  // 3. Determine MIME type
  const mimeType = getMimeType(filename)
  console.log(`[OCR] Fichier: ${filename}, MIME: ${mimeType}, Taille: ${Math.round(fileSize / 1024)} Ko`)

  // 4. Check file size (max ~20MB for base64)
  if (fileSize > 20 * 1024 * 1024) {
    throw new Error(`Fichier trop volumineux pour l'OCR (${Math.round(fileSize / 1024 / 1024)} Mo). Maximum: 20 Mo.`)
  }

  // 5. Convert to base64
  const base64 = Buffer.from(arrayBuffer).toString('base64')

  // 6. Call vision model
  const text = await callOpenRouterVision(
    OCR_SYSTEM_PROMPT,
    OCR_USER_PROMPT,
    [{ base64, mimeType }],
    {
      model: 'google/gemini-2.0-flash-001',
      temperature: 0,
      max_tokens: 16000,
    }
  )

  console.log(`[OCR] ✓ Extraction reussie pour ${filename}: ${text.length} caracteres`)

  return {
    text,
    pageCount: 1, // Vision doesn't provide page count
    method: 'vision_ocr',
  }
}
