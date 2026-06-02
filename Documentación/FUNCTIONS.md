# FUNCTIONS.md — Referencia de funciones

Todas las funciones de `app.jsx` documentadas. Actualiza cuando añadas o modifiques funciones.

---

## Funciones de módulo (fuera de componentes)

### Storage

| Función | Firma | Descripción |
|---|---|---|
| `loadVault()` | `→ file[]` | Lee archivos de localStorage |
| `saveVault(files)` | `file[] → void` | Guarda archivos en localStorage |
| `loadCats()` | `→ {name,icon}[]` | Lee categorías personalizadas |
| `saveCats(cats)` | `→ void` | Guarda categorías |
| `loadLog()` | `→ entry[]` | Lee log de actividad |
| `saveLog(log)` | `→ void` | Guarda log (máx 200) |
| `loadLikes()` | `→ Set<string>` | Lee IDs con me gusta |
| `saveLikes(set)` | `→ void` | Guarda me gustas |
| `loadCounts()` | `→ {[id]:number}` | Lee play counts |
| `saveCounts(obj)` | `→ void` | Guarda play counts |
| `loadBookmarks()` | `→ {[id]:Bookmark[]}` | Lee marcadores |
| `saveBookmarks(obj)` | `→ void` | Guarda marcadores |
| `loadClipStore()` | `→ {[id]:Clip[]}` | Lee clips |
| `saveClipStore(obj)` | `→ void` | Guarda clips |

### IndexedDB (File System Access)

| Función | Firma | Descripción |
|---|---|---|
| `getIDB()` | `→ Promise<IDBDatabase>` | Abre/crea base `metalsys_fs` con objectStore `handles` |
| `idbSet(key, val)` | `→ Promise<void>` | Guarda un valor en el store |
| `idbGet(key)` | `→ Promise<any>` | Lee un valor del store |

### Formateo

| Función | Firma | Descripción |
|---|---|---|
| `fmtBytes(n)` | `number → string` | "1.23 MB", "456 KB", "12 B" |
| `fmtDate(ts)` | `number → string` | "06.02.26 / 10:14" |
| `fmtLongDate(ts)` | `number → string` | "02 JUN 2026 · 10:14:01" |
| `fmtTimeSec(sec)` | `number → string` | "1:23", "0:45" |
| `parseTimeSec(str)` | `string → number` | "1:23" → 83 |

### Detección de tipo

| Función | Firma | Descripción |
|---|---|---|
| `isAudioFile(f)` | `file → boolean` | mp3/wav/ogg/flac/m4a/aac/opus/aiff/wma |
| `isVideoFile(f)` | `file → boolean` | mp4/mov/avi/mkv/webm/flv/m4v/ogv |
| `isImageFile(f)` | `file → boolean` | jpg/png/gif/bmp/webp/svg/ico |
| `isPdfFile(f)` | `file → boolean` | .pdf o application/pdf |
| `isMarkdownFile(f)` | `file → boolean` | .md / .markdown |
| `isTextFile(f)` | `file → boolean` | txt/md/log/csv/json/xml/html/css/js/... |
| `isZipFile(f)` | `file → boolean` | .zip o MIME zip |
| `extOf(f)` | `file → string` | extensión en minúsculas |
| `autoCategory(name, type)` | `→ string` | Categoría automática por extensión |

### Procesamiento de imagen/audio

| Función | Firma | Descripción |
|---|---|---|
| `processThumb(file)` | `File → Promise<dataURL>` | Canvas: 128px + paleta fósforo rojo CRT |
| `readAsDataURL(file)` | `File → Promise<dataURL>` | Promesa sobre FileReader |
| `loadImage(src)` | `string → Promise<HTMLImageElement>` | Promesa sobre new Image() |
| `downloadFile(f)` | `file → void` | Crea `<a>` y trigger click |
| `decodeTextFromDataURL(url, max)` | `→ {text, truncated, totalBytes}` | Decodifica texto desde data URL |

### ID3

