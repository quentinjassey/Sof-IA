// =============================================================================
// SOF'IA — Génération des documents de démonstration : Sondage CA
// 8 factures de vente + 4 bons de livraison pour Rivetin Mécanique Industrielle
// Usage: appelé depuis generate-demo-docs.ts
// =============================================================================

import fs from 'fs'
import path from 'path'
import {
  type InvoiceData,
  type DeliveryNoteData,
  type InvoiceLine,
  type TDocumentDefinitions,
  type Content,
  type TableCell,
  RIVETIN,
  fmt,
  fmtDate,
  generatePdfBuffer,
  baseStyles,
  invoiceTableLayout,
  infoTableLayout,
  boxLayout,
  buildCompanyHeader,
  buildClientBox,
  buildBankingBlock,
  buildLegalConditions,
  buildLegalFooter,
} from './pdf-helpers'

// =============================================================================
// Invoice Data (8 invoices)
// =============================================================================

const invoices: InvoiceData[] = [
  // ── FA-4504 — Champagnac (EXPORT, no TVA) ──
  {
    ref: 'FA-4504',
    type: 'vente',
    date: '2024-11-30',
    client_or_supplier: 'Champagnac SA',
    client_code: 'C0357',
    address: 'Carretera de Vallvidrera 42',
    address_line2: '08017 Barcelona, Espagne',
    siret: 'N/A',
    tva_intra: 'ES B65432198',
    order_ref: 'CMD-ESP-2024-0187',
    lines: [
      { ref: 'PF-1204', description: 'Supports de fixation inox A4 — export série SP', detail: 'Lot de 50 unités — traitement anticorrosion marine', quantity: 3, unit: 'lots', unit_price_ht: 4875.10, total_ht: 14625.30 },
      { ref: 'PF-1218', description: 'Brides d\'assemblage haute résistance Ø160', detail: 'Alliage titane grade 5 — certification EN 10204-3.1', quantity: 15, unit: 'pièces', unit_price_ht: 698.00, total_ht: 10470.00 },
      { ref: 'PF-1233', description: 'Axes de liaison usinés — tolérance h6', detail: 'Acier 42CrMo4 trempé et revenu — longueur 480 mm', quantity: 12, unit: 'pièces', unit_price_ht: 672.50, total_ht: 8070.00 },
    ],
    total_ht: 33165.30,
    tva_rate: 0,
    tva_amount: 0,
    total_ttc: 33165.30,
    payment_terms: '60 jours fin de mois',
    payment_mode: 'Virement SWIFT',
    due_date: '2025-01-31',
    note: 'Exonération de TVA — art. 262 I du CGI (exportation)',
  },

  // ── FA-4472 — Matec SAS ──
  {
    ref: 'FA-4472',
    type: 'vente',
    date: '2024-11-30',
    client_or_supplier: 'Matec SAS Energy',
    client_code: 'C0706',
    address: '28 rue Garibaldi',
    address_line2: '69006 Lyon',
    siret: '523 412 876 00015',
    tva_intra: 'FR 32 523412876',
    order_ref: 'CMD-2024-1187',
    lines: [
      { ref: 'PF-0842', description: 'Pièces mécaniques usinées alliage A42 — série standard', detail: 'Tournage CN 5 axes — tolérance IT7', quantity: 45, unit: 'pièces', unit_price_ht: 389.50, total_ht: 17527.50 },
      { ref: 'PF-0856', description: 'Ensembles paliers montés avec roulements SKF', detail: 'Classe de précision P6 — graissage permanent', quantity: 18, unit: 'pièces', unit_price_ht: 634.75, total_ht: 11425.50 },
      { ref: 'PF-0871', description: 'Arbres de transmission rectifiés Ø55 h6', detail: 'Acier C45 chromé dur — longueur 720 mm', quantity: 15, unit: 'pièces', unit_price_ht: 519.75, total_ht: 7796.25 },
    ],
    total_ht: 36749.25,
    tva_rate: 20,
    tva_amount: 7349.85,
    total_ttc: 44099.10,
    payment_terms: '30 jours fin de mois',
    payment_mode: 'Virement bancaire',
    due_date: '2024-12-31',
    linked_bl_ref: 'BL-4472',
  },

  // ── FA-4464 — 3KB Ulster ──
  {
    ref: 'FA-4464',
    type: 'vente',
    date: '2024-11-30',
    client_or_supplier: '3KB Ulster Ltd',
    client_code: 'C0678',
    address: 'Unit 7 Springtown Industrial Estate',
    address_line2: 'BT48 0LY Derry, Northern Ireland, UK',
    siret: 'N/A',
    tva_intra: 'GB 234567891',
    order_ref: 'PO-3KB-2024-0442',
    lines: [
      { ref: 'PF-0934', description: 'Vérins hydrauliques double effet Ø80/45', detail: 'Course 350 mm — pression max. 250 bar — joints Viton', quantity: 8, unit: 'pièces', unit_price_ht: 2145.00, total_ht: 17160.00 },
      { ref: 'PF-0948', description: 'Distributeurs hydrauliques 4/3 à commande proportionnelle', detail: 'Débit nominal 60 l/min — raccords G3/4"', quantity: 6, unit: 'pièces', unit_price_ht: 1876.50, total_ht: 11259.00 },
      { ref: 'PF-0963', description: 'Blocs de sécurité avec clapets pilotés', detail: 'Montage sur embase CETOP 05 — alliage aluminium usiné', quantity: 5, unit: 'pièces', unit_price_ht: 1845.87, total_ht: 9229.35 },
    ],
    total_ht: 37648.35,
    tva_rate: 20,
    tva_amount: 7529.67,
    total_ttc: 45178.02,
    payment_terms: '45 jours',
    payment_mode: 'Virement SWIFT',
    due_date: '2025-01-14',
  },

  // ── FA-4852 — Soudard et Cie ──
  {
    ref: 'FA-4852',
    type: 'vente',
    date: '2024-12-17',
    client_or_supplier: 'Soudard et Compagnie SARL',
    client_code: 'C0817',
    address: '18 rue des Aciéries',
    address_line2: '42000 Saint-Étienne',
    siret: '412 567 893 00031',
    tva_intra: 'FR 56 412567893',
    order_ref: 'CMD-SC-2024-0298',
    lines: [
      { ref: 'PF-1102', description: 'Châssis mécano-soudés acier S355J2 — sablé et peint', detail: 'Dim. 1200 x 800 x 600 mm — épaisseur 8 mm', quantity: 4, unit: 'pièces', unit_price_ht: 5230.00, total_ht: 20920.00 },
      { ref: 'PF-1115', description: 'Platines d\'ancrage pré-percées avec goujons M20', detail: 'Acier galvanisé à chaud — épaisseur 25 mm', quantity: 13, unit: 'pièces', unit_price_ht: 762.99, total_ht: 9918.87 },
      { ref: 'PF-1128', description: 'Longerons de renfort profilé HEA 200 — découpe sur plan', detail: 'Longueur 2400 mm — perçages selon gabarit client', quantity: 5, unit: 'pièces', unit_price_ht: 1840.00, total_ht: 9200.00 },
      { ref: 'TR-0001', description: 'Frais de port et transport', detail: 'Livraison par porteur — Saint-Étienne', quantity: 1, unit: 'forfait', unit_price_ht: 522.00, total_ht: 522.00 },
    ],
    total_ht: 40560.87,
    tva_rate: 20,
    tva_amount: 8112.17,
    total_ttc: 48673.04,
    payment_terms: '30 jours fin de mois',
    payment_mode: 'Virement bancaire',
    due_date: '2025-01-31',
  },

  // ── FA-4477 — Gamelam SA ──
  {
    ref: 'FA-4477',
    type: 'vente',
    date: '2024-11-30',
    client_or_supplier: 'Gamelam SA',
    client_code: 'C0160',
    address: '5 boulevard de la Croix-Rousse',
    address_line2: '69004 Lyon',
    siret: '634 218 745 00042',
    tva_intra: 'FR 45 634218745',
    order_ref: 'CMD-2024-0856',
    lines: [
      { ref: 'PF-0712', description: 'Réducteurs à engrenages hélicoïdaux — rapport 1:25', detail: 'Couple nominal 480 N.m — rendement 96%', quantity: 6, unit: 'pièces', unit_price_ht: 3420.00, total_ht: 20520.00 },
      { ref: 'PF-0726', description: 'Accouplements élastiques type Rotex Ø48', detail: 'Alésage 28/38 mm — amortissement 98 Shore A', quantity: 12, unit: 'pièces', unit_price_ht: 856.10, total_ht: 10273.20 },
      { ref: 'PF-0738', description: 'Arbres de sortie avec rainure de clavette', detail: 'Acier 16MnCr5 cémenté — Ø60 h6 — L=350 mm', quantity: 6, unit: 'pièces', unit_price_ht: 1653.32, total_ht: 9919.92 },
      { ref: 'MC-1205', description: 'Marchandises diverses — consommables et accessoires', detail: 'Joints, bagues, vis de fixation, graisse spéciale', quantity: 1, unit: 'lot', unit_price_ht: 4674.00, total_ht: 4674.00 },
    ],
    total_ht: 45387.12,
    tva_rate: 20,
    tva_amount: 9077.42,
    total_ttc: 54464.54,
    payment_terms: '30 jours fin de mois',
    payment_mode: 'Virement bancaire',
    due_date: '2024-12-31',
    linked_bl_ref: 'BL-4477',
  },

  // ── FA-4491 — Lucie Gatin ──
  {
    ref: 'FA-4491',
    type: 'vente',
    date: '2024-11-30',
    client_or_supplier: 'Établissements Lucie Gatin',
    client_code: 'C0866',
    address: '42 chemin de la Mouche',
    address_line2: '69007 Lyon',
    siret: '745 321 098 00018',
    tva_intra: 'FR 67 745321098',
    order_ref: 'CMD-ELG-2024-0734',
    lines: [
      { ref: 'PF-0587', description: 'Tables de positionnement linéaire à vis à billes', detail: 'Course 600 mm — précision ±0,02 mm — rails THK', quantity: 4, unit: 'pièces', unit_price_ht: 5780.00, total_ht: 23120.00 },
      { ref: 'PF-0594', description: 'Colonnes de guidage rectifiées avec douilles à billes', detail: 'Ø40 h5 — longueur 500 mm — acier 100Cr6', quantity: 16, unit: 'pièces', unit_price_ht: 387.25, total_ht: 6196.00 },
      { ref: 'PF-0602', description: 'Plaques d\'adaptation usinées avec trous de fixation', detail: 'Aluminium AU4G — 400 x 300 x 20 mm — anodisé noir', quantity: 8, unit: 'pièces', unit_price_ht: 1245.00, total_ht: 9960.00 },
      { ref: 'PF-0618', description: 'Butées mécaniques de fin de course réglables', detail: 'Corps acier traité — amortisseur hydraulique intégré', quantity: 12, unit: 'pièces', unit_price_ht: 879.53, total_ht: 10554.36 },
    ],
    total_ht: 49830.36,
    tva_rate: 20,
    tva_amount: 9966.07,
    total_ttc: 59796.43,
    payment_terms: '45 jours fin de mois',
    payment_mode: 'Virement bancaire',
    due_date: '2025-01-15',
  },

  // ── FA-4515 — Soudard et Cie (second invoice) ──
  {
    ref: 'FA-4515',
    type: 'vente',
    date: '2024-11-30',
    client_or_supplier: 'Soudard et Compagnie SARL',
    client_code: 'C0817',
    address: '18 rue des Aciéries',
    address_line2: '42000 Saint-Étienne',
    siret: '412 567 893 00031',
    tva_intra: 'FR 56 412567893',
    order_ref: 'CMD-SC-2024-0312',
    lines: [
      { ref: 'PF-1140', description: 'Bâtis de machines mécano-soudés — structure renforcée', detail: 'Acier S355J2 — dim. 2000 x 1000 x 1200 mm', quantity: 3, unit: 'pièces', unit_price_ht: 8450.00, total_ht: 25350.00 },
      { ref: 'PF-1155', description: 'Traverses de rigidification profilé IPE 240', detail: 'Longueur 1800 mm — platines soudées aux extrémités', quantity: 8, unit: 'pièces', unit_price_ht: 1245.00, total_ht: 9960.00 },
      { ref: 'PF-1168', description: 'Pieds réglables anti-vibratoires M24 — charge 5 tonnes', detail: 'Semelle vulcanisée — course réglage 40 mm', quantity: 16, unit: 'pièces', unit_price_ht: 358.51, total_ht: 5736.16 },
      { ref: 'PF-1175', description: 'Plaques de montage usinées avec perçages de précision', detail: 'Fonte grise FGL 250 — planéité 0,05 mm/m', quantity: 8, unit: 'pièces', unit_price_ht: 1281.25, total_ht: 10250.00 },
      { ref: 'TR-0002', description: 'Frais de port et transport', detail: 'Livraison par porteur — Saint-Étienne — chargement grue', quantity: 1, unit: 'forfait', unit_price_ht: 573.00, total_ht: 573.00 },
    ],
    total_ht: 51869.16,
    tva_rate: 20,
    tva_amount: 10373.83,
    total_ttc: 62242.99,
    payment_terms: '30 jours fin de mois',
    payment_mode: 'Virement bancaire',
    due_date: '2024-12-31',
    linked_bl_ref: 'BL-4515',
  },

  // ── FA-4479 — Caldelec ──
  {
    ref: 'FA-4479',
    type: 'vente',
    date: '2024-11-30',
    client_or_supplier: 'Caldelec SAS',
    client_code: 'C0736',
    address: '9 impasse des Électriciens',
    address_line2: '69200 Vénissieux',
    siret: '856 432 178 00027',
    tva_intra: 'FR 89 856432178',
    order_ref: 'CMD-2024-1042',
    lines: [
      { ref: 'PF-0982', description: 'Armoires de commande industrielle — tôle 2 mm', detail: 'Dim. 2000 x 800 x 600 mm — IP55 — RAL 7035', quantity: 5, unit: 'pièces', unit_price_ht: 4120.00, total_ht: 20600.00 },
      { ref: 'PF-0995', description: 'Platines de montage découpées laser avec pliage', detail: 'Acier DC01 — épaisseur 3 mm — peinture époxy', quantity: 20, unit: 'pièces', unit_price_ht: 867.50, total_ht: 17350.00 },
      { ref: 'PF-1008', description: 'Supports de câblage et chemins de câbles perforés', detail: 'Acier galvanisé Sendzimir — largeur 300 mm', quantity: 10, unit: 'mètres', unit_price_ht: 1238.33, total_ht: 12383.30 },
      { ref: 'PF-1022', description: 'Boîtiers de dérivation industriels usinés sur mesure', detail: 'Aluminium AS13 — IP66 — presse-étoupes M25 inclus', quantity: 8, unit: 'pièces', unit_price_ht: 2002.79, total_ht: 16022.32 },
    ],
    total_ht: 66355.62,
    tva_rate: 20,
    tva_amount: 13271.12,
    total_ttc: 79626.74,
    payment_terms: '30 jours fin de mois',
    payment_mode: 'Virement bancaire',
    due_date: '2024-12-31',
    linked_bl_ref: 'BL-4479',
  },
]

