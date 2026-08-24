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

const PROOF_URL = 'https://roche-aim-infographic.onrender.com/';

// Reference database: verbatim content from the Global Customer Relationship
// Study 2025 deck only. Every "text" field must be reproduced exactly as
// written in the source deck — no paraphrasing, no rewriting.
const MESSAGE_LIBRARY = {
  "CRR-01": { type: "lead", text: "Customer relationships matter because they drive loyalty and real commercial impact", source: "Slide 6", buyingInfluence: ["clinical","financial"], customerChallenge: ["operational-excellence-uptime"] },
  "CRR-02": { type: "lead", text: "Strong relationships, with opportunities to strengthen operations, communication, and future growth", source: "Slide 7", buyingInfluence: ["operational","financial"], customerChallenge: ["operational-excellence-uptime","communication-transparency"] },
  "CRR-03": { type: "lead", text: "Customers praise our people and products but highlight areas to improve", source: "Slide 9", buyingInfluence: ["clinical"], customerChallenge: ["product-technical"] },
  "CRR-04": { type: "lead", text: "60% of our customers would recommend Roche; only 8% would not", source: "Slide 9", buyingInfluence: ["clinical","financial"], customerChallenge: ["product-technical"] },
  "CRR-05": { type: "lead", text: "Customers link transparent and proactive communication to their ability to plan ahead, innovate and grow", source: "Slide 11", buyingInfluence: ["operational","financial"], customerChallenge: ["communication-transparency"] },
  "CRR-06": { type: "lead", text: "Customers want digital solutions but integration and staff readiness block adoption", source: "Slide 12", buyingInfluence: ["operational","financial"], customerChallenge: ["automation-digitalization","barriers-to-digital-adoption"] },
  "CRR-07": { type: "lead", text: "59% of customers want to explore optimising their lab workflows, and while 44% are interested in digital solutions to drive efficiency and growth they face major barriers", source: "Slide 12", buyingInfluence: ["operational","financial"], customerChallenge: ["automation-digitalization","barriers-to-digital-adoption"] },
  "CRR-08": { type: "lead", text: "Large labs are less likely to recommend Roche\u2026", source: "Slide 14", buyingInfluence: ["financial"], customerChallenge: ["operational-excellence-uptime"] },
  "CRR-09": { type: "lead", text: "\u2026because operational inconsistencies can often turn into major failures", source: "Slide 15", buyingInfluence: ["operational"], customerChallenge: ["service-logistics-reliability","operational-excellence-uptime"] },
  "CRR-10": { type: "lead", text: "Executives are less likely to recommend Roche\u2026", source: "Slide 16", buyingInfluence: ["financial"], customerChallenge: ["strategic-partnership"] },
  "CRR-11": { type: "lead", text: "\u2026and they wish for more engagement and strategic partnership", source: "Slide 17", buyingInfluence: ["financial"], customerChallenge: ["strategic-partnership"] },
  "CRR-12": { type: "lead", text: "Overall experience along the customer journey is high with opportunities to improve", source: "Slide 19", buyingInfluence: ["operational","clinical"], customerChallenge: ["operational-excellence-uptime"] },
  "CRR-13": { type: "lead", text: "Foundation of trust: Customers rate Roche highly for reliable products and professional staff. With an NPS of +49 and 89% seeing us as a true partner, trust in our people and solutions is our biggest strength", source: "Slide 34", buyingInfluence: ["clinical","financial"], customerChallenge: ["strategic-partnership","product-technical"] },
  "CRR-14": { type: "lead", text: "Win the C-Suite: While quality is recognized, many executives perceive Roche as transactional. To win the C-Suite, we must position ourselves as a strategic partner, enabling efficiency and access to innovation", source: "Slide 34", buyingInfluence: ["financial"], customerChallenge: ["strategic-partnership","access-to-innovation"] },
  "CRR-15": { type: "lead", text: "Enable future growth: Labs see strong potential in digital and AI-driven solutions, but face barriers with IT integration, budgets, and staff readiness. Roche can unlock adoption by reducing complexity, co-developing solutions, and supporting change management", source: "Slide 34", buyingInfluence: ["operational","financial"], customerChallenge: ["automation-digitalization","barriers-to-digital-adoption"] },
  "CRR-16": { type: "lead", text: "Close the communication gap: Proactive, transparent updates on orders, service, and innovation are critical. Customers want early insights to better manage operations and plan long-term", source: "Slide 34", buyingInfluence: ["operational"], customerChallenge: ["communication-transparency"] },

  "CRR-17": { type: "support", text: "Over the 18 years of collaboration, I have been satisfied with the quality, durability of the equipment and reliability of Roche products, but the people I have interacted with are the main reason I recommend Roche", source: "Slide 6, customer quote", buyingInfluence: ["clinical"], customerChallenge: ["strategic-partnership","product-technical"] },
  "CRR-18": { type: "support", text: "I did not buy from an equipment seller - I built a partnership with Roche - My Roche contacts are reliable people I trust", source: "Slide 6, customer quote", buyingInfluence: ["clinical","financial"], customerChallenge: ["strategic-partnership"] },
  "CRR-19": { type: "support", text: "The relationship with Roche Diagnostics goes beyond the one included in the agreements. We are partners with whom we have been working together for many years.", source: "Slide 6, customer quote", buyingInfluence: ["financial"], customerChallenge: ["strategic-partnership"] },
  "CRR-20": { type: "support", text: "Reliable products and accurate results provide a strong foundation of trust. Local teams' responsiveness and expertise strengthen partnerships.", source: "Slide 7", buyingInfluence: ["clinical","operational"], customerChallenge: ["product-technical","strategic-partnership"] },
  "CRR-21": { type: "support", text: "Facing growing pressures, labs seek simpler, automated, and digital solutions and expect Roche to act as the partner for enabling future growth.", source: "Slide 7", buyingInfluence: ["operational","financial"], customerChallenge: ["automation-digitalization"] },
  "CRR-22": { type: "support", text: "If the laboratory isn't aware of alternative solutions to work faster, it doesn't have the opportunity to fight to acquire them.", source: "Slide 11, customer quote", buyingInfluence: ["operational"], customerChallenge: ["communication-transparency","access-to-innovation"] },
  "CRR-23": { type: "support", text: "The biggest barriers are system integration, staff adaptation. Despite these, we're committed to advancing digital solutions because of their long-term value", source: "Slide 12, customer quote", buyingInfluence: ["operational"], customerChallenge: ["barriers-to-digital-adoption","managing-staff-shortages"] },
  "CRR-24": { type: "support", text: "Main Priority: Cost-effective solutions and expanding test menu while adopting new right-sized solutions.", source: "Slide 14, Small labs", buyingInfluence: ["financial"], customerChallenge: ["cost-effective-right-sized-solutions"] },
  "CRR-25": { type: "support", text: "Main Priority: Drive automation and efficiency to manage growth with limited staff.", source: "Slide 14, Medium labs", buyingInfluence: ["operational"], customerChallenge: ["automation-digitalization","managing-staff-shortages"] },
  "CRR-26": { type: "support", text: "Main Priority: Standardize and digitalize (AI, DP, predictive analytics) for efficiency at scale.", source: "Slide 14, Large labs", buyingInfluence: ["operational","financial"], customerChallenge: ["automation-digitalization"] },
  "CRR-27": { type: "support", text: "Key Pain Point: Extended downtime caused by delayed parts and service staff shortages", source: "Slide 14, Large labs", buyingInfluence: ["operational"], customerChallenge: ["service-logistics-reliability","managing-staff-shortages"] },
  "CRR-28": { type: "support", text: "Address operational frictions: Support labs with more predictive service, faster access to parts, and after-hours expertise to minimize disruptions.", source: "Slide 15", buyingInfluence: ["operational"], customerChallenge: ["service-logistics-reliability","operational-excellence-uptime"] },
  "CRR-29": { type: "support", text: "Enhance transparency: Provide early visibility into reagent supply issues and delays so labs can plan workflows and avoid last-minute crisis.", source: "Slide 15", buyingInfluence: ["operational"], customerChallenge: ["communication-transparency","reagent-waste-packaging"] },
  "CRR-30": { type: "support", text: "Key Pain Point: High costs, slow processes, and perceived loss of strategic partnership", source: "Slide 16, Executives", buyingInfluence: ["financial"], customerChallenge: ["strategic-partnership","cost-effective-right-sized-solutions"] },
  "CRR-31": { type: "support", text: "Main Priorities: Drive efficiency and growth through digitalization, automation, and AI.", source: "Slide 16, Executives", buyingInfluence: ["financial"], customerChallenge: ["automation-digitalization"] },
  "CRR-32": { type: "support", text: "Efficiency & Scalability: Help them manage growth and control costs with automation solutions, workflow consulting, and inventory tools to improve TAT", source: "Slide 17", buyingInfluence: ["financial","operational"], customerChallenge: ["automation-digitalization","cost-effective-right-sized-solutions"] },
  "CRR-33": { type: "support", text: "Access to Innovation: Enable them to stay competitive with advanced tech, digital pathology, AI-driven workflows, and expanded menus.", source: "Slide 17", buyingInfluence: ["financial"], customerChallenge: ["access-to-innovation"] },
  "CRR-34": { type: "support", text: "Strategic & Flexible Partnership: Strengthen partnership with transparent innovation pipeline, faster contracting, flexible commercial models and co-development opportunities", source: "Slide 17", buyingInfluence: ["financial"], customerChallenge: ["strategic-partnership","commercial-procurement-flexibility"] },
  "CRR-35": { type: "support", text: "This is precisely a difficulty because we lack communication. No proactive communication, no information on new products, no dedicated sales representative. It's difficult to have a contact person when you have a request for information or a price", source: "Slide 20, customer quote", buyingInfluence: ["operational"], customerChallenge: ["communication-transparency"] },
  "CRR-36": { type: "support", text: "Enhancing commercial and contractual flexibility. Customers feel the procurement process is often inflexible, with rigid pricing. This lack of flexibility makes it difficult to align with their internal processes and budgetary constraints.", source: "Slide 21", buyingInfluence: ["financial"], customerChallenge: ["commercial-procurement-flexibility"] },
  "CRR-37": { type: "support", text: "Addressing space and infrastructure challenges early. Labs frequently struggle with limited physical space for large equipment, a challenge often not addressed during pre-installation inspections. Delays are also caused by issues with a lab's own IT department", source: "Slide 22", buyingInfluence: ["operational"], customerChallenge: ["infrastructure-space-constraints"] },
  "CRR-38": { type: "support", text: "Expanding training frequency and accessibility. Time constraints in 24/7 labs make it difficult to train all staff; customers ask for more refresher sessions and accessible online options.", source: "Slide 23", buyingInfluence: ["operational"], customerChallenge: ["training-expertise","managing-staff-shortages"] },
  "CRR-39": { type: "support", text: "Making product offerings more flexible and cost-effective. High costs and large reagent pack sizes create waste and financial pressure, especially in lower-volume labs.", source: "Slide 24", buyingInfluence: ["financial"], customerChallenge: ["cost-effective-right-sized-solutions","reagent-waste-packaging"] },
  "CRR-40": { type: "support", text: "Improving resolution consistency. While many issues are fixed quickly, others are delayed by spare part shortages, repeat visits, or hotline procedures that feel unnecessary for experienced staff.", source: "Slide 25", buyingInfluence: ["operational"], customerChallenge: ["service-logistics-reliability"] },
  "CRR-41": { type: "support", text: "Improving delivery reliability and transparency: Despite many positive experiences, some customers report delays, backorders, and partial shipments that disrupt operations. They ask for earlier alerts on shortages and clearer, more reliable ETAs.", source: "Slide 26", buyingInfluence: ["operational"], customerChallenge: ["service-logistics-reliability","communication-transparency"] },
  "CRR-42": { type: "support", text: "Empowering representatives to act independently: Customers believe their representatives are personally capable, but are often restricted by rigid processes and internal hierarchies that slow decision-making.", source: "Slide 27", buyingInfluence: ["financial","operational"], customerChallenge: ["strategic-partnership"] },
  "CRR-43": { type: "support", text: "Your front line staff are GREAT... The problem is Roche does not empower them to make decisions", source: "Slide 27, customer quote", buyingInfluence: ["operational"], customerChallenge: ["strategic-partnership"] }
};

