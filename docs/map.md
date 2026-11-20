# src/map.js
**Responsabilidad:** generar la ciudad (cuadrícula de tiles determinista), responder consultas de tiles/colisiones y dibujar los tiles visibles.
**Depende de:** `CONFIG`, `Utils`.

El objeto global se llama **`CityMap`** (no `Map`, para no tapar el `Map` nativo de JavaScript). La ciudad se genera al cargar el script.

## API pública
- `CityMap.cols`, `CityMap.rows` (40×40), `CityMap.width`, `CityMap.height` (2560×2560 px), `CityMap.tiles` (`Uint8Array`, índice `ty * cols + tx`).
- `CityMap.generate()`: rellena `tiles` (se llama sola al cargar).
- `CityMap.tileAt(tx, ty)`: tipo de tile según las reglas del trazado (lo usa `generate`).
- `CityMap.getTile(tx, ty)`: tipo de tile; fuera del mapa devuelve `BUILDING`.
- `CityMap.worldToTile(x)`: píxel de mundo → índice de tile.
- `CityMap.tileCenter(tx, ty) → {x, y}`: centro de un tile en píxeles de mundo.
- `CityMap.isSolid(x, y)`, `CityMap.isRoad(x, y)`, `CityMap.isWalkable(x, y)` (acera o parque; para peatones): consultas en píxeles de mundo.
- `CityMap.randomTileOfType(type, rng?) → {tx, ty} | null`: tile aleatorio del tipo pedido (`rng` inyectable para tests).
- `CityMap.circleHitsSolid(x, y, r)`: si un círculo toca algún tile sólido.
- `CityMap.moveCircle(x, y, r, dx, dy) → {x, y}`: mueve un círculo sin entrar en edificios, deslizándose por las paredes. Lo usará cualquier entidad que camine (jugador, peatones, policía).
- `CityMap.draw(ctx, camera)`: dibuja solo los tiles visibles (`camera.x/y` = esquina superior izquierda en el mundo).

## Detalles / decisiones
- Trazado: cada 8 tiles, 2 de calzada + manzana de 6×6 (anillo de acera + 4×4 de edificio). El borde (fila/columna 0 y 39) es muro y tiene prioridad, así que la última fila/columna de manzanas pega directamente al muro (sin acera exterior) y la calle superior/izquierda solo tiene 1 tile de ancho.
- Parques: las manzanas de `CONFIG.MAP.PARK_BLOCKS` (`[1, 3]` y `[3, 1]`, en coordenadas de manzana) tienen el interior `PARK`.
- `moveCircle` avanza en sub-pasos de ≤ 2 px y prueba cada eje por separado: si un eje choca, ese eje no avanza pero el otro sí (deslizamiento). Se queda como mucho a 2 px de la pared.
- Dibujo: colores en `CONFIG.MAP.COLORS`; línea discontinua amarilla en el centro de las calles (no en cruces); tejados con un color por manzana y borde oscuro; árboles en los parques en tiles alternos; el muro exterior en gris oscuro.

## Tests
`tests/map.test.js`: borde sólido, fuera de rango sólido, patrón de 8 tiles, los 2 parques, todas las calzadas conectadas, conversiones píxel→tile, `randomTileOfType`, tile de aparición del jugador es acera y `moveCircle` (se para en la pared y desliza).
