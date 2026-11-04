# 你吃啥？｜免費餐廳探索網站 V1

以 HTML、CSS、JavaScript 製作，適合 GitHub Pages。無帳號、無 API Key、無需綁信用卡。

## 功能
- 台灣美食刊物風格單頁式設計，支援手機與桌機
- 使用瀏覽器定位、拖曳 OpenStreetMap 地圖選點，或手動搜尋地址
- 500 公尺／1 公里／2 公里半徑
- 心情、口味、料理、餐點類型與預算／用餐時間選項
- 從 OpenStreetMap 的具名餐飲店家隨機推薦，避免連續重複
- 用 Google Maps 網址開啟評論頁或步行導航，不需 Google API Key

## 重要資料限制
1. **不會取得 Google Maps 評分、評論或店家照片**。推薦卡片採本專案自繪的通用店面插畫，並提供 Google Maps 連結供查閱真實評論。不能把料理標籤誤當成評論摘要。
2. **預算無法可靠驗證**：可選擇預算，但現階段不據此過濾店家，頁面清楚提示未驗證。正式價格功能需另外有可信來源。
3. **營業時間不保證準確**。程式僅對簡單的 OSM 每週時段文字與 `24/7` 做推算；複雜格式與缺少資料一律標示「營業時間未知」。確認已關閉的店家會排除，未知則保留並提示。
4. **口味／心情不是店家實測資料**：僅依公開料理標記及店名進行有限加權，不表示店家一定符合偏好。
5. **Google Maps URL 搜尋不能保證定位到正確的店家**，必要時請在 Google 地圖再核對。
6. 公開 Overpass、Nominatim 與 OSM 圖磚服務可能限流、暫停或更改政策，**沒有穩定服務保證**，不適合直接大規模商用。
7. 沒有會員系統，也不會將使用者位置傳到自建伺服器，但位置／地點搜尋會傳送給公開地圖資料服務，依其服務政策處理。

## 本機預覽
建議用 VS Code 的 Live Server 外掛，或在這個資料夾執行：

```bash
python -m http.server 8000
```

接著用瀏覽器開啟 `http://localhost:8000`。瀏覽器定位通常只在 HTTPS 或 localhost 可用；直接打開 `file://` 可能會遇到限制。

## GitHub Pages 部署
1. 登入 GitHub，建立新的 **Public** Repository（例如 `ni-chi-sha`）
2. 將 `index.html`、`style.css`、`script.js`、`assets/storefront.svg`、`README.md` 上傳至 Repository **根目錄**（注意 `assets` 的目錄結構）
3. 開啟 Repository 的 **Settings → Pages**
4. 在 **Build and deployment** 設為 **Deploy from a branch**，branch 選 `main`，folder 選 `/(root)`，儲存
5. 部署後通常會在 `https://<你的帳號>.github.io/ni-chi-sha/` 開啟

## 使用之免費外部服務與政策
- Leaflet: https://leafletjs.com/
- OpenStreetMap: https://www.openstreetmap.org/copyright
- OSM tile policy: https://operations.osmfoundation.org/policies/tiles/
- Nominatim policy（手動搜尋採送出才查詢，不做 autocomplete）: https://operations.osmfoundation.org/policies/nominatim/
- Overpass API: https://wiki.openstreetmap.org/wiki/Overpass_API
- Google Maps URLs (no Google API key): https://developers.google.com/maps/documentation/urls/get-started

## 後續建議
如果公開服務限流或資料品質不足，優先改用自主維護的合法店家資料／靜態 JSON 清單與資料更新機制。避免直接爬取 Google Maps 評論或照片。
