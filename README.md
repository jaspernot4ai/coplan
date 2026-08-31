# CoPlan

Multiplayer itinerary planning where each traveler brings their own AI agent.

**Live demo:** https://coplan.coplan-lab.workers.dev

Open `https://coplan.coplan-lab.workers.dev/r/<any-room-name>?as=<your-name>` — anyone with the link joins the same room. Add `?seed=1` on an empty room to load a sample 3-day Tokyo itinerary with a deliberate scheduling conflict and priced items ready for checkout.

## Highlights

- **Multi-user real-time collaboration** — every traveler and every traveler's agent edit the same itinerary over one WebSocket-backed Durable Object per room; every change (human or agent) shows up on all screens instantly.
- **Deterministic conflict detection** — overlapping activities on the same day are flagged the moment they're saved, using plain interval-overlap math, not an LLM call. No hallucination risk, no latency.
- **Cross-session payment approval** — an agent can build a checkout request, but it can never be the one to approve it. The browser tab that requested checkout literally never renders an "Approve" button; approval has to happen from a different device or a different member's screen.

## WebMCP tools

Registered once per session (works whether the browser exposes `document.modelContext` or `navigator.modelContext` — see "What we learned" below).

| Tool | What it does |
|---|---|
| `list_itinerary` | Reads every item currently on the shared itinerary (day, time, title, type, who proposed it). |
| `add_activity` | Adds a new item to the itinerary on behalf of the current user. Visible to all members in real time. |
| `update_activity` | Updates the time, title, or type of an existing item. Still applies even if it creates a conflict — the conflict just gets flagged. |
| `remove_activity` | Removes an item. Affects everyone, including items other travelers proposed. |
| `get_budget_status` | Looks up the current user's budget limit and pending spend, so an agent can check before adding a priced item. |
| `request_checkout` | Bundles all priced, unpaid items into a pending checkout request. Cannot complete payment under any circumstances (see below). |

## How it works

Humans and agents never get separate code paths. A human clicking "Add" in the UI and an agent calling the `add_activity` tool both end up calling the exact same JavaScript function, which sends the exact same WebSocket message to the exact same server handler. Neither side has a shortcut the other doesn't have — so what the human sees is always exactly what the agent did, and vice versa.

```
                    ┌─ human clicks a button ──────┐
                    │                               ▼
                    │                      action-layer function
Chrome / ChatGPT ───┤                      (addActivity, updateActivity,
 agent calls a tool ┘                       requestCheckout, ...)
                                                     │
                                                     ▼
                                          one WebSocket message
                                                     │
                                                     ▼
                                    RoomDO (Durable Object, one per room)
                                    — validates, applies, detects conflicts,
                                      logs to the audit timeline, persists —
                                                     │
                                                     ▼
                                    broadcasts full room state to every
                                    connected tab (human or agent-driven)
```

The one deliberate exception is payment: `approve_checkout` only exists as a button in the UI, never as a WebMCP tool, and the server additionally refuses an approval that comes from the same browser session that requested the checkout. That boundary is structural, not a matter of the agent choosing to behave.

## What we learned building this

1. **`document.modelContext` vs `navigator.modelContext` is a real platform split, not a typo to "clean up".** Chrome currently exposes `navigator.modelContext` (already marked deprecated as the spec moves toward `document`), while the ChatGPT desktop app's built-in browser only exposes `document.modelContext`. Every tool-registration check in this codebase uses `document.modelContext || navigator.modelContext || window.modelContext` — dropping either branch silently breaks one platform.
2. **A UI-disabled button is not a security boundary once an agent can operate the browser.** ChatGPT's desktop browser doesn't only call registered tools — it can also move the mouse and click, with `isTrusted: true` events indistinguishable from a real user. We initially assumed keeping "Approve payment" out of the WebMCP tool list was enough. It isn't: an agent asked to "confirm the payment" can just click the disabled-looking button anyway if it's present in the DOM. The only boundary that actually holds is not rendering the element at all in the session that requested it, and having the server independently reject an approval from that same session. This is why checkout approval is *cross-session*, not merely *cross-tool*.

## Known trade-offs (by design, for a hackathon demo)

- **No authentication.** A room is only as private as its URL — anyone with the link can join, read, and edit as any name they choose. This is a link-sharing product decision (same as a shared Google Doc), not an oversight, but it means don't put anything sensitive in a room.
- **Prices are self-reported**, not pulled from a real product catalog, and checkout is demo-mode only — no real payment processor is connected. Items are marked `paid` for demonstration purposes.
- **The server enforces a field whitelist, per-item and per-approval capacity limits, and a per-connection message rate limit** specifically because tool-driven clients can call far faster than a human ever would — see the audit timeline (`limit_reached`, `checkout_limited`) for what happens when those limits are hit.

## Local development

```bash
npm install
npx wrangler dev
```

Opens on `http://127.0.0.1:8787`. To exercise WebMCP tool calls locally in Chrome, enable `chrome://flags/#enable-webmcp-testing`, set it to Enabled, and fully restart the browser (an Origin Trial token is only needed for the deployed domain, not localhost).

## Tech stack

Cloudflare Workers + Durable Objects (one Durable Object instance per room, providing both the real-time WebSocket fan-out and the persistence layer), a single-page vanilla JS frontend with no build step or framework, and WebMCP for agent tool access.

## License

MIT — see [LICENSE](LICENSE).