// =============================================================================
// Delivery Notes (4 BLs)
// =============================================================================

const deliveryNotes: DeliveryNoteData[] = [
  // ── BL-4472 — Matec SAS ──
  {
    ref: 'BL-4472',
    type: 'livraison',
    date_expedition: '2024-11-28',
    date_delivery: '2024-11-30',
    order_ref: 'CMD-2024-1187',
    linked_invoice: 'FA-4472',
    recipient_or_supplier: 'Matec SAS Energy',
    address: '28 rue Garibaldi',
    address_line2: '69006 Lyon',
    contact: 'M. Philippe Renard',
    phone: '04 72 45 67 89',
    transporter: 'Transports Rhône Express',
    tracking_number: 'TRE-2024-48721',
    incoterm: 'DDP Lyon — Franco de port',
    weight: '486 kg — 2 palettes filmées',
    packaging: '2 palettes EUR 1200x800 — filmage étirable + cerclage',
    items: [
      { ref: 'PF-0842', description: 'Pièces mécaniques usinées alliage A42 — série standard', quantity: '45', unit: 'pièces' },
      { ref: 'PF-0856', description: 'Ensembles paliers montés avec roulements SKF', quantity: '18', unit: 'pièces' },
      { ref: 'PF-0871', description: 'Arbres de transmission rectifiés Ø55 h6', quantity: '15', unit: 'pièces' },
    ],
    received_by: 'M. Philippe Renard',
    observations: 'Marchandise conforme — réceptionnée quai B',
  },

  // ── BL-4477 — Gamelam SA ──
  {
    ref: 'BL-4477',
    type: 'livraison',
    date_expedition: '2024-11-28',
    date_delivery: '2024-11-29',
    order_ref: 'CMD-2024-0856',
    linked_invoice: 'FA-4477',
    recipient_or_supplier: 'Gamelam SA',
    address: '5 boulevard de la Croix-Rousse',
    address_line2: '69004 Lyon',
    contact: 'Mme Catherine Blanc',
    phone: '04 78 32 10 54',
    transporter: 'Gefco Lyon',
    tracking_number: 'GEF-2024-LY-7834',
    incoterm: 'DDP Lyon',
    weight: '312 kg — 1 palette filmée + 2 cartons',
    packaging: '1 palette EUR 1200x800 + 2 cartons renforcés',
    items: [
      { ref: 'PF-0712', description: 'Réducteurs à engrenages hélicoïdaux — rapport 1:25', quantity: '6', unit: 'pièces' },
      { ref: 'PF-0726', description: 'Accouplements élastiques type Rotex Ø48', quantity: '12', unit: 'pièces' },
      { ref: 'PF-0738', description: 'Arbres de sortie avec rainure de clavette', quantity: '6', unit: 'pièces' },
      { ref: 'MC-1205', description: 'Marchandises diverses — consommables et accessoires', quantity: '1', unit: 'lot' },
    ],
    received_by: 'Mme Catherine Blanc',
    observations: 'RAS — conforme au bon de commande',
  },

  // ── BL-4515 — Soudard et Cie ──
  {
    ref: 'BL-4515',
    type: 'livraison',
    date_expedition: '2024-11-28',
    date_delivery: '2024-11-30',
    order_ref: 'CMD-SC-2024-0312',
    linked_invoice: 'FA-4515',
    recipient_or_supplier: 'Soudard et Compagnie SARL',
    address: '18 rue des Aciéries',
    address_line2: '42000 Saint-Étienne',
    contact: 'M. Jean-Marc Soudard',
    phone: '04 77 21 43 65',
    transporter: 'Transports Rhône Express',
    tracking_number: 'TRE-2024-49102',
    incoterm: 'DDP Saint-Étienne',
    weight: '724 kg — 3 palettes filmées',
    packaging: '3 palettes EUR 1200x800 — calage mousse + cerclage acier',
    items: [
      { ref: 'PF-1140', description: 'Bâtis de machines mécano-soudés — structure renforcée', quantity: '3', unit: 'pièces' },
      { ref: 'PF-1155', description: 'Traverses de rigidification profilé IPE 240', quantity: '8', unit: 'pièces' },
      { ref: 'PF-1168', description: 'Pieds réglables anti-vibratoires M24 — charge 5 tonnes', quantity: '16', unit: 'pièces' },
      { ref: 'PF-1175', description: 'Plaques de montage usinées avec perçages de précision', quantity: '8', unit: 'pièces' },
    ],
    received_by: 'M. Jean-Marc Soudard',
    observations: 'Réception conforme — déchargement grue effectué',
  },

  // ── BL-4479 — Caldelec ──
  {
    ref: 'BL-4479',
    type: 'livraison',
    date_expedition: '2024-11-29',
    date_delivery: '2024-11-29',
    order_ref: 'CMD-2024-1042',
    linked_invoice: 'FA-4479',
    recipient_or_supplier: 'Caldelec SAS',
    address: '9 impasse des Électriciens',
    address_line2: '69200 Vénissieux',
    contact: 'M. Stéphane Berger',
    phone: '04 72 89 56 23',
    transporter: 'Livraison directe (véhicule Rivetin)',
    incoterm: 'EXW Vénissieux',
    weight: '218 kg — 4 cartons sur palette',
    packaging: '1 palette EUR 1200x800 — 4 cartons renforcés cerclés',
    items: [
      { ref: 'PF-0982', description: 'Armoires de commande industrielle — tôle 2 mm', quantity: '5', unit: 'pièces' },
      { ref: 'PF-0995', description: 'Platines de montage découpées laser avec pliage', quantity: '20', unit: 'pièces' },
      { ref: 'PF-1008', description: 'Supports de câblage et chemins de câbles perforés', quantity: '10', unit: 'mètres' },
      { ref: 'PF-1022', description: 'Boîtiers de dérivation industriels usinés sur mesure', quantity: '8', unit: 'pièces' },
    ],
    received_by: 'M. Stéphane Berger',
    observations: 'Livraison locale — vérifié sur place — conforme',
  },
]

