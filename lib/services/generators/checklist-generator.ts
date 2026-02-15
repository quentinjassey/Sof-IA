// =============================================================================
// SOF'IA -- Checklist de completude documentaire (PDF)
// Generates a PDF document listing expected vs received documents.
// Uses pdfmake for server-side PDF generation.
// Dependency: pdfmake (npm install pdfmake @types/pdfmake)
// =============================================================================

// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const PdfPrinter = require('pdfmake') as any
import type { TDocumentDefinitions, Content, TableCell } from 'pdfmake/interfaces'
import type { Completeness, Profile, Mission } from '@/types/database'

// -----------------------------------------------------------------------------
// Fonts configuration (Roboto bundled with pdfmake)
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
// Scenario labels (French professional vocabulary)
// -----------------------------------------------------------------------------

const SCENARIO_LABELS: Record<string, string> = {
  sondage_ca: 'Sondage sur le chiffre d\'affaires',
  cutoff: 'Cesure d\'exercice (cut-off)',
  pointage: 'Pointage des etats financiers',
}

// -----------------------------------------------------------------------------
// Status display mapping
// -----------------------------------------------------------------------------

const STATUS_LABELS: Record<string, string> = {
  present: 'Present',
  missing: 'Manquant',
  incomplete: 'Incomplet',
}

const STATUS_COLORS: Record<string, string> = {
  present: '#22c55e',
  missing: '#ef4444',
  incomplete: '#f59e0b',
}

// -----------------------------------------------------------------------------
// Generator
// -----------------------------------------------------------------------------

export interface ChecklistGeneratorInput {
  mission: Mission
  profile: Profile
  completeness: Completeness[]
}

/**
 * Generates a PDF checklist of document completeness.
 * Returns a Buffer containing the PDF data.
 */
export async function generateChecklistPdf(
  input: ChecklistGeneratorInput
): Promise<Buffer> {
  const { mission, profile, completeness } = input
  const generatedAt = new Date()
  const formattedDate = formatDateFr(generatedAt)

  // Calculate completeness rate for required documents
  const requiredDocs = completeness.filter((c) => c.required)
  const presentRequired = requiredDocs.filter((c) => c.status === 'present').length
  const completenessRate =
    requiredDocs.length > 0
      ? Math.round((presentRequired / requiredDocs.length) * 100)
      : 0

  // Build table body
  const tableBody: TableCell[][] = [
    // Header row
    [
      { text: 'Document attendu', style: 'tableHeader' },
      { text: 'Requis', style: 'tableHeader' },
      { text: 'Statut', style: 'tableHeader' },
      { text: 'Detail', style: 'tableHeader' },
    ],
  ]

  for (const entry of completeness) {
    tableBody.push([
      { text: entry.label, style: 'tableCell' },
      { text: entry.required ? 'Oui' : 'Non', style: 'tableCell', alignment: 'center' },
      {
        text: STATUS_LABELS[entry.status] || entry.status,
        style: 'tableCell',
        color: STATUS_COLORS[entry.status] || '#000000',
        bold: entry.status !== 'present',
        alignment: 'center',
      },
      {
        text: entry.note || (entry.count > 0 ? `${entry.count} document(s)` : '-'),
        style: 'tableCell',
      },
    ])
  }

  // Assemble PDF document definition
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
          text: 'Check-list de completude documentaire',
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
                  { text: 'CHECK-LIST DE COMPLETUDE DOCUMENTAIRE', style: 'mainTitle' },
                  { text: '', margin: [0, 5, 0, 0] },
                  {
                    columns: [
                      {
                        width: 'auto',
                        stack: [
                          { text: 'Mission :', style: 'labelText' },
                          { text: 'Scenario :', style: 'labelText' },
                          { text: 'Date de generation :', style: 'labelText' },
                        ],
                      },
                      {
                        width: '*',
                        stack: [
                          { text: mission.name, style: 'valueText' },
                          { text: SCENARIO_LABELS[mission.scenario] || mission.scenario, style: 'valueText' },
                          { text: formattedDate, style: 'valueText' },
                        ],
                        margin: [10, 0, 0, 0],
                      },
                    ],
                  },
                  { text: '', margin: [0, 5, 0, 0] },
                  {
                    columns: [
                      {
                        width: 'auto',
                        stack: [
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
                          { text: profile.name, style: 'valueText' },
                          { text: profile.cabinet, style: 'valueText' },
                          ...(profile.inscription_cncc
                            ? [{ text: profile.inscription_cncc, style: 'valueText' } as Content]
                            : []),
                        ],
                        margin: [10, 0, 0, 0],
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

      // Spacer
      { text: '', margin: [0, 20, 0, 0] },

      // Document completeness table
      {
        table: {
          headerRows: 1,
          widths: ['*', 50, 70, '*'],
          body: tableBody,
        },
        layout: {
          hLineWidth: (i: number, node: { table: { body: unknown[][] } }) =>
            i === 0 || i === 1 || i === node.table.body.length ? 1 : 0.5,
          vLineWidth: () => 0.5,
          hLineColor: (i: number) => (i <= 1 ? '#1e3a5f' : '#cccccc'),
          vLineColor: () => '#cccccc',
          fillColor: (i: number) => (i === 0 ? '#1e3a5f' : i % 2 === 0 ? '#f8f9fa' : null),
          paddingLeft: () => 8,
          paddingRight: () => 8,
          paddingTop: () => 6,
          paddingBottom: () => 6,
        },
      } as Content,

      // Spacer
      { text: '', margin: [0, 15, 0, 0] },

      // Completeness summary
      {
        columns: [
          {
            width: '*',
            text: [
              { text: 'Taux de completude (documents requis) : ', style: 'summaryLabel' },
              {
                text: `${completenessRate}%`,
                style: 'summaryValue',
                color: completenessRate >= 75 ? '#22c55e' : completenessRate >= 50 ? '#f59e0b' : '#ef4444',
              },
              {
                text: ` (${presentRequired}/${requiredDocs.length} documents requis presents)`,
                style: 'summaryDetail',
              },
            ],
          },
        ],
      } as Content,

      // Spacer
      { text: '', margin: [0, 20, 0, 0] },

      // Bottom disclaimer box
      {
        table: {
          widths: ['*'],
          body: [
            [
              {
                stack: [
                  {
                    text: 'Ce document est un outil de pre-analyse documentaire genere par Sof\'IA.',
                    style: 'disclaimerBox',
                  },
                  {
                    text: 'Il ne constitue pas une conclusion d\'audit. Validation humaine requise.',
                    style: 'disclaimerBox',
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
      tableHeader: { fontSize: 9, bold: true, color: '#ffffff', alignment: 'left' },
      tableCell: { fontSize: 9, color: '#1e293b' },
      summaryLabel: { fontSize: 10, color: '#1e293b' },
      summaryValue: { fontSize: 12, bold: true },
      summaryDetail: { fontSize: 9, color: '#64748b' },
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

/**
 * Converts a pdfmake document definition into a Buffer.
 */
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

/**
 * Formats a Date to French format: dd/mm/yyyy a hh:mm
 */
function formatDateFr(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${day}/${month}/${year} a ${hours}:${minutes}`
}
