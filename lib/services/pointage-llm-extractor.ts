// =============================================================================
// SOF'IA — Extracteur LLM pour le scénario Pointage (vrais PDFs)
// Envoie le texte extrait des PDFs au LLM (via OpenRouter) pour structurer
// les données financières au format PointageCompany.
//
// 4 appels LLM séquentiels (temperature=0, JSON strict) :
//   1. Métadonnées entreprise (nom, forme juridique, SIRET...)
//   2. Bilan (actif 8 postes + passif 10 postes)
//   3. Compte de résultat (charges + produits)
//   4. Annexe (notes numérotées)
// =============================================================================

import { callOpenRouter } from '@/lib/llm/openrouter'
import type {
  PointageCompany,
  BilanActif,
  BilanPassif,
  CompteResultat,
  AnnexeNote,
} from '@/lib/config/pointage-companies'

// -----------------------------------------------------------------------------
// LLM extraction model — uses large-context Gemini
// -----------------------------------------------------------------------------

const EXTRACTION_MODEL = 'google/gemini-2.0-flash-001'

// -----------------------------------------------------------------------------
// Helper: safe JSON parse with fallback
// -----------------------------------------------------------------------------

function safeParseJson<T>(raw: string, fallback: T): T {
  // Try to extract JSON from markdown code blocks
  let cleaned = raw.trim()
  const jsonBlockMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
  if (jsonBlockMatch) {
    cleaned = jsonBlockMatch[1].trim()
  }

  try {
    return JSON.parse(cleaned) as T
  } catch {
    console.warn('[LLM Extractor] JSON parse échoué, tentative de nettoyage...')
    // Try removing trailing commas and other common issues
    try {
      const fixed = cleaned
        .replace(/,\s*}/g, '}')
        .replace(/,\s*]/g, ']')
        .replace(/\n/g, ' ')
      return JSON.parse(fixed) as T
    } catch {
      console.error('[LLM Extractor] JSON parse définitivement échoué.')
      return fallback
    }
  }
}

// -----------------------------------------------------------------------------
// Helper: ensure number (force to 0 if NaN/undefined)
// -----------------------------------------------------------------------------

function num(v: unknown): number {
  if (v == null) return 0
  const n = Number(v)
  return isNaN(n) ? 0 : n
}

// -----------------------------------------------------------------------------
// Appel 1 : Métadonnées entreprise
// -----------------------------------------------------------------------------

interface MetadataResult {
  name: string
  legal_form: string
  address: string
  siret: string
  rcs: string
  president: string
  capital_social: number
  fiscal_year_end: string
}

async function extractMetadata(allText: string): Promise<MetadataResult> {
  console.log('[LLM Extractor] Appel 1/4 : Métadonnées entreprise...')

  const prompt = `Tu es un assistant d'extraction de données financières. Extrais les métadonnées de l'entreprise à partir du texte des comptes annuels ci-dessous.

Retourne UNIQUEMENT un objet JSON valide avec cette structure exacte :
{
  "name": "Nom de l'entreprise",
  "legal_form": "SAS|SARL|SA|SCI|Association|etc.",
  "address": "Adresse complète",
  "siret": "XXX XXX XXX XXXXX",
  "rcs": "Ville B XXX XXX XXX",
  "president": "M./Mme Prénom Nom",
  "capital_social": 0,
  "fiscal_year_end": "YYYY-MM-DD"
}

Si une information n'est pas trouvée, utilise une chaîne vide "" pour les textes et 0 pour les nombres.
La date de clôture fiscal_year_end doit être au format ISO (ex: "2022-12-31").

TEXTE DES COMPTES ANNUELS :
${allText.slice(0, 15000)}`

  const raw = await callOpenRouter(
    [{ role: 'user', content: prompt }],
    { temperature: 0, max_tokens: 500, model: EXTRACTION_MODEL }
  )

  return safeParseJson<MetadataResult>(raw, {
    name: 'Entreprise (nom non extrait)',
    legal_form: '',
    address: '',
    siret: '',
    rcs: '',
    president: '',
    capital_social: 0,
    fiscal_year_end: '',
  })
}

