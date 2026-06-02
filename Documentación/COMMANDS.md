# COMMANDS.md — Registro de acciones por sesión

Documenta qué herramientas y cambios se hicieron en cada sesión.
Usa la plantilla al final para nuevas entradas.

---

## 2026-06-02 — Sesión: 11 mejoras + documentación

**Autor:** Claude (claude-sonnet-4-6)  
**Herramientas usadas:** Read, Edit, Write, Grep, PowerShell

### Archivos modificados
- `app.jsx` — +~730 líneas (3715 total / 191 KB)
- `crt.css` — +~280 líneas (nuevas clases para todos los componentes)
- `Documentación/*.md` — creados/actualizados todos los archivos

### Cambios en app.jsx
1. Añadidas 5 constantes de clave localStorage (`LIKES_KEY`, `COUNTS_KEY`, `BMRK_KEY`, `CLIPS_KEY`)
2. Añadidas 10 funciones de storage (`loadLikes/saveLikes`, etc.)
3. Añadidas funciones helper `getIDB/idbSet/idbGet`, `fmtTimeSec/parseTimeSec`
4. Añadidos nuevos componentes antes de `App()`:
   - `LibraryTree` — árbol de biblioteca colapsable
   - `PlayQueue` — cola con drag-to-reorder
   - `TopSongs` — top 10 canciones
   - `LikeButton` — botón ♡/♥
   - `MeGustaPage` — página de canciones favoritas
   - `StatsPage` — página de estadísticas
   - `PlayerMenuDropdown` — menú ··· del reproductor
   - `BookmarkModal` — modal para crear marcadores
   - `ClipModal` — modal para crear clips
   - `LocalPage` — importación desde carpeta local
5. En `App()`:
   - Añadidos 12 nuevos estados (likedIds, playCounts, bookmarks, clipStore, manualQueue, activeClip, waveforms, showPlayerMenu, showBookmarkModal, showClipModal, activeClipRef, audioSyncRef)
   - Añadidos efectos de persistencia para nuevos estados
   - Añadido efecto CRT sync con RAF + AnalyserNode
   - Actualizado `onTime` handler para detectar fin de clip y hacer loop
   - Actualizado `startTrack` para: incrementar playCounts, limpiar activeClip, decodificar waveform async con OfflineAudioContext
   - Añadido `effectiveQueue = manualQueue || musicQueue`
   - Añadidas funciones: toggleLike, addBookmark, deleteBookmark, seekToBookmark, addClip, deleteClip, playClip, stopClip, importLocalFile
   - Actualizados `playNext/playPrev` para usar `effectiveQueue`
   - Actualizado `stopMusic` para limpiar activeClip
   - `playScope` ahora limpia manualQueue
   - Layout del grid cambiado a 3 columnas con LibraryTree, main, sidebar derecho
   - Añadidas rutas: MESGUSTA, STATS, LOCAL
   - Añadidos botones MESGUSTA/STATS/LOCAL en Nav
6. `MusicPlayer` — nuevas props: onOpenMenu, showMenu, onCloseMenu, onCreateBookmark, onCreateClip, waveform, likedIds, onToggleLike; añadidos SVG waveform, div mp-menu-wrap, LikeButton
7. `DetailPage` — nuevas props para bookmarks, clips, like; añadidas pestañas MARCADORES y CLIPS
8. Añadidos modales `BookmarkModal`, `ClipModal` en render de App
9. `.crt-audio-pulse` div añadido al DOM en render

### Cambios en crt.css
- `.grid` → 3 columnas con media queries (1300px/1050px/900px)
- Añadidos ~280 líneas de CSS para: lib-tree, play-queue, top-songs, like-btn, stats-page, player-menu, bookmarks/clips tabs, waveform, audio-pulse, local-import
- `music-player` grid-template-columns actualizado a 7 columnas

---

## 2026-06-02 — Sesión: Reconstrucción de documentación

**Autor:** Claude (claude-sonnet-4-6)  
**Herramientas usadas:** Read, Write, PowerShell, Grep

### Archivos creados/actualizados
- `Documentación/CONTEXT.md` — nuevo, contexto para nueva sesión
- `Documentación/CHANGELOG.md` — reescrito desde cero
- `Documentación/ARCHITECTURE.md` — reescrito
- `Documentación/FUNCTIONS.md` — nuevo
- `Documentación/FEATURES.md` — reescrito
- `Documentación/PLAYBACK.md` — reescrito
- `Documentación/UPLOAD.md` — reescrito
- `Documentación/DEVELOPMENT.md` — reescrito
- `Documentación/COMMANDS.md` — reescrito (este archivo)
- `README.md` — reescrito con descripción completa

---

## Sesiones anteriores — (sin herramientas conocidas)

Las sesiones anteriores usaron herramientas de otro asistente (GitHub Copilot). No se dispone del registro exacto. Los cambios se reconstruyeron leyendo el código directamente.

---

## Plantilla para nuevas entradas

```
## YYYY-MM-DD — Sesión: [descripción breve]

**Autor:** [nombre o Claude model]
**Herramientas usadas:** Read, Edit, Write, Grep, PowerShell, ...

### Archivos modificados
- `archivo.jsx` — descripción del cambio
- `crt.css` — descripción del cambio

### Cambios principales
1. ...
2. ...

### Notas de prueba
- Verificar: [cómo comprobar manualmente que funciona]
```
