function toMinutes(hhmm) {
  const [h, m] = String(hhmm).split(":").map(Number);
  return h * 60 + m;
}

// 重算整份行程的衝突狀態：同一天、時間重疊即互相標記
function detectConflicts(items) {
  // 先清空所有標記，避免留下上一次的殘影
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






// ① 房間本體：一個房號 = 一個實例，各自獨立、有記憶
export class RoomDO {

    addLog(entry) {
        this.log.push({ id: crypto.randomUUID(), at: Date.now(), ...entry });
        if (this.log.length > 100) this.log = this.log.slice(-100);   // 只留最近 100 筆
    }

    constructor(ctx, env) {
        this.ctx = ctx;
        this.items = [];
        this.log = [];

        this.ctx.blockConcurrencyWhile(async () => {
        this.items = (await this.ctx.storage.get("items")) || [];
        this.log = (await this.ctx.storage.get("log")) || [];
        });
    }

  async fetch(request) {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
        server.send(JSON.stringify({ items: this.items, log: this.log }));   // 新連線先給目前狀態
    return new Response(null, { status: 101, webSocket: client });
  }

      async webSocketMessage(ws, message) {
    const msg = JSON.parse(message);

    if (msg.t === "add") {
      const activity = { id: crypto.randomUUID(), ...msg.activity };
      this.items.push(activity);
      this.addLog({
        who: activity.createdBy,
        viaAgent: activity.viaAgent,
        action: "add_activity",
        summary: `新增「${activity.title}」到 Day ${activity.day} ${activity.start}–${activity.end}`,
      });
    }

    detectConflicts(this.items);
    await this.ctx.storage.put("items", this.items);
    await this.ctx.storage.put("log", this.log);
    this.broadcast();
  }

   broadcast() {
    const payload = JSON.stringify({ items: this.items, log: this.log });
    for (const socket of this.ctx.getWebSockets()) {
      socket.send(payload);
    }
  }
}

// ② Worker：看網址決定把請求轉給哪個房間
// ② Worker：看網址決定把請求轉給哪個房間
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const match = url.pathname.match(/^\/api\/room\/(\w+)$/);

    if (match) {
      const roomName = match[1];
      const id = env.ROOM.idFromName(roomName);
      const room = env.ROOM.get(id);
      return room.fetch(request);
    }

    return new Response("Not found", { status: 404 });
  },
};