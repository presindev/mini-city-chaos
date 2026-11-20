# src/game.js y src/main.js
**Responsabilidad:** `Game` mantiene el estado de la partida y su máquina de estados; `main.js` arranca el juego y ejecuta el bucle.
**Depende de:** `CONFIG`, `CityMap`, `Camera`, `Player`, `Pedestrian`, `Weapons`, `Pickup`, `Car`, `Wanted`, `Police`, `Hud`, `Effects`, `Input` (inyectado en `Game`). `main.js` además usa `Sound`.

## API pública
### `Game` (clase)
- `new Game(input, rng?)`: empieza en el estado `'menu'`. `input` necesita `wasPressed(code)`, `isDown(code)`, `wheel` y `mouse {x, y, down}` (en el navegador es el `Input` global; en los tests, un stub). `rng` (por defecto `Math.random`) se usa para los peatones.
- `game.state`: `'menu' | 'playing' | 'paused' | 'gameover'`.
- `game.time`: segundos sobrevividos en la partida actual; `game.score`: puntos (kills + `CONFIG.SCORE.PER_SECOND` por cada segundo completo sobrevivido; `game.scoreTimer` guarda la fracción pendiente).
- `game.highscore`: récord cargado en cada `reset()`; `game.newRecord`: `true` si la última partida lo batió. `game.storage` (opcional, `getItem`/`setItem`) permite inyectar un almacenamiento en los tests; si es `undefined` se usa `localStorage`.
- `game.player` (`Player`), `game.camera` (`Camera`), `game.pedestrians`, `game.bullets`, `game.pickups`, `game.effects`, `game.cars` (tráfico, aparcados y patrullas), `game.wanted` (`Wanted`), `game.police` (policías a pie): se crean de nuevo en cada `reset()`.
- `game.spawnPedestrians()`: rellena hasta 25 peatones vivos en aceras (o parques, 15 %) fuera de cámara.
- `game.isOnScreen(x, y, margin?)`, `game.scareAt(x, y, radius)`, `game.damagePedestrian(ped, n, fromX?, fromY?, attacker?)` (+10 puntos si muere a manos del jugador).
- `game.getTargets()`: peatones + policías + jugador (lo que pueden dañar balas, puños y atropellos; cada uno se salta a su `owner`/al jugador). `game.damageTarget(t, n, x, y, attacker)` reparte a `damagePedestrian`, `damagePolice` o `damagePlayer`.
- `game.damageCar(car, n, attacker)` (MCC-001): punto único para dañar coches (balas, choques, explosiones). Ignora la chatarra, los coches que ya arden y `n ≤ 0`. Resta vida y apunta `car.byPlayer = (attacker === player)`. A 0 de vida: `burnTimer = CAR.BURN_TIME`, `noReward` si lo conducía el jugador, saca al conductor IA de un coche civil (`ejectDriver`, `driver = null`; el patrulla sigue con su IA) y emite `carBurning {car}`.
- `game.explodeCar(car)` (MCC-001): lo llama `Car.update` cuando `burnTimer` llega a 0. Convierte el coche en chatarra (`wreck`, `WRECK_TIME`, parado, sin conductor). Si el jugador sigue dentro, `player.forceExit` y `damagePlayer(EXPLOSION_DAMAGE)` completo (sin la reducción del coche); si no, daño con caída lineal si está a < `EXPLOSION_RADIUS`. Daña con la misma caída a peatones y policías (`damageTarget` con el jugador como atacante solo si la explosión es suya; si no, el propio coche) y a los demás coches (`damageCar`, reacción en cadena). Si `byPlayer && !noReward`: +`SCORE.PATROL_CAR` y `wanted.copKilled()` (+1 ★) para un patrulla, o +`SCORE.CAR` y `wanted.pedAttacked()` (≥ 1 ★) para un coche civil. Las muertes de la explosión se cuentan antes que el premio del coche. Asusta a los peatones en `SCARE_RADIUS` y emite `carExploded {car, x, y, byPlayer}`.
- `game.emitCarSmoke(dt)` (MCC-001): cada frame, en los coches en pantalla, llamas si arden (`Effects.fire`) o humo si su vida es ≤ `CAR.SMOKE_HEALTH` (`Effects.smoke`; también la chatarra).
- Policía y patrullas (ver [`police.md`](police.md)): `damagePlayer`, `damagePolice`, `isPlayerSeen`, `spawnPolice`, `findPoliceSpawn(onlyType?)`, `patrolCars`, `spawnPatrolCars`.
- `game.reset()`: vuelve al estado inicial de una partida (tiempo, puntos, `scoreTimer`, `newRecord`, jugador, cámara, peatones, balas, efectos, pickups) y recarga el récord.
- `game.start()`: `reset()` y pasa a `'playing'`.
- `game.gameOver()`: de `'playing'` a `'gameover'`; si `floor(score)` supera el récord, lo actualiza, marca `newRecord` y lo guarda con `Hud.saveHighscore`. En otro estado no hace nada. Lo llama `damagePlayer` cuando el jugador muere.
- `game.addTimeScore(dt)`: suma `PER_SECOND` por cada segundo completo acumulado.
- `game.update(dt)`: en `'playing'`: tiempo y puntos por tiempo → jugador (a pie o conduciendo) → `Car.updateAll` → cámara → balas → peatones (y quita los eliminados) → spawner de peatones → policías → `wanted.update(dt, isPlayerSeen())` → `spawnPolice` → `spawnPatrolCars` → pickups (no si va en coche) → `emitCarSmoke` (MCC-001) → `Effects.update`.
- `game.draw(ctx)`: `'menu'` → `Hud.drawMenu`; `'playing'` → `drawWorld`; `'paused'` → `drawWorld` + `Hud.drawPause`; `'gameover'` → `drawWorld` + `Hud.drawGameOver` (se ve la escena final detrás).
- `game.drawWorld(ctx)` dibuja mapa → pickups → cadáveres (peatones y policías) → peatones → coches → policías → jugador → balas → efectos (`swing`, `flash`, `particle`) → HUD (`Hud.draw`).
- El constructor se suscribe a `pedAttacked` (estrellas y sangre), `bulletImpact` (partículas), `playerHurt` (parpadeo del jugador), `carBurning` (llamas) y `carExploded` (explosión).

