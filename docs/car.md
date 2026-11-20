# src/entities/car.js
**Responsabilidad:** coches indestructibles: física arcade, colisiones con edificios y entre coches, tráfico IA, robar/conducir (junto con `Player`) y atropellos.
**Depende de:** `CONFIG` (sección `CAR`), `Utils`, `CityMap`; `Pedestrian` (solo para sacar al conductor al robar el coche).

## API pública
### `Car` (clase)
- `new Car(x, y, angle = 0, color)`: propiedades `x`, `y`, `angle` (radianes, 0 = mirando a +x), `speed` (px/s sobre el eje del coche; negativa = marcha atrás), `width` (48, largo), `height` (24, ancho), `color`, `driver` (`'ai' | 'player' | null`; `null` = aparcado), `isPolice` (`false`), `controls = {throttle, steer}` (−1..1), `ai` (opcional), `route` (estado del tráfico), `remove`.
- `car.update(dt, game)`: si `driver === 'ai'` rellena `controls` con `car.ai(car, dt, game)` si existe o con la IA de tráfico; si `driver === null` pone los controles a 0; aplica la física. Si lo conduce el jugador, copia `x/y/angle` del coche a `game.player` y comprueba atropellos.
- `car.draw(ctx, camera)`: rectángulo rotado con sombra, parabrisas delantero, luna trasera y faros (el frente es +x local). Si `isPolice`: blanco y negro con barra de luces roja/azul.
- `car.distanceTo(px, py)`: distancia de un punto a la carrocería (rectángulo rotado), 0 si está dentro.
- `car.pushOut(person)`: empuja un círculo `{x, y, radius}` fuera del coche (sin meterlo en edificios).
- `car.runOver(game)`: si `|speed| > RUN_OVER_SPEED`, mata lo que toque de `game.getTargets()` (salvo `game.player`) con `game.damageTarget(t, 9999, car.x, car.y, game.player)` y emite `runOver {target, car}`.
- `car.ejectDriver(game)`: crea un `Pedestrian` asustado junto al coche (el conductor IA huye).
- `car.freeSpotBeside(r, game)`: primer hueco libre (izquierda, derecha, delante, detrás) para un círculo de radio `r`, o `null`.
- `car.initRoute(rng)`: calcula la ruta de tráfico a partir de la pose actual.
- Estáticos: `Car.circles(x, y, angle)`, `Car.hitsSolid(x, y, angle)`, `Car.trafficAI(car, dt, game)`, `Car.obstacleAhead(car, game)`, `Car.randomTrafficCar(rng)`, `Car.isTraffic(car)`, `Car.spawnTraffic(game)`, `Car.resolveCollisions(game)`, `Car.updateAll(dt, game)`, y utilidades de la cuadrícula (`laneX`, `laneY`, `nodeCenter`, `validNode`, `waypoint`, `chooseExit`).

### Integración (en otros módulos)
- `Game`: `game.cars` se crea en `reset()` (y se rellena con `Car.spawnTraffic`). En `update`, tras `player.update`, se llama a `Car.updateAll(dt, game)` (actualiza todos los coches, separa coches, empuja personas, quita coches abandonados fuera de cámara y repone el tráfico) y **después** la cámara sigue a `player.x/y` (que ya está sobre el coche). Los pickups reciben `null` como jugador si va en coche. Los coches se dibujan después de los peatones y antes del jugador.
- `Player`: `player.inCar` (`null` o el `Car`). `E` llama a `enterNearestCar(game)` / `exitCar(game)`; dentro, `drive(dt, game)` traduce W/S/A/D a `controls`; se puede cambiar de arma pero no disparar ni apuntar; `draw` no pinta nada.

### Eventos emitidos
| Evento | Datos | Cuándo |
|---|---|---|
| `carEnter` | `{car}` | el jugador entra (`Player.enterNearestCar`) |
| `carExit` | `{car}` | el jugador sale (`Player.exitCar`) |
| `carCrash` | `{car, speed}` | un choque contra edificio u otro coche hace perder ≥ `CRASH_SPEED` px/s (máx. uno cada `CRASH_COOLDOWN` s por coche) |
| `runOver` | `{target, car}` | atropello mortal del coche del jugador |

