# PROBE — Discovery Intelligence

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

**Vos données Probe restent stockées localement sur votre appareil.**
