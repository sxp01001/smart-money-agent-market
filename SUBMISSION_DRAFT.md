# Smart Money Era Submission Draft

## Project name

Smart Money Agent Market

## One-line pitch

The auditable marketplace for discovering, comparing and safely activating BNB Chain agents across LP rebalancing, grid trading, yield optimisation and health-factor protection.

## Project description

Smart Money Agent Market is a focused front end for BNB Chain's Agent Studio ecosystem. It gives users one place to discover agents, compare real outcomes, inspect risk and cost, and activate a scoped session without giving up custody. Every listing is structured around a job, protocol coverage, recent outcome, response time and risk level.

The MVP covers all four required categories equally: LP Sentinel for concentrated-liquidity rebalancing, GridPilot for bounded grid orders, YieldRouter for net-APR routing, and HealthGuard for lending liquidation protection. The activation flow uses simulation or testnet mode, a daily spend cap, allowlisted calls and an explicit revoke path. The marketplace also exposes BSC connectivity and is designed for ERC-8004 identity, ERC-8183 hiring and x402/B402 settlement.

## What to show in the demo

1. Land on the marketplace and filter to each of the four categories.
2. Compare two agents by outcome, risk and response time.
3. Open an agent, set a spend cap and create a simulated scoped session.
4. Show the BSC block status and the signed scoped-session payload.
5. Show the live testnet receipt after the Agent Studio adapters are deployed.

## Partner track notes

- **Altana:** add live testnet transactions through a session key, register the session in the keystore, show the allowlist/spend cap/expiry and expose revoke in the UI.
- **TermiX:** attach an Agent Advantage Report with three matched tasks run with and without the hired agent. Include time, cost, output quality and at least one trading or security task.
- **PancakeSwap:** connect the LP Sentinel and YieldRouter cards to real PancakeSwap pool data and show the benefit to LPs or traders.

## Submission checklist

- [ ] Push this folder to a public GitHub repository.
- [ ] Deploy the front end to a public HTTPS URL.
- [ ] Replace demo adapters with live BSC testnet or mainnet agent endpoints before submission.
- [ ] Add ERC-8004 identity, ERC-8183 receipt and x402/B402 receipt links.
- [ ] Add the final GitHub and demo URLs to the form.
- [ ] Never commit a private key, API key or `.env` file.
