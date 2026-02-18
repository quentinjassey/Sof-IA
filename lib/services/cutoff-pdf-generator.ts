// =============================================================================
// SOF'IA -- Generateur PDF pour les documents du scenario Cut-Off
// Genere : FEC (texte), Factures (PDF), Bons de livraison/reception (PDF)
// Utilise pdfmake (meme pattern que pointage-pdf-generator.ts)
// =============================================================================

// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const PdfPrinter = require('pdfmake/src/printer') as any
import path from 'path'
import type { TDocumentDefinitions, Content, TableCell } from 'pdfmake/interfaces'
import type {
  CutoffCompany,
  CutoffInvoice,
  DeliveryNote,
} from '@/lib/config/cutoff-companies'

// -----------------------------------------------------------------------------
// Fonts (Roboto TTFs extracted from pdfmake vfs_fonts.js)
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
// Helpers
// -----------------------------------------------------------------------------

/** Formate un nombre avec espaces insecables comme separateur de milliers. */
function fmt(n: number): string {
  const parts = Math.abs(n).toFixed(2).split('.')
  const intPart = parts[0].split('')
  const result: string[] = []
  for (let i = intPart.length - 1, count = 0; i >= 0; i--, count++) {
    if (count > 0 && count % 3 === 0) result.unshift('\u00A0')
    result.unshift(intPart[i])
  }
  return (n < 0 ? '-' : '') + result.join('') + ',' + parts[1]
}

/** Formate un montant sans decimales (pour FEC). */
function fmtFec(n: number): string {
  return n.toFixed(2).replace('.', ',')
}

/** Convertit YYYY-MM-DD en DD/MM/YYYY. */
function fmtDate(date: string): string {
  const [y, m, d] = date.split('-')
  return `${d}/${m}/${y}`
}

/** Convertit YYYY-MM-DD en YYYYMMDD (format FEC DGFiP). */
function toFecDate(date: string): string {
  return date.replace(/-/g, '')
}

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

const baseStyles = {
  companyName: { fontSize: 12, bold: true, color: '#1e3a5f' },
  companyInfo: { fontSize: 8, color: '#475569', margin: [0, 1, 0, 1] as [number, number, number, number] },
  mainTitle: { fontSize: 14, bold: true, color: '#1e3a5f', alignment: 'center' as const },
  subtitle: { fontSize: 10, color: '#64748b', alignment: 'center' as const },
  sectionTitle: { fontSize: 10, bold: true, color: '#1e3a5f', margin: [0, 10, 0, 5] as [number, number, number, number] },
  tableHeader: { fontSize: 8, bold: true, color: '#ffffff' },
  tableCell: { fontSize: 8, color: '#1e293b' },
  tableCellBold: { fontSize: 8, bold: true, color: '#1e293b' },
  totalRow: { fontSize: 9, bold: true, color: '#1e3a5f' },
  label: { fontSize: 9, bold: true, color: '#1e3a5f' },
  value: { fontSize: 9, color: '#1e293b' },
  disclaimer: { fontSize: 7, color: '#94a3b8', italics: true },
  footerPage: { fontSize: 8, color: '#94a3b8' },
}

const tableLayout = {
  hLineWidth: (i: number, node: { table: { body: unknown[][] } }) =>
    i === 0 || i === 1 || i === node.table.body.length ? 1 : 0.5,
  vLineWidth: () => 0.5,
  hLineColor: (i: number) => (i <= 1 ? '#1e3a5f' : '#cccccc'),
  vLineColor: () => '#cccccc',
  fillColor: (i: number) => (i === 0 ? '#1e3a5f' : i % 2 === 0 ? '#f8f9fa' : null),
  paddingLeft: () => 6,
  paddingRight: () => 6,
  paddingTop: () => 4,
  paddingBottom: () => 4,
}

// -----------------------------------------------------------------------------
// FEC Text (tab-delimited, DGFiP format)
// -----------------------------------------------------------------------------

