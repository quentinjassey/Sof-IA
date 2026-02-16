// =============================================================================
// SOF'IA -- Donnees des entreprises fictives pour le scenario Pointage
// 4 entreprises : 3 propres + 1 avec incoherences (Brasserie du Vieux Port)
//
// VOCABULAIRE OBLIGATOIRE :
// - "signal documentaire" (jamais "anomalie")
// - "constat factuel" (jamais "conclusion")
// - "necessite l'attention du CAC" (jamais "significatif")
// =============================================================================

import type { SignalType, SignalPriority } from './signal-rules'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface BilanLigne {
  label: string
  brut: number
  amort: number
  net: number
  net_n1: number
}

export interface BilanActif {
  immobilisations_incorporelles: BilanLigne
  immobilisations_corporelles: BilanLigne
  immobilisations_financieres: BilanLigne
  stocks: BilanLigne
  creances_clients: BilanLigne
  autres_creances: BilanLigne
  disponibilites: BilanLigne
  charges_constatees_avance: BilanLigne
}

export interface BilanPassif {
  capital_social: BilanLigne
  reserves: BilanLigne
  resultat_exercice: BilanLigne
  report_nouveau: BilanLigne
  provisions_risques: BilanLigne
  emprunts_dettes_financieres: BilanLigne
  dettes_fournisseurs: BilanLigne
  dettes_fiscales_sociales: BilanLigne
  autres_dettes: BilanLigne
  produits_constates_avance: BilanLigne
}

export interface CompteResultatLigne {
  label: string
  montant: number
  montant_n1: number
}

export interface CompteResultat {
  produits_exploitation: CompteResultatLigne[]
  charges_exploitation: CompteResultatLigne[]
  resultat_exploitation: number
  resultat_exploitation_n1: number
  produits_financiers: CompteResultatLigne[]
  charges_financieres: CompteResultatLigne[]
  resultat_financier: number
  resultat_financier_n1: number
  produits_exceptionnels: CompteResultatLigne[]
  charges_exceptionnelles: CompteResultatLigne[]
  resultat_exceptionnel: number
  resultat_exceptionnel_n1: number
  impot_benefices: number
  impot_benefices_n1: number
  resultat_net: number
  resultat_net_n1: number
}

export interface AnnexeNote {
  numero: number
  titre: string
  contenu: string
  montants?: Record<string, number>
}

export interface ExpectedPointageSignal {
  signal_id: string
  rule_triggered: string
  type: SignalType
  description: string
  priority: SignalPriority
  source_document: string
  compared_documents: string[]
  source_page: string
  amount?: number
  discrepancy?: string
  nep_reference?: string
}

