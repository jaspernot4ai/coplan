# CoPlan 版面重新設計規格 v2

> 這份規格取代 `docs/DESIGN.md`（舊版保留供對照，不要再依它實作）。
> 目標是**版面本身就在說明作品的主張**，而不只是把功能排整齊。
> 所有設計決策已在此訂死，實作者不需要自行判斷。

---

## 0. 這次改版要達成什麼

現在的三欄版面把功能排整齊了，但它只是「排整齊」。改版要做到三件事：

1. **一眼看出這是多人的。** 旅伴不該藏在側欄下方，應該在最上面、以人為單位呈現。
2. **衝突要「看得到」，不是「被告知」。** 目前靠一行琥珀色文字說「Overlaps with 1 other item」。
   改成**按時間比例定位的日程網格**後，兩個重疊的行程會在畫面上真的疊在一起、並排擠在同一格時間裡——
   觀眾不需要讀文字就懂。這是這次改版最重要的一項，也是 demo 影片裡最有說服力的畫面。
3. **待確認付款要無法忽視。** 全寬橫幅，位置在行程表正上方。

**視覺定位：專業協作工具**（Linear / Notion 那一類）。克制的中性灰、細邊框、清楚的層次、
中等資訊密度。不要漸層、不要陰影堆疊、不要大圓角、不要動畫特效。
它要看起來像一個團隊真的在用的東西，而不是 hackathon 玩具。

---

## 1. 不可破壞的東西（Invariants）

版面與 id 可以重構，但**下列行為與契約必須完全保留**。每一步做完都要對照這份清單自我驗證。

**功能行為**
- 多人即時同步（WebSocket 廣播後全員重繪）
- 新增／修改時間／修改價格／刪除行程
- 確定性衝突偵測與標記
- 預算上限設定、待訂金額計算、超支警示
- 結帳請求 → **發起的 session 不渲染確認按鈕**，只顯示 🔒 說明與 Cancel
- 其他 session 顯示 Approve payment / Decline
- Agent 活動時間軸（🙋 人／🤖 Agent 區分、成員顏色）
- `?seed=1` 示範資料、`?reset=1` 重置
- 成員清單與 `colorOf()` 的確定性顏色

**程式契約**
- **所有 WebMCP 工具的 `name`、`description`、`inputSchema` 一字不改**
- 動作層函式的名稱與簽章不變：`addActivity` / `updateActivity` / `removeActivity` /
  `setBudget` / `requestCheckout` / `approveCheckout` / `rejectCheckout` / `mySpent` / `me`
- `esc()` 必須繼續套用在**所有**插進 `innerHTML` 的動態值（名字、標題、summary、URL）
- `sessionId` 每次載入重新產生、不存 localStorage
- 前端不自行更新畫面，一律等伺服器廣播回來才重繪
- **完全不要改 `src/index.js`**

**允許的改動**
- 重寫 `<body>` 結構、重新命名 id、重寫 `<style>`、重寫各 render 函式產生的 DOM
- 前提是 JS 內所有 `getElementById` 參照同步更新，且行為不變

---

## 2. 設計代幣

```css
:root {
  /* 中性 */
  --bg:        #f7f7f5;   /* 頁面底 */
  --panel:     #ffffff;   /* 面板 */
  --panel-2:   #fbfbfa;   /* 次級面板（工具列、網格底） */
  --ink:       #1f2328;   /* 主文字 */
  --ink-2:     #4b5563;   /* 次文字 */
  --muted:     #8b8f96;   /* 標籤、時間戳 */
  --line:      #e6e6e3;   /* 邊框 */
  --line-2:    #f0f0ee;   /* 更淡的分隔線（網格時間線） */

  /* 語意 */
  --accent:    #5b5bd6;   /* 主色：主要按鈕、Agent 標記、連結 */
  --accent-bg: #eeeefc;
  --warn:      #b45309;   /* 衝突 */
  --warn-bg:   #fef3c7;
  --danger:    #dc2626;   /* 超支、否決 */
  --danger-bg: #fef2f2;
  --ok:        #15803d;   /* 已付款、已連線 */
  --ok-bg:     #ecfdf3;

  /* 尺寸 */
  --r-card: 8px;
  --r-ctrl: 6px;
  --r-pill: 999px;
  --hour-height: 56px;    /* 日程網格：一小時的像素高度 */
  --gutter-width: 52px;   /* 時間刻度欄寬 */
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg:        #0e0f11;
    --panel:     #17181b;
    --panel-2:   #131417;
    --ink:       #e8e8ea;
    --ink-2:     #b6b9bf;
    --muted:     #797d85;
    --line:      #26272b;
    --line-2:    #1e1f23;
    --accent:    #7b7bf0;
    --accent-bg: #1e1e3a;
    --warn:      #d97706;
    --warn-bg:   #3a2c0a;
    --danger:    #f87171;
    --danger-bg: #3a1414;
    --ok:        #4ade80;
    --ok-bg:     #0f2a1a;
  }
}
```

