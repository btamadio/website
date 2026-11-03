---
title: Grid explainer
summary: An MCP server and agent that explains Australian electricity price spikes with cited data, scored against 25 documented market events.
status: in-progress
order: 1
tags: [mcp, agents, evals, aemo]
---

## Problem

Why did South Australian prices spike at 6pm? The answer is spread across AEMO price, generation, interconnector and constraint data.

## What it is

An MCP server with five tools (prices, demand, generation mix, interconnector flows, binding constraints) over AEMO's market data, and a Claude tool-use agent that calls them and writes an explanation. Times are NEM time (UTC+10, no daylight saving). The 25 test events are price spikes above $5,000/MWh documented in the Australian Energy Regulator's quarterly reports (May 2024 to March 2025).

## Eval

Each answer is graded on which of the AER's documented causes it names as a factor. The grader (Haiku 5.5) sees only the answer, never the AER's cause list. Two rubrics are reported:

- **Strict:** a cause counts only if the answer clearly states it. Hedged or "possible" causes do not count.
- **Lenient:** a cause counts if the answer names it as likely or contributing and cites data for it, even when it hedges.

"Observable" recall counts only causes the tools can show. Rebidding, start-up limits, FCAS and inertia need bid data the tools don't expose, so no model can name them from this data. Five low-wind labels were also removed from the observable set (see below).

| Run | Recall, all causes (strict / lenient) | Recall, observable (strict / lenient) | Events with ungrounded numbers | Cost, 25 events |
|---|---|---|---|---|
| Haiku 5.5, first tools | 0.26 / 0.39 | 0.40 / 0.61 | 13 | $0.07 |
| Sonnet 5.5, first tools | 0.34 / 0.44 | 0.56 / 0.68 | 13 | $0.78 |
| Sonnet 5.5, after tool fixes | 0.40 / 0.49 | 0.66 / 0.75 | 17 | $0.80 |

Each row is a single run, so differences of one or two events are within noise. "Ungrounded" means the answer contains a figure that appears in no tool result; derived sums count as ungrounded, so this over-reports.

## What went wrong, and what fixed it

**Network limits were found, then marked down.** Both models called the constraints tool on almost every event, and 9 to 11 of their misses still discussed binding constraints, but hedged ("I can't tell which set the price"). Under the strict rubric that scores as a miss. Under the lenient rubric both models name network limits on 19 of 24 events (Sonnet 15, Haiku 12 under strict).

The constraints tool also hurt itself. It ranks by marginal value, and 112 of the 250 top-10 rows across Sonnet's runs were generator-specific or FCAS constraints (for example `VGPT1G.ENERGY <= 0`) that say nothing about the network. On one event, 6 of the 10 rows were this noise and the AER's cause (flow limits into NSW from Queensland and Victoria) was absent. Dropping those constraints before ranking raised Sonnet's network hits from 15 to 20 of 24 under the strict rubric (19 to 23 lenient).

**"Low wind" is mostly not observable.** I compared wind output at each event's peak-price interval with that region's output over August 2024 to March 2025. On five events wind was at or above the 36th percentile (one was at the 79th), so the AER's "low" means low against forecast, which the tools can't show. Those five are excluded from observable recall.

**Low wind that is visible is still missed.** On 13 observable low-wind events, Sonnet names it on 6, before and after the tool changes. The data is in the tool result (Queensland 2025-01-22: 158 MW against a regional peak of 1,022 MW), but the answers describe the fuels that changed, such as solar fading and hydro ramping, and skip wind that was low but flat. I added each fuel's peak output to the generation-mix result so the model could judge "low". It made no difference. I did not try a percent-of-peak column or a prompt instruction, so this is unresolved, not proven unfixable.

**Other known problems**
- Rebidding is missed on every event. It is the most common documented cause and the tools have no bid data.
- Sonnet's answers contain ungrounded figures on 17 of 25 events after the tool changes, up from 13. I haven't investigated why.
- The AER's cause tables undercount for the four Q2-2024 events, because their causes come from section headings rather than a driver table.
- Haiku costs about a ninth as much as Sonnet but scores lower on every recall measure above.

## Still to come

Architecture diagram, a replayable trace of one event, and the repo and blog links. The repo is private for now.