export interface PointageCompany {
  id: string
  name: string
  legal_form: string
  address: string
  siret: string
  rcs: string
  president: string
  capital_social: number
  fiscal_year_end: string
  bilan: { actif: BilanActif; passif: BilanPassif }
  compte_resultat: CompteResultat
  annexe: AnnexeNote[]
  expected_signals: ExpectedPointageSignal[]
  is_faulty: boolean
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function bl(label: string, brut: number, amort: number, net_n1: number): BilanLigne {
  return { label, brut, amort, net: brut - amort, net_n1 }
}

function blPassif(label: string, montant: number, montant_n1: number): BilanLigne {
  return { label, brut: montant, amort: 0, net: montant, net_n1: montant_n1 }
}

function crl(label: string, montant: number, montant_n1: number): CompteResultatLigne {
  return { label, montant, montant_n1 }
}

// -----------------------------------------------------------------------------
// Entreprise 1 : ACME Distribution SAS (propre)
// -----------------------------------------------------------------------------

const acmeDistribution: PointageCompany = {
  id: 'acme_distribution',
  name: 'ACME Distribution SAS',
  legal_form: 'SAS',
  address: '45 rue de la Republique, 69002 Lyon',
  siret: '412 345 678 00012',
  rcs: 'Lyon B 412 345 678',
  president: 'M. Pierre Martin',
  capital_social: 200000,
  fiscal_year_end: '2025-12-31',
  bilan: {
    actif: {
      immobilisations_incorporelles: bl('Immobilisations incorporelles', 85000, 34000, 48000),
      immobilisations_corporelles: bl('Immobilisations corporelles', 1530000, 534000, 1020000),
      immobilisations_financieres: bl('Immobilisations financieres', 25000, 0, 25000),
      stocks: bl('Stocks et en-cours', 380000, 12000, 345000),
      creances_clients: bl('Creances clients et comptes rattaches', 520000, 15000, 480000),
      autres_creances: bl('Autres creances', 45000, 0, 38000),
      disponibilites: bl('Disponibilites', 185000, 0, 142000),
      charges_constatees_avance: bl('Charges constatees d\'avance', 18000, 0, 15000),
    },
    passif: {
      capital_social: blPassif('Capital social', 200000, 200000),
      reserves: blPassif('Reserves', 180000, 155000),
      resultat_exercice: blPassif('Resultat de l\'exercice', 128000, 112000),
      report_nouveau: blPassif('Report a nouveau', 42000, 30000),
      provisions_risques: blPassif('Provisions pour risques et charges', 35000, 28000),
      emprunts_dettes_financieres: blPassif('Emprunts et dettes financieres', 650000, 720000),
      dettes_fournisseurs: blPassif('Dettes fournisseurs et comptes rattaches', 410000, 385000),
      dettes_fiscales_sociales: blPassif('Dettes fiscales et sociales', 285000, 265000),
      autres_dettes: blPassif('Autres dettes', 52000, 48000),
      produits_constates_avance: blPassif('Produits constates d\'avance', 15000, 12000),
    },
  },
  compte_resultat: {
    produits_exploitation: [
      crl('Chiffre d\'affaires net', 4050000, 3820000),
      crl('Production stockee', 15000, 8000),
      crl('Reprises sur provisions', 12000, 10000),
      crl('Autres produits d\'exploitation', 8000, 5000),
    ],
    charges_exploitation: [
      crl('Achats de marchandises', 2450000, 2310000),
      crl('Variation de stocks', -20000, 12000),
      crl('Autres achats et charges externes', 520000, 490000),
      crl('Impots, taxes et versements assimiles', 85000, 78000),
      crl('Salaires et traitements', 580000, 545000),
      crl('Charges sociales', 232000, 218000),
      crl('Dotations aux amortissements et provisions', 95000, 88000),
      crl('Autres charges d\'exploitation', 5000, 4000),
    ],
    resultat_exploitation: 138000,
    resultat_exploitation_n1: 98000,
    produits_financiers: [crl('Produits financiers', 3000, 2500)],
    charges_financieres: [crl('Charges financieres', 28000, 32000)],
    resultat_financier: -25000,
    resultat_financier_n1: -29500,
    produits_exceptionnels: [crl('Produits exceptionnels', 45000, 82000)],
    charges_exceptionnelles: [crl('Charges exceptionnelles', 8000, 15000)],
    resultat_exceptionnel: 37000,
    resultat_exceptionnel_n1: 67000,
    impot_benefices: 22000,
    impot_benefices_n1: 23500,
    resultat_net: 128000,
    resultat_net_n1: 112000,
  },
  annexe: [
    { numero: 1, titre: 'Regles et methodes comptables', contenu: 'Les comptes annuels sont etablis conformement aux dispositions du Plan Comptable General (PCG). Les conventions generales comptables ont ete appliquees, dans le respect du principe de prudence.' },
    { numero: 2, titre: 'Immobilisations incorporelles', contenu: 'Les immobilisations incorporelles sont evaluees a leur cout d\'acquisition. Les amortissements sont calcules selon le mode lineaire. Logiciels : duree 3 ans. Fonds commercial : non amorti, soumis a un test de depreciation annuel.', montants: { brut: 85000, amort: 34000, net: 51000 } },
    { numero: 3, titre: 'Immobilisations corporelles', contenu: 'Les immobilisations corporelles sont evaluees a leur cout d\'acquisition. Terrains et constructions : duree 20 a 40 ans. Materiel et outillage : duree 5 a 10 ans. Materiel de transport : duree 4 a 5 ans. Mobilier et materiel de bureau : duree 5 a 10 ans. Mouvement des immobilisations corporelles sur l\'exercice : acquisitions 145 000 EUR, cessions 18 000 EUR (VNC 3 000 EUR).', montants: { brut: 1530000, amort: 534000, net: 996000 } },
    { numero: 4, titre: 'Immobilisations financieres', contenu: 'Participations dans la SCI des Ateliers du Rhone pour 25 000 EUR.', montants: { brut: 25000, amort: 0, net: 25000 } },
    { numero: 5, titre: 'Stocks', contenu: 'Les stocks sont evalues au cout moyen pondere. Une depreciation est constatee lorsque la valeur de realisation est inferieure au cout d\'acquisition. Depreciation des stocks : 12 000 EUR (principalement sur marchandises a rotation lente).', montants: { brut: 380000, depreciation: 12000, net: 368000 } },
    { numero: 6, titre: 'Creances', contenu: 'Les creances sont evaluees a leur valeur nominale. Une depreciation est pratiquee lorsque la valeur de recouvrement est inferieure a la valeur nominale. Depreciation des creances clients : 15 000 EUR (3 clients en difficulte identifies).', montants: { creances_clients_brut: 520000, depreciation: 15000, net: 505000 } },
    { numero: 7, titre: 'Capitaux propres', contenu: 'Capital social : 200 000 EUR divise en 20 000 actions de 10 EUR. Reserves legale : 20 000 EUR. Autres reserves : 160 000 EUR. Report a nouveau : 42 000 EUR.' },
    { numero: 8, titre: 'Provisions pour risques et charges', contenu: 'Provision pour litige commercial : 20 000 EUR (litige avec un ancien client). Provision pour garantie clients : 15 000 EUR. Mouvement : dotation 12 000 EUR, reprise 5 000 EUR.', montants: { total: 35000 } },
    { numero: 9, titre: 'Emprunts et dettes financieres', contenu: 'Emprunt bancaire LCL (2022-2029) : 520 000 EUR, taux 2,8 %, echeances trimestrielles. Facilite de caisse BNP : 130 000 EUR, taux variable Euribor + 1,5 %.', montants: { total: 650000 } },
    { numero: 10, titre: 'Chiffre d\'affaires', contenu: 'Chiffre d\'affaires net : 4 050 000 EUR, en progression de 6,0 % par rapport a N-1 (3 820 000 EUR). Repartition : France metropolitaine 92 %, Export UE 8 %.', montants: { total: 4050000 } },
    { numero: 11, titre: 'Effectif moyen', contenu: 'L\'effectif moyen est de 28 salaries (25 en N-1), repartis comme suit : cadres 6, employes 14, agents de maitrise 8.' },
    { numero: 12, titre: 'Engagements hors bilan', contenu: 'Credit-bail mobilier : engagement residuel 85 000 EUR (materiel de manutention). Caution bancaire : 40 000 EUR (loyer entrepot). Aucun autre engagement significatif hors bilan.' },
    { numero: 13, titre: 'Evenements posterieurs a la cloture', contenu: 'Aucun evenement significatif survenu entre la date de cloture et la date d\'arrete des comptes.' },
    { numero: 14, titre: 'Autres informations', contenu: 'Autres charges externes : 520 000 EUR (loyers 180 000 EUR, sous-traitance 120 000 EUR, honoraires 45 000 EUR, frais de deplacement 35 000 EUR, assurances 28 000 EUR, entretien 42 000 EUR, divers 70 000 EUR).' },
  ],
  expected_signals: [],
  is_faulty: false,
}

// -----------------------------------------------------------------------------
// Entreprise 2 : Duval Menuiserie SARL (propre)
// -----------------------------------------------------------------------------

const duvalMenuiserie: PointageCompany = {
  id: 'duval_menuiserie',
  name: 'Duval Menuiserie SARL',
  legal_form: 'SARL',
  address: '12 avenue des Chartrons, 33000 Bordeaux',
  siret: '523 456 789 00034',
  rcs: 'Bordeaux B 523 456 789',
  president: 'Mme Sophie Duval',
  capital_social: 50000,
  fiscal_year_end: '2025-12-31',
  bilan: {
    actif: {
      immobilisations_incorporelles: bl('Immobilisations incorporelles', 15000, 9000, 7000),
      immobilisations_corporelles: bl('Immobilisations corporelles', 480000, 185000, 310000),
      immobilisations_financieres: bl('Immobilisations financieres', 5000, 0, 5000),
      stocks: bl('Stocks et en-cours', 195000, 8000, 180000),
      creances_clients: bl('Creances clients et comptes rattaches', 210000, 6000, 195000),
      autres_creances: bl('Autres creances', 18000, 0, 15000),
      disponibilites: bl('Disponibilites', 72000, 0, 58000),
      charges_constatees_avance: bl('Charges constatees d\'avance', 5000, 0, 4000),
    },
    passif: {
      capital_social: blPassif('Capital social', 50000, 50000),
      reserves: blPassif('Reserves', 85000, 72000),
      resultat_exercice: blPassif('Resultat de l\'exercice', 42000, 38000),
      report_nouveau: blPassif('Report a nouveau', 15000, 10000),
      provisions_risques: blPassif('Provisions pour risques et charges', 12000, 10000),
      emprunts_dettes_financieres: blPassif('Emprunts et dettes financieres', 280000, 310000),
      dettes_fournisseurs: blPassif('Dettes fournisseurs et comptes rattaches', 185000, 172000),
      dettes_fiscales_sociales: blPassif('Dettes fiscales et sociales', 112000, 98000),
      autres_dettes: blPassif('Autres dettes', 16000, 14000),
      produits_constates_avance: blPassif('Produits constates d\'avance', 3000, 0),
    },
  },
  compte_resultat: {
    produits_exploitation: [
      crl('Chiffre d\'affaires net', 1280000, 1180000),
      crl('Production stockee', 8000, 5000),
      crl('Reprises sur provisions', 4000, 3000),
      crl('Autres produits d\'exploitation', 2000, 1500),
    ],
    charges_exploitation: [
      crl('Achats de matieres premieres', 520000, 480000),
      crl('Variation de stocks', -5000, 8000),
      crl('Autres achats et charges externes', 285000, 268000),
      crl('Impots, taxes et versements assimiles', 32000, 29000),
      crl('Salaires et traitements', 248000, 230000),
      crl('Charges sociales', 99000, 92000),
      crl('Dotations aux amortissements et provisions', 42000, 38000),
      crl('Autres charges d\'exploitation', 2000, 1800),
    ],
    resultat_exploitation: 68000,
    resultat_exploitation_n1: 41700,
    produits_financiers: [crl('Produits financiers', 500, 400)],
    charges_financieres: [crl('Charges financieres', 18000, 20000)],
    resultat_financier: -17500,
    resultat_financier_n1: -19600,
    produits_exceptionnels: [crl('Produits exceptionnels', 2000, 25000)],
    charges_exceptionnelles: [crl('Charges exceptionnelles', 1500, 2000)],
    resultat_exceptionnel: 500,
    resultat_exceptionnel_n1: 23000,
    impot_benefices: 9000,
    impot_benefices_n1: 7100,
    resultat_net: 42000,
    resultat_net_n1: 38000,
  },
  annexe: [
    { numero: 1, titre: 'Regles et methodes comptables', contenu: 'Les comptes annuels sont etablis conformement aux dispositions du PCG. Methode des couts historiques. Amortissements lineaires.' },
    { numero: 2, titre: 'Immobilisations incorporelles', contenu: 'Logiciel de gestion : cout 15 000 EUR, amorti sur 3 ans.', montants: { brut: 15000, amort: 9000, net: 6000 } },
    { numero: 3, titre: 'Immobilisations corporelles', contenu: 'Atelier et outillage : duree 7 a 10 ans. Vehicules utilitaires : duree 5 ans. Mobilier : duree 8 ans. Acquisitions de l\'exercice : 45 000 EUR (machine decoupe numerique). Aucune cession.', montants: { brut: 480000, amort: 185000, net: 295000 } },
    { numero: 4, titre: 'Stocks', contenu: 'Matieres premieres (bois, quincaillerie, verre) evaluees au CUMP. Depreciation : 8 000 EUR sur lots anciens.', montants: { brut: 195000, depreciation: 8000, net: 187000 } },
    { numero: 5, titre: 'Creances', contenu: 'Creances clients : 210 000 EUR brut, depreciation 6 000 EUR sur 2 clients douteux.', montants: { brut: 210000, depreciation: 6000, net: 204000 } },
    { numero: 6, titre: 'Capitaux propres', contenu: 'Capital social : 50 000 EUR (500 parts de 100 EUR). Reserves legale : 5 000 EUR. Reserves libres : 80 000 EUR.' },
    { numero: 7, titre: 'Provisions', contenu: 'Provision pour garantie decennale : 12 000 EUR.', montants: { total: 12000 } },
    { numero: 8, titre: 'Emprunts', contenu: 'Pret Banque Populaire (2021-2028) : 280 000 EUR, taux 3,1 %, mensualites.', montants: { total: 280000 } },
    { numero: 9, titre: 'Chiffre d\'affaires', contenu: 'CA net : 1 280 000 EUR (+8,5 % vs N-1). Repartition : particuliers 65 %, professionnels 35 %.', montants: { total: 1280000 } },
    { numero: 10, titre: 'Effectif moyen', contenu: 'Effectif moyen : 12 salaries (11 en N-1). Menuisiers 7, poseurs 3, administratif 2.' },
    { numero: 11, titre: 'Engagements hors bilan', contenu: 'Credit-bail vehicule utilitaire : engagement residuel 18 000 EUR. Nantissement fonds de commerce au profit de la Banque Populaire.' },
    { numero: 12, titre: 'Evenements posterieurs', contenu: 'Aucun evenement notable apres la cloture.' },
    { numero: 13, titre: 'Autres informations', contenu: 'Autres achats et charges externes : 285 000 EUR (sous-traitance 95 000 EUR, loyer atelier 48 000 EUR, transport 32 000 EUR, assurances 22 000 EUR, honoraires 18 000 EUR, divers 70 000 EUR).' },
  ],
  expected_signals: [],
  is_faulty: false,
}

// -----------------------------------------------------------------------------
// Entreprise 3 : Technipro Services SAS (propre)
// -----------------------------------------------------------------------------

const techniproServices: PointageCompany = {
  id: 'technipro_services',
  name: 'Technipro Services SAS',
  legal_form: 'SAS',
  address: '8 boulevard Haussmann, 75009 Paris',
  siret: '634 567 890 00056',
  rcs: 'Paris B 634 567 890',
  president: 'M. Laurent Girard',
  capital_social: 150000,
  fiscal_year_end: '2025-12-31',
  bilan: {
    actif: {
      immobilisations_incorporelles: bl('Immobilisations incorporelles', 120000, 52000, 72000),
      immobilisations_corporelles: bl('Immobilisations corporelles', 350000, 140000, 225000),
      immobilisations_financieres: bl('Immobilisations financieres', 40000, 0, 40000),
      stocks: bl('Stocks et en-cours', 85000, 3000, 78000),
      creances_clients: bl('Creances clients et comptes rattaches', 680000, 22000, 620000),
      autres_creances: bl('Autres creances', 55000, 0, 48000),
      disponibilites: bl('Disponibilites', 310000, 0, 245000),
      charges_constatees_avance: bl('Charges constatees d\'avance', 25000, 0, 20000),
    },
    passif: {
      capital_social: blPassif('Capital social', 150000, 150000),
      reserves: blPassif('Reserves', 320000, 275000),
      resultat_exercice: blPassif('Resultat de l\'exercice', 185000, 158000),
      report_nouveau: blPassif('Report a nouveau', 65000, 50000),
      provisions_risques: blPassif('Provisions pour risques et charges', 45000, 38000),
      emprunts_dettes_financieres: blPassif('Emprunts et dettes financieres', 180000, 220000),
      dettes_fournisseurs: blPassif('Dettes fournisseurs et comptes rattaches', 285000, 260000),
      dettes_fiscales_sociales: blPassif('Dettes fiscales et sociales', 350000, 310000),
      autres_dettes: blPassif('Autres dettes', 68000, 55000),
      produits_constates_avance: blPassif('Produits constates d\'avance', 17000, 12000),
    },
  },
  compte_resultat: {
    produits_exploitation: [
      crl('Chiffre d\'affaires net', 2750000, 2480000),
      crl('Production stockee', 12000, 8000),
      crl('Reprises sur provisions', 8000, 6000),
      crl('Autres produits d\'exploitation', 5000, 3000),
    ],
    charges_exploitation: [
      crl('Achats de matieres et fournitures', 320000, 290000),
      crl('Variation de stocks', -3000, 5000),
      crl('Autres achats et charges externes', 850000, 780000),
      crl('Impots, taxes et versements assimiles', 65000, 58000),
      crl('Salaires et traitements', 820000, 750000),
      crl('Charges sociales', 328000, 300000),
      crl('Dotations aux amortissements et provisions', 68000, 62000),
      crl('Autres charges d\'exploitation', 4000, 3000),
    ],
    resultat_exploitation: 323000,
    resultat_exploitation_n1: 250000,
    produits_financiers: [crl('Produits financiers', 5000, 4000)],
    charges_financieres: [crl('Charges financieres', 12000, 15000)],
    resultat_financier: -7000,
    resultat_financier_n1: -11000,
    produits_exceptionnels: [crl('Produits exceptionnels', 8000, 12000)],
    charges_exceptionnelles: [crl('Charges exceptionnelles', 5000, 4000)],
    resultat_exceptionnel: 3000,
    resultat_exceptionnel_n1: 8000,
    impot_benefices: 134000,
    impot_benefices_n1: 89000,
    resultat_net: 185000,
    resultat_net_n1: 158000,
  },
  annexe: [
    { numero: 1, titre: 'Regles et methodes comptables', contenu: 'Comptes etablis conformement au PCG. Methode a l\'avancement pour les contrats de prestation longue duree.' },
    { numero: 2, titre: 'Immobilisations incorporelles', contenu: 'Logiciels et licences : cout 120 000 EUR, amortis sur 3 a 5 ans. Dont developpement logiciel interne 65 000 EUR.', montants: { brut: 120000, amort: 52000, net: 68000 } },
    { numero: 3, titre: 'Immobilisations corporelles', contenu: 'Materiel informatique : duree 3 ans. Agencements locaux : duree 9 ans. Mobilier : duree 7 ans. Acquisitions : 55 000 EUR. Cessions : 12 000 EUR (VNC 2 000 EUR).', montants: { brut: 350000, amort: 140000, net: 210000 } },
    { numero: 4, titre: 'Immobilisations financieres', contenu: 'Depot de garantie locaux commerciaux : 40 000 EUR.', montants: { brut: 40000, net: 40000 } },
    { numero: 5, titre: 'Creances', contenu: 'Creances clients brut : 680 000 EUR. Depreciation : 22 000 EUR (4 clients a risque identifies). Delai moyen de recouvrement : 52 jours.', montants: { brut: 680000, depreciation: 22000, net: 658000 } },
    { numero: 6, titre: 'Capitaux propres', contenu: 'Capital social : 150 000 EUR (15 000 actions de 10 EUR). Reserve legale : 15 000 EUR. Autres reserves : 305 000 EUR.' },
    { numero: 7, titre: 'Provisions', contenu: 'Provision pour litiges prudhommaux : 30 000 EUR. Provision pour garantie contractuelle : 15 000 EUR.', montants: { total: 45000 } },
    { numero: 8, titre: 'Emprunts', contenu: 'Pret BNP Paribas (2023-2030) : 180 000 EUR, taux 2,5 %.', montants: { total: 180000 } },
    { numero: 9, titre: 'Chiffre d\'affaires', contenu: 'CA net : 2 750 000 EUR (+10,9 % vs N-1). Repartition : conseil IT 55 %, developpement 30 %, formation 15 %.', montants: { total: 2750000 } },
    { numero: 10, titre: 'Effectif moyen', contenu: 'Effectif moyen : 35 salaries (32 en N-1). Consultants 22, developpeurs 8, support 3, administratif 2.' },
    { numero: 11, titre: 'Engagements hors bilan', contenu: 'Bail commercial 3/6/9 ans : loyer annuel 120 000 EUR, engagement residuel 360 000 EUR. Nantissement parts sociales au profit de BNP Paribas.' },
    { numero: 12, titre: 'Evenements posterieurs', contenu: 'Signature d\'un contrat cadre avec un nouveau client (CA estime 200 000 EUR/an) en janvier 2026.' },
    { numero: 13, titre: 'Autres informations', contenu: 'Autres achats et charges externes : 850 000 EUR (sous-traitance 380 000 EUR, loyers 120 000 EUR, honoraires 85 000 EUR, frais de deplacement 95 000 EUR, telecommunications 42 000 EUR, divers 128 000 EUR).' },
  ],
  expected_signals: [],
  is_faulty: false,
}

// -----------------------------------------------------------------------------
// Entreprise 4 : Brasserie du Vieux Port SA (AVEC incoherences)
// -----------------------------------------------------------------------------

const brasserieVieuxPort: PointageCompany = {
  id: 'brasserie_vieux_port',
  name: 'Brasserie du Vieux Port SA',
  legal_form: 'SA',
  address: '23 quai du Port, 13002 Marseille',
  siret: '745 678 901 00078',
  rcs: 'Marseille B 745 678 901',
  president: 'M. Jean-Marc Roux',
  capital_social: 500000,
  fiscal_year_end: '2025-12-31',
  bilan: {
    actif: {
      immobilisations_incorporelles: bl('Immobilisations incorporelles', 180000, 72000, 115000),
      // INCOHERENCE PTG-001: bilan dit 1 245 000 brut corporelles, annexe Note 3 dit 1 218 000 brut
      immobilisations_corporelles: bl('Immobilisations corporelles', 2450000, 1205000, 1280000),
      immobilisations_financieres: bl('Immobilisations financieres', 65000, 0, 65000),
      stocks: bl('Stocks et en-cours', 420000, 18000, 385000),
      creances_clients: bl('Creances clients et comptes rattaches', 780000, 25000, 720000),
      autres_creances: bl('Autres creances', 62000, 0, 55000),
      disponibilites: bl('Disponibilites', 245000, 0, 198000),
      charges_constatees_avance: bl('Charges constatees d\'avance', 22000, 0, 18000),
    },
    passif: {
      capital_social: blPassif('Capital social', 500000, 500000),
      reserves: blPassif('Reserves', 480000, 420000),
      resultat_exercice: blPassif('Resultat de l\'exercice', 210000, 185000),
      report_nouveau: blPassif('Report a nouveau', 95000, 75000),
      provisions_risques: blPassif('Provisions pour risques et charges', 58000, 48000),
      emprunts_dettes_financieres: blPassif('Emprunts et dettes financieres', 850000, 920000),
      dettes_fournisseurs: blPassif('Dettes fournisseurs et comptes rattaches', 520000, 485000),
      dettes_fiscales_sociales: blPassif('Dettes fiscales et sociales', 395000, 365000),
      autres_dettes: blPassif('Autres dettes', 82000, 75000),
      produits_constates_avance: blPassif('Produits constates d\'avance', 34000, 28000),
    },
  },
  compte_resultat: {
    produits_exploitation: [
      crl('Chiffre d\'affaires net', 5200000, 4850000),
      crl('Production stockee', 22000, 15000),
      crl('Reprises sur provisions', 15000, 12000),
      crl('Autres produits d\'exploitation', 10000, 8000),
    ],
    charges_exploitation: [
      crl('Achats de matieres premieres', 1820000, 1700000),
      crl('Variation de stocks', -15000, 20000),
      crl('Autres achats et charges externes', 1250000, 1180000),
      crl('Impots, taxes et versements assimiles', 125000, 115000),
      crl('Salaires et traitements', 1050000, 980000),
      crl('Charges sociales', 420000, 392000),
      crl('Dotations aux amortissements et provisions', 155000, 142000),
      crl('Autres charges d\'exploitation', 8000, 6000),
    ],
    resultat_exploitation: 434000,
    resultat_exploitation_n1: 350000,
    produits_financiers: [crl('Produits financiers', 8000, 6000)],
    charges_financieres: [crl('Charges financieres', 42000, 48000)],
    resultat_financier: -34000,
    resultat_financier_n1: -42000,
    produits_exceptionnels: [crl('Produits exceptionnels', 15000, 20000)],
    charges_exceptionnelles: [crl('Charges exceptionnelles', 12000, 8000)],
    resultat_exceptionnel: 3000,
    resultat_exceptionnel_n1: 12000,
    impot_benefices: 193000,
    impot_benefices_n1: 135000,
    resultat_net: 210000,
    resultat_net_n1: 185000,
  },
  annexe: [
    { numero: 1, titre: 'Regles et methodes comptables', contenu: 'Comptes etablis conformement au PCG. Amortissements lineaires. Stocks evalues au CUMP.' },
    { numero: 2, titre: 'Immobilisations incorporelles', contenu: 'Fonds de commerce : 95 000 EUR (non amorti). Logiciels : 85 000 EUR amortis sur 3 ans.', montants: { brut: 180000, amort: 72000, net: 108000 } },
    // INCOHERENCE PTG-001 : annexe dit brut 2 423 000 (vs bilan 2 450 000 = ecart 27 000)
    { numero: 3, titre: 'Immobilisations corporelles', contenu: 'Installations techniques : duree 10 a 15 ans. Materiel de brassage : duree 8 a 12 ans. Materiel de transport : duree 5 ans. Mobilier : duree 7 ans. Mouvement de l\'exercice : acquisitions 185 000 EUR, cessions 32 000 EUR (VNC 5 000 EUR).', montants: { brut: 2423000, amort: 1178000, net: 1245000 } },
    { numero: 4, titre: 'Immobilisations financieres', contenu: 'Participation SARL Les Calanques Distribution : 50 000 EUR. Depot de garantie locaux : 15 000 EUR.', montants: { brut: 65000, net: 65000 } },
    { numero: 5, titre: 'Stocks', contenu: 'Matieres premieres (malt, houblon, levures) : 280 000 EUR. Produits finis (bieres, sodas) : 140 000 EUR. Depreciation : 18 000 EUR.', montants: { brut: 420000, depreciation: 18000, net: 402000 } },
    { numero: 6, titre: 'Creances', contenu: 'Creances clients : 780 000 EUR brut. Depreciation : 25 000 EUR (5 clients CHR en difficulte). Delai moyen : 48 jours.', montants: { brut: 780000, depreciation: 25000, net: 755000 } },
    { numero: 7, titre: 'Capitaux propres', contenu: 'Capital social : 500 000 EUR (50 000 actions de 10 EUR). Reserve legale : 50 000 EUR. Autres reserves : 430 000 EUR. Report a nouveau : 95 000 EUR.' },
    { numero: 8, titre: 'Provisions', contenu: 'Provision pour remise en etat site : 35 000 EUR. Provision pour litige fournisseur : 23 000 EUR.', montants: { total: 58000 } },
    { numero: 9, titre: 'Emprunts', contenu: 'Pret Credit Agricole (2021-2031) : 620 000 EUR, taux 2,6 %. Pret BPI France (2023-2028) : 230 000 EUR, taux 1,8 %.', montants: { total: 850000 } },
    { numero: 10, titre: 'Chiffre d\'affaires', contenu: 'CA net : 5 200 000 EUR (+7,2 % vs N-1). Repartition : bieres artisanales 72 %, boissons non alcoolisees 18 %, restauration sur place 10 %.', montants: { total: 5200000 } },
    { numero: 11, titre: 'Effectif moyen', contenu: 'Effectif moyen : 45 salaries (42 en N-1). Production 22, logistique 10, commercial 8, administratif 5.' },
    // INCOHERENCE PTG-002 : PAS de note "Engagements hors bilan" — manquante
    // (la societe a du credit-bail et des cautions, mais pas de note dediee)
    { numero: 12, titre: 'Evenements posterieurs a la cloture', contenu: 'Lancement d\'une nouvelle gamme de bieres sans alcool prevu en mars 2026. Investissement prevu : 120 000 EUR.' },
    // INCOHERENCE PTG-005 : Honoraires passent de 38 000 a 142 000 (+273%), explication = "divers"
    { numero: 13, titre: 'Autres informations', contenu: 'Autres achats et charges externes : 1 250 000 EUR (matieres consommables 280 000 EUR, sous-traitance 185 000 EUR, loyers 165 000 EUR, transport et livraisons 148 000 EUR, entretien et reparations 95 000 EUR, assurances 52 000 EUR, honoraires 142 000 EUR, publicite 68 000 EUR, divers 115 000 EUR). Les honoraires comprennent divers conseils et prestations.', montants: { honoraires_n: 142000, honoraires_n1: 38000 } },
  ],
  expected_signals: [
    {
      signal_id: 'S1',
      rule_triggered: 'PTG-001',
      type: 'incoherence_montant',
      description:
        'Ecart entre le poste "Immobilisations corporelles" au bilan ' +
        '(brut : 2 450 000 EUR) et le montant indique dans l\'annexe Note 3 ' +
        '(brut : 2 423 000 EUR). Ecart de 27 000 EUR. ' +
        'Le bilan presente un total brut de 2 450 000 EUR et des amortissements de 1 205 000 EUR ' +
        '(net = 1 245 000 EUR). L\'annexe indique un total brut de 2 423 000 EUR et des ' +
        'amortissements de 1 178 000 EUR (net = 1 245 000 EUR).',
      priority: 'high',
      source_document: 'Bilan',
      compared_documents: ['Bilan', 'Annexe — Note 3'],
      source_page: 'Bilan — Actif immobilise / Annexe — Note 3',
      amount: 2450000,
      discrepancy: '27 000 EUR (ecart brut) / amortissements ecart 27 000 EUR',
      nep_reference: 'NEP 500',
    },
    {
      signal_id: 'S2',
      rule_triggered: 'PTG-002',
      type: 'incompletude',
      description:
        'Information obligatoire absente de l\'annexe : les engagements hors bilan ne sont pas ' +
        'mentionnes. L\'annexe ne contient aucune note relative aux engagements hors bilan ' +
        '(credit-bail, cautions, garanties donnees, etc.). La societe dispose d\'emprunts bancaires ' +
        'de 850 000 EUR et l\'absence de cette information est notable au regard de ' +
        'l\'article L. 123-13 du Code de Commerce.',
      priority: 'medium',
      source_document: 'Annexe',
      compared_documents: ['Annexe'],
      source_page: 'Annexe — Ensemble du document (absence constatee)',
      nep_reference: 'NEP 500',
    },
    {
      signal_id: 'S3',
      rule_triggered: 'PTG-005',
      type: 'rupture_chaine',
      description:
        'Variation notable du poste "Honoraires" dans les autres charges externes : ' +
        '142 000 EUR en 2025 contre 38 000 EUR en 2024, soit une hausse de +273,7 %. ' +
        'L\'annexe (Note 13) mentionne uniquement "divers conseils et prestations" sans detail ' +
        'suffisant de cette variation de 104 000 EUR. Cette augmentation necessite ' +
        'l\'attention du commissaire aux comptes.',
      priority: 'high',
      source_document: 'Annexe — Note 13',
      compared_documents: ['Annexe — Note 13'],
      source_page: 'Annexe — Note 13 (Autres informations)',
      amount: 142000,
      discrepancy: '+104 000 EUR (+273,7 %)',
      nep_reference: 'NEP 500',
    },
  ],
  is_faulty: true,
}

// -----------------------------------------------------------------------------
// Export
// -----------------------------------------------------------------------------

export const POINTAGE_COMPANIES: PointageCompany[] = [
  acmeDistribution,
  duvalMenuiserie,
  techniproServices,
  brasserieVieuxPort,
]

/**
 * Retourne une entreprise aleatoire parmi les 4 disponibles.
 */
export function getRandomCompany(): PointageCompany {
  const index = Math.floor(Math.random() * POINTAGE_COMPANIES.length)
  return POINTAGE_COMPANIES[index]
}

/**
 * Retourne une entreprise par son identifiant.
 */
export function getCompanyById(id: string): PointageCompany | undefined {
  return POINTAGE_COMPANIES.find((c) => c.id === id)
}

// -----------------------------------------------------------------------------
// Seeded RNG + random discrepancies
// -----------------------------------------------------------------------------

/**
 * Crée un générateur pseudo-aléatoire déterministe à partir d'un seed (ex: missionId).
 * Le même seed produit toujours la même séquence de nombres.
 */
function createSeededRng(seed: string): () => number {
  let h = 0
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(31, h) + seed.charCodeAt(i) | 0
  }
  return () => {
    h = Math.imul(h, 1103515245) + 12345 | 0
    return ((h >>> 16) & 0x7fff) / 0x7fff
  }
}

