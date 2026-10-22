---
title: 'Using Rust WebAssembly in Vite + React: A Modern Game of Life Example'
description: 'Run the official Rust + wasm Game of Life tutorial in a Vite + React project.'
pubDate: '2025-12-09'
tags: [rust, webassembly, vite, react]
---

> This project is based on the official Rust + WebAssembly tutorial for **Game of Life**:  
> [https://rustwasm.github.io/docs/book/game-of-life/introduction.html](https://rustwasm.github.io/docs/book/game-of-life/introduction.html)
> 
> All Rust code is taken directly from the tutorial. The focus here is on integrating Rust-generated WebAssembly into a **Vite + React + TypeScript** project. The official tutorial still uses webpack and JavaScript, which makes the documentation a bit outdated for Vite users. This guide shows how to adapt the workflow to Vite while keeping everything compatible with wasm-bindgen.

## 1. Project Structure Overview

After setup, the project looks like this:

```text
.
├── backend                # Rust wasm backend
│   ├── Cargo.toml
│   └── src/lib.rs
├── pkg                    # wasm-bindgen output directory
├── src                    # React frontend
│   ├── App.tsx
│   └── main.tsx
├── vite.config.ts
├── package.json
└── index.html
```

This structure separates the Rust logic (backend) from the React frontend.

## 2. Create the Vite + React + TypeScript Project

In the **project root**:

```bash
pnpm create vite
```

Select:

- Framework: `React`
- Variant: `TypeScript`

Install dependencies:

```bash
cd wasm-lifegame
pnpm install
```

## 3. Create Rust WebAssembly Backend

From the **project root**:

```bash
cargo new backend --lib
```

Directory structure:

```text
backend/
├── Cargo.toml
└── src/lib.rs
```

Configure `Cargo.toml` for wasm

```toml
[package]
name = "backend"
version = "0.1.0"
edition = "2024"

[lib]
crate-type = ["cdylib"]

[dependencies]
wasm-bindgen = "0.2.106"
```

- `crate-type = ["cdylib"]` makes Rust compile to a dynamic library compatible with wasm
- `wasm-bindgen` is required for JS interop
### Rust Code: Game of Life

Open `backend/src/lib.rs` and replace it with the [**official Game of Life Rust code**](https://rustwasm.github.io/docs/book/game-of-life/introduction.html).

```rust
use std::fmt;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
#[repr(u8)]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Cell {
    Dead = 0,
    Alive = 1,
}

#[wasm_bindgen]
pub struct Universe {
    width: u32,
    height: u32,
    cells: Vec<Cell>,
}

impl Universe {
    fn get_index(&self, row: u32, column: u32) -> usize {
        (row * self.width + column) as usize
    }

    fn live_neighbor_count(&self, row: u32, column: u32) -> u8 {
        let mut count = 0;
        for delta_row in [self.height - 1, 0, 1].iter().cloned() {
            for delta_col in [self.width - 1, 0, 1].iter().cloned() {
                if delta_row == 0 && delta_col == 0 {
                    continue;
                }

                let neighbor_row = (row + delta_row) % self.height;
                let neighbor_col = (column + delta_col) % self.width;
                let idx = self.get_index(neighbor_row, neighbor_col);
                count += self.cells[idx] as u8;
            }
        }
        count
    }
}

#[wasm_bindgen]
impl Universe {
    pub fn tick(&mut self) {
        let mut next = self.cells.clone();

        for row in 0..self.height {
            for col in 0..self.width {
                let idx = self.get_index(row, col);
                let cell = self.cells[idx];
                let live_neighbors = self.live_neighbor_count(row, col);

                let next_cell = match (cell, live_neighbors) {
                    (Cell::Alive, x) if x < 2 => Cell::Dead,
                    (Cell::Alive, 2) | (Cell::Alive, 3) => Cell::Alive,
                    (Cell::Alive, x) if x > 3 => Cell::Dead,
                    (Cell::Dead, 3) => Cell::Alive,
                    (otherwise, _) => otherwise,
                };

                next[idx] = next_cell;
            }
        }

        self.cells = next;
    }

    pub fn new() -> Universe {
        let width = 64;
        let height = 64;

        let cells = (0..width * height)
            .map(|i| {
                if i % 2 == 0 || i % 7 == 0 {
                    Cell::Alive
                } else {
                    Cell::Dead
                }
            })
            .collect();

        Universe {
            width,
            height,
            cells,
        }
    }

    pub fn render(&self) -> String {
        self.to_string()
    }
}

impl fmt::Display for Universe {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        for line in self.cells.as_slice().chunks(self.width as usize) {
            for &cell in line {
                let symbol = if cell == Cell::Dead { '◻' } else { '◼' };
                write!(f, "{}", symbol)?;
            }
            write!(f, "\n")?;
        }

        Ok(())
    }
}

```



## 4. Add the wasm compilation target

```bash
rustup target add wasm32-unknown-unknown
```

## 5. Build Rust to WebAssembly


```bash
cd backend
cargo build --target wasm32-unknown-unknown
```

Generates:

```text
backend/target/wasm32-unknown-unknown/debug/backend.wasm
```

## 6. Generate JavaScript Bindings with wasm-bindgen

Install `wasm-bindgen-cli` by `cargo`

```bash
cargo install wasm-bindgen-cli
```

Return to the project root:

```bash
cd ..
wasm-bindgen backend/target/wasm32-unknown-unknown/debug/backend.wasm \
  --out-dir pkg \
  --target web
```
- Note that `--target` is "web" and not "bundle".

Output:

```text
pkg
├── backend_bg.wasm
├── backend_bg.wasm.d.ts
├── backend.d.ts
└── backend.js
```

This `pkg` folder contains everything the frontend needs to import the wasm module.

## 7. Install Vite WebAssembly Plugins

```bash
pnpm add -D vite-plugin-wasm vite-plugin-top-level-await
```

These plugins allow Vite to handle `.wasm` imports and top-level `await`. Edit `vite.config.ts`:

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";

export default defineConfig({
  plugins: [react(), wasm(), topLevelAwait()],
});
```

## React Frontend: Loading Rust wasm (src/App.tsx)

```tsx
import { useRef, useEffect } from "react";
import "./App.css";
import init, { Universe } from "../pkg/backend"; // Not `backend_bg.wasm`

function App() {
  const preRef = useRef<HTMLPreElement | null>(null);
  const universeRef = useRef<Universe | null>(null);

  useEffect(() => {
    const start = async () => {
      await init();
      const universe = Universe.new();
      universeRef.current = universe;

      const renderLoop = () => {
        if (preRef.current && universeRef.current) {
          preRef.current.textContent = universeRef.current.render();
          universeRef.current.tick();
        }
        requestAnimationFrame(renderLoop);
      };

      requestAnimationFrame(renderLoop);
    };

    start();
  }, []);

  return (
    <pre
      ref={preRef}
      id="game-of-life-canvas"
      style={{ fontFamily: "monospace", lineHeight: 1, fontSize: 10 }}
    />
  );
}

export default App;
```

## Run the Project

```bash
pnpm run dev
```

Visit:

```
http://localhost:5173
```

You should see the **Game of Life running in real time in the browser**, driven by Rust + wasm.

## Automate wasm Build (package.json)

```json
"scripts": {
  "wasm": "cd backend && cargo build --target wasm32-unknown-unknown && wasm-bindgen target/wasm32-unknown-unknown/debug/backend.wasm --out-dir ../pkg --target web",
  "predev": "pnpm run wasm",
  "prebuild": "pnpm run wasm",
  "dev": "vite",
  "build": "tsc -b && vite build",
  "lint": "eslint .",
  "preview": "vite preview"
}
```

This ensures Rust is compiled to wasm automatically before dev or build.
