# Graph Report - C:\Users\Usuario\Documents\METAL.sys  (2026-06-10)

## Corpus Check
- 39 files · ~68,543 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 404 nodes · 549 edges · 33 communities (22 shown, 11 thin omitted)
- Extraction: 93% EXTRACTED · 7% INFERRED · 0% AMBIGUOUS · INFERRED: 39 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]

## God Nodes (most connected - your core abstractions)
1. `app.jsx — Main App Logic and UI` - 22 edges
2. `fmtBytes()` - 17 edges
3. `DetailPage()` - 11 edges
4. `Graphify Skill (SKILL.md)` - 10 edges
5. `Functions Reference (FUNCTIONS.md)` - 9 edges
6. `Emil Design Engineering Skill (SKILL.md)` - 9 edges
7. `normStr()` - 8 edges
8. `index.html — App Entry Point` - 8 edges
9. `Graphify Full Pipeline` - 8 edges
10. `METAL.SYS Project Context` - 8 edges

## Surprising Connections (you probably didn't know these)
- None detected - all connections are within the same source files.

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **ID3v2 Parsing Ecosystem (browser + server variants)** — app_jsx_id3_parser, api_files_id3_parser, functions_api_reindex_meta, functions_api_reindex_covers [INFERRED 0.95]
- **AWS Signature V4 Implementation (audio, files, reindex-meta, reindex-covers)** — functions_api_audio, functions_api_files, functions_api_reindex_meta, functions_api_reindex_covers [EXTRACTED 1.00]
- **Cloudflare Pages Functions Backend API** — functions_api_audio, functions_api_files, functions_api_reindex_meta, functions_api_reindex_covers, functions_api_userdata, functions_api_auth_login, functions_api_auth_logout, functions_api_auth_profile, functions_api_auth_register [EXTRACTED 1.00]
- **Authentication System (register/login/logout/profile + KV sessions)** — functions_api_auth_login, functions_api_auth_logout, functions_api_auth_profile, functions_api_auth_register, auth_pbkdf2_scheme, cloudflare_kv_store [EXTRACTED 1.00]
- **No-build Browser Frontend Stack** — index_html, react_18_cdn, babel_standalone_cdn, app_jsx, tweaks_panel_jsx, crt_css [EXTRACTED 1.00]
- **R2 Storage Layer (audio + covers + meta index)** — cloudflare_r2_bucket, r2_meta_index, r2_covers_store, functions_api_audio, functions_api_files [EXTRACTED 1.00]
- **CRT Effects System (CSS + runtime tweaks + visual pipeline)** — crt_css, app_jsx_tweak_defaults, tweaks_panel_jsx_tweakspanel, app_jsx_crt_visual_pipeline, tweaks_panel_jsx_usetweak [EXTRACTED 1.00]
- **Local Persistence Layer (localStorage + IndexedDB)** — app_jsx_localstorage_layer, app_jsx_indexeddb_layer, app_jsx_vault_data_model [EXTRACTED 1.00]
- **Graphify Pipeline Steps 1-9** — skills_graphify_step1_install, skills_graphify_step2_detect, skills_graphify_step3_extract, skills_graphify_step4_build, skills_graphify_step5_label, skills_graphify_step6_outputs, skills_graphify_step9_cleanup [EXTRACTED 1.00]
- **METAL.SYS Playback Subsystem** — documentacion_playback_play_context, documentacion_playback_effective_queue, documentacion_playback_clip_loop, documentacion_playback_crt_sync, documentacion_playback_waveform_pipeline, documentacion_functions_start_track, documentacion_functions_play_scope [INFERRED 0.95]
- **R2 Backend Admin Scripts** — scripts_reindex_covers_covers, scripts_reindex_meta_meta, scripts_check_covers_check [EXTRACTED 1.00]

## Communities (33 total, 11 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.02
Nodes (11): ASCII_LOGO, _catIconRegistry, DEFAULT_CATS, ICON_GROUPS, ICON_LIBRARY, LOG_LABELS, MARQUEE_LINES, PERF_DEFAULTS (+3 more)

### Community 1 - "Community 1"
Cohesion: 0.05
Nodes (46): graphify add <url> - Ingest URL, Add Watch Reference (add-watch.md), --watch Mode (Auto-Rebuild on Changes), --mcp MCP Server for Agent Access, --neo4j Export (Cypher/Neo4j Push), --svg Export, --wiki Export (Agent-Crawlable Wiki), Confidence Rubric (EXTRACTED/INFERRED/AMBIGUOUS) (+38 more)

### Community 2 - "Community 2"
Cohesion: 0.08
Nodes (42): presignedGet — AWS SigV4 Presigned URL Generator, parseID3 — Server-side ID3v2 Parser (Workers), listAllObjects — R2 S3 ListObjectsV2 (paginated), app.jsx — Main App Logic and UI, App() — Root React Component with all state, ArtistCard — 3D Hover Effect Artist Grid Card, CRT Visual Pipeline (AnalyserNode → RMS → CSS vars), downloadFile — R2 presigned URL or data URL download (+34 more)

