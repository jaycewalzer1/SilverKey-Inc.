# Workspace-first client architecture

SilverKey distinguishes **who the user is on the server** (identity: `user_roles`, brokerage membership) from **which product shell they are using in the UI** (workspace: `buyer` | `seller` | `agent` | `brokerage` | `integration_partner`). Navigation and many gates should follow **`useActiveWorkspace()`**, not `useIsAgent()`, when the question is “which shell or tab?” — keep **`useIsAgent()`** when the question is “does this session have the agent role?” (agent-only APIs and agent UX).

## Status legend

| Status | Meaning |
| ------ | ------- |
| **Implemented** | Full product shell: nav, onboarding, and primary routes as described below. |
| **Partial** | Some primary surfaces ship; others still use empty dashboard pages. See [workspaces-placeholder-shells.md](workspaces-placeholder-shells.md). |
| **Placeholder dashboard** | Thin page still renders `WorkspacePlaceholderPage` even when messaging/nav have moved on. |

## Concepts

| Concept | Purpose |
|--------|---------|
| **`Workspace`** | UX mode for routing, sidebar, and feature composition (`buyer` \| `seller` \| `agent` \| `brokerage` \| `integration_partner`). |
| **`allowedWorkspaces`** | Derived from identity (and optional `brokerage_org_ids` / roles); defines which workspace tabs the user may pick. |
| **`activeWorkspace`** | Persisted per browser session; canonical hook **`useActiveWorkspace()`** in `packages/hooks/store/`. |
| **`useIsAgent()`** | True when `roles` includes `"agent"`; use for API eligibility and agent UX, not primary nav shell selection. |
| **`isPlaceholderWorkspace()`** | Currently always `false` (empty set). Do not use it alone to infer shell-only UX — check the thin dashboard page and [workspaces-placeholder-shells.md](workspaces-placeholder-shells.md). |
| **Admin dev persona** | Server-backed workspace QA via **`/admin/dev-persona`** (replaces session `devPreviewAllWorkspaces`). |

## Identity sync

**What it is:** A client-side reconciler that keeps **`allowedWorkspaces`** and **`activeWorkspace`** aligned with the signed-in user’s server identity (`user_roles`, `brokerage_org_ids`). It does **not** change the server — it reads auth/profile and updates the Zustand workspace store.

**How it works:**

1. **`useWorkspaceIdentitySync`** (`packages/hooks/store/integrations/useWorkspaceIdentitySync.ts`) mounts once under `AuthShellProviders`.
2. On auth user or profile role changes, it calls **`syncFromIdentity`** on the workspace store.
3. **`deriveAllowedWorkspaces`** computes which shells identity permits (e.g. agent-only account → `["agent"]`; buyer+seller roles → both).
4. **`pickInitialActive`** picks `activeWorkspace`: prefers session-persisted value when allowed; otherwise first allowed shell.
5. **Dev persona:** Use **`/admin/dev-persona`** for prod-like multi-workspace QA (server-backed identity).

Dashboard URLs are **role- and workspace-agnostic** (for example `/search`, `/messaging`, `/dashboard/...`). Which shell the user sees is driven by **`activeWorkspace`** and related store state, not by path prefixes.

## Key code paths (web)

| Area | Location |
|------|----------|
| Derive allowed workspaces | `Client/packages/utils/product/workspace/deriveAllowedWorkspaces.ts` |
| Placeholder workspace guard | `Client/packages/utils/product/workspace/isPlaceholderWorkspace.ts` |
| Nav visibility / labels | `Client/packages/utils/product/workspace/workspaceNavConfig.ts` |
| Workspace Zustand slice | `Client/packages/store/slices/workspace/workspace.slice.ts` |
| Sync from auth + profile | `Client/packages/hooks/store/integrations/useWorkspaceIdentitySync.ts` |
| Path normalization (`stripWorkspaceShellPrefix`) | `Client/packages/utils/core/layout/dashboardLayoutConfig.ts` (layout keys only; no shell-prefix redirects) |
| Dashboard area resolution | `Client/packages/utils/layout/dashboardLayoutConfig.ts`, `Client/apps/web/app/layouts/dashboard/useDashboardRoute.ts` |
| Transaction party config | `Client/packages/utils/workspace/transactionShell.ts` + `useTransactionShellConfig` in `packages/hooks/store/` |
| Per-workspace nav labels / visibility | `Client/packages/utils/workspace/workspaceNavConfig.ts` |
| Placeholder page | `Client/packages/features/workspace/components/WorkspacePlaceholderPage.tsx` |
| Workspace switcher UI | `Client/packages/features/workspace/components/WorkspaceSwitcher.web.tsx` |
| Admin reuse / brokerage | `Client/packages/features/admin/types/adminScope.ts` — sections accept `AdminScope` |

