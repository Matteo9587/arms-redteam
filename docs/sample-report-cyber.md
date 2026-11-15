# Rapport Red Team ARMS — Scénario 1 — Attaque cyber conventionnelle

- **Date** : 15/11/2026 13:37:41
- **Modèle** : nvidia/nemotron-3.5-super-vl:free (+2 repli) · **Durée** : 193 s
- **Score de risque global** : **0.79 (Critique)** · perte probable cumulée 19 674 800 €

## 1. La cible

ARMS expose 5 vecteurs d'entrée principaux, dont le webhook crypto (HMAC en mode monitor, pas d'anti-rejeu) et le flux de prix OraclePrice non signé, qui ciblent directement la chaîne crypto F2/F3. Le triage LLM et la boucle de feedback sans validation humaine constituent des cibles privilégiées pour l'agent IA adversaire (F4/F5). Quatre dépendances critiques (NimbusCloud, ChainCustody, OraclePrice, LLM Provider X) concentrent les risques de disponibilité, d'intégrité et de souveraineté des données.

**Cibles prioritaires** :
- /v1/partners/crypto/webhook (cyber, chaîne crypto F2)
- oracle-feed (cyber, chaîne crypto F3)
- triage-agent/prompt (IA adversaire, modèle/triage LLM F4)
- feedback-loop/labels (IA adversaire, boucle de feedback F5)
- /v1/score/explain (IA adversaire, oracle de score modèle)

| Flux | Chemin | Données | Faiblesse |
|---|---|---|---|
| F1 | Core banking → tx-gateway → feature-store → aml-model | Transactions SEPA/cartes, données KYC | Chiffrement au repos et mTLS, mais pas de contrôle d'intégrité spécifique documenté sur le parcours complet. |
| F2 | ChainCustody (webhook) → crypto-connector → tx-gateway | Dépôts/retraits crypto, adresses de wallets, informations « règle du voyage » | Signature HMAC en mode « monitor » uniquement (invalide = journalisée), pas de nonce ni d'anti-rejeu, WARN non transférés au SIEM. |
| F3 | OraclePrice → crypto-connector | Cours BTC/ETH/USDC en EUR | Données non signées, source unique, pas de garde-fou d'écart de cours ; cours utilisé directement pour le seuil R1. |
| F4 | aml-model → triage-agent → LLM Provider X | Alerte + libellé libre de la transaction + extrait KYC | Données traitées hors UE, libellé client inséré dans le prompt sans délimitation ni filtrage. |
| F5 | triage-agent → feedback-loop → aml-model | Labels « faux positif » générés automatiquement | Aucune validation humaine, réentraînement hebdomadaire automatique, déploiement sans validation champion/challenger. |
| F6 | SanctionList Pro → feature-store | Listes sanctions / PEP / wallets à risque | Mise à jour quotidienne uniquement, délai d'exposition entre deux mises à jour. |

| Point d’entrée | Cible | Vecteur | P | I |
|---|---|---|---|---|
| EP1 | /v1/partners/crypto/webhook | Webhook crypto entrant (ChainCustody) | 4 | 5 |
| EP2 | oracle-feed | Flux de prix OraclePrice | 3 | 4 |
| EP3 | /v1/score/explain | Endpoint d'explication du modèle AML | 4 | 3 |
| EP4 | triage-agent/prompt | Prompt du triage LLM | 4 | 4 |
| EP5 | feedback-loop/labels | Boucle de feedback MLOps | 3 | 4 |

## 2. L’équipe (agents)

| Agent | Rôle | Produit |
|---|---|---|
| Reconnaissance | Cartographie dépendances critiques, flux de données et vecteurs d’entrée | Carte des surfaces d’attaque |
| Attaquant | Simule des attaques cyber à forte probabilité (webhooks, flux de prix, contournement LCB-FT) | Journal d’attaques + réaction ARMS |
| Compliance Breaker | Qualifie les infractions DORA, MiCA, AI Act, RGPD, LCB-FT avec preuves | Registre des non-conformités |
| Impact & Risk Scoring | Chiffre pertes, risque réglementaire et réputationnel, hiérarchise | Score 0–1 + priorisation |

Interactions : la Reconnaissance transmet la carte des surfaces d’attaque aux agents offensifs ; Attaquant et IA Adversaire agissent sur le même jumeau numérique et laissent des traces ; le Compliance Breaker confronte ces traces aux textes ; l’agent Impact consolide le tout en score de risque.

## 3. Les scénarios

### Agent Attaquant — attaque cyber conventionnelle

