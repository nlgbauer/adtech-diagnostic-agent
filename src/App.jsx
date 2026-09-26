import React, { useState, useCallback, useMemo, useEffect } from "react";

/* ------------------------------------------------------------------ *
 * AdTech Programmatic Deal Diagnostic Agent, V1 demo (illustrative mockup).
 *
 * THESIS: Detect -> diagnose -> recommend -> act -> verify.
 * Tell the publisher exactly WHY an eligible PMP isn't generating spend,
 * WHAT to do, and, when the fix is publisher-side and automatable, OFFER
 * TO DO IT with permission, then re-verify.
 *
 * V1 eligibility (only these are diagnosable): underperforming PMP deals
 * where supply path is the primary SSP AND demand is the DSP. PG deals,
 * healthy deals, and non-primary paths appear in the portfolio but are
 * out of scope for the beta.
 *
 * All benchmark figures are ILLUSTRATIVE synthetic demo data, shown as a
 * percentage of a benchmark for comparable deals, never claimed
 * as a sourced or industry number.
 * ------------------------------------------------------------------ */

const c = {
  teal: "#1E293B", orange: "#2563EB", orangeDeep: "#1D4ED8", navy: "#232F3E",
  ink: "#16191F", body: "#232F3E", muted: "#5A6570", faint: "#8D97A0",
  line: "#E3E6E8", lineSoft: "#EEF0F1", panelAlt: "#F7F8F8",
  link: "#3B5573", linkBtn: "#2563EB",
  green: "#128A4B", greenBg: "#E7F4EC", amber: "#B4690E", amberBg: "#FBF1E1",
  red: "#B02B2B", redBg: "#F9EAEA", handoff: "#6E7B87",
};
const mono = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
const sans = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif";

function useIsMobile(breakpoint = 720) {
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" ? window.innerWidth < breakpoint : false);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < breakpoint);
    window.addEventListener("resize", onResize);
    onResize();
    return () => window.removeEventListener("resize", onResize);
  }, [breakpoint]);
  return isMobile;
}

const PUBLISHERS = [
  { id: "fandom", name: "Fandom" },
  { id: "ddm", name: "Dotdash Meredith" },
  { id: "nbcu", name: "NBCUniversal" },
];
const GENRES_BY_PUB = {
  fandom: ["Sports", "Gaming", "Entertainment", "Pop Culture", "Anime"],
  ddm: ["Home & Garden", "Food & Recipes", "Health", "Travel", "Beauty"],
  nbcu: ["News", "Late Night", "Sports Highlights", "Drama", "Reality"],
};
const OTHER_GENRES = ["Entertainment", "Lifestyle", "General Entertainment", "News", "Comedy", "Drama"];
const STRUCTURAL_WHYS = ["deal_id_mismatch", "not_propagated", "deal_inactive"];

function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
const between = (r, lo, hi) => lo + r() * (hi - lo);
const hexId = (r) => "amc" + Math.floor(r() * 0xfffffff).toString(16).padStart(7, "0");
const pctS = (x) => (x <= 0 ? "0%" : x < 0.01 ? "<1%" : Math.round(x * 100) + "%");

/* ================= FUNNEL TEMPLATES ================= *
 * Two-layer model: a template builds a funnel that breaks at a STAGE.
 * The specific cause is drawn from that stage's set in TAXONOMY. Where two
 * causes at a stage are indistinguishable from the sell side, the taxonomy
 * entry names the alternatives and holds cause-confidence at med/low.
 * All comparative numbers are synthetic, shown vs. a benchmark. */
const TEMPLATES = {
  healthy: (r, g) => ({ dealActive: true, signalsOk: true, forecastReq: fr(r), dealReq: null, floorOk: true, floorPctBench: between(r, 0.95, 1.08), dealGenre: g, buyerGenre: g, activationRatio: between(r, 0.7, 0.92), participationBench: between(r, 0.85, 1.05), campaignEligible: true, winBench: between(r, 0.9, 1.05), reconciled: true, otherDealParticipation: between(r, 0.3, 0.42), supMul: between(r, 0.9, 0.97), partMul: 0.32, clrMul: 0.8 }),
  deal_status: (r, g) => ({ dealActive: false, signalsOk: true, forecastReq: fr(r), floorOk: true, floorPctBench: 1, dealGenre: g, buyerGenre: g, activationRatio: 0, participationBench: 0, campaignEligible: false, winBench: 0, reconciled: true, otherDealParticipation: between(r, 0.3, 0.42), supMul: between(r, 0.9, 0.97), partMul: 0, clrMul: 0 }),
  supply: (r, g) => ({ dealActive: true, signalsOk: true, forecastReq: fr(r), floorOk: true, floorPctBench: between(r, 0.95, 1.08), dealGenre: g, buyerGenre: g, activationRatio: between(r, 0.5, 0.75), participationBench: between(r, 0.85, 1.0), campaignEligible: true, winBench: between(r, 0.85, 1.0), reconciled: true, otherDealParticipation: between(r, 0.3, 0.42), supMul: between(r, 0.01, 0.04), partMul: 0.4, clrMul: 0.9 }),
  supply_signal: (r, g) => ({ dealActive: true, signalsOk: false, forecastReq: fr(r), floorOk: true, floorPctBench: between(r, 0.95, 1.08), dealGenre: g, buyerGenre: g, activationRatio: between(r, 0.5, 0.75), participationBench: between(r, 0.85, 1.0), campaignEligible: true, winBench: between(r, 0.85, 1.0), reconciled: true, otherDealParticipation: between(r, 0.3, 0.42), supMul: between(r, 0.35, 0.55), partMul: 0.4, clrMul: 0.9 }),
  floor: (r, g) => ({ dealActive: true, signalsOk: true, forecastReq: fr(r), floorOk: false, floorPctBench: between(r, 1.35, 1.7), dealGenre: g, buyerGenre: g, activationRatio: between(r, 0.4, 0.7), participationBench: between(r, 0.4, 0.7), campaignEligible: true, winBench: between(r, 0.05, 0.15), reconciled: true, otherDealParticipation: between(r, 0.3, 0.42), supMul: between(r, 0.9, 0.97), partMul: 0.4, clrMul: 0.04 }),
  availability_zero: (r, g) => ({ dealActive: true, signalsOk: true, forecastReq: fr(r), floorOk: true, floorPctBench: 1, dealGenre: g, buyerGenre: g, activationRatio: 0, participationBench: 0, campaignEligible: false, winBench: 0, reconciled: true, otherDealParticipation: between(r, 0.3, 0.42), supMul: between(r, 0.9, 0.97), partMul: 0, clrMul: 0 }),
  activation_friction: (r, g) => ({ dealActive: true, signalsOk: true, forecastReq: fr(r), floorOk: true, floorPctBench: between(r, 0.95, 1.08), dealGenre: g, buyerGenre: g, activationRatio: between(r, 0.1, 0.22), participationBench: between(r, 0.15, 0.35), campaignEligible: true, winBench: between(r, 0.85, 1.0), reconciled: true, otherDealParticipation: between(r, 0.3, 0.42), supMul: between(r, 0.9, 0.97), partMul: 0.12, clrMul: 0.9 }),
  campaign: (r, g) => ({ dealActive: true, signalsOk: true, forecastReq: fr(r), floorOk: true, floorPctBench: between(r, 0.95, 1.08), dealGenre: g, buyerGenre: g, activationRatio: between(r, 0.45, 0.7), participationBench: between(r, 0.1, 0.3), campaignEligible: false, winBench: 0, reconciled: true, otherDealParticipation: between(r, 0.3, 0.42), supMul: between(r, 0.9, 0.97), partMul: 0.01, clrMul: 0 }),
  targeting: (r, g) => ({ dealActive: true, signalsOk: true, forecastReq: fr(r), floorOk: true, floorPctBench: between(r, 0.95, 1.08), dealGenre: g, buyerGenre: pick(r, OTHER_GENRES.filter((x) => x !== g)), activationRatio: between(r, 0.4, 0.7), participationBench: between(r, 0.15, 0.35), campaignEligible: true, winBench: between(r, 0.85, 1.0), reconciled: true, otherDealParticipation: between(r, 0.3, 0.42), supMul: between(r, 0.9, 0.97), partMul: 0.1, clrMul: 0.9 }),
  participation: (r, g) => ({ dealActive: true, signalsOk: true, forecastReq: fr(r), floorOk: true, floorPctBench: between(r, 0.95, 1.08), dealGenre: g, buyerGenre: g, activationRatio: between(r, 0.5, 0.75), participationBench: between(r, 0.1, 0.3), campaignEligible: true, winBench: 0, reconciled: true, otherDealParticipation: between(r, 0.3, 0.42), supMul: between(r, 0.9, 0.97), partMul: 0.008, clrMul: 0 }),
  seat: (r, g) => ({ dealActive: true, signalsOk: true, forecastReq: fr(r), floorOk: true, floorPctBench: between(r, 0.95, 1.08), dealGenre: g, buyerGenre: g, activationRatio: between(r, 0.5, 0.75), participationBench: between(r, 0.1, 0.3), campaignEligible: true, winBench: 0, reconciled: true, otherDealParticipation: between(r, 0.02, 0.12), supMul: between(r, 0.9, 0.97), partMul: 0.008, clrMul: 0 }),
  auction: (r, g) => ({ dealActive: true, signalsOk: true, forecastReq: fr(r), floorOk: true, floorPctBench: between(r, 1.0, 1.15), dealGenre: g, buyerGenre: g, activationRatio: between(r, 0.5, 0.8), participationBench: between(r, 0.7, 0.95), campaignEligible: true, winBench: between(r, 0.05, 0.2), reconciled: true, otherDealParticipation: between(r, 0.3, 0.42), supMul: between(r, 0.9, 0.97), partMul: 0.32, clrMul: 0.15 }),
  delivery: (r, g) => ({ dealActive: true, signalsOk: true, forecastReq: fr(r), floorOk: true, floorPctBench: between(r, 0.95, 1.08), dealGenre: g, buyerGenre: g, activationRatio: between(r, 0.6, 0.85), participationBench: between(r, 0.85, 1.0), campaignEligible: true, winBench: between(r, 0.85, 1.0), reconciled: false, otherDealParticipation: between(r, 0.3, 0.42), supMul: between(r, 0.9, 0.97), partMul: 0.3, clrMul: 0.8 }),
};
function fr(r) { return between(r, 1.6e6, 2.4e6); }
function buildFunnel(tmplKey, r, g, extra) {
  const f = TEMPLATES[tmplKey](r, g);
  f.dealReq = f.forecastReq * f.supMul;
  f.eligible = f.dealReq;
  f.bidResponses = f.dealReq * f.partMul;
  f.bidsClearing = f.bidResponses * f.clrMul;
  if (extra) Object.assign(f, extra);
  return f;
}

/* ================= TAXONOMY (41 modes) ================= *
 * stage = display + localization target. tmpl = funnel template.
 * loc/root = confidence. kind = fix|lever|notify|escalate|monitor|info|none.
 * alts = other causes at this stage the SSP can't cleanly distinguish. */
