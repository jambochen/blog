---
title: '中央極限定理的數值驗證'
description: '示範文章：用來檢查公式、程式碼與中英混排的樣式，可以直接刪除。'
pubDate: '2026-10-09'
tags: ['statistics', 'probability']
---

設 $X_1, X_2, \dots, X_n$ 為獨立同分布 (i.i.d.) 的隨機變數，期望值 $\mu$、變異數 $\sigma^2 < \infty$。令樣本平均 $\bar{X}_n = \frac{1}{n}\sum_{i=1}^{n} X_i$，中央極限定理 (central limit theorem) 說的是標準化後的樣本平均依分布收斂到標準常態：

$$
\sqrt{n}\,\frac{\bar{X}_n - \mu}{\sigma} \xrightarrow{d} \mathcal{N}(0, 1).
$$

## 為什麼是 $\sqrt{n}$

樣本平均的變異數是 $\operatorname{Var}(\bar{X}_n) = \sigma^2 / n$，所以 $\bar{X}_n - \mu$ 的量級是 $n^{-1/2}$。乘上 $\sqrt{n}$ 剛好把它放大回 $O(1)$：乘得再少會塌縮到 0，乘得再多會發散。

> 定理只保證「分布」收斂，沒有說收斂多快。收斂速度由 Berry–Esseen 定理給出，上界是 $O(n^{-1/2})$。

## 用指數分布驗證

指數分布 $\operatorname{Exp}(1)$ 明顯右偏，$\mu = \sigma = 1$，適合拿來看偏態如何隨 $n$ 消失。

```python
import numpy as np

rng = np.random.default_rng(seed=0)

def standardized_means(n: int, trials: int = 100_000) -> np.ndarray:
    samples = rng.exponential(scale=1.0, size=(trials, n))
    return np.sqrt(n) * (samples.mean(axis=1) - 1.0)

for n in (2, 10, 100, 1000):
    z = standardized_means(n)
    skewness = np.mean(z**3) / np.std(z) ** 3
    print(f"n={n:<5d} skewness={skewness:+.3f}")
```

$n$ 個 $\operatorname{Exp}(1)$ 的和服從 $\operatorname{Gamma}(n, 1)$，偏態係數是 $2/\sqrt{n}$，所以理論值可以直接寫出來：

| $n$  | 理論偏態 $2/\sqrt{n}$ |
| ---- | --------------------- |
| 2    | 1.414                 |
| 10   | 0.632                 |
| 100  | 0.200                 |
| 1000 | 0.063                 |

模擬結果應該落在這些數字附近，誤差來自 `trials` 有限。偏態以 $n^{-1/2}$ 的速度趨近 0，和 Berry–Esseen 的階數一致。
