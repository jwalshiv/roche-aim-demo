const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.ANTHROPIC_API_KEY;

// Content selection below (Lead/Support/Proof/internal notes) is fully
// deterministic and does NOT use this key. It's kept here, and callAnthropic()
// below stays ready to call, for the planned generative-content feature —
// e.g. drafting a cohesive customer email from a set of verbatim selections.
// Retrieval must never depend on this; only a genuinely generative step should.
if (!API_KEY) {
  console.warn('WARNING: ANTHROPIC_API_KEY not set. Content selection will work fine without it, but any generative feature added later will fail until it is set.');
}

const HTML = fs.readFileSync(path.join(__dirname, 'roche-app.html'), 'utf8');
const DECK_PDF_PATH = path.join(__dirname, 'reference-deck.pdf');

// Reference database: verbatim content from the Global Customer Relationship
// Study 2025 deck only. Every "text" field must be reproduced exactly as
// written in the source deck — no paraphrasing, no rewriting.
//
// Definitions:
// - lead:    highest-level statement relevant to the query. Selected first,
//            directly against the requested buying influence / customer need.
// - support: detail that substantiates a lead message. Selected via
//            relatedLead — i.e. only surfaced once a lead has been chosen,
//            never independently tag-matched on its own.
// - proof:   case studies / stories related to a lead + its support,
//            selected the same way via relatedLead.
//
// audience: "external" entries are safe candidates for customer-facing
// messaging output (Lead/Support/Proof). "internal" is reserved for two
// kinds of "company talking to itself": (1) directive self-talk — "we
// must...", "Roche can unlock...", or an imperative action-item header
// ("Address...", "Enhance...", "Help them...", "Enable them...",
// "Strengthen..."); and (2) analytical self-talk — Roche studying its own
// customer base using internal-only frameworks and metrics a customer
// wouldn't recognize or care about (e.g. "Promoter"/"Detractor" NPS
// segmentation, internal win-rate or renewal-rate figures). Everything
// else — plain findings, stats, and quotes about customers, even
// unflattering ones — defaults to external. Both case studies (China/Brazil)
// are internal process narration and stay internal for that reason.
const MESSAGE_LIBRARY = {
  "CRR-06a": { type: "lead", audience: "external", text: "Customer relationships matter because they drive loyalty and real commercial impact", source: "Slide 6", buyingInfluence: ["clinical","financial"], customerChallenge: ["operational-excellence-uptime"] },
  "CRR-06e": { type: "lead", audience: "internal", text: "Promoter accounts renew 90% more often than Detractors", source: "Slide 6", buyingInfluence: ["financial"], customerChallenge: ["operational-excellence-uptime"] },
  "CRR-06f": { type: "lead", audience: "internal", text: "Promoter accounts have a 53% higher win rate than Detractors", source: "Slide 6", buyingInfluence: ["financial"], customerChallenge: ["operational-excellence-uptime"] },
  "CRR-06g": { type: "lead", audience: "internal", text: "Promoter accounts generate ~58% of the revenue", source: "Slide 6", buyingInfluence: ["financial"], customerChallenge: ["operational-excellence-uptime"] },
  "CRR-07a": { type: "lead", audience: "external", text: "Strong relationships, with opportunities to strengthen operations, communication, and future growth", source: "Slide 7", buyingInfluence: ["operational","financial"], customerChallenge: ["operational-excellence-uptime","communication-transparency"] },
  "CRR-07d": { type: "lead", audience: "external", text: "88% Overall satisfaction with Roche", source: "Slide 7", buyingInfluence: ["clinical","operational","financial"], customerChallenge: ["product-technical"] },
  "CRR-07e": { type: "lead", audience: "external", text: "89% Believe Roche is a true partner", source: "Slide 7", buyingInfluence: ["clinical","operational","financial"], customerChallenge: ["strategic-partnership"] },
  "CRR-09a": { type: "lead", audience: "external", text: "Customers praise our people and products but highlight areas to improve", source: "Slide 9", buyingInfluence: ["clinical"], customerChallenge: ["product-technical"] },
  "CRR-09b": { type: "lead", audience: "external", text: "60% of our customers would recommend Roche; only 8% would not", source: "Slide 9", buyingInfluence: ["clinical","financial"], customerChallenge: ["product-technical"] },
  "CRR-11a": { type: "lead", audience: "external", text: "Customers link transparent and proactive communication to their ability to plan ahead, innovate and grow", source: "Slide 11", buyingInfluence: ["operational","financial"], customerChallenge: ["communication-transparency"] },
  "CRR-12a": { type: "lead", audience: "external", text: "Customers want digital solutions but integration and staff readiness block adoption", source: "Slide 12", buyingInfluence: ["operational","financial"], customerChallenge: ["automation-digitalization","barriers-to-digital-adoption"] },
  "CRR-12b": { type: "lead", audience: "external", text: "59% of customers want to explore optimising their lab workflows, and while 44% are interested in digital solutions to drive efficiency and growth they face major barriers", source: "Slide 12", buyingInfluence: ["operational","financial"], customerChallenge: ["automation-digitalization","barriers-to-digital-adoption"] },
  "CRR-14a": { type: "lead", audience: "external", text: "Large labs are less likely to recommend Roche\u2026", source: "Slide 14", buyingInfluence: ["financial"], customerChallenge: ["operational-excellence-uptime"] },
  "CRR-15a": { type: "lead", audience: "external", text: "\u2026because operational inconsistencies can often turn into major failures", source: "Slide 15", buyingInfluence: ["operational"], customerChallenge: ["service-logistics-reliability","operational-excellence-uptime"] },
  "CRR-16a": { type: "lead", audience: "external", text: "Executives are less likely to recommend Roche\u2026", source: "Slide 16", buyingInfluence: ["financial"], customerChallenge: ["strategic-partnership"] },
  "CRR-17a": { type: "lead", audience: "external", text: "\u2026and they wish for more engagement and strategic partnership", source: "Slide 17", buyingInfluence: ["financial"], customerChallenge: ["strategic-partnership"] },
  "CRR-19": { type: "lead", audience: "external", text: "Overall experience along the customer journey is high with opportunities to improve", source: "Slide 19", buyingInfluence: ["operational","clinical"], customerChallenge: ["operational-excellence-uptime"] },
  "CRR-34a": { type: "lead", audience: "external", text: "Foundation of trust: Customers rate Roche highly for reliable products and professional staff. With an NPS of +49 and 89% seeing us as a true partner, trust in our people and solutions is our biggest strength", source: "Slide 34", buyingInfluence: ["clinical","financial"], customerChallenge: ["strategic-partnership","product-technical"] },
  "CRR-34b": { type: "lead", audience: "internal", text: "Win the C-Suite: While quality is recognized, many executives perceive Roche as transactional. To win the C-Suite, we must position ourselves as a strategic partner, enabling efficiency and access to innovation", source: "Slide 34", buyingInfluence: ["financial"], customerChallenge: ["strategic-partnership","access-to-innovation"] },
  "CRR-34c": { type: "lead", audience: "internal", text: "Enable future growth: Labs see strong potential in digital and AI-driven solutions, but face barriers with IT integration, budgets, and staff readiness. Roche can unlock adoption by reducing complexity, co-developing solutions, and supporting change management", source: "Slide 34", buyingInfluence: ["operational","financial"], customerChallenge: ["automation-digitalization","barriers-to-digital-adoption"] },
  "CRR-34d": { type: "lead", audience: "internal", text: "Close the communication gap: Proactive, transparent updates on orders, service, and innovation are critical. Customers want early insights to better manage operations and plan long-term", source: "Slide 34", buyingInfluence: ["operational"], customerChallenge: ["communication-transparency"] },

  "CRR-06b": { type: "support", audience: "external", relatedLead: ["CRR-06a"], text: "Over the 18 years of collaboration, I have been satisfied with the quality, durability of the equipment and reliability of Roche products, but the people I have interacted with are the main reason I recommend Roche", source: "Slide 6, customer quote", buyingInfluence: ["clinical"], customerChallenge: ["strategic-partnership","product-technical"] },
  "CRR-06c": { type: "support", audience: "external", relatedLead: ["CRR-06a"], text: "I did not buy from an equipment seller - I built a partnership with Roche - My Roche contacts are reliable people I trust", source: "Slide 6, customer quote", buyingInfluence: ["clinical","financial"], customerChallenge: ["strategic-partnership"] },
  "CRR-06d": { type: "support", audience: "external", relatedLead: ["CRR-06a"], text: "The relationship with Roche Diagnostics goes beyond the one included in the agreements. We are partners with whom we have been working together for many years.", source: "Slide 6, customer quote", buyingInfluence: ["financial"], customerChallenge: ["strategic-partnership"] },
  "CRR-07b": { type: "support", audience: "external", relatedLead: ["CRR-07a"], text: "Reliable products and accurate results provide a strong foundation of trust. Local teams' responsiveness and expertise strengthen partnerships.", source: "Slide 7", buyingInfluence: ["clinical","operational"], customerChallenge: ["product-technical","strategic-partnership"] },
  "CRR-07c": { type: "support", audience: "external", relatedLead: ["CRR-07a","CRR-34c"], text: "Facing growing pressures, labs seek simpler, automated, and digital solutions and expect Roche to act as the partner for enabling future growth.", source: "Slide 7", buyingInfluence: ["operational","financial"], customerChallenge: ["automation-digitalization"] },
  "CRR-11b": { type: "support", audience: "external", relatedLead: ["CRR-11a"], text: "If the laboratory isn't aware of alternative solutions to work faster, it doesn't have the opportunity to fight to acquire them.", source: "Slide 11, customer quote", buyingInfluence: ["operational"], customerChallenge: ["communication-transparency","access-to-innovation"] },
  "CRR-12c": { type: "support", audience: "external", relatedLead: ["CRR-12a","CRR-12b"], text: "The biggest barriers are system integration, staff adaptation. Despite these, we're committed to advancing digital solutions because of their long-term value", source: "Slide 12, customer quote", buyingInfluence: ["operational"], customerChallenge: ["barriers-to-digital-adoption","managing-staff-shortages"] },
  "CRR-14b": { type: "support", audience: "external", relatedLead: ["CRR-14a"], text: "Main Priority: Cost-effective solutions and expanding test menu while adopting new right-sized solutions.", source: "Slide 14, Small labs", buyingInfluence: ["financial"], customerChallenge: ["cost-effective-right-sized-solutions"] },
  "CRR-14c": { type: "support", audience: "external", relatedLead: ["CRR-14a"], text: "Main Priority: Drive automation and efficiency to manage growth with limited staff.", source: "Slide 14, Medium labs", buyingInfluence: ["operational"], customerChallenge: ["automation-digitalization","managing-staff-shortages"] },
  "CRR-14d": { type: "support", audience: "external", relatedLead: ["CRR-14a"], text: "Main Priority: Standardize and digitalize (AI, DP, predictive analytics) for efficiency at scale.", source: "Slide 14, Large labs", buyingInfluence: ["operational","financial"], customerChallenge: ["automation-digitalization"] },
  "CRR-14e": { type: "support", audience: "external", relatedLead: ["CRR-14a","CRR-15a"], text: "Key Pain Point: Extended downtime caused by delayed parts and service staff shortages", source: "Slide 14, Large labs", buyingInfluence: ["operational"], customerChallenge: ["service-logistics-reliability","managing-staff-shortages"] },
  "CRR-15b": { type: "support", audience: "internal", relatedLead: ["CRR-15a"], text: "Address operational frictions: Support labs with more predictive service, faster access to parts, and after-hours expertise to minimize disruptions.", source: "Slide 15", buyingInfluence: ["operational"], customerChallenge: ["service-logistics-reliability","operational-excellence-uptime"] },
  "CRR-15c": { type: "support", audience: "internal", relatedLead: ["CRR-15a","CRR-34d"], text: "Enhance transparency: Provide early visibility into reagent supply issues and delays so labs can plan workflows and avoid last-minute crisis.", source: "Slide 15", buyingInfluence: ["operational"], customerChallenge: ["communication-transparency","reagent-waste-packaging"] },
  "CRR-16b": { type: "support", audience: "external", relatedLead: ["CRR-16a"], text: "Key Pain Point: High costs, slow processes, and perceived loss of strategic partnership", source: "Slide 16, Executives", buyingInfluence: ["financial"], customerChallenge: ["strategic-partnership","cost-effective-right-sized-solutions"] },
  "CRR-16c": { type: "support", audience: "external", relatedLead: ["CRR-16a","CRR-34c"], text: "Main Priorities: Drive efficiency and growth through digitalization, automation, and AI.", source: "Slide 16, Executives", buyingInfluence: ["financial"], customerChallenge: ["automation-digitalization"] },
  "CRR-17b": { type: "support", audience: "internal", relatedLead: ["CRR-17a"], text: "Efficiency & Scalability: Help them manage growth and control costs with automation solutions, workflow consulting, and inventory tools to improve TAT", source: "Slide 17", buyingInfluence: ["financial","operational"], customerChallenge: ["automation-digitalization","cost-effective-right-sized-solutions"] },
  "CRR-17c": { type: "support", audience: "internal", relatedLead: ["CRR-17a","CRR-34b"], text: "Access to Innovation: Enable them to stay competitive with advanced tech, digital pathology, AI-driven workflows, and expanded menus.", source: "Slide 17", buyingInfluence: ["financial"], customerChallenge: ["access-to-innovation"] },
  "CRR-17d": { type: "support", audience: "internal", relatedLead: ["CRR-17a"], text: "Strategic & Flexible Partnership: Strengthen partnership with transparent innovation pipeline, faster contracting, flexible commercial models and co-development opportunities", source: "Slide 17", buyingInfluence: ["financial"], customerChallenge: ["strategic-partnership","commercial-procurement-flexibility"] },
  "CRR-20": { type: "support", audience: "external", relatedLead: ["CRR-11a","CRR-34d"], text: "This is precisely a difficulty because we lack communication. No proactive communication, no information on new products, no dedicated sales representative. It's difficult to have a contact person when you have a request for information or a price", source: "Slide 20, customer quote", buyingInfluence: ["operational"], customerChallenge: ["communication-transparency"] },
  "CRR-21": { type: "support", audience: "internal", relatedLead: ["CRR-17a","CRR-34b"], text: "Enhancing commercial and contractual flexibility. Customers feel the procurement process is often inflexible, with rigid pricing. This lack of flexibility makes it difficult to align with their internal processes and budgetary constraints.", source: "Slide 21", buyingInfluence: ["financial"], customerChallenge: ["commercial-procurement-flexibility"] },
  "CRR-22": { type: "support", audience: "internal", relatedLead: ["CRR-19"], text: "Addressing space and infrastructure challenges early. Labs frequently struggle with limited physical space for large equipment, a challenge often not addressed during pre-installation inspections. Delays are also caused by issues with a lab's own IT department", source: "Slide 22", buyingInfluence: ["operational"], customerChallenge: ["infrastructure-space-constraints"] },
  "CRR-23": { type: "support", audience: "internal", relatedLead: ["CRR-19"], text: "Expanding training frequency and accessibility. Time constraints in 24/7 labs make it difficult to train all staff; customers ask for more refresher sessions and accessible online options.", source: "Slide 23", buyingInfluence: ["operational"], customerChallenge: ["training-expertise","managing-staff-shortages"] },
  "CRR-24": { type: "support", audience: "internal", relatedLead: ["CRR-09a","CRR-19"], text: "Making product offerings more flexible and cost-effective. High costs and large reagent pack sizes create waste and financial pressure, especially in lower-volume labs.", source: "Slide 24", buyingInfluence: ["financial"], customerChallenge: ["cost-effective-right-sized-solutions","reagent-waste-packaging"] },
  "CRR-25": { type: "support", audience: "internal", relatedLead: ["CRR-15a","CRR-19"], text: "Improving resolution consistency. While many issues are fixed quickly, others are delayed by spare part shortages, repeat visits, or hotline procedures that feel unnecessary for experienced staff.", source: "Slide 25", buyingInfluence: ["operational"], customerChallenge: ["service-logistics-reliability"] },
  "CRR-26": { type: "support", audience: "internal", relatedLead: ["CRR-15a","CRR-19"], text: "Improving delivery reliability and transparency: Despite many positive experiences, some customers report delays, backorders, and partial shipments that disrupt operations. They ask for earlier alerts on shortages and clearer, more reliable ETAs.", source: "Slide 26", buyingInfluence: ["operational"], customerChallenge: ["service-logistics-reliability","communication-transparency"] },
  "CRR-27a": { type: "support", audience: "internal", relatedLead: ["CRR-17a","CRR-19"], text: "Empowering representatives to act independently: Customers believe their representatives are personally capable, but are often restricted by rigid processes and internal hierarchies that slow decision-making.", source: "Slide 27", buyingInfluence: ["financial","operational"], customerChallenge: ["strategic-partnership"] },
  "CRR-27b": { type: "support", audience: "external", relatedLead: ["CRR-17a","CRR-19"], text: "Your front line staff are GREAT... The problem is Roche does not empower them to make decisions", source: "Slide 27, customer quote", buyingInfluence: ["operational"], customerChallenge: ["strategic-partnership"] },

  "CRR-29a": { type: "proof", audience: "internal", relatedLead: ["CRR-34c","CRR-34d"], text: "How China is using the CRR to shape their 2026 strategy", source: "Slide 29, case study" },
  "CRR-29b": { type: "proof", audience: "internal", relatedLead: ["CRR-34c","CRR-34d"], text: "289 responses, 97% response rate \u2014 among the highest globally", source: "Slide 29, case study" },
  "CRR-29c": { type: "proof", audience: "internal", relatedLead: ["CRR-34a","CRR-34d"], text: "Enhancing the TOP account experience through CRR helps better secure China's business", source: "Slide 29, quote \u2014 Carolin Wang, Service Strategy & Transformation, China" },
  "CRR-31a": { type: "proof", audience: "internal", relatedLead: ["CRR-34d","CRR-17a"], text: "How Brazil is using CRR to drive action", source: "Slide 31, case study" },
  "CRR-31b": { type: "proof", audience: "internal", relatedLead: ["CRR-34d"], text: "Brazil conducted in-depth CRR interviews with strategic accounts to assess relationships and capture key feedback.", source: "Slide 31, case study" },
  "CRR-31c": { type: "proof", audience: "internal", relatedLead: ["CRR-34c"], text: "They identified systemic challenges and defined high-level initiatives together with cross-functional leadership to drive improvements.", source: "Slide 31, case study" },
  "CRR-31d": { type: "proof", audience: "internal", relatedLead: ["CRR-17a","CRR-34b"], text: "Brazil developed account reports, collaborated with account teams to prioritize actions, and formalized objectives, impact, owners, and timelines.", source: "Slide 31, case study" },
  "CRR-31e": { type: "proof", audience: "internal", relatedLead: ["CRR-34d","CRR-17a"], text: "Finally, they shared findings and action plans with customers and validated next steps, which reinforced transparency and strengthened partnerships.", source: "Slide 31, case study" }
};

