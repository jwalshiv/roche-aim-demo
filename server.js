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

const MESSAGE_LIBRARY = {
  "CM-09": { headline: "The only company with Pharma and Dx under one roof", support: "The integration of Roche Pharma and Roche Diagnostics is not structural convenience; it is a unique strategic asset. Insights from one division accelerate breakthroughs in the other, creating a flywheel no standalone diagnostics company can replicate.", role: "Uniquely ownable — no competitor can claim this. Frames the Roche partnership as access to a combined Pharma + Diagnostics intelligence engine. Most powerful in oncology, neurology, and companion diagnostics contexts.", proof: "Companion diagnostics for 60%+ of oncology decisions · Pharma + Dx co-development pipeline including SBX and CDx", tags: ["c-suite","lab-director","unified-roche","oncology","neurology","cdx","pharma-dx-integration","collaborative-innovation"] },
  "CM-10": { headline: "We co-create with the people who use our solutions", support: "Our innovations emerge from deep collaboration with clinicians, lab scientists, hospital systems, universities, and biotech partners — not from assumptions made in isolation. The best ideas come from inside the lab, and we listen.", role: "Addresses the frustration that vendors design in boardrooms, not labs. Repositions Roche as a genuine partner that designs with customers, not for them.", proof: "20+ AI algorithm partners in navify open environment · Active in-licensing agreements across 133+ partnerships", tags: ["lab-director","lab-manager","clinician","co-creation","collaborative-innovation","ai-digital","neurology","oncology"] },
  "CM-11": { headline: "We collaborate with 250+ external partners because no one has all the answers", support: "Innovation at the pace healthcare demands requires us to reach beyond our own walls. Through alliances with universities, health systems, biotech firms, and AI companies, we stay connected to the leading edge of global science — wherever it emerges.", role: "Expands the collaboration message from internal Roche synergy to the wider partner network.", proof: "250+ external R&D alliances · 133 active in-licensing agreements · 327 active out-licensing agreements", tags: ["c-suite","lab-director","ecosystem","co-creation","collaborative-innovation","ai-digital","partner-ecosystem","neurology"] },
  "CM-12": { headline: "Diverse perspectives are how we find answers nobody else is looking for", support: "Healthcare is global, its challenges are varied, and its solutions must reflect that. We deliberately bring together different disciplines, geographies, and lived experiences because the most important diagnostic breakthroughs are rarely found from a single vantage point.", role: "Brings the people and culture dimension into the innovation narrative.", proof: "~40,000 employees in 100+ countries · Global Access programs in cervical cancer and infectious disease", tags: ["c-suite","clinician","people-culture","co-creation","collaborative-innovation","global-access","neurology","sustainability"] },
  "CM-13": { headline: "One platform, every dimension of the lab", support: "From core lab automation to molecular diagnostics, digital pathology, near-patient care, and data intelligence — Roche Diagnostics offers an integrated ecosystem that no patchwork of point solutions can match.", role: "Answers the C-suite question about consolidation risk and the economic buyer concern about managing multiple vendor lifecycles.", proof: ">100,000 installed instruments worldwide · >5,000 lab & POC software deployments · navify covers core lab, molecular, pathology, POC", tags: ["c-suite","lab-director","economic-buyer","ecosystem","breadth-platform","ai-digital","oncology","neurology"] },
  "CM-14": { headline: "Innovation that works at scale — and in the smallest lab", support: "Whether you are a national reference laboratory or a regional hospital, our solutions are designed to perform with the same rigour. We democratise access to sophisticated diagnostics, not just for the few.", role: "Counters the perception that Roche innovation is only for large institutions.", proof: "LumiraDx POC platform for decentralised settings · HPV Global Access Program · cobas vital for smaller labs", tags: ["lab-director","lab-manager","economic-buyer","breadth-platform","global-access","sustainability","infectious-disease"] },
  "CM-15": { headline: "A portfolio this broad means fewer gaps in your care pathway", support: "With solutions spanning oncology, neurology, infectious disease, cardiometabolic, women's health, and diabetes management, Roche covers the disease areas that matter most.", role: "Reframes portfolio breadth as a clinical care continuity argument, not a product catalogue.", proof: "Coverage: Oncology · Neurology · Infectious disease · Cardiometabolic · Women's health · Diabetes · >500 assays", tags: ["c-suite","lab-director","portfolio-breadth","breadth-platform","neurology","oncology","cardiometabolic","womens-health"] },
  "CM-16": { headline: "Consolidating to Roche is a decision that compounds in value over time", support: "Every new Roche solution you add connects to what you already have. Our open, integrated architecture means moving from one instrument to a full ecosystem is not a rip-and-replace — it is a compounding return on a single strategic decision.", role: "Reframes consolidation not as vendor lock-in but as a compounding investment.", proof: "cobas ultra extensible platform · navify modular suite — add capabilities without replacing infrastructure · >6,500 navify customers", tags: ["economic-buyer","lab-director","tco","ecosystem","breadth-platform","ai-digital"] }
};

