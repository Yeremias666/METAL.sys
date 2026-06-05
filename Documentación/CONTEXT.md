# CONTEXT.md — Archivo de contexto para nueva sesión

> Lee este archivo al inicio de cada nueva sesión para continuar exactamente donde se dejó.
> Actualízalo al terminar cada sesión con cambios importantes.

---

## ¿Qué es este proyecto?

**METAL.SYS** es un reproductor/bóveda web personal de archivos multimedia con estética retro CRT. Funciona íntegramente en el navegador sin ningún backend — todos los datos se almacenan en `localStorage` como data URLs base64.

Ubicación: `c:\Users\ygmullor\Documents\METAL.sys\`

---

## Stack y restricciones técnicas

- **React 18** via CDN (UMD), no hay npm ni node_modules
- **Babel Standalone** transpila JSX en el navegador en tiempo de ejecución
- **Sin bundler**: los archivos `.jsx` se cargan con `<script type="text/babel">`
- **Sin backend**: cero servidor, cero login, cero cloud
- **Persistencia**: `localStorage` + IndexedDB (solo para handles de File System Access API)
- **Dependencias CDN**: React 18.3.1, ReactDOM 18.3.1, Babel 7.29.0, JSZip 3.10.1, marked 12.0.0

Para servir localmente:
```bash
python -m http.server 8000
# o: npx http-server -c-1 . -p 8000
```

---

## Archivos fuente

| Archivo | Tamaño aprox. | Rol |
|---|---|---|
| `index.html` | 1 KB | Entrada, carga CDN |
| `app.jsx` | 191 KB / 3715 líneas | Toda la lógica y UI |
| `crt.css` | ~85 KB | Estilos y efectos CRT |
| `tweaks-panel.jsx` | 26 KB | Panel de tweaks visual |

---

## Constantes y claves de localStorage

```js
SIZE_CAP  = 8 MB   // por archivo
VAULT_CAP = 25 MB  // total

