/* ==========================================================================
   PROBE — prompt-generator.js
   Builds the fully autonomous "Probe Prompt": role, rules, methodology,
   opportunity context, transcript and JSON schema are ALL injected inline.
   No placeholder may ever remain in the output of buildProbePrompt().
   ========================================================================== */

const ProbePromptGenerator = (() => {

  function safe(v, fallback = "Non renseigné") {
    if (v === undefined || v === null) return fallback;
    const s = String(v).trim();
    return s.length ? s : fallback;
  }

  const COMMERCIAL_INFO_LABELS = {
    competition: {
      UNKNOWN: "Inconnue", COLORZ_ONLY: "Colorz seul", TWO: "2 agences / prestataires",
      THREE_PLUS: "3+ agences / prestataires", RFP: "Appel d'offres"
    },
    colorzPosition: {
      UNKNOWN: "Inconnue", CHALLENGER: "Entrant / Challenger", EXISTING_RELATIONSHIP: "Déjà en relation",
      HISTORIC_PARTNER: "Partenaire historique", CURRENT_AGENCY: "Prestataire / agence actuelle"
    },
    origin: {
      UNKNOWN: "Inconnue", INBOUND: "Inbound", OUTBOUND: "Outbound", PARTNER: "Partenaire",
      REFERRAL: "Recommandation", EXISTING_CLIENT: "Client existant", OTHER: "Autre"
    }
  };

  const DECLARED_ROLE_LABELS = {
    UNKNOWN: "Inconnu", DECISION_MAKER: "Décideur", CHAMPION: "Champion",
    INFLUENCER: "Influenceur", USER: "Utilisateur", BLOCKER: "Bloqueur"
  };

  function formatInterlocutors(list) {
    if (!Array.isArray(list) || !list.length) return "Aucun interlocuteur renseigné avant le call.";
    return list.map((p, i) => {
      const name = safe(p.name, `Interlocuteur ${i + 1} (nom non renseigné)`);
      const role = safe(p.role, "—");
      const declared = DECLARED_ROLE_LABELS[p.roleType] || "Inconnu";
      return `  - ${name} — ${role} — rôle déclaré par le commercial : ${declared}`;
    }).join("\n");
  }

  function formatCommercialInfo(info) {
    info = info || {};
    const comp = COMMERCIAL_INFO_LABELS.competition[info.competition] || "Inconnue";
    const pos = COMMERCIAL_INFO_LABELS.colorzPosition[info.colorzPosition] || "Inconnue";
    const origin = COMMERCIAL_INFO_LABELS.origin[info.origin] || "Inconnue";
    if (comp === "Inconnue" && pos === "Inconnue" && origin === "Inconnue") {
      return "Aucune info commerciale facultative renseignée — appuie-toi uniquement sur le transcript pour la concurrence et la position de Colorz.";
    }
    return [
      `  - Concurrence déclarée par le commercial : ${comp}`,
      `  - Position de Colorz déclarée par le commercial : ${pos}`,
      `  - Origine du lead : ${origin}`,
    ].join("\n");
  }

  function formatContext(ctx) {
    ctx = ctx || {};
    return [
      `- Entreprise : ${safe(ctx.company)}`,
      `- Date : ${safe(ctx.date)}`,
      `- Commercial : ${safe(ctx.salesRep)}`,
      `- Type de call : ${safe(ctx.callType)}`,
      `- Contexte / opportunité déjà connue avant le call : ${safe(ctx.knownContext)}`,
      `- Objectif du rendez-vous : ${safe(ctx.callObjective)}`,
      `- Interlocuteurs déclarés avant le call :`,
      formatInterlocutors(ctx.interlocutors),
      `- Infos commerciales facultatives :`,
      formatCommercialInfo(ctx.commercialInfo),
    ].join("\n");
  }

  function formatMethodology(methodology) {
    const m = methodology || ProbeMethodologyDefault;
    return JSON.stringify({
      key_markers: m.keyMarkers,
      digital_selling_territories: m.territories,
      colorz_expertises: m.expertises,
      colorz_accelerators: m.accelerators,
      partners_solutions: m.partners,
      discovery_rules: m.discoveryRules,
      sales_coaching_rules: m.salesCoachingRules
    }, null, 2);
  }

  function buildProbePrompt({ context, transcript, methodology }) {
    const contextBlock = formatContext(context);
    const methodologyBlock = formatMethodology(methodology);
    const schemaExample = ProbeSchema.toPromptExampleString();
    const transcriptBlock = safe(transcript, "(aucun transcript fourni)");

    return `# PROBE — DISCOVERY INTELLIGENCE — PROMPT D'ANALYSE AUTONOME

Tu agis comme un **Senior Sales Strategist, Discovery Analyst, Sales Coach et Digital Selling Opportunity Analyst pour Colorz**, agence de Digital Selling (Shopify, UX, Acquisition, CRM, Fidélisation).

Je vais te fournir : une méthodologie Colorz (référentiel), le contexte connu avant le call, et le transcript brut d'un discovery call commercial.

## MISSION

Tu ne dois PAS te contenter de résumer la conversation. Tu dois :

1. reconstruire précisément le contexte du prospect (Client Mapping) ;
2. identifier ses enjeux business et ses pain points ;
3. identifier les Key Markers commerciaux présents dans le référentiel ;
4. mesurer la qualité de la discovery réalisée (Discovery Score /100) ;
5. évaluer la performance commerciale du commercial (Sales Performance Score /100) ;
6. identifier les questions importantes qui n'ont pas été posées ;
7. identifier les occasions commerciales manquées ;
8. évaluer la discipline de pitch (le commercial a-t-il vendu trop tôt ?) ;
9. lister les informations manquantes (Discovery Gaps) ;
10. déterminer si un callback de qualification est nécessaire ;
11. **Opportunity Radar** — analyser l'intégralité du transcript pour détecter TOUS les points d'entrée Digital Selling potentiels, pas seulement l'objet initial du rendez-vous. Un prospect peut ne pas être mûr pour le projet initial (ex : migration) mais présenter un excellent potentiel sur un autre territoire (CRM, CRO, fidélisation, customer care, SEO, marketplace, etc.) ;
12. évaluer le Colorz Fit global (/100) ;
13. réaliser le Colorz Match (expertises, accélérateurs, partenaires/solutions réellement pertinents et documentés dans le référentiel fourni ci-dessous) ;
14. proposer entre 1 et 5 angles commerciaux recommandés, classés par priorité ;
15. identifier les points de vigilance ;
16. proposer les prochaines actions commerciales, classées par timing ;
17. produire un executive summary compréhensible en moins de 30 secondes ;
18. reconstruire le **Buying Committee** : pour chaque interlocuteur déclaré ci-dessous (et tout autre interlocuteur mentionné dans le transcript), proposer une lecture de son rôle réel, de son influence et de son attitude vis-à-vis de Colorz ;
19. produire un **Win Assessment** (Win Score) : la force de la position commerciale de Colorz sur cette opportunité, distincte de l'Opportunity Score.

## BUYING COMMITTEE — RÈGLE IMPORTANTE

Le commercial a pu déclarer un rôle pour chaque interlocuteur AVANT le call (voir "Interlocuteurs déclarés" ci-dessous). Ce rôle déclaré (\`declared_role\`) ne doit JAMAIS être silencieusement écrasé : reporte-le tel quel dans le JSON. Ta propre lecture, à partir du transcript, va dans \`inferred_role\` — un champ séparé, qui peut différer du rôle déclaré. Si le commercial n'a rien déclaré, \`declared_role\` reste \`UNKNOWN\`.

Une personne sympathique n'est PAS automatiquement un champion. Pour considérer un \`inferred_role\` de \`CHAMPION\` (et non \`POTENTIAL_CHAMPION\`), recherche des signaux concrets : influence réelle, accès au pouvoir, intérêt personnel/professionnel au succès du projet, partage d'informations internes utiles, volonté de défendre Colorz, actions concrètes en faveur de l'avancement. En l'absence de ces signaux, utilise \`POTENTIAL_CHAMPION\` plutôt que \`CHAMPION\`.

Inclue également dans le Buying Committee tout interlocuteur mentionné dans le transcript mais absent de la liste déclarée (avec \`declared_role: "UNKNOWN"\`).

## WIN ASSESSMENT (WIN SCORE) — RAISONNEMENT INSPIRÉ DE MEDDPICC, JAMAIS EXPOSÉ COMME TEL

Le Win Score répond à une question différente de l'Opportunity Score :

- **Opportunity Score** : cette opportunité mérite-t-elle que Colorz investisse du temps commercial ? (besoin, potentiel, urgence, fit, valeur)
- **Win Score** : si cette opportunité existe, quelle est la force de notre position pour la GAGNER ?

Ne fusionne JAMAIS ces deux notions. Un très gros projet avec un excellent fit Colorz peut avoir un Win Score faible (concurrent historique implanté, décideur inaccessible, arrivée tardive, critères de choix défavorables). Inversement, une petite opportunité peut avoir un Win Score élevé.

Construis le Win Score en analysant quatre familles de signaux (sans jamais afficher ce framework à l'utilisateur, et sans jamais transformer ceci en probabilité statistique du type "72% de chances de gagner") :

**A. Force du deal** (\`deal_strength\`) : douleur/besoin réel, impact business, urgence, compelling event, budget ou capacité budgétaire, coût du statu quo, fit Colorz.

**B. Position de Colorz** (\`colorz_position\`) : Colorz seul consulté ou non, nombre de concurrents, appel d'offres ou consultation restreinte, arrivée tôt ou tard dans le process, participation à la définition du besoin, relation existante, recommandation/introduction partenaire, concurrent incumbent, différenciation comprise, critères de décision favorables ou non. "Colorz seul" est un signal positif parmi d'autres, jamais une victoire certaine. Considère aussi le statu quo ("ne rien faire") comme une forme de concurrence à part entière — parfois la plus dangereuse. Ne construis PAS de fiche concurrent détaillée (pas de battlecard, pas de comparatif tarifaire) : utilise uniquement ce qui est réellement mentionné (identité du concurrent si citée, nombre, incumbent/challenger, avantage apparent, critères de choix).

**C. Pouvoir & dynamique politique** (\`political_position\`) : décideur économique identifié et rencontré ou non, champion potentiel vs champion réellement actif, sponsor interne, opposants, bloqueurs, accès aux décideurs.

**D. Maîtrise du process** (\`process_control\`) : critères de décision connus, process de décision connu, calendrier crédible, budget, procurement, juridique, appel d'offres, prochaine étape datée ou non, participants identifiés, engagement concret obtenu.

Pour chacune de ces 4 familles, fournis un résumé court (\`summary\`) et une liste de signaux concrets (\`signals\`).

Ajoute ensuite :
- \`win_drivers\` : les facteurs qui jouent EN FAVEUR de Colorz (pain critique, compelling event fort, champion actif, préférence déclarée, Colorz seul consulté, excellente adéquation, accès au décideur, relation existante...). Chaque driver a une \`strength\` (LOW/MEDIUM/HIGH) et un statut FACT/INFERENCE/UNKNOWN.
- \`loss_risks\` : les facteurs qui jouent CONTRE Colorz (concurrent historique implanté, appel d'offres très large, absence de champion, décideur inaccessible, budget non confirmé, urgence faible, statu quo acceptable, critères de choix inconnus, arrivée tardive, prix potentiellement déterminant, prochaine étape faible ou non datée...). Chaque risque a une \`severity\` (LOW/MEDIUM/HIGH/CRITICAL), un statut FACT/INFERENCE/UNKNOWN, et une \`mitigation\` concrète. N'invente JAMAIS un risque uniquement pour remplir la section — un tableau vide est acceptable.
- \`how_to_win\` : maximum 5 actions concrètes pour AUGMENTER les chances de Colorz (obtenir un échange avec le décideur, confirmer le budget, identifier les critères de choix, comprendre la position du concurrent incumbent, obtenir un next step daté, transformer un interlocuteur favorable en champion actif, faire émerger le coût du statu quo...), classées par priorité.

Le \`score\` (0-100) et le \`label\` (Très favorable / Favorable / Incertain / Fragile / Très fragile) résument ces quatre familles. Le \`confidence\` (0-100) ne mesure PAS les chances de gagner mais la quantité et la qualité des informations disponibles pour évaluer la position de Colorz — un score élevé avec une confidence faible doit être interprété comme une lecture favorable mais peu fiable en l'état.

## RÈGLE FONDAMENTALE — FACT / INFERENCE / UNKNOWN

Pour toute information tu dois distinguer :

- **FACT** : explicitement présente dans le transcript.
- **INFERENCE** : raisonnablement déduite du transcript mais non confirmée.
- **UNKNOWN** : non obtenue pendant le call.

Ne transforme JAMAIS une inférence en fait. Ne complète jamais une information manquante avec ton imagination. N'invente jamais un Accélérateur, une expertise ou un partenaire absent du référentiel fourni ci-dessous.

## MÉTHODE OPPORTUNITY RADAR — INTERDICTION DE KEYWORD MATCHING

Pour chaque opportunité détectée, suis ce raisonnement dans l'ordre :

1. identifier le SIGNAL (ce que dit réellement le prospect) ;
2. identifier le PROBLÈME POTENTIEL sous-jacent ;
3. fournir l'EVIDENCE (extrait ou paraphrase du transcript) ;
4. déterminer ce qui est FACT / INFERENCE ;
5. identifier les INFORMATIONS MANQUANTES pour qualifier pleinement cette opportunité ;
6. déterminer les QUESTIONS À POSER pour la qualifier ;
7. identifier le TERRITOIRE DIGITAL SELLING concerné (parmi le référentiel fourni) ;
8. c'est SEULEMENT ENSUITE que tu identifies l'offre / expertise / accélérateur / partenaire potentiellement pertinent.

Exemple de raisonnement INTERDIT (keyword matching direct) :
"Le prospect dit fidélité → recommander automatiquement Loyoly."

Raisonnement ATTENDU :
"Le prospect indique une problématique de réachat → potentiel enjeu fidélisation → ce qui est confirmé : [...] → ce qui reste à qualifier : [...] → si confirmé, envisager les solutions du référentiel pertinentes : [...]."

Chaque opportunité détectée reçoit deux scores INDÉPENDANTS :

- **Opportunity Score (0-100)** : intérêt commercial potentiel.
- **Confidence Score (0-100)** : à quel point les informations obtenues pendant le call permettent réellement d'affirmer l'existence de cette opportunité.

Puis une recommandation :
- **PUSH** : opportunité forte et suffisamment qualifiée.
- **QUALIFY** : potentiel fort mais informations insuffisantes.
- **EXPLORE** : signal intéressant à approfondir.
- **DO_NOT_PUSH** : peu pertinent actuellement ou mauvais timing.

## DISCOVERY SCORE — EXIGENCE

Une conversation agréable n'est PAS automatiquement une bonne discovery. Si des informations critiques sont absentes, pénalise réellement le score. Une excellente discovery doit permettre de répondre : Why change ? Why now ? Why Colorz ? Who decides ? How will they decide ? What constraints exist ? What happens next ?

## SALES PERFORMANCE — EXIGENCE

Sois exigeant mais juste. Le but est de faire progresser le commercial, pas de chercher artificiellement des erreurs. Ne recommande pas de callback inutilement : si la prochaine étape déjà prévue permet naturellement d'obtenir les informations manquantes, indique-le.

---

# RÉFÉRENTIEL COLORZ (méthodologie Probe — source de vérité, ne pas en sortir)

${methodologyBlock}

---

# INFORMATIONS SUR L'OPPORTUNITÉ (contexte connu avant le call)

${contextBlock}

---

# TRANSCRIPT À ANALYSER

${transcriptBlock}

---

# FORMAT DE SORTIE OBLIGATOIRE

Ta réponse finale doit contenir **UNIQUEMENT du JSON valide**, strictement conforme à la structure ci-dessous (mêmes clés, mêmes types). Remplace chaque valeur d'exemple par ton analyse réelle. Les tableaux peuvent contenir plus ou moins d'éléments selon ce que révèle réellement le transcript (un tableau vide [] est acceptable si rien n'a été détecté).

RETURN ONLY VALID JSON.
No Markdown.
No \`\`\`json.
No introduction.
No conclusion.

## SCHÉMA JSON ATTENDU (structure exacte) :

${schemaExample}

---

Effectue maintenant l'analyse complète. Rappelle-toi : ne jamais inventer une information absente du transcript ; distinguer FACT, INFERENCE et UNKNOWN ; être exigeant sur la qualité de la discovery ; ne jamais faire de keyword matching pour l'Opportunity Radar ; ne jamais écraser silencieusement un rôle déclaré dans le Buying Committee ; ne jamais transformer le Win Score en probabilité statistique ; ne jamais construire de fiche concurrent détaillée ; et produire uniquement le JSON valide attendu par Probe, incluant \`buying_committee\` et \`win_assessment\`.`;
  }

  return { buildProbePrompt };
})();
