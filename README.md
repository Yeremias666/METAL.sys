# METAL.SYS

Reproductor de música web personal con estética retro CRT. Accede a tu biblioteca desde cualquier dispositivo — sin aplicaciones, sin suscripciones, sin anuncios.

<<<AQUI INSERTAR IMAGEN: captura de pantalla general de la app en modo oscuro>>>

---

## Para el usuario

### ¿Qué es esto?

METAL.SYS es tu reproductor de música personal. Tu música vive en la nube (Cloudflare R2) y en tu navegador. La interfaz imita un monitor CRT de los 80 con efectos de escaneo, aberración cromática y paletas de fósforo.

---

### Primeros pasos

#### 1. Crear cuenta

Abre la app y pulsa el icono de usuario en la esquina superior derecha. Elige **REGISTRARSE**, escribe tu nombre de usuario, email y contraseña. Una vez dentro, tu música y tus preferencias se sincronizan entre dispositivos.

<<<AQUI INSERTAR IMAGEN: modal de registro / login>>>

#### 2. Subir música

Ve a **SUBIR** en la barra de navegación. Arrastra archivos MP3 o usa el explorador. La app lee automáticamente las etiquetas ID3 (título, artista, álbum, año, portada). La barra de progreso muestra velocidad y tiempo restante.

<<<AQUI INSERTAR IMAGEN: página de subida con barra de progreso>>>

- Límite por archivo: **8 MB**
- Límite total del vault local: **25 MB**
- Los archivos en R2 no tienen límite de tamaño desde la app

#### 3. Reproducir

Haz clic en cualquier canción para reproducirla. El reproductor aparece en la barra inferior. Desde ahí puedes pausar, cambiar de pista, activar shuffle, repetir y ver la forma de onda.

<<<AQUI INSERTAR IMAGEN: barra de reproductor con VU meter>>>

---

### Navegación

| Página | Qué hay |
|---|---|
| **INICIO** | Cuadrícula de artistas, archivos recientes, estadísticas |
| **TODO** | Todas las canciones ordenadas alfabéticamente |
| **BANDAS** | Todos los artistas con portada y botón "Reproducir Todo" |
| **♥ GUSTA** | Canciones marcadas como favoritas |
| **PLAYLIST** | Tus playlists creadas |
| **STATS** | Timeline de subidas, top artistas, 8 métricas |
| **LOCAL** | Música desde carpeta local (Chrome/Edge) |

En el **sidebar izquierdo** tienes el árbol de biblioteca: artistas > discos > canciones. Haz clic en cualquier nivel para navegar directamente.

<<<AQUI INSERTAR IMAGEN: sidebar izquierdo con árbol de biblioteca>>>

---

### Playlists

Ve a **PLAYLIST** y pulsa **CREAR PLAYLIST**. Ponle nombre, descripción y portada. Desde cualquier canción pulsa `···` → **Añadir a Playlist**. Para editar una playlist, ábrela y pulsa **✎ EDITAR**.

<<<AQUI INSERTAR IMAGEN: página de detalle de playlist con botón editar>>>

---

### Marcadores y Clips

Desde la página de detalle de una canción (haz clic en el nombre de la canción) encontrarás dos pestañas:

- **MARCADORES** — guarda un instante con nombre (ej. "intro", "solo"). Pulsa para saltar al momento.
- **CLIPS** — define un fragmento de inicio/fin que se repite en bucle. Ideal para practicar.

---

### Efectos CRT

Pulsa el icono de ajustes para abrir el **TweaksPanel** flotante. Desde ahí puedes:

- Cambiar la **paleta de fósforo**: metal (rojo, defecto), synthwave (rosa), green, amber, mono
- Ajustar scanlines, viñeta, aberración cromática, bloom, flicker y más
- Activar **Modo Claro** desde el menú de usuario (icono de usuario → ◑ MODO CLARO)

<<<AQUI INSERTAR IMAGEN: TweaksPanel abierto con opciones de fósforo>>>

---

### Rendimiento

Si la app va lenta, abre el menú de usuario → **▸ RENDIMIENTO** y desactiva los efectos que más consumen (scanlines, bloom, VU meter). Los ajustes se sincronizan con tu cuenta si activas "Guardar en cuenta".

---

## Referencia técnica

### Stack

| Elemento | Detalle |
|---|---|
| Framework | React 18.3.1 (CDN, UMD) |
| Transpilador | Babel Standalone 7.29.0 (en el navegador) |
| Bundler | **Ninguno** — archivos `.jsx` cargados directamente |
| ZIP | JSZip 3.10.1 (CDN) |
| Markdown | marked 12.0.0 (CDN) |
| Persistencia local | `localStorage` + IndexedDB (handles de carpeta local, caché de portadas) |
| Persistencia en nube | Cloudflare R2 (audio) + Cloudflare KV (usuarios, sesiones, datos) |
| Audio API | Web Audio API nativa |
| Backend | Cloudflare Pages Functions (`functions/api/`) |

### Restricciones — no cambiar

- **Sin npm, sin bundler, sin node_modules.** React 18 + Babel Standalone se cargan via CDN. Añadir un paso de build rompería el proyecto.
- **Sin backend propio.** Todo es Cloudflare Pages + KV + R2.
- **JSX transpilado en el navegador.** Los errores de sintaxis aparecen en la consola del navegador, no en la terminal.
- El estado global vive en `App()` y se pasa hacia abajo como props. No hay contexto ni store.

---

### Estructura de archivos

