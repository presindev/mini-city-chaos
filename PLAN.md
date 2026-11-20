# PLAN.md — Plan de implementación

Leyenda de estado: `[ ]` pendiente · `[~]` en curso · `[x]` hecho · `[!]` bloqueado (explicar).

Regla: **una feature por sesión**, en orden. Cada paso = un commit.
Tiempo orientativo total: ~60 min de desarrollo (≈7 min por feature).

## Resumen

| ID | Feature | Estado |
|---|---|---|
| F0 | Planificación y documentación inicial | [x] |
| F1 | Esqueleto: canvas, bucle, input, utilidades y tests | [x] |
| F2 | Mapa de la ciudad, cámara y jugador a pie | [x] |
| F3 | Peatones | [x] |
| F4 | Armas, balas y pickups | [x] |
| F5 | Coches: tráfico, robar y conducir | [x] |
| F6 | Nivel de búsqueda y policía | [x] |
| F7 | HUD, minimapa y pantallas (inicio / Game Over) | [x] |
| F8 | Sonido, balanceo y pulido final | [x] |

---

## F0 — Planificación y documentación inicial `[x]`

- [x] Acotar alcance con el usuario
- [x] `PLAN.md` con features, pasos y criterios
- [x] `docs/README.md`

**Criterios de aceptación**
- [x] Una sesión nueva puede empezar F1 leyendo solo los markdowns.

---

## F1 — Esqueleto: canvas, bucle, input, utilidades y tests `[x]`

**Pasos**
- [x] 1.1 `index.html` con canvas 960×640 centrado, fondo oscuro y carga de scripts en orden.
- [x] 1.2 `src/config.js` con `CONFIG` (tamaños de pantalla/tile/mapa y constantes del juego).
- [x] 1.3 `src/utils.js`: `clamp`, `lerp`, `dist`, `angleTo`, `randRange`, `circleRectCollide`, `circleCircleCollide`, `rectsOverlap`.
- [x] 1.4 `tests/utils.test.js` con tests de las funciones de `utils.js` (`node --test tests/` en verde).
- [x] 1.5 `src/input.js`: estado de teclas (`isDown`, `wasPressed` por frame), posición del ratón en canvas, botón pulsado, rueda.
- [x] 1.6 `src/game.js` + `src/main.js`: bucle `requestAnimationFrame` con `dt` limitado, máquina de estados `menu/playing/paused/gameover` (texto provisional por estado), `Enter` empieza, `P` pausa.
- [x] 1.7 Documentar en `docs/` (config, utils, input, game).

**Criterios de aceptación**
- [x] Abrir `index.html` muestra el canvas sin errores en consola. *(Confirmado por el usuario.)*
- [x] `Enter` pasa de "menú" a "jugando"; `P` pausa/reanuda. *(Confirmado por el usuario y cubierto por `tests/game.test.js`.)*
- [x] `node --test tests/` pasa todos los tests (11/11).
- [x] Todos los archivos de `src/` siguen el patrón global + `module.exports`.

---

## F2 — Mapa de la ciudad, cámara y jugador a pie `[x]`

**Pasos**
- [x] 2.1 `src/map.js`: generación determinista de la ciudad 40×40 (patrón de 8 tiles, borde sólido, 2 parques). API: `getTile(tx,ty)`, `isSolid(x,y)`, `isRoad(x,y)`, `worldToTile`, `randomTileOfType(type)`.
- [x] 2.2 `tests/map.test.js`: bordes sólidos, existencia de calles conectadas, consultas correctas.
- [x] 2.3 Dibujo del mapa (solo tiles visibles), colores planos por tipo de tile + líneas de carretera.
- [x] 2.4 `src/camera.js`: sigue al jugador, limitada a los bordes del mapa, `worldToScreen`/`screenToWorld`.
- [x] 2.5 `src/entities/player.js`: círculo con indicador de dirección, WASD, rota hacia el ratón, colisión con edificios (deslizamiento por paredes).
- [x] 2.6 Docs (`map`, `camera`, `player`).

**Criterios de aceptación**
- [x] Se ve una ciudad con calles, aceras, edificios y parque. *(Confirmado por el usuario.)*
- [x] El jugador se mueve con WASD, mira al ratón y no atraviesa edificios ni sale del mapa. *(Confirmado por el usuario y cubierto por tests.)*
- [x] La cámara sigue al jugador y nunca muestra fuera del mapa. *(Confirmado por el usuario y cubierto por tests.)*
- [x] Tests de mapa en verde. *(`node --test tests/` → 26/26, incluye `map`, `camera` y `player`.)*

