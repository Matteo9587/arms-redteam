/**
 * Jumeau numérique (fictif) du système ARMS — Agentic Risk Monitoring System.
 *
 * Tout ce fichier décrit un environnement de simulation pédagogique : aucun système
 * réel n'est ciblé. Les fournisseurs sont fictifs. Les faiblesses sont volontairement
 * plantées pour que la Red Team agentique puisse les découvrir.
 */

export type Criticality = 'critique' | 'élevée' | 'moyenne' | 'faible';

export interface ArmsComponent {
  id: string;
  name: string;
  tech: string;
  role: string;
  exposure: string;
}

export interface DataFlow {
  id: string;
  from: string;
  to: string;
  data: string;
  protection: string;
}

export interface Endpoint {
  id: string;
  component: string;
  auth: string;
  rateLimit: string;
  integrity: string;
  notes: string;
}

export interface Vendor {
  name: string;
  service: string;
  criticality: Criticality;
  supportsCriticalFunction: boolean;
  dataLocation: string;
  dataShared: string;
  inDoraRegister: boolean;
  contract: {
    sla: string;
    auditRights: boolean;
    exitStrategy: string;
    incidentNotification: string;
    subcontracting: string;
    other?: string;
  };
}

export const ARMS_ARCHITECTURE = {
  system: 'ARMS — Agentic Risk Monitoring System',
  context:
    "Plateforme de surveillance LCB-FT et fraude (transactions SEPA, cartes et crypto-actifs) de la banque, en pré-production. Système fictif utilisé pour l'exercice.",
  version: '2.3.0-rc (pré-production)',
  aiActStatus:
    "Traité comme système d'IA à haut risque par décision de gouvernance interne (il peut déclencher le gel ou le blocage de comptes clients).",
  components: [
    {
      id: 'tx-gateway',
      name: "Passerelle d'ingestion des transactions",
      tech: 'API REST + bus Kafka',
      role: 'Reçoit les transactions SEPA, cartes et crypto (core banking et partenaires)',
      exposure: 'Interne (mTLS) + Internet (endpoints partenaires)',
    },
    {
      id: 'crypto-connector',
      name: 'Connecteur crypto-actifs',
      tech: 'Microservice Node.js',
      role: 'Webhooks dépôts/retraits du dépositaire ChainCustody, valorisation EUR via le flux OraclePrice',
      exposure: 'Internet (webhook entrant)',
    },
    {
      id: 'feature-store',
      name: 'Feature store clients',
      tech: 'Feature store sur NimbusCloud (région unique Paris)',
      role: 'Calcule vélocité, structuration, géographie, exposition aux mixers',
      exposure: 'Interne',
    },
    {
      id: 'aml-model',
      name: 'Modèle de scoring LCB-FT',
      tech: 'Régression logistique, réentraînement hebdomadaire automatique',
      role: 'Score de risque 0–1, alerte si score ≥ 0,70',
      exposure: 'Interne + endpoint /v1/score/explain exposé aux partenaires',
    },
    {
      id: 'triage-agent',
      name: 'Agent IA de triage des alertes',
      tech: 'LLM externe (LLM Provider X) + RAG sur les procédures',
      role: "Lit l'alerte et le libellé libre de la transaction, propose escalade ou classement sans suite. Classement automatique si confiance ≥ 0,80",
      exposure: 'Interne, appelle une API LLM hors UE',
    },
    {
      id: 'feedback-loop',
      name: 'Boucle de feedback MLOps',
      tech: 'Pipeline de réentraînement',
      role: 'Les alertes classées sans suite deviennent des labels « faux positif » pour le réentraînement hebdomadaire',
      exposure: 'Interne',
    },
    {
      id: 'case-manager',
      name: "Gestion des dossiers et journal d'audit",
      tech: 'Application interne + Elasticsearch',
      role: "Dossiers analystes, piste d'audit (rétention 30 jours)",
      exposure: 'Interne (SSO + MFA)',
    },
    {
      id: 'reporting',
      name: 'Reporting réglementaire',
      tech: 'Batch quotidien',
      role: 'Déclarations de soupçon Tracfin, reporting des incidents TIC (DORA)',
      exposure: 'Interne',
    },
    {
      id: 'siem',
      name: 'SIEM / SOC',
      tech: 'SIEM groupe',
      role: 'Corrélation des événements de sécurité',
      exposure: 'Interne',
    },
  ] satisfies ArmsComponent[],
  dataFlows: [
    {
      id: 'F1',
      from: 'Core banking',
      to: 'tx-gateway → feature-store → aml-model',
      data: 'Transactions SEPA/cartes, données KYC',
      protection: 'mTLS, chiffrement au repos',
    },
    {
      id: 'F2',
      from: 'ChainCustody (webhook)',
      to: 'crypto-connector → tx-gateway',
      data: 'Dépôts/retraits crypto, adresses de wallets, informations « règle du voyage »',
      protection: 'Signature HMAC en mode « monitor » depuis la migration v2.3',
    },
    {
      id: 'F3',
      from: 'OraclePrice (flux de prix)',
      to: 'crypto-connector',
      data: 'Cours BTC/ETH/USDC en EUR, utilisés pour valoriser les montants et appliquer les seuils',
      protection: 'HTTPS, données non signées, source unique',
    },
    {
      id: 'F4',
      from: 'aml-model',
      to: 'triage-agent → LLM Provider X',
      data: 'Alerte + libellé libre de la transaction + extrait KYC',
      protection: 'TLS, données traitées hors UE',
    },
    {
      id: 'F5',
      from: 'triage-agent',
      to: 'feedback-loop → aml-model',
      data: 'Labels « faux positif » générés automatiquement',
      protection: 'Aucune validation humaine',
    },
    {
      id: 'F6',
      from: 'SanctionList Pro',
      to: 'feature-store',
      data: 'Listes sanctions / PEP / wallets à risque',
      protection: 'Mise à jour quotidienne',
    },
    {
      id: 'F7',
      from: 'case-manager',
      to: 'reporting → Tracfin / ACPR',
      data: 'Déclarations de soupçon, incidents TIC',
      protection: 'Batch J+1',
    },
    {
      id: 'F8',
      from: 'Tous les composants',
      to: 'siem',
      data: 'Journaux de sécurité',
      protection: 'Transfert des journaux de la passerelle partenaires désactivé depuis la migration',
    },
  ] satisfies DataFlow[],
  controls: [
    'R1 : transfert crypto ≥ 10 000 € (valorisé via OraclePrice) → vigilance renforcée (EDD) + contrôle règle du voyage',
    'R2 (structuration) : DÉCOMMISSIONNÉE en v2.0, logique déléguée au modèle ML',
    "Seuil d'alerte du modèle : score ≥ 0,70",
    'Monitoring du modèle : PSI hebdomadaire sur la distribution des entrées (seuil 0,10)',
    'Réconciliation des soldes crypto : batch de fin de journée (23:00)',
    'Filtrage sanctions : liste SanctionList Pro, analyse des wallets à 1 saut',
  ],
};

