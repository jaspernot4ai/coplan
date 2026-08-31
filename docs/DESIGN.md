# CoPlan 視覺規格

> 這份文件把設計決策訂死，實作者不需要自行判斷。照著做即可。
> 全部手寫 CSS，放在 `public/index.html` 的 `<style>` 區塊。**不要引入任何框架或字型 CDN。**

## 設計主張（為什麼長這樣）

這個作品要在三秒內讓人看懂一件事：**人和 Agent 在同一個畫面上協作同一份行程。**

因此版面刻意做成三欄，讓「誰在場」「大家在編什麼」「Agent 剛剛做了什麼」同時可見。
右欄的活動時間軸不是附屬功能，它是作品的主張本身——不要把它折疊或縮小。

視覺基調：乾淨、資訊密度中等、像個真的協作工具而不是玩具。
不要漸層、不要陰影堆疊、不要圓角過大、不要動畫特效。克制勝過華麗。

## 色彩

用 CSS 變數定義，深色模式只覆寫變數值。

```css
:root {
  --bg: #f6f7f9;          /* 頁面底色 */
  --panel: #ffffff;        /* 面板／卡片底色 */
  --ink: #14181f;          /* 主要文字 */
  --muted: #6b7280;        /* 次要文字 */
  --line: #e5e7eb;         /* 邊框與分隔線 */
  --accent: #2563eb;       /* 主色：按鈕、連結、Agent 標記 */
  --warn: #b45309;         /* 衝突：文字 */
  --warn-bg: #fef3c7;      /* 衝突：底色 */
  --danger: #dc2626;       /* 超出預算 */
  --danger-bg: #fef2f2;
  --ok: #16a34a;           /* 已付款、已連線 */
  --radius: 10px;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #0f1216;
    --panel: #171b21;
    --ink: #e8eaed;
    --muted: #9aa3ae;
    --line: #262c34;
    --warn-bg: #3a2c0a;
    --danger-bg: #3a1414;
  }
}
```

**規則：任何顏色都必須來自變數，不要在元件裡寫死色碼。**
既有 JS 裡寫死的色碼（例如卡片的 `#e07b00`、`#fff4e0`）改成 `var(--warn)` / `var(--warn-bg)`。
成員顏色的 PALETTE 例外，那是身分識別用的，維持原樣。

## 字型與尺寸

```css
font-family: system-ui, -apple-system, "Noto Sans TC", "Microsoft JhengHei", sans-serif;
```

- 內文 15px / 行高 1.5
- 卡片標題 15px 粗體
- 次要資訊（類型、成員、時間戳）13px，用 `--muted`
- 區塊標題（成員／預算／行程／時間軸）13px、大寫字距 0.06em、`--muted` 色
- 時間與金額數字加 `font-variant-numeric: tabular-nums`，避免跳動

## 版面

```
┌──────────────────────────────────────────────────────────┐
│ 標題列：CoPlan ｜ 房間 <房號> ｜ [複製邀請連結]           │
├────────────┬──────────────────────────┬──────────────────┤
│ 左欄 260px │ 中欄 彈性                │ 右欄 340px       │
│            │                          │                  │
│ 連線狀態   │ 新增行程表單             │ Agent 活動時間軸 │
│ WebMCP狀態 │ 待確認結帳請求（若有）   │ （最新在上）     │
│ 行程成員   │ Day 1 / Day 2 / Day 3    │                  │
│ 我的預算   │ 行程卡片                 │                  │
│ 結帳按鈕   │                          │                  │
└────────────┴──────────────────────────┴──────────────────┘
```

- 用 CSS Grid：`grid-template-columns: 260px 1fr 340px; gap: 12px; padding: 12px;`
- 桌面時整體高度 `100vh`，三欄各自 `overflow-y: auto`（各自捲動，不要整頁捲）
- `@media (max-width: 1100px)` 改為單欄 `grid-template-columns: 1fr`，高度改 auto，順序：中欄內容 → 左欄 → 右欄
- 375px 寬不得出現橫向捲動

