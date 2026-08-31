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

## 任務 3.5：修 SEC-001 儲存型 XSS（**最優先，先於英文化**）

完整分析見 `docs/REVIEW-2026-08-28.md`。摘要：

使用者可控的字串（`?as=` 的名字、行程標題、稽核 summary）被直接插進 `innerHTML`，
沒有轉義。攻擊者傳一個 `?as=<img src=x onerror=...>` 的連結給旅伴，
該字串會存進伺服器並在**所有成員**的瀏覽器執行（儲存型 XSS）。
注入的腳本可以直接呼叫 `approveCheckout()`，讓整個付款閘門失效。

**做法**：加 `esc()` 轉義函式，把所有 `innerHTML` 樣板裡的動態值包起來。
詳細位置清單與驗收方式見審查報告。

順便處理報告中的 MAINT-001（刪除兩個 `.bak` 檔）與 MAINT-002（`?as=` 限長 20 字）。

### 回報


---

## 任務 3.6：WebMCP 安全加固（與任務 3.5 一起做）

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


---

## 任務 4：介面英文化（最高優先）

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


---

## 任務 5：示範資料與重置

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


---

## 任務 6：README 與授權（提交必要條件）

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