### Community 3 - "Community 3"
Cohesion: 0.07
Nodes (42): App() Root Component - Global State, Artist Meta localStorage Key (artist_meta_v1), localStorage Keys and Persistence, METAL.SYS Project Context, Phosphor CRT Palettes (5 Presets), Playback State (currentTrackId, isPlaying, position), Route Object { page, cat?, fileId? }, Vault - files[] Array in localStorage (+34 more)

### Community 4 - "Community 4"
Cohesion: 0.22
Nodes (15): hmac(), hmacHex(), jsonResponse(), listAllObjects(), makeSignedHeaders(), onRequest(), parseID3(), presignedCoverUrl() (+7 more)

### Community 6 - "Community 6"
Cohesion: 0.27
Nodes (11): hmac(), hmacHex(), jsonRes(), listAllAudio(), makeGetHeaders(), makePutHeaders(), onRequest(), sha256Hex() (+3 more)

### Community 7 - "Community 7"
Cohesion: 0.13
Nodes (15): buildTimeline(), FileCard(), fmtBytes(), fmtLongDate(), ImageView(), MeGustaPage(), MultiSelectBar(), PdfView() (+7 more)

### Community 8 - "Community 8"
Cohesion: 0.30
Nodes (11): hmac(), hmacHex(), jsonRes(), listAllAudio(), makeGetHeaders(), makePutHeaders(), onRequest(), sha256Hex() (+3 more)

### Community 9 - "Community 9"
Cohesion: 0.36
Nodes (8): hmac(), hmacHex(), jsonResponse(), onRequest(), presignedGet(), sha256Hex(), te, toBytes()

### Community 10 - "Community 10"
Cohesion: 0.29
Nodes (10): DetailPage(), extOf(), isAudioFile(), isImageFile(), isMarkdownFile(), isPdfFile(), isTextFile(), isVideoFile() (+2 more)

### Community 11 - "Community 11"
Cohesion: 0.31
Nodes (10): Animation Accessibility (prefers-reduced-motion), Animation Decision Framework, clip-path for Animation, Gesture and Drag Interactions, CSS Animation Performance Rules, UI Review Format (Before/After Table), Emil Design Engineering Skill (SKILL.md), Sonner Component Principles (+2 more)

### Community 12 - "Community 12"
Cohesion: 0.25
Nodes (8): GET /api/files - Cover Check Endpoint, CHECK-COVERS Script (Browser Console), REINDEX-COVERS Script (R2 Cover Extraction), GET /api/reindex-covers - Cloudflare Pages Function, R2 Storage for Covers (_covers/Artist/Album.jpg), GET /api/reindex-meta - Cloudflare Pages Function, _meta/index.json - ID3 Metadata Index in R2, REINDEX-META Script (ID3 Metadata Index in R2)

### Community 13 - "Community 13"
Cohesion: 0.29
Nodes (7): AllSongsPage(), BandasPage(), CategoryPage(), filterAndSort(), HomePage(), normStr(), PlaylistPage()

### Community 14 - "Community 14"
Cohesion: 0.38
Nodes (7): PBKDF2-SHA256 Authentication (100k iterations, 30-day sessions), Cloudflare KV Store — User Sessions and Data, functions/api/auth/login.js — User Login, functions/api/auth/logout.js — User Logout, functions/api/auth/profile.js — User Profile GET/PUT, functions/api/auth/register.js — User Registration, functions/api/userdata.js — User Data Sync (KV)

### Community 15 - "Community 15"
Cohesion: 0.60
Nodes (4): CORS, hashPassword(), onRequest(), randomHex()

### Community 16 - "Community 16"
Cohesion: 0.60
Nodes (4): CORS, hashPassword(), onRequest(), randomHex()

### Community 17 - "Community 17"
Cohesion: 0.67
Nodes (3): CORS, getSession(), onRequest()

### Community 18 - "Community 18"
Cohesion: 0.50
Nodes (4): AudioInfo(), MusicPlayer(), useVuBars(), VUBackdrop()

### Community 19 - "Community 19"
Cohesion: 0.67
Nodes (3): CORS, getSession(), onRequest()

### Community 20 - "Community 20"
Cohesion: 0.67
Nodes (3): coversGetAll(), coversPut(), getCoversDB()

### Community 21 - "Community 21"
Cohesion: 0.67
Nodes (3): getIDB(), idbGet(), idbSet()

### Community 22 - "Community 22"
Cohesion: 0.67
Nodes (3): loadImage(), processThumb(), readAsDataURL()

## Knowledge Gaps
- **73 isolated node(s):** `PreToolUse`, `TWEAK_DEFAULTS`, `PERF_DEFAULTS`, `DEFAULT_CATS`, `ASCII_LOGO` (+68 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **11 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.