export const ENDPOINTS: Endpoint[] = [
  {
    id: '/v1/partners/crypto/webhook',
    component: 'crypto-connector',
    auth: 'En-tête HMAC-SHA256 requis, mais une signature invalide est seulement journalisée (mode monitor)',
    rateLimit: '1 000 req/min',
    integrity: "Pas de nonce ni d'horodatage : aucun contrôle d'idempotence ou d'anti-rejeu",
    notes:
      "Exemple de message légitime observé : WH-LEGIT-0001 (dépôt de 2,0 BTC). Les WARN de signature ne sont pas transférés au SIEM.",
  },
  {
    id: '/v1/score/explain',
    component: 'aml-model',
    auth: 'Clé API partenaire partagée',
    rateLimit: 'Aucun',
    integrity: 'Renvoie le score brut et les principales variables',
    notes: 'Permet de sonder le modèle en boîte noire (oracle de score) pour trouver sa frontière de décision.',
  },
  {
    id: 'oracle-feed',
    component: 'crypto-connector',
    auth: 'HTTPS sortant vers OraclePrice',
    rateLimit: 'n/a',
    integrity: "Données de prix non signées, pas de seconde source, pas de garde-fou d'écart de cours",
    notes: 'Le cours reçu sert directement à valoriser les transferts et à appliquer le seuil R1.',
  },
  {
    id: '/v1/transactions',
    component: 'tx-gateway',
    auth: 'mTLS (core banking)',
    rateLimit: 'n/a',
    integrity: 'Libellé libre de 140 caractères transmis tel quel',
    notes: 'Le libellé est concaténé dans le prompt du triage-agent.',
  },
  {
    id: 'triage-agent/prompt',
    component: 'triage-agent',
    auth: 'Interne',
    rateLimit: 'n/a',
    integrity: 'Libellé client inséré dans le prompt sans délimitation ni filtrage',
    notes: 'Classement automatique sans revue humaine si confiance ≥ 0,80.',
  },
  {
    id: 'feedback-loop/labels',
    component: 'feedback-loop',
    auth: 'Interne',
    rateLimit: 'n/a',
    integrity: "Écriture automatique des labels, pas de quarantaine ni d'échantillonnage humain",
    notes: 'Réentraînement hebdomadaire automatique, déploiement sans validation champion/challenger.',
  },
  {
    id: 'case-manager/admin',
    component: 'case-manager',
    auth: 'SSO + MFA',
    rateLimit: 'Standard',
    integrity: 'Correct',
    notes: 'Pas de faiblesse évidente.',
  },
];

