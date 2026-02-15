// lib/config/expected-documents.ts
// Mapping des documents attendus par scenario de mission.
// Source: ARCHITECTURE_POC_SOFIA_ANNEXES.md - Section C

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type ScenarioType = 'sondage_ca' | 'cutoff' | 'pointage';

export type DocumentType =
  | 'fec'
  | 'facture_vente'
  | 'facture_achat'
  | 'bon_livraison'
  | 'contrat'
  | 'annexe'
  | 'bilan'
  | 'compte_resultat'
  | 'autre';

export interface ExpectedDocument {
  /** Identifiant technique du type de document (correspondant a la colonne `type` de la table `documents`) */
  type: DocumentType;
  /** Libelle affiche en francais (vocabulaire professionnel CAC) */
  label: string;
  /** Description du document et de son role dans le scenario */
  description: string;
  /** Indique si le document est requis pour lancer la pre-analyse */
  required: boolean;
  /** Formats de fichier acceptes */
  format: string[];
}

// -----------------------------------------------------------------------------
// Mapping par scenario
// -----------------------------------------------------------------------------

export const expectedDocuments: Record<ScenarioType, ExpectedDocument[]> = {
  // -------------------------------------------------------------------------
  // Scenario 1 : Sondage sur le chiffre d'affaires
  // -------------------------------------------------------------------------
  sondage_ca: [
    {
      type: 'fec',
      label: 'Fichier des Ecritures Comptables (FEC)',
      description:
        'Export du FEC au format DGFiP (fichier tabulaire). Contient l\'ensemble des ecritures du journal de ventes pour l\'exercice audite.',
      required: true,
      format: ['.txt', '.csv'],
    },
    {
      type: 'facture_vente',
      label: 'Factures de vente (echantillon)',
      description:
        'Factures de vente correspondant aux ecritures selectionnees par le commissaire aux comptes pour le sondage. Chaque facture doit comporter : numero, date, client, description, montant HT, TVA et TTC.',
      required: true,
      format: ['.pdf'],
    },
    {
      type: 'bon_livraison',
      label: 'Bons de livraison',
      description:
        'Bons de livraison ou preuves d\'expedition associes aux factures de vente. Permettent de verifier la realite de la livraison et le rattachement temporel de l\'operation.',
      required: true,
      format: ['.pdf'],
    },
    {
      type: 'contrat',
      label: 'Contrats clients',
      description:
        'Contrats-cadres ou bons de commande, si disponibles. Permettent de verifier les conditions de vente et la coherence avec les factures.',
      required: false,
      format: ['.pdf'],
    },
    {
      type: 'annexe',
      label: 'Annexe aux comptes annuels',
      description:
        'Annexe aux comptes annuels, si disponible. Permet la verification de la coherence du chiffre d\'affaires declare.',
      required: false,
      format: ['.pdf'],
    },
  ],

  // -------------------------------------------------------------------------
  // Scenario 2 : Cesure d'exercice / Cut-off
  // -------------------------------------------------------------------------
  cutoff: [
    {
      type: 'fec',
      label: 'Fichier des Ecritures Comptables (FEC)',
      description:
        'Export du FEC au format DGFiP. Doit couvrir les ecritures de ventes et d\'achats autour de la date de cloture (fenetre de cut-off).',
      required: true,
      format: ['.txt', '.csv'],
    },
    {
      type: 'facture_vente',
      label: 'Factures de vente (periode de cloture)',
      description:
        'Factures de vente emises autour de la date de cloture (31/12). Permettent d\'analyser le rattachement temporel des produits.',
      required: true,
      format: ['.pdf'],
    },
    {
      type: 'facture_achat',
      label: 'Factures fournisseurs (periode de cloture)',
      description:
        'Factures fournisseurs recues autour de la date de cloture. Permettent d\'analyser le rattachement temporel des charges.',
      required: true,
      format: ['.pdf'],
    },
    {
      type: 'bon_livraison',
      label: 'Bons de livraison / reception',
      description:
        'Bons de livraison (ventes) et bons de reception (achats) pour les operations de la periode de cloture. Permettent d\'etablir la date effective de transfert des biens.',
      required: true,
      format: ['.pdf'],
    },
    {
      type: 'contrat',
      label: 'Contrats (prestations continues)',
      description:
        'Contrats avec des prestations a cheval sur deux exercices, si disponibles. Permettent de verifier les modalites de rattachement temporel.',
      required: false,
      format: ['.pdf'],
    },
  ],

  // -------------------------------------------------------------------------
  // Scenario 3 : Pointage des etats financiers
  // -------------------------------------------------------------------------
  pointage: [
    {
      type: 'bilan',
      label: 'Bilan',
      description:
        'Bilan de l\'exercice audite, presentant l\'actif et le passif. Document central pour le pointage de coherence avec l\'annexe.',
      required: true,
      format: ['.pdf'],
    },
    {
      type: 'compte_resultat',
      label: 'Compte de resultat',
      description:
        'Compte de resultat de l\'exercice audite. Permet de verifier la coherence des totaux avec le bilan et les notes de l\'annexe.',
      required: true,
      format: ['.pdf'],
    },
    {
      type: 'annexe',
      label: 'Annexe aux comptes annuels',
      description:
        'Annexe complete aux comptes annuels. Contient les notes explicatives, les tableaux de variation, les engagements hors bilan et les informations obligatoires.',
      required: true,
      format: ['.pdf'],
    },
    {
      type: 'fec',
      label: 'Fichier des Ecritures Comptables (FEC)',
      description:
        'Export du FEC au format DGFiP, si disponible. Permet des verifications complementaires de coherence entre les ecritures et les etats financiers.',
      required: false,
      format: ['.txt', '.csv'],
    },
  ],
};

