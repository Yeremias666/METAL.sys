<img src="favicon.svg" width="64" height="64" alt="METAL.SYS skull">

# METAL.SYS

> Reproductor de música web personal con estética retro CRT. Biblioteca en la nube vía Cloudflare R2, sin aplicaciones nativas, sin suscripciones.

---

## Características

- **Biblioteca en la nube** — archivos MP3 en Cloudflare R2, streaming directo desde el navegador
- **Vault local** — sube archivos directamente, se guardan como base64 en `localStorage`
- **Reproductor completo** — waveform, VU meter de 60 barras, shuffle, repeat, cola con drag-to-reorder
- **Parser ID3v2 nativo** — extrae título, artista, álbum, año, género, pista y portada sin librerías externas
- **Playlists** — creación, edición (nombre, portada, descripción), añadir/quitar canciones
- **Marcadores y Clips** — checkpoints con nombre y fragmentos de inicio/fin en bucle
- **Árbol de biblioteca** — sidebar colapsable con artistas › discos › canciones
- **Búsqueda en vivo** — sugerencias normalizadas (ignora tildes y mayúsculas)
- **Selección múltiple** — descarga ZIP por categoría, borrado en bloque
- **5 paletas de fósforo** — metal (rojo, defecto), synthwave, green, amber, mono
- **Efectos CRT ajustables** — scanlines, viñeta, aberración cromática, bloom, flicker, rollbar, jitter
- **Cuentas de usuario** — registro/login con PBKDF2 SHA-256 100k iteraciones, sesiones de 30 días
- **Panel de administración** — gestión de usuarios y objetos R2 (solo rol `admin`)
- **Sin build step** — React 18 + Babel Standalone cargados via CDN, cero configuración

---

## Inicio rápido

```bash
# Python 3
python -m http.server 8000

# Node.js
npx http-server -c-1 . -p 8000
```

Abrir `http://localhost:8000/`. Abrir `index.html` directamente via `file://` falla por restricciones CORS al cargar los `.jsx`.

---

## Stack

| Elemento | Detalle |
|---|---|
| Framework | React 18.3.1 (CDN, UMD) |
| Transpilador | Babel Standalone 7.29.0 (browser runtime) |
| Bundler | Ninguno |
| ZIP | JSZip 3.10.1 (CDN) |
| Markdown | marked 12.0.0 (CDN) |
| Almacenamiento local | `localStorage` + IndexedDB |
| Almacenamiento en nube | Cloudflare R2 (audio) + Cloudflare KV (usuarios, sesiones, datos) |
| Audio | Web Audio API nativa |
| Backend | Cloudflare Pages Functions |

---

## Estructura del proyecto

```
METAL.sys/
├── index.html                  — Punto de entrada, carga deps CDN
├── app.jsx                     — Toda la lógica y UI (~5000 líneas)
├── crt.css                     — Estilos completos + efectos CRT
├── tweaks-panel.jsx            — Panel flotante de ajustes visuales
├── functions/
│   └── api/
│       ├── audio.js            — Proxy streaming R2 con soporte Range
│       ├── files.js            — Lista MP3 con metadatos ID3 y portadas presignadas
│       ├── reindex-meta.js     — Extrae etiquetas ID3 → _meta/index.json (8/llamada)
│       ├── reindex-covers.js   — Extrae portadas → _covers/*.jpg (8/llamada)
│       ├── userdata.js         — Sincroniza bookmarks, clips, likes, playCounts en KV
│       ├── admin/
│       │   ├── users.js        — Gestión de usuarios (GET/PUT/DELETE, solo admin)
│       │   └── r2.js           — Gestión de objetos R2 (GET/DELETE, solo admin)
│       └── auth/
│           ├── register.js     — Registro con PBKDF2 SHA-256
│           ├── login.js        — Login, token 30 días en KV
│           ├── logout.js       — Invalida sesión
│           └── profile.js      — Ver y actualizar perfil (avatar, contraseña, rol)
└── Documentación/
    ├── CONTEXT.md              — Contexto de sesión para Claude
    ├── CHANGELOG.md
    ├── ARCHITECTURE.md
    ├── FUNCTIONS.md
    ├── FEATURES.md
    ├── PLAYBACK.md
    └── DEVELOPMENT.md
```

---

## API