// -----------------------------------------------------------------------------
// Appel 2 : Bilan
// -----------------------------------------------------------------------------

interface BilanResult {
  actif: {
    immobilisations_incorporelles: { brut: number; amort: number; net: number; net_n1: number }
    immobilisations_corporelles: { brut: number; amort: number; net: number; net_n1: number }
    immobilisations_financieres: { brut: number; amort: number; net: number; net_n1: number }
    stocks: { brut: number; amort: number; net: number; net_n1: number }
    creances_clients: { brut: number; amort: number; net: number; net_n1: number }
    autres_creances: { brut: number; amort: number; net: number; net_n1: number }
    disponibilites: { brut: number; amort: number; net: number; net_n1: number }
    charges_constatees_avance: { brut: number; amort: number; net: number; net_n1: number }
  }
  passif: {
    capital_social: { net: number; net_n1: number }
    reserves: { net: number; net_n1: number }
    resultat_exercice: { net: number; net_n1: number }
    report_nouveau: { net: number; net_n1: number }
    provisions_risques: { net: number; net_n1: number }
    emprunts_dettes_financieres: { net: number; net_n1: number }
    dettes_fournisseurs: { net: number; net_n1: number }
    dettes_fiscales_sociales: { net: number; net_n1: number }
    autres_dettes: { net: number; net_n1: number }
    produits_constates_avance: { net: number; net_n1: number }
  }
}

function sanitizeBilanActif(raw: BilanResult['actif']): BilanActif {
  const keys: (keyof BilanActif)[] = [
    'immobilisations_incorporelles', 'immobilisations_corporelles', 'immobilisations_financieres',
    'stocks', 'creances_clients', 'autres_creances', 'disponibilites', 'charges_constatees_avance',
  ]
  const labels: Record<string, string> = {
    immobilisations_incorporelles: 'Immobilisations incorporelles',
    immobilisations_corporelles: 'Immobilisations corporelles',
    immobilisations_financieres: 'Immobilisations financières',
    stocks: 'Stocks et en-cours',
    creances_clients: 'Créances clients et comptes rattachés',
    autres_creances: 'Autres créances',
    disponibilites: 'Disponibilités',
    charges_constatees_avance: 'Charges constatées d\'avance',
  }

  const result = {} as Record<string, unknown>
  for (const key of keys) {
    const src = raw?.[key] || { brut: 0, amort: 0, net: 0, net_n1: 0 }
    result[key] = {
      label: labels[key] || key,
      brut: num(src.brut),
      amort: num(src.amort),
      net: num(src.net) || (num(src.brut) - num(src.amort)),
      net_n1: num(src.net_n1),
    }
  }
  return result as unknown as BilanActif
}

function sanitizeBilanPassif(raw: BilanResult['passif']): BilanPassif {
  const keys: (keyof BilanPassif)[] = [
    'capital_social', 'reserves', 'resultat_exercice', 'report_nouveau',
    'provisions_risques', 'emprunts_dettes_financieres', 'dettes_fournisseurs',
    'dettes_fiscales_sociales', 'autres_dettes', 'produits_constates_avance',
  ]
  const labels: Record<string, string> = {
    capital_social: 'Capital social',
    reserves: 'Réserves',
    resultat_exercice: 'Résultat de l\'exercice',
    report_nouveau: 'Report à nouveau',
    provisions_risques: 'Provisions pour risques et charges',
    emprunts_dettes_financieres: 'Emprunts et dettes financières',
    dettes_fournisseurs: 'Dettes fournisseurs et comptes rattachés',
    dettes_fiscales_sociales: 'Dettes fiscales et sociales',
    autres_dettes: 'Autres dettes',
    produits_constates_avance: 'Produits constatés d\'avance',
  }

  const result = {} as Record<string, unknown>
  for (const key of keys) {
    const src = raw?.[key] || { net: 0, net_n1: 0 }
    result[key] = {
      label: labels[key] || key,
      brut: num(src.net),
      amort: 0,
      net: num(src.net),
      net_n1: num(src.net_n1),
    }
  }
  return result as unknown as BilanPassif
}