Trois webhooks BTC rejoués et deux webhooks ETH signés falsifiés ont été acceptés, créditant 574 000 € de solde frauduleux sans alerte. Le cours ETH a été abaissé de 40 % sans garde-fou, permettant cinq transferts de 4,5 ETH vers un mixer (valeur réelle 72 000 €) contournant le seuil R1 de 10 000 € ; seul le virement vers un wallet sanctionné a été bloqué. ARMS n'a généré aucune alerte SIEM ni AML en temps réel, la détection n'intervenant qu'en réconciliation de fin de journée avec 13,8 heures de retard.

**A1 — Rejeu de webhook BTC signé** (cyber, Rejeu de message (replay attack) sans nonce/anti-rejeu) — ❌ non détectée
1. Capture du webhook légitime WH-LEGIT-0001
2. Rejeu 3 fois avec signature valide via send_crypto_webhook
3. Crédit automatique de 2 BTC par rejeu
- Résultat : 3 webhooks acceptés (HTTP 200), 2 BTC crédités chacun = 170 000 € par webhook, solde frauduleux disponible 510 000 €
- Réaction d’ARMS : Accepté en mode monitor, WARN journalisé mais non transféré au SIEM, doublon crédité sans blocage
- Point de rupture : Absence de nonce/anti-rejeu et HMAC en mode monitor uniquement (pas de rejet)

**A2 — Signature ETH forgée** (cyber, Falsification de signature HMAC sur webhook entrant) — ❌ non détectée
1. Envoi de 2 webhooks ETH 10 unités avec signature 'forged'
2. Acceptation par le connecteur crypto sans vérification cryptographique bloquante
- Résultat : 2 webhooks acceptés (HTTP 200), 10 ETH crédités chacun = 32 000 €, solde frauduleux cumulé 574 000 €
- Réaction d’ARMS : Crédit frauduleux accepté, signature invalide journalisée seulement (WARN non remonté au SIEM)
- Point de rupture : Pas de rejet cryptographique sur signature invalide ; contrôle en mode monitor uniquement

**A3 — Manipulation du flux de prix Oracle ETH** (données, Altération du flux OraclePrice non signé, source unique) — ❌ non détectée
1. Interception du flux OraclePrice ETH
2. Déviation de -40 % (3 200 € → 1 920 €) via manipulate_price_feed
3. Utilisation immédiate du cours manipulé pour le seuil R1 et la valorisation
- Résultat : Cours ETH passé de 3 200 € à 1 920 € (-40 %), accepté sans garde-fou d'écart ni seconde source
- Réaction d’ARMS : Nouveau cours utilisé immédiatement pour valoriser les transferts et appliquer le seuil R1 ; aucun blocage
- Point de rupture : Flux de prix non signé, source unique, absence de déviation guard et de second source check

**A4 — Exfiltration ETH vers mixer sous seuil R1** (cyber, Fractionnement sous seuil + cours manipulé + travel rule forgée + destination mixer) — ❌ non détectée
1. Utiliser le cours ETH manipulé à 1 920 €
2. Émettre 5 transferts de 4,5 ETH vers mixer_2hop avec travel rule 'forged'
3. Chaque transfert valorisé 8 640 € (sous le seuil R1 de 10 000 €)
- Résultat : 5 transferts exécutés, valorisés 8 640 € chacun (valeur réelle 14 400 €), total exfiltré 72 000 € (valeur réelle), score AML 0,07 à 0,15, R1 contourné, mixer non détecté
- Réaction d’ARMS : Exécutés sans blocage, travel rule acceptée (contrôle de présence uniquement), score très faible, pas d'alerte AML
- Point de rupture : Seuil R1 basé sur le cours manipulé, absence de détection de mixer, travel rule non vérifiée substantiellement

**A5 — Transfert témoin vers wallet sanctionné** (cyber, Vérification de contrôle (non-attaque)) — ✅ détectée
1. Émission d'un transfert USDC 1 000 vers sanctioned_wallet avec travel rule complète
- Résultat : Transfert bloqué (sanctions), valeur 920 €
- Réaction d’ARMS : Bloqué par le filtrage SanctionList Pro ; wallet présent sur la liste
- Point de rupture : Aucun — ce contrôle fonctionne correctement

- **Actions malveillantes totales** : 12
- **Détectées ou bloquées par ARMS** : 1 (8,3 %)
- **Non détectées** : 11 (91,7 %)
- **Alertes SIEM générées** : 0
- **Solde frauduleux crédité (webhooks)** : 574 000 €
- **Valeur réelle exfiltrée (mixer)** : 72 000 €
- **Délai de détection par réconciliation** : 13,8 heures (J0 23:00)
- **Disponibilité système pendant l'attaque** : 100 %

