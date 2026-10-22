---
title: '用 Ollama？其實你在跑 llama.cpp'
description: '在 Jetson Orin Nano 上編譯 llama.cpp，轉換、量化並推理 GGUF 模型。'
pubDate: '2025-03-05'
tags: [llama.cpp, ollama, jetson]
---

Ollama 在大語言模型社群中擁有極高的關注度，因為它讓使用者能夠輕鬆地在本地環境運行大型語言模型，即使對相關參數不熟悉，也能獲得良好的使用體驗。此外，Ollama 還提供模型託管服務，使得部署與管理變得更加便捷。

然而，在 Ollama 背後執行推理的核心技術其實是 llama.cpp，而 GGUF 模型格式也是由 llama.cpp 的作者所開發。雖然 Ollama 已經足以應對日常使用，但如果追求極致的推理效能，或希望探索尚未正式發布的實驗性功能，那麼深入理解與使用 llama.cpp 便是必要的。

本指南將介紹如何在特定硬體環境下編譯 llama.cpp，轉換與量化 GGUF 模型，以及進行高效的推理測試。

## 試驗平台

硬體環境：Jetson Orin Nano

軟體環境：JetPack 6.2 (Ubuntu 22.04, CUDA 12.6)

測試模型：[microsoft/Phi-4-mini-instruct](https://huggingface.co/microsoft/Phi-4-mini-instruct)

## 編譯 llama.cpp

### 安裝必要套件

在 Jetson Orin Nano 上編譯 llama.cpp 需要確保系統具備必要的依賴項，包括 CUDA 支援、CMake 以及 g++ 編譯器。如果你使用的是 Jetson 平台，這些工具應該已經預裝。

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y build-essential cmake git
```

### 下載並編譯 llama.cpp

```bash
git clone https://github.com/ggerganov/llama.cpp.git
cd llama.cpp
```
Jetson 平台具備 CUDA 核心，因此我們可以啟用 CUDA 加速 GPU 計算。若使用其他平台，請參考[官方文檔](https://github.com/ggml-org/llama.cpp/blob/master/docs/build.md)以啟用對應功能。

```bash
cmake -B build -DGGML_CUDA=ON
make -j$(nproc)
```

執行完上述步驟後，llama.cpp 應已成功編譯，編譯的可執行文件會儲存在 `build/bin` 目錄下。

## 轉換 GGUF 模型

llama.cpp 使用 GGUF 格式的模型。你可以在 Hugging Face 或 Ollama 的儲存庫上直接下載別人轉換好的 GGUF 模型。但如果暫時還沒有現成的 GGUF，你可以自己將 Hugging Face 上發佈的模型轉換從 GGUF 模型，llama.cpp 有提供轉換的 Python 腳本。

### 下載原始 Hugging Face 模型

可以通過 [huggingface-cli](https://huggingface.co/docs/huggingface_hub/en/guides/cli) 快速下載 Hugging Face 上的模型:

```
huggingface-cli download microsoft/Phi-4-mini-instruct --local-dir ./phi4
```

這將把模型下載到本地的 `./phi4` 目錄中。

### 轉換為 GGUF 格式

轉換模型的腳本在 llama.cpp 目錄中。在運行腳本之前，你應該要安裝 python 的依賴

```bash
pip3 install -r requirements.txt
```

接下來就可以用 `convert_hf_to_gguf.py`轉換模型。你可以用命令 `python3 convert_hf_to_gguf.py -h` 查看該腳本的可用參數。

```bash
python3 convert_hf_to_gguf.py ./phi4 --outfile ./models/Phi-4-mini-instruct.gguf
```

這將生成 `./models/Phi-4-mini-instruct.gguf`。到這裏 llama.cpp 就可以推理模型了。

## 量化模型

為了提高推理速度並減少記憶體佔用，我們可以對 GGUF 模型進行量化處理。讓原本需要 9G 顯存的模型，只需要 5G 就能運行。

```bash
./build/bin/llama-quantize ./models/Phi-4-mini-instruct.gguf ./models/Phi-4-mini-instruct-q4.gguf q4_0
```

這會將模型從浮點格式轉換為 Q4_0 量化格式，從而提升推理速度並降低硬體需求。

目前量化格式種類繁多，各自具備不同程度的加速與壓縮效果，相對應的準確度也會有所犧牲。不同模型與應用場景適用不同的量化格式，因此建議嘗試多種量化方案，以尋找最適合的配置。

## 推理

當完成模型準備後，即可開始執行推理。

```bash
./build/bin/llama-cli -m ./models/Phi-4-mini-instruct-q4.gguf
```

如果一切順利，你應該能成功加載模型並進入對話模型。