// =============================================================================
// PDF Generation — Invoice
// =============================================================================

function buildInvoicePdf(invoice: InvoiceData): TDocumentDefinitions {
  const isExport = invoice.tva_rate === 0 && invoice.note?.includes('262 I')

  // Title block (right side)
  const titleBlock: Content = {
    stack: [
      { text: 'FACTURE DE VENTE', fontSize: 16, bold: true, color: '#1a1a2e', alignment: 'right' as const },
      { text: `N° ${invoice.ref}`, fontSize: 11, bold: true, color: '#2c3e6b', alignment: 'right' as const, margin: [0, 4, 0, 0] as [number, number, number, number] },
    ],
  }

  // Reference info table
  const refRows: TableCell[][] = [
    [{ text: 'N° facture', style: 'smallLabel' }, { text: invoice.ref, style: 'smallValue' }],
    [{ text: 'Date', style: 'smallLabel' }, { text: fmtDate(invoice.date), style: 'smallValue' }],
  ]
  if (invoice.order_ref) {
    refRows.push([{ text: 'N° commande', style: 'smallLabel' }, { text: invoice.order_ref, style: 'smallValue' }])
  }
  if (invoice.linked_bl_ref) {
    refRows.push([{ text: 'Bon de livraison', style: 'smallLabel' }, { text: invoice.linked_bl_ref, style: 'smallValue' }])
  }
  refRows.push(
    [{ text: 'Mode de règlement', style: 'smallLabel' }, { text: invoice.payment_mode, style: 'smallValue' }],
    [{ text: 'Échéance', style: 'smallLabel' }, { text: fmtDate(invoice.due_date), style: 'smallValue' }],
  )

  const refTable: Content = {
    table: { widths: [90, 'auto'], body: refRows },
    layout: infoTableLayout,
    margin: [0, 8, 0, 0] as [number, number, number, number],
  }

  // Nature line
  const natureLine = isExport ? 'Exportation de biens' : 'Livraison de biens'

  // Line items table
  const lineHeaders: TableCell[] = [
    { text: 'Réf.', style: 'tableHeader' },
    { text: 'Désignation', style: 'tableHeader' },
    { text: 'Qté', style: 'tableHeader', alignment: 'right' as const },
    { text: 'Unité', style: 'tableHeader' },
    { text: 'P.U. HT', style: 'tableHeader', alignment: 'right' as const },
    { text: 'Total HT', style: 'tableHeader', alignment: 'right' as const },
  ]

  const lineRows: TableCell[][] = invoice.lines.map((line: InvoiceLine) => [
    { text: line.ref, style: 'tableCell' },
    {
      stack: [
        { text: line.description, style: 'tableCell' },
        ...(line.detail ? [{ text: line.detail, style: 'tableCell', color: '#777777', fontSize: 6.5 }] : []),
      ],
    },
    { text: line.quantity.toString(), style: 'tableCellRight' },
    { text: line.unit || 'pièces', style: 'tableCell' },
    { text: `${fmt(line.unit_price_ht)} €`, style: 'tableCellRight' },
    { text: `${fmt(line.total_ht)} €`, style: 'tableCellRight' },
  ])

  const linesTable: Content = {
    table: {
      headerRows: 1,
      widths: [45, '*', 30, 40, 65, 70],
      body: [lineHeaders, ...lineRows],
    },
    layout: invoiceTableLayout,
  }

  // Totals block
  const totalsRows: TableCell[][] = [
    [
      { text: 'Total HT', style: 'label', alignment: 'right' as const },
      { text: `${fmt(invoice.total_ht)} €`, style: 'tableCellBold', alignment: 'right' as const },
    ],
  ]

  if (isExport) {
    totalsRows.push([
      { text: 'TVA', style: 'smallLabel', alignment: 'right' as const },
      { text: 'Exonération — art. 262 I du CGI', style: 'smallValue', alignment: 'right' as const },
    ])
  } else {
    totalsRows.push([
      { text: `TVA ${invoice.tva_rate}%`, style: 'smallLabel', alignment: 'right' as const },
      { text: `${fmt(invoice.tva_amount)} €`, style: 'smallValue', alignment: 'right' as const },
    ])
  }

  totalsRows.push([
    { text: 'Total TTC', style: 'totalRow', alignment: 'right' as const },
    { text: `${fmt(invoice.total_ttc)} €`, style: 'totalRow', alignment: 'right' as const, fontSize: 11 },
  ])

  const totalsTable: Content = {
    table: { widths: [80, 90], body: totalsRows },
    layout: { hLineWidth: () => 0, vLineWidth: () => 0, paddingTop: () => 3, paddingBottom: () => 3 },
    margin: [340, 10, 0, 0] as [number, number, number, number],
  }

  // Build full document
  const content: Content[] = [
    // Header: company left, title right
    {
      columns: [
        { width: '55%', ...buildCompanyHeader(RIVETIN) as object },
        { width: '45%', ...titleBlock as object },
      ],
      margin: [0, 0, 0, 12] as [number, number, number, number],
    },
    // Ref table + client box side by side
    {
      columns: [
        { width: '45%', ...refTable as object },
        { width: '55%', ...buildClientBox(invoice, false) as object },
      ],
      margin: [0, 0, 0, 12] as [number, number, number, number],
    },
    // Nature
    { text: `Nature : ${natureLine}`, style: 'value', margin: [0, 0, 0, 10] as [number, number, number, number] },
    // Line items
    linesTable,
    // Totals
    totalsTable,
  ]

  // Export note
  if (isExport) {
    content.push({
      text: invoice.note!,
      style: 'legalTextBold',
      margin: [0, 8, 0, 0] as [number, number, number, number],
    })
  }

  // Banking info
  content.push({ text: '', margin: [0, 10, 0, 0] as [number, number, number, number] })
  content.push(buildBankingBlock(RIVETIN))

  // Legal conditions
  content.push(buildLegalConditions(invoice.payment_terms, invoice.payment_mode))

  // Footer
  content.push(buildLegalFooter(RIVETIN))

  return {
    content,
    defaultStyle: { font: 'Roboto', fontSize: 8 },
    styles: baseStyles,
    pageSize: 'A4' as const,
    pageMargins: [40, 40, 40, 40] as [number, number, number, number],
  }
}