## 元件規格

### 面板（三欄的容器）
`background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius); padding: 16px;`

### 狀態標示（已連線 / WebMCP 已就緒）
小圓角膠囊，`font-size: 12px; padding: 3px 9px; border-radius: 999px;`
正常用 `--ok` 文字＋同色邊框，異常用 `--danger`。**保留現有的偵測邏輯與文字內容，只換樣式。**

### 行程卡片
- 一般：`border: 1px solid var(--line); background: var(--panel);`
- 衝突：`border-color: var(--warn); background: var(--warn-bg);` 並顯示既有的警告列（`--warn` 色，13px）
- 已付款：右側加綠色「✅ 已付款」標記
- 版面：第一行是時間輸入框（兩個 `type=time`）、標題；第二行是類型、提出者（用 colorOf 的顏色）、🤖/🙋 標記、價格輸入框；刪除鈕 `×` 靠右，`--muted` 色、hover 時變 `--danger`
- 時間與價格輸入框在卡片內要小巧，不要撐滿寬度

### 待確認結帳請求（最重要的元件，要最顯眼）
- 一般：2px `--accent` 邊框、`--accent` 的淡底
- 超支：2px `--danger` 邊框、`--danger-bg` 底色
- 內容保留現有文案，特別是那句「Agent 無法自行完成付款，需要你按下確認。」——**這句是作品主張，不要改寫或刪除**
- 「確認付款」是主要按鈕（實心 `--accent` 底、白字），「否決」是次要按鈕（外框樣式）

### 活動時間軸
- 每筆一列，底部 1px `--line` 分隔
- 左邊時間戳 `--muted`、tabular-nums
- 人／Agent 用 🙋/🤖 加上該成員的 colorOf 顏色
- action 代號用等寬字體、淺灰底小標籤
- summary 佔滿整行、`--muted` 色
- 衝突相關的紀錄整列用 `--warn` 色

### 按鈕
- 主要：`background: var(--accent); color: #fff; border: none;`
- 次要：`background: var(--bg); color: var(--ink); border: 1px solid var(--line);`
- 共通：`padding: 8px 12px; border-radius: 8px; cursor: pointer; font: inherit;`
- hover：`filter: brightness(0.97)`
- 不要做 transition 以外的動畫

### 表單元素
`padding: 8px 10px; border: 1px solid var(--line); border-radius: 8px; background: var(--bg); color: var(--ink); font: inherit;`
select 與 input 外觀一致。

### 標題列
- 左邊：CoPlan（20px、字距 -0.02em）＋ 房號（`--muted`、等寬）
- 右邊：「複製邀請連結」次要按鈕，點擊複製 `location.href` 到剪貼簿，按鈕文字暫時變「已複製」兩秒後還原

## 空狀態

- 某一天沒有行程：虛線框、置中、`--muted`，文字「還沒有安排」
- 完全沒有行程：中欄顯示「還沒有安排。用上面的表單新增，或直接叫你的 Agent 幫忙規劃。」
- 時間軸沒有紀錄：「還沒有任何活動」
- 沒有待確認請求：不顯示任何東西（不要放空容器的佔位文字）

## 無障礙

- 所有 input 要有 `aria-label`（表單沒有可見標籤時）
- 刪除鈕要有 `aria-label="移除這個行程"`
- 顏色不可以是唯一的資訊來源：衝突除了變色還有 ⚠️ 文字、已付款除了綠色還有 ✅ 文字（現況已符合，保持）

## 絕對不要動的東西

- 任何 WebMCP 工具的 `name`、`description`、`inputSchema`
- `src/index.js` 的任何內容
- 動作層函式（addActivity / updateActivity / removeActivity / setBudget / requestCheckout / approveCheckout / rejectCheckout）的邏輯與簽章
- 「前端不自行更新畫面，等伺服器廣播回來才重繪」這個原則
- 預算輸入框「使用者正在編輯時不回填」的那段防護
