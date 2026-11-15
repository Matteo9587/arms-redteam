# 🎬 Script de la mini-vidéo de démonstration (2 min 30 à 3 min)

**Enregistrement** : outil Capture d'écran de Windows 11 (`Win + Maj + R`, mode vidéo) ou Clipchamp, fenêtre du navigateur en plein écran (1440 × 900 ou plus), zoom du navigateur à 90 %.

**Avant d'enregistrer** : `npm run dev`, ouvrir http://localhost:3000. Pendant l'enregistrement, utiliser **« Rejouer la dernière »** (vitesse 1x, environ 45 s) : la console rejoue la vraie campagne enregistrée (`reports/latest.json`, sinon `docs/sample-report.json`) sans appeler le modèle, donc c'est fluide et sans quota consommé.

**Chiffres à citer** (campagne réelle) : score **0,72 Critique**, perte probable **10,1 M€**, **17 actions sur 18 non détectées**, **0 alerte SIEM**, détection de la structuration **92 % → 53 %**, disponibilité **100 %**, **10 non-conformités**.

| Temps | À l'écran | Ce que tu dis |
|---|---|---|
| 0:00 – 0:15 | Console, haut de page | « Le COMEX veut s'assurer qu'ARMS, le système agentique de surveillance LCB-FT, est prêt pour l'AI Act, DORA et MiCA. Plutôt qu'une checklist, on l'attaque avec une Red Team de 5 agents IA autonomes, codés avec le Vercel AI SDK. » |
| 0:15 – 0:30 | GitHub : `lib/agents/` puis `lib/arms/` | « Chaque agent est un `ToolLoopAgent` avec ses propres outils et un rapport structuré validé par zod. La cible est un jumeau numérique d'ARMS qui embarque un vrai modèle de scoring. » |
| 0:30 – 0:45 | Choisir « Campagne complète », cliquer sur Lancer ou Rejouer | « L'orchestrateur enchaîne Reconnaissance, Attaquant, IA Adversaire, Compliance Breaker et Impact. Les rapports passent d'un agent à l'autre. » |
| 0:45 – 1:05 | Journal des agents : RECON | « La Reconnaissance cartographie les flux et les fournisseurs, et repère le webhook crypto sans anti-rejeu, le flux de prix non signé et la boucle de feedback. » |
| 1:05 – 1:30 | ATK + colonne « Réaction d'ARMS » en rouge | « Scénario 1, attaque cyber : rejeu de webhooks, signature forgée, cours de l'ETH manipulé à −40 %, puis exfiltration juste sous le seuil de 10 000 €. Regardez la colonne de droite : ARMS ne détecte rien en temps réel, seulement à la réconciliation du soir. » |
| 1:30 – 1:55 | ADV-IA | « Scénario 2, attaque sur l'IA : injection de prompt dans le libellé lu par le LLM de triage. Les alertes sont classées automatiquement et deviennent des labels d'entraînement. Après le réentraînement, la détection de la structuration chute, et le système reste disponible à 100 %. » |
| 1:55 – 2:15 | Onglets « Synthèse » puis « Attaques & point de rupture » | « Résultat : score de risque global, actions non détectées, pertes, et le point de rupture de chaque scénario. » |
| 2:15 – 2:35 | Onglet « Non-conformités » | « Le Compliance Breaker qualifie les infractions avec preuves : DORA articles 9, 10, 19 et 28, MiCA article 75, AI Act articles 12, 14 et 15. » |
| 2:35 – 2:55 | Onglet « Score & priorités » | « L'agent Impact hiérarchise les vulnérabilités avec une formule explicite et propose un plan : signature stricte et anti-rejeu, double source de prix, revue humaine des classements, quarantaine des labels, journalisation conforme. » |
| 2:55 – 3:00 | Retour en haut | « Code et rapport sur GitHub. Merci ! » |

Astuce : si tu préfères montrer une campagne en direct, lance plutôt le scénario 1 seul (environ 1 à 2 minutes) et coupe les temps morts au montage.
