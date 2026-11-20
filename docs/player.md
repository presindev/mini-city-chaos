# src/entities/player.js
**Responsabilidad:** el jugador: a pie (WASD, mira al ratón, colisión con edificios, armas), conduciendo (entrar/salir con `E`) y recibiendo daño.
**Depende de:** `CONFIG`, `Utils`, `CityMap`, `Weapons` (y `Car`, `Pedestrian` a través de `game`).

## API pública
### `Player` (clase)
- `new Player(x, y)`: en píxeles de mundo. Propiedades: `x`, `y`, `radius` (12), `speed` (160 px/s), `health` (100), `angle` (radianes, 0 = mirando a +x), `inventory` (ver `weapons.md`; empieza solo con puños), `inCar` (`null` o el `Car` que conduce), `hurtTimer` (> 0: parpadea en rojo), `dead`.
- `player.update(dt, game)`: usa `game.input` (`isDown`, `wasPressed`, `wheel`, `mouse`) y `game.camera` (para pasar el ratón a mundo). `1`/`2`/`3` seleccionan arma, la rueda las recorre y mantener el clic izquierdo dispara (`Weapons.fire`).
- `player.drive(dt, game)`: con `inCar`, W/S/A/D van a `car.controls`; se puede cambiar de arma pero no disparar. `Car.update` mantiene `player.x/y/angle` sobre el coche.
- `player.enterNearestCar(game)` (coche a ≤ 50 px; el conductor IA sale huyendo; emite `carEnter`; no se puede entrar en coches que arden ni en chatarra, MCC-001) y `player.exitCar(game)` (sale al primer hueco libre a un lado; emite `carExit`). `E` alterna entre ambos.
- `player.forceExit(game)` (MCC-001): lo llama `Game.explodeCar` si el coche explota con el jugador dentro. Lo pone en el primer hueco libre junto al coche (o en su centro si no hay) y deja el coche sin conductor. No emite `carExit` (el evento es la explosión).
- `player.takeDamage(amount) → number`: resta vida (×0,5 si `inCar`), marca `dead` a 0. Al explotar su coche recibe el daño completo de la explosión, porque ya está fuera. Los eventos y el Game Over los gestiona `Game.damagePlayer`.
- `player.draw(ctx, camera)`: no dibuja nada si va en coche; si no, círculo azul con cabeza, una "mano" delante que indica hacia dónde mira y un cañón negro si lleva pistola (corto) o escopeta (largo).

## Detalles / decisiones
- El vector de movimiento se normaliza: en diagonal no se va más rápido.
- El movimiento se resuelve con `CityMap.moveCircle` (desliza por las paredes). No puede salir del mapa porque el borde es muro.
- Aparece en el centro del tile `CONFIG.PLAYER.SPAWN_TILE` (18, 20), una acera cerca del centro del mapa.
- Dentro del coche las balas no le llegan: se paran en la carrocería y dañan el coche (MCC-001). Si el coche empieza a arder, tiene `CAR.BURN_TIME` (3 s) para salir con `E` antes de que explote.
- Sin regeneración ni pickups de vida (decisión de diseño). Al recibir daño parpadea en rojo `EFFECTS.HURT_FLASH_TIME` (0,4 s).

## Tests
`tests/player.test.js`: velocidad correcta y diagonal no más rápida, no atraviesa edificios, mira al ratón en coordenadas de mundo. Las armas se prueban en `tests/weapons.test.js`, el coche en `tests/car.test.js`, el daño en `tests/police.test.js` y la salida forzada y el bloqueo de entrada en `tests/car-damage.test.js`.
