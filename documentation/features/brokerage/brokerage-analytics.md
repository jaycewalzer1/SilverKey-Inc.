# Brokerage analytics and Market inventory

> **Status:** Shipped (web; charts mostly fixture-backed; Ask tab is live NL HTTP)  
> **Last verified:** 2026-07-31  
> **Code:** `Client/packages/features/brokerage/`, `Server/app/routes/brokerage_analytics/`, `Server/app/services/brokerage_db_mcp/`

Brokerage workspace dashboard for team KPIs, leakage, agent detail, deal forensics, Market inventory, and natural-language Ask (SIL-323). Campaigns are **not** on main (archived on `archive/brokerage-campaigns`).

## Intent

Give brokerage admins a single `/dashboard` shell with period/office controls and deep links into per-agent analytics. Most chart tabs are **fixture-first** today so demos work without a live OpenAPI swap; the **Ask** tab calls a real guarded NL→SQL endpoint. Server analytics GET routes exist and are scoped by brokerage membership.

## Routes (web)

| Path | Surface |
|------|---------|
| `/dashboard` | `BrokerageDashboardPage` → `BrokerageDashboardShell` → `BrokerageAnalyticsShell` |
| `/dashboard?tab=overview` | Overview (default; overview may omit `tab`) |
| `/dashboard?tab=ask` | Ask — NL query panel (SIL-323) |
| `/dashboard?tab=leakage` | Leakage |
| `/dashboard?tab=agents` | Agents list + row actions |
| `/dashboard?tab=forensics` | Deal forensics |
| `/dashboard?tab=market` | Market inventory map/list |
| `/dashboard/agent/:agentSlug` | Per-agent analytics (`AgentAnalyticsPage`) |
| `/analytics` | Redirect → `/dashboard` |
| `/inventory` | Redirect → `/dashboard` |

Inventory is **not** a top-level sidebar item; it lives under the Market tab (`workspaceNavConfig` hides `inventory`).

## UI composition

```text
BrokerageDashboardPage (thin app)
  └─ BrokerageDashboardShell
       └─ BrokerageAnalyticsShell
            ├─ tabs: overview | ask | agents | leakage | forensics | market
            ├─ AnalyticsAskTab → NlQueryPanel → useBrokerageNlQuery
            ├─ ViewAllAgentsModal, AgentRowActions
            └─ AnalyticsMarketTab → BrokerageInventoryPanel
```

Tab ids: `Client/packages/features/brokerage/components/analytics/analyticsShellConstants.ts`.

Agent row actions: public website (`/a/:slug` when slug exists) and analytics (`/dashboard/agent/:nameSlug`). Agent analytics route is wrapped in `ProtectedRoute` (auth) but is **not** separately gated to the brokerage workspace on the client.

## Data flow

| Layer | Behavior |
|-------|----------|
| Hooks (`useBrokerageAnalytics`, inventory, ancillary, retention, engagement, forensics) | TanStack Query with **local fixture** `queryFn` / `initialData` until SIL-207 live swap |
| `api/analytics.ts` | Typed client for `/api/v1/brokerage/analytics/*` GETs — **ready but unused by chart hooks** |
| `api/nlQuery.ts` + `useBrokerageNlQuery` | **Live** `POST` NL query (Ask tab) |
| `useBrokerageOrgId` | Resolves org id for query keys / API calls; Ask falls back to demo org id if unset |
| Server routes | `require_brokerage_scope` on every analytics handler |

Do not assume the dashboard charts reflect live DB data until hooks call `api/analytics.ts`. Ask results **do** hit the DB via `brokerage_db_mcp`.

## Server API (GET analytics)

Listed in `Server/endpoints.json` under `GET /api/v1/brokerage/analytics/`:

`overview`, `volume`, `price`, `location`, `type`, `timing`, `ancillary`, `funnel`, `agents`, `deal-failure`, `targeted-agent-engagement`, `agent-retention-risk`, `inventory`

**Query params (typical):**

- `brokerage_org_id` (required) — membership checked by `require_brokerage_scope`
- `timeline` ∈ `week|month|year|5years|all` (preferred), or `date_from` / `date_to`
- Inventory also accepts `status`

**Auth failures:** 401 unauthenticated; 403 when `user.brokerage_org_ids` is empty or org not allowed; 400 when `brokerage_org_id` missing.

These GET paths are **not** in the OpenAPI spec yet — regenerate types after the contract lands (SIL-207).

### SIL-208 ML

`Server/app/services/brokerage/ml/` and Celery `score_brokerage_ml_insights_task` exist. There is **no** dedicated ML HTTP route in `endpoints.json`. Timing/retention handlers may return stub notes rather than a live model score.

## Ask tab / NL query (SIL-323)

### Client path

| Piece | Path |
|-------|------|
| Tab shell | `components/analytics/tabs/AnalyticsAskTab.tsx` |
| Panel | `components/analytics/NlQueryPanel.tsx` (`data-testid="analytics-ask-panel"`) |
| Hook | `hooks/useBrokerageNlQuery.ts` (TanStack `useMutation`) |
| API | `api/nlQuery.ts` → `POST /api/v1/brokerage/analytics/nl-query` |
| Viz helpers | `utils/analytics/nlQueryTransforms.ts` (`selectNlBarSeries`, `buildNlTableColumns`) |

Deep link: `/dashboard?tab=ask`.

### HTTP contract

