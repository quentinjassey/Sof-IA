# SOF'IA - POC HackAudit — Contexte projet complet

> Récupéré depuis le workspace Notion du projet le 11 février 2026.

---

## 1. Page principale — SOF'IA - POC HackAudit

### Objectif
Livrer un POC webapp simple qui illustre Sof'IA de manière concrète et crédible pour un jury de commissaires aux comptes. Le POC doit démontrer des livrables non génériques et l'applicabilité opérationnelle, sans jamais franchir la ligne du jugement professionnel.

### 1. Règle de base — Positionnement
**Cas d'usage unique** : Sof'IA automatise la pré-analyse documentaire des pièces comptables, journaux et pièces justificatives afin d'identifier les zones nécessitant une attention particulière et d'orienter le jugement du commissaire aux comptes, sans jamais s'y substituer.

⚠️ Toute fonctionnalité, écran ou wording doit renforcer cette phrase. Si ce n'est pas le cas, c'est hors périmètre.

### 2. Ce que le jury attend
- Un cas d'usage unique clairement formulé
- Illustré par trois exemples concrets et distincts
- Avec pour chaque exemple un contexte d'utilisation, des objectifs et une valeur ajoutée claire
- Et des livrables précis, non génériques

### 3. Les 3 exemples concrets
- **Exemple 1** : Pré-analyse documentaire du sondage sur le chiffre d'affaires
- **Exemple 2** : Pré-analyse documentaire de la césure d'exercice / cut-off
- **Exemple 3** : Cohérence documentaire des états financiers et de l'annexe (pointage)

### 4. Ce que le POC doit prouver
Le POC doit permettre de répondre oui à ces questions en moins de 3 minutes :
- Est-ce que je comprends ce que fait Sof'IA ?
- Est-ce que je vois ce que le CAC récupère en sortie ?
- Est-ce que je vois où l'humain valide et reste maître ?

### 5. Périmètre

**Sof'IA fait :**
- Pré-analyse documentaire
- Rapprochement pièces, journaux, justificatifs
- Signalements factuels et traçables
- Explicabilité : source, page, règle déclenchée
- Validation humaine visible
- Génération de livrables de dossier

**Sof'IA ne fait pas :**
- Sélection d'échantillon à la place du CAC
- Extrapolation statistique
- Conclusion d'audit
- Qualification significatif ou non significatif
- Recommandations d'opinion
- Détection de fraude présentée comme certaine
- Correction comptable automatisée

### 6. Livrables attendus dans la webapp / POC
Pour chaque exemple, la webapp/POC doit afficher et permettre de télécharger :
- Check-list de complétude documentaire
- Tableau des signaux documentaires avec source page et règle déclenchée
- Synthèse de pré-analyse intégrable au dossier
- Journal de traçabilité incluant validation humaine

### 7. Dates et jalons
- Dépôt POC au plus tard **lundi 02 mars 2026 à minuit**
- Pitch finale **lundi 09 mars 2026** durée environ 4 minutes
- Si on projette quelque chose pour le pitch, l'envoyer par email au plus tard **vendredi 06 mars**
- Aucune démonstration POC le jour J, le POC doit être autoportant

---

## 2. C'est quoi le sondage sur le chiffre d'affaires ?

Le sondage sur le chiffre d'affaires est une procédure d'audit qui consiste à tester un échantillon de ventes afin de vérifier que le chiffre d'affaires publié est réel, complet et correctement rattaché à la bonne période.

### À quoi ça sert concrètement ?
Le chiffre d'affaires est un poste clé des comptes, très exposé aux risques d'erreurs ou de manipulation, directement lié à la performance affichée de l'entreprise.

Le sondage permet au CAC de s'assurer que :
- Les ventes existent vraiment
- Elles correspondent à des prestations ou livraisons réelles
- Elles sont comptabilisées au bon montant
- Et surtout au bon exercice

### Comment ça se passe en pratique ?
Le CAC fait un sondage : sélection d'un échantillon de factures de ventes, souvent ciblé sur les montants élevés, les périodes sensibles (fin d'exercice), des clients ou flux à risque.

Pour chaque vente testée, il rapproche : la facture, le bon de livraison ou la preuve de service rendu, parfois le contrat, et l'encaissement.

### Le point critique : le cut-off
Une grande partie du sondage CA vise à vérifier le rattachement temporel.

