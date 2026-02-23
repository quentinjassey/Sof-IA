// =============================================================================
// SOF'IA — Extracteur de texte PDF
// Télécharge les PDFs depuis Supabase Storage et extrait le texte via pdf-parse.
// Gère les PDFs combinés (bilan + CR + annexe en un seul fichier).
// =============================================================================

import { SupabaseClient } from '@supabase/supabase-js'
import { ensureDOMMatrix } from '@/lib/polyfills/dom-matrix'
import { extractTextViaVision } from './ocr-service'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface ExtractedPdf {
  filename: string
  storagePath: string
  text: string
  pageCount: number
  extractionMethod?: 'pdf_parse' | 'vision_ocr' | 'direct_image'
}

export interface SplitSections {
  bilan: string
  compte_resultat: string
  annexe: string
  isCombined: boolean
}

// -----------------------------------------------------------------------------
// Single PDF extraction
// -----------------------------------------------------------------------------

/**
 * Télécharge un PDF depuis Supabase Storage et extrait son texte.
 * Retourne le texte complet et le nombre de pages.
 */
export async function extractTextFromStoredPdf(
  supabase: SupabaseClient,
  storagePath: string,
  filename: string,
  options?: { enableOcr?: boolean }
): Promise<ExtractedPdf> {
  console.log(`[PDF] Téléchargement de ${filename} (${storagePath})...`)

  const { data, error } = await supabase.storage
    .from('documents')
    .download(storagePath)

  if (error || !data) {
    throw new Error(`Impossible de télécharger ${filename}: ${error?.message || 'fichier vide'}`)
  }

  const buffer = Buffer.from(await data.arrayBuffer())
  const uint8 = new Uint8Array(buffer)

  ensureDOMMatrix()
  const { PDFParse } = await import('pdf-parse')
  const parser = new PDFParse({ data: uint8 })
  let text = ''
  let pageCount = 0
  try {
    const textResult = await parser.getText()
    text = textResult?.text?.trim() || ''
    pageCount = textResult?.pages?.length || 0
  } finally {
    await parser.destroy().catch(() => {})
  }

  console.log(`[PDF] ${filename}: ${pageCount} pages, ${text.length} caractères extraits`)

  if (text.length < 50) {
    console.warn(`[PDF] ATTENTION: ${filename} contient très peu de texte (${text.length} chars). PDF scanné sans OCR ?`)
  }

  // OCR fallback: if text is too sparse and OCR is enabled, try vision extraction
  if (text.length < 50 && options?.enableOcr) {
    console.log(`[PDF] ${filename}: texte insuffisant (${text.length} chars). Tentative OCR via vision...`)
    try {
      const ocrResult = await extractTextViaVision(supabase, storagePath, filename)
      console.log(`[PDF] OCR reussi pour ${filename}: ${ocrResult.text.length} caracteres`)
      return {
        filename,
        storagePath,
        text: ocrResult.text,
        pageCount: ocrResult.pageCount || pageCount,
        extractionMethod: 'vision_ocr',
      }
    } catch (ocrError) {
      console.error(`[PDF] Echec OCR pour ${filename}:`, ocrError)
      // Fall through to return sparse text
    }
  }

  return { filename, storagePath, text, pageCount, extractionMethod: 'pdf_parse' }
}

// -----------------------------------------------------------------------------
// Image extraction via OCR
// -----------------------------------------------------------------------------

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.tiff', '.tif']

/**
 * Extrait le texte d'une image (JPG, PNG, TIFF) via OCR vision.
 */
export async function extractTextFromStoredImage(
  supabase: SupabaseClient,
  storagePath: string,
  filename: string
): Promise<ExtractedPdf> {
  console.log(`[Image] Extraction OCR pour ${filename}...`)
  const ocrResult = await extractTextViaVision(supabase, storagePath, filename)
  return {
    filename,
    storagePath,
    text: ocrResult.text,
    pageCount: 1,
    extractionMethod: 'direct_image',
  }
}

// -----------------------------------------------------------------------------
// Multi-document extraction for a mission (PDFs + images)
// -----------------------------------------------------------------------------

/**
 * Extrait le texte de tous les documents d'une mission (PDFs et images).
 * Supporte les missions projet (lookup par project_id) et legacy (par mission_id).
 */
