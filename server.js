const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const root = __dirname;
const port = Number(process.env.PORT || 4173);
const bscRpcHost = process.env.BSC_RPC_HOST || 'bsc-testnet-rpc.publicnode.com';
const bscChainId = 97;
const pancakeV3Factory = (process.env.PANCAKE_V3_FACTORY || '0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865').toLowerCase();
const defaultPool = (process.env.LP_SENTINEL_POOL_ADDRESS || '0x01354b3fd448e253572989b3fe15213cbed6565a').toLowerCase();
const positionManager = '0x427bf5b37357632377ecbec9de3626c71a5396c1';
const defaultTokenA = (process.env.LP_SENTINEL_TOKEN_A || '0xae13d989dac2f0debff460ac112a837c89baa7cd').toLowerCase();
const defaultTokenB = (process.env.LP_SENTINEL_TOKEN_B || '0x66e972502a34a625828c544a1914e8d8cc2a9de5').toLowerCase();
const feeTiers = [100, 500, 2500, 3000, 10000];
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

function rpcCall(method, params) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params });
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
          if (parsed.error) return reject(new Error(parsed.error.message || 'RPC error'));
          resolve(parsed.result);
        } catch (_) { reject(new Error('Invalid RPC response')); }
      });
    });
    request.on('error', reject);
    request.setTimeout(5000, () => request.destroy(new Error('BSC RPC timeout')));
    request.write(body);
    request.end();
  });
}

function addressWord(address) { return address.toLowerCase().replace(/^0x/, '').padStart(64, '0'); }
function uintWord(value) { return Number(value).toString(16).padStart(64, '0'); }
function decodeAddress(value) { return `0x${value.slice(-40)}`.toLowerCase(); }
function decodeUint(value) { return BigInt(value || '0x0'); }
function encodeGetPool(tokenA, tokenB, fee) { return `0x1698ee82${addressWord(tokenA)}${addressWord(tokenB)}${uintWord(fee)}`; }
function callData(to, data) { return rpcCall('eth_call', [{ to, data }, 'latest']); }
function decodeSigned(value, bits) { const raw = BigInt(`0x${value}`); const limit = 1n << BigInt(bits - 1); return Number(raw >= limit ? raw - (1n << BigInt(bits)) : raw); }
function tickFromSlot0(value) { return decodeSigned(value.replace(/^0x/, '').slice(64, 128), 24); }
function rangeRisk(currentTick, lowerTick, upperTick) {
  if (!Number.isInteger(currentTick)) return { status: 'unavailable', level: 'unknown', distanceToBoundaryTicks: null };
  if (currentTick < lowerTick || currentTick > upperTick) return { status: 'out of range', level: 'high', distanceToBoundaryTicks: 0 };
  const distanceToBoundaryTicks = Math.min(currentTick - lowerTick, upperTick - currentTick);
  const width = Math.max(upperTick - lowerTick, 1);
  const ratio = distanceToBoundaryTicks / width;
  return { status: ratio < 0.1 ? 'near boundary' : 'inside range', level: ratio < 0.1 ? 'high' : ratio < 0.25 ? 'medium' : 'low', distanceToBoundaryTicks };
}

async function lpPositions(res, owner) {
  if (!/^0x[a-fA-F0-9]{40}$/.test(owner || '')) return sendJson(res, 400, { ok: false, error: 'A valid wallet address is required.' });
  try {
    const balance = Number(decodeUint(await callData(positionManager, `0x70a08231${addressWord(owner)}`)));
    const positions = [];
    for (let index = 0; index < Math.min(balance, 20); index += 1) {
      const tokenId = decodeUint(await callData(positionManager, `0x2f745c59${uintWord(index)}`));
      const raw = (await callData(positionManager, `0x99fbab88${tokenId.toString(16).padStart(64, '0')}`)).replace(/^0x/, '');
      if (raw.length < 8 * 64) continue;
      const position = {
        tokenId: tokenId.toString(),
        token0: decodeAddress(raw.slice(64 * 2, 64 * 3)),
        token1: decodeAddress(raw.slice(64 * 3, 64 * 4)),
        feeTier: Number(BigInt(`0x${raw.slice(64 * 4, 64 * 5)}`)),
        tickLower: decodeSigned(raw.slice(64 * 5, 64 * 6), 24),
        tickUpper: decodeSigned(raw.slice(64 * 6, 64 * 7), 24),
        liquidity: BigInt(`0x${raw.slice(64 * 7, 64 * 8)}`).toString()
      };
      try {
        const poolHex = await callData(pancakeV3Factory, encodeGetPool(position.token0, position.token1, position.feeTier));
        const pool = decodeAddress(poolHex);
        if (pool !== '0x0000000000000000000000000000000000000000') {
          position.pool = pool;
          position.currentTick = tickFromSlot0(await callData(pool, '0x3850c7bd'));
          position.risk = rangeRisk(position.currentTick, position.tickLower, position.tickUpper);
        }
      } catch (_) { position.risk = { status: 'unavailable', level: 'unknown', distanceToBoundaryTicks: null }; }
      positions.push(position);
    }
    return sendJson(res, 200, { ok: true, live: true, chain: 'BSC testnet', chainId: 97, owner: owner.toLowerCase(), positionManager, walletPositionCount: balance, positions, source: `PancakeSwap V3 NonfungiblePositionManager ${positionManager}`, updatedAt: new Date().toISOString() });
  } catch (error) {
    return sendJson(res, 502, { ok: false, error: 'LP position data unavailable', detail: error.message });
  }
}