// -----------------------------------------------------------------------------
// Fonctions utilitaires
// -----------------------------------------------------------------------------

/**
 * Retourne la liste des documents attendus pour un scenario donne.
 */
export function getExpectedDocuments(scenario: ScenarioType): ExpectedDocument[] {
  return expectedDocuments[scenario] ?? [];
}

/**
 * Retourne uniquement les documents requis (obligatoires) pour un scenario donne.
 */
export function getRequiredDocuments(scenario: ScenarioType): ExpectedDocument[] {
  return getExpectedDocuments(scenario).filter((doc) => doc.required);
}

/**
 * Retourne uniquement les documents optionnels pour un scenario donne.
 */
export function getOptionalDocuments(scenario: ScenarioType): ExpectedDocument[] {
  return getExpectedDocuments(scenario).filter((doc) => !doc.required);
}

/**
 * Verifie si un type de document est attendu (requis ou optionnel) pour un scenario.
 */
export function isDocumentExpected(scenario: ScenarioType, docType: DocumentType): boolean {
  return getExpectedDocuments(scenario).some((doc) => doc.type === docType);
}

/**
 * Verifie si un type de document est requis (obligatoire) pour un scenario.
 */
export function isDocumentRequired(scenario: ScenarioType, docType: DocumentType): boolean {
  return getRequiredDocuments(scenario).some((doc) => doc.type === docType);
}

/**
 * Retourne le libelle francais d'un type de document pour un scenario donne.
 * Si le type n'est pas trouve dans le scenario, retourne le type brut.
 */
export function getDocumentLabel(scenario: ScenarioType, docType: DocumentType): string {
  const doc = getExpectedDocuments(scenario).find((d) => d.type === docType);
  return doc?.label ?? docType;
}

/**
 * Retourne les formats de fichier acceptes pour un type de document dans un scenario.
 */
export function getAcceptedFormats(scenario: ScenarioType, docType: DocumentType): string[] {
  const doc = getExpectedDocuments(scenario).find((d) => d.type === docType);
  return doc?.format ?? [];
}

/**
 * Labels generiques pour les types de documents (utilise quand le contexte scenario n'est pas disponible).
 */
export const documentTypeLabels: Record<DocumentType, string> = {
  fec: 'Fichier des Ecritures Comptables (FEC)',
  facture_vente: 'Facture de vente',
  facture_achat: 'Facture fournisseur',
  bon_livraison: 'Bon de livraison / reception',
  contrat: 'Contrat',
  annexe: 'Annexe aux comptes annuels',
  bilan: 'Bilan',
  compte_resultat: 'Compte de resultat',
  autre: 'Autre document',
};
