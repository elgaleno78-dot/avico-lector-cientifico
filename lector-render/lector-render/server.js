// Servidor para Render: sirve la app y hace de puente con la API de Claude.
// La clave de la API vive solo aquí (variable de entorno), nunca en el navegador.
// Sin dependencias: requiere Node 18 o superior.
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.ANTHROPIC_API_KEY;
const APP_PASSWORD = process.env.APP_PASSWORD || '';
const MODELS = {
  quick: process.env.MODEL_QUICK || 'claude-haiku-5-5',
  default: process.env.MODEL_DEFAULT || 'claude-sonnet-5-5',
  complex: process.env.MODEL_COMPLEX || 'claude-sonnet-5-5',
};
const MAX_BODY = 25 * 1024 * 1024;
const INDEX = path.join(__dirname, 'public', 'index.html');

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > MAX_BODY) { reject(new Error('too_large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function toMessages(input, images) {
  const msgs = typeof input === 'string'
    ? [{ role: 'user', content: input }]
    : input.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content) }));
  if (images && images.length) {
    const first = msgs.findIndex(m => m.role === 'user');
    const text = msgs[first].content;
    msgs[first].content = [
      ...images.map(img => ({ type: 'image', source: { type: 'base64', media_type: img.type || 'image/jpeg', data: img.data } })),
      { type: 'text', text },
    ];
  }
  return msgs;
}

async function handleClaude(req, res) {
  if (!API_KEY) { res.writeHead(500, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ message: 'Falta ANTHROPIC_API_KEY en el servidor.' })); }
  if (APP_PASSWORD && req.headers['x-app-key'] !== APP_PASSWORD) { res.writeHead(401, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ code: 'unauthorized', message: 'Contraseña incorrecta.' })); }
  let body;
  try { body = JSON.parse(await readBody(req)); }
  catch (e) { res.writeHead(400, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ message: e.message === 'too_large' ? 'Solicitud demasiado grande.' : 'Solicitud inválida.' })); }

  const upstream = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: MODELS[body.tier] || MODELS.default,
      max_tokens: 8000,
      stream: true,
      messages: toMessages(body.input, body.images),
    }),
  }).catch(e => ({ ok: false, status: 502, text: async () => e.message }));

  if (!upstream.ok) {
    const detail = await upstream.text();
    const code = upstream.status === 429 ? 'rate_limited' : 'api_error';
    console.error('Anthropic API', upstream.status, detail.slice(0, 500));
    res.writeHead(upstream.status === 429 ? 429 : 502, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ code, message: code === 'rate_limited' ? 'Límite de uso alcanzado; espera un momento.' : 'Error de la API de Claude (' + upstream.status + ').' }));
  }

  // Reenvía solo el texto, en fragmentos, al navegador.
  res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-cache', 'x-accel-buffering': 'no' });
  const reader = upstream.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      if (!line.startsWith('data:')) continue;
      try {
        const ev = JSON.parse(line.slice(5));
        if (ev.type === 'content_block_delta' && ev.delta && ev.delta.type === 'text_delta') res.write(ev.delta.text);
      } catch (_) {}
    }
  }
  res.end();
}

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    if (req.method === 'GET' && url.pathname === '/api/health') {
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ ok: true, password: !!APP_PASSWORD }));
    }
    if (req.method === 'POST' && url.pathname === '/api/claude') return await handleClaude(req, res);
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      return fs.createReadStream(INDEX).pipe(res);
    }
    res.writeHead(404); res.end('No encontrado');
  } catch (e) {
    console.error(e);
    if (!res.headersSent) res.writeHead(500);
    res.end();
  }
}).listen(PORT, () => console.log('Lector de artículos en el puerto ' + PORT));
