# Brokerage DB MCP — schema normalization (SIL-323)

As-built design note for the brokerage database query service (NL → read-only
SQL → analytics UI). This is a **product data MCP / query service**, not Cursor
editor MCP under `.cursor/mcp.example.json`.

> **Last verified:** 2026-07-31  
> **HTTP + Ask UX:** [brokerage-analytics.md](./brokerage-analytics.md#ask-tab--nl-query-sil-323)  
> **Code:** `Server/app/services/brokerage_db_mcp/`

## Goal

Connect per-brokerage data, introspect tables/columns without hardcoding a single
CRM schema, answer plain-English questions safely, and render results in the
existing brokerage analytics charts/tables where possible.

## Related tickets

| Ticket | Boundary |
| ------ | -------- |
| **SIL-323** | Connector + introspection + NL→SQL guardrails + one NL UI path (Ask tab) |
| **SIL-207** | Fixture → live overview/agents API swap (coordinate; do not replace wholesale) |
| **SIL-211** | Brokerage performance dashboard insights |
| **SIL-285** | SkySlope demo dataset (mirror seed already shipped) |

## Two sample shapes

### Shape A — SkySlope mirror (canonical in-repo / v1 runtime)

Source of truth today: `skyslope_transactions`
(`Server/app/models/skyslope/skyslope_transaction.py`).

| Concern | How Shape A represents it |
| ------- | ------------------------- |
| Tenant | `brokerage_id` (FK → `brokerage_orgs`) |
| External id | `skyslope_transaction_id` |
| Agent | `agent_id` (nullable FK → `users`) |
| Lifecycle | `status`, `created_at`, `closed_at`, `cancelled_at`, `is_cancelled` |
| Money | `sale_price`, `list_price` (`Numeric(14, 2)` dollars) |
| Property | `address`, `city`, `state`, `zip`, lat/lng, `side`, `property_type` |
| Ancillary | `title_vendor`, `lender`, `escrow_company`, `has_home_warranty` |
| Escape hatch | `raw_payload` (JSONB) |

**NL example mapping** (“closed transactions by agent last quarter”):

- Filter: `closed_at` in quarter window, `is_cancelled = false`, status treated as closed
- Group: `agent_id`
- Aggregate: `COUNT(*)`, optional `SUM(sale_price)`
- Always scope: `brokerage_id = :brokerage_org_id`

v1 connection mode `silverkey_mirror` (`connection.py`) allowlists only
`skyslope_transactions` and requires the tenancy bind `:brokerage_org_id`.

### Shape B — Variant “raw brokerage CRM” (hypothetical external DB)

Illustrative second brokerage that never matched our mirror 1:1. Used to flag
normalization risk **before** we assume shared chart DTOs.

```text
agents(id, full_name, office_name, external_agent_code)
deals(
  deal_pk,
  agent_code,          -- string, not FK to SilverKey users
  deal_status,         -- e.g. PENDING | SETTLED | FELL_THROUGH
  settlement_date,     -- date, not timestamptz closed_at
  close_price_cents,   -- integer cents, not Numeric dollars
  list_price_cents,
  property_address,    -- single line, no city/state/zip columns
  side_code,           -- B / S
  title_co_name,
  mortgage_lender
)
```

**Normalization risks vs Shape A:**

| Concept | Shape A | Shape B risk |
| ------- | ------- | ------------ |
| Tenant key | `brokerage_id` UUID | May be absent or named differently on external DB |
| Agent identity | `agent_id` → `users` | `agent_code` string — join/map required for SilverKey UI |
| Closed deal | `closed_at` + status | `settlement_date` + `SETTLED` enum |
| Money | dollars `Numeric` | cents integer — divide by 100 before charts |
| Address | structured columns | single line — convert before geo heatmaps |

External Postgres/Snowflake adapters are reserved on `BrokerageDbConfig` but
**not wired** in v1 — `resolve_connection_config` always returns
`MODE_SILVERKEY_MIRROR`.

## As-built pipeline (v1)

| Stage | Module | Behavior |
| ----- | ------ | -------- |
| Config | `connection.py` | Resolve org; allowlist `skyslope_transactions`; tenancy column `brokerage_id` |
| Introspect | `introspection.py` | Schema snapshot for LLM prompt (allowlisted tables only) |
| Plan | `nl_query.py` | OpenAI JSON `{sql, viz_hint}`; system prompt forces `:brokerage_org_id` |
| Guard | `guardrails.py` | Single SELECT/WITH…SELECT; ban DML/DDL phrases; enforce `LIMIT ≤ 500` |
| Execute | `executor.py` | Re-check allowlist + tenancy bind; JSON-safe rows; no binary blobs |
| HTTP | `routes/brokerage_analytics` | `POST …/nl-query` + `require_brokerage_scope` |
| UI | `NlQueryPanel` / Ask tab | Question → mutation → SQL + optional bar + table |

Error taxonomy: `QueryGuardrailError`, `ConnectionConfigError`, `QueryExecutionError`,
`NlQueryError` in `errors.py`. Client-facing messages stay generic; codes are returned
in JSON `error`.

## Product MCP vs Cursor MCP

Do not confuse this service with editor MCP servers in `mcp.example.json`. This
package is an in-process Flask service that plans and runs read-only SQL for one
brokerage org. No MCP wire protocol is exposed to clients — only the REST
`nl-query` endpoint.

## Pitfalls

1. LLM can invent columns — executor rejects non-allowlisted tables; missing
   tenancy bind fails closed.
2. `OPENAI_KEY` required for live planning; tests must inject `sql_generator`.
3. Chart DTOs for overview/agents remain fixture-shaped until SIL-207; Ask results
   are a separate response shape (`columns`/`rows`/`viz_hint`).
4. Completing Shape B would need a real connector + column mapping layer — do not
   assume Ask works against an arbitrary CRM DSN today.
