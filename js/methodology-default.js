/* ==========================================================================
   PROBE — methodology-default.js
   Default "Probe Methodology" — fully editable from the Methodology screen.
   Seeded from the Colorz Digital Selling 360 framework and the Colorz
   Accelerators / Core Model documentation.
   Nothing here is invented: territories, accelerators and partners map to
   what Colorz actually documents. Users can edit/extend freely — Probe
   never re-injects hidden defaults once a methodology has been saved.
   ========================================================================== */

const ProbeMethodologyDefault = {
  version: "1.0",

  keyMarkers: [
    "TCO", "Time-to-market", "Dette technique", "Dépendance agence",
    "Autonomie", "International", "Multi-brand", "Multi-market",
    "Scalabilité", "Performance", "Conversion", "UX", "Omnicanalité",
    "Marketplace", "Catalogue", "PIM", "CRM", "Search", "Personnalisation",
    "Fidélité", "Customer Care", "OMS", "Stock unifié", "Accessibilité",
    "Migration", "Replatforming", "Gouvernance", "Ressources internes",
    "Budget", "Timing", "Compelling Event", "Décideur",
    "Processus de décision", "Concurrence"
  ],

  // Digital Selling 360 — "de la stratégie à la fidélisation"
  territories: [
    {
      name: "Strategy",
      description: "Positionnement, branding, trends, concepts, audit.",
      subitems: ["Positionnement", "Branding", "Trends", "Concepts", "Audit"]
    },
    {
      name: "UX / UI",
      description: "Design UX & UI, identité visuelle, conception, prototype, test.",
      subitems: ["Design UX & UI", "Identité visuelle", "Conception", "Prototype", "Test"]
    },
    {
      name: "Development / Commerce Platform",
      description: "Développement, déploiement Shopify, build ad-hoc, optimisation.",
      subitems: ["Développement", "Déploiement Shopify", "Build ad-hoc", "Optimisation"]
    },
    {
      name: "Acquisition / SEO",
      description: "Acquisition, SEO / S(G)EO, trafic organique, campagnes ciblées.",
      subitems: ["Acquisition", "SEO / S(G)EO", "Trafic organique", "Campagnes ciblées"]
    },
    {
      name: "Omnichannel",
      description: "Stratégie omnicanale.",
      subitems: ["Stratégie omnicanale"]
    },
    {
      name: "Marketplace",
      description: "Marketplace, gestion catalogue produit, retail media.",
      subitems: ["Marketplace", "Gestion catalogue produit", "Retail Media"]
    },
    {
      name: "CRO & Data",
      description: "A/B testing, conversion, data analysis, dashboards.",
      subitems: ["A/B Testing", "Conversion", "Data Analysis", "Dashboards"]
    },
    {
      name: "Social / Content",
      description: "Social media, influence, content, collaboration, communauté.",
      subitems: ["Social Media", "Influence", "Content", "Collaboration", "Communauté"]
    },
    {
      name: "CRM & Loyalty",
      description: "CRM, automation, segmentation, fidélité, relation client.",
      subitems: ["CRM", "Automation", "Segmentation", "Fidélité", "Relation client"]
    }
  ],

  // Colorz expertises — mirrors the territories above but usable as a
  // separate, independently editable list (e.g. to add cross-territory
  // expertises like "Migration & Replatforming" or "Core Model multi-brand").
  expertises: [
    { name: "Migration & Replatforming Shopify", description: "Migration depuis un CMS existant vers Shopify / Shopify Plus, avec approche de reprise de données et continuité SEO." },
    { name: "Core Model multi-marque / multi-site", description: "Socle commun réutilisé et adapté à chaque marque ou marché : gouvernance, duplication industrialisée, autonomie locale." },
    { name: "UX & Design System", description: "Conception UX/UI, design system, atomic design, page builder natif sans dette technique." },
    { name: "SEO & Performance", description: "Continuité et amélioration SEO en migration, performance technique (Core Web Vitals)." },
    { name: "Intégration SI & Middleware", description: "Connexion de Shopify au système d'information client (flux produits, prix, stocks, commandes, expéditions)." },
    { name: "CRM & Fidélisation", description: "Stratégie et outillage CRM, automation, segmentation, programmes de fidélité." },
    { name: "Acquisition & Marketplace", description: "SEO/SGEO, campagnes ciblées, marketplace et retail media." },
    { name: "CRO & Data", description: "A/B testing, analyse de données, dashboards de pilotage de la conversion." }
  ],

  // Accelerators = modules already built and proven by Colorz, reused and
  // adapted per project (documented "up to -70% dev time").
  accelerators: [
    {
      name: "Starter Theme / Starter Core Model",
      description: "Socle Shopify réutilisable et adaptable, incluant l'ensemble des fonctionnalités natives Shopify. Socle déjà éprouvé, réutilisé et adapté à chaque duplication.",
      relevantWhen: ["duplication", "multi-site", "multi-brand", "international", "industrialisation", "autonomie locale", "mutualisation", "time-to-market"]
    },
    {
      name: "Middleware Standardisé",
      description: "Socle middleware pour gérer les flux standards (produits, prix, stocks, commandes, expéditions), afin d'accélérer l'intégration de Shopify dans le SI client.",
      relevantWhen: ["intégration SI", "flux produits/stocks/commandes", "dépendance agence", "time-to-market", "multi-brand"]
    },
    {
      name: "Product Configurator",
      description: "Base de configurateur produit réutilisable, adaptable aux besoins spécifiques du projet (ex : personnalisation, flocage).",
      relevantWhen: ["personnalisation produit", "configuration complexe", "univers licence/sport/luxe"]
    },
    {
      name: "Search Engine / Advanced Search",
      description: "Système de recherche produit sur critères spécifiques, adaptable au contexte client au-delà du moteur natif Shopify.",
      relevantWhen: ["search", "catalogue complexe", "UX", "conversion"]
    }
  ],

  // Partners / solutions — preloaded names only, capabilities kept factual
  // and editable. Nothing here should be treated as an exhaustive capability
  // list; qualification is always required before recommending.
  partners: [
    { name: "Shopify", category: "Plateforme e-commerce", description: "Plateforme commerce headless-ready, socle du Core Model Colorz." },
    { name: "Klaviyo", category: "CRM / Marketing Automation", description: "Plateforme de marketing automation et CRM e-commerce." },
    { name: "Nosto", category: "Personnalisation / CRO", description: "Personnalisation et recommandations produit." },
    { name: "Algolia", category: "Search", description: "Moteur de recherche et de découverte produit." },
    { name: "Akeneo", category: "PIM", description: "Plateforme de gestion de l'information produit (PIM)." },
    { name: "Mirakl", category: "Marketplace", description: "Plateforme de gestion de marketplace." },
    { name: "Storyblok", category: "CMS headless", description: "CMS headless pour contenu éditorial découplé." },
    { name: "Yotpo", category: "Avis / Fidélité", description: "Avis clients, UGC et programmes de fidélité." },
    { name: "OneStock", category: "OMS", description: "Order Management System, gestion de stock unifié." },
    { name: "Gorgias", category: "Customer Care", description: "Plateforme de support client dédiée e-commerce." },
    { name: "Payplug", category: "Paiement", description: "Solution de paiement." },
    { name: "Mollie", category: "Paiement", description: "Solution de paiement." },
    { name: "HiPay", category: "Paiement", description: "Solution de paiement." },
    { name: "Accessiway", category: "Accessibilité", description: "Mise en conformité accessibilité numérique." },
    { name: "Syde", category: "Apps Shopify (merchandising)", description: "Marque du groupe Colorz : applications Shopify pour le merchandising (merch. collections auto., merch. catégories) et l'optimisation e-commerçant." },
    { name: "Loyoly", category: "Fidélité", description: "Programme de fidélité omnicanal intégré à Shopify, espace fidélité dédié côté client, remises utilisables au checkout." },
    { name: "Baback", category: "Retours / SAV", description: "Gestion des retours et échanges clients, portail self-service intégré à Shopify et automatisation du processus de retour." },
    { name: "Sales Genius", category: "Tarification / Promotions", description: "Règles de tarification spécifiques par segment client (remises salarié/partenaire, promotions ciblées, gestion fine des ventes privées)." },
    { name: "Regulo", category: "Facturation", description: "Gestion de l'édition des documents de facturation (factures, avoirs)." },
    { name: "Atlas Pickup Points", category: "Livraison", description: "Gestion des modes de livraison en point relais dans le checkout Shopify." }
  ],

  discoveryRules: [
    "Une excellente discovery doit permettre de répondre : Why change ? Why now ? Why Colorz ? Who decides ? How will they decide ? What constraints exist ? What happens next ?",
    "Une conversation agréable n'est pas automatiquement une bonne discovery — les informations critiques absentes doivent réellement réduire le score.",
    "Distinguer systématiquement FACT / INFERENCE / UNKNOWN ; ne jamais transformer une inférence en fait ; ne jamais inventer une information."
  ],

  salesCoachingRules: [
    "Valoriser les questions ouvertes, l'écoute active, la profondeur des relances et la reformulation.",
    "Signaler tout pitch commercial trop précoce (avant qualification suffisante des enjeux, du budget ou du processus de décision).",
    "Être exigeant mais juste : ne pas inventer des erreurs artificielles pour remplir une section de coaching.",
    "Toujours proposer une meilleure formulation concrète (suggested_wording) plutôt qu'une critique abstraite."
  ]
};
