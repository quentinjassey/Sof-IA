// =============================================================================
// SOF'IA -- Synthese de pre-analyse documentaire (PDF)
// Generates a structured PDF synthesis for integration into the CAC work file
// (NEP 230 compliance). Uses pdfmake for server-side PDF generation.
// Dependency: pdfmake (npm install pdfmake @types/pdfmake)
// =============================================================================

// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const PdfPrinter = require('pdfmake') as any
import type { TDocumentDefinitions, Content, TableCell } from 'pdfmake/interfaces'
import type { Signal, Profile, Mission, Completeness } from '@/types/database'

// -----------------------------------------------------------------------------
// Fonts configuration
// -----------------------------------------------------------------------------

const fonts = {
  Roboto: {
    normal: 'node_modules/pdfmake/build/vfs_fonts.js',
    bold: 'node_modules/pdfmake/build/vfs_fonts.js',
    italics: 'node_modules/pdfmake/build/vfs_fonts.js',
    bolditalics: 'node_modules/pdfmake/build/vfs_fonts.js',
  },
}

// -----------------------------------------------------------------------------
// Labels
// -----------------------------------------------------------------------------

const SCENARIO_LABELS: Record<string, string> = {
  sondage_ca: 'Sondage sur le chiffre d\'affaires',
  cutoff: 'Cesure d\'exercice (cut-off)',
  pointage: 'Pointage des etats financiers',
}

const SCENARIO_DESCRIPTIONS: Record<string, string> = {
  sondage_ca:
    'la pre-analyse documentaire des ecritures de ventes selectionnees pour le sondage sur le chiffre d\'affaires de la societe ACME Distribution SAS, exercice clos au 31/12/2025.',
  cutoff:
    'la pre-analyse documentaire des operations enregistrees autour de la date de cloture (31/12/2025) de la societe ACME Distribution SAS, dans le cadre de la verification de la cesure d\'exercice.',
  pointage:
    'la verification de la coherence documentaire entre les etats financiers (bilan, compte de resultat) et l\'annexe aux comptes annuels de la societe ACME Distribution SAS, exercice clos au 31/12/2025.',
}

const SIGNAL_TYPE_LABELS: Record<string, string> = {
  absence_piece: 'Piece justificative manquante',
  incoherence_date: 'Incoherence de dates',
  incoherence_montant: 'Ecart de montant',
  rupture_chaine: 'Rupture de la chaine documentaire',
  rattachement_temporel: 'Doute sur le rattachement temporel',
  incompletude: 'Information incomplete',
}

const PRIORITY_LABELS: Record<string, string> = {
  high: 'elevee',
  medium: 'moyenne',
  low: 'faible',
}

const STATUS_LABELS: Record<string, string> = {
  present: 'Present',
  missing: 'Manquant',
  incomplete: 'Incomplet',
}

// -----------------------------------------------------------------------------
// Generator
// -----------------------------------------------------------------------------

export interface SynthesisGeneratorInput {
  mission: Mission
  profile: Profile
  signals: Signal[]
  completeness: Completeness[]
}

/**
 * Generates a PDF synthesis for NEP 230 integration.
 * Returns a Buffer containing the PDF data.
 */