const TAX = [
  { id: 1, label: "Deal not live", stage: "Deal status", tmpl: "deal_status", owner: "Publisher", loc: "high", root: "high", kind: "prepare", verify: ["Deal status", "Deal availability"],
    look: "Your deal isn't in an active, in-flight state, so it can't serve.",
    action: "Your deal isn't active and in-flight, so nothing can transact against it. The agent shows you exactly which status or flight date is holding it back and preps the correction for you to approve, or you can set it yourself, then confirms your deal is live.",
    rec: "Recommended: let the agent prepare the status/flight correction, then click “Prepare the change” to review it before it’s applied. Pick “I’ll do it myself” only if you’d rather set it in your deal tool.",
    msg: "I checked your deal and it isn’t in an active, in-flight state, so right now nothing can transact against it. The good news is this is a setting on your side, so I can fix it fast. I’ve identified the exact status and flight dates that need to change. I’d recommend letting me prepare the correction so you can review it before it goes live. Want me to draft it? You can also make the change yourself if you’d prefer." },
  { id: 2, label: "Deal setup needs attention", stage: "Deal status", tmpl: "deal_status", owner: "Publisher", loc: "high", root: "high", kind: "prepare", verify: ["Deal status"], alts: ["Deal not live"],
    look: "A required setting on your deal is missing or inconsistent, so it can't become eligible.",
    action: "One of your deal's required settings is missing or inconsistent, so it can't serve. The agent shows you the exact setting and preps the correction for your approval, or you can fix it yourself, then confirms your deal validates.",
    rec: "Recommended: let the agent prepare the corrected setting and click “Prepare the change” to review the exact edit before applying. Choose “I’ll do it myself” if you prefer to fix it directly.",
    msg: "I found a required setting on your deal that’s missing or inconsistent, which is stopping it from becoming eligible to serve. This is publisher-controlled, so it’s a quick fix. I’ve pinpointed the exact setting. I’d recommend letting me prepare the correction for your review before I apply it. Want me to draft it? Or you can update it yourself." },
  { id: 3, label: "Eligible supply is constrained", stage: "Supply eligibility", tmpl: "supply", owner: "Publisher", loc: "high", root: "high", kind: "prepare", verify: ["Supply eligibility"],
    look: "Too little of your inventory qualifies for the deal, publisher-controlled constraints are narrowing it too far.",
    action: "Very little of your inventory is qualifying for this deal, because the constraints on it are too tight. The agent shows you which of your constraints are eliminating the most inventory, models the expected impact, and preps the change for you to approve before anything is applied.",
    rec: "Recommended: click “Prepare the change” to see which constraints the agent would relax and the modeled supply impact, then approve. Use “I’ll do it myself” to adjust them manually.",
    msg: "I looked at your supply and very little of your inventory is qualifying for this deal, the constraints on it are set too tight. This is on your side to adjust, and I can help. I’ve identified which constraints are eliminating the most inventory and modeled the impact of relaxing them. I’d recommend letting me prepare that change so you can approve it first. Want me to put it together?" },
  { id: 4, label: "Inventory doesn't match the package", stage: "Supply eligibility", tmpl: "supply", owner: "Publisher", loc: "high", root: "med", kind: "prepare", verify: ["Supply eligibility"], alts: ["Eligible supply is constrained"],
    look: "Your available CTV inventory doesn't consistently meet the deal's format or content requirements.",
    action: "Your available inventory doesn't consistently match what this deal promises buyers on format or content. The agent preps a publisher-side repackage that broadens eligible inventory where it still preserves the value promised to buyers, for your review.",
    rec: "Recommended: click “Prepare the change” to review the repackage the agent proposes before applying. Choose “I’ll do it myself” if you’d rather repackage by hand.",
    msg: "I compared your available inventory against what this deal promises buyers, and it doesn’t consistently match on format or content, so demand can’t find enough to buy. I’d recommend repackaging to broaden eligible inventory where it still preserves the value you’re offering buyers. I can prepare that change for you to review. Want me to draft it? Or you can repackage it yourself." },
  { id: 5, label: "Publisher supply signals are limiting eligibility", stage: "Supply signals", tmpl: "supply_signal", owner: "Publisher", loc: "high", root: "med", kind: "guide", verify: ["Supply signals"],
    look: "The SSP is filtering otherwise eligible opportunities on your inventory because required publisher-side supply signals are missing, invalid, or unavailable.",
    action: "The SSP is filtering out otherwise eligible opportunities on your inventory because a required supply-side signal (for example ads.txt authorization or app/URL integrity) is missing or invalid. The agent identifies the affected signal and guides you through remediation where it's publisher-controlled.",
    rec: "Recommended: click “Prepare the change” to see the affected signal and the remediation steps; approve the part that’s publisher-controlled. Some of this may need your ad-ops team.",
    msg: "I found that the SSP is filtering out otherwise-eligible opportunities on your inventory because a required supply-side signal is missing or invalid, for example ads.txt authorization or app/URL integrity. These live on your own web infrastructure, so this is one I can’t change directly, but I can tell you exactly what’s wrong and what to fix. I’ve identified the affected signal and written up the remediation steps for you or your ad-ops team to apply. Want me to show you the steps?" },
  { id: 6, label: "Bids are landing below your floor", stage: "Floor competitiveness", tmpl: "floor", owner: "Publisher", loc: "high", root: "high", kind: "prepare", verify: ["Floor competitiveness"],
    look: "Buyer demand exists, but bids aren't clearing your PMP floor (a standard programmatic reason: \"bid below deal floor\").",
    action: "Demand is here, but bids are landing below your floor, so they don't clear. The agent shows you where bids are landing relative to your floor and preps a lower floor for you to approve, or you hold it as a deliberate price signal. The tradeoff between price and delivery stays your call.",
    rec: "Recommended: click “Prepare the change” to see where bids are landing and the floor the agent proposes, then approve, or hold your floor as a price signal. Use “I’ll do it myself” to set it manually.",
    msg: "Demand is here and buyers are bidding, but their bids are landing below your floor, so nothing clears. This is your lever to pull. I’ve mapped where bids are landing relative to your floor. I’d recommend lowering the floor toward that range to convert the bids you’re already getting, though you may choose to hold it as a deliberate price signal. Want me to prepare the floor change for your approval?" },
  { id: 7, label: "Deal isn't available in the DSP", stage: "Deal availability", tmpl: "availability_zero", owner: "the SSP path", loc: "high", root: "high", kind: "escalate", structuralWhy: "not_available", verify: ["Deal availability"],
    look: "Your deal is live in the SSP but isn't appearing as available for activation in the DSP, so buyers can't attach to it (0% activation with healthy supply).",
    action: "Your deal is live in the SSP but isn't showing up as available in the DSP, so buyers can't activate it and it sits at zero activation. Both the SSP and the DSP are on the same primary path, so the agent packages the deal ID, timestamps, and evidence and files a ticket with SSP support to trace the propagation, then confirms your deal becomes available to buyers. Activating it is still the buyer's choice.",
    rec: "Recommended: click “Escalate to the SSP”, the agent has the deal ID, timestamps, and evidence packaged so the SSP can trace why the deal isn’t reaching the DSP. There’s no publisher-side setting to change here.",
    msg: "Your deal is live on the SSP but isn’t showing as available in the DSP, so buyers can’t activate it. That’s why it’s sitting at zero. There’s no setting on your end to change here; this is a propagation issue between the two systems. I’ve already gathered the deal ID, timestamps, and supporting evidence. I’d recommend filing a ticket with SSP support so they can trace it. Want me to open it for you? SSP support typically responds within 1 business day." },
  { id: 8, label: "Targeting doesn't overlap demand", stage: "Targeting compatibility", tmpl: "targeting", owner: "Publisher", loc: "high", root: "high", kind: "prepare", verify: ["Targeting compatibility"],
    look: "Your package and buyer targeting barely overlap on audience, geo, or content, so few opportunities qualify.",
    action: "Your package and the demand's targeting barely overlap, on audience, geography, or content, so little qualifies to transact. The agent shows you where the gap is and, where your packaging is the lever, preps a change to close it while preserving your intended product. If the package is deliberately narrow, you keep it and the gap is surfaced to buyers via the SSP.",
    rec: "Recommended: click “Prepare the change” to review the packaging change that closes the overlap, then approve. If the narrow package is intentional, choose “I’ll do it myself” and the gap is surfaced to buyers via the SSP instead.",
    msg: "I compared your package against the demand’s targeting and they barely overlap, on audience, geography, or content, so very little qualifies to transact. If the narrow package is intentional, keep it and I’ll surface the gap to buyers via the SSP. Otherwise, I’d recommend widening the package to close the overlap. I can prepare that change for your review. Want me to draft it?" },
  { id: 9, label: "Demand participation is systematically weak", stage: "Buyer participation", tmpl: "participation", owner: "Demand-side", loc: "high", root: "med", kind: "opportunity",
    look: "Your deal is healthy and every publisher-controlled lever is clean, but participation across buyers is persistently soft, a deal-level pattern rather than one campaign. Read as a demand signal, not a break.",
    action: "The deal is healthy, so nothing needs fixing. Instead of notifying buyers, which the agent doesn't do, it reads aggregate participation on comparable inventory and recommends a separate test package aligned to where demand is concentrating (for example a genre-derived variant, or curating shopper-relevant supply via a first-party data clean room). Your existing deal is never touched; you authorize a controlled experiment, and the agent monitors both.",
    rec: "Recommended: let the agent confirm your own levers are clean, then click “Notify / flag via the SSP” to surface the under-participation to demand and start monitoring. No deal change is needed yet.",
    msg: "Your deal is healthy, nothing is broken. Every check passed, and the levers you control (supply, floor, packaging) are clean. What I’m seeing is a demand opportunity: participation on this deal is soft, but on comparable inventory in the DSP, demand is concentrating around a more specific package. Rather than change your existing deal, I’d recommend testing a separate variant aligned to that observed demand, your current deal stays exactly as is. Want me to show you the proposed test package and the demand signals behind it?" },
  { id: 10, label: "Demand is weak across several of your deals", stage: "Portfolio demand health", tmpl: "seat", owner: "Buyer", loc: "high", root: "med", kind: "monitor",
    look: "The same softness shows up across your comparable deals, not just this one, so it's a broader demand signal, not a deal-specific break.",
    action: "This weakness isn't specific to one deal, the same demand is soft across several of your comparable deals. That points to a broader demand pattern rather than anything wrong with this deal's setup. The agent surfaces the portfolio-level pattern through the appropriate SSP workflow and monitors it, rather than changing a healthy deal.",
    rec: "Recommended: click “Set a monitor”, this is a portfolio-wide demand pattern, not a fault in this deal, so the agent watches it and surfaces the trend rather than changing a healthy deal.",
    msg: "I checked across your portfolio, and this same softness shows up on several of your comparable deals, not just this one. That tells me it’s a broader demand pattern, not something wrong with this deal’s setup, so I wouldn’t change a healthy deal over it. I’d recommend I keep monitoring and surface the portfolio-level trend through the right SSP workflow. Want me to set that monitor?" },
  { id: 11, label: "Healthy ramp (no break)", stage: "None", tmpl: "healthy", owner: "None", loc: "high", root: "high", kind: "none",
    look: "Every stage clears; the deal is active, eligible, attracting demand, and progressing normally.",
    action: "Nothing is broken, the deal is healthy and just ramping. No action needed; the agent will re-check on its own in a few days.",
    msg: "Good news: I ran every check and nothing is broken. Your deal is active, eligible, attracting demand, and simply ramping; revenue is only below target because the flight is still early. There’s nothing for you to do right now. I’ll keep an eye on it and re-check in a few days, and I’ll flag you if anything changes." },
];
const TAX_BY_STAGE = TAX.reduce((m, t) => { (m[t.stage] = m[t.stage] || []).push(t); return m; }, {});

const OUT_OF_SCOPE = [
  { group: "Buyer-side campaign issues (below publisher altitude)", why: "Individual buyer campaign state, paused, out of flight, budget exhausted, pacing throttled, no eligible creative, format or policy blocks, is the buyer's to resolve and sits below the altitude a publisher acts on. V1 rolls these up into one deal-level participation signal instead of diagnosing single campaigns.", items: ["Buyer campaign paused", "Buyer campaign out of flight", "Buyer budget constrained / exhausted", "Buyer pacing suppression", "Creative not eligible", "Creative format / duration mismatch", "Policy / quality serving block"] },
  { group: "Buyer-choice inferences (not observable from the sell side)", why: "Why a buyer prioritized another deal, preferred the open exchange, or consolidated onto another supply path is a buyer decision the SSP can't observe. V1 won't infer buyer intent.", items: ["Deal deprioritized in buyer stack", "Buyer prefers open exchange / another deal", "Supply-path optimization (SPO) preference"] },
  { group: "Publisher ad-server final decisioning (V2, needs ad-server access)", why: "Losing at the publisher's own ad server, final decisioning, direct-sold priority, happens in a system the SSP doesn't operate. Diagnosing it needs publisher ad-server access.", items: ["Publisher final-decisioning loss", "Direct-sold priority displaces PMP"] },
  { group: "Cross-system delivery reconciliation (V2, needs publisher reporting)", why: "Reconciling the SSP delivery against the publisher's own reporting, counting methodology, IVT/filtering differences, reporting latency, requires reading the publisher's separate reporting system.", items: ["Reporting latency", "Reporting discrepancy", "Counting-methodology difference", "Invalid-traffic / filtering discrepancy"] },
  { group: "Other SSPs & other DSPs (V2 / V3, outside the primary path)", why: "The publisher runs other SSPs (Magnite, Index) in parallel, and demand also flows through other DSPs (TTD, DV360). V1 sees only the SSP-to-DSP corridor; other SSPs come into view in V2, other DSPs in V3.", items: ["Demand leakage to another supply path", "Audience / identity match loss (cross-system)", "Non-the DSP buyer 'why'"] },
];

