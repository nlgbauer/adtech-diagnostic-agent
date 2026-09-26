# AdTech Programmatic Deal Diagnostic Agent

An illustrative, publisher-facing prototype: an agent that diagnoses why a
programmatic PMP (private marketplace) deal is underperforming across the
delivery funnel, then recommends a next action scoped to what it can honestly
do. Fully synthetic data, no live calls, no model call at runtime. The
diagnostic engine derives each failure cause from the generated funnel numbers,
so the reasoning follows the data on every refresh.

## Access
The demo is behind a simple password gate (access control, not real security,
all data is synthetic). Set the password in `src/Gate.jsx` (the `PASSWORD`
constant). Current value: `demo2026`.

## Run locally
```bash
npm install
npm run dev
```
Opens on http://localhost:5173

## What it does
- A publisher views their PMP deals across sell-side (SSP) supply and buy-side
  (DSP) demand; some deals underperform.
- Open a flagged deal and the agent localizes the break across an 8-stage
  delivery funnel, then recommends a next action scoped to what it can honestly
  do (prepare / guide / file ticket / demand opportunity / monitor).
- Refresh regenerates the portfolio with new flagged deals.
- Tabs: Prototype, Architecture (3 diagrams), Failure taxonomy, and Background.

## Deploy to Vercel
Push to GitHub, then in Vercel "Add New Project" and import the repo. Vercel
auto-detects Vite (build: `npm run build`, output: `dist`). No environment
variables needed.

## Notes
- `noindex` is set in `index.html` so the demo stays out of search results.
- All UI, data, benchmarks, and product mechanics are illustrative and synthetic,
  built from public information and adjacent-domain experience. Not affiliated
  with or representative of any specific ad-tech platform.
