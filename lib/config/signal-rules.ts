// lib/config/signal-rules.ts
// Catalogue complet des regles de signalement documentaire.
// Source: ARCHITECTURE_POC_SOFIA_ANNEXES.md - Section D
//
// VOCABULAIRE OBLIGATOIRE :
// - "signal documentaire" (jamais "anomalie")
// - "constat factuel" (jamais "conclusion")
// - "necessite l'attention du CAC" (jamais "significatif")
//
// Chaque signal est un constat documentaire objectif, jamais une qualification d'audit.

import type { ScenarioType } from './expected-documents';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

/** Types de signaux documentaires (correspondant a la colonne `type` de la table `signals`) */
export type SignalType =
  | 'absence_piece'
  | 'incoherence_date'
  | 'incoherence_montant'
  | 'rupture_chaine'
  | 'rattachement_temporel'
  | 'incompletude';

/** Niveaux de priorite d'un signal */
export type SignalPriority = 'high' | 'medium' | 'low';

/** Categories de regles */
export type RuleCategory = 'DOC' | 'SCA' | 'CUT' | 'PTG';

export interface SignalRule {
  /** Identifiant unique de la regle (ex: SCA-001, CUT-001, PTG-001, DOC-001) */
  id: string;
  /** Categorie de la regle */
  category: RuleCategory;
  /** Type de signal documentaire */
  type: SignalType;
  /** Libelle court en francais */
  label: string;
  /** Description detaillee de ce que la regle detecte (en francais, vocabulaire professionnel) */
  description: string;
  /** Scenarios dans lesquels cette regle s'applique */
  scenario: ScenarioType[];
  /** Priorite par defaut du signal */
  priority: SignalPriority;
  /** Reference a une norme d'exercice professionnel (NEP), si applicable */
  nep_reference?: string;
  /** Description en francais de ce qui est verifie par la regle */
  checks: string;
}

// -----------------------------------------------------------------------------
// Catalogue de regles
// -----------------------------------------------------------------------------

