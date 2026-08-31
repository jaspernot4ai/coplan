# 溝通
- 回覆極簡：直接給結果，不解釋過程、不客套
- 不要問「需要我繼續嗎」，直接做完

# 專案
CoPlan — 多人 × 多 Agent 共享行程協作，參加 OpenAI WebMCP Challenge（截止 2026/9/4 04:00 台北時間）。
Cloudflare Workers + Durable Objects（一房間一實例）、原生 JS、WebSocket 即時同步。
已部署：https://coplan.coplan-lab.workers.dev

# 防 slop 規則
- 做**最小**的修改。新增檔案、抽象層、或安裝套件前先問我，並說明為什麼不能用現有的東西解決
- 一次只改一件事。不要順便重構、順便改格式、順便優化
- 不寫「以防萬一」的程式碼：沒有實際會發生的情境，就不要加那個 if
- 註解寫在「段落／功能」層級，不逐行寫：每個函式、每個邏輯區塊前面用一到兩行說明「這段在做什麼、為什麼這樣做」，讓人不必讀完程式碼就能導航
- 不寫逐行的顯而易見註解（例如 `i++ // i 加一`）。註解要回答「為什麼」，不是複述「做了什麼」
- 取捨要寫進註解：刻意不做驗證、刻意重算全部而不做增量、刻意用簡單解法，都在該處註明理由
- 改完主動告訴我：改了哪些檔案、為什麼、有沒有我該注意的取捨

# 架構規則
- WebMCP 的 API 位置因平台而異：Chrome 是 navigator.modelContext，ChatGPT 桌面版是 document.modelContext。一律用 `document.modelContext || navigator.modelContext || window.modelContext;`
- WebMCP 工具的 execute 必須呼叫與 UI 按鈕相同的函式，不可另寫一套邏輯
- 工具的回傳值是寫給 AI 看的回報訊息，要說清楚做了什麼
- 衝突偵測、預算判斷一律用程式邏輯，不呼叫 LLM
- 會花錢的操作永不由 Agent 直接完成，只能產生待人確認的請求
- 前端不自行更新畫面，一律等伺服器廣播回來才重繪