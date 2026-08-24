const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const API_KEY = process.env.ANTHROPIC_API_KEY;
const PORT = process.env.PORT || 3000;

if (!API_KEY) {
  console.error('ERROR: ANTHROPIC_API_KEY not set.');
  process.exit(1);
}

const HTML = fs.readFileSync(path.join(__dirname, 'roche-app.html'), 'utf8');
const DECK_PDF_PATH = path.join(__dirname, 'reference-deck.pdf');

const PROOF_URL = 'https://roche-aim-infographic.onrender.com/';

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
//            selected the same way via relatedLead. The infographic bridge
//            is always appended in addition, since it covers the full study.
const MESSAGE_LIBRARY = {
  "CRR-06a": { type: "lead", text: "Customer relationships matter because they drive loyalty and real commercial impact", source: "Slide 6", buyingInfluence: ["clinical","financial"], customerChallenge: ["operational-excellence-uptime"] },
  "CRR-07a": { type: "lead", text: "Strong relationships, with opportunities to strengthen operations, communication, and future growth", source: "Slide 7", buyingInfluence: ["operational","financial"], customerChallenge: ["operational-excellence-uptime","communication-transparency"] },
  "CRR-09a": { type: "lead", text: "Customers praise our people and products but highlight areas to improve", source: "Slide 9", buyingInfluence: ["clinical"], customerChallenge: ["product-technical"] },
  "CRR-09b": { type: "lead", text: "60% of our customers would recommend Roche; only 8% would not", source: "Slide 9", buyingInfluence: ["clinical","financial"], customerChallenge: ["product-technical"] },
  "CRR-11a": { type: "lead", text: "Customers link transparent and proactive communication to their ability to plan ahead, innovate and grow", source: "Slide 11", buyingInfluence: ["operational","financial"], customerChallenge: ["communication-transparency"] },
  "CRR-12a": { type: "lead", text: "Customers want digital solutions but integration and staff readiness block adoption", source: "Slide 12", buyingInfluence: ["operational","financial"], customerChallenge: ["automation-digitalization","barriers-to-digital-adoption"] },
  "CRR-12b": { type: "lead", text: "59% of customers want to explore optimising their lab workflows, and while 44% are interested in digital solutions to drive efficiency and growth they face major barriers", source: "Slide 12", buyingInfluence: ["operational","financial"], customerChallenge: ["automation-digitalization","barriers-to-digital-adoption"] },
  "CRR-14a": { type: "lead", text: "Large labs are less likely to recommend Roche\u2026", source: "Slide 14", buyingInfluence: ["financial"], customerChallenge: ["operational-excellence-uptime"] },
  "CRR-15a": { type: "lead", text: "\u2026because operational inconsistencies can often turn into major failures", source: "Slide 15", buyingInfluence: ["operational"], customerChallenge: ["service-logistics-reliability","operational-excellence-uptime"] },
  "CRR-16a": { type: "lead", text: "Executives are less likely to recommend Roche\u2026", source: "Slide 16", buyingInfluence: ["financial"], customerChallenge: ["strategic-partnership"] },
  "CRR-17a": { type: "lead", text: "\u2026and they wish for more engagement and strategic partnership", source: "Slide 17", buyingInfluence: ["financial"], customerChallenge: ["strategic-partnership"] },
  "CRR-19": { type: "lead", text: "Overall experience along the customer journey is high with opportunities to improve", source: "Slide 19", buyingInfluence: ["operational","clinical"], customerChallenge: ["operational-excellence-uptime"] },
  "CRR-34a": { type: "lead", text: "Foundation of trust: Customers rate Roche highly for reliable products and professional staff. With an NPS of +49 and 89% seeing us as a true partner, trust in our people and solutions is our biggest strength", source: "Slide 34", buyingInfluence: ["clinical","financial"], customerChallenge: ["strategic-partnership","product-technical"] },
  "CRR-34b": { type: "lead", text: "Win the C-Suite: While quality is recognized, many executives perceive Roche as transactional. To win the C-Suite, we must position ourselves as a strategic partner, enabling efficiency and access to innovation", source: "Slide 34", buyingInfluence: ["financial"], customerChallenge: ["strategic-partnership","access-to-innovation"] },
  "CRR-34c": { type: "lead", text: "Enable future growth: Labs see strong potential in digital and AI-driven solutions, but face barriers with IT integration, budgets, and staff readiness. Roche can unlock adoption by reducing complexity, co-developing solutions, and supporting change management", source: "Slide 34", buyingInfluence: ["operational","financial"], customerChallenge: ["automation-digitalization","barriers-to-digital-adoption"] },
  "CRR-34d": { type: "lead", text: "Close the communication gap: Proactive, transparent updates on orders, service, and innovation are critical. Customers want early insights to better manage operations and plan long-term", source: "Slide 34", buyingInfluence: ["operational"], customerChallenge: ["communication-transparency"] },

  "CRR-06b": { type: "support", relatedLead: ["CRR-06a"], text: "Over the 18 years of collaboration, I have been satisfied with the quality, durability of the equipment and reliability of Roche products, but the people I have interacted with are the main reason I recommend Roche", source: "Slide 6, customer quote", buyingInfluence: ["clinical"], customerChallenge: ["strategic-partnership","product-technical"] },
  "CRR-06c": { type: "support", relatedLead: ["CRR-06a"], text: "I did not buy from an equipment seller - I built a partnership with Roche - My Roche contacts are reliable people I trust", source: "Slide 6, customer quote", buyingInfluence: ["clinical","financial"], customerChallenge: ["strategic-partnership"] },
  "CRR-06d": { type: "support", relatedLead: ["CRR-06a"], text: "The relationship with Roche Diagnostics goes beyond the one included in the agreements. We are partners with whom we have been working together for many years.", source: "Slide 6, customer quote", buyingInfluence: ["financial"], customerChallenge: ["strategic-partnership"] },
  "CRR-07b": { type: "support", relatedLead: ["CRR-07a"], text: "Reliable products and accurate results provide a strong foundation of trust. Local teams' responsiveness and expertise strengthen partnerships.", source: "Slide 7", buyingInfluence: ["clinical","operational"], customerChallenge: ["product-technical","strategic-partnership"] },
  "CRR-07c": { type: "support", relatedLead: ["CRR-07a","CRR-34c"], text: "Facing growing pressures, labs seek simpler, automated, and digital solutions and expect Roche to act as the partner for enabling future growth.", source: "Slide 7", buyingInfluence: ["operational","financial"], customerChallenge: ["automation-digitalization"] },
  "CRR-11b": { type: "support", relatedLead: ["CRR-11a"], text: "If the laboratory isn't aware of alternative solutions to work faster, it doesn't have the opportunity to fight to acquire them.", source: "Slide 11, customer quote", buyingInfluence: ["operational"], customerChallenge: ["communication-transparency","access-to-innovation"] },
  "CRR-12c": { type: "support", relatedLead: ["CRR-12a","CRR-12b"], text: "The biggest barriers are system integration, staff adaptation. Despite these, we're committed to advancing digital solutions because of their long-term value", source: "Slide 12, customer quote", buyingInfluence: ["operational"], customerChallenge: ["barriers-to-digital-adoption","managing-staff-shortages"] },
  "CRR-14b": { type: "support", relatedLead: ["CRR-14a"], text: "Main Priority: Cost-effective solutions and expanding test menu while adopting new right-sized solutions.", source: "Slide 14, Small labs", buyingInfluence: ["financial"], customerChallenge: ["cost-effective-right-sized-solutions"] },
  "CRR-14c": { type: "support", relatedLead: ["CRR-14a"], text: "Main Priority: Drive automation and efficiency to manage growth with limited staff.", source: "Slide 14, Medium labs", buyingInfluence: ["operational"], customerChallenge: ["automation-digitalization","managing-staff-shortages"] },
  "CRR-14d": { type: "support", relatedLead: ["CRR-14a"], text: "Main Priority: Standardize and digitalize (AI, DP, predictive analytics) for efficiency at scale.", source: "Slide 14, Large labs", buyingInfluence: ["operational","financial"], customerChallenge: ["automation-digitalization"] },
  "CRR-14e": { type: "support", relatedLead: ["CRR-14a","CRR-15a"], text: "Key Pain Point: Extended downtime caused by delayed parts and service staff shortages", source: "Slide 14, Large labs", buyingInfluence: ["operational"], customerChallenge: ["service-logistics-reliability","managing-staff-shortages"] },
  "CRR-15b": { type: "support", relatedLead: ["CRR-15a"], text: "Address operational frictions: Support labs with more predictive service, faster access to parts, and after-hours expertise to minimize disruptions.", source: "Slide 15", buyingInfluence: ["operational"], customerChallenge: ["service-logistics-reliability","operational-excellence-uptime"] },
  "CRR-15c": { type: "support", relatedLead: ["CRR-15a","CRR-34d"], text: "Enhance transparency: Provide early visibility into reagent supply issues and delays so labs can plan workflows and avoid last-minute crisis.", source: "Slide 15", buyingInfluence: ["operational"], customerChallenge: ["communication-transparency","reagent-waste-packaging"] },
  "CRR-16b": { type: "support", relatedLead: ["CRR-16a"], text: "Key Pain Point: High costs, slow processes, and perceived loss of strategic partnership", source: "Slide 16, Executives", buyingInfluence: ["financial"], customerChallenge: ["strategic-partnership","cost-effective-right-sized-solutions"] },
  "CRR-16c": { type: "support", relatedLead: ["CRR-16a","CRR-34c"], text: "Main Priorities: Drive efficiency and growth through digitalization, automation, and AI.", source: "Slide 16, Executives", buyingInfluence: ["financial"], customerChallenge: ["automation-digitalization"] },
  "CRR-17b": { type: "support", relatedLead: ["CRR-17a"], text: "Efficiency & Scalability: Help them manage growth and control costs with automation solutions, workflow consulting, and inventory tools to improve TAT", source: "Slide 17", buyingInfluence: ["financial","operational"], customerChallenge: ["automation-digitalization","cost-effective-right-sized-solutions"] },
  "CRR-17c": { type: "support", relatedLead: ["CRR-17a","CRR-34b"], text: "Access to Innovation: Enable them to stay competitive with advanced tech, digital pathology, AI-driven workflows, and expanded menus.", source: "Slide 17", buyingInfluence: ["financial"], customerChallenge: ["access-to-innovation"] },
  "CRR-17d": { type: "support", relatedLead: ["CRR-17a"], text: "Strategic & Flexible Partnership: Strengthen partnership with transparent innovation pipeline, faster contracting, flexible commercial models and co-development opportunities", source: "Slide 17", buyingInfluence: ["financial"], customerChallenge: ["strategic-partnership","commercial-procurement-flexibility"] },
  "CRR-20": { type: "support", relatedLead: ["CRR-11a","CRR-34d"], text: "This is precisely a difficulty because we lack communication. No proactive communication, no information on new products, no dedicated sales representative. It's difficult to have a contact person when you have a request for information or a price", source: "Slide 20, customer quote", buyingInfluence: ["operational"], customerChallenge: ["communication-transparency"] },
  "CRR-21": { type: "support", relatedLead: ["CRR-17a","CRR-34b"], text: "Enhancing commercial and contractual flexibility. Customers feel the procurement process is often inflexible, with rigid pricing. This lack of flexibility makes it difficult to align with their internal processes and budgetary constraints.", source: "Slide 21", buyingInfluence: ["financial"], customerChallenge: ["commercial-procurement-flexibility"] },
  "CRR-22": { type: "support", relatedLead: ["CRR-19"], text: "Addressing space and infrastructure challenges early. Labs frequently struggle with limited physical space for large equipment, a challenge often not addressed during pre-installation inspections. Delays are also caused by issues with a lab's own IT department", source: "Slide 22", buyingInfluence: ["operational"], customerChallenge: ["infrastructure-space-constraints"] },
  "CRR-23": { type: "support", relatedLead: ["CRR-19"], text: "Expanding training frequency and accessibility. Time constraints in 24/7 labs make it difficult to train all staff; customers ask for more refresher sessions and accessible online options.", source: "Slide 23", buyingInfluence: ["operational"], customerChallenge: ["training-expertise","managing-staff-shortages"] },
  "CRR-24": { type: "support", relatedLead: ["CRR-09a","CRR-19"], text: "Making product offerings more flexible and cost-effective. High costs and large reagent pack sizes create waste and financial pressure, especially in lower-volume labs.", source: "Slide 24", buyingInfluence: ["financial"], customerChallenge: ["cost-effective-right-sized-solutions","reagent-waste-packaging"] },
  "CRR-25": { type: "support", relatedLead: ["CRR-15a","CRR-19"], text: "Improving resolution consistency. While many issues are fixed quickly, others are delayed by spare part shortages, repeat visits, or hotline procedures that feel unnecessary for experienced staff.", source: "Slide 25", buyingInfluence: ["operational"], customerChallenge: ["service-logistics-reliability"] },
  "CRR-26": { type: "support", relatedLead: ["CRR-15a","CRR-19"], text: "Improving delivery reliability and transparency: Despite many positive experiences, some customers report delays, backorders, and partial shipments that disrupt operations. They ask for earlier alerts on shortages and clearer, more reliable ETAs.", source: "Slide 26", buyingInfluence: ["operational"], customerChallenge: ["service-logistics-reliability","communication-transparency"] },
  "CRR-27a": { type: "support", relatedLead: ["CRR-17a","CRR-19"], text: "Empowering representatives to act independently: Customers believe their representatives are personally capable, but are often restricted by rigid processes and internal hierarchies that slow decision-making.", source: "Slide 27", buyingInfluence: ["financial","operational"], customerChallenge: ["strategic-partnership"] },
  "CRR-27b": { type: "support", relatedLead: ["CRR-17a","CRR-19"], text: "Your front line staff are GREAT... The problem is Roche does not empower them to make decisions", source: "Slide 27, customer quote", buyingInfluence: ["operational"], customerChallenge: ["strategic-partnership"] },

  "CRR-29a": { type: "proof", relatedLead: ["CRR-34c","CRR-34d"], text: "How China is using the CRR to shape their 2026 strategy", source: "Slide 29, case study" },
  "CRR-29b": { type: "proof", relatedLead: ["CRR-34c","CRR-34d"], text: "289 responses, 97% response rate \u2014 among the highest globally", source: "Slide 29, case study" },
  "CRR-29c": { type: "proof", relatedLead: ["CRR-34a","CRR-34d"], text: "Enhancing the TOP account experience through CRR helps better secure China's business", source: "Slide 29, quote \u2014 Carolin Wang, Service Strategy & Transformation, China" },
  "CRR-31a": { type: "proof", relatedLead: ["CRR-34d","CRR-17a"], text: "How Brazil is using CRR to drive action", source: "Slide 31, case study" },
  "CRR-31b": { type: "proof", relatedLead: ["CRR-34d"], text: "Brazil conducted in-depth CRR interviews with strategic accounts to assess relationships and capture key feedback.", source: "Slide 31, case study" },
  "CRR-31c": { type: "proof", relatedLead: ["CRR-34c"], text: "They identified systemic challenges and defined high-level initiatives together with cross-functional leadership to drive improvements.", source: "Slide 31, case study" },
  "CRR-31d": { type: "proof", relatedLead: ["CRR-17a","CRR-34b"], text: "Brazil developed account reports, collaborated with account teams to prioritize actions, and formalized objectives, impact, owners, and timelines.", source: "Slide 31, case study" },
  "CRR-31e": { type: "proof", relatedLead: ["CRR-34d","CRR-17a"], text: "Finally, they shared findings and action plans with customers and validated next steps, which reinforced transparency and strengthened partnerships.", source: "Slide 31, case study" }
};

