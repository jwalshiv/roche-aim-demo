const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const API_KEY = process.env.ANTHROPIC_API_KEY;
const PORT = process.env.PORT || 3000;

if (!API_KEY) {
  console.error('ERROR: ANTHROPIC_API_KEY environment variable is not set.');
  process.exit(1);
}

const HTML = fs.readFileSync(path.join(__dirname, 'roche-app.html'), 'utf8');

function sendJSON(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body)
  });
  res.end(body);
}

const server = http.createServer((req, res) => {
  const reqPath = req.url.split('?')[0].replace(/\/+$/, '') || '/';

  // Serve the app
  if (req.method === 'GET' && (reqPath === '/' || reqPath === '')) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(HTML);
    return;
  }

  // Health check
  if (req.method === 'GET' && reqPath === '/health') {
    sendJSON(res, 200, { ok: true });
    return;
  }

  // API proxy
  if (req.method === 'POST' && reqPath === '/api/generate') {
    const chunks = [];
    let totalSize = 0;

    req.on('data', chunk => {
      totalSize += chunk.length;
      // Allow up to 2MB body (system prompt + library can be large)
      if (totalSize > 2 * 1024 * 1024) {
        res.writeHead(413);
        res.end('Request too large');
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      const body = Buffer.concat(chunks).toString('utf8');

      let parsed;
      try {
        parsed = JSON.parse(body);
      } catch (e) {
        console.error('Body parse error:', e.message, '| body length:', body.length);
        sendJSON(res, 400, { error: 'Invalid JSON in request body: ' + e.message });
        return;
      }

      if (!parsed.system || !parsed.userPrompt) {
        sendJSON(res, 400, { error: 'Missing system or userPrompt field' });
        return;
      }

      const payload = JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4000,
        system: parsed.system,
        messages: [{ role: 'user', content: parsed.userPrompt }]
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

      console.log('[API] Sending request to Anthropic, payload size:', payload.length, 'bytes');

      const apiReq = https.request(options, apiRes => {
        const apiChunks = [];
        apiRes.on('data', chunk => apiChunks.push(chunk));
        apiRes.on('end', () => {
          const raw = Buffer.concat(apiChunks).toString('utf8');
          console.log('[API] Status:', apiRes.statusCode, '| Response size:', raw.length, 'bytes');

          // If Anthropic returned a non-200, pass the error through
          if (apiRes.statusCode !== 200) {
            console.error('[API] Error response:', raw.slice(0, 500));
            let errMsg = 'Anthropic API error ' + apiRes.statusCode;
            try {
              const errObj = JSON.parse(raw);
              errMsg = errObj.error?.message || errMsg;
            } catch (_) {}
            sendJSON(res, 502, { error: errMsg });
            return;
          }

          // Parse Anthropic response
          let anthropicParsed;
          try {
            anthropicParsed = JSON.parse(raw);
          } catch (e) {
            console.error('[API] Failed to parse Anthropic JSON:', e.message);
            sendJSON(res, 500, { error: 'Anthropic returned invalid JSON: ' + e.message });
            return;
          }

          // Extract text content
          const text = (anthropicParsed.content || []).map(b => b.text || '').join('');
          if (!text) {
            console.error('[API] No text content in response:', JSON.stringify(anthropicParsed).slice(0, 300));
            sendJSON(res, 500, { error: 'Anthropic returned no text content' });
            return;
          }

          // Parse the JSON the model returned
          const clean = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
          let result;
          try {
            result = JSON.parse(clean);
          } catch (e) {
            console.error('[API] Model JSON parse error:', e.message, '| text length:', text.length);
            console.error('[API] Raw text (first 500):', text.slice(0, 500));
            sendJSON(res, 500, { error: 'Model returned malformed JSON: ' + e.message });
            return;
          }

          console.log('[API] Success — analysis items:', (result.analysis || []).length, '| slides:', ((result.architecture || {}).slides || []).length);
          sendJSON(res, 200, { result });
        });
      });

      apiReq.on('error', e => {
        console.error('[API] Request error:', e.message);
        sendJSON(res, 502, { error: 'Could not reach Anthropic API: ' + e.message });
      });

      apiReq.write(payload);
      apiReq.end();
    });

    req.on('error', e => {
      console.error('[REQ] Request error:', e.message);
    });

    return;
  }

  console.log('[404] Unmatched route:', req.method, req.url, '| parsed:', reqPath);
  res.writeHead(404);
  res.end('Not found: ' + req.method + ' ' + req.url);
});

server.listen(PORT, () => {
  console.log('Roche AIM demo running at http://localhost:' + PORT);
  console.log('API key configured:', API_KEY ? 'YES (' + API_KEY.slice(0, 12) + '...)' : 'NO');
});