**規則：任何顏色都必須來自代幣，不得在元件裡寫死色碼。**
唯一例外是 `colorOf()` 的 PALETTE（成員身分色），維持原樣。

### 字型與尺寸

```css
font-family: system-ui, -apple-system, "Segoe UI", "Noto Sans TC",
             "Microsoft JhengHei", sans-serif;
```

| 用途 | 尺寸 | 樣式 |
|---|---|---|
| 品牌名 CoPlan | 17px | 600, letter-spacing -0.01em |
| 區塊標題（TRAVELERS / ACTIVITY 等） | 11px | 600, uppercase, letter-spacing .07em, `--muted` |
| 內文 | 14px | line-height 1.5 |
| 卡片標題 | 13.5px | 550 |
| 次要資訊（類型、時間戳、成員） | 12px | `--muted` |
| 時間刻度 | 11px | `--muted`, tabular-nums |

所有時間與金額加 `font-variant-numeric: tabular-nums`。

### 間距

只用 4 / 8 / 12 / 16 / 24 這五個值，不要出現 5px、7px、13px 這種數字。

---

## 3. 版面

```
┌──────────────────────────────────────────────────────────────────────┐
│ ① 標題列  CoPlan · Room demo            ● Connected ● WebMCP  [Invite]│
├──────────────────────────────────────────────────────────────────────┤
│ ② 工具列  TRAVELERS ●Cindy ●Bob ●Alice   │  Budget NT$7,000/10,000 [Checkout] │
├────────────────────────────────────────────────┬─────────────────────┤
│ ③ 待確認結帳橫幅（有請求時才出現，全寬）        │                     │
│                                                 │  ⑥ 右欄 340px      │
│ ④ 新增行程工具列（單列）                        │                     │
│                                                 │  Selected activity  │
│ ⑤ 日程網格                                      │  （選取時才出現）   │
│   ┌────┬──────────┬──────────┬──────────┐       │                     │
│   │08  │  Day 1   │  Day 2   │  Day 3   │       │  ACTIVITY           │
│   │09  │ ┌──────┐ │          │          │       │  時間軸（最新在上） │
│   │10  │ │Senso │ │          │          │       │                     │
│   │11  │ ├──┬───┤ │          │          │       │                     │
│   │12  │ │A │ B │ │  ← 重疊的兩筆並排    │       │                     │
│   └────┴──────────┴──────────┴──────────┘       │                     │
└────────────────────────────────────────────────┴─────────────────────┘
```

- 外層：`display:grid; grid-template-columns: 1fr 340px; gap:12px; padding:12px;`
- 高度 `100vh`，左右兩欄各自 `overflow-y:auto`（不要整頁捲動）
- 標題列與工具列橫跨全寬，置於 grid 之上

### ① 標題列

- 左：**CoPlan**（17px/600）＋ `Room` 標籤與房號（12px `--muted`，房號用等寬字體）
- 右：兩個狀態點 ＋ `Copy invite link` 次要按鈕
- 狀態點改成**小圓點 + 文字**（不要膠囊外框）：`● Connected` / `● WebMCP ready`，
  正常為 `--ok`，異常為 `--danger`。12px。
- 高度 52px，底部 1px `--line`

### ② 工具列

- 左：`TRAVELERS` 標籤 + 成員 chips。每個 chip 是**圓點 + 名字**，
  圓點用 `colorOf(name)`，chip 有 1px `--line` 邊框、`--r-pill`、padding 3px 10px、12px 字。
  **這一列往上移到最顯眼的位置，是「這是多人的」的第一印象。**
- 右：預算摘要 + Checkout 主要按鈕
  - 預算摘要格式：`Pending NT$7,000 / NT$10,000`，超支時金額用 `--danger` 並補 `⚠️ Over budget`
  - 預算上限的輸入框改成**點擊摘要才展開的小輸入**（inline edit）：
    點 `NT$10,000` 變成 input，失焦或 Enter 送出。
    尚未設定時顯示 `Set budget` 連結樣式的按鈕。
    → 保留原本「使用者正在編輯時不回填」的防護。
- 高度 48px，底部 1px `--line`
- 資料外流告知那句話移到這裡的最右側，或工具列下方一條 11px `--muted` 的細線文字。
  文字內容不變。