async function extractBilan(bilanText: string): Promise<{ actif: BilanActif; passif: BilanPassif }> {
  console.log('[LLM Extractor] Appel 2/4 : Bilan...')

  const prompt = `Tu es un assistant d'extraction de données financières. Extrais les données du BILAN à partir du texte ci-dessous.

IMPORTANT : Les montants sont en euros, sans décimales. Si un montant n'est pas trouvé, mets 0.
Les montants "amort" correspondent aux amortissements/dépréciations.
Les montants N-1 sont ceux de l'exercice précédent.

Retourne UNIQUEMENT un objet JSON valide avec cette structure exacte :
{
  "actif": {
    "immobilisations_incorporelles": { "brut": 0, "amort": 0, "net": 0, "net_n1": 0 },
    "immobilisations_corporelles": { "brut": 0, "amort": 0, "net": 0, "net_n1": 0 },
    "immobilisations_financieres": { "brut": 0, "amort": 0, "net": 0, "net_n1": 0 },
    "stocks": { "brut": 0, "amort": 0, "net": 0, "net_n1": 0 },
    "creances_clients": { "brut": 0, "amort": 0, "net": 0, "net_n1": 0 },
    "autres_creances": { "brut": 0, "amort": 0, "net": 0, "net_n1": 0 },
    "disponibilites": { "brut": 0, "amort": 0, "net": 0, "net_n1": 0 },
    "charges_constatees_avance": { "brut": 0, "amort": 0, "net": 0, "net_n1": 0 }
  },
  "passif": {
    "capital_social": { "net": 0, "net_n1": 0 },
    "reserves": { "net": 0, "net_n1": 0 },
    "resultat_exercice": { "net": 0, "net_n1": 0 },
    "report_nouveau": { "net": 0, "net_n1": 0 },
    "provisions_risques": { "net": 0, "net_n1": 0 },
    "emprunts_dettes_financieres": { "net": 0, "net_n1": 0 },
    "dettes_fournisseurs": { "net": 0, "net_n1": 0 },
    "dettes_fiscales_sociales": { "net": 0, "net_n1": 0 },
    "autres_dettes": { "net": 0, "net_n1": 0 },
    "produits_constates_avance": { "net": 0, "net_n1": 0 }
  }
}

Notes :
- "amort" = amortissements et dépréciations (colonne du milieu dans un bilan standard)
- "net" = brut - amort (ou montant net de l'exercice pour le passif)
- "net_n1" = montant net de l'exercice précédent
- Regroupe les sous-postes dans la catégorie principale appropriée
- Pour le passif, "net" = montant de l'exercice, "net_n1" = montant N-1

TEXTE DU BILAN :
${bilanText.slice(0, 80000)}`

  const raw = await callOpenRouter(
    [{ role: 'user', content: prompt }],
    { temperature: 0, max_tokens: 3000, model: EXTRACTION_MODEL }
  )

  const parsed = safeParseJson<BilanResult>(raw, {
    actif: {} as BilanResult['actif'],
    passif: {} as BilanResult['passif'],
  })

  return {
    actif: sanitizeBilanActif(parsed.actif),
    passif: sanitizeBilanPassif(parsed.passif),
  }
}

// -----------------------------------------------------------------------------
// Appel 3 : Compte de résultat
// -----------------------------------------------------------------------------