### `Main`
- `Main.start()`: se ejecuta solo al cargar la página. Inicializa `Input`, crea `Game` (lo expone como `window.game` para depurar), `Sound.attach(game)`, desbloquea el audio en la primera tecla/clic, gestiona `M` (silencio, con etiqueta "SILENCIO (M)") y lanza `requestAnimationFrame`.

### Eventos (`game.on(name, fn)` / `game.emit(name, data)`)
Bus de eventos mínimo para que los sistemas se enganchen sin depender unos de otros (`fn(data, game)`). Los oyentes sobreviven a `reset()`.

| Evento | Datos | Lo emite |
|---|---|---|
| `pedAttacked` | `{ped, byPlayer, killed}` | `damagePedestrian` |
| `pedKilled` | `{ped, byPlayer}` | `damagePedestrian` |
| `shot` | `{weapon, x, y, owner}` | `Weapons.fire` (armas de fuego) |
| `punch` | `{hit, x, y, owner}` | `Weapons.punch` |
| `bulletImpact` | `{x, y, target}` (`target` = `null` si fue un edificio o un coche; si fue un coche, además `car`) | `Bullet.update` |
| `pickup` | `{weapon, x, y}` | `Game.update` |
| `carEnter` / `carExit` | `{car}` | `Player.enterNearestCar` / `exitCar` |
| `carCrash` | `{car, speed}` | `Car.crash` (choque fuerte contra edificio o coche) |
| `runOver` | `{target, car}` | `Car.runOver` |
| `carBurning` | `{car}` | `Game.damageCar` (el coche llega a 0 de vida y empieza a arder; MCC-001) |
| `carExploded` | `{car, x, y, byPlayer}` (`byPlayer`: la explosión se atribuye al jugador y da premio) | `Game.explodeCar` (MCC-001) |
| `wantedChanged` | `{stars, prev}` | `Wanted` (vía `Game.reset`) |
| `copKilled` | `{cop}` | `Game.damagePolice` |
| `copShot` | `{cop}` | `Police.update` |
| `playerHurt` | `{amount, health}` | `Game.damagePlayer` |
| `playerDied` | `{}` | `Game.damagePlayer` |

Quién escucha: `Wanted` (`pedAttacked`), `Effects` (`bulletImpact`, `pedAttacked`, `playerHurt`, `carBurning`, `carExploded`) y `Sound` (todos; ver [`audio.md`](audio.md)).

`damageTarget`/`damagePedestrian` reciben un `attacker` opcional: solo si es el jugador (o no se indica) se dan puntos y `byPlayer` es `true`.

**Atribución de coches (MCC-001):** un coche recuerda solo su último daño (`byPlayer`): bala del jugador, choque en el que el jugador conducía cualquiera de los dos coches o explosión atribuida al jugador. Se congela al empezar a arder. Si ardía mientras lo conducía el jugador, nunca da puntos ni estrellas.

## Detalles / decisiones
- Transiciones: `menu --Enter--> playing --P--> paused --P--> playing`; `gameover --Enter--> playing` (con `reset`).
- `dt` en segundos, limitado a `CONFIG.MAX_DT` (0,05 s) para que una pestaña en segundo plano no cause saltos enormes.
- Orden de cada frame: `game.update(dt)` → `game.draw(ctx)` → `Input.endFrame()`.
- Las pantallas y el HUD están en `hud.js` (ver [`hud.md`](hud.md)).

## Tests
`tests/game.test.js`: Enter empieza, P pausa/reanuda (el tiempo no avanza en pausa) y reiniciar desde Game Over deja tiempo y puntos a cero, bus de eventos, puntos por segundo (sin perder fracciones ni sumar en pausa), récord (carga, guardado solo si se bate, almacenamiento que lanza excepciones) y reinicio limpio (jugador, inventario, balas, efectos, pickups y peatones nuevos). `damageCar`/`explodeCar` y sus eventos: `tests/car-damage.test.js` (ver [`car.md`](car.md)).
