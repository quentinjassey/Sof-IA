========================================================================
  SOF'IA — JEUX DE DONNÉES FICTIFS POUR LE POC
  Société fictive : ACME Distribution SAS
  Exercice clos le 31/12/2025
========================================================================

AVERTISSEMENT :
Toutes les données contenues dans ce répertoire sont ENTIÈREMENT
FICTIVES. Les noms de sociétés, personnes, montants, numéros SIRET
et adresses sont inventés à des fins de démonstration uniquement.
Aucune donnée ne correspond à une entité réelle.

========================================================================
SCÉNARIO 1 : SONDAGE SUR LE CHIFFRE D'AFFAIRES (data/sondage_ca/)
========================================================================

Objectif : Pré-analyse documentaire du sondage sur le CA.
Le CAC a sélectionné un échantillon de ventes Q4 2025 et Sof'IA
rapproche les pièces justificatives, signale les absences ou
incohérences documentaires, et trace les contrôles réalisés.

Fichiers :
  - FEC_ACME_2025.txt : FEC au format DGFiP (tab-delimited)
    9 écritures de vente (journal VE), Q4 2025
    Clients : Durand, Martin, Lefèvre, Petit, Moreau, Bernard,
              Girard, Dubois, Roux

  - factures/ : 9 factures de vente
    FAC-2025-0847 à FAC-2025-0855

  - bons_livraison/ : 6 bons de livraison
    BL-2025-0612 à BL-2025-0617
    (Volontairement 6 BL pour 9 factures)

Signaux attendus (4 signaux) :
------------------------------------------------------------------------
| Signal  | Règle    | Priorité | Description                          |
|---------|----------|----------|--------------------------------------|
| S1      | SCA-001  | Élevée   | FAC-2025-0851 (Moreau Industries,    |
|         |          |          | 35 000 EUR HT) sans bon de           |
|         |          |          | livraison associé.                    |
|---------|----------|----------|--------------------------------------|
| S2      | SCA-001  | Élevée   | FAC-2025-0854 (Dubois Commerce,      |
|         |          |          | 18 000 EUR HT) sans bon de           |
|         |          |          | livraison associé. La facture         |
|         |          |          | mentionne une livraison prévue en     |
|         |          |          | janvier 2026.                         |
|---------|----------|----------|--------------------------------------|
| S3      | SCA-002  | Élevée   | Écart de montant entre               |
|         |          |          | FAC-2025-0852 (12 500 EUR HT)        |
|         |          |          | et BL-2025-0616 (13 250 EUR HT       |
|         |          |          | livré). Écart de 750 EUR (6,0%)      |
|         |          |          | dû à 10 unités Série C ajoutées      |
|         |          |          | en complément.                        |
|---------|----------|----------|--------------------------------------|
| S4      | SCA-005  | Élevée   | FAC-2025-0855 datée du 30/12/2025    |
|         |          |          | (vente comptabilisée en N).           |
|         |          |          | BL-2025-0617 daté du 03/01/2026      |
|         |          |          | (expédition en N+1). Signal de        |
|         |          |          | rattachement temporel.                |
------------------------------------------------------------------------


========================================================================
SCÉNARIO 2 : CÉSURE D'EXERCICE / CUT-OFF (data/cutoff/)
========================================================================

Objectif : Pré-analyse documentaire de la césure d'exercice.
Sof'IA identifie les opérations proches de la clôture (31/12/2025),
rapproche factures et bons de livraison/réception, et signale
les situations documentaires ambiguës en matière de rattachement
temporel.

Fichiers :
  - FEC_ACME_2025_cutoff.txt : FEC au format DGFiP (tab-delimited)
    Écritures des journaux VE (ventes) et HA (achats)
    Période : 18/12/2025 au 10/01/2026

  - factures_cutoff/ : 9 documents
    5 factures de vente : FAC-2025-1180 à FAC-2025-1184
    3 factures fournisseurs : FRN-2025-0487 à FRN-2025-0489
    1 avoir : AV-2026-0001

  - bons_reception/ : 5 bons de livraison/réception
    BL-2025-0780 à BL-2025-0782 (livraisons clients)
    BR-2025-0341, BR-2025-0345 (réceptions fournisseurs)

Signaux attendus (4 signaux) :
------------------------------------------------------------------------
| Signal  | Règle    | Priorité | Description                          |
|---------|----------|----------|--------------------------------------|
| S1      | CUT-001  | Élevée   | FAC-2025-1182 datée 29/12/2025       |
|         |          |          | (facture avant clôture),              |
|         |          |          | BL-2025-0782 daté 05/01/2026          |
|         |          |          | (livraison après clôture). Vente      |
|         |          |          | de 44 000 EUR HT comptabilisée        |
|         |          |          | en 2025, livraison en 2026.           |
|---------|----------|----------|--------------------------------------|
| S2      | CUT-002  | Élevée   | FRN-2025-0489 datée 02/01/2026        |
|         |          |          | (facture après clôture),              |
|         |          |          | BR-2025-0345 daté 28/12/2025          |
|         |          |          | (réception avant clôture). Achat      |
|         |          |          | de 7 800 EUR HT réceptionné en        |
|         |          |          | 2025, facturé en 2026.                |
|---------|----------|----------|--------------------------------------|
| S3      | CUT-004  | Élevée   | FAC-2025-1183 datée 30/12/2025        |
|         |          |          | (prestation de service Perrin,        |
|         |          |          | 16 000 EUR HT). Aucun justificatif   |
|         |          |          | de date de réalisation de la          |
|         |          |          | prestation. La facture mentionne      |
|         |          |          | des dates de prestation mais sans     |
|         |          |          | pièce probante (PV, feuille de        |
|         |          |          | temps, etc.).                         |
|---------|----------|----------|--------------------------------------|
| S4      | CUT-005  | Moyenne  | AV-2026-0001 daté 10/01/2026          |
|         |          |          | annulant partiellement la vente       |
|         |          |          | FAC-2025-1181 du 22/12/2025.          |
|         |          |          | Avoir de 6 000 EUR HT émis en         |
|         |          |          | N+1 sur une vente de N.               |
------------------------------------------------------------------------