function contentTypeKey(label) {
  const s = (label || '').toLowerCase();
  if (s.indexOf('proof') !== -1) return 'proof';
  if (s.indexOf('support') !== -1) return 'support';
  return 'lead';
}

function libraryBlock(entries) {
  return entries.map(([id, m]) => {
    let block = '[' + id + ']\nText: "' + m.text + '"\nSource: ' + m.source;
    if (m.buyingInfluence) block += '\nBuying influence: ' + m.buyingInfluence.join(', ');
    if (m.customerChallenge) block += '\nCustomer challenge: ' + m.customerChallenge.join(', ');
    if (m.relatedLead) block += '\nSubstantiates lead(s): ' + m.relatedLead.join(', ');
    return block;
  }).join('\n---\n');
}

function buildSystemPrompt(typeKey) {
  const leadEntries = Object.entries(MESSAGE_LIBRARY).filter(([, m]) => m.type === 'lead');
  const leadLibrary = libraryBlock(leadEntries);

  if (typeKey === 'lead') {
    const library = libraryBlock(leadEntries);
    return `You are retrieving content for Roche Diagnostics from a single approved source: the Global Customer Relationship Study 2025 deck. This is a verbatim-retrieval task, not a writing task.

A LEAD MESSAGE is the highest-level statement relevant to the query.

ABSOLUTE RULES:
- You may ONLY reproduce the "Text" field of library entries below, character-for-character, exactly as written. Do not paraphrase, reword, summarise, correct grammar, expand, shorten, or combine entries.
- Do not invent, infer, or add any claim, statistic, or sentence that is not the exact text of a library entry.
- Select the lead entries whose buying influence and/or customer challenge tags best match the requested context. If several fit, prefer the closer match.
- If nothing in the library reasonably matches the requested context, do not force a match \u2014 report it in "gaps" instead.
- Return ONLY valid JSON, no markdown fences, no preamble.

JSON structure:
{
  "selections": [ { "id": "CRR-XX", "text": "exact verbatim text copied from the entry, unchanged", "source": "exact source field copied from the entry" } ],
  "gaps": [ { "title": "short title", "description": "what the requested context needed that this library does not cover" } ]
}

LEAD LIBRARY:
${library}`;
  }

  // support / proof: two-stage. First identify which lead(s) fit the requested
  // context (using the lead library for reference only \u2014 never return these
  // directly), then return only target-type entries whose relatedLead links to
  // those leads. This is what "substantiates the lead message" / "related to
  // the lead message and support" means in practice.
  const targetEntries = Object.entries(MESSAGE_LIBRARY).filter(([, m]) => m.type === typeKey);
  const targetLibrary = libraryBlock(targetEntries);
  const kindNoun = typeKey === 'proof' ? 'PROOF (case studies / stories)' : 'SUPPORT (substantiating detail)';
  const kindDefinition = typeKey === 'proof'
    ? 'PROOF is a case study or story related to the lead message and its support \u2014 evidence that the message plays out in the real world.'
    : 'SUPPORT is detail that substantiates a lead message \u2014 it only exists in service of a lead, never independently.';

  return `You are retrieving content for Roche Diagnostics from a single approved source: the Global Customer Relationship Study 2025 deck. This is a verbatim-retrieval task, not a writing task.

${kindDefinition}

PROCESS (do this internally \u2014 only the final list matters):
1. Using the LEAD LIBRARY below (reference only, do not return these), identify which lead(s) best fit the requested buying influence and customer need.
2. From the ${kindNoun} LIBRARY, select entries whose "Substantiates lead(s)" field includes one of those leads. Buying influence / customer challenge tags on the target entries are a secondary tiebreaker, not the primary filter \u2014 relevance flows from the lead, not from independent tag-matching.
3. If no target-type entry links to a lead that fits this context, report the gap instead of forcing a loosely related entry.

ABSOLUTE RULES:
- You may ONLY reproduce the "Text" field of ${kindNoun} library entries, character-for-character, exactly as written. Do not paraphrase, reword, summarise, correct grammar, expand, shorten, or combine entries.
- Do not invent, infer, or add any claim, statistic, or sentence that is not the exact text of a library entry.
- Never return an entry from the LEAD LIBRARY itself in "selections" \u2014 only from the ${kindNoun} LIBRARY.
- Return ONLY valid JSON, no markdown fences, no preamble.

JSON structure:
{
  "selections": [ { "id": "CRR-XX", "text": "exact verbatim text copied from the entry, unchanged", "source": "exact source field copied from the entry" } ],
  "gaps": [ { "title": "short title", "description": "what the requested context needed that this library does not cover" } ]
}

LEAD LIBRARY (reference only \u2014 do not select from this list):
${leadLibrary}

${kindNoun} LIBRARY (select only from this list):
${targetLibrary}`;
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

  // Streaming endpoint
  if (req.method === 'POST' && reqPath === '/api/generate') {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      let parsed;
      try { parsed = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
      catch (e) { sendJSON(res, 400, { error: 'Invalid JSON: ' + e.message }); return; }

      const typeKey = contentTypeKey(parsed.contentType);

      // Set up SSE headers so browser receives tokens/result the same way regardless of path
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
      });

      const userPrompt = 'Requested context:\n- Buying influence: ' + parsed.audience + '\n- Topics: ' + parsed.topics + '\n- Customer need: ' + parsed.customerNeed + '\n- Disease area: ' + parsed.disease + '\n- Portfolio: ' + parsed.portfolio + '\n- Product: ' + parsed.product + '\n- Content type requested: ' + parsed.contentType + '\n\nSelect the entries that best match this buying influence and customer need. Return them verbatim with their id and source. If nothing matches well, report the gap instead of forcing a selection.';

      const payload = JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4000,
        stream: true,
        system: buildSystemPrompt(typeKey),
        messages: [{ role: 'user', content: userPrompt }]
      });

      console.log('[API] Streaming request (' + typeKey + '), payload:', payload.length, 'bytes');

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
        console.log('[API] Stream status:', apiRes.statusCode);

        if (apiRes.statusCode !== 200) {
          const errChunks = [];
          apiRes.on('data', c => errChunks.push(c));
          apiRes.on('end', () => {
            let errMsg = 'Anthropic error ' + apiRes.statusCode;
            try { errMsg = JSON.parse(Buffer.concat(errChunks).toString()).error?.message || errMsg; } catch (_) {}
            res.write('event: error\ndata: ' + JSON.stringify({ error: errMsg }) + '\n\n');
            res.end();
          });
          return;
        }

        let buffer = '';

        apiRes.on('data', chunk => {
          const lines = chunk.toString().split('\n');
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6).trim();
            if (data === '[DONE]') continue;
            try {
              const evt = JSON.parse(data);
              if (evt.type === 'content_block_delta' && evt.delta?.type === 'text_delta') {
                const token = evt.delta.text;
                buffer += token;
                res.write('event: token\ndata: ' + JSON.stringify({ token }) + '\n\n');
              }
              if (evt.type === 'message_stop') {
                const clean = buffer.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
                try {
                  const result = JSON.parse(clean);
                  result.contentType = typeKey;
                  result.selections = (result.selections || []).map(function(sel) {
                    // Enforce verbatim: always serve the library's own text/source for the
                    // matched id rather than trusting whatever the model echoed back.
                    const lib = MESSAGE_LIBRARY[sel.id];
                    return (lib && lib.type === typeKey) ? { id: sel.id, text: lib.text, source: lib.source } : null;
                  }).filter(Boolean);
                  result.gaps = result.gaps || [];

                  // Proof always also includes the fixed infographic bridge, in
                  // addition to any matched case-study entries.
                  if (typeKey === 'proof') {
                    result.proof = {
                      text: 'Full Global Customer Relationship Study 2025 findings, presented as an interactive infographic.',
                      url: PROOF_URL
                    };
                  }

                  console.log('[API] Stream complete — selections:', result.selections.length, 'gaps:', result.gaps.length);
                  res.write('event: result\ndata: ' + JSON.stringify({ result }) + '\n\n');
                } catch (e) {
                  console.error('[API] JSON parse error:', e.message, '| tail:', clean.slice(-200));
                  res.write('event: error\ndata: ' + JSON.stringify({ error: 'Model returned malformed JSON: ' + e.message }) + '\n\n');
                }
                res.end();
              }
            } catch (_) {}
          }
        });

        apiRes.on('error', e => {
          res.write('event: error\ndata: ' + JSON.stringify({ error: e.message }) + '\n\n');
          res.end();
        });
      });

      apiReq.on('error', e => {
        res.write('event: error\ndata: ' + JSON.stringify({ error: 'Cannot reach Anthropic: ' + e.message }) + '\n\n');
        res.end();
      });

      apiReq.write(payload);
      apiReq.end();
    });
    return;
  }

  console.log('[404]', req.method, reqPath);
  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log('Roche AIM demo running at http://localhost:' + PORT);
  console.log('API key:', API_KEY ? 'YES (' + API_KEY.slice(0,16) + '...)' : 'NOT SET');
});