---

## F3 — Peatones `[x]`

**Pasos**
- [x] 3.1 `src/entities/pedestrian.js`: círculo de color aleatorio, vida, deambula (cambia de dirección cada pocos segundos) por zonas transitables a pie.
- [x] 3.2 Spawner en `game.js`: mantener ~25 peatones vivos, aparecen fuera de cámara.
- [x] 3.3 Estado "huir": método `scare(fromX, fromY)` que los hace correr en dirección contraria unos segundos.
- [x] 3.4 Muerte: `takeDamage(n)`; al morir quedan como mancha unos segundos y se eliminan; +10 puntos (contador provisional en `game.score`).
- [x] 3.5 Docs.

**Criterios de aceptación**
- [x] Hay peatones moviéndose por aceras/parques sin atravesar edificios. *(Confirmado por el usuario y cubierto por tests.)*
- [x] Siempre hay aproximadamente el número configurado de peatones. *(`tests/pedestrian.test.js`.)*
- [x] Llamar a `scare` / `takeDamage` (desde consola) produce huida / muerte visibles. *(Confirmado por el usuario jugando: golpes y disparos.)*

---

## F4 — Armas, balas y pickups `[x]`

**Pasos**
- [x] 4.1 `src/weapons.js`: definiciones (puños, pistola, escopeta) desde `CONFIG`; `fire(owner, angle, game)` respeta cadencia y munición.
- [x] 4.2 `src/entities/bullet.js`: movimiento, alcance máximo, se destruye contra edificios, daña personas (no al que dispara).
- [x] 4.3 Puños: golpe de corto alcance en arco frente al jugador (sin bala), con feedback visual.
- [x] 4.4 Inventario del jugador: `1`/`2`/`3` y rueda para cambiar; solo armas obtenidas; clic dispara.
- [x] 4.5 `src/entities/pickup.js`: pistola/escopeta/munición en puntos fijos del mapa, se recogen al pasar por encima y reaparecen tras N segundos.
- [x] 4.6 Disparar asusta a los peatones cercanos (radio configurable).
- [x] 4.7 Tests de cadencia/munición (`tests/weapons.test.js`), docs.

**Criterios de aceptación**
- [x] Puños, pistola y escopeta funcionan con su daño, alcance y cadencia. *(Confirmado por el usuario y cubierto por tests.)*
- [x] La munición se gasta y se repone con pickups; sin munición no se dispara. *(Confirmado por el usuario y cubierto por tests.)*
- [x] Las balas no atraviesan edificios. *(`tests/weapons.test.js`.)*
- [x] Los peatones mueren al recibir daño suficiente y huyen al oír disparos. *(Confirmado por el usuario y cubierto por tests.)*

---

## F5 — Coches: tráfico, robar y conducir `[x]`

**Pasos**
- [x] 5.1 `src/entities/car.js`: rectángulo rotado con color, física simple (aceleración, fricción, giro proporcional a la velocidad, marcha atrás).
- [x] 5.2 Colisión coche–edificio (rebote/parada) y coche–coche simple.
- [x] 5.3 Tráfico IA: ~10 coches que circulan por la calzada siguiendo la calle y giran en cruces.
- [x] 5.4 `E`: entrar en el coche más cercano (si está a distancia), el conductor IA sale y huye; `E` de nuevo para salir junto al coche.
- [x] 5.5 Conducción del jugador (W/S/A/D); la cámara sigue al coche; no se puede disparar dentro.
- [x] 5.6 Atropellos: a velocidad > umbral, peatones mueren (+puntos). Jugador recibe 50 % del daño de balas dentro del coche. *(El 50 % de daño lo aplica F6 leyendo `player.inCar`.)*
- [x] 5.7 Docs.

**Criterios de aceptación**
- [x] Hay tráfico circulando por las calles sin atravesar edificios. *(tests OK; confirmado por el usuario)*
- [x] Puedo robar un coche con `E`, conducirlo y salir con `E`. *(tests OK; confirmado por el usuario)*
- [x] Los coches no se destruyen; chocan contra edificios. *(tests OK; confirmado por el usuario)*
- [x] Atropellar a velocidad mata peatones. *(tests OK; confirmado por el usuario)*

---

## F6 — Nivel de búsqueda y policía `[x]`