## Detalles / decisiones
- **Física:** W acelera (`ACCELERATION`), S frena (`BRAKE`) y luego da marcha atrás; sin pedal, `FRICTION`. Velocidad entre `-MAX_REVERSE_SPEED` y `MAX_SPEED`. El giro es `TURN_RATE · steer · clamp(speed / TURN_FULL_SPEED, −1, 1)`: parado no gira, marcha atrás invierte el giro, y por encima de 120 px/s gira a 3 rad/s (radio ≈ velocidad / 3).
- **Colisión:** el coche es una cápsula de 3 círculos de radio 12 a lo largo del eje. Se mueve en sub-pasos de 4 px; si choca prueba cada eje por separado (desliza por la pared perdiendo la parte bloqueada de la velocidad) y si queda bloqueado rebota (`speed = −speed · BOUNCE`). Si girar lo metería en un edificio, no gira.
- **Coche–coche:** se busca el par de círculos más solapado y se separan ambos a partes iguales (sin entrar en edificios); los dos pierden velocidad (`CAR_HIT_DAMPING`).
- **Personas:** cualquier coche empuja fuera a peatones, objetivos de `getTargets()` y al jugador a pie. Solo el coche del jugador mata (por encima de `RUN_OVER_SPEED`); el tráfico no mata a nadie. El jugador puede conducir por aceras y parques (solo los edificios son sólidos).
- **Tráfico IA:** circula por el carril derecho de las calles interiores, de cruce en cruce (cruces `k = 1..4`, tiles `8k` y `8k+1`); en cada cruce elige al azar una salida que no sea media vuelta ni salga de la cuadrícula. Persecución de un punto objetivo (`waypoint`), frena a `TRAFFIC_TURN_SPEED` antes de girar, se para si hay algo delante (coche o persona) pero como mucho `MAX_WAIT` s (evita bloqueos), y si se queda atascado contra una pared da marcha atrás. Aparece en el carril entre dos cruces, fuera de cámara y lejos de otros coches. Los coches de tráfico atascados fuera de cámara (`STUCK_REMOVE_TIME`) y los abandonados (`driver === null`) fuera de cámara se eliminan; el spawner mantiene `TRAFFIC_COUNT` coches de tráfico.
- **Robar:** se entra en el coche cuya carrocería esté más cerca (≤ `ENTER_DISTANCE` desde el centro del jugador). Se puede robar cualquier coche, también uno con `isPolice`. Al salir, el coche queda aparcado (`driver = null`) y sigue rodando hasta pararse por fricción; si no hay hueco libre no se puede salir.
- **Policía (F6):** un coche patrulla es un `Car` con `isPolice = true`, `driver = 'ai'` y su propio `ai`; la física, colisiones y empujes son los mismos. El 50 % de daño dentro del coche lo aplica F6 leyendo `player.inCar`.
- Valores en `CONFIG.CAR` (ver `config.js`): `BRAKE` 600, `TURN_FULL_SPEED` 120, `BOUNCE` 0,3, `CRASH_SPEED` 100, `CRASH_COOLDOWN` 0,5, `CAR_HIT_DAMPING` 0,7, `TRAFFIC_SPEED` 150, `TRAFFIC_TURN_SPEED` 80, `TRAFFIC_GAP` 30, `TURN_START` 44, `WAYPOINT_REACHED` 20, `TURN_SLOWDOWN_DIST` 140, `MAX_WAIT` 3, `STUCK_TIME` 1,5, `REVERSE_TIME` 0,8, `STUCK_REMOVE_TIME` 8.

## Tests
`tests/car.test.js`: aceleración, velocidad máxima y fricción; freno y marcha atrás limitada; giro proporcional a la velocidad; no atraviesa edificios y emite `carCrash`; separación de coches; `E` entra (el conductor huye, `carEnter`) y sale a un hueco libre (`carExit`); `E` sin coche cerca no hace nada; conducir mueve el coche, el jugador lo sigue, no dispara ni recoge pickups; atropello por encima del umbral mata, puntúa y emite `runOver`, por debajo solo empuja; 30 s de tráfico sin salir de la calzada ni atravesar edificios, sin atascarse ni matar a nadie; el hook `ai` sustituye a la IA de tráfico.
