# src/input.js
**Responsabilidad:** guardar el estado del teclado, el ratón y la rueda para que el juego lo consulte en cada frame.
**Depende de:** nada (usa los eventos del DOM en `init`).

## API pública
- `Input.init(canvas, target = window)`: registra los listeners.
- `Input.isDown(code) → boolean`: tecla mantenida. `code` es `KeyboardEvent.code` (`'KeyW'`, `'Digit1'`, `'Enter'`, `'KeyP'`...).
- `Input.wasPressed(code) → boolean`: tecla pulsada en este frame (ignora la autorrepetición).
- `Input.mouse.{x, y}`: posición en píxeles del canvas (corrige el escalado CSS). Pasar a coordenadas de mundo es trabajo de la cámara (F2).
- `Input.mouse.down`: botón izquierdo mantenido; `Input.mouse.clicked`: pulsado en este frame.
- `Input.wheel`: `-1`, `0` o `+1` en este frame.
- `Input.endFrame()`: limpia los datos por frame. Lo llama `main.js` al final de cada frame.

## Detalles / decisiones
- Se usa `e.code` (posición física de la tecla), así WASD funciona igual con cualquier distribución de teclado.
- Al perder el foco la ventana (`blur`) se sueltan todas las teclas para que ninguna se quede "pegada".
- Se bloquean el menú contextual del canvas, el scroll de la rueda sobre el canvas y el scroll con flechas/espacio.

## Tests
Sin tests automáticos (depende del DOM); comprobado con una prueba rápida en Node simulando eventos. Prueba manual en el navegador.
