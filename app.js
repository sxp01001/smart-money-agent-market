const agents = [
  { id: 'lp-sentinel', initials: 'LP', name: 'LP Sentinel', category: 'Rebalancing', icon: 'icon-mint', description: 'Watches concentrated liquidity ranges and proposes a rebalance before fees decay or price leaves the band.', protocol: 'PancakeSwap V3', outcome: 'Pilot benchmark', benchmark: '18.4% fee uplift vs. static range, 30-day replay, 42 positions', risk: 'Low', latency: '1.2s', fit: 96, endpoint: '/agents/lp-sentinel' },
  { id: 'grid-pilot', initials: 'GP', name: 'GridPilot', category: 'Grid Trading', icon: 'icon-orange', description: 'Builds and manages bounded grid orders with a clear inventory limit and pause-on-volatility guard.', protocol: 'BSC Spot', outcome: 'Pilot benchmark', benchmark: '72% profitable closes, 30-day replay, 118 fills', risk: 'Med', latency: '0.9s', fit: 91, endpoint: '/agents/grid-pilot' },
  { id: 'yield-router', initials: 'YR', name: 'YieldRouter', category: 'Yield Optimisation', icon: 'icon-pink', description: 'Compares net APR across supported pools after fees, lockups and utilization, then routes only within your cap.', protocol: 'Venus / Lista', outcome: 'Pilot benchmark', benchmark: '9.8% net APR after fees, 7-day snapshot, 6 pools', risk: 'Med', latency: '2.4s', fit: 88, endpoint: '/agents/yield-router' },
  { id: 'health-guard', initials: 'HF', name: 'HealthGuard', category: 'Health Factor Monitoring', icon: 'icon-blue', description: 'Monitors lending positions, estimates liquidation distance and sends an actionable top-up or repay plan.', protocol: 'Venus', outcome: 'Pilot benchmark', benchmark: '24/7 polling target, 15s alert threshold, testnet', risk: 'Low', latency: '1.6s', fit: 85, endpoint: '/agents/health-guard' }
];

const state = { category: 'all', query: '', sort: 'fit', compare: new Set(), selected: null, mode: 'simulate', walletAccount: null, walletChainId: null, provider: null };
const grid = document.querySelector('#agentGrid');
const empty = document.querySelector('#emptyState');
const tray = document.querySelector('#compareTray');
const toast = document.querySelector('#toast');

function filteredAgents() {
  const list = agents.filter(agent => (state.category === 'all' || agent.category === state.category) && `${agent.name} ${agent.category} ${agent.protocol}`.toLowerCase().includes(state.query.toLowerCase()));
  return list.sort((a, b) => state.sort === 'risk' ? a.risk.localeCompare(b.risk) : state.sort === 'latency' ? parseFloat(a.latency) - parseFloat(b.latency) : b.fit - a.fit);
}

function render() {
  const list = filteredAgents();
  empty.hidden = list.length > 0;
  grid.innerHTML = list.map(agent => `<article class="agent-card"><div class="agent-top"><div class="agent-icon ${agent.icon}">${agent.initials}</div><span class="live-tag demo-tag">DEMO ADAPTER / BSC READY</span></div><div class="agent-category">${agent.category}</div><h3>${agent.name}</h3><p>${agent.description}</p><div class="agent-metrics"><div class="metric"><span>${agent.outcome}</span><strong title="${agent.benchmark}">View benchmark</strong></div><div class="metric"><span>Risk</span><strong>${agent.risk}</strong></div><div class="metric"><span>Response target</span><strong>${agent.latency}</strong></div></div><div class="agent-foot"><label class="compare-check"><input type="checkbox" data-compare="${agent.id}" ${state.compare.has(agent.id) ? 'checked' : ''}> Compare</label><button class="button button-primary" data-activate="${agent.id}" type="button">Activate</button></div></article>`).join('');
  updateTray();
}

function updateTray() {
  const selected = agents.filter(agent => state.compare.has(agent.id));
  tray.hidden = selected.length === 0;
  document.querySelector('#compareCount').textContent = `${selected.length} selected`;
  document.querySelector('#compareNames').innerHTML = selected.map(agent => `<span class="compare-name">${agent.name}</span>`).join('');
}

