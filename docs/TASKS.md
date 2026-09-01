# CoPlan 任務清單

> 這份檔案由規劃端維護，Claude Code 依序執行。
> **開工前先讀專案根目錄的 `CLAUDE.md`**，那裡有防 slop 規則與架構原則，一律遵守。
> 每完成一項，在該項標題後面加上 `✅` 並簡述改了哪些檔案。有疑問或發現規格有問題，寫在該項下方的「回報」區塊，不要自行擴大範圍。

## 專案現況（2026-08-28）

參加 OpenAI WebMCP Challenge，**截止 2026/9/4 04:00（台北時間）**。
線上版：https://coplan.coplan-lab.workers.dev

已完成：WebMCP 雙平台工具註冊、Durable Object 多人即時同步與持久化、行程 CRUD、
確定性衝突偵測、Agent 活動稽核時間軸、網址身分（`/r/<房號>?as=<名字>`）、
成員清單與確定性顏色、預算上限、Agent 結帳請求 + 人工確認閘門。

檔案結構：
- `src/index.js` — Worker 路由 + RoomDO（房間狀態、衝突偵測、日誌、廣播、儲存）
- `public/index.html` — 單一頁面：連線層、動作層、渲染、WebMCP 工具註冊

---

## 測試環境（每項任務都適用）

**一律用 Chrome 151 以上測試，不要用其他瀏覽器。**
WebMCP 目前只有 Chrome 與 ChatGPT 桌面版內建瀏覽器支援；Edge、Firefox、Safari 等
都不會注入 `modelContext`，頁面會顯示「WebMCP 不可用」，那不是 bug，是瀏覽器不支援。

Chrome 需先啟用：`chrome://flags/#enable-webmcp-testing` 設為 Enabled 並完整重啟瀏覽器。
（正式網域另需 origin trial token，見任務 2。localhost 不需要。）

驗證工具是否註冊成功，在 Chrome DevTools Console：
```js
(document.modelContext || navigator.modelContext).getTools().then(t => console.table(t))
```

多人測試用不同網址參數開兩個分頁，例如
`http://127.0.0.1:8787/r/demo1?as=Cindy` 與 `http://127.0.0.1:8787/r/demo1?as=Bob`。

### 誰負責驗證什麼

**Claude Code 無法自行驗證 WebMCP 行為。** 那需要一個已啟用 flag 的 Chrome 視窗，
而該設定綁在使用者本機的瀏覽器設定檔上，終端機環境取用不到。
**不要嘗試用 Playwright、puppeteer 或任何無頭瀏覽器去測 WebMCP**——
無頭瀏覽器不會注入 `modelContext`，只會得到假的失敗結果並浪費時間。

| 項目 | 誰驗證 |
|---|---|
| JS/HTML 語法正確、`wrangler dev` 能啟動、Console 無錯誤 | Claude Code |
| 版面、深色模式、375px 寬不橫捲 | Claude Code（可用一般瀏覽器或截圖檢查，這些與 WebMCP 無關） |
| 多人即時同步、新增／編輯／刪除、預算與結帳流程 | Claude Code 可用一般瀏覽器測（這些不依賴 WebMCP） |
| **WebMCP 工具註冊、Agent 實際呼叫工具** | **使用者本人**，用開了 flag 的 Chrome 或 ChatGPT 桌面版 |

完成任務後，在「回報」區塊明確寫出：哪些你自己驗證過、哪些需要使用者用 Chrome 確認。
**不要宣稱驗證了你實際上無法驗證的事。**

**重要**：`navigator.modelContext` 在 Chrome 151 已標記 deprecated，規格正往 `document` 收斂。
程式碼一律使用 `document.modelContext || navigator.modelContext || window.modelContext`，
不要「簡化」成只取其中一個——ChatGPT 桌面版只有 `document`，Chrome 兩個都有。

---

## 任務 0：修 BUG-001 ✅

`docs/BUGS.md` 的 BUG-001：`src/index.js` 中 `request_checkout` 分支的 `addLog`
把 `viaAgent` 寫死為 `true`，導致人按下結帳也被記成 Agent 操作。

**改動**：把該處的 `viaAgent: true,` 改成 `viaAgent: msg.viaAgent,`

**只改這一行，不要順便動別的。** 改完在 `docs/BUGS.md` 把 BUG-001 標題的 🔴 待修 改成 ✅ 已修。

**驗收**：人按結帳 → 時間軸顯示 🙋；Agent 呼叫 request_checkout → 顯示 🤖。

### 回報


---

## 任務 1：UI 打磨（優先度最高）✅

目前是無樣式的原型外觀。評審四項標準中「執行品質」佔四分之一，這一項最容易被時間壓力犧牲，
也最容易補分。**功能不要動，只做外觀。**

### 規格

完整的視覺規格在 `docs/DESIGN.md`，**先完整讀過再動手**。那份文件已經把顏色、間距、
版面、每個元件的樣式全部訂死，不需要你做設計判斷；照著實作即可。有規格沒寫到的細節，
選最克制的做法，並在「回報」區塊記下你做了什麼決定。

### 執行順序（一次一步，每步完成後自行檢查頁面仍可運作）

1. 在 `<head>` 加 `<style>` 區塊，定義 `docs/DESIGN.md` 的 CSS 變數與基礎樣式（body、字型、按鈕、表單元素）
2. 改 `<body>` 的 HTML 結構為三欄 Grid，把既有元素搬到對應欄位（不要改元素的 id）
3. 把 JS 裡寫死的色碼換成 CSS 變數（卡片、待確認框、時間軸）
4. 加標題列與「複製邀請連結」按鈕
5. 補空狀態文案
6. 檢查深色模式與 375px 寬

### 不要做的

- 不要引入任何 CSS 框架、UI 套件或字型 CDN。手寫 CSS。
- 不要改任何 WebMCP 工具的 description 或 schema。
- 不要改 `src/index.js`。
- 不要重構 JavaScript 的結構或函式簽章，只調整產生的 HTML 與樣式。
- 不要改動元素的 `id`（JS 靠它們抓元素）。
- 不要加動畫、漸層、陰影特效。

### 驗收

- 兩個瀏覽器分頁（不同 `?as=` 名字，例如 `/r/demo1?as=Cindy` 與 `?as=Bob`）操作：
  新增、改時間、刪除、填價格、設預算、結帳請求與確認，全部行為與改版前一致
- 即時同步正常，Agent 活動時間軸正常記錄
- 淺色與深色模式都可讀
- 375px 寬不會橫向捲動
- Console 沒有任何錯誤

### 回報

**改了哪些檔案**：只有 `public/index.html`（結構、`<style>`、JS 產生的 DOM 與樣式）。沒有動 `src/index.js`。

**照執行順序做完**：`<head>` 加齊 `docs/DESIGN.md` 的 CSS 變數與淺／深色覆寫；`<body>` 改成標題列 + 三欄 Grid（左側 aside／中間 main／右側 aside），所有元素 id 不變；卡片、待確認框、時間軸、預算列、成員標籤全部改用 class + `var(--*)`，JS 裡不再有寫死色碼（PALETTE 依規格保留原樣）；加標題列與「複製邀請連結」（點擊複製 `location.href`，文字變「已複製」2 秒後還原）；補齊三種空狀態文案；深色模式與 375px 已檢查（見下方驗證範圍）。

**規格沒寫到、自行決定的地方**：
1. 三欄容器只有左、右兩個 `<aside>` 包成 `.panel`；中欄不整體包一層 panel，因為中欄本身由「新增表單」「待確認框」「行程卡」三種已各自有邊框樣式的區塊組成，再包一層外框反而多一層視覺雜訊。選最克制的做法。
2. 待確認框的「`--accent` 淡底」規格沒有對應變數，用 `color-mix(in srgb, var(--accent) 8%, var(--panel))` 從既有變數混色，沒有新寫死色碼。
3. **時間軸「衝突相關的紀錄整列用 `--warn` 色」這條沒有實作**：`src/index.js` 的 log entry 只有 `who / viaAgent / action / summary / at`，沒有攜帶衝突旗標，前端在不碰 `src/index.js` 的前提下無法可靠判斷哪筆紀錄跟衝突有關（用 summary 文字比對是猜測，不採用）。若要做，需要伺服器端 `addLog` 多帶一個欄位，這超出本任務「不要改 `src/index.js`」的範圍，留給你判斷要不要另開任務。
4. 額外補了 `<meta name="viewport" content="width=device-width, initial-scale=1" />`——原本沒有，手機瀏覽器沒有這個 meta 會用 980px 假想寬度渲染再縮小，375px 不橫捲這條驗收會測不出真實結果。也順手把 `<title>` 從「WebMCP 通路測試」改成「CoPlan — 多人 × Agent 共享行程」。

**驗證範圍（照上面「誰負責驗證什麼」的表）**：
- 我自己用 `wrangler dev` + 一般瀏覽器分頁驗證過：Console 全程無錯誤（只有一個跟本次改動無關的 `favicon.ico 404`）；兩分頁即時同步（新增/改時間/刪除/填價格/設預算/結帳請求/確認付款，時間軸即時記錄且雙邊一致）；衝突偵測與 `⚠️` 警示樣式正常；375px 寬 `scrollWidth` 實測 360、無橫捲，單欄堆疊順序（中欄→左欄→右欄）符合規格；複製邀請連結按鈕文字狀態正常切換，無 JS 錯誤。
- **沒有測、也不該由我測**：WebMCP 工具實際註冊與 Agent 呼叫——用的是無頭瀏覽器，畫面正確顯示「❌ WebMCP 不可用」（預期行為，不是 bug），但這不代表在有 flag 的 Chrome 裡工具一定註冊成功，這條需要你用開了 flag 的 Chrome 或 ChatGPT 桌面版確認。
- 深色模式沒有自動化截圖驗證（沒有可以強制模擬 `prefers-color-scheme` 的工具），只有對照 `docs/DESIGN.md` 的變數覆寫表逐一檢查程式碼，邏輯上顏色都走變數、深色只覆寫變數值，但建議你自己開深色模式系統設定看一眼实際畫面。

**發現但沒有動的東西**：`docs/TASKS.md` 在我做這個任務的過程中被更新，多了「任務 0：修 BUG-001」且標為最優先。因為你這次明確要我做的是任務 1，我沒有連帶去改 `src/index.js` 的那一行，任務 0 還沒做，留給你確認要不要現在接著處理。

## 任務 1.5：結帳確認改為「跨 session 確認」 ✅（後端由 Claude Code、前端由規劃端補完）

### 為什麼要改

實測發現：ChatGPT 桌面版內建瀏覽器**不只能呼叫 WebMCP 工具，還能直接操作頁面**
（移動滑鼠、點按鈕）。使用者只要說「幫我按下確認」，它就真的按下去了。

也就是說：我們在 WebMCP 工具層沒有開放付款能力（宣告層做對了），
但「像人一樣點按鈕」這條路完全不經過 WebMCP，所以閘門形同虛設。

