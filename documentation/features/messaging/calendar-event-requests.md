# Calendar event requests (from messaging)

> **Status:** Shipped (web + native messaging)  
> **Last verified:** 2026-07-31  
> **Code:** `Client/packages/features/agent/…/calendarEventRequest/`, `Client/packages/features/calendar/hooks/data/createEvent/`, `Client/packages/utils/comms/messaging/`, `Server/app/services/agent/conversation/event_requests.py`

Agents and clients request a calendar event **as a structured chat message** from messaging. Accept/cancel updates a message status field; creating a Google Calendar event is a separate flow (calendar create modal without `calendarEventRequest`).

There is no dedicated calendar feature hub under `documentation/features/` — this page covers the messaging-originated request path only.

## Intent

From an open agent–client thread, open “Request Calendar Event”, prefill the recipient from the active conversation, collect title/schedule/location, and send a message whose first line is machine-parsable so the thread can render an event-request card and later accept/cancel it.

## Platforms (important split)

| Surface | Modal | Form / submit |
|---------|--------|----------------|
| **Web** | `CalendarEventRequestModal.tsx` | Reuses `useCreateEventModal` + `CreateEventModalForm` with `calendarEventRequest` integration; title “Request Calendar Event” |
| **Native** | `CalendarEventRequestModal.native.tsx` | `CalendarEventRequestFormCore.native` + `useCalendarEventRequestForm` (dedicated RN form; fixed 30‑minute duration) |

Shared payload builder (web submit path):  
`packages/utils/comms/messaging/buildEventRequestPayloadFromCreateFormState.ts`  
(re-exported from `packages/features/messaging/utils/`).

Wire format helpers:  
`packages/utils/comms/messaging/eventRequestPayload.ts` (`buildEventRequestMessage`, `parseEventRequestPayload`).

## Entry points and prefill

| Opener | Prefill props |
|--------|----------------|
| Web agent messaging | `MessagingModals` gets `initialClientId={selectedClientId}` and `activeConversationId` from `AgentMessaging` |
| Web client messaging | Same modals; `activeConversationId` routes submit to the open thread |
| Native overlays | `MessagingScreenNativeOverlays.native` passes `initialClientId` / `activeConversationId` into the native modal |

**Agent prefill:** `initialClientId` sets the Client picker so “Send Request” is not stuck disabled when opened from an existing thread (`useCreateEventModal` / `useCalendarEventRequestForm` effects).

**Client/buyer routing:** prefer `activeConversationId`; fall back to `conversations[0]` if needed. Web shows a toast if no conversation exists.

## Recipient routing (send)

On submit (web `useCreateEventModalSubmitFlow` when `isCalendarEventRequestFlow`):

1. Build `EventRequestPayload` → `buildEventRequestMessage` (prefix + human text).
2. **Agent:** resolve conversation by `client_id`; if none, `conversationId = "new"` and pass `clientIdForAgent` so the chat API can create the thread.
3. **Non-agent:** use `activeConversationId` match or first conversation.
4. Prefer injected `sendCalendarEventMessage` (optimistic messaging); else `sendMessageDirect(conversationId, message, clientId?)`.

Native `useCalendarEventRequestForm.handleSend` follows the same conversation rules but always builds a 30‑minute timed window from a single date+time (no all-day / end-time picker).

## Message wire format

First line (parsed by client and detected by server):

```text
__EVENT_REQUEST__{"title":"...","start":"<ISO>","end":"<ISO>","description":"...","location":"..."}
```

Followed by human-readable body (emoji header, date, time, optional location/description). Constant: `EVENT_REQUEST_PREFIX = "__EVENT_REQUEST__"` (client + server).

On send, server messaging sets `event_request_status = "pending"` when content starts with that prefix (`Server/app/services/agent/conversation/messaging.py`).

## Accept / cancel (server)

| Item | Value |
|------|--------|
| Endpoint | `PATCH /api/v1/agent/chats/messages/{message_id}/event-request-status` |
| Client API | `agentApi.updateEventRequestStatus` → `useEventRequests` |
| Service | `update_event_request_status` in `event_requests.py` |
| OpenAPI | `UpdateEventRequestStatusRequest` + path under agent chats |

Rules:

- Caller must be agent or client on the conversation.
- Message must be an event-request (prefix check).
- **Accept:** only the **recipient** (not sender); status must be `pending`.
- **Cancel:** either party.
- Statuses: `pending` \| `accepted` \| `cancelled` (`pending` is not set via this PATCH).

Accepting does **not** create a Google Calendar event by itself — it updates message status for the card UI. Calendar creation remains the separate Google create path.

## Client-only vs server

| Concern | Where |
|---------|--------|
| Prefill from open thread | Client only (`initialClientId` / `activeConversationId`) |
| Schedule UI, mutual availability (web create modal) | Client (`useCreateEventModal*`, availability hooks) |
| Payload + `__EVENT_REQUEST__` message shape | Client utils; server only detects prefix / stores status |
| Persist message + `event_request_status` | Server chats/messaging |
| Status transitions | Server `event_requests.py` |
| Google Calendar CRUD | Separate calendar APIs — not this request flow |

## Developer pitfalls

1. **Web ≠ native form:** Web reuses the full create-event modal (all-day, start/end, Meet toggle hidden for request flow). Native uses a simpler form and hardcodes end = start + 30 minutes.
2. **Without `initialClientId`, agent web Send stays disabled** until Client is chosen again — always pass the open thread’s client id from messaging.
3. **Do not import chat queries into calendar** unless using the injected `calendarEventRequest` bag — keeps calendar free of messaging subscriptions when unused.
4. **Workspace messaging** (`/api/v1/conversations/*`) is a different stack; this event-request path is agent–client chats (`/api/v1/agent/chats/*`).
5. **Prefix must stay on the first line** — parsers only inspect line 1; human text must follow after a newline.
6. Duplicate builder entry: prefer `packages/utils/comms/messaging/buildEventRequestPayloadFromCreateFormState.ts`; feature folder re-exports it.

## Related

- Messaging overview: [messaging.md](./messaging.md)
- SSE / live updates: [sse.md](../../architecture/messaging/sse.md)
- Brokerage Ask (unrelated NL analytics): [brokerage-analytics.md](../brokerage/brokerage-analytics.md)
