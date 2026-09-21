/**
 * Adapt server brokerage analytics envelopes → UI DTOs (SIL-207).
 * Pure transforms so API snake_case / status thresholds stay unit-testable.
 */
import {
  buildBrokerageAgents,
  buildBrokerageAnalyticsData,
} from "packages/features/brokerage/utils/analytics/overviewTransforms";
import type { TimePeriod } from "packages/features/brokerage/utils/analyticsPeriod";

/**
 * Adapt server overview envelope → BrokerageAnalyticsOverview UI shape.
 * Server returns { success, overview: {...}, transaction_funnel: [...], agent_performance: [...] }
 * We merge into the fixture shape so the UI never sees missing fields.
 */
export function adaptOverviewResponse(serverData: Record<string, unknown>, period: TimePeriod) {
  const fixture = buildBrokerageAnalyticsData(period);
  const serverOverview = (serverData.overview as Record<string, unknown>) ?? {};
  return {
    ...fixture,
    overview: {
      ...fixture.overview,
      activeAgents: (serverOverview.active_agents as number) ?? fixture.overview.activeAgents,
      openTransactions:
        (serverOverview.open_transactions as number) ?? fixture.overview.openTransactions,
      atRiskCount: (serverOverview.at_risk_agents as number) ?? fixture.overview.atRiskCount,
    },
    transactionFunnel: Array.isArray(serverData.transaction_funnel)
      ? (
          serverData.transaction_funnel as {
            stage: string;
            count: number;
            drop_off_percent?: number;
          }[]
        ).map((s) => ({
          stage: s.stage,
          count: s.count,
          dropOffPercent: s.drop_off_percent ?? 0,
          weightedForecast: s.count,
        }))
      : fixture.transactionFunnel,
  };
}

/**
 * Adapt server agents envelope → BrokerageAnalyticsAgent[] UI shape.
 * Server returns { success, agents: [{agent_id, name, active_clients, closings}] }
 */
export function adaptAgentsResponse(serverData: Record<string, unknown>, period: TimePeriod) {
  const fixtureAgents = buildBrokerageAgents(period);
  if (!Array.isArray(serverData.agents) || serverData.agents.length === 0) {
    return fixtureAgents;
  }
  return (
    serverData.agents as {
      agent_id: string;
      name: string;
      active_clients: number;
      closings: number;
    }[]
  ).map((a, i) => {
    const fixture = fixtureAgents[i % fixtureAgents.length];
    return {
      ...fixture,
      id: a.agent_id,
      name: a.name,
      activeClients: a.active_clients,
      closings: a.closings,
      status: (a.closings >= 30 ? "top" : a.closings <= 5 ? "at_risk" : "healthy") as
        | "top"
        | "at_risk"
        | "healthy",
      stall: fixture?.stall ?? null,
    };
  });
}
