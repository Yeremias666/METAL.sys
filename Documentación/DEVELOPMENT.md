# Desarrollo y pruebas locales

## Requisitos

- Navegador moderno: Chrome o Edge (para File System Access API en LOCAL)
- Python 3 o Node.js para servir estáticamente (CORS)

## Servir localmente

```bash
# Python 3
cd "c:/Users/ygmullor/Documents/METAL.sys"
python -m http.server 8000
# Abrir http://localhost:8000/

# Node.js
npx http-server -c-1 . -p 8000
```

> Abrir `index.html` vía `file://` falla por CORS al cargar los `.jsx` con Babel Standalone.

## Flujo de desarrollo

1. Editar `app.jsx` o `crt.css`
2. Recargar el navegador (`Ctrl+R`)
3. Revisar la consola del navegador por errores de JSX/JS
4. Babel Standalone reporta errores de transpilación directamente en consola

## Pruebas manuales recomendadas

### Subida
- Subir un MP3 de `test/` y verificar que aparece en `INICIO` con artista, álbum y portada
- Verificar barra de progreso llega al 100% y desaparece
- Probar `LOCAL` (Chrome/Edge): elegir la carpeta `test/`, importar los 3 MP3

### Reproducción
- Reproducir por artista desde `INICIO`, `LibraryTree`, `CategoryPage`
- Reproducir un disco desde tarjeta de álbum
- Reproducir desde `TODO`, `MESGUSTA`
- Probar shuffle: canciones en orden distinto
- Probar repeat all: al final de cola vuelve al inicio
- Probar repeat one: misma canción se repite
- Reordenar la cola arrastrando en `PlayQueue` → verificar orden correcto
- Crear marcador desde ···, ir al marcador desde MARCADORES en DetailPage
- Crear clip desde ···, reproducir el clip desde CLIPS → verificar bucle

### Like y Me Gusta
- Dar like a una canción desde el reproductor y desde DetailPage
- Verificar que aparece en `♥ GUSTA`
- Reproducir todo desde `MESGUSTA`
- Quitar like → desaparece de `MESGUSTA`

### Estadísticas
- Reproducir varias canciones → ir a `STATS` → verificar contadores y timeline
- Verificar top artistas en `STATS`
- Verificar `TopSongs` en sidebar derecho

### Waveform y CRT sync
- Iniciar reproducción → verificar forma de onda visible en la barra del reproductor
- Escuchar con volumen alto → verificar que el overlay CRT pulsa con la música

### Multi-select
- Seleccionar varias canciones en una página de artista
- Descargar como ZIP → verificar estructura por categoría
- Borrar selección en bloque

## Contribuir

1. Documentar cada cambio en `Documentación/CHANGELOG.md` con fecha ISO
2. Actualizar `Documentación/FUNCTIONS.md` si añades funciones
3. Actualizar `Documentación/FEATURES.md` y `README.md` si añades funcionalidades
4. Actualizar `Documentación/COMMANDS.md` con herramientas usadas
5. Actualizar `Documentación/CONTEXT.md` si el estado del proyecto cambia
