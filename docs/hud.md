# src/hud.js
**Responsabilidad:** dibuja el HUD de la partida, el minimapa y las pantallas de inicio, pausa y Game Over; guarda y carga el récord.
**Depende de:** `CONFIG` (sección `HUD`, `HIGHSCORE_KEY`, `WEAPONS`, `WANTED.MAX_STARS`), `CityMap`, `Weapons`.

## API pública
### Funciones puras (testeadas)
- `Hud.formatTime(seconds) → 'mm:ss'`: redondea hacia abajo; los negativos dan `'00:00'`.
- `Hud.defaultStorage() → Storage | null`: `window.localStorage`, o `null` en Node o si el acceso lanza una excepción (Safari con las cookies bloqueadas, por ejemplo).
- `Hud.loadHighscore(storage?) → number`: lee `CONFIG.HIGHSCORE_KEY`; 0 si no hay valor, no es un número o el almacenamiento lanza una excepción. Si `storage` es `undefined`, usa `defaultStorage()`.
- `Hud.saveHighscore(score, storage?) → boolean`: guarda `floor(score)`; `false` si no se pudo. Nunca lanza.

### Dibujo (solo usan `ctx`)
- `Hud.draw(ctx, game)`: HUD de la partida = `drawStatus` + `drawScore` + `drawMinimap`. Lo llama `game.drawWorld` al final.
- `Hud.drawStatus(ctx, game)`: panel arriba a la izquierda: barra de vida (verde/amarilla/roja según el %), arma actual + munición (`∞` para los puños), casillas `1 Puños · 2 Pistola · 3 Escopeta` (resaltada la actual, apagadas las que no se tienen). Si `player.inCar` existe, muestra debajo de la vida la barra de vida del coche (`drawCarBar`; el panel crece 20 px y el resto de filas baja) y "EN COCHE (E: salir)".
- `Hud.drawCarBar(ctx, car, game, x, y, w)` (MCC-001): barra de 12 px con el texto "COCHE <vida>"; azul por encima de `CAR.SMOKE_HEALTH` y naranja por debajo. Mientras el coche arde, parpadea en rojo con "¡COCHE EN LLAMAS!".
- `Hud.drawScore(ctx, game)`: arriba a la derecha: estrellas de búsqueda (`game.wanted ? game.wanted.stars : 0`, de `CONFIG.WANTED.MAX_STARS`), puntos y tiempo sobrevivido.
- `Hud.drawMinimap(ctx, game)`: abajo a la derecha (`HUD.MINIMAP_SIZE` px): ciudad, rectángulo de la vista de la cámara, coches patrulla (`isPolice` y que no sean chatarra, cuadrados azules; MCC-001: la chatarra de un patrulla no se dibuja), policías a pie vivos (`game.police || []`, puntos azules) y jugador (punto amarillo; usa la posición de `player.inCar` si conduce).
- `Hud.getMinimapCanvas()`: pre-renderiza la ciudad una sola vez en un canvas fuera de pantalla (1 tile = 4 px). Devuelve `null` si no hay `document` (Node).
- `Hud.drawMenu(ctx, game)`: título, lema, lista de controles, "Pulsa Enter para empezar" (parpadea) y `game.highscore`.
- `Hud.drawPause(ctx, game)`: oscurece el mundo, panel con "PAUSA" y los controles.
- `Hud.drawGameOver(ctx, game)`: oscurece el mundo, panel con puntos, tiempo, récord, "¡Nuevo récord!" si `game.newRecord`, y "Pulsa Enter para reiniciar".
- Ayudantes: `drawStar`, `dim`, `text`, `drawControls`.

## Detalles / decisiones
- Lee los datos de F5/F6 (`game.wanted`, `game.police`, `game.cars`, `player.inCar`) de forma defensiva: el HUD funciona aunque aún no existan.
- Textos en pantalla en español; colores y medidas en `CONFIG.HUD`.
- El récord se guarda en `gameOver()` de `Game` (transición a `'gameover'`), no al morir.
- El mapa del minimapa es estático (el trazado es determinista), por eso se dibuja una sola vez.

## Tests
`tests/hud.test.js`: `formatTime`, carga/guardado del récord con almacenamiento falso, almacenamiento que lanza excepciones, y que en Node no hay almacenamiento por defecto ni canvas de minimapa. La integración con `Game` (puntos por segundo, récord, reinicio limpio) está en `tests/game.test.js`. El dibujo (incluida la barra del coche de MCC-001) se prueba a mano; que el minimapa no dibuje la chatarra de los patrullas se prueba en `tests/car-damage.test.js`.