export async function generateSynthesisPdf(
  input: SynthesisGeneratorInput
): Promise<Buffer> {
  const { mission, profile, signals, completeness } = input
  const generatedAt = new Date()
  const formattedDate = formatDateFr(generatedAt)

  // Compute statistics
  const byPriority = {
    high: signals.filter((s) => s.priority === 'high').length,
    medium: signals.filter((s) => s.priority === 'medium').length,
    low: signals.filter((s) => s.priority === 'low').length,
  }
  const byDecision = {
    pending: signals.filter((s) => s.human_decision === 'pending').length,
    validated: signals.filter((s) => s.human_decision === 'validated').length,
    rejected: signals.filter((s) => s.human_decision === 'rejected').length,
    to_investigate: signals.filter((s) => s.human_decision === 'to_investigate').length,
  }

  // Group signals by type for summary
  const signalsByType: Record<string, Signal[]> = {}
  for (const signal of signals) {
    if (!signalsByType[signal.type]) {
      signalsByType[signal.type] = []
    }
    signalsByType[signal.type].push(signal)
  }

  // Top signals (high priority first, then medium)
  const topSignals = signals
    .filter((s) => s.priority === 'high' || s.priority === 'medium')
    .sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 }
      return priorityOrder[a.priority] - priorityOrder[b.priority]
    })
    .slice(0, 5)

  // Build documents analyzed table
  const docsTableBody: TableCell[][] = [
    [
      { text: 'Type de document', style: 'smallTableHeader' },
      { text: 'Statut', style: 'smallTableHeader' },
      { text: 'Detail', style: 'smallTableHeader' },
    ],
  ]
  for (const entry of completeness) {
    docsTableBody.push([
      { text: entry.label, style: 'smallTableCell' },
      {
        text: STATUS_LABELS[entry.status] || entry.status,
        style: 'smallTableCell',
        color: entry.status === 'present' ? '#22c55e' : entry.status === 'missing' ? '#ef4444' : '#f59e0b',
      },
      { text: entry.note || (entry.count > 0 ? `${entry.count} document(s)` : '-'), style: 'smallTableCell' },
    ])
  }

  // Build signals by type summary
  const signalTypeSummary: Content[] = Object.entries(signalsByType).map(([type, typeSignals]) => ({
    text: `\u2022 ${SIGNAL_TYPE_LABELS[type] || type} : ${typeSignals.length} signal(s) (${typeSignals.filter((s) => s.priority === 'high').length} de priorite elevee)`,
    style: 'bodyText',
    margin: [15, 2, 0, 2] as [number, number, number, number],
  }))

  // Build top signal descriptions
  const topSignalDescriptions: Content[] = topSignals.map((signal, index) => ({
    text: `${index + 1}. [${signal.rule_triggered || '-'}] ${signal.description}`,
    style: 'bodyText',
    margin: [15, 2, 0, 2] as [number, number, number, number],
  }))

  // Build document definition
  const docDefinition: TDocumentDefinitions = {
    pageSize: 'A4',
    pageMargins: [40, 60, 40, 80],

    header: {
      columns: [
        {
          text: 'Sof\'IA',
          style: 'headerBrand',
          margin: [40, 20, 0, 0],
        },
        {
          text: 'Synthese de pre-analyse documentaire',
          style: 'headerTitle',
          alignment: 'right',
          margin: [0, 20, 40, 0],
        },
      ],
    },

    footer: (currentPage: number, pageCount: number): Content => ({
      stack: [
        {
          text: 'Analyse automatique \u2014 a valider par le commissaire aux comptes. Sof\'IA ne se substitue pas au jugement professionnel.',
          style: 'disclaimer',
          alignment: 'center',
          margin: [40, 0, 40, 5],
        },
        {
          text: `Page ${currentPage} / ${pageCount}`,
          alignment: 'center',
          style: 'footerPage',
        },
      ],
    }),

    content: [
      // Title block
      {
        table: {
          widths: ['*'],
          body: [
            [
              {
                stack: [
                  { text: 'SYNTHESE DE PRE-ANALYSE DOCUMENTAIRE', style: 'mainTitle' },
                  { text: 'Integrable au dossier de travail \u2014 NEP 230', style: 'subtitle' },
                ],
                margin: [10, 10, 10, 10],
              },
            ],
          ],
        },
        layout: {
          hLineWidth: () => 2,
          vLineWidth: () => 2,
          hLineColor: () => '#1e3a5f',
          vLineColor: () => '#1e3a5f',
        },
      } as Content,

      { text: '', margin: [0, 10, 0, 0] },

      // Mission info block
      {
        columns: [
          {
            width: 'auto',
            stack: [
              { text: 'Mission :', style: 'labelText' },
              { text: 'Scenario :', style: 'labelText' },
              { text: 'Date de pre-analyse :', style: 'labelText' },
              { text: 'Commissaire aux comptes :', style: 'labelText' },
              { text: 'Cabinet :', style: 'labelText' },
              ...(profile.inscription_cncc
                ? [{ text: 'N\u00b0 CNCC :', style: 'labelText' } as Content]
                : []),
            ],
          },
          {
            width: '*',
            stack: [
              { text: mission.name, style: 'valueText' },
              { text: SCENARIO_LABELS[mission.scenario] || mission.scenario, style: 'valueText' },
              { text: formattedDate, style: 'valueText' },
              { text: profile.name, style: 'valueText' },
              { text: profile.cabinet, style: 'valueText' },
              ...(profile.inscription_cncc
                ? [{ text: profile.inscription_cncc, style: 'valueText' } as Content]
                : []),
            ],
            margin: [10, 0, 0, 0],
          },
        ],
      } as Content,

      { text: '', margin: [0, 15, 0, 0] },

      // Section 1: Perimetre
      { text: '1. PERIMETRE DE LA PRE-ANALYSE', style: 'sectionTitle' },
      {
        text: `La presente pre-analyse porte sur ${completeness.reduce((sum, c) => sum + c.count, 0)} document(s) relatif(s) a ${SCENARIO_DESCRIPTIONS[mission.scenario] || 'la mission d\'audit.'}`,
        style: 'bodyText',
        margin: [0, 5, 0, 10],
      },
      // Documents table
      {
        table: {
          headerRows: 1,
          widths: ['*', 60, '*'],
          body: docsTableBody,
        },
        layout: {
          hLineWidth: (i: number, node: { table: { body: unknown[][] } }) =>
            i === 0 || i === 1 || i === node.table.body.length ? 1 : 0.5,
          vLineWidth: () => 0.5,
          hLineColor: (i: number) => (i <= 1 ? '#1e3a5f' : '#e2e8f0'),
          vLineColor: () => '#e2e8f0',
          fillColor: (i: number) => (i === 0 ? '#1e3a5f' : null),
          paddingLeft: () => 6,
          paddingRight: () => 6,
          paddingTop: () => 4,
          paddingBottom: () => 4,
        },
      } as Content,

      { text: '', margin: [0, 15, 0, 0] },

      // Section 2: Principaux constats
      { text: '2. PRINCIPAUX CONSTATS DOCUMENTAIRES', style: 'sectionTitle' },
      {
        text: `La pre-analyse a identifie ${signals.length} signal(s) documentaire(s) :`,
        style: 'bodyText',
        margin: [0, 5, 0, 5],
      },
      {
        ul: [
          `${byPriority.high} signal(s) de priorite elevee`,
          `${byPriority.medium} signal(s) de priorite moyenne`,
          `${byPriority.low} signal(s) de priorite faible`,
        ],
        style: 'bodyText',
        margin: [15, 0, 0, 10],
      } as Content,

      // Breakdown by type
      ...(signalTypeSummary.length > 0
        ? [
            { text: 'Repartition par type de signal :', style: 'bodyText', bold: true, margin: [0, 5, 0, 5] } as Content,
            ...signalTypeSummary,
          ]
        : []),

      { text: '', margin: [0, 5, 0, 0] },

      // Top signals
      ...(topSignalDescriptions.length > 0
        ? [
            { text: 'Principaux constats :', style: 'bodyText', bold: true, margin: [0, 5, 0, 5] } as Content,
            ...topSignalDescriptions,
          ]
        : []),

      { text: '', margin: [0, 15, 0, 0] },

      // Section 3: Decisions
      { text: '3. DECISIONS DU COMMISSAIRE AUX COMPTES', style: 'sectionTitle' },
      {
        text: `Sur les ${signals.length} signal(s) documentaire(s) identifie(s) :`,
        style: 'bodyText',
        margin: [0, 5, 0, 5],
      },
      {
        ul: [
          `${byDecision.validated} valide(s) par le commissaire aux comptes`,
          `${byDecision.rejected} rejete(s)`,
          `${byDecision.to_investigate} a approfondir`,
          `${byDecision.pending} en attente de decision`,
        ],
        style: 'bodyText',
        margin: [15, 0, 0, 10],
      } as Content,

      { text: '', margin: [0, 15, 0, 0] },

      // Section 4: Limites
      { text: '4. LIMITES DE L\'ANALYSE', style: 'sectionTitle' },
      {
        table: {
          widths: ['*'],
          body: [
            [
              {
                stack: [
                  {
                    text: 'La presente pre-analyse est realisee par un outil d\'intelligence artificielle (Sof\'IA). Elle porte exclusivement sur des constats documentaires factuels.',
                    style: 'limitText',
                  },
                  { text: '', margin: [0, 5, 0, 0] },
                  { text: 'Elle ne constitue en aucun cas :', style: 'limitText' },
                  {
                    ul: [
                      'une conclusion d\'audit,',
                      'une qualification de signal documentaire,',
                      'une recommandation d\'opinion.',
                    ],
                    style: 'limitText',
                    margin: [15, 3, 0, 3],
                  } as Content,
                  { text: '', margin: [0, 3, 0, 0] },
                  {
                    text: 'L\'ensemble des signaux documentaires a ete soumis a la validation du commissaire aux comptes, qui reste seul decisionnaire.',
                    style: 'limitText',
                    bold: true,
                  },
                ],
                margin: [10, 8, 10, 8],
              },
            ],
          ],
        },
        layout: {
          hLineWidth: () => 1,
          vLineWidth: () => 1,
          hLineColor: () => '#f59e0b',
          vLineColor: () => '#f59e0b',
          fillColor: () => '#fffbeb',
        },
      } as Content,

      { text: '', margin: [0, 20, 0, 0] },

      // Section 5: Validation
      { text: '5. VALIDATION', style: 'sectionTitle' },
      {
        text: `Cette synthese a ete generee par Sof'IA. Elle necessite la validation du commissaire aux comptes.`,
        style: 'bodyText',
        italics: true,
        margin: [0, 5, 0, 10],
      },

      {
        columns: [
          {
            width: 'auto',
            stack: [
              { text: 'Pre-analyse validee par :', style: 'labelText' },
              { text: 'Date :', style: 'labelText' },
              { text: 'Signature :', style: 'labelText' },
            ],
          },
          {
            width: '*',
            stack: [
              { text: profile.name, style: 'valueText' },
              { text: '_____ / _____ / __________', style: 'valueText' },
              { text: '', margin: [0, 25, 0, 0] },
              { text: '___________________________________', style: 'valueText' },
            ],
            margin: [10, 0, 0, 0],
          },
        ],
      } as Content,
    ],

    styles: {
      headerBrand: { fontSize: 14, bold: true, color: '#1e3a5f' },
      headerTitle: { fontSize: 10, color: '#64748b' },
      mainTitle: { fontSize: 16, bold: true, color: '#1e3a5f', alignment: 'center' },
      subtitle: { fontSize: 10, color: '#64748b', alignment: 'center', italics: true, margin: [0, 3, 0, 0] },
      sectionTitle: { fontSize: 12, bold: true, color: '#1e3a5f', margin: [0, 5, 0, 5] },
      labelText: { fontSize: 9, color: '#64748b', margin: [0, 2, 0, 2] },
      valueText: { fontSize: 9, bold: true, color: '#1e293b', margin: [0, 2, 0, 2] },
      bodyText: { fontSize: 10, color: '#1e293b', lineHeight: 1.4 },
      limitText: { fontSize: 9, color: '#92400e', lineHeight: 1.4 },
      smallTableHeader: { fontSize: 8, bold: true, color: '#ffffff' },
      smallTableCell: { fontSize: 8, color: '#1e293b' },
      disclaimer: { fontSize: 7, color: '#94a3b8', italics: true },
      footerPage: { fontSize: 8, color: '#94a3b8' },
    },

    defaultStyle: {
      font: 'Roboto',
    },
  }

  return generatePdfBuffer(docDefinition)
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function generatePdfBuffer(docDefinition: TDocumentDefinitions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const printer = new PdfPrinter(fonts)
      const pdfDoc = printer.createPdfKitDocument(docDefinition)

      const chunks: Uint8Array[] = []
      pdfDoc.on('data', (chunk: Uint8Array) => chunks.push(chunk))
      pdfDoc.on('end', () => resolve(Buffer.concat(chunks)))
      pdfDoc.on('error', reject)
      pdfDoc.end()
    } catch (err) {
      reject(err)
    }
  })
}

function formatDateFr(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${day}/${month}/${year} a ${hours}:${minutes}`
}
