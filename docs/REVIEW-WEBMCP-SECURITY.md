# WebMCP 工具安全審查 — 2026-08-28

審查對象：`public/index.html` 註冊的 6 個 WebMCP 工具，
以及它們背後的訊息協定（`src/index.js` 的 8 個 `msg.t` 分支）。

工具清單：`list_itinerary`、`add_activity`、`update_activity`、`remove_activity`、
`get_budget_status`、`request_checkout`

**審查前提**：這是黑客松 demo，房間靠「知道網址」進入，沒有帳號系統。
下面把「這個定位下可接受」與「即使是 demo 也該修」分開標示。

---

## 1. 是否可能越權？

### 🔴 SEC-002：任何人可以修改與刪除別人的行程

`update` / `remove` 分支只用 `id` 找項目，**沒有比對 `createdBy`**：

```js
if (msg.t === "remove") {
  const a = this.items.find(x => x.id === msg.id);
  if (a) { this.items = this.items.filter(x => x.id !== msg.id); ... }
}
```

Agent 只要先呼叫 `list_itinerary`（會回傳所有項目的 id），
就能刪掉或改掉**任何成員**的行程，稽核紀錄還會誠實寫成是它做的。

**判斷**：對共編工具來說，「大家都能改同一份文件」其實是**產品意圖**
（Google Docs 也是這樣），所以不算漏洞。但目前**沒有任何地方向使用者說明這件事**，
而 Agent 拿到 `remove_activity` 這種破壞性工具時，很可能誤刪別人的安排。

**建議（低成本、demo 內可做）**：
- `remove_activity` 的 description 補上：
  「This removes an item for **everyone**, including items proposed by other travelers.
   Always confirm with the user before removing an item they did not create.」
- 不要加權限檢查（那會破壞共編的產品定位），改用**稽核 + 告知**。

### 🟡 SEC-003：`set_budget` 只認名字，可被冒用

```js
if (this.members[msg.by]) { this.members[msg.by].budget = ... }
```

`msg.by` 直接來自前端的 `?as=`。任何人只要用 `?as=Bob` 開房間，
就能改 Bob 的預算上限，也能以 Bob 的名義新增行程、發起結帳。

**判斷**：這是「無帳號系統」的必然結果，不是實作疏失。
**提交說明必須主動寫明**：身分採連結分享模式，**沒有身分驗證**；
正式產品需加入認證層。誠實寫出來比被評審發現好。

> **2026-09-01 補充**：任務 14 加了一個最低限度的判斷——`set_budget` 現在要求
> 這條連線必須先以 `msg.by` 這個名字 `join` 過，否則擋下（見 `src/index.js`）。
> 這不是身分驗證（誰都能自己 `join` 成任何名字，成本幾乎是零），只擋掉「完全
> 沒宣稱過某個身分、單靠一則訊息就能改別人預算」這種更低成本的濫用，SEC-003
> 描述的核心問題（沒有帳號系統，名字可任意冒用）並未解決，也解決不了。

### ✅ 付款這一條沒有越權

`approve_checkout` 有 session 檢查，發起的 session 無法自行確認。
這是全系統唯一真正的權限邊界，且實作正確。

> ⚠️ **已於 2026-09-01 被實測推翻。** 上面的判斷建立在一個沒有被驗證過的假設上：
> 「跨 session 檢查」等於「跨裝置」。實測發現不是——`sessionId` 每次頁面載入都重新
> 產生、不存 `localStorage`，所以「同一個瀏覽器開一個新分頁」在伺服器眼中就已經是
> 全新的 session。請 ChatGPT 桌面版「開新分頁按確認」，它真的照做，付款照樣完成，
> 完全不用碰任何程式碼、不用繞過任何工具限制。
>
> 更根本的問題是：伺服器把授權判斷的依據，建立在一個**完全由前端訊息內容提供、
> 攻擊者填得出任何值**的欄位（`msg.sessionId`）上。第一次補丁（任務 14 第一版）
> 改成用 `localStorage` 存的 `deviceId`，但這個欄位一樣是訊息內容的一部分、一樣是
> 能執行 JS 的 Agent 讀得到也改得掉的地方，並未修正根本問題，只是把攻擊門檻墊高一點。
> 最終修法（任務 14 第二版，本文件標記日期完成）：改成由**伺服器**發一個 `HttpOnly`
> cookie，`webSocketMessage` 完全不再看訊息裡的任何身分欄位，只信任連線建立當下
> 由 Worker 解析 cookie、透過只有 Worker 自己會設的 header 轉給 Durable Object 的
> `deviceId`。細節見 `docs/TASKS.md` 任務 14、`docs/SUBMISSION.md`
> 「My payment gate did not actually work」。
>
> 同時也順手誠實面對另一件事：新版**只**檢查裝置、不再檢查「是不是本人」
> （`msg.by` 本來就是攻擊者填得出來的欄位，拿它當權限依據只是製造假象）。
> 「必須是本人」現在只在 UI 表達，不是伺服器強制——這代表一個真正不同裝置的
> 旅伴，理論上可以繞過 UI、直接送協定訊息確認別人的付款。這件事也寫進了
> `README.md`「Known trade-offs」。

