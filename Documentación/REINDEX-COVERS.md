# REINDEX-COVERS — Script de portadas R2

Extrae las portadas embebidas en los MP3 y las sube a R2 como archivos independientes
en `_covers/Artista/Album.jpg`. Solo hace falta ejecutarlo cuando se añaden álbumes nuevos.

---

## Cuándo ejecutarlo

- **Primera vez**: tras subir todos los MP3 a R2
- **Al añadir álbumes nuevos**: después de subir los archivos nuevos a R2
- **No hace falta**: para visitas normales a la app — las portadas ya están en R2

El script detecta automáticamente qué álbumes no tienen portada y solo procesa esos.
Los álbumes que ya tienen portada se saltan.

---

## Script (consola del navegador)

Abre la app en el navegador → F12 → Console → pega y ejecuta:

```javascript
(async () => {
  let offset = 0, total = '?', ok = 0;
  while (true) {
    const r = await fetch(`/api/reindex-covers?offset=${offset}`).then(r=>r.json());
    total = r.total; ok += r.processed;
    console.log(`${offset + r.batchSize}/${total} — subidas OK: ${ok}`);
    if (r.done) { console.log(`✅ Completo. ${ok}/${total} portadas subidas`); break; }
    offset = r.next;
  }
})();
```

---

## Tiempo estimado

- ~8 álbumes cada 10-20 segundos
- 281 álbumes → ~6-10 minutos en total
- Progreso visible línea a línea en la consola

---

## Notas técnicas

- El endpoint es `GET /api/reindex-covers?offset=N` (Cloudflare Pages Function)
- Descarga los primeros 2 MB de un MP3 representativo por álbum
- Extrae la portada (JPEG o PNG) del tag ID3 (v2.2, v2.3 y v2.4)
- La sube a R2 como `_covers/Artista/Album.jpg`
- `files.js` genera URLs presignadas de 7 días para esas portadas en cada carga
- Si una portada no se encuentra (MP3 sin tag ID3), ese álbum queda sin portada
