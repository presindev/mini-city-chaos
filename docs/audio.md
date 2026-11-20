# src/audio.js (`Sound`) y src/effects.js (`Effects`)
**Responsabilidad:** `Sound` sintetiza los efectos de sonido con WebAudio y los conecta al bus de eventos del juego; `Effects` crea, actualiza y dibuja los efectos visuales cortos (partículas, destello de disparo) de `game.effects`.
**Depende de:** `CONFIG` (secciones `AUDIO`, `EFFECTS` y `CAR.MAX_SPEED`). `Sound.attach` usa `game.on`. Orden de carga en `index.html`: `effects.js` → `audio.js` → `game.js` → `main.js`.

## API pública
### `Sound` (objeto)
Se llama `Sound` y no `Audio` para no tapar el constructor nativo `Audio` del navegador.
- `Sound.unlock(AudioCtor?) → boolean`: crea (una sola vez) el `AudioContext` (`AudioContext` o `webkitAudioContext` para Safari) con un nodo de volumen maestro y un búfer de ruido, y lo reanuda si está suspendido. Debe llamarse dentro de un gesto del usuario. Devuelve `false` si no hay WebAudio. `AudioCtor` permite inyectar un contexto falso en los tests.
- `Sound.play(name, volume = 1, source = null) → boolean`: reproduce una receta de `Sound.SOUNDS`. No hace nada (devuelve `false`) si no hay contexto, si está en silencio, si el nombre no existe o si se supera el límite de repeticiones. `source` (opcional) evita que el mismo emisor dispare el mismo sonido dos veces en el mismo instante.
- `Sound.toggleMute() → muted`, `Sound.setMuted(bool)`, `Sound.muted`.
- `Sound.attach(game)`: se suscribe con `game.on` a todos los eventos de la tabla. Basta con llamarlo una vez (los oyentes sobreviven a `reset()`).
- `Sound.reset()`: olvida el contexto (para tests).
- Bloques internos: `tone(t, {type, freq, freqEnd, dur, vol, attack})` (oscilador con barrido de frecuencia), `noise(t, {dur, vol, filter, freq, freqEnd, q, attack})` (ruido blanco filtrado), `envelope(t, vol, attack, dur)`.

| Evento | Sonido (`Sound.SOUNDS`) |
|---|---|
| `shot` `{weapon, owner}` | `pistol` / `shotgun` si `owner` es el jugador; `copShot` si es otro (la policía puede reutilizar `Weapons.fire`) |
| `punch` `{hit}` | `punchHit` (golpe seco) / `punchMiss` (silbido) |
| `bulletImpact` `{target}` | `hitWall` (chasquido agudo) / `hitFlesh` (golpe sordo) |
| `pickup` | `pickup` (dos notas ascendentes) |
| `pedKilled` | `death` (tono descendente) |
| `carEnter` / `carExit` | `carDoor` (portazo) |
| `carCrash` `{speed}` | `crash`, volumen proporcional a `speed / CAR.MAX_SPEED` (mín. 0,3) |
| `runOver` | `runOver` (golpe grave) |
| `wantedChanged` `{stars, prev}` | `siren` (dos tonos, dos veces) **solo si sube** |
| `copKilled` | `copDeath` |
| `copShot` `{cop}` | `copShot` (con *dedupe* por `cop`, por si también llega un `shot` del mismo policía) |
| `playerHurt` | `hurt` |
| `playerDied` | `gameOver` (cuatro notas descendentes) |

### `Effects` (objeto)
Todos los efectos de `game.effects` tienen `{kind, x, y, time}` (coordenadas de mundo, `time` = vida restante). Tipos: `swing` (puños, lo crea `Weapons.punch`), `flash` (destello, lo crea `Weapons.fire`) y `particle` (`{vx, vy, maxTime, size, color}`).
- `burst(effects, x, y, {count, speed, colors, angle?, size?}, rng?)`: añade partículas en direcciones aleatorias y aplica el límite.
- `impact(effects, {x, y, target}, rng?)`: chispas grises/amarillas si `target` es `null` (edificio); rojas si hay `target`.
- `blood(effects, {x, y}, rng?)`: salpicadura de sangre.
- `cap(effects)`: si hay más de `MAX_PARTICLES` partículas, quita las más antiguas (no toca `swing`/`flash`).
- `countParticles(effects)`.
- `update(effects, dt) → effects vivos`: resta `dt` a todos, mueve las partículas con rozamiento exponencial y filtra las acabadas.
- `drawParticle(ctx, p, e)` (cuadradito que se desvanece) y `drawFlash(ctx, p, e)` (bola + cono en la dirección del disparo, se desvanece).

## Integración
- **`main.js`**: `Sound.attach(game)`; `keydown`/`mousedown` en `window` llaman a `Sound.unlock()`; cada frame, `Input.wasPressed('KeyM')` → `Sound.toggleMute()`; si está en silencio dibuja la etiqueta "SILENCIO (M)" abajo en el centro. El audio no está en `Game` para que los tests de Node no dependan de él.
- **`game.js`**: en el constructor se suscribe a `bulletImpact` → `Effects.impact`, `pedAttacked` → `Effects.blood` y `playerHurt` → `player.hurtTimer = EFFECTS.HURT_FLASH_TIME`. `update` usa `Effects.update`; `drawEffects` dibuja `flash` y `particle` con `Effects`.
- **`player.js`**: `hurtTimer` (0 al crear, baja en `update`); mientras sea > 0 el cuerpo parpadea en rojo (`HURT_BLINK_RATE` veces/s).

## Detalles / decisiones
- Volumen maestro `AUDIO.MASTER_VOLUME` (0,35). Límite anti-saturación: como mucho `MAX_SAME_SOUND` (3) reproducciones del mismo sonido en `THROTTLE_WINDOW` (0,05 s); p. ej. los 5 perdigones de la escopeta producen 3 impactos audibles.
- Cualquier excepción dentro de una receta se ignora: el audio nunca rompe el juego. Sin `AudioContext` todo es *no-op*.
- Las partículas usan `Math.random` (no el `rng` del juego) para no alterar la secuencia de los peatones en los tests.
- Límite de partículas `EFFECTS.MAX_PARTICLES` (120). Vida `PARTICLE_TIME` (0,35 s, ±40 %).

## Tests
- `tests/audio.test.js`: *no-op* sin `AudioContext`; todas las recetas suenan con un `AudioContext` falso; `unlock` crea un único contexto y lo reanuda; silencio (nada suena y ganancia 0); límite de repeticiones; *dedupe* por emisor; `attach` se suscribe a los 14 eventos, los mapea al sonido correcto (sirena solo al subir) y sobrevive a `reset()`.
- `tests/effects.test.js`: impactos/sangre crean el número y color de partículas configurados; las partículas se mueven, frenan y desaparecen; límite de partículas; `Game` convierte `bulletImpact`/`pedAttacked`/`playerHurt` en partículas y parpadeo, y el temporizador baja a 0.
- Sonido y aspecto: prueba manual.
