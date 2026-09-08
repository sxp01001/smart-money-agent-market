const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const root = __dirname;
const port = Number(process.env.PORT || 4173);
const bscRpcHost = process.env.BSC_RPC_HOST || 'bsc-testnet-rpc.publicnode.com';
const bscChainId = 97;
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml'
};

function bscStatus(res) {
  const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_blockNumber', params: [] });
  const request = https.request({
    hostname: bscRpcHost,
    path: '/',
    method: 'POST',
    headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) }
  }, upstream => {
    let data = '';
    upstream.on('data', chunk => { data += chunk; });
    upstream.on('end', () => {
      try {
        const parsed = JSON.parse(data);
        const block = parsed.result ? parseInt(parsed.result, 16) : null;
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
        res.end(JSON.stringify({ ok: Number.isInteger(block), chain: 'BSC testnet', chainId: bscChainId, block }));
      } catch (_) {
        res.writeHead(502, { 'content-type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, error: 'Invalid RPC response' }));
      }
    });
  });
  request.on('error', () => {
    res.writeHead(502, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'BSC RPC unavailable' }));
  });
  request.setTimeout(3500, () => request.destroy(new Error('BSC RPC timeout')));
  request.write(body);
  request.end();
}

http.createServer((req, res) => {
  if (req.url === '/api/bsc-status') return bscStatus(res);
  let requested;
  try { requested = decodeURIComponent((req.url || '/').split('?')[0]); }
  catch (_) { res.writeHead(400); return res.end('Bad request'); }
  const file = path.resolve(root, requested === '/' ? 'index.html' : `.${requested}`);
  const relative = path.relative(root, file);
  if (relative.startsWith('..') || path.isAbsolute(relative) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); return res.end('Not found');
  }
  res.writeHead(200, { 'content-type': mime[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}).listen(port, () => console.log(`Smart Money Marketplace running at http://localhost:${port}`));
