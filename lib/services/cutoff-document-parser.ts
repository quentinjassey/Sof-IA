// =============================================================================
// SOF'IA -- Parser de documents reels pour le scenario Cut-Off
// Telecharge et parse les FEC (texte tabulé) + factures PDF + BL/BR PDF
// depuis Supabase Storage.
//
// Stratégie d'extraction :
//   - FEC (.txt) : parsing tabulé déterministe (format DGFiP structuré)
//   - PDFs (factures, BL/BR) : extraction LLM via OpenRouter si OPENROUTER_API_KEY
//     est configurée, sinon fallback regex
//   - Images (JPG, PNG, TIFF) : OCR via Gemini Vision puis extraction LLM
//   - PDFs scannés : OCR fallback si pdf-parse retourne peu de texte
// =============================================================================

import { SupabaseClient } from '@supabase/supabase-js'
import type {
  FecEntry,
  CutoffInvoice,
  DeliveryNote,
} from '@/lib/config/cutoff-companies'
import { extractTextViaVision } from './ocr-service'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse')

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.tiff', '.tif']

// -----------------------------------------------------------------------------
// Exported result type
// -----------------------------------------------------------------------------

export interface ParsedCutoffDocuments {
  companyName: string
  fecEntries: FecEntry[]
  invoices: CutoffInvoice[]
  deliveryNotes: DeliveryNote[]
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/** Parse French number format: "1 234,56" or "1234.56" → 1234.56 */
function parseFrenchNumber(str: string): number {
  const cleaned = str.replace(/[\s\u00A0]/g, '').replace(',', '.')
  return parseFloat(cleaned) || 0
}

/** Convert YYYYMMDD → YYYY-MM-DD */
function fecDateToISO(yyyymmdd: string): string {
  if (!yyyymmdd || yyyymmdd.length !== 8) return yyyymmdd || ''
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`
}

/** Extract text from a PDF buffer using pdf-parse */
async function extractPdfText(buffer: Buffer): Promise<string> {
  const result = await pdfParse(buffer)
  return result.text
}

/** Check if OpenRouter LLM is available */
function isLlmAvailable(): boolean {
  const key = process.env.OPENROUTER_API_KEY
  return Boolean(key && key !== '<YOUR_OPENROUTER_API_KEY>')
}

// -----------------------------------------------------------------------------
// FEC Parser (deterministic — structured tab-delimited data)
// -----------------------------------------------------------------------------

/**
 * Parse a tab-delimited FEC text file buffer into FecEntry[].
 *
 * FEC format (DGFiP):
 * - First line is header (18 columns), skipped
 * - Lines separated by CRLF or LF
 * - Columns: JournalCode, JournalLib, EcritureNum, EcritureDate(YYYYMMDD),
 *   CompteNum, CompteLib, CompAuxNum, CompAuxLib, PieceRef, PieceDate(YYYYMMDD),
 *   EcritureLib, Debit, Credit, EcritureLet, DateLet, ValidDate, Montantdevise, Idevise
 * - Debit/Credit use French decimal comma: "1234,56"
 */
export function parseFecBuffer(buffer: Buffer): FecEntry[] {
  const text = buffer.toString('utf-8')
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0)

  if (lines.length < 2) {
    console.warn('[CutoffParser] FEC file has fewer than 2 lines')
    return []
  }

  // Skip header line
  const entries: FecEntry[] = []

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split('\t')
    if (cols.length < 13) {
      console.warn(`[CutoffParser] FEC line ${i + 1}: only ${cols.length} columns, skipping`)
      continue
    }

    entries.push({
      journal_code: cols[0]?.trim() || '',
      journal_lib: cols[1]?.trim() || '',
      ecriture_num: cols[2]?.trim() || '',
      ecriture_date: fecDateToISO(cols[3]?.trim() || ''),
      compte_num: cols[4]?.trim() || '',
      compte_lib: cols[5]?.trim() || '',
      comp_aux_num: cols[6]?.trim() || null,
      comp_aux_lib: cols[7]?.trim() || null,
      piece_ref: cols[8]?.trim() || '',
      piece_date: fecDateToISO(cols[9]?.trim() || ''),
      ecriture_lib: cols[10]?.trim() || '',
      debit: parseFrenchNumber(cols[11] || '0'),
      credit: parseFrenchNumber(cols[12] || '0'),
      valid_date: cols[15]?.trim() ? fecDateToISO(cols[15].trim()) : null,
    })
  }

  console.log(`[CutoffParser] FEC parsed: ${entries.length} entries`)
  return entries
}

// -----------------------------------------------------------------------------
// Main orchestrator — LLM-first with regex fallback
// -----------------------------------------------------------------------------

/**
 * Fetch all cutoff documents for a mission from Supabase,
 * download and parse each one (FEC text + invoice PDFs + delivery note PDFs),
 * and return the structured data.
 *
 * For PDFs: uses LLM (OpenRouter) to classify and extract structured data.
 * If LLM is not available, falls back to basic filename heuristics.
 */
export async function fetchAndParseAllCutoffDocuments(
  supabase: SupabaseClient,
  missionId: string
): Promise<ParsedCutoffDocuments> {
  console.log(`[CutoffParser] Fetching documents for mission ${missionId}...`)

  // 1. Fetch document metadata from the documents table
  const { data: documents, error } = await supabase
    .from('documents')
    .select('*')
    .eq('mission_id', missionId)

  if (error || !documents || documents.length === 0) {
    throw new Error(`Aucun document trouve pour la mission ${missionId}`)
  }

  console.log(`[CutoffParser] Found ${documents.length} document(s)`)

  const useLlm = isLlmAvailable()
  if (useLlm) {
    console.log('[CutoffParser] OpenRouter LLM disponible — extraction intelligente activée')
  } else {
    console.log('[CutoffParser] OpenRouter LLM non disponible — fallback heuristique')
  }

  let companyName = ''
  const fecEntries: FecEntry[] = []
  const invoices: CutoffInvoice[] = []
  const deliveryNotes: DeliveryNote[] = []

  // Lazy-load LLM extractor only if needed
  let llmExtractor: typeof import('./cutoff-llm-extractor') | null = null
  if (useLlm) {
    llmExtractor = await import('./cutoff-llm-extractor')
  }

  // 2. Process each document
  for (const doc of documents) {
    const filename = (doc.filename || '').toLowerCase()
    const docType = doc.type as string

    try {
      // ----- FEC text file (always deterministic) -----
      if (docType === 'fec' || filename.endsWith('.txt')) {
        console.log(`[CutoffParser] Downloading FEC: ${doc.filename}`)
        const { data: fileData, error: dlError } = await supabase.storage
          .from('documents')
          .download(doc.storage_path)

        if (dlError || !fileData) {
          console.error(`[CutoffParser] Failed to download FEC ${doc.filename}: ${dlError?.message}`)
          continue
        }

        const buffer = Buffer.from(await fileData.arrayBuffer())
        const parsed = parseFecBuffer(buffer)
        fecEntries.push(...parsed)

        // Try to extract company name from FEC filename
        if (!companyName) {
          const nameMatch = doc.filename.match(/FEC_(.+?)_\d{4}/i)
          if (nameMatch) {
            companyName = nameMatch[1].replace(/_/g, ' ')
          }
        }
        continue
      }

      // ----- Image files: OCR via vision then LLM extraction -----
      const isImage = IMAGE_EXTENSIONS.some(ext => filename.endsWith(ext))
      if (!filename.endsWith('.pdf') && !isImage) {
        console.log(`[CutoffParser] Skipping unsupported file: ${doc.filename}`)
        continue
      }

      let text: string

      if (isImage) {
        // Direct OCR for image files
        console.log(`[CutoffParser] Image detected — OCR via vision: ${doc.filename}`)
        const ocrResult = await extractTextViaVision(supabase, doc.storage_path, doc.filename)
        text = ocrResult.text
      } else {
        // PDF: try pdf-parse first, OCR fallback if sparse text
        console.log(`[CutoffParser] Downloading PDF: ${doc.filename}`)
        const { data: fileData, error: dlError } = await supabase.storage
          .from('documents')
          .download(doc.storage_path)

        if (dlError || !fileData) {
          console.error(`[CutoffParser] Failed to download ${doc.filename}: ${dlError?.message}`)
          continue
        }

        const buffer = Buffer.from(await fileData.arrayBuffer())
        text = await extractPdfText(buffer)

        // OCR fallback for scanned PDFs with insufficient text
        if (text.trim().length < 50) {
          console.log(`[CutoffParser] PDF text sparse (${text.trim().length} chars) — OCR fallback: ${doc.filename}`)
          try {
            const ocrResult = await extractTextViaVision(supabase, doc.storage_path, doc.filename)
            text = ocrResult.text
            console.log(`[CutoffParser] OCR reussi pour ${doc.filename}: ${text.length} caracteres`)
          } catch (ocrError) {
            console.error(`[CutoffParser] OCR failed for ${doc.filename}:`, ocrError)
          }
        }
      }

      // Skip if no exploitable text after extraction/OCR
      if (!text || text.trim().length < 10) {
        console.warn(`[CutoffParser] Texte insuffisant pour ${doc.filename} (${text?.trim().length || 0} chars) — document ignoré`)
        continue
      }

      if (useLlm && llmExtractor) {
        // ===== LLM PATH =====
        // Step 1: Classify the document
        const classification = await llmExtractor.classifyDocument(text, doc.filename)
        let classifiedType = classification.type

        // If LLM classified as "autre" or "fec" but it's a PDF, try using the
        // Supabase doc_type or filename hints to override
        if (classifiedType === 'autre' || classifiedType === 'fec') {
          console.warn(`[CutoffParser] LLM classified PDF ${doc.filename} as "${classifiedType}" — attempting fallback classification`)
          if (docType === 'facture_vente' || docType === 'facture_achat') {
            classifiedType = docType as 'facture_vente' | 'facture_achat'
          } else if (docType === 'bon_livraison') {
            classifiedType = filename.includes('br') ? 'bon_reception' : 'bon_livraison'
          } else {
            // Last resort: try as invoice (most common document type in cutoff)
            console.warn(`[CutoffParser] Treating ${doc.filename} as invoice by default`)
            classifiedType = 'facture_vente'
          }
        }

        // Step 2: Extract based on classification
        if (classifiedType === 'facture_vente' || classifiedType === 'facture_achat' || classifiedType === 'avoir') {
          const invoice = await llmExtractor.extractInvoiceWithLLM(text, doc.filename)
          invoices.push(invoice)

          if (!companyName && invoice.client_or_supplier) {
            companyName = invoice.client_or_supplier
          }
        } else if (classifiedType === 'bon_livraison' || classifiedType === 'bon_reception') {
          const note = await llmExtractor.extractDeliveryNoteWithLLM(text, doc.filename)
          deliveryNotes.push(note)
        }
      } else {
        // ===== FALLBACK: filename-based heuristic =====
        if (
          docType === 'facture_vente' ||
          docType === 'facture_achat' ||
          filename.startsWith('fac') ||
          filename.startsWith('frn') ||
          filename.startsWith('av-') ||
          filename.startsWith('av_')
        ) {
          // Minimal extraction from filename
          const ref = doc.filename.replace(/\.pdf$/i, '')
          const type = filename.startsWith('frn') ? 'achat' as const
            : filename.startsWith('av') ? 'avoir' as const
            : 'vente' as const

          invoices.push({
            ref,
            type,
            date: '',
            client_or_supplier: '',
            client_code: '',
            address: '',
            siret: '',
            lines: [],
            total_ht: 0,
            tva_rate: 20,
            tva_amount: 0,
            total_ttc: 0,
            payment_terms: '',
            due_date: '',
            linked_bl_ref: null,
            linked_invoice: null,
            note: null,
          })
        } else if (
          docType === 'bon_livraison' ||
          filename.startsWith('bl-') || filename.startsWith('bl_') ||
          filename.startsWith('br-') || filename.startsWith('br_')
        ) {
          const ref = doc.filename.replace(/\.pdf$/i, '')
          deliveryNotes.push({
            ref,
            type: filename.startsWith('br') ? 'reception' : 'livraison',
            date_expedition: null,
            date_delivery: '',
            order_ref: '',
            linked_invoice: '',
            recipient_or_supplier: '',
            contact: '',
            items_description: '',
            quantity: '',
            received_by: '',
            observations: '',
          })
        } else {
          console.log(`[CutoffParser] Skipping unrecognized document: ${doc.filename} (type: ${docType})`)
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[CutoffParser] Error processing ${doc.filename}: ${msg}`)
    }
  }

  console.log(
    `[CutoffParser] Parsing complete: ${fecEntries.length} FEC entries, ` +
    `${invoices.length} invoices, ${deliveryNotes.length} delivery notes`
  )

  return {
    companyName: companyName || 'Entreprise inconnue',
    fecEntries,
    invoices,
    deliveryNotes,
  }
}
