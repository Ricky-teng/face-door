# 人臉辨識服務（InsightFace）

一個獨立的 Python (Flask) 服務，包住 InsightFace 的 `buffalo_l` 模型，
提供 `/embed`（把一張照片轉成 512 維人臉特徵值）給 [server/index.js](../server/index.js) 呼叫。

## 為什麼 Python 環境不在這個資料夾裡

虛擬環境（`venv`）跟下載下來的模型權重檔，是刻意裝在專案外面的
`C:\fbench\env`，**不是**放在這個 `recognizer/` 資料夾。

原因：這個專案在 OneDrive 同步的路徑下，路徑本身已經很長；
`onnx` 這個套件內建的測試資料檔案名稱又臭又長，兩個疊加會超過 Windows
路徑長度上限（`WinError 206`），導致安裝失敗。裝在 `C:\fbench` 這種短路徑
底下可以完全避開這個問題，也順便避開 OneDrive 同步大量小檔案造成的效能問題。

## 啟動方式

```bash
npm run recognizer
```

第一次啟動要載入模型，大約需要 70~80 秒，之後看到

```
=== 模型載入完成，服務就緒 ===
```

才代表可以開始接收請求。之後這個服務要跟 [server/index.js](../server/index.js)（`npm run server`）一起跑，兩個都要保持開著。

## 如果要在別台電腦上重新安裝

```bash
python -m venv C:\fbench\env
C:\fbench\env\Scripts\python.exe -m pip install --no-deps insightface
C:\fbench\env\Scripts\python.exe -m pip install onnxruntime numpy onnx tqdm requests scipy scikit-image opencv-python-headless coloredlogs cython easydict flask
```

用 `--no-deps` 先裝 `insightface` 本身，再手動裝其餘依賴，是為了跳過
`insightface` 預設會拉進來的重複套件 `opencv-python`（跟已經裝的
`opencv-python-headless` 功能重疊，純粹浪費下載時間）。

裝的路徑一樣要選短路徑、不在 OneDrive 同步範圍內，否則會重演上面提到的
路徑長度問題。