function showToast(message) { toast.textContent = message; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 3000); }
function parseChainId(value) { if (typeof value !== 'string') return null; const text = value.trim().toLowerCase(); const radix = text.startsWith('0x') ? 16 : 10; const parsed = Number.parseInt(text, radix); return Number.isInteger(parsed) ? parsed : null; }
function chainLabel(value) { const id = parseChainId(value); return id === 97 ? 'BSC testnet' : id === 56 ? 'BSC mainnet' : `Chain ${value}`; }
function injectedProviders() { if (!window.ethereum) return []; const list = Array.isArray(window.ethereum.providers) ? window.ethereum.providers : [window.ethereum]; return list.filter(Boolean); }
async function selectProvider(preferTestnet = false) {
  const providers = injectedProviders();
  if (preferTestnet) {
    for (const provider of providers) {
      try { if (parseChainId(await provider.request({ method: 'eth_chainId' })) === 97) return provider; } catch (_) { /* ignore unavailable provider */ }
    }
  }
  return state.provider && providers.includes(state.provider) ? state.provider : providers[0] || null;
}
function openActivation(agent) { state.selected = agent; document.querySelector('#modalTitle').textContent = agent.name; document.querySelector('#modalDescription').textContent = agent.description; document.querySelector('#permissionText').textContent = agent.category === 'Health Factor Monitoring' ? 'Read positions + alert only' : `Execute allowlisted ${agent.protocol} calls`; document.querySelector('#activationModal').showModal(); }

grid.addEventListener('change', event => { const id = event.target.dataset.compare; if (!id) return; event.target.checked ? state.compare.add(id) : state.compare.delete(id); updateTray(); });
grid.addEventListener('click', event => { const id = event.target.dataset.activate; if (id) openActivation(agents.find(agent => agent.id === id)); });
document.querySelector('#searchInput').addEventListener('input', event => { state.query = event.target.value; render(); });
document.querySelector('#categorySelect').addEventListener('change', event => { state.category = event.target.value; document.querySelectorAll('.category-tab').forEach(tab => tab.classList.toggle('active', tab.dataset.category === state.category)); render(); });
document.querySelector('#sortSelect').addEventListener('change', event => { state.sort = event.target.value; render(); });
document.querySelectorAll('.category-tab').forEach(tab => tab.addEventListener('click', () => { state.category = tab.dataset.category; document.querySelector('#categorySelect').value = state.category; document.querySelectorAll('.category-tab').forEach(item => item.classList.toggle('active', item === tab)); render(); }));
document.querySelector('#clearCompare').addEventListener('click', () => { state.compare.clear(); render(); });
document.querySelector('#compareButton').addEventListener('click', () => openComparison());
document.querySelector('#exploreButton').addEventListener('click', () => document.querySelector('#market').scrollIntoView());
document.querySelector('#connectButton').addEventListener('click', connectWallet);
document.querySelector('#closeModal').addEventListener('click', () => document.querySelector('#activationModal').close());
document.querySelector('#closeCompare').addEventListener('click', () => document.querySelector('#compareModal').close());
document.querySelector('#spendCap').addEventListener('input', event => { document.querySelector('#spendOutput').textContent = `${event.target.value} USDC`; });
document.querySelectorAll('.mode').forEach(button => button.addEventListener('click', () => { state.mode = button.dataset.mode; document.querySelectorAll('.mode').forEach(item => item.classList.toggle('active', item === button)); }));
document.querySelector('#confirmActivation').addEventListener('click', createScopedSession);

function openComparison() {
  const selected = agents.filter(agent => state.compare.has(agent.id)).slice(0, 3);
  if (selected.length < 2) return showToast('Select at least two agents to compare.');
  ['A', 'B', 'C'].forEach((key, index) => { const header = document.querySelector(`#compareHead${key}`); header.textContent = selected[index]?.name || `Agent ${key}`; header.hidden = !selected[index]; });
  const rows = [['Category', agent => agent.category], ['Protocol', agent => agent.protocol], ['Benchmark', agent => agent.benchmark], ['Risk', agent => agent.risk], ['Response target', agent => agent.latency], ['Endpoint', agent => agent.endpoint]];
  document.querySelector('#comparisonBody').innerHTML = rows.map(([label, get]) => `<tr><th>${label}</th>${selected.map(agent => `<td>${get(agent)}</td>`).join('')}</tr>`).join('');
  document.querySelector('#compareModal').showModal();
}

