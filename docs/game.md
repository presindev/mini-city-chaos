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
- Policía y patrullas (ver [`police.md`](police.md)): `damagePlayer`, `damagePolice`, `isPlayerSeen`, `spawnPolice`, `findPoliceSpawn(onlyType?)`, `patrolCars`, `spawnPatrolCars`.
- `game.reset()`: vuelve al estado inicial de una partida (tiempo, puntos, `scoreTimer`, `newRecord`, jugador, cámara, peatones, balas, efectos, pickups) y recarga el récord.
- `game.start()`: `reset()` y pasa a `'playing'`.
- `game.gameOver()`: de `'playing'` a `'gameover'`; si `floor(score)` supera el récord, lo actualiza, marca `newRecord` y lo guarda con `Hud.saveHighscore`. En otro estado no hace nada. Lo llama `damagePlayer` cuando el jugador muere.
- `game.addTimeScore(dt)`: suma `PER_SECOND` por cada segundo completo acumulado.
- `game.update(dt)`: en `'playing'`: tiempo y puntos por tiempo → jugador (a pie o conduciendo) → `Car.updateAll` → cámara → balas → peatones (y quita los eliminados) → spawner de peatones → policías → `wanted.update(dt, isPlayerSeen())` → `spawnPolice` → `spawnPatrolCars` → pickups (no si va en coche) → `Effects.update`.
- `game.draw(ctx)`: `'menu'` → `Hud.drawMenu`; `'playing'` → `drawWorld`; `'paused'` → `drawWorld` + `Hud.drawPause`; `'gameover'` → `drawWorld` + `Hud.drawGameOver` (se ve la escena final detrás).
- `game.drawWorld(ctx)` dibuja mapa → pickups → cadáveres (peatones y policías) → peatones → coches → policías → jugador → balas → efectos (`swing`, `flash`, `particle`) → HUD (`Hud.draw`).
- El constructor se suscribe a `pedAttacked` (estrellas y sangre), `bulletImpact` (partículas) y `playerHurt` (parpadeo del jugador).

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
| `bulletImpact` | `{x, y, target}` (`target` = `null` si fue un edificio) | `Bullet.update` |
| `pickup` | `{weapon, x, y}` | `Game.update` |
| `carEnter` / `carExit` | `{car}` | `Player.enterNearestCar` / `exitCar` |
| `carCrash` | `{car, speed}` | `Car.crash` (choque fuerte contra edificio o coche) |
| `runOver` | `{target, car}` | `Car.runOver` |
| `wantedChanged` | `{stars, prev}` | `Wanted` (vía `Game.reset`) |
| `copKilled` | `{cop}` | `Game.damagePolice` |
| `copShot` | `{cop}` | `Police.update` |
| `playerHurt` | `{amount, health}` | `Game.damagePlayer` |
| `playerDied` | `{}` | `Game.damagePlayer` |

Quién escucha: `Wanted` (`pedAttacked`), `Effects` (`bulletImpact`, `pedAttacked`, `playerHurt`) y `Sound` (todos; ver [`audio.md`](audio.md)).

`damageTarget`/`damagePedestrian` reciben un `attacker` opcional: solo si es el jugador (o no se indica) se dan puntos y `byPlayer` es `true`.

## Detalles / decisiones
- Transiciones: `menu --Enter--> playing --P--> paused --P--> playing`; `gameover --Enter--> playing` (con `reset`).
- `dt` en segundos, limitado a `CONFIG.MAX_DT` (0,05 s) para que una pestaña en segundo plano no cause saltos enormes.
- Orden de cada frame: `game.update(dt)` → `game.draw(ctx)` → `Input.endFrame()`.
- Las pantallas y el HUD están en `hud.js` (ver [`hud.md`](hud.md)).

## Tests
`tests/game.test.js`: Enter empieza, P pausa/reanuda (el tiempo no avanza en pausa) y reiniciar desde Game Over deja tiempo y puntos a cero, bus de eventos, puntos por segundo (sin perder fracciones ni sumar en pausa), récord (carga, guardado solo si se bate, almacenamiento que lanza excepciones) y reinicio limpio (jugador, inventario, balas, efectos, pickups y peatones nuevos).