---

## 2. 是否可以遍歷其他人的資料？

### ✅ 房間之間隔離正確

`env.ROOM.idFromName(roomName)` 讓每個房號對應獨立的 Durable Object 實例，
一個房間的工具**絕對讀不到另一個房間的資料**。這是架構層級的隔離，不靠程式碼自律。

### 🟡 SEC-004：房號可被猜測，且沒有列舉保護

房號來自網址，使用者自取。若有人用 `tokyo`、`test`、`demo` 這類常見字串掃描，
就能進入別人的房間讀取全部行程與稽核紀錄。

**判斷**：這是「知道網址就能加入」的產品設計的另一面。
**建議（低成本）**：`?seed=1` 以外的新房間，若使用者沒指定房號，
自動產生**足夠長的隨機房號**（例如 12 字元），而不是短字串。
提交說明也要寫明「房號即存取權杖」的限制。

### ✅ 工具本身不能跨房間查詢

6 個工具全部操作當前頁面的 `items` / `members`，沒有任何一個接受「房號」參數。
Agent 無法用工具去讀別的房間——這是刻意的設計，值得寫進提交說明。

---

## 3. Input 是否可能造成 Injection / SSRF / Path Traversal？

### 🔴 XSS：見 `docs/REVIEW-2026-08-28.md` 的 SEC-001（已排入任務 3.5）

`add_activity` 的 `title`、`?as=` 的名字都會進入 `innerHTML`。
**Agent 是可以被提示注入誘導的**——惡意網頁或惡意行程標題可以讓 Agent
呼叫 `add_activity` 塞入 `<img src=x onerror=...>`，然後在所有成員的瀏覽器執行。
這條路徑讓 XSS 從「使用者自己貼」升級成「Agent 可被誘導代為植入」，必須修。

### ✅ 沒有 SSRF 的攻擊面

系統**不發出任何對外請求**：沒有 `fetch()` 到外部網址、沒有圖片 URL 欄位、
沒有 webhook、沒有 LLM 呼叫。工具的 input 全部只寫進 Durable Object 的記憶體與儲存。
**這是刻意的設計選擇**（衝突偵測用程式邏輯而非 LLM），順帶消滅了整類風險。

### ✅ 沒有 Path Traversal 的攻擊面

沒有檔案系統操作。房號正則 `^\/api\/room\/([\w-]+)$` 只允許英數與連字號，
`..`、`/`、`%2e%2e` 全部無法通過。Durable Object 的 key 也不是路徑。

### 🟡 SEC-005：伺服器完全不驗證輸入型別與範圍

```js
const activity = { id: crypto.randomUUID(), ...msg.activity };
Object.assign(a, msg.patch);
```

`...msg.activity` 和 `Object.assign` 會**原封不動接受任何欄位**。可能後果：

- 塞入 `day: 999`、`start: "abc"` → `toMinutes("abc")` 回 `NaN`，
  衝突比較全部為 false（不會當掉，但功能靜默失效）
- 塞入 `paid: true` → **直接把項目標成已付款，繞過整個結帳閘門**
- 塞入 `id: "..."` 覆寫既有項目的 id → 資料錯亂
- 塞入超大字串或大量欄位 → 撐大儲存

