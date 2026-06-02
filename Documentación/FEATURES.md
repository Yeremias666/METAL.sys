# FEATURES.md — Índice de funcionalidades

Lista actualizada de todas las funcionalidades del proyecto. Añade una línea cuando implementes algo nuevo.

---

## Subida y biblioteca

- **Drag & drop / explorador**: sube archivos arrastrando o con click
- **Auto-lectura ID3v2**: extrae título, artista, álbum, año, género, pista y portada de MP3
- **Parser ID3v2 nativo**: sin librerías externas, soporta v2.3 y v2.4, encoding UTF-8/UTF-16/Latin1
- **Thumbnails CRT**: canvas a 128px + paleta fósforo roja (4 paradas) + posterización + scanlines
- **Límite de tamaño**: 8 MB por archivo, 25 MB total de vault
- **Importar carpeta local**: File System Access API (Chrome/Edge), crea categoría LOCAL

## Navegación

- **Página INICIO**: resumen de artistas, archivos recientes, estadísticas
- **Página TODO**: todos los artistas con reproducir todo
- **Página de artista (CAT)**: cuadrícula de álbumes con portadas y efecto vinilo
- **Vista interior de disco**: canciones del disco en grid o tabla
- **Buscador con sugerencias**: sugerencias en vivo (máx 5), resultados completos por álbum/canción
- **Página ME GUSTA**: canciones marcadas con ♥, reproducir todo
- **Página STATS**: timeline de subidas, top artistas, 8 métricas del vault
- **Página LOCAL**: importar música desde carpeta del sistema de archivos

## Reproductor de música

- **Barra persistente MusicPlayer**: siempre visible mientras hay pista en reproducción
- **VU meter**: 60 barras simétricas con Web Audio API y mapping logarítmico
- **Waveform en progress bar**: forma de onda calculada con OfflineAudioContext, 300 puntos
- **Seek clickable**: click en la barra de progreso para saltar a cualquier posición
- **Shuffle contextual**: aleatoriza la cola según el contexto (artista/disco/todo)
- **Repeat**: tres modos — off, all (repite lista), one (repite pista)
- **Drag-to-reorder queue**: arrastra canciones en el sidebar para cambiar el orden
- **Me Gusta en reproductor**: botón ♡/♥ en la barra del reproductor
- **Menú ··· con opciones**: crear marcador, crear clip

## Marcadores y Clips

- **Marcadores**: checkpoint en M:SS con nombre, accesibles desde tab Marcadores en DetailPage
- **Clips**: fragmento con inicio y fin, se reproduce en bucle, tab Clips en DetailPage
- **Loop de clip**: en `timeupdate`, cuando `currentTime >= clip.end` → seek a `clip.start`

## Efectos CRT

- **5 paletas fósforo**: metal (rojo), synthwave (rosa), green, amber, mono
- **Scanlines**: overlay CSS semi-transparente
- **Viñeta radial**: degradado en bordes
- **Aberración cromática**: desfase horizontal configurable
- **Curvatura de pantalla**: border-radius en `.crt-screen`
- **Bloom / glow**: text-shadow + filter en textos primarios
- **Flicker**: animación CSS en `.crt-screen`
- **Roll bar**: barra de barrido animada
- **Jitter**: movimiento horizontal leve del contenido
- **Destello CRT sincronizado con audio**: overlay radial cuya opacidad sigue el RMS del audio

## Layout y sidebar

- **Layout 3 columnas**: árbol de biblioteca (izq), contenido principal (centro), widgets (der)
- **Árbol de biblioteca**: artistas > discos > canciones colapsables con botones ▶
- **Cola de reproducción**: lista en tiempo real, drag-to-reorder, pista actual destacada
- **Top 10 canciones**: más reproducidas con contador
- **Widgets de sidebar**: última subida, contador de descargas, actividad reciente, terminal árbol

## Detalle de archivo

- **Pestañas adaptativas**: AUDIO, IMAGEN, VÍDEO, PDF, MD, TEXTO, ÁRBOL, DESCRIPCIÓN, DETALLES, MARCADORES, CLIPS
- **Editor de metadatos inline**: nombre, descripción, categoría
- **Visor de imagen nativo**: a tamaño completo
- **Reproductor de vídeo HTML5**: con poster
- **Iframe PDF**: con fallback "descarga el archivo"
- **Markdown renderizado**: con marked.js (GFM)
- **Previsualización de texto**: hasta 200 KB
- **Árbol ZIP interactivo**: nivel 1 abierto por defecto, carpetas colapsables

## Selección múltiple

- **Checkbox por canción**: en grid y tabla
- **Barra flotante MultiSelectBar**: con total de bytes seleccionados
- **Descarga ZIP**: archivos agrupados por categoría, evita colisiones de nombre
- **Borrado en bloque**: con confirmación

## Estadísticas y persistencia

- **StatsPanel**: barra de uso segmentada por artista, gráfico de barras por artista
- **DownloadCounter**: odómetro de descargas lifetime
- **Log de actividad**: últimas 200 acciones (UP / DL / DEL)
- **Play counts**: contador de reproducciones por canción (persistido)

## Tweaks visuales

- **TweaksPanel flotante**: ajuste en tiempo real de todos los efectos CRT
- **Controles**: select (fósforo), sliders (scanlines, vignette, chroma, bloom, curvature), toggles (flicker, rollbar, jitter)
- **Persistencia de tweaks**: bloque `/*EDITMODE-BEGIN*/…/*EDITMODE-END*/` en app.jsx
