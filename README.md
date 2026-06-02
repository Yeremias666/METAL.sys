# METAL.SYS

Reproductor web personal con estética retro de CRT. Funciona 100% en el navegador — sin servidor, sin login, sin backend. Los archivos se almacenan en `localStorage` como data URLs.

## ¿Qué es?

Una bóveda privada de música (y otros archivos) con interfaz tipo consola underground de los 80. Pensado para colecciones personales de MP3 con metadatos correctos. El diseño imita monitores fósforo/CRT con efectos de scanlines, viñeta, aberración cromática, bloom y flicker.

---

## Funcionalidades completas

### Subida de archivos
- Drag & drop o explorador de archivos
- Límite por archivo: **8 MB** (`SIZE_CAP`)
- Límite total de la bóveda: **25 MB** (`VAULT_CAP`)
- Barra de progreso en tiempo real con velocidad, tiempo transcurrido y ETA
- Para MP3: lectura automática de etiquetas ID3v2 (título, artista, álbum, año, género, pista, portada)
- La portada extraída del MP3 se muestra como miniatura y se guarda en la entrada

### Biblioteca y navegación
- Página de inicio (`INICIO`) con cuadrícula de artistas, canciones recientes y estadísticas
- Página `TODO` con todos los artistas y botón "Reproducir Todo"
- Página de artista (`CAT`) con cuadrícula de álbumes/discos
- Vista interior de disco con lista de canciones (grid o lista)
- Navegación dinámica en `<Nav>` — un botón por artista en la barra de navegación

### Búsqueda y filtros
- Buscador en la página de artista con sugerencias en vivo (máx. 5)
- Resultados completos filtrados por álbum y canciones
- Normalización de búsqueda: ignora tildes y mayúsculas

### Reproductor de música
- Barra persistente en la parte inferior (`MusicPlayer`) activa cuando hay pista en curso
- Controles: ▶/❚❚, ◀◀ anterior, ▶▶ siguiente, volumen
- **Shuffle**: aleatoriza la cola según el contexto activo (artista / disco / todo)
- **Repeat**: tres modos — `off` (sin repetición), `all` (repite lista), `one` (repite pista actual)
- Visualizador VU con 60 barras usando Web Audio API (`AnalyserNode`, log-frequency mapping)
- Barra de progreso clickable para hacer seek

### Botones de reproducción contextual
- Botón ▶ en cada tarjeta de artista → reproduce ese artista
- Botón ▶ en cada tarjeta de álbum → reproduce ese disco
- Botón "▶ REPRODUCIR TODO" en `TodoPage` → reproduce toda la biblioteca

### Detalle de archivo (`DetailPage`)
- Pestañas según tipo: AUDIO, IMAGEN, VÍDEO, PDF, MD, TEXTO, ÁRBOL (ZIP), DESCRIPCIÓN, DETALLES
- Reproductor de audio estilo radio con VU (12 barras) y portada
- Visor de imagen nativo, reproductor de vídeo HTML5, iframe para PDF
- Renderizado de Markdown con `marked.js`
- Previsualización de texto plano (hasta 200 KB)
- Árbol interactivo para archivos ZIP (`jszip`)
- Edición inline de nombre, descripción y categoría
- Botones: descargar, eliminar

### Selección múltiple
- Checkbox en cada canción (grid y lista)
- Barra flotante `MultiSelectBar` cuando hay elementos seleccionados
- Descargar selección como `.zip` (estructura por categoría)
- Eliminar selección en bloque

### Estadísticas (`StatsPanel`)
- Tiles: total de archivos, espacio usado, espacio libre, descargas
- Barra total segmentada por artista con colores
- Gráfico de barras por artista

### Widgets de sidebar
- `NowStreaming` — último archivo subido (estilo cassette TDK)
- `DownloadCounter` — contador de descargas con dígitos estilo odómetro
- `RecentActivity` — log de últimas 5 acciones (subidas, descargas, borrados)
- `Terminal` — árbol de la biblioteca estilo `ls --tree`

### Efectos CRT y Tweaks
- Fósforo configurable: `metal` (rojo sangre, default), `synthwave`, `green`, `amber`, `mono`
- Scanlines, viñeta, aberración cromática, curvatura de pantalla, bloom, flicker, rollbar, jitter
- Panel flotante `TweaksPanel` (esquina inferior derecha) para ajustar todos los efectos en tiempo real
- Los valores de tweaks se persisten en el bloque `/*EDITMODE-BEGIN*/…/*EDITMODE-END*/` de `app.jsx`

