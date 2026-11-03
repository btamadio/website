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

## Architecture

![Architecture: a question goes to the agent loop, which calls five tools on an MCP server; the server queries cached AEMO data in DuckDB; the eval harness scores each answer against 25 AER events.](/grid-explainer-architecture.svg)

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

## Replay: one recorded run

This is a saved run, not a live call. No API is called when you view this page. Model: Sonnet 5.5, run after the tool fixes. The AER lists network limitation, low wind and rebidding as causes of this event. The answer names the first two and cannot name rebidding, which needs bid data.

**Question:** Why did South Australian electricity prices spike around 7.30am on 23 October 2024? (times are NEM time)

<details>
<summary>Step 1: <code>get_prices</code>(region=SA1, start=2024-10-23T05:00, end=2024-10-23T10:00, resolution_minutes=5)</summary>

```json
{"source":"AEMO MMS DISPATCHPRICE, INTERVENTION = 0 (pricing run)","window":{"start":"2024-10-23T05:00","end":"2024-10-23T10:00","timezone":"NEM time (UTC+10, no DST); each timestamp is the END of the interval"},"row_count":60,"columns":["time","rrp_mean","rrp_max"],"rows":[["2024-10-23T05:05",170.4,170.4],["2024-10-23T05:10",243.0,243.0],["2024-10-23T05:15" … (2,258 characters in total)
```

</details>

<details>
<summary>Step 2: <code>get_demand</code>(region=SA1, start=2024-10-23T05:00, end=2024-10-23T10:00, resolution_minutes=30)</summary>

```json
{"source":"AEMO MMS DISPATCHREGIONSUM, INTERVENTION = 0 (pricing run)","window":{"start":"2024-10-23T05:00","end":"2024-10-23T10:00","timezone":"NEM time (UTC+10, no DST); each timestamp is the END of the interval"},"row_count":10,"columns":["time","demand_mw","available_generation_mw"],"rows":[["2024-10-23T05:30",1178.9,1765.3],["2024-10-23T06:00",1228.8,17 … (682 characters in total)
```

</details>

<details>
<summary>Step 3: <code>get_generation_mix</code>(region=SA1, start=2024-10-23T05:00, end=2024-10-23T10:00, resolution_minutes=30)</summary>

```json
{"source":"AEMO MMS DISPATCH_UNIT_SCADA + DUDETAILSUMMARY (region) + fuel registry, all dispatch intervals","window":{"start":"2024-10-23T05:00","end":"2024-10-23T10:00","timezone":"NEM time (UTC+10, no DST); each timestamp is the END of the interval"},"row_count":10,"columns":["time","Battery Storage","Diesel","Natural Gas","Natural Gas / Diesel","Natural G … (1,360 characters in total)
```

</details>

<details>
<summary>Step 4: <code>get_interconnector_flows</code>(start=2024-10-23T05:00, end=2024-10-23T10:00, resolution_minutes=30)</summary>

```json
{"source":"AEMO MMS DISPATCHINTERCONNECTORRES, INTERVENTION = 0 (pricing run)","window":{"start":"2024-10-23T05:00","end":"2024-10-23T10:00","timezone":"NEM time (UTC+10, no DST); each timestamp is the END of the interval"},"row_count":10,"columns":["time","N-Q-MNSP1","NSW1-QLD1","T-V-MNSP1","V-S-MNSP1","V-SA","VIC1-NSW1"],"rows":[["2024-10-23T05:30",-18.3,- … (934 characters in total)
```

</details>

<details>
<summary>Step 5: <code>get_binding_constraints</code>(start=2024-10-23T06:30, end=2024-10-23T08:30)</summary>

```json
{"source":"AEMO MMS DISPATCHCONSTRAINT + GENCONDATA (descriptions), INTERVENTION = 0 (pricing run)","window":{"start":"2024-10-23T06:30","end":"2024-10-23T08:30","timezone":"NEM time (UTC+10, no DST); each timestamp is the END of the interval"},"row_count":10,"columns":["constraint_id","binding_intervals","first_time","last_time","peak_marginal_value","max_v … (2,307 characters in total)
```

</details>

**Answer** (2 model steps, 11 s, $0.033):

> SA prices spiked to the market price cap of about $9,900/MWh in several 5-minute intervals between 7:15 and 7:35. The price was about $300/MWh just before and $270/MWh straight after. The spike lasted about 20 minutes, not the whole half-hour.
>
> **What the data shows**
> - **Tight, expensive supply.** SA demand was about 1,194–1,268 MW. Wind was low, at 103.6 MW in the 7:30 half-hour against 188.5 MW an hour earlier. Solar was still small, at 48 MW. Gas and diesel were setting prices, and prices were already $200–300/MWh.
> - **Imports from Victoria were cut back.** The Victoria–SA flow (V-SA) went from +133.5 MW (import into SA) in the 7:00 half-hour to −74.2 MW (export from SA) in the 7:30 half-hour.
> - **Constraints were binding in the same window.** These were Victorian and NSW network constraints, with large negative marginal values:
>   - Constraint "CA_SYDS_562A9792_1" (marginal value −17,488), which covers overload of a Victorian line.
>   - "NRM_SA1_VIC1" (−17,223.6), which limits SA-to-VIC flow. It bound once, at 7:40.
>   - "V^SML_BESH_2" (−5,353), which covers a voltage-collapse limit in Victoria.
> - **The Dalrymple BESS constraint also bound.** "S_DALNTH1_GE_ZERO" bound from 6:35 to 7:05 with a marginal value of 13,512. It limited the Dalrymple battery's energy.
>
> **Likely cause:** low wind, a battery energy limit, and Victorian network constraints together left SA without enough cheap supply for those few intervals. I can't say which constraint set the price in each interval.
>
> Prices fell after 8:00 as solar and wind rose.

With the first tools this event was a network-limitation miss: the top constraints were mostly generator-specific noise. With the filtered list the same question scored a hit.

## Still to come

A live "ask your own" mode (needs server-side keys, a per-IP rate limit and a hard spend cap first), plus the repo and blog links. The repo is private for now.
