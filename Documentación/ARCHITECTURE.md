# Arquitectura de METAL.SYS

## Stack

- **React 18** (CDN UMD) + **Babel Standalone** (transpilación JSX en el navegador)
- **Sin bundler**, sin npm, sin node_modules
- **Sin backend** — localStorage como única persistencia (+ IndexedDB para handles de File System Access API)
- **Dependencias CDN**: JSZip 3.10.1, marked 12.0.0

## Archivos fuente

```
app.jsx           ← 3715 líneas / 191 KB — toda la lógica y UI
crt.css           ← ~85 KB — estilos y efectos CRT
tweaks-panel.jsx  ← 26 KB — panel de ajustes visual
index.html        ← 1 KB — entrada, carga CDN
```

## Layout de 3 columnas

```
┌─────────────────────────────────────────────────────────────┐
│  StatusBar · Banner · Nav · Marquee                         │
├──────────────┬──────────────────────────┬───────────────────┤
│  LibraryTree │  Página activa           │  PlayQueue        │
│  (220px)     │  (1fr)                   │  TopSongs         │
│              │                          │  NowStreaming     │
│  Árbol       │  INICIO / TODO /         │  DownloadCounter  │
│  colapsable  │  MESGUSTA / STATS /      │  RecentActivity   │
│  sticky      │  LOCAL / SUBIR /         │  (280px)          │
│              │  CAT / DETAIL            │                   │
├──────────────┴──────────────────────────┴───────────────────┤
│  Terminal (árbol ls --tree)                                 │
│  Footer                                                     │
├─────────────────────────────────────────────────────────────┤
│  MusicPlayer (fixed bottom) — cover · info+waveform · ctrl  │
│                             · vol · ♡ · ··· · ✕             │
└─────────────────────────────────────────────────────────────┘
```

## Modelo de datos

### Objeto `file` (en vault)
```js
{
  id: string,          // 'F' + timestamp36 + random
  name: string,        // título (de ID3 o formulario)
  description: string, // "álbum · año · género"
  category: string,    // = artist (nivel 1 navegación)
  artist: string,
  album: string,
  track: string,       // "4/14" o "4"
  year: string,
  genre: string,
  thumbnail: string,   // data URL PNG CRT-processed
  coverArt: string,    // data URL original del APIC frame
  fileName: string,    // nombre original del archivo
  fileSize: number,    // bytes
  fileType: string,    // MIME
  fileData: string,    // data URL completo
  uploadedAt: number,  // timestamp ms
  downloads: number,
}
```

### Objeto `playContext`
```js
{ type: 'all' | 'artist' | 'album', artist?, album?, shuffle: boolean }
```

### Bookmark / Clip
```js
// Bookmark
{ id: string, name: string, time: number }  // time en segundos

// Clip
{ id: string, name: string, start: number, end: number }
```

## Flujo de datos principales

### Subida
```
UploadPage → handleFile → _parseID3Buffer → form prefill
           → submit → startUpload → FileReader.readAsDataURL
           → onprogress → setUploadProgress
           → onload → setFiles + addToLog + navigate
```

### Reproducción
```
playScope(ctx, shuffle) → setManualQueue(null) → setPlayContext
                        → startTrack(firstTrack)
                          → audio.src = file.fileData
                          → setCurrentTrackId
                          → setPlayCounts++
                          → requestID3 (cache)
                          → waveform decode async (OfflineAudioContext)
audio.ended → onEnded → playNext(wrap) → startTrack(nextInEffectiveQueue)
```

### Clip en bucle
```
playClip(clip) → setActiveClip → seek(clip.start) → audio.play()
audio.timeupdate → onTime → if currentTime >= clip.end → seek(clip.start)
```

### CRT sync
```
isPlaying changes → useEffect → RAF loop
  → AnalyserNode.getByteTimeDomainData → RMS
  → .crt-audio-pulse.style.opacity = clamp(rms * 2.5, 0, 1)
```

## Puntos de extensión

- Separar `app.jsx` en módulos con bundler (Vite/Webpack)
- Migrar persistencia a IndexedDB para mayor capacidad (actual: localStorage ~5-10 MB)
- Service Worker para modo offline completo
- Backend para sync entre dispositivos