## Server alignment

- **Agent role** in `user_roles` is the source for **`@require_agent_access`** (via `user_is_agent()`).
- **Brokerage scope** — parallel decorator **`require_brokerage_scope`** in `Server/app/utils/common_patterns.py`; OpenAPI **`User.brokerage_org_ids`**. Regenerate types from `openapi/` after schema changes.

## Thin app note

Workspace **route shells** live in **`Client/apps/web/app/routes/`** and layouts as thin composition; business logic and hooks stay in **`Client/packages/`** (see [thin-app-architecture.md](thin-app-architecture.md) and `.cursor/rules/shared/thin-app-architecture.mdc`).

---

## Workspace inventories

Canonical routes are shared; **nav visibility**, **labels**, **onboarding**, and **dashboard content** differ by `activeWorkspace`.

### Buyer — **Implemented**

**Product goal:** Home search and transaction workflow for purchasers; AI-assisted discovery, saved homes, messaging, and closing tasks.

| Area | Detail |
| ---- | ------ |
| **Onboarding (web)** | `onboarding_role` → About (`demographics`) → housing essentials → size → location → search features → financial (mobile excludes financial). Investor uses the same step count as buyer. |
| **Nav (desktop)** | Dashboard, Search, Library, Messaging, Profile |
| **Nav (mobile)** | Dashboard, Search, Library, Messaging (profile via header) |
| **Dashboard (`/dashboard`)** | `DashboardPage` → `DashboardFeature`: calendar, checklists, transaction widgets |
| **Other routes** | `/search`, `/library` (saved), `/messaging`, `/profile` — full buyer/agent-shared features |
| **Post-onboarding** | `/dashboard` |

### Agent — **Implemented**

**Product goal:** Licensed agents serving buyers on active transactions — client hub, messaging, and the same dashboard shell with agent-specific branches.

| Area | Detail |
| ---- | ------ |
| **Onboarding (web)** | `onboarding_role` → About → brokerage → licensing → territory |
| **Nav (desktop)** | Dashboard, Search, Library, Messaging (**Clients**), Profile |
| **Nav (mobile)** | Same tab keys as buyer; messaging label **Clients** |
| **Dashboard (`/dashboard`)** | `DashboardPage` → `DashboardFeature` with `activeWorkspace === "agent"` branches (client list, agent calendar; client hub under `/dashboard/client/...`) |
| **Client hub** | Per-client tabs (roadmap, profile, liked homes, library, schedule) — [agent-client-hub.md](../features/agent/agent-client-hub.md). Messaging is **not** a hub tab. |
| **Messaging** | `/messaging` — `AgentMessaging` / agent Clients tab (sibling of hub) |
| **Post-onboarding** | `/dashboard` |
| **API identity** | `useIsAgent()` — agent role in `user.roles` for agent-only endpoints |

### Seller — **Partial**

Onboarding and messaging ship; dashboard is still an empty shell.

| Area | Detail |
| ---- | ------ |
| **Onboarding** | Public role picker: **Seller** → `onboarding_role` → `seller_property` → `seller_address` → `seller_timeline` → `seller_motivation` → `seller_pricing` → `seller_demographics` → submit. Sets roles via preferences sync; `activeWorkspace` → `seller`; lands on `/dashboard`. |
| **Nav** | Standard non-placeholder visibility (Dashboard, Search, Library, Messaging, Profile). Inventory is never a top-level tab. |
| **Dashboard** | `SellerDashboardPage` → `WorkspacePlaceholderPage` |
| **Messaging** | Agent–client stack with seller persona (`ClientMessaging`) |
| **Code** | `SellerDashboardPage.tsx`, `packages/features/seller/`, messaging via `getMessagingSurfaceForWorkspace("seller")` |

### Brokerage — **Partial** (analytics shipped)

Fixture-backed analytics + Market inventory on web; messaging uses the workspace stack. Campaigns are not on main.

