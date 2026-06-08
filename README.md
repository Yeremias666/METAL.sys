# METAL.SYS

Reproductor web personal con estética retro CRT. Combina un vault local en `localStorage` con una biblioteca en la nube (Cloudflare R2) accesible desde cualquier dispositivo. Sin npm, sin bundler, sin node_modules.

---

## Stack técnico

| Elemento | Detalle |
|---|---|
| Framework | React 18.3.1 (CDN, UMD) |
| Transpilador | Babel Standalone 7.29.0 (en el navegador) |
| Bundler | Ninguno — archivos `.jsx` cargados directamente |
| ZIP | JSZip 3.10.1 (CDN) |
| Markdown | marked 12.0.0 (CDN) |
| Persistencia local | `localStorage` (vault, likes, marcadores, clips) + IndexedDB (handles de carpeta local + caché de portadas) |
| Persistencia en nube | Cloudflare R2 (archivos de audio) + Cloudflare KV (datos de usuario) |
| Audio API | Web Audio API nativa del navegador |
| Backend | Cloudflare Pages Functions (`functions/api/`) |

---

## Arquitectura de datos

El reproductor maneja dos fuentes de archivos simultáneamente:

### Vault local (`localStorage`)
Archivos subidos directamente en el navegador. Se guardan como data URLs base64.
- Límite por archivo: **8 MB** (`SIZE_CAP`)
- Límite total: **25 MB** (`VAULT_CAP`)

### Biblioteca R2 (Cloudflare)
Al arrancar, la app llama a `/api/files` y carga la lista de MP3 del bucket R2. Los archivos R2 nunca se descargan completos — el reproductor obtiene una URL presignada temporal de `/api/audio` y hace streaming directo desde R2. Las portadas se descargan una vez y se cachean en IndexedDB.

---

## Estructura de archivos

```
METAL.sys/
├── index.html              ← Entrada principal, carga dependencias CDN
├── app.jsx                 ← Toda la lógica y UI (~306 KB, ~4700 líneas)
├── crt.css                 ← Estilos y efectos CRT (~131 KB)
├── tweaks-panel.jsx        ← Panel de ajustes visual
├── favicon.svg / .ico
├── README.md
├── functions/
│   └── api/
│       ├── audio.js        ← URL presignada AWS Sig V4 para streaming de R2
│       ├── files.js        ← Lista MP3 de R2 con metadatos ID3 y portadas
│       ├── reindex-meta.js ← Extrae etiquetas ID3 y las guarda en _meta/index.json
│       ├── reindex-covers.js ← Extrae portadas y las sube como _covers/*.jpg
│       ├── userdata.js     ← GET/PUT bookmarks, clips, likes y playCounts en KV
│       └── auth/
│           ├── register.js
│           ├── login.js
│           ├── logout.js
│           └── profile.js
└── Documentación/
    ├── CONTEXT.md          ← ⭐ Contexto para nueva sesión con Claude
    ├── CHANGELOG.md        ← Historial completo de cambios
    ├── ARCHITECTURE.md
    ├── FUNCTIONS.md
    ├── FEATURES.md
    ├── PLAYBACK.md
    ├── UPLOAD.md
    ├── DEVELOPMENT.md
    └── COMMANDS.md
```

---

## Cómo ejecutar localmente

```bash
# Opción 1 — Python 3
python -m http.server 8000

# Opción 2 — Node.js
npx http-server -c-1 . -p 8000
```

Abrir `http://localhost:8000/`. Abrir directamente `index.html` vía `file://` falla por CORS al cargar los `.jsx`. Babel Standalone transpila JSX en el navegador; los errores de sintaxis aparecen en la consola del navegador, no en la terminal.

---

## Funcionalidades

### Biblioteca y navegación
- Página **INICIO** con cuadrícula de artistas, archivos recientes y estadísticas del vault
- Página **BANDAS** con todos los artistas y botón "Reproducir Todo"
- Página **TODO** con todas las canciones (vault + local) ordenadas alfabéticamente
- Página **♥ GUSTA** con canciones marcadas con me gusta + reproducir todo
- Página **STATS** con timeline de subidas, top artistas y 8 métricas del vault
- Página **LOCAL** para importar música desde una carpeta del sistema (Chrome/Edge)
- Página de artista con cuadrícula de álbumes y efecto vinilo en hover
- Vista interior de disco con lista de canciones (grid o tabla)
- **Árbol de biblioteca** colapsable en sidebar izquierdo: artistas > discos > canciones
- **Editar artista**: modal para subir imagen y descripción del artista, persistida en localStorage

### Subida de archivos
- Drag & drop o explorador de archivos
- Parser ID3v2 nativo (sin librerías): título, artista, álbum, año, género, pista, portada
- Soporta ID3v2.2, v2.3 y v2.4, encoding UTF-8 / UTF-16 / Latin1
- Barra de progreso en tiempo real con velocidad, tiempo transcurrido y ETA
- Thumbnails procesadas: canvas 128px, paleta fósforo roja, posterización, scanlines

### Reproductor de música
- Barra persistente en la parte inferior (`MusicPlayer`) activa cuando hay pista en curso
- **VU meter**: 60 barras con Web Audio API, mapping logarítmico de frecuencias
- **Waveform**: forma de onda calculada con `OfflineAudioContext` (300 puntos RMS), superpuesta en la barra de progreso
- Barra de progreso con **click** y **drag** para seek
- **Shuffle**: aleatoriza la cola según el contexto activo, empieza en la pista actual
- **Repeat**: tres modos — off, all (repite lista), one (repite pista actual)
- **Cola de reproducción** en sidebar derecho: tiempo real, drag-to-reorder
- **Destello CRT** sincronizado con el RMS del audio en reproducción
- Streaming directo desde Cloudflare R2 via URL presignada (archivos de nube)