export const signalRules: SignalRule[] = [
  // ===========================================================================
  // REGLES COMMUNES (DOC-*) — Applicables a tous les scenarios
  // ===========================================================================
  {
    id: 'DOC-001',
    category: 'DOC',
    type: 'absence_piece',
    label: 'Document attendu absent',
    description:
      'Piece justificative referencee dans le FEC ou attendue dans le cadre du scenario mais non fournie dans les documents de la mission.',
    scenario: ['sondage_ca', 'cutoff', 'pointage'],
    priority: 'high',
    nep_reference: 'NEP 500',
    checks:
      'Verification de la presence de chaque document attendu par le scenario. Rapprochement entre les references presentes dans le FEC (PieceRef) et les documents fournis.',
  },
  {
    id: 'DOC-002',
    category: 'DOC',
    type: 'incompletude',
    label: 'Document incomplet',
    description:
      'Document present dans la mission mais incomplet : pages manquantes, donnees partiellement illisibles ou informations essentielles absentes.',
    scenario: ['sondage_ca', 'cutoff', 'pointage'],
    priority: 'medium',
    checks:
      'Analyse de la structure du document : nombre de pages, presence des mentions obligatoires (numero, date, montant), lisibilite du contenu.',
  },
  {
    id: 'DOC-003',
    category: 'DOC',
    type: 'rupture_chaine',
    label: 'Format de document non exploitable',
    description:
      'Document fourni dans un format non exploitable ou dont le contenu n\'a pas pu etre extrait de maniere fiable (scan de mauvaise qualite, PDF image sans OCR, fichier endommage).',
    scenario: ['sondage_ca', 'cutoff', 'pointage'],
    priority: 'low',
    checks:
      'Tentative d\'extraction du texte du document. Verification que le contenu extrait est coherent et exploitable pour le rapprochement.',
  },

  // ===========================================================================
  // REGLES SONDAGE CA (SCA-*) — Scenario : sondage_ca
  // ===========================================================================
  {
    id: 'SCA-001',
    category: 'SCA',
    type: 'absence_piece',
    label: 'Bon de livraison absent pour une vente',
    description:
      'Facture de vente presente dans l\'echantillon sans bon de livraison associe. L\'absence de preuve de livraison ne permet pas de confirmer la realite de l\'operation.',
    scenario: ['sondage_ca'],
    priority: 'high',
    nep_reference: 'NEP 500',
    checks:
      'Pour chaque facture de vente, recherche d\'un bon de livraison dont la reference, le client et la description correspondent. Si aucun BL n\'est trouve, un signal est genere.',
  },
  {
    id: 'SCA-002',
    category: 'SCA',
    type: 'incoherence_montant',
    label: 'Ecart de montant entre facture et ecriture FEC',
    description:
      'Le montant figurant sur la facture de vente ne correspond pas au montant enregistre dans l\'ecriture comptable du FEC. L\'ecart depasse le seuil de tolerance (1 %).',
    scenario: ['sondage_ca'],
    priority: 'high',
    nep_reference: 'NEP 500',
    checks:
      'Comparaison du montant HT de la facture avec le montant (debit ou credit) de l\'ecriture FEC correspondante. Calcul de l\'ecart en pourcentage. Signal si ecart > 1 %.',
  },
  {
    id: 'SCA-003',
    category: 'SCA',
    type: 'incoherence_date',
    label: 'Ecart de date entre facture et bon de livraison',
    description:
      'Ecart superieur a 5 jours entre la date de la facture de vente et la date du bon de livraison associe. Cet ecart peut indiquer un decalage entre la facturation et la realite de la livraison.',
    scenario: ['sondage_ca'],
    priority: 'medium',
    checks:
      'Comparaison de la date de la facture et de la date du bon de livraison associe. Signal si l\'ecart absolu depasse 5 jours ouvrables.',
  },
  {
    id: 'SCA-004',
    category: 'SCA',
    type: 'rupture_chaine',
    label: 'Reference de piece FEC introuvable',
    description:
      'L\'ecriture du FEC contient une reference de piece (PieceRef) qui ne correspond a aucun document fourni dans la mission. La chaine documentaire est incomplete.',
    scenario: ['sondage_ca'],
    priority: 'high',
    nep_reference: 'NEP 500',
    checks:
      'Pour chaque ecriture du FEC dans le perimetre du sondage, verification que la PieceRef est retrouvee parmi les documents fournis (factures, BL, contrats).',
  },
  {
    id: 'SCA-005',
    category: 'SCA',
    type: 'rattachement_temporel',
    label: 'Rattachement temporel a verifier (vente en N, livraison en N+1)',
    description:
      'Vente comptabilisee sur l\'exercice N alors que le bon de livraison ou la preuve de prestation est date de l\'exercice N+1. Le rattachement a l\'exercice necessite l\'attention du commissaire aux comptes.',
    scenario: ['sondage_ca'],
    priority: 'high',
    nep_reference: 'NEP 500, paragraphe A14',
    checks:
      'Comparaison de la date de l\'ecriture comptable (exercice N) avec la date du bon de livraison. Signal si la livraison est datee apres la cloture de l\'exercice (31/12/N).',
  },

  // ===========================================================================
  // REGLES CUT-OFF (CUT-*) — Scenario : cutoff
  // ===========================================================================
  {
    id: 'CUT-001',
    category: 'CUT',
    type: 'rattachement_temporel',
    label: 'Facture avant cloture, livraison apres cloture',
    description:
      'Facture datee avant la date de cloture mais bon de livraison date apres la cloture. Le rattachement du produit ou de la charge a l\'exercice necessite une verification par le commissaire aux comptes.',
    scenario: ['cutoff'],
    priority: 'high',
    nep_reference: 'NEP 500, paragraphe A14',
    checks:
      'Identification des factures dont la date est anterieure ou egale au 31/12/N et dont le BL associe est date du 01/01/N+1 ou apres. L\'ecart temporel est calcule en jours.',
  },
  {
    id: 'CUT-002',
    category: 'CUT',
    type: 'rattachement_temporel',
    label: 'Facture apres cloture, livraison avant cloture',
    description:
      'Facture datee apres la date de cloture mais bon de livraison ou reception date avant la cloture. Le produit ou la charge pourrait devoir etre rattache a l\'exercice N.',
    scenario: ['cutoff'],
    priority: 'high',
    nep_reference: 'NEP 500, paragraphe A14',
    checks:
      'Identification des factures dont la date est posterieure au 31/12/N et dont le BL ou bon de reception associe est date du 31/12/N ou avant.',
  },
  {
    id: 'CUT-003',
    category: 'CUT',
    type: 'incoherence_date',
    label: 'Ecart de dates en periode de cloture',
    description:
      'Ecart superieur a la fenetre de cut-off parametree entre la date de la facture et la date du bon de livraison, pour une operation situee autour de la date de cloture.',
    scenario: ['cutoff'],
    priority: 'medium',
    checks:
      'Comparaison des dates facture et BL pour les operations dans la fenetre de cut-off (par defaut : 10 jours avant et apres le 31/12). Signal si l\'ecart depasse la fenetre parametree.',
  },
  {
    id: 'CUT-004',
    category: 'CUT',
    type: 'absence_piece',
    label: 'Operation sans justificatif de date de livraison',
    description:
      'Operation comptabilisee dans la fenetre de cut-off sans document permettant d\'etablir la date effective de livraison ou de reception. L\'absence de ce justificatif ne permet pas de verifier le rattachement temporel.',
    scenario: ['cutoff'],
    priority: 'high',
    checks:
      'Pour chaque ecriture dans la fenetre de cut-off, verification de l\'existence d\'un bon de livraison ou de reception avec une date exploitable.',
  },
  {
    id: 'CUT-005',
    category: 'CUT',
    type: 'incoherence_montant',
    label: 'Avoir en N+1 annulant une vente de N',
    description:
      'Facture d\'avoir emise en debut d\'exercice N+1 annulant totalement ou partiellement une vente enregistree en fin d\'exercice N. Cette situation necessite l\'attention du commissaire aux comptes.',
    scenario: ['cutoff'],
    priority: 'medium',
    checks:
      'Recherche de factures d\'avoir datees de N+1 dont la reference ou le libelle renvoie a une facture de vente de N. Comparaison des montants.',
  },

  // ===========================================================================
  // REGLES POINTAGE (PTG-*) — Scenario : pointage
  // ===========================================================================
  {
    id: 'PTG-001',
    category: 'PTG',
    type: 'incoherence_montant',
    label: 'Ecart entre le bilan et l\'annexe',
    description:
      'Le montant d\'un poste du bilan ne correspond pas au montant indique dans la note correspondante de l\'annexe. Cet ecart factuel necessite une verification.',
    scenario: ['pointage'],
    priority: 'high',
    nep_reference: 'NEP 500',
    checks:
      'Rapprochement des montants figurant au bilan (actif et passif) avec les montants correspondants dans les notes de l\'annexe. Signal si un ecart est constate.',
  },
  {
    id: 'PTG-002',
    category: 'PTG',
    type: 'incompletude',
    label: 'Information obligatoire absente de l\'annexe',
    description:
      'Information reglementairement obligatoire non retrouvee dans l\'annexe aux comptes annuels (par exemple : engagements hors bilan, methodes comptables, effectifs).',
    scenario: ['pointage'],
    priority: 'high',
    nep_reference: 'NEP 500',
    checks:
      'Recherche dans l\'annexe des mentions obligatoires prevues par le PCG et le Code de commerce : methodes comptables, tableau des immobilisations, engagements hors bilan, effectifs, remunerations des dirigeants (selon seuils).',
  },
  {
    id: 'PTG-003',
    category: 'PTG',
    type: 'incoherence_montant',
    label: 'Total du compte de resultat incoherent avec le bilan',
    description:
      'Le resultat net figurant au compte de resultat ne correspond pas au resultat de l\'exercice au bilan. Cet ecart factuel necessite une verification.',
    scenario: ['pointage'],
    priority: 'high',
    checks:
      'Comparaison du resultat net au compte de resultat (produits - charges) avec le resultat de l\'exercice au passif du bilan. Signal si les montants different.',
  },
  {
    id: 'PTG-004',
    category: 'PTG',
    type: 'incompletude',
    label: 'Poste sans note explicative dans l\'annexe',
    description:
      'Un poste du bilan ou du compte de resultat depassant un seuil ne dispose d\'aucune note explicative dans l\'annexe. L\'absence d\'information documentaire est constatee.',
    scenario: ['pointage'],
    priority: 'medium',
    checks:
      'Identification des postes dont le montant depasse un seuil (configurable). Verification de l\'existence d\'une note correspondante dans l\'annexe.',
  },
  {
    id: 'PTG-005',
    category: 'PTG',
    type: 'rupture_chaine',
    label: 'Variation notable entre N et N-1 sans explication',
    description:
      'Un poste du bilan ou du compte de resultat presente une variation notable entre l\'exercice N et l\'exercice N-1 sans note explicative dans l\'annexe. Cette absence documentaire est constatee.',
    scenario: ['pointage'],
    priority: 'medium',
    checks:
      'Calcul de la variation (en pourcentage et en valeur absolue) de chaque poste entre N et N-1. Recherche d\'une note explicative dans l\'annexe si la variation depasse le seuil parametre.',
  },
];