// =============================================================================
// PDF Generation — Delivery Note
// =============================================================================

function buildDeliveryNotePdf(bl: DeliveryNoteData): TDocumentDefinitions {
  // Title block
  const titleBlock: Content = {
    stack: [
      { text: 'BON DE LIVRAISON', fontSize: 16, bold: true, color: '#1a1a2e', alignment: 'right' as const },
      { text: `N° ${bl.ref}`, fontSize: 11, bold: true, color: '#2c3e6b', alignment: 'right' as const, margin: [0, 4, 0, 0] as [number, number, number, number] },
    ],
  }

  // Destinataire box
  const recipientBox: Content = {
    table: {
      widths: ['*'],
      body: [[{
        stack: [
          { text: 'DESTINATAIRE', style: 'label', margin: [8, 6, 8, 3] as [number, number, number, number] },
          { text: bl.recipient_or_supplier, style: 'tableCellBold', fontSize: 9, margin: [8, 0, 8, 2] as [number, number, number, number] },
          { text: bl.address, style: 'tableCell', margin: [8, 0, 8, 1] as [number, number, number, number] },
          ...(bl.address_line2 ? [{ text: bl.address_line2, style: 'tableCell', margin: [8, 0, 8, 1] as [number, number, number, number] }] : []),
          { text: `Contact : ${bl.contact}`, style: 'tableCell', margin: [8, 2, 8, 1] as [number, number, number, number] },
          ...(bl.phone ? [{ text: `Tél. : ${bl.phone}`, style: 'tableCell', margin: [8, 0, 8, 6] as [number, number, number, number] }] : []),
        ],
      }]],
    },
    layout: boxLayout,
  }

  // Reference info
  const refRows: TableCell[][] = [
    [{ text: 'N° bon de livraison', style: 'smallLabel' }, { text: bl.ref, style: 'smallValue' }],
  ]
  if (bl.date_expedition) {
    refRows.push([{ text: 'Date d\'expédition', style: 'smallLabel' }, { text: fmtDate(bl.date_expedition), style: 'smallValue' }])
  }
  refRows.push(
    [{ text: 'Date de livraison', style: 'smallLabel' }, { text: fmtDate(bl.date_delivery), style: 'smallValue' }],
  )
  if (bl.order_ref) {
    refRows.push([{ text: 'N° commande', style: 'smallLabel' }, { text: bl.order_ref, style: 'smallValue' }])
  }
  refRows.push(
    [{ text: 'Facture associée', style: 'smallLabel' }, { text: bl.linked_invoice, style: 'smallValue' }],
  )

  const refTable: Content = {
    table: { widths: [95, 'auto'], body: refRows },
    layout: infoTableLayout,
  }

  // Transport section
  const transportRows: TableCell[][] = []
  if (bl.transporter) {
    transportRows.push([{ text: 'Transporteur', style: 'smallLabel' }, { text: bl.transporter, style: 'smallValue' }])
  }
  if (bl.tracking_number) {
    transportRows.push([{ text: 'N° suivi', style: 'smallLabel' }, { text: bl.tracking_number, style: 'smallValue' }])
  }
  if (bl.incoterm) {
    transportRows.push([{ text: 'Conditions de livraison', style: 'smallLabel' }, { text: bl.incoterm, style: 'smallValue' }])
  }
  if (bl.weight) {
    transportRows.push([{ text: 'Poids / conditionnement', style: 'smallLabel' }, { text: bl.weight, style: 'smallValue' }])
  }
  if (bl.packaging) {
    transportRows.push([{ text: 'Emballage', style: 'smallLabel' }, { text: bl.packaging, style: 'smallValue' }])
  }

  const transportTable: Content = {
    table: { widths: [110, '*'], body: transportRows },
    layout: infoTableLayout,
    margin: [0, 0, 0, 12] as [number, number, number, number],
  }

  // Items table
  const itemHeaders: TableCell[] = [
    { text: 'Réf.', style: 'tableHeader' },
    { text: 'Désignation', style: 'tableHeader' },
    { text: 'Quantité', style: 'tableHeader', alignment: 'right' as const },
    { text: 'Unité', style: 'tableHeader' },
  ]

  const itemRows: TableCell[][] = bl.items.map((item) => [
    { text: item.ref, style: 'tableCell' },
    { text: item.description, style: 'tableCell' },
    { text: item.quantity, style: 'tableCellRight' },
    { text: item.unit, style: 'tableCell' },
  ])

  const itemsTable: Content = {
    table: {
      headerRows: 1,
      widths: [50, '*', 50, 50],
      body: [itemHeaders, ...itemRows],
    },
    layout: invoiceTableLayout,
  }

  // Reception block
  const receptionBlock: Content = {
    table: {
      widths: ['*'],
      body: [[{
        stack: [
          { text: 'ACCUSÉ DE RÉCEPTION', style: 'label', margin: [8, 8, 8, 5] as [number, number, number, number] },
          { text: `Réceptionné par : ${bl.received_by}`, style: 'smallValue', margin: [8, 0, 8, 2] as [number, number, number, number] },
          { text: `Date de réception : ${fmtDate(bl.date_delivery)}`, style: 'smallValue', margin: [8, 0, 8, 2] as [number, number, number, number] },
          { text: `Observations : ${bl.observations}`, style: 'smallValue', margin: [8, 0, 8, 4] as [number, number, number, number] },
          { text: '', margin: [8, 0, 8, 0] as [number, number, number, number] },
          { text: 'Signature : [Signé]', style: 'smallLabel', margin: [8, 0, 8, 8] as [number, number, number, number] },
        ],
      }]],
    },
    layout: boxLayout,
    margin: [0, 15, 0, 0] as [number, number, number, number],
  }

  const content: Content[] = [
    // Header
    {
      columns: [
        { width: '55%', ...buildCompanyHeader(RIVETIN) as object },
        { width: '45%', ...titleBlock as object },
      ],
      margin: [0, 0, 0, 14] as [number, number, number, number],
    },
    // Destinataire + Refs
    {
      columns: [
        { width: '50%', ...recipientBox as object },
        { width: '50%', ...refTable as object },
      ],
      margin: [0, 0, 0, 12] as [number, number, number, number],
    },
    // Transport section
    { text: 'TRANSPORT', style: 'sectionTitle' },
    transportTable,
    // Items
    { text: 'DÉTAIL DES MARCHANDISES', style: 'sectionTitle' },
    itemsTable,
    // Reception
    receptionBlock,
    // Footer
    buildLegalFooter(RIVETIN),
  ]

  return {
    content,
    defaultStyle: { font: 'Roboto', fontSize: 8 },
    styles: baseStyles,
    pageSize: 'A4' as const,
    pageMargins: [40, 40, 40, 40] as [number, number, number, number],
  }
}