export async function extractAllMissionPdfs(
  supabase: SupabaseClient,
  missionId: string,
  projectId?: string | null
): Promise<ExtractedPdf[]> {
  let query = supabase.from('documents').select('*')
  if (projectId) {
    query = query.eq('project_id', projectId)
  } else {
    query = query.eq('mission_id', missionId)
  }
  const { data: documents, error } = await query

  if (error || !documents || documents.length === 0) {
    throw new Error(`Aucun document trouvé pour la mission ${missionId}`)
  }

  const supportedDocs = documents.filter((doc) => {
    const filename = doc.filename.toLowerCase()
    const isPdf = filename.endsWith('.pdf')
    const isImage = IMAGE_EXTENSIONS.some(ext => filename.endsWith(ext))
    return isPdf || isImage
  })

  if (supportedDocs.length === 0) {
    throw new Error(`Aucun fichier exploitable (PDF ou image) trouvé parmi les ${documents.length} document(s) de la mission.`)
  }

  const pdfs: ExtractedPdf[] = []
  const errors: string[] = []

  for (const doc of supportedDocs) {
    try {
      const filename = doc.filename.toLowerCase()
      const isImage = IMAGE_EXTENSIONS.some(ext => filename.endsWith(ext))

      const extracted = isImage
        ? await extractTextFromStoredImage(supabase, doc.storage_path, doc.filename)
        : await extractTextFromStoredPdf(supabase, doc.storage_path, doc.filename, { enableOcr: true })
      pdfs.push(extracted)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[PDF] Erreur extraction ${doc.filename}: ${msg}`)
      errors.push(`${doc.filename}: ${msg}`)
    }
  }

  // If ALL documents failed, throw with the actual error details
  if (pdfs.length === 0 && errors.length > 0) {
    throw new Error(`Échec de l'extraction de tous les documents : ${errors.join(' | ')}`)
  }

  return pdfs
}

// -----------------------------------------------------------------------------
// Combined PDF splitting
// -----------------------------------------------------------------------------

// Patterns used to detect section boundaries in combined financial statements.
// Each pattern is designed to match actual section headers, not TOC entries.
// We use patterns that match page headers (title on its own line or after a page marker).
const BILAN_PATTERNS = [
  /\bBILAN\s+ACTIF\n/i,                         // Standalone "BILAN ACTIF" — internal report header
  /\bBILAN\s+PASSIF\n/i,                        // Standalone "BILAN PASSIF" — internal report header
  /\bBILAN\s+AU\s+\d/i,                         // "BILAN AU 31/12/..."
  /\bBILAN\s*[-–—]\s*ACTIF\b/i,                 // CERFA 2050: "BILAN - ACTIF" (fallback)
  /\bBILAN\s*[-–—]\s*PASSIF\b/i,                // CERFA 2051: "BILAN - PASSIF" (fallback)
  /\bACTIF\s+IMMOBILIS[EÉ]/i,                   // "ACTIF IMMOBILISÉ" (last resort)
]

const CR_PATTERNS = [
  /\bCOMPTE\s+DE\s+R[EÉ]SULTAT\n/i,            // Standalone CR header
  /\bCOMPTE\s+DE\s+R[EÉ]SULTAT\s+DE\s+L/i,     // "COMPTE DE RÉSULTAT DE L'EXERCICE"
  /\bPRODUITS\s+D['']EXPLOITATION\n/i,           // Start of CR content
]

const ANNEXE_PATTERNS = [
  /\bANNEXE\s+(?:DES|AUX)\s+COMPTES\s+ANNUELS/i, // "ANNEXE DES COMPTES ANNUELS"
  /\bANNEXE\s+AU\s+BILAN\b/i,
  /\bANNEXE\s+COMPTABLE\s*\n/i,                   // Standalone "ANNEXE COMPTABLE" header
]

// Minimum section length in chars — sections below this are likely TOC matches
const MIN_SECTION_LENGTH = 500

/**
 * Trouve la position d'une section dans le texte, en ignorant les
 * correspondances dans la table des matières (sommaire).
 *
 * Stratégie :
 *   Phase 1 — Cherche un titre de section qui apparaît dans les premières
 *     lignes d'une nouvelle page (≤ 5 chars après un marqueur `-- X of Y --`)
 *     et qui est suivi de contenu substantiel (nom d'entreprise, dates, etc.)
 *   Phase 2 — Fallback : première occurrence après les 2000 premiers caractères
 *     (qui sont généralement la page de garde + le sommaire)
 */
function findSectionPosition(text: string, patterns: RegExp[]): number {
  // Build list of page start positions from pdf-parse markers
  const pageMarkerRegex = /-- \d+ of \d+ --\n/g
  const pageStarts: number[] = []
  let m
  while ((m = pageMarkerRegex.exec(text)) !== null) {
    pageStarts.push(m.index + m[0].length)
  }

  // Phase 1: Find patterns that start a page (within first 5 chars after page marker)
  // and are followed by real content (not another TOC entry)
  for (const pattern of patterns) {
    const globalPattern = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g')
    let match
    while ((match = globalPattern.exec(text)) !== null) {
      const matchPos = match.index
      // Must be near the start of a page (≤ 50 chars covers CERFA headers like
      // "DGFiP N° 2050 - SD 2023\t1\t" before the title, but excludes TOC entries
      // which are typically 150+ chars into a page)
      const isPageStart = pageStarts.some((ps) => matchPos >= ps && matchPos <= ps + 50)
      if (isPageStart) {
        // Verify this is a real section: check that the next 200 chars contain
        // a company name, a date, or financial data (not just more TOC lines)
        const after = text.slice(matchPos, matchPos + 300)
        const looksReal =
          /\d{2}\/\d{2}\/\d{4}/.test(after) ||     // Date like 01/01/2022
          /\d{2}\/\d{2}\/\d{2}\b/.test(after) ||    // Date like 31/12/22
          /ASSOC|SAS|SARL|SA\b|SCI/.test(after) ||  // Legal form
          /Exercice|exercice/.test(after) ||          // "Exercice du..."
          /Formulaire obligatoire/.test(after) ||     // CERFA header
          /TOTAL|Brut|Net|Amort/i.test(after)        // Financial table headers
        if (looksReal) {
          return matchPos
        }
      }
    }
  }

  // Phase 2: Fallback — first occurrence past the cover/TOC (first 2000 chars)
  const SKIP_TOC_CHARS = 2000
  for (const pattern of patterns) {
    const searchText = text.slice(SKIP_TOC_CHARS)
    const match = searchText.match(pattern)
    if (match && match.index != null) {
      return match.index + SKIP_TOC_CHARS
    }
  }

  return -1
}

/**
 * Découpe un PDF combiné (bilan + CR + annexe) en 3 sections.
 * Si le découpage échoue ou produit des sections trop petites,
 * renvoie le texte complet pour chaque section (le LLM trouvera
 * la bonne partie grâce à son large contexte).
 */
export function splitCombinedFinancialStatements(fullText: string): SplitSections {
  const bilanPos = findSectionPosition(fullText, BILAN_PATTERNS)
  const crPos = findSectionPosition(fullText, CR_PATTERNS)
  const annexePos = findSectionPosition(fullText, ANNEXE_PATTERNS)

  console.log(`[PDF] Positions détectées — Bilan: ${bilanPos}, CR: ${crPos}, Annexe: ${annexePos}`)

  // Sort positions to determine order
  const positions = [
    { name: 'bilan', pos: bilanPos },
    { name: 'cr', pos: crPos },
    { name: 'annexe', pos: annexePos },
  ]
    .filter((p) => p.pos >= 0)
    .sort((a, b) => a.pos - b.pos)

  // If we can't find at least 2 sections, return full text for all
  if (positions.length < 2) {
    console.warn('[PDF] Moins de 2 sections détectées — envoi du texte complet au LLM.')
    return {
      bilan: fullText,
      compte_resultat: fullText,
      annexe: fullText,
      isCombined: true,
    }
  }

  // Extract sections based on detected positions
  const sections: Record<string, string> = {
    bilan: fullText,
    cr: fullText,
    annexe: fullText,
  }

  for (let i = 0; i < positions.length; i++) {
    const start = positions[i].pos
    const end = i + 1 < positions.length ? positions[i + 1].pos : fullText.length
    sections[positions[i].name] = fullText.slice(start, end)
  }

  // Validate: if any section is too small, the split likely hit a TOC entry.
  // Fall back to full text for all sections (LLM handles it fine with large context).
  const bilanSection = bilanPos >= 0 ? sections['bilan'] : fullText
  const crSection = crPos >= 0 ? sections['cr'] : fullText
  const annexeSection = annexePos >= 0 ? sections['annexe'] : fullText

  if (bilanSection.length < MIN_SECTION_LENGTH || crSection.length < MIN_SECTION_LENGTH) {
    console.warn(
      `[PDF] Section trop petite détectée (Bilan: ${bilanSection.length}, CR: ${crSection.length} chars). ` +
      `Le découpage a probablement touché le sommaire. Envoi du texte complet au LLM.`
    )
    return {
      bilan: fullText,
      compte_resultat: fullText,
      annexe: fullText,
      isCombined: true,
    }
  }

  console.log(
    `[PDF] Sections découpées — Bilan: ${bilanSection.length} chars, CR: ${crSection.length} chars, Annexe: ${annexeSection.length} chars`
  )

  return {
    bilan: bilanSection,
    compte_resultat: crSection,
    annexe: annexeSection,
    isCombined: true,
  }
}
