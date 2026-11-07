// headphonelessrecording.com — static landing page + waitlist. No dependencies.
// Env: PORT (Railway sets it), DATA_DIR (point at a Railway volume so signups survive deploys),
//      ADMIN_KEY (required to read the list at /api/waitlist.csv?key=...).
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, 'public');
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const LIST = path.join(DATA_DIR, 'waitlist.jsonl');
const ADMIN_KEY = process.env.ADMIN_KEY || '';
fs.mkdirSync(DATA_DIR, { recursive: true });

const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'application/javascript',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.txt': 'text/plain', '.xml': 'application/xml' };

const emails = new Set();
try { fs.readFileSync(LIST, 'utf8').split('\n').filter(Boolean).forEach((l) => { try { emails.add(JSON.parse(l).email); } catch {} }); } catch {}

const hits = new Map();   // ip -> [timestamps], a light brake on spam
function limited(ip) {
  const now = Date.now(), a = (hits.get(ip) || []).filter((t) => now - t < 60_000);
  a.push(now); hits.set(ip, a);
  return a.length > 8;
}
const send = (res, code, body, type = 'application/json') => {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
};

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();

  if (url.pathname === '/api/waitlist' && req.method === 'POST') {
    if (limited(ip)) return send(res, 429, { error: 'Too many tries. Wait a minute and try again.' });
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > 4000) req.destroy(); });
    req.on('end', () => {
      let d = {};
      try { d = JSON.parse(body || '{}'); } catch { return send(res, 400, { error: 'That request was not readable.' }); }
      if (d.website) return send(res, 200, { ok: true });          // honeypot field: bots fill it, people don't
      const email = String(d.email || '').trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 200) return send(res, 400, { error: 'Enter an email address like you@example.com.' });
      const already = emails.has(email);
      if (!already) {
        emails.add(email);
        const rec = { email, use: String(d.use || '').slice(0, 40), daw: String(d.daw || '').slice(0, 60), at: new Date().toISOString() };
        fs.appendFileSync(LIST, JSON.stringify(rec) + '\n');
      }
      send(res, 200, { ok: true, already });
    });
    return;
  }
  if (url.pathname === '/api/waitlist.csv') {
    if (!ADMIN_KEY || url.searchParams.get('key') !== ADMIN_KEY) return send(res, 403, { error: 'forbidden' });
    let rows = [];
    try { rows = fs.readFileSync(LIST, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)); } catch {}
    const esc = (v) => `"${String(v || '').replace(/"/g, '""')}"`;
    return send(res, 200, ['email,use,daw,at', ...rows.map((r) => [r.email, r.use, r.daw, r.at].map(esc).join(','))].join('\n'), 'text/csv');
  }
  if (url.pathname === '/healthz') return send(res, 200, 'ok', 'text/plain');

  let p = decodeURIComponent(url.pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.normalize(path.join(PUBLIC, p));
  if (!file.startsWith(PUBLIC)) return send(res, 404, 'Not found', 'text/plain');
  fs.readFile(file, (err, buf) => {
    if (err) return fs.readFile(path.join(PUBLIC, '404.html'), (e2, b2) => send(res, 404, e2 ? 'Not found' : b2.toString(), 'text/html; charset=utf-8'));
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': path.extname(file) === '.html' ? 'no-cache' : 'public, max-age=3600' });
    res.end(buf);
  });
}).listen(PORT, () => console.log(`headphonelessrecording on :${PORT}`));
