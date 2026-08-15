# FaceGuard 專案交接筆記

給接手這個專案的 AI 看的。使用者正在把系統從「開發用電腦」搬到「另一台當常駐伺服器用的電腦」。這份文件是接續開發用的完整背景。

## 專案是什麼

一個自架的人臉辨識智慧門禁系統。平板裝在家門口當鏡頭，辨識成功後（未來）觸發 ESP32 控制電子鎖開門。

## 架構（三個獨立服務）

1. **前端**（Vite + 原生 JS，[src/main.js](src/main.js)）——平板瀏覽器打開，負責：
   - 本地跑輕量的人臉「是否有人在鏡頭前」偵測跟畫框（用 `@vladmandic/human`，`human.detect(video)`），**不**用來做身份比對
   - 把畫面截圖（縮到寬度 800px）傳給後端 `/api/recognize` 做真正的身份比對
   - 連續 2 次比對結果一致才算數（防止單幀雜訊造成忽通忽不通），常數 `CONFIRM_COUNT`
   - 人員管理、通行紀錄、設定頁（門檻、自動辨識、自動開門、開門秒數——這幾個設定已經會存進 `localStorage`，重新整理不會跳回預設值）
   - 「辨識模式」按鈕（`#kioskToggle`）：切到只顯示鏡頭+門鎖狀態的精簡版面，給裝在門口的平板用，狀態存在 `localStorage`

2. **Express 後端**（[server/index.js](server/index.js)）——存人員資料、通行紀錄（`server/data.json`，**已加進 .gitignore，不會進版控**，因為裡面有人臉特徵值），並且：
   - 提供 `/api/people`、`/api/logs`、`/api/recognize` 等 REST API
   - `POST/PATCH /api/people` 收到的是**原始照片**，由後端呼叫下面的 Python 服務算特徵值（前端不再自己算）
   - 支援密碼保護：環境變數 `APP_PASSWORD` 有設才會要求密碼（沒設就直接放行，這是本機/區網用的安全預設，部署到公網一定要設）
   - `DATA_DIR` 環境變數可以指定資料存放路徑（給雲端部署掛 Volume 用，本機不用設）

3. **Python 辨識服務**（[recognizer/app.py](recognizer/app.py)，Flask）——包住 InsightFace 的 `buffalo_l` 模型，提供 `/embed`，把照片轉成 512 維人臉特徵值。Express 呼叫這個服務做實際運算。

## ⚠️ 最重要的一件事：Python 環境不在專案資料夾裡

**這個資料夾被搬過來之後，`recognizer` 服務目前是完全跑不起來的**，因為它的 Python 虛擬環境（`venv`）跟下載下來的模型權重檔（275MB），刻意裝在原本那台電腦的 `C:\fbench\env`，**不在**這個專案資料夾裡，所以不會被複製過來。

原因寫在 [recognizer/README.md](recognizer/README.md)：這個專案路徑本身很長（在 OneDrive 同步資料夾底下），`onnx` 這個 Python 套件內建的測試資料檔案名稱又臭又長，兩個疊加會超過 Windows 路徑長度上限，導致安裝失敗（`WinError 206`）。解法是把 venv 裝在一個**很短、不在雲端同步資料夾裡**的路徑。

**在新電腦上要做的事**：照 [recognizer/README.md](recognizer/README.md) 最後那段指令，在新電腦上找一個短路徑（例如 `C:\fbench`，不要在 OneDrive/Google Drive 這種同步資料夾底下）重新建立 venv、裝套件。第一次啟動會自動下載 275MB 模型權重，會需要幾分鐘（視網速而定，我們在原本那台電腦上曾經因為網路太慢卡了快兩小時，換成有線網路後就正常了，如果新電腦也卡很久，先檢查是不是在用 WiFi）。

## 為什麼是這個架構（避免走回頭路）

- **一開始整個辨識都在瀏覽器端用 `@vladmandic/human` 做**，包含身份比對。後來發現手刻的 cosine similarity 用法是錯的（Human.js 的說明文件其實要求用它自己的 `human.match.similarity()`），改對之後準確度還是不夠好（陌生人可能被誤認），才決定換成更準的 InsightFace，但那個只有 Python 生態系有現成的高品質實作，所以才拆成獨立的 Python 微服務。
- **不要建議走回純瀏覽器端 AI 辨識**——已經驗證過準確度不夠。

## 目前卡在哪：正在從 Railway 搬到自架主機

