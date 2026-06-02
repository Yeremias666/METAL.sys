# Historial de cambios

Este documento registra las modificaciones importantes realizadas en el proyecto METAL.SYS para que otra persona pueda entender las decisiones, reproducir la web y continuar el desarrollo.

## 2026-06-02

- Añadida carpeta de documentación `Documentación/`
- Creado `Documentación/CHANGELOG.md` con el historial inicial de cambios
- Creado `README.md` en la raíz con descripción de la aplicación y sus funcionalidades
- Actualización de la vista de artista en `app.jsx`:
  - Vista principal de artista ahora muestra discos en cuadrícula
  - Disco con miniatura y vinilo parcial emergente
  - Dentro de cada disco se muestran las canciones correspondientes
  - Buscador en vivo con sugerencias instantáneas (máx. 5 resultados)
  - Búsqueda completa con botón "BUSCAR" que muestra todas las coincidencias
  - Posibilidad de buscar discos y canciones, con etiquetas `DISCO`/`CANCIÓN`
- Corrección de estructura JSX en `app.jsx` para restaurar el renderizado correcto de la página de artista
- Documentado el flujo para actualizar la documentación cuando se agreguen nuevas funciones