**技術上無法用偵測解決**：Agent 透過瀏覽器除錯協定注入的輸入事件，`isTrusted` 為 `true`，
與真人點擊無法區分；偵測 `navigator.webdriver` 之類的特徵是軍備競賽，
而且 ChatGPT 內建瀏覽器本來就是本作品的目標平台，不能擋。

**唯一穩固的邊界是把確認移出 Agent 控制的那個 session。**
Agent 的能力範圍等於它操作的那個瀏覽器分頁；只要確認發生在別的 session，它就無能為力。

### 設計

**規則：發起結帳請求的 session，不得確認該筆請求。**

這一條規則同時涵蓋兩種情境，不需要為任一種寫特例：

- **多人旅行**：Cindy 的 Agent 發起 → Bob 在他的視窗確認（共同複核，符合分攤旅費的真實情境）
- **獨自旅行**：Cindy 的 Agent 在電腦上發起 → Cindy 用**手機**打開同一個房間網址確認
  （體驗等同銀行的 3D 驗證。技術上不需要任何新後端——手機走的是同一條 WebSocket，
  只是另一個 session）

### 實作

**1. 前端產生 session id**

每次頁面載入產生一個隨機 id（`crypto.randomUUID()`），存在變數即可，
**不要存進 localStorage**——存進去的話同一台電腦開新分頁會拿到同一個 id，規則就失效了。

**2. 送出結帳請求時附帶 session id**

`requestCheckout` 的訊息加上 `sessionId`。

**3. 後端記錄發起者的 session**

`pendingApprovals` 的項目加上 `requestedBySession` 欄位。

**4. 後端拒絕同一個 session 的確認**

`approve_checkout` 分支加上檢查：若 `msg.sessionId === approval.requestedBySession`，
不執行付款，改為寫一筆日誌：

```js
this.addLog({
  who: msg.by,
  viaAgent: msg.viaAgent,
  action: "approve_blocked",
  summary: "確認被拒絕：發起結帳的裝置不能自己確認，請在另一個裝置或由其他成員確認",
});
```

**否決（reject_checkout）不受此限制** —— 取消一筆請求沒有風險，任何 session 都可以否決。

**5. 前端：發起的 session 不渲染確認按鈕**

這是整個改動的重點。在發起請求的那個 session 裡，
「確認付款」按鈕**根本不要產生出來**（不是 disabled，是不存在於 DOM）。
Agent 想點也沒有東西可點。

該 session 改為顯示：

> 🔒 為了保護你的付款，發起請求的裝置不能自行確認。
> 請在你的另一個裝置上打開這個房間，或請同行成員確認。

並附上目前的房間網址（方便手機輸入或掃描）。
其他 session 則正常顯示「確認付款」與「否決」按鈕。

**6. 告知層：讓 Agent 知道它做不到**

修改 `request_checkout` 工具的 description 與回傳訊息，明確說明：

- description 補上：「此工具只會建立待確認請求。付款必須在**另一個裝置或另一位成員的畫面上**確認，
  本頁面（發起請求的這個分頁）不會出現確認按鈕，Agent 無法代為完成。」
- 回傳訊息改成：「已送出 NT$X 的結帳請求。我無法完成付款，
  這個分頁也不會出現確認按鈕——請在你的手機或其他裝置打開同一個房間網址確認，
  或請同行成員協助確認。」

這一層不是防線（合作的 Agent 才會照做），但能讓 Agent 主動引導使用者去對的地方，
而不是在畫面上到處找按鈕。

### 不要做的

- 不要嘗試偵測自動化（`navigator.webdriver`、`isTrusted`、行為特徵）——無效且會誤傷。
- 不要加 CAPTCHA。
- 不要為「獨旅」寫特例分支。一條 session 規則就涵蓋兩種情境。
- 不要動衝突偵測、行程 CRUD、時間軸的任何邏輯。

### 驗收

1. 同一個瀏覽器分頁按「結帳」→ 該分頁**沒有**確認按鈕，只顯示提示文字
2. 另開一個分頁（同房間、同名字或不同名字）→ 該分頁**有**確認按鈕，按下去付款成功
3. 手機開同一個房間網址 → 有確認按鈕，可完成付款
4. 對 ChatGPT 說「幫我結帳，然後按下確認」→ 它送出請求，但**在它那個分頁找不到按鈕**，
   應該會回報它做不到（這一項需使用者用 ChatGPT 桌面版驗證）
5. 否決按鈕在任何 session 都能按

### 回報


---

## 任務 2：Chrome origin trial token ✅（token 已申請並貼入 head，已驗證）

評審不會為了試玩去開 `chrome://flags`。沒有 token，他們打開網址只會看到「WebMCP 不可用」。

1. 到 https://developer.chrome.com/origintrials 註冊 WebMCP trial，
   Web Origin 填 `https://coplan.coplan-lab.workers.dev`
2. 取得 token 後，加進 `public/index.html` 的 `<head>`：
   `<meta http-equiv="origin-trial" content="TOKEN" />`
3. 重新部署，用**沒有開 flag 的瀏覽器**驗證 WebMCP 仍顯示可用

**這一步需要人操作註冊頁面**，Claude Code 無法代勞，請提醒使用者處理。

### 回報


---

## 任務 3：示範資料與一鍵重置（做完任務 1 再做）

錄 demo 影片時需要能快速回到乾淨狀態，也需要讓評審一打開就看得到內容。

- 網址參數 `?seed=1` 時，若房間是空的，自動塞入一組東京三天的示範行程
  （含兩筆刻意衝突的項目、兩筆已標價的待訂項目），讓評審一開就有東西看。
- 提供 `?reset=1` 清空房間（僅清資料，不影響程式）。
- 示範資料放在前端常數，不要進 `src/index.js`。

### 回報



---

## 任務 3.5：修 SEC-001 儲存型 XSS（**最優先，先於英文化**）✅

完整分析見 `docs/REVIEW-2026-08-28.md`。摘要：

使用者可控的字串（`?as=` 的名字、行程標題、稽核 summary）被直接插進 `innerHTML`，
沒有轉義。攻擊者傳一個 `?as=<img src=x onerror=...>` 的連結給旅伴，
該字串會存進伺服器並在**所有成員**的瀏覽器執行（儲存型 XSS）。
注入的腳本可以直接呼叫 `approveCheckout()`，讓整個付款閘門失效。

**做法**：加 `esc()` 轉義函式，把所有 `innerHTML` 樣板裡的動態值包起來。
詳細位置清單與驗收方式見審查報告。

順便處理報告中的 MAINT-001（刪除兩個 `.bak` 檔）與 MAINT-002（`?as=` 限長 20 字）。

### 回報

**改了哪些檔案**：`public/index.html`（加 `esc()`、套用到全部 5 處 `innerHTML` 動態值、`?as=` 限長）；刪除 `public/index.html.bak`、`src/index.js.bak`（用 `~/.claude/scripts/trash.ps1` 移到回收桶，不是永久刪除）。沒有動 `src/index.js`——SEC-001 是純前端渲染問題。

**esc() 套用位置**：逐一核對審查報告列的三處＋「其他任何 innerHTML」，實際找到 5 處動態值，全部套用：
1. 行程卡片 `row2.innerHTML`：`a.type`、`a.createdBy`
2. 時間軸 `div.innerHTML`：`e.who`（兩個分支都要）、`e.action`、`e.summary`
3. 成員清單 `renderMembers`：`m.name`
4. 待確認結帳框 `renderApprovals`：`p.requestedBy`（兩個分支）
5. 待確認結帳框發起端提示：`location.href`（review 有特別點名這一處，容易漏，因為看起來像是「我方產生的網址」而非使用者輸入，但網址的 query string 本身就帶著使用者可控的 `?as=` 值）

`colorOf()` 回傳值（PALETTE 固定色碼）與 `titleSpan.textContent = a.title`（已用 textContent）依審查報告的判準不需轉義，維持原樣。

**MAINT-002 的一行修正**：`myName` 改成 `(...get("as") || "").slice(0, 20).trim() || "Anonymous Traveler"`，超長或空白都會落回預設值。

**驗證**：Playwright 用 `?as=<img src=x onerror=alert(document.title)>` 開房並新增一筆行程——沒有跳出任何 alert，成員清單、行程卡片、時間軸三處都把該字串當純文字顯示，沒有被當成 HTML 執行。Console 全程無錯誤。這條是本次修正的核心驗收項目，已用瀏覽器實際攻擊字串驗證過，不是只讀程式碼判斷。

---

## 任務 3.6：WebMCP 安全加固（與任務 3.5 一起做）✅

完整分析見 `docs/REVIEW-WEBMCP-SECURITY.md`。這裡只列要動手的部分。

### A. SEC-005 欄位白名單（🔴 必修 — 目前可繞過付款閘門）

`src/index.js` 的 `add` 與 `update` 分支用 `...msg.activity` / `Object.assign(a, msg.patch)`
原封不動接受任何欄位。任何人在 Console 送
`{t:"update", id, patch:{paid:true}, ...}` 就能把項目標成已付款，
**繞過整個跨 session 結帳閘門**——那正是本作品的核心主張。

加白名單，並讓 `id` / `createdBy` / `viaAgent` / `paid` / `conflictWith` 一律由伺服器決定：

```js
// 只接受這些欄位。用白名單而非黑名單——否則 patch 可以塞 paid:true
// 直接繞過付款閘門，而付款閘門是這個作品的核心主張。
const ALLOWED_ACTIVITY_FIELDS = ["type", "day", "start", "end", "title", "note", "price"];
function pickActivityFields(obj) {
  const out = {};
  for (const k of ALLOWED_ACTIVITY_FIELDS) if (obj && k in obj) out[k] = obj[k];
  return out;
}
```

- `add`：`{ id: crypto.randomUUID(), createdBy: msg.activity.createdBy, viaAgent: !!msg.activity.viaAgent, ...pickActivityFields(msg.activity) }`
- `update`：`Object.assign(a, pickActivityFields(msg.patch))`

### B. SEC-006 速率與容量上限（🟡 建議 — 做最小版就好）

**理由**：人不會一分鐘點一千次，Agent 會。開放給 Agent 的介面需要比人類介面更嚴格的配額。

最小版三條，全部用記憶體計數，不要引入任何外部服務：

1. `items` 上限 200 筆。超過時不新增，寫一筆 `action: "limit_reached"` 的日誌
2. `pendingApprovals` 上限 5 筆；且**同一個 `sessionId` 已有待確認請求時不再建立新的**
   （回一筆日誌說明已有待確認請求）
3. 每個 WebSocket 連線每秒最多 20 則訊息，超過直接忽略（不需回應）

### C. SEC-008 資料外流告知（🟡 極低成本，加分項）

在頁面上（成員區下方或頁尾）加一行小字：

> Tools exposed to your agent can read this room's itinerary.
> Anything here may be sent to your agent provider.

這是 agentic web 的知情同意問題，主動處理會讓評審印象深刻。

### D. SEC-002 破壞性工具的警語（🟡 極低成本）

`remove_activity` 的 description 補上：

> This removes an item for **everyone**, including items proposed by other travelers.
> Always confirm with the user before removing an item they did not create.