| Endpoint | Método | Descripción |
|---|---|---|
| `/api/files` | GET | Lista MP3 de R2 con metadatos ID3 y portadas (caché CDN 5 min) |
| `/api/audio?path=…` | GET, HEAD | Proxy streaming con cabecera Range desde R2 |
| `/api/reindex-meta` | GET | Reindexar metadatos ID3 (8 archivos/llamada) |
| `/api/reindex-covers` | GET | Reindexar portadas en `_covers/` (8 álbumes/llamada) |
| `/api/userdata` | GET, PUT | Sincronizar bookmarks, clips, likes, playCounts, playlists |
| `/api/auth/register` | POST | Registro — PBKDF2 SHA-256, 100k iteraciones, salt aleatorio |
| `/api/auth/login` | POST | Login — devuelve token de 30 días |
| `/api/auth/logout` | POST | Invalida sesión en KV |
| `/api/auth/profile` | GET, PUT | Perfil de usuario — avatar, contraseña, rol |
| `/api/admin/users` | GET, PUT, DELETE | Listar/cambiar rol/eliminar usuarios — requiere `role: admin` |
| `/api/admin/r2` | GET, DELETE | Listar/eliminar objetos R2 — requiere `role: admin` |

### Roles

El campo `role` se almacena en `KV user:${username}`. El email `gutierrezy100@gmail.com` recibe `admin` al registrarse; el resto reciben `user`. Los endpoints `/api/admin/*` verifican el rol directamente desde KV — nunca confían en el token de sesión para autorizar.

---

## Variables de entorno (Cloudflare Pages)

| Variable | Descripción |
|---|---|
| `R2_ACCESS_KEY_ID` | Clave de acceso S3-compatible para el bucket R2 |
| `R2_SECRET_ACCESS_KEY` | Clave secreta S3-compatible |
| `KV` | Binding al namespace de Cloudflare KV |

---

## Persistencia local

| Clave | Contenido |
|---|---|
| `metalsys_vault_v2` | `file[]` — vault completo (data URLs base64) |
| `metalsys_cats_v2` | `{ name, icon }[]` — categorías personalizadas |
| `metalsys_likes_v1` | `string[]` — IDs con me gusta |
| `metalsys_playcounts_v1` | `{ [fileId]: number }` — reproducciones por canción |
| `metalsys_bookmarks_v1` | `{ [fileId]: { id, name, time }[] }` |
| `metalsys_clips_v1` | `{ [fileId]: { id, name, start, end }[] }` |
| `metalsys_artist_meta_v1` | `{ [artist]: { image, description } }` |
| `metalsys_playlists_v1` | `{ id, name, description, coverArt, songIds[], createdAt }[]` |
| `metalsys_log_v2` | Log de actividad — máx. 200 entradas |
| `metalsys_plog_v1` | Log de reproducción — máx. 2000 entradas |
| `metalsys_auth_token` | Token de sesión activo |
| `metalsys_auth_user` | `{ username, email, avatar, role }` en caché |

---

## Modelo de datos

```js
// Archivo en el vault
{
  id, name, artist, album, track, year, genre,
  thumbnail,   // PNG data URL — 128px, paleta fósforo activa
  coverArt,    // PNG data URL — frame APIC original del ID3
  fileData,    // base64 data URL completo (solo vault local)
  fileSize, fileType, fileName, uploadedAt, downloads
}
```

`category === artist` — el nombre del artista es la clave de navegación principal.

---

## Pipeline de reproducción

```
playScope(ctx, shuffle)
  → limpia manualQueue → establece playContext
  → startTrack(file)
      → audio.src = fileData | '/api/audio?path=...'
      → incrementa playCounts
      → async: decodifica waveform via OfflineAudioContext
      → async: lee tags ID3 para portada

audio.ended → onEnded → playNext()
effectiveQueue = manualQueue ?? musicQueue
musicQueue derivado de playContext
```

---

## Restricciones

- **Sin npm, sin bundler, sin node_modules.** Añadir un paso de build rompe el proyecto.
- **Sin backend propio.** Todo es Cloudflare Pages + KV + R2.
- **JSX transpilado en el navegador** via Babel Standalone. Los errores de sintaxis aparecen en la consola del navegador, no en la terminal.
- **Estado global en `App()`** pasado como props. Sin contexto, sin store.

---

## Desarrollo

Después de cada cambio:

1. `Documentación/CHANGELOG.md` — entrada con fecha y descripción
2. `Documentación/FUNCTIONS.md` — si se añade o modifica una función
3. `Documentación/FEATURES.md` — si se añade funcionalidad nueva
4. `Documentación/CONTEXT.md` — si cambia el estado global del proyecto