```
METAL.sys/
├── index.html                  ← Entrada principal, carga deps CDN
├── app.jsx                     ← Toda la lógica y UI (~5000 líneas)
├── crt.css                     ← Estilos + efectos CRT
├── tweaks-panel.jsx            ← Panel de ajustes visual
├── favicon.svg / .ico
├── README.md
├── functions/
│   └── api/
│       ├── audio.js            ← Proxy streaming R2 con soporte Range
│       ├── files.js            ← Lista MP3 con metadatos ID3 y portadas
│       ├── reindex-meta.js     ← Extrae etiquetas ID3 → _meta/index.json
│       ├── reindex-covers.js   ← Extrae portadas → _covers/*.jpg
│       ├── userdata.js         ← GET/PUT bookmarks, clips, likes, playCounts
│       ├── admin/
│       │   ├── users.js        ← GET/PUT/DELETE usuarios (solo admin)
│       │   └── r2.js           ← GET/DELETE objetos R2 (solo admin)
│       └── auth/
│           ├── register.js
│           ├── login.js
│           ├── logout.js
│           └── profile.js
└── Documentación/
    ├── CONTEXT.md              ← ⭐ Contexto para nueva sesión con Claude
    ├── CHANGELOG.md
    ├── ARCHITECTURE.md
    ├── FUNCTIONS.md
    ├── FEATURES.md
    ├── PLAYBACK.md
    ├── UPLOAD.md
    ├── DEVELOPMENT.md
    └── COMMANDS.md
```

---

### Arquitectura de datos

#### Vault local (`localStorage`)
Archivos subidos directamente. Se guardan como data URLs base64.
- Límite por archivo: **8 MB** (`SIZE_CAP`)
- Límite total: **25 MB** (`VAULT_CAP`)

#### Biblioteca R2
Al arrancar, la app llama a `/api/files` y carga la lista de MP3. Los archivos nunca se descargan completos — el reproductor hace streaming via `/api/audio` (proxy con soporte de cabecera `Range`). Las portadas se cachean en IndexedDB.

#### Modelo de archivo

```js
{
  id, name, artist, album, track, year, genre,
  thumbnail,   // PNG data URL — procesada 128px, paleta fósforo
  coverArt,    // PNG data URL — frame APIC original del ID3
  fileData,    // base64 data URL completo (vault local)
  fileSize, fileType, fileName, uploadedAt, downloads
}
```

#### claves de localStorage

| Clave | Contenido |
|---|---|
| `metalsys_vault_v2` | `file[]` — vault completo |
| `metalsys_cats_v2` | `{ name, icon }[]` — categorías |
| `metalsys_likes_v1` | `string[]` — IDs con me gusta |
| `metalsys_playcounts_v1` | `{ [fileId]: number }` |
| `metalsys_bookmarks_v1` | `{ [fileId]: { id, name, time }[] }` |
| `metalsys_clips_v1` | `{ [fileId]: { id, name, start, end }[] }` |
| `metalsys_artist_meta_v1` | `{ [artist]: { image, description } }` |
| `metalsys_playlists_v1` | `{ id, name, description, coverArt, songIds[], createdAt }[]` |
| `metalsys_log_v2` | actividad (máx. 200 entradas) |
| `metalsys_plog_v1` | log de reproducción (máx. 2000 entradas) |
| `metalsys_theme` | `'dark'` \| `'light'` |

---

### Backend — endpoints

| Endpoint | Método | Descripción |
|---|---|---|
| `/api/files` | GET | Lista MP3 de R2 con metadatos e ID3 |
| `/api/audio?path=…` | GET, HEAD | Proxy streaming con Range desde R2 |
| `/api/reindex-meta` | GET | Reindexar metadatos ID3 (8 archivos/llamada) |
| `/api/reindex-covers` | GET | Reindexar portadas → `_covers/` (8/llamada) |
| `/api/userdata` | GET, PUT | Sincronizar datos de usuario en KV |
| `/api/auth/register` | POST | Registro con PBKDF2 SHA-256 100k iter. |
| `/api/auth/login` | POST | Login; devuelve token 30 días |
| `/api/auth/logout` | POST | Invalida sesión en KV |
| `/api/auth/profile` | GET, PUT | Ver y actualizar perfil (avatar, contraseña) |
| `/api/admin/users` | GET, PUT, DELETE | Gestión de usuarios (solo rol `admin`) |
| `/api/admin/r2` | GET, DELETE | Gestión de objetos R2 (solo rol `admin`) |

#### Roles

Al registrarse, el email `gutierrezy100@gmail.com` recibe rol `admin`; el resto reciben `user`. El rol se almacena en `KV user:${username}` y se verifica en el servidor en cada petición a `/api/admin/*` — nunca se confía en el token de sesión para autorizar acciones de admin.

---

### Variables de entorno (Cloudflare Pages)

| Variable | Uso |
|---|---|
| `R2_ACCESS_KEY_ID` | Clave de acceso S3-compatible para R2 |
| `R2_SECRET_ACCESS_KEY` | Clave secreta para R2 |
| `KV` | Binding al namespace de Cloudflare KV |

---

### Ejecutar localmente

```bash
# Python 3
python -m http.server 8000

# Node.js
npx http-server -c-1 . -p 8000
```

Abrir `http://localhost:8000/`. Abrir `index.html` via `file://` falla por CORS.

---

### Política de documentación

Después de cada cambio:
1. Añadir entrada en `Documentación/CHANGELOG.md`
2. Actualizar `Documentación/FUNCTIONS.md` si se añade o modifica alguna función
3. Actualizar `Documentación/FEATURES.md` para funcionalidades nuevas
4. Actualizar `Documentación/CONTEXT.md` si cambia el estado global del proyecto