export function generateFecText(company: CutoffCompany): Buffer {
  const header = [
    'JournalCode', 'JournalLib', 'EcritureNum', 'EcritureDate', 'CompteNum',
    'CompteLib', 'CompAuxNum', 'CompAuxLib', 'PieceRef', 'PieceDate',
    'EcritureLib', 'Debit', 'Credit', 'EcritureLet', 'DateLet',
    'ValidDate', 'Montantdevise', 'Idevise',
  ].join('\t')

  const rows = company.fec_entries.map((e) =>
    [
      e.journal_code,
      e.journal_lib,
      e.ecriture_num,
      toFecDate(e.ecriture_date),
      e.compte_num,
      e.compte_lib,
      e.comp_aux_num ?? '',
      e.comp_aux_lib ?? '',
      e.piece_ref,
      toFecDate(e.piece_date),
      e.ecriture_lib,
      fmtFec(e.debit),
      fmtFec(e.credit),
      '', // EcrtureLet
      '', // DateLet
      e.valid_date ? toFecDate(e.valid_date) : '',
      '', // Montantdevise
      '', // Idevise
    ].join('\t')
  )

  return Buffer.from([header, ...rows].join('\r\n'), 'utf-8')
}

// -----------------------------------------------------------------------------
// Invoice PDF
// -----------------------------------------------------------------------------

export async function generateInvoicePdf(company: CutoffCompany, invoice: CutoffInvoice): Promise<Buffer> {
  const isAvoir = invoice.type === 'avoir'
  const isAchat = invoice.type === 'achat'
  const titleText = isAvoir ? 'AVOIR' : isAchat ? 'FACTURE FOURNISSEUR' : 'FACTURE DE VENTE'
  const titleColor = isAvoir ? '#b91c1c' : '#1e3a5f'

  // Lines table
  const linesBody: TableCell[][] = [
    [
      { text: 'Designation', style: 'tableHeader' },
      { text: 'Qte', style: 'tableHeader', alignment: 'right' as const },
      { text: 'P.U. HT', style: 'tableHeader', alignment: 'right' as const },
      { text: 'Total HT', style: 'tableHeader', alignment: 'right' as const },
    ],
    ...invoice.lines.map((line) => [
      { text: line.description, style: 'tableCell' },
      { text: String(line.quantity), style: 'tableCell', alignment: 'right' as const },
      { text: fmt(line.unit_price_ht), style: 'tableCell', alignment: 'right' as const },
      { text: fmt(line.total_ht), style: 'tableCell', alignment: 'right' as const },
    ] as TableCell[]),
  ]

  const refInfo: Content[] = [
    { text: [{ text: 'Reference : ', style: 'label' }, { text: invoice.ref, style: 'value' }] } as Content,
    { text: [{ text: 'Date : ', style: 'label' }, { text: fmtDate(invoice.date), style: 'value' }] } as Content,
  ]
  if (invoice.linked_bl_ref) {
    refInfo.push(
      { text: [{ text: isAchat ? 'Bon de reception : ' : 'Bon de livraison : ', style: 'label' }, { text: invoice.linked_bl_ref, style: 'value' }] } as Content
    )
  }
  if (invoice.linked_invoice) {
    refInfo.push(
      { text: [{ text: 'Facture d\'origine : ', style: 'label' }, { text: invoice.linked_invoice, style: 'value' }] } as Content
    )
  }

  const docDef: TDocumentDefinitions = {
    pageSize: 'A4',
    pageMargins: [40, 40, 40, 60],
    footer: (): Content => ({
      text: 'Document genere par Sof\'IA — Donnees de demonstration',
      style: 'disclaimer',
      alignment: 'center',
      margin: [40, 10, 40, 0],
    }),
    content: [
      // Company header (emitter)
      {
        columns: [
          {
            width: '50%',
            stack: [
              { text: company.name, style: 'companyName' },
              { text: `${company.legal_form} au capital de ${fmt(company.capital_social).split(',')[0]} EUR`, style: 'companyInfo' },
              { text: company.address, style: 'companyInfo' },
              { text: `SIRET : ${company.siret}`, style: 'companyInfo' },
              { text: `TVA intra : ${company.tva_intra}`, style: 'companyInfo' },
              { text: `RCS ${company.rcs}`, style: 'companyInfo' },
            ],
          },
          {
            width: '50%',
            stack: [
              { text: titleText, fontSize: 16, bold: true, color: titleColor, alignment: 'right' as const },
              { text: '', margin: [0, 8, 0, 0] },
              ...refInfo.map((item) => Object.assign({}, item, { alignment: 'right' as const })),
            ],
          },
        ],
      } as Content,
      { text: '', margin: [0, 15, 0, 0] },
      // Client/supplier block
      {
        table: {
          widths: ['*'],
          body: [
            [
              {
                stack: [
                  { text: isAchat ? 'FOURNISSEUR' : 'CLIENT', style: 'label', margin: [8, 6, 8, 3] as [number, number, number, number] },
                  { text: invoice.client_or_supplier, style: 'tableCellBold', margin: [8, 0, 8, 2] as [number, number, number, number] },
                  { text: invoice.address, style: 'tableCell', margin: [8, 0, 8, 2] as [number, number, number, number] },
                  { text: `SIRET : ${invoice.siret}`, style: 'tableCell', margin: [8, 0, 8, 6] as [number, number, number, number] },
                ],
              },
            ],
          ],
        },
        layout: {
          hLineWidth: () => 1,
          vLineWidth: () => 1,
          hLineColor: () => '#e2e8f0',
          vLineColor: () => '#e2e8f0',
        },
      } as Content,
      { text: '', margin: [0, 15, 0, 0] },
      // Lines table
      {
        table: { headerRows: 1, widths: ['*', 40, 70, 70], body: linesBody },
        layout: tableLayout,
      } as Content,
      { text: '', margin: [0, 10, 0, 0] },
      // Totals block (aligned right)
      {
        columns: [
          { width: '*', text: '' },
          {
            width: 200,
            table: {
              widths: ['*', 80],
              body: [
                [{ text: 'Total HT', style: 'tableCellBold' }, { text: fmt(invoice.total_ht), style: 'tableCellBold', alignment: 'right' as const }],
                [{ text: `TVA ${invoice.tva_rate}%`, style: 'tableCell' }, { text: fmt(invoice.tva_amount), style: 'tableCell', alignment: 'right' as const }],
                [{ text: 'Total TTC', style: 'totalRow' }, { text: fmt(invoice.total_ttc), style: 'totalRow', alignment: 'right' as const }],
              ],
            },
            layout: {
              hLineWidth: (i: number, node: { table: { body: unknown[][] } }) =>
                i === node.table.body.length ? 1.5 : 0.5,
              vLineWidth: () => 0,
              hLineColor: (i: number, node: { table: { body: unknown[][] } }) =>
                i === node.table.body.length ? '#1e3a5f' : '#e2e8f0',
              paddingLeft: () => 4,
              paddingRight: () => 4,
              paddingTop: () => 4,
              paddingBottom: () => 4,
            },
          },
        ],
      } as Content,
      { text: '', margin: [0, 15, 0, 0] },
      // Payment terms
      {
        stack: [
          { text: [{ text: 'Conditions de paiement : ', style: 'label' }, { text: invoice.payment_terms, style: 'value' }] },
          { text: [{ text: 'Date d\'echeance : ', style: 'label' }, { text: fmtDate(invoice.due_date), style: 'value' }] },
          ...(invoice.note ? [{ text: [{ text: 'Observations : ', style: 'label' }, { text: invoice.note, style: 'value' }] } as Content] : []),
        ],
      } as Content,
    ],
    styles: baseStyles,
    defaultStyle: { font: 'Roboto' },
  }

  return generatePdfBuffer(docDef)
}

