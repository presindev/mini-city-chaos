# src/wanted.js y src/entities/police.js
**Responsabilidad:** `Wanted` lleva el nivel de búsqueda (0–3 ★); `Police` es el policía a pie que persigue y dispara al jugador. `Game` los une (spawner, daño y muerte del jugador).
**Depende de:** `CONFIG` (`WANTED`, `POLICE`), `Utils`, `CityMap`, `Bullet`.

## API pública
### `Wanted` (clase, lógica pura)
- `new Wanted(onChange?)`: empieza con 0 ★. `onChange(stars, prev)` se llama cada vez que cambian las estrellas (el juego lo usa para emitir `wantedChanged`).
- `stars`, `unseenTimer` (segundos sin que ningún policía vea al jugador).
- `setStars(n)`: limita a 0..`MAX_STARS` y reinicia el temporizador si cambia.
- `pedAttacked()`: mínimo 1 ★. `copKilled()`: +1 ★ (máx. 3).
- `update(dt, seen)`: si `seen` o 0 ★, el temporizador vuelve a 0; si llega a `LOSE_STAR_TIME` (10 s) → −1 ★ y el temporizador se reinicia.

### `Police` (clase)
- `new Police(x, y, rng?)`: vida 50, radio 12. `rng` inyectable (cadencia inicial desfasada, puntería, rodeos).
- Propiedades: `x`, `y`, `radius`, `health`, `angle`, `dead`, `leaving` (deja de perseguir y se aleja), `remove`.
- `canSee(x, y)`: distancia ≤ `WANTED.VISION_RADIUS` (350), sin comprobar paredes.
- `takeDamage(amount) → boolean`: `true` si este golpe lo mata (deja cadáver `CORPSE_TIME` s).
- `update(dt, game)`: usa `game.player`, `game.bullets` y, si existen, `game.effects`, `game.scareAt`, `game.emit`.
- `draw(ctx, camera)`: círculo azul marino con gorra negra (visera hacia delante), placa dorada y pistola.

### Integración en `Game`
- `game.wanted` (`Wanted`, nuevo en cada `reset()`), `game.police` (array de `Police`: vivos, cadáveres y los que se van).
- `getTargets()` = peatones + policías + jugador. `damageTarget` reparte a `damagePedestrian`, `damagePolice` o `damagePlayer`.
- `damagePolice(cop, n, x, y, attacker)`: ignora el daño entre policías; al morir emite `copKilled {cop}` y, si lo mató el jugador (o sin atacante), +50 puntos y +1 ★.
- `damagePlayer(n)`: punto único para herir al jugador; ignora el daño que el jugador se hace a sí mismo (desde `damageTarget`). Emite `playerHurt {amount, health}`; a 0 de vida emite `playerDied {}` y llama a `gameOver()`.
- `isPlayerSeen()`: algún policía activo ve al jugador.
- `spawnPolice()`: mantiene `WANTED.FOOT_COPS[stars]` policías persiguiendo; los sobrantes pasan a `leaving` y se borran al estar fuera de cámara. Los nuevos aparecen con `findPoliceSpawn()`: tile de calzada o acera en un anillo de 560–900 px alrededor del jugador y fuera de cámara (margen 64 px).
- `patrolCars()`: coches patrulla activos (`isPolice`, conducidos por la IA, sin `leaving`).
- `spawnPatrolCars()`: mantiene `WANTED.PATROL_CARS[stars]` patrullas; aparecen en calzada (`findPoliceSpawn(ROAD)`) mirando al jugador; los sobrantes pasan a `leaving` y se borran fuera de cámara.
- `isPlayerSeen()` también cuenta los coches patrulla a ≤ `VISION_RADIUS`.
- El listener de `pedAttacked` (solo `byPlayer`) se registra una vez en el constructor y llama a `this.wanted.pedAttacked()`.
- Orden en `update`: … peatones → policías (y quitar `remove`) → `wanted.update(dt, isPlayerSeen())` → `spawnPolice()` → `spawnPatrolCars()` → pickups → efectos.

