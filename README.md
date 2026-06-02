# METAL.SYS

METAL.SYS es un reproductor web personal con estética retro de CRT y un gestor local de archivos multimedia. Está diseñado para funcionar completamente en el navegador, sin servidor ni login: los archivos se almacenan en `localStorage` y se accede a ellos desde una interfaz que imita una consola underground.

## ¿Qué hace esta web?

- Permite subir archivos de audio, imágenes, vídeo, PDF y otros tipos compatibles.
- Lee metadatos ID3 de MP3 para extraer título, artista, álbum, año y portada.
- Clasifica automáticamente los archivos en categorías como `MÚSICA`, `DOCUMENTOS`, `IMÁGENES`, `VIDEOS`, `JUEGOS` y `OTROS`.
- Ofrece una vista principal con resumen de la biblioteca y artistas.
- Permite navegar por artista y álbumes, con miniaturas y una experiencia visual tipo cassette/vinilo.
- Incluye un buscador avanzado que muestra coincidencias en vivo y resultados filtrados por discos y canciones.
- Estilo retro con efectos de scanlines, vignette, cromáticos, parpadeo y un diseño inspirado en hardware old-school.

## Funciones principales

- Almacenamiento local en el navegador (`localStorage`)
- Generación de miniaturas y soporte de portadas de álbum
- Reproductor de audio con visualización de barras VU
- Previsualización de imágenes, vídeo, PDF y texto
- Página de detalles de archivos con edición de metadatos
- Gestor de categorías y creación de nuevas categorías con iconos
- Búsqueda con sugerencias en vivo y resultados completos

## Archivos importantes

- `index.html` – entrada principal de la aplicación
- `app.jsx` – lógica y componentes principales de la web
- `crt.css` – estilos e interfaz CRT retro
- `tweaks-panel.jsx` – controles de ajustes visuales y editor de tweaks
- `Documentación/CHANGELOG.md` – historial de cambios y notas de desarrollo

## Cómo reproducir la web

1. Abrir `index.html` en un navegador compatible con ES6 y React.
2. Asegurarse de tener conexión a Internet para cargar las dependencias externas:
   - React
   - ReactDOM
   - Babel Standalone
   - JSZip
   - marked
3. Subir archivos usando el panel de carga o arrastrar y soltar.
4. Navegar entre artistas, discos y canciones desde la interfaz.

## Actualización de documentación

Cada vez que se agregue o cambie alguna funcionalidad, se debe:

1. Añadir una entrada nueva en `Documentación/CHANGELOG.md` con la fecha y el detalle del cambio.
2. Actualizar este `README.md` si la nueva función modifica la descripción general del proyecto o su uso.

## Futuras mejoras sugeridas

- Añadir soporte para descargas masivas en ZIP desde la interfaz de artista
- Mejorar la generación de miniaturas con soporte para más formatos de imagen
- Añadir temas adicionales para la estética CRT
- Soporte offline completo con Service Worker