// -----------------------------------------------------------------------------
// Fonctions utilitaires
// -----------------------------------------------------------------------------

/**
 * Retourne toutes les regles applicables a un scenario donne.
 */
export function getRulesForScenario(scenario: ScenarioType): SignalRule[] {
  return signalRules.filter((rule) => rule.scenario.includes(scenario));
}

/**
 * Retourne une regle par son identifiant (ex: 'CUT-001').
 * Retourne undefined si l'identifiant n'est pas trouve.
 */
export function getRuleById(ruleId: string): SignalRule | undefined {
  return signalRules.find((rule) => rule.id === ruleId);
}

/**
 * Retourne toutes les regles d'un type de signal donne.
 */
export function getRulesByType(signalType: SignalType): SignalRule[] {
  return signalRules.filter((rule) => rule.type === signalType);
}

/**
 * Retourne toutes les regles d'une categorie donnee (DOC, SCA, CUT, PTG).
 */
export function getRulesByCategory(category: RuleCategory): SignalRule[] {
  return signalRules.filter((rule) => rule.category === category);
}

/**
 * Retourne toutes les regles d'une priorite donnee.
 */
export function getRulesByPriority(priority: SignalPriority): SignalRule[] {
  return signalRules.filter((rule) => rule.priority === priority);
}

