/**
 * Hook returning brokerage analytics overview + agents filtered by time period.
 * TanStack Query wrapper — real API when brokerageOrgId available, fixtures otherwise.
 * SIL-207: adapters transform server envelope → UI DTOs.
 */
import { useQuery } from "@tanstack/react-query";
import {
  fetchAgentAnalytics,
  fetchBrokerageAnalyticsOverview,
} from "packages/features/brokerage/api/analytics";
import {
  adaptAgentsResponse,
  adaptOverviewResponse,
} from "packages/features/brokerage/utils/analytics/analyticsApiAdapters";
import {
  buildBrokerageAgents,
  buildBrokerageAnalyticsData,
} from "packages/features/brokerage/utils/analytics/overviewTransforms";
import type { TimePeriod } from "packages/features/brokerage/utils/analyticsPeriod";
import { useBrokerageOrgId } from "./useBrokerageOrgId";

export type { TimePeriod };
export {
  buildBrokerageAgents,
  buildBrokerageAnalyticsData,
} from "packages/features/brokerage/utils/analytics/overviewTransforms";

function overviewResult(period: TimePeriod) {
  return {
    data: buildBrokerageAnalyticsData(period),
    agents: buildBrokerageAgents(period),
  };
}

export function useBrokerageAnalytics(period: TimePeriod = "all") {
  const brokerageOrgId = useBrokerageOrgId();
  const query = useQuery({
    queryKey: ["brokerage-analytics", "overview", brokerageOrgId, period],
    queryFn: brokerageOrgId
      ? async () => {
          const [overviewRes, agentsRes] = await Promise.all([
            fetchBrokerageAnalyticsOverview({ brokerageOrgId, timeline: period }),
            fetchAgentAnalytics({ brokerageOrgId, timeline: period }),
          ]);
          return {
            data: adaptOverviewResponse(overviewRes as Record<string, unknown>, period),
            agents: adaptAgentsResponse(agentsRes as Record<string, unknown>, period),
          };
        }
      : async () => overviewResult(period),
    placeholderData: () => overviewResult(period),
    staleTime: 60_000,
  });
  return {
    data: query.data?.data ?? buildBrokerageAnalyticsData(period),
    agents: query.data?.agents ?? buildBrokerageAgents(period),
    isLoading: query.isLoading && !query.data,
    error: query.error ?? null,
  };
}