---
target: the dashboard (trail list page)
total_score: 16
p0_count: 1
p1_count: 3
timestamp: 2026-07-19T12-49-15Z
slug: src-pages-mountains-tsx
---
Method: dual-agent (A: acadad2b418b01349 · B: a0a4ae38a37219f0c)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2/4 | Mobile nav highlights "My Trails" while user is actually on the Explore/list page; icon-font FOUC shows raw words before Material Symbols loads |
| 2 | Match Between System / Real World | 1/4 | Hero copy promises "real-time biodiversity metrics, soil health tracking, canopy coverage reports" — none exist anywhere in the app; "Map View" nav label for a page with no map; distance/time values have no units |
| 3 | User Control and Freedom | 2/4 | Search clear button works well, but Dashboard/Plans/Analytics/Profile are all dead `href="#"` |
| 4 | Consistency and Standards | 2/4 | Confirmed: trail cards and search input get a custom green focus ring; navbar links fall back to native black browser outline — two different focus vocabularies on one page |
| 5 | Error Prevention | 2/4 | No destructive actions present, but fetch failures are swallowed silently |
| 6 | Recognition Rather Than Recall | 2/4 | Stat labels are clear, but difficulty (Easy/Hard) has no color/icon coding — text-only, re-read every time |
| 7 | Flexibility and Efficiency of Use | 1/4 | No filters, sort, or favoriting despite copy implying "ecosystem type" search and a "My Trails" destination |
| 8 | Aesthetic and Minimalist Design | 3/4 | Strongest area: clean type scale, restrained Material 3 palette, good whitespace — undercut by redundant stat-block scaffolding |
| 9 | Error Recovery | 1/4 | "Backend down" and "zero search results" render identically; no retry affordance |
| 10 | Help and Documentation | 0/4 | No onboarding, tooltips, or explanation of jargon like "biophilic analysis" |
| **Total** | | **16/40** | **Poor (12-19) — significant improvements needed** |

## Anti-Patterns Verdict

**LLM assessment (partial slop):** Not a template dump — real hand-tuned Material 3 color tokens, a working debounce, reduced-motion handling, and a genuine empty state are present. But real tells: every card repeats an identical two-stat scaffold (`TOTAL HIKERS` / `DIFFICULTY`) with all three cards showing the same placeholder-looking `100` hikers; the hero's "real-time biodiversity/soil/canopy" copy is aspirational copy nobody wired to actual content; and the bottom nav promises a whole app (My Trails / Analytics / Profile) that doesn't exist behind three of its four tabs.

**Deterministic scan:** `detect.mjs --json src` returned `[]` (clean, exit 0) — but Assessment B traced this to the detector's own source and found it's a **structurally weak signal here**, not a real "passes" verdict: for `.tsx` files the tool only runs line-level regex matchers (side-borders, gradient-text, gray-on-color, etc.); its page-level analyzers (flat-type-hierarchy, monotonous-spacing, marketing-buzzword, numbered-section-markers...) are gated to `.html/.astro/.vue/.svelte` and structurally never fire on `.tsx`. URL-mode scanning (which the tool itself recommended) requires the full `puppeteer` package, not installed. So: no reliable automated overlay evidence exists for this run — treat the clean scan as "inapplicable," not "passed."

**Real evidence B did gather** (via computed styles + real Tab-key traversal, not static analysis): one confirmed WCAG contrast failure and confirmed sub-44px touch targets across the entire mobile nav — see Priority Issues.

## Overall Impression

The page's craft foundation is genuinely good — restrained Material 3 palette, real micro-interaction work (hover/active/focus states, staggered entrance, reduced-motion handling), a well-written empty state. But it's a "designed shell around content that isn't there yet": the emotional pitch (biophilic ecosystem analysis) is stronger than anything the product actually delivers, the bottom nav advertises three destinations that don't exist, and on mobile the nav itself physically covers part of the last card. The biggest opportunity is closing the gap between what the copy promises and what a tap actually produces — right now first-time users get burned within one click.

## What's Working

- **Micro-interaction craft**: `hover:shadow-lg`, `active:scale-[0.98]`, `focus-visible:ring-2` on trail cards, plus the staggered `trail-card-enter` animation with a `prefers-reduced-motion` fallback in `src/index.css` — considered, not default.
- **Empty state**: `No trails match "…"` with a working, well-copy'd "Clear search" action — a real empty state that teaches, not a "nothing here."
- **Color system**: a genuine Material 3 token set in `tailwind.config.js`, not ad-hoc hex values — confirmed contrast on primary text pairs runs 4.26–11.54:1, well above AA.

## Priority Issues

**[P0] Mobile bottom nav occludes page content.** The bottom nav is `fixed bottom-0` and removed from document flow, but `<main>` (`src/pages/Mountains.tsx`) only has `py-lg` (48px) of its own bottom padding — nothing compensates for the ~72-80px nav height. On mobile, scrolling to the end of the grid leaves the last card's bottom edge (its difficulty value) covered by the nav with no way to see it.
*Why it matters:* silently hides real content (a stat value) behind a decorative bar — a genuine content-blocking bug on the primary mobile experience, not a cosmetic nit.
*Fix:* add bottom padding to `<main>` sized to the nav's real height (e.g. `pb-24 md:pb-0`) or `env(safe-area-inset-bottom)`-aware spacing.
*Suggested command:* `/impeccable harden`

