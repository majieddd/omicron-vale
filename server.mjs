// Omicron dev server: zero-dep static file server, correct MIME.
import { createServer } from 'node:http';
import { readFile, statSync } from 'node:fs';
import { join, extname, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = normalize(dirname(fileURLToPath(import.meta.url)));
const PORT = process.env.PORT || 8231;
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp',
  '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2'
};

const server = createServer((req, res) => {
  const raw = decodeURIComponent((req.url || '/').split('?')[0]);
  let fp = normalize(join(ROOT, raw === '/' ? 'index.html' : raw));
  // path traversal guard (Windows-safe)
  const rootNorm = normalize(ROOT).toLowerCase();
  const fpNorm = normalize(fp).toLowerCase();
  if (!fpNorm.startsWith(rootNorm)) { res.writeHead(403); res.end('forbidden'); return; }
  let st;
  try { st = statSync(fp); } catch { res.writeHead(404); res.end('not found'); return; }
  if (st.isDirectory()) fp = join(fp, 'index.html');
  readFile(fp, (err, data) => {
    if (err) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[extname(fp).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Omicron dev server: http://127.0.0.1:${PORT}/`);
});