function contentTypeKey(label) {
  const s = (label || '').toLowerCase();
  if (s === 'all') return 'all';
  if (s.indexOf('proof') !== -1) return 'proof';
  if (s.indexOf('support') !== -1) return 'support';
  return 'lead';
}

function tagIncludes(arr, val) {
  return Array.isArray(arr) && arr.indexOf(val) !== -1;
}

// True intersection first: an entry must satisfy every filter that was
// actually specified (not "All"). Only if that intersection is empty do we
// fall back to a partial (any-one-filter) match, as a best-effort — never a
// silent substitution of union logic for a real, specific query.
function filterEntries(entries, audienceValue, needValue) {
  const hasAudience = !!audienceValue && audienceValue !== 'all';
  const hasNeed = !!needValue && needValue !== 'all';

  if (!hasAudience && !hasNeed) {
    return { matches: entries, mode: 'all' };
  }

  const matchesA = function(e) { return hasAudience ? tagIncludes(e[1].buyingInfluence, audienceValue) : true; };
  const matchesN = function(e) { return hasNeed ? tagIncludes(e[1].customerChallenge, needValue) : true; };

  const intersection = entries.filter(function(e) { return matchesA(e) && matchesN(e); });
  if (intersection.length > 0) return { matches: intersection, mode: 'intersection' };

  if (hasAudience && hasNeed) {
    const partial = entries.filter(function(e) { return matchesA(e) || matchesN(e); });
    if (partial.length > 0) return { matches: partial, mode: 'partial' };
  }

  return { matches: [], mode: 'none' };
}

