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

  function formatContext(ctx) {
    ctx = ctx || {};
    return [
      `- Prospect / société : ${safe(ctx.prospect)}`,
      `- Opportunité : ${safe(ctx.opportunity)}`,
      `- Date : ${safe(ctx.date)}`,
      `- Commercial : ${safe(ctx.salesRep)}`,
      `- Interlocuteurs : ${safe(ctx.contacts)}`,
      `- Fonctions des interlocuteurs : ${safe(ctx.contactRoles)}`,
      `- Type de call : ${safe(ctx.callType)}`,
      `- Origine du lead : ${safe(ctx.leadSource)}`,
      `- Contexte déjà connu avant le call : ${safe(ctx.knownContext)}`,
      `- Objectif du rendez-vous : ${safe(ctx.callObjective)}`,
      `- Notes pré-call : ${safe(ctx.preCallNotes)}`,
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
17. produire un executive summary compréhensible en moins de 30 secondes.

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

Effectue maintenant l'analyse complète. Rappelle-toi : ne jamais inventer une information absente du transcript ; distinguer FACT, INFERENCE et UNKNOWN ; être exigeant sur la qualité de la discovery ; ne jamais faire de keyword matching pour l'Opportunity Radar ; et produire uniquement le JSON valide attendu par Probe.`;
  }

  return { buildProbePrompt };
})();
