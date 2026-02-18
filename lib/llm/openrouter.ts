// =============================================================================
// SOF'IA — Client OpenRouter (API compatible OpenAI)
// Utilisé pour :
//   1. Explications des scores de confiance
//   2. Évaluation PTG-005 (suffisance de l'explication annexe)
//   3. Narratif de synthèse (livrable 3)
// Modèle par défaut : Gemini Flash 3.0 via OpenRouter, temperature = 0
// =============================================================================

// Types pour les messages multimodaux (vision)
type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }

type MessageContent = string | ContentPart[]

interface OpenRouterMultimodalMessage {
  role: 'system' | 'user' | 'assistant'
  content: MessageContent
}

interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface OpenRouterResponse {
  choices: Array<{
    message: {
      content: string
    }
  }>
}

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions'

/**
 * Appelle un modèle via OpenRouter (API OpenAI-compatible).
 * Retourne le contenu texte de la réponse.
 */
export async function callOpenRouter(
  messages: OpenRouterMessage[],
  options?: {
    temperature?: number
    max_tokens?: number
    model?: string
  }
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey || apiKey === '<YOUR_OPENROUTER_API_KEY>') {
    throw new Error('OPENROUTER_API_KEY non configurée.')
  }

  const model = options?.model || process.env.OPENROUTER_MODEL || 'google/gemini-2.0-flash-001'
  console.log(`[OpenRouter] Appel LLM — modèle: ${model}, temperature: ${options?.temperature ?? 0}, max_tokens: ${options?.max_tokens ?? 200}`)

  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://sofia-poc.vercel.app',
      'X-Title': 'Sof\'IA POC',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: options?.temperature ?? 0,
      max_tokens: options?.max_tokens ?? 200,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error(`[OpenRouter] ✗ Erreur HTTP ${response.status}: ${errorText}`)
    throw new Error(`OpenRouter API error: ${response.status}`)
  }

  const data = (await response.json()) as OpenRouterResponse
  const content = data.choices?.[0]?.message?.content?.trim() || ''
  console.log(`[OpenRouter] ✓ Réponse reçue (${content.length} caractères)`)
  return content
}

/**
 * Appelle un modele via OpenRouter avec support multimodal (texte + images).
 * Utilise pour l'OCR de documents scannes via Gemini Vision.
 */
export async function callOpenRouterVision(
  systemPrompt: string,
  userPrompt: string,
  files: Array<{ base64: string; mimeType: string }>,
  options?: {
    temperature?: number
    max_tokens?: number
    model?: string
  }
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey || apiKey === '<YOUR_OPENROUTER_API_KEY>') {
    throw new Error('OPENROUTER_API_KEY non configuree.')
  }

  if (!files || files.length === 0) {
    throw new Error('callOpenRouterVision: aucun fichier fourni pour l\'analyse vision.')
  }

  const model = options?.model || process.env.OPENROUTER_MODEL || 'google/gemini-2.0-flash-001'
  console.log(`[OpenRouter Vision] Appel LLM multimodal — modele: ${model}, fichiers: ${files.length}`)

  // Build multimodal user message with text + images
  const userContent: ContentPart[] = [
    { type: 'text', text: userPrompt },
    ...files.map((f) => ({
      type: 'image_url' as const,
      image_url: { url: `data:${f.mimeType};base64,${f.base64}` },
    })),
  ]

  const messages: OpenRouterMultimodalMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userContent },
  ]

  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://sofia-poc.vercel.app',
      'X-Title': "Sof'IA POC",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: options?.temperature ?? 0,
      max_tokens: options?.max_tokens ?? 4000,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error(`[OpenRouter Vision] ✗ Erreur HTTP ${response.status}: ${errorText}`)
    throw new Error(`OpenRouter Vision API error: ${response.status}`)
  }

  const data = (await response.json()) as OpenRouterResponse
  const content = data.choices?.[0]?.message?.content?.trim() || ''
  console.log(`[OpenRouter Vision] ✓ Reponse recue (${content.length} caracteres)`)
  return content
}

/**
 * Génère une explication courte du score de confiance d'un signal documentaire.
 * Temperature = 0 pour un résultat déterministe.
 */
export async function generateConfidenceExplanation(context: {
  rule_triggered: string
  confidence_score: number
  description: string
  source_document: string
  detection_method: string
}): Promise<string> {
  const systemPrompt = `Tu es un assistant de pré-analyse documentaire pour un commissaire aux comptes (CAC) français.
Tu dois expliquer en 2-3 phrases pourquoi le score de confiance d'un signal documentaire est à ${context.confidence_score}%.

RÈGLES ABSOLUES :
- Tu expliques la fiabilité de la DÉTECTION, jamais la gravité du constat.
- Tu ne fais AUCUNE conclusion d'audit.
- Tu ne qualifies JAMAIS un signal de "significatif" ou "non significatif".
- Tu ne recommandes AUCUNE action.
- Tu utilises un ton factuel et professionnel.
- Tu réponds en français.
- 2-3 phrases maximum, pas de bullet points.`

  const userPrompt = `Signal : ${context.rule_triggered}
Score de confiance : ${context.confidence_score}%
Description : ${context.description}
Document source : ${context.source_document}
Méthode de détection : ${context.detection_method}

Explique pourquoi le score de confiance est à ${context.confidence_score}%.`

  return callOpenRouter(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    { temperature: 0, max_tokens: 200 }
  )
}

// -----------------------------------------------------------------------------
// 2. Évaluation PTG-005 — suffisance de l'explication dans l'annexe
// -----------------------------------------------------------------------------

