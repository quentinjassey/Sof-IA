// =============================================================================
// SOF'IA — Helpers PDF partagés pour la génération de documents de démonstration
// Utilisé par generate-sondage.ts, generate-cutoff.ts, generate-pointage.ts
// =============================================================================

// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const PdfPrinter = require('pdfmake/src/printer') as any
import path from 'path'
import type { TDocumentDefinitions, Content, TableCell } from 'pdfmake/interfaces'

// -----------------------------------------------------------------------------
// Fonts
// -----------------------------------------------------------------------------
const fontDir = path.join(process.cwd(), 'fonts')
export const fonts = {
  Roboto: {
    normal: path.join(fontDir, 'Roboto-Regular.ttf'),
    bold: path.join(fontDir, 'Roboto-Medium.ttf'),
    italics: path.join(fontDir, 'Roboto-Italic.ttf'),
    bolditalics: path.join(fontDir, 'Roboto-MediumItalic.ttf'),
  },
}

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------
export interface CompanyInfo {
  name: string
  legal_form: string
  address: string
  address_line2?: string
  siret: string
  tva_intra: string
  rcs: string
  capital_social: number
  naf_code: string
  iban: string
  bic: string
  bank_name: string
  phone?: string
  email?: string
}

export interface InvoiceLine {
  ref: string            // Article reference (e.g., "PF-0842")
  description: string
  detail?: string        // Second line description
  quantity: number
  unit?: string          // "pièces", "kg", "lots"
  unit_price_ht: number
  total_ht: number
}

export interface InvoiceData {
  ref: string
  type: 'vente' | 'achat' | 'avoir'
  date: string           // YYYY-MM-DD
  client_or_supplier: string
  client_code: string
  address: string
  address_line2?: string
  siret: string
  tva_intra?: string
  order_ref?: string     // N° commande
  lines: InvoiceLine[]
  total_ht: number
  tva_rate: number
  tva_amount: number
  total_ttc: number
  payment_terms: string
  payment_mode: string   // "Virement bancaire", "Chèque", etc.
  due_date: string
  linked_bl_ref?: string
  linked_invoice?: string
  note?: string
}

export interface DeliveryNoteData {
  ref: string
  type: 'livraison' | 'reception'
  date_expedition?: string
  date_delivery: string
  order_ref?: string
  linked_invoice: string
  recipient_or_supplier: string
  address: string
  address_line2?: string
  contact: string
  phone?: string
  transporter?: string
  tracking_number?: string
  incoterm?: string
  weight?: string
  packaging?: string
  items: Array<{
    ref: string
    description: string
    quantity: string
    unit: string
  }>
  received_by: string
  observations: string
}

// -----------------------------------------------------------------------------
// Number / Date Formatting
// -----------------------------------------------------------------------------

/** Formate un nombre avec espaces insécables (milliers) et virgule décimale. */
export function fmt(n: number): string {
  const parts = Math.abs(n).toFixed(2).split('.')
  const intPart = parts[0].split('')
  const result: string[] = []
  for (let i = intPart.length - 1, count = 0; i >= 0; i--, count++) {
    if (count > 0 && count % 3 === 0) result.unshift('\u00A0')
    result.unshift(intPart[i])
  }
  return (n < 0 ? '-' : '') + result.join('') + ',' + parts[1]
}

/** Formate un nombre sans décimales pour les montants entiers. */
export function fmtInt(n: number): string {
  const intPart = Math.abs(Math.round(n)).toString().split('')
  const result: string[] = []
  for (let i = intPart.length - 1, count = 0; i >= 0; i--, count++) {
    if (count > 0 && count % 3 === 0) result.unshift('\u00A0')
    result.unshift(intPart[i])
  }
  return (n < 0 ? '-' : '') + result.join('')
}

/** Formate un montant pour FEC (virgule décimale, pas de séparateur de milliers). */
export function fmtFec(n: number): string {
  return n.toFixed(2).replace('.', ',')
}

/** Convertit YYYY-MM-DD en DD/MM/YYYY. */
export function fmtDate(date: string): string {
  const [y, m, d] = date.split('-')
  return `${d}/${m}/${y}`
}

/** Convertit YYYY-MM-DD en YYYYMMDD (format FEC DGFiP). */
export function toFecDate(date: string): string {
  return date.replace(/-/g, '')
}

// -----------------------------------------------------------------------------
// PDF Buffer Generation
// -----------------------------------------------------------------------------

