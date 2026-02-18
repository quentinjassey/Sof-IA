// =============================================================================
// SOF'IA — Extracteur LLM pour le scénario Cut-Off (vrais documents)
// Envoie le texte extrait des PDFs au LLM (via OpenRouter) pour structurer
// les données en CutoffInvoice / DeliveryNote.
//
// 3 types d'appels LLM (temperature=0, JSON strict) :
//   1. Classification du document (facture vente/achat/avoir, BL, BR, autre)
//   2. Extraction facture → CutoffInvoice
//   3. Extraction bon livraison/réception → DeliveryNote
// =============================================================================

import { callOpenRouter } from '@/lib/llm/openrouter'
import type {
  CutoffInvoice,
  InvoiceLine,
  DeliveryNote,
} from '@/lib/config/cutoff-companies'

// -----------------------------------------------------------------------------
// Model & helpers
// -----------------------------------------------------------------------------

const EXTRACTION_MODEL = 'google/gemini-2.0-flash-001'

function safeParseJson<T>(raw: string, fallback: T): T {
  let cleaned = raw.trim()
  const jsonBlockMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
  if (jsonBlockMatch) {
    cleaned = jsonBlockMatch[1].trim()
  }

  try {
    return JSON.parse(cleaned) as T
  } catch {
    console.warn('[CutoffLLM] JSON parse échoué, tentative de nettoyage...')
    try {
      const fixed = cleaned
        .replace(/,\s*}/g, '}')
        .replace(/,\s*]/g, ']')
        .replace(/\n/g, ' ')
      return JSON.parse(fixed) as T
    } catch {
      console.error('[CutoffLLM] JSON parse définitivement échoué.')
      return fallback
    }
  }
}

function num(v: unknown): number {
  if (v == null) return 0
  const n = Number(v)
  return isNaN(n) ? 0 : n
}

/** Validate and normalize an ISO date string (YYYY-MM-DD). Returns '' if invalid. */
function normalizeDate(v: unknown): string {
  if (v == null) return ''
  const s = String(v).trim()
  if (!s || s === 'null' || s === 'undefined') return ''

  // Already ISO YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s

  // DD/MM/YYYY → YYYY-MM-DD
  const frMatch = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (frMatch) return `${frMatch[3]}-${frMatch[2]}-${frMatch[1]}`

  // YYYY/MM/DD → YYYY-MM-DD
  const slashMatch = s.match(/^(\d{4})\/(\d{2})\/(\d{2})$/)
  if (slashMatch) return `${slashMatch[1]}-${slashMatch[2]}-${slashMatch[3]}`

  // DD-MM-YYYY → YYYY-MM-DD
  const dashMatch = s.match(/^(\d{2})-(\d{2})-(\d{4})$/)
  if (dashMatch) return `${dashMatch[3]}-${dashMatch[2]}-${dashMatch[1]}`

  console.warn(`[CutoffLLM] Date non reconnue: "${s}"`)
  return ''
}

/** Safe string conversion — avoids "null" or "undefined" literal strings */
function safeStr(v: unknown, fallback = ''): string {
  if (v == null) return fallback
  const s = String(v).trim()
  if (s === 'null' || s === 'undefined') return fallback
  return s
}

// -----------------------------------------------------------------------------
// 1. Document classification
// -----------------------------------------------------------------------------

export type CutoffDocType =
  | 'facture_vente'
  | 'facture_achat'
  | 'avoir'
  | 'bon_livraison'
  | 'bon_reception'
  | 'fec'
  | 'autre'

interface ClassificationResult {
  type: CutoffDocType
  confidence: number
  ref: string
}

/**
 * Classify a document based on its extracted text and filename.
 * Returns the detected document type, a confidence score, and any reference found.
 */
export async function classifyDocument(
  text: string,
  filename: string
): Promise<ClassificationResult> {
  console.log(`[CutoffLLM] Classification du document: ${filename}`)

  const prompt = `Tu es un assistant de classification de documents comptables pour un commissaire aux comptes français.
Analyse le texte extrait d'un document et détermine son type.

Types possibles :
- "facture_vente" : Facture de vente émise par l'entreprise auditée (client destinataire)
- "facture_achat" : Facture fournisseur reçue par l'entreprise auditée
- "avoir" : Avoir / note de crédit (annulation partielle ou totale d'une facture)
- "bon_livraison" : Bon de livraison (BL) — preuve d'expédition/livraison de marchandises
- "bon_reception" : Bon de réception (BR) — preuve de réception de marchandises
- "fec" : Fichier des Écritures Comptables (FEC) — données tabulées comptables
- "autre" : Document non classifiable dans les catégories précédentes

Indices pour la classification :
- Les factures contiennent "Facture", "Total HT", "TVA", "Total TTC"
- Les avoirs contiennent "Avoir", "Note de crédit", "Facture d'origine"
- Les BL contiennent "Bon de livraison", "Date de livraison", "Date d'expédition"
- Les BR contiennent "Bon de réception", "Date de réception"
- Les factures fournisseur sont souvent préfixées FRN-
- Les factures de vente sont souvent préfixées FAC-
- Les avoirs sont souvent préfixés AV-
- Les BL sont préfixés BL-, les BR sont préfixés BR-

Retourne UNIQUEMENT un objet JSON :
{"type": "facture_vente", "confidence": 95, "ref": "FAC-2025-0001"}

- "type" : un des types listés ci-dessus
- "confidence" : score de confiance 0-100
- "ref" : référence du document trouvée dans le texte (ex: FAC-2025-0891, BL-2025-0042) ou "" si non trouvée

Nom du fichier : ${filename}

TEXTE DU DOCUMENT (premiers 3000 caractères) :
${text.slice(0, 3000)}`

  const raw = await callOpenRouter(
    [{ role: 'user', content: prompt }],
    { temperature: 0, max_tokens: 100, model: EXTRACTION_MODEL }
  )

  const parsed = safeParseJson<ClassificationResult>(raw, {
    type: 'autre',
    confidence: 0,
    ref: '',
  })

  console.log(`[CutoffLLM] → ${parsed.type} (confiance: ${parsed.confidence}%, ref: ${parsed.ref || 'N/A'})`)
  return parsed
}