export interface ExplanationEvaluation {
  sufficient: boolean
  reasoning: string
  confidence: number
}

/**
 * Demande au LLM d'évaluer si le texte de l'annexe fournit une explication
 * suffisante pour une variation notable d'un poste du CR.
 * Temperature = 0 pour un résultat déterministe.
 */
export async function evaluateExplanationSufficiency(context: {
  poste: string
  montant_n: number
  montant_n1: number
  variation_pct: number
  annexe_text: string
  note_numero: number
}): Promise<ExplanationEvaluation> {
  const systemPrompt = `Tu es un assistant de pré-analyse documentaire pour un commissaire aux comptes (CAC) français.
On te donne une variation notable d'un poste du compte de résultat et le texte de l'annexe correspondante.
Tu dois évaluer FACTUELLEMENT si l'annexe fournit une explication suffisamment détaillée pour cette variation.

CRITÈRES D'ÉVALUATION :
- L'annexe mentionne-t-elle SPÉCIFIQUEMENT le poste concerné ?
- L'annexe donne-t-elle une CAUSE identifiable de la variation (ex: investissement, recrutement, contrat spécifique) ?
- L'explication est-elle PROPORTIONNÉE à l'ampleur de la variation ?
- Une mention vague comme "divers" ou "prestations diverses" sans détail est INSUFFISANTE.

RÈGLES ABSOLUES :
- Tu ne fais AUCUNE conclusion d'audit.
- Tu ne qualifies JAMAIS de "significatif" ou "non significatif".
- Tu ne recommandes AUCUNE action.
- Tu constates FACTUELLEMENT si l'explication est détaillée ou non.

Réponds UNIQUEMENT au format JSON (sans markdown, sans backticks) :
{"sufficient": true/false, "reasoning": "explication factuelle en 1-2 phrases", "confidence": 0-100}`

  const userPrompt = `Poste : ${context.poste}
Montant N : ${context.montant_n} EUR
Montant N-1 : ${context.montant_n1} EUR
Variation : ${context.variation_pct > 0 ? '+' : ''}${context.variation_pct.toFixed(1)} %

Texte de l'annexe (Note ${context.note_numero}) :
"${context.annexe_text}"

L'annexe fournit-elle une explication suffisamment détaillée pour cette variation ?`

  const raw = await callOpenRouter(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    { temperature: 0, max_tokens: 200 }
  )

  try {
    // Nettoyer la réponse (enlever backticks markdown si présents)
    const cleaned = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
    const parsed = JSON.parse(cleaned)
    return {
      sufficient: Boolean(parsed.sufficient),
      reasoning: String(parsed.reasoning || ''),
      confidence: Number(parsed.confidence) || 70,
    }
  } catch {
    console.warn('[OpenRouter] Impossible de parser la réponse PTG-005, fallback heuristique:', raw)
    throw new Error('Réponse LLM non parseable')
  }
}

// -----------------------------------------------------------------------------
// 3. Narratif de synthèse (livrable 3)
// -----------------------------------------------------------------------------

/**
 * Génère un paragraphe narratif professionnel pour la synthèse de pré-analyse.
 * Le texte est intégrable directement dans le dossier de travail NEP 230.
 * Temperature = 0.2 pour un peu de variété naturelle tout en restant factuel.
 */
export async function generateSynthesisNarrative(context: {
  mission_name: string
  scenario: string
  company_name: string
  signals: Array<{ rule: string; description: string; priority: string; type: string }>
  completeness: Array<{ label: string; status: string; count: number }>
}): Promise<string> {
  const systemPrompt = `Tu es un rédacteur spécialisé dans les dossiers de travail pour commissaires aux comptes (CAC) en France.
Tu rédiges un paragraphe de synthèse des constats documentaires issus d'une pré-analyse automatisée (Sof'IA).
Ce texte sera intégré directement dans le dossier de travail du CAC (NEP 230).

STYLE ET TON :
- Rédaction professionnelle, factuelle, concise.
- Vocabulaire d'audit : "constat documentaire", "signal documentaire", "nécessite l'attention", "pré-analyse".
- Structure narrative fluide (pas de bullet points, pas de tableau).
- 3 à 5 phrases maximum.
- En français.

RÈGLES ABSOLUES :
- JAMAIS de conclusion d'audit ("les comptes sont...", "il existe un risque de...").
- JAMAIS le mot "anomalie" → utiliser "signal documentaire".
- JAMAIS "significatif" ou "non significatif".
- JAMAIS de recommandation ("il conviendrait de...", "nous recommandons...").
- Tu CONSTATES, tu ne JUGES pas.
- Mentionne le nombre de signaux par niveau de priorité.
- Mentionne les principaux types de constats observés.
- Termine par rappeler que ces constats nécessitent la validation du commissaire aux comptes.`

  const signalsSummary = context.signals.length > 0
    ? context.signals.map((s) => `- [${s.rule}] (${s.priority}) ${s.description}`).join('\n')
    : 'Aucun signal documentaire détecté.'

  const docsSummary = context.completeness
    .map((c) => `- ${c.label} : ${c.status} (${c.count})`)
    .join('\n')

  const userPrompt = `Mission : ${context.mission_name}
Scénario : ${context.scenario}
Entreprise : ${context.company_name}

Documents analysés :
${docsSummary}

Signaux documentaires détectés (${context.signals.length}) :
${signalsSummary}

Rédige le paragraphe de synthèse des principaux constats documentaires.`

  return callOpenRouter(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    { temperature: 0.2, max_tokens: 400 }
  )
}
