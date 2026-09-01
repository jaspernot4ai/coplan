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

  // 廣播格式集中在這裡，加欄位只要改一個地方。
  // forDeviceId：這個 payload 是要送給哪個連線的——每個連線的 deviceId 不同，
  // 「這筆待確認是不是我自己那台裝置發起的」這件事本來就因人而異，沒辦法用同一份
  // JSON 廣播給所有人。這裡只送出算好的布林值 sameDeviceAsMe，不送出原始 requestedByDevice，
  // 避免把裝置 id 這種內部識別碼不必要地攤在所有連線的畫面上。
  state(forDeviceId) {
    return JSON.stringify({
      items: this.items,
      log: this.log,
      members: this.members,
      pendingApprovals: this.pendingApprovals.map(({ requestedByDevice, ...rest }) => ({
        ...rest,
        sameDeviceAsMe: requestedByDevice === forDeviceId,
      })),
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

    // 裝置身分只信任 Worker 轉發過來的這個 header（見檔案最下面的 Worker fetch()），
    // 完全不看訊息內容——webSocketMessage 之後只會從這個連線的 attachment 讀 deviceId，
    // 不會再看 msg.deviceId／msg.sessionId，那兩個欄位是攻擊者可以任意填寫的。
    // 用 serializeAttachment 而不是一個 Map<ws, deviceId>：這個 DO 用的是 Hibernatable
    // WebSockets API（acceptWebSocket），閒置時整個物件可能被回收、記憶體裡的 Map 會消失，
    // 只有 serializeAttachment 存的東西保證在下次喚醒時還在同一個連線上讀得到。
    const deviceId = request.headers.get("X-Coplan-Device") || crypto.randomUUID();
    server.serializeAttachment({ deviceId });

    this.ctx.acceptWebSocket(server);
    server.send(this.state(deviceId));
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

    // 這個連線的裝置身分（來自 fetch() 時存的 attachment），以及它目前宣稱的名字
    // （由 join 訊息設定）。set_budget／reset_room 用 name 判斷「這個連線有沒有以
    // 這個身分加入過」；approve_checkout 用 deviceId 判斷「是不是同一台裝置」。
    const attachment = ws.deserializeAttachment() || {};
    const deviceId = attachment.deviceId;

    if (msg.t === "join") {
      // 記住這個連線宣稱的名字，讓之後的 set_budget／reset_room 可以比對「這個連線
      // 有沒有以這個身分加入過」——不是身分驗證（名字本來就可以隨便宣稱），
      // 只是擋掉「完全沒加入過就能操作」這種最低成本的濫用。
      ws.serializeAttachment({ ...attachment, name: msg.name });

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
    // 補上零授權缺口：這個連線必須先以 msg.by 這個名字 join 過，才能設定這個名字的預算——
    // 沒有帳號系統，這不是真正的身分驗證（誰都能自己 join 成任何名字），
    // 但至少擋掉「完全沒宣稱過某個身分、單靠一則訊息就能改別人預算」這種零成本濫用。
    if (msg.t === "set_budget") {
      if (attachment.name !== msg.by) {
        this.addLog({
          who: msg.by,
          viaAgent: msg.viaAgent,
          action: "budget_blocked",
          summary: `Blocked: this connection hasn't joined as ${msg.by}, so it can't set their budget.`,
        });
      } else if (this.members[msg.by]) {
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
      // 用連線的 deviceId 判斷「這台裝置」有沒有待確認請求，不再看 msg.sessionId——
      // 理由跟 approve_checkout 一樣：sessionId 是前端訊息裡的欄位，攻擊者填得出來，
      // deviceId 來自 fetch() 時的連線層級 attachment，訊息內容改不了它。
      const deviceAlreadyPending = this.pendingApprovals.some(p => p.requestedByDevice === deviceId);

      if (deviceAlreadyPending) {
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
          requestedByDevice: deviceId,
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

        // 放行只認一條，而且完全不看訊息內容：確認者的連線 deviceId（來自伺服器發的
        // HttpOnly cookie，webSocketMessage 開頭已經從 attachment 讀出）不能等於發起請求
        // 那個連線的 deviceId。不再檢查「確認者是不是本人」（msg.by === approval.requestedBy）——
        // msg.by 是前端訊息裡的欄位，任何連線都填得出任何名字，拿一個攻擊者自己填的欄位
        // 當作權限依據，只會給人一種「有身分檢查」的假象，卻擋不住真正想繞過的人。
        // 「必須是本人」這件事改成只在 UI 表達（見 public/index.html 的 renderApprovals：
        // 只有 me() === requestedBy 且不同裝置才會畫出確認按鈕），伺服器唯一守住的、
        // 也是唯一守得住的邊界，是裝置。這個取捨記在 docs/TASKS.md 任務 14 與 README。
        const sameDevice = deviceId === approval.requestedByDevice;

        if (sameDevice) {
          this.addLog({
            who: msg.by,
            viaAgent: false,
            action: "approve_blocked",
            summary: "Approval blocked: this is the same device that requested checkout. Approve from a different device.",
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

    // 錄影與評審試玩用的重置。一次清空，避免逐筆刪除在時間軸留下數十筆雜訊。
    // members 保留，這樣重置後成員顏色與名單不變，錄影可以直接接著開始。
    // 補上零授權缺口：重置是全房間、不可逆的破壞性操作，改版前任何連線送一則訊息
    // 就能清空所有人的資料。現在跟 set_budget 用同一套最低限度的判斷——這個連線
    // 必須先以 msg.by 這個名字 join 過。擋不住「本來就在房間裡的人」惡意重置
    // （沒有帳號系統做不到這件事），但至少擋掉連 join 都沒做的最低成本濫用。
    if (msg.t === "reset_room") {
      if (attachment.name !== msg.by) {
        this.addLog({
          who: msg.by,
          viaAgent: false,
          action: "reset_blocked",
          summary: `Blocked: this connection hasn't joined as ${msg.by}, so it can't reset the room.`,
        });
      } else {
        this.items = [];
        this.log = [];
        this.pendingApprovals = [];
        this.addLog({
          who: msg.by,
          viaAgent: false,
          action: "reset_room",
          summary: "Room reset — itinerary, timeline and pending approvals cleared",
        });
        await this.save();
        this.broadcast();
        return;
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

  // 每個連線的 sameDeviceAsMe 不一樣，沒辦法像以前那樣算一份 JSON 廣播給所有人——
  // 這是被裝置綁定機制逼出來的必要延伸，不是額外加的功能。連線數在這個作品的規模下
  // 頂多幾個人，逐一算一次 state() 的成本可以忽略。
  broadcast() {
    for (const socket of this.ctx.getWebSockets()) {
      const attachment = socket.deserializeAttachment() || {};
      socket.send(this.state(attachment.deviceId));
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

// 只解析我們自己要用的那一個 cookie，不需要一整個 cookie-parsing 套件。
function readDeviceCookie(request) {
  const header = request.headers.get("Cookie") || "";
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === "coplan_device") {
      return decodeURIComponent(part.slice(eq + 1).trim());
    }
  }
  return null;
}

// ② Worker：看網址決定把請求轉給哪個房間
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 發裝置憑證。前端在建立 WebSocket 之前一定會先呼叫這支、並 await 它完成，
    // 讓瀏覽器有機會先把 Set-Cookie 存好。這支端點本身不回傳 deviceId 給 JS——
    // HttpOnly 讀不到本來就是整個機制的重點，能執行 JS 的 Agent 不該摸得到這個值，
    // 這是它跟舊版存在 localStorage 的 deviceId 的根本差異。
    if (url.pathname === "/api/device") {
      if (readDeviceCookie(request)) {
        return new Response(JSON.stringify({ ok: true }), {
          headers: { "Content-Type": "application/json" },
        });
      }
      const deviceId = crypto.randomUUID();
      // Secure 只在真的是 https 時才加——本機 wrangler dev 是 http，瀏覽器會直接
      // 拒存帶 Secure 的 cookie（且 127.0.0.1 不像 localhost 那樣有例外），
      // 硬加只會讓本機測試連 cookie 都存不進去，而 http 底下 Secure 也不提供任何保護。
      const secure = url.protocol === "https:" ? "; Secure" : "";
      return new Response(JSON.stringify({ ok: true }), {
        headers: {
          "Content-Type": "application/json",
          "Set-Cookie": `coplan_device=${deviceId}; HttpOnly; SameSite=Lax; Path=/; Max-Age=31536000${secure}`,
        },
      });
    }

    const match = url.pathname.match(/^\/api\/room\/([\w-]+)$/);

    if (match) {
      const roomName = match[1];
      const id = env.ROOM.idFromName(roomName);
      const room = env.ROOM.get(id);

      // 裝置身分只信任這裡解析出來的 cookie，不信任 client 送來的任何欄位。
      // 用一個新 Headers 物件、明確 set() 覆蓋這個 header 再轉發——就算原始請求
      // 自己塞了一個同名的 X-Coplan-Device header 想冒充別的裝置，也會被這裡蓋掉，
      // 因為 DO 那邊只認這個 header，不會回頭看訊息內容。
      const deviceId = readDeviceCookie(request) || crypto.randomUUID();
      const headers = new Headers(request.headers);
      headers.set("X-Coplan-Device", deviceId);
      const forwarded = new Request(request, { headers });
      return room.fetch(forwarded);
    }

    return new Response("Not found", { status: 404 });
  },
};