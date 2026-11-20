# src/utils.js
**Responsabilidad:** funciones matemáticas y de colisión puras (sin DOM).
**Depende de:** nada.

## API pública
- `Utils.clamp(value, min, max) → number`
- `Utils.lerp(a, b, t) → number`
- `Utils.dist(x1, y1, x2, y2) → number`: distancia euclídea.
- `Utils.angleTo(x1, y1, x2, y2) → number`: ángulo en radianes hacia el punto 2 (0 = derecha, π/2 = abajo, porque la Y de pantalla crece hacia abajo).
- `Utils.randRange(min, max, rng = Math.random) → number`: aleatorio en `[min, max)`; `rng` se puede inyectar para tests deterministas.
- `Utils.circleRectCollide(cx, cy, r, x, y, w, h) → boolean`: círculo contra rectángulo alineado con los ejes.
- `Utils.circleCircleCollide(x1, y1, r1, x2, y2, r2) → boolean`
- `Utils.rectsOverlap(a, b) → boolean`: rectángulos `{x, y, w, h}`.

## Detalles / decisiones
- En todas las colisiones, **tocarse justo en el borde no cuenta** como colisión (comparaciones estrictas). Así una entidad pegada a una pared puede deslizarse sin quedarse enganchada.

## Tests
`tests/utils.test.js`: todas las funciones, incluidos casos de borde y esquina.