### Coches patrulla (estáticos de `Police`, paso 6.4)
- `Police.createPatrolCar(x, y, angle)`: un `Car` (F5) con `isPolice = true`, `driver = 'ai'` y `ai = Police.patrolAI`.
- `Police.patrolTarget(car, tx, ty)`: si la línea hasta el jugador está libre (y a < `PATROL_SIGHT`, 700 px) va directo; si no, al cruce alcanzable en línea recta que minimiza `dist(coche, cruce) + dist(cruce, jugador)` (ruta voraz por la cuadrícula de calles; no repite el último cruce).
- `Police.patrolAI(car, dt, game)`: gira hacia el objetivo, reduce gas en curvas cerradas, y si se queda parado `PATROL_STUCK_TIME` da marcha atrás `PATROL_REVERSE_TIME` girando al revés. Con `leaving` se aleja del jugador.
- `Police.ram(car, game)`: a ≥ `RAM_MIN_SPEED` (40 px/s), si toca al jugador: 20 de daño a pie o 10 si va en coche (se pasa `10 / 0,5` porque `takeDamage` ya reduce a la mitad), con enfriamiento `RAM_COOLDOWN` (2 s) por coche.
- Si el jugador roba un coche patrulla, deja de tener IA (es un coche normal suyo); abandonado, desaparece fuera de cámara.

### `Player.takeDamage(amount) → number`
Resta vida (×`CAR.PLAYER_DAMAGE_FACTOR` = 0,5 si `inCar`), marca `dead` a 0 de vida y devuelve el daño aplicado. Los eventos y el Game Over los gestiona `Game.damagePlayer`.

## Detalles / decisiones
- Persecución en línea recta con `CityMap.moveCircle` (se desliza por las paredes). Si avanza menos de la mitad de lo previsto, camina de lado (±90°, al azar) durante `DETOUR_TIME` (0,8 s) para rodear la manzana. Se para a `KEEP_DISTANCE` (110 px) del jugador.
- Dispara si está a < `SHOOT_RANGE` (300 px) cada `FIRE_COOLDOWN` (1,5 s; era 1), con un error de puntería de ±`AIM_ERROR` (12°; era 8) y daño `DAMAGE` (6; era 10), bala a `BULLET_SPEED` 600 px/s y alcance `BULLET_RANGE` 400 px. El disparo asusta a los peatones y deja fogonazo, como el del jugador.
- Las balas de policía que alcanzan a otro policía se paran sin hacer daño; si alcanzan a un peatón le hacen daño pero no cuentan para el jugador.
- Atacar a un policía sin matarlo no da estrellas (solo matarlo).
- Con 0 ★ todos los policías pasan a `leaving`: se alejan del jugador y desaparecen al salir de cámara. Si el jugador está muerto, también se alejan.

## Tests
- `tests/wanted.test.js`: subidas, máximo 3, bajada tras 10 s sin ser visto (y reinicio), ser visto reinicia el temporizador, `onChange`.
- `tests/patrol.test.js`: número de patrullas según estrellas (en calzada, fuera de cámara) y retirada; el patrulla llega hasta el jugador por la cuadrícula sin pisar edificios (3 semillas) y embiste; daño 20/10 con enfriamiento y velocidad mínima; los patrullas ven al jugador.
- `tests/police.test.js`: persecución y distancia mínima, no atraviesa edificios y rodea una manzana, disparo con rango y cadencia (`copShot`), visión, muerte y cadáver, retirada; jugador con 50 % de daño en coche; integración con `Game`: estrellas por atacar peatones, número de policías según la tabla, retirada con 0 ★, matar policía (+50, +1 ★, `copKilled`, sin fuego amigo), daño y muerte del jugador → `gameover`, pérdida de estrella escondido.