export const VENDORS: Vendor[] = [
  {
    name: 'NimbusCloud',
    service: 'IaaS/PaaS : héberge le feature store, le modèle et le pipeline MLOps',
    criticality: 'critique',
    supportsCriticalFunction: true,
    dataLocation: 'UE — région unique Paris',
    dataShared: 'Données transactionnelles et KYC pseudonymisées',
    inDoraRegister: true,
    contract: {
      sla: '99,9 %',
      auditRights: true,
      exitStrategy: 'Rédigée, jamais testée',
      incidentNotification: 'Sous 24 h',
      subcontracting: 'Notifiée',
      other: 'Héberge 3 fonctions critiques ARMS : risque de concentration non évalué',
    },
  },
  {
    name: 'ChainCustody',
    service: 'Dépositaire et conservateur de crypto-actifs (prestataire agréé MiCA), webhooks dépôts/retraits',
    criticality: 'critique',
    supportsCriticalFunction: true,
    dataLocation: 'UE (Irlande)',
    dataShared: 'Adresses de wallets, montants, identité donneur d’ordre / bénéficiaire',
    inDoraRegister: false,
    contract: {
      sla: '99,5 %',
      auditRights: true,
      exitStrategy: 'Absente',
      incidentNotification: 'Non spécifiée',
      subcontracting: 'Sous-traitance de l’infrastructure de signature non notifiée',
    },
  },
  {
    name: 'OraclePrice',
    service: 'Flux de prix des crypto-actifs (BTC, ETH, USDC) en EUR',
    criticality: 'élevée',
    supportsCriticalFunction: true,
    dataLocation: 'Hors UE (Singapour)',
    dataShared: 'Aucune donnée client',
    inDoraRegister: false,
    contract: {
      sla: 'Aucun (conditions générales standard)',
      auditRights: false,
      exitStrategy: 'Absente',
      incidentNotification: 'Aucune',
      subcontracting: 'Inconnue',
      other: 'Source de prix unique, aucune source de repli',
    },
  },
  {
    name: 'LLM Provider X',
    service: 'Modèle de langage utilisé par le triage-agent',
    criticality: 'élevée',
    supportsCriticalFunction: true,
    dataLocation: 'États-Unis',
    dataShared: 'Libellés de transactions, extraits KYC (nom, profession, pays)',
    inDoraRegister: true,
    contract: {
      sla: '99 %',
      auditRights: false,
      exitStrategy: 'Absente',
      incidentNotification: 'Sous 72 h',
      subcontracting: 'Non documentée',
      other:
        'DPA signé, clauses contractuelles types « en cours », aucune documentation technique du modèle transmise',
    },
  },
  {
    name: 'SanctionList Pro',
    service: 'Listes de sanctions, PEP et wallets à risque',
    criticality: 'élevée',
    supportsCriticalFunction: true,
    dataLocation: 'UE',
    dataShared: 'Noms et wallets à contrôler',
    inDoraRegister: true,
    contract: {
      sla: '99,5 %',
      auditRights: true,
      exitStrategy: 'Fournisseur alternatif identifié',
      incidentNotification: 'Sous 4 h',
      subcontracting: 'Notifiée',
      other: 'Mise à jour quotidienne : un wallet créé dans la journée n’est pas encore listé',
    },
  },
];

/** Documentation et gouvernance du modèle, telles que le Compliance Breaker peut les consulter. */
export const MODEL_GOVERNANCE = {
  modelCard: {
    exists: true,
    version: '1.2',
    lastUpdated: 'il y a 8 mois (avant la mise en place du réentraînement automatique)',
    covers: ['Objectif du modèle', 'Variables utilisées', 'Performance initiale (AUC 0,91)'],
    missing: [
      'Provenance et qualité des données d’entraînement (labels auto-générés)',
      'Analyse des biais',
      'Tests de robustesse adversariale',
      "Description de l'agent de triage LLM et de son prompt",
      'Procédure de validation avant déploiement des modèles réentraînés',
    ],
  },
  explainability:
    "Le score du modèle est explicable (variables principales). Les décisions du triage-agent ne le sont pas : la justification produite par le LLM n'est pas conservée.",
  humanOversight:
    'Classement automatique des alertes si confiance ≥ 0,80 ; taux d’échantillonnage humain des classements : 0 %.',
  versioning: 'Modèles réentraînés déployés automatiquement, version non journalisée avec chaque décision.',
  logging: {
    retention: '30 jours',
    fieldsLogged: ['horodatage', 'identifiant alerte', 'décision', 'confiance'],
    fieldsMissing: ['version du modèle', 'variables d’entrée', 'prompt / empreinte du prompt', 'justification', 'identité du valideur'],
  },
  dpia: {
    amlModel: 'Réalisée (2025)',
    triageAgent: 'Non réalisée',
  },
  dataProcessing: {
    categories: ['Identité', 'Transactions', 'Profession', 'Pays de résidence', 'Wallets crypto'],
    transfersOutsideEU: 'Oui : LLM Provider X (États-Unis), clauses contractuelles types en cours de signature',
    retention: 'Libellés envoyés au LLM conservés 30 jours par le fournisseur',
    legalBasis: 'Obligation légale (LCB-FT)',
  },
  incidentProcess: {
    automaticClassification: false,
    doraMajorIncidentCriteria: 'Non implémentés dans ARMS (classification manuelle par le SOC)',
    reconciliation: 'Batch de fin de journée (23:00)',
  },
};