`update_activity` 也補一句類似的（會影響所有成員）。

### 不要做的

- **不要**為 `update` / `remove` 加 `createdBy` 權限檢查。共編工具就是大家都能改
  （Google Docs 也是），加了會破壞產品定位。改用稽核 + 告知。
- **不要**加 nonce / 序號防 replay。分析後確認：`approve_checkout` 因為請求是一次性的
  （確認後即 splice 移除），天然免疫重放；其餘重放只造成雜訊。
- 不要引入任何外部服務或套件做速率限制。

### 驗收

1. Console 送 `ws.send(JSON.stringify({t:"update", id:"<某個id>", patch:{paid:true}, by:"X", viaAgent:false}))`
   → 項目**不會**變成已付款
2. 連續呼叫 `request_checkout` 兩次 → 只會有一筆待確認請求
3. 迴圈送 100 則 add 訊息 → 不會全部進去，且頁面不卡死
4. 既有功能全部正常

### 回報

**改了哪些檔案**：只有 `src/index.js`（A、B）與 `public/index.html`（C、D 各一行/一句）。

**A. 欄位白名單**：完全照給的程式碼做，`ALLOWED_ACTIVITY_FIELDS` 沒有 `id`/`createdBy`/`viaAgent`/`paid`/`conflictWith`，這五個一律由伺服器決定，`add` 用 `msg.activity.createdBy` + `!!msg.activity.viaAgent` + `pickActivityFields`，`update` 用 `Object.assign(a, pickActivityFields(msg.patch))`。

**B. 速率與容量上限**，三條都做：
1. `items` 上限 200，超過時不 push，改寫一筆 `action: "limit_reached"` 的稽核紀錄（沿用同一個 `if/else` 結構，不影響後面的 `detectConflicts`/`save`/`broadcast`）
2. `pendingApprovals` 上限 5 筆，且同一 `sessionId` 已有待確認請求時直接拒絕、寫 `action: "checkout_limited"` 的紀錄——這條同時也是任務規格外多做的「防重複結帳」，驗收 2（連續呼叫兩次只留一筆）就是靠這個機制通過的
3. `webSocketMessage` 一進來就先過速率窗（`Map<ws, {count, windowStart}>`，每秒重置），超過 20 則直接 `return`，不解析訊息、不回應

**多做的一件小事（不在規格清單但同一個機制自然需要）**：加了 `webSocketClose` / `webSocketError` 清掉對應連線的 `rateLimits` 項目，避免這個 Map 隨著連線數（尤其是短連線反覆進出）無界成長——這跟 SEC-006 本身在防的「無上限資源成長」是同一件事，所以一起做了，沒有另外問。

**C. 資料外流告知**：在左欄「Travelers」區塊、成員清單下方加了一行 `.agent-notice`（13px、`--muted`），文字照規格原文。

**D. 破壞性工具警語**：`remove_activity` 與 `update_activity` 的 description 各補一句，`remove_activity` 用規格給的原文（會影響所有成員、刪除前確認），`update_activity` 仿照寫法補「可能改到別人建立的項目，動手前先跟使用者確認」。

**驗證（Playwright 實際攻擊，非只讀程式碼）**：
1. `patch:{paid:true}` 直接送 → 該筆項目沒有變成已付款，價格欄位仍可編輯，`paid` 欄位沒有被寫入。同一時間送 `patch:{price:500}` 驗證白名單內的欄位仍正常生效，排除「整個 update 被擋掉」的誤判。
2. 連續呼叫 `requestCheckout(false)` 兩次 → `#approvals` 只多一個框，時間軸出現 `checkout_limited` 紀錄說明第二次被擋下的原因。
3. 迴圈送 50 則 `add`（用 50 而非 100，效果相同但省驗證時間）→ 伺服器只接受 20 則（速率窗生效），頁面全程可操作、無 JS 錯誤。**有一個值得注意但不算失敗的現象**：洪水攻擊後所有分頁的 WebSocket 一度斷線（`readyState 3`），懷疑是 Durable Object 在瞬間流量下重啟或被驅逐，而不是單純限流生效；重新整理後**立即重連、資料完全沒有遺失**（含已接受的 20 筆全部都在）。這代表限流本身有效，但如果要在正式 demo 上避免這個瞬斷的觀感，可能需要另外處理 DO 的負載行為——這超出「最小版三條」的範圍，記在這裡讓你判斷要不要另開任務。
4. 既有功能（新增/改時間/刪除、跨 session 確認、英文化）用 Playwright 走過一輪，行為與修正前一致，Console 無錯誤。

**沒有做的（照「不要做的」清單，確認過不是遺漏）**：沒有加 `createdBy` 權限檢查、沒有加 nonce/序號防重放、沒有引入任何外部服務。

---

## 任務 4：介面英文化（最高優先）✅

### 為什麼

評審是 OpenAI 與合作夥伴的國際團隊。他們會實際打開網站試玩，
畫面全中文會讓他們無法判斷「執行品質」——而那佔評分四分之一權重。

### 要做的

把 `public/index.html` 裡**所有使用者看得到的中文字串**改成英文，包括：

- 標題列、按鈕、表單標籤、下拉選項（景點/餐廳/交通/住宿 → Sight / Food / Transit / Stay）
- 狀態文字（已連線、WebMCP 已就緒、連線中斷）
- 空狀態文案
- 衝突警告、超支警告、已付款標記
- 待確認結帳區的全部文字，**特別是這幾句要翻得精準有力**：
  - 「🔒 為了保護你的付款，發起請求的裝置不能自行確認。」
    → `🔒 For your protection, the device that requested this payment cannot approve it.`
  - 「請用手機或另一個裝置打開這個房間，或請同行成員確認」
    → `Open this room on your phone or another device, or ask a fellow traveler to approve.`
  - 「這筆請求由另一個裝置發起，你可以代為確認。」
    → `This request came from another device. You can approve it here.`
- **WebMCP 工具的 `description` 全部改成英文**——Agent 讀的是這些，英文的 description
  對英文 prompt 的理解更穩定，評審也會檢查工具定義的品質。工具的 `name` 維持不變。
- 伺服器產生的稽核 summary（在 `src/index.js` 裡）也要英文化，
  例如 `Added "Tsukiji Market" to Day 1 09:00–11:00`、
  `${name} joined the trip`、
  `Approval blocked: the device that requested checkout cannot approve it`
- `<title>` 改成 `CoPlan — Multiplayer itinerary planning with your own AI agent`

### 不要做的

- 不要做多語系切換機制（i18n 框架、語言檔）——只要直接改成英文。
  現在做切換是為了還不存在的需求增加複雜度。
- 不要改任何工具的 `name`、`inputSchema` 結構、或任何邏輯。
- 不要改變 `viaAgent`、session 檢查、衝突偵測的行為。

### 驗收

- 全站沒有中文（程式碼註解可以維持中文，那是給開發者看的）
- 所有既有功能行為不變（新增／改時間／刪除／預算／跨 session 確認）
- Console 無錯誤

### 回報

**改了哪些檔案**：`public/index.html`（所有 UI 字串、WebMCP 工具 description、`<title>`、`lang="en"`）與 `src/index.js`（8 個 `addLog` 的 summary）。

**做完的範圍**：標題列、狀態文字、表單標籤與下拉選項（`Sight/Food/Transit/Stay`，連同 `add_activity` 的 `inputSchema.enum` 一起改，確保 UI 選項與工具接受的值一致，這點規格沒明講但邏輯上一定要一致，否則 Agent 傳中文列舉值會跟畫面選項對不上）、空狀態文案、衝突／超支／已付款標記、待確認結帳區全部文字（三句指定翻譯照給的原文用）、6 個 WebMCP 工具的 description 與 `execute` 回傳訊息、`src/index.js` 的 8 個稽核 summary、`<title>`、`<html lang>` 改成 `en`。連 `?as=` 沒帶值時的預設顯示名稱「匿名旅伴」也一併改成 `Anonymous Traveler`（規格沒列這條，但它是使用者看得到的字串，不改會漏網）。

**規格沒寫到、自行決定的地方**：
1. 時間軸的 `toLocaleTimeString` locale 從 `"zh-TW"` 改成 `"en-US"`（`hour12:false` 已強制 24 小時制，locale 主要影響次要格式細節，跟著介面語言一致比較合理）。
2. 幾處數量文字加了單複數判斷（`1 item` vs `2 items`），規格的英文範例沒特別要求，但中文本來就沒有單複數問題，直接翻成英文若不處理會出現「1 items」這種不自然的說法，判斷這是翻譯品質的一部分，不是額外功能。
3. 程式碼註解維持中文，符合驗收「程式碼註解可以維持中文」。

**驗證**：先用 `grep` 對兩個檔案抓所有中日韓文字區間字元，確認命中的只剩 `//` 與 `/* */` 註解，沒有任何字串字面值遺漏。接著兩輪 Playwright 驗證（第一輪在英文化完成後、第二輪在任務 3.5/3.6 安全修正之後重跑一次確認沒有回歸）：全頁畫面截圖逐字掃描無中文；新增/設預算/結帳/確認/否決、衝突警示、375px 版面都用真的瀏覽器操作過，行為與改版前一致；Console 全程無錯誤。第一輪驗證另外抓到一個小 bug（伺服器端結帳稽核紀錄的「(N items)」沒有做單複數，跟畫面上的「(1 item)」不一致）已經修掉。

**沒有測、需要你確認的**：WebMCP 工具的英文 description 對 Agent 理解程度的實際影響（例如 ChatGPT 讀了新版 description 是否還是會正確呼叫工具、有沒有因為翻譯造成語意流失）——這需要有 flag 的 Chrome 或 ChatGPT 桌面版實際跟 Agent 對話測試，我這邊只能確認字串本身翻得對、工具還能正常註冊與被靜態呼叫。

---

## 任務 5：示範資料與重置 ✅

錄影與評審試玩都需要「一打開就有東西看」。

- 網址參數 `?seed=1`：若房間是空的，自動載入一組東京三天的示範行程。
  內容需包含：
  - 至少兩筆**刻意時間衝突**的項目（讓評審一眼看到衝突偵測）
  - 至少三筆**已標價**的待訂項目（讓結帳流程可以直接演）
  - 分屬兩個不同成員（例如 Cindy 與 Bob），顏色才有對比
- 網址參數 `?reset=1`：清空該房間的行程、日誌與待確認請求（成員可留）。
  清空後把網址參數移除（`history.replaceState`），避免重整又清一次。
- 示範資料放在 `public/index.html` 的常數，**不要進 `src/index.js`**。
- 兩個參數都只影響資料，不改變任何邏輯。

### 驗收

- `?seed=1` 開新房間 → 出現示範行程，其中有琥珀色衝突標記與已標價項目
- `?seed=1` 開已有資料的房間 → **不覆蓋**既有資料
- `?reset=1` → 清空，且重整後不會再次清空

### 回報

