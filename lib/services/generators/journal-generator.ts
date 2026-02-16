// =============================================================================
// SOF'IA -- Journal de tracabilite (PDF)
// Generates a PDF audit trail with all Sof'IA and CAC actions chronologically.
// Immutable record for NEP 230 compliance.
// Uses pdfmake for server-side PDF generation.
// Dependency: pdfmake (npm install pdfmake @types/pdfmake)
// =============================================================================

// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const PdfPrinter = require('pdfmake/src/printer') as any
import path from 'path'
import type { TDocumentDefinitions, Content, TableCell } from 'pdfmake/interfaces'
import type { Trace, Profile, Mission } from '@/types/database'

// -----------------------------------------------------------------------------
// Fonts configuration (Roboto TTFs extracted from pdfmake vfs_fonts.js)
// -----------------------------------------------------------------------------

const fontDir = path.join(process.cwd(), 'fonts')
const fonts = {
  Roboto: {
    normal: path.join(fontDir, 'Roboto-Regular.ttf'),
    bold: path.join(fontDir, 'Roboto-Medium.ttf'),
    italics: path.join(fontDir, 'Roboto-Italic.ttf'),
    bolditalics: path.join(fontDir, 'Roboto-MediumItalic.ttf'),
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

const ACTION_LABELS: Record<string, string> = {
  mission_created: 'Mission creee',
  mission_updated: 'Mission mise a jour',
  mission_deleted: 'Mission supprimee',
  document_added: 'Document(s) ajoute(s)',
  document_deleted: 'Document supprime',
  analysis_started: 'Pre-analyse demarree',
  analysis_completed: 'Pre-analyse terminee',
  analysis_failed: 'Pre-analyse echouee',
  fec_parsed: 'FEC analyse',
  pdf_extracted: 'PDF traite',
  rapprochement_completed: 'Rapprochements realises',
  signals_generated: 'Signaux documentaires generes',
  deliverables_generated: 'Livrables generes',
  signal_validated: 'Signal valide',
  signal_rejected: 'Signal rejete',
  signal_to_investigate: 'Signal a approfondir',
  deliverables_regenerated: 'Livrables regeneres',
  deliverables_exported: 'Livrables exportes',
}

const TARGET_TYPE_LABELS: Record<string, string> = {
  mission: 'Mission',
  document: 'Document',
  signal: 'Signal',
  deliverable: 'Livrable',
}

// -----------------------------------------------------------------------------
// Generator
// -----------------------------------------------------------------------------

export interface JournalGeneratorInput {
  mission: Mission
  profile: Profile
  traces: Trace[]
}

/**
 * Generates a PDF audit trail journal.
 * Returns a Buffer containing the PDF data.
 */
export async function generateJournalPdf(
  input: JournalGeneratorInput
): Promise<Buffer> {
  const { mission, profile, traces } = input
  const generatedAt = new Date()
  const formattedDate = formatDateFr(generatedAt)

  // Sort traces chronologically (oldest first)
  const sortedTraces = [...traces].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  )

  // Statistics
  const sofiaActions = sortedTraces.filter((t) => t.actor === 'sofia').length
  const userActions = sortedTraces.filter((t) => t.actor === 'user').length

  // Build trace table
  const tableBody: TableCell[][] = [
    [
      { text: 'Date / Heure', style: 'tableHeader' },
      { text: 'Acteur', style: 'tableHeader' },
      { text: 'Action', style: 'tableHeader' },
      { text: 'Details', style: 'tableHeader' },
      { text: 'Cible', style: 'tableHeader' },
    ],
  ]

  for (const trace of sortedTraces) {
    const traceDate = new Date(trace.timestamp)
    const isUserAction = trace.actor === 'user'

    // Build target (Cible) display string from target_type and target_id
    const targetLabel = trace.target_type
      ? TARGET_TYPE_LABELS[trace.target_type] || trace.target_type
      : '-'
    const targetDisplay = trace.target_type && trace.target_id
      ? `${targetLabel} (${trace.target_id.substring(0, 8)}...)`
      : targetLabel

    tableBody.push([
      {
        text: formatDateTimeFr(traceDate),
        style: 'tableCell',
        fontSize: 8,
      },
      {
        text: trace.actor_name,
        style: 'tableCell',
        bold: isUserAction,
        color: isUserAction ? '#1e3a5f' : '#6b7280',
      },
      {
        text: ACTION_LABELS[trace.action] || trace.action,
        style: 'tableCell',
      },
      {
        text: trace.details || '-',
        style: 'tableCell',
        fontSize: 8,
      },
      {
        text: targetDisplay,
        style: 'tableCell',
        fontSize: 8,
      },
    ])
  }

  const docDefinition: TDocumentDefinitions = {
    pageSize: 'A4',
    pageMargins: [40, 60, 40, 80],
    pageOrientation: 'landscape',

    header: {
      columns: [
        {
          text: 'Sof\'IA',
          style: 'headerBrand',
          margin: [40, 20, 0, 0],
        },
        {
          text: 'Journal de tracabilite',
          style: 'headerTitle',
          alignment: 'right',
          margin: [0, 20, 40, 0],
        },
      ],
    },

    footer: (currentPage: number, pageCount: number): Content => ({
      stack: [
        {
          text: 'Ce journal est genere automatiquement et ne peut etre modifie. Il constitue la trace des diligences realisees dans le cadre de cette pre-analyse.',
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
                  { text: 'JOURNAL DE TRACABILITE', style: 'mainTitle' },
                  { text: '', margin: [0, 5, 0, 0] },
                  {
                    columns: [
                      {
                        width: '50%',
                        stack: [
                          {
                            columns: [
                              { text: 'Mission :', style: 'labelText', width: 'auto' },
                              { text: mission.name, style: 'valueText', margin: [5, 0, 0, 0] },
                            ],
                          },
                          {
                            columns: [
                              { text: 'Scenario :', style: 'labelText', width: 'auto' },
                              { text: SCENARIO_LABELS[mission.scenario] || mission.scenario, style: 'valueText', margin: [5, 0, 0, 0] },
                            ],
                          },
                        ],
                      },
                      {
                        width: '50%',
                        stack: [
                          {
                            columns: [
                              { text: 'CAC :', style: 'labelText', width: 'auto' },
                              { text: `${profile.name}${profile.inscription_cncc ? ` (${profile.inscription_cncc})` : ''}`, style: 'valueText', margin: [5, 0, 0, 0] },
                            ],
                          },
                          {
                            columns: [
                              { text: 'Cabinet :', style: 'labelText', width: 'auto' },
                              { text: profile.cabinet, style: 'valueText', margin: [5, 0, 0, 0] },
                            ],
                          },
                          {
                            columns: [
                              { text: 'Date :', style: 'labelText', width: 'auto' },
                              { text: formattedDate, style: 'valueText', margin: [5, 0, 0, 0] },
                            ],
                          },
                        ],
                      },
                    ],
                  },
                ],
                margin: [10, 10, 10, 10],
              },
            ],
          ],
        },
        layout: {
          hLineWidth: () => 1,
          vLineWidth: () => 1,
          hLineColor: () => '#1e3a5f',
          vLineColor: () => '#1e3a5f',
        },
      } as Content,

      { text: '', margin: [0, 15, 0, 0] },

      // Trace table
      {
        table: {
          headerRows: 1,
          widths: [90, 110, 110, '*', 80],
          body: tableBody,
        },
        layout: {
          hLineWidth: (i: number, node: { table: { body: unknown[][] } }) =>
            i === 0 || i === 1 || i === node.table.body.length ? 1 : 0.5,
          vLineWidth: () => 0.5,
          hLineColor: (i: number) => (i <= 1 ? '#1e3a5f' : '#e2e8f0'),
          vLineColor: () => '#e2e8f0',
          fillColor: (rowIndex: number) => {
            if (rowIndex === 0) return '#1e3a5f'
            // Alternate row colors, with slight highlight for user actions
            const trace = sortedTraces[rowIndex - 1]
            if (trace && trace.actor === 'user') return '#eff6ff'
            return rowIndex % 2 === 0 ? '#f8f9fa' : null
          },
          paddingLeft: () => 6,
          paddingRight: () => 6,
          paddingTop: () => 4,
          paddingBottom: () => 4,
        },
      } as Content,

      { text: '', margin: [0, 15, 0, 0] },

      // Summary
      {
        columns: [
          {
            width: '*',
            text: [
              { text: `Total : ${sortedTraces.length} action(s) tracee(s)`, style: 'summaryText', bold: true },
              { text: ` \u2014 dont ${sofiaActions} action(s) Sof'IA et ${userActions} action(s) du commissaire aux comptes`, style: 'summaryText' },
            ],
          },
        ],
      } as Content,

      { text: '', margin: [0, 15, 0, 0] },

      // Disclaimer box
      {
        table: {
          widths: ['*'],
          body: [
            [
              {
                stack: [
                  {
                    text: 'Ce journal est genere automatiquement et ne peut etre modifie.',
                    style: 'disclaimerBox',
                  },
                  {
                    text: 'Il constitue la trace des diligences realisees dans le cadre de cette pre-analyse documentaire.',
                    style: 'disclaimerBox',
                  },
                  {
                    text: 'Analyse automatique \u2014 a valider par le commissaire aux comptes. Sof\'IA ne se substitue pas au jugement professionnel.',
                    style: 'disclaimerBox',
                    bold: true,
                    margin: [0, 5, 0, 0],
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
          hLineColor: () => '#94a3b8',
          vLineColor: () => '#94a3b8',
          fillColor: () => '#f1f5f9',
        },
      } as Content,
    ],

    styles: {
      headerBrand: { fontSize: 14, bold: true, color: '#1e3a5f' },
      headerTitle: { fontSize: 10, color: '#64748b' },
      mainTitle: { fontSize: 16, bold: true, color: '#1e3a5f', alignment: 'center' },
      labelText: { fontSize: 9, color: '#64748b', margin: [0, 2, 0, 2] },
      valueText: { fontSize: 9, bold: true, color: '#1e293b', margin: [0, 2, 0, 2] },
      tableHeader: { fontSize: 9, bold: true, color: '#ffffff' },
      tableCell: { fontSize: 9, color: '#1e293b' },
      summaryText: { fontSize: 10, color: '#1e293b' },
      disclaimer: { fontSize: 7, color: '#94a3b8', italics: true },
      footerPage: { fontSize: 8, color: '#94a3b8' },
      disclaimerBox: { fontSize: 9, color: '#475569', alignment: 'center', italics: true },
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

function formatDateTimeFr(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`
}