// =============================================================================
// Main Export
// =============================================================================

export async function generateSondageDocs(outputDir: string): Promise<{ count: number; outputDir: string }> {
  let count = 0

  // Generate invoices (flat in outputDir)
  for (const invoice of invoices) {
    const docDef = buildInvoicePdf(invoice)
    const buffer = await generatePdfBuffer(docDef)
    const filename = `${invoice.ref}.pdf`
    fs.writeFileSync(path.join(outputDir, filename), buffer)
    console.log(`  [sondage] Facture ${filename} (${(buffer.length / 1024).toFixed(0)} Ko)`)
    count++
  }

  // Generate delivery notes (flat in outputDir)
  for (const bl of deliveryNotes) {
    const docDef = buildDeliveryNotePdf(bl)
    const buffer = await generatePdfBuffer(docDef)
    const filename = `${bl.ref}.pdf`
    fs.writeFileSync(path.join(outputDir, filename), buffer)
    console.log(`  [sondage] Bon de livraison ${filename} (${(buffer.length / 1024).toFixed(0)} Ko)`)
    count++
  }

  // The FEC file is already present at data/sondage_ca/DGI_LET_2024.txt
  // Just verify it exists
  const fecPath = path.join(outputDir, 'DGI_LET_2024.txt')
  if (fs.existsSync(fecPath)) {
    console.log('  [sondage] FEC DGI_LET_2024.txt (existant)')
    count++
  } else {
    console.warn('  [sondage] ATTENTION: FEC DGI_LET_2024.txt non trouvé')
  }

  return { count, outputDir }
}
