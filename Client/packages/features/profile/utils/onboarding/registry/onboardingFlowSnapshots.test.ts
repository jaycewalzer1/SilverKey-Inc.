import { describe, expect, it } from "vitest";

import {
  getOnboardingSteps,
  getOnboardingStepsMobile,
} from "packages/features/profile/utils/onboarding/steps/steps";

import { buildOnboardingFlowFromOptions } from "./buildProfileFlow";

function stepSnapshot(steps: { id: string; title: string }[]) {
  return steps.map((s) => ({ id: s.id, title: s.title }));
}

const BUYER_WEB_SNAPSHOT = [
  { id: "onboarding_role", title: "Who I am" },
  { id: "demographics", title: "About" },
  { id: "housing_essentials", title: "Essentials" },
  { id: "housing_ranges", title: "Size" },
  { id: "location", title: "Location" },
  { id: "search_property", title: "Features" },
  { id: "financial", title: "Finance" },
];

const BUYER_MOBILE_SNAPSHOT = BUYER_WEB_SNAPSHOT;

const AGENT_SNAPSHOT = [
  { id: "onboarding_role", title: "Who I am" },
  { id: "demographics", title: "About" },
  { id: "agent_brokerage", title: "Brokerage" },
  { id: "agent_licensing", title: "Licensing" },
  { id: "agent_profile", title: "Territory" },
];

const RENTER_SNAPSHOT = [
  { id: "onboarding_role", title: "Who I am" },
  { id: "renter_budget", title: "Budget" },
  { id: "renter_location", title: "Areas" },
  { id: "renter_move_timeline", title: "Timeline" },
  { id: "renter_household", title: "Household" },
  { id: "renter_amenities", title: "Amenities" },
];

describe("onboarding flow snapshots (buyer and agent parity)", () => {
  it("buyer web — public API matches golden fixture", () => {
    expect(stepSnapshot(getOnboardingSteps({ primaryRole: "buyer" }))).toEqual(BUYER_WEB_SNAPSHOT);
  });

  it("buyer web — registry builder matches golden fixture", () => {
    expect(
      stepSnapshot(buildOnboardingFlowFromOptions({ primaryRole: "buyer", platform: "web" }))
    ).toEqual(BUYER_WEB_SNAPSHOT);
  });

  it("buyer mobile — public API matches golden fixture", () => {
    expect(stepSnapshot(getOnboardingStepsMobile({ primaryRole: "buyer" }))).toEqual(
      BUYER_MOBILE_SNAPSHOT
    );
  });

  it("buyer mobile — registry builder matches golden fixture", () => {
    expect(
      stepSnapshot(
        buildOnboardingFlowFromOptions({
          primaryRole: "buyer",
          platform: "mobile",
        })
      )
    ).toEqual(BUYER_MOBILE_SNAPSHOT);
  });

  it("agent web — public API matches golden fixture", () => {
    expect(stepSnapshot(getOnboardingSteps({ isAgent: true, primaryRole: "agent" }))).toEqual(
      AGENT_SNAPSHOT
    );
  });

  it("agent web — registry builder matches golden fixture", () => {
    expect(
      stepSnapshot(
        buildOnboardingFlowFromOptions({ isAgent: true, primaryRole: "agent", platform: "web" })
      )
    ).toEqual(AGENT_SNAPSHOT);
  });

  it("agent mobile — public API matches golden fixture", () => {
    expect(stepSnapshot(getOnboardingStepsMobile({ isAgent: true }))).toEqual(AGENT_SNAPSHOT);
  });

  const SELLER_SNAPSHOT = [
    { id: "onboarding_role", title: "Who I am" },
    { id: "seller_property", title: "Property" },
    { id: "seller_address", title: "Address" },
    { id: "seller_timeline", title: "Timeline" },
    { id: "seller_motivation", title: "Motivation" },
    { id: "seller_pricing", title: "Pricing" },
    { id: "seller_demographics", title: "About" },
  ];

  it("seller web — full onboarding snapshot", () => {
    expect(stepSnapshot(getOnboardingSteps({ primaryRole: "seller" }))).toEqual(SELLER_SNAPSHOT);
  });

  it("renter web — full onboarding snapshot", () => {
    expect(stepSnapshot(getOnboardingSteps({ primaryRole: "renter" }))).toEqual(RENTER_SNAPSHOT);
  });

  it("renter web — registry builder matches snapshot", () => {
    expect(
      stepSnapshot(buildOnboardingFlowFromOptions({ primaryRole: "renter", platform: "web" }))
    ).toEqual(RENTER_SNAPSHOT);
  });

  it("renter mobile — public API matches snapshot", () => {
    expect(stepSnapshot(getOnboardingStepsMobile({ primaryRole: "renter" }))).toEqual(
      RENTER_SNAPSHOT
    );
  });

  it("brokerage web — shell onboarding snapshot", () => {
    expect(stepSnapshot(getOnboardingSteps({ primaryRole: "brokerage" }))).toEqual([
      { id: "onboarding_role", title: "Who I am" },
      { id: "brokerage_shell_setup", title: "Brokerage setup" },
    ]);
  });

  const INTEGRATION_PARTNER_SNAPSHOT = [
    { id: "onboarding_role", title: "Who I am" },
    { id: "ip_org_details", title: "Organization" },
    { id: "ip_integration_type", title: "Service type" },
    { id: "ip_point_of_contact", title: "Contact" },
    { id: "ip_service_area", title: "Service area" },
    { id: "ip_agreement", title: "Agreement" },
  ];

  it("integration partner web — SIL-193 five-step onboarding snapshot", () => {
    expect(stepSnapshot(getOnboardingSteps({ primaryRole: "integration_partner" }))).toEqual(
      INTEGRATION_PARTNER_SNAPSHOT
    );
  });

  it("integration partner web — registry builder matches SIL-193 snapshot", () => {
    expect(
      stepSnapshot(
        buildOnboardingFlowFromOptions({
          primaryRole: "integration_partner",
          platform: "web",
        })
      )
    ).toEqual(INTEGRATION_PARTNER_SNAPSHOT);
  });

  it("integration partner mobile — public API matches SIL-193 snapshot", () => {
    expect(
      stepSnapshot(getOnboardingStepsMobile({ primaryRole: "integration_partner" }))
    ).toEqual(INTEGRATION_PARTNER_SNAPSHOT);
  });
});