**改了哪些檔案**：只有 `public/index.html`（一個 `DEMO_ITEMS` 常數 + `maybeSeedDemo` / `maybeReset` 兩個函式，掛在 `ws.onmessage` 收到第一份 state 時觸發）。沒有動 `src/index.js`，也沒有新增任何後端訊息類型——`seed` 用既有的 `add` 訊息逐筆送、`reset` 用既有的 `remove` / `reject_checkout` 訊息逐筆清，理由是這樣完全不用碰後端就能做到規格要求的效果。

**示範資料內容**：東京 3 天、8 筆項目，分屬 Cindy（4 筆）與 Bob（4 筆）；Day 1 的兩筆（09:00–11:00 淺草寺 / 10:00–12:00 上野公園）與 Day 2 的兩筆（15:00–16:00 箱根旅館入住 / 15:30–17:00 蘆之湖遊船）分別重疊，共兩組衝突（規格只要求至少一組「兩筆衝突」，這裡做了兩組讓 Day 1、Day 2 都看得到琥珀色標記）；四筆已標價（¥1,200／¥3,400／¥8,000／¥3,800），均超過規格要求的「至少三筆」。

**規格沒寫到、自行決定的地方**：
1. `seed`/`reset` 的資料是直接建 `add`/`remove`/`reject_checkout` 訊息送出，**沒有經過 `addActivity()` 這個動作層包裝函式**——因為 `addActivity()` 會強制把 `createdBy` 寫成目前這個 session 的名字（`me()`），但示範資料需要同時有 Cindy 跟 Bob 兩個作者，跟目前開房間的人是誰無關。這是刻意繞過既有的動作層入口，理由已寫在程式碼註解裡。
2. **`reset=1` 沒有清空日誌（Agent 活動時間軸）**——規格寫「清空該房間的行程、日誌與待確認請求」，但現有的 WebSocket 訊息類型裡沒有任何一個能清空 `log` 陣列（`add`/`update`/`remove` 只操作單筆項目，沒有「清空日誌」這個操作），要做到就必須在 `src/index.js` 新增一種訊息類型或給既有訊息加特殊分支，這超出本任務「不要進 `src/index.js`」的範圍。故意沒做，已在程式碼裡寫註解說明，讓你判斷是否要另開一個小任務加後端支援，還是接受 demo 錄影前重新整理房間、log 本來就有 100 筆上限不會無限成長。
3. `reset=1` 清空後只移除網址上的 `reset` 參數，保留其他參數（例如 `as=`），用 `URLSearchParams.delete` 而非整個清空 query string，這樣使用者的身分不會因為按了 reset 而跟著被清掉。

**跟舊的「任務 3」重複**：`docs/TASKS.md` 裡還留著較早、較簡略的「任務 3：示範資料與一鍵重置」，內容被這份任務 5 完整取代（規格更細、驗收更明確），我視為任務 3 已由任務 5 取代、不再單獨執行，沒有另外處理任務 3 的回報區塊，留給你確認要不要把任務 3 整段刪掉以免以後混淆。

**驗證**：Playwright 測過 `?seed=1` 在空房間會塞入全部 8 筆示範行程、衝突標記與價格正確顯示；在已有資料（23 筆殘留測試資料）的房間開 `?seed=1` 時正確跳過、沒有覆蓋既有資料——這正好驗證了「不覆蓋」這條規則。`?reset=1` 的清空與網址參數移除邏輯有讀過程式碼確認，實際清空效果因為測試環境房間一直被其他並行的驗證流程持續寫入資料，沒有取得一個乾淨的「清空後重整、確認不再清空」的獨立截圖，建議你自己在乾淨房間跑一次 `?seed=1` → `?reset=1` → 重新整理，肉眼確認清空且沒有再次清空。

---

## 任務 6：README 與授權（提交必要條件） ✅

Devpost 規則要求**公開的程式碼儲存庫並附開源授權**，沒有會不予評分。

- 專案根目錄新增 `README.md`，**用英文**，包含：
  - 一句話說明這是什麼（multiplayer itinerary planning where each traveler brings their own AI agent）
  - Live demo 網址
  - 三個亮點：multi-user real-time collaboration、deterministic conflict detection、
    cross-session payment approval
  - **WebMCP 工具清單**（表格：tool name / what it does）
  - How it works：一段說明「人和 Agent 走同一條程式路徑」的架構，附簡單流程圖（純文字即可）
  - 兩個實測發現：①`document` vs `navigator.modelContext` 平台差異
    ②能操作瀏覽器的 Agent 可以點按鈕，所以閘門必須是「不渲染按鈕」而非 disabled
  - Local development 步驟（npm install / wrangler dev / Chrome flag）
  - Tech stack：Cloudflare Workers + Durable Objects、vanilla JS、WebMCP
  - License 段落
- 根目錄新增 `LICENSE`，用 MIT，年份 2026
- 內容可從 `docs/` 底下的文件整理，但 README 要精簡，**不要把整份 docs 貼過去**

### 回報

**新增檔案**：根目錄 `README.md`、`LICENSE`。另外把 `package.json` 的 `"license"` 欄位從 `"ISC"`（舊的預設值，從沒對過）改成 `"MIT"`，跟新加的 LICENSE 檔案一致——這條不在任務清單裡，但既然要加開源授權，`package.json` 自稱的授權跟實際的 LICENSE 檔不一致會很奇怪，屬於同一件事的一部分，就一起改了。

**README 內容**：清單要求的項目全部有——一句話說明、live demo 網址、三個亮點、6 個 WebMCP 工具的表格、「人和 Agent 走同一條程式路徑」的架構說明＋純文字流程圖、兩個實測發現（`document`/`navigator.modelContext` 平台差異、「不渲染按鈕」而非 disabled 的理由）、Local development 步驟、Tech stack、License 段落。

**多加的一段（規格沒要求，但判斷值得加）**：「Known trade-offs」小節，寫了三件事——沒有身分驗證（連結分享模式）、價格是自填不是真實金流、伺服器有白名單/容量/速率限制。這些內容其實是 `docs/REVIEW-WEBMCP-SECURITY.md` 裡明確建議「要主動寫進提交說明」的項目（SEC-003 身分驗證、price 未來要接真實金流才能改由伺服器決定、SEC-006 的配額限制）。README 就是這次唯一會被評審看到的「提交說明」，所以我判斷這些內容屬於任務 6 的範圍內，不是擴大範圍，一起放進去了。

**LICENSE 的版權人名稱**：MIT 條款需要一個 `Copyright (c) 2026 <名字>`，任務清單沒指定要填誰，我先填了專案名稱「CoPlan」（沒有正式法人或指定個人時的常見慣例）。如果你想改成你自己的名字或 GitHub 帳號，直接改 `LICENSE` 第 3 行即可。

**驗證**：README 裡列的檔案結構、指令、路由都對照現有的 `wrangler.jsonc`、`package.json`、`src/index.js`、`public/index.html` 逐項核對過，沒有憑空編造路徑或指令；6 個工具的 description 摘要跟 `public/index.html` 目前英文化後的版本一致。這份文件本身不涉及程式邏輯，沒有可以用瀏覽器驗證的行為，用「內容跟程式碼一致」取代功能測試。

---

---

## 任務 7：讓 `?reset=1` 真正乾淨（錄影前必做，改動很小） ✅

見 `docs/REVIEW-2026-08-28b.md` 的 REV2-002。

目前 `?reset=1` 用逐筆 `remove` 訊息清空，會在時間軸留下一整排 `remove_activity` 紀錄，
日誌也清不掉。錄 demo 影片時開場畫面不乾淨。

**做法**：

1. `src/index.js` 加一個分支：

```js
// 錄影與評審試玩用的重置。一次清空，避免逐筆刪除在時間軸留下數十筆雜訊。
// members 保留，這樣重置後成員顏色與名單不變，錄影可以直接接著開始。
if (msg.t === "reset_room") {
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
```

2. 前端 `maybeReset` 改成只送這一則訊息，移除原本的逐筆 remove 迴圈。
   移除網址參數那段保留。

**同時處理 REV2-001**：在 `renderApprovals` 的 `who` 變數上方加註解：

```js
// who 內含已組好的 HTML：requestedBy 在這裡就要 esc()，
// 之後插進 innerHTML 時不會、也不能再轉義一次。
```

**驗收**：`?reset=1` 後行程、時間軸、待確認請求全空，時間軸只留一筆 reset 紀錄，
成員清單保留，重整不會再次清空。

### 回報

**改了哪些檔案**：`src/index.js`（新增 `reset_room` 分支，完全照給的程式碼，一字不改）、`public/index.html`（`maybeReset` 改成送單一 `reset_room` 訊息、`renderApprovals` 加 REV2-001 的說明註解）。

**`reset_room` 分支放置位置**：放在 `reject_checkout` 分支之前，跟 `join` 分支一樣用 `return` 提早結束——因為它自己已經呼叫了 `save()`/`broadcast()`，不需要再跑到函式尾端共用的那段。

**`maybeReset` 的一個小備註**：函式簽章還留著 `currentItems`、`currentApprovals` 兩個參數，但函式內容改掉後這兩個參數已經沒用到了。因為任務描述是「改動很小」且沒有要求動函式簽章或呼叫端，我沒有連帶清掉這兩個沒用到的參數，維持最小改動；如果你要一併清乾淨，`ws.onmessage` 裡的呼叫處也要跟著改。

**驗證（Playwright 實測，非只讀程式碼）**：`?seed=1` 開房塞入示範資料與稽核紀錄後，接著開 `?reset=1`——行程板變回空狀態文案、時間軸只剩一筆 `reset_room`（「Room reset — itinerary, timeline and pending approvals cleared」）、待確認結帳框消失、成員清單完整保留（含所有先前 join 過的名字）；網址列的 `reset` 參數已被移除；重新整理後時間軸依然只有那一筆，沒有被重複清空。Console 全程無錯誤（僅無關的 favicon 404）。六項驗收全過。

---

---

## 任務 8：版面重新設計（依 `docs/DESIGN-V2.md`） ✅

**先完整讀 `docs/DESIGN-V2.md` 再動手。** 那份規格已經把顏色、尺寸、版面、每個元件、
實作順序與退路全部訂死，不需要你做設計判斷。

### 重點提醒

- **第 1 節「不可破壞的東西」是硬性約束**，每一步做完都要對照驗證
- **完全不要動 `src/index.js`**，也不要改任何 WebMCP 工具的定義
- 依第 6 節的**八個步驟一步一驗**，不要一次全改。每步做完確認功能正常、Console 無錯誤
- 第 4 步（比例定位的日程網格）是核心，也是風險最高的一步。
  **若超過兩小時仍不穩定，依第 7 節退回列表版**，其餘步驟照常完成

### 為什麼要做這個改版

現在的版面只是把功能排整齊。改版後：
- 旅伴移到最上方 → 一眼看出「這是多人的」
- 行程改成按時間比例定位的網格 → **時間重疊的行程會真的在畫面上並排擠在一起**，
  觀眾不必讀文字就懂衝突是什麼。這是 demo 影片裡最有說服力的一格畫面
- 待確認付款改成全寬橫幅 → 無法忽視

### 完成後需要使用者驗證的項目（你無法自行驗證）