function buildGaps(mode, count, kind, audience) {
  if (mode === 'all') return [];
  if (count === 0) {
    return [{ title: 'No match found', description: 'No ' + audience + ' ' + kind + ' entries in the library satisfy the requested buying influence and customer need.' }];
  }
  if (mode === 'partial') {
    return [{ title: 'Partial match only', description: 'No entry satisfied both the requested buying influence and customer need together \u2014 showing entries that match at least one.' }];
  }
  return [];
}

// lead: matched directly by its own tags.
// support / proof: matched via relatedLead — first find which lead(s) (of
// any audience, since this is reference-only) fit the requested filters,
// then return target-type entries that substantiate one of those leads.
function selectByType(kind, audience, audienceValue, needValue) {
  if (kind === 'lead') {
    const entries = Object.entries(MESSAGE_LIBRARY).filter(function(e) { return e[1].type === 'lead' && e[1].audience === audience; });
    const filtered = filterEntries(entries, audienceValue, needValue);
    const selections = filtered.matches.map(function(e) { return { id: e[0], text: e[1].text, source: e[1].source, type: 'lead' }; });
    return { selections: selections, gaps: buildGaps(filtered.mode, selections.length, 'lead', audience) };
  }

  const allLeads = Object.entries(MESSAGE_LIBRARY).filter(function(e) { return e[1].type === 'lead'; });
  const leadMatch = filterEntries(allLeads, audienceValue, needValue);
  const matchedLeadIds = leadMatch.matches.map(function(e) { return e[0]; });

  const targetEntries = Object.entries(MESSAGE_LIBRARY).filter(function(e) { return e[1].type === kind && e[1].audience === audience; });
  const linked = targetEntries.filter(function(e) { return (e[1].relatedLead || []).some(function(rl) { return matchedLeadIds.indexOf(rl) !== -1; }); });

  const selections = linked.map(function(e) { return { id: e[0], text: e[1].text, source: e[1].source, type: kind }; });
  return { selections: selections, gaps: buildGaps(leadMatch.mode, selections.length, kind, audience) };
}