**Pasos**
- [x] 6.1 `src/wanted.js`: estado de estrellas (0–3), eventos (`pedAttacked`, `pedKilled`, `copKilled`), temporizador de "no visto" → baja estrella. Lógica pura.
- [x] 6.2 `tests/wanted.test.js`: subidas, máximo 3, bajada tras 10 s sin ser visto, reinicio del temporizador al ser visto.
- [x] 6.3 Policía a pie (`src/entities/police.js`): persigue al jugador, dispara pistola si tiene visión y está en rango.
- [x] 6.4 Coche patrulla: reutiliza `Car` con IA de persecución; embiste y causa daño por choque. *(Hecho por el integrador tras fusionar F5: `Police.createPatrolCar`/`patrolAI`/`ram` en `police.js`, `Game.spawnPatrolCars`/`patrolCars`.)*
- [x] 6.5 Spawner de policía según estrellas (fuera de cámara), retirada al llegar a 0 ★.
- [x] 6.6 Muerte del jugador (vida 0) → estado `gameover`.
- [x] 6.7 Docs.

**Criterios de aceptación**
- [x] Matar/atacar peatones da estrellas; matar policías sube estrellas hasta 3. *(cubierto por tests; confirmado por el usuario)*
- [x] El número de policías corresponde a la tabla de nivel de búsqueda. *(a pie y coches patrulla cubiertos por tests; confirmado por el usuario)*
- [x] Escondiéndose 10 s de la policía se pierde una estrella. *(cubierto por tests; confirmado por el usuario)*
- [x] La policía puede matar al jugador y se llega a Game Over. *(cubierto por tests; confirmado por el usuario)*
- [x] Tests de `wanted` en verde.

---

## F7 — HUD, minimapa y pantallas `[x]`

**Pasos**
- [x] 7.1 `src/hud.js`: barra de vida, arma actual + munición, estrellas, puntos y tiempo.
- [x] 7.2 Puntos por tiempo sobrevivido (+1/s) y por kills (ya existentes).
- [x] 7.3 Minimapa (esquina): ciudad simplificada, jugador, policías y coches patrulla.
- [x] 7.4 Pantalla de inicio (título + controles) y pausa.
- [x] 7.5 Game Over: puntuación, récord en `localStorage` (`mcc-highscore`, con try/catch), `Enter` reinicia limpio.
- [x] 7.6 Docs.

**Criterios de aceptación**
- [x] El HUD muestra siempre la información correcta y actualizada. (Confirmado por el usuario.)
- [x] El minimapa refleja posiciones reales. (Confirmado por el usuario.)
- [x] El récord persiste al recargar la página. (Confirmado por el usuario; comprobado en Chrome headless y con tests)
- [x] Reiniciar deja la partida en estado inicial (sin restos de la anterior). (test automático; y comprobado en headless tras integrar: 0 ★, sin policías, patrullas ni balas)

---

## F8 — Sonido, balanceo y pulido final `[x]`

**Pasos**
- [x] 8.1 `src/audio.js`: sonidos sintetizados (puño, pistola, escopeta, pickup, choque, sirena corta, muerte). Se activa tras la primera interacción del usuario. Tecla `M` silencia. *(Objeto global `Sound`; tests con `AudioContext` falso. Confirmado por el usuario.)*
- [x] 8.2 Conectar sonidos a eventos del juego. *(`Sound.attach(game)` en `main.js`, incluidos los eventos reservados de F5/F6. Confirmado por el usuario.)*
- [x] 8.3 Feedback visual: destello de disparo, partículas simples de impacto, parpadeo al recibir daño. *(`src/effects.js`; comprobado en captura headless. Confirmado por el usuario.)*
- [x] 8.4 Balanceo de `CONFIG` jugando varias partidas. *(Con simulaciones de supervivencia en vez de partidas reales; valores en `docs/config.md`. Dificultad confirmada por el usuario jugando.)*
- [x] 8.5 Revisión final: sin errores en consola, todos los tests verdes, `docs/` completa, `README.md` de usuario con cómo jugar.

**Criterios de aceptación**
- [x] Cada arma y evento principal tiene sonido; `M` silencia. *(Conectado y testeado con un `AudioContext` falso; confirmado por el usuario.)*
- [x] Una partida típica dura varios minutos y es jugable de principio a fin. *(Confirmado por el usuario.)*
- [x] Sin errores en consola; `node --test tests/` en verde. *(95/95; partida completa en Chrome headless sin errores de JS.)*
- [x] Documentación completa y actualizada.
