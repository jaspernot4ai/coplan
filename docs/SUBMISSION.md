# Devpost Submission Draft — CoPlan

> 提交表單直接複製這裡的英文內容。中文註記是給你看的，不要貼進表單。

---

## Project name

**CoPlan**

## Tagline（一句話，Devpost 會顯示在卡片上）

Multiplayer trip planning where every traveler brings their own AI agent —
and the payment step is one your agent structurally cannot take.

## Try it

- **Live demo**: https://coplan.coplan-lab.workers.dev/r/tokyo?as=You&seed=1
- **Source**: https://github.com/jaspernot4ai/coplan
- Works in **Chrome 149+** (origin trial token included — no flags needed)
  and in the **ChatGPT desktop app's built-in browser** (GPT-5.6 Sol or Terra).
- To try it with a friend, open the same room with a different name:
  `.../r/tokyo?as=Alex` — or just open it on your phone as a second participant.

---

## Inspiration

Every AI agent today works alone. My agent can plan my trip and your agent can plan
yours, but they cannot sit at the same table and plan *our* trip. The web has no shared
surface for that — agents are stuck screenshotting pages and guessing where the buttons are.

WebMCP changes the shape of the problem: a page can declare what it can do, and any
agent that visits can call those capabilities directly. So I asked a narrower question:
**what does an application look like when it is designed from the start for several
people and several agents to work on the same document at the same time?**

CoPlan is the answer to that question, built around a trip that three friends plan together.

---

## What it does

A shared itinerary board that lives in a room URL. Every traveler opens the same link
with their own name, and every traveler can bring their own AI agent.

- **Agents edit the real board.** Six WebMCP tools let an agent read the itinerary,
  add, edit and remove activities, check the traveler's budget, and request checkout.
  Every call moves the same shared state everyone else is looking at, live.
- **Conflicts surface instantly.** Overlapping time slots are detected with deterministic
  code — no model call, no hallucination, no latency. The system marks the conflict and
  then gets out of the way: it never decides for the group, it makes the problem visible
  so a human can resolve it.
- **Every agent action is on an audit timeline.** Who did it, when, which tool, what changed,
  and whether it came from a person or an agent. The timeline is not a debug panel —
  it is the part of the interface that makes agent collaboration trustworthy.
- **Payment is the one thing an agent cannot do.** An agent can price the trip, gather the
  bookings and submit a checkout request. It cannot approve it. Approval must come from a
  different device than the one that requested it, enforced server-side against an
  `HttpOnly` cookie the agent's own JavaScript can never read or forge — the UI further
  guides approval to the same person who requested it, though that part is a courtesy, not
  a server-enforced guarantee (see "Challenges I ran into" below).

---

## How I built it

**Cloudflare Workers + Durable Objects, vanilla JavaScript, no framework.**

One room equals one Durable Object instance. Durable Objects serialize every incoming
message on a single thread, which means several agents writing to the same itinerary at
the same moment cannot interleave — the race condition is solved by the architecture
rather than by locks I would have to get right. State is broadcast to every connected
member over WebSocket and persisted to the object's own storage.

**The architectural rule that everything else follows from:**

```
[human clicks a button]  ┐
                         ├──→ addActivity() ──→ ws.send() ──→ Durable Object ──→ broadcast
[agent calls a tool]     ┘
```

A WebMCP tool's `execute` is only an adapter. It calls the exact same named function the
UI button calls. There is no agent-only code path and no agent-only back door, so people
and agents provably see the same truth — and it means the whole application can be tested
without an agent present.

`viaAgent` is decided by that entry function's parameter (the button passes `false`, the
tool passes `true`), so an agent cannot misreport itself in the audit log.

---

## Challenges I ran into

### 1. The same API lives in two different places

Chrome exposes `navigator.modelContext`. The ChatGPT desktop app's built-in browser
exposes `document.modelContext`. Checking only one silently loses the other platform —
the browser reports "WebMCP detected, but this page exposes no tools", which reads like
your own bug. Chrome 151 additionally logs a deprecation warning pointing at `document`,
so the spec is converging there.

```js
const mc = document.modelContext || navigator.modelContext || window.modelContext;
```

Detection also has to poll rather than run once on load — the object can be injected
after the page has finished loading, and a one-shot check freezes on the wrong answer.

### 2. My payment gate did not actually work — and finding out changed the design

The first version put the "Approve payment" button behind a rule that only the requesting
user could press it. I demoed it, said *"press confirm"* to the agent, and it pressed the
button. The gate was theatre.

An agent driving a browser is not limited to the tools you declared. It clicks. And you
cannot detect it: events injected through the browser's debugging protocol arrive with
`isTrusted === true`, indistinguishable from a human click. Sniffing for automation
signals is an arms race that would also block the exact platform this project targets.

**The only durable boundary is one the agent's session cannot reach.** So the rule became:

