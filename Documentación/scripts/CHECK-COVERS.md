# CHECK-COVERS — Comprobar qué álbumes tienen portada

Muestra un resumen de cuántos álbumes tienen portada en R2 y lista los que no tienen ninguna.

---

## Cuándo usarlo

- Después de ejecutar `REINDEX-COVERS` para verificar que todo se procesó bien
- Para identificar qué álbumes necesitan portada embebida en sus MP3

---

## Script (consola del navegador)

Abre la app en el navegador → F12 → Console → pega y ejecuta:

```javascript
fetch('/api/files').then(r=>r.json()).then(files => {
  const albums = {};
  files.forEach(f => {
    const key = `${f.category} / ${f.album || '(sin álbum)'}`;
    if (!albums[key]) albums[key] = f.coverUrl;
  });
  const sinPortada = Object.entries(albums).filter(([,url]) => !url).map(([k]) => k).sort();
  const conPortada = Object.entries(albums).filter(([,url]) => url).length;
  console.log(`✅ Con portada: ${conPortada} | ❌ Sin portada: ${sinPortada.length}`);
  if (sinPortada.length) console.log('Sin portada:\n' + sinPortada.join('\n'));
});
```

---

## Notas

- Lee `/api/files` que ya tiene las URLs presignadas de las portadas generadas por `REINDEX-COVERS`
- Si un álbum aparece en la lista es porque su MP3 no tenía imagen embebida en los tags ID3
- Para añadir portada: embebe la imagen en el MP3 con un editor de tags (Mp3tag, MusicBrainz Picard) y vuelve a ejecutar `REINDEX-COVERS`