/* ================= ENGINE ================= */
function diagnose(f, deal) {
  const supplyRatio = f.dealReq / f.forecastReq;
  const participation = f.eligible ? f.bidResponses / f.eligible : 0;
  const clearRatio = f.bidResponses > 0 ? f.bidsClearing / f.bidResponses : 0;
  const activePct = f.activationRatio;
  const S = [];
  const add = (source, title, rows, status, expl) => S.push({ source, title, rows, status, expl });
  const participatingAtAll = participation > 0.02;
  const hasBids = f.bidResponses > 0 && participatingAtAll;

  // Build each stage's own health first (independent of ordering).
  const reqM = (f.eligible / 1e6);
  const stageDefs = [
    { source: "SSP", title: "Deal status",
      rows: [["Deal state", f.dealActive ? "Active, in flight" : "Inactive / not serving"]],
      status: f.dealActive ? "ok" : "flag",
      expl: "Confirms the PMP is active, in flight, and validly configured on the SSP side." },
    { source: "SSP", title: "Supply eligibility",
      rows: [["Eligible supply", supplyRatio > 0.2 ? `${reqM.toFixed(1)}M requests` : `${(reqM).toFixed(2)}M requests (constrained)`], ["State", supplyRatio > 0.2 ? "Healthy" : "Constrained"]],
      status: supplyRatio > 0.2 ? "ok" : "flag",
      expl: "Measures how much of your supply is actually qualifying as eligible inventory for the deal." },
    { source: "SSP + DSP", title: "Supply signals",
      rows: [["Supply-side signals", f.signalsOk === false ? "Filtered, signal invalid or missing" : "Valid"]],
      status: f.signalsOk === false ? "flag" : "ok",
      expl: "Validates your publisher-side supply signals, ads.txt authorization, app/URL integrity, traffic quality, so opportunities aren't filtered before buyers can bid." },
    { source: "SSP + DSP", title: "Floor competitiveness",
      rows: [["Floor vs. clearing bids", f.floorOk ? "Competitive" : "Above where bids clear"]],
      status: f.floorOk ? "ok" : "flag",
      expl: "Compares incoming bids against your floor to see if price is blocking otherwise-present demand." },
    { source: "the DSP", title: "Deal availability",
      rows: [["Available in the DSP", activePct === 0 ? "Not available" : "Available"], ["Buyer activation", activePct === 0 ? "None" : activePct < 0.35 ? "Low" : "Normal"]],
      status: activePct === 0 ? "flag" : "ok",
      expl: "Checks that the deal is propagating through to the DSP as available, so buyers can attach to it." },
    { source: "SSP + DSP", title: "Targeting compatibility",
      rows: [["Overlap", f.dealGenre === f.buyerGenre ? "Strong" : "Limited"], ["Deal vs. demand", `${f.dealGenre} vs ${f.buyerGenre}`]],
      status: f.dealGenre === f.buyerGenre ? "ok" : "flag",
      expl: "Compares your deal packaging against demand targeting to see if enough opportunities qualify." },
    { source: "the DSP", title: "Buyer participation",
      rows: [["Participation", participatingAtAll ? "Healthy" : "Low"]],
      status: participatingAtAll ? "ok" : "flag",
      expl: "Tracks whether demand is participating on this deal at expected rates, a deal-level pattern, not any single campaign." },
    { source: "the DSP", title: "Portfolio demand health",
      rows: [["Demand on comparable deals", participatingAtAll ? "Healthy" : (f.otherDealParticipation > 0.15 ? "Healthy elsewhere" : "Soft across portfolio")]],
      status: participatingAtAll ? "na" : (f.otherDealParticipation > 0.15 ? "ok" : "flag"),
      expl: "Compares this deal against your comparable deals to tell whether weak participation is isolated here or portfolio-wide." },
  ];
  stageDefs.forEach((s) => add(s.source, s.title, s.rows, s.status, s.expl));

  const idxOf = (t) => S.findIndex((s) => s.title === t);
  const availabilityIdx = idxOf("Deal availability");
  const participationIdx = idxOf("Buyer participation");
  const portfolioIdx = idxOf("Portfolio demand health");
  const flags = S.map((s, i) => (s.status === "flag" ? i : -1)).filter((i) => i >= 0);
  let breakIdx;
  if (activePct === 0) breakIdx = flags[0];
  else {
    let cand = flags.filter((i) => i !== availabilityIdx);
    if (cand.includes(participationIdx) && S[portfolioIdx].status === "flag") cand = cand.filter((i) => i !== participationIdx);
    breakIdx = cand.length ? cand[0] : (flags.length ? flags[0] : -1);
  }
  const brkStage = breakIdx >= 0 ? S[breakIdx].title : "None";
  // Stages AFTER the break weren't reached. Mark them neutral (not-evaluated) so
  // they never contradict the diagnosis, but don't repeat a label down every row.
  // The reason is explained once, on the first not-evaluated stage.
  if (breakIdx >= 0) {
    for (let i = breakIdx + 1; i < S.length; i++) {
      const first = i === breakIdx + 1;
      S[i] = { ...S[i], status: "na", rows: [["Status", "Not evaluated"]],
        expl: first
          ? `The agent evaluates the funnel in order and stops at the first break, since a downstream stage can't be judged until the upstream issue is resolved. These checks re-run automatically once the ${brkStage.toLowerCase()} issue above is fixed.`
          : "" };
    }
  }
  const issuesFound = breakIdx >= 0 ? 1 : 0;
  const checksCompleted = S.length;
  const checksInformative = S.slice(0, breakIdx >= 0 ? breakIdx + 1 : S.length).filter((s) => s.status === "ok" || s.status === "flag").length;

  // the specific cause was drawn at generation time (f._causeId); fall back to
  // the first cause registered at the localized stage.
  let cause = TAX.find((t) => t.id === f._causeId);
  if (!cause || cause.stage !== brkStage) cause = (TAX_BY_STAGE[brkStage] || [TAX[TAX.length - 1]])[0];

  const sideMap = { Publisher: "Publisher-side", "the SSP path": "primary path", "Demand-side": "Demand-side", Buyer: "Buyer-side", "Buyer/platform": "Buyer-side", "Buyer / Publisher": "Buyer / publisher", "Buyer + Publisher lever": "Buyer + publisher lever", Marketplace: "Marketplace", "Cross-system": "Cross-system", Structural: "Structural", "Buyer / structural": "Buyer-side", Temporary: "Timing", None: "None" };
  const headline = cause.stage === "None"
    ? "Nothing is broken, this deal is ramping normally."
    : cause.label + ".";

  return {
    stages: S, breakIdx, checksInformative, issuesFound, checksCompleted,
    cause: cause.id, label: cause.label, stage: cause.stage,
    side: sideMap[cause.owner] || cause.owner, loc: cause.loc, root: cause.root,
    headline, diagnosis: cause.look, whatYouCanDo: cause.action, rec: cause.rec || null, message: cause.msg || cause.look,
    alts: cause.alts || null,
    action: { kind: cause.kind, label: actionLabel(cause), verifyChecks: cause.verify || (PREPARED[cause.id] && PREPARED[cause.id].verify) || [] },
    prepared: PREPARED[cause.id] || null,
    contract: CONTRACT[cause.id] || null,
    genre: f.dealGenre,
  };
}
function actionLabel(cause) {
  return { fix: "The agent can fix this", prepare: "The agent can prepare this change", notify: "Notify / flag via the SSP", reconcile: "Start a reconciliation", escalate: "File a ticket with the SSP", monitor: "Monitor", info: "Insight", none: "No action needed" }[cause.kind];
}
// concrete change the agent drafts for the publisher to review (prepare tier)
// Demand opportunity (id9): the deal is HEALTHY. The agent observes aggregate
// participation patterns on comparable inventory and proposes a SEPARATE test
// package aligned to observed demand. Existing deal is never touched.
// Language is observation-only ("demand is concentrating around…"), never buyer intent.
const GENRE_VARIANT = {
  "Sports": { content: "Sports + live-event", audience: "Adults 18–49, sports-interest", duration: "15s + 30s" },
  "Sports Highlights": { content: "Highlights + live-event", audience: "Adults 18–49, sports-interest", duration: "15s + 30s" },
  "News": { content: "News + politics", audience: "Adults 25–54", duration: "15s + 30s" },
  "Late Night": { content: "Late-night + comedy", audience: "Adults 18–34", duration: "15s + 30s" },
  "Drama": { content: "Drama + prestige", audience: "Adults 25–54", duration: "30s + 60s" },
  "Reality": { content: "Reality + lifestyle", audience: "Adults 18–34", duration: "15s + 30s" },
  "Comedy": { content: "Comedy + late-night", audience: "Adults 18–34", duration: "15s + 30s" },
  "Gaming": { content: "Gaming + esports", audience: "Adults 18–34, gaming-interest", duration: "15s + 30s" },
  "Anime": { content: "Anime + fandom", audience: "Adults 18–34", duration: "15s + 30s" },
  "Sci-Fi": { content: "Sci-fi + fandom", audience: "Adults 18–34", duration: "15s + 30s" },
  "Fantasy": { content: "Fantasy + fandom", audience: "Adults 18–34", duration: "15s + 30s" },
  "Pop Culture": { content: "Pop culture + entertainment", audience: "Adults 18–34", duration: "15s + 30s" },
};
function demandVariant(genre, floor) {
  const v = GENRE_VARIANT[genre] || { content: `${genre} + adjacent`, audience: "Adults 18–34", duration: "15s + 30s" };
  const testFloor = Math.max(18, Math.round((parseFloat(floor) || 32) * 0.85));
  return {
    rows: [
      ["Content", `${genre} (broad)`, v.content],
      ["Audience", "Broad reach", v.audience],
      ["Duration", "30s only", v.duration],
      ["Floor (CPM)", `$${floor}`, `$${testFloor} (test)`],
      ["Existing deal", "Remains active", "Unchanged"],
    ],
    evidence: [
      `Demand is concentrating around ${v.content.toLowerCase()} on comparable inventory in the DSP.`,
      `Participation is stronger for ${v.audience.toLowerCase()} than for the deal's current broad reach.`,
      `Consistent with stronger demand for ${v.duration} creative than 30s-only packages.`,
      "Signals are aggregate participation patterns on comparable inventory, not individual advertiser decisions.",
    ],
  };
}
const GUIDE_STEPS = {
  5: [
    "Pull the exact filtered-signal reason the SSP is returning (e.g. ads.txt authorization unavailable, app/URL mismatch).",
    "Check the flagged domains/apps against your ads.txt / app-ads.txt entries and confirm the SSP's seller ID and relationship are listed correctly.",
    "Correct or add the missing entry on your own web infrastructure (or hand these steps to your ad-ops team).",
    "Once published, re-run this diagnosis and I'll confirm the filtered opportunities recover.",
  ],
};
const PREPARED = {
  1: { verb: "Reactivate the deal", change: "Set the deal to active and its flight to cover today (the flagged status/date is highlighted for your review).", verify: ["Deal status", "Deal availability"] },
  2: { verb: "Correct the deal setting", change: "Fill the missing or inconsistent deal setting with the value the setup implies (shown for your review before it's applied).", verify: ["Deal status"] },
  3: { verb: "Broaden eligible supply", change: "Relax the publisher-controlled constraints eliminating the most inventory; modeled to expand eligible supply materially.", verify: ["Supply eligibility"] },
  4: { verb: "Repackage inventory", change: "Broaden the package to include the CTV formats and content the deal needs, where it preserves the value promised to buyers.", verify: ["Supply eligibility"] },
  6: { verb: "Adjust the floor", change: "Lower the floor toward the range where bids are landing; modeled to convert arriving bids into materially more wins. You can also hold it as a price signal.", verify: ["Floor competitiveness"] },
  8: { verb: "Close the targeting gap", change: "Where your packaging is the lever, broaden the deal toward the demand's targeting while preserving your intended product; modeled to lift overlap.", verify: ["Targeting compatibility"] },
};

// 6-part contract for publisher-controlled (prepare-tier) diagnoses.
// finding = object+field that failed; evidence = [label,value] rows (real observed);
// diff = {field, before, after}; effect = modeled impact (ranges, not guaranteed).
const CONTRACT = {
  1: { finding: "Deal object · status / flight dates",
       evidence: [["the SSP deal state", "Inactive / not in flight"], ["the DSP signal", "Deal not eligible to transact"], ["Consequence", "0 impressions, nothing can serve"]],
       diff: { field: "Deal status", before: "Paused · flight ended", after: "Active · flight covers today" },
       effect: "Deal becomes eligible to transact immediately. Delivery then depends on demand, which the agent monitors." },
  2: { finding: "Deal object · required configuration field",
       evidence: [["the SSP validation", "Field missing / inconsistent"], ["the DSP signal", "Deal fails validation"], ["Consequence", "Deal can't become eligible"]],
       diff: { field: "Flagged deal setting", before: "Missing / conflicting value", after: "Value the setup implies" },
       effect: "Deal passes validation and becomes eligible. Modeled to clear the Deal status check on re-run." },
  3: { finding: "Deal targeting · most restrictive constraints",
       evidence: [["Eligible supply (observed)", "~0.03M requests"], ["the DSP signal", "Supply too thin to sustain demand"], ["Consequence", "Demand can't find scale on the deal"]],
       diff: { field: "Tightest eligibility constraints", before: "~0.03M eligible requests", after: "~1.4–1.8M eligible requests (modeled)" },
       effect: "Modeled to expand eligible supply materially (roughly 40–60×). Actual lift depends on how demand takes up the added supply." },
  4: { finding: "Deal package · format / content coverage",
       evidence: [["Package coverage (observed)", "Misses formats demand requests"], ["the DSP signal", "Opportunities filtered on format/content"], ["Consequence", "Eligible supply understates real inventory"]],
       diff: { field: "Package format/content scope", before: "Narrow, misses requested CTV formats", after: "Broadened to cover requested formats (value preserved)" },
       effect: "Modeled to widen eligible supply while preserving the deal's promised value. Lift depends on demand for the added formats." },
  6: { finding: "Deal pricing · floor vs. clearing bids",
       evidence: [["Incoming bids (observed)", "Landing ~15–25% below floor"], ["the DSP signal", "Bid below deal floor"], ["Consequence", "Bids arrive but don't clear"]],
       diff: { field: "Deal floor (CPM)", before: "$46.00", after: "$34.00 (modeled, toward where bids land)" },
       effect: "Modeled to convert a materially larger share of arriving bids into wins. You may also hold the floor as a deliberate price signal." },
  8: { finding: "Deal targeting · overlap with demand",
       evidence: [["Targeting overlap (observed)", "Limited (audience/geo/content)"], ["the DSP signal", "Low match between package and demand"], ["Consequence", "Little qualifies to transact"]],
       diff: { field: "Package targeting scope", before: "Narrow overlap with demand", after: "Broadened toward demand (intended product preserved)" },
       effect: "Modeled to lift the share of opportunities that qualify. If the narrow package is intentional, keep it and the gap is surfaced to buyers via the SSP instead." },
};
const SUPPLY_PATHS = ["Primary SSP", "Magnite", "Index Exchange"];
const DEMAND_PLATFORMS = ["the DSP", "The Trade Desk", "DV360"];
function generatePortfolio(pubId, seed) {
  const r = rng(seed);
  const genres = GENRES_BY_PUB[pubId];
  const rows = [];
  // guarantee 2 eligible underperforming primary-path PMPs, each a random cause
  const drawable = TAX.filter((t) => t.stage !== "None" && !t.defer);
  for (let e = 0; e < 2; e++) {
    const genre = genres[e % genres.length];
    const cause = pick(r, drawable);
    const funnel = buildFunnel(cause.tmpl, r, genre, { _causeId: cause.id, structuralWhy: cause.structuralWhy });
    rows.push(makeDeal(r, genre, "Private auction", "Primary SSP", "the DSP",
      Math.round(between(r, 6, 18)), funnel, true));
  }
  // one healthy primary-path PMP (appears in scope but healthy → not diagnosable)
  {
    const genre = genres[2 % genres.length];
    const funnel = buildFunnel("healthy", r, genre, { _causeId: 11 });
    rows.push(makeDeal(r, genre, "Private auction", "Primary SSP", "the DSP",
      Math.round(between(r, 88, 99)), funnel, false));
  }
  const fillers = [
    ["Programmatic guaranteed", "Primary SSP", "the DSP"],
    ["Private auction", "Magnite", "The Trade Desk"],
    ["Private auction", "Index Exchange", "DV360"],
    ["Programmatic guaranteed", "Magnite", "The Trade Desk"],
    ["Private auction", "Primary SSP", "The Trade Desk"],
  ];
  fillers.forEach((fl, i) => {
    const genre = genres[(i + 3) % genres.length];
    rows.push(makeDeal(r, genre, fl[0], fl[1], fl[2], Math.round(between(r, 70, 99)), null, false));
  });
  for (let i = rows.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [rows[i], rows[j]] = [rows[j], rows[i]]; }
  return rows;
}
function makeDeal(r, genre, type, supply, demand, revPct, funnel, diagnosable) {
  const floorOk = funnel ? funnel.floorOk : true;
  return { id: hexId(r), name: `${genre}, CTV`, type, supply, demand,
    integration: supply === "Primary SSP" ? "the SSP / UAM" : supply === "Magnite" ? "SpringServe" : "Prebid",
    floor: (floorOk ? between(r, 22, 40) : between(r, 46, 60)).toFixed(2),
    revPct, funnel, diagnosable };
}