Signal complémentaire possible :
  FAC-2025-1184 (31/12/2025, Tissot, 20 000 EUR HT) sans bon de
  livraison — la facture mentionne "livraison à planifier en
  janvier 2026" (CUT-001 ou CUT-004).


========================================================================
SCÉNARIO 3 : POINTAGE DES ÉTATS FINANCIERS (data/pointage/)
========================================================================

Objectif : Vérifier la cohérence et l'exhaustivité documentaire
des comptes annuels (bilan, compte de résultat, annexe).
Sof'IA contrôle la présence des informations attendues, vérifie
la cohérence factuelle entre les états financiers et l'annexe,
et signale les incohérences ou absences.

Fichiers :
  - bilan_ACME_2025.txt : Bilan au 31/12/2025
    Total actif = Total passif = 2 450 000,00 EUR
    Avec comparatif N-1 (2024)

  - compte_resultat_ACME_2025.txt : Compte de résultat 2025
    CA net : 4 050 000,00 EUR
    Résultat net : 128 000,00 EUR
    Avec comparatif N-1 (2024)

  - annexe_ACME_2025.txt : Annexe aux comptes annuels
    14 notes explicatives
    Avec écarts intentionnels par rapport au bilan/CR

Signaux attendus (3 signaux) :
------------------------------------------------------------------------
| Signal  | Règle    | Priorité | Description                          |
|---------|----------|----------|--------------------------------------|
| S1      | PTG-001  | Élevée   | Écart entre le poste                 |
|         |          |          | "Immobilisations corporelles"        |
|         |          |          | au bilan (valeur nette :             |
|         |          |          | 996 000 EUR) et le montant           |
|         |          |          | indiqué dans l'annexe Note 3         |
|         |          |          | (valeur nette : 981 000 EUR).        |
|         |          |          | Écart de 15 000 EUR.                 |
|         |          |          |                                      |
|         |          |          | Origine probable : le bilan          |
|         |          |          | présente un total brut de            |
|         |          |          | 1 530 000 EUR et des                 |
|         |          |          | amortissements de 534 000 EUR        |
|         |          |          | (net = 996 000 EUR). L'annexe        |
|         |          |          | indique un total brut de             |
|         |          |          | 1 515 000 EUR et des                 |
|         |          |          | amortissements de 519 000 EUR        |
|         |          |          | (net = 981 000 EUR, en excluant      |
|         |          |          | la cession).                         |
|---------|----------|----------|--------------------------------------|
| S2      | PTG-002  | Moyenne  | Information obligatoire absente      |
|         |          |          | de l'annexe : les engagements        |
|         |          |          | hors bilan ne sont pas               |
|         |          |          | mentionnés. L'annexe ne contient     |
|         |          |          | aucune note relative aux             |
|         |          |          | engagements hors bilan (cautions,    |
|         |          |          | garanties données, engagements       |
|         |          |          | de crédit-bail, etc.), ce qui        |
|         |          |          | est une information obligatoire      |
|         |          |          | au titre de l'article L. 123-13     |
|         |          |          | du Code de Commerce.                 |
|---------|----------|----------|--------------------------------------|
| S3      | PTG-005  | Moyenne  | Variation significative du poste     |
|         |          |          | "Autres charges externes"            |
|         |          |          | (hors postes détaillés) :            |
|         |          |          | 95 000 EUR en 2025 contre            |
|         |          |          | 52 000 EUR en 2024, soit une         |
|         |          |          | hausse de +82,7%.                    |
|         |          |          |                                      |
|         |          |          | L'annexe (Note 14) fournit un        |
|         |          |          | détail partiel (frais de             |
|         |          |          | recrutement 25 000 EUR, formation    |
|         |          |          | 18 000 EUR, cotisations 12 000 EUR)  |
|         |          |          | mais 40 000 EUR restent sous la      |
|         |          |          | mention "Divers" sans explication    |
|         |          |          | suffisante de cette variation        |
|         |          |          | significative.                       |
------------------------------------------------------------------------


========================================================================
NOTES GÉNÉRALES
========================================================================

1. FORMAT FEC
   Les fichiers FEC sont au format DGFiP : colonnes séparées par
   tabulation, encodage UTF-8. Les montants utilisent la virgule
   comme séparateur décimal (format français).

2. DOCUMENTS JUSTIFICATIFS
   Les fichiers .txt simulent le contenu textuel de documents PDF.
   En production, ces documents seraient des fichiers PDF réels.
   Le format texte permet une analyse directe sans OCR.

3. COHÉRENCE DES DONNÉES
   Les montants dans le FEC correspondent aux montants des factures
   (sauf écarts intentionnels pour les signaux). Les numéros de
   pièces (PieceRef) dans le FEC correspondent aux numéros des
   factures et bons de livraison.

4. SOCIÉTÉ FICTIVE
   ACME Distribution SAS
   12, rue de l'Industrie — 69003 LYON
   SIRET : 412 345 678 00012
   Capital social : 250 000 EUR
   Président : M. Jean-Marc Rousseau
   Activité : Distribution de produits industriels et commerciaux
   Effectif moyen : 22 salariés

5. UTILISATION
   Ces données sont destinées exclusivement au POC Sof'IA dans
   le cadre du concours HackAudit 2026. Elles ne doivent pas
   être utilisées à d'autres fins.

========================================================================
