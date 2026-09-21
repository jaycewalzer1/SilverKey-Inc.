import { describe, expect, it } from "vitest";

import type { OnboardingData } from "packages/features/profile/types/onboarding/onboarding";

import { isStepCompleteForOnboarding } from "./stepCompletion";

describe("isStepCompleteForOnboarding — integration partner (SIL-193)", () => {
  it("requires non-empty org name for ip_org_details", () => {
    expect(isStepCompleteForOnboarding({}, "ip_org_details")).toBe(false);
    expect(isStepCompleteForOnboarding({ ip_org_name: "   " }, "ip_org_details")).toBe(false);
    expect(
      isStepCompleteForOnboarding({ ip_org_name: "Better Mortgage" }, "ip_org_details")
    ).toBe(true);
  });

  it("requires non-empty integration type for ip_integration_type", () => {
    expect(isStepCompleteForOnboarding({}, "ip_integration_type")).toBe(false);
    expect(
      isStepCompleteForOnboarding({ ip_integration_type: "title" }, "ip_integration_type")
    ).toBe(true);
  });

  it("requires both contact name and email for ip_point_of_contact", () => {
    expect(isStepCompleteForOnboarding({}, "ip_point_of_contact")).toBe(false);
    expect(
      isStepCompleteForOnboarding(
        { ip_contact_name: "Alex", ip_contact_email: "" },
        "ip_point_of_contact"
      )
    ).toBe(false);
    expect(
      isStepCompleteForOnboarding(
        { ip_contact_name: "Alex", ip_contact_email: "alex@example.com" },
        "ip_point_of_contact"
      )
    ).toBe(true);
  });

  it("requires at least one service state for ip_service_area", () => {
    expect(isStepCompleteForOnboarding({}, "ip_service_area")).toBe(false);
    expect(isStepCompleteForOnboarding({ ip_service_states: [] }, "ip_service_area")).toBe(
      false
    );
    expect(
      isStepCompleteForOnboarding({ ip_service_states: ["GA"] }, "ip_service_area")
    ).toBe(true);
  });

  it("requires explicit agreement acknowledgment for ip_agreement", () => {
    expect(isStepCompleteForOnboarding({}, "ip_agreement")).toBe(false);
    expect(
      isStepCompleteForOnboarding({ ip_agreement_acknowledged: false }, "ip_agreement")
    ).toBe(false);
    expect(
      isStepCompleteForOnboarding({ ip_agreement_acknowledged: true }, "ip_agreement")
    ).toBe(true);
  });
});

describe("isStepCompleteForOnboarding — shared edge cases", () => {
  it("treats unknown step ids as complete (no gate)", () => {
    expect(isStepCompleteForOnboarding({}, "not_a_real_step")).toBe(true);
  });

  it("requires non-empty location addresses for location step", () => {
    const incomplete: OnboardingData = {
      important_locations: [{ address: "  " }],
    };
    const complete: OnboardingData = {
      important_locations: [{ address: "123 Main St" }],
    };
    expect(isStepCompleteForOnboarding(incomplete, "location")).toBe(false);
    expect(isStepCompleteForOnboarding(complete, "location")).toBe(true);
  });

  it("requires housing type that parses to at least one value", () => {
    expect(
      isStepCompleteForOnboarding(
        {
          preferred_bedrooms_min: 3,
          preferred_bathrooms_min: 2,
          preferred_housing_type: "",
        },
        "housing_essentials"
      )
    ).toBe(false);
    expect(
      isStepCompleteForOnboarding(
        {
          preferred_bedrooms_min: 3,
          preferred_bathrooms_min: 2,
          preferred_housing_type: "single_family",
        },
        "housing_essentials"
      )
    ).toBe(true);
  });
});