**Endpoint:** `POST /api/v1/brokerage/analytics/nl-query`  
**Auth:** authenticated + `require_brokerage_scope` (`brokerage_org_id` in JSON body or query string must be in `user.brokerage_org_ids`).  
**OpenAPI:** path + `NlQueryRequest` / `NlQueryResponse` in `openapi/openapi.yaml` and `openapi/components/schemas/brokerage/`. Inventory: `POST /api/v1/brokerage/analytics/nl-query` in `Server/endpoints.json`.

**Request body:**

```json
{
  "brokerage_org_id": "<uuid>",
  "question": "closed transactions by agent last quarter"
}
```

**Success (200):**

```json
{
  "success": true,
  "brokerage_org_id": "<uuid>",
  "question": "...",
  "sql": "SELECT ... WHERE brokerage_id = :brokerage_org_id LIMIT 500",
  "viz_hint": "bar | table | none",
  "columns": ["agent_id", "closed_count"],
  "rows": [{ "agent_id": "...", "closed_count": 2 }],
  "row_count": 1
}
```

The UI shows the executed SQL (mono), optional bar chart when `viz_hint=bar` and a label+numeric pair exists, and always a results table.

**Error modes (sanitized client messages):**

| HTTP | Typical `error` code | When |
|------|----------------------|------|
| 400 | `validation_error` | Empty `question` |
| 400 | `query_rejected` / guardrail codes | Multi-statement, non-SELECT, banned keywords/phrases |
| 400 | `empty_question`, `missing_brokerage_org_id`, `brokerage_not_found`, `empty_sql`, `tenancy_*`, `table_not_allowed`, `no_table` | Planning / tenancy / allowlist failures |
| 400 | (decorator) | Missing `brokerage_org_id` for scope |
| 401 | — | Not authenticated |
| 403 | — | No `brokerage_org_ids` or org not allowed |
| 500 | `llm_unconfigured`, `llm_failed`, `execution_failed`, others | Missing `OPENAI_KEY`, LLM failure, DB execution |

Route handler: `Server/app/routes/brokerage_analytics/__init__.py` (`post_brokerage_analytics_nl_query`). Tests: `Server/tests/unit/routes/brokerage_analytics/test_nl_query.py`.

### Server pipeline (`brokerage_db_mcp`)

```text
run_nl_query
  → resolve_connection_config (v1 silverkey_mirror)
  → introspect_schema (allowlisted tables only)
  → generate_sql_with_openai (or injected SqlGenerator in tests)
  → execute_readonly
       → validate_read_only_sql (guardrails + LIMIT ≤ 500)
       → allowlist tables (skyslope_transactions only in v1)
       → require brokerage_id + :brokerage_org_id bind
       → execute on SilverKey DB session
```

Module: `Server/app/services/brokerage_db_mcp/` (`nl_query.py`, `guardrails.py`, `executor.py`, `connection.py`, `introspection.py`, `errors.py`).

Schema / Shape A–B design: [db-mcp-schema-normalization.md](./db-mcp-schema-normalization.md).

### Env / config

| Dep | Role |
|-----|------|
| `OPENAI_KEY` | Required for live SQL planning (`generate_sql_with_openai`); missing → `llm_unconfigured` |
| App `DATABASE_URL` / Flask DB | Mirror queries run against the SilverKey DB (`skyslope_transactions`) |
| Model selection | `openai_model_feature_overlap()` from `app.config.llm_models` |

No separate brokerage-DB URL env in v1 — connection mode is always `silverkey_mirror`.

## Workspace placement

Brokerage is **not** a placeholder workspace (`isPlaceholderWorkspace` is an empty set). Nav shows Dashboard, Library, Messaging, Profile (Search hidden; Inventory via Market tab). Messaging uses the workspace stack (`BrokerageMessaging`). See [workspace-first-architecture.md](../../architecture/workspace-first-architecture.md).

## Local demo

1. Onboard as Brokerage, or set Admin → Dev persona to brokerage.
2. Open `/dashboard` — fixtures render chart tabs without calling analytics GETs.
3. Ask tab: needs auth, `brokerage_org_id` on the user, and `OPENAI_KEY` for live LLM planning; unit tests inject a fake `SqlGenerator`.
4. Optional server demo data: `Server/scripts/skyslope/generate_demo_dataset.py`, `load_demo_to_skyslope.py`, `generate_inventory_fixtures.py`, `generate_agent_analytics_fixtures.py` under `Server/data/skyslope-demo/`.

## Out of scope on main

- Email campaigns UI, learning loop, campaign Celery tasks, and campaign demo JSON (removed; see archive branch `archive/brokerage-campaigns`)
- Dedicated mobile brokerage analytics shell
- Partner placement / RESPA steering (documented under transaction-management, not this surface)
- External Postgres/Snowflake adapters (config shape reserved; not wired)

## Pitfalls

1. `/analytics` and `/inventory` redirect to `/dashboard` (query params on `/analytics` are dropped).
2. Client fixtures and server stubs can diverge — treat chart UI numbers as demo until SIL-207.
3. Agent detail pages are slug/fixture-driven and auth-only on the client; do not assume membership scoping there yet.
4. Ask is the only analytics path with OpenAPI coverage today; do not assume GETs are generated types.
5. Guardrails fail closed on keyword token overlap (e.g. identifier named like a banned word).
6. Keep new code under allowed feature folders (`api/`, `components/`, `hooks/`, `types/`, `utils/`, …) — package structure is lint-enforced.

## Related

- Hub index: [README.md](./README.md)
- DB MCP schema note: [db-mcp-schema-normalization.md](./db-mcp-schema-normalization.md)
- Messaging: [messaging.md](../messaging/messaging.md)
- Ops scripts: [scripts-guide.md](../../runbooks/scripts-guide.md)