**其中 `paid: true` 是真的問題**：Agent 只要呼叫
`update_activity({ id, price: 0 })` 之類的路徑…… 實際上 `update_activity` 工具的
schema 沒有 `paid` 欄位，但**協定層沒有擋**——任何人打開 Console 送
`ws.send(JSON.stringify({t:"update", id, patch:{paid:true}, by:"X", viaAgent:false}))`
就能白拿。這已經是「刻意繞過工具介面」的層級，但既然閘門是作品的核心主張，
**建議補一道白名單**（成本很低）。

**建議修正**：`add` / `update` 只接受白名單欄位：

```js
// 只接受這些欄位。用白名單而非黑名單——
// 否則 patch 可以塞入 paid:true 直接繞過付款閘門。
const ALLOWED = ["type", "day", "start", "end", "title", "note", "price"];
function pick(obj) {
  const out = {};
  for (const k of ALLOWED) if (obj && k in obj) out[k] = obj[k];
  return out;
}
```

`add` 用 `{ id: crypto.randomUUID(), createdBy, viaAgent, ...pick(msg.activity) }`，
`update` 用 `Object.assign(a, pick(msg.patch))`。
`createdBy` / `viaAgent` / `paid` / `id` / `conflictWith` 一律由伺服器決定，不接受前端指定。

---

## 4. 是否有限制呼叫頻率與資料量？

### 🟡 SEC-006：完全沒有速率限制與容量上限

目前的界限只有一個：日誌保留最近 100 筆。其餘皆無上限：

- `items` 可無限成長 → 每次變更都 `detectConflicts`（**O(n²)**）+ 全量廣播 +
  全量寫入 storage。幾千筆就會明顯卡頓，且每次廣播都把整份狀態送給所有連線
- `members` 可無限成長（每個新名字就是一個成員）
- `pendingApprovals` 可無限成長（`request_checkout` 沒有防重複）
- 單一訊息大小無限制
- WebSocket 連線數無限制

**判斷**：demo 情境下不會自然觸發，但**一個被提示注入的 Agent 可以在幾秒內
呼叫 `add_activity` 上千次**，讓房間卡死。這也是「Agent 可呼叫的介面」
與「人手動操作的介面」的本質差異：**人不會一分鐘點一千次，Agent 會**。

**建議（demo 內做得完的最小版）**：
- `items` 上限 200 筆，超過就拒絕並回一筆日誌
- `pendingApprovals` 上限 5 筆；同一個 session 已有待確認請求時，不再建立新的
- 每個連線每秒最多 20 則訊息，超過就忽略（記憶體計數即可，不需要外部服務）

**這一項值得寫進提交說明**——「為 Agent 開放的介面需要比人類介面更嚴格的配額」
是 agentic web 的真實課題，指出它會加分。

---

## 5. 多個 Tool 組合後是否可以濫用商業邏輯？

分析目前 6 個工具的組合：

### 🟡 組合 A：`list_itinerary` → `update_activity` 壓低價格

Agent 可以先讀出所有項目，再把 `price` 改成 0，讓總額低於預算後再 `request_checkout`。
**但這在此系統無實害**：價格本來就是使用者自填的估計值，不是真實商品價格，
而且付款是 DEMO 模式。
**未來若接真實商品目錄，`price` 必須改由伺服器從商品資料查得，絕不可由前端或 Agent 指定。**
→ 已記入「未來擴充注意事項」。

### 🟡 組合 B：`update_activity` 把別人的行程改掉再 `request_checkout`

因為沒有 `createdBy` 檢查（SEC-002），Agent 可以把別人的項目改成自己的……
實際上 `createdBy` 不在 `update` 的 schema 裡，但協定層沒擋（同 SEC-005）。
白名單修好後，這條路就封住了。

### ✅ 組合 C：無法用工具組合完成付款

這是最重要的一條。6 個工具裡沒有任何一個、也沒有任何組合，
能讓 `paid` 變成 true——`approve_checkout` 不是工具，只存在於 UI，
且發起的 session 不渲染該按鈕。**這道邊界是結構性的，不是靠工具描述維持的。**
（前提是 SEC-005 的白名單要補上，否則可以繞過協定層。）

### 🟡 組合 D：重複 `request_checkout` 洗版

沒有防重複，Agent 可以連續呼叫產生大量待確認請求。
→ 併入 SEC-006 的 `pendingApprovals` 上限處理。