function contentTypeKey(label) {
  const s = (label || '').toLowerCase();
  if (s.indexOf('proof') !== -1) return 'proof';
  if (s.indexOf('support') !== -1) return 'support';
  return 'lead';
}

function buildSystemPrompt(typeKey) {
  const entries = Object.entries(MESSAGE_LIBRARY).filter(([, m]) => m.type === typeKey);
  const library = entries.map(([id, m]) =>
    '[' + id + ']\nText: "' + m.text + '"\nSource: ' + m.source + '\nBuying influence: ' + m.buyingInfluence.join(', ') + '\nCustomer challenge: ' + m.customerChallenge.join(', ')
  ).join('\n---\n');

  return `You are retrieving content for Roche Diagnostics from a single approved source: the Global Customer Relationship Study 2025 deck. This is a verbatim-retrieval task, not a writing task.

ABSOLUTE RULES:
- You may ONLY reproduce the "Text" field of library entries below, character-for-character, exactly as written. Do not paraphrase, reword, summarise, correct grammar, expand, shorten, or combine entries.
- Do not invent, infer, or add any claim, statistic, or sentence that is not the exact text of a library entry.
- Select entries whose buying influence and/or customer challenge tags best match the requested context. If several entries fit, prefer the closer match.
- If nothing in the library reasonably matches the requested buying influence / customer challenge / disease / portfolio / product combination, do not force a match — report it in "gaps" instead.
- Return ONLY valid JSON, no markdown fences, no preamble.

JSON structure:
{
  "selections": [ { "id": "CRR-XX", "text": "exact verbatim text copied from the entry, unchanged", "source": "exact source field copied from the entry" } ],
  "gaps": [ { "title": "short title", "description": "what the requested context needed that this library does not cover" } ]
}

LIBRARY (only entries of the requested content type are listed \u2014 select only from these):
${library}`;
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

      // Proof is a fixed bridge to the infographic, not generated or selected from
      // the library, and is never passed through the model.
      if (typeKey === 'proof') {
        const result = {
          contentType: 'proof',
          proof: {
            text: 'Full Global Customer Relationship Study 2025 findings, presented as an interactive infographic.',
            url: PROOF_URL
          },
          selections: [],
          gaps: []
        };
        res.write('event: token\ndata: ' + JSON.stringify({ token: '' }) + '\n\n');
        res.write('event: result\ndata: ' + JSON.stringify({ result }) + '\n\n');
        res.end();
        return;
      }

      const userPrompt = 'Requested context:\n- Buying influence: ' + parsed.audience + '\n- Topics: ' + parsed.topics + '\n- Customer need: ' + parsed.customerNeed + '\n- Disease area: ' + parsed.disease + '\n- Portfolio: ' + parsed.portfolio + '\n- Product: ' + parsed.product + '\n- Content type requested: ' + parsed.contentType + '\n\nSelect the library entries (of the requested content type only) that best match this buying influence and customer need. Return them verbatim with their id and source. If nothing matches well, report the gap instead of forcing a selection.';

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
                    return lib ? { id: sel.id, text: lib.text, source: lib.source } : sel;
                  }).filter(function(sel) { return MESSAGE_LIBRARY[sel.id]; });
                  result.gaps = result.gaps || [];
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