之前把這個系統部署到 Railway（兩個服務：Express 公開、recognizer 內網），過程踩了不少坑（`APP_PASSWORD`／`RECOGNIZER_URL` 改了要記得按 Deploy 才生效；Railway 會自動幫每個服務注入自己的 `PORT` 環境變數蓋掉 Dockerfile 裡設的值，要手動在 recognizer 服務加一個固定的 `PORT=5001` 變數；服務間要用 `${{recognizer.RAILWAY_PRIVATE_DOMAIN}}` 這種參照語法拿內部網址，手動猜 `recognizer.railway.internal` 會 DNS 解析不到）。

**但 Railway 不是免費的**——試用額度會被 24 小時常駐的兩個服務燒完，使用者要的是**完全免費**，所以決定放棄 Railway，改成**買一台 mini PC（或用手邊另一台電腦）自己架在家裡常駐**，一次性硬體花費，之後零月費。

Docker 相關檔案（[Dockerfile](Dockerfile)、[recognizer/Dockerfile](recognizer/Dockerfile)）都還留著，不一定要用 Docker 跑，直接用 `node server/index.js` + `python recognizer/app.py` 兩個 process 常駐也可以（本機測試時期就是這樣跑的）。

**現在的搬遷方式**：使用者打算在原本那台開發用電腦上做一個簡單的下載頁（`downloadfile/index.html`，目前是空檔案），讓新的伺服器電腦連過去下載這個專案資料夾。這個 `face-door` 資料夾本身已經被搬進 `downloadfile/face-door` 底下了。

## 硬體（門鎖控制）——規劃好了但還沒做

- 決定用**一般款 ESP32**（WROOM-32 模組，不要 S2/S3/C3/C6），因為只需要「收 HTTP 請求→切繼電器」，不需要相機/AI 能力（那些現在都在平板+recognizer 那邊處理）
- 使用者手上有 Arduino Uno，但**沒有內建 WiFi**，已經決定不用它，改買 ESP32
- 已經買/在買的零件：ESP32 Type-C 開發板（CH340 晶片，**第一次接電腦前要先裝驅動程式**）、USB-A to USB-C 傳輸線（不是充電線）、繼電器模組、12V 電源供應器、一顆小型電磁鎖
- **電磁鎖的硬體限制很重要**：通電開鎖/斷電上鎖（fail-safe）、**單次開鎖時間不能超過 5 秒**（線圈會過熱）、**兩次觸發間隔不能低於 60 秒**。App 的「開門時間」設定要選 2 秒（不要選 10 秒）。ESP32 韌體之後要加 60 秒冷卻邏輯，**這個現在還沒寫**。
- **完全還沒做**：ESP32 韌體本身、實際接線、[src/main.js](src/main.js) 的 `openDoor()`/`lockDoor()` 目前還只是模擬 UI 狀態，沒有真的呼叫硬體 API

## 網路連線

- 電腦、平板、手機都已經裝了 **Tailscale** 並登入同一個帳號，各自有固定的 `100.x.x.x` 位址，不受區網 DHCP 變動影響
- 家用路由器（Zyxel EMG3525-T50B，中華電信 HiNet）後台密碼一直登不進去，已經放棄用路由器設定固定 IP，改靠 Tailscale 解決
- **搬到新電腦後**：新電腦也要裝 Tailscale 登入同帳號，拿到新的固定 IP，平板的 Chrome flags 白名單（`chrome://flags/#unsafely-treat-insecure-origin-as-secure`，因為用 IP 而非 HTTPS 網址，鏡頭權限需要這個設定）跟開啟的網址都要改成新電腦的 Tailscale IP
- 之前規劃過用 Tailscale + droidVNC-NG（平板）+ RealVNC Viewer（手機）做「人不在家也能看平板即時畫面」的功能，**討論到一半被辨識準確度問題打斷，還沒真的做完**，如果使用者提起，可以接續

## 現在的設定值（可能要依新環境重新調）

- 相似度門檻：使用者測試後調到大概 0.4~0.45（預設 0.65 太嚴格，正確使用者也會被卡）
- 建議：搬到新環境、新的實際安裝位置後，**重新用「新增照片」補幾張在實際安裝位置、實際光線條件下拍的照片**，可以顯著改善準確度，這比調參數更有效
- 畫質門檻已經放寬（`MIN_FACE_SCORE = 0.5`、`MIN_FACE_WIDTH_RATIO = 0.1`），本地人臉偵測頻率降到約 2 次/秒（`DETECT_INTERVAL = 500`）避免鏡頭畫面卡頓

## 快速啟動指令（本機/自架都適用）

```bash
npm install
npm run build
npm run server       # Express 後端，port 3001（或 $PORT）
```

另開一個終端機：
```bash
<venv路徑>/python recognizer/app.py   # Python 辨識服務，port 5001，第一次啟動要等模型載入（本機測約 74 秒）
```

兩個都要保持開著，服務才會動。
