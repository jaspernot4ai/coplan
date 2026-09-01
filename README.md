# CoPlan

Multiplayer itinerary planning where each traveler brings their own AI agent.

**Live demo:** https://coplan.coplan-lab.workers.dev

Open `https://coplan.coplan-lab.workers.dev/r/<any-room-name>?as=<your-name>` — anyone with the link joins the same room. Add `?seed=1` on an empty room to load a sample 3-day Tokyo itinerary with a deliberate scheduling conflict and priced items ready for checkout.

## Highlights

- **Multi-user real-time collaboration** — every traveler and every traveler's agent edit the same itinerary over one WebSocket-backed Durable Object per room; every change (human or agent) shows up on all screens instantly.
- **Deterministic conflict detection** — overlapping activities on the same day are flagged the moment they're saved, using plain interval-overlap math, not an LLM call. No hallucination risk, no latency.
- **Device- and identity-bound payment approval** — an agent can build a checkout request, but it can never be the one to approve it. Approval requires *both* a different device from the one that requested it *and* the same person who requested it — a fellow traveler cannot approve someone else's payment. Both conditions are enforced server-side. (This replaced an earlier, weaker design — see "What we learned" below.)

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

The one deliberate exception is payment: `approve_checkout` only exists as a button in the UI, never as a WebMCP tool, and the server additionally refuses an approval unless it comes from a different device *and* the same person who requested it. That boundary is structural, not a matter of the agent choosing to behave.

## What we learned building this

1. **`document.modelContext` vs `navigator.modelContext` is a real platform split, not a typo to "clean up".** Chrome currently exposes `navigator.modelContext` (already marked deprecated as the spec moves toward `document`), while the ChatGPT desktop app's built-in browser only exposes `document.modelContext`. Every tool-registration check in this codebase uses `document.modelContext || navigator.modelContext || window.modelContext` — dropping either branch silently breaks one platform.
2. **A UI-disabled button is not a security boundary once an agent can operate the browser.** ChatGPT's desktop browser doesn't only call registered tools — it can also move the mouse and click, with `isTrusted: true` events indistinguishable from a real user. We initially assumed keeping "Approve payment" out of the WebMCP tool list was enough. It isn't: an agent asked to "confirm the payment" can just click the disabled-looking button anyway if it's present in the DOM. The only boundary that actually holds is not rendering the element at all in the session that requested it, and having the server independently reject an approval from that same session.
3. **Our own first "cross-session" design didn't survive contact with a real agent.** The first version gated approval on a `sessionId` that's regenerated every page load and never persisted — the reasoning at the time was that persisting it would let a *new tab* share the *same* id, which felt like it would weaken the boundary. That reasoning was backwards. Not persisting it meant every new tab got a brand-new session automatically, and a `sessionId`-only check can't tell the difference between "a different device" and "the same browser, a second tab." We asked ChatGPT desktop to open a new tab and approve its own request — it did, and the payment went through. The fix was to add a second, *persisted* identifier (`deviceId`, stored in `localStorage`) that stays the same across tabs in one browser profile, so a new tab no longer gets a free pass. We also realized the original design had no identity check at all: any *other* session — including a different member entirely — could approve someone else's payment. Approval now requires both a different device **and** the same person who requested it, checked server-side in `approve_checkout`. Both bugs were found by trying to break our own demo before writing this up, not by inspection.

## Known trade-offs (by design, for a hackathon demo)

- **No authentication.** A room is only as private as its URL — anyone with the link can join, read, and edit as any name they choose. Identity (`?as=`) can be forged; forging it from the *same* device you already used doesn't help (the device check still catches you), but forging it from a genuinely different device is not currently defended against — see the payment model's limits below.
- **Prices are self-reported**, not pulled from a real product catalog, and checkout is demo-mode only — no real payment processor is connected. Items are marked `paid` for demonstration purposes.
- **The server enforces a field whitelist, per-item and per-approval capacity limits, and a per-connection message rate limit** specifically because tool-driven clients can call far faster than a human ever would — see the audit timeline (`limit_reached`, `checkout_limited`) for what happens when those limits are hit.
- **The payment model's real boundary is the device, not a verified identity, and that boundary has known limits:**
  - `deviceId` is `localStorage`-backed and generated once per browser profile. If `localStorage` is unavailable (some private-browsing modes, storage permissions denied) it silently falls back to a fresh random id on every page load — which reproduces the original weak behavior described above, not a hypothetical edge case.
  - An agent that can open a private/incognito window or a second browser profile gets a fresh `deviceId` and can legitimately re-declare the same `?as=` name it was already given — this passes both checks and is a real, demonstrated way around the device gate. It is meaningfully harder than opening a second tab, but not impossible.
  - A separate, related gap: because identity is just a URL parameter, someone using a genuinely different device could type the *victim's* name into `?as=` on their own device and pass both checks — the device check doesn't stop this because the device really is different, and the identity check doesn't stop it because there's no account system to tell a real "Cindy" apart from anyone claiming to be Cindy.
  - Closing these properly means binding approval to something a device can prove rather than merely state — WebAuthn (binding to the OS/TPM-backed platform authenticator) is the natural next step, and is out of scope for this hackathon build.
  - **If an agent controls the user's phone as well as their computer**, this entire model fails — that's a full device-compromise threat model, not a payment-approval design problem, and no UI-level fix addresses it.

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