> **Question centrale** — Le point de rupture critique global est l'absence de contrôle cryptographique strict (nonce/anti-rejeu et rejet des signatures invalides) sur le webhook ChainCustody, couplée à l'utilisation d'un flux de prix OraclePrice non signé et unique pour le seuil R1. Cette combinaison permet de créditer 574 000 € de fonds frauduleux et d'exfiltrer 72 000 € de valeur réelle vers un mixer sans aucune alerte en temps réel, ARMS ne détectant l'écart qu'en réconciliation de fin de journée avec 13,8 heures de retard. Le seul contrôle efficace observé est le filtrage des wallets sanctionnés (transfert témoin bloqué).

## 4. La réaction d’ARMS

- Actions malveillantes : 12 · détectées ou bloquées : 1 · non détectées : 11
- Alertes SIEM : 0 · WARN non transférés au SIEM : 2
- Alertes LCB-FT : 0 (escaladées : 0, classées automatiquement par le LLM : 0)
- Réconciliation : Écart de solde crypto constaté seulement au batch de fin de journée (délai 13.8 h)
- Disponibilité du système : 100 %

## 5. Le problème réglementaire (gaps)

ARMS présente 10 non-conformités réglementaires majeures (DORA, MiCA, AI Act, RGPD, LCB-FT) révélées par les attaques A1-A5 : absence de contrôles cryptographiques sur les webhooks ChainCustody, flux de prix Oracle non signé et unique, détection uniquement en réconciliation de fin de journée (13,8 h de retard, 0 alerte SIEM), notification incident non envoyée, journalisation IA incomplète et conservée 30 jours seulement, absence de contrôle humain (0 % d'échantillonnage), transfert de données KYC vers un LLM américain sans garanties finales, et règle du voyage réduite à un contrôle de présence. Seul le filtrage des wallets sanctionnés (A5) fonctionne.

| # | Texte | Article | Preuve | Sévérité |
|---|---|---|---|---|
| V1 | DORA | Règlement (UE) 2022/2554, art. 28 | Registre fournisseurs : ChainCustody (inDoraRegister:false, exitStrategy absente, incidentNotification non spécifiée, sous-traitance de signature non notifiée) et OraclePrice (inDoraRegister:false, aucun SLA, aucun droit d'audit, aucune stratégie de sortie, aucune notification d'incident) supportent des fonctions critiques ARMS. | critique |
| V2 | DORA | Règlement (UE) 2022/2554, art. 10 | 0 alerte SIEM générée ; 11 des 12 actions malveillantes non détectées (91,7 %) ; détection uniquement par réconciliation de fin de journée à J0 23:00, soit 13,8 h après la première action malveillante (J0 09:11). | critique |
| V3 | DORA | Règlement (UE) 2022/2554, art. 19 | Incident timeline : notificationToAuthority = 'Non envoyée' ; classification automatique non implémentée (classification manuelle par le SOC). | critique |
| V4 | MiCA | Règlement (UE) 2023/1114, art. 75 | ChainCustody (dépositaire/conservateur agréé MiCA) : absence de stratégie de sortie, sous-traitance de l'infrastructure de signature non notifiée, incident notification non spécifiée ; crédits frauduleux de 574 000 € acceptés sans blocage. | élevée |
| V5 | MiCA | Règlement (UE) 2023/1114, art. 91-92 | Flux OraclePrice ETH altéré de -40 % (3 200 € → 1 920 €) via manipulate_price_feed, accepté sans garde-fou d'écart ni seconde source ; utilisé pour le seuil R1 et la valorisation. | élevée |
| V6 | AI Act | Règlement (UE) 2024/1689, art. 12 | Journaux triage-agent et crypto-connector incomplets : champs manquants (version du modèle, variables d'entrée, prompt/empreinte, justification, identité du valideur) ; 5 entrées seulement, rétention 30 jours. | élevée |
| V7 | AI Act | Règlement (UE) 2024/1689, art. 15 | Aucun test de robustesse adversariale dans la model card ; réentraînement automatique déployé sans validation ni journalisation de version ; flux de prix non signé accepté sans contrôle d'intégrité. | élevée |
| V8 | AI Act | Règlement (UE) 2024/1689, art. 14 | Classement automatique des alertes si confiance ≥ 0,80 ; taux d'échantillonnage humain des classements : 0 % ; aucune révision humaine des décisions du triage-agent. | élevée |
| V9 | RGPD | Règlement (UE) 2016/679, art. 44-46 | LLM Provider X (États-Unis) reçoit libellés de transactions et extraits KYC (nom, profession, pays) ; DPA signé mais clauses contractuelles types 'en cours de signature' ; aucune documentation technique du modèle transmise. | élevée |
| V10 | LCB-FT | Règlement (UE) 2023/1113 (TFR), art. 14-16 | Travel rule acceptée sur simple contrôle de présence ; travel rule 'forgée' acceptée pour 5 transferts vers mixer_2hop (score AML 0,07-0,15, mixer non détecté) ; contournement du seuil R1 de 10 000 € via cours manipulé. | critique |

## 6. Impact mesuré et recommandations

Formule : `score = (0,40·F + 0,35·R + 0,25·Rép) × (0,70·P + 0,30·I) ; global = 0,6·max + 0,4·moyenne`

| Rang | Vulnérabilité | Score | Niveau | Perte probable |
|---|---|---|---|---|
| 1 | Contrôle cryptographique webhook absent (nonce/anti-rejeu + rejet signature invalide) | 0.9 | Critique | 5 474 000 € |
| 2 | Absence détection temps réel SIEM/AML + détection réconciliation J+13,8h | 0.84 | Critique | 3 500 000 € |
| 3 | Seuil R1 contourné + absence détection mixer + travel rule non vérifiée | 0.77 | Critique | 4 572 000 € |
| 4 | Flux OraclePrice non signé, source unique, absence garde-fou déviation | 0.59 | Élevé | 1 928 800 € |
| 5 | Absence classification automatique incident majeur et notification ACPR | 0.55 | Élevé | 1 650 000 € |
| 6 | Registre DORA incomplet (ChainCustody, OraclePrice) - pas de stratégie de sortie/SLA/audit | 0.4 | Moyen | 1 400 000 € |
| 7 | Transferts données personnelles vers LLM US sans CCT finalisées + AIPD manquant | 0.33 | Moyen | 1 150 000 € |

L'exercice TLPT sur ARMS révèle un risque critique global (score 0,79) avec une perte financière probable estimée à 19,7 M€, principalement liée à l'absence de contrôle cryptographique sur les webhooks et à l'absence de détection temps réel. Aucun des 11 vecteurs d'attaque majeurs n'a généré d'alerte SIEM/AML, la détection n'intervenant qu'en réconciliation de fin de journée avec 13,8 heures de retard, exposant la banque à des sanctions DORA, LCB-FT et MiCA. Le seul contrôle efficace observé est le filtrage des wallets sanctionnés ; une remédiation immédiate des contrôles cryptographiques et de la détection temps réel est impérative avant mise en production.

| Priorité | Action | Responsable | Horizon |
|---|---|---|---|
| 1 | Implémenter nonce/anti-rejeu et rejet cryptographique des signatures invalides sur les webhooks ChainCustody, passer du mode monitor au blocage actif. | RSSI | immédiat |
| 2 | Vérifier substantiellement les travel rules (cohérence donneur/bénéficiaire), bloquer les travel rules forgées et détecter les destinations mixer. | Conformité LCB-FT | immédiat |
| 3 | Déployer règles de détection temps réel SIEM/AML (écart de cours >5 %, destination mixer, travel rule incomplète) et alimenter le SIEM. | RSSI / SOC | 30 jours |
| 4 | Signer les flux OraclePrice, imposer une seconde source de cotation, bloquer tout écart >5 % et geler les seuils R1 en cas d'anomalie de cours. | Data/ML | 30 jours |
| 5 | Implémenter la classification automatique d'incident majeur DORA et automatiser la notification ACPR dans les délais 4 h / 24 h. | Conformité / RSSI | 30 jours |
| 6 | Enregistrer ChainCustody et OraclePrice au registre DORA, contractualiser SLAs, droits d'audit et stratégies de sortie testées, notifier les sous-traitants. | Conformité / Achats | 90 jours |
| 7 | Finaliser et signer les clauses contractuelles types avec le LLM Provider US, réaliser un AIPD pour le triage-agent et limiter les données personnelles envoyées. | Conformité RGPD / DPO | 90 jours |

## Annexe — métriques du jumeau numérique

```json
{
  "forgedCreditsEUR": 64000,
  "duplicatedCreditsEUR": 510000,
  "exfiltratedEUR": 72000,
  "undervaluationEUR": 28800,
  "r1Bypass": 5,
  "r1Blocked": 0,
  "travelRuleForgedPassed": 5,
  "sanctionsBlocked": 1,
  "amlAlerts": 0,
  "alertsAutoClosedViaInjection": 0,
  "alertsEscalated": 0,
  "poisonedLabels": 0,
  "injectedStructuringTx": 0,
  "launderedUndetectedEUR": 0,
  "structuringDetection": {
    "initial": 0.917,
    "now": 0.917
  },
  "mixerDetection": {
    "initial": 0.4,
    "now": 0.4
  },
  "hoursUndetected": 13.8,
  "modelRetrainings": 0,
  "systemAvailability": "100 %"
}
```