### ③ 待確認結帳橫幅

- 全寬（跨左欄），位於左欄最上方，行程表之上
- 一般：1px `--accent` 邊框 + `--accent-bg` 底
- 超支：1px `--danger` 邊框 + `--danger-bg` 底
- 版面：第一行是「誰 requested checkout of NT$X (n items)」＋超支標記；
  第二行是說明文字；第三行是按鈕
- **文案一字不改**，特別是這兩句：
  - `🔒 For your protection, the device that requested this payment cannot approve it.`
  - `Open this room on your phone or another device, or ask a fellow traveler to approve.`
- 發起端：只有 `Cancel this request`（次要按鈕）
- 其他 session：`Approve payment`（主要按鈕）+ `Decline`（次要按鈕）
- 網址那行用等寬字體、可選取、`--panel-2` 底、`--r-ctrl`

### ④ 新增行程工具列

單列橫向排列，元素之間 8px：
`[類型 select] [Day select] [開始 time] [結束 time] [標題 input，flex:1] [Add 主要按鈕]`

- 整列放在一個 `--panel-2` 底、1px `--line`、`--r-card` 的容器裡，padding 8px
- 標題輸入框佔滿剩餘寬度
- 不要 `<fieldset>` 與 `<legend>`，改用一般 div

### ⑤ 日程網格（本次改版的核心）

**結構**

```
<div class="grid">            position: relative
  <div class="gutter">        寬 var(--gutter-width)，每小時一格刻度
  <div class="day">           三欄，等寬，min-width 200px
     <div class="block">      absolute 定位的行程方塊
```

**時間範圍**：動態計算
- 起點 = 所有行程中最早的 `start`，往下取整到整點，但**不早於 08:00**
- 終點 = 所有行程中最晚的 `end`，往上取整到整點，但**不晚於 23:00**
- 若沒有任何行程，固定顯示 09:00–18:00
- 起點與終點至少相差 6 小時（避免只有一筆行程時網格太扁）

**定位**

```
top    = (toMinutes(start) - rangeStartMin) / 60 * var(--hour-height)
height = max((toMinutes(end) - toMinutes(start)) / 60 * var(--hour-height), 36px)
```

**時間刻度**：gutter 每小時一個標籤（`09:00`），右對齊，11px `--muted`。
每個整點在日欄畫一條 1px `--line-2` 的水平線（用 `repeating-linear-gradient` 或絕對定位的 div 皆可）。

**重疊的視覺處理（最重要）**

同一天內，把時間有重疊的行程分成「群組」（傳遞性：A 與 B 重疊、B 與 C 重疊 → 三者同群）。
群組內按開始時間排序，第 i 個方塊：

```
width = calc((100% - 8px) / n)
left  = i * (100% / n)
```

n 為群組大小。**重疊的行程因此會並排擠在同一段時間裡，一眼就看得出來。**
這比任何文字警告都直接。

**方塊內容**（由上到下，緊湊）
- 第一行：標題（單行截斷，`text-overflow: ellipsis`）
- 第二行：`09:00–11:00` 時間（11px `--muted`）＋ 成員圓點與名字（11px，用 `colorOf`）
  ＋ 🤖/🙋 標記
- 右下角：價格 chip（若有 price），`NT$1,200`，11px，`--panel-2` 底
- 若 `paid`：右上角 `✅` 並整體降低不透明度到 0.75
- 衝突：1px `--warn` 邊框 + `--warn-bg` 底 + 左側 3px `--warn` 色條
- 一般：1px `--line` 邊框 + `--panel` 底
- 被選取：2px `--accent` 邊框
- `cursor: pointer`，hover 時 `filter: brightness(0.98)`

**方塊高度不足時**（< 48px）：只顯示標題一行，其餘資訊靠 `title` 屬性提供 tooltip。

**空狀態**：整個網格沒有任何行程時，網格區域中央顯示
`No plans yet. Add one above, or ask your agent to help plan.`（文案不變），
時間刻度仍然顯示（讓畫面有結構感，不是一片空白）。

### ⑥ 右欄

**選取的行程編輯卡**（點擊方塊後出現在右欄最上方，未選取時不顯示）

- 標題：`SELECTED ACTIVITY`
- 內容：標題（唯讀顯示）、開始/結束時間 input、價格 input、`Remove` 危險樣式次要按鈕、
  右上角 `×` 取消選取
- **這是取代原本卡片內嵌輸入框的做法**：方塊上不再放 input，
  網格才乾淨；編輯集中在右欄，也不會有定位問題
