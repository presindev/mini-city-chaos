# src/config.js
**Responsabilidad:** concentrar en el objeto global `CONFIG` todas las constantes del juego.
**Depende de:** nada.

## API pública
- `CONFIG.SCREEN_WIDTH`, `CONFIG.SCREEN_HEIGHT`: tamaño del canvas (960×640).
- `CONFIG.MAX_DT`: límite del `dt` por frame (0,05 s).
- `CONFIG.TILE_SIZE`, `CONFIG.MAP_COLS`, `CONFIG.MAP_ROWS`, `CONFIG.MAP.*`: tamaño del mapa y del patrón de manzanas; `MAP.PARK_BLOCKS` (manzanas que son parque, en coordenadas de manzana) y `MAP.COLORS` (colores del dibujo del mapa).
- `CONFIG.TILE.{ROAD, SIDEWALK, BUILDING, PARK}`: códigos numéricos de tile.
- `CONFIG.PLAYER` (incluye `SPAWN_TILE`, el tile de aparición), `CONFIG.WEAPONS.{FISTS, PISTOL, SHOTGUN}`, `CONFIG.PICKUPS` (`RESPAWN_TIME`, `RADIUS`, `PISTOL_TILES`, `SHOTGUN_TILES`), `CONFIG.EFFECTS` (duración del golpe y del destello), `CONFIG.SCARE_RADIUS`.
- `CONFIG.CAR`, `CONFIG.PEDESTRIAN` (incluye `CORPSE_TIME`, `PARK_SPAWN_CHANCE`, `SPAWN_MARGIN`, `COLORS`), `CONFIG.WANTED`, `CONFIG.POLICE`, `CONFIG.SCORE`, `CONFIG.HIGHSCORE_KEY`.

## Detalles / decisiones
- Unidades: segundos, píxeles de mundo, px/s; los ángulos de armas (`ARC`, `SPREAD`) en grados.
- `WANTED.FOOT_COPS` y `WANTED.PATROL_CARS` son arrays indexados por número de estrellas (0–3).
- Valores elegidos aquí (ajustables en F8): `CAR.FRICTION` = 200 px/s², `CAR.TURN_RATE` = 3 rad/s a velocidad máxima, `PICKUPS.RADIUS` = 14 px, `POLICE.RADIUS` = 12 px, `BULLET_SPEED` de la escopeta = 700 px/s.

- F2: `MAP.PARK_COUNT` se sustituyó por `MAP.PARK_BLOCKS` (`[1, 3]` y `[3, 1]`) para fijar qué manzanas son parque; se añadió `PLAYER.SPAWN_TILE` = `{tx: 18, ty: 20}`.
- F5–F8 (detalle en cada página): `CAR` (frenado, giro hasta `TURN_FULL_SPEED`, choques, IA de tráfico; ver [`car.md`](car.md)), `POLICE` (balas, puntería, distancias, aparición y coches patrulla `RAM_MIN_SPEED`, `PATROL_*`; ver [`police.md`](police.md)), `HUD` (ver [`hud.md`](hud.md)), `AUDIO` y nuevas `EFFECTS` (partículas, parpadeo; ver [`audio.md`](audio.md)).
- **Balanceo (8.4):** `POLICE.DAMAGE` 10→6, `FIRE_COOLDOWN` 1→1,5 s, `AIM_ERROR` 8→12°, `RAM_DAMAGE_ON_FOOT` 25→20, `RAM_COOLDOWN` 1→2 s, `WEAPONS.SHOTGUN.SPREAD` 30→20°. Elegidos simulando cuánto aguanta un jugador quieto (~30 s con 1★, ~11 s con 2★, ~7 s con 3★).
- **MCC-001 (daño y explosiones de coches)**, solo claves nuevas:
  - `CAR.HEALTH` = 100 (vida inicial), `CAR.SMOKE_HEALTH` = 50 (echa humo con vida ≤ este valor), `CAR.BURN_TIME` = 3 s (arde a 0 de vida antes de explotar), `CAR.EXPLOSION_RADIUS` = 110 px, `CAR.EXPLOSION_DAMAGE` = 80 (en el centro; cae linealmente a 0 en el radio), `CAR.CRASH_DAMAGE_FACTOR` = 0,1 (vida perdida por cada px/s de velocidad perdida en un `carCrash`), `CAR.WRECK_TIME` = 15 s (lo que dura la chatarra).
  - `SCORE.CAR` = 20 (coche civil destruido por el jugador), `SCORE.PATROL_CAR` = 100 (coche patrulla destruido por el jugador).
  - `EFFECTS.SMOKE_RATE` = 6 partículas/s, `SMOKE_SPEED` = 25, `SMOKE_TIME` = 1,2 s, `SMOKE_COLORS` (grises); `EFFECTS.FIRE_RATE` = 18 partículas/s, `FIRE_SPEED` = 50, `FIRE_TIME` = 0,5 s, `FIRE_COLORS` (amarillo a rojo); `EFFECTS.EXPLOSION_COUNT` = 40 partículas, `EXPLOSION_SPEED` = 280, `EXPLOSION_TIME` = 0,7 s, `EXPLOSION_COLORS` (fuego y humo). Humo y llamas solo en coches en pantalla. Ver [`car.md`](car.md) y [`audio.md`](audio.md).
- F3/F4: `PICKUPS.PISTOL_COUNT`/`SHOTGUN_COUNT` se sustituyeron por las listas de tiles `PISTOL_TILES`/`SHOTGUN_TILES`. Nuevos: `PEDESTRIAN.CORPSE_TIME` = 5 s, `PARK_SPAWN_CHANCE` = 0,15, `SPAWN_MARGIN` = 64 px, `EFFECTS.SWING_TIME` = 0,15 s, `EFFECTS.FLASH_TIME` = 0,06 s.

## Tests
Sin tests propios; lo usan los tests de otros módulos.