interface CRResult {
  produits_exploitation: Array<{ label: string; montant: number; montant_n1: number }>
  charges_exploitation: Array<{ label: string; montant: number; montant_n1: number }>
  resultat_exploitation: number
  resultat_exploitation_n1: number
  produits_financiers: Array<{ label: string; montant: number; montant_n1: number }>
  charges_financieres: Array<{ label: string; montant: number; montant_n1: number }>
  resultat_financier: number
  resultat_financier_n1: number
  produits_exceptionnels: Array<{ label: string; montant: number; montant_n1: number }>
  charges_exceptionnelles: Array<{ label: string; montant: number; montant_n1: number }>
  resultat_exceptionnel: number
  resultat_exceptionnel_n1: number
  impot_benefices: number
  impot_benefices_n1: number
  resultat_net: number
  resultat_net_n1: number
}

function sanitizeCR(raw: CRResult): CompteResultat {
  const sanitizeLines = (lines: Array<{ label: string; montant: number; montant_n1: number }> | undefined) =>
    (lines || []).map((l) => ({
      label: l.label || 'Non identifié',
      montant: num(l.montant),
      montant_n1: num(l.montant_n1),
    }))

  return {
    produits_exploitation: sanitizeLines(raw.produits_exploitation),
    charges_exploitation: sanitizeLines(raw.charges_exploitation),
    resultat_exploitation: num(raw.resultat_exploitation),
    resultat_exploitation_n1: num(raw.resultat_exploitation_n1),
    produits_financiers: sanitizeLines(raw.produits_financiers),
    charges_financieres: sanitizeLines(raw.charges_financieres),
    resultat_financier: num(raw.resultat_financier),
    resultat_financier_n1: num(raw.resultat_financier_n1),
    produits_exceptionnels: sanitizeLines(raw.produits_exceptionnels),
    charges_exceptionnelles: sanitizeLines(raw.charges_exceptionnelles),
    resultat_exceptionnel: num(raw.resultat_exceptionnel),
    resultat_exceptionnel_n1: num(raw.resultat_exceptionnel_n1),
    impot_benefices: num(raw.impot_benefices),
    impot_benefices_n1: num(raw.impot_benefices_n1),
    resultat_net: num(raw.resultat_net),
    resultat_net_n1: num(raw.resultat_net_n1),
  }
}

async function extractCompteResultat(crText: string): Promise<CompteResultat> {
  console.log('[LLM Extractor] Appel 3/4 : Compte de résultat...')

  const prompt = `Tu es un assistant d'extraction de données financières. Extrais les données du COMPTE DE RÉSULTAT à partir du texte ci-dessous.

IMPORTANT : Les montants sont en euros, sans décimales. Si un montant n'est pas trouvé, mets 0.
"montant" = exercice courant (N), "montant_n1" = exercice précédent (N-1).

Retourne UNIQUEMENT un objet JSON valide avec cette structure exacte :
{
  "produits_exploitation": [
    { "label": "Chiffre d'affaires net", "montant": 0, "montant_n1": 0 },
    { "label": "Production stockée", "montant": 0, "montant_n1": 0 }
  ],
  "charges_exploitation": [
    { "label": "Achats de marchandises", "montant": 0, "montant_n1": 0 },
    { "label": "Autres achats et charges externes", "montant": 0, "montant_n1": 0 },
    { "label": "Salaires et traitements", "montant": 0, "montant_n1": 0 },
    { "label": "Charges sociales", "montant": 0, "montant_n1": 0 },
    { "label": "Dotations aux amortissements", "montant": 0, "montant_n1": 0 }
  ],
  "resultat_exploitation": 0,
  "resultat_exploitation_n1": 0,
  "produits_financiers": [{ "label": "Produits financiers", "montant": 0, "montant_n1": 0 }],
  "charges_financieres": [{ "label": "Charges financières", "montant": 0, "montant_n1": 0 }],
  "resultat_financier": 0,
  "resultat_financier_n1": 0,
  "produits_exceptionnels": [{ "label": "Produits exceptionnels", "montant": 0, "montant_n1": 0 }],
  "charges_exceptionnelles": [{ "label": "Charges exceptionnelles", "montant": 0, "montant_n1": 0 }],
  "resultat_exceptionnel": 0,
  "resultat_exceptionnel_n1": 0,
  "impot_benefices": 0,
  "impot_benefices_n1": 0,
  "resultat_net": 0,
  "resultat_net_n1": 0
}

Notes :
- Liste tous les postes que tu trouves dans chaque catégorie
- Le résultat net est le solde final après impôts
- Les charges sont des montants positifs (pas négatifs)

TEXTE DU COMPTE DE RÉSULTAT :
${crText.slice(0, 80000)}`

  const raw = await callOpenRouter(
    [{ role: 'user', content: prompt }],
    { temperature: 0, max_tokens: 3000, model: EXTRACTION_MODEL }
  )

  const parsed = safeParseJson<CRResult>(raw, {
    produits_exploitation: [],
    charges_exploitation: [],
    resultat_exploitation: 0,
    resultat_exploitation_n1: 0,
    produits_financiers: [],
    charges_financieres: [],
    resultat_financier: 0,
    resultat_financier_n1: 0,
    produits_exceptionnels: [],
    charges_exceptionnelles: [],
    resultat_exceptionnel: 0,
    resultat_exceptionnel_n1: 0,
    impot_benefices: 0,
    impot_benefices_n1: 0,
    resultat_net: 0,
    resultat_net_n1: 0,
  })

  return sanitizeCR(parsed)
}

