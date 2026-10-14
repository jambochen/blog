# Jambo 的 blog

電腦科學、數學與統計的筆記，以 [Astro](https://astro.build) 建置，發佈在 <https://jambochen.github.io/blog/>。文章可以單篇閱讀，也可以依系列的順序閱讀。

## 指令

需要 Node.js 22.12 以上與 pnpm。

| 指令 | 作用 |
| --- | --- |
| `pnpm install` | 安裝相依套件 |
| `pnpm dev` | 啟動開發伺服器，網址是 `localhost:4321/blog/` |
| `pnpm test` | 執行 Vitest 測試 |
| `pnpm check` | 檢查型別 |
| `pnpm build` | 建置到 `dist/`，同時產生搜尋索引 |
| `pnpm preview` | 預覽建置結果 |
| `node scripts/shot.mjs <path>` | 以 375px 的寬度截一張開發伺服器上的頁面 |
| `scripts/check-wording.sh` | 列出 `coding-agent/` 文章裡應替換的用詞 |

開發伺服器上的搜尋用的是上一次建置的索引，所以第一次使用前要先建置一次。

推送到 `main` 時，`.github/workflows/` 裡的流程執行測試、型別檢查與建置，再部署到 GitHub Pages。

## 結構

```text
src/
├── content/
│   ├── blog/          文章；一個資料夾是一個系列，直接放在 blog/ 的是單篇
│   └── series.json    每個系列的名稱、說明與色調
├── pages/             首頁、文章列表、系列頁、文章頁、關於、搜尋、404
├── layouts/           Base.astro 是每一頁的外框，BlogPost.astro 是文章頁
├── components/        頁面的元件，以及文章裡的互動圖
├── lib/               文章目錄、路由、wikilink、圖的轉換、背景場景
└── styles/global.css  顏色、字級與內文的樣式
docs/                  文件，見下
scripts/               截圖與用詞檢查
```

## 文件

| 文件 | 內容 |
| --- | --- |
| [docs/design.md](docs/design.md) | 網站的視覺風格：顏色、字體、版面、各頁面、動效，以及試過後沒有採用的做法 |
| [docs/terrain-wallpaper.md](docs/terrain-wallpaper.md) | 背景的等高線地形與三體模擬怎麼生成 |
| [docs/style.md](docs/style.md) | 文章的寫作風格 |
| [GLOSSARY.md](GLOSSARY.md) | 專案的用語，以及文章裡的術語 |
| [AGENTS.md](AGENTS.md) | 給 coding agent 的規範檔：開發、寫文章、wikilink 與系列的規則 |