Exemples de risques classiques :
- Vente comptabilisée en décembre alors que la livraison est en janvier
- Facture émise avant que la prestation soit réellement réalisée
- Pression de fin d'année pour "faire le chiffre"

### En résumé
Le sondage sur le chiffre d'affaires, c'est : un échantillonnage de ventes, contrôlé par le CAC, pour vérifier que le CA est réel, bien justifié et bien daté, avec un focus très fort sur les ventes de fin d'exercice.

---

## 3. C'est quoi la césure d'exercice / cut-off ?

### L'idée centrale
La césure d'exercice, c'est le fait de s'assurer que chaque opération est enregistrée dans le bon exercice comptable. Ni trop tôt, ni trop tard.

Le CAC vérifie que les produits et les charges sont rattachés à la période où ils ont réellement été réalisés, pas à celle qui arrange.

### Pourquoi c'est critique
En fin d'exercice, il y a souvent :
- Des factures émises ou reçues en retard
- Des livraisons ou prestations autour du 31/12
- Des enjeux de résultat (pression, bonus, covenants, image financière)

Risque élevé de : gonfler le chiffre d'affaires, décaler des charges, lisser artificiellement le résultat.

### Concrètement, ce que fait le CAC
Le CAC se concentre sur une zone temporelle sensible (quelques jours avant et après la clôture). Il analyse les opérations proches de la date de clôture et regarde : la date de la facture, la date de livraison ou de prestation, la réalité économique de l'opération, les documents associés.

### Ce que le CAC cherche à prouver
Pour chaque opération testée :
- Quand l'opération a réellement eu lieu
- Quelle est la preuve (BL, PV de réception, contrat, feuille de temps, logs…)
- Si l'écriture comptable reflète bien cette réalité

Le risque est documentaire avant d'être comptable.

---

## 4. C'est quoi le pointage ?

Le pointage, c'est vérifier que ce qui est écrit en comptabilité est bien réel, justifié et exact.

Le CAC prend une écriture comptable (ou un échantillon) et la "pointe" avec des pièces justificatives.

### Exemples classiques
- Facture de vente → pointée avec le BL, le contrat, la date de prestation
- Facture fournisseur → pointée avec la commande, la réception, le paiement
- Charge → pointée avec la facture, la réalité de la dépense, la bonne période
- Immobilisation → pointée avec la facture, la mise en service, l'amortissement

### Ce que le CAC cherche en pointage
- Est-ce que l'opération existe vraiment ?
- Est-elle correctement enregistrée ?
- Est-elle dans la bonne période (cut-off) ?
- Est-elle justifiée par des documents fiables ?
- Est-elle cohérente avec le reste (contrats, flux, activité) ?

### Pointage ≠ jugement comptable
Le pointage ne décide pas si l'écriture est "bonne" au sens comptable final. Il vérifie les faits et les preuves. Le jugement vient ensuite, dans l'analyse du CAC.

---

## 5. WTF is a commissaire aux comptes ?

### 1. Le rôle du CAC
Le commissaire aux comptes est un tiers indépendant dont la mission est de certifier la régularité, la sincérité et l'image fidèle des comptes annuels. Il engage sa responsabilité personnelle et professionnelle sur son opinion.

Son rôle n'est pas de produire des comptes ni de détecter automatiquement des fraudes, mais de formuler une opinion fondée sur des diligences documentées, traçables et conformes aux normes professionnelles.

### 2. Réalité opérationnelle du métier en 2026
Un CAC doit :
- Collecter et analyser un volume croissant de documents comptables
- Travailler sur des formats hétérogènes et parfois peu structurés
- Respecter des délais contraints de clôture des dossiers
- Produire une documentation robuste et défendable en inspection

### 3. Le problème métier que Sof'IA adresse
Une part importante du temps des équipes d'audit est consacrée à :
- La recherche de pièces justificatives
- Le rapprochement manuel documents/écritures
- La vérification de cohérence documentaire
- La constitution du dossier de travail

Ces tâches sont nécessaires mais répétitives et exposées au risque d'omission.

### 4. Le positionnement exact de Sof'IA
Sof'IA est un outil d'assistance à la pré-analyse documentaire.
- Il intervient en amont des décisions, avant toute conclusion, pour orienter l'attention du CAC.
- Sof'IA ne se substitue jamais au jugement professionnel, à la sélection méthodologique, à la conclusion d'audit.