STORAGE_KEY = 'metalsys_vault_v2'      // archivos del vault
CATS_KEY    = 'metalsys_cats_v2'       // categorías personalizadas
LOG_KEY     = 'metalsys_log_v2'        // actividad (máx 200)
LIKES_KEY   = 'metalsys_likes_v1'      // IDs de canciones con me gusta
COUNTS_KEY  = 'metalsys_playcounts_v1' // { fileId: count }
BMRK_KEY    = 'metalsys_bookmarks_v1'  // { fileId: [{id, name, time}] }
CLIPS_KEY   = 'metalsys_clips_v1'      // { fileId: [{id, name, start, end}] }
```

---

## Estado global en App()

| Estado | Tipo | Descripción |
|---|---|---|
| `route` | `{ page, cat?, fileId? }` | Página activa |
| `files` | `file[]` | Vault completo |
| `customCats` | `{ name, icon }[]` | Categorías manuales |
| `log` | `entry[]` | Actividad reciente |
| `selectedIds` | `Set<string>` | Multi-select |
| `bulkBusy` | `boolean` | ZIP generándose |
| `uploadProgress` | `object\|null` | Subida en curso |
| `currentTrackId` | `string\|null` | Pista en reproducción |
| `isPlaying` | `boolean` | |
| `position` | `number` | Segundos |
| `duration` | `number` | Segundos |
| `volume` | `number` | 0–1 |
| `playContext` | `playContext` | Contexto de cola |
| `repeatMode` | `'off'\|'all'\|'one'` | |
| `id3Cache` | `{ [fileId]: tags }` | Cache tags ID3 |
| `likedIds` | `Set<string>` | Me gusta |
| `playCounts` | `{ [fileId]: number }` | Reproducciones por canción |
| `bookmarks` | `{ [fileId]: Bookmark[] }` | Marcadores por canción |
| `clipStore` | `{ [fileId]: Clip[] }` | Clips por canción |
| `manualQueue` | `file[]\|null` | Cola reordenada manualmente (null = auto) |
| `activeClip` | `{id, start, end}\|null` | Clip en bucle activo |
| `waveforms` | `{ [fileId]: Float32Array }` | Datos de forma de onda |
| `showPlayerMenu` | `boolean` | Menú ··· del reproductor |
| `showBookmarkModal` | `boolean` | |
| `showClipModal` | `boolean` | |

Rutas disponibles:
- `{ page: 'INICIO' }` — Home
- `{ page: 'TODO' }` — Todos los artistas
- `{ page: 'MESGUSTA' }` — Canciones con me gusta
- `{ page: 'STATS' }` — Estadísticas
- `{ page: 'LOCAL' }` — Importar carpeta local
- `{ page: 'SUBIR' }` — Subir archivo
- `{ page: 'UPLOAD_PROGRESS' }` — Progreso de subida
- `{ page: 'CAT', cat: artistName }` — Página de artista
- `{ page: 'DETAIL', fileId: id }` — Detalle de archivo

---

## Todos los componentes

### Layout
| Componente | Descripción |
|---|---|
| `App` | Raíz — estado global, audio, routing |
| `StatusBar` | Barra superior con reloj |
| `Banner` | Cabecera con logo ASCII |
| `Nav` | Navegación: INICIO, SUBIR, TODO, ♥ GUSTA, STATS, LOCAL + artistas |
| `Marquee` | Ticker de texto |
| `Footer` | Badges de pie de página |

### Páginas
| Componente | Descripción |
|---|---|
| `HomePage` | Grid de artistas, recientes, stats |
| `TodoPage` | Todos los artistas + reproducir todo |
| `MeGustaPage` | Canciones con me gusta + reproducir |
| `StatsPage` | Timeline, top artistas, métricas |
| `LocalPage` | Importar carpeta local (File System Access API) |
| `UploadPage` | Formulario subida con drag&drop, auto-ID3 |
| `UploadProgressPage` | Barra de progreso de subida |
| `CategoryPage` | Artista: álbumes, búsqueda, filtros |
| `DetailPage` | Detalle: audio, imagen, vídeo, PDF, MD, texto, ZIP, specs, marcadores, clips |

### Sidebar izquierdo
| Componente | Descripción |
|---|---|
| `LibraryTree` | Árbol colapsable artistas > discos > canciones |

### Sidebar derecho
| Componente | Descripción |
|---|---|
| `PlayQueue` | Cola de reproducción con drag-to-reorder |
| `TopSongs` | Top 10 canciones más escuchadas |
| `NowStreaming` | Última subida (estilo cassette) |
| `DownloadCounter` | Contador lifetime de descargas |
| `RecentActivity` | Últimas 5 acciones del log |

### Reproductor y multimedia
| Componente | Descripción |
|---|---|
| `MusicPlayer` | Barra persistente bottom: VU, waveform, ♡, ··· |
| `AudioInfo` | Radio widget con VU en DetailPage |
| `ImageView`, `VideoView`, `PdfView` | Visualizadores |
| `MarkdownPreview`, `TextPreview`, `ZipTree` | Visualizadores de texto |
| `PlayerMenuDropdown` | Menú ··· con opciones |
| `BookmarkModal` | Crear marcador |
| `ClipModal` | Crear clip |
| `LikeButton` | Botón ♡/♥ |

### Misc
| Componente | Descripción |
|---|---|
| `FileCard` | Tarjeta grid de archivo |
| `TrackListTable` | Tabla de pistas sortable |
| `FileListTable` | Tabla genérica de archivos |
| `StatsPanel` | Panel de uso del vault |
| `MultiSelectBar` | Barra flotante de selección múltiple |
| `CreateCategoryModal` | Crear categoría con icono |
| `Terminal` | Árbol `ls --tree` estilo consola |
| `IconGlyph`, `CategoryGlyph`, `NavGlyph` | Iconos SVG inline |

---

## Funciones clave en App()

### Reproducción
| Función | Descripción |
|---|---|
| `startTrack(file, ctx?)` | Carga pista, incrementa playCounts, decodifica waveform |
| `playScope(ctx, shuffle)` | Inicia contexto, limpia manualQueue |
| `playNext(wrap)` | Usa `effectiveQueue` (manualQueue \|\| musicQueue) |
| `playPrev()` | Usa `effectiveQueue` |
| `playTrack(file)` | Toggle play/pause desde DetailPage |
| `playPause()` | Toggle global |
| `seek(sec)` | Seek en el audio |
| `stopMusic()` | Para y limpia, resetea activeClip |
| `toggleShuffle()` | Limpia manualQueue, alterna shuffle |
| `toggleRepeat()` | Cicla off → all → one |
| `effectiveQueue` | `manualQueue || musicQueue` — cola efectiva |

### Me Gusta / Marcadores / Clips
| Función | Descripción |
|---|---|
| `toggleLike(fileId)` | Alterna en `likedIds` Set |
| `addBookmark(fileId, bm)` | Añade a `bookmarks[fileId]` |
| `deleteBookmark(fileId, bmId)` | Borra de `bookmarks[fileId]` |
| `seekToBookmark(time)` | Llama a `seek(time)` |
| `addClip(fileId, clip)` | Añade a `clipStore[fileId]` |
| `deleteClip(fileId, clipId)` | Borra, desactiva si activo |
| `playClip(clip)` | Activa `activeClip`, hace seek y play |
| `stopClip()` | Limpia `activeClip` |

### Subida
| Función | Descripción |
|---|---|
| `startUpload(meta)` | FileReader + progreso → crea entry |
| `importLocalFile(file, cat)` | Igual pero desde File System Access API |

---

## Paletas fósforo (CSS)

| Clase | Color principal |
|---|---|
| `phosphor-metal` (default) | Rojo sangre `#d61f1f` |
| `phosphor-synthwave` | Rosa neón `#ff2bd6` |
| `phosphor-green` | Verde tóxico `#39ff14` |
| `phosphor-amber` | Ámbar `#ffb347` |
| `phosphor-mono` | Azul-blanco `#d8e0ff` |