async function lpRecommendation(res) {
  try {
    const configuredPool = process.env.LP_SENTINEL_POOL_ADDRESS || defaultPool;
    let pool = /^0x[a-fA-F0-9]{40}$/.test(configuredPool) ? configuredPool.toLowerCase() : null;
    let fee = null;
    let tokenA = defaultTokenA;
    let tokenB = defaultTokenB;
    if (!pool) {
      for (const tier of feeTiers) {
        const result = await callData(pancakeV3Factory, encodeGetPool(tokenA, tokenB, tier));
        const candidate = result && result.length >= 42 ? decodeAddress(result) : null;
        if (candidate && candidate !== '0x0000000000000000000000000000000000000000') { pool = candidate; fee = tier; break; }
      }
    }
    const blockHex = await rpcCall('eth_blockNumber', []);
    const block = parseInt(blockHex, 16);
    if (!pool) {
      return sendJson(res, 200, { ok: true, live: false, chain: 'BSC testnet', chainId: 97, block, agent: 'LP Sentinel', status: 'no-pool-found', message: 'No configured PancakeSwap V3 testnet pool was found for the selected pair. Set LP_SENTINEL_POOL_ADDRESS or provide a funded testnet pool.', source: `PancakeSwap V3 Factory ${pancakeV3Factory}`, updatedAt: new Date().toISOString() });
    }
    const [token0Hex, token1Hex, liquidityHex, slot0Hex, feeHex, spacingHex] = await Promise.all([
      callData(pool, '0x0dfe1681'), callData(pool, '0xd21220a7'), callData(pool, '0x1a686502'), callData(pool, '0x3850c7bd'), callData(pool, '0xddca3f43'), callData(pool, '0xd0c93a7c')
    ]);
    const token0 = decodeAddress(token0Hex);
    const token1 = decodeAddress(token1Hex);
    const liquidity = decodeUint(liquidityHex).toString();
    const sqrtPriceX96 = decodeUint(slot0Hex.slice(0, 66));
    const tick = Number(BigInt(`0x${slot0Hex.slice(66, 130)}`));
    const tickSpacing = Number(decodeUint(spacingHex));
    const bandSize = Math.max(tickSpacing * 10, 1);
    const centerTick = Math.round(tick / bandSize) * bandSize;
    const lowerTick = centerTick - bandSize;
    const upperTick = centerTick + bandSize;
    const sqrtPrice = Number(sqrtPriceX96) / 2 ** 96;
    const priceToken1PerToken0 = sqrtPrice * sqrtPrice;
    const risk = rangeRisk(tick, lowerTick, upperTick);
    const body = { ok: true, live: true, chain: 'BSC testnet', chainId: 97, block, agent: 'LP Sentinel', pool, feeTier: Number(decodeUint(feeHex)), token0, token1, liquidity, tick, tickSpacing, suggestedRange: { lowerTick, upperTick, method: 'heuristic monitoring band around the live tick' }, risk, priceToken1PerToken0: Number.isFinite(priceToken1PerToken0) ? Number(priceToken1PerToken0.toPrecision(8)) : null, recommendation: `Current tick ${tick} is ${risk.status} for the suggested monitoring band ${lowerTick} to ${upperTick}. This is a read-only heuristic, not a submitted rebalance.`, source: `PancakeSwap V3 pool ${pool}`, updatedAt: new Date().toISOString() };
    return sendJson(res, 200, body);
  } catch (error) {
    return sendJson(res, 502, { ok: false, live: false, chain: 'BSC testnet', chainId: 97, error: 'PancakeSwap testnet data unavailable', detail: error.message });
  }
}

function sendJson(res, status, payload) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(payload));
}

http.createServer((req, res) => {
  const requestUrl = new URL(req.url || '/', 'http://localhost');
  if (requestUrl.pathname === '/api/bsc-status') return bscStatus(res);
  if (requestUrl.pathname === '/api/agents/lp-sentinel/recommendation') return lpRecommendation(res);
  if (requestUrl.pathname === '/api/agents/lp-sentinel/positions') return lpPositions(res, requestUrl.searchParams.get('owner'));
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