- 修改任一欄位即呼叫既有的 `updateActivity(id, patch, false)`
- 若該行程在廣播後被別人刪掉，自動取消選取

**活動時間軸**

- 標題：`ACTIVITY`
- 每筆一列，12px，底部 1px `--line-2`
- 版面：`[時間戳] [🤖/🙋 名字] [action 代號] ` 第一行；`summary` 第二行 `--ink-2`
- 名字用 `colorOf` 上色；action 代號用等寬 11px、`--panel-2` 底、`--r-ctrl`、padding 1px 5px
- 衝突相關（`action` 含 `conflict`）或被擋下的（`approve_blocked`）整列文字用 `--warn`
- 空狀態：`No activity yet.`

### 按鈕

```css
.btn { padding: 7px 12px; border-radius: var(--r-ctrl); font: inherit; font-size: 13px;
       cursor: pointer; border: 1px solid transparent; }
.btn-primary   { background: var(--accent); color: #fff; }
.btn-secondary { background: var(--panel); color: var(--ink); border-color: var(--line); }
.btn-danger    { background: var(--panel); color: var(--danger); border-color: var(--line); }
.btn:hover     { filter: brightness(0.97); }
.btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
```

### 表單元素

```css
input, select { padding: 6px 9px; border: 1px solid var(--line); border-radius: var(--r-ctrl);
                background: var(--panel); color: var(--ink); font: inherit; font-size: 13px; }
input:focus, select:focus { outline: none; border-color: var(--accent); }
```

---

## 4. 響應式

`@media (max-width: 1000px)`：

- 外層改單欄 `grid-template-columns: 1fr`，高度 auto，改為整頁捲動
- 三個日欄改成**垂直堆疊**（每天一個區塊，各自帶時間刻度），仍保留比例定位與重疊並排
- 右欄移到最下方
- 工具列的成員 chips 可換行
- 375px 寬不得出現橫向捲動

---

## 5. 無障礙

- 每個沒有可見標籤的 input 要有 `aria-label`
- 行程方塊用 `<button>` 或加 `role="button"` + `tabindex="0"`，可用鍵盤選取
- 刪除鈕 `aria-label="Remove this activity"`
- 顏色不可為唯一資訊來源：衝突除變色外保留 ⚠️、已付款保留 ✅
- 焦點樣式必須可見（見上方 `:focus-visible`）

---

## 6. 實作順序（一步一驗，不要一次全改）

每一步做完都要用第 1 節的 Invariants 清單自我驗證，並確認 Console 無錯誤。

1. **代幣與基礎樣式**：寫入新的 `<style>`（變數、body、按鈕、表單、深色模式）。
   此時版面仍是舊的，只有顏色與控制項外觀改變。**確認功能全部正常再往下。**
2. **標題列與工具列**：把成員、狀態、預算、Checkout 搬上去，左欄清空。
   預算改為 inline edit。**確認預算設定與 Checkout 仍正常。**
3. **新增行程工具列**：改成單列。
4. **日程網格**：這是最大的一步。先做「時間刻度 + 比例定位」，
   確認方塊位置正確；再做「重疊分組並排」。
   **這一步之後要特別驗證衝突偵測的視覺結果與資料一致**
   （方塊並排的組合，必須與 `conflictWith` 標記的一致）。
5. **右欄選取編輯卡**：把方塊內嵌的 input 移出來。
   **確認改時間、改價格、刪除都仍可用，且人的操作在時間軸標 🙋。**
6. **待確認結帳橫幅**：改為全寬、新樣式。**文案一字不改。**
7. **活動時間軸**樣式。
8. **響應式與無障礙**收尾。

## 7. 若第 4 步做不出來的退路

比例定位的日程網格是本次改版的核心，但若做到一半發現風險過高（例如重疊分組算不準、
或方塊在極端資料下錯位），**允許退回「每日垂直列表」的呈現**，但仍需採用新的
視覺語言（代幣、卡片樣式、左側 3px 衝突色條、價格 chip、右欄編輯卡）。

**退路的判斷點：如果第 4 步花超過兩小時仍不穩定，就退回列表版。**
其餘所有步驟照常完成。功能正確永遠優先於視覺野心——這個作品的價值在主張，不在畫面炫技。

## 8. 不要做的

- 不要引入任何 CSS 框架、UI 套件、字型 CDN、圖示套件（需要圖示就用 emoji 或內嵌 SVG）
- 不要加拖曳調整時間的功能（超出範圍，且會動到既有的更新路徑）
- 不要加動畫、過場、載入骨架
- 不要改任何 WebMCP 工具定義
- 不要改 `src/index.js`
- 不要為了版面而改變資料結構