---

## 6. 高風險操作是否需要額外確認？

| 操作 | 風險 | 現況 | 評價 |
|---|---|---|---|
| 完成付款 | 高（不可逆、涉及金錢） | 跨 session 確認，發起端不渲染按鈕 | ✅ 設計正確且穩固 |
| 刪除行程 | 中（影響其他成員） | 無確認，description 未警告 | 🟡 建議在 description 註明「會影響所有成員」 |
| 修改別人的行程 | 中 | 無確認 | 🟡 同上 |
| 設定預算 | 低 | 無確認 | ✅ 可接受 |

**付款這一項的設計值得在提交說明中展開**：
純畫面上的 disabled 按鈕擋不住能操作瀏覽器的 Agent，
唯一穩固的做法是讓該 session **根本沒有那個 DOM 元素**。

---

## 7. 是否能防止 Replay？

### 🟡 SEC-007：訊息可重放，但影響有限

協定沒有 nonce、沒有時間戳驗證、沒有序號。任何人只要在 Console 重送同一則訊息就會再執行一次。

逐項評估：
- 重放 `add` → 產生重複項目（伺服器每次都給新 `id`），只是雜訊
- 重放 `update` / `remove` → 冪等，重複執行結果相同
- **重放 `approve_checkout` → 無效**：確認成功後該筆 `pendingApprovals` 已被 `splice` 移除，
  `findIndex` 回 -1，什麼都不會發生。**這是意外的好設計——狀態機本身提供了防重放。**
- 重放 `request_checkout` → 產生多筆請求（併入 SEC-006 處理）

**結論**：最關鍵的付款操作天然免疫重放（因為請求是一次性的、用完即刪）。
其餘重放只造成雜訊，不造成價值轉移。**demo 情境下不需要額外做 nonce。**

---

## 8. 是否可能被用來大量外洩資料？

### 🟡 SEC-008：`list_itinerary` 一次回傳全部資料

沒有分頁、沒有筆數上限。房間裡所有行程的標題、時間、提出者名稱一次全給 Agent。

**判斷**：
- 這正是這個工具該做的事——Agent 需要看到全貌才能避免衝突
- 房間內的資料本來就是所有成員共享的，不存在「房間內的個資邊界」
- **真正的邊界是房間**，而房間邊界由 Durable Object 隔離保證（見第 2 點）

**但要注意的是**：`list_itinerary` 的輸出會**離開這個網站**，
進入 Agent 的上下文（ChatGPT 的伺服器）。使用者可能沒有意識到這件事。

**建議（幾乎零成本，且很加分）**：在頁面上（例如成員區下方）加一行小字說明：

> Tools exposed to your agent can read this room's itinerary.
> Anything here may be sent to your agent provider.

這是 agentic web 的**知情同意**問題，主動處理會讓評審印象深刻——
大部分作品不會想到「開放給 Agent 的資料等於送出網站外」。

---

## 修正優先順序

| 編號 | 問題 | 優先 | 成本 |
|---|---|---|---|
| SEC-001 | 儲存型 XSS（`innerHTML` 未轉義） | 🔴 必修 | 低 |
| SEC-005 | 欄位白名單（防 `paid:true` 繞過閘門） | 🔴 必修 | 低 |
| SEC-006 | 速率與容量上限（最小版） | 🟡 建議 | 中 |
| SEC-008 | 頁面上的資料外流告知 | 🟡 建議（加分） | 極低 |
| SEC-002 | `remove_activity` description 加警語 | 🟡 建議 | 極低 |
| SEC-004 | 未指定房號時產生長隨機房號 | 🟢 可選 | 低 |
| SEC-003 | 無身分驗證 | 📝 寫進提交說明即可 | — |
| SEC-007 | Replay | ✅ 不需處理 | — |

## 未來擴充注意事項（不是現在要做，但寫進 README 會加分）

- **`price` 必須改由伺服器查商品目錄取得**，絕不可由前端或 Agent 指定
- 接真實金流時，`approve_checkout` 應改為裝置綁定的驗證（WebAuthn / passkey），
  跨 session 只是 demo 條件下的合理近似
- 需要身分認證層，`me()` 這個接縫已經預留好替換點
- 需要伺服器端的欄位驗證與權限模型