/* ================= UI ================= */
function Ribbon({ view, setView }) {
  const items = [
    { key: "deals", label: "Prototype" },
    { key: "architecture", label: "Architecture" },
    { key: "taxonomy", label: "Failure taxonomy" },
  ];
  return (
    <div style={{ background: c.ink, borderBottom: `1px solid rgba(255,255,255,0.08)` }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 22px", height: 34, display: "flex", alignItems: "center", gap: 4 }}>
        <span style={{ fontSize: 10, fontFamily: mono, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.5)", marginRight: 8 }}>Nate Bauer · concept</span>
        {items.map((it) => {
          const on = view === it.key || (it.key === "deals" && (view === "deals" || view === "deal"));
          return (
            <div key={it.key} onClick={() => setView(it.key)}
              style={{ fontSize: 11.5, fontWeight: 600, color: on ? "#fff" : "rgba(255,255,255,0.6)", padding: "0 11px", height: "100%", display: "flex", alignItems: "center", cursor: "pointer", borderBottom: on ? `2px solid ${c.orange}` : "2px solid transparent" }}>
              {it.label}
            </div>
          );
        })}
      </div>
    </div>
  );
}
function Masthead() {
  return (
    <div style={{ background: c.teal }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 22px", height: 52, display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
          <span style={{ fontSize: 19, fontWeight: 700, color: "#fff", letterSpacing: "-0.02em" }}>deal diagnostic</span>
          <span style={{ fontSize: 19, fontWeight: 300, color: "#fff" }}>agent</span>
        </div>
        <div style={{ marginLeft: "auto", fontSize: 12, color: "rgba(255,255,255,0.8)" }}>?</div>
      </div>
    </div>
  );
}
function NavBar({ pub, setPub, view, setView }) {
  const tabs = [
    { key: "deals", label: "Deals" },
    { key: "background", label: "Background" },
  ];
  return (
    <div style={{ background: c.orange }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 22px", height: 44, display: "flex", alignItems: "stretch" }}>
        {tabs.map((tb) => {
          const on = (tb.key === "deals") ? (view === "deals" || view === "deal") : view === tb.key;
          return (
            <div key={tb.key} onClick={() => setView(tb.key)}
              style={{ display: "flex", alignItems: "center", padding: "0 18px", background: on ? "rgba(255,255,255,0.16)" : "transparent", color: "#fff", fontSize: 12.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", cursor: "pointer" }}>
              {tb.label}
            </div>
          );
        })}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.85)" }}>Publisher:</span>
          <select value={pub} onChange={(e) => setPub(e.target.value)} style={{ fontSize: 12, fontWeight: 600, color: c.ink, background: "#fff", border: "none", borderRadius: 4, padding: "5px 8px" }}>
            {PUBLISHERS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </div>
    </div>
  );
}

function StatusCell({ rev }) {
  const crit = rev < 30, label = crit ? "Underdelivering" : rev < 70 ? "Watch" : "Active", color = crit ? c.red : rev < 70 ? c.amber : c.green;
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5, color: c.body }}><span style={{ width: 8, height: 8, borderRadius: 4, background: color }} />{label}</span>;
}
function ConfidenceMeter({ label, level }) {
  const idx = { low: 1, med: 2, high: 3 }[level], col = level === "high" ? c.green : level === "med" ? c.amber : c.red, word = { low: "Low", med: "Medium", high: "High" }[level];
  return <div><div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}><span style={{ fontSize: 11.5, color: c.muted }}>{label}</span><span style={{ fontSize: 11.5, fontWeight: 700, color: c.ink }}>{word}</span></div><div style={{ display: "flex", gap: 3 }}>{[1, 2, 3].map((n) => <div key={n} style={{ height: 5, flex: 1, borderRadius: 2, background: n <= idx ? col : c.line }} />)}</div></div>;
}

function CheckRow({ stage, index, state, expanded, onToggle, isBreak, result }) {
  const dim = state === "pending", st = stage.status;
  const isOpp = result && result.action && result.action.kind === "opportunity";
  const breakColor = isOpp ? c.teal : c.red;
  const breakGlyph = isOpp ? "★" : "▲";
  const markColor = isBreak ? breakColor : st === "flag" ? c.amber : (st === "na" || st === "insufficient") ? c.faint : c.green;
  const glyph = state === "scanning" ? "" : isBreak ? breakGlyph : st === "flag" ? "!" : st === "na" ? "–" : st === "insufficient" ? "?" : "✓";
  return (
    <div style={{ borderTop: index === 0 ? "none" : `1px solid ${c.lineSoft}`, opacity: dim ? 0.32 : 1, transition: "opacity 220ms ease", background: isBreak && state === "done" ? (isOpp ? "#E9F3F2" : c.redBg) : "transparent" }}>
      <button onClick={state === "done" ? onToggle : undefined} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", textAlign: "left", cursor: state === "done" ? "pointer" : "default", background: "transparent", border: "none" }}>
        <span style={{ fontFamily: mono, fontSize: 10, color: c.faint, width: 16 }}>{String(index + 1).padStart(2, "0")}</span>
        <span style={{ width: 18, height: 18, borderRadius: 4, border: `1.5px solid ${state === "scanning" ? c.orange : markColor}`, color: markColor, fontFamily: mono, fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{state === "scanning" ? <span style={{ width: 6, height: 6, borderRadius: 3, background: c.orange }} /> : glyph}</span>
        <span style={{ flex: 1, fontSize: 14, fontWeight: st === "flag" ? 700 : 600, color: state === "scanning" ? c.orangeDeep : (st === "na" || st === "insufficient") ? c.muted : c.ink }}>{stage.title}</span>
        <span style={{ fontFamily: mono, fontSize: 8.5, letterSpacing: "0.06em", textTransform: "uppercase", color: c.faint, whiteSpace: "nowrap" }}>{stage.source}</span>
        {state === "done" && <span style={{ color: c.faint, fontSize: 10, transform: expanded ? "rotate(180deg)" : "none" }}>▾</span>}
      </button>
      {state === "done" && expanded && (
        <div style={{ padding: "0 12px 12px 44px" }}>
          {stage.rows.map(([l, v]) => <div key={l} style={{ display: "flex", gap: 8, fontSize: 11, marginBottom: 2 }}><span style={{ color: c.muted, width: 140, flexShrink: 0 }}>{l}</span><span style={{ fontFamily: mono, fontSize: 11, color: isBreak ? (isOpp ? c.teal : c.red) : c.body }}>{v}</span></div>)}
          {(isBreak || stage.expl) && <p style={{ fontSize: 11.5, color: c.muted, lineHeight: 1.45, marginTop: 4 }}>{isBreak ? (isOpp ? `Your deal is healthy here. Soft participation on this stage is what surfaced the demand opportunity. See it on the left.` : `This is the stage that flagged. See the diagnosis and recommended action on the left.`) : stage.expl}</p>}
        </div>
      )}
    </div>
  );
}

/* action panel with the act -> verify loop */
function ActionPanel({ result, deal, onFixed }) {
  const a = result.action;
  const prep = result.prepared;
  const [state, setState] = useState("offer"); // offer | review | running | done
  const kind = a.kind;
  const tone = kind === "none" ? c.green : kind === "opportunity" ? c.teal : kind === "escalate" || kind === "notify" || kind === "reconcile" ? c.link : kind === "monitor" || kind === "info" || kind === "guide" || kind === "advise" ? c.handoff : c.orange;
  const toneBg = kind === "none" ? c.greenBg : kind === "opportunity" ? "#E9F3F2" : kind === "escalate" || kind === "notify" || kind === "reconcile" ? "#EAF3FB" : kind === "monitor" || kind === "info" || kind === "guide" || kind === "advise" ? c.panelAlt : c.amberBg;
  const label = { fix: "I can fix this", prepare: "I can prepare this change", guide: "Here\u2019s how to fix this", advise: "Ways to lift demand", opportunity: "Demand opportunity", notify: "I can flag this via the SSP", reconcile: "Cross-system reconciliation", escalate: "I can file this with the SSP", monitor: "I can monitor this", info: "My read", none: "My recommendation" }[kind];
  const FIXVERB = { 1: "Reactivate the deal", 2: "Correct the deal configuration", 9: "Re-sync the deal ID" };
  const boxTitle = prep ? prep.verb
    : kind === "fix" ? (FIXVERB[result.cause] || "Fix the configuration")
    : kind === "guide" ? "Remediate the supply signal"
    : kind === "advise" ? "Improve demand relevance"
    : kind === "opportunity" ? "Test a package aligned to observed demand"
    : kind === "notify" ? "Surface weak demand to buyers"
    : kind === "reconcile" ? "Start a reconciliation"
    : kind === "escalate" ? "Open a propagation ticket"
    : kind === "monitor" ? "Watch the portfolio trend"
    : kind === "info" ? "Use in deal strategy"
    : kind === "none" ? "No action needed"
    : a.label;

  const runFix = () => { setState("running"); setTimeout(() => { setState("done"); onFixed && onFixed(a.verifyChecks || []); }, 1400); };
  const applyPrepared = () => { setState("running"); setTimeout(() => { setState("done"); onFixed && onFixed((prep && prep.verify) || a.verifyChecks || []); }, 1400); };

  const box = (children) => (
    <div style={{ marginTop: 18, paddingTop: 16, borderTop: `1px solid ${c.lineSoft}` }}>
      <div style={{ border: `1px solid ${c.line}`, borderLeft: `3px solid ${tone}`, borderRadius: 8, overflow: "hidden" }}>
        <div style={{ background: toneBg, padding: "8px 14px" }}>
          <div style={{ fontFamily: mono, fontSize: 9.5, letterSpacing: "0.1em", textTransform: "uppercase", color: c.muted }}>{label}</div>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: c.ink, marginTop: 2 }}>{boxTitle}</div>
        </div>
        <div style={{ padding: "12px 14px" }}>{children}</div>
      </div>
    </div>
  );
  const btn = (txt, onClick, primary = true, fill = c.orange, txtColor = c.ink) => (
    <button onClick={onClick} style={{ fontSize: 12.5, fontWeight: primary ? 700 : 600, color: primary ? txtColor : c.muted, background: primary ? fill : "#fff", border: primary ? "none" : `1px solid ${c.line}`, borderRadius: 6, padding: "8px 16px", cursor: "pointer" }}>{txt}</button>
  );
  const running = (verb) => <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: c.body }}><span style={{ width: 6, height: 6, borderRadius: 3, background: c.orange }} /> {verb}…</div>;
  const verified = (msg) => <div><div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700, color: c.green, marginBottom: 4 }}>✓ Done</div><p style={{ fontSize: 12.5, color: c.muted, lineHeight: 1.5 }}>{msg}</p></div>;

  // TIER 1, agent executes a config fix
  if (kind === "fix") {
    if (state === "running") return box(running("Applying fix and re-verifying affected checks"));
    if (state === "done") return box(verified("Done. I re-ran your deal's checks and they pass now. It should begin activating; I’ll keep an eye on revenue over the next few hours."));
    return box(<>
      <p style={{ fontSize: 12.5, color: c.body, lineHeight: 1.5, marginBottom: 10 }}>This is a configuration issue on the primary programmatic path (SSP to DSP) that I can correct for you, re-syncing the deal and re-verifying. Want me to handle it, or would you rather make the change yourself?</p>
      <div style={{ display: "flex", gap: 8 }}>{btn("Yes, fix it & verify", runFix)}{btn("I'll do it myself", () => setState("self"), false)}</div>
      {state === "self" && <p style={{ fontSize: 11.5, color: c.muted, marginTop: 8, lineHeight: 1.5 }}>In your deal setup, correct the flagged field and re-push; then re-run this diagnosis to confirm the affected checks clear.</p>}
    </>);
  }

  // TIER 2, agent prepares a change for review
  if (kind === "prepare") {
    const ct = result.contract;
    if (state === "running") return box(running("Applying the change and re-verifying"));
    if (state === "done") return box(<div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700, color: c.green, marginBottom: 6 }}>✓ Applied &amp; verified</div>
      <p style={{ fontSize: 12.5, color: c.body, lineHeight: 1.5, marginBottom: 8 }}>I applied the change and re-ran the affected checks. Here are the new values:</p>
      {ct && <div style={{ background: c.panelAlt, borderRadius: 6, padding: "8px 11px", marginBottom: 8 }}>
        <div style={{ display: "flex", gap: 8, fontSize: 11.5, marginBottom: 2 }}><span style={{ color: c.muted, width: 130, flexShrink: 0 }}>{ct.diff.field}</span><span style={{ fontFamily: mono, color: c.green }}>{ct.diff.after}</span></div>
        <div style={{ display: "flex", gap: 8, fontSize: 11.5 }}><span style={{ color: c.muted, width: 130, flexShrink: 0 }}>Affected checks</span><span style={{ fontFamily: mono, color: c.green }}>{(prep && prep.verify || []).join(", ")} · passing</span></div>
      </div>}
      <p style={{ fontSize: 12, color: c.muted, lineHeight: 1.5 }}>I’ll keep watching your delivery over the next few hours to confirm spend responds.</p>
    </div>);
    if (state === "self") return box(<p style={{ fontSize: 12, color: c.muted, lineHeight: 1.55 }}>{prep ? "No problem, here’s the change to make in your deal setup: " + prep.change + " Once you’ve done it, re-run the diagnosis and I’ll confirm it cleared." : "Make this change in your deal setup, then re-run and I’ll confirm."}</p>);
    if (state === "review") return box(ct ? <>
      <div style={{ fontSize: 11, fontFamily: mono, letterSpacing: "0.1em", textTransform: "uppercase", color: c.faint, marginBottom: 3 }}>Finding</div>
      <p style={{ fontSize: 12.5, color: c.ink, fontWeight: 600, lineHeight: 1.45, marginBottom: 9 }}>{ct.finding}</p>
      <div style={{ fontSize: 11, fontFamily: mono, letterSpacing: "0.1em", textTransform: "uppercase", color: c.faint, marginBottom: 3 }}>Evidence</div>
      <div style={{ marginBottom: 9 }}>{ct.evidence.map(([l, v]) => <div key={l} style={{ display: "flex", gap: 8, fontSize: 11.5, marginBottom: 2 }}><span style={{ color: c.muted, width: 130, flexShrink: 0 }}>{l}</span><span style={{ fontFamily: mono, color: c.body }}>{v}</span></div>)}</div>
      <div style={{ fontSize: 11, fontFamily: mono, letterSpacing: "0.1em", textTransform: "uppercase", color: c.faint, marginBottom: 3 }}>Proposed change</div>
      <div style={{ background: c.panelAlt, borderRadius: 6, padding: "9px 11px", marginBottom: 9 }}>
        <div style={{ fontSize: 11, color: c.muted, marginBottom: 4 }}>{ct.diff.field}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontFamily: mono, fontSize: 12 }}>
          <span style={{ color: c.red, textDecoration: "line-through" }}>{ct.diff.before}</span>
          <span style={{ color: c.faint }}>→</span>
          <span style={{ color: c.green, fontWeight: 700 }}>{ct.diff.after}</span>
        </div>
      </div>
      <div style={{ fontSize: 11, fontFamily: mono, letterSpacing: "0.1em", textTransform: "uppercase", color: c.faint, marginBottom: 3 }}>Expected effect <span style={{ textTransform: "none", letterSpacing: 0, color: c.faint }}>· modeled, not guaranteed</span></div>
      <p style={{ fontSize: 12, color: c.body, lineHeight: 1.45, marginBottom: 12 }}>{ct.effect}</p>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>{btn("Apply & verify", applyPrepared)}{btn("Adjust first", () => setState("self"), false)}<span style={{ fontSize: 10.5, color: c.faint }}>Your call, nothing is applied until you approve.</span></div>
    </> : <>
      <div style={{ fontSize: 11.5, fontWeight: 700, color: c.ink, marginBottom: 4 }}>Here’s the change I’ve drafted, review before I apply it</div>
      <p style={{ fontSize: 12.5, color: c.body, lineHeight: 1.55, marginBottom: 10, background: c.panelAlt, borderRadius: 6, padding: "9px 11px" }}>{prep ? prep.change : "The agent has drafted the change."}</p>
      <div style={{ display: "flex", gap: 8 }}>{btn("Apply & verify", applyPrepared)}{btn("Adjust first", () => setState("self"), false)}</div>
    </>);
    return box(<>
      <p style={{ fontSize: 12.5, color: c.body, lineHeight: 1.55, marginBottom: 10 }}>{prep ? <>I recommend this change: <strong>{prep.change}</strong> Want me to show you the full change (finding, evidence, before/after, and expected effect) for your approval?</> : "I recommend a change here. Want me to prepare it for your final approval?"}</p>
      <div style={{ display: "flex", gap: 8 }}>{btn("Review the change", () => setState("review"))}{btn("I'll do it myself", () => setState("self"), false)}</div>
    </>);
  }

  // TIER 2c, advise: agent gives publisher-side demand-improvement recommendations, then monitors
  if (kind === "opportunity") {
    const genreFull = (deal.name || "").replace(/,?\s*CTV\s*$/i, "").trim() || "your inventory";
    const genre = genreFull.split(" ")[0] || "your genre";
    const v = demandVariant(genreFull, deal.floor);
    if (state === "done") return box(<div style={{ fontSize: 12.5, color: c.green, fontWeight: 600 }}>✓ Done. I’ll keep monitoring participation on your existing deal and flag you if the demand pattern shifts, or if it’s worth revisiting this test.</div>);
    if (state === "prepared") return box(<div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700, color: c.green, marginBottom: 6 }}>✓ Test package drafted</div>
      <p style={{ fontSize: 12.5, color: c.body, lineHeight: 1.5, marginBottom: 8 }}>I’ve drafted the variant as a <strong>separate</strong> package for your review, your existing deal is untouched and still active. Nothing goes live until you publish it.</p>
      <p style={{ fontSize: 12, color: c.muted, lineHeight: 1.5 }}>When you’re ready, publish the test alongside your current deal and I’ll monitor both so you can compare participation.</p>
    </div>);
    if (state === "evidence") return box(<>
      <div style={{ fontSize: 11, fontFamily: mono, letterSpacing: "0.1em", textTransform: "uppercase", color: c.faint, marginBottom: 5 }}>Demand evidence · aggregate signals</div>
      <ul style={{ margin: "0 0 10px 0", paddingLeft: 18 }}>{v.evidence.map((e, i) => <li key={i} style={{ fontSize: 12, color: i === v.evidence.length - 1 ? c.muted : c.body, lineHeight: 1.5, marginBottom: 5, fontStyle: i === v.evidence.length - 1 ? "italic" : "normal" }}>{e}</li>)}</ul>
      <div style={{ display: "flex", gap: 8 }}>{btn("Prepare test package", () => setState("prepared"))}{btn("Back", () => setState("variant"), false)}</div>
    </>);
    // default + variant view: the proposed test package table
    return box(<>
      <p style={{ fontSize: 12, color: c.body, lineHeight: 1.5, marginBottom: 9 }}>Keep your existing deal unchanged. Based on aggregate the DSP participation signals for comparable inventory, I’d test a separate package aligned to where demand is concentrating:</p>
      <div style={{ border: `1px solid ${c.line}`, borderRadius: 7, overflow: "hidden", marginBottom: 10 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.1fr 1.2fr", background: c.panelAlt, fontFamily: mono, fontSize: 9, letterSpacing: "0.06em", textTransform: "uppercase", color: c.muted }}>
          <div style={{ padding: "6px 9px" }}>Setting</div><div style={{ padding: "6px 9px" }}>Existing deal</div><div style={{ padding: "6px 9px" }}>Proposed test</div>
        </div>
        {v.rows.map(([k, ex, test], i) => (
          <div key={k} style={{ display: "grid", gridTemplateColumns: "1fr 1.1fr 1.2fr", borderTop: `1px solid ${c.lineSoft}`, fontSize: 11.5 }}>
            <div style={{ padding: "6px 9px", color: c.muted }}>{k}</div>
            <div style={{ padding: "6px 9px", color: c.body }}>{ex}</div>
            <div style={{ padding: "6px 9px", color: c.teal, fontWeight: 600 }}>{test}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{btn("Prepare test package", () => setState("prepared"))}{btn("Show demand evidence", () => setState("evidence"), false)}{btn("Keep monitoring", () => setState("done"), false)}</div>
    </>);
  }

  // TIER 2c-old, advise (unused): kept for safety
  if (kind === "advise") {
    const tips = ADVICE[result.cause] || [];
    if (state === "done") return box(<div style={{ fontSize: 12.5, color: c.green, fontWeight: 600 }}>✓ Done. I’ll monitor participation on this deal and flag you if it recovers, or if it’s worth revisiting these plays.</div>);
    if (state === "review") return box(<>
      <p style={{ fontSize: 12, color: c.body, lineHeight: 1.5, marginBottom: 8 }}>Here are the publisher-side plays I’d recommend to make this deal more compelling to demand:</p>
      <ul style={{ margin: "0 0 10px 0", paddingLeft: 18 }}>{tips.map((t, i) => <li key={i} style={{ fontSize: 12, color: c.body, lineHeight: 1.5, marginBottom: 6 }}>{t}</li>)}</ul>
      {btn("Got it, monitor from here", () => setState("done"))}
    </>);
    return box(<>
      <p style={{ fontSize: 12.5, color: c.body, lineHeight: 1.5, marginBottom: 10 }}>The fix here is making your supply more compelling to demand, not chasing individual buyers. I’ve got a few publisher-side plays that tend to lift relevance and activation. Want me to lay them out?</p>
      {btn("Show me the plays", () => setState("review"))}
    </>);
  }

  // TIER 2b, guide: agent lays out steps the publisher (or ad-ops) applies; agent can't execute
  if (kind === "guide") {
    const steps = GUIDE_STEPS[result.cause] || [];
    if (state === "done") return box(<div style={{ fontSize: 12.5, color: c.green, fontWeight: 600 }}>✓ Noted. Once you’ve published the change, re-run this diagnosis and I’ll confirm the filtered opportunities recover.</div>);
    if (state === "review") return box(<>
      <p style={{ fontSize: 12, color: c.body, lineHeight: 1.5, marginBottom: 8 }}>Here are the steps to remediate this on your side. This lives on your own web infrastructure, so I can’t apply it for you, but I’ve laid out exactly what to do:</p>
      <ol style={{ margin: "0 0 10px 0", paddingLeft: 18 }}>{steps.map((st, i) => <li key={i} style={{ fontSize: 12, color: c.body, lineHeight: 1.5, marginBottom: 5 }}>{st}</li>)}</ol>
      {btn("Got it, I’ll apply these", () => setState("done"))}
    </>);
    return box(<>
      <p style={{ fontSize: 12.5, color: c.body, lineHeight: 1.5, marginBottom: 10 }}>This one lives on your own web infrastructure (your ads.txt / app-ads.txt), so I can’t change it directly. But I’ve pinpointed the exact signal and written up the fix. Want me to show you the steps to hand to your ad-ops team?</p>
      {btn("Show me the steps", () => setState("review"))}
    </>);
  }

  // TIER 3, route (agent can't execute; opens a draft)
  if (kind === "reconcile") {
    if (state === "done") return box(<div style={{ fontSize: 12.5, color: c.green, fontWeight: 600 }}>✓ Surfaced for review.</div>);
    return box(<>
      <p style={{ fontSize: 12.5, color: c.body, lineHeight: 1.5, marginBottom: 10 }}>This is a cross-system measurement gap, spend is likely flowing, but the SSP and your ad server count it differently. It's not one side's fault to escalate; it's a reconciliation you start, with the SSP as a party to it. The agent has the variance ready to attach.</p>
      {btn("Start a reconciliation", () => setState("done"), true, c.link, "#fff")}
    </>);
  }
  if (kind === "notify" || kind === "escalate") {
    if (state === "done") return box(<div style={{ fontSize: 12.5, color: c.green, fontWeight: 600 }}>{kind === "escalate" ? "✓ Done. I’ve filed the ticket with the SSP and attached the evidence. They typically respond within 1 business day, and I’ll flag you the moment they do." : "✓ Done. I’ve surfaced this to the relevant buyers through the SSP and I’m monitoring for recovery. I’ll let you know as participation responds."}</div>);
    return box(btn(kind === "escalate" ? "File the ticket" : "Flag to buyers", () => setState("done"), true, kind === "escalate" ? c.link : c.orange, kind === "escalate" ? "#fff" : c.ink));
  }
  if (kind === "monitor") {
    if (state === "done") return box(<div style={{ fontSize: 12.5, color: c.green, fontWeight: 600 }}>✓ Done. I’ve set a monitor. I’ll re-check automatically and flag you if it doesn’t self-resolve.</div>);
    return box(btn("Set the monitor", () => setState("done")));
  }
  if (kind === "info") {
    return box(<p style={{ fontSize: 12.5, color: c.muted, lineHeight: 1.55 }}>I’d treat this as an insight for your next packaging or pricing decision rather than something to fix, the buyer’s path choice is theirs to make.</p>);
  }
  // none
  return box(<div style={{ fontSize: 12.5, color: c.green, fontWeight: 600 }}>✓ Nothing to do right now, the deal is healthy and ramping. The agent will re-check in a few days.</div>);
}

function Sect({ title, children }) {
  return <div><div style={{ fontSize: 12.5, fontWeight: 700, color: c.ink, marginBottom: 2 }}>{title}</div><p style={{ fontSize: 12.5, color: c.muted, lineHeight: 1.5 }}>{children}</p></div>;
}

function Result({ deal, onBack }) {
  const isMobile = useIsMobile();
  const result = useMemo(() => diagnose(deal.funnel, deal), [deal]);
  const [stages, setStages] = useState(result.stages);
  const breakIdx = result.breakIdx;
  const [visible, setVisible] = useState(0);
  const [scanning, setScanning] = useState(-1);
  const [done, setDone] = useState(false);
  const [expanded, setExpanded] = useState({});
  const [fixed, setFixed] = useState(false);

  // auto-run on mount (no intermediate Run page)
  useEffect(() => {
    let i = 0; setVisible(0); setScanning(-1); setDone(false); setExpanded({}); setFixed(false);
    const step = () => {
      if (i >= result.stages.length) { setScanning(-1); setDone(true); if (breakIdx >= 0) setExpanded({ [breakIdx]: true }); return; }
      setScanning(i);
      setTimeout(() => { setVisible(i + 1); setScanning(-1); i += 1; setTimeout(step, 90); }, 150);
    };
    step();
  }, [deal, result.stages.length, breakIdx]);

  // verify loop: when a fix runs, mark named checks ok AND transition the verdict
  const onFixed = (checkTitles) => {
    setStages((prev) => prev.map((s) => checkTitles.includes(s.title) ? { ...s, status: "ok", rows: [["Status", "Re-checked, now passing"]] } : s));
    setFixed(true);
  };
  // post-fix verdict (diagnose → act → verify → monitor)
  const POSTFIX = {
    "Deal status": { head: "Deal is live. Monitoring delivery.", found: "Done. I applied the correction and re-ran the affected checks, and they now pass. Your deal is active and in flight. I\u2019ll keep watching buyer participation to confirm spend starts responding, and flag you if it doesn\u2019t." },
    "Supply eligibility": { head: "Supply opened up. Monitoring delivery.", found: "Done. I applied the change and re-verified. More of your inventory now qualifies for the deal. I\u2019ll monitor whether demand picks up the added supply and let you know how it responds." },
    "Supply signals": { head: "Signal remediated. Monitoring eligibility.", found: "Done, the affected supply signal is resolved where it was yours to control, and the checks re-run clean. I\u2019ll confirm the filtered opportunities recover and keep you posted." },
    "Floor competitiveness": { head: "Floor adjusted. Monitoring clears.", found: "Done, your floor now sits where bids are landing, and I\u2019ve re-verified. I\u2019ll watch whether the bids you\u2019re already getting start clearing into wins and update you." },
    "Targeting compatibility": { head: "Package widened. Monitoring overlap.", found: "Done. I applied the packaging change and re-verified. The overlap with demand is wider now. I\u2019ll monitor whether it converts into participation and flag you either way." },
  };
  const postfix = POSTFIX[result.stage] || { head: "Change verified. Monitoring delivery.", found: "Done. I applied the change and the affected checks re-run clean. I\u2019ll keep monitoring to confirm spend responds and flag you if anything changes." };

  const card = { background: "#fff", border: `1px solid ${c.line}`, borderRadius: 8 };
  const okHeadline = result.stage === "None";
  const isOpportunity = result.action && result.action.kind === "opportunity";
  const bannerColor = (okHeadline || fixed) ? c.green : isOpportunity ? c.teal : c.red;

  return (
    <div style={{ paddingTop: 16 }}>
      <button onClick={onBack} style={{ fontSize: 13, color: c.link, marginBottom: 14, fontWeight: 500, background: "transparent", border: "none", cursor: "pointer" }}>← All deals</button>

      {/* agent identity + deal header, unified */}
      <div style={{ ...card, borderTop: `3px solid ${bannerColor}`, marginBottom: 14, overflow: "hidden" }}>
        <div style={{ padding: "10px 20px", borderBottom: `1px solid ${c.lineSoft}`, display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap", background: c.panelAlt }}>
          <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.08em", color: "#fff", background: c.orange, borderRadius: 3, padding: "2px 5px" }}>DIAGNOSTIC AGENT · BETA</span>
          <span style={{ fontSize: 11, color: c.muted }}>Finds why an SSP-to-DSP PMP deal isn't spending, and helps you fix it.</span>
        </div>
        <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 11.5, color: c.muted, fontFamily: mono }}>{deal.type} · {deal.supply} · {deal.demand} · {deal.id}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: c.ink, letterSpacing: "-0.025em", marginTop: 3 }}>{deal.name}</div>
          </div>
          <div style={{ display: "flex", gap: 28, alignItems: "center" }}>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontFamily: mono, fontSize: 26, fontWeight: 700, color: bannerColor, lineHeight: 1 }}>{deal.revPct}%</div>
              <div style={{ fontSize: 10, color: c.faint, marginTop: 3 }}>of expected revenue</div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.05fr 1fr", gap: 14, alignItems: "start" }}>
        {/* LEFT, verdict + single recommendation */}
        <div style={{ ...card, borderTop: `3px solid ${bannerColor}`, padding: "20px 22px", minHeight: 240 }}>
          {!done ? (
            <div style={{ display: "flex", alignItems: "center", gap: 9, color: c.muted, fontSize: 13, paddingTop: 8 }}><span style={{ width: 7, height: 7, borderRadius: 4, background: c.orange, animation: "none" }} /> Looking at why your spend isn’t flowing…</div>
          ) : (
            <>
              <div style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: c.faint, marginBottom: 8 }}>{fixed ? "Verified · monitoring" : okHeadline ? "Diagnosis" : isOpportunity ? "Deal healthy · demand opportunity found" : "Here's why your spend isn't flowing"}</div>
              <div style={{ fontSize: 19, fontWeight: 700, color: c.ink, lineHeight: 1.28, letterSpacing: "-0.02em", marginBottom: 4 }}>{fixed ? postfix.head : isOpportunity ? "Your deal is healthy. I found a demand opportunity." : result.headline}</div>
              <div style={{ display: "inline-block", fontSize: 10.5, fontWeight: 600, color: c.muted, background: c.panelAlt, border: `1px solid ${c.line}`, borderRadius: 20, padding: "3px 10px", marginBottom: 18 }}>{result.side}</div>

              <div style={{ marginBottom: 20, maxWidth: 280 }}>
                <ConfidenceMeter label="Confidence" level={result.root} />
              </div>

              <div style={{ fontSize: 10, fontFamily: mono, letterSpacing: "0.12em", textTransform: "uppercase", color: c.faint, marginBottom: 6, display: "flex", alignItems: "center", gap: 7 }}><span style={{ width: 5, height: 5, borderRadius: 3, background: fixed ? c.green : c.orange }} />{fixed ? "Fix verified" : "Agent"}</div>
              <p style={{ fontSize: 13.5, color: c.body, lineHeight: 1.62, whiteSpace: "pre-line" }}>{fixed ? postfix.found : result.message}</p>

              <ActionPanel result={result} deal={deal} onFixed={onFixed} />
            </>
          )}
        </div>

        {/* RIGHT, evidence funnel */}
        <div style={{ ...card, overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", borderBottom: `1px solid ${c.lineSoft}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontFamily: mono, fontSize: 9.5, letterSpacing: "0.12em", textTransform: "uppercase", color: c.muted }}>Evidence funnel</span>
            {done && <span style={{ fontFamily: mono, fontSize: 9.5, color: c.muted, fontWeight: 700 }}>{result.checksCompleted} checks completed · <span style={{ color: isOpportunity ? c.teal : result.issuesFound ? c.red : c.green }}>{isOpportunity ? "1 opportunity found" : `${result.issuesFound} issue${result.issuesFound === 1 ? "" : "s"} found`}</span></span>}
          </div>
          {stages.map((s, i) => {
            const st = !done ? (scanning === i ? "scanning" : i < visible ? "done" : "pending") : "done";
            const group = { 0: "Can the deal run?", 2: "Is supply valid & priced right?", 4: "Can buyers access & match it?", 6: "Are buyers participating?" }[i];
            return (
              <React.Fragment key={i}>
                {group && <div style={{ padding: "5px 16px", background: c.panelAlt, borderTop: i === 0 ? "none" : `1px solid ${c.lineSoft}`, borderBottom: `1px solid ${c.lineSoft}`, fontFamily: mono, fontSize: 8.5, letterSpacing: "0.1em", textTransform: "uppercase", color: c.handoff }}>{group}</div>}
                <CheckRow stage={s} index={i} state={st} isBreak={i === breakIdx} result={result} expanded={!!expanded[i]} onToggle={() => setExpanded((e) => ({ ...e, [i]: !e[i] }))} />
              </React.Fragment>
            );
          })}
          <div style={{ padding: "9px 16px", borderTop: `1px solid ${c.lineSoft}`, fontSize: 9.5, color: c.faint, fontFamily: mono }}>Benchmarks shown are illustrative synthetic demo data.</div>
        </div>
      </div>
    </div>
  );
}