### 5. Cadre réglementaire et déontologique
- Supervision humaine systématique
- Explicabilité des signalements
- Traçabilité des actions
- Confidentialité et protection des données
- Conformité RGPD et IA Act
- Respect des normes d'exercice professionnel, notamment NEP 230

⚠️ Toute fonctionnalité qui affaiblit ces principes est hors périmètre.

### 6. Ce que le jury doit ressentir
Un CAC doit pouvoir se dire : cet outil comprend mon métier, il m'aide sans m'exposer, il renforce la qualité de mon dossier, il respecte mon rôle et ma responsabilité.

### 7. Conséquence pour le POC
Tout développement doit répondre à la question : en quoi cette fonctionnalité aide-t-elle le CAC à mieux documenter ses travaux, sans jamais décider à sa place ? Si la réponse n'est pas évidente, la fonctionnalité ne doit pas être développée.

---

## 6. Cas d'usage et scénarios

### Cas d'usage unique
Pré-analyse documentaire des pièces comptables (comptes annuels et annexe), journaux et pièces justificatives — y compris exports structurés lorsqu'ils sont disponibles — afin d'identifier les zones nécessitant une attention particulière et d'orienter le jugement du CAC, sans jamais s'y substituer.

### Exemple 1 — Préparation documentaire du sondage sur le CA
- **Moment** : Phase de planification et de travaux sur le cycle ventes
- **Objectif** : Préparer le dossier documentaire des écritures sélectionnées par le CAC
- **Sof'IA fait** : rattache les pièces justificatives aux écritures sélectionnées, signale les absences ou incohérences documentaires, trace les contrôles réalisés
- **Sof'IA ne fait pas** : ne sélectionne pas l'échantillon, n'extrapole pas, ne conclut pas

### Exemple 2 — Pré-analyse documentaire de la césure d'exercice (cut-off)
- **Moment** : Travaux de clôture autour de la date d'arrêté des comptes
- **Objectif** : Identifier les opérations nécessitant une attention particulière en matière de rattachement temporel
- **Sof'IA fait** : identifie les opérations proches de la clôture, rapproche factures/livraisons/prestations, signale les situations documentaires ambiguës
- **Sof'IA ne fait pas** : ne qualifie pas l'erreur comptable, ne requalifie pas les écritures

### Exemple 3 — Cohérence documentaire des états financiers et de l'annexe (pointage)
- **Moment** : Phase de finalisation avant émission du rapport
- **Objectif** : Vérifier la cohérence et l'exhaustivité documentaire des comptes annuels
- **Sof'IA fait** : contrôle la présence des informations attendues, vérifie la cohérence factuelle entre états financiers et annexes, signale incohérences ou absences
- **Sof'IA ne fait pas** : ne valide pas les comptes, ne conclut pas sur la conformité réglementaire

### Principe commun
Dans les trois situations : Sof'IA agit uniquement en pré-analyse documentaire, le CAC reste seul décisionnaire, la validation humaine est toujours visible et tracée.

### Conséquence pour le POC
La webapp doit proposer un parcours utilisateur unique, décliné sur trois jeux de données. Aucune fonctionnalité ne doit être développée pour un seul exemple sans être compatible avec les deux autres.

---

## 7. Backlog POC

| ID | User Story | Description |
|--------|-------------------------------------------|-------------|
| POC-01 | Sélectionner un scénario de mission | Écran d'accueil listant les 3 exemples concrets |
| POC-02 | Voir les documents attendus et reçus | Tableau comparatif documents attendus vs reçus |
| POC-03 | Rattacher les pièces aux écritures | Rapprochement factuel écritures ↔ pièces |
| POC-04 | Visualiser des signaux documentaires | Liste de signaux documentaires objectifs |
| POC-05 | Comprendre pourquoi un signal est généré | Vue détaillée du document source avec explication |
| POC-06 | Valider, rejeter ou approfondir un signal | Boutons décision + champ commentaire obligatoire |
| POC-07 | Générer une check-list documentaire | Document structuré avec périmètre et limites |
| POC-08 | Tableau des signaux avec décisions | Tableau récapitulatif avec source et décision humaine |
| POC-09 | Synthèse de pré-analyse | Synthèse narrative structurée pour dossier NEP 230 |
| POC-10 | Journal de traçabilité | Journal chronologique des actions IA et humaines |

---

