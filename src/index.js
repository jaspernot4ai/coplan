// ① 房間本體：一個房號 = 一個實例，各自獨立、有記憶
export class RoomDO {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.items = [];  // 這個房間的共享資料
  }

  async fetch(request) {
    // 建立 WebSocket 的兩端：一端給瀏覽器，一端留在伺服器
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    this.ctx.acceptWebSocket(server);   // 交給 Cloudflare 託管這條連線
    server.send(JSON.stringify(this.items));  // 一連上就先給他目前的資料

    return new Response(null, { status: 101, webSocket: client });
  }

  // 有人透過 WebSocket 傳訊息進來時會呼叫這裡
  async webSocketMessage(ws, message) {
    this.items.push(message);   // 加進共享資料
    this.broadcast();           // 通知所有人
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