// -----------------------------------------------------------------------------
// 2. Invoice extraction
// -----------------------------------------------------------------------------

interface InvoiceLLMResult {
  ref: string
  type: 'vente' | 'achat' | 'avoir'
  date: string
  client_or_supplier: string
  client_code: string
  address: string
  siret: string
  lines: Array<{
    description: string
    quantity: number
    unit_price_ht: number
    total_ht: number
  }>
  total_ht: number
  tva_rate: number
  tva_amount: number
  total_ttc: number
  payment_terms: string
  due_date: string
  linked_bl_ref: string | null
  linked_invoice: string | null
  note: string | null
}

/**
 * Extract structured invoice data from PDF text using LLM.
 */
export async function extractInvoiceWithLLM(
  text: string,
  filename: string
): Promise<CutoffInvoice> {
  console.log(`[CutoffLLM] Extraction facture: ${filename}`)

  const prompt = `Tu es un assistant d'extraction de données pour un commissaire aux comptes français.
Extrais les informations structurées de cette facture (vente, achat, ou avoir).

IMPORTANT :
- Les dates doivent être au format ISO : YYYY-MM-DD (ex: 2025-12-29)
- Si la date est au format DD/MM/YYYY (ex: 29/12/2025), convertis-la en 2025-12-29
- Les montants sont des nombres décimaux (ex: 12345.67, pas "12 345,67")
- Si un champ n'est pas trouvé, utilise "" pour les textes, 0 pour les nombres, null pour les optionnels

Retourne UNIQUEMENT un objet JSON :
{
  "ref": "FAC-2025-0891",
  "type": "vente",
  "date": "2025-12-29",
  "client_or_supplier": "Nom du client ou fournisseur",
  "client_code": "CLI-001",
  "address": "Adresse complète",
  "siret": "XXX XXX XXX XXXXX",
  "lines": [
    {"description": "Article 1", "quantity": 10, "unit_price_ht": 100.00, "total_ht": 1000.00}
  ],
  "total_ht": 1000.00,
  "tva_rate": 20,
  "tva_amount": 200.00,
  "total_ttc": 1200.00,
  "payment_terms": "30 jours fin de mois",
  "due_date": "2026-01-29",
  "linked_bl_ref": "BL-2025-0042",
  "linked_invoice": null,
  "note": null
}

Notes :
- "type" : "vente" pour facture de vente (FAC-), "achat" pour facture fournisseur (FRN-), "avoir" pour avoir (AV-)
- "linked_bl_ref" : référence du bon de livraison/réception associé (BL-YYYY-NNNN ou BR-YYYY-NNNN) si mentionné
- "linked_invoice" : pour un avoir, la facture d'origine (FAC-YYYY-NNNN) si mentionnée
- "note" : remarque/observation si présente sur le document
- "lines" : lignes de détail de la facture, si identifiables dans le texte

Nom du fichier : ${filename}

TEXTE COMPLET DE LA FACTURE :
${text.slice(0, 12000)}`

  const raw = await callOpenRouter(
    [{ role: 'user', content: prompt }],
    { temperature: 0, max_tokens: 2000, model: EXTRACTION_MODEL }
  )

  const parsed = safeParseJson<InvoiceLLMResult>(raw, {
    ref: filename.replace(/\.pdf$/i, ''),
    type: 'vente',
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

  // Sanitize
  const lines: InvoiceLine[] = (parsed.lines || []).map((l) => ({
    description: String(l.description || ''),
    quantity: num(l.quantity),
    unit_price_ht: num(l.unit_price_ht),
    total_ht: num(l.total_ht),
  }))

  const invoice: CutoffInvoice = {
    ref: safeStr(parsed.ref, filename.replace(/\.pdf$/i, '')),
    type: (['vente', 'achat', 'avoir'].includes(parsed.type) ? parsed.type : 'vente') as 'vente' | 'achat' | 'avoir',
    date: normalizeDate(parsed.date),
    client_or_supplier: safeStr(parsed.client_or_supplier),
    client_code: safeStr(parsed.client_code),
    address: safeStr(parsed.address),
    siret: safeStr(parsed.siret),
    lines,
    total_ht: num(parsed.total_ht),
    tva_rate: num(parsed.tva_rate) || 20,
    tva_amount: num(parsed.tva_amount),
    total_ttc: num(parsed.total_ttc),
    payment_terms: safeStr(parsed.payment_terms),
    due_date: normalizeDate(parsed.due_date),
    linked_bl_ref: safeStr(parsed.linked_bl_ref) || null,
    linked_invoice: safeStr(parsed.linked_invoice) || null,
    note: safeStr(parsed.note) || null,
  }

  console.log(`[CutoffLLM] → Facture ${invoice.ref} (${invoice.type}), date: ${invoice.date}, total HT: ${invoice.total_ht}`)
  return invoice
}

// -----------------------------------------------------------------------------
// 3. Delivery note extraction
// -----------------------------------------------------------------------------

interface DeliveryNoteLLMResult {
  ref: string
  type: 'livraison' | 'reception'
  date_expedition: string | null
  date_delivery: string
  order_ref: string
  linked_invoice: string
  recipient_or_supplier: string
  contact: string
  items_description: string
  quantity: string
  received_by: string
  observations: string
}

/**
 * Extract structured delivery note data from PDF text using LLM.
 */
export async function extractDeliveryNoteWithLLM(
  text: string,
  filename: string
): Promise<DeliveryNote> {
  console.log(`[CutoffLLM] Extraction bon de livraison/réception: ${filename}`)

  const prompt = `Tu es un assistant d'extraction de données pour un commissaire aux comptes français.
Extrais les informations structurées de ce bon de livraison (BL) ou bon de réception (BR).

IMPORTANT :
- Les dates doivent être au format ISO : YYYY-MM-DD (ex: 2025-12-29)
- Si la date est au format DD/MM/YYYY (ex: 29/12/2025), convertis-la en 2025-12-29
- Si un champ n'est pas trouvé, utilise "" pour les textes, null pour les dates optionnelles

Retourne UNIQUEMENT un objet JSON :
{
  "ref": "BL-2025-0042",
  "type": "livraison",
  "date_expedition": "2025-12-28",
  "date_delivery": "2025-12-29",
  "order_ref": "CMD-2025-0100",
  "linked_invoice": "FAC-2025-0891",
  "recipient_or_supplier": "Nom du destinataire ou fournisseur",
  "contact": "M. Dupont",
  "items_description": "Description des articles livrés/reçus",
  "quantity": "10 unités",
  "received_by": "Signature du réceptionnaire",
  "observations": "Observations éventuelles"
}

Notes :
- "type" : "livraison" pour un BL (expédition vers le client), "reception" pour un BR (réception du fournisseur)
- "date_expedition" : date d'expédition (peut être null si non mentionnée)
- "date_delivery" : date de livraison ou de réception — C'EST LA DATE LA PLUS IMPORTANTE pour l'analyse cut-off. OBLIGATOIRE.
- "linked_invoice" : référence de la facture associée (FAC-YYYY-NNNN ou FRN-YYYY-NNNN) si elle est EXPLICITEMENT mentionnée dans le document. Si AUCUNE référence de facture n'apparaît dans le texte, retourne "" (chaîne vide). NE PAS INVENTER de référence.
- "items_description" : description résumée des articles/marchandises
- "quantity" : quantité totale (texte libre, ex: "10 palettes", "250 unités")

Nom du fichier : ${filename}

TEXTE COMPLET DU DOCUMENT :
${text.slice(0, 8000)}`

  const raw = await callOpenRouter(
    [{ role: 'user', content: prompt }],
    { temperature: 0, max_tokens: 1000, model: EXTRACTION_MODEL }
  )

  const parsed = safeParseJson<DeliveryNoteLLMResult>(raw, {
    ref: filename.replace(/\.pdf$/i, ''),
    type: 'livraison',
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

  const note: DeliveryNote = {
    ref: safeStr(parsed.ref, filename.replace(/\.pdf$/i, '')),
    type: parsed.type === 'reception' ? 'reception' : 'livraison',
    date_expedition: normalizeDate(parsed.date_expedition) || null,
    date_delivery: normalizeDate(parsed.date_delivery),
    order_ref: safeStr(parsed.order_ref),
    linked_invoice: safeStr(parsed.linked_invoice),
    recipient_or_supplier: safeStr(parsed.recipient_or_supplier),
    contact: safeStr(parsed.contact),
    items_description: safeStr(parsed.items_description),
    quantity: safeStr(parsed.quantity),
    received_by: safeStr(parsed.received_by),
    observations: safeStr(parsed.observations),
  }

  if (!note.date_delivery) {
    console.warn(`[CutoffLLM] ⚠ Date de livraison non extraite pour ${filename} — signal cut-off potentiellement incomplet`)
  }

  console.log(`[CutoffLLM] → ${note.ref} (${note.type}), livraison: ${note.date_delivery}, facture liée: ${note.linked_invoice || 'N/A'}`)
  return note
}
