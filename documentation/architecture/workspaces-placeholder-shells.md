# Workspace placeholder shells

Some workspaces still render **empty dashboard pages** while identity, nav, and messaging advance independently. Prefer this page over treating `isPlaceholderWorkspace()` as the sole truth — that helper is currently an **empty set** (always `false`).

See [workspace-first-architecture.md](workspace-first-architecture.md) for the full inventory.

## Current as-built (2026-07-31)

| Workspace | Dashboard | Messaging | Nav (`getWorkspaceNavTabs`) |
|-----------|-----------|-----------|-----------------------------|
| **Buyer / agent** | Full product (agent: client hub under `/dashboard/client/...`) | Full product | Full tabs |
| **Brokerage** | Analytics + Ask + Market inventory ([brokerage-analytics.md](../features/brokerage/brokerage-analytics.md)) | Workspace stack (`BrokerageMessaging`) | Dashboard, Library, Messaging, Profile (Search hidden; Inventory via Market tab) |
| **Seller** | `WorkspacePlaceholderPage` via `SellerDashboardPage` | Real agent–client stack (`ClientMessaging` + seller persona) | Same visibility rules as non-placeholder workspaces (Search/Library/Profile visible) |
| **Integration partner** | `WorkspacePlaceholderPage` | Workspace stack (`integrator` persona) | Same as other non-placeholder workspaces |

`isPlaceholderWorkspace` no longer lists seller/brokerage/integration_partner. Route guards that keyed off it (`showPlaceholderForRoute`, barren nav) therefore do **not** force placeholder UX. Thin pages still choose placeholder vs real shells explicitly.

## Seller / integration-partner onboarding exceptions

Seller signup uses the full multi-step `seller_onboarding` flow ([SIL-192](https://linear.app/silverkey/issue/SIL-192/seller-seller-onboarding-profile-variation)) — property, address, timeline, motivation, pricing, demographics. Seller **dashboard** remains placeholder; **messaging is shipped**.

Integration partner signup uses the five-step SIL-193 flow (`ip_org_details` … `ip_agreement`) instead of the old single shell-setup step. Partner **dashboard** remains placeholder; **messaging** uses the workspace stack. See [profile-onboarding.md](../features/account/profile-onboarding.md).

## What “placeholder dashboard” means

| Allowed | Forbidden (until that page ships real UX) |
| ------- | --------------------------------------------- |
| Thin page that renders `WorkspacePlaceholderPage` | Product widgets on seller / integration-partner dashboards |
| Identity sync + workspace switcher / admin dev persona | Treating `isPlaceholderWorkspace` as the only graduation signal |
| Messaging and onboarding that already ship for the role | Undocumented product surfaces without updating this doc |

## Code map

| Piece | Location |
| ----- | -------- |
| Placeholder detector (currently always false) | `Client/packages/utils/product/workspace/isPlaceholderWorkspace.ts` |
| Shared empty-state page | `Client/packages/features/workspace/components/WorkspacePlaceholderPage.tsx` |
| Nav visibility / labels | `Client/packages/utils/product/workspace/workspaceNavConfig.ts` |
| Route composition | `Client/apps/web/app/layouts/dashboard/DashboardContent.tsx` |
| Thin dashboard pages | `Client/apps/web/pages/workspace/SellerDashboardPage.tsx`, `BrokerageDashboardPage.tsx`, `IntegrationPartnerDashboardPage.tsx` |

## How to extend a shell-only dashboard

1. Update this doc and the workspace section in [workspace-first-architecture.md](workspace-first-architecture.md).
2. Replace the thin page’s `WorkspacePlaceholderPage` with a real feature shell under `packages/features/<workspace>/`.
3. Adjust nav tabs/labels in `workspaceNavConfig` if product tabs change.
4. If you reintroduce a true “barren shell” mode, populate `PLACEHOLDER_WORKSPACES` in `isPlaceholderWorkspace` and restore the DashboardContent guards deliberately.
5. Add onboarding steps via the [profile onboarding flow registry](../features/account/profile-onboarding.md) when the role has a public picker entry.

## Related

- Brokerage analytics: [brokerage-analytics.md](../features/brokerage/brokerage-analytics.md)
- Partner placement (brokerage admin): [rev-share-partners.md](../features/transaction-management/rev-share-partners.md)
