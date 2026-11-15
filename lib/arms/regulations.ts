/**
 * Base de connaissances réglementaire (résumés) consultée par l'agent Compliance Breaker.
 * Les résumés sont volontairement courts et paraphrasés ; se référer aux textes officiels.
 */

export type Regulation = 'DORA' | 'MiCA' | 'AI Act' | 'RGPD' | 'LCB-FT';

export interface RegulatoryRequirement {
  regulation: Regulation;
  reference: string;
  title: string;
  summary: string;
  keywords: string[];
}

export const REGULATIONS: RegulatoryRequirement[] = [
  // ---------------------------------------------------------------- DORA
  {
    regulation: 'DORA',
    reference: 'Règlement (UE) 2022/2554, art. 6',
    title: 'Cadre de gestion du risque lié aux TIC',
    summary:
      'Cadre documenté, revu au moins une fois par an, couvrant stratégies, politiques et outils pour protéger les actifs TIC.',
    keywords: ['gouvernance', 'cadre', 'risque tic', 'documentation'],
  },
  {
    regulation: 'DORA',
    reference: 'Règlement (UE) 2022/2554, art. 9',
    title: 'Protection et prévention',
    summary:
      "Mécanismes d'authentification forte, contrôles d'intégrité et de non-altération des données, gestion sécurisée des flux et des accès.",
    keywords: ['authentification', 'intégrité', 'signature', 'webhook', 'api', 'hmac', 'protection'],
  },
  {
    regulation: 'DORA',
    reference: 'Règlement (UE) 2022/2554, art. 10',
    title: 'Détection',
    summary:
      'Mécanismes permettant de détecter rapidement les activités anormales, avec plusieurs niveaux de contrôle et des seuils d’alerte définis.',
    keywords: ['détection', 'siem', 'anomalie', 'journalisation', 'logs', 'monitoring'],
  },
  {
    regulation: 'DORA',
    reference: 'Règlement (UE) 2022/2554, art. 11-12',
    title: 'Réponse, rétablissement et sauvegarde',
    summary: 'Politique de continuité TIC, plans de réponse et de rétablissement testés, sauvegardes et restauration.',
    keywords: ['continuité', 'rétablissement', 'sauvegarde', 'réponse'],
  },
  {
    regulation: 'DORA',
    reference: 'Règlement (UE) 2022/2554, art. 17',
    title: 'Processus de gestion des incidents liés aux TIC',
    summary:
      'Processus pour détecter, gérer et notifier les incidents ; enregistrement de tous les incidents et indicateurs d’alerte précoce.',
    keywords: ['incident', 'gestion', 'enregistrement', 'alerte précoce'],
  },
  {
    regulation: 'DORA',
    reference: 'Règlement (UE) 2022/2554, art. 18',
    title: 'Classification des incidents',
    summary:
      'Classification selon le nombre de clients touchés, la durée, l’étendue géographique, les pertes de données, la criticité des services et l’impact économique.',
    keywords: ['classification', 'incident majeur', 'critères'],
  },
  {
    regulation: 'DORA',
    reference: 'Règlement (UE) 2022/2554, art. 19',
    title: 'Notification des incidents majeurs',
    summary:
      "Notification à l'autorité compétente (ACPR) : rapport initial (au plus tard 4 h après la classification et 24 h après la détection), intermédiaire puis final.",
    keywords: ['notification', 'acpr', 'rapport', 'incident majeur', 'délai'],
  },
  {
    regulation: 'DORA',
    reference: 'Règlement (UE) 2022/2554, art. 24-26',
    title: 'Tests de résilience opérationnelle numérique (dont TLPT)',
    summary:
      'Programme de tests proportionné ; tests de pénétration fondés sur la menace (TLPT) au moins tous les 3 ans pour les entités significatives.',
    keywords: ['test', 'tlpt', 'red team', 'pénétration', 'résilience'],
  },
  {
    regulation: 'DORA',
    reference: 'Règlement (UE) 2022/2554, art. 28',
    title: 'Risque lié aux prestataires tiers de services TIC',
    summary:
      "Registre d'information de tous les accords avec des prestataires TIC, évaluation préalable, stratégies de sortie documentées et testées pour les fonctions critiques.",
    keywords: ['tiers', 'prestataire', 'registre', 'fournisseur', 'stratégie de sortie', 'dépendance'],
  },
  {
    regulation: 'DORA',
    reference: 'Règlement (UE) 2022/2554, art. 29',
    title: 'Risque de concentration',
    summary: 'Évaluation du risque de concentration TIC avant de confier des fonctions critiques à un même prestataire.',
    keywords: ['concentration', 'cloud', 'fournisseur unique', 'source unique'],
  },
  {
    regulation: 'DORA',
    reference: 'Règlement (UE) 2022/2554, art. 30',
    title: 'Dispositions contractuelles clés',
    summary:
      "Contrats incluant niveaux de service, localisation des données, droits d'accès, d'inspection et d'audit, assistance en cas d'incident, stratégie de sortie.",
    keywords: ['contrat', 'sla', 'audit', 'clause', 'localisation'],
  },
  // ---------------------------------------------------------------- MiCA
  {
    regulation: 'MiCA',
    reference: 'Règlement (UE) 2023/1114, art. 68',
    title: 'Dispositifs de gouvernance des prestataires de services sur crypto-actifs',
    summary:
      'Politiques et procédures efficaces, contrôle interne, continuité d’activité et systèmes TIC sécurisés (conformes à DORA).',
    keywords: ['gouvernance', 'casp', 'continuité', 'contrôle interne', 'tic'],
  },
  {
    regulation: 'MiCA',
    reference: 'Règlement (UE) 2023/1114, art. 70',
    title: 'Protection des crypto-actifs et des fonds des clients',
    summary: 'Dispositions adéquates pour protéger les droits de propriété des clients, notamment en cas d’insolvabilité.',
    keywords: ['protection', 'actifs clients', 'fonds', 'conservation'],
  },
  {
    regulation: 'MiCA',
    reference: 'Règlement (UE) 2023/1114, art. 75',
    title: 'Conservation et administration de crypto-actifs pour le compte de clients',
    summary:
      'Politique de conservation, registre des positions, rapprochements ; responsabilité du prestataire en cas de perte de crypto-actifs due à un incident qui lui est imputable.',
    keywords: ['conservation', 'custody', 'registre', 'rapprochement', 'perte', 'responsabilité'],
  },
  {
    regulation: 'MiCA',
    reference: 'Règlement (UE) 2023/1114, art. 91-92',
    title: 'Manipulation de marché et prévention des abus de marché',
    summary:
      'Interdiction des manipulations de marché ; dispositifs efficaces pour détecter et signaler les ordres et transactions suspects.',
    keywords: ['manipulation', 'prix', 'oracle', 'abus de marché', 'cours'],
  },
  {
    regulation: 'MiCA',
    reference: 'Règlement (UE) 2023/1114, art. 111',
    title: 'Sanctions administratives',
    summary:
      'Pour les prestataires (titre V), amendes pouvant atteindre au moins 5 M€ ou 5 % du chiffre d’affaires annuel total.',
    keywords: ['sanction', 'amende'],
  },
  // ---------------------------------------------------------------- AI Act
  {
    regulation: 'AI Act',
    reference: 'Règlement (UE) 2024/1689, art. 9',
    title: 'Système de gestion des risques',
    summary: "Processus itératif d'identification, d'évaluation et de réduction des risques tout au long du cycle de vie.",
    keywords: ['gestion des risques', 'cycle de vie'],
  },
  {
    regulation: 'AI Act',
    reference: 'Règlement (UE) 2024/1689, art. 10',
    title: 'Données et gouvernance des données',
    summary:
      "Données d'entraînement pertinentes, représentatives, aussi exemptes d'erreurs que possible ; examen des biais ; pratiques de gouvernance documentées.",
    keywords: ['données', 'entraînement', 'labels', 'biais', 'qualité', 'empoisonnement', 'poisoning'],
  },
  {
    regulation: 'AI Act',
    reference: 'Règlement (UE) 2024/1689, art. 11 et annexe IV',
    title: 'Documentation technique',
    summary: 'Documentation à jour démontrant la conformité : conception, données, validation, tests, modifications.',
    keywords: ['documentation', 'model card', 'annexe iv'],
  },
  {
    regulation: 'AI Act',
    reference: 'Règlement (UE) 2024/1689, art. 12',
    title: 'Enregistrement (journalisation)',
    summary: "Enregistrement automatique des événements tout au long de la vie du système pour garantir la traçabilité.",
    keywords: ['journalisation', 'logs', 'traçabilité', 'audit'],
  },
  {
    regulation: 'AI Act',
    reference: 'Règlement (UE) 2024/1689, art. 13',
    title: 'Transparence et information des déployeurs',
    summary: 'Fonctionnement suffisamment transparent pour interpréter les résultats et les utiliser de manière appropriée.',
    keywords: ['transparence', 'explicabilité', 'interprétation'],
  },
  {
    regulation: 'AI Act',
    reference: 'Règlement (UE) 2024/1689, art. 14',
    title: 'Contrôle humain',
    summary:
      'Conception permettant une supervision humaine effective, y compris la possibilité de ne pas utiliser, d’ignorer ou d’annuler une décision.',
    keywords: ['contrôle humain', 'supervision', 'automatique', 'revue'],
  },
  {
    regulation: 'AI Act',
    reference: 'Règlement (UE) 2024/1689, art. 15',
    title: 'Exactitude, robustesse et cybersécurité',
    summary:
      "Résilience face aux tentatives de tiers d'altérer l'utilisation ou les performances : mesures contre l'empoisonnement des données ou du modèle, les exemples adverses et le contournement du modèle.",
    keywords: ['robustesse', 'cybersécurité', 'adversarial', 'empoisonnement', 'poisoning', 'évasion', 'injection'],
  },
  {
    regulation: 'AI Act',
    reference: 'Règlement (UE) 2024/1689, art. 26',
    title: 'Obligations des déployeurs',
    summary:
      'Utilisation conforme à la notice, contrôle humain par des personnes compétentes, conservation des journaux au moins 6 mois.',
    keywords: ['déployeur', 'conservation', 'journaux', '6 mois'],
  },
  {
    regulation: 'AI Act',
    reference: 'Règlement (UE) 2024/1689, art. 99',
    title: 'Sanctions',
    summary: 'Manquements aux obligations des systèmes à haut risque : jusqu’à 15 M€ ou 3 % du chiffre d’affaires mondial.',
    keywords: ['sanction', 'amende'],
  },
  // ---------------------------------------------------------------- RGPD
  {
    regulation: 'RGPD',
    reference: 'Règlement (UE) 2016/679, art. 5 et 25',
    title: 'Minimisation et protection des données dès la conception',
    summary: 'Données adéquates, pertinentes et limitées ; protection intégrée dès la conception.',
    keywords: ['minimisation', 'privacy by design', 'données personnelles'],
  },
  {
    regulation: 'RGPD',
    reference: 'Règlement (UE) 2016/679, art. 22',
    title: 'Décision individuelle automatisée',
    summary: 'Droit de ne pas faire l’objet d’une décision fondée exclusivement sur un traitement automatisé produisant des effets significatifs.',
    keywords: ['décision automatisée', 'profilage'],
  },
  {
    regulation: 'RGPD',
    reference: 'Règlement (UE) 2016/679, art. 35',
    title: "Analyse d'impact (AIPD)",
    summary: 'AIPD obligatoire pour les traitements susceptibles d’engendrer un risque élevé (nouvelles technologies, profilage).',
    keywords: ['aipd', 'dpia', 'analyse d’impact'],
  },
  {
    regulation: 'RGPD',
    reference: 'Règlement (UE) 2016/679, art. 44-46',
    title: 'Transferts hors UE',
    summary: 'Transferts uniquement avec garanties appropriées (décision d’adéquation, clauses contractuelles types…).',
    keywords: ['transfert', 'hors ue', 'états-unis', 'clauses contractuelles'],
  },
  {
    regulation: 'RGPD',
    reference: 'Règlement (UE) 2016/679, art. 83',
    title: 'Sanctions',
    summary: 'Jusqu’à 20 M€ ou 4 % du chiffre d’affaires annuel mondial.',
    keywords: ['sanction', 'amende'],
  },
  // ---------------------------------------------------------------- LCB-FT
  {
    regulation: 'LCB-FT',
    reference: 'Règlement (UE) 2023/1113 (TFR), art. 14-16',
    title: 'Règle du voyage pour les transferts de crypto-actifs',
    summary:
      "Le prestataire doit transmettre et vérifier les informations sur le donneur d'ordre et le bénéficiaire, et détecter les informations manquantes ou incohérentes.",
    keywords: ['règle du voyage', 'travel rule', 'donneur d’ordre', 'crypto', 'transfert'],
  },
  {
    regulation: 'LCB-FT',
    reference: 'Code monétaire et financier, art. L.561-15',
    title: 'Déclaration de soupçon à Tracfin',
    summary: 'Obligation de déclarer les sommes ou opérations soupçonnées de provenir d’une infraction (blanchiment, financement du terrorisme).',
    keywords: ['déclaration de soupçon', 'tracfin', 'blanchiment', 'structuration'],
  },
  {
    regulation: 'LCB-FT',
    reference: 'Directive (UE) 2015/849 et règlement (UE) 2024/1624 (AMLR)',
    title: 'Vigilance et surveillance des opérations',
    summary:
      'Dispositif de surveillance adapté aux risques, détection des opérations inhabituelles, conservation des données 5 ans.',
    keywords: ['vigilance', 'surveillance', 'conservation', '5 ans', 'blanchiment'],
  },
];

export function lookupRegulation(regulation?: string, keyword?: string): RegulatoryRequirement[] {
  const reg = regulation?.toLowerCase().replace(/[^a-z]/g, '');
  const kw = keyword?.toLowerCase().trim();
  return REGULATIONS.filter((r) => {
    const regOk = !reg || r.regulation.toLowerCase().replace(/[^a-z]/g, '') === reg;
    const kwOk =
      !kw ||
      r.keywords.some((k) => k.includes(kw) || kw.includes(k)) ||
      r.title.toLowerCase().includes(kw) ||
      r.summary.toLowerCase().includes(kw);
    return regOk && kwOk;
  });
}