**[P1] Mobile touch targets measured under the 44px minimum, across the board.** Confirmed by direct measurement: all four bottom-nav items came in at ~40px height (Explore 47.8×40, My Trails 95.7×43.2, Analytics 59.8×40, Profile 41.9×40); the search input's clear (×) button measured 24×24px — the smallest tappable target on the page.
*Why it matters:* below Apple/Google's 44×44pt guidance, this reliably produces mis-taps on a touch device, especially for anyone with reduced dexterity.
*Fix:* pad every tappable target to a real 44×44px hit area (visual size can stay smaller via padding).
*Suggested command:* `/impeccable adapt`

**[P1] Copy promises features the product doesn't have.** The hero claims "real-time biodiversity metrics, soil health tracking, and canopy coverage reports"; neither the list page nor the detail page (`/trail/1-3`) shows anything of the kind — the detail page only adds four numeric stat tiles (Difficulty/Distance/Estimated Time/Total Hikers), with no units on Distance or Estimated Time.
*Why it matters:* this is the very first thing a new user reads; the very next click (into any trail) disproves it, breaking trust before the product has done anything else.
*Fix:* either build a minimal version of the promised metrics, or rewrite the hero to describe what the product actually does today.
*Suggested command:* `/impeccable clarify`

**[P1] Broken navigation semantics.** The mobile "My Trails" pill renders as the active/selected tab while the user is actually on the Explore/list page (`src/pages/Mountains.tsx`); "Dashboard," "Plans," "Analytics," and "Profile" are all dead `href="#"` links across desktop and mobile nav.
*Why it matters:* wrong active-state indicators actively mislead users about where they are; dead links teach users to stop trusting the nav bar at all.
*Fix:* either wire these to real routes or remove/gray them out with a "coming soon" treatment until they exist.
*Suggested command:* `/impeccable harden`

**[P2] Confirmed WCAG contrast failure on stat-pill labels.** Measured via computed styles (not estimated): the "TOTAL HIKERS" / "DIFFICULTY" labels (`src/pages/Mountains.tsx` — the `text-outline uppercase tracking-wider` spans) render `rgb(114,121,110)` on `rgb(244,244,240)` at 12px/600 weight, a **4.07:1** contrast ratio against the required **4.5:1** for small text.
*Why it matters:* fails WCAG AA for a low-vision user reading the exact numbers (hiker count, difficulty) the card exists to communicate.
*Fix:* darken the label color slightly (toward `on-surface`/ink) or bump size/weight to qualify as "large text" (≥14px bold or ≥18px).
*Suggested command:* `/impeccable audit`

## Persona Red Flags

**Jordan (first-timer):** Clicks "Dashboard" or "Plans" expecting real destinations — gets nothing. Reads "real-time biodiversity metrics" in the hero, clicks into a trail expecting it, finds only four plain numbers instead — trust broken on the very first interaction, before Jordan has done anything else in the product.

**Sam (accessibility-dependent):** Tabbing from the logo produces a plain native black focus rectangle, then jumps to a custom green ring on cards and the search input — two different focus vocabularies for a keyboard user to parse. The "TOTAL HIKERS"/"DIFFICULTY" labels measure a confirmed 4.07:1 contrast, just under the 4.5:1 AA floor for the exact data Sam is trying to read.

**Casey (mobile):** The fixed bottom nav has no compensating padding under it, so the bottom of the last trail card is plausibly clipped at full scroll (P0 above) — a content-blocking bug on Casey's primary device. Every nav icon and the search-clear button measure under the 44px tap-target minimum, which on a one-handed, thumb-only, distracted use pattern means real mis-taps.

## Minor Observations

- Icon-font FOUC: on first paint, "search," "notifications," and "account_circle" render as raw words before Material Symbols loads (confirmed via screenshot ~80ms after DOMContentLoaded).
- All three seed mountains show `TOTAL HIKERS: 100` — identical placeholder-looking data that undercuts the "real-time" claim.
- Skeleton loading state always renders exactly 6 placeholder cards regardless of the real 3-item dataset, causing a visible collapse when real content loads.
- `favicon.ico` 404s on every page load (confirmed in console).
- One unconfirmed signal: a mobile (390px) screenshot showed apparent text clipping at the right edge, but a DOM overflow check (`scrollWidth` vs `clientWidth`) found no actual overflow — likely a headless-browser paint/font-timing artifact, not a real bug. Worth a manual look on a real device, not a confirmed issue.

## Questions to Consider

- If the hero's entire pitch is "biophilic ecosystem analysis," what would this look like if difficulty/hikers were replaced with something that actually feels like nature — an elevation profile, a canopy photo, real trail conditions — instead of two numbers a corporate dashboard would show?
- The bottom nav implies a whole app (My Trails, Analytics, Profile) that isn't built — should this page ship without that nav until those destinations are real, rather than advertising navigation it can't deliver?
- "Map View" is the active top-nav label for a page with zero map — is a grid of cards actually the right primary view for a spatial hiking product, or is a map the feature that's actually missing?
