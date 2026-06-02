# Subida de archivos — flujo y detalles

## Flujo normal (UploadPage)

1. Usuario selecciona o arrastra un archivo en `UploadPage`
2. `handleFile(f)` valida:
   - Tamaño ≤ `SIZE_CAP` (8 MB)
   - Total actual + nuevo ≤ `VAULT_CAP` (25 MB)
3. Si es audio: `f.arrayBuffer()` → `_parseID3Buffer(buf)` → rellena formulario (title, artist, album, year, genre, track, coverArt)
4. `submit()` llama `onUpload(meta)` con `_rawFile: file` y todos los metadatos
5. `startUpload(meta)` en App():
   - Crea estado inicial de progreso, navega a `UPLOAD_PROGRESS`
   - `FileReader.readAsDataURL(file)` con `onprogress`:
     - Actualiza `uploadProgress` con bytesLoaded, percent, bytesPerSec, elapsedMs, etaMs
   - `reader.onload`: crea entry con id único, añade a `files`, log `UP`, navega a artista
   - `reader.onerror`: marca error, limpia tras 1.5s

## Flujo local (LocalPage — File System Access API)

1. `window.showDirectoryPicker({ mode: 'read' })` → `FileSystemDirectoryHandle`
2. Recursion por `handle.entries()` buscando extensiones audio
3. Lista de encontrados se muestra antes de importar
4. `importLocalFile(file, 'LOCAL')` por cada archivo (mismo flujo que startUpload)
5. Se aplican los límites 8MB/25MB normales

## Estructura de `uploadProgress`

```js
{
  name: string,
  bytesLoaded: number,
  bytesTotal: number,
  percent: number,   // 0–100
  bytesPerSec: number,
  elapsedMs: number,
  etaMs: number,
  done: boolean,
  error?: boolean,
}
```

## Entry creada en vault

```js
{
  id: 'F' + Date.now().toString(36) + random,
  name, description, category, artist, album, track, year, genre,
  thumbnail: meta.thumbnail || meta.coverArt,
  coverArt: meta.coverArt,
  fileName: file.name,
  fileSize: file.size,
  fileType: file.type || 'application/octet-stream',
  fileData: reader.result,   // data URL completo
  uploadedAt: Date.now(),
  downloads: 0,
}
```

## Correcciones implementadas

- Barra de progreso: `Math.min(100, Math.max(0, percent))` para evitar >100%
- CSS `.up-meter` con `position: relative` y `.up-meter-fill` con `position: absolute` para que `width: 100%` funcione
- `reader.onerror` limpia el estado tras timeout para volver al formulario

## Compatibilidad Local Import

Solo Chrome y Edge soportan `showDirectoryPicker`. Firefox no. La UI muestra un mensaje de error si no es compatible.