> The session that requested a payment may not approve it — and in that session
> the approve button is never rendered at all. Not disabled: absent from the DOM.

At the time I believed "another session" was the boundary, and shipped it that way: a
`sessionId` generated fresh on every page load, deliberately never persisted, checked
server-side against the session that made the request.

**That belief was also wrong, and I only found out by trying to break it again.** The
reasoning for never persisting `sessionId` was "persisting it would let a new tab share
the same id, which would weaken the boundary" — backwards. Not persisting it is exactly
what let a *new tab* look like a *different session* to the server. I asked ChatGPT desktop
to open a new tab and approve its own checkout request. It did, and the payment went
through, with zero code changes on its side — the "boundary" was never a device boundary,
it was a per-tab counter. On top of that, the original rule had no identity check at all:
*any* other session could approve — including a different member entirely, spending
someone else's money without them knowing.

**The second attempt fixed "new tab" but repeated the same mistake in a different place.**
I added a second identifier, `deviceId`, generated once and persisted in `localStorage` so
every tab in the same browser profile would share it — a new tab no longer got a free pass.
But `deviceId` was still just a value inside the WebSocket message, read from `localStorage`
by client-side JavaScript and sent as `msg.deviceId`. An agent that can execute JavaScript
on the page — which is exactly the agent this project is built for — can read
`localStorage.getItem("coplan-device")` and send whatever value it wants in that field.
The server was still trusting the client to self-report its own identity; I had just made
the self-report a little harder to accidentally trigger, not impossible to forge on purpose.
I never demonstrated this exploit on camera the way I did the `sessionId` one, but the
reasoning is the same reasoning that broke the first version, and it would have broken this
one just as completely. I caught it in review, not in a live test — which is itself a lesson
about where in the client-server boundary trust actually has to live.

**The fix was to stop trusting the message content at all.** Device identity now comes from
something the page's own JavaScript cannot read or write: an `HttpOnly` cookie the server
issues from a new `GET /api/device` endpoint. The frontend calls it once, before opening the
WebSocket, purely so the browser has a chance to store the cookie — the response never hands
the id back to JavaScript. The Worker parses that cookie on every `/api/room/:name` request
and forwards the device id to the Durable Object through a header it sets itself, overwriting
whatever the same-named header on the inbound request might already contain, so a client
can't just send its own `X-Coplan-Device` value and skip the cookie step. Inside the Durable
Object, `webSocketMessage` never reads `msg.sessionId` or `msg.deviceId` again — device
identity is attached to the WebSocket connection itself, once, in `fetch()`, using the
Hibernatable WebSockets API's `serializeAttachment` (a plain in-memory `Map` would have been
wiped whenever Cloudflare hibernates an idle Durable Object; the attachment survives that).

This closes the class of bug that broke the first two versions — the server no longer asks
the client "who are you," it just reads a value the client's JavaScript was never given
in the first place.

**One more honest trade-off came out of getting this right.** The old design also checked
`msg.by === requestedBy` — "is the approver the same person who requested it" — and blocked
otherwise. I removed that check server-side. `msg.by` is a name the client puts in the
message; there's no account system behind it, so treating it as an authorization boundary
never protected anything real, it just *looked* like it did. Keeping a check that can't
actually stop a determined bypass, once I understood it couldn't, felt worse than removing
it: it would have been advertising a guarantee the code didn't provide. So the rule split in
two, deliberately:

1. **A different device — enforced by the server, and the only thing it actually enforces.**
   The `HttpOnly` cookie is the boundary an in-browser agent's JavaScript cannot reach.
2. **The same person who requested it — expressed in the UI, not enforced by the server.**
   A fellow traveler's window renders no approve button for a payment they didn't request
   (only the option to decline), which is enough to stop the button from being clicked by
   accident or by a cooperative agent following instructions. It does **not** stop a fellow
   traveler's own agent from sending the raw WebSocket message directly — the server would
   accept it, because from a different device it looks identical to the intended flow. That
   gap is real, documented under "Known limits" below, and was a deliberate choice over
   pretending a forgeable field was a real check.

- **Traveling together** — a fellow traveler can see a payment is pending and can decline
  it (declining is safe, it moves no money) or approve it, since the server does not verify
  who they are — only that they're on a different device than the one that requested it. The
  UI never offers them the approve button, so this requires bypassing the interface on
  purpose; it is not something the normal app flow lets anyone stumble into.
- **Traveling alone** — the user approves on their **own phone or second browser**, opening
  the same room URL under their own name. This is the flow everyone already knows from bank
  3-D Secure prompts, and it's the only flow the UI actually offers.

The declared tool surface tells the agent this in words too — the `request_checkout` tool's
description says approval must come from a different device, and stops short of claiming
the server verifies *who* approves, because it doesn't. A cooperative agent guides the user
to the right device instead of hunting for a button that isn't there. But the words are a
courtesy; the device boundary is the one piece of structure that actually holds — and even
that structure has an honest edge documented under "Known limits" below, not hidden.