function buildSystemPrompt() {
  const library = Object.entries(MESSAGE_LIBRARY).map(([id, msg]) =>
    '[' + id + ']\nHeadline: "' + msg.headline + '"\nSupport: "' + msg.support + '"\nRole: ' + msg.role + '\nProof: ' + msg.proof + '\nTags: ' + msg.tags.join(', ')
  ).join('\n---\n');

  return `You are a senior brand strategist at Roche Diagnostics with the AIM Framework message library.

Produce a structured messaging brief. Select the most relevant messages, explain WHY each fits the specific audience and context, architect a narrative sequence, draft copy with citations, and identify gaps.

RULES:
- Cite every sentence with [CM-XX] if sourced from library, or [AI] if you wrote it
- Every headline must have headline_source: "library" if verbatim from a CM headline, or "ai" if you wrote it
- priority must be one of: lead, support, bridge, close
- Never invent claims not in the library
- Maximum 3 items in analysis array
- Maximum 3 slides in architecture
- Maximum 2 sentences per slide copy field
- Maximum 1 item in gaps array
- Be concise — shorter responses are better

Return ONLY valid JSON, no markdown:
{
  "analysis": [{"id":"CM-XX","headline":"...","rationale":"...","priority":"lead"}],
  "architecture": {
    "arc": "one sentence narrative arc",
    "slides": [{"position":1,"label":"...","headline":"...","headline_source":"ai","copy":"... [CM-XX] ... [AI] ...","visual_note":"...","sources":["CM-XX"]}]
  },
  "gaps": [{"title":"...","description":"..."}]
}

MESSAGE LIBRARY:
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

  if (req.method === 'POST' && reqPath === '/api/generate') {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      let parsed;
      try { parsed = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
      catch (e) { sendJSON(res, 400, { error: 'Invalid JSON: ' + e.message }); return; }

      // Build system prompt server-side — browser only sends the user query
      const systemPrompt = buildSystemPrompt();
      const userPrompt = 'Generate a ' + parsed.deliverable + ' for:\n- Buying influence: ' + parsed.audience + '\n- Topic: ' + parsed.topic + '\n- Disease area: ' + parsed.disease + '\n- Values layer: ' + parsed.values + '\n\nSelect the 3 most relevant messages only. Build exactly 3 slides. Keep each slide copy to 2 sentences max. Cite every sentence [CM-XX] or [AI]. Identify 1 gap only.';

      const payload = JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }]
      });

      console.log('[API] Payload size:', payload.length, 'bytes');

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
        const apiChunks = [];
        apiRes.on('data', chunk => apiChunks.push(chunk));
        apiRes.on('end', () => {
          const raw = Buffer.concat(apiChunks).toString('utf8');
          console.log('[API] Status:', apiRes.statusCode, '| Size:', raw.length);

          if (apiRes.statusCode !== 200) {
            let errMsg = 'Anthropic error ' + apiRes.statusCode;
            try { errMsg = JSON.parse(raw).error?.message || errMsg; } catch (_) {}
            sendJSON(res, 502, { error: errMsg });
            return;
          }

          let anthropicParsed;
          try { anthropicParsed = JSON.parse(raw); }
          catch (e) { sendJSON(res, 500, { error: 'Anthropic returned invalid JSON' }); return; }

          const text = (anthropicParsed.content || []).map(b => b.text || '').join('');
          if (!text) { sendJSON(res, 500, { error: 'Anthropic returned no text' }); return; }

          const clean = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
          let result;
          try { result = JSON.parse(clean); }
          catch (e) {
            console.error('[API] Model JSON error:', e.message, '| text:', text.slice(0, 200));
            sendJSON(res, 500, { error: 'Model returned malformed JSON: ' + e.message });
            return;
          }

          console.log('[API] Success — analysis:', (result.analysis||[]).length, 'slides:', ((result.architecture||{}).slides||[]).length);
          sendJSON(res, 200, { result });
        });
      });

      apiReq.on('error', e => sendJSON(res, 502, { error: 'Cannot reach Anthropic: ' + e.message }));
      apiReq.write(payload);
      apiReq.end();
    });
    return;
  }

  console.log('[404]', req.method, req.url);
  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log('Roche AIM demo running at http://localhost:' + PORT);
  console.log('API key:', API_KEY ? 'YES (' + API_KEY.slice(0,16) + '...)' : 'NOT SET');
});
