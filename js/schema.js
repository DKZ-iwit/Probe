/* ==========================================================================
   PROBE — schema.js
   The single contract between Probe -> AI -> Probe.
   Used to:
     1) generate the structural JSON example injected into the Probe Prompt
     2) validate imported JSON (essential fields only, never hard-fails)
     3) drive the Results dashboard rendering
   ========================================================================== */

const ProbeSchema = (() => {

  // Top-level keys Probe considers "essential" when importing a JSON result.
  // Missing keys degrade gracefully in the dashboard rather than blocking import.
  const REQUIRED_TOP_LEVEL_KEYS = [
    "executive_summary",
    "client_mapping",
    "discovery_score",
    "sales_performance",
    "opportunity_radar",
    "colorz_fit",
  ];

  // Full structural example — every key Probe knows how to render.
  // This exact object (with instructive placeholder values) is injected
  // verbatim into the generated Probe Prompt so the AI returns matching shape.
  const EXAMPLE = {
    meta: {
      prospect: "string — nom du prospect / société",
      call_type: "First Discovery | Qualification | Follow-up | Technical Discovery | Pre-Proposal | Other",
      analysis_date: "YYYY-MM-DD"
    },

    executive_summary: {
      situation: "string — 1-2 phrases",
      main_challenge: "string",
      main_pain: "string",
      qualification_level: "LOW | MEDIUM | HIGH",
      best_opportunity: "string — nom du territoire Digital Selling le plus prometteur",
      main_risk: "string",
      recommended_next_action: "string"
    },

    client_mapping: {
      company: {
        activity: "string",
        business_model: "string",
        positioning: "string",
        organisation: "string",
        markets: "string",
        international: "string",
        digital_maturity: "string",
        status: "FACT | INFERENCE | UNKNOWN"
      },
      current_situation: {
        platform: "string",
        architecture: "string",
        tools: "string",
        partners_agencies: "string",
        internal_organisation: "string",
        resources: "string",
        status: "FACT | INFERENCE | UNKNOWN"
      },
      project: {
        nature: "string",
        origin: "string",
        scope: "string",
        objectives: "string",
        timeline: "string",
        constraints: "string",
        status: "FACT | INFERENCE | UNKNOWN"
      },
      business_goals: [
        {
          label: "string",
          evidence: "string — citation ou paraphrase du transcript",
          status: "FACT | INFERENCE",
          importance: "LOW | MEDIUM | HIGH | CRITICAL"
        }
      ],
      pain_points: [
        {
          label: "string",
          description: "string",
          importance: "LOW | MEDIUM | HIGH | CRITICAL",
          evidence: "string",
          business_impact: "string",
          status: "FACT | INFERENCE"
        }
      ]
    },

    buying_committee: [
      {
        name: "string — nom de l'interlocuteur",
        job_title: "string — fonction",
        declared_role: "UNKNOWN | DECISION_MAKER | CHAMPION | INFLUENCER | USER | BLOCKER — tel que déclaré par l'utilisateur avant le call, ne jamais l'écraser silencieusement",
        inferred_role: "UNKNOWN | DECISION_MAKER | CHAMPION | POTENTIAL_CHAMPION | INFLUENCER | USER | BLOCKER — lecture de l'IA à partir du transcript",
        role_confidence: 0,
        evidence: "string",
        influence_level: "LOW | MEDIUM | HIGH | UNKNOWN",
        attitude_to_colorz: "FAVORABLE | NEUTRAL | UNFAVORABLE | UNKNOWN",
        notes: "string"
      }
    ],

    key_markers: [
      {
        marker: "string — ex: TCO, Dette technique, Multi-brand...",
        importance: "LOW | MEDIUM | HIGH | CRITICAL",
        evidence: "string",
        commercial_implication: "string"
      }
    ],

    discovery_score: {
      global: 0,
      sub_scores: {
        business_context: 0,
        business_goals: 0,
        pain_exploration: 0,
        technical_context: 0,
        organisation: 0,
        budget: 0,
        decision_process: 0,
        timing: 0,
        compelling_event: 0,
        next_steps: 0
      },
      rationale: "string — pourquoi ce score, quelles infos manquent"
    },

    sales_performance: {
      global: 0,
      criteria_notes: "string — synthèse qualitative",
      commercial_wins: [
        {
          title: "string",
          explanation: "string",
          evidence: "string",
          impact: "string",
          emoji: "🔥 | 🎯 | 🧠 | 🦄 | 🚀 | 💎"
        }
      ],
      coaching: [
        {
          situation: "string",
          issue: "string",
          why_it_matters: "string",
          better_approach: "string",
          suggested_wording: "string",
          evidence: "string",
          emoji: "👀 | 🫣 | ⚠️ | 🚨"
        }
      ]
    },

    missed_questions: [
      {
        topic: "string",
        importance: "NICE_TO_HAVE | IMPORTANT | CRITICAL",
        reason: "string",
        suggested_question: "string",
        consequence: "string"
      }
    ],

    missed_opportunities: [
      {
        signal: "string",
        evidence: "string",
        what_happened: "string",
        why_it_mattered: "string",
        better_follow_up: "string"
      }
    ],

    pitch_discipline: {
      first_pitch_moment: "string — moment approximatif dans le call",
      qualification_level_before_pitch: "string",
      assessment: "TOO_EARLY | APPROPRIATE | LATE",
      explanation: "string"
    },

    discovery_gaps: [
      {
        topic: "string",
        priority: "BLOCKING | IMPORTANT | USEFUL",
        reason: "string",
        suggested_question: "string"
      }
    ],

    callback: {
      recommended: false,
      reason: "string",
      recommended_duration: "string",
      priority_questions: ["string"]
    },

    opportunity_radar: [
      {
        territory: "string — un territoire Digital Selling du référentiel Colorz",
        signal: "string",
        potential_problem: "string",
        evidence: "string",
        fact_or_inference: "FACT | INFERENCE",
        missing_information: ["string"],
        questions_to_ask: ["string"],
        opportunity_score: 0,
        confidence_score: 0,
        recommendation: "PUSH | QUALIFY | EXPLORE | DO_NOT_PUSH",
        colorz_match: {
          expertises: ["string"],
          accelerators: ["string — uniquement issus du référentiel fourni"],
          partners_solutions: ["string — uniquement issus du référentiel fourni"]
        },
        next_move: "string"
      }
    ],

    colorz_fit: {
      score: 0,
      strong_fits: ["string"],
      partial_fits: ["string"],
      mismatches: ["string"],
      risks: ["string"]
    },

    // Win Score — force de la position commerciale de Colorz sur l'opportunité
    // principale. Distinct de l'Opportunity Score (intérêt de l'opportunité).
    // Raisonnement inspiré de MEDDPICC, jamais exposé comme tel à l'utilisateur.
    win_assessment: {
      score: 0,
      confidence: 0,
      label: "Très favorable | Favorable | Incertain | Fragile | Très fragile",
      deal_strength: {
        summary: "string — douleur, impact business, urgence, compelling event, budget, coût du statu quo, fit Colorz",
        signals: ["string"]
      },
      colorz_position: {
        summary: "string — position de Colorz face à la concurrence, sans fiche concurrent détaillée",
        competitors_named: ["string"],
        competitor_count: "UNKNOWN | COLORZ_ONLY | TWO | THREE_PLUS | RFP",
        incumbent: "string ou UNKNOWN",
        advantage_perceived: "string",
        decision_criteria_known: ["string"]
      },
      political_position: {
        summary: "string — décideur, champion, sponsor, opposants, accès au pouvoir",
        signals: ["string"]
      },
      process_control: {
        summary: "string — critères de décision, calendrier, budget, procurement, prochaine étape",
        signals: ["string"]
      },
      win_drivers: [
        {
          title: "string",
          strength: "LOW | MEDIUM | HIGH",
          evidence: "string",
          status: "FACT | INFERENCE | UNKNOWN",
          explanation: "string"
        }
      ],
      loss_risks: [
        {
          title: "string",
          severity: "LOW | MEDIUM | HIGH | CRITICAL",
          evidence: "string",
          status: "FACT | INFERENCE | UNKNOWN",
          explanation: "string",
          mitigation: "string"
        }
      ],
      how_to_win: [
        {
          priority: 1,
          action: "string",
          reason: "string",
          expected_impact: "string",
          suggested_wording: "string"
        }
      ]
    },

    colorz_match: {
      expertise_matches: [
        {
          expertise: "string",
          relevance: "string",
          client_need: "string",
          evidence: "string",
          recommended_angle: "string"
        }
      ],
      accelerator_matches: [
        {
          accelerator: "string — uniquement issu du référentiel",
          relevance: "string",
          client_problem: "string",
          evidence: "string",
          recommended_angle: "string"
        }
      ],
      solution_partner_matches: [
        {
          solution_or_partner: "string — uniquement issu du référentiel",
          relevance: "string",
          corresponding_need: "string",
          confidence: "LOW | MEDIUM | HIGH",
          qualification_needed: "string",
          suggested_action: "string"
        }
      ]
    },

    recommended_sales_angles: [
      {
        priority: 1,
        title: "string",
        client_pain: "string",
        message: "string",
        evidence: "string",
        recommended_positioning: "string"
      }
    ],

    watchouts: [
      {
        topic: "string",
        severity: "LOW | MEDIUM | HIGH | CRITICAL",
        explanation: "string",
        evidence: "string",
        mitigation: "string"
      }
    ],

    next_best_actions: [
      {
        priority: 1,
        timing: "NOW | BEFORE_NEXT_CALL | NEXT_CALL | LATER",
        action: "string",
        reason: "string",
        expected_outcome: "string"
      }
    ]
  };

  function toPromptExampleString() {
    return JSON.stringify(EXAMPLE, null, 2);
  }

  // Lightweight, non-blocking validation. Returns { valid, missing, warnings }.
  function validate(obj) {
    const missing = [];
    if (!obj || typeof obj !== "object") {
      return { valid: false, missing: ["(root)"], warnings: ["Le JSON importé n'est pas un objet valide."] };
    }
    REQUIRED_TOP_LEVEL_KEYS.forEach((k) => {
      if (!(k in obj)) missing.push(k);
    });
    const warnings = [];
    if (obj.discovery_score && typeof obj.discovery_score.global !== "number") {
      warnings.push("discovery_score.global manquant ou non numérique.");
    }
    if (obj.opportunity_radar && !Array.isArray(obj.opportunity_radar)) {
      warnings.push("opportunity_radar devrait être un tableau.");
    }
    return { valid: missing.length === 0, missing, warnings };
  }

  // Attempts to salvage a JSON object out of a string that may contain
  // stray markdown fences or leading/trailing prose.
  function extractJson(raw) {
    if (!raw) return { ok: false, error: "Contenu vide." };
    let text = String(raw).trim();
    // strip ```json ... ``` or ``` ... ```
    text = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
    // direct parse attempt
    try {
      return { ok: true, data: JSON.parse(text) };
    } catch (e) {
      // try to find the outermost { ... } block
      const first = text.indexOf("{");
      const last = text.lastIndexOf("}");
      if (first !== -1 && last !== -1 && last > first) {
        const slice = text.slice(first, last + 1);
        try {
          return { ok: true, data: JSON.parse(slice) };
        } catch (e2) {
          return { ok: false, error: "JSON invalide : " + e2.message };
        }
      }
      return { ok: false, error: "JSON invalide : " + e.message };
    }
  }

  return {
    REQUIRED_TOP_LEVEL_KEYS,
    EXAMPLE,
    toPromptExampleString,
    validate,
    extractJson
  };
})();