### 3. Interfaces built for agents need tighter quotas than interfaces built for people

A person will not click "add" a thousand times in a minute. An agent will — especially a
prompt-injected one. Reviewing my own tools I found the same pattern repeatedly: limits
that are implicitly enforced by human patience simply do not exist for agents. Items,
pending approvals and message rates all needed explicit ceilings.

### 4. Tool descriptions are behavior design, not documentation

Writing *"call this before adding anything, to avoid clashing with other people's plans"*
into the read tool's description made the agent consistently read the board before acting.
Writing *"everyone in the room sees this immediately"* made it propose first and ask for
confirmation before writing — behavior I never coded. The description field is the most
leveraged surface in a WebMCP integration.

---

## Accomplishments I'm proud of

- A gate that holds because of **structure**, not because a prompt asked an agent to behave.
- Conflict detection that is fully deterministic — the parts of an agentic app that must
  be right do not need a model.
- Human and agent share a single code path, which makes the audit trail meaningful rather
  than decorative.
- I reviewed my own WebMCP surface as an attack surface (privilege, traversal, injection,
  quotas, tool composition, replay, exfiltration) and wrote the findings down in the repo
  under `docs/` — including the ones I chose not to fix, and why.

---

## What I learned

The interesting question in the agentic web is not *what can I let the agent do* —
it is *where does the agent's reach end, and can I prove it*.

A tool you did not declare is not a capability the agent lacks; it may still reach it by
driving the page. Real boundaries are the ones the agent's session cannot cross: another
session, another device, another person. Everything else is a request for good behavior.

---

## What's next for CoPlan

- **Hardware-backed device binding, plus real identity.** (WebAuthn / passkey) so approval is
  tied to something a device can prove via the OS/TPM-backed platform authenticator, rather
  than a cookie any fresh browser profile or private window can simply not have. This is
  also the only way to close the identity gap under "Known limits" below — the server
  currently doesn't check identity at all for approvals, on purpose, because a self-reported
  name was never a real check; a credential system is what would make checking identity
  server-side actually meaningful instead of theatre.
- **Real inventory and payments.** Prices are user-entered estimates today; with a real
  catalogue, price must be resolved server-side from the catalogue and never accepted from
  the client or the agent.
- **An authentication layer.** Identity is currently a name in the URL — deliberately, so
  judges and travelers can join with one click. The code keeps identity behind a single
  `me()` seam so this can be replaced without touching anything else.
- **Server-side validation and a permission model**, both intentionally out of scope for a
  10-day build.

---

## Built with

`webmcp` · `cloudflare-workers` · `durable-objects` · `websockets` · `javascript` · `html` · `css`

---

## 已知限制（誠實揭露，建議放在 README 與提交說明末段）

These are deliberate scope decisions for a 10-day hackathon build, listed so they are not
mistaken for oversights:

- **No authentication.** Anyone with the room link can join under any name.
- **The room URL is the access token.** There is no access control beyond knowing it.
- **The server does not validate field types or ranges** beyond an allow-list that protects
  the payment flag.
- **Payments are simulated.** No real money moves; items are marked paid in DEMO mode.
- **The server no longer checks identity at all for approvals — only device.** Earlier
  designs checked `msg.by === requestedBy` and blocked otherwise; that check was removed
  deliberately once I recognized it was authorizing against a value the client fully
  controls, which never protected anything real. A genuinely different device can approve
  *anyone's* payment under *any* name it claims — the UI never offers that path to a normal
  user (only the requester's own name gets an approve button, on a different device), but a
  fellow traveler's own agent sending the raw WebSocket message directly is not stopped by
  the server. This is a real, current limit, not a hypothetical one.
- **The device credential falls back to a fresh random value if no cookie is presented at
  all** — this happens for a client that skips the browser's normal cookie handling
  entirely (a bare script talking the WebSocket protocol directly, not a real browser tab),
  or a browser configured to block cookies outright. Every such connection looks like a
  brand-new "device" to the server, which trivially satisfies the "different device" check.
  This does **not** apply to an agent operating inside a real browser tab — the browser
  attaches the `HttpOnly` cookie to the WebSocket handshake automatically, and the agent's
  JavaScript has no way to see or omit it.
- **An agent that can open a private/incognito window or a second browser profile** gets a
  cookie jar with no `coplan_device` cookie yet, so the server issues it a fresh one —
  a legitimately different device by the server's own definition, and (per the point above)
  it doesn't even need to claim the right name to use it. Meaningfully harder than opening a
  second tab in the same profile, not impossible.
- **An agent that controls every one of your devices** defeats device-bound approval
  entirely — but that is a fully compromised-device threat model, not the one this project
  addresses.
