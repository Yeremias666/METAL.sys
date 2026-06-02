# Reproducción — comportamiento y lógica

## Contexto (`playContext`)

```js
{ type: 'all' | 'artist' | 'album', artist?, album?, shuffle: boolean }
```

- `type: 'all'` — toda la biblioteca
- `type: 'artist'` — canciones de un artista
- `type: 'album'` — canciones de un disco de un artista

## Cola efectiva

```js
const musicQueueBase = useMemo(() => getQueueForContext(playContext), [...]);
const musicQueue     = useMemo(() => playContext.shuffle ? shuffleArray(musicQueueBase) : musicQueueBase, [...]);
const effectiveQueue = manualQueue || musicQueue;
```

`manualQueue` se activa cuando el usuario arrastra para reordenar en `PlayQueue`. Se limpia al llamar `playScope()` o `toggleShuffle()`.

## Funciones principales

| Función | Descripción |
|---|---|
| `getQueueForContext(ctx)` | Filtra `files.filter(isAudioFile)` por artista/álbum/todo |
| `shuffleArray(items)` | Fisher-Yates, no muta el original |
| `playScope(ctx, shuffle)` | Limpia manualQueue, actualiza playContext, inicia pista 1 |
| `startTrack(file, ctx?)` | Carga fileData en audio, incrementa playCount, decodifica waveform |
| `playNext(wrap)` | Busca índice en effectiveQueue, avanza (con/sin wrap al inicio) |
| `playPrev()` | Retrocede en effectiveQueue |

## Modos de reproducción

### Shuffle
- `toggleShuffle()` → flip `playContext.shuffle` + limpia manualQueue
- Si shuffle activo: `musicQueue = shuffleArray(musicQueueBase)`
- Si manualQueue activo: shuffle no afecta (manualQueue tiene precedencia)

### Repeat
- `repeatMode: 'off' | 'all' | 'one'`
- `toggleRepeat()` cicla: off → all → one → off
- En `audio.ended`:
  - `one` → seek(0) + play (misma pista)
  - `all` → playNext(true) (vuelve al inicio si llega al final)
  - `off` → playNext(false) (para al final)

## Clips en bucle

- `activeClip: { id, start, end }` — establecido por `playClip(clip)`
- En `audio.timeupdate (onTime)`:
  ```js
  if (clip && audio.currentTime >= clip.end) audio.currentTime = clip.start;
  ```
- `activeClipRef` sincronizado con state para evitar stale closure en `onTime`
- `stopClip()` / cambio de pista limpia `activeClip`

## Play counts

- Se incrementa en `startTrack` cuando es una pista nueva (id diferente al `currentTrackId`)
- Persistido en `metalsys_playcounts_v1`
- Usado en `TopSongs` y `StatsPage`

## Waveform

- En `startTrack`, si no hay waveform cacheada para el fileId:
  1. `fetch(file.fileData)` → arrayBuffer
  2. `OfflineAudioContext.decodeAudioData(buf)` → AudioBuffer
  3. `getChannelData(0)` → Float32Array de samples
  4. Downsample a 300 puntos (RMS por bloque)
  5. `setWaveforms(prev => ({...prev, [file.id]: out}))`
- Renderizado en `MusicPlayer` como SVG con dos polylines simétricas

## CRT sync

- `useEffect([isPlaying])` → cuando hay reproducción, inicia RAF loop
- Lee RMS de `AnalyserNode` (TimeDomain data)
- Modifica `.crt-audio-pulse.style.opacity` directamente en DOM (no state para evitar re-renders)
- RMS formula: `sqrt(sum((sample/128-1)^2) / length)`
- Escala: `Math.min(1, rms * 2.5)`

## Botones de reproducción contextual

| Lugar | Acción |
|---|---|
| `HomePage` → tarjeta artista | `playScope({ type:'artist', artist }, false)` |
| `CategoryPage` → tarjeta álbum | `playScope({ type:'album', artist, album }, false)` |
| `TodoPage` → "REPRODUCIR TODO" | `playScope({ type:'all' }, false)` |
| `MeGustaPage` → "REPRODUCIR ME GUSTA" | `setManualQueue(likedAudio)` + `startTrack(first)` |
| `LibraryTree` → botón ▶ artista | `playScope({ type:'artist', artist }, false)` |
| `LibraryTree` → botón ▶ disco | `playScope({ type:'album', artist, album }, false)` |
| `PlayQueue` → click pista | `startTrack(file)` |

## Stale closure (nota técnica)

`playNext` es capturado en el closure de `onEnded` (audio useEffect con deps `[currentTrackId, repeatMode]`). Si `manualQueue` cambia sin que cambie `currentTrackId`, `onEnded` tiene un `playNext` stale con la cola anterior. Comportamiento aceptable: al cambiar de pista el efecto se re-ejecuta con closures frescos.
