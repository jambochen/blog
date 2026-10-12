---
title: 'Jetson AI Lab實戰啟航19-NanoLLM開發平臺(7)：Plugins解析'
description: 'NanoLLM 的 plugin 格式、基礎類型與原始碼解析。'
pubDate: '2024-09-08'
seriesOrder: 27
---

## Plugins插件

Plugins插件是近年來所有建構開發平台的一個關鍵元素，也是鼓勵開發者在上面發展各自創意空間的黏合劑，可以為開發平台提供無限擴展的能力。

NanoLLM也同樣提供擴展plugins的機制，它是模型（如 LLM、ASR、TTS）、後處理器和 I/O（如視訊和音訊流）的包裝器，可以將它們連接在一起，與其他插件節點一起形成管道，目的在減少樣板程式碼並快速建構更複雜的代理。

Plugins將輸入資料接到處理佇列中，然後對其進行處理，再透過其輸出通道輸出結果。每個輸出通道表示模型具有的一種輸出類型，例如ChatQuery插件在token、word和sentence級別公開輸出，並且每個輸出通道可以連接到任意數量的其他插件節點。

預設情況下，插件是執行緒化的，並在自己的佇列中運行，但可以透過傳遞`threaded=False`給插件的初始化程序將它們配置為內聯運行（非執行緒化）。也可以透過`interrupt()`中斷函數，以放棄當前請求和輸入佇列中的任何剩餘資料，例如想提前停止 LLM生成或靜音TTS輸出。

創建新插件類型時，由`process()`函數來處理傳入資料，然後返回傳出資料。我們還可以使用簡單的回呼函數來接收資料，而不需要定義自己的插件類接收聊天輸出，例如`chat_plugin.add(my_function)`。

NanoLLM所有插件都透過共享的`nano_llm.plugin`解析器進行處理，原始碼在容器裡的`/opt/NanoLLM/nano_llm/plugin.py`。

即便是基礎類（base class）的插件，也得能處理來自與其他插件連接的輸入/輸出資料，這樣才能形成pipeline或graph。插件可以單執行緒運行，也可以在處理佇列外資料的獨立執行緒中運行。

## Plugins的最基礎格式如下：

```python
class Plugin(name=None, title=None, inputs=1, outputs=1, relay=False, drop_inputs=False, threaded=True, **kwargs)
```

## 下面三類是常用的基礎plugins類型：

- source：讀取文字提示詞、圖像/視訊；
- process：處理LLM查詢、RAG、動態LLM調用、圖像後處理器；
- output：輸出文字到stdout、保存圖像/視訊。

## 下面簡單說明一下plugin原始碼裡的主要內容：

- 插件之間存在集成關係，需要透過`process()`函數進行傳遞；
- `Instances = []`：插件實例的全域列表；
- `process(input, **kwargs)`：插件實例應實現的抽象函數來處理傳入資料。除非`threaded=False`，否則不要在外部調用此函數，否則插件的內部執行緒會從佇列中分派。

### 參數部分：

- `input`：從pipeline中前一個插件所輸入資料進行處理；
- `kwargs`：伴隨此資料的可選處理參數

### 返回結果：

- 插件應返回其輸出資料以發送給下游插件，也可以調用`output()`而不return值。
- `input(input=None, **kwargs)`：將資料添加到插件的處理佇列中並立即返回，或者如果`threaded=False`，則立即處理並返回結果。

### 參數部分：

- `input`：發送到插件的`proces()`函數的輸入資料；
- `kwargs`：轉發到插件的`process()`函數的其他參數。

### 返回結果：

- 如果插件是執行緒化的就不返回值，否則返回任何輸出值。
- `output(output, channel=0, **kwargs)`：將資料輸出到指定通道的下一個插件，如果輸出為-1時，則輸出給所有通道的下一個插件。
- `property num_outputs`：返回所有通道的輸出連接總數
- `start()`：為圖中啟用了執行緒的所有插件啟動執行緒。
- `stop()`：標記插件以停止處理並退出`run()`執行緒。
- `destroy()`：停止插件執行緒的運行，並從全域實例中註銷它。
- `run()`：永久處理佇列，並在使用`threaded=True`創建時自動運行
- `dispatch(input, **kwargs)`：對傳入資料調用`process()`函數
- `interrupt(clear_inputs=True, recursive=True, block=None)`：中斷任何正在進行/未決的處理，並可選擇清除輸入佇列和任何下游佇列，並可選擇性地等待這些請求的處理完成。

### 參數部分：

- `clear_inputs(bool)`：如果為True，則清除此插件佇列中的所有剩餘輸入；
- `recursive(bool)`：如果為True，則任何下游插件也將被中斷；
- `block(bool)`：如果為True，此函數將等待任何正在進行的處理完成。這樣做是為了使任何揮之不去的輸出不會在管道的下游級聯。如果`block`為None，則如果此插件有輸出，它將自動設置為True。
- `clear_inputs()`：清除輸入佇列，刪除所有資料。
- `find(type)`：透過在其他插件的輸入和輸出連接的管道圖中搜索指定類型的插件，返回該插件。
- `add_tool(function, enabled=True, **kwargs)`：註冊一個能夠被函數調用模型調用的函數。

### 參數部分：

- `func(callable|str)`：函數或函數名；
- `doc_templates(dict)`：將help文檔中的key替換為對應值。
- `add_parameter(attribute: str, name=None, type=None, default=None, read_only=False, hidden=False, help=None, kwarg=None, end=None, **kwargs)`：創建一個在`state_dict`中共享且可由客戶端訪問/修改的屬性。這些將自動顯示在studio web UI中，並可以透過websockets同步。如果有一個同名的`__init__`參數，它的幫助文檔將取自該參數。
- `add_parameters(**kwargs)`：從`Plugin.add_parameters(x=x, y=y)`格式的kwargs中添加參數，其中鍵是屬性名稱，值是預設值。
- `set_parameters(**kwargs)`：設置參數的狀態字典。只會設置字典中與參數匹配的條目。
- `reorder_parameters()`：將一些參數移動到末尾以進行顯示（如果`end=True`）
- `state_dict(config=False, connections=False, hidden=False, **kwargs)`：返回一個配置字典，其中包含與客戶端共享的插件狀態。子類可以重新實現這一點，為每種類型的插件添加自定義狀態。
- `send_state(state_dict=None, **kwargs)`：透過websocket發送狀態字典消息。
- `send_stats(stats={}, **kwargs)`：透過websocket發送性能統計資料。
- `send_alert(message, **kwargs)`：向Web伺服器發送警報消息（有關kwargs，請參閱`webserver.send_alert()`）
- `send_client_output(channel)`：訂閱客戶端以透過websockets接收插件輸出。
- `apply_substitutions(text)`：透過從其他插件中查找值，對文字字串執行變數替換。引用的作用域可以是插件的名稱：“日期是\${Clock.date}”，或者如果沒有作用域，則找到第一個帶有它的插件：“日期為\${date}”插件和屬性都不區分大小寫：“日期均為\${date}”這些也可以引用不需要位置參數的getter函數或屬性，如果找到，將調用關聯函數並替換其返回值。

以上就是要自行開發NanoLLM插件的一些API內容，接入系統的方式就是按照標準Python的習慣，將插件程式碼放到`nano_llm/plugins`目錄下，也可以根據功能去添加子目錄，調用時按照要求載入就行。
