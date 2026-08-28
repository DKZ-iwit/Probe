# PROBE — Discovery Intelligence (V1.1)

> **V1.1 — refactor UX & commercial intelligence.** Ce qui a changé par
> rapport à la V1, en bref : saisie "New Discovery" radicalement simplifiée
> (Entreprise + interlocuteurs + contexte facultatif, plus de formulaire à
> tiroirs), interface principalement en français, un nouveau moteur **Win
> Score** (force de la position commerciale de Colorz, distinct de
> l'Opportunity Score) avec **Buying Committee**, et un écran Résultats à
> deux niveaux ("En 30 secondes" puis "Voir l'analyse complète"). Détail
> complet en fin de document, section **Journal des modifications (V1.1)**.


Probe transforme un discovery call commercial en intelligence exploitable :
**Comprendre → Qualifier → Évaluer → Détecter → Rebondir.**

Conçu initialement pour **Colorz**, agence de Digital Selling (Shopify, UX,
Acquisition, CRM & Fidélisation).

Probe n'est pas un CRM. Il ne se limite pas à évaluer l'opportunité initiale
d'un rendez-vous : son **Opportunity Radar** analyse l'intégralité du
transcript pour détecter et grader tous les points d'entrée Digital Selling
pertinents — même ceux qui n'étaient pas l'objet du rendez-vous.

---

## 1. Architecture

Application 100 % statique, sans build, sans serveur, sans backend :

```
probe/
├── index.html              application shell + navigation
├── manifest.json            PWA manifest
├── sw.js                     service worker (cache versionné, offline)
├── css/style.css             design system (dark/light)
├── js/
│   ├── db.js                 wrapper IndexedDB
│   ├── schema.js              contrat JSON Probe ↔ IA ↔ Probe
│   ├── methodology-default.js référentiel Colorz par défaut (éditable)
│   ├── prompt-generator.js    génère le Probe Prompt (aucun placeholder)
│   └── app.js                 router + toutes les vues (HTML string templates)
└── icons/                     icônes PWA (standard + maskable)
```

- **HTML / CSS / JavaScript vanilla.** Pas de React, pas de Vue, pas de Node
  requis pour faire tourner l'app (Node n'est utilisé que pour les tests
  automatisés du dépôt, voir plus bas).
- Navigation par `hash` (`#home`, `#new`, `#history`, `#methodology`,
  `#settings`, `#results/<id>`), donc utilisable au clavier, au retour
  navigateur, et redémarrable après un refresh (le brouillon en cours de
  "New Discovery" est persisté à chaque frappe).
- **Aucune requête réseau n'est jamais déclenchée par l'application.** Aucune
  clé API, aucune authentification. Le seul moment où de l'IA intervient,
  c'est manuellement, en dehors de Probe (étape 3 ci-dessous).

## 2. Stockage

Tout est local, dans IndexedDB (base `probe-db`), via `js/db.js` :

| Store         | Contenu                                                         |
|---------------|------------------------------------------------------------------|
| `analyses`    | une entrée par discovery analysée (contexte + JSON résultat)     |
| `methodology` | le référentiel Probe/Colorz courant (1 enregistrement)           |
| `settings`    | thème, conservation du transcript, etc. (1 enregistrement)       |
| `drafts`      | le brouillon "New Discovery" en cours (1 enregistrement)         |

Le transcript brut n'est conservé après import de l'analyse que si le
réglage **Settings → Conserver le transcript** est activé (désactivé par
défaut). Le Service Worker (`sw.js`) ne touche jamais à IndexedDB : il ne
gère que le cache des fichiers de l'application shell pour le mode offline.

## 3. Fonctionnement du générateur de prompt — la boucle centrale

```
PREPARE → TRANSCRIPT → GENERATE PROBE PROMPT → (coller dans Claude/ChatGPT)
        → copier la réponse JSON → IMPORT ANALYSIS → RESULTS
```