### Marcadores y Clips
- **Marcadores**: checkpoint con nombre y tiempo (M:SS.mmm), accesibles desde tab en DetailPage
- **Clips**: fragmento con inicio y fin; se reproducen en bucle; tab en DetailPage
- Ambos persistidos en `localStorage`

### Búsqueda y filtros
- Buscador en la página de artista con sugerencias en vivo (máx. 5)
- Normalización: ignora tildes y mayúsculas

### Selección múltiple
- Checkbox por canción en grid y tabla
- Barra flotante `MultiSelectBar` con total de bytes seleccionados
- Descarga selección como `.zip` (estructura por categoría)
- Borrado en bloque

### Detalle de archivo (`DetailPage`)
- Pestañas adaptativas según tipo: AUDIO, IMAGEN, VÍDEO, PDF, MD, TEXTO, ÁRBOL (ZIP), DESCRIPCIÓN, DETALLES, MARCADORES, CLIPS
- Edición inline de nombre, descripción y categoría
- Reproductor de audio con VU de 12 barras y portada
- Árbol interactivo para ZIP (jszip), Markdown con marked.js, previsualización de texto hasta 200 KB

### Efectos CRT y Tweaks
- **5 paletas fósforo**: `metal` (rojo sangre, default), `synthwave` (rosa), `green`, `amber`, `mono`
- Scanlines, viñeta, aberración cromática, curvatura, bloom, flicker, rollbar, jitter
- Panel flotante `TweaksPanel` para ajustar todos los efectos en tiempo real
- Valores persistidos en el bloque `/*EDITMODE-BEGIN*/…/*EDITMODE-END*/` de `app.jsx`

### Widgets de sidebar
- `PlayQueueWithNowPlaying` — cassette de la canción en curso + cola de reproducción con drag-to-reorder
- `TopSongs` — top 10 canciones más escuchadas con contador
- `PlaysCounter` — suma total de reproducciones (odómetro)
- `RecentActivity` — log estilo `tail -f` con timestamps y eventos (PLAY, PAUSE, NEXT, UP, DL, DEL...)

### Backend — Cloudflare Pages Functions
- `GET /api/files` — lista todos los MP3 de R2 con metadatos desde `_meta/index.json` y portadas presignadas (caché CDN 5 min)
- `GET /api/audio?path=...` — URL presignada AWS Sig V4 para streaming de un MP3 desde R2 (TTL 1 h)
- `GET /api/reindex-meta` — extrae etiquetas ID3 de los MP3 en R2 y las guarda en `_meta/index.json`; 8 archivos por llamada
- `GET /api/reindex-covers` — extrae portadas de los MP3 y las sube como `_covers/Artista/Album.jpg`; 8 álbumes por llamada
- `GET|PUT /api/userdata` — sincroniza bookmarks, clips, likes y playCounts en Cloudflare KV por usuario autenticado
- `POST /api/auth/register|login|logout` + `GET|PUT /api/auth/profile` — autenticación con PBKDF2 SHA-256, 100k iteraciones, sesión 30 días en KV

El panel de **BIBLIOTECA R2 /// MANTENIMIENTO** en la página de Inicio permite ejecutar el reindexado de metadatos y portadas directamente desde la UI.

---

## Variables de entorno (Cloudflare Pages)

| Variable | Uso |
|---|---|
| `R2_ACCESS_KEY_ID` | Clave de acceso S3-compatible para R2 |
| `R2_SECRET_ACCESS_KEY` | Clave secreta para R2 |
| `KV` | Binding al namespace de Cloudflare KV (usuarios y sesiones) |

---

## Claves de localStorage

| Clave | Contenido |
|---|---|
| `metalsys_vault_v2` | `file[]` — vault completo (data URLs base64) |
| `metalsys_cats_v2` | `{ name, icon }[]` — categorías personalizadas |
| `metalsys_likes_v1` | `string[]` — IDs de canciones con me gusta |
| `metalsys_playcounts_v1` | `{ [fileId]: number }` — reproducciones por canción |
| `metalsys_bookmarks_v1` | `{ [fileId]: { id, name, time }[] }` |
| `metalsys_clips_v1` | `{ [fileId]: { id, name, start, end }[] }` |
| `metalsys_artist_meta_v1` | `{ [artistName]: { image: dataURL, description: string } }` |
| `metalsys_log_v2` | actividad (máx. 200 entradas) |
| `metalsys_plog_v1` | log de reproducción (máx. 2000 entradas) |

---

## Restricciones técnicas — no cambiar

- **Sin npm, sin bundler, sin node_modules.** React 18 + Babel Standalone se cargan via CDN en `index.html`. Añadir un paso de build rompería el proyecto.
- **JSX transpilado en el navegador** via `<script type="text/babel">`. Los errores de sintaxis aparecen en la consola del navegador.
- El estado global vive en `App()` y se pasa hacia abajo como props. No hay contexto ni store.

---

## Política de documentación

Obligatorio después de cada cambio:
1. Añadir entrada en `Documentación/CHANGELOG.md` con fecha y descripción
2. Actualizar `Documentación/FUNCTIONS.md` si se añade o modifica alguna función
3. Actualizar `Documentación/FEATURES.md` si se añade una funcionalidad nueva
4. Actualizar `Documentación/CONTEXT.md` si cambia el estado global del proyecto
