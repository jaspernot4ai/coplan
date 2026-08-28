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

// ① 房間本體：一個房號 = 一個實例，各自獨立、有記憶
export class RoomDO {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.items = [];
    this.log = [];
    this.members = {};

    this.ctx.blockConcurrencyWhile(async () => {
      this.items = (await this.ctx.storage.get("items")) || [];
      this.log = (await this.ctx.storage.get("log")) || [];
      this.members = (await this.ctx.storage.get("members")) || {};
    });
  }

  // 廣播格式集中在這裡，加欄位只要改一個地方
  state() {
    return JSON.stringify({
      items: this.items,
      log: this.log,
      members: this.members,
    });
  }

  // 儲存也集中在這裡，避免漏存某一份
  async save() {
    await this.ctx.storage.put("items", this.items);
    await this.ctx.storage.put("log", this.log);
    await this.ctx.storage.put("members", this.members);
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
    const msg = JSON.parse(message);

    if (msg.t === "join") {
      const isNew = !this.members[msg.name];
      this.members[msg.name] = { name: msg.name, lastSeen: Date.now() };
      if (isNew) {
        this.addLog({
          who: msg.name,
          viaAgent: false,
          action: "join",
          summary: `${msg.name} 加入了行程`,
        });
      }
      await this.save();
      this.broadcast();
      return;
    }

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

    if (msg.t === "update") {
      const a = this.items.find(x => x.id === msg.id);
      if (a) {
        Object.assign(a, msg.patch);
        this.addLog({
          who: msg.by,
          viaAgent: msg.viaAgent,
          action: "update_activity",
          summary: `調整「${a.title}」為 Day ${a.day} ${a.start}–${a.end}`,
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
          summary: `移除「${a.title}」`,
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