// -----------------------------------------------------------------------------
// Appel 4 : Annexe
// -----------------------------------------------------------------------------

interface AnnexeResult {
  notes: Array<{
    numero: number
    titre: string
    contenu: string
    montants?: Record<string, number>
  }>
}

async function extractAnnexe(annexeText: string): Promise<AnnexeNote[]> {
  console.log('[LLM Extractor] Appel 4/4 : Annexe...')

  const prompt = `Tu es un assistant d'extraction de données financières. Extrais les notes de l'ANNEXE AUX COMPTES ANNUELS à partir du texte ci-dessous.

IMPORTANT : Identifie chaque note/section de l'annexe, numérote-les séquentiellement, et extrais les montants clés mentionnés.

Retourne UNIQUEMENT un objet JSON valide avec cette structure exacte :
{
  "notes": [
    {
      "numero": 1,
      "titre": "Règles et méthodes comptables",
      "contenu": "Résumé du contenu de la note (2-3 phrases max)",
      "montants": { "clé_descriptive": 12345 }
    }
  ]
}

Règles pour les notes :
- Numérote séquentiellement à partir de 1
- "titre" = titre de la section/note
- "contenu" = résumé factuel du contenu (2-4 phrases)
- "montants" = dictionnaire des montants clés mentionnés dans la note (optionnel)
  - Clés en snake_case (ex: "brut", "amort", "net", "total", "honoraires_n", "honoraires_n1")
  - Pour les immobilisations : utilise "brut", "amort", "net"
  - Pour les charges externes détaillées : utilise "honoraires_n" et "honoraires_n1" si les honoraires N et N-1 sont mentionnés
- IMPORTANT : Si tu trouves une note sur les engagements hors bilan, inclus-la avec le titre exact "Engagements hors bilan"
- IMPORTANT : Si tu trouves une section "Autres informations" ou "Charges externes", détaille les montants des honoraires si disponibles

TEXTE DE L'ANNEXE :
${annexeText.slice(0, 60000)}`

  const raw = await callOpenRouter(
    [{ role: 'user', content: prompt }],
    { temperature: 0, max_tokens: 4000, model: EXTRACTION_MODEL }
  )

  const parsed = safeParseJson<AnnexeResult>(raw, { notes: [] })

  return (parsed.notes || []).map((n, i) => ({
    numero: n.numero || i + 1,
    titre: n.titre || `Note ${i + 1}`,
    contenu: n.contenu || '',
    montants: n.montants,
  }))
}