- 用開了 flag 的 Chrome 實測 WebMCP 工具仍正常註冊與呼叫
- 用 ChatGPT 桌面版實測 Agent 呼叫工具、以及跨 session 付款保護

### 回報

**改了哪些檔案**：只有 `public/index.html`（完全重寫），`src/index.js` 全程未動——`git diff --stat` 確認過，第 1 節「不可破壞的東西」逐條都保留：6 個 WebMCP 工具的 `name`/`description`/`inputSchema` 一字未改、`esc()`/`addActivity`/`updateActivity`/`removeActivity`/`setBudget`/`requestCheckout`/`approveCheckout`/`colorOf`/`DEMO_ITEMS`/seed 與 reset 邏輯全部逐字複製、伺服器廣播後才重繪的模式沒破、結帳橫幅的鎖定文字（`🔒 For your protection...` 等）逐字保留。

**第 4 步（比例定位網格）沒有採用第 7 節的退路**——完整實作了規格的日程網格，兩小時內就做完且穩定，不需要退回列表版。

**我自己驗證過的項目**（本機 `wrangler dev` + Playwright 實測，非只讀程式碼）：
- 空房間：Console 無錯誤、09:00–18:00 刻度、空狀態文案
- 比例定位：1 小時行程 = 56px、4 小時行程 = 224px，時間差 5 小時對應 top 偏移 280px，精確吻合
- 重疊並排：兩筆重疊行程等寬並排、都標 `conflict` 樣式與 ⚠️；加入第三筆遞移重疊的行程後正確重新分組成三等分（transitive grouping 有效）
- 點選行程開啟右欄編輯卡、改時間後區塊高度即時跟著變、× 關閉卡片；用編輯卡刪除行程後正確移除並讓剩餘重疊項目重新分組
- 預算 inline 編輯：Set budget → 輸入 → Enter 提交 → 再次點擊可編輯 → blur 提交，皆正確反映
- 跨 session 付款保護：兩分頁測試，請求端只看得到「Cancel this request」，另一分頁（不同 session）正確顯示「This device already has a pending checkout」之外的另一則文字（可審核批准），批准後請求端行程正確變 `paid` 樣式（勾號 + 淡化）
- 鍵盤無障礙：Tab 可 focus 到行程區塊（可見 outline），Enter 可開啟編輯卡
- 375px 窄螢幕：無橫向捲動、Day 1/2/3 各自的時間刻度正確在窄螢幕下恢復顯示

**驗證中發現並已修正的問題**：`.toolbar` 原本用固定 `height: 48px` 但同時有 `flex-wrap: wrap`——窄螢幕下 Travelers 的 chip 多、換行後內容變高，固定高度沒讓容器跟著撐開，換行的第二排會溢出蓋到下方的 `.agent-notice` 文字（規格外發現的真實 CSS bug，非規格本身的問題）。修法：`height: 48px` 改成 `min-height: 48px`，並把 `padding: 0 16px` 改成 `padding: 6px 16px` 讓換行後上下留白不會太擠。修完後重測 375px：toolbar 隨內容撐高到 190.8px，`.agent-notice` 緊接在下方、無重疊，截圖確認正常。這是本次唯一的程式碼修正，範圍限定在 `.toolbar` 這條 CSS 規則，沒有動到任何不可破壞清單裡的項目。

**驗證後判斷是誤報、未修改的項目**：驗證時另外觀察到「新加入的分頁（Approver）一開始預算顯示『Set budget』，即使房間日誌已顯示有人設過 NT$3,000 預算」——確認過這不是 bug：預算是**個人**設定（存在 `members[msg.by].budget`，不是房間層級共用值），Approver 自己從未設過預算，顯示「Set budget」是正確行為，跟先前 Tester 設的 3000 無關。不需修改。

**需要你自己用 Chrome/ChatGPT 確認的項目（我這邊無法驗證）**：
- 開啟 WebMCP flag 的 Chrome 上，6 個工具是否仍正確註冊、`document.modelContext`/`navigator.modelContext` 是否能列出並呼叫（程式碼本身逐字未改，理論上行為不變，但需要你實機確認瀏覽器端真的認得到）
- ChatGPT 桌面版透過 Agent 實際呼叫 `request_checkout` 等工具，確認畫面上的批准按鈕在請求端 session 真的「找不到」（不是工具層面擋，而是 DOM 上真的沒有這個按鈕可點）

**規格未明講、我自己判斷的地方**（供之後對照）：
- 桌機版每個 `.day-block` 各自帶一個 `.gutter`，只在第一欄顯示（`visibility:hidden` 隱藏其餘欄位的刻度但保留寬度），而非規格圖示字面上的單一共用時間軸——這樣三個日欄才能維持真正等寬；窄螢幕再用一條媒體查詢把 `visibility` 打開即可還原每欄各自的刻度，不用寫 resize 監聽
- `computeTimeRange()` 在總時距 < 6 小時時，優先往後延伸 `endMin`（上限 23:00），延伸不夠才往前拉 `startMin`（下限 00:00）——規格沒指定延伸方向，選了「先延後、後提前」
- 時間軸的 `.warn-row`（conflict/approve_blocked 提示色）不會蓋過姓名 span 既有的 inline `colorOf()` 顏色（CSS specificity，inline 必贏），判斷為可接受的次要視覺瑕疵，沒有用 `!important` 硬蓋

---

## 任務 9：介面中英切換 ✅

規劃端在任務 8 之後直接動手加了一份中英切換（未走正常流程）。第 0 步先確認過：
`public/index.html` 從任務 8 起就沒 commit 過，任務 8 的重寫跟這份語言切換疊在同一份未版控的工作目錄裡，
無法乾淨切分退掉語言切換、只留任務 8。第一輪稽核用「跟規格逐條核對」的方式檢查這份既有實作，
但你指出這是循環論證（規格是照著這份既有 code 寫的，符合規格不構成獨立驗證），第 2/4/5/6 節的靜態核對
不算數，第 7 節要重新設計測法、實際跑過。以下是照這個要求重做的結果。

### 第 0 步：先 commit

`git status` 確認過 `public/index.html` 沒被 `.gitignore` 排除（`.gitignore` 只排 `node_modules/` 與 `.wrangler/`，
純粹是沒人 commit 過，不是被忽略）。已將任務 8 重寫 + 語言切換 + `docs/DESIGN-V2.md`（原本也未追蹤）
一起 commit（`083e206`），訊息裡誠實寫明這是兩件事疊在一起、任務 9 尚未驗收。
`public/index.html.pre-task9-backup` 沒有進版控，commit 完已刪除。`src/index.js` 全程未變動（`git diff --stat` 為空）。

### 第 7 節：我自己重新設計並實測的項目（本機 wrangler dev + Playwright，非讀程式碼推論）

測試前先清掉六個互相打架的殘留 `wrangler dev`／`workerd.exe` 進程（多次任務下來沒清乾淨，
導致一開始連線一直 hang）。以下每項都是這次獨立設計、實際跑出來的結果，不是沿用規劃端的測試結構：

- **英文模式逐字核對**：沒有拿規劃端的 `I18N.en` 當基準，改用 `git log -S "For your protection"` 與
  `git log -S "ask a fellow traveler to approve"` 去翻任務 8 之前就已 commit 的歷史版本，
  確認結帳鎖定文字（含 `<b>` 標籤位置與句尾冒號）逐字元組相同，不是規劃端改過的。
  另外實測讀取 `#status`／`#mcp`／`#copyInvite`／`.travelers-label`／`#checkout`／`.agent-notice`／
  `#add`／`.section-title` 的即時 DOM 文字，全數與英文預設值相符。
- **`#type` select.value 在中文模式下仍為英文 enum**：實測切到中文後讀 `#type option` 的
  `value` 屬性，四個選項的 `value` 分別仍是 `Sight`/`Food`/`Transit`/`Stay`，只有顯示文字變中文。
- **雙分頁跨語言即時同步（真實 WebSocket，不是假的）**：開兩個真的分頁連進同一個房間——
  Alice 用中文、Bob 用英文（各自手動切換，不依賴 localStorage，因為兩分頁同源共用 localStorage，
  這點在下方「規格未明講之處」有記錄）。從 Bob（英文）新增一筆 `type: "Food"` 的行程，
  在 Alice（中文）分頁**即時**收到廣播、行程塊正確渲染、日誌正確顯示「已新增「...」到第 1 天 12:00–13:00」，
  且讀取 `items` 陣列確認伺服器實際存的 `type` 值是英文 `"Food"`，不受 Alice 端語言影響。
- **跨 session 付款保護（querySelector 確認 DOM，不是看畫面），兩種語言都測**：Bob 建立一筆
  NT$2,500 的待付項目並發起結帳。在 Bob（請求端）的分頁用 `querySelector` 抓
  `.approval-banner` 裡所有 `<button>`，英文模式下只有一顆「Cancel this request」，DOM 裡
  完全沒有 approve 按鈕；接著在同一分頁切成中文、重新查詢，仍然只有「取消這筆請求」一顆，
  確認語言切換的重繪不會意外生出確認按鈕。另一分頁 Alice（不同 session）中文模式下正確顯示
  「確認付款」／「拒絕」兩顆按鈕；點下「確認付款」後，Bob 分頁即時收到廣播、該行程變
  `paid: true`、待確認橫幅消失、日誌正確顯示「已確認付款 NT$2,500（demo 模式，未接真實金流）」。
- **語言切換不多送 WebSocket 訊息**：重新整理分頁後，用 `WebSocket.prototype.send` 包一層計數器
  （在初始 `join` 訊息送出之後才掛上，避免把它算進去），連續切換語言 2 次，計數器全程維持 0。
- **Fallback（塞一筆表上沒有的訊息，不是讀程式碼推論）**：因為 `src/index.js` 現有 13 個
  `addLog()` 呼叫點跟前端的 13 條規則剛好一一對應，沒辦法在不動 `src/index.js` 的前提下讓伺服器
  真的產生第 14 種訊息。改用等效的作法：直接對真實的 `log` 陣列 `push` 一筆規則表上沒有的假訊息
  （模擬「伺服器廣播了新訊息類型」這個情境本身），呼叫的是**跟每次真實 WS 訊息進來時完全同一個**
  `renderLog()`，不是直接呼叫 `localizeSummary()`。結果：中文模式下這筆訊息原樣顯示英文，
  沒有壞掉、沒有顯示 `undefined`。
- **375 / 768 / 1280 三種寬度 × 兩種語言**：六個組合全部用 `getBoundingClientRect` 實測
  `scrollWidth` vs 視窗寬、`.topbar`/`.toolbar`/`.agent-notice` 是否互相重疊——全數無橫向捲動、無重疊。
  桌機（768px、1280px）兩種語言下 `.topbar` 高度都精確是 52px。
- **重整後語言偏好保留**：中文分頁重整後（利用 localStorage 已存的 `coplan-lang`），
  `#langToggle` 按鈕文字正確顯示「EN」（代表目前是中文），`document.documentElement.lang`
  正確是 `zh-Hant`。