export function generatePdfBuffer(docDefinition: TDocumentDefinitions): Promise<Buffer> {
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

// -----------------------------------------------------------------------------
// Shared Styles
// -----------------------------------------------------------------------------

export const baseStyles = {
  companyName: { fontSize: 13, bold: true, color: '#1a1a2e' },
  companyInfo: { fontSize: 7.5, color: '#555555', margin: [0, 1, 0, 1] as [number, number, number, number] },
  mainTitle: { fontSize: 16, bold: true, color: '#1a1a2e', alignment: 'center' as const },
  subtitle: { fontSize: 9, color: '#666666', alignment: 'center' as const },
  sectionTitle: { fontSize: 10, bold: true, color: '#1a1a2e', margin: [0, 12, 0, 5] as [number, number, number, number] },
  tableHeader: { fontSize: 7.5, bold: true, color: '#ffffff' },
  tableCell: { fontSize: 7.5, color: '#333333' },
  tableCellBold: { fontSize: 7.5, bold: true, color: '#333333' },
  tableCellRight: { fontSize: 7.5, color: '#333333', alignment: 'right' as const },
  totalRow: { fontSize: 8.5, bold: true, color: '#1a1a2e' },
  label: { fontSize: 8, bold: true, color: '#1a1a2e' },
  value: { fontSize: 8, color: '#333333' },
  smallLabel: { fontSize: 7, bold: true, color: '#555555' },
  smallValue: { fontSize: 7, color: '#555555' },
  legalText: { fontSize: 6.5, color: '#888888' },
  legalTextBold: { fontSize: 6.5, bold: true, color: '#888888' },
  disclaimer: { fontSize: 6.5, color: '#aaaaaa', italics: true },
}

export const invoiceTableLayout = {
  hLineWidth: (i: number, node: { table: { body: unknown[][] } }) =>
    i === 0 || i === 1 || i === node.table.body.length ? 0.8 : 0.3,
  vLineWidth: () => 0.3,
  hLineColor: (i: number) => (i <= 1 ? '#1a1a2e' : '#dddddd'),
  vLineColor: () => '#dddddd',
  fillColor: (i: number) => (i === 0 ? '#2c3e6b' : i % 2 === 0 ? '#f7f8fa' : null),
  paddingLeft: () => 6,
  paddingRight: () => 6,
  paddingTop: () => 3,
  paddingBottom: () => 3,
}

export const infoTableLayout = {
  hLineWidth: () => 0.3,
  vLineWidth: () => 0,
  hLineColor: () => '#e8e8e8',
  paddingLeft: () => 6,
  paddingRight: () => 6,
  paddingTop: () => 3,
  paddingBottom: () => 3,
}

export const boxLayout = {
  hLineWidth: () => 0.6,
  vLineWidth: () => 0.6,
  hLineColor: () => '#d0d0d0',
  vLineColor: () => '#d0d0d0',
}

// -----------------------------------------------------------------------------
// Reusable PDF Building Blocks
// -----------------------------------------------------------------------------

/** Builds company header block (emitter, left side). */
export function buildCompanyHeader(company: CompanyInfo): Content {
  return {
    stack: [
      { text: company.name, style: 'companyName' },
      { text: `${company.legal_form} au capital de ${fmtInt(company.capital_social)} EUR`, style: 'companyInfo' },
      { text: company.address, style: 'companyInfo' },
      ...(company.address_line2 ? [{ text: company.address_line2, style: 'companyInfo' }] : []),
      { text: `SIRET : ${company.siret}  —  NAF : ${company.naf_code}`, style: 'companyInfo' },
      { text: `TVA intra. : ${company.tva_intra}`, style: 'companyInfo' },
      { text: `RCS ${company.rcs}`, style: 'companyInfo' },
      ...(company.phone ? [{ text: `Tél. : ${company.phone}`, style: 'companyInfo' }] : []),
    ],
  }
}

/** Builds client/supplier box. */
export function buildClientBox(invoice: InvoiceData, isAchat: boolean): Content {
  const lines: Content[] = [
    { text: isAchat ? 'FOURNISSEUR' : 'CLIENT', style: 'label', margin: [8, 6, 8, 3] as [number, number, number, number] },
    { text: invoice.client_or_supplier, style: 'tableCellBold', fontSize: 9, margin: [8, 0, 8, 2] as [number, number, number, number] },
    { text: invoice.address, style: 'tableCell', margin: [8, 0, 8, 1] as [number, number, number, number] },
  ]
  if (invoice.address_line2) {
    lines.push({ text: invoice.address_line2, style: 'tableCell', margin: [8, 0, 8, 1] as [number, number, number, number] })
  }
  lines.push(
    { text: `SIRET : ${invoice.siret}`, style: 'tableCell', margin: [8, 0, 8, 1] as [number, number, number, number] },
  )
  if (invoice.tva_intra) {
    lines.push({ text: `TVA intra. : ${invoice.tva_intra}`, style: 'tableCell', margin: [8, 0, 8, 1] as [number, number, number, number] })
  }
  lines.push(
    { text: `N° client : ${invoice.client_code}`, style: 'tableCell', margin: [8, 0, 8, 6] as [number, number, number, number] },
  )

  return {
    table: { widths: ['*'], body: [[{ stack: lines }]] },
    layout: boxLayout,
  } as Content
}

/** Builds the banking info block. */
export function buildBankingBlock(company: CompanyInfo): Content {
  return {
    table: {
      widths: ['*'],
      body: [[{
        stack: [
          { text: 'COORDONNÉES BANCAIRES', style: 'smallLabel', margin: [8, 5, 8, 3] as [number, number, number, number] },
          { text: `Banque : ${company.bank_name}`, style: 'smallValue', margin: [8, 0, 8, 1] as [number, number, number, number] },
          { text: `IBAN : ${company.iban}`, style: 'smallValue', margin: [8, 0, 8, 1] as [number, number, number, number] },
          { text: `BIC : ${company.bic}`, style: 'smallValue', margin: [8, 0, 8, 5] as [number, number, number, number] },
        ],
      }]],
    },
    layout: { hLineWidth: () => 0.4, vLineWidth: () => 0.4, hLineColor: () => '#e0e0e0', vLineColor: () => '#e0e0e0' },
  } as Content
}

/** Builds the legal conditions block (penalties, escompte). */
export function buildLegalConditions(paymentTerms: string, paymentMode: string): Content {
  return {
    stack: [
      { text: 'CONDITIONS DE RÈGLEMENT', style: 'smallLabel', margin: [0, 8, 0, 3] as [number, number, number, number] },
      { text: `${paymentTerms}  —  ${paymentMode}`, style: 'smallValue' },
      { text: 'Pas d\'escompte pour paiement anticipé.', style: 'smallValue', margin: [0, 2, 0, 0] as [number, number, number, number] },
      { text: 'En cas de retard de paiement, une pénalité égale à 3 fois le taux d\'intérêt légal sera appliquée (art. L.441-10 C. com.).', style: 'legalText', margin: [0, 2, 0, 0] as [number, number, number, number] },
      { text: 'Indemnité forfaitaire pour frais de recouvrement : 40,00 EUR (art. D.441-5 C. com.).', style: 'legalText' },
    ],
  }
}

/** Builds the dense legal footer for invoices. */
export function buildLegalFooter(company: CompanyInfo): Content {
  return {
    stack: [
      {
        canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.4, lineColor: '#cccccc' }],
        margin: [0, 10, 0, 4] as [number, number, number, number],
      },
      {
        text: `${company.name} — ${company.legal_form} au capital de ${fmtInt(company.capital_social)} EUR — RCS ${company.rcs} — SIRET ${company.siret} — TVA ${company.tva_intra} — NAF ${company.naf_code}`,
        style: 'legalText',
        alignment: 'center' as const,
      },
    ],
  }
}

// -----------------------------------------------------------------------------
// Shared Company — Used across all 3 scenarios
// -----------------------------------------------------------------------------

export const RIVETIN: CompanyInfo = {
  name: 'Rivetin Mécanique Industrielle',
  legal_form: 'SAS',
  address: 'Zone Industrielle des Bruyères',
  address_line2: '14 allée des Forges — 69200 Vénissieux',
  siret: '489 312 756 00024',
  tva_intra: 'FR 81 489312756',
  rcs: 'Lyon B 489 312 756',
  capital_social: 320000,
  naf_code: '2562B',
  iban: 'FR76 3006 6108 0000 0405 1267 843',
  bic: 'CMCIFRPP',
  bank_name: 'Crédit Industriel et Commercial — Agence Lyon Part-Dieu',
  phone: '04 72 89 34 12',
  email: 'contact@rivetin-mecanique.fr',
}

// Re-export types for convenience
export type { TDocumentDefinitions, Content, TableCell }
