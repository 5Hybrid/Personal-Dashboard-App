# Troubleshooting

Known local-dev/build gotchas for this app, why they happen, and how to fix them fast.

## "Hmmm... can't reach this page — localhost refused to connect" (ERR_CONNECTION_REFUSED)

**When it happens:** after building, or after running the app in dev mode.

**What it means:** the window that opened is a **debug** build. Tauri bakes the
content-loading mode in at compile time based on Rust's `debug_assertions`:

| Build | Loads frontend from |
|---|---|
| `cargo build` / `cargo run` / `npm run tauri dev` (debug) | `http://localhost:1420` — the Vite dev server (`tauri.conf.json`'s `build.devUrl`) |
| `cargo build --release` / `npm run tauri build` (release) | The embedded `dist/` bundle — never touches localhost |

So this screen always means: a debug-mode window opened, but **nothing is listening on
port 1420**. Two ways that happens:

1. **You launched the debug exe directly** (`src-tauri/target/debug/tauri-app.exe`, `cargo
   run`, or an IDE "Run" button) without the Vite dev server running alongside it.
   → Use `npm run tauri dev` instead — it starts Vite for you (`beforeDevCommand` in
   `tauri.conf.json`). Never double-click `target/debug/tauri-app.exe` on its own.

2. **A previous dev session's Vite process didn't fully exit** (e.g. you closed the
   terminal/IDE instead of Ctrl+C'ing it — a common way Windows leaves orphaned `node.exe`
   processes behind). `vite.config.ts` sets `strictPort: true` on 1420, so the *new* Vite
   instance for your next `npm run dev` / `tauri dev` can't bind that port and just exits —
   but the Tauri window still opens and tries to load `http://localhost:1420`, which now has
   nobody listening at all.

**Fix (already automated):** `predev` in `package.json` runs
[`scripts/free-dev-port.js`](../scripts/free-dev-port.js) before every `npm run dev`
(and therefore before every `tauri dev`, since that's what `beforeDevCommand` invokes) and
kills whatever's squatting on port 1420. This should make case 2 self-healing.

**Manual recovery** if it still happens (e.g. you ran `vite`/`tauri dev` some other way that
skips the npm lifecycle hook):

```powershell
# Find and kill whatever's on port 1420
Get-NetTCPConnection -LocalPort 1420 -ErrorAction SilentlyContinue |
  ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }

# Or just run the same script directly
node scripts/free-dev-port.js 1420
```

Then restart with `npm run tauri dev` (not the raw debug exe).

---

## App won't open from the shortcut / taskbar icon (window never appears)

**Symptom:** the icon is pinned to
`src-tauri/target/release/tauri-app.exe`. Clicking it seems to do nothing — Task Manager
shows a `tauri-app.exe` process, but no window appears (or only an invisible helper window
titled `com.nathanang.lifeos-siw` shows up).

**What it means:** `lib.rs` registers `tauri_plugin_single_instance` specifically to guard
against this: double-clicking the icon while a previous launch is still alive (even
invisibly) spawns a second process pointed at the same WebView2 profile folder
(`%LOCALAPPDATA%\com.nathanang.lifeos\EBWebView`). The second WebView2 environment fails to
initialize (profile lock contention) and can leave orphaned `msedgewebview2.exe` processes
behind, which then block the *next* launch too.

**Fix:**

```powershell
# 1. Kill the stuck app and any of ITS orphaned webview children
#    (check ParentProcessId first — msedgewebview2.exe is also used by
#    Windows Search and other apps; only kill ones parented by tauri-app.exe)
Get-CimInstance Win32_Process -Filter "Name='msedgewebview2.exe'" |
  Where-Object {
    (Get-CimInstance Win32_Process -Filter "ProcessId=$($_.ParentProcessId)").Name -eq 'tauri-app.exe'
  } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

Get-Process -Name tauri-app -ErrorAction SilentlyContinue | Stop-Process -Force

# 2. Relaunch
Start-Process "C:\Users\natha\Projects\Personal-Dashboard-App\src-tauri\target\release\tauri-app.exe"
```

**Caution:** don't blanket-kill every `msedgewebview2.exe` process on the system — most of
them belong to unrelated apps (Windows Search's `SearchHost.exe`, Google Drive, etc.).
Always check `ParentProcessId` first.

---

## General rule of thumb

- **Testing a Rust/frontend change quickly?** Use `npm run tauri dev`. Never run
  `target/debug/tauri-app.exe` standalone.
- **Want the real, installable build?** `npm run tauri build` (or `cargo build --release`
  inside `src-tauri`), then launch `target/release/tauri-app.exe` — this one never needs a
  dev server running.
- **Always stop a dev session with Ctrl+C** in the terminal it's running in, not by closing
  the window/terminal app — that's what leaves orphaned Vite/WebView2 processes behind for
  next time.