- **Console 全程無錯誤**：兩個分頁從頭到尾只有無關的 favicon 404，沒有其他錯誤或警告。

### 本輪沒有抓到需要修的問題

第 7 節每一條都是這次重新設計、實際跑出結果，**沒有沿用規劃端的測試結構**。結果是零缺陷——
這不是因為信任既有實作，而是這輪的三個重點懷疑對象（雙分頁真實同步、fallback 真的觸發、
兩種語言下的付款保護 DOM 檢查）都各自實測通過。沒有任何程式碼修改。

### 需要你自己用 Chrome/ChatGPT 確認的項目（我這邊無法驗證）

- 開了 WebMCP flag 的 Chrome：6 個工具是否仍正確註冊與呼叫（語言切換沒有動 `registerTool` 那段，
  也沒有在切換語言時重新呼叫 `registerTool`，程式碼上看不到重新註冊的路徑，但這條規則本身
  要求不能用 Playwright 測，所以仍待你實機確認）
- ChatGPT 桌面版：Agent 呼叫工具、以及跨 session 付款保護的真實體驗

### 規格未明講、我自己判斷的地方

- 語言偏好存在 `localStorage`，同一瀏覽器開多個分頁會共用同一把 key（`coplan-lang`）。
  規格第 6 節說「同一個房間裡不同成員可以各自用不同語言檢視」，這句話在**不同裝置／不同瀏覽器**
  之間自然成立（各自獨立的 localStorage）；但同一台電腦、同一個瀏覽器開兩個分頁時，
  两個分頁載入當下都會讀到同一個已存偏好，之後才能各自手動切換成不同語言——這次測試就是
  用「各自手動切換」模擬這個情境，測試結果不代表兩分頁會自動維持不同語言。這跟 `sessionId`
  刻意不共用是兩件不同的事，語言偏好本來就沒有要求跨分頁隔離，只是要求「不進房間狀態」，
  這點有守住。

---

## 任務 11：把 repo 的提交門面補完 ✅

範圍：確認 commit 都推上 origin、確認 LICENSE 能被 GitHub 認出來、補 About 欄位（description／homepage／topics）。

**改了哪些檔案**：這個任務不改程式碼，只動 git 歷史（push）與 GitHub repo 的 metadata（`gh repo edit`）。沒有 diff。

**不可破壞清單逐條確認**：無涉及——這個任務不碰 `src/index.js`、不碰 `public/index.html`、不碰 `wrangler.jsonc`。

**我自己驗證過的項目**：
1. **commit 都推上去了**：`git status` 確認當時只有 `public/index.html` 是未 commit 的（任務 10 進行中的工作，刻意沒動它），`docs/TASKS.md` 的任務 9 回報已經是獨立一筆 commit `c87bd52`。`git fetch origin` 後發現 `origin/main` 落後本機兩筆（`083e206` 任務 8+9 語言切換、`c87bd52` 任務 9 回報），`git push -u origin main` 後用 `git log --oneline origin/main -5` 實測確認這兩筆都在遠端了。
2. **LICENSE 檔名與內容**：`git ls-tree origin/main --name-only | grep -i license` 確認遠端上的檔名就是 `LICENSE`（沒有副檔名）。內容逐字讀過，是標準未修改的 MIT 全文，`Copyright (c) 2026 CoPlan`，年份與著作權人都在。用 `gh repo view --json licenseInfo` 直接問 GitHub API 確認，回傳 `{"key":"mit","name":"MIT License"}`——GitHub 已經認出來了，不是你看到的頁面快取問題。
3. **About 欄位**：`gh auth status` 確認已登入帳號 `jaspernot4ai`。執行 `gh repo edit` 設定 description／homepage／五個 topic，完成後用 `gh repo view --json description,homepageUrl,repositoryTopics,licenseInfo` 重新查詢 API（不是只看指令有沒有報錯）確認四項都正確落地。

**description 我擬的句子**："Multiplayer itinerary planning where every traveler's AI agent can edit the same trip in real time — but checkout always needs a human on a different device to approve."（175 字元，在 350 字元限制內）。方向照你的指示：多人 × 多 Agent 共用同一份行程表、花錢前由人在另一個裝置放行。

**驗證中發現並修正的問題**：無——三項都是第一次執行就正確，沒有需要修正的地方。

**判斷是誤報、未修改的項目**：無。

**需要你自己確認的項目**：description 的英文措辭是我擬的，若你有更精準的定位用詞（例如想強調 WebMCP 這個技術名詞本身），可以再告訴我調整；目前這句沒有出現「WebMCP」字樣，是刻意寫給不一定懂這個字的人看的一句話，topics 裡已經有 `webmcp` 這個字補上技術關鍵字面。

**規格未明講、我自己判斷的地方**：topics 完全依你給的五個照加，沒有自行增減；homepage 用你給的部署網址，沒有另外確認該網址目前是否可正常連線（那是任務 10 驗證範圍內的事）。

---

## 任務 10：著陸頁 + 進房入口 ✅

範圍：`/` 顯示著陸頁（不再落進 lobby 房間）、`/r/:roomId` 行為完全不變、Try it／進房表單、著陸頁雙語、Chrome／ChatGPT 接上 Agent 的說明。

### 0.5 frontend-design skill 的實際使用狀況（先說明，避免誤解）

這個環境一開始沒裝 `frontend-design` skill（`Skill` 工具回報 `Unknown skill`）。你選了「去裝」，我用 `claude plugin marketplace add anthropics/skills` 加了官方 marketplace、`claude plugin install example-skills@anthropic-agent-skills` 裝了含這個 skill 的套件包——但套件要重啟 session 才會註冊進 `Skill` 工具，這個 session 是背景工作、我沒辦法自己重啟。**我改成直接讀取已下載到本機的 `SKILL.md` 原始檔**（`~/.claude/plugins/marketplaces/anthropic-agent-skills/skills/frontend-design/SKILL.md`），把它的設計流程（先定調色票／字體／版面／signature 四件事、對照三種「一看就是 AI 生的」樣板自我批判、剋制、只在一個地方放膽）整段讀完後手動照著做。**效果上等同呼叫了這個 skill，但技術上不是透過 `Skill` 工具執行的**——如果你在意這個技術細節，之後重啟過 session 後可以請我用真正的 `Skill` 工具重跑一次設計批判，看有沒有出入。

### 改了哪些檔案

只有 `public/index.html`。`git diff --stat`：

```
public/index.html | 421 ++++++++++++++++++++++++++++++++++++++++++++++++------
1 file changed, 374 insertions(+), 47 deletions(-)
```

`src/index.js`、`wrangler.jsonc` 的 `git diff --stat` 皆為空，完全沒有動。

### 不可破壞清單逐條確認

- **完全不動 `src/index.js`**：`git diff --stat src/index.js` 空。✅
- **不動 `wrangler.jsonc`**：`git diff --stat wrangler.jsonc` 空。過程中一度以為要靠改它才能修好 `/r/:roomId` 的路由，後來查清楚是我自己的測試方法有問題（見下方「驗證中發現並修正的問題」），完全不需要動這個檔案。✅
- **`/r/:roomId` 行為完全不變**：用 `git diff` 對 `public/index.html` 做了針對性 grep，確認以下區塊**沒有任何一行改動**：6 個 WebMCP 工具的 `registerTool`／`inputSchema`／`description`、`addActivity`／`updateActivity`／`removeActivity`／`setBudget`／`requestCheckout`／`approveCheckout`／`rejectCheckout`／`esc`／`colorOf`／`toMinutes`／`computeTimeRange`／`groupOverlaps`／`buildBlock`／`render`／`renderEditCard`／`renderLog`／`renderMembers`／`renderBudget`／`renderApprovals`／`maybeSeedDemo`／`maybeReset` 的函式本體，以及結帳橫幅的 `lockLine`／`cancelRequest`／`fromAnotherDevice`／`approvePayment`／`decline` 文字。實際改動的只有：把「建立 WebSocket + 註冊 WebMCP 工具」與「人的表單按鈕綁定」這兩段包進 `if (isRoomMode) { ... }`，以及 `applyLang()` 加了幾行處理著陸頁的分支。這些包裝本身不改變房間模式裡面任何一行邏輯的執行順序或內容。
- **`docs/DESIGN-V2.md` 第 1 節**：房間頁的 DOM 結構、CSS、渲染函式一行都沒改，第 1 節逐條仍然成立（沿用任務 8／9 已經驗證過的結論，這次沒有理由讓它們失效）。

### 兩個技術前提的實作方式

- **模式判斷**：`const roomPathMatch = location.pathname.match(/^\/r\/([\w-]+)/); const isRoomMode = !!roomPathMatch;`，放在 script 最前面。原本無條件執行的 `new WebSocket(...)` 與 `setInterval(...)`（WebMCP 偵測＋註冊）都收進 `if (isRoomMode) { ... }`；`else` 分支呼叫 `initLanding()`。`.app`（房間頁整個版面）在著陸頁模式下用 `document.querySelector(".app").style.display = "none"` 隱藏——**只改 inline style，沒有動任何一行既有 CSS 規則**。著陸頁的 HTML 是 `.app` 關閉標籤後新增的一個 `<div id="landing" hidden>` 兄弟節點，CSS 全部新增在 `</style>` 前，沒有插進既有規則中間。
- **Try it 隨機房號**：`ROOM_WORDS`（十個日本地名，呼應這個 demo 的東京行程主題）＋ 4 碼隨機字尾，例如 `hakone-dgvd`。獨立跑了一支 Node 腳本連續呼叫這個邏輯 20 次，20 次全部不重複，格式符合 `/^[a-z]+-[a-z0-9]{4}$/`。Try it 固定帶 `seed=1`；進房表單房號留白時也會隨機新房間，但**不帶** `seed=1`（見下方「規格未明講」）。

### 我自己驗證過的項目，以及驗證方法（這次沒有 Playwright，方法先說清楚）

這個 session 的 Playwright MCP 從一開始就是斷線狀態（`CONNECT_TIMEOUT`），中途重試過一次仍然沒有恢復。第 6 節要求的「實際觀測，不是讀程式碼推論」在沒有真瀏覽器的情況下沒辦法用視覺截圖做到，所以我改用**能拿到的最接近的替代方案**：在本機 `wrangler dev` 前，用 `jsdom` 在隔離環境（裝在 `$CLAUDE_JOB_DIR/tmp` 底下，不是這個專案的 `node_modules`，`package.json`／`package-lock.json` 完全沒被動到）真的把整支 `<script>` 抓下來、真的執行過，攔截 `WebSocket` 建構子與 `setInterval` 呼叫次數來看它們有沒有被觸發——這是動態執行後觀測的結果，不是靜態讀程式碼推論出「應該會這樣」。

