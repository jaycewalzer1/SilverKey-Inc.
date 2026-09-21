import { describe, expect, it } from "vitest";

import { buildBrokerageAgents } from "packages/features/brokerage/utils/analytics/overviewTransforms";

import { adaptAgentsResponse, adaptOverviewResponse } from "./analyticsApiAdapters";

describe("adaptOverviewResponse", () => {
  it("maps snake_case overview KPIs onto the fixture shape", () => {
    const adapted = adaptOverviewResponse(
      {
        overview: {
          active_agents: 12,
          open_transactions: 34,
          at_risk_agents: 5,
        },
      },
      "month"
    );
    expect(adapted.overview.activeAgents).toBe(12);
    expect(adapted.overview.openTransactions).toBe(34);
    expect(adapted.overview.atRiskCount).toBe(5);
  });

  it("falls back to fixture KPIs when server overview fields are missing", () => {
    const adapted = adaptOverviewResponse({ overview: {} }, "month");
    expect(adapted.overview.activeAgents).toBeGreaterThan(0);
    expect(adapted.overview.openTransactions).toBeGreaterThan(0);
  });

  it("maps transaction_funnel drop_off_percent and defaults missing percent to 0", () => {
    const adapted = adaptOverviewResponse(
      {
        transaction_funnel: [
          { stage: "Offer", count: 10, drop_off_percent: 12.5 },
          { stage: "Under contract", count: 7 },
        ],
      },
      "month"
    );
    expect(adapted.transactionFunnel).toEqual([
      { stage: "Offer", count: 10, dropOffPercent: 12.5, weightedForecast: 10 },
      { stage: "Under contract", count: 7, dropOffPercent: 0, weightedForecast: 7 },
    ]);
  });

  it("keeps fixture funnel when server funnel is absent", () => {
    const adapted = adaptOverviewResponse({}, "month");
    expect(adapted.transactionFunnel.length).toBeGreaterThan(0);
  });
});

describe("adaptAgentsResponse", () => {
  it("falls back to fixture agents when server agents are empty", () => {
    const fixtures = buildBrokerageAgents("month");
    expect(adaptAgentsResponse({ agents: [] }, "month")).toEqual(fixtures);
    expect(adaptAgentsResponse({}, "month")).toEqual(fixtures);
  });

  it("maps agent_id / active_clients and classifies status by closings thresholds", () => {
    const adapted = adaptAgentsResponse(
      {
        agents: [
          { agent_id: "a-top", name: "Top Agent", active_clients: 40, closings: 30 },
          { agent_id: "a-ok", name: "Healthy Agent", active_clients: 20, closings: 10 },
          { agent_id: "a-risk", name: "Risk Agent", active_clients: 3, closings: 5 },
        ],
      },
      "month"
    );
    expect(adapted).toHaveLength(3);
    expect(adapted[0]).toMatchObject({
      id: "a-top",
      name: "Top Agent",
      activeClients: 40,
      closings: 30,
      status: "top",
    });
    expect(adapted[1]).toMatchObject({
      id: "a-ok",
      status: "healthy",
      closings: 10,
    });
    expect(adapted[2]).toMatchObject({
      id: "a-risk",
      status: "at_risk",
      closings: 5,
    });
  });
});
