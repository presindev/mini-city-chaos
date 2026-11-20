# src/entities/pedestrian.js
**Responsabilidad:** peatón NPC: deambula por aceras y parques, huye cuando se asusta o recibe daño y deja un cadáver temporal al morir.
**Depende de:** `CONFIG`, `Utils`, `CityMap`.

## API pública
### `Pedestrian` (clase)
- `new Pedestrian(x, y, rng?)`: color aleatorio de `CONFIG.PEDESTRIAN.COLORS`; `rng` inyectable para tests.
- Propiedades: `x`, `y`, `radius` (10), `health` (30), `angle`, `fleeing` (getter), `dead`, `remove` (el juego lo quita de su lista cuando es `true`).
- `ped.scare(fromX, fromY)`: huye en dirección contraria a 140 px/s durante 4 s.
- `ped.takeDamage(amount, fromX?, fromY?) → boolean`: devuelve `true` si este golpe lo mata. Si sobrevive, huye del punto dado.
- `ped.update(dt)`, `ped.draw(ctx, camera)`.

## Detalles / decisiones
- Tranquilo, no pisa la calzada: si el punto de delante no es acera/parque (`CityMap.isWalkable`), elige otra dirección. Huyendo **sí** puede cruzar la calzada; si acaba en la calle, sigue andando hasta volver a una acera.
- Cambia de dirección cada 2–4 s o al chocar (se usa `CityMap.moveCircle`, como el jugador).
- Al morir queda una mancha roja `CORPSE_TIME` (5 s) que se desvanece en el último segundo, y después `remove = true`.
- Huyendo se dibuja con el borde rojo.
- Los puntos por matarlo no los da el peatón sino `Game.damagePedestrian` (+10).

## Tests
`tests/pedestrian.test.js`: tranquilos nunca entran en edificios ni en la calzada; `scare` (dirección, velocidad, duración); `takeDamage` y desaparición del cadáver; el juego mantiene 25 vivos aparecidos fuera de cámara y suma puntos; `scareAt` respeta el radio.