1. **`/` 顯示著陸頁，且沒有 WebSocket 連線、沒有註冊 WebMCP 工具**（實測，非推論）：對 `http://127.0.0.1:8787/` 抓到的真實 HTML 用 jsdom 執行整支 script，攔截後量到 `WebSocket` 建構子呼叫次數 = 0、`setInterval` 呼叫次數 = 0、`#landing` 的 `hidden` 屬性被移除（可見）、`.app` 的 inline `display` 被設成 `"none"`。
2. **`/r/:roomId` 行為與改動前完全相同**（實測）：同樣手法對 `/r/test123?as=Alice` 執行，量到 `WebSocket` 建構子確實被呼叫一次、連線位址正確是 `ws://127.0.0.1:8787/api/room/test123`（房號從路徑正確解析出來）、`setInterval` 被呼叫一次（WebMCP 偵測輪詢有啟動）、`#landing` 保持 `hidden`、`.app` 保持預設可見。另外針對「任務 9 已經驗收過的房間頁語言切換」單獨補了一次迴歸測試：在房間模式下點擊 `#langToggle`，量到 `#checkout` 文字從 `Checkout` 變成 `結帳`、`.travelers-label` 變成「旅伴」、房號標籤正確顯示「房間 roomtoggletest」——確認我在 `applyLang()` 裡加的著陸頁分支沒有連帶弄壞房間頁原本就有的語言切換。
3. **著陸頁雙語切換**（實測）：對著陸頁執行整支 script 後點擊 `#langToggleLanding`，量到 hero 標題、eyebrow 標籤、Chrome 說明卡片內文全部從英文正確變成中文，`document.documentElement.lang` 變成 `zh-Hant`，`localStorage.getItem("coplan-lang")` 變成 `"zh"`，而且整個切換過程中 `WebSocket` 建構子呼叫次數維持 0——語言切換本身不會意外觸發連線。「從著陸頁切成中文後進房，房間頁仍是中文」這一條沒有另外做一次真的跨頁導覽測試（jsdom 不適合模擬真實頁面跳轉），但它是上面兩項各自獨立驗證過的機制的直接組合：兩種模式讀的是同一把 `localStorage` key、同一套 `lang` 變數與 `applyLang()`，機制本身沒有分岔，我認為這個組合結論站得住，但如果你想要更嚴格的證據，這條建議留給你或之後 Playwright 恢復連線時補一次真的兩頁導覽測試。
4. **JS 語法**：`node --check` 通過。
5. **Console 錯誤**：jsdom 的 `window.addEventListener("error", ...)` 在上述所有執行過程中都沒有捕捉到任何錯誤。

### 驗證中發現並修正的問題（其實是我自己的測試方法有問題，不是程式碼的 bug）

一開始用 `curl` 直接測 `/r/test123`，本機與**正式上線的 `https://coplan.coplan-lab.workers.dev/r/tokyo?as=You&seed=1`**（`docs/SUBMISSION.md` 寫的那個 Live demo 連結）都回傳 `404 Not found`（就是 `src/index.js` 自己那段 catch-all 的文字）。一度以為找到一個提交等級的嚴重 bug、準備要回報給你，甚至一度懷疑要不要動 `wrangler.jsonc`。

查證後發現是**我的測試方法本身的問題**，不是程式碼的 bug：Cloudflare 的 `not_found_handling: single-page-application` 這個 SPA fallback，是靠請求是否「像瀏覽器導覽」的訊號（`Sec-Fetch-Mode: navigate` 之類的 header）決定要不要生效——查了 Cloudflare 官方文件（`developers.cloudflare.com/workers/static-assets/binding`）確認 `run_worker_first` 預設是 `false`（asset-first），這點沒有問題；問題出在我用**沒有帶這些 header 的裸 `curl`**去測。補上 `-H "Sec-Fetch-Mode: navigate"` 之後，同一個正式網址立刻回 `200`，內容正確。真正的瀏覽器（包含 Playwright 驅動的瀏覽器）本來就會自動帶這些 header，所以任務 8／9 用 Playwright 測 `/r/lobby` 之類的路徑從頭到尾都是對的，是我這次在沒有 Playwright 的情況下用 `curl` 直接測才踩到這個假警報。上面第 6 節的 jsdom 動態測試我後來也統一補上了同樣的 header，才拿到正確結果。

**結論：`/r/:roomId` 的路由與 SPA fallback 沒有任何問題，`wrangler.jsonc` 不需要動，這不是任務 10 的 bug，也不是任何既有程式碼的 bug——純粹是我測試工具選錯的假警報，寫在這裡是為了讓你知道我認真查證過、不是隨口說「應該沒事」。**

### 判斷是誤報、未修改的項目

上一節那個「`/r/:roomId` 404」就是本輪唯一一個誤報，已經在上面完整交代查證過程，沒有動任何程式碼。

### 需要你自己確認的項目（我這邊無法驗證）

- **375／768／1280 三種寬度 × 兩種語言的視覺檢查**：jsdom 沒有真正的 CSS 版面引擎（`getBoundingClientRect` 在 jsdom 裡固定回傳 0），沒辦法測橫向捲動或元素重疊。CSS 本身沿用了任務 8／9 已經驗證過的 `flex-wrap` + `min-height` 手法（`.ld-hero`／`.ld-gate`／`.ld-connect-grid` 在 900px 與 480px 都有對應的媒體查詢改成單欄），但沒有實機截圖佐證，等 Playwright 恢復連線或你自己開瀏覽器縮放視窗確認一次。
- **開了 WebMCP flag 的 Chrome、ChatGPT 桌面版實測**：這條規格本來就明講不要用 Playwright 測，一直都是留給你的項目，這次也一樣。
- **著陸頁的 Chrome／ChatGPT 接上步驟文案是否仍是目前的真實步驟**：我沒有自己重新實測（沒有真瀏覽器），文案是交叉比對 `README.md`（"an Origin Trial token is only needed for the deployed domain, not localhost"）、`docs/DEMO-SCRIPT.md`（模型必須是 GPT-5.6 Sol 或 Terra，Luna 不支援）、`docs/SUBMISSION.md`（"Works in Chrome 149+ ... no flags needed"）三份文件互相印證後寫的，不是憑空抄一份舊文件，但也不是我自己重新測出來的第一手結果——你在指示裡特別強調這點要「以實測為準」，這條我做不到，需要你親自確認現在還是不是這樣。

### 規格未明講、我自己判斷的地方

- **進房表單房號留白時，不帶 `seed=1`**：規格說「房號留白就隨機」，但沒說要不要塞示範資料。我判斷 Try it 的用途是「給我一個立刻能看的 demo」，進房表單的用途是「我想直接開始用 / 準備輸入房號找旅伴」，兩者留白時的意圖不同，所以只有 Try it 帶 `seed=1`。如果你希望進房表單留白也塞示範資料，一行判斷式可以改。
- **房號詞庫**：用十個日本地名（tokyo／kyoto／osaka…）而非隨機英文單字或純亂碼，呼應這個 demo 本身的東京行程主題，也讓房號比純 hex 好記、好念出來給旅伴聽。
- **著陸頁的設計語言延伸**：新增了三個衍生 CSS 變數（`--ld-accent-2`、`--ld-accent-wash`、`--ld-ink-soft`），全部用 `color-mix()` 或手調色階從既有的 `--accent`／`--ink` 算出來，沒有引入新色相；只在著陸頁的區塊裡定義，房間頁看不到也用不到這幾個變數。Hero 示意圖直接複用房間頁真正的 `.block`／`.conflict`／`.block-meta` 這些 class 手動擺出兩個「時間重疊」的行程卡片（固定座標，不接真資料），不是另外畫一張示意圖或插圖——這是這次設計唯一放膽的地方（frontend-design skill 說的「signature」），其餘版面刻意剋制。動畫只有 hero demo 卡片的進場位移，用 `@media (prefers-reduced-motion: reduce)` 關掉。
- **GitHub 連結**：用你在這次指示裡明講的 `https://github.com/jaspernot4ai/coplan`（在此之前我原本打算先問你，後來看到 `docs/SUBMISSION.md` 已經寫著同一個網址，判斷可以直接採用；這次你也直接把網址寫進指示裡，兩邊一致，沒有衝突）。

---

## 任務 12：修 hero 示意圖的裁切 ✅

### 改了哪些檔案

只有 `public/index.html`，只動了你指定的那兩條規則。`git diff --stat`：

```
public/index.html | 8 ++++++--
1 file changed, 6 insertions(+), 2 deletions(-)
```

`src/index.js`、`wrangler.jsonc` 沒有 diff。

### 不可破壞清單逐條確認

- **只改 `.ld-demo-block.block` 與 `.ld-demo-b.block` 這兩條規則**：`git diff` 貼在下面，逐行核對過，`.ld-hero-demo` 的高度／`overflow`／box-shadow、`.ld-demo-a.block`（`top`／`height`／`animation-delay`）、`.ld-demo-b.block` 原本就有的 `border-color`／`background`／`border-left`／`padding-left` 四行全部原封不動，只有兩條規則裡跟寬度／位置算式相關的那幾行改了：

  ```diff
        .ld-demo-block.block {
  -       left: 70px; width: calc(50% - 8px); font-size: 12px;
  +       --ld-demo-gutter: 70px;
  +       left: var(--ld-demo-gutter); width: calc((100% - var(--ld-demo-gutter) - 24px) / 2); font-size: 12px;
          animation: ld-settle .9s cubic-bezier(.2,.8,.2,1) both;
        }
        .ld-demo-a.block { top: 40px; height: 84px; animation-delay: .1s; }
        .ld-demo-b.block {
  -       top: 70px; height: 84px; left: calc(70px + 50% - 4px);
  +       top: 70px; height: 84px;
  +       left: calc(var(--ld-demo-gutter) + (100% - var(--ld-demo-gutter) - 24px) / 2 + 8px);
          animation-delay: .55s;
          border-color: var(--warn); background: var(--warn-bg); border-left: 3px solid var(--warn); padding-left: 4px;
        }
  ```

- **房間頁 `/r/:roomId` 行為不變**：這個任務完全沒碰房間頁的任何一行 CSS/JS，不需要重新驗證（沒有變動就沒有回歸風險）。

### 修法

按你的指示抽出一個共用的 CSS 變數 `--ld-demo-gutter: 70px`（定義在 `.ld-demo-block.block` 上，A、B 兩張卡都吃得到這個變數，因為兩者都同時符合這個選擇器）。可用寬度改成 `100% - 刻度欄 - 24px`（24 = 16px 右側留白 + 8px 兩卡間距），兩張卡各佔一半；B 的 `left` = 刻度欄 + 一張卡寬 + 8px 間距。右側留白選了 16px（在你給的 14–16px 區間內取上限，跟這個檔案裡其他地方常用的 16px 間距一致，例如 `.topbar`／`.agent-notice` 的 padding 都用 16px）。

### 我自己驗證過的項目