| Función | Firma | Descripción |
|---|---|---|
| `_parseID3Buffer(buf)` | `ArrayBuffer → Promise<tags>` | Parser ID3v2 — tags: title, artist, albumArtist, album, year, genre, track, coverArt |
| `readID3(dataURL)` | `string → Promise<tags>` | fetch(dataURL) → arrayBuffer → `_parseID3Buffer` |

### Búsqueda y normalización

| Función | Firma | Descripción |
|---|---|---|
| `normStr(s)` | `string → string` | lowercase + strip accents (NFD) |
| `filterAndSort(files, opts)` | `→ file[]` | Filtra por query/ext/fecha, ordena por campo |

### VU Bars

| Función | Firma | Descripción |
|---|---|---|
| `readVuBars(node, data, n)` | `→ number[]` | n barras desde AnalyserNode con mapping logarítmico |
| `useVuBars(analyser, isPlaying, n)` | Hook `→ number[]` | RAF loop para actualizar barras VU |

---

## Funciones dentro de App()

### Audio / Reproductor

| Función | Descripción |
|---|---|
| `ensureAnalyser()` | Crea una sola vez el AnalyserNode (fftSize 256, smoothing 0.55) |
| `startTrack(file, ctx?)` | Carga src, actualiza currentTrackId, incrementa playCounts, decodifica waveform async |
| `playScope(ctx, shuffle)` | Selecciona contexto, limpia manualQueue, inicia reproducción |
| `playNext(wrap)` | Avanza en `effectiveQueue` (manualQueue \|\| musicQueue) |
| `playPrev()` | Retrocede en `effectiveQueue` |
| `playTrack(file)` | Toggle play/pause para una pista específica (desde DetailPage) |
| `playPause()` | Toggle global play/pause |
| `seek(sec)` | `audio.currentTime = sec` + actualiza state |
| `stopMusic()` | Para audio, limpia currentTrackId, resetea activeClip |
| `toggleShuffle()` | Limpia manualQueue, alterna `playContext.shuffle` |
| `toggleRepeat()` | Cicla `repeatMode`: off → all → one → off |
| `getQueueForContext(ctx)` | Filtra `files` de audio según tipo de contexto |
| `requestID3(file)` | Lee/cachea tags ID3 en `id3Cache` |

### Me Gusta / Marcadores / Clips

| Función | Descripción |
|---|---|
| `toggleLike(fileId)` | Añade/quita de `likedIds` |
| `addBookmark(fileId, bm)` | Añade marcador `{id, name, time}` a `bookmarks[fileId]` |
| `deleteBookmark(fileId, bmId)` | Elimina marcador por ID |
| `seekToBookmark(time)` | Llama `seek(time)` |
| `addClip(fileId, clip)` | Añade clip `{id, name, start, end}` a `clipStore[fileId]` |
| `deleteClip(fileId, clipId)` | Elimina clip, desactiva si era el activo |
| `playClip(clip)` | Activa `activeClip`, seek a `clip.start`, play |
| `stopClip()` | Limpia `activeClip` |

### Subida

| Función | Descripción |
|---|---|
| `startUpload(meta)` | FileReader con onprogress → `uploadProgress` state → crea entry → navega a artista |
| `importLocalFile(file, cat)` | Igual que startUpload pero para File objects del File System Access API |
| `addToLog(entry)` | Añade al log de actividad |

### CRUD archivos

| Función | Descripción |
|---|---|
| `handleDownload(f)` | Descarga + incrementa downloads counter + log |
| `handleDelete(f)` | Elimina del vault + log + para si era la pista activa |
| `handleUpdate(f)` | Actualiza metadatos de un archivo |
| `openFile(id)` | Navega a `{ page: 'DETAIL', fileId: id }` |

### Multi-select

| Función | Descripción |
|---|---|
| `toggleSel(id)` | Alterna selección de un archivo |
| `clearSel()` | Limpia todos los seleccionados |
| `bulkDownload()` | Genera ZIP con JSZip, agrupa por categoría |
| `bulkDelete()` | Borra todos los seleccionados con confirmación |

### Categorías

| Función | Descripción |
|---|---|
| `handleCreateCat()` | Abre modal `CreateCategoryModal` |
| `submitCreateCat({name, icon})` | Añade categoría, navega a ella |
