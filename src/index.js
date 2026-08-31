function toMinutes(hhmm) {
  const [h, m] = String(hhmm).split(":").map(Number);
  return h * 60 + m;
}

// 重算整份行程的衝突狀態：同一天、時間重疊即互相標記
function detectConflicts(items) {
  for (const a of items) a.conflictWith = [];

  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i];
      const b = items[j];
      if (Number(a.day) !== Number(b.day)) continue;

      const overlap =
        toMinutes(a.start) < toMinutes(b.end) &&
        toMinutes(b.start) < toMinutes(a.end);

      if (overlap) {
        a.conflictWith.push(b.id);
        b.conflictWith.push(a.id);
      }
    }
  }
  return items;
}

// 預算計算：把某人所有「有價格」的行程加總。
// 刻意用確定性程式邏輯而非 LLM —— 金額必須永遠算對，且畫面要即時反應，等不起 API 往返。
function spentBy(items, who) {
  return items
    .filter(a => a.createdBy === who && Number(a.price) > 0 && !a.paid)
    .reduce((sum, a) => sum + Number(a.price), 0);
}

// 只接受這些欄位。用白名單而非黑名單——否則 patch 可以塞 paid:true
// 直接繞過付款閘門，而付款閘門是這個作品的核心主張。
const ALLOWED_ACTIVITY_FIELDS = ["type", "day", "start", "end", "title", "note", "price"];
function pickActivityFields(obj) {
  const out = {};
  for (const k of ALLOWED_ACTIVITY_FIELDS) if (obj && k in obj) out[k] = obj[k];
  return out;
}

const MAX_ITEMS = 200;
const MAX_PENDING_APPROVALS = 5;
const MAX_MESSAGES_PER_SECOND = 20;

// ① 房間本體：一個房號 = 一個實例，各自獨立、有記憶
export class RoomDO {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.items = [];
    this.log = [];
    this.members = {};
    // 待人確認的結帳請求。用陣列而非單一物件，之後多人同時發起也能自然支援。
    this.pendingApprovals = [];
    // 極簡限流狀態：ws -> { count, windowStart }。人不會一分鐘點一千次，Agent 會，
    // 開放給 Agent 的介面需要比人類介面更嚴格的配額。只存記憶體，不需要外部服務。
    this.rateLimits = new Map();

