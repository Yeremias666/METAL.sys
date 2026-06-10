# Community 2

> 42 nodes · cohesion 0.08

## Key Concepts

- **app.jsx — Main App Logic and UI** (22 connections) — `app.jsx`
- **index.html — App Entry Point** (8 connections) — `index.html`
- **functions/api/files.js — R2 File Listing with ID3 Metadata** (7 connections) — `functions/api/files.js`
- **Cloudflare R2 Bucket (metalsys) — Audio File Storage** (6 connections) — `functions/api/audio.js`
- **App() — Root React Component with all state** (5 connections) — `app.jsx`
- **functions/api/audio.js — Presigned R2 Audio URL** (5 connections) — `functions/api/audio.js`
- **README.md — Project Documentation** (5 connections) — `README.md`
- **tweaks-panel.jsx — Reusable Tweaks Panel** (5 connections) — `tweaks-panel.jsx`
- **parseID3 — Server-side ID3v2 Parser (Workers)** (4 connections) — `functions/api/files.js`
- **localStorage Persistence Layer** (4 connections) — `app.jsx`
- **Playback Pipeline (playScope → startTrack → audio.ended)** (4 connections) — `app.jsx`
- **functions/api/reindex-meta.js — R2 Metadata Reindexer** (4 connections) — `functions/api/reindex-meta.js`
- **CRT Visual Pipeline (AnalyserNode → RMS → CSS vars)** (3 connections) — `app.jsx`
- **_parseID3Buffer — Browser-side ID3v2 Parser** (3 connections) — `app.jsx`
- **MusicPlayer — Persistent Bottom Playback Bar** (3 connections) — `app.jsx`
- **Upload Pipeline (handleFile → _parseID3Buffer → startUpload)** (3 connections) — `app.jsx`
- **File/Vault Data Model** (3 connections) — `app.jsx`
- **crt.css — CRT Visual Effects Styles** (3 connections) — `crt.css`
- **Documentación/ARCHITECTURE.md — Architecture Documentation** (3 connections) — `Documentación/ARCHITECTURE.md`
- **functions/api/reindex-covers.js — R2 Cover Reindexer** (3 connections) — `functions/api/reindex-covers.js`
- **TweaksPanel — Floating Draggable Panel Component** (3 connections) — `tweaks-panel.jsx`
- **presignedGet — AWS SigV4 Presigned URL Generator** (2 connections) — `functions/api/audio.js`
- **downloadFile — R2 presigned URL or data URL download** (2 connections) — `app.jsx`
- **IndexedDB Persistence Layer (folder handles + cover cache)** (2 connections) — `app.jsx`
- **processThumb — CRT Phosphor Thumbnail Generator** (2 connections) — `app.jsx`
- *... and 17 more nodes in this community*

## Relationships

- [[Community 14]] (2 shared connections)

## Source Files

- `.claude/settings.json`
- `Documentación/ARCHITECTURE.md`
- `Documentación/CHANGELOG.md`
- `README.md`
- `app.jsx`
- `crt.css`
- `favicon.svg`
- `functions/api/audio.js`
- `functions/api/files.js`
- `functions/api/reindex-covers.js`
- `functions/api/reindex-meta.js`
- `index.html`
- `tweaks-panel.jsx`

## Audit Trail

- EXTRACTED: 113 (83%)
- INFERRED: 23 (17%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [[index]] to navigate.*