## 8. Livrables attendus — Sorties Sof'IA

### Livrable 1 — Check-list de complétude documentaire
- Type de document, document attendu, document reçu, statut (présent/manquant/incomplet)
- Usage : suivi de la collecte, justification, traçabilité

### Livrable 2 — Tableau des signaux documentaires
- Pour chaque signal : type, document source, page/ligne concernée, règle déclenchée, niveau de priorité, décision humaine (validé/rejeté/à approfondir)

### Livrable 3 — Synthèse de pré-analyse
- Périmètre, documents analysés, principaux constats documentaires, limites de l'analyse, mention explicite de la validation humaine
- Intégration directe au dossier de travail

### Livrable 4 — Journal de traçabilité
- Date, document analysé, signal détecté, règle déclenchée, action du CAC, commentaire éventuel
- Défense du dossier en inspection, transparence totale

### Formats attendus
- Affichables à l'écran, exportables (PDF ou tableur simple), nommés avec un vocabulaire métier CAC

### Critère de validation finale
Un livrable est validé si un CAC peut l'intégrer dans son dossier sans le retravailler, il est compréhensible sans explication orale, il ne contient aucune conclusion automatisée.

---

## 9. Parcours utilisateur POC

### Écran 1 — Accueil & contexte de mission
- Type de mission, exemple sélectionné, documents mis à disposition
- Action : sélection d'un exemple + bouton "Lancer la pré-analyse"

### Écran 2 — Documents analysés & complétude
- Liste documents reçus vs attendus, statut (présent/manquant/incomplet)
- Règle : aucun jugement, uniquement des constats factuels

### Écran 3 — Signaux documentaires détectés
- Tableau : type de signal, document concerné, page/ligne, règle déclenchée, niveau de priorité
- Règle : les signaux sont des alertes documentaires, jamais des anomalies qualifiées

### Écran 4 — Détail d'un signal & explicabilité
- Extrait du document source, élément mis en évidence, explication factuelle
- Mention visible : "Analyse automatique — à valider par le commissaire aux comptes"

### Écran 5 — Validation humaine
- Pour chaque signal : statut (validé/rejeté/à approfondir) + champ commentaire libre
- Règle : aucun signal ne disparaît sans action humaine tracée

### Écran 6 — Livrables générés
- Check-list, tableau des signaux, synthèse de pré-analyse, journal de traçabilité
- Tous visibles et téléchargeables

---

## 10. Espace idées / question

| ID | Description | Valeur | Risque déontologique | Alignement Sof'IA | Décision |
|---------|---------------------------------------|--------|---------------------|-------------------|----------|
| IDEA-01 | Priorisation visuelle | Moyenne | Faible | Oui | À étudier (si non assimilable à un score) |
| IDEA-02 | Détection de fraude | Apparente | Très élevé | Non | Rejetée (hors périmètre) |
| IDEA-03 | Améliorer l'explication des signaux | Forte | Nul | Oui | Acceptée (renforce confiance jury) |

---

## 11. PITCH 4 min

### Personne 1 — L'ouverture (WHY)
Le paradoxe du CAC : le temps passé à lire, chercher, vérifier mécaniquement est du temps en moins pour l'analyse et le jugement professionnel. Sof'IA adresse ce point de friction.

### Personne 2 — La solution
Sof'IA est une solution d'IA qui automatise la pré-analyse documentaire pour orienter le jugement du CAC, sans jamais s'y substituer. Elle prend en entrée les journaux comptables (FEC), les annexes, et les pièces justificatives. Elle ne choisit jamais l'échantillon, ne qualifie jamais une anomalie, ne conclut jamais. L'outil éclaire. Le jugement reste humain.

### Personne 3 — Les cas d'usage
Trois exemples concrets : sondage CA, cut-off, pointage états financiers/annexe. Dans chaque cas, le CAC gagne du temps sans perdre la maîtrise.

### Personne 4 — Les livrables
Check-list de complétude, tableau de signaux documentaires, synthèse de pré-analyse, journal de traçabilité. Gain de temps, dossier plus robuste, meilleure qualité de jugement.

### Personne 5 — La vision
Sof'IA a été pensée pour renforcer la compétence, l'indépendance et la déontologie. Elle est explicable, traçable, gouvernée par l'humain. Sof'IA permet au CAC de rester le garant éclairé de la fiabilité de l'information financière.