function selectInternalNotes(audienceValue, needValue) {
  const entries = Object.entries(MESSAGE_LIBRARY).filter(function(e) { return e[1].audience === 'internal'; });
  const filtered = filterEntries(entries, audienceValue, needValue);
  return filtered.matches.map(function(e) { return { id: e[0], text: e[1].text, source: e[1].source, type: e[1].type }; });
}

// --- Generative-content infrastructure (not used by /api/generate today) ---
// Retrieval above is fully deterministic on purpose. This is kept ready for
// the planned feature where the LLM drafts customer-facing copy FROM a set
// of already-verbatim-matched selections (e.g. weaving a chosen Lead +
// Support into a cohesive email) — a genuinely generative step layered on
// top of deterministic retrieval, not a replacement for it. Selection
// (which entries are relevant) should stay deterministic even after this is
// wired in; only the drafting step should call the model.

function callAnthropic(systemPrompt, userPrompt) {
  if (!API_KEY) {
    return Promise.reject(new Error('ANTHROPIC_API_KEY not set \u2014 required for generative features (not for content selection).'));
  }
  return new Promise(function(resolve, reject) {
    const payload = JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }]
    });
    const options = {
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(payload)
      }
    };
    const apiReq = https.request(options, apiRes => {
      const bodyChunks = [];
      apiRes.on('data', c => bodyChunks.push(c));
      apiRes.on('end', () => {
        const body = Buffer.concat(bodyChunks).toString('utf8');
        if (apiRes.statusCode !== 200) {
          let errMsg = 'Anthropic error ' + apiRes.statusCode;
          try { errMsg = JSON.parse(body).error?.message || errMsg; } catch (_) {}
          reject(new Error(errMsg));
          return;
        }
        try {
          const data = JSON.parse(body);
          const text = (data.content || []).map(function(b) { return b.text || ''; }).join('');
          resolve(text);
        } catch (e) {
          reject(new Error('Malformed response from Anthropic: ' + e.message));
        }
      });
    });
    apiReq.on('error', function(e) { reject(new Error('Cannot reach Anthropic: ' + e.message)); });
    apiReq.write(payload);
    apiReq.end();
  });
}

