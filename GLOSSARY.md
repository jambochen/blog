# Jambo's blog

A notes blog on computer science, mathematics and statistics. Posts stand alone or are read in order as a series.

## Language

### Posts and series

**Post**:
One article, whether or not it belongs to a series.
_Avoid_: article, entry, episode (for a post outside a series)

**Series**:
A set of posts meant to be read in order.
_Avoid_: collection, category

**Key**:
The name that identifies a series: the name of its folder and the first part of the address of its page and its episodes.
_Avoid_: slug, series id

**Episode**:
A post that belongs to a series.
_Avoid_: part, chapter

**Standalone post**:
A post that belongs to no series.
_Avoid_: single, loose post

**Placement**:
Where an episode sits in its series: its number among the episodes a reader can open, and its slot among all of them.
_Avoid_: position, place, series order

**Draft**:
A post that is written but not published. A reader cannot open it, but it still takes a slot in its series.
_Avoid_: unpublished post, hidden post

**Catalogue**:
Every post a reader can open, together with the series, placements and standalone posts derived from them.
_Avoid_: index, registry, post list

**Tone**:
The colour a series gives to its colour block.
_Avoid_: theme, palette

### Links between posts

**Wikilink**:
A reference in a post's text, written `[[...]]`, to another post or to a section.
_Avoid_: xref, cross-reference, reference

**Section**:
A heading of a post together with the text under it, as the target of a wikilink.
_Avoid_: anchor, heading (for the target)

**Link preview**:
The card shown when a reader hovers over a wikilink, naming the target and summarising it.
_Avoid_: tooltip, hover card

### 文章用語

Terms used in the text of the posts. They stay in Chinese because the posts are written in it.

**讀者**:
用 R 或 Python 做資料分析與科學計算的學生與研究者，沒有 CS 訓練，目前只透過網頁對話介面使用 GPT 與 Claude。R 為主，多數人用 RStudio；Python 為輔。不假設認識 Markdown、Git、終端機或 Node.js。例子取自統計，但讀者不限於統計系。
_Avoid_: 統計人、非資工專業、初學者、小白

**Coding agent**:
能在讀者電腦上直接讀寫檔案並執行 code 的 LLM 工具，本系列以 Claude Code 為例，並說明 Codex 的對應做法。
_Avoid_: AI 助手、AI 工具、CLI agent

**Agent 框架**:
包在 LLM 外面的那一層，替 LLM 讀檔、執行指令並把結果送回去；LLM 加上框架才是 agent。網頁對話與 coding agent 是同一個 LLM 配上不同的框架。首次出現時寫全稱並附英文 harness，其後簡稱框架。
_Avoid_: 外層、外殼、harness（單獨使用）

**網頁對話**:
讀者現有的使用方式：在瀏覽器裡與 GPT 或 Claude 對話，手動複製貼上 code。
_Avoid_: 聊天機器人、ChatGPT（作為泛稱）

**操作介面**:
讀者操作 coding agent 的入口。本系列只涵蓋桌面 app 與編輯器擴充套件，不涵蓋命令列。Claude 桌面 app 專指其中的 Code 分頁，不含 Chat 與 Cowork；Codex 這邊專指 ChatGPT 桌面 app 裡的 Codex，不含同一個 app 裡的 Chat 與 Work。
_Avoid_: 前端、客戶端

**專案**:
電腦上的一個資料夾，裝著一份分析所需的全部資料、code 與文件，也是 coding agent 看得到的範圍。
_Avoid_: project（指網頁對話或 Cowork 裡的 Projects 功能）、工作區、repo

**Vault**:
Obsidian 用來放筆記的資料夾，裡面全是 Markdown 檔。它可以直接當成一個專案交給 coding agent。
_Avoid_: 筆記庫、知識庫、資料庫

**貫穿範例**:
全系列共用的一個公開資料集與分析任務，每篇文章在它上面推進一步。
_Avoid_: demo、案例、練習

**規範檔**:
放在專案裡、寫給 coding agent 讀的指示檔案，用來記錄專案的寫作規範並讓 agent 主動指出問題。Claude Code 的是 `CLAUDE.md`，Codex 的是 `AGENTS.md`。
_Avoid_: 提示詞、system prompt、設定檔

**Skill**:
一份寫給 coding agent 的特定任務做法說明，只在做該類任務時才被載入。與規範檔的差別：規範檔每次對話都生效，skill 按需生效。
_Avoid_: 外掛、plugin、巨集、模板

**Subagent**:
Agent 在對話中另外啟動的一個 agent，有自己的 context window，做完後只把結論交回主對話。
_Avoid_: 子 agent、子代理、分身

**純文字優先**:
本系列的立場：給 coding agent 讀的資料與文件，優先用 CSV、Markdown、TeX 原始碼這類純文字格式，不用 Excel、Word、PDF。
_Avoid_: 輕量化、格式轉換

**提交**:
Git commit 的中文說法：專案在某一刻的完整快照，出錯時可以退回。也作動詞用，存下一份快照便是提交一次。
_Avoid_: 存檔點、版本、備份