/**
 * Retourne le nombre de regles applicables par niveau de priorite pour un scenario.
 */
export function getRuleCountByPriority(
  scenario: ScenarioType
): Record<SignalPriority, number> {
  const rules = getRulesForScenario(scenario);
  return {
    high: rules.filter((r) => r.priority === 'high').length,
    medium: rules.filter((r) => r.priority === 'medium').length,
    low: rules.filter((r) => r.priority === 'low').length,
  };
}

// -----------------------------------------------------------------------------
// Labels francais pour les types de signaux
// -----------------------------------------------------------------------------

/** Labels francais pour les types de signaux (affichage UI) */
export const signalTypeLabels: Record<SignalType, string> = {
  absence_piece: 'Piece justificative manquante',
  incoherence_date: 'Incoherence de dates',
  incoherence_montant: 'Ecart de montant',
  rupture_chaine: 'Rupture de la chaine documentaire',
  rattachement_temporel: 'Doute sur le rattachement temporel',
  incompletude: 'Information incomplete',
};

/** Labels francais pour les niveaux de priorite (affichage UI) */
export const priorityLabels: Record<SignalPriority, string> = {
  high: 'Eleve',
  medium: 'Moyen',
  low: 'Faible',
};

/** Couleurs CSS suggerees pour les niveaux de priorite (classes Tailwind) */
export const priorityColors: Record<SignalPriority, { bg: string; text: string; border: string }> = {
  high: {
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-200',
  },
  medium: {
    bg: 'bg-yellow-50',
    text: 'text-yellow-700',
    border: 'border-yellow-200',
  },
  low: {
    bg: 'bg-gray-50',
    text: 'text-gray-600',
    border: 'border-gray-200',
  },
};

/** Labels francais pour les decisions humaines (affichage UI) */
export const humanDecisionLabels: Record<string, string> = {
  pending: 'En attente de decision',
  validated: 'Valide par le CAC',
  rejected: 'Rejete par le CAC',
  to_investigate: 'A approfondir',
};

/** Couleurs CSS suggerees pour les decisions humaines (classes Tailwind) */
export const humanDecisionColors: Record<string, { bg: string; text: string }> = {
  pending: { bg: 'bg-gray-100', text: 'text-gray-600' },
  validated: { bg: 'bg-green-50', text: 'text-green-700' },
  rejected: { bg: 'bg-red-50', text: 'text-red-700' },
  to_investigate: { bg: 'bg-amber-50', text: 'text-amber-700' },
};