async function connectWallet() {
  const provider = await selectProvider(true);
  if (!provider) return showToast('No injected wallet detected. Demo mode remains available.');
  try {
    const accounts = await provider.request({ method: 'eth_requestAccounts' });
    await updateWalletState(accounts[0], provider);
    showToast(`Wallet connected: ${accounts[0].slice(0, 6)}...${accounts[0].slice(-4)}`);
  } catch (_) { showToast('Wallet connection was cancelled.'); }
}

async function updateWalletState(account = null, providerOverride = null) {
  const provider = providerOverride || await selectProvider(Boolean(state.mode === 'testnet'));
  if (!provider) return;
  state.provider = provider;
  const accounts = account ? [account] : await provider.request({ method: 'eth_accounts' });
  state.walletAccount = accounts[0] || null;
  state.walletChainId = await provider.request({ method: 'eth_chainId' });
  const button = document.querySelector('#connectButton');
  if (!state.walletAccount) {
    button.textContent = 'Connect wallet';
    button.classList.remove('wallet-connected');
    return;
  }
  const network = chainLabel(state.walletChainId);
  button.textContent = `${state.walletAccount.slice(0, 6)}...${state.walletAccount.slice(-4)} · ${network}`;
  button.classList.add('wallet-connected');
}

async function createScopedSession() {
  const agent = state.selected;
  const cap = document.querySelector('#spendCap').value;
  const payload = JSON.stringify({ agent: agent.id, endpoint: agent.endpoint, mode: state.mode, dailySpendCapUsdc: Number(cap), allowlist: [agent.protocol], expiresIn: '24h' });
  if (state.mode === 'testnet') {
    const provider = await selectProvider(true);
    if (!provider) { showToast('Install or unlock a wallet before using BSC testnet mode.'); return; }
    try {
      const accounts = await provider.request({ method: 'eth_accounts' });
      await updateWalletState(accounts[0], provider);
      if (!state.walletAccount) { showToast('Connect your wallet before using BSC testnet mode.'); return; }
      if (parseChainId(state.walletChainId) !== 97) {
        showToast(`Website detected ${chainLabel(state.walletChainId)}. Switch to BNB Smart Chain Testnet (Chain ID 97), then try again.`);
        return;
      }
      await provider.request({ method: 'personal_sign', params: [`Smart Money session\n${payload}`, state.walletAccount] });
      showToast(`${agent.name} session consent signed on BSC testnet. No funds moved.`);
      document.querySelector('#activationModal').close();
      return;
    } catch (_) { showToast('Signature cancelled; no session was created.'); return; }
  }
  document.querySelector('#activationModal').close(); showToast(`${agent.name} session staged in ${state.mode} mode. No funds moved.`);
}

async function refreshBscStatus() {
  try {
    const response = await fetch('/api/bsc-status');
    const data = await response.json();
    document.querySelector('#networkLabel').textContent = data.ok ? `${data.chain || 'BSC'} connected` : 'BSC unavailable';
    document.querySelector('#networkStatus').classList.toggle('offline', !data.ok);
    document.querySelector('#blockLabel').textContent = data.block ? `#${data.block.toLocaleString()}` : '';
  } catch (_) { document.querySelector('#networkLabel').textContent = 'Demo mode'; }
}

render();
refreshBscStatus();
for (const provider of injectedProviders()) {
  provider.on?.('accountsChanged', accounts => updateWalletState(accounts[0], provider).catch(() => {}));
  provider.on?.('chainChanged', chainId => { state.walletChainId = chainId; updateWalletState(null, provider).catch(() => {}); showToast('Wallet network updated.'); });
}
selectProvider(true).then(provider => provider && updateWalletState(null, provider)).catch(() => {});
setInterval(refreshBscStatus, 30000);
