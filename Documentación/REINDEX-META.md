# REINDEX-META — Script de metadatos ID3 desde R2

Lee los tags ID3 de todos los MP3 en R2 (título, artista, álbum, año, género, pista, disco)
y los guarda en `_meta/index.json` dentro del bucket. `files.js` lee ese índice en cada carga
para devolver metadatos reales en lugar de parsear el nombre del archivo.

---

## Cuándo ejecutarlo

- **Primera vez**: tras subir todos los MP3 a R2
- **Al añadir canciones nuevas**: después de subir los archivos nuevos
- **No hace falta**: para visitas normales — la app lee el índice ya generado

El script detecta automáticamente qué archivos no están en el índice y solo procesa esos.
Los que ya tienen metadatos nunca se sobreescriben.

---

## Script (consola del navegador)

Abre la app en el navegador → F12 → Console → pega y ejecuta:

```javascript
(async () => {
  let offset = 0, total = '?', ok = 0;
  while (true) {
    const r = await fetch(`/api/reindex-meta?offset=${offset}`).then(r=>r.json());
    if (r.error) { console.error('Error:', r.error); break; }
    total = r.total; ok += r.processed;
    console.log(`${offset + r.batchSize}/${total} — indexadas OK: ${ok}`);
    if (r.done) { console.log(`✅ Completo. ${ok}/${total} canciones indexadas`); break; }
    offset = r.next;
  }
})();
```

---

## Tiempo estimado

- ~8 canciones cada 5-15 segundos
- 100 canciones → ~1-3 minutos
- Progreso visible línea a línea en la consola

---

## Notas técnicas

- El endpoint es `GET /api/reindex-meta?offset=N` (Cloudflare Pages Function)
- Descarga los primeros 256 KB de cada MP3 (suficiente para cualquier cabecera ID3)
- Parsea ID3v2.2 (3 chars), v2.3 y v2.4 (4 chars)
- Guarda el índice acumulado en R2 como `_meta/index.json` tras cada batch
- `files.js` lee `_meta/index.json` al arrancar y fusiona los datos con el listado de archivos
- Si un archivo no está en el índice, `files.js` hace fallback al parsing del nombre del archivo
