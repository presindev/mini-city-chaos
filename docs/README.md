# Documentación del código — Mini City Chaos

Índice de la documentación técnica. Hay **una página por módulo** de `src/`. Cada sesión que cree o modifique un módulo debe crear/actualizar su página y la fila correspondiente de esta tabla.

## Visión general

Juego top-down en HTML5 Canvas y JavaScript puro. `index.html` carga los scripts de `src/` en orden; cada script expone un objeto/clase global (y lo exporta con `module.exports` para los tests de Node). `main.js` crea la instancia de `Game`, que mantiene el estado (`menu`, `playing`, `paused`, `gameover`) y ejecuta el bucle `update(dt)` → `draw(ctx)`.

Flujo de un frame:
1. `Input` recoge teclado/ratón; `main.js` gestiona `M` (silencio) y desbloquea el audio.
2. `Game.update(dt)` (en `playing`): tiempo/puntos → jugador (a pie o conduciendo) → coches (`Car.updateAll`) → cámara → balas → peatones → spawner de peatones → policías → nivel de búsqueda → spawner de policías y coches patrulla → pickups → efectos.
3. Los sistemas se comunican con eventos (`game.on`/`game.emit`, ver [`game.md`](game.md)): `Wanted`, `Sound` y `Effects` reaccionan a lo que pasa.
4. `Game.draw(ctx)`: mapa (tiles visibles) → pickups → cadáveres → peatones → coches → policías → jugador → balas → efectos → HUD/minimapa; menú, pausa y Game Over en `Hud`.

## Módulos

| Módulo | Página | Estado | Feature |
|---|---|---|---|
| `src/config.js` | [`config.md`](config.md) | hecho | F1–F8 |
| `src/utils.js` | [`utils.md`](utils.md) | hecho | F1 |
| `src/input.js` | [`input.md`](input.md) | hecho | F1 |
| `src/game.js`, `src/main.js` | [`game.md`](game.md) | hecho | F1–F8 |
| `src/map.js` (`CityMap`) | [`map.md`](map.md) | hecho (+ `isWalkable` en F3) | F2, F3 |
| `src/camera.js` | [`camera.md`](camera.md) | hecho | F2 |
| `src/entities/player.js` | [`player.md`](player.md) | hecho (a pie, armas, coche, daño) | F2, F4–F6, F8 |
| `src/entities/pedestrian.js` | [`pedestrian.md`](pedestrian.md) | hecho | F3 |
| `src/weapons.js`, `bullet.js`, `pickup.js` | [`weapons.md`](weapons.md) | hecho | F4 |
| `src/entities/car.js` | [`car.md`](car.md) | hecho | F5 |
| `src/wanted.js`, `src/entities/police.js` (+ coches patrulla) | [`police.md`](police.md) | hecho | F6 |
| `src/hud.js` | [`hud.md`](hud.md) | hecho | F7 |
| `src/audio.js` (`Sound`), `src/effects.js` (`Effects`) | [`audio.md`](audio.md) | hecho | F8 |

## Plantilla para una página de módulo

```markdown
# <archivo>
**Responsabilidad:** una frase.
**Depende de:** otros módulos globales que usa.
## API pública
- `nombre(params) → retorno`: descripción.
## Detalles / decisiones
## Tests
Archivo de tests y qué cubren (o "sin tests: prueba manual").
```