/** Retourne un entier aléatoire entre min et max (inclus), arrondi au millier. */
function randRange(rng: () => number, min: number, max: number): number {
  return Math.round((rng() * (max - min) + min) / 1000) * 1000
}

/**
 * Retourne une copie de l'entreprise avec des décalages aléatoires introduits
 * entre les documents (bilan ↔ annexe, CR ↔ bilan passif).
 *
 * Les décalages sont déterministes : même missionId = mêmes décalages.
 * Au moins 2 décalages sont toujours présents.
 */
export function getCompanyWithDiscrepancies(companyId: string, missionId: string): PointageCompany | undefined {
  const base = getCompanyById(companyId)
  if (!base) return undefined

  // Deep clone pour ne pas modifier les données de base
  const company = JSON.parse(JSON.stringify(base)) as PointageCompany
  const rng = createSeededRng(missionId)

  const applied: string[] = []

  // --- PTG-001 : Écart montant bilan / annexe (Note 3 immo corporelles) ---
  // 70% de chance (ou déjà présent pour la Brasserie)
  const note3 = company.annexe.find((n) => n.numero === 3)
  if (note3?.montants?.brut != null) {
    const bilanBrut = company.bilan.actif.immobilisations_corporelles.brut
    const alreadyDiscrepant = note3.montants.brut !== bilanBrut

    if (alreadyDiscrepant) {
      applied.push('PTG-001')
    } else if (rng() < 0.7) {
      const offset = randRange(rng, 8000, 45000)
      const sign = rng() < 0.5 ? 1 : -1
      note3.montants.brut += sign * offset
      if (note3.montants.amort != null) {
        note3.montants.amort += sign * Math.round(offset * (0.3 + rng() * 0.3))
      }
      note3.montants.net = note3.montants.brut - (note3.montants.amort || 0)
      applied.push('PTG-001')
    }
  }

  // --- PTG-002 : Information obligatoire absente de l'annexe ---
  // 50% de chance de supprimer la note engagements hors bilan
  const engIdx = company.annexe.findIndex(
    (n) => n.titre.toLowerCase().includes('engagements hors bilan')
  )
  if (engIdx < 0) {
    applied.push('PTG-002') // déjà absente
  } else if (rng() < 0.5) {
    company.annexe.splice(engIdx, 1)
    applied.push('PTG-002')
  }

  // --- PTG-003 : Résultat net CR ≠ résultat exercice passif ---
  // 40% de chance
  const crResultat = company.compte_resultat.resultat_net
  const passifResultat = company.bilan.passif.resultat_exercice.net
  if (crResultat !== passifResultat) {
    applied.push('PTG-003') // déjà décalé
  } else if (rng() < 0.4) {
    const offset = randRange(rng, 2000, 12000)
    const sign = rng() < 0.5 ? 1 : -1
    company.bilan.passif.resultat_exercice.net += sign * offset
    company.bilan.passif.resultat_exercice.brut = company.bilan.passif.resultat_exercice.net
    applied.push('PTG-003')
  }

  // --- PTG-005 : Variation notable honoraires sans explication ---
  // 90% de chance (POC — on veut montrer le signal quasi systématiquement)
  const autresInfo = company.annexe.find(
    (n) => n.titre.toLowerCase().includes('autres informations')
  )
  if (autresInfo) {
    const alreadyHasHonoraires = autresInfo.montants?.honoraires_n != null
    if (alreadyHasHonoraires) {
      applied.push('PTG-005') // déjà présent (Brasserie)
    } else if (rng() < 0.9) {
      const honorairesN = randRange(rng, 80000, 180000)
      const honorairesN1 = randRange(rng, 15000, 40000)
      autresInfo.montants = {
        ...autresInfo.montants,
        honoraires_n: honorairesN,
        honoraires_n1: honorairesN1,
      }
      // S'assurer que le texte mentionne "divers" sans détail
      if (!autresInfo.contenu.toLowerCase().includes('divers conseils')) {
        autresInfo.contenu = autresInfo.contenu.replace(
          /honoraires \d[\d\s]*EUR/i,
          `honoraires ${honorairesN.toLocaleString('fr-FR')} EUR`
        )
        autresInfo.contenu += ' Les honoraires comprennent divers conseils et prestations.'
      }
      applied.push('PTG-005')
    }
  }

  // --- Garantir au moins 2 décalages (et PTG-005 toujours présent pour la démo) ---
  // Forcer PTG-005 si pas encore appliqué (critique pour la démo POC)
  if (!applied.includes('PTG-005') && autresInfo) {
    const honorairesN = randRange(rng, 80000, 180000)
    const honorairesN1 = randRange(rng, 15000, 40000)
    autresInfo.montants = {
      ...autresInfo.montants,
      honoraires_n: honorairesN,
      honoraires_n1: honorairesN1,
    }
    if (!autresInfo.contenu.toLowerCase().includes('divers conseils')) {
      autresInfo.contenu += ' Les honoraires comprennent divers conseils et prestations.'
    }
    applied.push('PTG-005')
  }

  if (applied.length < 2) {
    // Forcer PTG-001 si pas encore appliqué
    if (!applied.includes('PTG-001') && note3?.montants?.brut != null) {
      const bilanBrut = company.bilan.actif.immobilisations_corporelles.brut
      if (note3.montants.brut === bilanBrut) {
        const offset = randRange(rng, 10000, 35000)
        note3.montants.brut -= offset
        if (note3.montants.amort != null) {
          note3.montants.amort -= Math.round(offset * 0.4)
        }
        note3.montants.net = note3.montants.brut - (note3.montants.amort || 0)
      }
      applied.push('PTG-001')
    }

    // Forcer PTG-003 si toujours pas assez
    if (applied.length < 2 && !applied.includes('PTG-003')) {
      const offset = randRange(rng, 3000, 8000)
      company.bilan.passif.resultat_exercice.net += offset
      company.bilan.passif.resultat_exercice.brut = company.bilan.passif.resultat_exercice.net
      applied.push('PTG-003')
    }
  }

  console.log(
    `[Pointage] Décalages appliqués pour ${company.name} (mission ${missionId.slice(0, 8)}…): ` +
    `${applied.length} — ${applied.join(', ') || 'aucun'}`
  )

  return company
}

/**
 * Retourne le total actif du bilan (somme des nets).
 */
export function getTotalActif(company: PointageCompany): number {
  const actif = company.bilan.actif
  return Object.values(actif).reduce((sum, ligne) => sum + ligne.net, 0)
}

/**
 * Retourne le total passif du bilan (somme des nets).
 */
export function getTotalPassif(company: PointageCompany): number {
  const passif = company.bilan.passif
  return Object.values(passif).reduce((sum, ligne) => sum + ligne.net, 0)
}