// -----------------------------------------------------------------------------
// Main entry point
// -----------------------------------------------------------------------------

/**
 * Extrait les données financières structurées à partir du texte des PDFs.
 * Effectue 4 appels LLM séquentiels pour construire un objet PointageCompany.
 *
 * @param bilanText - Texte extrait du PDF du bilan (ou section bilan d'un PDF combiné)
 * @param crText - Texte extrait du PDF du CR
 * @param annexeText - Texte extrait du PDF de l'annexe
 * @param allText - Texte complet de tous les PDFs (utilisé pour les métadonnées)
 */
export async function extractPointageCompanyFromPdfs(
  bilanText: string,
  crText: string,
  annexeText: string,
  allText?: string
): Promise<PointageCompany> {
  const startTime = Date.now()
  console.log('[LLM Extractor] Début de l\'extraction structurée (4 appels LLM)...')

  // Appel 1 : Métadonnées
  const metadata = await extractMetadata(allText || bilanText)
  console.log(`[LLM Extractor] Métadonnées extraites : ${metadata.name}`)

  // Appel 2 : Bilan
  const bilan = await extractBilan(bilanText)
  console.log('[LLM Extractor] Bilan extrait.')

  // Appel 3 : Compte de résultat
  const compteResultat = await extractCompteResultat(crText)
  console.log(`[LLM Extractor] CR extrait — résultat net : ${compteResultat.resultat_net}`)

  // Appel 4 : Annexe
  const annexe = await extractAnnexe(annexeText)
  console.log(`[LLM Extractor] Annexe extraite — ${annexe.length} notes`)

  const elapsed = Date.now() - startTime
  console.log(`[LLM Extractor] Extraction complète en ${elapsed} ms.`)

  // Déterminer la date de clôture à partir des métadonnées ou du texte
  const fiscalYearEnd = metadata.fiscal_year_end || guessFiscalYearEnd(allText || bilanText)

  return {
    id: `real_pdf_${Date.now()}`,
    name: metadata.name,
    legal_form: metadata.legal_form,
    address: metadata.address,
    siret: metadata.siret,
    rcs: metadata.rcs,
    president: metadata.president,
    capital_social: metadata.capital_social,
    fiscal_year_end: fiscalYearEnd,
    bilan,
    compte_resultat: compteResultat,
    annexe,
    expected_signals: [], // Not applicable for real PDFs
    is_faulty: false, // Will be determined by signal detection
  }
}

/**
 * Tente de deviner la date de clôture à partir du texte.
 */
function guessFiscalYearEnd(text: string): string {
  // Common patterns: "31/12/2022", "31 décembre 2022", "exercice clos le 31/12/2022"

  // DD/MM/YYYY format
  const dateSlash = text.match(/(\d{2})\/(\d{2})\/(\d{4})/)
  if (dateSlash) {
    return `${dateSlash[3]}-${dateSlash[2]}-${dateSlash[1]}`
  }

  // "31 décembre 2022" format
  const monthNames: Record<string, string> = {
    janvier: '01', fevrier: '02', mars: '03', avril: '04',
    mai: '05', juin: '06', juillet: '07', aout: '08',
    septembre: '09', octobre: '10', novembre: '11', decembre: '12',
  }
  const dateText = text.match(/(\d{1,2})\s+(d[eé]cembre|janvier|f[eé]vrier|mars|avril|mai|juin|juillet|ao[uû]t|septembre|octobre|novembre)\s+(\d{4})/i)
  if (dateText) {
    const day = dateText[1].padStart(2, '0')
    const monthKey = dateText[2].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    const month = monthNames[monthKey] || '12'
    return `${dateText[3]}-${month}-${day}`
  }

  return '' // Unknown
}