// The model reliably returns only JSON when instructed to, but occasionally
// adds a conversational preamble anyway. Pull the {...} substring out
// directly so that can never break parsing of a generative response either.
function extractJSON(text) {
  const stripped = text.replace(/```json\s*/g, '').replace(/```\s*/g, '');
  const start = stripped.indexOf('{');
  const end = stripped.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) {
    throw new Error('No JSON object found in model response');
  }
  return JSON.parse(stripped.slice(start, end + 1));
}

function sendJSON(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}

const server = http.createServer((req, res) => {
  const reqPath = req.url.split('?')[0].replace(/\/+$/, '') || '/';

  if (req.method === 'GET' && (reqPath === '/' || reqPath === '')) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(HTML);
    return;
  }

  if (req.method === 'GET' && reqPath === '/health') {
    sendJSON(res, 200, { ok: true });
    return;
  }

  if (req.method === 'GET' && reqPath === '/reference-deck.pdf') {
    fs.readFile(DECK_PDF_PATH, (err, data) => {
      if (err) { res.writeHead(404); res.end('Deck not found'); return; }
      res.writeHead(200, {
        'Content-Type': 'application/pdf',
        'Content-Length': data.length,
        'Content-Disposition': 'inline; filename="Global Customer Relationship Study 2025.pdf"'
      });
      res.end(data);
    });
    return;
  }

  // Streaming endpoint (kept as SSE for client compatibility, though for
  // simplicity — and since 'all' must combine three separate calls — each
  // call to Anthropic here is non-streaming internally; only one final
  // "result" event is ever emitted per request).
  if (req.method === 'POST' && reqPath === '/api/generate') {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      let parsed;
      try { parsed = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
      catch (e) { sendJSON(res, 400, { error: 'Invalid JSON: ' + e.message }); return; }

      const typeKey = contentTypeKey(parsed.contentType);

      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
      });

      // Match on the underlying tag values (e.g. "financial", not the display
      // label "Financial"), sent by the client alongside the labels.
      const audienceValue = (parsed.audienceValue || '').toLowerCase();
      const needValue = (parsed.customerNeedValue || '').toLowerCase();

      let combined;
      if (typeKey === 'all') {
        const l = selectByType('lead', 'external', audienceValue, needValue);
        const s = selectByType('support', 'external', audienceValue, needValue);
        const p = selectByType('proof', 'external', audienceValue, needValue);
        combined = {
          selections: l.selections.concat(s.selections, p.selections),
          gaps: l.gaps.concat(s.gaps, p.gaps)
        };
      } else {
        combined = selectByType(typeKey, 'external', audienceValue, needValue);
      }

      const internalNotes = selectInternalNotes(audienceValue, needValue);

      console.log('[generate] type=' + typeKey + ' audience=' + (audienceValue || 'all') + ' need=' + (needValue || 'all') + ' \u2014 selections:', combined.selections.length, 'internalNotes:', internalNotes.length);

      const result = { contentType: typeKey, selections: combined.selections, gaps: combined.gaps, internalNotes: internalNotes };
      res.write('event: result\ndata: ' + JSON.stringify({ result }) + '\n\n');
      res.end();
    });
    return;
  }

  console.log('[404]', req.method, reqPath);
  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log('Roche AIM demo running at http://localhost:' + PORT);
  console.log('Content selection is fully deterministic (no API key required for this).');
  console.log('Anthropic API key:', API_KEY ? 'YES (' + API_KEY.slice(0,16) + '...) \u2014 ready for future generative features' : 'NOT SET \u2014 fine for now, needed once generative features are added');
});
