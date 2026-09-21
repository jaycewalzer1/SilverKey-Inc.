# Profile onboarding flow registry

Onboarding and personalization **step order** is defined declaratively under:

`Client/packages/features/profile/utils/onboarding/registry/`

## Adding or changing steps

1. Add the step id to [`profileStepIds.ts`](../../../Client/packages/features/profile/types/onboarding/profileStepIds.ts) if new.
2. Add title in [`registry/stepMeta.ts`](../../../Client/packages/features/profile/utils/onboarding/registry/stepMeta.ts).
3. Include the step in the right template in [`registry/flowTemplates.ts`](../../../Client/packages/features/profile/utils/onboarding/registry/flowTemplates.ts).
4. Add completion rules in [`registry/stepCompletion.ts`](../../../Client/packages/features/profile/utils/onboarding/registry/stepCompletion.ts) when skip/next behavior depends on fields.
5. Render UI in [`renderOnboardingStep.web.tsx`](../../../Client/packages/features/profile/components/onboarding/renderOnboardingStep.web.tsx) and [`.native.tsx`](../../../Client/packages/features/profile/components/onboarding/renderOnboardingStep.native.tsx).

Do **not** add a fourth `switch (step.id)` in feature shells — wire through `renderOnboardingStep`.

## Flow templates

| Template | Use |
| -------- | --- |
| `buyer_onboarding` | Default buyer signup |
| `agent_onboarding` | Agent signup |
| `seller_onboarding` | Seller signup: role + `seller_property`, `seller_address`, `seller_timeline`, `seller_motivation`, `seller_pricing`, `seller_demographics` |
| `brokerage_onboarding` | Brokerage shell: role + `brokerage_shell_setup` (one test input) |
| `integration_partner_onboarding` | SIL-193: role → `ip_org_details` → `ip_integration_type` → `ip_point_of_contact` → `ip_service_area` → `ip_agreement` (web + native) |
| `buyer_personalization` | Settings / profile preferences (buyer) |
| `agent_personalization` | Settings / profile preferences (agent) |

Brokerage shell setup binds `workspace_shell_test_input` on the client draft only; it is **stripped** from the preferences API payload until real product fields ship.

### Integration partner steps (SIL-193)

Step UI: `Client/packages/features/profile/components/onboarding/ip/` (`IpOrgDetailsStep`, `IpIntegrationTypeStep`, `IpPointOfContactStep`, `IpServiceAreaStep`, `IpAgreementStep`), wired through `renderOnboardingStep.{web,native}.tsx`.

| Step id | Title (registry) | Completion (`stepCompletion.ts`) |
|---------|------------------|----------------------------------|
| `ip_org_details` | Organization | Non-empty `ip_org_name` |
| `ip_integration_type` | Service type | Non-empty `ip_integration_type` |
| `ip_point_of_contact` | Contact | Non-empty `ip_contact_name` + `ip_contact_email` |
| `ip_service_area` | Service area | Non-empty `ip_service_states` array |
| `ip_agreement` | Agreement | `ip_agreement_acknowledged === true` |

`integration_partner_shell_setup` remains a step id / title in the registry but is **not** in `FLOW_TEMPLATE_STEP_IDS.integration_partner_onboarding` (replaced by the five IP steps). Dashboard for this workspace is still a placeholder — see [workspaces-placeholder-shells.md](../../architecture/workspaces-placeholder-shells.md).

Post-onboarding navigation lands on `/dashboard` for all roles. Workspace selection after onboarding is centralized in [`onboardingToWorkspace.ts`](../../../Client/packages/features/profile/utils/onboarding/role/onboardingToWorkspace.ts) (`postOnboardingWorkspaceForPrimaryRole`).

Public APIs [`getOnboardingSteps`](../../../Client/packages/features/profile/utils/onboarding/steps/steps.ts) and [`getPersonalizationSteps`](../../../Client/packages/features/profile/utils/onboarding/steps/steps.ts) delegate to `buildProfileFlow`.

## Brokerage / seller workspace shells

Onboarding registry work does not decide dashboard UX. Brokerage dashboard analytics and seller/brokerage messaging are documented under [workspaces-placeholder-shells.md](../../architecture/workspaces-placeholder-shells.md) and [brokerage-analytics.md](../brokerage/brokerage-analytics.md).

## Tests

- [`registry/onboardingFlowSnapshots.test.ts`](../../../Client/packages/features/profile/utils/onboarding/registry/onboardingFlowSnapshots.test.ts) — buyer/agent step order parity
- [`registry/buildProfileFlow.test.ts`](../../../Client/packages/features/profile/utils/onboarding/registry/buildProfileFlow.test.ts) — template resolution
