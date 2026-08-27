/* ==========================================================================
   PROBE — app.js
   Router + views + state. Vanilla JS, no framework, no build step.
   All data lives in IndexedDB (see db.js). No network calls are ever made
   from this file.
   ========================================================================== */

(() => {
  "use strict";

  const DRAFT_ID = "draft-current";
  const CALL_TYPES = ["First Discovery", "Qualification", "Follow-up", "Technical Discovery", "Pre-Proposal", "Other"];

  const GUIDE_SECTIONS = [
    { key: "business", title: "Business", items: ["Activité", "Modèle économique", "Organisation", "Marchés", "Maturité digitale", "Enjeux business", "Objectifs"] },
    { key: "why_change", title: "Why change?", items: ["Pains", "Frustrations", "Limites actuelles", "Impact business", "Conséquences du statu quo"] },
    { key: "why_now", title: "Why now?", items: ["Urgence", "Deadline", "Événement déclencheur", "Compelling event"] },
    { key: "technical", title: "Technical", items: ["Plateforme", "Architecture", "Stack", "Dette technique", "Intégrations", "Dépendances"] },
    { key: "organisation", title: "Organisation", items: ["Équipe interne", "Prestataires", "Agence actuelle", "Autonomie", "Gouvernance", "Ressources"] },
    { key: "buying_process", title: "Buying Process", items: ["Budget", "Décideur", "Sponsor", "Parties prenantes", "Processus de décision", "Concurrence", "Autres agences"] },
    { key: "success", title: "Success", items: ["Objectifs mesurables", "KPI", "Critères de succès"] },
    { key: "next_step", title: "Next Step", items: ["Prochaine étape", "Date", "Participants", "Engagement obtenu"] },
  ];

  let state = {
    view: "home",
    resultsId: null,
    methodology: null,
    settings: null,
    analyses: [],
    draft: null,
    openAccordions: new Set(["radar"]),
    openRadarItem: null,
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
    state.settings = rec ? rec.data : { theme: "dark", keepTranscript: false };
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
  async function loadDraft() {
    const d = await ProbeDB.get("drafts", DRAFT_ID);
    state.draft = d || freshDraft();
  }
  function freshDraft() {
    return {
      id: DRAFT_ID,
      step: 1,
      context: {
        prospect: "", opportunity: "", date: new Date().toISOString().slice(0, 10),
        salesRep: "", contacts: "", contactRoles: "", callType: "First Discovery",
        leadSource: "", knownContext: "", callObjective: "", preCallNotes: ""
      },
      checklist: {},
      transcript: "",
      promptText: "",
      importDraftJson: "",
    };
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
    const avg = (fn) => n ? Math.round(list.reduce((s, a) => s + num(fn(a)), 0) / n) : null;
    const discoveryAvg = avg((a) => a.result?.discovery_score?.global);
    const salesAvg = avg((a) => a.result?.sales_performance?.global);
    const fitAvg = avg((a) => a.result?.colorz_fit?.score);
    const callbacks = list.filter((a) => a.result?.callback?.recommended).length;

    // territory aggregation across all radars
    const territoryScore = {};
    list.forEach((a) => {
      (a.result?.opportunity_radar || []).forEach((o) => {
        if (!o.territory) return;
        if (!territoryScore[o.territory]) territoryScore[o.territory] = { total: 0, count: 0, push: 0 };
        territoryScore[o.territory].total += num(o.opportunity_score);
        territoryScore[o.territory].count += 1;
        if (o.recommendation === "PUSH") territoryScore[o.territory].push += 1;
      });
    });
    const topTerritories = Object.entries(territoryScore)
      .map(([name, v]) => ({ name, avg: Math.round(v.total / v.count), count: v.count, push: v.push }))
      .sort((a, b) => b.avg - a.avg || b.count - a.count)
      .slice(0, 5);

    const trendSlice = [...list].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)).slice(-6);
    const discoveryTrend = trendSlice.map((a) => num(a.result?.discovery_score?.global)).filter((v) => v !== undefined);
    const salesTrend = trendSlice.map((a) => num(a.result?.sales_performance?.global));

    return { n, discoveryAvg, salesAvg, fitAvg, callbacks, topTerritories, discoveryTrend, salesTrend };
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
        <p class="small">Préparez un discovery, collez le transcript, générez le Probe Prompt, et importez l'analyse pour construire votre premier dashboard.</p>
        <div class="mt16"><button class="btn btn-primary" data-action="new-discovery">+ NEW DISCOVERY</button></div>
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
      <div class="stat"><div class="stat-label">Sales Performance moyen</div><div class="stat-value">${s.salesAvg ?? "—"}<small>/100</small></div>
        ${s.salesTrend.length > 1 ? `<div class="stat-trend">${s.salesTrend.join(" → ")}</div>` : ""}</div>
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
      <button class="btn btn-primary" data-action="new-discovery">+ NEW DISCOVERY</button>
    </div>
    <footer class="app-footer">Your Probe data is stored locally on this device.</footer>
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
      { n: 1, label: "PREPARE" },
      { n: 2, label: "TRANSCRIPT" },
      { n: 3, label: "ANALYZE" },
      { n: 4, label: "RESULTS" },
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
      <div class="page-eyebrow">New Discovery</div>
      <h1 class="page-title">${d.context.prospect ? escapeHtml(d.context.prospect) : "Nouvelle discovery"}</h1>
      <p class="page-sub">Préparez, collez le transcript, générez le Probe Prompt, importez l'analyse.</p>
    </div>
    ${renderStepper(step)}
    <div id="stepBody">${step === 1 ? renderStep1(d) : step === 2 ? renderStep2(d) : step === 3 ? renderStep3(d) : renderStep4(d)}</div>
    `;
  }

  function renderStep1(d) {
    const c = d.context;
    const guide = GUIDE_SECTIONS.map((sec) => {
      const items = sec.items.map((item, i) => {
        const checked = d.checklist[sec.key]?.[i] ? "checked" : "";
        return `<label class="switch small" style="margin:6px 0;"><input type="checkbox" data-guide="${sec.key}:${i}" ${checked}> ${escapeHtml(item)}</label>`;
      }).join("");
      return `<div class="accordion ${state.openAccordions.has("guide-" + sec.key) ? "open" : ""}" data-accordion="guide-${sec.key}">
        <div class="accordion-head" data-toggle="guide-${sec.key}"><span>${escapeHtml(sec.title)}</span><span class="chev">›</span></div>
        <div class="accordion-body">${items}</div>
      </div>`;
    }).join("");

    return `
    <div class="grid" style="grid-template-columns: 1.3fr 1fr; gap:18px;">
      <div>
        <div class="card">
          <div class="card-title">Opportunité</div>
          <div class="grid grid-2">
            <div class="field"><label class="field-label">Prospect / société</label><input type="text" id="f_prospect" value="${escapeHtml(c.prospect)}" placeholder="Ex. Oreca"></div>
            <div class="field"><label class="field-label">Opportunité</label><input type="text" id="f_opportunity" value="${escapeHtml(c.opportunity)}" placeholder="Ex. Migration Shopify"></div>
            <div class="field"><label class="field-label">Date</label><input type="date" id="f_date" value="${escapeHtml(c.date)}"></div>
            <div class="field"><label class="field-label">Commercial</label><input type="text" id="f_salesRep" value="${escapeHtml(c.salesRep)}"></div>
            <div class="field"><label class="field-label">Interlocuteurs</label><input type="text" id="f_contacts" value="${escapeHtml(c.contacts)}"></div>
            <div class="field"><label class="field-label">Fonctions</label><input type="text" id="f_contactRoles" value="${escapeHtml(c.contactRoles)}"></div>
          </div>
          <div class="field">
            <label class="field-label">Type de call</label>
            <div class="chip-select" id="f_callType">
              ${CALL_TYPES.map((t) => `<div class="chip ${c.callType === t ? "active" : ""}" data-val="${t}">${t}</div>`).join("")}
            </div>
          </div>
          <div class="field"><label class="field-label">Origine du lead</label><input type="text" id="f_leadSource" value="${escapeHtml(c.leadSource)}"></div>
          <div class="field"><label class="field-label">Contexte déjà connu</label><textarea id="f_knownContext" rows="3">${escapeHtml(c.knownContext)}</textarea></div>
          <div class="field"><label class="field-label">Objectif du rendez-vous</label><textarea id="f_callObjective" rows="2">${escapeHtml(c.callObjective)}</textarea></div>
          <div class="field"><label class="field-label">Notes pré-call</label><textarea id="f_preCallNotes" rows="3">${escapeHtml(c.preCallNotes)}</textarea></div>
        </div>

        <div class="card">
          <div class="card-title">🔥 Key Markers à rechercher</div>
          <div class="chip-select">
            ${state.methodology.keyMarkers.map((k) => `<div class="chip">${escapeHtml(k)}</div>`).join("")}
          </div>
        </div>
      </div>

      <div>
        <div class="card">
          <div class="card-title">Discovery Guide</div>
          <p class="hint mt8" style="margin-top:-6px; margin-bottom:12px;">Checklist indicative à parcourir avant / pendant le call.</p>
          ${guide}
        </div>
      </div>
    </div>

    <div class="btn-row mt24" style="justify-content:space-between;">
      <button class="btn btn-ghost" data-action="discard-draft">Discard &amp; start over</button>
      <button class="btn btn-primary" data-action="goto-step" data-step="2">Continue to Transcript →</button>
    </div>
    `;
  }

  function renderStep2(d) {
    return `
    <div class="card">
      <div class="card-title">Paste Call Transcript</div>
      <textarea id="f_transcript" rows="18" placeholder="Collez ici le transcript brut du call...">${escapeHtml(d.transcript)}</textarea>
      <p class="hint mt8">Le transcript reste local. Il ne sera jamais envoyé automatiquement vers Internet.</p>
    </div>
    <div class="btn-row mt24" style="justify-content:space-between;">
      <button class="btn btn-ghost" data-action="goto-step" data-step="1">← Back</button>
      <button class="btn btn-primary" data-action="goto-step" data-step="3">Continue to Analysis →</button>
    </div>
    `;
  }

  function renderStep3(d) {
    const hasPrompt = !!d.promptText;
    return `
    <div class="card">
      <div class="card-title">Generate Probe Prompt</div>
      <p class="small muted mt8" style="margin-top:-4px;">Le prompt généré est totalement autonome : rôle, règles, méthodologie Colorz, contexte, transcript et schéma JSON sont injectés — aucun placeholder ne subsiste.</p>
      <div class="btn-row mt16">
        <button class="btn btn-primary" data-action="generate-prompt">⚙️ GENERATE PROBE PROMPT</button>
        ${hasPrompt ? `<button class="btn" data-action="copy-prompt">📋 COPY PROMPT</button>` : ""}
      </div>
      ${hasPrompt ? `
        <p class="hint mt16">Paste this prompt into Claude or ChatGPT. Then copy the JSON response back into Probe.</p>
        <div class="copy-box mt12">${escapeHtml(d.promptText)}</div>
      ` : ""}
    </div>

    <div class="card">
      <div class="card-title">Paste Probe JSON</div>
      <textarea id="f_importJson" rows="12" placeholder="Collez ici la réponse JSON renvoyée par Claude ou ChatGPT...">${escapeHtml(d.importDraftJson || "")}</textarea>
      <div id="importFeedback" class="mt12"></div>
      <div class="btn-row mt12">
        <button class="btn btn-primary" data-action="import-analysis">⬇️ IMPORT ANALYSIS</button>
      </div>
    </div>

    <div class="btn-row mt24" style="justify-content:space-between;">
      <button class="btn btn-ghost" data-action="goto-step" data-step="2">← Back</button>
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

    // step1 field bindings
    const bindField = (id, key) => {
      const el = $("#" + id);
      if (!el) return;
      el.addEventListener("input", () => { state.draft.context[key] = el.value; saveDraft(); });
    };
    ["prospect", "opportunity", "date", "salesRep", "contacts", "contactRoles", "leadSource", "knownContext", "callObjective", "preCallNotes"]
      .forEach((k) => bindField("f_" + k, k));

    const callTypeWrap = $("#f_callType");
    if (callTypeWrap) {
      $$(".chip", callTypeWrap).forEach((chip) => chip.addEventListener("click", () => {
        state.draft.context.callType = chip.getAttribute("data-val");
        saveDraft();
        $$(".chip", callTypeWrap).forEach((c) => c.classList.toggle("active", c === chip));
      }));
    }

    $$("[data-guide]").forEach((cb) => cb.addEventListener("change", () => {
      const [sec, idx] = cb.getAttribute("data-guide").split(":");
      state.draft.checklist[sec] = state.draft.checklist[sec] || {};
      state.draft.checklist[sec][idx] = cb.checked;
      saveDraft();
    }));

    $$("[data-toggle]").forEach((h) => h.addEventListener("click", () => {
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

    // step 4 (results embedded in the wizard) needs the same accordion /
    // radar interactions as the standalone Results page.
    if ((state.draft.step || 1) === 4) bindResultsInteractions(view);
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
      const i = Number(el.getAttribute("data-radar-toggle"));
      state.openRadarItem = state.openRadarItem === i ? null : i;
      render();
    }));
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
      prospect: state.draft.context.prospect || parsed.data.meta?.prospect || "Prospect sans nom",
      callType: state.draft.context.callType || parsed.data.meta?.call_type || "Other",
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
    if (check.warnings.length) toast("Analyse importée avec quelques avertissements — voir Results.");
    else toast("Analyse importée ✓");
    render();
  }

  // ============================================================ RESULTS (shared renderer)
  function renderResultsBody(analysis) {
    const r = analysis.result || {};
    const es = r.executive_summary || {};
    const ds = r.discovery_score || {};
    const sp = r.sales_performance || {};
    const cf = r.colorz_fit || {};
    const radar = (r.opportunity_radar || []).slice().sort((a, b) => num(b.opportunity_score) - num(a.opportunity_score));
    const top = radar[0];

    const subscoreLabels = {
      business_context: "Business Context", business_goals: "Business Goals", pain_exploration: "Pain Exploration",
      technical_context: "Technical Context", organisation: "Organisation", budget: "Budget",
      decision_process: "Decision Process", timing: "Timing", compelling_event: "Compelling Event", next_steps: "Next Steps"
    };

    const recEmoji = { PUSH: "🔥", QUALIFY: "🎯", EXPLORE: "👀", DO_NOT_PUSH: "🧊" };

    return `
    <div class="exec-summary">
      <div class="card-title" style="color:var(--accent);">Executive Summary</div>
      <div class="es-row"><div class="k">Situation</div><div class="v">${nl2br(es.situation)}</div></div>
      <div class="es-row"><div class="k">Enjeu principal</div><div class="v">${nl2br(es.main_challenge)}</div></div>
      <div class="es-row"><div class="k">Pain principal</div><div class="v">${nl2br(es.main_pain)}</div></div>
      <div class="es-row"><div class="k">Niveau de qualification</div><div class="v"><span class="${badgeClass('medium', es.qualification_level)}">${escapeHtml(es.qualification_level || "—")}</span></div></div>
      <div class="es-row"><div class="k">Meilleure opportunité</div><div class="v">${escapeHtml(es.best_opportunity)}</div></div>
      <div class="es-row"><div class="k">Principal risque</div><div class="v">${nl2br(es.main_risk)}</div></div>
      <div class="es-row"><div class="k">Prochaine action</div><div class="v">${nl2br(es.recommended_next_action)}</div></div>
    </div>

    <div class="grid grid-4">
      <div class="stat"><div class="stat-label">Discovery</div><div class="stat-value">${num(ds.global)}<small>/100</small></div></div>
      <div class="stat"><div class="stat-label">Sales Performance</div><div class="stat-value">${num(sp.global)}<small>/100</small></div></div>
      <div class="stat"><div class="stat-label">Colorz Fit</div><div class="stat-value">${num(cf.score)}<small>/100</small></div></div>
      <div class="stat"><div class="stat-label">Top Opportunity</div><div class="stat-value" style="font-size:18px;">${top ? escapeHtml(top.territory) : "—"}</div>
        ${top ? `<div class="stat-trend">${num(top.opportunity_score)}/100</div>` : ""}</div>
    </div>

    <div class="grid grid-2 mt16">
      <div class="card">
        <div class="card-title">Discovery Score — détail</div>
        ${Object.entries(subscoreLabels).map(([key, label]) => `
          <div class="subscore-row">
            <div class="label">${label}</div>
            <div class="bar-track"><div class="bar-fill" style="width:${num(ds.sub_scores?.[key]) * 10}%"></div></div>
            <div class="val">${num(ds.sub_scores?.[key])}/10</div>
          </div>`).join("")}
        ${ds.rationale ? `<p class="item-meta mt12">${nl2br(ds.rationale)}</p>` : ""}
      </div>
      <div class="card">
        <div class="card-title">📡 Opportunity Radar</div>
        ${radar.length ? radar.map((o, i) => renderRadarItem(o, i)).join("") : `<p class="small muted">Aucune opportunité détectée.</p>`}
      </div>
    </div>

    <div class="mt24">
      ${accordion("markers", "🔥 Key Markers", (r.key_markers || []).length, renderKeyMarkers(r.key_markers))}
      ${accordion("goals", "🎯 Business Goals", (r.client_mapping?.business_goals || []).length, renderBusinessGoals(r.client_mapping))}
      ${accordion("pains", "😬 Pain Points", (r.client_mapping?.pain_points || []).length, renderPainPoints(r.client_mapping))}
      ${accordion("client", "🗂️ Client Mapping — Company / Situation / Project", null, renderClientMapping(r.client_mapping))}
      ${accordion("gaps", "🚨 Discovery Gaps", (r.discovery_gaps || []).length, renderDiscoveryGaps(r.discovery_gaps))}
      ${accordion("missedq", "🫣 Missed Questions", (r.missed_questions || []).length, renderMissedQuestions(r.missed_questions))}
      ${accordion("missedo", "🫣 Missed Opportunities", (r.missed_opportunities || []).length, renderMissedOpportunities(r.missed_opportunities))}
      ${accordion("wins", "💎 Commercial Wins", (r.sales_performance?.commercial_wins || []).length, renderWins(r.sales_performance))}
      ${accordion("coaching", "🧠 Sales Coaching", (r.sales_performance?.coaching || []).length, renderCoaching(r.sales_performance))}
      ${accordion("pitch", "🎯 Pitch Discipline", null, renderPitchDiscipline(r.pitch_discipline))}
      ${accordion("callback", "📞 Callback", null, renderCallback(r.callback))}
      ${accordion("colorzmatch", "🚀 Colorz Match", null, renderColorzMatch(r.colorz_match))}
      ${accordion("colorzfit", "🎯 Colorz Fit — détail", null, renderColorzFit(r.colorz_fit))}
      ${accordion("angles", "🚀 Recommended Sales Angles", (r.recommended_sales_angles || []).length, renderAngles(r.recommended_sales_angles))}
      ${accordion("watchouts", "⚠️ Watchouts", (r.watchouts || []).length, renderWatchouts(r.watchouts))}
      ${accordion("actions", "✅ Next Best Actions", (r.next_best_actions || []).length, renderNextActions(r.next_best_actions))}
    </div>
    `;
  }

  function accordion(key, title, count, body) {
    const open = state.openAccordions.has(key);
    return `<div class="accordion ${open ? "open" : ""}" data-accordion="${key}">
      <div class="accordion-head" data-toggle="${key}"><span>${title}${count !== null && count !== undefined ? `<span class="accordion-count">${count}</span>` : ""}</span><span class="chev">›</span></div>
      <div class="accordion-body">${body}</div>
    </div>`;
  }

  function renderRadarItem(o, i) {
    const recClass = { PUSH: "badge-push", QUALIFY: "badge-qualify", EXPLORE: "badge-explore", DO_NOT_PUSH: "badge-donotpush" }[o.recommendation] || "badge-donotpush";
    const emoji = { PUSH: "🔥", QUALIFY: "🎯", EXPLORE: "👀", DO_NOT_PUSH: "🧊" }[o.recommendation] || "📡";
    const openDetail = state.openRadarItem === i;
    return `
    <div class="radar-item" data-radar-toggle="${i}">
      <div class="radar-emoji">${emoji}</div>
      <div class="radar-main">
        <div class="radar-name">${escapeHtml(o.territory || "—")}</div>
        <div class="radar-conf">Confidence ${num(o.confidence_score)}%</div>
        <div class="radar-bar-track"><div class="radar-bar-fill" style="width:${num(o.opportunity_score)}%"></div></div>
      </div>
      <div class="radar-score">
        <div class="num">${num(o.opportunity_score)}</div>
        <div class="max">/100</div>
        <span class="badge ${recClass}" style="margin-top:6px;">${escapeHtml(o.recommendation || "")}</span>
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
    if (!pains.length) return `<p class="muted">Aucun pain point identifié.</p>`;
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
    return block("Company", cm.company) + block("Current Situation", cm.current_situation) + block("Project", cm.project);
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
    if (!wins.length) return `<p class="muted">Aucun win identifié.</p>`;
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
    const cls = { TOO_EARLY: "badge-critical", APPROPRIATE: "badge-push", LATE: "badge-medium" }[pd.assessment] || "badge-donotpush";
    return `<div class="item">
      <div class="item-title">Premier pitch : ${escapeHtml(pd.first_pitch_moment)} <span class="badge ${cls}">${escapeHtml(pd.assessment || "")}</span></div>
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
    const block = (title, arr, cls) => (arr && arr.length) ? `<div class="item"><div class="item-title">${title}</div><div class="item-body">${listUl(arr)}</div></div>` : "";
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
        <button class="btn btn-sm" data-action="export-analysis" data-id="${analysis.id}">Export JSON</button>
        <button class="btn btn-sm btn-danger" data-action="delete-analysis" data-id="${analysis.id}">Delete</button>
      </div>
    </div>
    ${renderResultsBody(analysis)}
    `;
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

  function slug(s) {
    return String(s || "probe").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "probe";
  }

  // ============================================================ HISTORY
  function renderHistory() {
    if (!state.analyses.length) {
      return `<div class="page-head"><div class="page-eyebrow">History</div><h1 class="page-title">Historique</h1></div>
      <div class="empty-state"><div class="big">🕘</div><p>Aucune analyse enregistrée.</p></div>`;
    }
    const rows = state.analyses.map((a) => {
      const r = a.result || {};
      return `<div class="hist-row" data-open="${a.id}">
        <div><strong>${escapeHtml(a.prospect)}</strong><div class="small muted">${escapeHtml(a.callType || "")}</div></div>
        <div class="small">${fmtDate(a.date)}</div>
        <div class="mono">${num(r.discovery_score?.global)}</div>
        <div class="mono">${num(r.sales_performance?.global)}</div>
        <div class="mono">${num(r.colorz_fit?.score)}</div>
        <div class="small">${escapeHtml(r.executive_summary?.best_opportunity || "—")}</div>
        <div>${r.callback?.recommended ? '<span class="badge badge-qualify">📞 YES</span>' : '<span class="badge badge-donotpush">NO</span>'}</div>
      </div>`;
    }).join("");

    return `
    <div class="page-head">
      <div class="page-eyebrow">History</div>
      <h1 class="page-title">Historique</h1>
      <p class="page-sub">${state.analyses.length} discovery(ies) analysée(s).</p>
    </div>
    <div class="card" style="padding:0;">
      <div class="hist-row head">
        <div>Prospect</div><div>Date</div><div>Discovery</div><div>Sales</div><div>Fit</div><div>Top Opportunity</div><div>Callback</div>
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
      <div class="page-eyebrow">Methodology</div>
      <h1 class="page-title">Référentiel Probe / Colorz</h1>
      <p class="page-sub">Éditable — utilisé pour générer chaque futur Probe Prompt. Rien n'est injecté automatiquement en dehors de ce référentiel.</p>
    </div>

    <div class="methodology-block">
      <div class="methodology-block-title">Key Markers</div>
      <div class="methodology-block-sub">Marqueurs commerciaux recherchés pendant l'analyse.</div>
      <div class="tag-list" id="mk_keyMarkers">
        ${m.keyMarkers.map((k, i) => `<span class="tag">${escapeHtml(k)}<button data-remove="keyMarkers:${i}">✕</button></span>`).join("")}
      </div>
      <div class="inline-add"><input type="text" id="add_keyMarkers" placeholder="Ajouter un key marker…"><button class="btn btn-sm" data-add="keyMarkers">Add</button></div>
    </div>

    <div class="methodology-block">
      <div class="methodology-block-title">Digital Selling Territories</div>
      <div class="methodology-block-sub">Territoires Digital Selling 360 — de la stratégie à la fidélisation.</div>
      ${m.territories.map((t, i) => `<div class="entity-card">
        <div class="entity-card-head"><div class="entity-card-title">${escapeHtml(t.name)}</div><button class="btn btn-sm btn-danger" data-remove="territories:${i}">Remove</button></div>
        <div class="entity-card-desc">${escapeHtml(t.description)}</div>
      </div>`).join("")}
      <div class="inline-add"><input type="text" id="add_territories_name" placeholder="Nom du territoire"><input type="text" id="add_territories_desc" placeholder="Description"><button class="btn btn-sm" data-add="territories">Add</button></div>
    </div>

    <div class="methodology-block">
      <div class="methodology-block-title">Colorz Expertises</div>
      ${m.expertises.map((e, i) => `<div class="entity-card">
        <div class="entity-card-head"><div class="entity-card-title">${escapeHtml(e.name)}</div><button class="btn btn-sm btn-danger" data-remove="expertises:${i}">Remove</button></div>
        <div class="entity-card-desc">${escapeHtml(e.description)}</div>
      </div>`).join("")}
      <div class="inline-add"><input type="text" id="add_expertises_name" placeholder="Nom de l'expertise"><input type="text" id="add_expertises_desc" placeholder="Description"><button class="btn btn-sm" data-add="expertises">Add</button></div>
    </div>

    <div class="methodology-block">
      <div class="methodology-block-title">Colorz Accelerators</div>
      <div class="methodology-block-sub">Modules déjà développés et éprouvés par Colorz, réutilisables et adaptables. Ne jamais inventer un accélérateur absent de cette liste.</div>
      ${m.accelerators.map((a, i) => `<div class="entity-card">
        <div class="entity-card-head"><div class="entity-card-title">★ ${escapeHtml(a.name)}</div><button class="btn btn-sm btn-danger" data-remove="accelerators:${i}">Remove</button></div>
        <div class="entity-card-desc">${escapeHtml(a.description)}</div>
        <div class="entity-card-desc"><em>Pertinent si :</em> ${(a.relevantWhen || []).map(escapeHtml).join(", ")}</div>
      </div>`).join("")}
      <div class="inline-add"><input type="text" id="add_accelerators_name" placeholder="Nom de l'accélérateur"><input type="text" id="add_accelerators_desc" placeholder="Description"><button class="btn btn-sm" data-add="accelerators">Add</button></div>
    </div>

    <div class="methodology-block">
      <div class="methodology-block-title">Partners / Solutions</div>
      ${m.partners.map((p, i) => `<div class="entity-card">
        <div class="entity-card-head"><div class="entity-card-title">${escapeHtml(p.name)} <span class="small muted">— ${escapeHtml(p.category || "")}</span></div><button class="btn btn-sm btn-danger" data-remove="partners:${i}">Remove</button></div>
        <div class="entity-card-desc">${escapeHtml(p.description)}</div>
      </div>`).join("")}
      <div class="inline-add"><input type="text" id="add_partners_name" placeholder="Nom du partenaire"><input type="text" id="add_partners_desc" placeholder="Description / catégorie"><button class="btn btn-sm" data-add="partners">Add</button></div>
    </div>

    <div class="methodology-block">
      <div class="methodology-block-title">Discovery Rules</div>
      ${m.discoveryRules.map((rule, i) => `<div class="entity-card"><div class="entity-card-head"><div class="entity-card-desc" style="margin-top:0;">${escapeHtml(rule)}</div><button class="btn btn-sm btn-danger" data-remove="discoveryRules:${i}">Remove</button></div></div>`).join("")}
      <div class="inline-add"><input type="text" id="add_discoveryRules" placeholder="Ajouter une règle de discovery…"><button class="btn btn-sm" data-add="discoveryRules">Add</button></div>
    </div>

    <div class="methodology-block">
      <div class="methodology-block-title">Sales Coaching Rules</div>
      ${m.salesCoachingRules.map((rule, i) => `<div class="entity-card"><div class="entity-card-head"><div class="entity-card-desc" style="margin-top:0;">${escapeHtml(rule)}</div><button class="btn btn-sm btn-danger" data-remove="salesCoachingRules:${i}">Remove</button></div></div>`).join("")}
      <div class="inline-add"><input type="text" id="add_salesCoachingRules" placeholder="Ajouter une règle de coaching…"><button class="btn btn-sm" data-add="salesCoachingRules">Add</button></div>
    </div>

    <div class="btn-row mt24">
      <button class="btn btn-ghost" data-action="reset-methodology">Reset to defaults</button>
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
      <div class="page-eyebrow">Settings</div>
      <h1 class="page-title">Réglages</h1>
    </div>

    <div class="card">
      <div class="card-title">Apparence</div>
      <div class="chip-select">
        <div class="chip ${s.theme !== "light" ? "active" : ""}" data-theme="dark">🌙 Dark</div>
        <div class="chip ${s.theme === "light" ? "active" : ""}" data-theme="light">☀️ Light</div>
      </div>
    </div>

    <div class="card">
      <div class="card-title">Transcript</div>
      <label class="switch"><input type="checkbox" id="f_keepTranscript" ${s.keepTranscript ? "checked" : ""}> Conserver le transcript après import de l'analyse</label>
      <p class="hint">Par défaut, le transcript n'est pas conservé dans l'historique une fois l'analyse importée.</p>
    </div>

    <div class="card">
      <div class="card-title">Backup</div>
      <div class="btn-row">
        <button class="btn" data-action="export-backup">⬇️ EXPORT PROBE BACKUP</button>
        <label class="btn" for="importBackupFile" style="cursor:pointer;">⬆️ IMPORT PROBE BACKUP</label>
        <input type="file" id="importBackupFile" accept="application/json" hidden>
      </div>
      <p class="hint">Le backup contient : méthodologie, analyses et réglages.</p>
    </div>

    <div class="card">
      <div class="card-title">Danger zone</div>
      <button class="btn btn-danger" data-action="reset-all">Reset total</button>
      <p class="hint">Supprime définitivement toutes les données Probe de cet appareil (analyses, méthodologie, réglages).</p>
    </div>

    <footer class="app-footer">Your Probe data is stored locally on this device.</footer>
    `;
  }

  function bindSettings() {
    const view = $("#view");
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
        toast("Backup importé ✓");
        render();
      } catch (err) {
        toast("Erreur d'import : fichier invalide");
      }
    });

    const resetBtn = view.querySelector('[data-action="reset-all"]');
    if (resetBtn) resetBtn.addEventListener("click", async () => {
      if (!confirm("Supprimer TOUTES les données Probe sur cet appareil ? Cette action est irréversible.")) return;
      if (!confirm("Confirmation finale : reset total de Probe ?")) return;
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
    await Promise.all([loadMethodology(), loadSettings(), loadAnalyses(), loadDraft()]);
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