// -----------------------------------------------------------------------------
// Delivery / Reception Note PDF
// -----------------------------------------------------------------------------

export async function generateDeliveryNotePdf(company: CutoffCompany, note: DeliveryNote): Promise<Buffer> {
  const isReception = note.type === 'reception'
  const titleText = isReception ? 'BON DE RECEPTION' : 'BON DE LIVRAISON'

  const infoRows: TableCell[][] = [
    [{ text: 'Reference', style: 'label' }, { text: note.ref, style: 'value' }],
  ]
  if (note.date_expedition) {
    infoRows.push([{ text: 'Date d\'expedition', style: 'label' }, { text: fmtDate(note.date_expedition), style: 'value' }])
  }
  infoRows.push(
    [{ text: isReception ? 'Date de reception' : 'Date de livraison', style: 'label' }, { text: fmtDate(note.date_delivery), style: 'value' }],
    [{ text: 'Reference commande', style: 'label' }, { text: note.order_ref, style: 'value' }],
    [{ text: 'Facture associee', style: 'label' }, { text: note.linked_invoice, style: 'value' }],
  )

  const docDef: TDocumentDefinitions = {
    pageSize: 'A4',
    pageMargins: [40, 40, 40, 60],
    footer: (): Content => ({
      text: 'Document genere par Sof\'IA — Donnees de demonstration',
      style: 'disclaimer',
      alignment: 'center',
      margin: [40, 10, 40, 0],
    }),
    content: [
      // Company header
      {
        columns: [
          {
            width: '50%',
            stack: [
              { text: company.name, style: 'companyName' },
              { text: company.address, style: 'companyInfo' },
              { text: `SIRET : ${company.siret}`, style: 'companyInfo' },
            ],
          },
          {
            width: '50%',
            stack: [
              { text: titleText, fontSize: 14, bold: true, color: '#1e3a5f', alignment: 'right' as const },
              { text: note.ref, fontSize: 11, color: '#475569', alignment: 'right' as const, margin: [0, 4, 0, 0] as [number, number, number, number] },
            ],
          },
        ],
      } as Content,
      { text: '', margin: [0, 15, 0, 0] },
      // Info table
      {
        table: {
          widths: [120, '*'],
          body: infoRows,
        },
        layout: {
          hLineWidth: () => 0.5,
          vLineWidth: () => 0,
          hLineColor: () => '#e2e8f0',
          paddingLeft: () => 6,
          paddingRight: () => 6,
          paddingTop: () => 4,
          paddingBottom: () => 4,
        },
      } as Content,
      { text: '', margin: [0, 12, 0, 0] },
      // Recipient/supplier block
      {
        table: {
          widths: ['*'],
          body: [
            [
              {
                stack: [
                  { text: isReception ? 'FOURNISSEUR' : 'DESTINATAIRE', style: 'label', margin: [8, 6, 8, 3] as [number, number, number, number] },
                  { text: note.recipient_or_supplier, style: 'tableCellBold', margin: [8, 0, 8, 2] as [number, number, number, number] },
                  { text: `Contact : ${note.contact}`, style: 'tableCell', margin: [8, 0, 8, 6] as [number, number, number, number] },
                ],
              },
            ],
          ],
        },
        layout: {
          hLineWidth: () => 1,
          vLineWidth: () => 1,
          hLineColor: () => '#e2e8f0',
          vLineColor: () => '#e2e8f0',
        },
      } as Content,
      { text: '', margin: [0, 12, 0, 0] },
      // Items table
      { text: 'DESIGNATION DES MARCHANDISES', style: 'sectionTitle' },
      {
        table: {
          headerRows: 1,
          widths: ['*', 80],
          body: [
            [
              { text: 'Description', style: 'tableHeader' },
              { text: 'Quantite', style: 'tableHeader', alignment: 'right' as const },
            ],
            [
              { text: note.items_description, style: 'tableCell' },
              { text: note.quantity, style: 'tableCell', alignment: 'right' as const },
            ],
          ],
        },
        layout: tableLayout,
      } as Content,
      { text: '', margin: [0, 15, 0, 0] },
      // Reception block
      {
        table: {
          widths: ['*'],
          body: [
            [
              {
                stack: [
                  { text: isReception ? 'RÉCEPTION' : 'ACCUSÉ DE RÉCEPTION', style: 'label', margin: [8, 6, 8, 3] as [number, number, number, number] },
                  { text: `Recu par : ${note.received_by}`, style: 'value', margin: [8, 0, 8, 2] as [number, number, number, number] },
                  { text: `Date : ${fmtDate(note.date_delivery)}`, style: 'value', margin: [8, 0, 8, 2] as [number, number, number, number] },
                  { text: `Observations : ${note.observations}`, style: 'value', margin: [8, 0, 8, 6] as [number, number, number, number] },
                ],
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
    ],
    styles: baseStyles,
    defaultStyle: { font: 'Roboto' },
  }

  return generatePdfBuffer(docDef)
}

// -----------------------------------------------------------------------------
// Generate all cutoff documents
// -----------------------------------------------------------------------------

export async function generateAllCutoffPdfs(company: CutoffCompany): Promise<{
  fec: Buffer
  invoices: Array<{ ref: string; type: string; buffer: Buffer }>
  delivery_notes: Array<{ ref: string; type: string; buffer: Buffer }>
}> {
  const fec = generateFecText(company)

  const [invoices, deliveryNotes] = await Promise.all([
    Promise.all(
      company.invoices.map(async (inv) => ({
        ref: inv.ref,
        type: inv.type,
        buffer: await generateInvoicePdf(company, inv),
      }))
    ),
    Promise.all(
      company.delivery_notes.map(async (dn) => ({
        ref: dn.ref,
        type: dn.type,
        buffer: await generateDeliveryNotePdf(company, dn),
      }))
    ),
  ])

  return { fec, invoices, delivery_notes: deliveryNotes }
}
