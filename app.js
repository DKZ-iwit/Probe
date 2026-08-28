/* ==========================================================================
   PROBE — app.js (V1.1)
   Router + views + state. Vanilla JS, no framework, no build step.
   All data lives in IndexedDB (see db.js). No network calls are ever made
   from this file.

   V1.1 refactor: simplified "New Discovery" entry, French-first UI, Win
   Score / Buying Committee engines, "En 30 secondes" results panel with a
   "Voir l'analyse complète" second level. Fully backward compatible with
   V1 analyses (missing win_assessment / buying_committee render gracefully).
   ========================================================================== */

(() => {
  "use strict";

  const DRAFT_ID = "draft-current";

  const CALL_TYPES = ["Premier contact", "Qualification", "Follow-up", "Découverte technique", "Pré-proposition", "Autre"];

  const ROLE_TYPES = [
    { code: "UNKNOWN", label: "Inconnu" },
    { code: "DECISION_MAKER", label: "Décideur" },
    { code: "CHAMPION", label: "Champion" },
    { code: "INFLUENCER", label: "Influenceur" },
    { code: "USER", label: "Utilisateur" },
    { code: "BLOCKER", label: "Bloqueur" },
  ];
  const ROLE_LABEL = Object.fromEntries(ROLE_TYPES.map((r) => [r.code, r.label]));
  ROLE_LABEL.POTENTIAL_CHAMPION = "Champion potentiel — à confirmer";

  const COMPETITION_OPTIONS = [
    { code: "UNKNOWN", label: "Inconnue" },
    { code: "COLORZ_ONLY", label: "Colorz seul" },
    { code: "TWO", label: "2 agences / prestataires" },
    { code: "THREE_PLUS", label: "3+ agences / prestataires" },
    { code: "RFP", label: "Appel d'offres" },
  ];
  const COLORZ_POSITION_OPTIONS = [
    { code: "UNKNOWN", label: "Inconnue" },
    { code: "CHALLENGER", label: "Entrant / Challenger" },
    { code: "EXISTING_RELATIONSHIP", label: "Déjà en relation" },
    { code: "HISTORIC_PARTNER", label: "Partenaire historique" },
    { code: "CURRENT_AGENCY", label: "Prestataire / agence actuelle" },
  ];
  const ORIGIN_OPTIONS = [
    { code: "UNKNOWN", label: "Inconnue" },
    { code: "INBOUND", label: "Inbound" },
    { code: "OUTBOUND", label: "Outbound" },
    { code: "PARTNER", label: "Partenaire" },
    { code: "REFERRAL", label: "Recommandation" },
    { code: "EXISTING_CLIENT", label: "Client existant" },
    { code: "OTHER", label: "Autre" },
  ];

  const REC_FR = { PUSH: "À POUSSER", QUALIFY: "À QUALIFIER", EXPLORE: "À EXPLORER", DO_NOT_PUSH: "NON PRIORITAIRE" };
  const REC_EMOJI = { PUSH: "🔥", QUALIFY: "🎯", EXPLORE: "👀", DO_NOT_PUSH: "🧊" };
  const REC_CLASS = { PUSH: "badge-push", QUALIFY: "badge-qualify", EXPLORE: "badge-explore", DO_NOT_PUSH: "badge-donotpush" };

  const WIN_LABEL_CLASS = {
    "Très favorable": "tres-favorable", "Favorable": "favorable", "Incertain": "incertain",
    "Fragile": "fragile", "Très fragile": "tres-fragile"
  };

  const DISCOVERY_DIMENSIONS = [
    { key: "contexte", title: "1. Contexte", questions: ["Que possède le prospect aujourd'hui ?", "Comment fonctionne son environnement ?"], markers: ["TCO", "Dette technique", "Dépendance agence", "Ressources internes", "Gouvernance"] },
    { key: "probleme", title: "2. Problème", questions: ["Qu'est-ce qui coince ?", "Pourquoi envisage-t-il de changer ?"], markers: ["Scalabilité", "Performance", "UX", "Migration", "Replatforming"] },
    { key: "enjeu", title: "3. Enjeu", questions: ["Quel impact business ?", "Qu'essaie-t-il réellement d'améliorer ?"], markers: ["Conversion", "International", "Multi-brand", "CRM", "Fidélité", "Omnicanalité"] },
    { key: "timing", title: "4. Timing", questions: ["Pourquoi maintenant ?", "Existe-t-il une échéance ou un événement déclencheur ?"], markers: ["Timing", "Compelling Event"] },
    { key: "decision", title: "5. Décision", questions: ["Qui décide ?", "Quel budget ?", "Quel process ?", "Quelle concurrence ?"], markers: ["Budget", "Décideur", "Processus de décision", "Concurrence"] },
    { key: "suite", title: "6. Suite", questions: ["Quelle prochaine étape ?", "Quand ?", "Avec qui ?", "Quel engagement concret ?"], markers: [] },
  ];

  let state = {
    view: "home",
    resultsId: null,
    methodology: null,
    settings: null,
    analyses: [],
    draft: null,
    openAccordions: new Set(),
    openRadarItems: new Set(),   // composite keys "namespace:index"
    fullAnalysisOpen: false,
    commercialInfoOpen: false,
  };

  // ---------------------------------------------------------------- utils
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function uid(prefix = "id") {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function escapeHtml(str) {
    if (str === undefined || str === null) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function nl2br(str) {
    return escapeHtml(str).replace(/\n/g, "<br>");
  }

  function fmtDate(d) {
    if (!d) return "—";
    try {
      const dt = new Date(d);
      if (isNaN(dt.getTime())) return String(d);
      return dt.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
    } catch { return String(d); }
  }

  function toast(msg, ms = 2600) {
    const el = $("#toast");
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { el.hidden = true; }, ms);
  }

  function badgeClass(prefix, value) {
    if (!value) return `badge badge-${prefix}`;
    return `badge badge-${String(value).toLowerCase().replace(/_/g, "")}`;
  }

  function num(v, fallback = 0) {
    const n = Number(v);
    return isNaN(n) ? fallback : n;
  }

  function avgOf(list, fn) {
    const vals = list.map(fn).filter((v) => v !== undefined && v !== null && !isNaN(Number(v)));
    if (!vals.length) return null;
    return Math.round(vals.reduce((s, v) => s + Number(v), 0) / vals.length);
  }

  function downloadJson(filename, obj) {
    try {
      const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (e) {
      toast("Export impossible dans cet environnement.");
    }
  }

  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
        document.body.appendChild(ta); ta.focus(); ta.select();
        document.execCommand("copy"); ta.remove();
        return true;
      } catch { return false; }
    }
  }

  function slug(s) {
    return String(s || "probe").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "probe";
  }

  // ---------------------------------------------------------------- data layer
  async function loadMethodology() {
    const rec = await ProbeDB.get("methodology", "current");
    state.methodology = rec ? rec.data : JSON.parse(JSON.stringify(ProbeMethodologyDefault));
  }
  async function saveMethodology() {
    await ProbeDB.put("methodology", { key: "current", data: state.methodology, updatedAt: Date.now() });
  }
  async function loadSettings() {
    const rec = await ProbeDB.get("settings", "current");
    state.settings = rec ? Object.assign({ theme: "dark", keepTranscript: false, commercial: "" }, rec.data) : { theme: "dark", keepTranscript: false, commercial: "" };
    applyTheme();
  }
  async function saveSettings() {
    await ProbeDB.put("settings", { key: "current", data: state.settings, updatedAt: Date.now() });
  }
  function applyTheme() {
    document.documentElement.setAttribute("data-theme", state.settings.theme === "light" ? "light" : "dark");
  }
  async function loadAnalyses() {
    const rows = await ProbeDB.getAll("analyses");
    state.analyses = rows.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }

  function newInterlocutor() {
    return { id: uid("person"), name: "", role: "", roleType: "UNKNOWN" };
  }

  function freshDraft() {
    return {
      id: DRAFT_ID,
      step: 1,
      context: {
        company: "",
        date: new Date().toISOString().slice(0, 10),
        salesRep: (state.settings && state.settings.commercial) || "",
        callType: CALL_TYPES[0],
        knownContext: "",
        callObjective: "",
        interlocutors: [newInterlocutor()],
        commercialInfo: { competition: "UNKNOWN", colorzPosition: "UNKNOWN", origin: "UNKNOWN" },
      },
      transcript: "",
      promptText: "",
      importDraftJson: "",
    };
  }

  // Defensive migration for a draft that may have been saved by an older
  // version of Probe (or is otherwise missing fields this version expects).
  function migrateDraft(d) {
    if (!d) return freshDraft();
    d.context = d.context || {};
    if (d.context.company === undefined) d.context.company = d.context.prospect || "";
    if (!Array.isArray(d.context.interlocutors)) d.context.interlocutors = [];
    if (!d.context.interlocutors.length) d.context.interlocutors = [newInterlocutor()];
    if (!d.context.commercialInfo) d.context.commercialInfo = { competition: "UNKNOWN", colorzPosition: "UNKNOWN", origin: "UNKNOWN" };
    if (!d.context.date) d.context.date = new Date().toISOString().slice(0, 10);
    if (!d.context.callType) d.context.callType = CALL_TYPES[0];
    if (!d.context.salesRep && state.settings?.commercial) d.context.salesRep = state.settings.commercial;
    d.transcript = d.transcript || "";
    d.promptText = d.promptText || "";
    d.importDraftJson = d.importDraftJson || "";
    d.step = d.step || 1;
    return d;
  }

  async function loadDraft() {
    const d = await ProbeDB.get("drafts", DRAFT_ID);
    state.draft = migrateDraft(d);
  }
  async function saveDraft() {
    await ProbeDB.put("drafts", state.draft);
  }
  async function clearDraft() {
    state.draft = freshDraft();
    await ProbeDB.delete("drafts", DRAFT_ID);
  }

  // ---------------------------------------------------------------- router
  const ROUTES = ["home", "new", "history", "methodology", "settings", "results"];

  function navigate(view, opts = {}) {
    if (!ROUTES.includes(view)) view = "home";
    state.view = view;
    if (view === "results") state.resultsId = opts.id || state.resultsId;
    const hash = view === "results" ? `#results/${state.resultsId}` : `#${view}`;
    if (location.hash !== hash) location.hash = hash;
    render();
    try { window.scrollTo({ top: 0, behavior: "auto" }); } catch (e) { /* ignore in non-browser test env */ }
  }

  function parseHash() {
    const raw = (location.hash || "#home").replace("#", "");
    const [view, id] = raw.split("/");
    return { view: view || "home", id };
  }

  window.addEventListener("hashchange", () => {
    const { view, id } = parseHash();
    state.view = ROUTES.includes(view) ? view : "home";
    if (id) state.resultsId = id;
    render();
  });

  // ---------------------------------------------------------------- nav UI
  function setupNav() {
    $$(".tab-btn, [data-nav]").forEach((el) => {
      el.addEventListener("click", () => {
        const v = el.getAttribute("data-nav");
        $("#tabsMobile").classList.remove("open");
        navigate(v);
      });
    });
    $("#burgerBtn").addEventListener("click", () => $("#tabsMobile").classList.toggle("open"));
  }

  function highlightNav() {
    $$(".tab-btn").forEach((el) => {
      const v = el.getAttribute("data-nav");
      el.classList.toggle("active", v === state.view || (v === "new" && state.view === "results"));
    });
  }

  // ============================================================ RENDER ROOT
  function render() {
    highlightNav();
    const view = $("#view");
    switch (state.view) {
      case "home": view.innerHTML = renderHome(); bindHome(); break;
      case "new": view.innerHTML = renderNewDiscovery(); bindNewDiscovery(); break;
      case "history": view.innerHTML = renderHistory(); bindHistory(); break;
      case "methodology": view.innerHTML = renderMethodology(); bindMethodology(); break;
      case "settings": view.innerHTML = renderSettings(); bindSettings(); break;
      case "results": view.innerHTML = renderResultsPage(); bindResultsPage(); break;
      default: view.innerHTML = renderHome(); bindHome();
    }
  }

  // ============================================================ HOME
  function computeHomeStats() {
    const list = state.analyses;
    const n = list.length;
    const discoveryAvg = avgOf(list, (a) => a.result?.discovery_score?.global);
    const salesAvg = avgOf(list, (a) => a.result?.sales_performance?.global);
    const fitAvg = avgOf(list, (a) => a.result?.colorz_fit?.score);
    const winAvg = avgOf(list, (a) => a.result?.win_assessment?.score);
    const callbacks = list.filter((a) => a.result?.callback?.recommended).length;

    const territoryScore = {};
    list.forEach((a) => {
      (a.result?.opportunity_radar || []).forEach((o) => {
        if (!o.territory) return;
        if (!territoryScore[o.territory]) territoryScore[o.territory] = { total: 0, count: 0 };
        territoryScore[o.territory].total += num(o.opportunity_score);
        territoryScore[o.territory].count += 1;
      });
    });
    const topTerritories = Object.entries(territoryScore)
      .map(([name, v]) => ({ name, avg: Math.round(v.total / v.count), count: v.count }))
      .sort((a, b) => b.avg - a.avg || b.count - a.count)
      .slice(0, 5);

    const trendSlice = [...list].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)).slice(-6);
    const discoveryTrend = trendSlice.map((a) => num(a.result?.discovery_score?.global));
    const salesTrend = trendSlice.map((a) => num(a.result?.sales_performance?.global));

    return { n, discoveryAvg, salesAvg, fitAvg, winAvg, callbacks, topTerritories, discoveryTrend, salesTrend };
  }

  function renderHome() {
    const s = computeHomeStats();
    if (s.n === 0) {
      return `
      <div class="hero">
        <div class="brand-mark">◎</div>
        <div class="hero-title">PROBE</div>
        <div class="hero-sub">Discovery Intelligence</div>
      </div>
      <div class="empty-state">
        <div class="big">📡</div>
        <p><strong>Aucun call analysé pour l'instant.</strong></p>
        <p class="small">Renseignez l'entreprise, collez le transcript, générez le Probe Prompt, et importez l'analyse pour construire votre premier dashboard.</p>
        <div class="mt16"><button class="btn btn-primary" data-action="new-discovery">+ NOUVELLE DISCOVERY</button></div>
      </div>`;
    }

    return `
    <div class="hero">
      <div class="brand-mark">◎</div>
      <div class="hero-title">PROBE</div>
      <div class="hero-sub">Discovery Intelligence</div>
    </div>

    <div class="grid grid-4 mt16">
      <div class="stat"><div class="stat-label">Calls analysés</div><div class="stat-value">${s.n}</div></div>
      <div class="stat"><div class="stat-label">Discovery Score moyen</div><div class="stat-value">${s.discoveryAvg ?? "—"}<small>/100</small></div>
        ${s.discoveryTrend.length > 1 ? `<div class="stat-trend">${s.discoveryTrend.join(" → ")}</div>` : ""}</div>
      <div class="stat"><div class="stat-label">Win Score moyen</div><div class="stat-value">${s.winAvg ?? "—"}<small>/100</small></div></div>
      <div class="stat"><div class="stat-label">Colorz Fit moyen</div><div class="stat-value">${s.fitAvg ?? "—"}<small>/100</small></div></div>
    </div>

    <div class="grid grid-2 mt16">
      <div class="card">
        <div class="card-title">📞 Callbacks recommandés</div>
        <div class="stat-value">${s.callbacks} <small>/ ${s.n} calls</small></div>
      </div>
      <div class="card">
        <div class="card-title">📡 Principales opportunités Digital Selling détectées</div>
        ${s.topTerritories.length ? s.topTerritories.map((t) => `
          <div class="subscore-row">
            <div class="label">${escapeHtml(t.name)}</div>
            <div class="bar-track"><div class="bar-fill" style="width:${Math.min(100, t.avg)}%"></div></div>
            <div class="val">${t.avg}</div>
          </div>`).join("") : `<p class="small muted">Pas encore assez de données.</p>`}
      </div>
    </div>

    <div class="center mt24">
      <button class="btn btn-primary" data-action="new-discovery">+ NOUVELLE DISCOVERY</button>
    </div>
    <footer class="app-footer">Vos données Probe restent stockées localement sur votre appareil.</footer>
    `;
  }

  function bindHome() {
    $$('[data-action="new-discovery"]').forEach((b) => b.addEventListener("click", async () => {
      await clearDraft();
      navigate("new");
    }));
  }

  // ============================================================ NEW DISCOVERY
  function renderStepper(current) {
    const steps = [
      { n: 1, label: "PRÉPARER" },
      { n: 2, label: "TRANSCRIPT" },
      { n: 3, label: "ANALYSER" },
      { n: 4, label: "RÉSULTATS" },
    ];
    return `<div class="stepper">${steps.map((s) => `
      <div class="step-pill ${s.n === current ? "active" : ""} ${s.n < current ? "done" : ""}">
        <span class="num">0${s.n}</span>${s.label}
      </div>`).join("")}</div>`;
  }

  function renderNewDiscovery() {
    const d = state.draft || freshDraft();
    const step = d.step || 1;
    return `
    <div class="page-head">
      <div class="page-eyebrow">Nouvelle Discovery</div>
      <h1 class="page-title">${d.context.company ? escapeHtml(d.context.company) : "Nouvelle discovery"}</h1>
      <p class="page-sub">Quelques éléments, le transcript, et Probe s'occupe du reste.</p>
    </div>
    ${renderStepper(step)}
    <div id="stepBody">${step === 1 ? renderStep1(d) : step === 2 ? renderStep2(d) : step === 3 ? renderStep3(d) : renderStep4(d)}</div>
    `;
  }

  function renderStep1(d) {
    const c = d.context;
    const interlocutorRows = c.interlocutors.map((p, i) => `
      <div class="interlocutor-row" data-person="${p.id}">
        <input type="text" data-person-field="name" data-person-id="${p.id}" placeholder="Nom" value="${escapeHtml(p.name)}">
        <input type="text" data-person-field="role" data-person-id="${p.id}" placeholder="Fonction" value="${escapeHtml(p.role)}">
        <select data-person-field="roleType" data-person-id="${p.id}">
          ${ROLE_TYPES.map((r) => `<option value="${r.code}" ${p.roleType === r.code ? "selected" : ""}>${r.label}</option>`).join("")}
        </select>
        <button class="interlocutor-remove" data-remove-person="${p.id}" title="Supprimer" ${c.interlocutors.length <= 1 ? "disabled" : ""}>✕</button>
      </div>`).join("");

    const ci = c.commercialInfo;
    const selectOptions = (options, current) => options.map((o) => `<option value="${o.code}" ${current === o.code ? "selected" : ""}>${o.label}</option>`).join("");

    const dimensionCards = DISCOVERY_DIMENSIONS.map((dim) => {
      const markers = (dim.markers || []).filter((m) => state.methodology.keyMarkers.includes(m));
      return `<div class="dimension-card">
        <div class="dimension-title">${escapeHtml(dim.title)}</div>
        ${dim.questions.map((q) => `<div class="dimension-q">${escapeHtml(q)}</div>`).join("")}
        ${markers.length ? `<div class="dimension-markers">${markers.map((m) => `<span class="chip">${escapeHtml(m)}</span>`).join("")}</div>` : ""}
      </div>`;
    }).join("");

    return `
    <div class="card">
      <div class="field">
        <label class="field-label">Entreprise<span class="required-mark">*</span></label>
        <input type="text" id="f_company" value="${escapeHtml(c.company)}" placeholder="Ex. Oreca">
      </div>

      <div class="grid grid-2">
        <div class="field"><label class="field-label">Date</label><input type="date" id="f_date" value="${escapeHtml(c.date)}"></div>
        <div class="field"><label class="field-label">Type de call</label>
          <select id="f_callType">${CALL_TYPES.map((t) => `<option value="${t}" ${c.callType === t ? "selected" : ""}>${t}</option>`).join("")}</select>
        </div>
      </div>

      <div class="field">
        <label class="field-label">Interlocuteurs</label>
        <div id="interlocutorList">${interlocutorRows}</div>
        <button class="btn btn-sm mt8" data-action="add-person">+ Ajouter un interlocuteur</button>
      </div>

      <div class="field">
        <label class="field-label">Contexte / opportunité connue</label>
        <textarea id="f_knownContext" rows="2" placeholder="Ex. Migration Shopify envisagée, premier échange suite à une introduction partenaire.">${escapeHtml(c.knownContext)}</textarea>
      </div>
      <div class="field">
        <label class="field-label">Objectif du rendez-vous</label>
        <textarea id="f_callObjective" rows="2" placeholder="Facultatif">${escapeHtml(c.callObjective)}</textarea>
      </div>

      <button class="collapsible-toggle ${state.commercialInfoOpen ? "open" : ""}" data-action="toggle-commercial-info">
        <span class="chev">›</span> + Infos commerciales
      </button>
      <div class="collapsible-body ${state.commercialInfoOpen ? "open" : ""}" id="commercialInfoBody">
        <div class="grid grid-3">
          <div class="field"><label class="field-label">Concurrence</label><select id="f_competition">${selectOptions(COMPETITION_OPTIONS, ci.competition)}</select></div>
          <div class="field"><label class="field-label">Position de Colorz</label><select id="f_colorzPosition">${selectOptions(COLORZ_POSITION_OPTIONS, ci.colorzPosition)}</select></div>
          <div class="field"><label class="field-label">Origine</label><select id="f_origin">${selectOptions(ORIGIN_OPTIONS, ci.origin)}</select></div>
        </div>
      </div>
    </div>

    <div class="accordion" data-accordion="dimguide">
      <div class="accordion-head" data-toggle="dimguide"><span>🧭 Antisèche Discovery</span><span class="chev">›</span></div>
      <div class="accordion-body"><div class="dimension-grid mt8">${dimensionCards}</div></div>
    </div>

    <div class="btn-row mt24" style="justify-content:space-between;">
      <button class="btn btn-ghost" data-action="discard-draft">Annuler et recommencer</button>
      <button class="btn btn-primary" data-action="go-step2">Continuer vers le transcript →</button>
    </div>
    `;
  }

  function renderStep2(d) {
    return `
    <div class="card">
      <div class="card-title">Coller le transcript de l'appel</div>
      <textarea id="f_transcript" rows="18" placeholder="Collez ici le transcript brut du call...">${escapeHtml(d.transcript)}</textarea>
      <p class="hint mt8">Le transcript reste local. Il ne sera jamais envoyé automatiquement vers Internet.</p>
    </div>
    <div class="btn-row mt24" style="justify-content:space-between;">
      <button class="btn btn-ghost" data-action="goto-step" data-step="1">← Retour</button>
      <button class="btn btn-primary" data-action="goto-step" data-step="3">Continuer vers l'analyse →</button>
    </div>
    `;
  }

  function renderStep3(d) {
    const hasPrompt = !!d.promptText;
    return `
    <div class="card">
      <div class="card-title">Générer le Probe Prompt</div>
      <p class="small muted mt8" style="margin-top:-4px;">Le prompt généré est totalement autonome : rôle, règles, méthodologie Colorz, contexte, interlocuteurs, transcript et schéma JSON sont injectés — aucun placeholder ne subsiste.</p>
      <div class="btn-row mt16">
        <button class="btn btn-primary" data-action="generate-prompt">⚙️ GÉNÉRER LE PROBE PROMPT</button>
        ${hasPrompt ? `<button class="btn" data-action="copy-prompt">📋 COPIER LE PROMPT</button>` : ""}
      </div>
      ${hasPrompt ? `
        <p class="hint mt16">Collez ce prompt dans Claude ou ChatGPT, puis copiez la réponse JSON ci-dessous.</p>
        <div class="copy-box mt12">${escapeHtml(d.promptText)}</div>
      ` : ""}
    </div>

    <div class="card">
      <div class="card-title">Coller le JSON Probe</div>
      <textarea id="f_importJson" rows="12" placeholder="Collez ici la réponse JSON renvoyée par Claude ou ChatGPT...">${escapeHtml(d.importDraftJson || "")}</textarea>
      <div id="importFeedback" class="mt12"></div>
      <div class="btn-row mt12">
        <button class="btn btn-primary" data-action="import-analysis">⬇️ IMPORTER L'ANALYSE</button>
      </div>
    </div>

    <div class="btn-row mt24" style="justify-content:space-between;">
      <button class="btn btn-ghost" data-action="goto-step" data-step="2">← Retour</button>
    </div>
    `;
  }

  function renderStep4(d) {
    if (!d.savedAnalysisId) {
      return `<div class="empty-state"><p>Aucune analyse importée pour cette discovery.</p>
      <button class="btn btn-primary mt16" data-action="goto-step" data-step="3">← Retour à l'analyse</button></div>`;
    }
    const analysis = state.analyses.find((a) => a.id === d.savedAnalysisId);
    if (!analysis) return `<div class="empty-state"><p>Analyse introuvable.</p></div>`;
    return renderResultsBody(analysis);
  }

  function bindNewDiscovery() {
    const view = $("#view");

    const bindField = (id, key) => {
      const el = $("#" + id);
      if (!el) return;
      el.addEventListener("input", () => { state.draft.context[key] = el.value; saveDraft(); });
    };
    bindField("f_company", "company");
    bindField("f_date", "date");
    bindField("f_knownContext", "knownContext");
    bindField("f_callObjective", "callObjective");

    const callTypeSel = $("#f_callType");
    if (callTypeSel) callTypeSel.addEventListener("change", () => { state.draft.context.callType = callTypeSel.value; saveDraft(); });

    // interlocutors
    view.querySelectorAll("[data-person-field]").forEach((el) => {
      el.addEventListener(el.tagName === "SELECT" ? "change" : "input", () => {
        const pid = el.getAttribute("data-person-id");
        const field = el.getAttribute("data-person-field");
        const person = state.draft.context.interlocutors.find((p) => p.id === pid);
        if (person) { person[field] = el.value; saveDraft(); }
      });
    });
    view.querySelectorAll("[data-remove-person]").forEach((btn) => btn.addEventListener("click", async () => {
      const pid = btn.getAttribute("data-remove-person");
      if (state.draft.context.interlocutors.length <= 1) return;
      state.draft.context.interlocutors = state.draft.context.interlocutors.filter((p) => p.id !== pid);
      await saveDraft();
      render();
    }));
    const addPersonBtn = view.querySelector('[data-action="add-person"]');
    if (addPersonBtn) addPersonBtn.addEventListener("click", async () => {
      state.draft.context.interlocutors.push(newInterlocutor());
      await saveDraft();
      render();
    });

    // commercial info collapsible
    const ciToggle = view.querySelector('[data-action="toggle-commercial-info"]');
    if (ciToggle) ciToggle.addEventListener("click", () => {
      state.commercialInfoOpen = !state.commercialInfoOpen;
      ciToggle.classList.toggle("open", state.commercialInfoOpen);
      $("#commercialInfoBody").classList.toggle("open", state.commercialInfoOpen);
    });
    ["competition", "colorzPosition", "origin"].forEach((key) => {
      const sel = $("#f_" + key);
      if (sel) sel.addEventListener("change", () => { state.draft.context.commercialInfo[key] = sel.value; saveDraft(); });
    });

    // discovery cheat-sheet accordion
    view.querySelectorAll("[data-toggle]").forEach((h) => h.addEventListener("click", () => {
      const key = h.getAttribute("data-toggle");
      const acc = h.closest(".accordion");
      if (state.openAccordions.has(key)) { state.openAccordions.delete(key); acc.classList.remove("open"); }
      else { state.openAccordions.add(key); acc.classList.add("open"); }
    }));

    const transcriptEl = $("#f_transcript");
    if (transcriptEl) transcriptEl.addEventListener("input", () => { state.draft.transcript = transcriptEl.value; saveDraft(); });

    const importJsonEl = $("#f_importJson");
    if (importJsonEl) importJsonEl.addEventListener("input", () => { state.draft.importDraftJson = importJsonEl.value; saveDraft(); });

    view.querySelectorAll('[data-action="goto-step"]').forEach((b) => b.addEventListener("click", async () => {
      state.draft.step = Number(b.getAttribute("data-step"));
      await saveDraft();
      render();
    }));

    const go2Btn = view.querySelector('[data-action="go-step2"]');
    if (go2Btn) go2Btn.addEventListener("click", async () => {
      if (!state.draft.context.company || !state.draft.context.company.trim()) {
        toast("Le nom de l'entreprise est requis pour continuer.");
        const input = $("#f_company");
        if (input) { input.style.borderColor = "var(--red)"; input.focus(); }
        return;
      }
      state.draft.step = 2;
      await saveDraft();
      render();
    });

    const discardBtn = view.querySelector('[data-action="discard-draft"]');
    if (discardBtn) discardBtn.addEventListener("click", async () => {
      if (confirm("Effacer cette discovery en cours et repartir de zéro ?")) {
        await clearDraft();
        render();
      }
    });

    const genBtn = view.querySelector('[data-action="generate-prompt"]');
    if (genBtn) genBtn.addEventListener("click", async () => {
      state.draft.promptText = ProbePromptGenerator.buildProbePrompt({
        context: state.draft.context,
        transcript: state.draft.transcript,
        methodology: state.methodology,
      });
      await saveDraft();
      render();
      toast("Probe Prompt généré ✓");
    });

    const copyBtn = view.querySelector('[data-action="copy-prompt"]');
    if (copyBtn) copyBtn.addEventListener("click", async () => {
      const ok = await copyToClipboard(state.draft.promptText);
      toast(ok ? "Prompt copié dans le presse-papiers 📋" : "Impossible de copier automatiquement — sélectionnez le texte manuellement.");
    });

    const importBtn = view.querySelector('[data-action="import-analysis"]');
    if (importBtn) importBtn.addEventListener("click", () => handleImportAnalysis());

    if ((state.draft.step || 1) === 4) bindResultsInteractions(view);
  }

  async function handleImportAnalysis() {
    const raw = state.draft.importDraftJson || "";
    const feedback = $("#importFeedback");
    const parsed = ProbeSchema.extractJson(raw);
    if (!parsed.ok) {
      feedback.innerHTML = `<div class="error-box">⚠️ ${escapeHtml(parsed.error)}</div>`;
      return;
    }
    const check = ProbeSchema.validate(parsed.data);
    if (!check.valid) {
      feedback.innerHTML = `<div class="error-box">🚨 Champs essentiels manquants : ${check.missing.map(escapeHtml).join(", ")}. Import annulé — vérifiez que Claude/ChatGPT a bien renvoyé la structure complète.</div>`;
      return;
    }
    const analysis = {
      id: uid("analysis"),
      createdAt: Date.now(),
      prospect: state.draft.context.company || parsed.data.meta?.prospect || "Prospect sans nom",
      callType: state.draft.context.callType || parsed.data.meta?.call_type || "Autre",
      date: state.draft.context.date || parsed.data.meta?.analysis_date || new Date().toISOString().slice(0, 10),
      context: state.draft.context,
      transcript: state.settings.keepTranscript ? state.draft.transcript : "",
      result: parsed.data,
    };
    await ProbeDB.put("analyses", analysis);
    await loadAnalyses();
    state.draft.savedAnalysisId = analysis.id;
    state.draft.step = 4;
    await saveDraft();
    if (check.warnings.length) toast("Analyse importée avec quelques avertissements — voir Résultats.");
    else toast("Analyse importée ✓");
    render();
  }

  // ============================================================ RESULTS (shared renderer)
  function renderResultsBody(analysis) {
    const r = analysis.result || {};
    const es = r.executive_summary || {};
    const ds = r.discovery_score || {};
    const cf = r.colorz_fit || {};
    const wa = r.win_assessment || null;
    const radarFull = (r.opportunity_radar || []).slice().sort((a, b) => num(b.opportunity_score) - num(a.opportunity_score));
    const topOpp = radarFull[0];

    return `
    ${renderPanel30s(es, ds, cf, wa, topOpp)}

    <div class="card">
      <div class="card-title">📡 Opportunity Radar</div>
      ${radarFull.length ? radarFull.slice(0, 5).map((o, i) => renderRadarItem(o, i, "c")).join("") : `<p class="small muted">Aucune opportunité détectée.</p>`}
    </div>

    <div class="grid grid-2 mt16">
      <div class="card">
        <div class="card-title">🟢 Ce qui peut faire gagner</div>
        ${renderWinFactors(wa)}
      </div>
      <div class="card">
        <div class="card-title">🔴 Risques de perte</div>
        ${renderLossRisksCondensed(wa)}
      </div>
    </div>

    <div class="grid grid-2 mt16">
      <div class="card">
        <div class="card-title">🚨 Ce qu'il manque</div>
        ${renderGapsCondensed(r.discovery_gaps)}
      </div>
      <div class="card">
        <div class="card-title">✅ Next Steps</div>
        ${renderNextStepsCondensed(r.next_best_actions)}
      </div>
    </div>

    <div class="full-analysis-toggle">
      <button class="btn" data-action="toggle-full-analysis">${state.fullAnalysisOpen ? "▲ Masquer l'analyse complète" : "▼ Voir l'analyse complète"}</button>
    </div>

    <div class="full-analysis-wrap ${state.fullAnalysisOpen ? "open" : ""}">
      ${accordion("markers", "🔥 Key Markers", (r.key_markers || []).length, renderKeyMarkers(r.key_markers))}
      ${accordion("goals", "🎯 Objectifs business", (r.client_mapping?.business_goals || []).length, renderBusinessGoals(r.client_mapping))}
      ${accordion("pains", "😬 Points de friction", (r.client_mapping?.pain_points || []).length, renderPainPoints(r.client_mapping))}
      ${accordion("client", "🗂️ Cartographie client", null, renderClientMapping(r.client_mapping))}
      ${accordion("committee", "🧑‍🤝‍🧑 Buying Committee", (r.buying_committee || []).length, renderBuyingCommittee(r.buying_committee))}
      ${accordion("winscore", "🏆 Win Score détaillé", null, renderWinScoreDetail(wa))}
      ${accordion("radarfull", "📡 Opportunity Radar complet", radarFull.length, radarFull.length ? radarFull.map((o, i) => renderRadarItem(o, i, "f")).join("") : `<p class="muted">Aucune opportunité détectée.</p>`)}
      ${accordion("gaps", "🚨 Informations manquantes (complet)", (r.discovery_gaps || []).length, renderDiscoveryGaps(r.discovery_gaps))}
      ${accordion("missedq", "🫣 Questions manquées", (r.missed_questions || []).length, renderMissedQuestions(r.missed_questions))}
      ${accordion("missedo", "🫣 Opportunités manquées", (r.missed_opportunities || []).length, renderMissedOpportunities(r.missed_opportunities))}
      ${accordion("wins", "💎 Points forts du call", (r.sales_performance?.commercial_wins || []).length, renderWins(r.sales_performance))}
      ${accordion("coaching", "🧠 Coaching commercial", (r.sales_performance?.coaching || []).length, renderCoaching(r.sales_performance))}
      ${accordion("pitch", "🎯 Discipline de pitch", null, renderPitchDiscipline(r.pitch_discipline))}
      ${accordion("callback", "📞 Callback", null, renderCallback(r.callback))}
      ${accordion("colorzmatch", "🚀 Colorz Match", null, renderColorzMatch(r.colorz_match))}
      ${accordion("colorzfit", "🎯 Colorz Fit — détail", null, renderColorzFit(r.colorz_fit))}
      ${accordion("angles", "🚀 Angles commerciaux recommandés", (r.recommended_sales_angles || []).length, renderAngles(r.recommended_sales_angles))}
      ${accordion("watchouts", "⚠️ Points de vigilance", (r.watchouts || []).length, renderWatchouts(r.watchouts))}
      ${accordion("actions", "✅ Plan d'action détaillé", (r.next_best_actions || []).length, renderNextActions(r.next_best_actions))}
    </div>
    `;
  }

  function renderPanel30s(es, ds, cf, wa, topOpp) {
    const winScoreVal = wa ? num(wa.score) : null;
    const winLabel = wa ? (wa.label || "—") : "Non disponible";
    const winCls = wa ? (WIN_LABEL_CLASS[wa.label] || "na") : "na";
    return `
    <div class="panel-30s">
      <div class="panel-30s-title">En 30 secondes</div>
      <div class="panel-30s-text">${nl2br(es.situation || es.main_challenge || "Synthèse non disponible.")}</div>
      <div class="grid grid-4">
        <div class="stat"><div class="stat-label">Qualification</div><div class="stat-value">${num(ds.global)}<small>/100</small></div></div>
        <div class="stat"><div class="stat-label">Opportunité</div><div class="stat-value">${topOpp ? num(topOpp.opportunity_score) : "—"}<small>${topOpp ? "/100" : ""}</small></div>
          ${topOpp ? `<div class="stat-trend">${escapeHtml(topOpp.territory)}</div>` : ""}</div>
        <div class="stat"><div class="stat-label">Win Score</div><div class="stat-value">${winScoreVal ?? "—"}<small>${wa ? "/100" : ""}</small></div>
          <span class="win-badge ${winCls} mt8">${escapeHtml(winLabel)}</span></div>
        <div class="stat"><div class="stat-label">Colorz Fit</div><div class="stat-value">${num(cf.score)}<small>/100</small></div></div>
      </div>
    </div>`;
  }

  function accordion(key, title, count, body) {
    const open = state.openAccordions.has(key);
    return `<div class="accordion ${open ? "open" : ""}" data-accordion="${key}">
      <div class="accordion-head" data-toggle="${key}"><span>${title}${count !== null && count !== undefined ? `<span class="accordion-count">${count}</span>` : ""}</span><span class="chev">›</span></div>
      <div class="accordion-body">${body}</div>
    </div>`;
  }

  function renderRadarItem(o, i, namespace) {
    const recClass = REC_CLASS[o.recommendation] || "badge-donotpush";
    const emoji = REC_EMOJI[o.recommendation] || "📡";
    const key = `${namespace}:${i}`;
    const openDetail = state.openRadarItems.has(key);
    return `
    <div class="radar-item" data-radar-toggle="${key}">
      <div class="radar-emoji">${emoji}</div>
      <div class="radar-main">
        <div class="radar-name">${escapeHtml(o.territory || "—")}</div>
        <div class="radar-conf">Confidence ${num(o.confidence_score)}%</div>
        <div class="radar-bar-track"><div class="radar-bar-fill" style="width:${num(o.opportunity_score)}%"></div></div>
      </div>
      <div class="radar-score">
        <div class="num">${num(o.opportunity_score)}</div>
        <div class="max">/100</div>
        <span class="badge ${recClass}" style="margin-top:6px;">${REC_FR[o.recommendation] || escapeHtml(o.recommendation || "")}</span>
      </div>
    </div>
    ${openDetail ? renderRadarDetail(o) : ""}
    `;
  }

  function renderRadarDetail(o) {
    const cm = o.colorz_match || {};
    return `<div class="card" style="margin: -4px 0 12px; background:var(--bg-elevated);">
      <div class="item"><div class="item-title">💎 Signal</div><div class="item-body"><p>${nl2br(o.signal)}</p></div></div>
      <div class="item"><div class="item-title">Problème potentiel</div><div class="item-body"><p>${nl2br(o.potential_problem)}</p></div></div>
      <div class="item"><div class="item-title">Evidence <span class="badge ${badgeClass('fact', o.fact_or_inference)}">${escapeHtml(o.fact_or_inference || "")}</span></div><div class="item-body"><p>${nl2br(o.evidence)}</p></div></div>
      ${(o.missing_information || []).length ? `<div class="item"><div class="item-title">⚠️ Informations manquantes</div><div class="item-body">${listUl(o.missing_information)}</div></div>` : ""}
      ${(o.questions_to_ask || []).length ? `<div class="item"><div class="item-title">Questions à poser</div><div class="item-body">${listUl(o.questions_to_ask)}</div></div>` : ""}
      ${(cm.expertises?.length || cm.accelerators?.length || cm.partners_solutions?.length) ? `
      <div class="item"><div class="item-title">🚀 Colorz Match</div><div class="item-body">
        ${cm.expertises?.length ? `<p><strong>Expertises :</strong> ${cm.expertises.map(escapeHtml).join(", ")}</p>` : ""}
        ${cm.accelerators?.length ? `<p><strong>Accélérateurs :</strong> ${cm.accelerators.map(escapeHtml).join(", ")}</p>` : ""}
        ${cm.partners_solutions?.length ? `<p><strong>Partenaires / solutions :</strong> ${cm.partners_solutions.map(escapeHtml).join(", ")}</p>` : ""}
      </div></div>` : ""}
      <div class="item"><div class="item-title">Next move</div><div class="item-body"><p>${nl2br(o.next_move)}</p></div></div>
    </div>`;
  }

  function listUl(arr) {
    if (!arr || !arr.length) return `<p class="muted">—</p>`;
    return `<ul style="margin:4px 0; padding-left:18px;">${arr.map((x) => `<li>${nl2br(x)}</li>`).join("")}</ul>`;
  }

  // -------- condensed "En 30 secondes" blocks --------

  function renderWinFactors(wa) {
    if (!wa) return `<p class="muted">Win Score non disponible pour cette analyse.</p>`;
    const drivers = (wa.win_drivers || []).slice().sort((a, b) => strengthRank(b.strength) - strengthRank(a.strength));
    const risks = (wa.loss_risks || []);
    const mediumRisks = risks.filter((r) => r.severity === "MEDIUM" || r.severity === "LOW");
    const topSevere = risks.filter((r) => r.severity === "HIGH" || r.severity === "CRITICAL").slice(0, 1);

    const rows = [
      ...drivers.map((d) => ({ dot: "🟢", text: d.title })),
      ...mediumRisks.map((r) => ({ dot: "🟠", text: r.title })),
      ...topSevere.map((r) => ({ dot: "🔴", text: r.title })),
    ].slice(0, 6);

    if (!rows.length) return `<p class="muted">Aucun facteur identifié.</p>`;
    return rows.map((f) => `<div class="factor-row"><span class="dot">${f.dot}</span><span>${escapeHtml(f.text)}</span></div>`).join("");
  }

  function strengthRank(s) { return { HIGH: 3, MEDIUM: 2, LOW: 1 }[s] || 0; }
  function severityRank(s) { return { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 }[s] || 0; }

  function renderLossRisksCondensed(wa) {
    if (!wa) return `<p class="muted">Win Score non disponible pour cette analyse.</p>`;
    const risks = (wa.loss_risks || []).slice().sort((a, b) => severityRank(b.severity) - severityRank(a.severity)).slice(0, 5);
    if (!risks.length) return `<p class="muted">Aucun risque de perte identifié.</p>`;
    return risks.map((r) => {
      const dot = (r.severity === "CRITICAL" || r.severity === "HIGH") ? "🔴" : "🟠";
      return `<div class="factor-row"><span class="dot">${dot}</span><span>${escapeHtml(r.title)}</span></div>`;
    }).join("");
  }

  function renderGapsCondensed(gaps) {
    const filtered = (gaps || []).filter((g) => g.priority === "BLOCKING" || g.priority === "IMPORTANT")
      .sort((a, b) => (a.priority === "BLOCKING" ? 0 : 1) - (b.priority === "BLOCKING" ? 0 : 1))
      .slice(0, 5);
    if (!filtered.length) return `<p class="muted">Rien de bloquant identifié.</p>`;
    return filtered.map((g) => `<div class="factor-row"><span class="dot">${g.priority === "BLOCKING" ? "🚨" : "👀"}</span><span>${escapeHtml(g.topic)}</span></div>`).join("");
  }

  function renderNextStepsCondensed(actions) {
    if (!actions || !actions.length) return `<p class="muted">Aucune action proposée.</p>`;
    const order = { NOW: 0, BEFORE_NEXT_CALL: 1, NEXT_CALL: 2, LATER: 3 };
    const top = actions.slice().sort((a, b) => (order[a.timing] ?? 9) - (order[b.timing] ?? 9) || num(a.priority) - num(b.priority)).slice(0, 3);
    return top.map((a, i) => `<div class="nextstep-row">
      <div class="nextstep-num">${i + 1}</div>
      <div><div class="nextstep-action">${escapeHtml(a.action)}</div>${a.reason ? `<div class="nextstep-reason">${escapeHtml(a.reason)}</div>` : ""}</div>
    </div>`).join("");
  }

  // -------- detailed sections (full analysis) --------

  function renderKeyMarkers(markers) {
    if (!markers || !markers.length) return `<p class="muted">Aucun key marker identifié.</p>`;
    return markers.map((m) => `<div class="item">
      <div class="item-title">${escapeHtml(m.marker)} <span class="${badgeClass('medium', m.importance)}">${escapeHtml(m.importance || "")}</span></div>
      <div class="item-body"><p>${nl2br(m.evidence)}</p>${m.commercial_implication ? `<p class="item-meta">${nl2br(m.commercial_implication)}</p>` : ""}</div>
    </div>`).join("");
  }

  function renderBusinessGoals(cm) {
    const goals = cm?.business_goals || [];
    if (!goals.length) return `<p class="muted">Aucun objectif identifié.</p>`;
    return goals.map((g) => `<div class="item">
      <div class="item-title">${escapeHtml(g.label)} <span class="${badgeClass('medium', g.importance)}">${escapeHtml(g.importance || "")}</span> <span class="${badgeClass('fact', g.status)}">${escapeHtml(g.status || "")}</span></div>
      <div class="item-body"><p>${nl2br(g.evidence)}</p></div>
    </div>`).join("");
  }

  function renderPainPoints(cm) {
    const pains = cm?.pain_points || [];
    if (!pains.length) return `<p class="muted">Aucun point de friction identifié.</p>`;
    return pains.map((p) => `<div class="item">
      <div class="item-title">${escapeHtml(p.label)} <span class="${badgeClass('medium', p.importance)}">${escapeHtml(p.importance || "")}</span> <span class="${badgeClass('fact', p.status)}">${escapeHtml(p.status || "")}</span></div>
      <div class="item-body">
        <p>${nl2br(p.description)}</p>
        ${p.evidence ? `<p class="item-meta">Evidence : ${nl2br(p.evidence)}</p>` : ""}
        ${p.business_impact ? `<p class="item-meta">Impact business : ${nl2br(p.business_impact)}</p>` : ""}
      </div>
    </div>`).join("");
  }

  function renderClientMapping(cm) {
    if (!cm) return `<p class="muted">Non renseigné.</p>`;
    const block = (title, obj) => {
      if (!obj) return "";
      const rows = Object.entries(obj).filter(([k]) => k !== "status")
        .map(([k, v]) => `<p><strong>${escapeHtml(k.replace(/_/g, " "))} :</strong> ${nl2br(v)}</p>`).join("");
      return `<div class="item"><div class="item-title">${title} ${obj.status ? `<span class="${badgeClass('fact', obj.status)}">${escapeHtml(obj.status)}</span>` : ""}</div><div class="item-body">${rows}</div></div>`;
    };
    return block("Entreprise", cm.company) + block("Situation actuelle", cm.current_situation) + block("Projet", cm.project);
  }

  function renderBuyingCommittee(list) {
    if (!list || !list.length) return `<p class="muted">Aucun interlocuteur qualifié dans cette analyse.</p>`;
    return list.map((p) => {
      const declared = ROLE_LABEL[p.declared_role] || "Inconnu";
      const inferred = ROLE_LABEL[p.inferred_role] || "Inconnu";
      const differ = p.declared_role && p.inferred_role && p.declared_role !== p.inferred_role;
      return `<div class="committee-card">
        <div class="committee-name">${escapeHtml(p.name || "Interlocuteur")}</div>
        ${p.job_title ? `<div class="committee-title">${escapeHtml(p.job_title)}</div>` : ""}
        <div class="committee-roles">
          ${differ ? `
            <span class="badge badge-medium">Déclaré : ${escapeHtml(declared)}</span>
            <span class="badge badge-explore">Lecture IA : ${escapeHtml(inferred)}${p.role_confidence !== undefined ? ` (${num(p.role_confidence)}%)` : ""}</span>
          ` : `<span class="badge badge-explore">${escapeHtml(inferred)}${p.role_confidence !== undefined ? ` — confiance ${num(p.role_confidence)}%` : ""}</span>`}
          ${p.influence_level ? `<span class="${badgeClass('medium', p.influence_level)}">Influence : ${escapeHtml(p.influence_level)}</span>` : ""}
          ${p.attitude_to_colorz ? `<span class="badge badge-donotpush">Attitude : ${escapeHtml(p.attitude_to_colorz)}</span>` : ""}
        </div>
        ${p.evidence ? `<p class="item-meta">${nl2br(p.evidence)}</p>` : ""}
        ${p.notes ? `<p class="item-meta">${nl2br(p.notes)}</p>` : ""}
      </div>`;
    }).join("");
  }

  function renderWinScoreDetail(wa) {
    if (!wa) return `<p class="muted">Win Score non disponible pour cette analyse (ancienne version de Probe, ou non fourni par l'IA).</p>`;
    const winCls = WIN_LABEL_CLASS[wa.label] || "na";
    const family = (title, obj) => {
      if (!obj) return "";
      return `<div class="item"><div class="item-title">${title}</div><div class="item-body">
        <p>${nl2br(obj.summary)}</p>
        ${(obj.signals || []).length ? listUl(obj.signals) : ""}
        ${obj.competitors_named?.length ? `<p class="item-meta">Concurrents cités : ${obj.competitors_named.map(escapeHtml).join(", ")}</p>` : ""}
        ${obj.competitor_count ? `<p class="item-meta">Concurrence : ${escapeHtml(obj.competitor_count)}</p>` : ""}
        ${obj.incumbent ? `<p class="item-meta">Incumbent : ${escapeHtml(obj.incumbent)}</p>` : ""}
        ${obj.advantage_perceived ? `<p class="item-meta">Avantage perçu : ${nl2br(obj.advantage_perceived)}</p>` : ""}
        ${obj.decision_criteria_known?.length ? `<p class="item-meta">Critères de décision connus : ${obj.decision_criteria_known.map(escapeHtml).join(", ")}</p>` : ""}
      </div></div>`;
    };
    const drivers = (wa.win_drivers || []).map((d) => `<div class="item">
      <div class="item-title">🟢 ${escapeHtml(d.title)} <span class="${badgeClass('medium', d.strength)}">${escapeHtml(d.strength || "")}</span> <span class="${badgeClass('fact', d.status)}">${escapeHtml(d.status || "")}</span></div>
      <div class="item-body">${d.evidence ? `<p>${nl2br(d.evidence)}</p>` : ""}${d.explanation ? `<p class="item-meta">${nl2br(d.explanation)}</p>` : ""}</div>
    </div>`).join("") || `<p class="muted">—</p>`;
    const risks = (wa.loss_risks || []).map((r) => `<div class="item">
      <div class="item-title">🔴 ${escapeHtml(r.title)} <span class="${badgeClass('medium', r.severity)}">${escapeHtml(r.severity || "")}</span> <span class="${badgeClass('fact', r.status)}">${escapeHtml(r.status || "")}</span></div>
      <div class="item-body">${r.evidence ? `<p>${nl2br(r.evidence)}</p>` : ""}${r.explanation ? `<p class="item-meta">${nl2br(r.explanation)}</p>` : ""}${r.mitigation ? `<p class="item-meta">Mitigation : ${nl2br(r.mitigation)}</p>` : ""}</div>
    </div>`).join("") || `<p class="muted">—</p>`;
    const howToWin = (wa.how_to_win || []).slice().sort((a, b) => num(a.priority) - num(b.priority)).map((h) => `<div class="item">
      <div class="item-title">🚀 #${num(h.priority)} — ${escapeHtml(h.action)}</div>
      <div class="item-body">${h.reason ? `<p>${nl2br(h.reason)}</p>` : ""}${h.expected_impact ? `<p class="item-meta">Impact attendu : ${nl2br(h.expected_impact)}</p>` : ""}${h.suggested_wording ? `<p class="item-meta">Suggestion : « ${nl2br(h.suggested_wording)} »</p>` : ""}</div>
    </div>`).join("") || `<p class="muted">—</p>`;

    return `
      <div class="item"><div class="item-title">Score : ${num(wa.score)}/100 <span class="win-badge ${winCls}">${escapeHtml(wa.label || "")}</span></div>
        <div class="item-body"><p class="item-meta">Win Confidence : ${num(wa.confidence)}/100 — quantité et qualité des informations disponibles pour évaluer notre position (indépendant du score lui-même).</p></div>
      </div>
      ${family("A. Force du deal", wa.deal_strength)}
      ${family("B. Position de Colorz", wa.colorz_position)}
      ${family("C. Pouvoir &amp; dynamique politique", wa.political_position)}
      ${family("D. Maîtrise du process", wa.process_control)}
      <div class="divider"></div>
      <p class="card-title">Win drivers</p>${drivers}
      <div class="divider"></div>
      <p class="card-title">Loss risks</p>${risks}
      <div class="divider"></div>
      <p class="card-title">Comment augmenter nos chances</p>${howToWin}
    `;
  }

  function renderDiscoveryGaps(gaps) {
    if (!gaps || !gaps.length) return `<p class="muted">Aucun gap identifié.</p>`;
    return gaps.map((g) => `<div class="item">
      <div class="item-title">${escapeHtml(g.topic)} <span class="${badgeClass('medium', g.priority)}">${escapeHtml(g.priority || "")}</span></div>
      <div class="item-body"><p>${nl2br(g.reason)}</p>${g.suggested_question ? `<p class="item-meta">💬 ${nl2br(g.suggested_question)}</p>` : ""}</div>
    </div>`).join("");
  }

  function renderMissedQuestions(qs) {
    if (!qs || !qs.length) return `<p class="muted">Aucune question manquante identifiée.</p>`;
    return qs.map((q) => `<div class="item">
      <div class="item-title">${escapeHtml(q.topic)} <span class="${badgeClass('medium', q.importance)}">${escapeHtml(q.importance || "")}</span></div>
      <div class="item-body">
        <p>${nl2br(q.reason)}</p>
        ${q.suggested_question ? `<p class="item-meta">💬 « ${nl2br(q.suggested_question)} »</p>` : ""}
        ${q.consequence ? `<p class="item-meta">Conséquence : ${nl2br(q.consequence)}</p>` : ""}
      </div>
    </div>`).join("");
  }

  function renderMissedOpportunities(list) {
    if (!list || !list.length) return `<p class="muted">Aucune occasion manquée identifiée.</p>`;
    return list.map((m) => `<div class="item">
      <div class="item-title">🫣 ${escapeHtml(m.signal)}</div>
      <div class="item-body">
        <p>${nl2br(m.what_happened)}</p>
        ${m.why_it_mattered ? `<p class="item-meta">Pourquoi c'était important : ${nl2br(m.why_it_mattered)}</p>` : ""}
        ${m.better_follow_up ? `<p class="item-meta">Meilleure relance : ${nl2br(m.better_follow_up)}</p>` : ""}
      </div>
    </div>`).join("");
  }

  function renderWins(sp) {
    const wins = sp?.commercial_wins || [];
    if (!wins.length) return `<p class="muted">Aucun point fort identifié.</p>`;
    return wins.map((w) => `<div class="item">
      <div class="item-title">${w.emoji || "💎"} ${escapeHtml(w.title)}</div>
      <div class="item-body"><p>${nl2br(w.explanation)}</p>${w.evidence ? `<p class="item-meta">${nl2br(w.evidence)}</p>` : ""}</div>
    </div>`).join("");
  }

  function renderCoaching(sp) {
    const list = sp?.coaching || [];
    if (!list.length) return `<p class="muted">Aucun axe de coaching identifié.</p>`;
    return list.map((c) => `<div class="item">
      <div class="item-title">${c.emoji || "👀"} ${escapeHtml(c.situation)}</div>
      <div class="item-body">
        <p>${nl2br(c.issue)}</p>
        ${c.why_it_matters ? `<p class="item-meta">Pourquoi ça compte : ${nl2br(c.why_it_matters)}</p>` : ""}
        ${c.better_approach ? `<p class="item-meta">Meilleure approche : ${nl2br(c.better_approach)}</p>` : ""}
        ${c.suggested_wording ? `<p class="item-meta">Suggestion : « ${nl2br(c.suggested_wording)} »</p>` : ""}
      </div>
    </div>`).join("");
  }

  function renderPitchDiscipline(pd) {
    if (!pd) return `<p class="muted">Non renseigné.</p>`;
    const labelFr = { TOO_EARLY: "Trop tôt", APPROPRIATE: "Approprié", LATE: "Tardif" }[pd.assessment] || pd.assessment || "";
    const cls = { TOO_EARLY: "badge-critical", APPROPRIATE: "badge-push", LATE: "badge-medium" }[pd.assessment] || "badge-donotpush";
    return `<div class="item">
      <div class="item-title">Premier pitch : ${escapeHtml(pd.first_pitch_moment)} <span class="badge ${cls}">${escapeHtml(labelFr)}</span></div>
      <div class="item-body">
        ${pd.qualification_level_before_pitch ? `<p>Qualification avant pitch : ${nl2br(pd.qualification_level_before_pitch)}</p>` : ""}
        <p>${nl2br(pd.explanation)}</p>
      </div>
    </div>`;
  }

  function renderCallback(cb) {
    if (!cb) return `<p class="muted">Non renseigné.</p>`;
    return `<div class="item">
      <div class="item-title">${cb.recommended ? "📞 Callback recommandé : OUI" : "Callback recommandé : NON"}</div>
      <div class="item-body">
        <p>${nl2br(cb.reason)}</p>
        ${cb.recommended_duration ? `<p class="item-meta">Durée recommandée : ${nl2br(cb.recommended_duration)}</p>` : ""}
        ${(cb.priority_questions || []).length ? `<p class="item-meta">Questions prioritaires :</p>${listUl(cb.priority_questions)}` : ""}
      </div>
    </div>`;
  }

  function renderColorzMatch(cmatch) {
    if (!cmatch) return `<p class="muted">Non renseigné.</p>`;
    const exp = (cmatch.expertise_matches || []).map((e) => `<div class="item">
      <div class="item-title">🧠 ${escapeHtml(e.expertise)}</div>
      <div class="item-body"><p>${nl2br(e.client_need)}</p><p class="item-meta">${nl2br(e.recommended_angle)}</p></div>
    </div>`).join("");
    const acc = (cmatch.accelerator_matches || []).map((a) => `<div class="item">
      <div class="item-title">⚙️ ${escapeHtml(a.accelerator)}</div>
      <div class="item-body"><p>${nl2br(a.client_problem)}</p><p class="item-meta">${nl2br(a.recommended_angle)}</p></div>
    </div>`).join("");
    const part = (cmatch.solution_partner_matches || []).map((p) => `<div class="item">
      <div class="item-title">🤝 ${escapeHtml(p.solution_or_partner)} <span class="${badgeClass('medium', p.confidence)}">${escapeHtml(p.confidence || "")}</span></div>
      <div class="item-body"><p>${nl2br(p.corresponding_need)}</p>${p.qualification_needed ? `<p class="item-meta">À qualifier : ${nl2br(p.qualification_needed)}</p>` : ""}${p.suggested_action ? `<p class="item-meta">Action : ${nl2br(p.suggested_action)}</p>` : ""}</div>
    </div>`).join("");
    return `
      <p class="card-title" style="margin-top:0;">Expertises</p>${exp || `<p class="muted">—</p>`}
      <div class="divider"></div>
      <p class="card-title">Accélérateurs</p>${acc || `<p class="muted">—</p>`}
      <div class="divider"></div>
      <p class="card-title">Partenaires / Solutions</p>${part || `<p class="muted">—</p>`}
    `;
  }

  function renderColorzFit(cf) {
    if (!cf) return `<p class="muted">Non renseigné.</p>`;
    const block = (title, arr) => (arr && arr.length) ? `<div class="item"><div class="item-title">${title}</div><div class="item-body">${listUl(arr)}</div></div>` : "";
    return `<div class="item"><div class="item-title">Score : ${num(cf.score)}/100</div></div>
      ${block("✅ Strong fits", cf.strong_fits)}
      ${block("🟡 Partial fits", cf.partial_fits)}
      ${block("⚠️ Mismatches", cf.mismatches)}
      ${block("🚨 Risks", cf.risks)}`;
  }

  function renderAngles(angles) {
    if (!angles || !angles.length) return `<p class="muted">Aucun angle recommandé.</p>`;
    return angles.slice().sort((a, b) => num(a.priority) - num(b.priority)).map((a) => `<div class="item">
      <div class="item-title">🚀 #${num(a.priority)} — ${escapeHtml(a.title)}</div>
      <div class="item-body">
        <p><strong>Pain :</strong> ${nl2br(a.client_pain)}</p>
        <p><strong>Message :</strong> ${nl2br(a.message)}</p>
        ${a.recommended_positioning ? `<p class="item-meta">Positionnement : ${nl2br(a.recommended_positioning)}</p>` : ""}
        ${a.evidence ? `<p class="item-meta">Evidence : ${nl2br(a.evidence)}</p>` : ""}
      </div>
    </div>`).join("");
  }

  function renderWatchouts(list) {
    if (!list || !list.length) return `<p class="muted">Aucun point de vigilance identifié.</p>`;
    return list.map((w) => `<div class="item">
      <div class="item-title">${escapeHtml(w.topic)} <span class="${badgeClass('medium', w.severity)}">${escapeHtml(w.severity || "")}</span></div>
      <div class="item-body"><p>${nl2br(w.explanation)}</p>${w.mitigation ? `<p class="item-meta">Mitigation : ${nl2br(w.mitigation)}</p>` : ""}</div>
    </div>`).join("");
  }

  function renderNextActions(list) {
    if (!list || !list.length) return `<p class="muted">Aucune action proposée.</p>`;
    const order = { NOW: 0, BEFORE_NEXT_CALL: 1, NEXT_CALL: 2, LATER: 3 };
    return list.slice().sort((a, b) => (order[a.timing] ?? 9) - (order[b.timing] ?? 9) || num(a.priority) - num(b.priority)).map((a) => `<div class="item">
      <div class="item-title">${escapeHtml(a.action)} <span class="badge badge-explore">${escapeHtml(a.timing || "")}</span></div>
      <div class="item-body">${a.reason ? `<p>${nl2br(a.reason)}</p>` : ""}${a.expected_outcome ? `<p class="item-meta">Résultat attendu : ${nl2br(a.expected_outcome)}</p>` : ""}</div>
    </div>`).join("");
  }

  function renderResultsPage() {
    const analysis = state.analyses.find((a) => a.id === state.resultsId);
    if (!analysis) {
      return `<div class="empty-state"><p>Analyse introuvable.</p><button class="btn mt16" data-action="go-history">← Retour à l'historique</button></div>`;
    }
    return `
    <div class="page-head btn-row" style="justify-content:space-between; align-items:flex-start;">
      <div>
        <div class="page-eyebrow">${escapeHtml(analysis.callType || "")}</div>
        <h1 class="page-title">${escapeHtml(analysis.prospect)}</h1>
        <p class="page-sub">${fmtDate(analysis.date)}</p>
      </div>
      <div class="btn-row">
        <button class="btn btn-sm" data-action="export-analysis" data-id="${analysis.id}">Exporter JSON</button>
        <button class="btn btn-sm btn-danger" data-action="delete-analysis" data-id="${analysis.id}">Supprimer</button>
      </div>
    </div>
    ${renderResultsBody(analysis)}
    `;
  }

  // Shared bindings for any container rendering renderResultsBody() output —
  // used by both the New Discovery step 4 and the standalone Results page.
  function bindResultsInteractions(root = document) {
    $$("[data-toggle]", root).forEach((h) => h.addEventListener("click", () => {
      const key = h.getAttribute("data-toggle");
      const acc = h.closest(".accordion");
      if (state.openAccordions.has(key)) { state.openAccordions.delete(key); acc.classList.remove("open"); }
      else { state.openAccordions.add(key); acc.classList.add("open"); }
    }));
    $$("[data-radar-toggle]", root).forEach((el) => el.addEventListener("click", () => {
      const key = el.getAttribute("data-radar-toggle");
      if (state.openRadarItems.has(key)) state.openRadarItems.delete(key);
      else state.openRadarItems.add(key);
      render();
    }));
    const fullToggle = $('[data-action="toggle-full-analysis"]', root);
    if (fullToggle) fullToggle.addEventListener("click", () => {
      state.fullAnalysisOpen = !state.fullAnalysisOpen;
      render();
    });
  }

  function bindResultsPage() {
    bindResultsInteractions(document);
    const exportBtn = $('[data-action="export-analysis"]');
    if (exportBtn) exportBtn.addEventListener("click", () => {
      const a = state.analyses.find((x) => x.id === exportBtn.getAttribute("data-id"));
      if (a) downloadJson(`probe-${slug(a.prospect)}-${a.date}.json`, a);
    });
    const delBtn = $('[data-action="delete-analysis"]');
    if (delBtn) delBtn.addEventListener("click", async () => {
      const id = delBtn.getAttribute("data-id");
      if (confirm("Supprimer définitivement cette analyse ?")) {
        await ProbeDB.delete("analyses", id);
        await loadAnalyses();
        toast("Analyse supprimée");
        navigate("history");
      }
    });
    const goHist = $('[data-action="go-history"]');
    if (goHist) goHist.addEventListener("click", () => navigate("history"));
  }

  // ============================================================ HISTORY
  function renderHistory() {
    if (!state.analyses.length) {
      return `<div class="page-head"><div class="page-eyebrow">Historique</div><h1 class="page-title">Historique</h1></div>
      <div class="empty-state"><div class="big">🕘</div><p>Aucune analyse enregistrée.</p></div>`;
    }
    const rows = state.analyses.map((a) => {
      const r = a.result || {};
      const winVal = r.win_assessment ? num(r.win_assessment.score) : "—";
      return `<div class="hist-row" data-open="${a.id}">
        <div><strong>${escapeHtml(a.prospect)}</strong><div class="small muted">${escapeHtml(a.callType || "")}</div></div>
        <div class="small">${fmtDate(a.date)}</div>
        <div class="mono">${num(r.discovery_score?.global)}</div>
        <div class="mono">${num(r.sales_performance?.global)}</div>
        <div class="mono">${num(r.colorz_fit?.score)}</div>
        <div class="mono">${winVal}</div>
        <div class="small">${escapeHtml(r.executive_summary?.best_opportunity || "—")}</div>
        <div>${r.callback?.recommended ? '<span class="badge badge-qualify">📞 OUI</span>' : '<span class="badge badge-donotpush">NON</span>'}</div>
      </div>`;
    }).join("");

    return `
    <div class="page-head">
      <div class="page-eyebrow">Historique</div>
      <h1 class="page-title">Historique</h1>
      <p class="page-sub">${state.analyses.length} discovery(ies) analysée(s).</p>
    </div>
    <div class="card" style="padding:0;">
      <div class="hist-row head">
        <div>Prospect</div><div>Date</div><div>Discovery</div><div>Sales</div><div>Fit</div><div>Win</div><div>Top opportunité</div><div>Callback</div>
      </div>
      ${rows}
    </div>
    `;
  }

  function bindHistory() {
    $$("[data-open]").forEach((row) => row.addEventListener("click", () => navigate("results", { id: row.getAttribute("data-open") })));
  }

  // ============================================================ METHODOLOGY
  function renderMethodology() {
    const m = state.methodology;
    return `
    <div class="page-head">
      <div class="page-eyebrow">Méthodologie</div>
      <h1 class="page-title">Référentiel Probe / Colorz</h1>
      <p class="page-sub">Éditable — utilisé pour générer chaque futur Probe Prompt. Rien n'est injecté automatiquement en dehors de ce référentiel.</p>
    </div>

    <div class="methodology-block">
      <div class="methodology-block-title">Key Markers</div>
      <div class="methodology-block-sub">Marqueurs commerciaux recherchés pendant l'analyse.</div>
      <div class="tag-list" id="mk_keyMarkers">
        ${m.keyMarkers.map((k, i) => `<span class="tag">${escapeHtml(k)}<button data-remove="keyMarkers:${i}">✕</button></span>`).join("")}
      </div>
      <div class="inline-add"><input type="text" id="add_keyMarkers" placeholder="Ajouter un key marker…"><button class="btn btn-sm" data-add="keyMarkers">Ajouter</button></div>
    </div>

    <div class="methodology-block">
      <div class="methodology-block-title">Digital Selling Territories</div>
      <div class="methodology-block-sub">Territoires Digital Selling 360 — de la stratégie à la fidélisation.</div>
      ${m.territories.map((t, i) => `<div class="entity-card">
        <div class="entity-card-head"><div class="entity-card-title">${escapeHtml(t.name)}</div><button class="btn btn-sm btn-danger" data-remove="territories:${i}">Supprimer</button></div>
        <div class="entity-card-desc">${escapeHtml(t.description)}</div>
      </div>`).join("")}
      <div class="inline-add"><input type="text" id="add_territories_name" placeholder="Nom du territoire"><input type="text" id="add_territories_desc" placeholder="Description"><button class="btn btn-sm" data-add="territories">Ajouter</button></div>
    </div>

    <div class="methodology-block">
      <div class="methodology-block-title">Colorz Expertises</div>
      ${m.expertises.map((e, i) => `<div class="entity-card">
        <div class="entity-card-head"><div class="entity-card-title">${escapeHtml(e.name)}</div><button class="btn btn-sm btn-danger" data-remove="expertises:${i}">Supprimer</button></div>
        <div class="entity-card-desc">${escapeHtml(e.description)}</div>
      </div>`).join("")}
      <div class="inline-add"><input type="text" id="add_expertises_name" placeholder="Nom de l'expertise"><input type="text" id="add_expertises_desc" placeholder="Description"><button class="btn btn-sm" data-add="expertises">Ajouter</button></div>
    </div>

    <div class="methodology-block">
      <div class="methodology-block-title">Colorz Accelerators</div>
      <div class="methodology-block-sub">Modules déjà développés et éprouvés par Colorz, réutilisables et adaptables. Ne jamais inventer un accélérateur absent de cette liste.</div>
      ${m.accelerators.map((a, i) => `<div class="entity-card">
        <div class="entity-card-head"><div class="entity-card-title">★ ${escapeHtml(a.name)}</div><button class="btn btn-sm btn-danger" data-remove="accelerators:${i}">Supprimer</button></div>
        <div class="entity-card-desc">${escapeHtml(a.description)}</div>
        <div class="entity-card-desc"><em>Pertinent si :</em> ${(a.relevantWhen || []).map(escapeHtml).join(", ")}</div>
      </div>`).join("")}
      <div class="inline-add"><input type="text" id="add_accelerators_name" placeholder="Nom de l'accélérateur"><input type="text" id="add_accelerators_desc" placeholder="Description"><button class="btn btn-sm" data-add="accelerators">Ajouter</button></div>
    </div>

    <div class="methodology-block">
      <div class="methodology-block-title">Partners / Solutions</div>
      ${m.partners.map((p, i) => `<div class="entity-card">
        <div class="entity-card-head"><div class="entity-card-title">${escapeHtml(p.name)} <span class="small muted">— ${escapeHtml(p.category || "")}</span></div><button class="btn btn-sm btn-danger" data-remove="partners:${i}">Supprimer</button></div>
        <div class="entity-card-desc">${escapeHtml(p.description)}</div>
      </div>`).join("")}
      <div class="inline-add"><input type="text" id="add_partners_name" placeholder="Nom du partenaire"><input type="text" id="add_partners_desc" placeholder="Description / catégorie"><button class="btn btn-sm" data-add="partners">Ajouter</button></div>
    </div>

    <div class="methodology-block">
      <div class="methodology-block-title">Discovery Rules</div>
      ${m.discoveryRules.map((rule, i) => `<div class="entity-card"><div class="entity-card-head"><div class="entity-card-desc" style="margin-top:0;">${escapeHtml(rule)}</div><button class="btn btn-sm btn-danger" data-remove="discoveryRules:${i}">Supprimer</button></div></div>`).join("")}
      <div class="inline-add"><input type="text" id="add_discoveryRules" placeholder="Ajouter une règle de discovery…"><button class="btn btn-sm" data-add="discoveryRules">Ajouter</button></div>
    </div>

    <div class="methodology-block">
      <div class="methodology-block-title">Sales Coaching Rules</div>
      ${m.salesCoachingRules.map((rule, i) => `<div class="entity-card"><div class="entity-card-head"><div class="entity-card-desc" style="margin-top:0;">${escapeHtml(rule)}</div><button class="btn btn-sm btn-danger" data-remove="salesCoachingRules:${i}">Supprimer</button></div></div>`).join("")}
      <div class="inline-add"><input type="text" id="add_salesCoachingRules" placeholder="Ajouter une règle de coaching…"><button class="btn btn-sm" data-add="salesCoachingRules">Ajouter</button></div>
    </div>

    <div class="btn-row mt24">
      <button class="btn btn-ghost" data-action="reset-methodology">Réinitialiser aux valeurs par défaut</button>
    </div>
    `;
  }

  function bindMethodology() {
    const view = $("#view");

    view.querySelectorAll("[data-remove]").forEach((btn) => btn.addEventListener("click", async () => {
      const [group, idx] = btn.getAttribute("data-remove").split(":");
      state.methodology[group].splice(Number(idx), 1);
      await saveMethodology();
      render();
      toast("Élément supprimé");
    }));

    view.querySelectorAll("[data-add]").forEach((btn) => btn.addEventListener("click", async () => {
      const group = btn.getAttribute("data-add");
      if (group === "keyMarkers" || group === "discoveryRules" || group === "salesCoachingRules") {
        const input = $("#add_" + group);
        const val = input.value.trim();
        if (!val) return;
        state.methodology[group].push(val);
      } else if (group === "territories" || group === "expertises" || group === "partners") {
        const name = $(`#add_${group}_name`).value.trim();
        const desc = $(`#add_${group}_desc`).value.trim();
        if (!name) return;
        if (group === "partners") state.methodology[group].push({ name, category: "", description: desc });
        else state.methodology[group].push({ name, description: desc, subitems: [] });
      } else if (group === "accelerators") {
        const name = $(`#add_accelerators_name`).value.trim();
        const desc = $(`#add_accelerators_desc`).value.trim();
        if (!name) return;
        state.methodology.accelerators.push({ name, description: desc, relevantWhen: [] });
      }
      await saveMethodology();
      render();
      toast("Ajouté ✓");
    }));

    const resetBtn = view.querySelector('[data-action="reset-methodology"]');
    if (resetBtn) resetBtn.addEventListener("click", async () => {
      if (confirm("Réinitialiser le référentiel Probe aux valeurs par défaut ? Cette action écrase vos modifications.")) {
        state.methodology = JSON.parse(JSON.stringify(ProbeMethodologyDefault));
        await saveMethodology();
        render();
        toast("Référentiel réinitialisé");
      }
    });
  }

  // ============================================================ SETTINGS
  function renderSettings() {
    const s = state.settings;
    return `
    <div class="page-head">
      <div class="page-eyebrow">Réglages</div>
      <h1 class="page-title">Réglages</h1>
    </div>

    <div class="card">
      <div class="card-title">Commercial</div>
      <div class="field"><label class="field-label">Nom du commercial</label><input type="text" id="f_commercial" value="${escapeHtml(s.commercial || "")}" placeholder="Ex. Dimitri"></div>
      <p class="hint">Repris automatiquement dans chaque nouvelle discovery.</p>
    </div>

    <div class="card">
      <div class="card-title">Apparence</div>
      <div class="chip-select">
        <div class="chip ${s.theme !== "light" ? "active" : ""}" data-theme="dark">🌙 Sombre</div>
        <div class="chip ${s.theme === "light" ? "active" : ""}" data-theme="light">☀️ Clair</div>
      </div>
    </div>

    <div class="card">
      <div class="card-title">Transcript</div>
      <label class="switch"><input type="checkbox" id="f_keepTranscript" ${s.keepTranscript ? "checked" : ""}> Conserver le transcript après import de l'analyse</label>
      <p class="hint">Par défaut, le transcript n'est pas conservé dans l'historique une fois l'analyse importée.</p>
    </div>

    <div class="card">
      <div class="card-title">Sauvegarde</div>
      <div class="btn-row">
        <button class="btn" data-action="export-backup">⬇️ Exporter la sauvegarde Probe</button>
        <label class="btn" for="importBackupFile" style="cursor:pointer;">⬆️ Importer une sauvegarde Probe</label>
        <input type="file" id="importBackupFile" accept="application/json" hidden>
      </div>
      <p class="hint">Le backup contient : méthodologie, analyses et réglages.</p>
    </div>

    <div class="card">
      <div class="card-title">Zone sensible</div>
      <button class="btn btn-danger" data-action="reset-all">Réinitialisation totale</button>
      <p class="hint">Supprime définitivement toutes les données Probe de cet appareil (analyses, méthodologie, réglages).</p>
    </div>

    <footer class="app-footer">Vos données Probe restent stockées localement sur votre appareil.</footer>
    `;
  }

  function bindSettings() {
    const view = $("#view");

    const commercialInput = $("#f_commercial");
    if (commercialInput) commercialInput.addEventListener("input", async () => {
      state.settings.commercial = commercialInput.value;
      await saveSettings();
    });

    view.querySelectorAll("[data-theme]").forEach((chip) => chip.addEventListener("click", async () => {
      state.settings.theme = chip.getAttribute("data-theme");
      applyTheme();
      await saveSettings();
      render();
    }));
    const kt = $("#f_keepTranscript");
    if (kt) kt.addEventListener("change", async () => { state.settings.keepTranscript = kt.checked; await saveSettings(); toast("Réglage enregistré"); });

    const exportBtn = view.querySelector('[data-action="export-backup"]');
    if (exportBtn) exportBtn.addEventListener("click", () => {
      downloadJson(`probe-backup-${new Date().toISOString().slice(0, 10)}.json`, {
        version: 1, exportedAt: new Date().toISOString(),
        methodology: state.methodology, settings: state.settings, analyses: state.analyses
      });
    });

    const importFile = $("#importBackupFile");
    if (importFile) importFile.addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (data.methodology) { state.methodology = data.methodology; await saveMethodology(); }
        if (data.settings) { state.settings = data.settings; await saveSettings(); applyTheme(); }
        if (Array.isArray(data.analyses)) {
          for (const a of data.analyses) await ProbeDB.put("analyses", a);
          await loadAnalyses();
        }
        toast("Sauvegarde importée ✓");
        render();
      } catch (err) {
        toast("Erreur d'import : fichier invalide");
      }
    });

    const resetBtn = view.querySelector('[data-action="reset-all"]');
    if (resetBtn) resetBtn.addEventListener("click", async () => {
      if (!confirm("Supprimer TOUTES les données Probe sur cet appareil ? Cette action est irréversible.")) return;
      if (!confirm("Confirmation finale : réinitialisation totale de Probe ?")) return;
      await ProbeDB.clear("analyses");
      await ProbeDB.clear("methodology");
      await ProbeDB.clear("settings");
      await ProbeDB.clear("drafts");
      await loadMethodology(); await loadSettings(); await loadAnalyses(); await loadDraft();
      toast("Probe a été réinitialisé");
      navigate("home");
    });
  }

  // ============================================================ BOOTSTRAP
  async function boot() {
    setupNav();
    await loadMethodology();
    await loadSettings();
    await loadAnalyses();
    await loadDraft();
    const { view, id } = parseHash();
    state.view = ROUTES.includes(view) ? view : "home";
    if (id) state.resultsId = id;
    render();

    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker.register("sw.js").catch(() => {});
      });
    }
  }

  boot();
})();