function Portfolio({ deals, onOpen, onRefresh }) {
  const isMobile = useIsMobile();
  const eligible = deals.filter((d) => d.diagnosable);
  const th = { fontSize: 11.5, fontWeight: 700, color: c.body, textAlign: "left", padding: "9px 12px", whiteSpace: "nowrap" };
  const td = { padding: "11px 12px", fontSize: 12.5, color: c.body };
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "20px 0 14px" }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: c.ink, letterSpacing: "-0.02em" }}>Deals</h1>
        <button onClick={onRefresh} style={{ fontSize: 12.5, fontWeight: 600, color: c.body, background: "#fff", border: `1px solid ${c.line}`, borderRadius: 18, padding: "7px 14px" }}>↻ Refresh</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 300px", gap: 16, alignItems: "start" }}>
        {/* portfolio table */}
        <div style={{ background: "#fff", border: `1px solid ${c.line}`, borderRadius: 8, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr style={{ borderBottom: `1px solid ${c.line}` }}>
                <th style={th}>Status</th><th style={th}>Deal</th><th style={th}>Type</th><th style={th}>Integration</th><th style={th}>Supply path</th><th style={th}>Demand</th><th style={th}>Price</th><th style={{ ...th, textAlign: "right" }}>Rev vs exp</th>
              </tr></thead>
              <tbody>
                {deals.map((d) => {
                  const col = d.revPct < 30 ? c.red : d.revPct < 70 ? c.amber : c.green;
                  return (
                    <tr key={d.id} style={{ borderBottom: `1px solid ${c.lineSoft}` }}>
                      <td style={td}><StatusCell rev={d.revPct} /></td>
                      <td style={td}><div style={{ color: c.link, fontWeight: 500 }}>{d.name}</div><div style={{ fontFamily: mono, fontSize: 10.5, color: c.faint }}>{d.id}</div></td>
                      <td style={td}>{d.type}</td>
                      <td style={td}>{d.integration}</td>
                      <td style={td}>{d.supply}</td>
                      <td style={td}>{d.demand}</td>
                      <td style={td}><div>${d.floor}</div><div style={{ fontSize: 10, color: c.faint }}>{d.type === "Programmatic guaranteed" ? "Fixed CPM" : "Floor CPM"}</div></td>
                      <td style={{ ...td, textAlign: "right" }}><span style={{ fontFamily: mono, fontWeight: 700, color: col }}>{d.revPct}%</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* beta callout */}
        <div style={{ border: `1px solid ${c.orange}`, borderRadius: 10, overflow: "hidden", background: "#FFFBF4", order: isMobile ? -1 : 0 }}>
          <div style={{ background: c.teal, padding: "14px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: "#fff", letterSpacing: "-0.01em" }}>Diagnose a deal</span>
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", color: "#fff", background: c.orange, borderRadius: 4, padding: "2px 6px" }}>BETA</span>
            </div>
            <p style={{ fontSize: 12.5, color: "rgba(255,255,255,0.9)", lineHeight: 1.55, marginTop: 8, maxWidth: 720 }}>The agent analyzes your PMP deals across the full delivery funnel, determines where a deal is failing to spend, and recommends a course of action. With your approval, it can implement the recommended change on your behalf, then verify it worked.</p>
          </div>
          <div style={{ padding: "13px 14px" }}>
            <div style={{ fontSize: 11, color: c.muted, lineHeight: 1.5, marginBottom: 12 }}><span style={{ fontWeight: 700, color: c.body }}>Available today for:</span> SSP PMP deals on the primary supply path with DSP demand.</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: c.ink, marginBottom: 8 }}>{eligible.length} deal{eligible.length === 1 ? "" : "s"} eligible for diagnosis</div>
            {eligible.map((d) => (
              <button key={d.id} onClick={() => onOpen(d.id)} style={{ width: "100%", textAlign: "left", background: "#fff", border: `1px solid ${c.line}`, borderRadius: 7, padding: "9px 11px", marginBottom: 7, cursor: "pointer" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div><div style={{ fontSize: 12.5, fontWeight: 600, color: c.link }}>{d.name}</div><div style={{ fontFamily: mono, fontSize: 10, color: c.faint }}>{d.id}</div></div>
                  <div style={{ fontFamily: mono, fontSize: 13, fontWeight: 700, color: c.red }}>{d.revPct}%</div>
                </div>
                <div style={{ fontSize: 11, color: c.orangeDeep, fontWeight: 600, marginTop: 6 }}>Diagnose →</div>
              </button>
            ))}
            {eligible.length === 0 && <div style={{ fontSize: 11.5, color: c.muted }}>No eligible underperforming PMP deals right now.</div>}
          </div>
        </div>
      </div>

      <p style={{ fontFamily: mono, fontSize: 10, color: c.faint, textAlign: "center", marginTop: 16 }}>
        Diagnostic Agent Beta · scope: SSP PMP on the primary supply path and DSP demand · PG and non-primary paths shown for context, out of V1 scope · illustrative mockup · synthetic data
      </p>
    </div>
  );
}

/* ================= Architecture page ================= */
function ArchBox({ x, y, w, h, title, sub, fill, stroke, titleColor }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="8" fill={fill} stroke={stroke} strokeWidth="1.5" />
      <text x={x + w / 2} y={y + (sub ? 20 : h / 2 + 4)} textAnchor="middle" fontSize="12.5" fontWeight="700" fill={titleColor || c.ink} fontFamily={sans}>{title}</text>
      {sub && <text x={x + w / 2} y={y + 37} textAnchor="middle" fontSize="10" fill={c.muted} fontFamily={mono}>{sub}</text>}
    </g>
  );
}
function Arrow({ x1, y1, x2, y2, dashed, color }) {
  return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color || c.handoff} strokeWidth="1.5" strokeDasharray={dashed ? "4 3" : "0"} markerEnd="url(#ah)" />;
}
// numbered step badge for user-journey overlays
function StepBadge({ x, y, n, color }) {
  return (
    <g>
      <circle cx={x} cy={y} r="11" fill={color || c.link} />
      <text x={x} y={y + 3.5} textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff" fontFamily={sans}>{n}</text>
    </g>
  );
}
function Architecture() {
  const isMobile = useIsMobile();
  return (
    <div style={{ paddingTop: 22, maxWidth: 940 }}>
      <h1 style={{ fontSize: 26, fontWeight: 700, color: c.ink, letterSpacing: "-0.02em", marginBottom: 4 }}>Architecture</h1>
      <p style={{ fontSize: 13.5, color: c.muted, lineHeight: 1.6, marginBottom: 26 }}>Three views: the journey you take through this demo, how the same agent would move through the real programmatic ecosystem, and how it would connect technically over MCP. The honest part is the point, each view names which signals come from where, and where the agent can and can't see.</p>

      {/* ===== DIAGRAM 1: user journey overlaid on the demo mechanics ===== */}
      <div style={{ marginBottom: 30 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: c.ink, marginBottom: 4 }}>1 · Your journey through this demo, and what fires underneath</div>
        <p style={{ fontSize: 12.5, color: c.muted, lineHeight: 1.55, marginBottom: 10, maxWidth: 860 }}>Each thing you do in the demo maps to one synthetic component below. There's no live data and no model call, so what you see is the mechanics, not a black box.</p>
        <div style={{ border: `1px solid ${c.line}`, borderRadius: 10, background: "#fff", padding: "22px 18px 18px", overflowX: "auto" }}>
          <svg viewBox="0 0 980 210" style={{ width: "100%", minWidth: 860, height: "auto" }}>
            <defs><marker id="ahd1" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill={c.handoff} /></marker></defs>

            {/* pipeline row: real mechanics, with user-step badge + action label above each */}
            {/* 1 Cause generator */}
            <StepBadge x={40} y={44} n={1} color={c.link} />
            <text x={122} y={48} textAnchor="middle" fontSize="10" fontWeight="700" fill={c.link} fontFamily={sans}>You open a deal</text>
            <rect x={30} y={60} width={184} height={62} rx="9" fill={c.panelAlt} stroke={c.line} strokeWidth="1.4" />
            <text x={122} y={86} textAnchor="middle" fontSize="12.5" fontWeight="700" fill={c.ink} fontFamily={sans}>Cause generator</text>
            <text x={122} y={103} textAnchor="middle" fontSize="9.5" fill={c.muted} fontFamily={mono}>seeded RNG picks a cause</text>

            {/* 2 Synthetic funnel */}
            <StepBadge x={264} y={44} n={2} color={c.link} />
            <text x={346} y={48} textAnchor="middle" fontSize="10" fontWeight="700" fill={c.link} fontFamily={sans}>Agent scans</text>
            <rect x={254} y={60} width={184} height={62} rx="9" fill={c.panelAlt} stroke={c.line} strokeWidth="1.4" />
            <text x={346} y={86} textAnchor="middle" fontSize="12.5" fontWeight="700" fill={c.ink} fontFamily={sans}>Synthetic funnel</text>
            <text x={346} y={103} textAnchor="middle" fontSize="9.5" fill={c.muted} fontFamily={mono}>builds 8-stage signals</text>

            {/* 3 Rules engine */}
            <StepBadge x={488} y={44} n={3} color={c.link} />
            <text x={570} y={48} textAnchor="middle" fontSize="10" fontWeight="700" fill={c.link} fontFamily={sans}>You read the diagnosis</text>
            <rect x={478} y={60} width={184} height={62} rx="9" fill="#EAF3FB" stroke={c.link} strokeWidth="1.6" />
            <text x={570} y={86} textAnchor="middle" fontSize="12.5" fontWeight="700" fill={c.link} fontFamily={sans}>Rules engine</text>
            <text x={570} y={103} textAnchor="middle" fontSize="9.5" fill={c.muted} fontFamily={mono}>re-derives the cause</text>

            {/* pipeline arrows */}
            <line x1={214} y1={91} x2={252} y2={91} stroke={c.handoff} strokeWidth="1.5" markerEnd="url(#ahd1)" />
            <line x1={438} y1={91} x2={476} y2={91} stroke={c.handoff} strokeWidth="1.5" markerEnd="url(#ahd1)" />

            {/* branch to two outputs */}
            {/* 4 Diagnosis + advice */}
            <StepBadge x={722} y={40} n={4} color={c.amber} />
            <text x={812} y={44} textAnchor="middle" fontSize="10" fontWeight="700" fill={c.amber} fontFamily={sans}>You review + approve</text>
            <rect x={712} y={56} width={200} height={44} rx="9" fill={c.amberBg} stroke={c.amber} strokeWidth="1.5" />
            <text x={812} y={82} textAnchor="middle" fontSize="12" fontWeight="700" fill={c.amber} fontFamily={sans}>Diagnosis + advice</text>

            {/* 5 Act-verify loop */}
            <StepBadge x={722} y={128} n={5} color={c.green} />
            <text x={812} y={132} textAnchor="middle" fontSize="10" fontWeight="700" fill={c.green} fontFamily={sans}>You watch it verify</text>
            <rect x={712} y={144} width={200} height={44} rx="9" fill={c.greenBg} stroke={c.green} strokeWidth="1.5" />
            <text x={812} y={170} textAnchor="middle" fontSize="12" fontWeight="700" fill={c.green} fontFamily={sans}>Act-to-verify loop</text>

            <line x1={662} y1={85} x2={710} y2={78} stroke={c.handoff} strokeWidth="1.5" markerEnd="url(#ahd1)" />
            <line x1={662} y1={97} x2={710} y2={166} stroke={c.handoff} strokeWidth="1.5" markerEnd="url(#ahd1)" />
          </svg>
          <p style={{ fontSize: 12, color: c.muted, lineHeight: 1.55, marginTop: 10 }}>
            Deterministic and self-contained: <strong>no live data, no model call</strong>. A generator picks a cause and builds a consistent funnel; a <em>separate</em> engine reads only those numbers and re-derives the cause, so the reasoning follows the data on every refresh. That separation is deliberate, the logic can't cheat (it never sees which cause was planted) and it can't fail live (there's nothing external to break).
          </p>
        </div>
      </div>

      {/* ===== DIAGRAM 2: the agent across the ecosystem ===== */}
      <div style={{ marginBottom: 30 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: c.ink, marginBottom: 4 }}>2 · The agent across the programmatic ecosystem</div>
        <p style={{ fontSize: 12.5, color: c.muted, lineHeight: 1.55, marginBottom: 10, maxWidth: 860 }}>The real CTV PMP path runs left to right. In V1 the agent, launched from the SSP, reads only the <strong>SSP-to-DSP corridor</strong> (SSP supply and DSP demand). Its sight expands outward along the roadmap: other SSPs in <strong>V2</strong>, other DSPs in <strong>V3</strong>.</p>
        <div style={{ border: `1px solid ${c.line}`, borderRadius: 10, background: "#fff", padding: "18px", overflowX: "auto" }}>
          <svg viewBox="0 0 1200 560" style={{ width: "100%", minWidth: 1000, height: "auto" }}>
            <defs>
              <marker id="ah" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill={c.handoff} /></marker>
              <marker id="ahspend" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill={c.green} /></marker>
              <marker id="ahreq" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill={c.link} /></marker>
              <marker id="ahtel" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill={c.navy} /></marker>
            </defs>

            {/* V1 corridor band */}
            <rect x={352} y={40} width={490} height={158} rx="10" fill="#F0F7F1" stroke={c.green} strokeWidth="1.2" strokeDasharray="5 3" />
            <text x={597} y={60} textAnchor="middle" fontSize="12" fontFamily={mono} fontWeight="700" fill={c.green} letterSpacing="0.5">V1 · PRIMARY SSP-TO-DSP CORRIDOR</text>

            {/* value chain top row */}
            <ArchBox x={20} y={86} w={150} h={64} title="Advertiser" fill="#fff" stroke={c.faint} />
            <ArchBox x={186} y={86} w={150} h={64} title="Agency / trade desk" fill="#fff" stroke={c.faint} />
            {/* the DSP */}
            <rect x={352} y={74} width={222} height={116} rx="8" fill="#EEF2F6" stroke={c.navy} strokeWidth="1.5" />
            <text x={463} y={94} textAnchor="middle" fontSize="13" fontWeight="700" fill={c.navy} fontFamily={sans}>the DSP</text>
            <rect x={364} y={104} width={198} height={22} rx="4" fill="#fff" stroke={c.line} /><text x={463} y={119} textAnchor="middle" fontSize="9.5" fill={c.body} fontFamily={mono}>campaign · flight · budget · pacing</text>
            <rect x={364} y={130} width={198} height={22} rx="4" fill="#fff" stroke={c.line} /><text x={463} y={145} textAnchor="middle" fontSize="9.5" fill={c.body} fontFamily={mono}>deal targeting · creative</text>
            <rect x={364} y={156} width={198} height={22} rx="4" fill="#fff" stroke={c.line} /><text x={463} y={171} textAnchor="middle" fontSize="9.5" fill={c.body} fontFamily={mono}>bidder · bid shading</text>
            {/* the SSP */}
            <rect x={606} y={74} width={224} height={116} rx="8" fill={c.greenBg} stroke={c.green} strokeWidth="2" />
            <text x={718} y={94} textAnchor="middle" fontSize="13" fontWeight="700" fill={c.green} fontFamily={sans}>the SSP · Unified Ad Mktplace</text>
            <text x={718} y={108} textAnchor="middle" fontSize="9" fill={c.muted} fontFamily={mono}>the SSP the publisher logs into</text>
            <rect x={618} y={118} width={200} height={22} rx="4" fill="#fff" stroke={c.line} /><text x={718} y={133} textAnchor="middle" fontSize="9.5" fill={c.body} fontFamily={mono}>deal registry · propagation</text>
            <rect x={618} y={144} width={200} height={22} rx="4" fill="#fff" stroke={c.line} /><text x={718} y={159} textAnchor="middle" fontSize="9.5" fill={c.body} fontFamily={mono}>auction · floors</text>
            {/* publisher ad server + CTV, with meaningful sublabels */}
            <ArchBox x={860} y={86} w={156} h={64} title="Publisher ad server" sub="priority · final decisioning" fill="#fff" stroke={c.faint} />
            <ArchBox x={1032} y={86} w={150} h={64} title="CTV inventory" sub="app · content · opportunity" fill="#fff" stroke={c.faint} />

            {/* transaction flow: bid request (blue) + winning bid/spend (green) */}
            <text x={597} y={224} textAnchor="middle" fontSize="10.5" fontFamily={mono} fontWeight="700" fill={c.link}>&#9664; BID REQUEST (impression available &#8594; out to demand)</text>
            <line x1={1032} y1={214} x2={30} y2={214} stroke={c.link} strokeWidth="1.4" strokeDasharray="2 3" markerEnd="url(#ahreq)" opacity="0.55" />
            <text x={597} y={248} textAnchor="middle" fontSize="10.5" fontFamily={mono} fontWeight="700" fill={c.green}>WINNING BID · CREATIVE · SPEND (back to publisher) &#9654;</text>
            <line x1={30} y1={238} x2={1170} y2={238} stroke={c.green} strokeWidth="1.6" markerEnd="url(#ahspend)" />

            {/* parallel supply paths, branching from publisher ad-server side */}
            <text x={946} y={300} textAnchor="middle" fontSize="9.5" fontFamily={mono} fontWeight="700" fill={c.muted}>parallel publisher supply paths</text>
            <rect x={860} y={312} width={200} height={40} rx="7" fill="#fff" stroke={c.amber} strokeWidth="1.3" strokeDasharray="4 3" />
            <text x={960} y={330} textAnchor="middle" fontSize="10.5" fontWeight="700" fill={c.amber} fontFamily={sans}>Other SSPs · Magnite, Index</text>
            <text x={960} y={344} textAnchor="middle" fontSize="8.5" fill={c.muted} fontFamily={mono}>publisher uses today · visible in V2</text>
            {/* branch line from ad server down to SSP box, NO arrowhead into agent */}
            <line x1={938} y1={150} x2={938} y2={312} stroke={c.amber} strokeWidth="1.2" strokeDasharray="3 3" opacity="0.7" />

            {/* the agent */}
            <rect x={352} y={358} width={478} height={64} rx="10" fill="#EAF3FB" stroke={c.link} strokeWidth="1.8" />
            <text x={591} y={384} textAnchor="middle" fontSize="15" fontWeight="700" fill={c.link} fontFamily={sans}>Deals Diagnostic Agent</text>
            <text x={591} y={403} textAnchor="middle" fontSize="10" fill={c.muted} fontFamily={mono}>localize → recommend → authorize → act → verify</text>

            {/* telemetry arrows (navy, solid): the SSP + the DSP both read */}
            <line x1={520} y1={358} x2={470} y2={192} stroke={c.navy} strokeWidth="1.6" markerEnd="url(#ahtel)" />
            <text x={356} y={300} fontSize="9" fill={c.navy} fontFamily={mono}>reads demand signals</text>
            <line x1={662} y1={358} x2={712} y2={192} stroke={c.navy} strokeWidth="1.6" markerEnd="url(#ahtel)" />
            <text x={724} y={300} fontSize="9" fill={c.navy} fontFamily={mono}>reads supply + auction telemetry</text>

            {/* user invocation (gray) */}
            <ArchBox x={470} y={460} w={242} h={46} title="Publisher opens diagnosis" sub="from the SSP reporting, on a weak deal" fill={c.panelAlt} stroke={c.handoff} />
            <line x1={591} y1={460} x2={591} y2={424} stroke={c.handoff} strokeWidth="1.5" markerEnd="url(#ah)" />
            <text x={604} y={444} fontSize="9" fill={c.handoff} fontFamily={mono}>publisher opens diagnosis</text>

            {/* blind zone: other DSPs, NO arrowhead, stop marker */}
            <rect x={40} y={358} width={210} height={46} rx="8" fill="#fff" stroke={c.red} strokeWidth="1.3" strokeDasharray="4 3" />
            <text x={145} y={378} textAnchor="middle" fontSize="10.5" fontWeight="700" fill={c.red} fontFamily={sans}>Other DSPs · TTD, DV360</text>
            <text x={145} y={393} textAnchor="middle" fontSize="8.5" fill={c.muted} fontFamily={mono}>buyer telemetry unavailable · V3</text>
            {/* boundary line with stop bar, not arrow */}
            <line x1={352} y1={381} x2={258} y2={381} stroke={c.red} strokeWidth="1.3" strokeDasharray="4 3" />
            <line x1={258} y1={373} x2={258} y2={389} stroke={c.red} strokeWidth="2" />
            <text x={305} y={370} textAnchor="middle" fontSize="8" fill={c.red} fontFamily={mono}>no telemetry in V1</text>

            <text x={597} y={534} textAnchor="middle" fontSize="10.5" fill={c.muted} fontFamily={sans} fontStyle="italic">Visibility expands from the core SSP and DSP platforms to publisher-authorized supply integrations, then to third-party demand integrations.</text>
          </svg>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 14, marginTop: 14 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: c.green, marginBottom: 3 }}>V1 · the corridor (today)</div>
              <p style={{ fontSize: 11, color: c.muted, lineHeight: 1.5 }}>In V1 the agent reads the primary SSP on the supply side and the DSP on the demand side, so deal state, floors, activation, participation and auction outcomes are all visible. That shared sight across the sell/buy boundary is why one agent can localize a break to either side.</p>
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: c.amber, marginBottom: 3 }}>V2 · other SSPs</div>
              <p style={{ fontSize: 11, color: c.muted, lineHeight: 1.5 }}>The publisher already runs Magnite, Index and others in parallel, the agent just can't see them yet. With publisher-authorized SSP reads, the same diagnosis extends across the full sell side while demand stays on the primary DSP.</p>
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: c.red, marginBottom: 3 }}>V3 · other DSPs</div>
              <p style={{ fontSize: 11, color: c.muted, lineHeight: 1.5 }}>Past the DSP, the buyer's "why" lives inside another DSP the SSP can't read, often not a recorded field anywhere. The agent names that boundary rather than guessing; crossing it (agent-to-agent interop) is the V3 question.</p>
            </div>
          </div>
        </div>
      </div>

      {/* ===== DIAGRAM 3: agent runtime as a swimlane flow ===== */}
      <div>
        <div style={{ fontSize: 15, fontWeight: 700, color: c.ink, marginBottom: 4 }}>3 &middot; What the agent does at runtime, and where the model sits</div>
        <p style={{ fontSize: 12.5, color: c.muted, lineHeight: 1.55, marginBottom: 12, maxWidth: 880 }}>The production runtime as a single flow, read left to right. Each numbered step runs in one layer: the publisher&rsquo;s SSP surface, the agent itself, the ad platforms reached over MCP, or an offline eval harness. The numbered notes below explain, in full, what happens at each step and why it sits where it does.</p>
        <div style={{ border: `1px solid ${c.line}`, borderRadius: 10, background: "#fff", padding: "18px 18px 20px", overflowX: "auto" }}>
          <svg viewBox="0 0 1180 460" style={{ width: "100%", minWidth: 1000, height: "auto" }}>
            <defs>
              <marker id="ahsw" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill={c.handoff} /></marker>
            </defs>
            {[
              { y: 66, label: "PUBLISHER" },
              { y: 176, label: "AGENT" },
              { y: 300, label: "PLATFORMS (MCP)" },
              { y: 410, label: "OFFLINE" },
            ].map((lane, i) => (
              <g key={i}>
                <text x={16} y={lane.y + 4} fontSize="10" fontWeight="700" fill={c.faint} fontFamily={mono} letterSpacing="0.5">{lane.label}</text>
                {i > 0 && <line x1={130} y1={lane.y - 50} x2={1170} y2={lane.y - 50} stroke={c.lineSoft} strokeWidth="1" />}
              </g>
            ))}
            {[
              [1, "Flag the deal", "the SSP revenue pace", 150, 36, "#EAF1FA", c.link, c.link],
              [2, "Load the script", "diagnostic taxonomy", 340, 146, "#EAF3FB", c.link, c.link],
              [3, "Gather telemetry", "read-only tool calls", 530, 270, c.greenBg, c.green, c.green],
              [4, "Localize the break", "model reasons", 720, 146, "#EAF3FB", c.link, c.link],
              [5, "Recommend + authorize", "publisher approves", 720, 36, c.amberBg, c.amber, c.amber],
              [6, "Act via tools", "scoped write calls", 910, 270, c.greenBg, c.green, c.green],
              [7, "Verify + monitor", "re-read, confirm", 910, 146, "#E9F3F2", c.teal, c.teal],
              [8, "Eval gate", "before unattended", 530, 380, "#FFF9EE", c.orange, c.orangeDeep],
            ].map(([n, title, sub, x, y, fill, stroke, badge]) => (
              <g key={n}>
                <rect x={x} y={y} width={152} height={60} rx="9" fill={fill} stroke={stroke} strokeWidth="1.5" />
                <circle cx={x + 17} cy={y - 1} r="11" fill={badge} /><text x={x + 17} y={y + 2.5} textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff" fontFamily={sans}>{n}</text>
                <text x={x + 82} y={y + 25} textAnchor="middle" fontSize="11.5" fontWeight="700" fill={c.ink} fontFamily={sans}>{title}</text>
                <text x={x + 78} y={y + 43} textAnchor="middle" fontSize="8.5" fill={c.muted} fontFamily={mono}>{sub}</text>
              </g>
            ))}
            <path d="M226,96 L226,146" fill="none" stroke={c.handoff} strokeWidth="1.5" markerEnd="url(#ahsw)" />
            <path d="M340,176 L378,176" fill="none" stroke={c.handoff} strokeWidth="1.5" markerEnd="url(#ahsw)" />
            <path d="M492,176 L606,270" fill="none" stroke={c.handoff} strokeWidth="1.5" markerEnd="url(#ahsw)" />
            <path d="M682,270 L796,208" fill="none" stroke={c.handoff} strokeWidth="1.5" markerEnd="url(#ahsw)" />
            <path d="M796,146 L796,98" fill="none" stroke={c.handoff} strokeWidth="1.5" markerEnd="url(#ahsw)" />
            <path d="M872,86 L986,146" fill="none" stroke={c.handoff} strokeWidth="1.5" markerEnd="url(#ahsw)" />
            <path d="M986,146 L986,270" fill="none" stroke={c.handoff} strokeWidth="1.5" markerEnd="url(#ahsw)" />
            <path d="M986,270 L986,208" fill="none" stroke={c.handoff} strokeWidth="1.5" markerEnd="url(#ahsw)" />
            <path d="M606,380 L800,210" fill="none" stroke={c.orange} strokeWidth="1.2" strokeDasharray="4 3" opacity="0.7" />
            <text x={700} y={330} fontSize="8.5" fill={c.orangeDeep} fontFamily={mono}>gates step 6</text>
            <text x={660} y={352} textAnchor="middle" fontSize="8.5" fill={c.muted} fontFamily={mono} fontStyle="italic">the SSP + the DSP exposed as MCP servers &middot; every call scoped by publisher OAuth</text>
          </svg>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "14px 40px", marginTop: 18 }}>
            {[
              ["Flag the deal", "The agent watches the publisher\u2019s SSP reporting for PMP deals whose revenue is running behind the projected or comparable pace. That pace gap is the only thing that starts the flow; a deal spending on track is never diagnosed. Flagging happens on the publisher\u2019s own SSP surface, so it needs no permission beyond the reporting the publisher already sees."],
              ["Load the diagnostic script", "Before touching any data, the agent loads the fixed diagnostic taxonomy: the eight-stage funnel and the specific causes that can break a deal at each stage. This taxonomy is the agent\u2019s scope. It constrains what the agent looks for and what it is allowed to conclude, so the reasoning later is a matter of matching structured signals to a known list rather than open-ended speculation."],
              ["Gather telemetry across the ecosystem", "The agent walks the funnel stage by stage, pulling the telemetry each check needs through read-only MCP tool calls: deal state, floors, and auction outcomes from the SSP, plus availability and participation from the DSP. In V1 this is the SSP-to-DSP corridor only. In V2 and V3 the same step calls SSP and other-DSP agents to request and exchange the signals those platforms hold."],
              ["Localize the break (the model)", "This is the one step where a model does real work. It reads the assembled, structured signals and localizes the failure to a single stage and cause, then drafts the specific change. Because the taxonomy is fixed and the inputs are structured, that reasoning is bounded, so a small and inexpensive tool-use model is the right default. The system escalates to a larger model only for genuinely ambiguous cases where several signals conflict."],
              ["Recommend and authorize", "The agent turns the localized cause into a concrete recommendation and presents it to the publisher as a structured contract: the finding, the evidence behind it, the exact before-and-after change, and the modeled effect. Nothing is applied at this point. The publisher is the authorization gate, and for anything that writes to a deal, an explicit approval is required before the agent proceeds."],
              ["Act via scoped tool calls", "Once approved, the agent applies the change through a scoped write tool, whether that is lowering a floor, broadening eligibility, repackaging inventory, or filing a propagation ticket with the SSP. Its power is exactly the set of tools it has been granted under the publisher\u2019s OAuth scopes. Anything outside that set, such as writing to the publisher\u2019s own ads.txt, remains a recommendation the agent cannot execute itself."],
              ["Verify and monitor", "Immediately after acting, the agent re-reads the affected checks to confirm they now pass, and reports the new values back to the publisher. It then keeps watching the deal over the following hours to confirm that spend actually responds, rather than assuming the fix worked. Diagnose, act, and verify are a single loop, and that loop does not close until the metric has moved."],
              ["Eval gate (before unattended action)", "None of this is trusted blindly. Offline, a labeled set of deals with a known planted cause runs against the same logic and asserts that the agent localizes to the correct stage; this is exactly the harness that validates the prototype today. Online, an applied fix is checked against whether it actually moved the deal. The agent is only allowed to act unattended once it clears that accuracy bar, and it stays behind human approval until it does."],
            ].map(([title, body], i) => (
              <div key={i} style={{ display: "flex", gap: 10 }}>
                <div style={{ flexShrink: 0, width: 22, height: 22, borderRadius: 11, background: c.link, color: "#fff", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: sans }}>{i + 1}</div>
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: c.ink, marginBottom: 2 }}>{title}</div>
                  <p style={{ fontSize: 11.5, color: c.muted, lineHeight: 1.5 }}>{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}


/* ================= Background & context page ================= */
function Background() {
  const sections = [
    { h: "The customer problem", body: [
      "PMP deals are often created but never reach meaningful scale. A November 2025 AdExchanger article reported that only about 1 in 10 deal IDs achieve meaningful scale, and that PubMatic described troubleshooting a single PMP as taking days or even weeks to achieve liftoff.",
      "It's an industry-wide pattern: a publisher can see that a deal isn't spending, but the root cause may sit anywhere across deal setup, supply eligibility, supply signals, pricing, deal availability, targeting, or demand participation, and finding it is slow, manual work.",
    ] },
    { h: "What I built", body: [
      "I created a working prototype of a PMP Deal Diagnostic Agent for publishers, aimed squarely at getting deals on the SSP to scale faster. It evaluates a deal across the programmatic funnel, pinpoints where it's underdelivering, explains the issue in publisher-friendly language, recommends the publisher's next action, and, where the lever is publisher-controlled, prepares that action for approval and verifies it worked.",
    ] },
    { h: "How I'd measure MVP success", groups: [
      { label: "North star", items: ["% of total PMP deals that reach scale, per advertiser"] },
      { label: "Secondary", items: [
        "Total PMP revenue",
        "Time to PMP issue diagnosis",
        "Time from issue appearing to resolution",
        "Total the SSP revenue",
      ] },
      { label: "Guardrails", items: [
        "Total O&O CTV revenue (cannibalization check, if the platform runs its own supply)",
        "Total token cost",
      ] },
    ] },
    { h: "A note on the prototype", body: [
      "This is a self-directed portfolio prototype. The UI, data, benchmarks, telemetry, and product mechanics shown here are illustrative and synthetic, built from public information and my experience in adjacent programmatic systems. It is not modeled on any specific vendor's product, and the mechanics may not match how a given SSP works in reality.",
      "This is therefore an outsider's product hypothesis, not a claim about how any specific SSP currently works or what any platform should already be building. The intent is to make my thinking tangible: how I see the publisher problem, how I would scope an agentic V1, and how I would move from diagnosis to action.",
    ] },
  ];
  return (
    <div style={{ paddingTop: 22, maxWidth: 820 }}>
      <h1 style={{ fontSize: 26, fontWeight: 700, color: c.ink, letterSpacing: "-0.02em", marginBottom: 6 }}>AdTech Programmatic Deal Diagnostic Agent</h1>
      <p style={{ fontSize: 13, color: c.muted, lineHeight: 1.6, marginBottom: 22 }}>Background and context for the prototype: the problem it targets, what it does, how I would sequence it, and the honest limits of an outsider's hypothesis.</p>
      {sections.map((s, i) => (
        <div key={i} style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: c.orangeDeep, textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: mono, marginBottom: 8 }}>{s.h}</div>
          {s.body && s.body.map((para, pi) => (
            <p key={pi} style={{ fontSize: 13.5, color: c.body, lineHeight: 1.65, marginBottom: pi === s.body.length - 1 ? 0 : 12 }}>{para}</p>
          ))}
          {s.groups && s.groups.map((g, gi) => (
            <div key={gi} style={{ marginBottom: gi === s.groups.length - 1 ? 0 : 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: c.ink, marginBottom: 5 }}>{g.label}</div>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {g.items.map((it, ii) => (
                  <li key={ii} style={{ fontSize: 13.5, color: c.body, lineHeight: 1.6, marginBottom: 3 }}>{it}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/* ================= Failure Taxonomy reference page ================= */
function Taxonomy() {
  const kindLabel = { prepare: "Agent prepares", guide: "Agent guides", escalate: "Agent files ticket", opportunity: "Demand opportunity", monitor: "Agent monitors", fix: "Agent fixes", info: "Insight", none: "No action" };
  const kindColor = { prepare: c.link, guide: c.handoff, escalate: c.red, opportunity: c.teal, monitor: c.handoff, fix: c.orange, info: c.muted, none: c.green };
  const confWord = { high: "High", med: "Med", low: "Low" };
  const stages = ["Deal status", "Supply eligibility", "Supply signals", "Floor competitiveness", "Deal availability", "Targeting compatibility", "Buyer participation", "Portfolio demand health"];
  return (
    <div style={{ paddingTop: 22, maxWidth: 1000 }}>
      <h1 style={{ fontSize: 26, fontWeight: 700, color: c.ink, letterSpacing: "-0.02em", marginBottom: 4 }}>Failure taxonomy</h1>
      <p style={{ fontSize: 13.5, color: c.muted, lineHeight: 1.6, marginBottom: 8, maxWidth: 780 }}>
        The full set of PMP failure modes the agent draws from. The engine localizes the <em>stage</em> from the funnel data, then resolves the specific cause, and where two causes at a stage aren't distinguishable from the sell side, it says so and holds confidence lower rather than overclaiming.
      </p>
      <p style={{ fontSize: 12, color: c.muted, lineHeight: 1.6, marginBottom: 8, maxWidth: 820 }}>
        Each cause carries the action the agent takes, scoped to what it can honestly do. <strong>Prepares</strong>: drafts a change to your deal for your approval, then applies and verifies it. <strong>Guides</strong>: identifies the fix but can't apply it, because it lives on your own web infrastructure. <strong>Files ticket</strong>: routes an SSP-internal propagation issue to SSP support. <strong>Demand opportunity</strong>: the deal is healthy, so it proposes a separate test package rather than changing anything. <strong>Monitors</strong>: watches a portfolio-wide demand pattern instead of touching a healthy deal.
      </p>
      <div style={{ border: `1px solid ${c.line}`, borderLeft: `3px solid ${c.orange}`, borderRadius: 8, background: c.panelAlt, padding: "10px 14px", marginBottom: 18, fontSize: 11.5, color: c.muted, lineHeight: 1.5, maxWidth: 780 }}>
        All failure modes, thresholds, and benchmarks are illustrative and synthetic, reconstructed from public information, not sourced platform data. In production, the hard work is calibrating these thresholds and constructing real benchmarks; that's where data science comes in.
      </div>
      {stages.map((stg) => {
        const rows = TAX.filter((t) => t.stage === stg && !t.defer);
        if (!rows.length) return null;
        return (
          <div key={stg} style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: c.teal, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8, fontFamily: mono }}>{stg}</div>
            <div style={{ border: `1px solid ${c.line}`, borderRadius: 8, overflow: "hidden", background: "#fff" }}>
              {rows.map((t, i) => (
                <div key={t.id} style={{ borderTop: i === 0 ? "none" : `1px solid ${c.lineSoft}`, padding: "11px 14px" }}>
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: c.ink }}>{t.label}</div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span style={{ fontSize: 10.5, color: c.muted, fontFamily: mono }}>{t.owner} · {confWord[t.loc]}/{confWord[t.root]}</span>
                      <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "#fff", background: kindColor[t.kind], borderRadius: 4, padding: "2px 6px" }}>{kindLabel[t.kind]}</span>
                    </div>
                  </div>
                  <p style={{ fontSize: 12, color: c.muted, lineHeight: 1.5, marginTop: 4 }}><span style={{ color: c.body, fontWeight: 600 }}>What the SSP looks for: </span>{t.look}</p>
                  <p style={{ fontSize: 12, color: c.muted, lineHeight: 1.5, marginTop: 3 }}><span style={{ color: c.body, fontWeight: 600 }}>Action: </span>{t.action}</p>
                  {t.alts && <p style={{ fontSize: 11, color: c.faint, lineHeight: 1.4, marginTop: 3, fontStyle: "italic" }}>Not cleanly distinguishable from: {t.alts.join("; ")}.</p>}
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {(() => {
        return (
          <div style={{ marginTop: 30, marginBottom: 20 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: c.red, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4, fontFamily: mono }}>Known failure modes deliberately out of V1 scope</div>
            <p style={{ fontSize: 12, color: c.muted, lineHeight: 1.55, marginBottom: 12, maxWidth: 800 }}>The programmatic funnel can break in many more ways than the eight V1 diagnoses above. The modes below are real, but each one either sits below the altitude a publisher acts on, infers something not observable from the sell side, or lives in a system the SSP doesn't operate. V1 deliberately excludes them and says why. Showing the full surface is the point: the agent knows what it isn't diagnosing, and the scope expands outward (V1 → V2 → V3) as visibility and authorization allow.</p>
            <div style={{ display: "grid", gap: 12 }}>
              {OUT_OF_SCOPE.map((grp, gi) => (
                <div key={gi} style={{ border: `1px dashed ${c.faint}`, borderRadius: 8, background: "#fff", padding: "12px 14px" }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: c.body, marginBottom: 3 }}>{grp.group}</div>
                  <p style={{ fontSize: 11.5, color: c.muted, lineHeight: 1.5, marginBottom: 8 }}>{grp.why}</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {grp.items.map((it, ii) => (
                      <span key={ii} style={{ fontSize: 11, color: c.muted, background: c.panelAlt, border: `1px solid ${c.line}`, borderRadius: 4, padding: "3px 8px" }}>{it}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function DemoGuide({ onBackground }) {
  const isMobile = useIsMobile();
  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: isMobile ? "16px 14px 0" : "20px 22px 0" }}>
      <div style={{ borderRadius: 12, background: c.teal, padding: isMobile ? "20px 18px" : "26px 30px", color: "#fff" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: c.orange, textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: mono, marginBottom: 8 }}>Demo Guide</div>
        <div style={{ fontSize: 23, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.25, marginBottom: 10, maxWidth: 820 }}>PMP issues can take weeks to resolve. This demo presents an agent concept that provides insights and improves resolution time.</div>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.85)", lineHeight: 1.6, marginBottom: 20, maxWidth: 820 }}>Instructions for using the demo are below. Please read the <button onClick={onBackground} style={{ color: c.orange, fontWeight: 700, background: "transparent", border: "none", padding: 0, cursor: "pointer", fontSize: 13 }}>Background &amp; context</button> for the full problem statement and solution context.</p>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "14px 40px", maxWidth: 900 }}>
          {[
            "Select which publisher you want to represent, using the Publisher menu in the orange bar.",
            "Select a flagged PMP deal that is underperforming from the panel on the right.",
            "The agent identifies a cause for the underperformance and walks its evidence across the delivery funnel.",
            "Determine whether you want the agent to prepare and apply the recommended change, or handle it yourself.",
            "Click Refresh to generate a new flagged PMP deal, giving the agent a different underperformance to diagnose and resolve.",
          ].map((step, i) => (
            <div key={i} style={{ display: "flex", gap: 11 }}>
              <div style={{ flexShrink: 0, width: 24, height: 24, borderRadius: 12, background: c.orange, color: "#fff", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: sans }}>{i + 1}</div>
              <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.92)", lineHeight: 1.5, paddingTop: 2 }}>{step}</p>
            </div>
          ))}
        </div>
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.15)", marginTop: 22, paddingTop: 16, maxWidth: 900 }}>
          <p style={{ margin: 0, fontSize: 11.5, color: "rgba(255,255,255,0.72)", lineHeight: 1.6 }}>I built this demo using publicly available information and past experience in the programmatic landscape. I do not have access to the SSP' product or its roadmap, so the ideas shown here are illustrative, meant to present a neutral third party's perspective and a live example of my working style. This is a front-end demo using synthetic data.</p>
        </div>
      </div>
    </div>
  );
}

export default function AdTechDealDiagnostic() {
  const isMobile = useIsMobile();
  const [pub, setPub] = useState("fandom");
  const [seed, setSeed] = useState(1);
  const [openId, setOpenId] = useState(null);
  const [view, setView] = useState("deals"); // deals | architecture | background | taxonomy
  const deals = useMemo(() => generatePortfolio(pub, seed * 7919 + pub.length * 104729), [pub, seed]);
  const deal = openId ? deals.find((d) => d.id === openId) : null;
  useEffect(() => { setOpenId(null); }, [pub, seed]);
  const effectiveView = deal ? "deal" : view;

  return (
    <div style={{ minHeight: "100vh", background: "#fff", fontFamily: sans }}>
      {effectiveView === "deals" && <DemoGuide onBackground={() => { setView("background"); setOpenId(null); }} />}
      <Ribbon view={effectiveView} setView={(v) => { setView(v); setOpenId(null); }} />
      <Masthead />
      <NavBar pub={pub} setPub={setPub} view={effectiveView} setView={(v) => { setView(v); setOpenId(null); }} />
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: isMobile ? "0 14px 40px" : "0 22px 40px" }}>
        {deal ? <Result deal={deal} onBack={() => setOpenId(null)} />
          : view === "architecture" ? <Architecture />
          : view === "background" ? <Background />
          : view === "taxonomy" ? <Taxonomy />
          : <Portfolio deals={deals} onOpen={setOpenId} onRefresh={() => setSeed((s) => s + 1)} />}
      </div>
    </div>
  );
}
