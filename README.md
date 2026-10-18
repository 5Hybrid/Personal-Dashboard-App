# Life OS

A personal dashboard for school and life — a Tauri 2 + React desktop app.

## What's in it

- **Today** — greeting, today's tasks, the next 7 days, the 24-hour Day Ring, focus and quick notes.
- **Tasks** — everything in one list, grouped by when it's due. Filter by School, Personal or a list. Click a task to edit it in the side peek.
- **School** — each class is a page in the sidebar: assignments, weighted grades and notes. Letter grades and GPA points come from a school-wide scale you set in **Settings → School** (one-click "Standard +/-" preset available); any class can override it from its Edit dialog.
- **Calendar** — week and month views with Google Calendar events. Drag unscheduled tasks onto the week to block time.
- **Focus** — start a session from any task; the timer survives restarts.
- **Stats** — completions, on-time rate, focus time and class progress.
- **Ctrl K** — one box to search everything or add a task in plain language:
  `Lab 5 #python tue 11:59pm !high` → due Tuesday 11:59 PM, Python for Finance, high priority.
  Press **N** anywhere to open it.

Two areas only: **School** (classes) and **Personal** (lists, made with `#list`). Tasks from
older versions in Work, Gym, Finance, etc. show up as Personal lists of the same name — nothing
was deleted.

## Develop

```sh
npm install
npm run tauri dev
```

Tests: `npm test` (frontend) and `cargo test` in `src-tauri` (needs `GOOGLE_CLIENT_ID` /
`GOOGLE_CLIENT_SECRET` set at compile time — any value works for tests).

## Troubleshooting

Seeing "localhost refused to connect" after a build, or the app won't open from the
shortcut? See [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md).