### Categorías personalizadas
- Modal `CreateCategoryModal` con nombre + selector de icono (70+ glyphs SVG en 15 grupos)
- Las categorías se persisten en `localStorage` bajo `metalsys_cats_v2`

### Thumbnails procesadas
- Las imágenes se procesan con canvas: escala a 128px, paleta monocroma fósforo roja (4 paradas), posterización a 6 niveles, oscurecimiento de scanlines cada 2 filas
- Resultado: PNG data URL con estética CRT

---

## Stack técnico

| Elemento | Detalle |
|---|---|
| Framework | React 18.3.1 (CDN, UMD) |
| Transpilador | Babel Standalone 7.29.0 (en el navegador) |
| Bundler | Ninguno — archivos `.jsx` cargados directamente |
| ZIP | JSZip 3.10.1 (CDN) |
| Markdown | marked 12.0.0 (CDN) |
| Persistencia | `localStorage` (data URLs base64) |
| Audio API | Web Audio API nativa del navegador |
| Backend | Ninguno |

---

## Estructura de archivos

```
METAL.sys/
├── index.html              ← Entrada principal, carga dependencias CDN
├── app.jsx                 ← Toda la lógica y UI (155 KB aprox.)
├── crt.css                 ← Estilos y efectos CRT (84 KB aprox.)
├── tweaks-panel.jsx        ← Panel de ajustes visual (componentes TweaksPanel)
├── favicon.svg             ← Icono de la pestaña
├── README.md               ← Este archivo
├── Documentación/
│   ├── CONTEXT.md          ← ⭐ Archivo de contexto para nueva sesión con Claude
│   ├── CHANGELOG.md        ← Historial completo de cambios
│   ├── ARCHITECTURE.md     ← Arquitectura técnica detallada
│   ├── FUNCTIONS.md        ← Todas las funciones documentadas
│   ├── FEATURES.md         ← Índice de funcionalidades
│   ├── PLAYBACK.md         ← Sistema de reproducción y cola
│   ├── UPLOAD.md           ← Flujo de subida de archivos
│   ├── DEVELOPMENT.md      ← Guía de desarrollo local
│   └── COMMANDS.md         ← Registro de comandos y cambios por sesión
└── test/
    ├── 02 - The Love Song.mp3
    ├── 04 - So payaso - Versión 2004.mp3
    └── 10 - The Nobodies.mp3
```

---

## Cómo ejecutar

```bash
# Opción 1 — Python 3
cd "c:/Users/ygmullor/Documents/METAL.sys"
python -m http.server 8000
# Abrir http://localhost:8000/

# Opción 2 — Node.js
npx http-server -c-1 . -p 8000
```

> Abrir directamente `index.html` vía `file://` puede fallar por restricciones CORS del navegador al cargar los `.jsx`.

---

## Política de documentación

**Obligatorio** después de cada cambio:
1. Añadir entrada en `Documentación/CHANGELOG.md` con fecha y descripción
2. Actualizar `Documentación/FUNCTIONS.md` si se añade/modifica alguna función
3. Actualizar `Documentación/FEATURES.md` si se añade una funcionalidad nueva
4. Actualizar `Documentación/COMMANDS.md` con las herramientas/comandos usados en la sesión
5. Actualizar `Documentación/CONTEXT.md` si cambia el estado global del proyecto

---

## Límites y constantes clave

| Constante | Valor | Descripción |
|---|---|---|
| `SIZE_CAP` | 8 MB | Tamaño máximo por archivo |
| `VAULT_CAP` | 25 MB | Capacidad total de la bóveda |
| `STORAGE_KEY` | `metalsys_vault_v2` | Clave localStorage para archivos |
| `CATS_KEY` | `metalsys_cats_v2` | Clave localStorage para categorías |
| `LOG_KEY` | `metalsys_log_v2` | Clave localStorage para log de actividad |

---

## Mejoras futuras sugeridas

- Descargas masivas en ZIP desde la página de artista
- Cola de reproducción visible y editable (drag & drop)
- Historial de reproducción persistente en `localStorage`
- Soporte offline completo con Service Worker
- Importar/exportar la bóveda completa como un único ZIP