---

## Historia del proyecto (sesiones)

### Sesión 1 — Base inicial
React CDN + Babel, localStorage, estética CRT, subida archivos, visualizadores, multi-select.

### Sesión 2 — Música y artistas
ID3v2 parser nativo, artista = categoría, página de artista con álbumes, buscador.

### Sesión 3 — Sistema de reproducción
MusicPlayer barra, playContext, shuffle/repeat, TodoPage, botones ▶ en tarjetas.

### 2026-06-02 — Documentación + 11 mejoras
1. Árbol de biblioteca (sidebar izquierdo)
2. Cola de reproducción con drag-to-reorder (sidebar derecho)
3. Top 10 canciones más escuchadas
4. Botón Me Gusta + página ME GUSTA
5. Subpágina de estadísticas con timeline
6. Menú ··· en el reproductor
7. Marcadores (crear desde ···, tab en DetailPage)
8. Clips con bucle (crear desde ···, tab en DetailPage)
9. Importar carpeta local (File System Access API)
10. Waveform en barra de progreso (OfflineAudioContext)
11. Destello CRT sincronizado con volumen de audio

---

## Estado actual (2026-06-05)

Todo lo descrito está implementado. No hay funcionalidades en progreso.

### Nuevas claves de localStorage (sesión 2026-06-05)
| Clave | Contenido |
|---|---|
| `metalsys_artist_meta_v1` | `{ [artistName]: { image: dataURL, description: string } }` |

### Componentes nuevos/renombrados
- `PlayQueueWithNowPlaying` — fusiona NowStreaming + PlayQueue (sidebar derecho)
- `PlaysCounter` — contador de escuchas totales (reemplaza DownloadCounter)
- `RecentActivity` — rediseñado como log tail -f con timestamps y eventos de música

**Sugerencias futuras:**
- Historial de reproducción persistente
- Soporte offline con Service Worker
- Exportar/importar bóveda completa como ZIP

---

## Reglas para futuras sesiones

1. **Leer este archivo** al inicio.
2. Leer `CHANGELOG.md` para el estado exacto del último cambio.
3. Antes de tocar reproducción → leer `PLAYBACK.md`.
4. Antes de tocar subida → leer `UPLOAD.md`.
5. Al terminar → actualizar CHANGELOG.md, COMMANDS.md y este CONTEXT.md.
6. Nueva función → documentar en `FUNCTIONS.md`.
7. Nueva funcionalidad → añadir en `FEATURES.md` y `README.md`.
