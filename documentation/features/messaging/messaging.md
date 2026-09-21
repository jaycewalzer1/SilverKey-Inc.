# Messaging feature

> **Status:** Shipped for buyer/seller/agent (agent–client stack) and brokerage/integrator/admin (workspace stack)  
> **Last verified:** 2026-07-31  
> **Code:** `Client/packages/features/messaging/`, `Server/app/routes/conversations/`, `Server/app/routes/agent/` (legacy chats)

Unified messaging across two stacks:

| Stack | Personas | API |
| ----- | -------- | --- |
| Agent–client | buyer, seller, agent | `/api/v1/agent/chats/*` |
| Workspace | brokerage, integrator, admin support | `/api/v1/conversations/*` |

Workspace mapping: `getMessagingSurfaceForWorkspace` in `Client/packages/utils/comms/messaging/`. Seller uses the agent–client stack with a seller copy overlay (`ClientMessaging`), not a placeholder page. Brokerage uses `BrokerageMessaging` / workspace hooks.

Eligible contacts power new thread creation for brokerage↔agent and integrator↔brokerage threads.

## Architecture

- Persona matrix: [persona-variations.md](../../architecture/messaging/persona-variations.md)
- Workspace API: [workspace-conversations.md](../../architecture/messaging/workspace-conversations.md)
- SSE (three web hooks, dual stream URLs, mobile gap): [sse.md](../../architecture/messaging/sse.md)

## Calendar event requests

From agent–client threads, users can send a structured **Request Calendar Event** message (`__EVENT_REQUEST__` prefix), with recipient prefill from the open conversation. Web reuses the create-event modal; native uses a dedicated form. Accept/cancel is `PATCH …/event-request-status`. Details: [calendar-event-requests.md](./calendar-event-requests.md).

## Ops

Runbook: [messaging-sse-operations.md](../../runbooks/messaging-sse-operations.md).
