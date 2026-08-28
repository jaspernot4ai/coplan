// ① 房間本體：一個房號 = 一個實例，各自獨立、有記憶
export class RoomDO {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.items = [];

    // 開機時先從硬碟讀回來。blockConcurrencyWhile 會擋住其他請求，
    // 確保讀完之前不會有人拿到空的資料。
    this.ctx.blockConcurrencyWhile(async () => {
      this.items = (await this.ctx.storage.get("items")) || [];
    });
  }

  async fetch(request) {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    server.send(JSON.stringify(this.items));   // 新連線先給目前狀態
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, message) {
    const msg = JSON.parse(message);

    if (msg.t === "add") {
      this.items.push({ id: crypto.randomUUID(), ...msg.activity });
    }

    await this.ctx.storage.put("items", this.items);   // 寫回硬碟
    this.broadcast();
  }

  broadcast() {
    const payload = JSON.stringify(this.items);
    for (const socket of this.ctx.getWebSockets()) {
      socket.send(payload);
    }
  }
}

// ② Worker：看網址決定把請求轉給哪個房間
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const match = url.pathname.match(/^\/api\/room\/(\w+)$/);

    if (match) {
      const roomName = match[1];
      const id = env.ROOM.idFromName(roomName);  // 房號 → 實例 id
      const room = env.ROOM.get(id);             // 取得那個實例
      return room.fetch(request);                // 把請求交給它
    }

    return new Response("Not found", { status: 404 });
  },
};