    this.ctx.blockConcurrencyWhile(async () => {
      this.items = (await this.ctx.storage.get("items")) || [];
      this.log = (await this.ctx.storage.get("log")) || [];
      this.members = (await this.ctx.storage.get("members")) || {};
      this.pendingApprovals = (await this.ctx.storage.get("pendingApprovals")) || [];
    });
  }

  // 廣播格式集中在這裡，加欄位只要改一個地方
  state() {
    return JSON.stringify({
      items: this.items,
      log: this.log,
      members: this.members,
      pendingApprovals: this.pendingApprovals,
    });
  }

  // 儲存也集中在這裡，避免漏存某一份
  async save() {
    await this.ctx.storage.put("items", this.items);
    await this.ctx.storage.put("log", this.log);
    await this.ctx.storage.put("members", this.members);
    await this.ctx.storage.put("pendingApprovals", this.pendingApprovals);
  }

  addLog(entry) {
    this.log.push({ id: crypto.randomUUID(), at: Date.now(), ...entry });
    if (this.log.length > 100) this.log = this.log.slice(-100);
  }

  async fetch(request) {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    server.send(this.state());
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, message) {
    // 極簡限流：每個連線每秒最多 20 則訊息，超過直接忽略，不回應。
    const now = Date.now();
    let rl = this.rateLimits.get(ws);
    if (!rl || now - rl.windowStart >= 1000) {
      rl = { count: 0, windowStart: now };
      this.rateLimits.set(ws, rl);
    }
    rl.count++;
    if (rl.count > MAX_MESSAGES_PER_SECOND) return;

    const msg = JSON.parse(message);

    if (msg.t === "join") {
      const isNew = !this.members[msg.name];
      this.members[msg.name] = { name: msg.name, lastSeen: Date.now() };
      if (isNew) {
        this.addLog({
          who: msg.name,
          viaAgent: false,
          action: "join",
          summary: `${msg.name} joined the trip`,
        });
      }
      await this.save();
      this.broadcast();
      return;
    }

    if (msg.t === "add") {
      if (this.items.length >= MAX_ITEMS) {
        this.addLog({
          who: msg.activity?.createdBy || msg.by,
          viaAgent: !!(msg.activity?.viaAgent),
          action: "limit_reached",
          summary: `Itinerary is at its ${MAX_ITEMS}-item limit — this item was not added`,
        });
      } else {
        const activity = {
          id: crypto.randomUUID(),
          createdBy: msg.activity.createdBy,
          viaAgent: !!msg.activity.viaAgent,
          ...pickActivityFields(msg.activity),
        };
        this.items.push(activity);
        this.addLog({
          who: activity.createdBy,
          viaAgent: activity.viaAgent,
          action: "add_activity",
          summary: `Added "${activity.title}" to Day ${activity.day} ${activity.start}–${activity.end}`,
        });
      }
    }

    if (msg.t === "update") {
      const a = this.items.find(x => x.id === msg.id);
      if (a) {
        Object.assign(a, pickActivityFields(msg.patch));
        this.addLog({
          who: msg.by,
          viaAgent: msg.viaAgent,
          action: "update_activity",
          summary: `Updated "${a.title}" to Day ${a.day} ${a.start}–${a.end}`,
        });
      }
    }

    if (msg.t === "remove") {
      const a = this.items.find(x => x.id === msg.id);
      if (a) {
        this.items = this.items.filter(x => x.id !== msg.id);
        this.addLog({
          who: msg.by,
          viaAgent: msg.viaAgent,
          action: "remove_activity",
          summary: `Removed "${a.title}"`,
        });
      }
    }

    // 設定個人預算上限。預算屬於「人」而不是「行程」，所以存在 members 上。
    if (msg.t === "set_budget") {
      if (this.members[msg.by]) {
        this.members[msg.by].budget = Number(msg.budget) || 0;
        this.addLog({
          who: msg.by,
          viaAgent: msg.viaAgent,
          action: "set_budget",
          summary: `Set budget limit to NT$${Number(msg.budget).toLocaleString()}`,
        });
      }
    }

    // Agent 的結帳請求：刻意「只產生請求、不完成交易」。
    // 這是整個作品的核心主張 —— 花錢那一步在結構上就不開放給 Agent，
    // 不是靠 prompt 拜託它自律，而是這條路徑根本沒有完成交易的能力。
    if (msg.t === "request_checkout") {
      const sessionAlreadyPending = this.pendingApprovals.some(p => p.requestedBySession === msg.sessionId);

      if (sessionAlreadyPending) {
        this.addLog({
          who: msg.by,
          viaAgent: msg.viaAgent,
          action: "checkout_limited",
          summary: "This device already has a pending checkout request — approve or cancel it before requesting another",
        });
      } else if (this.pendingApprovals.length >= MAX_PENDING_APPROVALS) {
        this.addLog({
          who: msg.by,
          viaAgent: msg.viaAgent,
          action: "checkout_limited",
          summary: "Too many pending checkout requests in this room right now — try again once one is resolved",
        });
      } else {
        const mine = this.items.filter(
          a => a.createdBy === msg.by && Number(a.price) > 0 && !a.paid
        );
        const total = mine.reduce((sum, a) => sum + Number(a.price), 0);
        const budget = Number(this.members[msg.by]?.budget) || 0;

        this.pendingApprovals.push({
          id: crypto.randomUUID(),
          requestedBy: msg.by,
          requestedBySession: msg.sessionId,
          viaAgent: !!msg.viaAgent,
          itemIds: mine.map(a => a.id),
          total,
          overBudget: budget > 0 && total > budget,
          at: Date.now(),
        });

        this.addLog({
          who: msg.by,
          viaAgent: msg.viaAgent,
          action: "request_checkout",
          summary: `Requested checkout of NT$${total.toLocaleString()} (${mine.length} ${mine.length === 1 ? "item" : "items"}), pending approval`,
        });
      }
    }

    // 人按下確認才真的完成付款。標記 paid 而不是刪掉項目，
    // 這樣行程表仍看得到內容，之後要接真實金流也只需替換這一段。
    if (msg.t === "approve_checkout") {
      const idx = this.pendingApprovals.findIndex(p => p.id === msg.id);
      if (idx >= 0) {
        const approval = this.pendingApprovals[idx];

        // 唯一穩固的邊界：發起結帳請求的 session 不能自己確認。
        // Agent 能操作的範圍就是它所在的那個瀏覽器分頁，只要確認發生在別的 session，
        // 不論 Agent 怎麼操作畫面都碰不到。
        if (msg.sessionId === approval.requestedBySession) {
          this.addLog({
            who: msg.by,
            viaAgent: false,
            action: "approve_blocked",
            summary: "Approval blocked: the device that requested checkout cannot approve it. Approve from another device or member.",
          });
        } else {
          for (const a of this.items) {
            if (approval.itemIds.includes(a.id)) a.paid = true;
          }
          this.pendingApprovals.splice(idx, 1);
          this.addLog({
            who: msg.by,
            viaAgent: false,
            action: "approve_checkout",
            summary: `Approved payment of NT$${approval.total.toLocaleString()} (demo mode, no real payment processor connected)`,
          });
        }
      }
    }

    // 人也可以直接否決 Agent 的請求
    if (msg.t === "reject_checkout") {
      const idx = this.pendingApprovals.findIndex(p => p.id === msg.id);
      if (idx >= 0) {
        const approval = this.pendingApprovals[idx];
        this.pendingApprovals.splice(idx, 1);
        this.addLog({
          who: msg.by,
          viaAgent: false,
          action: "reject_checkout",
          summary: `Declined the checkout request for NT$${approval.total.toLocaleString()}`,
        });
      }
    }

    detectConflicts(this.items);
    await this.save();
    this.broadcast();
  }

  broadcast() {
    const payload = this.state();
    for (const socket of this.ctx.getWebSockets()) {
      socket.send(payload);
    }
  }

  // 連線結束就清掉它的限流狀態，避免 rateLimits 這個 Map 隨連線數無限成長。
  webSocketClose(ws) {
    this.rateLimits.delete(ws);
  }
  webSocketError(ws) {
    this.rateLimits.delete(ws);
  }
}

// ② Worker：看網址決定把請求轉給哪個房間
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const match = url.pathname.match(/^\/api\/room\/([\w-]+)$/);

    if (match) {
      const roomName = match[1];
      const id = env.ROOM.idFromName(roomName);
      const room = env.ROOM.get(id);
      return room.fetch(request);
    }

    return new Response("Not found", { status: 404 });
  },
};