| Area | Detail |
| ---- | ------ |
| **Onboarding** | Public role picker: **Brokerage** → `onboarding_role` → `brokerage_shell_setup` → submit. Grants `brokerage_admin` from `primary_onboarding_role` on first write; lands on `/dashboard`. |
| **Nav** | Dashboard, Library, Messaging, Profile (Search hidden; Market inventory under `/dashboard?tab=market`) |
| **Dashboard** | `BrokerageDashboardPage` → analytics shell ([brokerage-analytics.md](../features/brokerage/brokerage-analytics.md)) |
| **Messaging** | Workspace stack (`BrokerageMessaging`) |
| **Code** | `BrokerageDashboardPage.tsx`, `packages/features/brokerage/` |

### Integration partner — **Partial**

As-built operator shell with placeholder dashboard. Partner placement admin (brokerage-side) is documented separately; this shell is not buyer steering (RESPA).

| Area | Detail |
| ---- | ------ |
| **Onboarding** | Public role picker: **Integration partner** → `onboarding_role` → five SIL-193 steps (`ip_org_details` … `ip_agreement`) → submit. Grants `integration_partner` on first write; lands on `/dashboard`. See [profile-onboarding.md](../features/account/profile-onboarding.md). |
| **Nav** | Standard non-placeholder visibility. |
| **Dashboard** | `IntegrationPartnerDashboardPage` → `WorkspacePlaceholderPage` (onboarding is multi-step; dashboard is still empty) |
| **Messaging** | Workspace stack (`integrator` persona) |
| **Related (brokerage-side)** | [rev-share-partners.md](../features/transaction-management/rev-share-partners.md) |
| **Code** | `IntegrationPartnerDashboardPage.tsx`, `packages/features/integrationPartner/`, IP steps under `packages/features/profile/components/onboarding/ip/` |

---

## Identity → workspace

- POST `/api/v1/preferences` syncs **`user_roles`** from `why_joining_silverkey` via `Server/app/services/auth/user_roles_sync.py` (buyer / seller / investor tags); agent role is granted from `primary_onboarding_role: "agent"` on first write (immutable after grant). Shell QA: `brokerage_admin` and `integration_partner` are granted from `primary_onboarding_role` on first write.
- `deriveAllowedWorkspaces` reads `user.roles` from profile bootstrap (including `integration_partner` when provisioned).
- **`WorkspaceSwitcher`** — admin only at **`/admin/dev-persona`** (`AdminDevPersonaSection`): sets exclusive server-backed persona via `POST /api/v1/admin/current-user-dev-workspace`. Workspace UX follows identity like production; not mounted in the main dashboard.
- Shell onboarding success sets `activeWorkspace` and navigates via [`onboardingToWorkspace.ts`](../../../Client/packages/features/profile/utils/onboarding/role/onboardingToWorkspace.ts) (seller / brokerage / integration_partner → `/dashboard`).

## How to verify locally

1. Complete onboarding as **Seller** → placeholder dashboard + real messaging.
2. Complete onboarding as **Brokerage** (or Admin → Dev persona) → analytics dashboard + workspace messaging.
3. Complete onboarding as **Integration partner** → placeholder dashboard + workspace messaging.
4. As buyer or agent, confirm full tabs and flows unchanged.
5. Run tests:

```bash
cd Client && pnpm test:run -- packages/utils/product/workspace packages/features/workspace packages/features/profile/utils/onboarding apps/web/app/layouts/dashboard/DashboardContent.workspace.test.tsx
cd Server && .venv/bin/python -m pytest tests/unit/services/test_user_roles_sync.py tests/unit/routes/auth/test_routes_user_preferences.py::TestPreferences::test_create_preferences_syncs_seller_roles_to_profile -q --no-cov
```

| Layer | Test files |
|-------|------------|
| Client | `deriveAllowedWorkspaces.test.ts`, `isPlaceholderWorkspace.test.ts`, `workspaceNavConfig.test.ts`, `steps.test.ts`, `onboardingToWorkspace.test.ts`, `WorkspaceSwitcher.web.test.tsx`, `DashboardContent.workspace.test.tsx` |
| Server | `test_user_roles_sync.py`, `routes/auth/test_routes_user_preferences.py` (seller roles) |

## Related

- [workspaces-placeholder-shells.md](workspaces-placeholder-shells.md) — placeholder vs partial shell contract.
- [brokerage-analytics.md](../features/brokerage/brokerage-analytics.md) — brokerage dashboard surfaces.
- [layered-architecture-imports.md](layered-architecture-imports.md) — import layers and features.
- [Post–major change checklist](../internal/post-major-change-checklist.md) — update docs and Cursor config when architecture shifts.
- Scoped Cursor rule: `.cursor/rules/shared/post-major-change-sync.mdc`.
