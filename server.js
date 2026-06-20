import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3000;

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
};

function cors(extra = {}) {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, HEAD',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    ...extra,
  };
}

// Load Netlify serverless function modules
const netlifyHandlers = {};
function loadNetlifyFunctions() {
  const funcDir = path.join(__dirname, 'netlify', 'functions');
  if (!fs.existsSync(funcDir)) return;
  const files = fs.readdirSync(funcDir).filter(f => f.endsWith('.js') || f.endsWith('.cjs'));
  for (const f of files) {
    const name = f.replace(/\.(js|cjs)$/, '');
    try {
      const fnPath = path.join(funcDir, f);
      const require = createRequire(import.meta.url);
      const mod = require(fnPath);
      netlifyHandlers[name] = mod.handler || mod.default;
    } catch (e) {
      console.warn('Could not load Netlify function:', f, e.message);
    }
  }
}

function buildEvent(req, bodyBuffer) {
  const u = new URL(req.url, `http://${req.headers.host}`);
  return {
    httpMethod: req.method,
    path: u.pathname,
    queryStringParameters: Object.fromEntries(u.searchParams),
    headers: req.headers,
    body: bodyBuffer ? bodyBuffer.toString('base64') : null,
    isBase64Encoded: !!bodyBuffer,
  };
}

const server = http.createServer((req, res) => {
  // CORS headers for all responses
  Object.entries(cors()).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Route Netlify functions via /api/:name
  const apiMatch = req.url.match(/^\/api\/([^\/\?]+)/);
  if (apiMatch) {
    const handler = netlifyHandlers[apiMatch[1]];
    if (!handler) {
      res.writeHead(404, { 'Content-Type': 'application/json', ...cors() });
      res.end(JSON.stringify({ error: 'API function not found' }));
      return;
    }
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', async () => {
      const body = Buffer.concat(chunks);
      try {
        const result = await handler(buildEvent(req, body));
        const headers = { ...cors(), ...(result.headers || {}) };
        res.writeHead(result.statusCode || 200, headers);
        if (result.isBase64Encoded && result.body) {
          res.end(Buffer.from(result.body, 'base64'));
        } else {
          res.end(result.body || '');
        }
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json', ...cors() });
        res.end(JSON.stringify({ error: 'Function error', detail: e.message }));
      }
    });
    return;
  }

  let filePath = path.join(__dirname, 'website', req.url === '/' ? 'index.html' : req.url);
  const ext = path.extname(filePath).toLowerCase();

  if (!ext && !filePath.endsWith('/')) {
    filePath += '.html';
  }

  // Serve MetusV2 icon at /icon.png if website doesn't have one
  if (req.url === '/icon.png' && !fs.existsSync(filePath)) {
    filePath = path.join(__dirname, 'MetusV2', 'icon.png');
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }

  if (!fs.existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
    return;
  }

  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': contentType });
  fs.createReadStream(filePath).pipe(res);
});

loadNetlifyFunctions();
server.listen(PORT, () => {
  console.log(`🚀 MetusV2 Website running at http://localhost:${PORT}`);
});
