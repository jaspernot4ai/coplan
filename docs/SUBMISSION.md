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
  different device **and** the same person who requested it — a fellow traveler cannot
  approve someone else's payment, only the user's own phone or second browser can.

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

The rule is now two conditions, both server-side:

1. **A different device**, not merely a different tab — enforced with a second identifier
   (`deviceId`) that's generated once and persisted in `localStorage`, so every tab in the
   same browser profile shares it and a new tab no longer gets a free pass.
2. **The same person who requested it** — a fellow traveler's window can see that a payment
   is pending, but renders no approve button at all, only the option to decline.

- **Traveling together** — a fellow traveler can see a payment is pending and can decline
  it (declining is safe, it moves no money), but cannot approve someone else's payment.
- **Traveling alone** — the user approves on their **own phone or second browser**, opening
  the same room URL under their own name. This is the flow everyone already knows from bank
  3-D Secure prompts.

The declared tool surface tells the agent this in words too, so a cooperative agent guides
the user to the right device instead of hunting for a button that isn't there. But the
words are a courtesy; the structure is the boundary — and even the structure has an honest
edge documented under "Known limits" below, not hidden.

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

- **Hardware-backed device binding** (WebAuthn / passkey) so approval is tied to something a
  device can prove via the OS/TPM-backed platform authenticator, rather than a `localStorage`
  value a fresh browser profile can simply not have. This closes the identity-forgery gap
  described under "Known limits" below — a real account/credential system, not just a bigger
  random id.
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
- **`deviceId` falls back to a fresh random value if `localStorage` is unavailable** (some
  private-browsing modes, storage permission denied) — this silently reproduces the original
  weak per-tab behavior described above. Not a hypothetical edge case; worth knowing before
  demoing on a locked-down browser.
- **An agent that can open a private window or a second browser profile** gets a fresh
  `deviceId` and can legitimately re-declare the same name it already had — passing both
  checks. Harder than opening a second tab, not impossible.
- **Identity is a URL parameter, not a credential.** Forging `?as=<someone else's name>`
  from the *same* device you already used doesn't help (the device check still catches
  you), but forging it from a genuinely different device is not defended against — there is
  no account system to tell a real "Cindy" apart from anyone claiming to be Cindy on their
  own phone.
- **An agent that controls every one of your devices** defeats device-bound approval
  entirely — but that is a fully compromised-device threat model, not the one this project
  addresses.
