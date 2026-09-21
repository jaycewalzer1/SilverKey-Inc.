# Agent Client Hub

> **Status:** Shipped (web); mobile stack registered but path navigation incomplete  
> **Last verified:** 2026-07-31  
> **Code:** `Client/packages/features/agent/components/clientHub/`, `Client/packages/features/dashboard/components/shell/DashboardFeature.tsx`, `Client/packages/utils/growth/agent/clientHubSlug.ts`

Per-client workspace for licensed agents: roadmap/checklists, client profile (read-only), liked homes, documents library, and schedule. Messaging is a **sibling** surface (`/messaging`), not a hub tab.

## Intent

From the agent dashboard client list, open one buyer and manage their active transaction journey without leaving the dashboard shell. The hub composes checklists, profile, saved homes, documents, and calendar — it does not own messaging or search.

## Routes (web)

Canonical path helpers live in `packages/utils/growth/agent/clientHubSlug.ts`:

| Path | Behavior |
|------|----------|
| `/dashboard` | Agent dashboard: `ClientList` + agenda/calendar |
| `/dashboard/client/{nameSlug}/{idSlug}` | Lazy `ClientHubScreen` via `DashboardFeature` |

- `nameSlug` — slug of the client display name (`generateClientHubNameSlug`)
- `idSlug` — last UUID segment of the client user id (`generateClientHubIdSlug`)
- Build: `buildClientHubPath(clientId, clientName)`
- Parse: `parseClientHubPathname` after `stripWorkspaceShellPrefix` (strips `/buyer` / `/brokerage` prefixes)

There is no separate `RouteName` for the hub — it is a path segment under `ROUTES.DASHBOARD` (`/dashboard/*`).

**Entry points:** agent `ClientList` click; `DashboardAgentTodaySection` client / alert “View client”.

## UI composition

```text
DashboardPage (thin app)
  └─ DashboardFeature
       ├─ (no hub path) ClientList + agent agenda/calendar
       └─ (hub path) Suspense → ClientHubScreen (lazy loadClientHubModule)
            ├─ ClientHubHeaderCard (back, ClientSelector, progress, tabs)
            ├─ roadmap → ClientHubRoadmapPanel + checklists
            ├─ profile → ProfileFeature / ProfileScreen (agentSubject, read-only)
            ├─ liked-homes → ClientSavedHomes
            ├─ library → ClientHubLibraryPanel (+ DocuSign modals)
            └─ schedule → ClientHubSchedulePanel (agenda + ClientCalendar)
```

**Tabs:** `roadmap` | `profile` | `liked-homes` | `library` | `schedule`.

**Gate:** `activeWorkspace !== "agent"` → “Not available.”

## Data / APIs

| Concern | Source |
|---------|--------|
| Client roster | `useAgentClients` → `GET /api/v1/agent/clients` |
| Route resolution | `useClientHubRoute` (path or `clientId` prop) |
| Transaction for checklists | `useResolvedTransactionId(clientId)` → `AgentClient.transaction_id` |
| Checklist progress | `useChecklistProgress` (`isAgentViewer`); prefetch types via `useClientHubChecklistPrefetch` |
| Todos / agenda | `useAgentTodos` / `useClientHubAgendaTodos` → `/api/v1/agent/todos` |
| Liked homes | `useSavedHomesData(userId)` |
| Library / signing | `useDocumentsDataIntegration(clientId)` |
| Header stage / last action | `enhanceClientWithDealInfo` — **mock** deal metadata (`useAgentDashboardMockData`) |

Checklist prefetch types: `search`, `offer`, `escrow`, `insurance`, `financing`, `closing`.

## Mobile (as-built gap)

| Piece | Status |
|-------|--------|
| `DashboardStack` screen `ClientHub: { clientId }` | Registered |
| `navigateToPath("/dashboard/client/...")` | Maps to Dashboard tab splat — **does not** push `ClientHub` |
| `ClientHubScreen` props | Accepts `clientId` prop only; does **not** read `useRouteParams` |

Treat the hub as **web-primary** until native path → stack wiring lands. Prefer native barrel exports (`features/agent/index.native.ts`); web loads via `agentDashboardDynamicImports.ts` (not the web agent barrel).

## Developer pitfalls

1. **Messaging is not inside the hub** — use `/messaging` / Messaging tab (`AgentMessaging` / `ClientMessaging`).
2. **Header deal stage is fixture-enhanced** — do not treat stage / last action as live CRM pipeline.
3. **Agents hide buyer integration checklist widgets** — `hideIntegrationComponents={isAgentWorkspace}`.
4. **Missing `transaction_id` on the client** → empty roadmap progress / no checklist prefetch.
5. **Slug resolution returns the first match** if multiple clients share nameSlug+idSlug.
6. **Profile under `agentSubject` is read-only** — agents cannot edit client prefs from the hub.
7. Import hub via `loadClientHubModule` (web) or native barrel — not the web `packages/features/agent` public index.

## Related

- Workspace inventory: [workspace-first-architecture.md](../../architecture/workspace-first-architecture.md)
- Cross-feature imports: [cross-feature-composition.md](../../architecture/cross-feature-composition.md)
- Checklists: [checklists.md](../transaction-management/checklists.md)
- Messaging: [messaging.md](../messaging/messaging.md)
- Calendar event requests (from messaging): [calendar-event-requests.md](../messaging/calendar-event-requests.md)
