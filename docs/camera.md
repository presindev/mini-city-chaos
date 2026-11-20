# src/camera.js
**Responsabilidad:** cámara que sigue a un objetivo, limitada a los bordes del mapa, y conversión entre coordenadas de mundo y de pantalla.
**Depende de:** `CONFIG`, `Utils`.

## API pública
### `Camera` (clase)
- `new Camera(mapWidth, mapHeight, viewWidth?, viewHeight?)`: la vista por defecto es la pantalla (960×640).
- `camera.x`, `camera.y`: posición en el mundo de la esquina superior izquierda de la pantalla.
- `camera.follow(targetX, targetY)`: centra la cámara en el objetivo sin salirse del mapa.
- `camera.worldToScreen(x, y) → {x, y}` y `camera.screenToWorld(x, y) → {x, y}`.

## Detalles / decisiones
- Sin suavizado: se centra exactamente en el objetivo cada frame (lo más simple; se puede añadir en F8).
- `Game` llama a `follow` tras actualizar al jugador. En F5 seguirá al coche cuando el jugador conduzca.
- El ratón (`Input.mouse`, en píxeles de canvas) se pasa a mundo con `screenToWorld`.

## Tests
`tests/camera.test.js`: centrado, límites del mapa y conversiones inversas.
