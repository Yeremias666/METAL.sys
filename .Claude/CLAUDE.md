# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the app

There is no build step. Serve the directory over HTTP (opening `index.html` via `file://` fails due to CORS):

```bash
python -m http.server 8000
# or
npx http-server -c-1 . -p 8000
```

Open `http://localhost:8000/`. Reload the browser after any edit — Babel Standalone transpiles JSX at runtime and reports errors directly in the browser console.

Test MP3 files live in `test/`.

## Stack constraints — never change these

- **No npm, no bundler, no node_modules.** React 18 + Babel Standalone are loaded via CDN in `index.html`. Adding a build step would break the project.
- **No backend.** All persistence is `localStorage` (vault, likes, counts, bookmarks, clips) + IndexedDB (File System Access handles only).
- **JSX is transpiled in the browser** via `<script type="text/babel">`. Syntax errors appear in the browser console, not the terminal.

## File structure

| File | Size | Role |
|---|---|---|
| `app.jsx` | ~4700 lines | All logic and UI — single file by design |
| `crt.css` | ~3400 lines | All styles + CRT effects |
| `tweaks-panel.jsx` | ~570 lines | Floating tweaks panel (reusable shell) |
| `index.html` | 19 lines | Entry point, loads CDN deps |

## Architecture

### State lives entirely in `App()`

All React state is in the root `App()` component and passed down as props. There is no context, no store. Key state groups:

- **Routing**: `route = { page, cat?, fileId? }` — drives which page renders
- **Vault**: `files[]` — array of file objects stored as base64 data URLs
- **Playback**: `currentTrackId`, `isPlaying`, `position`, `duration`, `playContext`, `repeatMode`, `manualQueue`, `activeClip`
- **Social**: `likedIds` (Set), `playCounts`, `bookmarks`, `clipStore`
- **UI**: `selectedIds`, `uploadProgress`, `waveforms`

### Data model

Every uploaded file becomes a plain object:
```js
{ id, name, artist, album, track, year, genre,
  thumbnail,  // PNG data URL — CRT-processed (128px, phosphor palette)
  coverArt,   // PNG data URL — raw APIC frame from ID3
  fileData,   // full base64 data URL
  fileSize, fileType, fileName, uploadedAt, downloads }
```

`category === artist` — artist name is the primary navigation key.

### localStorage keys

| Key | Content |
|---|---|
| `metalsys_vault_v2` | `file[]` — entire vault |
| `metalsys_cats_v2` | `{ name, icon }[]` — custom categories |
| `metalsys_likes_v1` | `string[]` — liked file IDs |
| `metalsys_playcounts_v1` | `{ [fileId]: number }` |
| `metalsys_bookmarks_v1` | `{ [fileId]: { id, name, time }[] }` |
| `metalsys_clips_v1` | `{ [fileId]: { id, name, start, end }[] }` |
| `metalsys_log_v2` | activity log (max 200 entries) |

### Playback pipeline

```
playScope(ctx, shuffle)
  → clears manualQueue → sets playContext
  → startTrack(file)
      → audio.src = file.fileData (or blob URL for local files)
      → increments playCounts
      → async: decodes waveform via OfflineAudioContext → waveforms cache
      → async: reads ID3 tags for cover art → id3Cache

audio.ended → onEnded → playNext() using effectiveQueue
effectiveQueue = manualQueue ?? musicQueue   (musicQueue derived from playContext)
```

### ID3 parsing

`_parseID3Buffer(ArrayBuffer)` is a hand-rolled ID3v2 parser that extracts title, artist, album, year, genre, track, and cover art (APIC frame). It runs in the browser — no external library.

### CRT visual pipeline

`crt.css` drives all effects. Intensities are CSS custom properties (`--scanline-opacity`, `--chroma-x`, `--bloom`, etc.) updated at runtime by the TweaksPanel. The phosphor preset is a class on `.crt-screen` (`phosphor-metal`, `phosphor-synthwave`, etc.).

The `TWEAK_DEFAULTS` block in `app.jsx` (between `/*EDITMODE-BEGIN*/` and `/*EDITMODE-END*/`) is the live-editable config for the TweaksPanel protocol.

## Limits

- `SIZE_CAP = 8 MB` per file
- `VAULT_CAP = 25 MB` total vault

## After making changes

Per project convention (`Documentación/`):
1. Add an entry to `Documentación/CHANGELOG.md` with today's date
2. Update `Documentación/FUNCTIONS.md` if a function was added or changed
3. Update `Documentación/FEATURES.md` and `README.md` for new features
4. Update `Documentación/CONTEXT.md` if overall project state changes
# graphify
- **graphify** (`.claude/skills/graphify/SKILL.md`) - any input to knowledge graph. Trigger: `/graphify`
When the user types `/graphify`, invoke the Skill tool with `skill: "graphify"` before doing anything else.