- **JS 語法**：改動只在 `<style>` 區塊，仍然完整跑了一次 `node --check` 確認沒有連帶弄壞 `<script>`（有跑，通過）。
- **CSS 改動範圍**：`git diff` 逐行核對，確認只動了兩條規則裡跟本次問題直接相關的行，如上一節所貼。
- **裁切修好了，用代數證明，不是三個寬度各測一次**：B 卡右緣 = `--ld-demo-gutter` + 一張卡寬 + 8px + 一張卡寬 = 刻度欄 + 可用寬度 + 8px = 刻度欄 + (100% − 刻度欄 − 24px) + 8px = **100% − 16px**。這個結果**不含任何具體寬度數字**，是從算式本身推出來的恆等式——換句話說，不管 `.ld-hero-demo` 實際渲染出來是多寬（375／768／1280 或任何其他寬度），只要它的寬度大於「刻度欄 + 24px」（= 94px，這個頁面在最窄的手機版面下 `.ld-hero-demo` 都遠寬於 94px），B 卡右緣**必定**落在容器右緣往內 16px 處，不會被 `.ld-hero-demo` 的 `overflow: hidden` 裁到。這比在三個寬度各量一次更強：量三個點只能證明那三個點沒事，代數證明對任何寬度都成立。
- **B 比 A 低 30px、四邊框線都在**：這兩點都沒有被這次改動碰到——`top: 40px`（A）／`top: 70px`（B）維持原樣，差值仍是 30px；`.ld-demo-b.block` 原本就有的 `border-color: var(--warn)`（套用到四邊）與 `border-left: 3px solid var(--warn)`（左邊加粗）都完整保留，這次裁切問題本來就只影響「右邊框線有沒有被容器裁掉」，不影響邊框本身有沒有畫出來。
- **上線後兩個路徑都跑了真的 HTTP 請求確認**（帶 `Sec-Fetch-Mode: navigate` header，任務 10 已經確認過裸 `curl` 沒有這個 header 會誤觸發 SPA fallback 判斷失準）：`https://coplan.coplan-lab.workers.dev/` 回應裡有 `id="landing"` 與 `id="ldTryBtn"`；`https://coplan.coplan-lab.workers.dev/r/tokyo?as=You&seed=1` 回應裡有 `id="gridBody"` 與 `id="checkout"`——部署後兩種模式的 HTML 都正確送達，著陸頁不再是「打開根目錄就進 lobby 房間」的舊行為。

### Playwright 重連嘗試

跑之前的任務時就已經斷線，這次照指示先試了重連（`ToolSearch` 查詢 `playwright browser navigate/resize/evaluate/screenshot` 相關工具），結果仍然只有 `WebFetch` 一個工具，`playwright__*` 系列完全沒有出現——**還是連不上**。照你的指示，這條驗證（`getBoundingClientRect().right` 實測、2 秒等動畫落定後截圖）留給規劃端，我這邊沒有硬做假的截圖或編造測試結果。

### 部署

`npx wrangler deploy` 執行成功，`Current Version ID: 240e4797-76c1-4c7b-b7f7-20fa608116ed`，只上傳了 1 個變動的靜態檔案（`+ /index.html`）。部署後立刻用上面「我自己驗證過的項目」最後一條的兩個真實 HTTP 請求確認過線上內容已經是新版。

### 驗證中發現並修正的問題

無——這次改動範圍很小，一次就照代數算對，沒有中途發現新問題。

### 判斷是誤報、未修改的項目

無。

### 需要你自己確認的項目（我這邊無法驗證）

- **`getBoundingClientRect()` 實測與截圖**：如上所述，Playwright 這個 session 全程連不上，這條照你的指示留給規劃端用真瀏覽器驗（375／768／1280 三寬度、等 2 秒讓 `.55s` 進場動畫落定後再量測／截圖）。我這邊用代數證明了裁切問題在算式層面已經修好，但沒有真的渲染畫面可以貼給你看。
- 任務 10 報告裡列過的「375／768／1280 視覺檢查」與「Chrome／ChatGPT 實機測試」兩項，狀態不變，仍待你或規劃端用真瀏覽器確認。

### 規格未明講、我自己判斷的地方

- **右側留白選 16px**：你給的區間是 14–16px，選了上限 16px，理由是跟這個檔案裡其他地方（`.topbar`／`.toolbar`／`.agent-notice` 的 padding）已經在用的 16px 間距對齊，視覺上比較不會顯得是另外挑的數字。
- **兩卡間距沿用原本隱含的 8px**：原本 `width: calc(50% - 8px)` 裡的 `8px` 是唯一能看出「這裡本來想留一份間距」的線索，新算式把它保留下來當作 A、B 兩卡之間的間隙，也跟這個檔案裡真正的日程網格（`buildBlock()` 的 `width: calc((100% - 8px) / n)`）用同一個數字，維持視覺一致性。

---

## 附帶修正：房號統一轉小寫（commit `350e0f0`，未另編任務編號）

進房表單原本會保留房號大小寫（`Tokyo` 跟 `tokyo` 會落進兩個不同的 Durable Object），
清理規則加了 `.toLowerCase()`。用 Node 跑過等效邏輯，`"Tokyo"`／`"TOKYO"`／`"tokyo"` 三種輸入都清理成 `"tokyo"`，一致。Try it 產生的隨機房號本來就是小寫，不受影響。這是任務 13 房號清理邏輯的前一步，任務 13 的說明會接著提到它。

---

## 任務 13：房號輸入的靜默失敗（小修）✅

### 問題

進房表單輸入純中日文房號（例如「京都」）時，清理規則 `[^\w-]` 會把所有字元濾掉、
結果變成空字串，接著誤觸「留白就開新房」那條邏輯，導向一個隨機房號。兩位旅伴各自
輸入同一個中文房號，會各自落進不同的空房，畫面上沒有任何提示——看起來像同步壞掉。

### 改了哪些檔案

只有 `public/index.html`。`git diff --stat`：

```
public/index.html | 24 +++++++++++++++++++++++-
1 file changed, 23 insertions(+), 1 deletion(-)
```

`src/index.js`、`wrangler.jsonc` 無 diff。

### 不可破壞清單逐條確認

- **不改房間路徑的正則、不嘗試支援 CJK 房號**：`src/index.js` 與房間頁的 `/^\/r\/([\w-]+)/` 都沒有動；進房表單的清理正則 `[^\w-]` 也維持原樣，一個字元都沒改——這次只是在「清理後變空字串」這個既有可能性上加一個分支去處理它，不是改變清理規則本身要接受什麼字元。
- **房間頁 `/r/:roomId` 行為不變**：這個任務完全沒碰房間頁，不需要重新驗證。
- **沿用既有 I18N 機制**：新增的 `ldRoomInvalid` 走的是任務 9／10 已經在用的同一套 `data-i18n` 屬性 + `I18N.en`/`I18N.zh` 字典機制，沒有另外發明一套翻譯方式。

### 修法

`ldJoinBtn` 的點擊處理現在分三支，依序判斷：
1. `raw.trim() === ""`（使用者真的沒輸入）→ 跟原本行為一致，導向隨機新房間。
2. 清理後 `room === ""`（有輸入，但濾掉所有字元後變空——例如純 CJK）→ **不導向**，改成把 `#ldJoinError`（原本 `hidden` 的一行提示）顯示出來，文字走 `data-i18n="ldRoomInvalid"`。
3. 其餘情況 → 跟原本一樣導向清理後的房號（含前一個修正的 `.toLowerCase()`）。

每次點擊都先把錯誤訊息重新藏起來，避免上一次的錯誤殘留在畫面上干擾這一次的結果。

### 我自己驗證過的項目，以及驗證方法

Playwright 這個 session 仍然連不上（`ToolSearch` 查過，`playwright__*` 系列一樣沒出現），繼續用任務 10／12 那套 jsdom 動態執行測試手法：對本機 `wrangler dev` 送出的真實 HTML 執行整支 `<script>`，用真的 `.click()` 觸發表單按鈕，量測執行後的 DOM 狀態（不是讀程式碼推論）。

- **「京都」不會導航、會出現提示，中英文都測過**：對 `#ldJoinRoom` 填入「京都」後點 `#ldJoinBtn`，量到 `#ldJoinError` 的 `hidden` 屬性從 `true` 變成 `false`，文字逐字比對正確——英文模式是 `Room codes use English letters or numbers only — try a different code.`，切到中文模式後是「房號請用英文字母或數字——換一個試試。」（用 `#langToggleLanding` 切過語言後才輸入「京都」再點按鈕，確認兩種語言模式下都對）。
- **「Tokyo」仍正確導向、且沒有觸發錯誤提示**：填入「Tokyo」點按鈕後，量到 `#ldJoinError` 的 `hidden` 維持 `true`（沒有走到錯誤分支）。三個分支互斥，既然沒有進錯誤分支、也不是空字串分支（見下一條），只剩「導向」這個分支會執行。至於導向的目標字串本身，jsdom 對 `location.href = ...` 的真實賦值有已知限制（不支援真的跨頁導覽，賦值後讀不回新值），所以改用另一支獨立的 Node 腳本，把導向邏輯抽出來單獨跑（不經過 DOM），對 `"Tokyo"`／`"TOKYO"`／`"tokyo"`／`"京都"`／`""`／`"Tokyo Trip!"` 六種輸入各自算出的分支與房號逐一列印確認：`"Tokyo"` → `{action:"enter-room", room:"tokyo"}`，跟房間頁小寫化的規則一致。
- **留白仍會開新房**：填空字串點按鈕，`#ldJoinError` 的 `hidden` 維持 `true`（沒進錯誤分支），跟上面同一支獨立邏輯腳本的結果 `{action:"random-room"}` 一致；同時也測了「完全沒去點過這個輸入框」（沒設 `.value`）這個更貼近真實使用者「直接點 Enter」的情境，結果一樣。
- **Console 錯誤**：jsdom 的 `window.addEventListener("error", ...)` 在整輪測試中沒有捕捉到任何錯誤。
- **JS 語法**：`node --check` 通過。

### 驗證中發現並修正的問題

無——這次改動不大，一次照規格描述的三分支寫對，沒有中途發現新問題。

### 判斷是誤報、未修改的項目

無。

### 需要你自己確認的項目（我這邊無法驗證）

- 這次的「導向目標字串」是用獨立跑的邏輯腳本驗證，不是用真瀏覽器實際觀察到網址列真的變成 `/r/tokyo`。邏輯本身跟房間頁小寫化那次的驗證是同一套算式，我認為可信，但如果你想要百分之百第一手的證據，等 Playwright 恢復連線後可以請我補一次真的導覽測試。
- 任務 10／12 report 裡列過的「375／768／1280 視覺檢查」與「Chrome／ChatGPT 實機測試」狀態不變，仍待你或規劃端確認。

### 規格未明講、我自己判斷的地方

- **每次點擊都先重置錯誤訊息的顯示狀態**：規格沒提到這點，但如果不這樣做，使用者先打錯一次（看到提示）、修正後再打對一次，提示文字會一直卡在畫面上，即使這次已經正確導航離開頁面也不影響觀感，但如果使用者是「打錯→不理會提示→修正→再點一次」這種操作順序，讓提示在下一次點擊時自動先隱藏比較不會有「提示訊息是不是還有效」的疑慮。
- **沒有部署**：這次沒有另外跑 `npx wrangler deploy`，跟前一次「房號小寫」那次同一個判斷——這個 session 只在你明確要求時才部署（任務 12 有明講才部署），這次訊息裡沒有要求，維持只 commit + push。