Le bouton **GENERATE PROBE PROMPT** (`ProbePromptGenerator.buildProbePrompt`
dans `js/prompt-generator.js`) construit un prompt **totalement autonome** :
rôle, règles d'analyse (FACT / INFERENCE / UNKNOWN), méthode Opportunity
Radar, référentiel Colorz complet (injecté en JSON depuis `Methodology`),
contexte de l'opportunité, transcript intégral, et schéma JSON exact attendu
(généré depuis `js/schema.js`). **Aucun placeholder ne subsiste** dans le
texte final — c'est vérifié par les tests automatisés du dépôt.

L'utilisateur copie ce prompt dans Claude ou ChatGPT, récupère la réponse
JSON, et la colle dans **Paste Probe JSON → IMPORT ANALYSIS**. Probe ne fait
jamais l'appel IA lui-même.

## 4. Contrat JSON (Probe → IA → Probe)

`js/schema.js` définit un unique objet `EXAMPLE`, utilisé à la fois :

1. pour générer l'exemple structurel injecté dans le Probe Prompt ;
2. pour valider l'import (`ProbeSchema.validate`) — validation légère : les
   clés essentielles (`executive_summary`, `client_mapping`,
   `discovery_score`, `sales_performance`, `opportunity_radar`,
   `colorz_fit`) sont vérifiées, le reste est optionnel et s'affiche de
   façon dégradée si absent plutôt que de faire planter l'import ;
3. pour construire le dashboard (Step 04 / Results).

`ProbeSchema.extractJson` nettoie automatiquement les balises ```json```
éventuelles, trim les espaces, et tente d'extraire l'objet JSON si quelques
caractères parasites l'entourent.

## 5. Opportunity Radar

Chaque territoire Digital Selling détecté reçoit :

- un **Opportunity Score** (0–100, intérêt commercial potentiel) ;
- un **Confidence Score** (0–100, degré de certitude au vu du call) —
  **indépendant** du premier ;
- une **Recommendation** : `PUSH`, `QUALIFY`, `EXPLORE` ou `DO_NOT_PUSH`.

