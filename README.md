# Smart Money Agent Market

An MVP submission for BNB Chain's **Smart Money Era: Build the Era** hackathon.
It focuses on the required marketplace journey: discover, compare and activate
agents across all four categories.

## What works now

- Four first-class categories: rebalancing, grid trading, yield optimisation and health-factor monitoring.
- Search, category filters, sorting, comparison tray and activation flow.
- Scoped-permission UI with a daily spend cap and simulation/testnet modes.
- Read-only live BSC block check through a small Node proxy, with an offline state.
- Comparison table and a wallet-aware signed session consent flow for testnet demos.
- No wallet custody, no withdrawals and no fabricated transactions.

## Run locally

Requires Node.js 18 or newer.

```bash
npm start
```

Open <http://localhost:4173>.

## Before submission

The four catalog entries are demo adapters and are intentionally marked
`DEMO ADAPTER / BSC READY` in the UI. Replace them with real Agent Studio
deployments and real contract/endpoint metadata before submitting. Add the public deployed URL
and this repository URL to the Google submission form. Do not put private keys
in the repository.

Recommended next integrations:

1. Injected wallet or WalletConnect connection.
2. ERC-8004 identity lookup for each agent.
3. ERC-8183 hire/escrow receipt.
4. x402/B402 payment receipt.
5. Altana scoped session key and revoke flow for the partner track.

## Submission fit

- Main track: Agent Studio marketplace front end.
- TermiX: add an Agent Advantage Report with three matched tasks, including one trading/security task.
- Altana: include live testnet transactions, session limits, registry reads and a user-facing revoke action.
- PancakeSwap: keep the LP rebalancing and yield entries connected to real PancakeSwap data.
