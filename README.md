# AdTech Programmatic Deal Diagnostic Agent

**A working prototype of an agent that diagnoses why a programmatic PMP deal
isn't spending, and recommends what to do about it.**

Built by Nate Bauer as a portfolio piece to make a product hypothesis tangible:
how an agent could take a publisher from "this deal isn't delivering" to a
specific, scoped next action in minutes instead of the days or weeks it often
takes today.

### [▶ Try the live demo](https://REPLACE-WITH-YOUR-VERCEL-URL)

---

## The problem

Private marketplace (PMP) deals are often set up but never reach meaningful
scale. A publisher can see a deal isn't spending, but the root cause can sit
anywhere across deal setup, supply eligibility, supply signals, pricing, deal
availability, targeting, or demand participation. Finding it is slow, manual work
that can take days or weeks per deal.

## What the agent does

- Watches a publisher's PMP deals and flags the ones underdelivering against pace.
- Localizes the break to a single stage across an **8-stage delivery funnel**,
  reading illustrative sell-side (SSP) and buy-side (DSP) signals.
- Explains the cause in plain, publisher-facing language.
- Recommends a next action **scoped to what it can honestly do** — and where the
  lever is publisher-controlled, prepares that change for approval and verifies
  it worked.

The scope discipline is the point: the agent distinguishes what it can *fix*
(prepare and apply), *guide* (identify but not apply), *escalate* (file a
ticket), treat as a *demand opportunity*, or only *monitor* — and it holds
confidence low rather than overclaiming when two causes aren't distinguishable.

## What's in it

| Tab | What it shows |
|-----|---------------|
| **Prototype** | The live diagnosis flow: pick a flagged deal, watch the agent localize the break and recommend an action. |
| **Architecture** | Three diagrams: how the demo works, how the agent sits across the ecosystem, and its runtime over MCP. |
| **Failure taxonomy** | The full set of failure modes, the action tier for each, and what's deliberately out of scope. |
| **Background** | The problem, what I built, and how I'd measure success. |

## How it's built

- **React + Vite**, single-page, no backend.
- The diagnostic engine is **deterministic**: each failure cause is derived from
  generated funnel data, so the reasoning follows the numbers on every refresh —
  no live model call at runtime, nothing that can silently drift.

## A note on scope

This is a self-directed prototype. The UI, data, benchmarks, and product
mechanics are **illustrative and synthetic**, built from public information and
experience in adjacent programmatic systems. It is not modeled on, affiliated
with, or representative of any specific ad-tech platform's product or roadmap.

## Run locally

```bash
npm install
npm run dev
```

---

*Built by Nate Bauer · product manager, ad-tech and programmatic.*