Le prompt interdit explicitement le simple *keyword matching* ("le prospect
dit fidélité → recommander Loyoly") et impose un raisonnement en 8 étapes
(signal → problème potentiel → evidence → FACT/INFERENCE → informations
manquantes → questions à poser → territoire → offre/accélérateur/partenaire
pertinent).

Le scénario de test livré avec le dépôt (`test_e2e.js`) simule précisément
le cas décrit dans le cahier des charges : un prospect rencontré pour une
migration peu urgente, mais avec un fort signal CRM — et vérifie que Probe
affiche bien `Migration → DO_NOT_PUSH` et `CRM → PUSH` en tête de radar.

## 6. Methodology — un référentiel éditable, jamais codé en dur

L'écran **Methodology** permet d'éditer, sans toucher au code :

- **Key Markers** (TCO, dette technique, multi-brand, etc.) ;
- **Digital Selling Territories** (Strategy, UX/UI, Development, Acquisition,
  Omnichannel, Marketplace, CRO & Data, Social/Content, CRM & Loyalty —
  repris du support Colorz "Digital Selling 360, de la stratégie à la
  fidélisation") ;
- **Colorz Expertises** ;
- **Colorz Accelerators** — modules déjà développés et éprouvés par Colorz
  (Starter Theme / Starter Core Model, Middleware Standardisé, Product
  Configurator, Search Engine / Advanced Search), avec leurs conditions de
  pertinence ;
- **Partners / Solutions** (Shopify, Klaviyo, Nosto, Algolia, Akeneo,
  Mirakl, Storyblok, Yotpo, OneStock, Gorgias, Payplug, Mollie, HiPay,
  Accessiway, ainsi que Syde, Loyoly, Baback, Sales Genius, Regulo, Atlas
  Pickup Points issus du support Colorz fourni) ;
- **Discovery Rules** et **Sales Coaching Rules** (règles textuelles qui
  cadrent l'exigence de l'analyse IA).

Chaque modification est sauvegardée dans IndexedDB et réutilisée dès le
prochain **GENERATE PROBE PROMPT** — sans toucher au code de l'application.
Le prompt ne cite jamais un accélérateur ou un partenaire absent de ce
référentiel.

## 7. Procédure GitHub Pages

1. Créez un repository GitHub nommé `probe` (ou tout autre nom — les chemins
   sont relatifs, donc l'app fonctionne aussi bien à la racine que dans un
   sous-répertoire).
2. Copiez-y le contenu de ce dossier (`index.html`, `manifest.json`, `sw.js`,
   `css/`, `js/`, `icons/`) — **inutile de copier** `package.json`,
   `node_modules/`, `test.html` ou les fichiers `test_*.js`, qui ne servent
   qu'aux tests automatisés du dépôt et n'ont aucun rôle en production.
3. Dans **Settings → Pages**, choisissez la branche `main` (dossier racine).
4. L'application est alors accessible sur
   `https://USERNAME.github.io/probe/`, installable depuis Chrome Android
   (ou "Ajouter à l'écran d'accueil" sur iOS/desktop), et fonctionne
   offline une fois le premier chargement effectué (cache versionné dans
   `sw.js` — changez `CACHE_VERSION` à chaque mise à jour de fichiers pour
   forcer le rafraîchissement du cache).

## 8. Tests automatisés (dépôt uniquement — pas nécessaires en production)

Deux scripts Node valident la logique et le parcours complet avant
livraison (ils ne sont *pas* requis pour faire tourner l'application, qui
n'a besoin d'aucun outil Node) :

```bash
npm install fake-indexeddb jsdom --no-save
node test_core.js   # db.js / schema.js / prompt-generator.js en isolation
node test_e2e.js    # parcours complet : Prepare → Transcript → Generate →
                     # Import → Results → History → Methodology → Settings →
                     # export backup → simulation de reload / persistance
```

`test_e2e.js` reproduit le scénario du cahier des charges : préparation →
transcript → génération du prompt (vérifie l'absence de tout placeholder et
la présence du transcript, de la méthodologie et du schéma JSON) →
simulation d'une réponse IA → import → vérification du Client Mapping, des
scores, de l'Opportunity Radar (Migration → `DO_NOT_PUSH`, CRM → `PUSH`), du
Colorz Match et du Callback → sauvegarde → rechargement simulé → persistance
confirmée → export/import de backup.

---

## 9. Journal des modifications (V1.1)

Refactor **ciblé** : aucune réécriture d'architecture. IndexedDB, la
mécanique Probe → prompt → Claude/ChatGPT → JSON → Probe, GitHub Pages, et
le référentiel Colorz existant sont conservés à l'identique.

### Fichiers modifiés

- `js/schema.js` — ajout de deux clés top-level **optionnelles** :
  `buying_committee` (lecture structurée des interlocuteurs) et
  `win_assessment` (Win Score). `REQUIRED_TOP_LEVEL_KEYS` **n'a pas changé** :
  les analyses V1 sans ces clés restent valides à l'import.
- `js/prompt-generator.js` — `formatContext()` réécrit pour le nouveau
  contexte (entreprise, interlocuteurs multiples avec rôle déclaré, infos
  commerciales facultatives) ; ajout des sections de règles Win Score
  (raisonnement inspiré de MEDDPICC, jamais exposé comme tel) et Buying
  Committee (ne jamais écraser un rôle déclaré) dans le prompt généré.
- `js/app.js` — réécrit en profondeur : saisie "New Discovery" simplifiée
  (interlocuteurs dynamiques, bloc "+ Infos commerciales" replié, antisèche
  Discovery à 6 dimensions au lieu de la checklist détaillée), écran
  Résultats à deux niveaux ("En 30 secondes" + "Voir l'analyse complète"),
  rendu Win Score / Buying Committee, libellés français, réglage "Nom du
  commercial" dans Settings. Toute fonction de rendu tolère l'absence des
  nouveaux champs (analyses V1).
- `css/style.css` — additions uniquement (interlocuteurs, bloc repliable,
  antisèche Discovery, panneau "En 30 secondes", badges Win Score, cartes
  Buying Committee) ; rien retiré.
- `sw.js` — `CACHE_VERSION` passé à `probe-cache-v2`.
- `index.html` — libellés de navigation en français.
- `js/methodology-default.js`, `js/db.js` — **non modifiés**.

### Évolution du schéma JSON

Deux structures ajoutées, toutes deux optionnelles pour rester compatibles :

- `buying_committee: [{ name, job_title, declared_role, inferred_role, role_confidence, evidence, influence_level, attitude_to_colorz, notes }]`
- `win_assessment: { score, confidence, label, deal_strength, colorz_position, political_position, process_control, win_drivers, loss_risks, how_to_win }`

### Stratégie de compatibilité avec les anciennes analyses

- `ProbeSchema.REQUIRED_TOP_LEVEL_KEYS` reste inchangé — une analyse V1 sans
  `win_assessment` ni `buying_committee` est toujours **valide** à l'import.
- Chaque fonction de rendu concernée (`renderPanel30s`, `renderWinFactors`,
  `renderLossRisksCondensed`, `renderWinScoreDetail`, `renderBuyingCommittee`)
  vérifie explicitement la présence de la donnée et affiche un message de
  repli ("Win Score non disponible pour cette analyse", "Aucun interlocuteur
  qualifié dans cette analyse") plutôt que de planter ou d'afficher
  `undefined`.
- Le contexte interne (`analysis.context`) est passé de `prospect` /
  `contacts` / `contactRoles` à `company` / `interlocutors[]` — mais ce
  contexte n'est utilisé que pour régénérer un prompt, jamais pour l'affichage
  des résultats déjà importés, donc aucune migration de données n'est
  nécessaire pour les analyses existantes.
- Un éventuel brouillon "New Discovery" en cours au moment de la mise à jour
  (ancien format) est migré à la volée par `migrateDraft()` plutôt que perdu.

### Modifications IndexedDB

Aucune. Mêmes stores, même version (`probe-db`, `DB_VERSION = 1`). Les
nouvelles clés vivent dans le même champ `result` (JSON libre) que le reste
de l'analyse — pas de nouvel object store ni de migration de schéma requise.

### Nouvelle version du cache / service worker

`CACHE_VERSION` passé de `probe-cache-v1` à `probe-cache-v2` dans `sw.js` :
à la prochaine visite, les utilisateurs ayant déjà installé Probe récupèrent
automatiquement les nouveaux fichiers (l'ancien cache est purgé à
l'activation). Le service worker ne touche toujours jamais à IndexedDB.

### Tests réalisés

`test_core.js` (logique pure) et `test_e2e.js` (parcours complet en jsdom)
couvrent notamment :

1. **Régression V1** : une analyse pré-existante, seedée directement dans
   IndexedDB *avant* le boot de l'app dans le format V1 exact (sans
   `win_assessment` ni `buying_committee`, ancien `context.prospect`),
   s'ouvre depuis l'historique sans erreur et affiche des messages de repli
   corrects plutôt que des `undefined`.
2. **Nouvelle discovery** : création, ajout de plusieurs interlocuteurs
   (rôle par défaut *Inconnu*, un *Décideur* explicite), blocage de la
   validation si l'entreprise est vide, bloc "+ Infos commerciales" replié
   et laissable entièrement vide, transcript injecté, prompt généré sans
   aucun placeholder et contenant bien `win_assessment` / `buying_committee`
   / les interlocuteurs déclarés.
3. **Import + Win Score** : JSON simulé avec `win_assessment` et
   `buying_committee` (dont un rôle déclaré différent du rôle inféré par
   l'IA, rendu explicitement comme "Champion potentiel — à confirmer") ;
   panneau "En 30 secondes", Opportunity Radar en libellés français (À
   POUSSER / NON PRIORITAIRE...), blocs "Ce qui peut faire gagner",
   "Risques de perte", "Ce qu'il manque", Next Steps, puis "Voir l'analyse
   complète" révélant Buying Committee et Win Score détaillé (4 familles +
   drivers + risks + how-to-win).
4. **Réglages** : nom du commercial persisté et repris sur une nouvelle
   discovery.
5. **Persistance** : rechargement complet de l'app (nouvelle instance
   jsdom sur la même base fake-indexeddb) — les deux analyses (V1 seedée +
   V1.1 nouvellement importée) sont toujours présentes.
6. **Aucun appel réseau** : vérification statique (`fetch(`, `XMLHttpRequest`,
   URL `http://`/`https://`) absente de `js/app.js`.

41 assertions passent (`node test_core.js && node test_e2e.js`).

---

**Vos données Probe restent stockées localement sur votre appareil.**
